import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { PlatformError, fail } from './store.ts';
export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}
export interface GatewayResponse {
  status: number;
  contentType: string;
  encoding?: string;
  body: Buffer;
}
export type GatewayTransport = (
  url: URL,
  headers: Record<string, string>,
  address: ResolvedAddress,
  signal: AbortSignal,
) => Promise<GatewayResponse>;
export interface GatewayOptions {
  allowedHosts?: string[];
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  transport?: GatewayTransport;
  timeoutMs?: number;
  minuteLimit?: number;
}
const blocked = new BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(ip, prefix);
for (const [ip, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
] as const)
  blocked.addSubnet(ip, prefix, 'ipv6');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
export function publicAddress(value: ResolvedAddress) {
  if (isIP(value.address) !== value.family) return false;
  return value.family === 4
    ? !blocked.check(value.address)
    : global6.check(value.address, 'ipv6') && !blocked.check(value.address, 'ipv6');
}
export function httpsTransport(request: typeof httpsRequest = httpsRequest): GatewayTransport {
  return (url, headers, address, signal) =>
    new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'GET',
          headers,
          agent: false,
          servername: url.hostname,
          family: address.family,
          lookup: (_hostname, _options, callback) =>
            callback(null, address.address, address.family),
          signal,
          rejectUnauthorized: true,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          res.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 262144) {
              res.destroy(
                new PlatformError(502, 'La respuesta externa supera el límite permitido'),
              );
              return;
            }
            chunks.push(chunk);
          });
          res.on('error', reject);
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 502,
              contentType: String(res.headers['content-type'] ?? ''),
              encoding: String(res.headers['content-encoding'] ?? ''),
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.setTimeout(5000, () =>
        req.destroy(new PlatformError(504, 'El proveedor tardó demasiado en responder')),
      );
      req.on('error', reject);
      req.end();
    });
}
export class ExternalGateway {
  readonly hosts: Set<string>;
  private readonly resolver: NonNullable<GatewayOptions['resolve']>;
  private readonly transport: GatewayTransport;
  private readonly timeout: number;
  private readonly limit: number;
  private inFlight = 0;
  private readonly projects = new Map<string, { start: number; count: number; active: number }>();
  constructor(options: GatewayOptions = {}) {
    this.hosts = new Set(
      (options.allowedHosts ?? (process.env.CONNECTOR_ALLOWED_HOSTS ?? '').split(','))
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    );
    this.resolver =
      options.resolve ??
      (async (host) => (await lookup(host, { all: true, verbatim: true })) as ResolvedAddress[]);
    this.transport = options.transport ?? httpsTransport();
    this.timeout = options.timeoutMs ?? 8000;
    this.limit = options.minuteLimit ?? 60;
  }
  origin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      fail(400, 'Usa un origen HTTPS válido');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      url.port ||
      isIP(url.hostname) ||
      !url.hostname.includes('.') ||
      !/^[a-z0-9.-]+$/.test(url.hostname)
    )
      fail(400, 'Usa solo el origen HTTPS de un dominio, sin ruta, puerto ni credenciales');
    if (!this.hosts.has(url.hostname))
      fail(403, 'El dominio no está autorizado en CONNECTOR_ALLOWED_HOSTS del servidor');
    return url.origin;
  }
  private acquire(projectId: string) {
    const now = Date.now();
    for (const [key, value] of this.projects)
      if (now - value.start > 60000 && !value.active) this.projects.delete(key);
    const state = this.projects.get(projectId) ?? { start: now, count: 0, active: 0 };
    if (now - state.start > 60000) {
      state.start = now;
      state.count = 0;
    }
    if (state.count >= this.limit || state.active >= 2 || this.inFlight >= 10)
      fail(429, 'Se alcanzó el límite de consultas externas. Vuelve a intentar en un momento.');
    state.count++;
    state.active++;
    this.inFlight++;
    this.projects.set(projectId, state);
    return () => {
      state.active--;
      this.inFlight--;
    };
  }
  private bounded<T>(promise: Promise<T>, signal: AbortSignal) {
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(new PlatformError(504, 'La consulta externa agotó su tiempo'));
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }
  async get(projectId: string, url: URL, headers: Record<string, string>) {
    this.origin(url.origin);
    if (url.username || url.password) fail(400, 'No se permiten credenciales en la URL');
    const release = this.acquire(projectId),
      controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const addresses = await this.bounded(this.resolver(url.hostname), controller.signal);
      if (!addresses.length || addresses.some((address) => !publicAddress(address)))
        fail(403, 'El dominio no resuelve exclusivamente a direcciones públicas permitidas');
      const address = [...addresses].sort((a, b) => a.family - b.family)[0];
      const response = await this.bounded(
        this.transport(
          url,
          { Accept: 'application/json', 'Accept-Encoding': 'identity', ...headers },
          address,
          controller.signal,
        ),
        controller.signal,
      );
      if (response.status >= 300 && response.status < 400)
        fail(502, 'El proveedor devolvió una redirección; no se sigue automáticamente');
      if (response.status < 200 || response.status >= 300)
        fail(502, 'El proveedor rechazó la consulta');
      if (
        !/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(response.contentType) ||
        (response.encoding && response.encoding.toLowerCase() !== 'identity')
      )
        fail(502, 'El proveedor no devolvió JSON sin compresión');
      if (response.body.length > 262144)
        fail(502, 'La respuesta externa supera el límite permitido');
      try {
        return JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(response.body),
        ) as unknown;
      } catch {
        fail(502, 'El proveedor devolvió un JSON inválido');
      }
    } catch (error) {
      if (error instanceof PlatformError) throw error;
      fail(
        controller.signal.aborted ? 504 : 502,
        controller.signal.aborted
          ? 'La consulta externa agotó su tiempo'
          : 'No se pudo completar la comunicación con el proveedor',
      );
    } finally {
      clearTimeout(timer);
      release();
    }
  }
}
