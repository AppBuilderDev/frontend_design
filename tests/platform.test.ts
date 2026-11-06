import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/app';
import { JsonPageRepository } from '../server/repository';
import { JsonBlockRepository } from '../server/blocksRepository';
import { PlatformStore } from '../server/platform/store';
import { createPlatform } from '../server/platform/http';
import { backupDatabase } from '../server/platform/backup';
import { parseMoney, moneyInput, type Entity, type PlatformSession } from '../src/models/data';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0)) await close();
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'builder-platform-'));
  const file = join(dir, 'platform.sqlite');
  const store = new PlatformStore(file);
  const server = createApi(
    new JsonPageRepository(join(dir, 'pages.json')),
    ['http://localhost:5173'],
    new JsonBlockRepository(join(dir, 'blocks.json')),
    createPlatform(store),
    false,
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No port');
  const port = address.port;
  cleanups.push(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    store.close();
    await rm(dir, { recursive: true, force: true });
  });
  function client() {
    let cookie = '';
    return async (path: string, method = 'GET', data?: unknown) => {
      const response = await fetch('http://127.0.0.1:' + port + '/api/v1' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'AppBuilderDev',
          Cookie: cookie,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const next = response.headers.get('set-cookie');
      if (next) cookie = next.split(';')[0];
      return response;
    };
  }
  const owner = client();
  const registration = await owner('/auth/register', 'POST', {
    name: 'Dueño',
    organization: 'Almacén',
    email: 'owner@example.com',
    password: 'Clave-de-prueba-123',
  });
  expect(registration.status).toBe(201);
  const session: PlatformSession = await registration.json();
  const project = session.projects[0].id;
  return { dir, file, store, owner, client, project, root: '/projects/' + project };
}
it('aísla organizaciones, aplica roles, consume invitaciones una vez y revoca acceso', async () => {
  const { owner, client, project, root, store } = await setup();
  expect((await client()(root + '/entities')).status).toBe(401);
  const outsider = client();
  const signup = await outsider('/auth/register', 'POST', {
    name: 'Otro',
    organization: 'Otra',
    email: 'other@example.com',
    password: 'Clave-de-prueba-123',
  });
  const other = await signup.json();
  expect((await outsider(root + '/entities')).status).toBe(404);
  expect(() =>
    store.db
      .prepare('INSERT INTO projects(id,organization_id,name) VALUES (?,?,?)')
      .run('duplicate', other.projects[0].organizationId, 'Second'),
  ).toThrow();
  for (const role of ['editor', 'reader']) {
    const invite = await (
      await owner(root + '/invitations', 'POST', { email: role + '@example.com', role })
    ).json();
    const user = client();
    const result = await user('/auth/register', 'POST', {
      name: role,
      email: role + '@example.com',
      password: 'Clave-de-prueba-123',
      invitation: invite.token,
    });
    expect(result.status).toBe(201);
    const member = await result.json();
    expect(member.projects).toHaveLength(1);
    expect(member.projects[0].id).toBe(project);
    expect((await user('/invitations/accept', 'POST', { token: invite.token })).status).toBe(400);
    expect(
      (
        await user(root + '/pages', 'POST', {
          name: 'Prueba',
          code: 'prueba-' + role,
          status: 'published',
          components: [],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await user(root + '/entities', 'POST', {
          name: 'X',
          key: 'x',
          labelField: 'nombre',
          fields: [{ key: 'nombre', label: 'Nombre', type: 'text' }],
        })
      ).status,
    ).toBe(role === 'reader' ? 403 : 201);
    expect((await owner(root + '/members/' + member.user.id, 'DELETE')).status).toBe(204);
    expect((await user(root + '/entities')).status).toBe(404);
  }
  expect((await owner(root, 'PATCH', { name: 'Archivado', archived: true })).status).toBe(200);
  expect((await owner(root + '/entities')).status).toBe(409);
  expect((await owner(root, 'PATCH', { name: 'Restaurado', archived: false })).status).toBe(200);
  expect((await owner(root + '/entities')).status).toBe(200);
});
it('crea el inventario atómicamente y valida tipos, referencias, filtros y revisiones', async () => {
  const { owner, root } = await setup();
  const response = await owner(root + '/templates/inventory', 'POST');
  expect(response.status).toBe(201);
  const entities: Entity[] = await response.json();
  expect(entities).toHaveLength(3);
  expect((await owner(root + '/templates/inventory', 'POST')).status).toBe(409);
  expect(await (await owner(root + '/entities')).json()).toHaveLength(3);
  const category = entities.find((e) => e.key === 'categorias')!,
    unit = entities.find((e) => e.key === 'unidades')!,
    products = entities.find((e) => e.key === 'productos')!;
  const path = (id: string) => root + '/services/' + id + '/records';
  const cat = await (
    await owner(path(category.id), 'POST', { values: { nombre: 'Alimentos' } })
  ).json();
  const u = await (await owner(path(unit.id), 'POST', { values: { nombre: 'Unidad' } })).json();
  const values = { nombre: 'Arroz', sku: 'ARR-1', categoria: cat.id, unidad: u.id, precio: 1234 };
  for (const bad of [
    { ...values, precio: 12.34 },
    { ...values, precio: Number.MAX_SAFE_INTEGER + 1 },
    { ...values, precio: -1 },
    { ...values, extra: 'x' },
    { ...values, categoria: 'foreign' },
    { ...values, nombre: '' },
  ])
    expect((await owner(path(products.id), 'POST', { values: bad })).status).toBe(400);
  const created = await owner(path(products.id), 'POST', { values });
  expect(created.status).toBe(201);
  const record = await created.json();
  expect(record.labels.categoria).toBe('Alimentos');
  expect(record.values.precio).toBe(1234);
  expect((await owner(path(products.id), 'POST', { values })).status).toBe(400);
  const list = await (
    await owner(
      path(products.id) + '?q=arroz&filter.categoria=' + cat.id + '&sort=precio&pageSize=1',
    )
  ).json();
  expect(list.total).toBe(1);
  expect(list.items[0].id).toBe(record.id);
  expect(
    (
      await owner(path(products.id) + '/' + record.id, 'PUT', {
        values: { ...values, precio: 1450 },
        revision: 1,
      })
    ).status,
  ).toBe(200);
  expect(
    (await owner(path(products.id) + '/' + record.id, 'PUT', { values, revision: 1 })).status,
  ).toBe(409);
  expect((await owner(path(products.id) + '/' + record.id + '?revision=1', 'DELETE')).status).toBe(
    409,
  );
  expect((await owner(path(products.id) + '/' + record.id + '?revision=2', 'DELETE')).status).toBe(
    204,
  );
  expect((await (await owner(path(products.id))).json()).total).toBe(0);
  expect((await (await owner(path(products.id) + '?includeInactive=true')).json()).total).toBe(1);
});
it('mantiene publicaciones estables, bloquea contratos rotos y restaura una copia consistente', async () => {
  const { owner, root, project, store, file, dir } = await setup();
  const entities: Entity[] = await (await owner(root + '/templates/inventory', 'POST')).json();
  const product = entities.find((e) => e.key === 'productos')!;
  const draft = {
    name: 'Inventario',
    code: 'inventario',
    status: 'draft',
    components: [{ id: 'table', type: 'DataTable', props: { entityId: product.id } }],
  };
  let page = await (await owner(root + '/pages', 'POST', draft)).json();
  const runtime = '/runtime/projects/' + project + '/pages/by-path?path=/inventario';
  expect((await owner(runtime)).status).toBe(404);
  page = await (
    await owner(root + '/pages/' + page.id, 'PUT', {
      ...draft,
      status: 'published',
      revision: page.revision,
    })
  ).json();
  expect((await (await owner(runtime)).json()).entities).toHaveLength(3);
  const oldRevision = page.revision;
  page = await (
    await owner(root + '/pages/' + page.id, 'PUT', {
      ...draft,
      name: 'Borrador nuevo',
      revision: page.revision,
    })
  ).json();
  expect((await (await owner(runtime)).json()).name).toBe('Inventario');
  expect(
    (await owner(root + '/pages/' + page.id, 'PUT', { ...draft, revision: oldRevision })).status,
  ).toBe(409);
  expect(
    (await owner(root + '/pages/' + page.id + '?revision=' + oldRevision, 'DELETE')).status,
  ).toBe(409);
  expect(
    (
      await owner(root + '/entities/' + product.id, 'PUT', {
        ...product,
        fields: [...product.fields, { key: 'nuevo', label: 'Nuevo', type: 'text' }],
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await owner(root + '/pages', 'POST', {
        ...draft,
        code: 'roto',
        status: 'published',
        components: [{ id: 'bad', type: 'DataForm', props: { entityId: 'foreign' } }],
      })
    ).status,
  ).toBe(400);
  const backup = join(dir, 'backup.sqlite');
  await backupDatabase(file, backup);
  const restored = new PlatformStore(backup);
  try {
    expect(restored.published(project, '/inventario').name).toBe('Inventario');
    expect(restored.page(project, page.id).revision).toBe(page.revision);
    expect(restored.entities(project)).toHaveLength(3);
    expect(restored.db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(restored.db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 1 });
  } finally {
    restored.close();
  }
  expect(store.db.open).toBe(true);
});
it('conserva centavos exactos y rechaza redondeos implícitos', () => {
  expect(parseMoney('10.50')).toBe(1050);
  expect(parseMoney('0,01')).toBe(1);
  expect(parseMoney('-0.01')).toBe(-1);
  expect(moneyInput(9007199254740991)).toBe('90071992547409.91');
  expect(() => parseMoney('1.005')).toThrow();
  expect(() => parseMoney('90071992547409.92')).toThrow();
  expect(() => parseMoney('1e3')).toThrow();
});
