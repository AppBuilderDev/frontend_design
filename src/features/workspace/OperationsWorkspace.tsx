import { useCallback, useEffect, useState } from 'react';
import type { Entity } from '../../models/data';
import type { OperationSummary, OperationResult } from '../../models/operations';
import { platformRequest } from '../../services/platformHttp';
import { useWorkspace } from './WorkspaceContext';
import { OperationDesigner, createOperation } from './OperationDesigner';
import {
  ServiceInputs,
  initialServiceValues,
  parseServiceValues,
} from '../../components/ServiceInputs';
export function OperationsWorkspace({ entities }: { entities: Entity[] }) {
  const { project } = useWorkspace();
  const [operations, setOperations] = useState<OperationSummary[]>([]),
    [error, setError] = useState(''),
    [editing, setEditing] = useState<OperationSummary | null | undefined>(),
    [simulating, setSimulating] = useState<OperationSummary>();
  const [entityId, setEntityId] = useState(''),
    [mode, setMode] = useState<'create' | 'decrement'>('create');
  const load = useCallback(
    () =>
      platformRequest<OperationSummary[]>('/projects/' + project.id + '/operations')
        .then((operations) => {
          setOperations(operations);
          setError('');
        })
        .catch((e: Error) => setError(e.message)),
    [project.id],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const entity = entities.find((e) => e.id === entityId) ?? entities[0];
  return (
    <section className="operations-workspace">
      <div className="workspace-heading">
        <div>
          <h2>Servicios configurables</h2>
          <p>Conecta varios pasos y confirma sus escrituras juntas.</p>
        </div>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {project.role !== 'reader' && (
        <div className="operation-template">
          <label>
            Entidad inicial
            <select
              aria-label="Entidad inicial del servicio"
              value={entity?.id ?? ''}
              onChange={(e) => setEntityId(e.target.value)}
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plantilla
            <select
              aria-label="Plantilla del servicio"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="create">Crear un registro</option>
              <option value="decrement">Descontar una cantidad</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={
              !entity ||
              (mode === 'decrement' &&
                !entity.fields.some((f) => ['integer', 'money'].includes(f.type)))
            }
            onClick={() => setEditing(null)}
          >
            Crear servicio
          </button>
        </div>
      )}
      {!operations.length ? (
        <p className="workspace-empty">Crea tu primer servicio para combinar reglas y datos.</p>
      ) : (
        operations.map((operation) => (
          <OperationCard
            key={operation.id}
            projectId={project.id}
            role={project.role}
            operation={operation}
            onEdit={() => setEditing(operation)}
            onSimulate={() => setSimulating(operation)}
            onChanged={load}
          />
        ))
      )}
      {editing !== undefined && entity && (
        <OperationDesigner
          projectId={project.id}
          entities={entities}
          editing={editing ?? undefined}
          initial={editing?.draft ?? createOperation(entity, mode)}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
      {simulating && (
        <OperationSimulation
          projectId={project.id}
          operation={simulating}
          onClose={() => setSimulating(undefined)}
        />
      )}
    </section>
  );
}
function OperationCard({
  projectId,
  role,
  operation,
  onEdit,
  onSimulate,
  onChanged,
}: {
  projectId: string;
  role: string;
  operation: OperationSummary;
  onEdit: () => void;
  onSimulate: () => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [details, setDetails] = useState<unknown>();
  const base = '/projects/' + projectId + '/operations/' + operation.id;
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await platformRequest(base + path, { method, body: JSON.stringify(body) });
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="service-card operation-card">
      <header>
        <div>
          <h3>{operation.draft.name}</h3>
          <small>
            {operation.draft.key} · Borrador revisión {operation.revision}
          </small>
        </div>
        <span className="badge">
          {!operation.active
            ? 'Desactivado'
            : operation.publishedVersion
              ? 'Versión predeterminada ' + operation.publishedVersion
              : 'Sin publicar'}
        </span>
      </header>
      <p>
        {operation.draft.inputs.length} entradas · {operation.draft.steps.length} pasos · Solo los
        resultados definidos se devuelven a la aplicación.
      </p>
      <div className="actions">
        <button disabled={busy || role === 'reader'} onClick={onEdit}>
          Editar servicio {operation.draft.name}
        </button>
        <button disabled={busy || role === 'reader'} onClick={onSimulate}>
          Simular {operation.draft.name}
        </button>
        {role === 'owner' && (
          <>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void mutate('/publish', 'POST', { revision: operation.revision })}
            >
              Publicar servicio {operation.draft.name}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void mutate('', 'PATCH', {
                  revision: operation.revision,
                  active: !operation.active,
                })
              }
            >
              {operation.active ? 'Desactivar' : 'Activar'} servicio
            </button>
          </>
        )}
      </div>
      {role === 'owner' && operation.versions.length > 0 && (
        <label>
          Versión predeterminada
          <select
            aria-label={'Versión predeterminada de ' + operation.draft.name}
            disabled={busy}
            value={operation.publishedVersion}
            onChange={(e) =>
              void mutate('', 'PATCH', {
                revision: operation.revision,
                version: Number(e.target.value),
              })
            }
          >
            {operation.versions.map((v) => (
              <option key={v.version} value={v.version}>
                Versión {v.version} · {v.name} ·{' '}
                {v.allowOperators ? 'Operadores y administradores' : 'Administradores'}
              </option>
            ))}
          </select>
          <small>
            Se utiliza al volver a publicar una página. Las páginas existentes conservan su versión;
            desactivar el servicio bloquea todas.
          </small>
        </label>
      )}
      <div className="actions">
        <button
          onClick={() =>
            void platformRequest(base + '/impact')
              .then(setDetails)
              .catch((e: Error) => setError(e.message))
          }
        >
          Ver impacto y versiones
        </button>
        <button
          onClick={() =>
            void platformRequest(base + '/runs')
              .then(setDetails)
              .catch((e: Error) => setError(e.message))
          }
        >
          Ver últimas ejecuciones
        </button>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>Contrato de ejecución</summary>
        <pre>{'POST /api/v1' + base + '/execute'}</pre>
        <pre>
          {JSON.stringify(
            {
              operationId: 'UUID nuevo por intención; conservarlo al reintentar',
              version: operation.publishedVersion,
              input: Object.fromEntries(
                (
                  operation.versions.find((v) => v.version === operation.publishedVersion)
                    ?.inputs ?? []
                ).map((field) => [
                  field.key,
                  field.type === 'money' ? 'centavos enteros' : field.type,
                ]),
              ),
            },
            null,
            2,
          )}
        </pre>
      </details>
      {details !== undefined && (
        <details open>
          <summary>Detalle del servicio</summary>
          <pre>{JSON.stringify(details, null, 2)}</pre>
        </details>
      )}
    </article>
  );
}
function OperationSimulation({
  projectId,
  operation,
  onClose,
}: {
  projectId: string;
  operation: OperationSummary;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
      initialServiceValues(operation.draft.inputs),
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<OperationResult>();
  return (
    <div className="modal-backdrop">
      <section
        className="modal service-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulation-title"
      >
        <h2 id="simulation-title">Simular {operation.draft.name}</h2>
        <p>
          La simulación ejecuta el borrador y revierte todos sus cambios. No guarda registros,
          auditoría ni ejecuciones confirmadas.
        </p>
        <form
          aria-label="Simular servicio"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setResult(undefined);
            try {
              const input = parseServiceValues(operation.draft.inputs, values);
              setResult(
                await platformRequest<OperationResult>(
                  '/projects/' + projectId + '/operations/' + operation.id + '/simulate',
                  { method: 'POST', body: JSON.stringify({ revision: operation.revision, input }) },
                ),
              );
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ServiceInputs
            projectId={projectId}
            operationId={operation.id}
            version={0}
            fields={operation.draft.inputs}
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
              Cerrar simulación
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Simulando…' : 'Ejecutar simulación'}
            </button>
          </div>
        </form>
        {result && (
          <div className="service-response">
            <p role="status">Simulación completada. Ningún cambio fue guardado.</p>
            <pre>{JSON.stringify(result.output, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
