import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { PlatformStore, fail } from './store.ts';
import {
  inventoryConfigInput,
  inventoryRoleSchema,
  movementInput,
  type ApplicationAccess,
  type InventoryConfig,
  type InventoryRole,
  type Movement,
  type StockItem,
} from '../../src/models/inventory.ts';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const pagination = (params: URLSearchParams) => ({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(params.get('page') ?? 1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(params.get('pageSize') ?? 20),
});
export class InventoryStore {
  constructor(readonly store: PlatformStore) {}
  applications(userId: string): ApplicationAccess[] {
    return (
      this.store.db
        .prepare(
          `SELECT p.id,p.name,o.name AS organization,p.archived,CASE WHEN o.owner_id=? THEN 'admin' ELSE a.role END AS role FROM projects p JOIN organizations o ON o.id=p.organization_id JOIN inventory_config c ON c.project_id=p.id LEFT JOIN application_members a ON a.project_id=p.id AND a.user_id=? WHERE o.owner_id=? OR a.user_id IS NOT NULL ORDER BY o.name`,
        )
        .all(userId, userId, userId) as (Omit<ApplicationAccess, 'archived'> & {
        archived: number;
      })[]
    ).map((p) => ({ ...p, archived: !!p.archived }));
  }
  access(
    projectId: string,
    userId: string,
    operation: 'read' | 'move' | 'admin' = 'read',
  ): InventoryRole {
    const project = this.store.db
      .prepare(
        `SELECT p.archived,o.owner_id AS ownerId,a.role FROM projects p JOIN organizations o ON o.id=p.organization_id LEFT JOIN application_members a ON a.project_id=p.id AND a.user_id=? WHERE p.id=?`,
      )
      .get(userId, projectId) as
      { archived: number; ownerId: string; role: InventoryRole | null } | undefined;
    if (!project || (project.ownerId !== userId && !project.role)) {
      if (this.store.projects(userId).some((p) => p.id === projectId))
        fail(403, 'Necesitas acceso operativo al inventario. Solicítalo al propietario.');
      fail(404, 'Proyecto no encontrado');
    }
    if (project.archived) fail(409, 'El proyecto está archivado');
    const role = project.ownerId === userId ? 'admin' : project.role!;
    if (operation === 'admin' && role !== 'admin')
      fail(403, 'Solo un administrador de inventario puede realizar esta operación');
    if (operation === 'move' && role === 'viewer')
      fail(403, 'Tu acceso al inventario es de consulta');
    return role;
  }
  config(projectId: string): InventoryConfig {
    const row = this.store.db
      .prepare('SELECT definition FROM inventory_config WHERE project_id=?')
      .get(projectId) as { definition: string } | undefined;
    return row ? JSON.parse(row.definition) : fail(404, 'El inventario todavía no está activado');
  }
  configure(projectId: string, userId: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const data = inventoryConfigInput.parse(input),
      entity = this.store.entity(projectId, data.entityId);
    for (const [key, type] of [
      [data.nameField, 'text'],
      [data.skuField, 'text'],
      [data.unitField, 'relation'],
    ])
      if (key && !entity.fields.some((f) => f.key === key && f.type === type))
        fail(400, 'La conexión contiene un campo incompatible');
    return this.store.db
      .transaction(() => {
        const existing = this.store.db
          .prepare('SELECT definition FROM inventory_config WHERE project_id=?')
          .get(projectId) as { definition: string } | undefined;
        if (existing) {
          if (existing.definition === JSON.stringify(data)) return data;
          fail(
            409,
            'El inventario ya está conectado a un catálogo. No puede cambiarse sin migrar sus movimientos.',
          );
        }
        this.store.db
          .prepare('INSERT INTO inventory_config VALUES(?,?,?)')
          .run(projectId, data.entityId, JSON.stringify(data));
        this.store.audit(projectId, userId, 'inventory.enable', data.entityId);
        return data;
      })
      .immediate();
  }
  private product(projectId: string, id: string) {
    const config = this.config(projectId);
    return { config, record: this.store.getRecord(projectId, config.entityId, id) };
  }
  private balances(projectId: string) {
    const result = new Map<string, bigint>();
    for (const row of this.store.db
      .prepare('SELECT product_id,delta FROM inventory_movements WHERE project_id=?')
      .all(projectId) as { product_id: string; delta: number }[])
      result.set(row.product_id, (result.get(row.product_id) ?? 0n) + BigInt(row.delta));
    return result;
  }
  balance(projectId: string, id: string) {
    const value = this.balances(projectId).get(id) ?? 0n;
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
      fail(409, 'El saldo no es un entero seguro');
    return Number(value);
  }
  stock(projectId: string, params: URLSearchParams) {
    const config = this.config(projectId),
      balances = this.balances(projectId);
    const minimums = new Map(
      (
        this.store.db
          .prepare('SELECT product_id,minimum,revision FROM inventory_minimums WHERE project_id=?')
          .all(projectId) as { product_id: string; minimum: number; revision: number }[]
      ).map((m) => [m.product_id, m]),
    );
    const query = (params.get('q') ?? '').slice(0, 100).toLocaleLowerCase();
    const { page, pageSize } = pagination(params);
    const records = this.store.db
      .prepare('SELECT id,active FROM records WHERE project_id=? AND entity_id=?')
      .all(projectId, config.entityId) as { id: string; active: number }[];
    const items: StockItem[] = records
      .filter((r) => r.active || params.get('includeInactive') === 'true')
      .map((r) => {
        const record = this.store.getRecord(projectId, config.entityId, r.id),
          minimum = minimums.get(r.id);
        const balance = Number(balances.get(r.id) ?? 0n);
        if (!Number.isSafeInteger(balance) || balance < 0) fail(409, 'Saldo fuera de rango');
        return {
          id: r.id,
          name: String(record.values[config.nameField] ?? r.id),
          sku: config.skuField ? String(record.values[config.skuField] ?? '') : '',
          unit: config.unitField ? (record.labels[config.unitField] ?? '') : '',
          active: record.active,
          revision: record.revision,
          balance,
          minimum: minimum?.minimum ?? 0,
          minimumRevision: minimum?.revision ?? 0,
          belowMinimum: balance < (minimum?.minimum ?? 0),
        };
      })
      .filter(
        (r) =>
          (!query || (r.name + ' ' + r.sku).toLocaleLowerCase().includes(query)) &&
          (params.get('lowOnly') !== 'true' || r.belowMinimum),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    };
  }
  move(projectId: string, userId: string, input: unknown) {
    const data = movementInput.parse(input);
    this.access(projectId, userId, data.type === 'adjust' ? 'admin' : 'move');
    const fingerprint = hash(JSON.stringify(data));
    return this.store.db
      .transaction(() => {
        const duplicate = this.store.db
          .prepare(
            'SELECT request_hash,actor_id,data FROM inventory_movements WHERE project_id=? AND operation_id=?',
          )
          .get(projectId, data.operationId) as
          { request_hash: string; actor_id: string; data: string } | undefined;
        if (duplicate) {
          if (duplicate.request_hash !== fingerprint || duplicate.actor_id !== userId)
            fail(409, 'Ese identificador de operación ya se usó con otra solicitud');
          return { movement: JSON.parse(duplicate.data) as Movement, replayed: true };
        }
        const { config, record } = this.product(projectId, data.productId);
        if (!record.active && data.type !== 'adjust')
          fail(
            409,
            'El producto está inactivo. Solo se permiten ajustes administrativos justificados.',
          );
        const before = this.balance(projectId, data.productId);
        if (data.type === 'adjust' && data.expectedBalance !== before)
          fail(409, 'El saldo cambió desde que lo consultaste. Actualiza antes de ajustar.');
        if (data.referenceId) {
          const reference = this.store.db
            .prepare(
              'SELECT id FROM inventory_movements WHERE project_id=? AND product_id=? AND id=?',
            )
            .get(projectId, data.productId, data.referenceId);
          if (!reference)
            fail(400, 'La referencia no corresponde a un movimiento de este producto');
        }
        const delta = data.type === 'exit' ? -data.quantity : data.quantity;
        const next = BigInt(before) + BigInt(delta);
        if (next < 0n) fail(409, 'Existencias insuficientes. Disponible: ' + before);
        if (next > BigInt(Number.MAX_SAFE_INTEGER))
          fail(400, 'El saldo excedería el rango de enteros seguros');
        const actor = this.store.db.prepare('SELECT name FROM users WHERE id=?').get(userId) as {
          name: string;
        };
        const movement: Movement = {
          id: randomUUID(),
          operationId: data.operationId,
          productId: data.productId,
          productName: String(record.values[config.nameField] ?? data.productId),
          sku: config.skuField ? String(record.values[config.skuField] ?? '') : '',
          type: data.type,
          quantity: data.quantity,
          delta,
          before,
          after: Number(next),
          reason: data.reason,
          referenceId: data.referenceId ?? null,
          actorId: userId,
          actorName: actor.name,
          createdAt: new Date().toISOString(),
        };
        this.store.db
          .prepare('INSERT INTO inventory_movements VALUES(?,?,?,?,?,?,?,?,?)')
          .run(
            movement.id,
            projectId,
            data.productId,
            data.operationId,
            fingerprint,
            JSON.stringify(movement),
            delta,
            movement.createdAt,
            userId,
          );
        this.store.audit(projectId, userId, 'inventory.' + data.type, movement.id);
        return { movement, replayed: false };
      })
      .immediate();
  }
  history(projectId: string, params: URLSearchParams) {
    this.config(projectId);
    const { page, pageSize } = pagination(params);
    const type = params.get('type');
    if (type && !['entry', 'exit', 'adjust'].includes(type))
      fail(400, 'Tipo de movimiento inválido');
    const date = (name: string) => {
      const value = params.get(name);
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        fail(400, 'Fecha inválida');
      return value;
    };
    const from = date('from'),
      to = date('to');
    if (from && to && from > to) fail(400, 'Rango de fechas inválido');
    const productId = params.get('productId'),
      actorId = params.get('actorId');
    const items = (
      this.store.db
        .prepare('SELECT data FROM inventory_movements WHERE project_id=? ORDER BY rowid DESC')
        .all(projectId) as { data: string }[]
    )
      .map((r) => JSON.parse(r.data) as Movement)
      .filter(
        (m) =>
          (!productId || m.productId === productId) &&
          (!actorId || m.actorId === actorId) &&
          (!type || m.type === type) &&
          (!from || m.createdAt.slice(0, 10) >= from) &&
          (!to || m.createdAt.slice(0, 10) <= to),
      );
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    };
  }
  minimum(projectId: string, userId: string, productId: string, input: unknown) {
    this.access(projectId, userId, 'admin');
    const data = z
      .object({
        minimum: z.number().int().safe().nonnegative(),
        revision: z.number().int().nonnegative(),
      })
      .strict()
      .parse(input);
    return this.store.db
      .transaction(() => {
        this.product(projectId, productId);
        const old = this.store.db
          .prepare('SELECT revision FROM inventory_minimums WHERE project_id=? AND product_id=?')
          .get(projectId, productId) as { revision: number } | undefined;
        if (data.revision !== (old?.revision ?? 0))
          fail(409, 'El mínimo cambió. Actualiza antes de guardar.');
        this.store.db
          .prepare(
            'INSERT INTO inventory_minimums VALUES(?,?,?,1) ON CONFLICT(project_id,product_id) DO UPDATE SET minimum=excluded.minimum,revision=inventory_minimums.revision+1',
          )
          .run(projectId, productId, data.minimum);
        this.store.audit(projectId, userId, 'inventory.minimum', productId);
        return { minimum: data.minimum, revision: (old?.revision ?? 0) + 1 };
      })
      .immediate();
  }
  setActive(projectId: string, userId: string, productId: string, input: unknown) {
    this.access(projectId, userId, 'admin');
    const data = z
      .object({ active: z.boolean(), revision: z.number().int().positive() })
      .strict()
      .parse(input);
    return this.store.db
      .transaction(() => {
        const { record } = this.product(projectId, productId);
        if (record.revision !== data.revision)
          fail(409, 'El producto cambió. Actualiza antes de cambiar su estado.');
        this.store.db
          .prepare(
            'UPDATE records SET active=?,revision=revision+1,updated_at=? WHERE project_id=? AND id=?',
          )
          .run(data.active ? 1 : 0, new Date().toISOString(), projectId, productId);
        this.store.audit(
          projectId,
          userId,
          data.active ? 'inventory.activate' : 'inventory.deactivate',
          productId,
        );
        return { active: data.active, revision: record.revision + 1 };
      })
      .immediate();
  }
  members(projectId: string, userId: string) {
    this.store.access(projectId, userId, false, true);
    const members = this.store.db
      .prepare(
        'SELECT u.id AS userId,u.name,u.email,a.role FROM application_members a JOIN users u ON u.id=a.user_id WHERE a.project_id=? ORDER BY u.name',
      )
      .all(projectId);
    const invitations = this.store.db
      .prepare(
        'SELECT id,email,role,expires_at AS expiresAt FROM application_invitations WHERE project_id=? AND expires_at>?',
      )
      .all(projectId, Date.now());
    return { members, invitations };
  }
  setRole(projectId: string, userId: string, targetId: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const data = z
      .object({ role: z.union([inventoryRoleSchema, z.literal('none')]) })
      .strict()
      .parse(input);
    const org = this.store.db
      .prepare(
        'SELECT owner_id FROM organizations o JOIN projects p ON p.organization_id=o.id WHERE p.id=?',
      )
      .get(projectId) as { owner_id: string };
    if (targetId === org.owner_id)
      fail(400, 'El propietario conserva la administración del inventario');
    const exists = this.store.db
      .prepare(
        'SELECT user_id FROM members WHERE project_id=? AND user_id=? UNION SELECT user_id FROM application_members WHERE project_id=? AND user_id=?',
      )
      .get(projectId, targetId, projectId, targetId);
    if (!exists) fail(404, 'Usuario no encontrado en este proyecto');
    this.store.db
      .transaction(() => {
        if (data.role === 'none')
          this.store.db
            .prepare('DELETE FROM application_members WHERE project_id=? AND user_id=?')
            .run(projectId, targetId);
        else
          this.store.db
            .prepare(
              'INSERT INTO application_members VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role',
            )
            .run(projectId, targetId, data.role);
        this.store.audit(projectId, userId, 'application.role', targetId);
      })
      .immediate();
    return { role: data.role };
  }
  invite(projectId: string, userId: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const data = z
      .object({
        email: z.string().trim().toLowerCase().email().max(200),
        role: inventoryRoleSchema,
      })
      .parse(input);
    const existing = this.store.db
      .prepare(
        'SELECT u.id FROM users u JOIN application_members a ON a.user_id=u.id WHERE a.project_id=? AND u.email=?',
      )
      .get(projectId, data.email);
    if (existing)
      fail(409, 'La persona ya tiene acceso operativo; modifica su permiso en el listado');
    const token = randomBytes(32).toString('hex'),
      id = randomUUID(),
      expires = Date.now() + 72 * 60 * 60 * 1000;
    this.store.db
      .transaction(() => {
        this.store.db
          .prepare('DELETE FROM application_invitations WHERE project_id=? AND email=?')
          .run(projectId, data.email);
        this.store.db
          .prepare('INSERT INTO application_invitations VALUES(?,?,?,?,?,?)')
          .run(id, projectId, data.email, data.role, hash(token), expires);
        this.store.audit(projectId, userId, 'application.invite', id);
      })
      .immediate();
    return { token, id, expiresAt: expires };
  }
  operations(projectId: string) {
    this.config(projectId);
    return ['entry', 'exit', 'adjust'].map((type) => ({
      id: 'inventory.' + type,
      method: 'POST',
      path: '/api/v1/projects/' + projectId + '/inventory/movements',
      type,
      permission: type === 'adjust' ? 'admin' : 'operator',
      steps: [
        'validate-input',
        'check-permission',
        'check-idempotency',
        'load-product',
        'calculate-balance',
        ...(type === 'adjust'
          ? ['check-observed-balance', 'validate-correction-reference']
          : ['check-active-product']),
        'assert-nonnegative-safe-integer',
        'append-immutable-movement',
        'append-audit',
      ],
      transaction: 'immediate',
      input: {
        operationId: 'UUID único por intención',
        productId: 'Identificador del producto',
        type,
        quantity: type === 'adjust' ? 'Entero distinto de cero' : 'Entero positivo',
        reason: 'Justificación de 3 a 500 caracteres',
        ...(type === 'adjust'
          ? { expectedBalance: 'Saldo observado', referenceId: 'Movimiento corregido, opcional' }
          : {}),
      },
    }));
  }
}
