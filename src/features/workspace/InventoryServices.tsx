import { useEffect, useState } from 'react';
import { ApiError, platformRequest } from '../../services/platformHttp';
interface Operation {
  id: string;
  path: string;
  type: string;
  permission: string;
  steps: string[];
  input: Record<string, string>;
}
export function InventoryServices({ projectId }: { projectId: string }) {
  const [operations, setOperations] = useState<Operation[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    platformRequest<Operation[]>('/projects/' + projectId + '/inventory/operations', {
      signal: controller.signal,
    })
      .then(setOperations)
      .catch((e: Error) => {
        if (!controller.signal.aborted && (!(e instanceof ApiError) || e.status !== 404))
          setError(e.message);
      });
    return () => controller.abort();
  }, [projectId]);
  if (error)
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    );
  if (!operations.length) return null;
  return (
    <section className="service-card">
      <h2>Servicios transaccionales de inventario</h2>
      <p>
        Entradas, salidas y ajustes se confirman junto a su movimiento y auditoría. Un fallo
        revierte la operación completa. Cada intención utiliza un identificador único para que los
        reintentos no la dupliquen.
      </p>
      {operations.map((operation) => (
        <details key={operation.id}>
          <summary>
            {operation.type === 'entry'
              ? 'Entrada'
              : operation.type === 'exit'
                ? 'Salida'
                : 'Ajuste'}{' '}
            ·{' '}
            {operation.permission === 'admin'
              ? 'Administrador de inventario'
              : 'Operador o administrador'}
          </summary>
          <pre>{'POST ' + operation.path}</pre>
          <pre>{JSON.stringify({ input: operation.input, steps: operation.steps }, null, 2)}</pre>
        </details>
      ))}
      <p>
        La conexión al catálogo se configura en Inventario. Las reglas de disponibilidad, enteros y
        permisos se aplican en el servidor.
      </p>
    </section>
  );
}
