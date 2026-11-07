import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PlatformStore } from '../server/platform/store';
import { PlatformAuth } from '../server/platform/auth';
import { OperationsStore } from '../server/platform/operations';
import { InventoryStore } from '../server/platform/inventory';
import { createPlatform } from '../server/platform/http';
import { createApi } from '../server/app';
import { JsonPageRepository } from '../server/repository';
import { JsonBlockRepository } from '../server/blocksRepository';
import { backupDatabase } from '../server/platform/backup';
import type { OperationDefinition } from '../src/models/operations';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'builder-operations-')),
    file = join(dir, 'db.sqlite'),
    store = new PlatformStore(file),
    auth = new PlatformAuth(store),
    ops = new OperationsStore(store);
  const owner = await auth.register(
      {
        name: 'Dueño',
        email: 'owner@example.com',
        organization: 'Negocio',
        password: 'Clave-prueba-1234',
      },
      'test',
    ),
    userId = owner.session.user.id,
    project = owner.session.projects[0].id;
  const account = store.saveEntity(
    project,
    {
      name: 'Cuentas',
      key: 'cuentas',
      labelField: 'nombre',
      fields: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'saldo', label: 'Saldo', type: 'integer', required: true, min: 0 },
        { key: 'secreto', label: 'Dato interno', type: 'text' },
      ],
    },
    userId,
  );
  const log = store.saveEntity(
    project,
    {
      name: 'Registro',
      key: 'registro',
      labelField: 'motivo',
      fields: [
        { key: 'motivo', label: 'Motivo', type: 'text', required: true },
        {
          key: 'cuenta',
          label: 'Cuenta',
          type: 'relation',
          relationEntityId: account.id,
          required: true,
        },
        { key: 'importe', label: 'Importe', type: 'integer', required: true, min: 1 },
        { key: 'autor', label: 'Autor', type: 'text', required: true },
      ],
    },
    userId,
  );
  const record = store.saveRecord(
    project,
    account.id,
    { values: { nombre: 'Principal', saldo: 5, secreto: 'dato-privado' } },
    userId,
  );
  const definition: OperationDefinition = {
    name: 'Descontar saldo',
    key: 'descontar',
    allowOperators: true,
    inputs: [
      {
        key: 'cuenta',
        label: 'Cuenta',
        type: 'relation',
        relationEntityId: account.id,
        required: true,
        unique: false,
        options: [],
      },
      {
        key: 'importe',
        label: 'Importe',
        type: 'integer',
        required: true,
        unique: false,
        options: [],
        min: 1,
      },
    ],
    steps: [
      {
        id: 'consultar',
        kind: 'load',
        entityId: account.id,
        recordId: { kind: 'input', key: 'cuenta' },
      },
      {
        id: 'validar',
        kind: 'assert',
        left: { kind: 'record', step: 'consultar', field: 'saldo' },
        operator: 'gte',
        right: { kind: 'input', key: 'importe' },
        message: 'Saldo insuficiente',
      },
      {
        id: 'actualizar',
        kind: 'update',
        record: 'consultar',
        values: {
          saldo: {
            kind: 'subtract',
            left: { kind: 'record', step: 'consultar', field: 'saldo' },
            right: { kind: 'input', key: 'importe' },
          },
        },
      },
      {
        id: 'registrar',
        kind: 'create',
        entityId: log.id,
        values: {
          motivo: { kind: 'literal', value: 'Descuento' },
          cuenta: { kind: 'record', step: 'consultar', field: 'id' },
          importe: { kind: 'input', key: 'importe' },
          autor: { kind: 'actor' },
        },
      },
    ],
    result: {
      saldo: { kind: 'record', step: 'actualizar', field: 'saldo' },
      etiqueta: { kind: 'literal', value: 'v1' },
    },
  };
  const server = createApi(
    new JsonPageRepository(join(dir, 'pages.json')),
    ['http://localhost:5173'],
    new JsonBlockRepository(join(dir, 'blocks.json')),
    createPlatform(store),
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
  const saved = ops.save(project, userId, { definition });
  const request = (importe = 1) => ({
    operationId: randomUUID(),
    version: 1,
    input: { cuenta: record.id, importe },
  });
  return {
    dir,
    file,
    store,
    auth,
    ops,
    owner,
    userId,
    project,
    account,
    log,
    record,
    definition,
    saved,
    request,
    call,
    root: '/projects/' + project,
  };
}
it('compone consulta, condición, actualización y creación con reversión total y simulación sin escrituras', async () => {
  const { store, ops, project, userId, record, account, log, saved, request, definition } =
    await setup();
  const count = (table: string) =>
    (store.db.prepare('SELECT COUNT(*) AS n FROM ' + table).get() as { n: number }).n;
  const audit = count('audit');
  const simulated = ops.simulate(project, userId, saved.id, {
    revision: saved.revision,
    input: request(2).input,
  });
  expect(simulated?.output.saldo).toBe(3);
  expect(store.getRecord(project, account.id, record.id).values.saldo).toBe(5);
  expect(store.listRecords(project, log.id, new URLSearchParams()).total).toBe(0);
  expect(count('audit')).toBe(audit);
  const invalid = structuredClone(definition);
  const create = invalid.steps[3];
  if (create.kind === 'create') create.values.importe = { kind: 'literal', value: -1 };
  const broken = ops.save(
    project,
    userId,
    { definition: invalid, revision: saved.revision },
    saved.id,
  );
  ops.publish(project, userId, saved.id, { revision: broken.revision });
  expect(() => ops.execute(project, userId, saved.id, request(2))).toThrow();
  expect(store.getRecord(project, account.id, record.id).values.saldo).toBe(5);
  expect(count('operation_runs')).toBe(0);
  expect(store.listRecords(project, log.id, new URLSearchParams()).total).toBe(0);
});
it('serializa ejecuciones simultáneas y conserva la idempotencia', async () => {
  const { ops, project, userId, saved, request, call, owner, root, store, account, record, log } =
    await setup();
  ops.publish(project, userId, saved.id, { revision: saved.revision });
  const path = root + '/operations/' + saved.id + '/execute';
  const polluted = request();
  polluted.input = JSON.parse('{"__proto__":"ignored","cuenta":"' + record.id + '","importe":1}');
  expect((await call(owner.token, path, 'POST', polluted)).status).toBe(400);
  expect(store.getRecord(project, account.id, record.id).values.saldo).toBe(5);
  const input = request(4);
  const first = await call(owner.token, path, 'POST', input);
  expect(first.status).toBe(201);
  const original = await first.json();
  const retry = await call(owner.token, path, 'POST', input);
  expect(retry.status).toBe(200);
  expect((await retry.json()).id).toBe(original.id);
  expect(
    (await call(owner.token, path, 'POST', { ...input, input: request(3).input })).status,
  ).toBe(409);
  expect(store.getRecord(project, account.id, record.id).values.saldo).toBe(1);
  expect(store.listRecords(project, log.id, new URLSearchParams()).total).toBe(1);
  store.saveRecord(
    project,
    account.id,
    { values: { ...record.values, saldo: 5 }, revision: 2 },
    userId,
    record.id,
  );
  const attempts = await Promise.all([
    call(owner.token, path, 'POST', request(4)),
    call(owner.token, path, 'POST', request(4)),
  ]);
  expect(attempts.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(store.getRecord(project, account.id, record.id).values.saldo).toBe(1);
});
it('publica contratos estables, revierte versión predeterminada y bloquea cambios incompatibles', async () => {
  const { ops, project, userId, saved, definition, store, account, request } = await setup();
  let current = ops.publish(project, userId, saved.id, { revision: saved.revision });
  const page = store.savePage(
    project,
    {
      name: 'Acción',
      code: 'accion',
      status: 'published',
      components: [{ id: 'run', type: 'ServiceForm', props: { operationId: saved.id } }],
    },
    userId,
  );
  expect(store.published(project, '/accion').operations?.[0].version).toBe(1);
  expect(store.published(project, '/accion').entities).toEqual([]);
  expect(JSON.stringify(store.published(project, '/accion'))).not.toContain('steps');
  const changed = structuredClone(definition);
  changed.result.etiqueta = { kind: 'literal', value: 'v2' };
  current = ops.save(
    project,
    userId,
    { definition: changed, revision: current.revision },
    saved.id,
  );
  expect(ops.execute(project, userId, saved.id, request()).output.etiqueta).toBe('v1');
  current = ops.publish(project, userId, saved.id, { revision: current.revision });
  expect(ops.execute(project, userId, saved.id, { ...request(), version: 2 }).output.etiqueta).toBe(
    'v2',
  );
  expect(store.published(project, '/accion').operations?.[0].version).toBe(1);
  expect(() => ops.save(project, userId, { definition, revision: 1 }, saved.id)).toThrow();
  expect(() =>
    store.saveEntity(
      project,
      { ...account, fields: [...account.fields, { key: 'nuevo', label: 'Nuevo', type: 'text' }] },
      userId,
      account.id,
    ),
  ).toThrow();
  expect(() =>
    store.saveEntity(project, { ...account, labelField: 'secreto' }, userId, account.id),
  ).toThrow();
  expect(ops.impact(project, saved.id).pages[0].publishedVersion).toBe(1);
  current = ops.configure(project, userId, saved.id, { revision: current.revision, version: 1 });
  expect(current.publishedVersion).toBe(1);
  ops.configure(project, userId, saved.id, { revision: current.revision, active: false });
  expect(() => ops.execute(project, userId, saved.id, request())).toThrow();
  expect(store.page(project, page.id).publicationVersion).toBe(1);
});
it('limita operadores al contrato publicado, oculta pasos y opciones internas y revoca permisos de versiones antiguas', async () => {
  const { ops, store, auth, project, userId, saved, request, call, root, definition } =
    await setup();
  let current = ops.publish(project, userId, saved.id, { revision: saved.revision });
  const inventory = new InventoryStore(store);
  const invite = inventory.invite(project, userId, {
    email: 'operator@example.com',
    role: 'operator',
  });
  const operator = await auth.register(
    {
      name: 'Operador',
      email: 'operator@example.com',
      password: 'Clave-prueba-1234',
      invitation: invite.token,
    },
    'test',
  );
  expect(operator.session.projects).toHaveLength(0);
  expect(operator.session.applications[0].id).toBe(project);
  expect((await call(operator.token, root + '/operations')).status).toBe(404);
  const options = await (
    await call(operator.token, root + '/operations/' + saved.id + '/options/cuenta?version=1')
  ).json();
  expect(Object.keys(options[0]).sort()).toEqual(['id', 'label']);
  expect(
    await (
      await call(
        operator.token,
        root + '/operations/' + saved.id + '/options/cuenta?version=1&q=dato-privado',
      )
    ).json(),
  ).toEqual([]);
  expect(
    (await call(operator.token, root + '/operations/' + saved.id + '/execute', 'POST', request()))
      .status,
  ).toBe(201);
  const stricter = { ...definition, allowOperators: false };
  current = ops.save(
    project,
    userId,
    { definition: stricter, revision: current.revision },
    saved.id,
  );
  current = ops.publish(project, userId, saved.id, { revision: current.revision });
  expect(
    (await call(operator.token, root + '/operations/' + saved.id + '/execute', 'POST', request()))
      .status,
  ).toBe(403);
  const other = await auth.register(
    {
      name: 'Otro',
      organization: 'Otro',
      email: 'other@example.com',
      password: 'Clave-prueba-1234',
    },
    'test',
  );
  expect(
    (await call(other.token, root + '/operations/' + saved.id + '/execute', 'POST', request()))
      .status,
  ).toBe(404);
  const editorInvite = auth.invite(project, userId, {
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
  expect(
    (
      await call(editor.token, root + '/operations/' + saved.id + '/publish', 'POST', {
        revision: current.revision,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await call(editor.token, root + '/operations/' + saved.id + '/simulate', 'POST', {
        revision: current.revision,
        input: request().input,
      })
    ).status,
  ).toBe(200);
  expect(
    (await call(editor.token, root + '/operations/' + saved.id + '/execute', 'POST', request()))
      .status,
  ).toBe(403);
  expect(current.publishedVersion).toBe(2);
});
it('rechaza referencias futuras, tipos incorrectos, sobrecarga y expresiones fuera del rango seguro', async () => {
  const { ops, project, userId, saved, definition, request, store, record, account } =
    await setup();
  const forward = structuredClone(definition);
  forward.steps.reverse();
  expect(() => ops.save(project, userId, { definition: forward })).toThrow();
  const invalid = structuredClone(definition);
  invalid.result.malo = { kind: 'record', step: 'consultar', field: 'constructor' };
  expect(() => ops.save(project, userId, { definition: invalid })).toThrow();
  const text = structuredClone(definition);
  text.steps[1] = {
    id: 'validar',
    kind: 'assert',
    left: { kind: 'literal', value: 'x' },
    operator: 'gte',
    right: { kind: 'input', key: 'importe' },
    message: 'Condición',
  };
  expect(() => ops.save(project, userId, { definition: text })).toThrow();
  const overflow = structuredClone(definition);
  overflow.result.saldo = {
    kind: 'add',
    left: { kind: 'literal', value: Number.MAX_SAFE_INTEGER },
    right: { kind: 'literal', value: 1 },
  };
  const draft = ops.save(
    project,
    userId,
    { definition: overflow, revision: saved.revision },
    saved.id,
  );
  ops.publish(project, userId, saved.id, { revision: draft.revision });
  expect(() => ops.execute(project, userId, saved.id, request())).toThrow();
  expect(store.getRecord(project, account.id, record.id).values.saldo).toBe(5);
});
it('conserva las bases E2 y restaura versiones y ejecuciones desde backup', async () => {
  const { ops, project, userId, saved, request, store, file, dir } = await setup();
  ops.publish(project, userId, saved.id, { revision: saved.revision });
  const run = ops.execute(project, userId, saved.id, request());
  const destination = join(dir, 'copy.sqlite');
  await backupDatabase(file, destination);
  const restored = new PlatformStore(destination);
  try {
    expect(new OperationsStore(restored).runs(project, saved.id)[0].id).toBe(run.id);
    expect(new OperationsStore(restored).list(project)[0].versions).toHaveLength(1);
    expect(restored.db.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally {
    restored.close();
  }
  expect(store.db.prepare('SELECT MAX(version) AS v FROM inventory_schema_version').get()).toEqual({
    v: 1,
  });
  expect(store.db.prepare('SELECT MAX(version) AS v FROM schema_version').get()).toEqual({ v: 1 });
});

it('agrega servicios a una base E2 sin reescribir datos operativos y rechaza versiones futuras', async () => {
  const { store, file, project, userId, account, record } = await setup();
  const inventory = new InventoryStore(store);
  inventory.configure(project, userId, { entityId: account.id, nameField: 'nombre' });
  inventory.move(project, userId, {
    operationId: randomUUID(),
    productId: record.id,
    type: 'entry',
    quantity: 3,
    reason: 'Saldo operativo previo',
  });
  const tables = [
    'users',
    'projects',
    'members',
    'sessions',
    'entities',
    'records',
    'inventory_movements',
    'inventory_config',
  ];
  const snapshots = Object.fromEntries(
    tables.map((t) => [t, store.db.prepare('SELECT * FROM ' + t + ' ORDER BY rowid').all()]),
  );
  store.db.exec(
    'DROP TABLE operation_runs;DROP TABLE operation_versions;DROP TABLE operations;DROP TABLE operations_schema_version;',
  );
  const upgraded = new PlatformStore(file);
  try {
    for (const table of tables)
      expect(upgraded.db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()).toEqual(
        snapshots[table],
      );
    expect(new InventoryStore(upgraded).balance(project, record.id)).toBe(3);
    expect(new OperationsStore(upgraded).list(project)).toEqual([]);
    expect(upgraded.db.pragma('foreign_key_check')).toEqual([]);
  } finally {
    upgraded.close();
  }
  store.db.exec(
    'DROP TABLE operations_schema_version;CREATE TABLE operations_schema_version(version INTEGER PRIMARY KEY);INSERT INTO operations_schema_version VALUES(2);',
  );
  expect(() => new PlatformStore(file)).toThrow('Versión de servicios incompatible');
  expect(store.db.prepare('SELECT version FROM operations_schema_version').get()).toEqual({
    version: 2,
  });
});
