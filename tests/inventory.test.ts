import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PlatformStore } from '../server/platform/store';
import { InventoryStore } from '../server/platform/inventory';
import { PlatformAuth } from '../server/platform/auth';
import { createPlatform } from '../server/platform/http';
import { createApi } from '../server/app';
import { JsonPageRepository } from '../server/repository';
import { JsonBlockRepository } from '../server/blocksRepository';
import { backupDatabase } from '../server/platform/backup';
const close: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of close.splice(0)) await cleanup();
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'inventory-e2-'));
  const file = join(dir, 'db.sqlite');
  const store = new PlatformStore(file),
    inventory = new InventoryStore(store),
    auth = new PlatformAuth(store);
  const owner = await auth.register(
    {
      name: 'Owner',
      email: 'owner@example.com',
      password: 'Clave-prueba-1234',
      organization: 'Org',
    },
    'test',
  );
  const project = owner.session.projects[0].id,
    ownerId = owner.session.user.id;
  const entity = store.saveEntity(
    project,
    {
      key: 'productos',
      name: 'Productos',
      labelField: 'nombre',
      fields: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'sku', label: 'SKU', type: 'text', required: true, unique: true },
      ],
    },
    ownerId,
  );
  const product = store.saveRecord(
    project,
    entity.id,
    { values: { nombre: 'Arroz', sku: 'ARR-1' } },
    ownerId,
  );
  inventory.configure(project, ownerId, {
    entityId: entity.id,
    nameField: 'nombre',
    skuField: 'sku',
  });
  const server = createApi(
    new JsonPageRepository(join(dir, 'pages.json')),
    ['http://localhost:5173'],
    new JsonBlockRepository(join(dir, 'blocks.json')),
    createPlatform(store),
    false,
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No address');
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
  close.push(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    store.close();
    await rm(dir, { recursive: true, force: true });
  });
  const root = '/projects/' + project;
  const move = (type = 'entry', quantity = 5, extra: Record<string, unknown> = {}) => ({
    operationId: randomUUID(),
    productId: product.id,
    type,
    quantity,
    reason: 'Prueba justificada',
    ...extra,
  });
  return {
    store,
    inventory,
    auth,
    owner,
    ownerId,
    project,
    entity,
    product,
    call,
    root,
    move,
    file,
    dir,
  };
}
it('serializa salidas simultáneas y reintentos sin duplicar ni dejar stock negativo', async () => {
  const { owner, call, root, move, inventory, project, product } = await setup();
  const input = move();
  const created = await call(owner.token, root + '/inventory/movements', 'POST', input);
  expect(created.status).toBe(201);
  const original = await created.json();
  const retry = await call(owner.token, root + '/inventory/movements', 'POST', input);
  expect(retry.status).toBe(200);
  expect((await retry.json()).movement).toEqual(original.movement);
  expect(
    (await call(owner.token, root + '/inventory/movements', 'POST', { ...input, quantity: 6 }))
      .status,
  ).toBe(409);
  const results = await Promise.all([
    call(owner.token, root + '/inventory/movements', 'POST', move('exit', 4)),
    call(owner.token, root + '/inventory/movements', 'POST', move('exit', 4)),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(inventory.balance(project, product.id)).toBe(1);
  expect(inventory.history(project, new URLSearchParams()).total).toBe(2);
  expect(
    (await call(owner.token, root + '/inventory/movements', 'POST', move('entry', 0))).status,
  ).toBe(400);
  expect(
    (await call(owner.token, root + '/inventory/movements', 'POST', move('exit', -1))).status,
  ).toBe(400);
  expect(
    (await call(owner.token, root + '/inventory/movements', 'POST', move('entry', 1.1))).status,
  ).toBe(400);
});
it('revierte toda la transacción si falla el registro de auditoría y conserva enteros exactos', async () => {
  const { store, inventory, project, ownerId, product, move } = await setup();
  const input = move();
  store.db.exec(
    "CREATE TRIGGER fail_inventory_audit BEFORE INSERT ON audit WHEN NEW.action LIKE 'inventory.%' BEGIN SELECT RAISE(ABORT,'Injected storage failure');END;",
  );
  expect(() => inventory.move(project, ownerId, input)).toThrow();
  expect(inventory.balance(project, product.id)).toBe(0);
  expect(inventory.history(project, new URLSearchParams()).total).toBe(0);
  store.db.exec('DROP TRIGGER fail_inventory_audit');
  expect(inventory.move(project, ownerId, input).replayed).toBe(false);
  inventory.move(project, ownerId, move('entry', Number.MAX_SAFE_INTEGER - 5));
  expect(inventory.balance(project, product.id)).toBe(Number.MAX_SAFE_INTEGER);
  expect(() => inventory.move(project, ownerId, move('entry', 1))).toThrow();
  expect(inventory.balance(project, product.id)).toBe(Number.MAX_SAFE_INTEGER);
});
it('mantiene historial inmutable, filtros, mínimos y ajustes con saldo observado y referencia', async () => {
  const { inventory, project, ownerId, product, move, store, owner, call, root } = await setup();
  const first = inventory.move(project, ownerId, move()).movement;
  inventory.minimum(project, ownerId, product.id, { minimum: 5, revision: 0 });
  expect(inventory.stock(project, new URLSearchParams()).items[0].belowMinimum).toBe(false);
  inventory.minimum(project, ownerId, product.id, { minimum: 6, revision: 1 });
  expect(inventory.stock(project, new URLSearchParams('lowOnly=true')).total).toBe(1);
  expect(() =>
    inventory.minimum(project, ownerId, product.id, { minimum: 7, revision: 1 }),
  ).toThrow();
  expect(() =>
    inventory.move(project, ownerId, move('adjust', -1, { expectedBalance: 4 })),
  ).toThrow();
  expect(() =>
    inventory.move(project, ownerId, move('adjust', -6, { expectedBalance: 5 })),
  ).toThrow();
  expect(() =>
    inventory.move(
      project,
      ownerId,
      move('adjust', -1, { expectedBalance: 5, referenceId: 'foreign' }),
    ),
  ).toThrow();
  const adjustment = inventory.move(
    project,
    ownerId,
    move('adjust', -1, { expectedBalance: 5, referenceId: first.id }),
  ).movement;
  expect(adjustment.after).toBe(4);
  expect(adjustment.referenceId).toBe(first.id);
  const filter = new URLSearchParams({
    type: 'adjust',
    actorId: ownerId,
    productId: product.id,
    from: adjustment.createdAt.slice(0, 10),
    to: adjustment.createdAt.slice(0, 10),
    pageSize: '1',
  });
  expect(inventory.history(project, filter).items[0].id).toBe(adjustment.id);
  expect(() => inventory.history(project, new URLSearchParams('from=2026-02-30'))).toThrow();
  expect(() =>
    store.db.prepare('UPDATE inventory_movements SET delta=0 WHERE id=?').run(first.id),
  ).toThrow();
  expect(() =>
    store.db.prepare('DELETE FROM inventory_movements WHERE id=?').run(first.id),
  ).toThrow();
  expect(
    (await call(owner.token, root + '/inventory/movements/' + first.id, 'PUT', { quantity: 99 }))
      .status,
  ).toBe(404);
  inventory.setActive(project, ownerId, product.id, { active: false, revision: 1 });
  expect(() => inventory.move(project, ownerId, move('entry', 1))).toThrow();
  expect(inventory.history(project, new URLSearchParams()).total).toBe(2);
  inventory.move(
    project,
    ownerId,
    move('adjust', -1, { expectedBalance: 4, referenceId: adjustment.id }),
  );
  expect(
    inventory.stock(project, new URLSearchParams('includeInactive=true')).items[0].balance,
  ).toBe(3);
  inventory.setActive(project, ownerId, product.id, { active: true, revision: 2 });
  expect(inventory.stock(project, new URLSearchParams()).total).toBe(1);
});
it('separa operadores, administradores y consulta del acceso para construir, y aísla proyectos', async () => {
  const { auth, inventory, project, ownerId, call, root, move, entity, product } = await setup();
  for (const role of ['operator', 'viewer', 'admin'] as const) {
    const invitation = inventory.invite(project, ownerId, { email: role + '@example.com', role });
    const account = await auth.register(
      {
        name: role,
        email: role + '@example.com',
        password: 'Clave-prueba-1234',
        invitation: invitation.token,
      },
      'test',
    );
    expect(account.session.projects).toHaveLength(0);
    expect(account.session.applications[0].role).toBe(role);
    expect(() => auth.accept(invitation.token, account.session.user.id)).toThrow();
    expect((await call(account.token, root + '/entities')).status).toBe(404);
    expect((await call(account.token, root + '/inventory/stock')).status).toBe(200);
    expect(
      (await call(account.token, root + '/inventory/movements', 'POST', move('entry', 1))).status,
    ).toBe(role === 'viewer' ? 403 : 201);
    expect(
      (
        await call(account.token, root + '/inventory/products/' + product.id + '/minimum', 'PUT', {
          minimum: 2,
          revision: 0,
        })
      ).status,
    ).toBe(role === 'admin' ? 200 : 403);
    const current = inventory.balance(project, product.id);
    expect(
      (
        await call(
          account.token,
          root + '/inventory/movements',
          'POST',
          move('adjust', 1, { expectedBalance: current }),
        )
      ).status,
    ).toBe(role === 'admin' ? 201 : 403);
    expect(
      (
        await call(account.token, root + '/services/' + entity.id + '/records', 'POST', {
          values: { nombre: 'No autorizado', sku: 'NO' },
        })
      ).status,
    ).toBe(404);
    inventory.setRole(project, ownerId, account.session.user.id, { role: 'none' });
    expect((await call(account.token, root + '/inventory/stock')).status).toBe(404);
  }
  const editorInvite = auth.invite(project, ownerId, {
    email: 'editor@example.com',
    role: 'editor',
  });
  const editor = await auth.register(
    {
      name: 'Editor',
      email: 'editor@example.com',
      password: 'Clave-prueba-1234',
      invitation: editorInvite.token,
    },
    'test',
  );
  expect((await call(editor.token, root + '/inventory/stock')).status).toBe(403);
  expect(
    (
      await call(
        editor.token,
        root + '/services/' + entity.id + '/records/' + product.id + '?revision=1',
        'DELETE',
      )
    ).status,
  ).toBe(403);
  const outsider = await auth.register(
    {
      name: 'Other',
      organization: 'Other',
      email: 'other@example.com',
      password: 'Clave-prueba-1234',
    },
    'test',
  );
  expect((await call(outsider.token, root + '/inventory/movements', 'POST', move())).status).toBe(
    404,
  );
});
it('extiende una base E1 sin reescribir datos y recupera inventario desde una copia verificada', async () => {
  const { store, inventory, project, ownerId, product, move, file, dir } = await setup();
  const original = store.db.prepare('SELECT data FROM records WHERE id=?').get(product.id);
  inventory.move(project, ownerId, move('entry', 12));
  expect(store.db.prepare('SELECT data FROM records WHERE id=?').get(product.id)).toEqual(original);
  expect(store.db.prepare('SELECT MAX(version) AS v FROM schema_version').get()).toEqual({ v: 1 });
  const backup = join(dir, 'copy.sqlite');
  await backupDatabase(file, backup);
  const restored = new PlatformStore(backup);
  try {
    expect(new InventoryStore(restored).balance(project, product.id)).toBe(12);
    expect(restored.db.prepare('SELECT data FROM records WHERE id=?').get(product.id)).toEqual(
      original,
    );
    expect(restored.db.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally {
    restored.close();
  }
});

it('abre un esquema E1 existente sin cambiar sus cuentas, sesiones, páginas ni datos', async () => {
  const { store, file, project, ownerId } = await setup();
  store.savePage(
    project,
    {
      name: 'Página anterior',
      code: 'anterior',
      status: 'published',
      components: [{ id: 'h', type: 'Heading', props: { text: 'Antes de E2' } }],
    },
    ownerId,
  );
  const tables = [
    'users',
    'organizations',
    'projects',
    'members',
    'sessions',
    'entities',
    'records',
    'pages',
  ];
  const snapshot = Object.fromEntries(
    tables.map((table) => [
      table,
      store.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all(),
    ]),
  );
  // Temporary test fixture: remove only the empty additive E2 tables to reproduce E1.
  store.db.exec(
    'DROP TABLE inventory_movements;DROP TABLE inventory_minimums;DROP TABLE application_invitations;DROP TABLE application_members;DROP TABLE inventory_config;DROP TABLE inventory_schema_version;',
  );
  const migrated = new PlatformStore(file);
  try {
    for (const table of tables)
      expect(migrated.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()).toEqual(
        snapshot[table],
      );
    expect(() => new InventoryStore(migrated).config(project)).toThrow();
    expect(migrated.published(project, '/anterior').components[0].props.text).toBe('Antes de E2');
    expect(migrated.db.pragma('foreign_key_check')).toEqual([]);
  } finally {
    migrated.close();
  }
  store.db.exec(
    'DROP TABLE inventory_schema_version;CREATE TABLE inventory_schema_version(version INTEGER PRIMARY KEY);INSERT INTO inventory_schema_version VALUES(2);',
  );
  expect(() => new PlatformStore(file)).toThrow('Versión de inventario incompatible');
  expect(store.db.prepare('SELECT version FROM inventory_schema_version').get()).toEqual({
    version: 2,
  });
});
