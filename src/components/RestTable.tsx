import { useEffect, useState, type FormEvent } from 'react';
import type { ComponentNode } from '../models/contracts';
import type { Endpoint } from '../models/endpoints';
import { useDataContext } from './dataComponents';
import { platformRequest } from '../services/platformHttp';
type Row = Record<string, unknown> & { id: string; revision?: number };
function pathValue(value: unknown, path: string): unknown {
  return path
    ? path
        .split('.')
        .reduce<unknown>(
          (v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined),
          value,
        )
    : value;
}
function route(endpoint: Endpoint, projectId: string, id?: string) {
  const path = endpoint.path
    .replace('{projectId}', encodeURIComponent(projectId))
    .replace(':id', encodeURIComponent(id ?? ''));
  if (!path.startsWith('/api/v1/projects/' + encodeURIComponent(projectId) + '/'))
    throw new Error('Ruta fuera del proyecto');
  return path.slice('/api/v1'.length);
}
export function RestTable({ node }: { node: ComponentNode }) {
  const context = useDataContext(),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<Row | null | undefined>(),
    [busy, setBusy] = useState(false);
  const endpoint = (slot: string) => context?.endpoints.find((e) => e.id === node.props[slot]);
  const list = endpoint('listEndpointId'),
    create = endpoint('createEndpointId'),
    update = endpoint('updateEndpointId'),
    remove = endpoint('deleteEndpointId');
  const projectId = context?.projectId ?? '',
    preview = context?.preview ?? true;
  useEffect(() => {
    if (!list || preview) return;
    const controller = new AbortController();
    platformRequest<unknown>(route(list, projectId), { signal: controller.signal })
      .then((data) => {
        const result = pathValue(data, list.itemsPath);
        if (!Array.isArray(result))
          throw new Error('La respuesta no contiene un array en ' + list.itemsPath);
        setRows(
          result.map((item) => {
            if (!item || typeof item !== 'object' || typeof item.id !== 'string')
              throw new Error('Cada registro requiere un id de texto');
            return item as Row;
          }),
        );
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [list, projectId, preview, revision]);
  if (!context || !list)
    return <p className="data-empty">Selecciona la ruta GET en Servicios HTTP.</p>;
  const fields = (editing === null ? create : update)?.fields ?? list.fields;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = editing === null ? create : update;
    if (!endpoint || !context || preview) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const values: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = form.get(field.key);
        values[field.key] =
          field.type === 'boolean'
            ? raw === 'on'
            : field.type === 'integer'
              ? raw === ''
                ? null
                : Number(raw)
              : raw;
      }
      if (editing?.revision) values.revision = editing.revision;
      await platformRequest(route(endpoint, projectId, editing?.id), {
        method: endpoint.method,
        body: JSON.stringify(values),
      });
      setEditing(undefined);
      setLoading(true);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="data-panel rest-table">
      <div className="rest-table-toolbar">
        <h3>{String(node.props.title || 'Tabla HTTP')}</h3>
        {create && context.canWrite && !preview && (
          <button onClick={() => setEditing(null)}>Nuevo registro</button>
        )}
      </div>
      {preview ? (
        <p className="data-hint">
          GET: {list.path}. La vista previa no ejecuta escrituras. Publica para usar los servicios.
        </p>
      ) : (
        <>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          {loading && <p role="status">Cargando...</p>}
          <button
            disabled={busy}
            onClick={() => {
              setLoading(true);
              setRevision((v) => v + 1);
            }}
          >
            Actualizar tabla
          </button>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {list.fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    {list.fields.map((f) => (
                      <td key={f.key}>
                        {String(
                          (row.values as Record<string, unknown> | undefined)?.[f.key] ??
                            row[f.key] ??
                            '',
                        )}
                      </td>
                    ))}
                    <td>
                      <div className="actions">
                        {update && context.canWrite && (
                          <button
                            disabled={busy}
                            aria-label={'Editar registro ' + row.id}
                            onClick={() => setEditing(row)}
                          >
                            Editar
                          </button>
                        )}
                        {remove && context.canWrite && (
                          <button
                            disabled={busy}
                            aria-label={'Eliminar registro ' + row.id}
                            onClick={async () => {
                              if (!window.confirm('Eliminar este registro?')) return;
                              setBusy(true);
                              try {
                                await platformRequest(
                                  route(remove, projectId, row.id) +
                                    (row.revision ? '?revision=' + row.revision : ''),
                                  { method: remove.method },
                                );
                                setLoading(true);
                                setRevision((v) => v + 1);
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && !loading && <p>No hay registros.</p>}
        </>
      )}
      {editing !== undefined && !preview && (
        <form onSubmit={save} className="rest-record-form">
          <h3>{editing ? 'Editar registro' : 'Nuevo registro'}</h3>
          {fields.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                name={field.key}
                type={
                  field.type === 'boolean'
                    ? 'checkbox'
                    : field.type === 'integer'
                      ? 'number'
                      : 'text'
                }
                required={field.required && field.type !== 'boolean'}
                step={field.type === 'integer' ? 1 : undefined}
                defaultChecked={
                  field.type === 'boolean' ? Boolean(editing?.[field.key]) : undefined
                }
                defaultValue={
                  field.type !== 'boolean'
                    ? String(
                        (editing?.values as Record<string, unknown> | undefined)?.[field.key] ??
                          editing?.[field.key] ??
                          '',
                      )
                    : undefined
                }
              />
            </label>
          ))}
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => setEditing(undefined)}>
              Cancelar
            </button>
            <button disabled={busy} className="primary">
              Guardar registro
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
