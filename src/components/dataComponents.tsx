import type { OperationContract } from '../models/operations';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from 'react';
import type { ComponentNode } from '../models/contracts';
import {
  formatMoney,
  moneyInput,
  parseMoney,
  type Entity,
  type DataRecord,
  type RecordList,
  type DataField,
} from '../models/data';
import { ApiError, platformRequest } from '../services/platformHttp';
interface DataState {
  operations: OperationContract[];
  projectId: string;
  entities: Entity[];
  canWrite: boolean;
  preview: boolean;
  version: number;
  selected: Record<string, DataRecord | undefined>;
  select: (entityId: string, record?: DataRecord) => void;
  refresh: () => void;
}
const DataContext = createContext<DataState | undefined>(undefined);
export const useDataContext = () => useContext(DataContext);
export function DataProvider({
  projectId,
  entities,
  canWrite,
  operations = [],
  preview = false,
  children,
}: {
  projectId: string;
  entities: Entity[];
  canWrite: boolean;
  operations?: OperationContract[];
  preview?: boolean;
  children: ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const [selected, setSelected] = useState<DataState['selected']>({});
  const select = useCallback(
    (id: string, record?: DataRecord) => setSelected((items) => ({ ...items, [id]: record })),
    [],
  );
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <DataContext.Provider
      value={{
        projectId,
        entities,
        operations,
        canWrite,
        preview,
        version,
        selected,
        select,
        refresh,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
function resource(projectId: string, entityId: string) {
  return '/projects/' + projectId + '/services/' + entityId + '/records';
}
const entityFor = (context: DataState | undefined, node: ComponentNode) =>
  context?.entities.find((e) => e.id === node.props.entityId);
function Unconnected() {
  return (
    <div className="data-empty">
      Selecciona una entidad en Conexión de datos para configurar este componente.
    </div>
  );
}
function valueLabel(field: DataField, record: DataRecord): string {
  const value = record.values[field.key];
  if (value === null || value === undefined) return '—';
  if (field.type === 'money') return formatMoney(Number(value));
  if (field.type === 'boolean') return value ? 'Sí' : 'No';
  return record.labels[field.key] ?? String(value);
}
function RelationInput({
  field,
  context,
  value,
  disabled,
  onChange,
}: {
  field: DataField;
  context: DataState;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DataRecord[]>([]);
  const [error, setError] = useState('');
  const target = context.entities.find((e) => e.id === field.relationEntityId);
  useEffect(() => {
    const controller = new AbortController();
    platformRequest<RecordList>(
      resource(context.projectId, field.relationEntityId!) +
        '?pageSize=100&q=' +
        encodeURIComponent(query),
      { signal: controller.signal },
    )
      .then((result) => {
        setItems(result.items);
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [context.projectId, context.version, field.relationEntityId, query]);
  return (
    <>
      <input
        aria-label={'Buscar opción de ' + field.label}
        value={query}
        disabled={disabled}
        placeholder="Buscar opciones…"
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.label}
      >
        <option value="">Seleccionar…</option>
        {value && !items.some((r) => r.id === value) && (
          <option value={value}>Referencia actual</option>
        )}
        {items.map((r) => (
          <option key={r.id} value={r.id}>
            {String(r.values[target?.labelField ?? ''] ?? r.id)}
          </option>
        ))}
      </select>
      {items.length === 100 && <small>Refina la búsqueda para encontrar más opciones.</small>}
      {error && <small role="alert">{error}</small>}
    </>
  );
}
export function DataForm({ node }: { node: ComponentNode }) {
  const [message, setMessage] = useState('');
  const context = useDataContext(),
    entity = entityFor(context, node);
  if (!context || !entity) return <Unconnected />;
  const record = node.props.action === 'update' ? context.selected[entity.id] : undefined;
  return (
    <DataFormBody
      key={node.props.action === 'update' ? record?.id + ':' + record?.revision : 'create'}
      node={node}
      context={context}
      entity={entity}
      record={record}
      message={message}
      setMessage={setMessage}
    />
  );
}
function DataFormBody({
  node,
  context,
  entity,
  record,
  message,
  setMessage,
}: {
  message: string;
  setMessage: (message: string) => void;
  node: ComponentNode;
  context: DataState;
  entity: Entity;
  record?: DataRecord;
}) {
  const update = node.props.action === 'update';
  const initial = Object.fromEntries(
    entity.fields.map((f) => [f.key, record?.values[f.key] ?? (f.type === 'boolean' ? false : '')]),
  );
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const disabled = !context.canWrite || context.preview || busy;
  const title = String(node.props.title || (update ? 'Editar ' : 'Crear ') + entity.name);
  const change = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFields((errors) => ({ ...errors, [key]: '' }));
    setMessage('');
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    setBusy(true);
    setError('');
    setMessage('');
    setFields({});
    try {
      const parsed: Record<string, unknown> = {};
      for (const field of entity.fields) {
        const raw = values[field.key];
        if (raw === '' || raw === undefined || raw === null) {
          parsed[field.key] = null;
          continue;
        }
        if (field.type === 'integer') {
          if (!/^-?\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)))
            throw new ApiError('Revisa los campos indicados', 400, {
              [field.key]: 'Introduce un entero válido, sin decimales',
            });
          parsed[field.key] = Number(raw);
        } else if (field.type === 'money') {
          try {
            parsed[field.key] = typeof raw === 'number' ? raw : parseMoney(String(raw));
          } catch (e) {
            throw new ApiError('Revisa los campos indicados', 400, {
              [field.key]: (e as Error).message,
            });
          }
        } else parsed[field.key] = raw;
      }
      const result = await platformRequest<DataRecord>(
        resource(context.projectId, entity.id) + (update ? '/' + record!.id : ''),
        {
          method: update ? 'PUT' : 'POST',
          body: JSON.stringify({ values: parsed, revision: record?.revision }),
        },
      );
      if (update) context.select(entity.id, result);
      context.refresh();
      if (!update)
        setValues(
          Object.fromEntries(entity.fields.map((f) => [f.key, f.type === 'boolean' ? false : ''])),
        );
      setMessage('Registro guardado.');
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError) setFields(e.fields);
    } finally {
      setBusy(false);
    }
  }
  if (update && !record)
    return (
      <section className="data-panel">
        <h3>{title}</h3>
        <p>Selecciona un registro del listado para editarlo.</p>
      </section>
    );
  return (
    <section className="data-panel">
      <h3>{title}</h3>
      {context.preview && (
        <p className="data-hint">
          Vista previa del borrador. El guardado de datos está desactivado.
        </p>
      )}
      <form aria-label={title} onSubmit={(event) => void submit(event)} noValidate>
        {entity.fields.map((field) => {
          const raw = values[field.key];
          return (
            <div key={field.key} className="data-field">
              <label htmlFor={node.id + '-' + field.key}>
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              {field.type === 'relation' ? (
                <RelationInput
                  field={field}
                  context={context}
                  value={String(raw ?? '')}
                  disabled={disabled}
                  onChange={(v) => change(field.key, v)}
                />
              ) : field.type === 'boolean' ? (
                <input
                  id={node.id + '-' + field.key}
                  aria-label={field.label}
                  type="checkbox"
                  checked={!!raw}
                  disabled={disabled}
                  onChange={(e) => change(field.key, e.target.checked)}
                />
              ) : field.type === 'select' ? (
                <select
                  id={node.id + '-' + field.key}
                  value={String(raw ?? '')}
                  disabled={disabled}
                  onChange={(e) => change(field.key, e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {field.options.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={node.id + '-' + field.key}
                  disabled={disabled}
                  value={
                    field.type === 'money' && typeof raw === 'number'
                      ? moneyInput(raw)
                      : String(raw ?? '')
                  }
                  type={field.type === 'date' ? 'date' : 'text'}
                  inputMode={
                    field.type === 'integer'
                      ? 'numeric'
                      : field.type === 'money'
                        ? 'decimal'
                        : undefined
                  }
                  maxLength={field.type === 'text' ? 1000 : undefined}
                  onChange={(e) => change(field.key, e.target.value)}
                />
              )}
              {fields[field.key] && (
                <small className="data-error" role="alert">
                  {fields[field.key]}
                </small>
              )}
            </div>
          );
        })}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="data-success">
            {message}
          </p>
        )}
        <button className="primary" disabled={disabled || (update && !record)}>
          {busy ? 'Guardando…' : update ? 'Guardar registro' : 'Crear registro'}
        </button>
      </form>
    </section>
  );
}
export function DataTable({ node }: { node: ComponentNode }) {
  const context = useDataContext(),
    entity = entityFor(context, node);
  if (!context || !entity) return <Unconnected />;
  return <DataTableBody key={entity.id} node={node} entity={entity} context={context} />;
}
function DataTableBody({
  node,
  entity,
  context,
}: {
  node: ComponentNode;
  entity: Entity;
  context: DataState;
}) {
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [sort, setSort] = useState(entity.labelField),
    [filter, setFilter] = useState('');
  const [data, setData] = useState<RecordList>(),
    [error, setError] = useState('');
  const [pending, setPending] = useState(''),
    [working, setWorking] = useState(false);
  const filterField = entity.fields.find((f) => f.type === 'select' || f.type === 'relation');
  const filterFieldKey = filterField?.key;
  const key = JSON.stringify([query, page, sort, filter]);
  useEffect(() => {
    const controller = new AbortController();
    const [q, p, s, f] = JSON.parse(key);
    const params = new URLSearchParams({ q, page: String(p), sort: s, pageSize: '10' });
    if (f && filterFieldKey) params.set('filter.' + filterFieldKey, f);
    const timer = setTimeout(() => {
      platformRequest<RecordList>(resource(context.projectId, entity.id) + '?' + params, {
        signal: controller.signal,
      })
        .then((result) => {
          setData(result);
          setError('');
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [context.projectId, context.version, entity.id, key, filterFieldKey]);
  return (
    <section className="data-panel data-table">
      <h3>{String(node.props.title || entity.name)}</h3>
      <div className="data-filters">
        <input
          type="search"
          aria-label="Buscar registros"
          placeholder="Buscar registros…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Ordenar registros"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          {entity.fields.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        {filterField?.type === 'relation' ? (
          <div className="data-relation-filter">
            <RelationInput
              field={{ ...filterField, label: 'Filtrar por ' + filterField.label }}
              context={context}
              value={filter}
              disabled={false}
              onChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
            />
          </div>
        ) : (
          filterField && (
            <select
              aria-label={'Filtrar por ' + filterField.label}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los valores de {filterField.label}</option>
              {filterField.options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          )
        )}
        <button onClick={context.refresh}>Actualizar listado</button>
      </div>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : !data ? (
        <p role="status">Cargando registros…</p>
      ) : !data.items.length ? (
        <p className="data-empty">No hay registros para esta consulta.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {entity.fields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((record) => (
                <tr key={record.id}>
                  {entity.fields.map((f) => (
                    <td key={f.key}>{valueLabel(f, record)}</td>
                  ))}
                  <td>
                    <div className="actions">
                      <button onClick={() => context.select(entity.id, record)}>
                        Ver registro
                      </button>
                      {context.canWrite && !context.preview && (
                        <button
                          disabled={working}
                          onClick={async () => {
                            setWorking(true);
                            setPending('');
                            try {
                              await platformRequest(
                                resource(context.projectId, entity.id) +
                                  '/' +
                                  record.id +
                                  '?revision=' +
                                  record.revision,
                                { method: 'DELETE' },
                              );
                              context.select(entity.id);
                              context.refresh();
                            } catch (e) {
                              setPending((e as Error).message);
                            } finally {
                              setWorking(false);
                            }
                          }}
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending && (
        <p role="alert" className="alert">
          {pending}
        </p>
      )}
      {data && (
        <div className="data-pagination">
          <span>
            {data.total} registros · Página {data.page}
          </span>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <button
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
export function DataDetail({ node }: { node: ComponentNode }) {
  const context = useDataContext(),
    entity = entityFor(context, node);
  if (!context || !entity) return <Unconnected />;
  const record = context.selected[entity.id];
  return (
    <section className="data-panel">
      <h3>{String(node.props.title || 'Detalle de ' + entity.name)}</h3>
      {record ? (
        <dl className="data-detail">
          {entity.fields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>{valueLabel(field, record)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="data-empty">Selecciona un registro del listado.</p>
      )}
    </section>
  );
}
export function DataWorkbench({ entity }: { entity: Entity }) {
  const context = useDataContext();
  const selected = context?.selected[entity.id];
  return (
    <>
      <div className="data-workbench-actions">
        {selected && <button onClick={() => context?.select(entity.id)}>Nuevo registro</button>}
      </div>
      <div className="data-workbench">
        <DataTable
          node={{ id: 'manager-table', type: 'DataTable', props: { entityId: entity.id } }}
        />
        <div>
          <DataForm
            node={{
              id: 'manager-form',
              type: 'DataForm',
              props: { entityId: entity.id, action: selected ? 'update' : 'create' },
            }}
          />
          <DataDetail
            node={{ id: 'manager-detail', type: 'DataDetail', props: { entityId: entity.id } }}
          />
        </div>
      </div>
    </>
  );
}
