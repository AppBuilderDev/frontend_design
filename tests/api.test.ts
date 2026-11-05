import { JsonBlockRepository } from '../server/blocksRepository';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/app';
import { JsonPageRepository } from '../server/repository';
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'builder-'));
  const file = join(dir, 'pages.json');
  const repo = new JsonPageRepository(file);
  const server = createApi(
    repo,
    ['http://localhost:5173'],
    new JsonBlockRepository(join(dir, 'blocks.json')),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Sin puerto');
  const base = 'http://127.0.0.1:' + address.port;
  cleanup.push(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await rm(dir, { recursive: true, force: true });
  });
  return {
    file,
    blocksFile: join(dir, 'blocks.json'),
    call: (path: string, method = 'GET', data?: unknown) =>
      fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      }),
    base,
  };
}
const draft = {
  name: 'Inicio',
  code: 'inicio',
  status: 'draft',
  components: [
    {
      id: 'heading',
      type: 'Heading',
      props: { text: 'Hola desde Frontend Builder' },
    },
  ],
};
describe('API HTTP y persistencia', () => {
  it('crea, publica, mantiene snapshot y actualiza el Runtime solo al republicar', async () => {
    const { call, file } = await setup();
    const created = await call('/api/pages', 'POST', draft);
    expect(created.status).toBe(201);
    const page = await created.json();
    const path = '/api/public/pages/by-path?path=/inicio';
    expect((await call(path)).status).toBe(404);
    expect((await call('/api/pages')).status).toBe(200);
    await call('/api/pages/' + page.id, 'PUT', {
      ...draft,
      status: 'published',
    });
    expect((await (await call(path)).json()).components[0].props.text).toBe(
      'Hola desde Frontend Builder',
    );
    const changed = {
      ...draft,
      components: [
        {
          id: 'heading',
          type: 'Heading',
          props: { text: 'Texto actualizado' },
        },
      ],
    };
    await call('/api/pages/' + page.id, 'PUT', changed);
    expect((await (await call(path)).json()).components[0].props.text).toBe(
      'Hola desde Frontend Builder',
    );
    await call('/api/pages/' + page.id, 'PUT', {
      ...changed,
      status: 'published',
    });
    expect((await (await call(path)).json()).components[0].props.text).toBe('Texto actualizado');
    expect((await new JsonPageRepository(file).list())[0].published?.components[0].props.text).toBe(
      'Texto actualizado',
    );
    expect((await call('/api/pages/' + page.id, 'DELETE')).status).toBe(204);
    expect((await call(path)).status).toBe(404);
  });
  it('valida duplicados, rutas, Árboles, JSON y CORS', async () => {
    const { call, base } = await setup();
    await call('/api/pages', 'POST', draft);
    expect((await call('/api/pages', 'POST', draft)).status).toBe(409);
    for (const code of ['api/x', '/inicio', 'admin', 'A B', 'inicio/'])
      expect((await call('/api/pages', 'POST', { ...draft, code })).status).toBe(400);
    expect(
      (
        await call('/api/pages', 'POST', {
          ...draft,
          code: 'otra',
          components: [...draft.components, ...draft.components],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(base + '/api/pages', {
          headers: { Origin: 'https://unknown.test' },
        })
      ).status,
    ).toBe(403);
    const cors = await fetch(base + '/api/pages', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(cors.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect((await fetch(base + '/api/pages', { method: 'POST', body: '{' })).status).toBe(400);
  });
  it('serializa escrituras concurrentes y soporta rutas anidadas', async () => {
    const { call } = await setup();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        call('/api/pages', 'POST', {
          ...draft,
          code: 'reportes/ventas-' + i,
          status: 'published',
        }),
      ),
    );
    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect((await (await call('/api/pages')).json()).length).toBe(8);
    expect((await call('/api/public/pages/by-path?path=/reportes/ventas-1')).status).toBe(200);
  });
});

it('persiste bloques entre sesiones, valida árboles y permite eliminarlos sin cambiar páginas', async () => {
  const { call, blocksFile } = await setup();
  expect(
    (await call('/api/blocks', 'POST', { name: '', components: draft.components })).status,
  ).toBe(400);
  expect(
    (
      await call('/api/blocks', 'POST', {
        name: 'Duplicado',
        components: [...draft.components, ...draft.components],
      })
    ).status,
  ).toBe(400);
  const created = await call('/api/blocks', 'POST', {
    name: 'Mi sección',
    components: draft.components,
  });
  expect(created.status).toBe(201);
  const block = await created.json();
  expect(await new JsonBlockRepository(blocksFile).list()).toEqual([block]);
  expect(await (await call('/api/blocks')).json()).toEqual([block]);
  expect(await (await call('/api/pages')).json()).toEqual([]);
  expect((await call('/api/blocks/' + block.id, 'DELETE')).status).toBe(204);
  expect((await call('/api/blocks/' + block.id, 'DELETE')).status).toBe(404);
  expect(await new JsonBlockRepository(blocksFile).list()).toEqual([]);
});
