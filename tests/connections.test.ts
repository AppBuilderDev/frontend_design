import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { request as HttpsRequest } from 'node:https';
import { PlatformStore } from '../server/platform/store';
import { ConnectionsStore } from '../server/platform/connections';
import { SecretVault } from '../server/platform/secretVault';
import {
  ExternalGateway,
  publicAddress,
  httpsTransport,
  type GatewayTransport,
  type GatewayResponse,
} from '../server/platform/externalGateway';
import { PlatformAuth } from '../server/platform/auth';
import { InventoryStore } from '../server/platform/inventory';
import { createPlatform } from '../server/platform/http';
import { createApi } from '../server/app';
import { JsonPageRepository } from '../server/repository';
import { JsonBlockRepository } from '../server/blocksRepository';
import { backupDatabase } from '../server/platform/backup';
import { setupConnections } from '../server/platform/setupConnections';
import type { ConnectionDefinition } from '../src/models/connections';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});
const raw = (value: unknown): GatewayResponse => ({
  status: 200,
  contentType: 'application/json',
  body: Buffer.from(JSON.stringify(value)),
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'builder-connections-')),
    file = join(dir, 'db.sqlite'),
    store = new PlatformStore(file),
    masterKey = randomBytes(32).toString('base64');
  const auth = new PlatformAuth(store),
    owner = await auth.register(
      {
        name: 'Owner',
        organization: 'External',
        email: 'owner@example.com',
        password: 'Clave-prueba-1234',
      },
      'test',
    );
  const project = owner.session.projects[0].id,
    userId = owner.session.user.id;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let responder: GatewayTransport = async (url) =>
    raw({
      items: [
        {
          id: 1,
          nombre: url.hostname.startsWith('prod') ? 'Producción' : 'Pruebas',
          precio: 1250,
          oculto: 'private',
        },
      ],
    });
  const options = {
    masterKey,
    allowedHosts: ['prod.example.test', 'test.example.test'],
    resolve: async () => [{ address: '1.1.1.1', family: 4 as const }],
    transport: async (...args: Parameters<GatewayTransport>) => {
      calls.push({ url: args[0].toString(), headers: args[1] });
      return responder(...args);
    },
  };
  const connections = new ConnectionsStore(store, options);
  const definition: ConnectionDefinition = {
    name: 'Catálogo',
    key: 'catalogo',
    inputs: [
      {
        key: 'consulta',
        label: 'Buscar',
        type: 'text',
        required: false,
        unique: false,
        options: [],
      },
    ],
    parameters: { q: 'consulta' },
    responseMode: 'list',
    responsePath: ['items'],
    fields: [
      { key: 'codigo', label: 'Código', type: 'integer', path: ['id'], required: true },
      { key: 'nombre', label: 'Nombre', type: 'text', path: ['nombre'], required: true },
      { key: 'precio', label: 'Precio', type: 'money', path: ['precio'], required: true },
    ],
    allowedRoles: ['admin', 'operator', 'viewer'],
  };
  const saved = connections.save(project, userId, { definition });
  const testSecret = 'test-private-credential',
    productionSecret = 'prod-private-credential';
  connections.configureEnvironment(project, userId, saved.id, 'test', {
    revision: 0,
    origin: 'https://test.example.test',
    path: '/catalog',
    auth: 'apiKey',
    secret: testSecret,
  });
  connections.configureEnvironment(project, userId, saved.id, 'production', {
    revision: 0,
    origin: 'https://prod.example.test',
    path: '/catalog',
    auth: 'bearer',
    secret: productionSecret,
  });
  const server = createApi(
    new JsonPageRepository(join(dir, 'pages.json')),
    ['http://localhost:5173'],
    new JsonBlockRepository(join(dir, 'blocks.json')),
    createPlatform(store, { connections: options }),
    false,
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Sin puerto');
  const base = 'http://127.0.0.1:' + address.port + '/api/v1';
  const call = (token: string, path: string, method = 'GET', data?: unknown) =>
    fetch(base + path, {
      method,
      headers: {
        Cookie: 'ab_session=' + token,
        'X-Requested-With': 'AppBuilderDev',
        'Content-Type': 'application/json',
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  cleanup.push(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    store.close();
    await rm(dir, { recursive: true, force: true });
  });
  const publish = async () => {
    await connections.test(project, userId, saved.id, {
      revision: saved.revision,
      environment: 'production',
      input: { consulta: 'demo' },
    });
    return connections.publish(project, userId, saved.id, { revision: saved.revision });
  };
  return {
    dir,
    file,
    masterKey,
    store,
    auth,
    owner,
    project,
    userId,
    connections,
    definition,
    saved,
    testSecret,
    productionSecret,
    calls,
    setResponder: (value: GatewayTransport) => (responder = value),
    publish,
    call,
    root: '/projects/' + project,
  };
}
it('cifra credenciales con contexto y conserva configuración sin devolver secretos', async () => {
  const { connections, store, project, userId, saved, testSecret, productionSecret, masterKey } =
    await setup();
  const rows = store.db.prepare('SELECT secret FROM connection_environments').all() as {
    secret: string;
  }[];
  expect(JSON.stringify(rows)).not.toContain(testSecret);
  expect(JSON.stringify(rows)).not.toContain(productionSecret);
  expect(JSON.stringify(connections.environments(project, userId, saved.id))).not.toContain(
    productionSecret,
  );
  expect(connections.environments(project, userId, saved.id).every((e) => e.secretConfigured)).toBe(
    true,
  );
  const vault = new SecretVault(masterKey),
    first = vault.encrypt('token-private', 'scope'),
    second = vault.encrypt('token-private', 'scope');
  expect(first).not.toBe(second);
  expect(vault.decrypt(first, 'scope')).toBe('token-private');
  expect(() => vault.decrypt(first, 'other-scope')).toThrow();
  expect(() =>
    new SecretVault(randomBytes(32).toString('base64')).decrypt(first, 'scope'),
  ).toThrow();
  expect(() => new SecretVault().encrypt('token', 'scope')).toThrow();
});
it('bloquea destinos privados, literales y DNS mixto antes de enviar credenciales', async () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '172.16.1.1',
    '192.168.1.1',
    '198.18.0.1',
    '203.0.113.1',
    '224.1.1.1',
  ])
    expect(publicAddress({ address, family: 4 })).toBe(false);
  for (const address of [
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::1',
  ])
    expect(publicAddress({ address, family: 6 })).toBe(false);
  expect(publicAddress({ address: '1.1.1.1', family: 4 })).toBe(true);
  expect(publicAddress({ address: '2001:4860:4860::8888', family: 6 })).toBe(true);
  let sent = 0;
  const gateway = new ExternalGateway({
    allowedHosts: ['api.example.test'],
    resolve: async () => [
      { address: '1.1.1.1', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ],
    transport: async () => {
      sent++;
      return raw([]);
    },
  });
  for (const origin of [
    'http://api.example.test',
    'https://127.0.0.1',
    'https://user:pass@api.example.test',
    'https://api.example.test/path',
    'https://api.example.test?token=x',
    'https://other.example.test',
  ])
    expect(() => gateway.origin(origin)).toThrow();
  await expect(
    gateway.get('project', new URL('https://api.example.test/list'), { Authorization: 'secret' }),
  ).rejects.toThrow('direcciones públicas');
  expect(sent).toBe(0);
});
it('fija DNS para el socket y conserva verificación TLS, límites y cabeceras propias', async () => {
  let captured: Record<string, unknown> = {};
  let pinned = '';
  const request = ((
    url: URL,
    options: Record<string, unknown>,
    callback: (res: unknown) => void,
  ) => {
    captured = options;
    expect(url.hostname).toBe('api.example.test');
    (
      options.lookup as (
        host: string,
        opts: unknown,
        cb: (error: unknown, address: string, family: number) => void,
      ) => void
    )('api.example.test', {}, (_e, address, family) => {
      pinned = address;
      expect(family).toBe(4);
    });
    const emitter = new EventEmitter();
    Object.assign(emitter, {
      setTimeout: () => emitter,
      end: () => {
        const stream = Object.assign(new PassThrough(), {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
        });
        callback(stream);
        stream.end(JSON.stringify({ ok: true }));
      },
    });
    return emitter;
  }) as unknown as typeof HttpsRequest;
  let resolutions = 0;
  const gateway = new ExternalGateway({
    allowedHosts: ['api.example.test'],
    resolve: async () => {
      resolutions++;
      return [{ address: '1.1.1.1', family: 4 }];
    },
    transport: httpsTransport(request),
  });
  expect(
    await gateway.get('project', new URL('https://api.example.test/list'), {
      'X-API-Key': 'server-secret',
    }),
  ).toEqual({ ok: true });
  expect(pinned).toBe('1.1.1.1');
  expect(resolutions).toBe(1);
  expect(captured.servername).toBe('api.example.test');
  expect(captured.rejectUnauthorized).toBe(true);
  expect(captured.agent).toBe(false);
  expect(captured.family).toBe(4);
  expect((captured.headers as Record<string, string>).Cookie).toBeUndefined();
});
it('separa pruebas y producción, exige verificación y captura solo el contrato público', async () => {
  const {
    connections,
    project,
    userId,
    saved,
    store,
    call,
    owner,
    root,
    productionSecret,
    testSecret,
    calls,
  } = await setup();
  expect(() => connections.publish(project, userId, saved.id, { revision: 1 })).toThrow();
  const tested = await connections.test(project, userId, saved.id, {
    revision: 1,
    environment: 'test',
    input: { consulta: 'x y' },
  });
  expect(tested.items[0].nombre).toBe('Pruebas');
  expect(calls[0].headers['X-API-Key']).toBe(testSecret);
  expect(calls[0].url).toContain('q=x+y');
  await connections.test(project, userId, saved.id, {
    revision: 1,
    environment: 'production',
    input: {},
  });
  const published = connections.publish(project, userId, saved.id, { revision: 1 });
  const result = await connections.query(project, userId, saved.id, { version: 1, input: {} });
  expect(result.items).toEqual([{ codigo: 1, nombre: 'Producción', precio: 1250 }]);
  expect(calls.at(-1)?.headers.Authorization).toBe('Bearer ' + productionSecret);
  const page = store.savePage(
    project,
    {
      name: 'Catálogo',
      code: 'catalogo',
      status: 'published',
      components: [{ id: 'query', type: 'ApiQuery', props: { connectionId: saved.id } }],
    },
    userId,
  );
  expect(store.published(project, '/catalogo').connections?.[0].version).toBe(1);
  const snapshot = JSON.stringify(store.published(project, '/catalogo'));
  for (const hidden of [
    productionSecret,
    testSecret,
    'prod.example.test',
    'Authorization',
    'responsePath',
  ])
    expect(snapshot).not.toContain(hidden);
  expect(
    (
      await call(owner.token, root + '/connections/' + saved.id + '/query', 'POST', {
        version: 1,
        input: {},
        environment: 'test',
      })
    ).status,
  ).toBe(400);
  expect(published.publishedVersion).toBe(1);
  expect(page.publicationVersion).toBe(1);
  expect(
    store
      .published(project, '/catalogo')
      .connections![0].fields.every((f) => !Object.hasOwn(f, 'path')),
  ).toBe(true);
});
it('rota credenciales con revisión, pausa hasta comprobar y aplica permisos vivos a versiones anteriores', async () => {
  const { connections, project, userId, saved, publish, auth, store, call, root, definition } =
    await setup();
  let current = await publish();
  const editorInvite = auth.invite(project, userId, {
    email: 'builder@example.com',
    role: 'editor',
  });
  const editor = await auth.register(
    {
      name: 'Editor',
      email: 'builder@example.com',
      password: 'Clave-prueba-1234',
      invitation: editorInvite.token,
    },
    'test',
  );
  expect(
    (
      await call(
        editor.token,
        root + '/connections/' + saved.id + '/environments/production',
        'PUT',
        { revision: 1, origin: 'https://prod.example.test', path: '/catalog', auth: 'none' },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call(editor.token, root + '/connections/' + saved.id + '/test', 'POST', {
        revision: current.revision,
        environment: 'production',
        input: {},
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await call(editor.token, root + '/connections/' + saved.id + '/test', 'POST', {
        revision: current.revision,
        environment: 'test',
        input: {},
      })
    ).status,
  ).toBe(200);
  const readInvite = auth.invite(project, userId, {
    email: 'readonly@example.com',
    role: 'reader',
  });
  const reader = await auth.register(
    {
      name: 'Reader',
      email: 'readonly@example.com',
      password: 'Clave-prueba-1234',
      invitation: readInvite.token,
    },
    'test',
  );
  expect(
    (
      await call(reader.token, root + '/connections/' + saved.id + '/test', 'POST', {
        revision: current.revision,
        environment: 'test',
        input: {},
      })
    ).status,
  ).toBe(403);
  const invite = new InventoryStore(store).invite(project, userId, {
    email: 'viewer@example.com',
    role: 'viewer',
  });
  const viewer = await auth.register(
    {
      name: 'Consulta',
      email: 'viewer@example.com',
      password: 'Clave-prueba-1234',
      invitation: invite.token,
    },
    'test',
  );
  expect(viewer.session.projects).toHaveLength(0);
  expect(viewer.session.applications[0].id).toBe(project);
  expect((await call(viewer.token, root + '/connections')).status).toBe(404);
  expect(
    (
      await call(viewer.token, root + '/connections/' + saved.id + '/query', 'POST', {
        version: 1,
        input: {},
      })
    ).status,
  ).toBe(200);
  connections.configureEnvironment(project, userId, saved.id, 'production', {
    revision: 1,
    origin: 'https://prod.example.test',
    path: '/catalog',
    auth: 'bearer',
    secret: 'rotated-credential',
  });
  await expect(
    connections.query(project, userId, saved.id, { version: 1, input: {} }),
  ).rejects.toThrow('necesita comprobarse');
  expect(() =>
    connections.configureEnvironment(project, userId, saved.id, 'production', {
      revision: 1,
      origin: 'https://prod.example.test',
      path: '/catalog',
      auth: 'none',
    }),
  ).toThrow();
  await connections.test(project, userId, saved.id, {
    revision: current.revision,
    version: 1,
    environment: 'production',
    input: {},
  });
  expect(
    (await connections.query(project, userId, saved.id, { version: 1, input: {} })).items,
  ).toHaveLength(1);
  current = connections.save(
    project,
    userId,
    { revision: current.revision, definition: { ...definition, allowedRoles: ['admin'] } },
    saved.id,
  );
  await connections.test(project, userId, saved.id, {
    revision: current.revision,
    environment: 'production',
    input: {},
  });
  current = connections.publish(project, userId, saved.id, { revision: current.revision });
  expect(
    (
      await call(viewer.token, root + '/connections/' + saved.id + '/query', 'POST', {
        version: 1,
        input: {},
      })
    ).status,
  ).toBe(403);
  expect(() =>
    store.db
      .prepare('UPDATE connection_versions SET definition=? WHERE connection_id=?')
      .run('{}', saved.id),
  ).toThrow();
  connections.configure(project, userId, saved.id, { revision: current.revision, active: false });
  await expect(
    connections.query(project, userId, saved.id, { version: 1, input: {} }),
  ).rejects.toThrow('desactivada');
});
it('rechaza respuestas incompatibles y no devuelve ni registra credenciales o parámetros', async () => {
  const { connections, project, userId, saved, publish, setResponder, productionSecret } =
    await setup();
  await publish();
  for (const response of [
    { status: 302, contentType: 'application/json', body: Buffer.from('{}') },
    { status: 500, contentType: 'application/json', body: Buffer.from(productionSecret) },
    { status: 200, contentType: 'text/html', body: Buffer.from(productionSecret) },
    { status: 200, contentType: 'application/json', body: Buffer.from('bad-json') },
    { status: 200, contentType: 'application/json', body: Buffer.alloc(262145) },
    raw({ items: [{ id: 1, nombre: productionSecret, precio: 1200 }] }),
    raw({ items: [{ id: 1, nombre: 'Nombre', precio: 12.5 }] }),
    raw({ items: Array.from({ length: 101 }, () => ({ id: 1, nombre: 'N', precio: 1 })) }),
  ]) {
    setResponder(async () => response);
    await expect(
      connections.query(project, userId, saved.id, {
        version: 1,
        input: { consulta: 'private-query' },
      }),
    ).rejects.toThrow();
  }
  const details = JSON.stringify(connections.details(project, saved.id));
  expect(details).not.toContain(productionSecret);
  expect(details).not.toContain('private-query');
  expect(details).not.toContain('prod.example.test');
});
it('revalida permisos y configuración después de una respuesta en vuelo', async () => {
  const { connections, project, userId, saved, publish, setResponder, store, auth } = await setup();
  await publish();
  const inventory = new InventoryStore(store),
    invite = inventory.invite(project, userId, { email: 'reader@example.com', role: 'viewer' }),
    reader = await auth.register(
      {
        name: 'Lector',
        email: 'reader@example.com',
        password: 'Clave-prueba-1234',
        invitation: invite.token,
      },
      'test',
    );
  let release!: (response: GatewayResponse) => void;
  setResponder(
    async () =>
      await new Promise<GatewayResponse>((resolve) => {
        release = resolve;
      }),
  );
  const pending = connections.query(project, reader.session.user.id, saved.id, {
    version: 1,
    input: {},
  });
  while (!release) await new Promise((r) => setTimeout(r, 1));
  inventory.setRole(project, userId, reader.session.user.id, { role: 'none' });
  release(raw({ items: [{ id: 1, nombre: 'Dato', precio: 1 }] }));
  await expect(pending).rejects.toThrow('Proyecto no encontrado');
  release = undefined as unknown as typeof release;
  const second = connections.query(project, userId, saved.id, { version: 1, input: {} });
  while (!release) await new Promise((r) => setTimeout(r, 1));
  connections.configureEnvironment(project, userId, saved.id, 'production', {
    revision: 1,
    origin: 'https://prod.example.test',
    path: '/other',
    auth: 'none',
  });
  release(raw({ items: [{ id: 1, nombre: 'Dato', precio: 1 }] }));
  await expect(second).rejects.toThrow('cambió durante');
});
it('limita frecuencia, simultaneidad y tiempo total de resolución', async () => {
  const gateway = new ExternalGateway({
    allowedHosts: ['api.example.test'],
    minuteLimit: 1,
    resolve: async () => [{ address: '1.1.1.1', family: 4 }],
    transport: async () => raw([]),
  });
  await gateway.get('project', new URL('https://api.example.test'), {});
  await expect(gateway.get('project', new URL('https://api.example.test'), {})).rejects.toThrow(
    'límite',
  );
  const slow = new ExternalGateway({
    allowedHosts: ['api.example.test'],
    timeoutMs: 5,
    resolve: async () => await new Promise(() => {}),
  });
  await expect(slow.get('project', new URL('https://api.example.test'), {})).rejects.toThrow(
    'agotó',
  );
  const stalled = new ExternalGateway({
    allowedHosts: ['api.example.test'],
    timeoutMs: 5,
    resolve: async () => [{ address: '1.1.1.1', family: 4 }],
    transport: async () => await new Promise(() => {}),
  });
  await expect(stalled.get('project', new URL('https://api.example.test'), {})).rejects.toThrow(
    'agotó',
  );
});
it('conserva la clave de configuración y permite recuperar credenciales cifradas desde backup', async () => {
  const { dir, file, store, connections, project, userId, saved, publish, masterKey } =
    await setup();
  await publish();
  const env = join(dir, 'test.env');
  await writeFile(env, '# mantener\nAPI_PORT=3201\n');
  await setupConnections(env, ['api.example.test']);
  const first = parseEnv(await readFile(env, 'utf8'));
  await setupConnections(env, ['other.example.test']);
  const second = parseEnv(await readFile(env, 'utf8'));
  expect(second.CONNECTOR_MASTER_KEY).toBe(first.CONNECTOR_MASTER_KEY);
  expect(second.API_PORT).toBe('3201');
  expect(second.CONNECTOR_ALLOWED_HOSTS).toBe('api.example.test,other.example.test');
  expect(await readFile(env, 'utf8')).toContain('# mantener');
  const backup = join(dir, 'backup.sqlite');
  await backupDatabase(file, backup);
  const restored = new PlatformStore(backup);
  try {
    const manager = new ConnectionsStore(restored, {
      masterKey,
      allowedHosts: ['prod.example.test'],
      resolve: async () => [{ address: '1.1.1.1', family: 4 }],
      transport: async () => raw({ items: [{ id: 1, nombre: 'Restaurado', precio: 500 }] }),
    });
    expect(
      (await manager.query(project, userId, saved.id, { version: 1, input: {} })).items[0].nombre,
    ).toBe('Restaurado');
    expect(restored.db.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally {
    restored.close();
  }
  expect(connections.list(project)[0].publishedVersion).toBe(1);
  expect(store.db.open).toBe(true);
});

it('agrega conexiones sobre E3-A sin reescribir datos y rechaza extensiones futuras', async () => {
  const { store, file, project, userId } = await setup();
  const { OperationsStore } = await import('../server/platform/operations');
  const { randomUUID } = await import('node:crypto');
  const operations = new OperationsStore(store);
  const entity = store.saveEntity(
    project,
    {
      name: 'Notas',
      key: 'notas',
      labelField: 'nombre',
      fields: [{ key: 'nombre', label: 'Nombre', type: 'text', required: true }],
    },
    userId,
  );
  const service = operations.save(project, userId, {
    definition: {
      name: 'Crear nota',
      key: 'crear_nota',
      allowOperators: false,
      inputs: [],
      steps: [
        {
          id: 'crear',
          kind: 'create',
          entityId: entity.id,
          values: { nombre: { kind: 'literal', value: 'Anterior' } },
        },
      ],
      result: { registro_id: { kind: 'record', step: 'crear', field: 'id' } },
    },
  });
  operations.publish(project, userId, service.id, { revision: service.revision });
  operations.execute(project, userId, service.id, {
    operationId: randomUUID(),
    version: 1,
    input: {},
  });
  const tables = [
    'users',
    'projects',
    'members',
    'sessions',
    'entities',
    'records',
    'operations',
    'operation_versions',
    'operation_runs',
    'audit',
  ];
  const snapshot = Object.fromEntries(
    tables.map((table) => [
      table,
      store.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    ]),
  );
  store.db.exec(
    'DROP TABLE connection_events;DROP TABLE connection_checks;DROP TABLE connection_environments;DROP TABLE connection_versions;DROP TABLE connections;DROP TABLE connections_schema_version;',
  );
  const upgraded = new PlatformStore(file);
  try {
    for (const table of tables)
      expect(upgraded.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()).toEqual(
        snapshot[table],
      );
    expect(new ConnectionsStore(upgraded).list(project)).toEqual([]);
    expect(new OperationsStore(upgraded).runs(project, service.id)).toHaveLength(1);
    expect(upgraded.db.pragma('foreign_key_check')).toEqual([]);
  } finally {
    upgraded.close();
  }
  store.db.exec(
    'DROP TABLE connections_schema_version;CREATE TABLE connections_schema_version(version INTEGER PRIMARY KEY);INSERT INTO connections_schema_version VALUES(2);',
  );
  expect(() => new PlatformStore(file)).toThrow('Versión de conexiones incompatible');
  expect(store.db.prepare('SELECT version FROM connections_schema_version').get()).toEqual({
    version: 2,
  });
});
