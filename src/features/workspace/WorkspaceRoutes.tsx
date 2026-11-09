import { useState, type FormEvent } from 'react';
import { Plus, Route, Trash2, Pencil } from 'lucide-react';
import { endpointInputSchema, type Endpoint } from '../../models/endpoints';
import { platformRequest } from '../../services/platformHttp';
import { useWorkspace } from './WorkspaceContext';
import { useEndpoints } from './useEndpoints';
const defaultFields = [{ key: 'nombre', label: 'Nombre', type: 'text', required: true }];
export function WorkspaceRoutes() {
  const { project } = useWorkspace(),
    api = useEndpoints(project.id);
  const [editing, setEditing] = useState<Endpoint | null | undefined>(),
    [resource, setResource] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState('');
  const writable = project.role !== 'reader';
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const fields = JSON.parse(String(data.get('fields')));
      const input = endpointInputSchema.parse({
        name: data.get('name'),
        method: data.get('method'),
        path: data.get('path'),
        itemsPath: data.get('itemsPath'),
        fields,
      });
      await api.save(input, editing?.id, editing?.revision);
      setEditing(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const fields = JSON.parse(String(data.get('fields')));
      await platformRequest('/projects/' + project.id + '/resources', {
        method: 'POST',
        body: JSON.stringify({
          key: data.get('key'),
          name: data.get('name'),
          labelField: fields[0]?.key,
          fields,
        }),
      });
      setResource(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace-content">
      <div className="page-heading">
        <div>
          <h1>
            <Route size={26} /> Rutas y endpoints
          </h1>
          <p>Registra el contrato HTTP y vincula sus metodos a tus tablas.</p>
        </div>
        {writable && (
          <div className="actions">
            <button
              onClick={() => {
                setResource(true);
                setError('');
              }}
            >
              Crear recurso en backend
            </button>
            <button
              className="primary"
              onClick={() => {
                setEditing(null);
                setError('');
              }}
            >
              <Plus size={16} />
              Registrar ruta
            </button>
          </div>
        )}
      </div>
      <div className="tip">
        <p>
          Un recurso crea endpoints reales GET, POST, PUT, PATCH y DELETE en NestJS. Registra
          despues cada metodo que usaras en la pagina. Ruta:{' '}
          <code>/api/v1/projects/{'{projectId}'}/resources/productos</code>; agrega{' '}
          <code>/:id</code> para editar o eliminar. Las escrituras requieren acceso de editor o
          propietario.
        </p>
      </div>
      {(error || api.error) && (
        <p className="alert" role="alert">
          {error || api.error}
        </p>
      )}
      <label>
        Buscar rutas
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {api.loading ? (
        <p role="status">Cargando rutas...</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Metodo</th>
                <th>Ruta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {api.endpoints
                .filter((e) =>
                  (e.name + e.path + e.method).toLowerCase().includes(query.toLowerCase()),
                )
                .map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>
                      <code>{e.method}</code>
                    </td>
                    <td>
                      <code>{e.path}</code>
                    </td>
                    <td>
                      {writable && (
                        <div className="actions">
                          <button
                            aria-label={'Editar ruta ' + e.name}
                            onClick={() => {
                              setEditing(e);
                              setError('');
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            aria-label={'Eliminar ruta ' + e.name}
                            disabled={busy}
                            onClick={async () => {
                              if (!window.confirm('Eliminar esta ruta?')) return;
                              setBusy(true);
                              try {
                                await api.remove(e.id);
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!api.endpoints.length && <p className="empty">Aun no hay rutas registradas.</p>}
        </div>
      )}
      {editing !== undefined && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="route-title">
            <h2 id="route-title">{editing ? 'Editar ruta' : 'Registrar ruta'}</h2>
            <form onSubmit={save}>
              <label>
                Nombre
                <input name="name" required defaultValue={editing?.name} />
              </label>
              <label>
                Metodo
                <select aria-label="Metodo" name="method" defaultValue={editing?.method ?? 'GET'}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Ruta HTTP
                <input
                  name="path"
                  required
                  defaultValue={editing?.path ?? '/api/v1/projects/{projectId}/resources/productos'}
                />
              </label>
              <label>
                Ruta de items en respuesta
                <input name="itemsPath" defaultValue={editing?.itemsPath ?? 'items'} />
              </label>
              <label>
                Campos JSON
                <textarea
                  name="fields"
                  rows={6}
                  defaultValue={JSON.stringify(editing?.fields ?? defaultFields, null, 2)}
                />
              </label>
              <small>
                Campos: key, label, type (text, integer, boolean), required. Las credenciales se
                administran en el backend.
              </small>
              {error && (
                <p role="alert" className="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => setEditing(undefined)}>
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  Guardar ruta
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {resource && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-title"
          >
            <h2 id="resource-title">Crear recurso en backend</h2>
            <form onSubmit={createResource}>
              <label>
                Nombre
                <input name="name" required defaultValue="Productos" />
              </label>
              <label>
                Identificador
                <input name="key" required pattern="[a-z][a-z0-9_]*" defaultValue="productos" />
              </label>
              <label>
                Campos del recurso JSON
                <textarea
                  name="fields"
                  rows={6}
                  defaultValue={JSON.stringify(defaultFields, null, 2)}
                />
              </label>
              <p>El primer campo sera la etiqueta. La API valida tipos, permisos y revisiones.</p>
              {error && (
                <p className="alert" role="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => setResource(false)}>
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  Crear recurso
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
