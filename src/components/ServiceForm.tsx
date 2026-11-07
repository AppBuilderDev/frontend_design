import { useEffect, useState, type FormEvent } from 'react';
import type { ComponentNode } from '../models/contracts';
import {
  executionInputSchema,
  type OperationContract,
  type OperationResult,
} from '../models/operations';
import { useDataContext } from './dataComponents';
import {
  ServiceInputs,
  initialServiceValues,
  parseServiceValues,
  serviceErrorMessage,
} from './ServiceInputs';
import { platformRequest } from '../services/platformHttp';
import { usePendingOperation } from '../services/usePendingOperation';
export function ServiceForm({ node }: { node: ComponentNode }) {
  const context = useDataContext();
  const contract = context?.operations.find((o) => o.id === node.props.operationId);
  if (!context || !contract)
    return (
      <div className="data-empty">Selecciona un servicio publicado en Conexión de servicio.</div>
    );
  return (
    <BoundServiceForm
      key={contract.id + ':' + contract.version}
      node={node}
      projectId={context.projectId}
      preview={context.preview}
      contract={contract}
      onSuccess={context.refresh}
    />
  );
}
function BoundServiceForm({
  node,
  projectId,
  preview,
  contract,
  onSuccess,
}: {
  node: ComponentNode;
  projectId: string;
  preview: boolean;
  contract: OperationContract;
  onSuccess: () => void;
}) {
  const [access, setAccess] = useState<{ canExecute: boolean; userId: string }>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    platformRequest<{ canExecute: boolean; userId: string }>(
      '/projects/' +
        projectId +
        '/operations/' +
        contract.id +
        '/access?version=' +
        contract.version,
      { signal: controller.signal },
    )
      .then(setAccess)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [preview, projectId, contract.id, contract.version]);
  return (
    <section className="data-panel service-form">
      <h3>{String(node.props.title || contract.name)}</h3>
      <small>Versión {contract.version}</small>
      {preview ? (
        <p className="data-hint">
          Vista previa del servicio publicado. La ejecución está desactivada.
        </p>
      ) : error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : !access ? (
        <p role="status">Comprobando permiso del servicio…</p>
      ) : !access.canExecute ? (
        <p>Tu permiso actual no permite ejecutar este servicio.</p>
      ) : null}
      {(preview || access?.canExecute) && (
        <ServiceRun
          key={access?.userId ?? 'preview'}
          projectId={projectId}
          contract={contract}
          actorId={access?.userId ?? ''}
          preview={preview}
          onSuccess={onSuccess}
          label={String(node.props.buttonText || 'Ejecutar servicio')}
        />
      )}
    </section>
  );
}
function ServiceRun({
  projectId,
  contract,
  actorId,
  preview,
  onSuccess,
  label,
}: {
  projectId: string;
  contract: OperationContract;
  actorId: string;
  preview: boolean;
  onSuccess: () => void;
  label: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    initialServiceValues(contract.inputs),
  );
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<OperationResult>();
  const request = usePendingOperation({
    storageKey:
      'ab.service.' + projectId + '.' + actorId + '.' + contract.id + '.' + contract.version,
    schema: executionInputSchema,
    allowed: !preview && !busy,
    request: (input, signal) =>
      platformRequest<OperationResult>(
        '/projects/' + projectId + '/operations/' + contract.id + '/execute',
        { method: 'POST', body: JSON.stringify(input), signal },
      ),
    onStart: () => {
      setError('');
      setBusy(true);
      setResult(undefined);
    },
    onSuccess: (result) => {
      setResult(result);
      setValues(initialServiceValues(contract.inputs));
      onSuccess();
    },
    onError: (e) => setError(serviceErrorMessage(e, contract.inputs)),
    onFinally: () => setBusy(false),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const input = parseServiceValues(contract.inputs, values);
      void request.execute({ operationId: crypto.randomUUID(), version: contract.version, input });
    } catch (error) {
      setError(serviceErrorMessage(error, contract.inputs));
    }
  }
  return (
    <>
      <form aria-label={'Ejecutar ' + contract.name} onSubmit={submit}>
        <ServiceInputs
          projectId={projectId}
          operationId={contract.id}
          version={contract.version}
          fields={contract.inputs}
          values={values}
          disabled={preview || busy || !!request.pending}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={preview || busy || !!request.pending}>
          {busy ? 'Ejecutando…' : label}
        </button>
      </form>
      {request.pending?.uncertain && (
        <div className="inventory-recovery" role="status">
          <strong>Hay una ejecución pendiente de confirmar.</strong>
          <p>
            Se conserva al recargar esta pestaña. Reintentar confirma la misma solicitud sin
            duplicarla.
          </p>
          <button
            disabled={busy || preview}
            onClick={() => void request.execute(request.pending!.input, true)}
          >
            Reintentar ejecución pendiente
          </button>
        </div>
      )}
      {result && (
        <div className="service-result">
          <p role="status" className="data-success">
            {result.replayed ? 'La ejecución ya estaba confirmada.' : 'Servicio ejecutado.'}
          </p>
          <dl>
            {Object.entries(result.output).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/_/g, ' ')}</dt>
                <dd>
                  {value === null
                    ? '—'
                    : typeof value === 'boolean'
                      ? value
                        ? 'Sí'
                        : 'No'
                      : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
