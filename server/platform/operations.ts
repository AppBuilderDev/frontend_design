import type { ComponentNode } from '../../src/models/contracts.ts';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PlatformStore, PlatformError, fail } from './store.ts';
import { InventoryStore } from './inventory.ts';
import {
  operationInputSchema,
  executionInputSchema,
  operationValuesSchema,
  type OperationDefinition,
  type OperationContract,
  type OperationResult,
  type OperationSummary,
  type ValueExpression,
} from '../../src/models/operations.ts';
import type { Entity, DataField, DataRecord } from '../../src/models/data.ts';
type Primitive = 'string' | 'number' | 'boolean' | 'null';
type Value = string | number | boolean | null;
interface OperationRow {
  key: string;
  id: string;
  project_id: string;
  draft: string;
  revision: number;
  active: number;
  published_version: number;
}
class Simulation extends Error {
  constructor(readonly result: OperationResult) {
    super('Simulación');
  }
}
const primitive = (field: DataField): Primitive =>
  field.type === 'integer' || field.type === 'money'
    ? 'number'
    : field.type === 'boolean'
      ? 'boolean'
      : 'string';
export class OperationsStore {
  constructor(readonly store: PlatformStore) {}
  private row(projectId: string, id: string) {
    return (
      (this.store.db
        .prepare('SELECT * FROM operations WHERE project_id=? AND id=?')
        .get(projectId, id) as OperationRow | undefined) ?? fail(404, 'Servicio no encontrado')
    );
  }
  private version(projectId: string, id: string, version: number) {
    this.row(projectId, id);
    const row = this.store.db
      .prepare('SELECT definition FROM operation_versions WHERE service_id=? AND version=?')
      .get(id, version) as { definition: string } | undefined;
    return row
      ? operationInputSchema.parse(JSON.parse(row.definition))
      : fail(404, 'Versión no encontrada');
  }
  private contract(
    id: string,
    version: number,
    definition: OperationDefinition,
  ): OperationContract {
    return {
      id,
      version,
      name: definition.name,
      inputs: definition.inputs,
      allowOperators: definition.allowOperators,
    };
  }
  list(projectId: string): OperationSummary[] {
    return (
      this.store.db
        .prepare('SELECT * FROM operations WHERE project_id=? ORDER BY key')
        .all(projectId) as OperationRow[]
    ).map((row) => ({
      id: row.id,
      projectId,
      revision: row.revision,
      active: !!row.active,
      publishedVersion: row.published_version,
      draft: operationInputSchema.parse(JSON.parse(row.draft)),
      versions: (
        this.store.db
          .prepare(
            'SELECT version,definition FROM operation_versions WHERE service_id=? ORDER BY version DESC',
          )
          .all(row.id) as { version: number; definition: string }[]
      ).map((v) =>
        this.contract(row.id, v.version, operationInputSchema.parse(JSON.parse(v.definition))),
      ),
    }));
  }
  validate(
    projectId: string,
    input: unknown,
  ): { definition: OperationDefinition; entities: Entity[] } {
    const definition = operationInputSchema.parse(input),
      all = this.store.entities(projectId),
      used = new Set<string>(),
      aliases = new Map<string, Entity>();
    const entity = (id: string) => {
      const item =
        all.find((e) => e.id === id) ??
        fail(400, 'El servicio usa una entidad inexistente en este proyecto');
      if (!used.has(id)) {
        used.add(id);
        for (const field of item.fields)
          if (field.type === 'relation') entity(field.relationEntityId!);
      }
      return item;
    };
    for (const field of definition.inputs) {
      if (field.min !== undefined && field.max !== undefined && field.min > field.max)
        fail(400, 'Rango de entrada inválido: ' + field.label);
      if (field.type === 'relation') entity(field.relationEntityId ?? '');
      if (
        field.type === 'select' &&
        (!field.options.length || new Set(field.options).size !== field.options.length)
      )
        fail(400, 'Define opciones únicas para ' + field.label);
    }
    const infer = (value: ValueExpression, depth = 0): Primitive => {
      if (depth > 6) fail(400, 'Máximo seis niveles de expresión');
      if (value.kind === 'literal')
        return value.value === null ? 'null' : (typeof value.value as Primitive);
      if (value.kind === 'actor') return 'string';
      if (value.kind === 'input') {
        const field =
          definition.inputs.find((f) => f.key === value.key) ??
          fail(400, 'Entrada inexistente: ' + value.key);
        return primitive(field);
      }
      if (value.kind === 'record') {
        const source =
          aliases.get(value.step) ??
          fail(400, 'El paso referido no está disponible todavía: ' + value.step);
        if (value.field === 'id') return 'string';
        if (value.field === 'revision') return 'number';
        const field =
          source.fields.find((f) => f.key === value.field) ??
          fail(400, 'Campo inexistente: ' + value.field);
        return primitive(field);
      }
      if (infer(value.left, depth + 1) !== 'number' || infer(value.right, depth + 1) !== 'number')
        fail(400, 'Sumar y restar requiere enteros o centavos enteros');
      return 'number';
    };
    const assignments = (
      target: Entity,
      values: Record<string, ValueExpression>,
      create: boolean,
    ) => {
      for (const [key, value] of Object.entries(values)) {
        const field =
          target.fields.find((f) => f.key === key) ??
          fail(400, 'Campo de destino inexistente: ' + key);
        const type = infer(value);
        if (type !== primitive(field) && type !== 'null')
          fail(400, 'Tipos incompatibles en ' + field.label);
        if (type === 'null' && field.required) fail(400, 'No se puede vaciar ' + field.label);
      }
      if (create)
        for (const field of target.fields)
          if (field.required && !(field.key in values))
            fail(400, 'Falta conectar el campo obligatorio ' + field.label);
    };
    for (const step of definition.steps) {
      try {
        if (step.kind === 'load') {
          const target = entity(step.entityId);
          if (infer(step.recordId) !== 'string')
            fail(400, 'La consulta por ID requiere texto o una relación');
          aliases.set(step.id, target);
        } else if (step.kind === 'assert') {
          const left = infer(step.left),
            right = infer(step.right);
          if (['gt', 'gte', 'lt', 'lte'].includes(step.operator)) {
            if (left !== 'number' || right !== 'number')
              fail(400, 'La comparación de orden requiere números enteros');
          } else if (left !== right && left !== 'null' && right !== 'null')
            fail(400, 'La comparación contiene tipos incompatibles');
        } else if (step.kind === 'create') {
          const target = entity(step.entityId);
          assignments(target, step.values, true);
          aliases.set(step.id, target);
        } else {
          const target =
            aliases.get(step.record) ??
            fail(400, 'Selecciona un registro consultado o creado antes de actualizar');
          assignments(target, step.values, false);
          aliases.set(step.id, target);
        }
      } catch (error) {
        if (error instanceof PlatformError)
          throw new PlatformError(
            error.status,
            'Paso ' + step.id + ': ' + error.message,
            error.fields,
          );
        throw error;
      }
    }
    for (const value of Object.values(definition.result)) infer(value);
    return { definition, entities: all.filter((e) => used.has(e.id)) };
  }
  save(projectId: string, userId: string, input: unknown, id?: string) {
    this.store.access(projectId, userId, true);
    const raw = z
      .object({ definition: z.unknown(), revision: z.number().int().positive().optional() })
      .strict()
      .parse(input);
    return this.store.db
      .transaction(() => {
        const { definition } = this.validate(projectId, raw.definition);
        const old = id ? this.row(projectId, id) : undefined;
        if (old && old.revision !== raw.revision)
          fail(409, 'El servicio cambió. Recarga antes de guardar.');
        if (old && old.key !== definition.key)
          fail(409, 'El identificador del servicio no puede cambiar');
        if (
          !old &&
          (
            this.store.db
              .prepare('SELECT COUNT(*) AS n FROM operations WHERE project_id=?')
              .get(projectId) as { n: number }
          ).n >= 30
        )
          fail(409, 'Máximo 30 servicios configurables por proyecto');
        if (
          this.store.db
            .prepare('SELECT id FROM operations WHERE project_id=? AND key=? AND id<>?')
            .get(projectId, definition.key, id ?? '')
        )
          fail(409, 'El identificador del servicio ya existe');
        const key = id ?? randomUUID();
        if (old)
          this.store.db
            .prepare(
              'UPDATE operations SET draft=?,revision=revision+1 WHERE id=? AND project_id=?',
            )
            .run(JSON.stringify(definition), key, projectId);
        else
          this.store.db
            .prepare('INSERT INTO operations(id,project_id,key,draft) VALUES(?,?,?,?)')
            .run(key, projectId, definition.key, JSON.stringify(definition));
        this.store.audit(projectId, userId, 'service.draft', key);
        return this.list(projectId).find((s) => s.id === key)!;
      })
      .immediate();
  }
  publish(projectId: string, userId: string, id: string, input: unknown) {
    this.store.access(projectId, userId, false, true);
    const { revision } = z.object({ revision: z.number().int().positive() }).strict().parse(input);
    return this.store.db
      .transaction(() => {
        const row = this.row(projectId, id);
        if (row.revision !== revision) fail(409, 'El servicio cambió antes de publicar');
        const { definition, entities } = this.validate(projectId, JSON.parse(row.draft));
        const version =
          (
            this.store.db
              .prepare(
                'SELECT COALESCE(MAX(version),0) AS v FROM operation_versions WHERE service_id=?',
              )
              .get(id) as { v: number }
          ).v + 1;
        if (version > 20) fail(409, 'Máximo 20 versiones por servicio en el piloto');
        this.store.db
          .prepare('INSERT INTO operation_versions VALUES(?,?,?,?,?,?)')
          .run(
            id,
            version,
            JSON.stringify(definition),
            JSON.stringify(entities),
            new Date().toISOString(),
            userId,
          );
        this.store.db
          .prepare('UPDATE operations SET published_version=?,revision=revision+1 WHERE id=?')
          .run(version, id);
        this.store.audit(projectId, userId, 'service.publish', id);
        return this.list(projectId).find((s) => s.id === id)!;
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
          fail(409, 'El servicio cambió. Recarga antes de cambiar su estado.');
        if (data.version) this.version(projectId, id, data.version);
        this.store.db
          .prepare(
            'UPDATE operations SET active=?,published_version=?,revision=revision+1 WHERE id=?',
          )
          .run(
            data.active === undefined ? row.active : data.active ? 1 : 0,
            data.version ?? row.published_version,
            id,
          );
        this.store.audit(projectId, userId, 'service.configure', id);
        return this.list(projectId).find((s) => s.id === id)!;
      })
      .immediate();
  }
  access(projectId: string, userId: string, id: string, version: number) {
    const role = new InventoryStore(this.store).access(projectId, userId);
    const row = this.row(projectId, id);
    if (!row.active || !row.published_version)
      fail(409, 'El servicio está desactivado o todavía no está publicado');
    const definition = this.version(projectId, id, version),
      current = this.version(projectId, id, row.published_version);
    return {
      role,
      canExecute:
        role === 'admin' ||
        (role === 'operator' && definition.allowOperators && current.allowOperators),
      userId,
      contract: this.contract(id, version, definition),
    };
  }
  private relationOptions(projectId: string, field: DataField | undefined, query: string) {
    if (!field || field.type !== 'relation')
      fail(404, 'Esta entrada no ofrece opciones relacionadas');
    const entity = this.store.entity(projectId, field.relationEntityId!);
    const search = query.slice(0, 100).toLocaleLowerCase();
    return (
      this.store.db
        .prepare(
          'SELECT id,data FROM records WHERE project_id=? AND entity_id=? AND active=1 ORDER BY id',
        )
        .all(projectId, entity.id) as { id: string; data: string }[]
    )
      .map((r) => ({ id: r.id, label: String(JSON.parse(r.data)[entity.labelField] ?? r.id) }))
      .filter((r) => !search || r.label.toLocaleLowerCase().includes(search))
      .slice(0, 100);
  }
  options(
    projectId: string,
    userId: string,
    id: string,
    version: number,
    key: string,
    query: string,
  ) {
    const access = this.access(projectId, userId, id, version);
    if (!access.canExecute) fail(403, 'No tienes permiso para ejecutar este servicio');
    return this.relationOptions(
      projectId,
      access.contract.inputs.find((f) => f.key === key),
      query,
    );
  }
  draftOptions(projectId: string, userId: string, id: string, key: string, query: string) {
    this.store.access(projectId, userId);
    const definition = operationInputSchema.parse(JSON.parse(this.row(projectId, id).draft));
    return this.relationOptions(
      projectId,
      definition.inputs.find((f) => f.key === key),
      query,
    );
  }
  private run(projectId: string, userId: string, definition: OperationDefinition, input: unknown) {
    const values = this.store.validateValues(
      projectId,
      {
        id: 'service-inputs',
        key: 'service_inputs',
        name: 'Parámetros',
        labelField: definition.inputs[0]?.key ?? 'nombre',
        fields: definition.inputs,
      },
      input,
    );
    const records = new Map<string, DataRecord>();
    const evaluate = (expression: ValueExpression): Value => {
      if (expression.kind === 'input') return values[expression.key] ?? null;
      if (expression.kind === 'actor') return userId;
      if (expression.kind === 'literal') return expression.value;
      if (expression.kind === 'record') {
        const record =
          records.get(expression.step) ?? fail(400, 'Referencia de paso no disponible');
        return expression.field === 'id'
          ? record.id
          : expression.field === 'revision'
            ? record.revision
            : (record.values[expression.field] ?? null);
      }
      const left = evaluate(expression.left),
        right = evaluate(expression.right);
      if (typeof left !== 'number' || typeof right !== 'number')
        fail(400, 'La expresión necesita valores numéricos obligatorios');
      const result =
        expression.kind === 'add' ? BigInt(left) + BigInt(right) : BigInt(left) - BigInt(right);
      if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER))
        fail(400, 'El cálculo excede el rango de enteros seguros');
      return Number(result);
    };
    for (const step of definition.steps) {
      try {
        if (step.kind === 'load') {
          const id = evaluate(step.recordId);
          if (typeof id !== 'string') fail(400, 'Selecciona el registro que se debe consultar');
          const record = this.store.getRecord(projectId, step.entityId, id);
          if (!record.active) fail(409, 'El registro está inactivo');
          records.set(step.id, record);
        } else if (step.kind === 'assert') {
          const left = evaluate(step.left),
            right = evaluate(step.right);
          let valid = false;
          if (step.operator === 'eq') valid = left === right;
          else if (step.operator === 'neq') valid = left !== right;
          else {
            if (typeof left !== 'number' || typeof right !== 'number')
              fail(400, 'La condición necesita números obligatorios');
            valid =
              step.operator === 'gt'
                ? left > right
                : step.operator === 'gte'
                  ? left >= right
                  : step.operator === 'lt'
                    ? left < right
                    : left <= right;
          }
          if (!valid) fail(409, step.message);
        } else if (step.kind === 'create') {
          const values = Object.fromEntries(
            Object.entries(step.values).map(([key, value]) => [key, evaluate(value)]),
          );
          records.set(step.id, this.store.saveRecord(projectId, step.entityId, { values }, userId));
        } else {
          const record = records.get(step.record) ?? fail(400, 'Registro anterior no disponible');
          const source = definition.steps.find((s) => s.id === step.record);
          const findEntity = (alias: string): string => {
            const found = definition.steps.find((s) => s.id === alias);
            if (found?.kind === 'load' || found?.kind === 'create') return found.entityId;
            if (found?.kind === 'update') return findEntity(found.record);
            return fail(400, 'Registro de actualización inválido');
          };
          if (!source) fail(400, 'Registro anterior no disponible');
          const patch = Object.fromEntries(
            Object.entries(step.values).map(([key, value]) => [key, evaluate(value)]),
          );
          records.set(
            step.id,
            this.store.saveRecord(
              projectId,
              findEntity(step.record),
              { values: { ...record.values, ...patch }, revision: record.revision },
              userId,
              record.id,
            ),
          );
        }
      } catch (error) {
        if (error instanceof PlatformError)
          throw new PlatformError(
            error.status,
            'Paso ' + step.id + ': ' + error.message,
            error.fields,
          );
        throw error;
      }
    }
    return Object.fromEntries(
      Object.entries(definition.result).map(([key, value]) => [key, evaluate(value)]),
    );
  }
  execute(projectId: string, userId: string, id: string, input: unknown): OperationResult {
    const data = executionInputSchema.parse(input);
    return this.store.db
      .transaction(() => {
        const access = this.access(projectId, userId, id, data.version);
        if (!access.canExecute) fail(403, 'No tienes permiso para ejecutar este servicio');
        const fingerprint = createHash('sha256')
          .update(
            JSON.stringify({
              serviceId: id,
              version: data.version,
              input: Object.fromEntries(
                Object.entries(data.input).sort(([a], [b]) => a.localeCompare(b)),
              ),
            }),
          )
          .digest('hex');
        const prior = this.store.db
          .prepare(
            'SELECT service_id,version,actor_id,request_hash,result FROM operation_runs WHERE project_id=? AND operation_id=?',
          )
          .get(projectId, data.operationId) as
          | {
              service_id: string;
              version: number;
              actor_id: string;
              request_hash: string;
              result: string;
            }
          | undefined;
        if (prior) {
          if (
            prior.service_id !== id ||
            prior.version !== data.version ||
            prior.actor_id !== userId ||
            prior.request_hash !== fingerprint
          )
            fail(409, 'Ese identificador ya corresponde a otra solicitud');
          return { ...JSON.parse(prior.result), replayed: true };
        }
        if (
          (
            this.store.db
              .prepare(
                'SELECT COUNT(*) AS n FROM operation_runs WHERE project_id=? AND service_id=?',
              )
              .get(projectId, id) as { n: number }
          ).n >= 5000
        )
          fail(409, 'Límite del piloto: 5000 ejecuciones por servicio');
        const definition = this.version(projectId, id, data.version);
        this.validate(projectId, definition);
        const output = this.run(projectId, userId, definition, data.input),
          createdAt = new Date().toISOString();
        const result: OperationResult = {
          id: randomUUID(),
          operationId: data.operationId,
          serviceId: id,
          version: data.version,
          output,
          createdAt,
          replayed: false,
        };
        this.store.db
          .prepare('INSERT INTO operation_runs VALUES(?,?,?,?,?,?,?,?,?)')
          .run(
            result.id,
            projectId,
            id,
            data.version,
            data.operationId,
            userId,
            fingerprint,
            JSON.stringify(result),
            createdAt,
          );
        this.store.audit(projectId, userId, 'service.execute', result.id);
        return result;
      })
      .immediate();
  }
  simulate(projectId: string, userId: string, id: string, input: unknown) {
    this.store.access(projectId, userId, true);
    const data = z
      .object({ revision: z.number().int().positive(), input: operationValuesSchema })
      .strict()
      .parse(input);
    try {
      this.store.db
        .transaction(() => {
          const row = this.row(projectId, id);
          if (row.revision !== data.revision)
            fail(409, 'El borrador cambió. Actualiza antes de simular');
          const { definition } = this.validate(projectId, JSON.parse(row.draft));
          const output = this.run(projectId, userId, definition, data.input);
          throw new Simulation({
            id: 'simulation',
            operationId: 'simulation',
            serviceId: id,
            version: 0,
            output,
            createdAt: new Date().toISOString(),
            replayed: false,
            simulated: true,
          });
        })
        .immediate();
    } catch (error) {
      if (error instanceof Simulation) return error.result;
      throw error;
    }
    throw new Error('La simulación no se revirtió');
  }
  impact(projectId: string, id: string) {
    this.row(projectId, id);
    const pages = this.store.db
      .prepare('SELECT id,draft,published FROM pages WHERE project_id=?')
      .all(projectId) as { id: string; draft: string; published: string | null }[];
    const uses = (nodes: ComponentNode[]): boolean =>
      nodes.some(
        (n) => (n.type === 'ServiceForm' && n.props.operationId === id) || uses(n.children ?? []),
      );
    return {
      pages: pages
        .filter(
          (p) =>
            uses(JSON.parse(p.draft).components) ||
            (p.published && uses(JSON.parse(p.published).components)),
        )
        .map((p) => ({
          id: p.id,
          name: JSON.parse(p.draft).name,
          publishedVersion: p.published
            ? ((JSON.parse(p.published).operations ?? []).find(
                (s: OperationContract) => s.id === id,
              )?.version ?? null)
            : null,
        })),
      entities: (
        this.store.db
          .prepare(
            'SELECT version,entities FROM operation_versions WHERE service_id=? ORDER BY version DESC',
          )
          .all(id) as { version: number; entities: string }[]
      ).map((v) => ({
        version: v.version,
        entities: (JSON.parse(v.entities) as Entity[]).map((e) => ({ id: e.id, name: e.name })),
      })),
    };
  }
  runs(projectId: string, id: string) {
    this.row(projectId, id);
    return (
      this.store.db
        .prepare(
          'SELECT r.result,u.name AS actor FROM operation_runs r JOIN users u ON u.id=r.actor_id WHERE r.project_id=? AND r.service_id=? ORDER BY r.rowid DESC LIMIT 20',
        )
        .all(projectId, id) as { result: string; actor: string }[]
    ).map((r) => ({ ...JSON.parse(r.result), actor: r.actor }));
  }
}
