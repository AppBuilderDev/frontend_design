import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import type { DataField } from '../../models/data';
import {
  connectionDefinitionSchema,
  type ConnectionDefinition,
  type ConnectionSummary,
  type ConnectionEnvironment,
  type EnvironmentSummary,
  type ConnectionResult,
} from '../../models/connections';
import { platformRequest } from '../../services/platformHttp';
import { useWorkspace } from './WorkspaceContext';
import {
  ServiceInputs,
  initialServiceValues,
  parseServiceValues,
  serviceErrorMessage,
} from '../../components/ServiceInputs';
import { ConnectionResults } from '../../components/ConnectionResults';
const path = (value: string) => (value ? value.split('.') : []);
const initial: ConnectionDefinition = {
  name: 'Consulta de catálogo',
  key: 'consulta_catalogo',
  inputs: [
    { key: 'consulta', label: 'Buscar', type: 'text', required: false, unique: false, options: [] },
  ],
  parameters: { q: 'consulta' },
  responseMode: 'list',
  responsePath: ['items'],
  fields: [{ key: 'nombre', label: 'Nombre', type: 'text', path: ['nombre'], required: true }],
  allowedRoles: ['admin'],
};
export function ConnectionsWorkspace() {
  const { project } = useWorkspace();
  const [connections, setConnections] = useState<ConnectionSummary[]>([]),
    [editing, setEditing] = useState<ConnectionSummary | null | undefined>(),
    [error, setError] = useState(''),
    [policy, setPolicy] = useState<{ allowedHosts: string[]; encryptionReady: boolean }>();
  const load = useCallback(
    () =>
      platformRequest<ConnectionSummary[]>('/projects/' + project.id + '/connections')
        .then((values) => {
          setConnections(values);
          setError('');
        })
        .catch((e: Error) => setError(e.message)),
    [project.id],
  );
  useEffect(() => {
    void load();
    if (project.role === 'owner')
      void platformRequest<{ allowedHosts: string[]; encryptionReady: boolean }>(
        '/projects/' + project.id + '/connections/policy',
      )
        .then(setPolicy)
        .catch((e: Error) => setError(e.message));
  }, [load, project.id, project.role]);
  return (
    <section className="connections-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Conexiones externas</h2>
          <p>Consulta APIs de lectura con ambientes y credenciales separados.</p>
        </div>
        {project.role !== 'reader' && (
          <button className="primary" onClick={() => setEditing(null)}>
            Crear conexión externa
          </button>
        )}
      </div>
      {policy && (
        <details className="connection-policy">
          <summary>
            Preparación del servidor ·{' '}
            {policy.encryptionReady ? 'Cifrado disponible' : 'Clave de cifrado pendiente'}
          </summary>
          <p>
            Dominios autorizados: {policy.allowedHosts.join(', ') || 'Ninguno'}. El administrador
            del servidor debe autorizar los dominios y conservar la clave de cifrado fuera del
            frontend.
          </p>
          <p>
            Desde el backend: <code>npm run connectors:setup -- api.tu-proveedor.com</code>. Luego
            reiniciar la API. No compartir el archivo de configuración.
          </p>
        </details>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!connections.length ? (
        <p className="workspace-empty">
          Define qué datos necesitas mostrar y configura su origen en pruebas y producción.
        </p>
      ) : (
        connections.map((connection) => (
          <ConnectionCard
            key={connection.id}
            projectId={project.id}
            role={project.role}
            connection={connection}
            onEdit={() => setEditing(connection)}
            onChanged={load}
          />
        ))
      )}
      {editing !== undefined && (
        <ConnectionDesigner
          projectId={project.id}
          editing={editing ?? undefined}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
    </section>
  );
}
function ConnectionCard({
  projectId,
  role,
  connection,
  onEdit,
  onChanged,
}: {
  projectId: string;
  role: string;
  connection: ConnectionSummary;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const base = '/projects/' + projectId + '/connections/' + connection.id;
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [test, setTest] = useState(false),
    [environment, setEnvironment] = useState<ConnectionEnvironment>(),
    [settings, setSettings] = useState<EnvironmentSummary[]>([]),
    [details, setDetails] = useState<unknown>();
  async function mutate(action: string, method: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await platformRequest(base + action, { method, body: JSON.stringify(body) });
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function configure(target: ConnectionEnvironment) {
    setBusy(true);
    setError('');
    try {
      setSettings(await platformRequest<EnvironmentSummary[]>(base + '/environments'));
      setEnvironment(target);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="service-card connection-card">
      <header>
        <div>
          <h3>{connection.draft.name}</h3>
          <small>
            {connection.draft.key} · Borrador revisión {connection.revision}
          </small>
        </div>
        <span className="badge">
          {!connection.active
            ? 'Desactivada'
            : connection.publishedVersion
              ? 'Versión predeterminada ' + connection.publishedVersion
              : 'Sin publicar'}
        </span>
      </header>
      <p>
        {connection.draft.inputs.length} entradas · {connection.draft.fields.length} campos de
        respuesta · Consultas de lectura.
      </p>
      <div className="actions">
        <button disabled={busy || role === 'reader'} onClick={onEdit}>
          Editar conexión {connection.draft.name}
        </button>
        <button disabled={busy || role === 'reader'} onClick={() => setTest(true)}>
          Probar conexión {connection.draft.name}
        </button>
        {role === 'owner' && (
          <>
            <button disabled={busy} onClick={() => void configure('test')}>
              Configurar pruebas
            </button>
            <button disabled={busy} onClick={() => void configure('production')}>
              Configurar producción
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void mutate('/publish', 'POST', { revision: connection.revision })}
            >
              Publicar conexión {connection.draft.name}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void mutate('', 'PATCH', {
                  revision: connection.revision,
                  active: !connection.active,
                })
              }
            >
              {connection.active ? 'Desactivar' : 'Activar'} conexión
            </button>
          </>
        )}
      </div>
      <p className="data-hint">
        Para publicar, el propietario debe comprobar el contrato en producción. Las páginas
        existentes conservan su versión.
      </p>
      {role === 'owner' && connection.versions.length > 0 && (
        <label>
          Versión predeterminada
          <select
            aria-label={'Versión de conexión ' + connection.draft.name}
            value={connection.publishedVersion}
            disabled={busy}
            onChange={(e) =>
              void mutate('', 'PATCH', {
                revision: connection.revision,
                version: Number(e.target.value),
              })
            }
          >
            {connection.versions.map((v) => (
              <option key={v.version} value={v.version}>
                Versión {v.version} · {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        onClick={() =>
          void platformRequest(base + '/details')
            .then(setDetails)
            .catch((e: Error) => setError(e.message))
        }
      >
        Ver comprobaciones e impacto
      </button>
      {details !== undefined && (
        <details open>
          <summary>Comprobaciones, páginas y consultas recientes</summary>
          <pre>{JSON.stringify(details, null, 2)}</pre>
        </details>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {environment && (
        <EnvironmentDialog
          key={environment}
          projectId={projectId}
          connection={connection}
          environment={environment}
          setting={settings.find((s) => s.environment === environment)}
          onCancel={() => setEnvironment(undefined)}
          onSaved={() => setEnvironment(undefined)}
        />
      )}
      {test && (
        <ConnectionTest
          projectId={projectId}
          connection={connection}
          owner={role === 'owner'}
          onClose={() => setTest(false)}
        />
      )}
    </article>
  );
}
function ConnectionDesigner({
  projectId,
  editing,
  onCancel,
  onSaved,
}: {
  projectId: string;
  editing?: ConnectionSummary;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [definition, setDefinition] = useState<ConnectionDefinition>(editing?.draft ?? initial),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const change = (patch: Partial<ConnectionDefinition>) =>
    setDefinition((old) => ({ ...old, ...patch }));
  const inputChange = (index: number, patch: Partial<DataField>) => {
    const previous = definition.inputs[index],
      key = patch.key ?? previous.key;
    change({
      inputs: definition.inputs.map((f, i) => (i === index ? { ...f, ...patch } : f)),
      parameters: Object.fromEntries(
        Object.entries(definition.parameters).map(([remote, value]) => [
          remote,
          value === previous.key ? key : value,
        ]),
      ),
    });
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal connection-designer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
      >
        <h2 id="connection-title">{editing ? 'Editar conexión' : 'Crear conexión externa'}</h2>
        <p>
          Define el contrato de lectura. La URL y la credencial se configuran por ambiente después
          de guardar.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const parsed = connectionDefinitionSchema.parse(definition);
              await platformRequest(
                '/projects/' + projectId + '/connections' + (editing ? '/' + editing.id : ''),
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
              setError(
                error instanceof z.ZodError
                  ? error.issues.map((i) => i.message).join('; ')
                  : (error as Error).message,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="inspector-grid">
            <label>
              Nombre de conexión
              <input
                required
                maxLength={80}
                value={definition.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
            <label>
              Identificador de conexión
              <input
                required
                pattern="[a-z][a-z0-9_]*"
                value={definition.key}
                disabled={!!editing}
                onChange={(e) => change({ key: e.target.value })}
              />
            </label>
          </div>
          <fieldset>
            <legend>Permisos de consulta</legend>
            <p>
              Los administradores siempre conservan acceso. Puedes habilitar lectura para otros
              roles de aplicación.
            </p>
            {[
              ['operator', 'Operadores'],
              ['viewer', 'Usuarios de consulta'],
            ].map(([role, label]) => (
              <label className="operation-check" key={role}>
                <input
                  type="checkbox"
                  checked={definition.allowedRoles.includes(role as 'viewer' | 'operator')}
                  onChange={(e) =>
                    change({
                      allowedRoles: e.target.checked
                        ? [...definition.allowedRoles, role as 'viewer' | 'operator']
                        : definition.allowedRoles.filter((v) => v !== role),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <h3>Parámetros de consulta</h3>
          {definition.inputs.map((field, index) => (
            <fieldset key={index}>
              <legend>Entrada {index + 1}</legend>
              <div className="connection-field-grid">
                <label>
                  Etiqueta
                  <input
                    aria-label={'Etiqueta de consulta ' + (index + 1)}
                    required
                    value={field.label}
                    onChange={(e) => inputChange(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Identificador
                  <input
                    aria-label={'Identificador de consulta ' + (index + 1)}
                    required
                    value={field.key}
                    onChange={(e) => inputChange(index, { key: e.target.value })}
                  />
                </label>
                <label>
                  Parámetro de la API
                  <input
                    aria-label={'Parámetro remoto ' + (index + 1)}
                    required
                    value={
                      Object.keys(definition.parameters).find(
                        (key) => definition.parameters[key] === field.key,
                      ) ?? ''
                    }
                    onChange={(e) =>
                      change({
                        parameters: {
                          ...Object.fromEntries(
                            Object.entries(definition.parameters).filter(
                              ([, key]) => key !== field.key,
                            ),
                          ),
                          [e.target.value]: field.key,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Tipo
                  <select
                    aria-label={'Tipo de consulta ' + (index + 1)}
                    value={field.type}
                    onChange={(e) =>
                      inputChange(index, { type: e.target.value as DataField['type'] })
                    }
                  >
                    {[
                      ['text', 'Texto'],
                      ['integer', 'Entero'],
                      ['money', 'Centavos enteros'],
                      ['boolean', 'Sí o no'],
                      ['date', 'Fecha'],
                      ['select', 'Selección'],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="operation-check">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => inputChange(index, { required: e.target.checked })}
                />
                Obligatoria
              </label>
              {field.type === 'select' && (
                <label>
                  Opciones separadas por coma
                  <input
                    value={field.options.join(', ')}
                    onChange={(e) =>
                      inputChange(index, {
                        options: e.target.value.split(',').map((v) => v.trim()),
                      })
                    }
                  />
                </label>
              )}
              {['integer', 'money'].includes(field.type) && (
                <div className="inspector-grid">
                  <label>
                    Mínimo
                    <input
                      type="number"
                      step="1"
                      value={field.min ?? ''}
                      onChange={(e) =>
                        inputChange(index, {
                          min: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Máximo
                    <input
                      type="number"
                      step="1"
                      value={field.max ?? ''}
                      onChange={(e) =>
                        inputChange(index, {
                          max: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  change({
                    inputs: definition.inputs.filter((_, i) => i !== index),
                    parameters: Object.fromEntries(
                      Object.entries(definition.parameters).filter(
                        ([, value]) => value !== field.key,
                      ),
                    ),
                  })
                }
              >
                Quitar entrada {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={definition.inputs.length >= 10}
            onClick={() => {
              const key = 'entrada_' + (definition.inputs.length + 1);
              change({
                inputs: [
                  ...definition.inputs,
                  {
                    key,
                    label: 'Nueva entrada',
                    type: 'text',
                    required: false,
                    unique: false,
                    options: [],
                  },
                ],
                parameters: { ...definition.parameters, [key]: key },
              });
            }}
          >
            Agregar parámetro
          </button>
          <h3>Respuesta esperada</h3>
          <div className="inspector-grid">
            <label>
              Forma de respuesta
              <select
                aria-label="Forma de respuesta"
                value={definition.responseMode}
                onChange={(e) => change({ responseMode: e.target.value as 'list' | 'object' })}
              >
                <option value="list">Lista de resultados</option>
                <option value="object">Un objeto</option>
              </select>
            </label>
            <label>
              Ruta de resultados
              <input
                aria-label="Ruta de resultados"
                value={definition.responsePath.join('.')}
                placeholder="items o data.items; vacío para la raíz"
                onChange={(e) => change({ responsePath: path(e.target.value) })}
              />
            </label>
          </div>
          <p className="data-hint">
            Las rutas usan nombres separados por punto. Los importes deben venir ya en centavos
            enteros; no se redondean ni convierten decimales.
          </p>
          {definition.fields.map((field, index) => (
            <fieldset key={index}>
              <legend>Campo de respuesta {index + 1}</legend>
              <div className="connection-field-grid">
                <label>
                  Etiqueta
                  <input
                    aria-label={'Etiqueta de respuesta ' + (index + 1)}
                    required
                    value={field.label}
                    onChange={(e) =>
                      change({
                        fields: definition.fields.map((f, i) =>
                          i === index ? { ...f, label: e.target.value } : f,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Identificador
                  <input
                    aria-label={'Identificador de respuesta ' + (index + 1)}
                    required
                    value={field.key}
                    onChange={(e) =>
                      change({
                        fields: definition.fields.map((f, i) =>
                          i === index ? { ...f, key: e.target.value } : f,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Ruta del campo
                  <input
                    aria-label={'Ruta del campo ' + (index + 1)}
                    value={field.path.join('.')}
                    placeholder="nombre o precio.centavos"
                    onChange={(e) =>
                      change({
                        fields: definition.fields.map((f, i) =>
                          i === index ? { ...f, path: path(e.target.value) } : f,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Tipo
                  <select
                    aria-label={'Tipo de respuesta ' + (index + 1)}
                    value={field.type}
                    onChange={(e) =>
                      change({
                        fields: definition.fields.map((f, i) =>
                          i === index ? { ...f, type: e.target.value as typeof f.type } : f,
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
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="operation-check">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    change({
                      fields: definition.fields.map((f, i) =>
                        i === index ? { ...f, required: e.target.checked } : f,
                      ),
                    })
                  }
                />
                Obligatorio en la respuesta
              </label>
              <button
                type="button"
                disabled={definition.fields.length === 1}
                onClick={() => change({ fields: definition.fields.filter((_, i) => i !== index) })}
              >
                Quitar campo {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={definition.fields.length >= 12}
            onClick={() =>
              change({
                fields: [
                  ...definition.fields,
                  {
                    key: 'campo_' + (definition.fields.length + 1),
                    label: 'Nuevo campo',
                    type: 'text',
                    path: [],
                    required: true,
                  },
                ],
              })
            }
          >
            Agregar campo de respuesta
          </button>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="actions justify-end">
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contrato de conexión'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function EnvironmentDialog({
  projectId,
  connection,
  environment,
  setting,
  onCancel,
  onSaved,
}: {
  projectId: string;
  connection: ConnectionSummary;
  environment: ConnectionEnvironment;
  setting?: EnvironmentSummary;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [auth, setAuth] = useState(setting?.auth ?? 'none'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="environment-title"
      >
        <h2 id="environment-title">
          Configurar {environment === 'test' ? 'pruebas' : 'producción'}
        </h2>
        <p>
          Las credenciales se cifran en el backend. Cambiar este ambiente exige comprobar de nuevo
          las versiones que lo utilicen.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError('');
            try {
              await platformRequest(
                '/projects/' +
                  projectId +
                  '/connections/' +
                  connection.id +
                  '/environments/' +
                  environment,
                {
                  method: 'PUT',
                  body: JSON.stringify({
                    revision: setting?.revision ?? 0,
                    origin: values.origin,
                    path: values.path,
                    auth,
                    headerName: String(values.headerName || 'X-API-Key'),
                    ...(values.secret ? { secret: values.secret } : {}),
                  }),
                },
              );
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Origen HTTPS
            <input
              name="origin"
              type="url"
              required
              defaultValue={setting?.origin}
              placeholder="https://api.proveedor.com"
            />
          </label>
          <label>
            Ruta fija
            <input
              name="path"
              required
              defaultValue={setting?.path ?? '/catalogo'}
              placeholder="/v1/catalogo"
            />
          </label>
          <label>
            Autenticación
            <select
              aria-label="Autenticación de ambiente"
              value={auth}
              onChange={(e) => setAuth(e.target.value as typeof auth)}
            >
              <option value="none">Sin credencial</option>
              <option value="bearer">Token Bearer</option>
              <option value="apiKey">API key en cabecera X-</option>
            </select>
          </label>
          {auth === 'apiKey' && (
            <label>
              Nombre de cabecera
              <input
                name="headerName"
                required
                pattern="[Xx]-[A-Za-z0-9-]+"
                defaultValue={setting?.headerName ?? 'X-API-Key'}
              />
            </label>
          )}
          {auth !== 'none' && (
            <label>
              Credencial
              <input
                name="secret"
                type="password"
                autoComplete="off"
                maxLength={4096}
                required={!setting?.secretConfigured}
                placeholder={
                  setting?.secretConfigured
                    ? 'Configurada: vacío conserva la actual'
                    : 'Introduce la credencial para este ambiente'
                }
              />
            </label>
          )}
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="actions justify-end">
            <button type="button" disabled={busy} onClick={onCancel}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              Guardar ambiente
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function ConnectionTest({
  projectId,
  connection,
  owner,
  onClose,
}: {
  projectId: string;
  connection: ConnectionSummary;
  owner: boolean;
  onClose: () => void;
}) {
  const [environment, setEnvironment] = useState<ConnectionEnvironment>('test'),
    [version, setVersion] = useState(0),
    [values, setValues] = useState<Record<string, unknown>>(() =>
      initialServiceValues(connection.draft.inputs),
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ConnectionResult>();
  const contract = version
    ? connection.versions.find((v) => v.version === version)!
    : connection.draft;
  return (
    <div className="modal-backdrop">
      <section
        className="modal connection-test service-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-test-title"
      >
        <h2 id="connection-test-title">Probar {connection.draft.name}</h2>
        <p>
          La consulta usa el ambiente seleccionado. Solo se muestran los campos validados del
          contrato.
        </p>
        <div className="inspector-grid">
          <label>
            Ambiente
            <select
              aria-label="Ambiente de prueba"
              disabled={busy}
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value as ConnectionEnvironment);
                setResult(undefined);
              }}
            >
              <option value="test">Pruebas</option>
              {owner && <option value="production">Producción</option>}
            </select>
          </label>
          <label>
            Contrato
            <select
              aria-label="Contrato de prueba"
              disabled={busy}
              value={version}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVersion(v);
                setValues(
                  initialServiceValues(
                    v
                      ? connection.versions.find((c) => c.version === v)!.inputs
                      : connection.draft.inputs,
                  ),
                );
                setResult(undefined);
              }}
            >
              <option value={0}>Borrador guardado</option>
              {connection.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  Versión {v.version}
                </option>
              ))}
            </select>
          </label>
        </div>
        <form
          aria-label="Probar conexión externa"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setResult(undefined);
            try {
              const input = parseServiceValues(contract.inputs, values);
              setResult(
                await platformRequest<ConnectionResult>(
                  '/projects/' + projectId + '/connections/' + connection.id + '/test',
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      environment,
                      revision: connection.revision,
                      ...(version ? { version } : {}),
                      input,
                    }),
                  },
                ),
              );
            } catch (e) {
              setError(serviceErrorMessage(e, contract.inputs));
            } finally {
              setBusy(false);
            }
          }}
        >
          <ServiceInputs
            projectId={projectId}
            operationId={connection.id}
            version={version}
            fields={contract.inputs}
            values={values}
            disabled={busy}
            onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
          />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Cerrar prueba
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Consultando…' : 'Ejecutar prueba de conexión'}
            </button>
          </div>
        </form>
        {result && (
          <>
            <p role="status" className="data-success">
              Contrato comprobado en {environment === 'test' ? 'pruebas' : 'producción'}.
            </p>
            <ConnectionResults fields={contract.fields} result={result} />
          </>
        )}
      </section>
    </div>
  );
}
