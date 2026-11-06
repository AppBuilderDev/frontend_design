import type { createPlatform } from './platform/http.ts';
import { blockInputSchema } from '../src/models/blocks.ts';
import type { BlockRepository } from './blocksRepository.ts';
import { createServer, type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pageInputSchema, validTree } from '../src/models/contracts.ts';
import type { PageRepository } from './repository.ts';
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    totalBytes += buf.length;
    if (totalBytes > 1_000_000) throw new HttpError(413, 'Definición demasiado grande');
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}
export function createApi(
  repository: PageRepository,
  origins: string[],
  blocks: BlockRepository,
  platform?: ReturnType<typeof createPlatform>,
  legacyEnabled = true,
) {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (origin && !origins.includes(origin)) {
      res.writeHead(403);
      res.end(JSON.stringify({ message: 'Origen no permitido' }));
      return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    const send = (status: number, data: unknown) => {
      res.writeHead(status);
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;
      if (platform && (await platform(req, res, url, () => body(req)))) return;
      if (!legacyEnabled)
        throw new HttpError(404, 'La API anterior está deshabilitada. Usa /api/v1.');
      if (path === '/api/blocks' && req.method === 'GET') {
        send(200, await blocks.list());
        return;
      }
      if (path === '/api/blocks' && req.method === 'POST') {
        const parsed = blockInputSchema.safeParse(await body(req));
        if (!parsed.success)
          throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
        const block = { ...parsed.data, id: randomUUID(), createdAt: new Date().toISOString() };
        await blocks.transact((items) => {
          items.push(block);
        });
        send(201, block);
        return;
      }
      const blockMatch = /^\/api\/blocks\/([^/]+)$/.exec(path);
      if (blockMatch && req.method === 'DELETE') {
        await blocks.transact((items) => {
          const index = items.findIndex((item) => item.id === blockMatch[1]);
          if (index < 0) throw new HttpError(404, 'Bloque no encontrado');
          items.splice(index, 1);
        });
        res.writeHead(204);
        res.end();
        return;
      }
      if (path === '/api/public/pages/by-path' && req.method === 'GET') {
        const value = url.searchParams.get('path');
        const page = (await repository.list()).find(
          (p) => p.published && '/' + p.published.code === value,
        )?.published;
        if (!page) throw new HttpError(404, 'Página no encontrada');
        send(200, page);
        return;
      }
      if (path === '/api/pages' && req.method === 'GET') {
        send(
          200,
          (await repository.list()).map((p) => p.draft),
        );
        return;
      }
      const match = /^\/api\/pages\/([^/]+)$/.exec(path);
      const id = match?.[1];
      if (id && req.method === 'GET') {
        const page = (await repository.list()).find((p) => p.draft.id === id);
        if (!page) throw new HttpError(404, 'Página no encontrada');
        send(200, page.draft);
        return;
      }
      if ((path === '/api/pages' && req.method === 'POST') || (id && req.method === 'PUT')) {
        const parsed = pageInputSchema.safeParse(await body(req));
        if (!parsed.success)
          throw new HttpError(400, parsed.error.issues.map((i) => i.message).join('; '));
        const input = parsed.data;
        if (!validTree(input.components))
          throw new HttpError(400, 'Árbol inválido: IDs duplicados o límites excedidos');
        const page = await repository.transact((pages) => {
          const existing = id ? pages.find((p) => p.draft.id === id) : undefined;
          if (id && !existing) throw new HttpError(404, 'Página no encontrada');
          if (
            pages.some(
              (p) =>
                p.draft.id !== id &&
                (p.draft.code === input.code || p.published?.code === input.code),
            )
          )
            throw new HttpError(409, 'El código ya está en uso');
          const now = new Date().toISOString();
          const draft = {
            ...input,
            id: existing?.draft.id ?? randomUUID(),
            createdAt: existing?.draft.createdAt ?? now,
            updatedAt: now,
          };
          if (existing) {
            existing.draft = draft;
            if (input.status === 'published') existing.published = structuredClone(draft);
          } else
            pages.push({
              draft,
              ...(input.status === 'published' ? { published: structuredClone(draft) } : {}),
            });
          return draft;
        });
        send(id ? 200 : 201, page);
        return;
      }
      if (id && req.method === 'DELETE') {
        await repository.transact((pages) => {
          const index = pages.findIndex((p) => p.draft.id === id);
          if (index < 0) throw new HttpError(404, 'Página no encontrada');
          pages.splice(index, 1);
        });
        res.writeHead(204);
        res.end();
        return;
      }
      throw new HttpError(404, 'Endpoint no encontrado');
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      send(status, {
        message: status === 500 ? 'Error de persistencia del servidor' : (error as Error).message,
      });
    }
  });
}
