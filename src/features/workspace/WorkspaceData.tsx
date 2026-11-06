import { useState } from 'react';
import { Plus, Database, Pencil, Trash2 } from 'lucide-react';
import type { Entity, EntityInput, DataField } from '../../models/data';
import { entityInputSchema } from '../../models/data';
import { platformRequest } from '../../services/platformHttp';
import { useWorkspace } from './WorkspaceContext';
import { useEntities } from './useEntities';
import { DataProvider, DataWorkbench } from '../../components/dataComponents';

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^\d+|^_+|_+$/g, '')
    .slice(0, 40);
const field = (): DataField => ({
  key: '',
  label: '',
  type: 'text',
  required: false,
  unique: false,
  options: [],
});
export function WorkspaceData() {
  const { project } = useWorkspace();
  const { entities, error, loading, load } = useEntities(project.id);
  const [templateError, setTemplateError] = useState('');
  const [installing, setInstalling] = useState(false);
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<Entity | null | undefined>();
  const active = entities.find((e) => e.id === selected) ?? entities[0];
  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <h1>Datos</h1>
          <p>Define lo que tu aplicación necesita guardar.</p>
        </div>
        {project.role !== 'reader' && (
          <button className="primary" onClick={() => setEditing(null)}>
            <Plus size={16} />
            Crear entidad
          </button>
        )}
      </div>
      {(error || templateError) && (
        <p role="alert" className="alert">
          {error || templateError}
        </p>
      )}
      {loading ? (
        <p role="status">Cargando entidades…</p>
      ) : !entities.length ? (
        <section className="workspace-empty">
          <Database size={30} />
          <h2>Empieza por tus datos</h2>
          <p>
            Una entidad puede representar productos, categorías o clientes. Sus campos definirán los
            formularios y servicios.
          </p>
          {project.role !== 'reader' && (
            <button
              className="primary"
              disabled={installing}
              onClick={async () => {
                setInstalling(true);
                setTemplateError('');
                try {
                  await platformRequest('/projects/' + project.id + '/templates/inventory', {
                    method: 'POST',
                  });
                  await load();
                } catch (e) {
                  setTemplateError((e as Error).message);
                } finally {
                  setInstalling(false);
                }
              }}
            >
              {installing ? 'Preparando…' : 'Comenzar con inventario'}
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="entity-strip">
            {entities.map((e) => (
              <button
                key={e.id}
                className={e.id === active?.id ? 'active' : ''}
                onClick={() => setSelected(e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
          {active && (
            <>
              <div className="entity-caption">
                <span>
                  {active.fields.length} campos · {active.key} · Revisión {active.revision}
                </span>
                {project.role !== 'reader' && (
                  <button onClick={() => setEditing(active)}>
                    <Pencil size={14} />
                    Editar definición
                  </button>
                )}
              </div>
              <DataProvider
                key={active.id}
                projectId={project.id}
                entities={entities}
                canWrite={project.role !== 'reader'}
              >
                <DataWorkbench entity={active} />
              </DataProvider>
            </>
          )}
        </>
      )}
      {editing !== undefined && (
        <EntityDialog
          key={editing?.id ?? 'new'}
          entity={editing}
          entities={entities}
          projectId={project.id}
          onCancel={() => setEditing(undefined)}
          onSaved={async (e) => {
            setEditing(undefined);
            setSelected(e.id);
            await load();
          }}
        />
      )}
    </main>
  );
}
function EntityDialog({
  entity,
  entities,
  projectId,
  onCancel,
  onSaved,
}: {
  entity: Entity | null;
  entities: Entity[];
  projectId: string;
  onCancel: () => void;
  onSaved: (e: Entity) => void;
}) {
  const [name, setName] = useState(entity?.name ?? '');
  const [key, setKey] = useState(entity?.key ?? '');
  const [fields, setFields] = useState<DataField[]>(
    entity?.fields ?? [{ ...field(), key: 'nombre', label: 'Nombre', required: true }],
  );
  const [labelField, setLabelField] = useState(entity?.labelField ?? 'nombre');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = (index: number, patch: Partial<DataField>) =>
    setFields((old) => old.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <div className="modal-backdrop">
      <section
        className="modal entity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-dialog-title"
      >
        <h2 id="entity-dialog-title">{entity ? 'Editar entidad' : 'Crear entidad'}</h2>
        <p>
          Los servicios de datos se crean automáticamente. Los identificadores y tipos de campos
          guardados se conservan.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            setBusy(true);
            try {
              const input: EntityInput = entityInputSchema.parse({ name, key, labelField, fields });
              const result = await platformRequest<Entity>(
                '/projects/' + projectId + '/entities' + (entity ? '/' + entity.id : ''),
                {
                  method: entity ? 'PUT' : 'POST',
                  body: JSON.stringify({ ...input, revision: entity?.revision }),
                },
              );
              onSaved(result);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="inspector-grid">
            <label>
              Nombre de la entidad
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => {
                  const value = e.target.value;
                  setName(value);
                  if (!entity && (!key || key === slug(name))) setKey(slug(value));
                }}
              />
            </label>
            <label>
              Identificador de entidad
              <input
                required
                value={key}
                disabled={!!entity}
                onChange={(e) => setKey(e.target.value)}
                pattern="[a-z][a-z0-9_]*"
              />
            </label>
          </div>
          <div className="entity-fields">
            {fields.map((f, index) => {
              const fixed = entity?.fields.some((old) => old.key === f.key);
              return (
                <fieldset key={index}>
                  <legend>Campo {index + 1}</legend>
                  <div className="entity-field-row">
                    <label>
                      Etiqueta
                      <input
                        aria-label={'Etiqueta del campo ' + (index + 1)}
                        required
                        value={f.label}
                        onChange={(e) =>
                          change(index, {
                            label: e.target.value,
                            ...(!fixed && (!f.key || f.key === slug(f.label))
                              ? { key: slug(e.target.value) }
                              : {}),
                          })
                        }
                      />
                    </label>
                    <label>
                      Identificador
                      <input
                        aria-label={'Identificador del campo ' + (index + 1)}
                        value={f.key}
                        required
                        disabled={fixed}
                        onChange={(e) => change(index, { key: e.target.value })}
                      />
                    </label>
                    <label>
                      Tipo
                      <select
                        aria-label={'Tipo del campo ' + (index + 1)}
                        value={f.type}
                        disabled={fixed}
                        onChange={(e) =>
                          change(index, { type: e.target.value as DataField['type'] })
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
                      disabled={fixed || fields.length === 1}
                      aria-label={'Eliminar campo ' + (index + 1)}
                      onClick={() => setFields((old) => old.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="entity-field-rules">
                    <label>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => change(index, { required: e.target.checked })}
                      />
                      Obligatorio
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={f.unique}
                        onChange={(e) => change(index, { unique: e.target.checked })}
                      />
                      Único
                    </label>
                    {['integer', 'money'].includes(f.type) && (
                      <>
                        <label>
                          Mínimo
                          <input
                            aria-label={'Mínimo del campo ' + (index + 1)}
                            type="number"
                            step="1"
                            value={f.min ?? ''}
                            onChange={(e) =>
                              change(index, {
                                min: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Máximo
                          <input
                            aria-label={'Máximo del campo ' + (index + 1)}
                            type="number"
                            step="1"
                            value={f.max ?? ''}
                            onChange={(e) =>
                              change(index, {
                                max: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                    {f.type === 'money' && (
                      <small>
                        Los límites y los valores se guardan en centavos enteros. S/ 10.50 equivale
                        a 1050.
                      </small>
                    )}
                    {f.type === 'select' && (
                      <label>
                        Opciones separadas por coma
                        <input
                          aria-label={'Opciones del campo ' + (index + 1)}
                          value={f.options.join(', ')}
                          onChange={(e) =>
                            change(index, {
                              options: e.target.value.split(',').map((v) => v.trim()),
                            })
                          }
                        />
                      </label>
                    )}
                    {f.type === 'relation' && (
                      <label>
                        Entidad relacionada
                        <select
                          aria-label={'Entidad relacionada del campo ' + (index + 1)}
                          required
                          value={f.relationEntityId ?? ''}
                          onChange={(e) => change(index, { relationEntityId: e.target.value })}
                        >
                          <option value="">Seleccionar entidad</option>
                          {entities
                            .filter((e) => e.id !== entity?.id)
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                </fieldset>
              );
            })}
          </div>
          <div className="actions">
            <button
              type="button"
              disabled={fields.length >= 30}
              onClick={() => setFields((old) => [...old, field()])}
            >
              <Plus size={15} />
              Agregar campo
            </button>
            <label>
              Campo para identificar registros
              <select
                aria-label="Campo para identificar registros"
                value={labelField}
                onChange={(e) => setLabelField(e.target.value)}
              >
                {fields
                  .filter((f) => f.key)
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label || f.key}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <div className="actions justify-end">
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar entidad'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
