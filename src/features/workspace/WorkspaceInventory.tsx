import { useEffect, useState } from 'react';
import type { InventoryConfig } from '../../models/inventory';
import { ApiError, platformRequest } from '../../services/platformHttp';
import { InventoryPanel } from '../../components/InventoryPanel';
import { DataProvider } from '../../components/dataComponents';
import { useWorkspace } from './WorkspaceContext';
import { useEntities } from './useEntities';
export function WorkspaceInventory() {
  const { project, refresh } = useWorkspace();
  const { entities } = useEntities(project.id);
  const [config, setConfig] = useState<InventoryConfig | null>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    platformRequest<InventoryConfig>('/projects/' + project.id + '/inventory/config', {
      signal: controller.signal,
    })
      .then(setConfig)
      .catch((e: Error) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 404) setConfig(null);
        else setError(e.message);
      });
    return () => controller.abort();
  }, [project.id]);
  const entity =
    entities.find((e) => e.id === selected) ??
    entities.find((e) => e.key === 'productos') ??
    entities[0];
  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">EL DÍA A DÍA DE TU NEGOCIO</span>
          <h1>Mi inventario</h1>
          <p>
            Consulta tus existencias y registra lo que entra o sale. Cada movimiento queda guardado.
          </p>
        </div>
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {config === undefined ? (
        <p role="status">Comprobando configuración…</p>
      ) : config ? (
        <DataProvider projectId={project.id} entities={entities} canWrite={false}>
          <InventoryPanel
            node={{
              id: 'workspace-inventory',
              type: 'Inventory',
              props: { title: 'Existencias y movimientos' },
            }}
          />
        </DataProvider>
      ) : (
        <section className="workspace-section">
          <h2>Conecta tu catálogo de productos</h2>
          <p>
            Las existencias comienzan en cero. El primer saldo se registra como una entrada o
            ajuste; los productos actuales se conservan. La conexión se mantiene para proteger el
            historial.
          </p>
          {project.role !== 'owner' ? (
            <p>El propietario debe activar el inventario.</p>
          ) : !entity ? (
            <p>Primero crea tus entidades en Datos o usa la plantilla de inventario.</p>
          ) : (
            <form
              key={entity.id}
              className="inventory-setup"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setError('');
                const data = Object.fromEntries(new FormData(event.currentTarget));
                try {
                  const result = await platformRequest<InventoryConfig>(
                    '/projects/' + project.id + '/inventory/config',
                    {
                      method: 'POST',
                      body: JSON.stringify({
                        entityId: entity.id,
                        nameField: data.nameField,
                        ...(data.skuField ? { skuField: data.skuField } : {}),
                        ...(data.unitField ? { unitField: data.unitField } : {}),
                      }),
                    },
                  );
                  setConfig(result);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Entidad de productos
                <select
                  aria-label="Entidad del inventario"
                  value={entity.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Campo del nombre
                <select name="nameField" required defaultValue={entity.labelField}>
                  {entity.fields
                    .filter((f) => f.type === 'text')
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Campo de SKU
                <select
                  name="skuField"
                  defaultValue={
                    entity.fields.some((f) => f.key === 'sku' && f.type === 'text') ? 'sku' : ''
                  }
                >
                  <option value="">Sin SKU</option>
                  {entity.fields
                    .filter((f) => f.type === 'text')
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Campo de unidad
                <select
                  name="unitField"
                  defaultValue={
                    entity.fields.some((f) => f.key === 'unidad' && f.type === 'relation')
                      ? 'unidad'
                      : ''
                  }
                >
                  <option value="">Sin unidad relacionada</option>
                  {entity.fields
                    .filter((f) => f.type === 'relation')
                    .map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="primary"
                disabled={busy || !entity.fields.some((f) => f.type === 'text')}
              >
                {busy ? 'Activando…' : 'Activar inventario'}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
