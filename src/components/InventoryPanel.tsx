import { usePendingOperation } from '../services/usePendingOperation';
import { useEffect, useState, type FormEvent } from 'react';
import type { ComponentNode } from '../models/contracts';
import {
  movementInput,
  type InventoryRole,
  type StockItem,
  type StockList,
  type MovementInput,
  type Movement,
  type MovementList,
} from '../models/inventory';
import { useDataContext } from './dataComponents';
import { platformRequest } from '../services/platformHttp';
const operationLabel = { entry: 'Entrada', exit: 'Salida', adjust: 'Ajuste' };
export function InventoryPanel({ node }: { node: ComponentNode }) {
  const context = useDataContext();
  const projectId = context?.projectId;
  const [access, setAccess] = useState<{ role: InventoryRole; userId: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    platformRequest<{ role: InventoryRole; userId: string }>(
      '/projects/' + projectId + '/inventory/access',
      { signal: controller.signal },
    )
      .then((value) => {
        setAccess(value);
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [projectId]);
  if (!context)
    return (
      <div className="data-empty">Este componente requiere un proyecto con inventario activo.</div>
    );
  if (error)
    return (
      <section className="data-panel" role="alert">
        {error}
      </section>
    );
  if (!access) return <p role="status">Comprobando acceso al inventario…</p>;
  return (
    <InventoryBody
      key={projectId + ':' + access.userId}
      projectId={context.projectId}
      preview={context.preview}
      contextVersion={context.version}
      access={access}
      title={String(node.props.title || 'Inventario')}
    />
  );
}
function InventoryBody({
  projectId,
  preview,
  contextVersion,
  access,
  title,
}: {
  projectId: string;
  preview: boolean;
  contextVersion: number;
  access: { role: InventoryRole; userId: string };
  title: string;
}) {
  const base = '/projects/' + projectId + '/inventory';
  const storageKey = 'ab.movement.' + projectId + '.' + access.userId;
  const [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [low, setLow] = useState(false),
    [inactive, setInactive] = useState(false),
    [selected, setSelected] = useState('');
  const [filters, setFilters] = useState({
    productId: '',
    type: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
  });
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<{
    stock: StockList;
    history: MovementList;
    actors: { id: string; name: string }[];
    key: string;
  }>();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const key = JSON.stringify({ query, page, low, inactive, filters, version, contextVersion });
  useEffect(() => {
    const controller = new AbortController();
    const state = JSON.parse(key);
    const stockParams = new URLSearchParams({
      q: state.query,
      page: String(state.page),
      pageSize: '10',
      lowOnly: String(state.low),
      includeInactive: String(state.inactive),
    });
    const historyParams = new URLSearchParams({
      ...state.filters,
      page: String(state.filters.page),
      pageSize: '10',
    });
    Promise.all([
      platformRequest<StockList>(base + '/stock?' + stockParams, { signal: controller.signal }),
      platformRequest<MovementList>(base + '/movements?' + historyParams, {
        signal: controller.signal,
      }),
      platformRequest<{ id: string; name: string }[]>(base + '/actors', {
        signal: controller.signal,
      }),
    ])
      .then(([stock, history, actors]) => {
        setData({ stock, history, actors, key });
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [base, key]);
  const refresh = () => setVersion((v) => v + 1);
  const admin = access.role === 'admin',
    canMove = access.role !== 'viewer' && !preview;
  const product = data?.stock.items.find((r) => r.id === selected);
  const { pending, execute } = usePendingOperation<
    MovementInput,
    { movement: Movement; replayed: boolean }
  >({
    storageKey,
    schema: movementInput,
    allowed: canMove && !busy,
    request: (input, signal) =>
      platformRequest(base + '/movements', { method: 'POST', body: JSON.stringify(input), signal }),
    onStart: () => {
      setBusy(true);
      setError('');
      setMessage('');
    },
    onSuccess: (result) => {
      setMessage(
        (result.replayed ? 'Movimiento ya registrado.' : 'Movimiento registrado.') +
          ' Saldo confirmado: ' +
          result.movement.after,
      );
      refresh();
    },
    onError: (error) => setError(error.message),
    onFinally: () => setBusy(false),
  });
  const waiting = busy || !!pending || (data !== undefined && data.key !== key);
  async function changeProduct(path: string, input: unknown) {
    if (waiting || preview) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await platformRequest(base + '/products/' + path, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      setMessage('Producto actualizado.');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const setFilter = (name: keyof typeof filters, value: string) =>
    setFilters((old) => ({ ...old, [name]: value, page: 1 }));
  return (
    <div className="inventory-panel">
      <div className="inventory-title">
        <h2>{title}</h2>
        <span className="badge">
          {admin
            ? 'Administrador de inventario'
            : access.role === 'operator'
              ? 'Operador'
              : 'Consulta'}
        </span>
        <button disabled={busy} onClick={refresh}>
          Actualizar inventario
        </button>
      </div>
      {preview && (
        <p className="data-hint">
          Vista previa: puedes consultar el inventario. Los movimientos se registran desde la
          aplicación publicada.
        </p>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="data-success">
          {message}
        </p>
      )}
      {pending?.uncertain && (
        <section className="inventory-recovery" role="status">
          <strong>Hay un movimiento pendiente de confirmar</strong>
          <p>
            Reintentar consultará la misma operación y evitará duplicarla, incluso si ya se
            registró. Se conserva al recargar esta pestaña.
          </p>
          <button
            className="primary"
            disabled={busy || !canMove}
            onClick={() => void execute(pending.input, true)}
          >
            {busy ? 'Confirmando…' : 'Reintentar movimiento pendiente'}
          </button>
        </section>
      )}
      {!data ? (
        <p role="status">Cargando inventario…</p>
      ) : (
        <>
          <section className="data-panel">
            <h3>Existencias</h3>
            <div className="data-filters">
              <input
                type="search"
                aria-label="Buscar producto"
                placeholder="Nombre o SKU…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <label className="inventory-check">
                <input
                  type="checkbox"
                  checked={low}
                  onChange={(e) => {
                    setLow(e.target.checked);
                    setPage(1);
                  }}
                />
                Solo bajo mínimo
              </label>
              <label className="inventory-check">
                <input
                  type="checkbox"
                  checked={inactive}
                  onChange={(e) => {
                    setInactive(e.target.checked);
                    setPage(1);
                  }}
                />
                Incluir inactivos
              </label>
            </div>
            {data.key !== key && <p role="status">Actualizando inventario…</p>}
            {!data.stock.items.length ? (
              <p className="data-empty">No hay productos para esta consulta.</p>
            ) : (
              <div className="table-scroll">
                <table aria-label="Existencias de inventario">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>SKU</th>
                      <th>Unidad</th>
                      <th>Existencias</th>
                      <th>Mínimo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stock.items.map((item) => (
                      <tr key={item.id} className={item.belowMinimum ? 'inventory-low' : ''}>
                        <td>{item.name}</td>
                        <td>{item.sku || '—'}</td>
                        <td>{item.unit || '—'}</td>
                        <td>{item.balance}</td>
                        <td>{item.minimum}</td>
                        <td>
                          {!item.active ? 'Inactivo' : item.belowMinimum ? 'Bajo mínimo' : 'Activo'}
                        </td>
                        <td>
                          <div className="actions">
                            <button
                              disabled={waiting}
                              onClick={() => {
                                setSelected(item.id);
                                setMessage('');
                              }}
                            >
                              Seleccionar {item.name}
                            </button>
                            {admin && !preview && (
                              <button
                                disabled={waiting}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      (item.active ? 'Desactivar' : 'Reactivar') +
                                        ' ' +
                                        item.name +
                                        ' y conservar sus movimientos?',
                                    )
                                  )
                                    void changeProduct(item.id + '/status', {
                                      active: !item.active,
                                      revision: item.revision,
                                    });
                                }}
                              >
                                {item.active ? 'Desactivar' : 'Reactivar'} {item.name}
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
            <div className="data-pagination">
              <span>
                {data.stock.total} productos · Página {data.stock.page}
              </span>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Productos anteriores
              </button>
              <button
                disabled={page * data.stock.pageSize >= data.stock.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Productos siguientes
              </button>
            </div>
          </section>
          {product && (
            <div className="inventory-product-grid">
              {canMove && (
                <MovementForm
                  key={product.id + ':' + product.balance + ':' + product.revision}
                  product={product}
                  admin={admin}
                  disabled={waiting}
                  onSubmit={(input) => void execute(input)}
                />
              )}
              {admin && !preview && (
                <MinimumForm
                  key={'min' + product.id + ':' + product.minimumRevision}
                  product={product}
                  disabled={waiting}
                  onSubmit={(minimum) =>
                    void changeProduct(product.id + '/minimum', {
                      minimum,
                      revision: product.minimumRevision,
                    })
                  }
                />
              )}
            </div>
          )}
          <section className="data-panel">
            <h3>Historial de movimientos</h3>
            <div className="inventory-history-filters">
              <label>
                Producto
                <select
                  aria-label="Producto del historial"
                  value={filters.productId}
                  onChange={(e) => setFilter('productId', e.target.value)}
                >
                  <option value="">Todos los productos</option>
                  {Array.from(
                    new Map([
                      ...data.stock.items.map((r) => [r.id, r.name] as const),
                      ...data.history.items.map((m) => [m.productId, m.productName] as const),
                    ]).entries(),
                  ).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                  {filters.productId &&
                    !data.stock.items.some((r) => r.id === filters.productId) &&
                    !data.history.items.some((m) => m.productId === filters.productId) && (
                      <option value={filters.productId}>Producto seleccionado</option>
                    )}
                </select>
              </label>
              <label>
                Tipo
                <select
                  aria-label="Tipo del historial"
                  value={filters.type}
                  onChange={(e) => setFilter('type', e.target.value)}
                >
                  <option value="">Todos los tipos</option>
                  {Object.entries(operationLabel).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Usuario
                <select
                  aria-label="Usuario del historial"
                  value={filters.actorId}
                  onChange={(e) => setFilter('actorId', e.target.value)}
                >
                  <option value="">Todos los usuarios</option>
                  {data.actors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Desde
                <input
                  type="date"
                  aria-label="Historial desde"
                  value={filters.from}
                  onChange={(e) => setFilter('from', e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  aria-label="Historial hasta"
                  value={filters.to}
                  onChange={(e) => setFilter('to', e.target.value)}
                />
              </label>
            </div>
            <p className="data-hint">
              Las fechas corresponden al día UTC del servidor. Los movimientos confirmados se
              conservan; las correcciones se registran como ajustes.
            </p>
            {!data.history.items.length ? (
              <p className="data-empty">No hay movimientos para estos filtros.</p>
            ) : (
              <div className="table-scroll">
                <table aria-label="Historial de inventario">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Tipo</th>
                      <th>Variación</th>
                      <th>Saldo anterior</th>
                      <th>Saldo resultante</th>
                      <th>Motivo</th>
                      <th>Usuario</th>
                      <th>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.items.map((m) => (
                      <tr key={m.id}>
                        <td>{new Date(m.createdAt).toLocaleString()}</td>
                        <td>{m.productName}</td>
                        <td>{operationLabel[m.type]}</td>
                        <td>
                          {m.delta > 0 ? '+' : ''}
                          {m.delta}
                        </td>
                        <td>{m.before}</td>
                        <td>{m.after}</td>
                        <td>{m.reason}</td>
                        <td>{m.actorName}</td>
                        <td>
                          <details>
                            <summary>Ver identificación</summary>
                            <small>Movimiento: {m.id}</small>
                            {m.referenceId && <p>Corrige: {m.referenceId}</p>}
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="data-pagination">
              <span>
                {data.history.total} movimientos · Página {data.history.page}
              </span>
              <button
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Movimientos anteriores
              </button>
              <button
                disabled={filters.page * data.history.pageSize >= data.history.total}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Movimientos siguientes
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function MovementForm({
  product,
  admin,
  disabled,
  onSubmit,
}: {
  product: StockItem;
  admin: boolean;
  disabled: boolean;
  onSubmit: (input: MovementInput) => void;
}) {
  const [type, setType] = useState<MovementInput['type']>(product.active ? 'entry' : 'adjust'),
    [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = String(data.get('quantity'));
    if (!/^[+-]?\d+$/.test(raw)) {
      setError('Introduce una cantidad entera, sin decimales');
      return;
    }
    const result = movementInput.safeParse({
      operationId: crypto.randomUUID(),
      productId: product.id,
      type,
      quantity: Number(raw),
      reason: data.get('reason'),
      ...(type === 'adjust'
        ? {
            expectedBalance: product.balance,
            ...(data.get('referenceId') ? { referenceId: String(data.get('referenceId')) } : {}),
          }
        : {}),
    });
    if (!result.success) {
      setError(result.error.issues.map((e) => e.message).join('; '));
      return;
    }
    setError('');
    onSubmit(result.data);
  }
  return (
    <section className="data-panel">
      <h3>Registrar movimiento · {product.name}</h3>
      <p>
        Saldo observado: <strong>{product.balance}</strong>
        {product.unit ? ' ' + product.unit : ''}
        {!product.active ? ' · Producto inactivo' : ''}
      </p>
      <form aria-label="Registrar movimiento" onSubmit={submit}>
        <label>
          Tipo de movimiento
          <select
            value={type}
            disabled={disabled}
            onChange={(e) => setType(e.target.value as MovementInput['type'])}
          >
            {product.active && (
              <>
                <option value="entry">Entrada</option>
                <option value="exit">Salida</option>
              </>
            )}
            {admin && <option value="adjust">Ajuste</option>}
          </select>
        </label>
        <label>
          {type === 'adjust' ? 'Variación del ajuste' : 'Cantidad'}
          <input
            name="quantity"
            aria-label="Cantidad del movimiento"
            inputMode="numeric"
            required
            disabled={disabled}
            placeholder={type === 'adjust' ? 'Por ejemplo, -2 o 3' : 'Unidades enteras'}
          />
        </label>
        <label>
          Motivo
          <input name="reason" required minLength={3} maxLength={500} disabled={disabled} />
        </label>
        {type === 'adjust' && (
          <>
            <p className="data-hint">
              Indica la diferencia que se sumará o restará. El servidor comprobará que el saldo
              observado sigue vigente.
            </p>
            <label>
              Movimiento corregido (opcional)
              <input
                name="referenceId"
                disabled={disabled}
                placeholder="Copia el identificador desde el historial"
              />
            </label>
          </>
        )}
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={disabled || (!product.active && !admin)}>
          Confirmar {operationLabel[type].toLowerCase()}
        </button>
      </form>
    </section>
  );
}
function MinimumForm({
  product,
  disabled,
  onSubmit,
}: {
  product: StockItem;
  disabled: boolean;
  onSubmit: (minimum: number) => void;
}) {
  const [error, setError] = useState('');
  return (
    <section className="data-panel">
      <h3>Mínimo · {product.name}</h3>
      <p>El aviso aparece cuando las existencias son menores que el mínimo.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const raw = String(new FormData(e.currentTarget).get('minimum'));
          if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
            setError('Usa un entero no negativo');
            return;
          }
          setError('');
          onSubmit(Number(raw));
        }}
      >
        <label>
          Mínimo de existencias
          <input
            name="minimum"
            inputMode="numeric"
            required
            defaultValue={product.minimum}
            disabled={disabled}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={disabled}>Guardar mínimo</button>
      </form>
    </section>
  );
}
