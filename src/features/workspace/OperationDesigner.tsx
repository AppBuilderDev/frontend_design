import { useState } from 'react';
import type { Entity, DataField } from '../../models/data';
import {
  operationInputSchema,
  type OperationDefinition,
  type OperationSummary,
  type OperationStep,
  type ValueExpression,
} from '../../models/operations';
import { platformRequest } from '../../services/platformHttp';
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^\d+|^_+|_+$/g, '')
    .slice(0, 40);
const literal = (value: string | number | boolean | null = ''): ValueExpression => ({
  kind: 'literal',
  value,
});
export function createOperation(
  entity: Entity,
  mode: 'create' | 'decrement' = 'create',
  fieldKey?: string,
): OperationDefinition {
  if (mode === 'decrement') {
    const field =
      entity.fields.find((f) => f.key === fieldKey) ??
      entity.fields.find((f) => ['integer', 'money'].includes(f.type));
    if (field) {
      const record: ValueExpression = { kind: 'record', step: 'consultar', field: field.key };
      return {
        name: ('Descontar ' + field.label).slice(0, 80),
        key: slug('descontar_' + field.key),
        allowOperators: false,
        inputs: [
          {
            key: 'registro',
            label: 'Registro',
            type: 'relation',
            required: true,
            unique: false,
            options: [],
            relationEntityId: entity.id,
          },
          {
            key: 'cantidad',
            label: 'Cantidad',
            type: field.type,
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
            entityId: entity.id,
            recordId: { kind: 'input', key: 'registro' },
          },
          {
            id: 'validar',
            kind: 'assert',
            left: record,
            operator: 'gte',
            right: { kind: 'input', key: 'cantidad' },
            message: 'La cantidad disponible es insuficiente',
          },
          {
            id: 'actualizar',
            kind: 'update',
            record: 'consultar',
            values: {
              [field.key]: {
                kind: 'subtract',
                left: record,
                right: { kind: 'input', key: 'cantidad' },
              },
            },
          },
        ],
        result: { nuevo_valor: { kind: 'record', step: 'actualizar', field: field.key } },
      };
    }
  }
  return {
    name: ('Crear ' + entity.name).slice(0, 80),
    key: slug('crear_' + entity.key),
    allowOperators: false,
    inputs: entity.fields.map((f) => ({ ...f, unique: false })),
    steps: [
      {
        id: 'crear',
        kind: 'create',
        entityId: entity.id,
        values: Object.fromEntries(
          entity.fields.map((f) => [f.key, { kind: 'input', key: f.key } as ValueExpression]),
        ),
      },
    ],
    result: { registro_id: { kind: 'record', step: 'crear', field: 'id' } },
  };
}
export function OperationDesigner({
  projectId,
  entities,
  editing,
  initial,
  onCancel,
  onSaved,
}: {
  projectId: string;
  entities: Entity[];
  editing?: OperationSummary;
  initial: OperationDefinition;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [definition, setDefinition] = useState(initial),
    [tab, setTab] = useState('inputs'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const change = (patch: Partial<OperationDefinition>) =>
    setDefinition((old) => ({ ...old, ...patch }));
  const stepChange = (index: number, step: OperationStep) =>
    change({ steps: definition.steps.map((s, i) => (i === index ? step : s)) });
  function addStep(kind: OperationStep['kind']) {
    const used = new Set(definition.steps.map((s) => s.id));
    let n = 1;
    while (used.has('paso_' + n)) n++;
    const id = 'paso_' + n,
      entityId = entities[0]?.id ?? '';
    const step: OperationStep =
      kind === 'load'
        ? { id, kind, entityId, recordId: literal() }
        : kind === 'create'
          ? { id, kind, entityId, values: {} }
          : kind === 'update'
            ? { id, kind, record: '', values: {} }
            : {
                id,
                kind,
                left: literal(0),
                operator: 'gte',
                right: literal(0),
                message: 'No se cumple la condición',
              };
    change({ steps: [...definition.steps, step] });
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal operation-designer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operation-title"
      >
        <h2 id="operation-title">{editing ? 'Editar servicio' : 'Crear servicio'}</h2>
        <p>
          Conecta entradas y resultados de pasos anteriores. Guardar conserva un borrador; la
          publicación es una acción del propietario.
        </p>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!e.currentTarget.checkValidity()) {
              setError(
                'Revisa los campos obligatorios y usa enteros para los valores fijos numéricos.',
              );
              return;
            }
            setError('');
            setBusy(true);
            try {
              const parsed = operationInputSchema.parse(definition);
              await platformRequest(
                '/projects/' + projectId + '/operations' + (editing ? '/' + editing.id : ''),
                {
                  method: editing ? 'PUT' : 'POST',
                  body: JSON.stringify({
                    definition: parsed,
                    ...(editing ? { revision: editing.revision } : {}),
                  }),
                },
              );
              onSaved();
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="inspector-grid">
            <label>
              Nombre del servicio
              <input
                required
                maxLength={80}
                value={definition.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
            <label>
              Identificador del servicio
              <input
                required
                pattern="[a-z][a-z0-9_]*"
                disabled={!!editing}
                value={definition.key}
                onChange={(e) => change({ key: e.target.value })}
              />
            </label>
          </div>
          <label className="operation-check">
            <input
              type="checkbox"
              checked={definition.allowOperators}
              onChange={(e) => change({ allowOperators: e.target.checked })}
            />
            Permitir ejecución a operadores de la aplicación
          </label>
          <small>
            Los administradores pueden ejecutar. El permiso se aplica al publicar; los usuarios de
            consulta no ejecutan escrituras.
          </small>
          <div className="operation-tabs" role="tablist" aria-label="Configuración del servicio">
            {[
              ['inputs', 'Entradas'],
              ['steps', 'Pasos'],
              ['result', 'Resultado'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div hidden={tab !== 'inputs'}>
            <h3>Entradas del formulario</h3>
            {definition.inputs.map((field, index) => (
              <fieldset className="operation-input" key={index}>
                <legend>Entrada {index + 1}</legend>
                <div className="entity-field-row">
                  <label>
                    Etiqueta
                    <input
                      aria-label={'Etiqueta de entrada ' + (index + 1)}
                      required
                      value={field.label}
                      onChange={(e) => {
                        const value = e.target.value;
                        change({
                          inputs: definition.inputs.map((f, i) =>
                            i === index
                              ? {
                                  ...f,
                                  label: value,
                                  ...(!f.key || f.key === slug(f.label)
                                    ? { key: slug(value) }
                                    : {}),
                                }
                              : f,
                          ),
                        });
                      }}
                    />
                  </label>
                  <label>
                    Identificador
                    <input
                      aria-label={'Identificador de entrada ' + (index + 1)}
                      required
                      pattern="[a-z][a-z0-9_]*"
                      value={field.key}
                      onChange={(e) =>
                        change({
                          inputs: definition.inputs.map((f, i) =>
                            i === index ? { ...f, key: e.target.value } : f,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Tipo
                    <select
                      aria-label={'Tipo de entrada ' + (index + 1)}
                      value={field.type}
                      onChange={(e) =>
                        change({
                          inputs: definition.inputs.map((f, i) =>
                            i === index ? { ...f, type: e.target.value as DataField['type'] } : f,
                          ),
                        })
                      }
                    >
                      {[
                        ['text', 'Texto'],
                        ['integer', 'Entero'],
                        ['money', 'Importe en centavos'],
                        ['boolean', 'Sí o no'],
                        ['date', 'Fecha'],
                        ['select', 'Selección'],
                        ['relation', 'Relación'],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    aria-label={'Eliminar entrada ' + (index + 1)}
                    onClick={() =>
                      change({ inputs: definition.inputs.filter((_, i) => i !== index) })
                    }
                  >
                    Eliminar
                  </button>
                </div>
                <div className="entity-field-rules">
                  <label className="operation-check">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        change({
                          inputs: definition.inputs.map((f, i) =>
                            i === index ? { ...f, required: e.target.checked } : f,
                          ),
                        })
                      }
                    />
                    Obligatoria
                  </label>
                  {['integer', 'money'].includes(field.type) && (
                    <label>
                      Mínimo (entero o centavos)
                      <input
                        type="number"
                        step="1"
                        value={field.min ?? ''}
                        onChange={(e) =>
                          change({
                            inputs: definition.inputs.map((f, i) =>
                              i === index
                                ? {
                                    ...f,
                                    min: e.target.value === '' ? undefined : Number(e.target.value),
                                  }
                                : f,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                  {field.type === 'relation' && (
                    <label>
                      Entidad relacionada
                      <select
                        required
                        value={field.relationEntityId ?? ''}
                        onChange={(e) =>
                          change({
                            inputs: definition.inputs.map((f, i) =>
                              i === index ? { ...f, relationEntityId: e.target.value } : f,
                            ),
                          })
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {entities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {field.type === 'select' && (
                    <label>
                      Opciones separadas por coma
                      <input
                        value={field.options.join(', ')}
                        onChange={(e) =>
                          change({
                            inputs: definition.inputs.map((f, i) =>
                              i === index
                                ? { ...f, options: e.target.value.split(',').map((v) => v.trim()) }
                                : f,
                            ),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={definition.inputs.length >= 20}
              onClick={() =>
                change({
                  inputs: [
                    ...definition.inputs,
                    {
                      key: 'entrada_' + (definition.inputs.length + 1),
                      label: 'Nueva entrada',
                      type: 'text',
                      required: true,
                      unique: false,
                      options: [],
                    },
                  ],
                })
              }
            >
              Agregar entrada
            </button>
          </div>
          <div hidden={tab !== 'steps'}>
            <h3>Pasos de la transacción</h3>
            <p>
              Se ejecutan en orden. Si uno falla, ninguno se guarda. No se ejecuta código libre.
            </p>
            {definition.steps.map((step, index) => (
              <StepEditor
                key={step.id + ':' + index}
                step={step}
                index={index}
                prior={definition.steps.slice(0, index)}
                entities={entities}
                inputs={definition.inputs}
                onChange={(step) => stepChange(index, step)}
                onRemove={() => change({ steps: definition.steps.filter((_, i) => i !== index) })}
                onMove={(direction) => {
                  const steps = [...definition.steps],
                    target = index + direction;
                  if (target < 0 || target >= steps.length) return;
                  [steps[index], steps[target]] = [steps[target], steps[index]];
                  change({ steps });
                }}
              />
            ))}
            <div className="actions">
              {[
                ['load', 'Consultar registro'],
                ['assert', 'Comprobar condición'],
                ['create', 'Crear registro'],
                ['update', 'Actualizar registro'],
              ].map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  disabled={definition.steps.length >= 20}
                  onClick={() => addStep(kind as OperationStep['kind'])}
                >
                  Agregar: {label}
                </button>
              ))}
            </div>
          </div>
          <div hidden={tab !== 'result'}>
            <h3>Resultado público</h3>
            <p>
              Solo estos valores se devuelven al usuario que ejecuta. Los registros intermedios y
              los pasos quedan en el servidor.
            </p>
            <ValueAssignments
              fields={undefined}
              values={definition.result}
              entities={entities}
              prior={definition.steps}
              inputs={definition.inputs}
              onChange={(result) => change({ result })}
            />
          </div>
          {error && (
            <p className="alert operation-validation" role="alert">
              {error}
            </p>
          )}
          <div className="actions justify-end">
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar borrador del servicio'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function entityOf(stepId: string, prior: OperationStep[], entities: Entity[]): Entity | undefined {
  const step = prior.find((s) => s.id === stepId);
  return step?.kind === 'load' || step?.kind === 'create'
    ? entities.find((e) => e.id === step.entityId)
    : step?.kind === 'update'
      ? entityOf(step.record, prior.slice(0, prior.indexOf(step)), entities)
      : undefined;
}
function StepEditor({
  step,
  index,
  prior,
  entities,
  inputs,
  onChange,
  onRemove,
  onMove,
}: {
  step: OperationStep;
  index: number;
  prior: OperationStep[];
  entities: Entity[];
  inputs: DataField[];
  onChange: (s: OperationStep) => void;
  onRemove: () => void;
  onMove: (direction: number) => void;
}) {
  const entity =
    step.kind === 'load' || step.kind === 'create'
      ? entities.find((e) => e.id === step.entityId)
      : step.kind === 'update'
        ? entityOf(step.record, prior, entities)
        : undefined;
  return (
    <fieldset className="operation-step">
      <legend>
        Paso {index + 1} ·{' '}
        {step.kind === 'load'
          ? 'Consultar'
          : step.kind === 'assert'
            ? 'Condición'
            : step.kind === 'create'
              ? 'Crear'
              : 'Actualizar'}
      </legend>
      <div className="operation-step-header">
        <label>
          Identificador del paso
          <input
            aria-label={'Identificador del paso ' + (index + 1)}
            required
            defaultValue={step.id}
            onBlur={(e) => onChange({ ...step, id: e.target.value })}
          />
        </label>
        <div className="actions">
          <button type="button" aria-label={'Subir paso ' + (index + 1)} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" aria-label={'Bajar paso ' + (index + 1)} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" onClick={onRemove}>
            Eliminar paso
          </button>
        </div>
      </div>
      {(step.kind === 'load' || step.kind === 'create') && (
        <label>
          Entidad
          <select
            aria-label={'Entidad del paso ' + (index + 1)}
            value={step.entityId}
            onChange={(e) =>
              onChange({
                ...step,
                entityId: e.target.value,
                ...(step.kind === 'create' ? { values: {} } : {}),
              })
            }
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {step.kind === 'load' && (
        <div>
          <small>Identificador del registro a consultar</small>
          <ExpressionEditor
            value={step.recordId}
            prior={prior}
            entities={entities}
            inputs={inputs}
            onChange={(recordId) => onChange({ ...step, recordId })}
          />
        </div>
      )}
      {step.kind === 'assert' && (
        <>
          <ExpressionEditor
            value={step.left}
            prior={prior}
            entities={entities}
            inputs={inputs}
            onChange={(left) => onChange({ ...step, left })}
          />
          <label>
            Comparación
            <select
              aria-label={'Comparación del paso ' + (index + 1)}
              value={step.operator}
              onChange={(e) =>
                onChange({ ...step, operator: e.target.value as typeof step.operator })
              }
            >
              {[
                ['eq', 'Igual a'],
                ['neq', 'Distinto de'],
                ['gt', 'Mayor que'],
                ['gte', 'Mayor o igual que'],
                ['lt', 'Menor que'],
                ['lte', 'Menor o igual que'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <ExpressionEditor
            value={step.right}
            prior={prior}
            entities={entities}
            inputs={inputs}
            onChange={(right) => onChange({ ...step, right })}
          />
          <label>
            Mensaje si no se cumple
            <input
              required
              maxLength={150}
              value={step.message}
              onChange={(e) => onChange({ ...step, message: e.target.value })}
            />
          </label>
        </>
      )}
      {step.kind === 'update' && (
        <label>
          Registro de un paso anterior
          <select
            aria-label={'Registro del paso ' + (index + 1)}
            required
            value={step.record}
            onChange={(e) => onChange({ ...step, record: e.target.value, values: {} })}
          >
            <option value="">Seleccionar…</option>
            {prior
              .filter((s) => s.kind !== 'assert')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
          </select>
        </label>
      )}
      {(step.kind === 'create' || step.kind === 'update') && (
        <ValueAssignments
          fields={entity?.fields ?? []}
          values={step.values}
          prior={prior}
          entities={entities}
          inputs={inputs}
          onChange={(values) => onChange({ ...step, values })}
        />
      )}
    </fieldset>
  );
}
function ValueAssignments({
  fields,
  values,
  prior,
  entities,
  inputs,
  onChange,
}: {
  fields: DataField[] | undefined;
  values: Record<string, ValueExpression>;
  prior: OperationStep[];
  entities: Entity[];
  inputs: DataField[];
  onChange: (v: Record<string, ValueExpression>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  return (
    <div className="operation-assignments">
      {Object.entries(values).map(([key, value]) => (
        <div className="operation-assignment" key={key}>
          <div>
            <strong>{fields?.find((f) => f.key === key)?.label ?? key}</strong>
            <small>{key}</small>
            <button
              type="button"
              aria-label={'Quitar valor ' + key}
              onClick={() =>
                onChange(Object.fromEntries(Object.entries(values).filter(([k]) => k !== key)))
              }
            >
              Quitar
            </button>
          </div>
          <ExpressionEditor
            value={value}
            prior={prior}
            entities={entities}
            inputs={inputs}
            onChange={(next) => onChange({ ...values, [key]: next })}
          />
        </div>
      ))}
      <div className="actions">
        <label>
          {fields ? 'Campo de destino' : 'Identificador del resultado'}
          {fields ? (
            <select
              aria-label="Agregar campo de destino"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            >
              <option value="">Seleccionar campo…</option>
              {fields
                .filter((f) => !(f.key in values))
                .map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
            </select>
          ) : (
            <input
              aria-label="Nuevo campo de resultado"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          )}
        </label>
        <button
          type="button"
          disabled={!newKey || newKey in values}
          onClick={() => {
            onChange({ ...values, [newKey]: literal() });
            setNewKey('');
          }}
        >
          Agregar valor
        </button>
      </div>
    </div>
  );
}
function ExpressionEditor({
  value,
  prior,
  entities,
  inputs,
  onChange,
  depth = 0,
}: {
  value: ValueExpression;
  prior: OperationStep[];
  entities: Entity[];
  inputs: DataField[];
  onChange: (v: ValueExpression) => void;
  depth?: number;
}) {
  const source = value.kind === 'record' ? entityOf(value.step, prior, entities) : undefined;
  return (
    <div className="operation-expression">
      <select
        aria-label="Origen del valor"
        value={value.kind}
        onChange={(e) => {
          const kind = e.target.value as ValueExpression['kind'];
          onChange(
            kind === 'input'
              ? { kind, key: inputs[0]?.key ?? '' }
              : kind === 'record'
                ? { kind, step: prior.find((s) => s.kind !== 'assert')?.id ?? '', field: 'id' }
                : kind === 'actor'
                  ? { kind }
                  : kind === 'add' || kind === 'subtract'
                    ? { kind, left: literal(0), right: literal(0) }
                    : literal(),
          );
        }}
      >
        {[
          ['input', 'Entrada del formulario'],
          ['record', 'Resultado de un paso'],
          ['literal', 'Valor fijo'],
          ['actor', 'Usuario que ejecuta'],
          ...(depth < 5
            ? [
                ['add', 'Sumar enteros'],
                ['subtract', 'Restar enteros'],
              ]
            : []),
        ].map(([kind, label]) => (
          <option key={kind} value={kind}>
            {label}
          </option>
        ))}
      </select>
      {value.kind === 'input' && (
        <select
          aria-label="Entrada de origen"
          required
          value={value.key}
          onChange={(e) => onChange({ ...value, key: e.target.value })}
        >
          {inputs.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label} ({f.key})
            </option>
          ))}
        </select>
      )}
      {value.kind === 'record' && (
        <>
          <select
            aria-label="Paso de origen"
            required
            value={value.step}
            onChange={(e) => onChange({ ...value, step: e.target.value, field: 'id' })}
          >
            {prior
              .filter((s) => s.kind !== 'assert')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
          </select>
          <select
            aria-label="Campo de origen"
            value={value.field}
            onChange={(e) => onChange({ ...value, field: e.target.value })}
          >
            <option value="id">Identificador del registro</option>
            <option value="revision">Revisión del registro</option>
            {source?.fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </>
      )}
      {value.kind === 'literal' && (
        <LiteralEditor value={value.value} onChange={(v) => onChange(literal(v))} />
      )}
      {(value.kind === 'add' || value.kind === 'subtract') && (
        <div className="operation-arithmetic">
          <ExpressionEditor
            value={value.left}
            prior={prior}
            entities={entities}
            inputs={inputs}
            depth={depth + 1}
            onChange={(left) => onChange({ ...value, left })}
          />
          <strong>{value.kind === 'add' ? '+' : '−'}</strong>
          <ExpressionEditor
            value={value.right}
            prior={prior}
            entities={entities}
            inputs={inputs}
            depth={depth + 1}
            onChange={(right) => onChange({ ...value, right })}
          />
        </div>
      )}
    </div>
  );
}
function LiteralEditor({
  value,
  onChange,
}: {
  value: string | number | boolean | null;
  onChange: (v: string | number | boolean | null) => void;
}) {
  const [type, setType] = useState(value === null ? 'null' : typeof value);
  return (
    <>
      <select
        aria-label="Tipo de valor fijo"
        value={type}
        onChange={(e) => {
          const next = e.target.value;
          setType(next);
          onChange(
            next === 'null' ? null : next === 'number' ? 0 : next === 'boolean' ? false : '',
          );
        }}
      >
        <option value="string">Texto</option>
        <option value="number">Entero o centavos</option>
        <option value="boolean">Sí o no</option>
        <option value="null">Sin valor</option>
      </select>
      {type === 'boolean' ? (
        <select
          aria-label="Valor fijo"
          value={String(value)}
          onChange={(e) => onChange(e.target.value === 'true')}
        >
          <option value="false">No</option>
          <option value="true">Sí</option>
        </select>
      ) : (
        type !== 'null' && (
          <input
            aria-label="Valor fijo"
            required={type === 'number'}
            pattern={type === 'number' ? '-?[0-9]+' : undefined}
            value={String(value ?? '')}
            onChange={(e) =>
              onChange(
                type === 'number' && /^-?\d+$/.test(e.target.value)
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )
      )}
    </>
  );
}
