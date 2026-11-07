import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PlatformStore, PlatformError, fail } from './store.ts';
import { InventoryStore } from './inventory.ts';
import { ExternalGateway, type GatewayOptions } from './externalGateway.ts';
import { SecretVault } from './secretVault.ts';
import {
  connectionDefinitionSchema,
  environmentInputSchema,
  environmentSchema,
  queryInputSchema,
  type ConnectionDefinition,
  type ConnectionEnvironment,
  type ConnectionSummary,
  type ConnectionContract,
  type EnvironmentSummary,
  type ConnectionResult,
} from '../../src/models/connections.ts';
import { operationValuesSchema } from '../../src/models/operations.ts';
interface Row {
  id: string;
  project_id: string;
  key: string;
  draft: string;
  revision: number;
  active: number;
  published_version: number;
}
interface EnvironmentRow {
  connection_id: string;
  environment: ConnectionEnvironment;
  revision: number;
  origin: string;
  path: string;
  auth: 'none' | 'bearer' | 'apiKey';
  header_name: string;
  secret: string | null;
}
export interface ConnectionOptions extends GatewayOptions {
  masterKey?: string;
}
export class ConnectionsStore {
  readonly gateway: ExternalGateway;
  readonly vault: SecretVault;
  constructor(
    readonly store: PlatformStore,
    options: ConnectionOptions = {},
  ) {
    this.gateway = new ExternalGateway(options);
    this.vault = new SecretVault(options.masterKey ?? process.env.CONNECTOR_MASTER_KEY);
  }
  policy() {
    return { allowedHosts: [...this.gateway.hosts], encryptionReady: this.vault.ready };
  }
  private row(projectId: string, id: string) {
    return (
      (this.store.db
        .prepare('SELECT * FROM connections WHERE project_id=? AND id=?')
        .get(projectId, id) as Row | undefined) ?? fail(404, 'Conexión no encontrada')
    );
  }
  private definition(input: unknown) {
    return connectionDefinitionSchema.parse(input);
  }
  private hash(definition: ConnectionDefinition) {
    return createHash('sha256').update(JSON.stringify(definition)).digest('hex');
  }
  private version(projectId: string, id: string, version: number) {
    this.row(projectId, id);
    const value = this.store.db
      .prepare('SELECT definition FROM connection_versions WHERE connection_id=? AND version=?')
      .get(id, version) as { definition: string } | undefined;
    return value
      ? this.definition(JSON.parse(value.definition))
      : fail(404, 'Versión de conexión no encontrada');
  }
  private contract(
    id: string,
    version: number,
    definition: ConnectionDefinition,
  ): ConnectionContract {
    return {
      id,
      version,
      name: definition.name,
      inputs: definition.inputs,
      fields: definition.fields.map(({ key, label, type, required }) => ({
        key,
        label,
        type,
        required,
      })),
    };
  }
  list(projectId: string) {
    return (
      this.store.db
        .prepare('SELECT * FROM connections WHERE project_id=? ORDER BY key')
        .all(projectId) as Row[]
    ).map((row): ConnectionSummary => ({
      id: row.id,
      revision: row.revision,
      active: !!row.active,
      publishedVersion: row.published_version,
      draft: this.definition(JSON.parse(row.draft)),
      versions: (
        this.store.db
          .prepare(
            'SELECT version,definition FROM connection_versions WHERE connection_id=? ORDER BY version DESC',
          )
          .all(row.id) as { version: number; definition: string }[]
      ).map((v) => this.contract(row.id, v.version, this.definition(JSON.parse(v.definition)))),
    }));
  }
  save(projectId: string, userId: string, input: unknown, id?: string) {
    this.store.access(projectId, userId, true);
    const body = z
      .object({ revision: z.number().int().positive().optional(), definition: z.unknown() })
      .strict()
      .parse(input);
    const definition = this.definition(body.definition);
    return this.store.db
      .transaction(() => {
        const old = id ? this.row(projectId, id) : undefined;
        if (old && old.revision !== body.revision)
          fail(409, 'La conexión cambió. Recarga antes de guardar');
        if (old && old.key !== definition.key)
          fail(409, 'El identificador de conexión no puede cambiar');
        if (
          !old &&
          (
            this.store.db
              .prepare('SELECT COUNT(*) AS n FROM connections WHERE project_id=?')
              .get(projectId) as { n: number }
          ).n >= 20
        )
          fail(409, 'Máximo veinte conexiones por proyecto');
        if (
          this.store.db
            .prepare('SELECT id FROM connections WHERE project_id=? AND key=? AND id<>?')
            .get(projectId, definition.key, id ?? '')
        )
          fail(409, 'El identificador de conexión ya existe');
        const key = id ?? randomUUID();
        if (old)
          this.store.db
            .prepare('UPDATE connections SET draft=?,revision=revision+1 WHERE id=?')
            .run(JSON.stringify(definition), id);
        else
          this.store.db
            .prepare('INSERT INTO connections(id,project_id,key,draft) VALUES(?,?,?,?)')
            .run(key, projectId, definition.key, JSON.stringify(definition));
        this.store.audit(projectId, userId, 'connection.draft', key);
        return this.list(projectId).find((c) => c.id === key)!;
      })
      .immediate();
  }
  private environment(projectId: string, id: string, environment: ConnectionEnvironment) {
    this.row(projectId, id);
    return (
      (this.store.db
        .prepare('SELECT * FROM connection_environments WHERE connection_id=? AND environment=?')
        .get(id, environment) as EnvironmentRow | undefined) ??
      fail(409, 'Falta configurar el ambiente ' + environment)
    );
  }
  private environmentSummary(row: EnvironmentRow): EnvironmentSummary {
    return {
      environment: row.environment,
      revision: row.revision,
      origin: row.origin,
      path: row.path,
      auth: row.auth,
      headerName: row.header_name,
      secretConfigured: !!row.secret,
    };
  }
  environments(projectId: string, userId: string, id: string) {
    this.store.access(projectId, userId, false, true);
    this.row(projectId, id);
    return (
      this.store.db
        .prepare('SELECT * FROM connection_environments WHERE connection_id=? ORDER BY environment')
        .all(id) as EnvironmentRow[]
    ).map((row) => this.environmentSummary(row));
  }
  configureEnvironment(
    projectId: string,
    userId: string,
    id: string,
    environment: ConnectionEnvironment,
    input: unknown,
  ) {
    this.store.access(projectId, userId, false, true);
    this.row(projectId, id);
    const data = environmentInputSchema.parse(input),
      origin = this.gateway.origin(data.origin);
    const url = new URL(data.path, origin);
    if (url.origin !== origin) fail(400, 'La ruta cambia el dominio configurado');
    return this.store.db
      .transaction(() => {
        const old = this.store.db
          .prepare('SELECT * FROM connection_environments WHERE connection_id=? AND environment=?')
          .get(id, environment) as EnvironmentRow | undefined;
        if (data.revision !== (old?.revision ?? 0))
          fail(409, 'La configuración del ambiente cambió');
        const context = projectId + ':' + id + ':' + environment;
        const secret =
          data.auth === 'none'
            ? null
            : data.secret
              ? this.vault.encrypt(data.secret, context)
              : (old?.secret ?? null);
        if (data.auth !== 'none' && !secret)
          fail(400, 'Configura una credencial para este ambiente');
        if (secret && !this.vault.ready)
          fail(503, 'La clave de cifrado de conexiones no está disponible');
        this.store.db
          .prepare(
            'INSERT INTO connection_environments VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(connection_id,environment) DO UPDATE SET revision=excluded.revision,origin=excluded.origin,path=excluded.path,auth=excluded.auth,header_name=excluded.header_name,secret=excluded.secret',
          )
          .run(
            id,
            environment,
            (old?.revision ?? 0) + 1,
            origin,
            data.path,
            data.auth,
            data.headerName,
            secret,
          );
        this.store.audit(projectId, userId, 'connection.environment.' + environment, id);
        return this.environmentSummary(this.environment(projectId, id, environment));
      })
      .immediate();
  }
  private checked(
    id: string,
    environment: ConnectionEnvironment,
    revision: number,
    definition: ConnectionDefinition,
    fresh = false,
  ) {
    const value = this.store.db
      .prepare(
        'SELECT status,checked_at FROM connection_checks WHERE connection_id=? AND environment=? AND environment_revision=? AND definition_hash=?',
      )
      .get(id, environment, revision, this.hash(definition)) as
      { status: string; checked_at: number } | undefined;
    return (
      !!value && value.status === 'ok' && (!fresh || Date.now() - value.checked_at <= 86400000)
    );
  }
  publish(projectId: string, userId: string, id: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const { revision } = z.object({ revision: z.number().int().positive() }).strict().parse(input);
    return this.store.db
      .transaction(() => {
        const row = this.row(projectId, id);
        if (row.revision !== revision) fail(409, 'La conexión cambió antes de publicar');
        const definition = this.definition(JSON.parse(row.draft)),
          environment = this.environment(projectId, id, 'production');
        if (!this.checked(id, 'production', environment.revision, definition, true))
          fail(
            409,
            'Comprueba este contrato en producción antes de publicarlo (la comprobación debe ser de las últimas 24 horas)',
          );
        const version =
          (
            this.store.db
              .prepare(
                'SELECT COALESCE(MAX(version),0) AS v FROM connection_versions WHERE connection_id=?',
              )
              .get(id) as { v: number }
          ).v + 1;
        if (version > 20) fail(409, 'Máximo veinte versiones de conexión');
        this.store.db
          .prepare('INSERT INTO connection_versions VALUES(?,?,?,?)')
          .run(id, version, JSON.stringify(definition), new Date().toISOString());
        this.store.db
          .prepare('UPDATE connections SET published_version=?,revision=revision+1 WHERE id=?')
          .run(version, id);
        this.store.audit(projectId, userId, 'connection.publish', id);
        return this.list(projectId).find((c) => c.id === id)!;
      })
      .immediate();
  }
  configure(projectId: string, userId: string, id: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const data = z
      .object({
        revision: z.number().int().positive(),
        active: z.boolean().optional(),
        version: z.number().int().positive().optional(),
      })
      .strict()
      .parse(input);
    return this.store.db
      .transaction(() => {
        const row = this.row(projectId, id);
        if (row.revision !== data.revision)
          fail(409, 'La conexión cambió. Recarga antes de modificarla');
        if (data.version) this.version(projectId, id, data.version);
        this.store.db
          .prepare(
            'UPDATE connections SET active=?,published_version=?,revision=revision+1 WHERE id=?',
          )
          .run(
            data.active === undefined ? row.active : data.active ? 1 : 0,
            data.version ?? row.published_version,
            id,
          );
        this.store.audit(projectId, userId, 'connection.configure', id);
        return this.list(projectId).find((c) => c.id === id)!;
      })
      .immediate();
  }
  access(projectId: string, userId: string, id: string, version: number) {
    const role = new InventoryStore(this.store).access(projectId, userId);
    const row = this.row(projectId, id);
    if (!row.active || !row.published_version)
      fail(409, 'La conexión está desactivada o no publicada');
    const definition = this.version(projectId, id, version),
      current = this.version(projectId, id, row.published_version);
    return {
      canQuery: definition.allowedRoles.includes(role) && current.allowedRoles.includes(role),
      userId,
      contract: this.contract(id, version, definition),
    };
  }
  private at(value: unknown, path: string[]) {
    let current = value;
    for (const key of path) {
      if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key))
        return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }
  private mapped(definition: ConnectionDefinition, body: unknown, secret: string | null) {
    const target = this.at(body, definition.responsePath);
    const rows = definition.responseMode === 'list' ? target : [target];
    if (!Array.isArray(rows) || rows.length > 100)
      fail(502, 'La respuesta no cumple el contrato: se esperan hasta cien resultados');
    if (
      definition.responseMode === 'object' &&
      (target === null || typeof target !== 'object' || Array.isArray(target))
    )
      fail(502, 'La respuesta no cumple el contrato de objeto');
    return rows.map((row) =>
      Object.fromEntries(
        definition.fields.map((field) => {
          const value = this.at(row, field.path);
          if (value === null || value === undefined) {
            if (field.required) fail(502, 'La respuesta no cumple el campo ' + field.label);
            return [field.key, null];
          }
          const valid =
            field.type === 'integer' || field.type === 'money'
              ? typeof value === 'number' && Number.isSafeInteger(value)
              : field.type === 'boolean'
                ? typeof value === 'boolean'
                : field.type === 'date'
                  ? typeof value === 'string' &&
                    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
                    Number.isFinite(Date.parse(value)) &&
                    new Date(value).toISOString().slice(0, 10) === value
                  : typeof value === 'string' && value.length <= 1000;
          if (!valid) fail(502, 'La respuesta no cumple el tipo de ' + field.label);
          if (
            secret &&
            (String(value).includes(secret) ||
              String(value).includes(encodeURIComponent(secret)) ||
              String(value).includes(Buffer.from(secret).toString('base64')))
          )
            fail(502, 'La respuesta contiene un dato protegido y no se devuelve');
          return [field.key, value as string | number | boolean];
        }),
      ),
    );
  }
  private event(
    projectId: string,
    userId: string,
    id: string,
    environment: ConnectionEnvironment,
    version: number,
    status: number,
    start: number,
  ) {
    this.store.db
      .transaction(() => {
        this.store.db
          .prepare(
            'INSERT INTO connection_events(project_id,connection_id,actor_id,environment,version,status,duration_ms,created_at) VALUES(?,?,?,?,?,?,?,?)',
          )
          .run(
            projectId,
            id,
            userId,
            environment,
            version,
            status,
            Date.now() - start,
            new Date().toISOString(),
          );
        this.store.db
          .prepare(
            'DELETE FROM connection_events WHERE connection_id=? AND id NOT IN(SELECT id FROM connection_events WHERE connection_id=? ORDER BY id DESC LIMIT 500)',
          )
          .run(id, id);
      })
      .immediate();
  }
  private async perform(
    projectId: string,
    userId: string,
    id: string,
    definition: ConnectionDefinition,
    environment: ConnectionEnvironment,
    input: unknown,
    version: number,
    recheck: () => void,
  ): Promise<ConnectionResult> {
    const values = this.store.validateValues(
      projectId,
      {
        id: 'connection-input',
        key: 'connection_input',
        name: 'Parámetros',
        labelField: definition.inputs[0]?.key ?? 'nombre',
        fields: definition.inputs,
      },
      input,
    );
    const config = this.environment(projectId, id, environment),
      url = new URL(config.path, config.origin);
    for (const [param, key] of Object.entries(definition.parameters))
      if (values[key] !== null && values[key] !== undefined)
        url.searchParams.set(param, String(values[key]));
    const start = Date.now();
    let status = 200;
    try {
      const secret = config.secret
        ? this.vault.decrypt(config.secret, projectId + ':' + id + ':' + environment)
        : null;
      const headers: Record<string, string> = {};
      if (config.auth === 'bearer') headers.Authorization = 'Bearer ' + secret;
      else if (config.auth === 'apiKey') headers[config.header_name] = secret!;
      const body = await this.gateway.get(projectId, url, headers);
      const items = this.mapped(definition, body, secret);
      recheck();
      if (this.environment(projectId, id, environment).revision !== config.revision)
        fail(409, 'La configuración del ambiente cambió durante la consulta');
      return { connectionId: id, version, items, checkedAt: new Date().toISOString() };
    } catch (error) {
      status = error instanceof PlatformError ? error.status : 502;
      if (error instanceof PlatformError) throw error;
      fail(502, 'No se pudo validar la respuesta del proveedor');
    } finally {
      this.event(projectId, userId, id, environment, version, status, start);
    }
  }
  async test(projectId: string, userId: string, id: string, input: unknown) {
    const project = this.store.access(projectId, userId, true);
    const data = z
      .object({
        environment: environmentSchema,
        revision: z.number().int().positive(),
        version: z.number().int().positive().optional(),
        input: operationValuesSchema,
      })
      .strict()
      .parse(input);
    if (data.environment === 'production' && project.role !== 'owner')
      fail(403, 'Solo el propietario comprueba producción');
    const row = this.row(projectId, id);
    if (row.revision !== data.revision) fail(409, 'El contrato cambió antes de probar');
    const definition = data.version
        ? this.version(projectId, id, data.version)
        : this.definition(JSON.parse(row.draft)),
      environment = this.environment(projectId, id, data.environment);
    let status = 'failed';
    try {
      const result = await this.perform(
        projectId,
        userId,
        id,
        definition,
        data.environment,
        data.input,
        data.version ?? 0,
        () => {
          this.store.access(projectId, userId, true, data.environment === 'production');
          if (this.row(projectId, id).revision !== row.revision)
            fail(409, 'El contrato cambió durante la prueba');
        },
      );
      status = 'ok';
      return result;
    } finally {
      this.store.db
        .prepare(
          'INSERT INTO connection_checks VALUES(?,?,?,?,?,?) ON CONFLICT(connection_id,environment,environment_revision,definition_hash) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status',
        )
        .run(id, data.environment, environment.revision, this.hash(definition), Date.now(), status);
    }
  }
  async query(projectId: string, userId: string, id: string, input: unknown) {
    const data = queryInputSchema.parse(input),
      access = this.access(projectId, userId, id, data.version);
    if (!access.canQuery) fail(403, 'Tu permiso no permite consultar esta conexión');
    const definition = this.version(projectId, id, data.version),
      environment = this.environment(projectId, id, 'production');
    if (!this.checked(id, 'production', environment.revision, definition))
      fail(409, 'La configuración de producción necesita comprobarse para esta versión');
    return this.perform(
      projectId,
      userId,
      id,
      definition,
      'production',
      data.input,
      data.version,
      () => {
        if (!this.access(projectId, userId, id, data.version).canQuery)
          fail(403, 'Tu permiso cambió durante la consulta');
      },
    );
  }
  details(projectId: string, id: string) {
    this.row(projectId, id);
    const pages = this.store.db
      .prepare('SELECT id,draft,published FROM pages WHERE project_id=?')
      .all(projectId) as { id: string; draft: string; published: string | null }[];
    const contracts = pages
      .filter(
        (p) =>
          p.published &&
          (JSON.parse(p.published).connections ?? []).some((c: ConnectionContract) => c.id === id),
      )
      .map((p) => ({
        id: p.id,
        name: JSON.parse(p.draft).name,
        version: (JSON.parse(p.published!).connections as ConnectionContract[]).find(
          (c) => c.id === id,
        )!.version,
      }));
    return {
      pages: contracts,
      checks: this.store.db
        .prepare(
          'SELECT environment,environment_revision AS environmentRevision,status,checked_at AS checkedAt FROM connection_checks WHERE connection_id=? ORDER BY checked_at DESC LIMIT 20',
        )
        .all(id),
      events: this.store.db
        .prepare(
          'SELECT environment,version,status,duration_ms AS durationMs,created_at AS createdAt FROM connection_events WHERE project_id=? AND connection_id=? ORDER BY id DESC LIMIT 20',
        )
        .all(projectId, id),
    };
  }
}
