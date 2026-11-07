import { useEffect, useState, type FormEvent } from 'react';
import type { ComponentNode } from '../models/contracts';
import type { ConnectionContract, ConnectionResult } from '../models/connections';
import { useDataContext } from './dataComponents';
import {
  ServiceInputs,
  initialServiceValues,
  parseServiceValues,
  serviceErrorMessage,
} from './ServiceInputs';
import { platformRequest } from '../services/platformHttp';
import { ConnectionResults } from './ConnectionResults';
export function ApiQuery({ node }: { node: ComponentNode }) {
  const context = useDataContext(),
    contract = context?.connections.find((c) => c.id === node.props.connectionId);
  if (!context || !contract)
    return <div className="data-empty">Selecciona una conexión publicada en Conexión externa.</div>;
  return (
    <BoundQuery
      key={contract.id + ':' + contract.version}
      contract={contract}
      projectId={context.projectId}
      preview={context.preview}
      node={node}
    />
  );
}
function BoundQuery({
  contract,
  projectId,
  preview,
  node,
}: {
  contract: ConnectionContract;
  projectId: string;
  preview: boolean;
  node: ComponentNode;
}) {
  const [allowed, setAllowed] = useState<boolean>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    platformRequest<{ canQuery: boolean }>(
      '/projects/' +
        projectId +
        '/connections/' +
        contract.id +
        '/access?version=' +
        contract.version,
      { signal: controller.signal },
    )
      .then((r) => setAllowed(r.canQuery))
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [preview, projectId, contract.id, contract.version]);
  return (
    <section className="data-panel service-form">
      <h3>{String(node.props.title || contract.name)}</h3>
      {preview ? (
        <p className="data-hint">
          Vista previa. Las consultas externas se prueban desde Servicios; aquí no se consulta
          producción.
        </p>
      ) : error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : allowed === undefined ? (
        <p role="status">Comprobando acceso a la consulta…</p>
      ) : !allowed ? (
        <p>Tu permiso no permite consultar esta conexión.</p>
      ) : null}
      {(preview || allowed) && (
        <QueryForm
          contract={contract}
          projectId={projectId}
          preview={preview}
          label={String(node.props.buttonText || 'Consultar')}
        />
      )}
    </section>
  );
}
function QueryForm({
  contract,
  projectId,
  preview,
  label,
}: {
  contract: ConnectionContract;
  projectId: string;
  preview: boolean;
  label: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
      initialServiceValues(contract.inputs),
    ),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ConnectionResult>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || preview) return;
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const input = parseServiceValues(contract.inputs, values);
      setResult(
        await platformRequest<ConnectionResult>(
          '/projects/' + projectId + '/connections/' + contract.id + '/query',
          { method: 'POST', body: JSON.stringify({ version: contract.version, input }) },
        ),
      );
    } catch (e) {
      setError(serviceErrorMessage(e, contract.inputs));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form aria-label={'Consultar ' + contract.name} onSubmit={(e) => void submit(e)}>
        <ServiceInputs
          projectId={projectId}
          operationId={contract.id}
          version={contract.version}
          fields={contract.inputs}
          values={values}
          disabled={preview || busy}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
        <button className="primary" disabled={preview || busy}>
          {busy ? 'Consultando…' : label}
        </button>
      </form>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p role="status" className="data-success">
            Consulta completada.
          </p>
          <ConnectionResults fields={contract.fields} result={result} />
        </>
      )}
    </>
  );
}
