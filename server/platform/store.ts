import { initializeInventory } from './inventorySchema.ts';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  entityInputSchema,
  type Entity,
  type EntityInput,
  type DataRecord,
  type ProjectAccess,
} from '../../src/models/data.ts';
import {
  pageInputSchema,
  validTree,
  type Page,
  type ComponentNode,
} from '../../src/models/contracts.ts';

export class PlatformError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new PlatformError(status, message);
}
interface EntityRow {
  id: string;
  project_id: string;
  definition: string;
  revision: number;
}
interface RecordRow {
  id: string;
  project_id: string;
  entity_id: string;
  data: string;
  active: number;
  revision: number;
  created_at: string;
  updated_at: string;
}
interface PageRow {
  id: string;
  draft: string;
  published: string | null;
  revision: number;
  publication_version: number;
}
export class PlatformStore {
  readonly db: Database.Database;
  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new Database(file, { timeout: 5000 });
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id));
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id), name TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS members (project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','editor','reader')), PRIMARY KEY(project_id,user_id));
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), email TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('editor','reader')), token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), key TEXT NOT NULL, definition TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, UNIQUE(project_id,key));
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), entity_id TEXT NOT NULL REFERENCES entities(id), data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS records_scope ON records(project_id,entity_id);
      CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), code TEXT NOT NULL, draft TEXT NOT NULL, published TEXT, revision INTEGER NOT NULL DEFAULT 1, publication_version INTEGER NOT NULL DEFAULT 0, UNIQUE(project_id,code));
      CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT, user_id TEXT, action TEXT NOT NULL, target_id TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_version VALUES (1);
    `);
    const version = this.db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
      version: number;
    };
    if (version.version !== 1) throw new Error('Versión de base de datos incompatible');
    try {
      initializeInventory(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close() {
    this.db.close();
  }
  audit(projectId: string, userId: string, action: string, targetId: string) {
    this.db
      .prepare(
        'INSERT INTO audit(project_id,user_id,action,target_id,created_at) VALUES (?,?,?,?,?)',
      )
      .run(projectId, userId, action, targetId, new Date().toISOString());
  }
  projects(userId: string): ProjectAccess[] {
    return this.db
      .prepare(
        `SELECT p.id, p.organization_id AS organizationId, o.name AS organization, p.name, m.role, p.archived FROM projects p JOIN organizations o ON o.id=p.organization_id JOIN members m ON m.project_id=p.id WHERE m.user_id=? ORDER BY o.name`,
      )
      .all(userId)
      .map((r) => ({
        ...(r as Omit<ProjectAccess, 'archived'>),
        archived: !!(r as { archived: number }).archived,
      }));
  }
  access(projectId: string, userId: string, write = false, owner = false): ProjectAccess {
    const project =
      this.projects(userId).find((p) => p.id === projectId) ?? fail(404, 'Proyecto no encontrado');
    if (project.archived) fail(409, 'El proyecto está archivado');
    if (owner && project.role !== 'owner')
      fail(403, 'Solo el propietario puede realizar esta acción');
    if (write && project.role === 'reader') fail(403, 'Tu acceso al proyecto es de solo lectura');
    return project;
  }
  entities(projectId: string): Entity[] {
    return (
      this.db
        .prepare('SELECT * FROM entities WHERE project_id=? ORDER BY key')
        .all(projectId) as EntityRow[]
    ).map((r) => ({
      ...JSON.parse(r.definition),
      id: r.id,
      projectId: r.project_id,
      revision: r.revision,
    }));
  }
  entity(projectId: string, id: string): Entity {
    return this.entities(projectId).find((e) => e.id === id) ?? fail(404, 'Entidad no encontrada');
  }
  saveEntity(projectId: string, input: unknown, userId: string, id?: string): Entity {
    const data = entityInputSchema.parse(input);
    return this.db
      .transaction(() => {
        const existing = id ? this.entity(projectId, id) : undefined;
        if (existing && (input as { revision?: number }).revision !== existing.revision)
          fail(409, 'La entidad cambió. Recarga antes de guardar.');
        if (!existing && this.entities(projectId).length >= 50)
          fail(409, 'El piloto admite hasta 50 entidades por proyecto');
        const entities = this.entities(projectId);
        if (entities.some((e) => e.key === data.key && e.id !== id))
          fail(409, 'El identificador de entidad ya existe');
        if (existing && data.key !== existing.key)
          fail(409, 'El identificador estable de la entidad no puede cambiar');
        for (const field of data.fields)
          if (field.type === 'relation' && !entities.some((e) => e.id === field.relationEntityId))
            fail(400, 'La entidad relacionada no pertenece a este proyecto');
        if (existing) {
          const configured = this.db
            .prepare('SELECT definition FROM inventory_config WHERE project_id=? AND entity_id=?')
            .get(projectId, id) as { definition: string } | undefined;
          if (configured) {
            const cfg = JSON.parse(configured.definition);
            for (const key of [cfg.nameField, cfg.skuField, cfg.unitField].filter(Boolean)) {
              const old = existing.fields.find((f) => f.key === key);
              const next = data.fields.find((f) => f.key === key);
              if (
                !next ||
                next.type !== old?.type ||
                next.relationEntityId !== old.relationEntityId
              )
                fail(409, 'El campo está conectado al inventario y debe conservar su definición');
            }
          }
          const oldFields = JSON.stringify(existing.fields);
          if (oldFields !== JSON.stringify(data.fields)) {
            for (const row of this.db
              .prepare('SELECT published FROM pages WHERE project_id=? AND published IS NOT NULL')
              .all(projectId) as { published: string }[]) {
              const published = JSON.parse(row.published) as Page;
              if (published.entities?.some((e) => e.id === id))
                fail(
                  409,
                  'La entidad está usada en una publicación. Retira las páginas dependientes antes de cambiar su esquema.',
                );
            }
            for (const old of existing.fields)
              if (
                !data.fields.some(
                  (f) =>
                    f.key === old.key &&
                    f.type === old.type &&
                    f.relationEntityId === old.relationEntityId,
                )
              )
                fail(409, 'No se permite eliminar o cambiar el tipo de campos en E1');
            for (const row of this.recordRows(projectId, id!))
              this.validateValues(projectId, { ...data, id: id! }, JSON.parse(row.data), row.id);
          }
        }
        const key = id ?? randomUUID();
        if (existing)
          this.db
            .prepare(
              'UPDATE entities SET definition=?, revision=revision+1 WHERE id=? AND project_id=?',
            )
            .run(JSON.stringify(data), key, projectId);
        else
          this.db
            .prepare('INSERT INTO entities(id,project_id,key,definition) VALUES (?,?,?,?)')
            .run(key, projectId, data.key, JSON.stringify(data));
        this.audit(projectId, userId, existing ? 'entity.update' : 'entity.create', key);
        return this.entity(projectId, key);
      })
      .immediate();
  }
  private recordRows(projectId: string, entityId: string): RecordRow[] {
    return this.db
      .prepare(
        'SELECT * FROM records WHERE project_id=? AND entity_id=? ORDER BY created_at DESC,id',
      )
      .all(projectId, entityId) as RecordRow[];
  }
  private validateValues(
    projectId: string,
    entity: EntityInput & { id: string },
    input: unknown,
    recordId?: string,
  ): DataRecord['values'] {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      fail(400, 'Valores de registro inválidos');
    const raw = input as Record<string, unknown>;
    const values: DataRecord['values'] = {};
    const errors: Record<string, string> = {};
    for (const key of Object.keys(raw))
      if (!entity.fields.some((f) => f.key === key)) errors[key] = 'Campo no declarado';
    for (const field of entity.fields) {
      let value = raw[field.key];
      if (typeof value === 'string') value = value.trim();
      if (value === undefined || value === null || value === '') {
        if (field.required) errors[field.key] = 'Este campo es obligatorio';
        values[field.key] = null;
        continue;
      }
      if (field.type === 'integer' || field.type === 'money') {
        if (typeof value !== 'number' || !Number.isSafeInteger(value))
          errors[field.key] = 'Debe ser un entero dentro del rango seguro';
        else if (
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max)
        )
          errors[field.key] = 'Valor fuera del rango permitido';
      } else if (field.type === 'boolean') {
        if (typeof value !== 'boolean') errors[field.key] = 'Debe ser verdadero o falso';
      } else if (typeof value !== 'string' || value.length > 1000)
        errors[field.key] = 'Texto inválido o demasiado largo';
      else if (
        field.type === 'date' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        errors[field.key] = 'Fecha inválida';
      else if (field.type === 'select' && !field.options.includes(value))
        errors[field.key] = 'Opción no permitida';
      else if (field.type === 'relation') {
        const referenced = this.db
          .prepare(
            'SELECT id FROM records WHERE id=? AND entity_id=? AND project_id=? AND (active=1 OR id=?)',
          )
          .get(value, field.relationEntityId, projectId, recordId ?? '');
        // A pre-existing inactive reference may be retained, but new assignments may not use it.
        const previous = recordId
          ? (this.db
              .prepare('SELECT data FROM records WHERE id=? AND project_id=?')
              .get(recordId, projectId) as { data: string } | undefined)
          : undefined;
        if (!referenced && (!previous || JSON.parse(previous.data)[field.key] !== value))
          errors[field.key] = 'Referencia inexistente o inactiva en este proyecto';
      }
      if (field.unique && !errors[field.key]) {
        if (
          this.recordRows(projectId, entity.id).some(
            (row) => row.id !== recordId && JSON.parse(row.data)[field.key] === value,
          )
        )
          errors[field.key] = 'Este valor ya está en uso';
      }
      if (!errors[field.key]) values[field.key] = value as string | number | boolean;
    }
    if (Object.keys(errors).length)
      throw new PlatformError(400, 'Revisa los campos indicados', errors);
    return values;
  }
  private record(row: RecordRow): DataRecord {
    const values = JSON.parse(row.data) as DataRecord['values'];
    const labels: Record<string, string> = {};
    for (const field of this.entity(row.project_id, row.entity_id).fields)
      if (field.type === 'relation' && typeof values[field.key] === 'string') {
        const target = this.entity(row.project_id, field.relationEntityId!);
        const related = this.db
          .prepare('SELECT data FROM records WHERE id=? AND project_id=? AND entity_id=?')
          .get(values[field.key], row.project_id, target.id) as { data: string } | undefined;
        if (related)
          labels[field.key] = String(
            JSON.parse(related.data)[target.labelField] ?? values[field.key],
          );
      }
    return {
      id: row.id,
      values,
      labels,
      active: !!row.active,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  listRecords(projectId: string, entityId: string, params: URLSearchParams) {
    const entity = this.entity(projectId, entityId);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(params.get('page') ?? 1);
    const pageSize = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(params.get('pageSize') ?? 20);
    const search = (params.get('q') ?? '').slice(0, 100).toLocaleLowerCase();
    const sort = params.get('sort') || entity.labelField;
    if (!entity.fields.some((f) => f.key === sort)) fail(400, 'Campo de orden inválido');
    const filters: Record<string, string> = {};
    params.forEach((v, k) => {
      if (k.startsWith('filter.')) {
        const key = k.slice(7);
        if (!entity.fields.some((f) => f.key === key)) fail(400, 'Filtro desconocido');
        filters[key] = v;
      }
    });
    let items = this.recordRows(projectId, entityId).filter((r) => {
      if (params.get('includeInactive') !== 'true' && !r.active) return false;
      const values = JSON.parse(r.data) as DataRecord['values'];
      return (
        (!search ||
          Object.values(values).some((v) =>
            String(v ?? '')
              .toLocaleLowerCase()
              .includes(search),
          )) &&
        Object.entries(filters).every(([k, v]) => String(values[k] ?? '') === v)
      );
    });
    const direction = params.get('direction') === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      const av = JSON.parse(a.data)[sort],
        bv = JSON.parse(b.data)[sort];
      return (
        direction *
          (typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av ?? '').localeCompare(String(bv ?? ''))) || a.id.localeCompare(b.id)
      );
    });
    const total = items.length;
    items = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: items.map((r) => this.record(r)), total, page, pageSize };
  }
  getRecord(projectId: string, entityId: string, id: string) {
    this.entity(projectId, entityId);
    const row = this.db
      .prepare('SELECT * FROM records WHERE id=? AND project_id=? AND entity_id=?')
      .get(id, projectId, entityId) as RecordRow | undefined;
    return row ? this.record(row) : fail(404, 'Registro no encontrado');
  }
  saveRecord(projectId: string, entityId: string, input: unknown, userId: string, id?: string) {
    return this.db
      .transaction(() => {
        const entity = this.entity(projectId, entityId);
        const data = z
          .object({
            values: z.record(z.string(), z.unknown()),
            revision: z.number().int().optional(),
          })
          .parse(input);
        if (id) {
          const existing = this.getRecord(projectId, entityId, id);
          if (!existing.active) fail(409, 'El registro está inactivo');
          if (data.revision !== existing.revision)
            fail(409, 'El registro cambió. Recarga antes de guardar.');
        }
        if (!id && this.recordRows(projectId, entityId).length >= 5000)
          fail(409, 'Límite del piloto: 5000 registros por entidad');
        const values = this.validateValues(projectId, entity, data.values, id);
        const key = id ?? randomUUID(),
          now = new Date().toISOString();
        if (id)
          this.db
            .prepare(
              'UPDATE records SET data=?,revision=revision+1,updated_at=? WHERE id=? AND project_id=?',
            )
            .run(JSON.stringify(values), now, key, projectId);
        else
          this.db
            .prepare(
              'INSERT INTO records(id,project_id,entity_id,data,created_at,updated_at) VALUES (?,?,?,?,?,?)',
            )
            .run(key, projectId, entityId, JSON.stringify(values), now, now);
        this.audit(projectId, userId, id ? 'record.update' : 'record.create', key);
        return this.getRecord(projectId, entityId, key);
      })
      .immediate();
  }
  deactivateRecord(
    projectId: string,
    entityId: string,
    id: string,
    revision: number,
    userId: string,
  ) {
    return this.db
      .transaction(() => {
        const old = this.getRecord(projectId, entityId, id);
        if (old.revision !== revision)
          fail(409, 'El registro cambió. Recarga antes de desactivarlo.');
        this.db
          .prepare(
            'UPDATE records SET active=0,revision=revision+1,updated_at=? WHERE id=? AND project_id=?',
          )
          .run(new Date().toISOString(), id, projectId);
        this.audit(projectId, userId, 'record.deactivate', id);
      })
      .immediate();
  }
  installInventory(projectId: string, userId: string) {
    return this.db
      .transaction(() => {
        const existing = this.entities(projectId);
        if (existing.some((e) => ['categorias', 'unidades', 'productos'].includes(e.key)))
          fail(
            409,
            'La plantilla requiere que no existan categorías, unidades o productos. No se modificaron tus datos.',
          );
        const base = {
          labelField: 'nombre',
          fields: [{ key: 'nombre', label: 'Nombre', type: 'text', required: true, unique: true }],
        };
        const category = this.saveEntity(
          projectId,
          { ...base, key: 'categorias', name: 'Categorías' },
          userId,
        );
        const unit = this.saveEntity(
          projectId,
          { ...base, key: 'unidades', name: 'Unidades' },
          userId,
        );
        this.saveEntity(
          projectId,
          {
            key: 'productos',
            name: 'Productos',
            labelField: 'nombre',
            fields: [
              { key: 'nombre', label: 'Nombre', type: 'text', required: true },
              { key: 'sku', label: 'SKU', type: 'text', required: true, unique: true },
              {
                key: 'categoria',
                label: 'Categoría',
                type: 'relation',
                required: true,
                relationEntityId: category.id,
              },
              {
                key: 'unidad',
                label: 'Unidad',
                type: 'relation',
                required: true,
                relationEntityId: unit.id,
              },
              { key: 'precio', label: 'Precio (S/)', type: 'money', required: true, min: 0 },
            ],
          },
          userId,
        );
        return this.entities(projectId);
      })
      .immediate();
  }
  pages(projectId: string): Page[] {
    return (
      this.db
        .prepare('SELECT * FROM pages WHERE project_id=? ORDER BY code')
        .all(projectId) as PageRow[]
    ).map((r) => ({
      ...JSON.parse(r.draft),
      revision: r.revision,
      projectId,
      publicationVersion: r.publication_version,
    }));
  }
  page(projectId: string, id: string): Page {
    return this.pages(projectId).find((p) => p.id === id) ?? fail(404, 'Página no encontrada');
  }
  bindings(projectId: string, components: ComponentNode[]): Entity[] {
    const entities = this.entities(projectId),
      used = new Set<string>();
    const add = (id: string) => {
      if (used.has(id)) return;
      const e =
        entities.find((e) => e.id === id) ?? fail(400, 'Una conexión usa una entidad inexistente');
      used.add(id);
      e.fields.forEach((f) => {
        if (f.type === 'relation') add(f.relationEntityId!);
      });
    };
    const visit = (nodes: ComponentNode[]) =>
      nodes.forEach((n) => {
        if (
          ![
            'Container',
            'Card',
            'Heading',
            'Paragraph',
            'Button',
            'Input',
            'DataForm',
            'DataTable',
            'DataDetail',
            'Inventory',
          ].includes(n.type)
        )
          fail(400, 'Componente no disponible: ' + n.type);
        if (n.type === 'Inventory') {
          const config = this.db
            .prepare('SELECT entity_id FROM inventory_config WHERE project_id=?')
            .get(projectId) as { entity_id: string } | undefined;
          if (!config) fail(400, 'Activa el inventario antes de publicar este componente');
          add(config.entity_id);
        }
        if (['DataForm', 'DataTable', 'DataDetail'].includes(n.type)) {
          if (typeof n.props.entityId !== 'string') fail(400, 'Selecciona la entidad de ' + n.type);
          add(n.props.entityId);
          if (
            n.type === 'DataForm' &&
            n.props.action &&
            !['create', 'update'].includes(String(n.props.action))
          )
            fail(400, 'Acción de formulario inválida');
        }
        visit(n.children ?? []);
      });
    visit(components);
    return entities.filter((e) => used.has(e.id));
  }
  savePage(projectId: string, input: unknown, userId: string, id?: string): Page {
    return this.db
      .transaction(() => {
        const data = pageInputSchema.parse(input);
        if (!validTree(data.components)) fail(400, 'Árbol de componentes inválido');
        const existing = id ? this.page(projectId, id) : undefined;
        if (existing && (input as { revision?: number }).revision !== existing.revision)
          fail(
            409,
            'La página cambió en otra sesión. Conserva tus cambios y recarga antes de guardar.',
          );
        const rows = this.db
          .prepare('SELECT id,code,published FROM pages WHERE project_id=?')
          .all(projectId) as { id: string; code: string; published: string | null }[];
        if (!id && rows.length >= 100) fail(409, 'Límite del piloto: 100 páginas');
        if (
          rows.some(
            (r) =>
              r.id !== id &&
              (r.code === data.code || (r.published && JSON.parse(r.published).code === data.code)),
          )
        )
          fail(409, 'El código de página está reservado');
        const key = id ?? randomUUID(),
          now = new Date().toISOString();
        const draft = { ...data, id: key, createdAt: existing?.createdAt ?? now, updatedAt: now };
        const version = (existing?.publicationVersion ?? 0) + (data.status === 'published' ? 1 : 0);
        const published =
          data.status === 'published'
            ? JSON.stringify({
                ...draft,
                projectId,
                entities: this.bindings(projectId, data.components),
                publicationVersion: version,
              })
            : null;
        if (id)
          this.db
            .prepare(
              'UPDATE pages SET code=?,draft=?,published=COALESCE(?,published),revision=revision+1,publication_version=? WHERE id=? AND project_id=?',
            )
            .run(data.code, JSON.stringify(draft), published, version, key, projectId);
        else
          this.db
            .prepare(
              'INSERT INTO pages(id,project_id,code,draft,published,publication_version) VALUES (?,?,?,?,?,?)',
            )
            .run(key, projectId, data.code, JSON.stringify(draft), published, version);
        this.audit(
          projectId,
          userId,
          data.status === 'published' ? 'page.publish' : 'page.save',
          key,
        );
        return this.page(projectId, key);
      })
      .immediate();
  }
  published(projectId: string, path: string): Page {
    const rows = this.db
      .prepare('SELECT published FROM pages WHERE project_id=? AND published IS NOT NULL')
      .all(projectId) as { published: string }[];
    return (
      rows.map((r) => JSON.parse(r.published) as Page).find((p) => '/' + p.code === path) ??
      fail(404, 'Página no encontrada')
    );
  }
}
