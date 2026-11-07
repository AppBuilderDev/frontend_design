import { InventoryServices } from './InventoryServices';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from './WorkspaceContext';
import { useEntities } from './useEntities';
import { platformRequest } from '../../services/platformHttp';
export function WorkspaceServices() {
  const { project } = useWorkspace();
  const { entities, error } = useEntities(project.id);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState('');
  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <h1>Servicios propios</h1>
          <p>
            Cada entidad tiene operaciones validadas. Las páginas se conectan por identificador, sin
            guardar credenciales.
          </p>
        </div>
        <Link className="workspace-text-link" to="/workspace/data">
          Administrar entidades
        </Link>
      </div>
      <InventoryServices projectId={project.id} />
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {!entities.length && (
        <p className="workspace-empty">Crea una entidad en Datos para disponer de sus servicios.</p>
      )}
      {entities.map((entity) => (
        <section className="service-card" key={entity.id}>
          <div>
            <h2>{entity.name}</h2>
            <small>{entity.id}</small>
          </div>
          <div className="service-operations">
            {[
              ['GET', 'Listar y filtrar'],
              ['GET', 'Consultar por ID'],
              ['POST', 'Crear registro'],
              ['PUT', 'Actualizar con revisión'],
              ['DELETE', 'Desactivar conservando el registro'],
            ].map(([method, label], i) => (
              <span key={i}>
                <code>{method}</code>
                {label}
              </span>
            ))}
          </div>
          <details>
            <summary>Contrato y validaciones</summary>
            <pre>{'/api/v1/projects/' + project.id + '/services/' + entity.id + '/records'}</pre>
            <p>
              Entrada: valores declarados por la entidad. Los campos desconocidos se rechazan. Los
              números son enteros seguros y los importes se almacenan en centavos.
            </p>
            <pre>
              {JSON.stringify(
                { entityId: entity.id, labelField: entity.labelField, fields: entity.fields },
                null,
                2,
              )}
            </pre>
            <p>
              Listados: page, pageSize (máximo 100), q, sort y filter.identificador. Las
              modificaciones requieren permisos y la revisión vigente.
            </p>
          </details>
          <button
            disabled={!!busy}
            onClick={async () => {
              setBusy(entity.id);
              try {
                const data = await platformRequest(
                  '/projects/' + project.id + '/services/' + entity.id + '/records?pageSize=5',
                );
                setResult(JSON.stringify(data, null, 2));
              } catch (e) {
                setResult((e as Error).message);
              } finally {
                setBusy('');
              }
            }}
          >
            {busy === entity.id ? 'Consultando…' : 'Probar consulta de ' + entity.name}
          </button>
        </section>
      ))}
      {result && (
        <section className="service-response">
          <h2>Resultado de la consulta</h2>
          <pre>{result}</pre>
        </section>
      )}
    </main>
  );
}
