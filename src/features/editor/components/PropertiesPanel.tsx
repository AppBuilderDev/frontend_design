import { CatalogProperties } from './CatalogProperties';
import { componentLabels } from '../config/labels';
import { useDataContext } from '../../../components/dataComponents';
import { StyleControls } from './StyleControls';
import { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Layers,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronLeft,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
interface Props {
  node?: ComponentNode;
  containers: ComponentNode[];
  onProperty: (key: string, value: string) => void;
  onReorder: (offset: number) => void;
  onMove: (parent: string) => void;
  onDelete: () => void;
  onClose?: () => void;
  mobileDismissed?: boolean;
}
export function PropertiesPanel({
  node,
  containers,
  onProperty: prop,
  onReorder,
  onMove,
  onDelete,
  onClose,
  mobileDismissed = false,
}: Props) {
  const [destination, setDestination] = useState('');
  const data = useDataContext();
  const [advanced, setAdvanced] = useState(false);
  const hasQuickOptions = !!node && ['Heading', 'Paragraph', 'Button'].includes(node.type);
  if (node && hasQuickOptions && !advanced)
    return (
      <aside
        className={'editor-right quick-properties' + (mobileDismissed ? ' mobile-dismissed' : '')}
        aria-label="Propiedades del elemento"
      >
        <div className="studio-panel-heading">
          <h2>{componentLabels[node.type] ?? node.type}</h2>
          <button className="mobile-panel-close" aria-label="Cerrar propiedades" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="properties">
          <label>
            Texto
            <textarea
              aria-label="Texto"
              rows={2}
              value={String(node.props.text ?? '')}
              onChange={(event) => prop('text', event.target.value)}
            />
          </label>
          <label>
            Tamaño
            <select
              aria-label="Tamaño del texto seleccionado"
              value={String(node.props.fontSize ?? (node.type === 'Heading' ? '32px' : '16px'))}
              onChange={(event) => prop('fontSize', event.target.value)}
            >
              {[
                ...new Set([
                  String(node.props.fontSize ?? (node.type === 'Heading' ? '32px' : '16px')),
                  ...[12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64].map((size) => size + 'px'),
                ]),
              ].map((size) => (
                <option key={size} value={size}>
                  {size.replace('px', '')} px
                </option>
              ))}
            </select>
          </label>
          <div className="classic-text-format" role="toolbar" aria-label="Formato del texto">
            <button
              aria-label="Negrita"
              aria-pressed={
                Number(node.props.fontWeight ?? (node.type === 'Heading' ? '700' : '400')) >= 600 ||
                node.props.fontWeight === 'bold'
              }
              onClick={() =>
                prop(
                  'fontWeight',
                  Number(node.props.fontWeight ?? (node.type === 'Heading' ? '700' : '400')) >=
                    600 || node.props.fontWeight === 'bold'
                    ? '400'
                    : '700',
                )
              }
            >
              <Bold size={16} />
            </button>
            <button
              aria-label="Cursiva"
              aria-pressed={node.props.fontStyle === 'italic'}
              onClick={() =>
                prop('fontStyle', node.props.fontStyle === 'italic' ? 'normal' : 'italic')
              }
            >
              <Italic size={16} />
            </button>
            <button
              aria-label="Subrayado"
              aria-pressed={node.props.textDecoration === 'underline'}
              onClick={() =>
                prop(
                  'textDecoration',
                  node.props.textDecoration === 'underline' ? 'none' : 'underline',
                )
              }
            >
              <Underline size={16} />
            </button>
          </div>
          <section className="quick-appearance">
            <h3>Apariencia</h3>
            <label>
              Color de texto
              <div className="quick-color">
                <input
                  type="color"
                  aria-label="Elegir color de texto"
                  value={
                    /^#[0-9a-f]{6}$/i.test(String(node.props.color))
                      ? String(node.props.color)
                      : '#111827'
                  }
                  onChange={(event) => prop('color', event.target.value)}
                />
                <input
                  aria-label="Color de texto"
                  value={String(node.props.color ?? '')}
                  placeholder="#111827"
                  onChange={(event) => prop('color', event.target.value)}
                />
              </div>
            </label>
            <span className="quick-field-label">Alineación</span>
            <div className="quick-alignment">
              {[
                { value: 'left', label: 'Alinear a la izquierda', Icon: AlignLeft },
                { value: 'center', label: 'Centrar texto', Icon: AlignCenter },
                { value: 'right', label: 'Alinear a la derecha', Icon: AlignRight },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  aria-label={label}
                  aria-pressed={(node.props.textAlign ?? 'left') === value}
                  onClick={() => prop('textAlign', value)}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </section>
          <button className="all-properties" onClick={() => setAdvanced(true)}>
            Todas las opciones
          </button>
        </div>
      </aside>
    );
  return (
    <aside className={'editor-right' + (mobileDismissed ? ' mobile-dismissed' : '')}>
      <div className="studio-panel-heading">
        <h2>{node ? (componentLabels[node.type] ?? node.type) : 'Personalizar'}</h2>
        {onClose && (
          <button className="mobile-panel-close" aria-label="Cerrar propiedades" onClick={onClose}>
            <X size={17} />
          </button>
        )}
      </div>
      {node ? (
        <div className="properties">
          {hasQuickOptions && (
            <button className="all-properties" onClick={() => setAdvanced(false)}>
              <ChevronLeft size={15} /> Opciones básicas
            </button>
          )}
          <div className="selected-type">
            <Layers size={18} />
            <strong>{componentLabels[node.type] ?? node.type}</strong>
          </div>
          {['Heading', 'Paragraph', 'Button'].includes(node.type) && (
            <label>
              Texto
              <textarea
                aria-label="Texto"
                rows={4}
                value={String(node.props.text ?? '')}
                onChange={(e) => prop('text', e.target.value)}
              />
            </label>
          )}
          {node.type === 'Heading' && (
            <label>
              Nivel
              <select
                value={String(node.props.level ?? 'h1')}
                onChange={(e) => prop('level', e.target.value)}
              >
                {[
                  ['h1', 'Título principal'],
                  ['h2', 'Título de sección'],
                  ['h3', 'Subtítulo'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {['Card', 'Inventory'].includes(node.type) && (
            <label>
              Título
              <input
                value={String(node.props.title ?? '')}
                onChange={(e) => prop('title', e.target.value)}
              />
            </label>
          )}
          {node.type === 'Button' && (
            <label>
              Enlace
              <input
                placeholder="/inicio o https://..."
                value={String(node.props.href ?? '')}
                onChange={(e) => prop('href', e.target.value)}
              />
            </label>
          )}
          {node.type === 'Input' && (
            <>
              {[
                ['label', 'Etiqueta'],
                ['placeholder', 'Texto de ejemplo'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={String(node.props[key] ?? '')}
                    onChange={(e) => prop(key, e.target.value)}
                  />
                </label>
              ))}
              <label>
                Tipo de entrada
                <select
                  value={String(node.props.inputType ?? 'text')}
                  onChange={(e) => prop('inputType', e.target.value)}
                >
                  {['text', 'email', 'number', 'password'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {node.type === 'RestTable' && (
            <>
              <div className="panel-heading" data-kind="data">
                Servicios HTTP
              </div>
              {[
                ['listEndpointId', 'Ruta GET', ['GET']],
                ['createEndpointId', 'Ruta POST', ['POST']],
                ['updateEndpointId', 'Ruta PUT o PATCH', ['PUT', 'PATCH']],
                ['deleteEndpointId', 'Ruta DELETE', ['DELETE']],
              ].map(([key, label, methods]) => (
                <label key={String(key)}>
                  {String(label)}
                  <select
                    aria-label={String(label)}
                    value={String(node.props[String(key)] ?? '')}
                    onChange={(e) => prop(String(key), e.target.value)}
                  >
                    <option value="">Sin vincular</option>
                    {data?.endpoints
                      .filter((e) => (methods as string[]).includes(e.method))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} - {e.method}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <label>
                Titulo de tabla
                <input
                  value={String(node.props.title ?? '')}
                  onChange={(e) => prop('title', e.target.value)}
                />
              </label>
              <small>
                Administra las definiciones en Rutas y endpoints. Publicar captura sus contratos.
              </small>
            </>
          )}
          {['DataForm', 'DataTable', 'DataDetail'].includes(node.type) && (
            <>
              <div className="panel-heading" data-kind="data">
                Conexión de datos
              </div>
              <label>
                Entidad
                <select
                  aria-label="Entidad conectada"
                  value={String(node.props.entityId ?? '')}
                  onChange={(e) => prop('entityId', e.target.value)}
                >
                  <option value="">Seleccionar entidad</option>
                  {data?.entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título
                <input
                  value={String(node.props.title ?? '')}
                  onChange={(e) => prop('title', e.target.value)}
                />
              </label>
              {node.type === 'DataForm' && (
                <label>
                  Operación
                  <select
                    aria-label="Operación del formulario"
                    value={String(node.props.action ?? 'create')}
                    onChange={(e) => prop('action', e.target.value)}
                  >
                    <option value="create">Crear registro</option>
                    <option value="update">Editar selección del listado</option>
                  </select>
                </label>
              )}
              <small>
                El servicio se resuelve por la entidad de este proyecto. En el editor no se
                modifican registros.
              </small>
            </>
          )}
          {node.type === 'ServiceForm' && (
            <>
              <div className="panel-heading" data-kind="data">
                Conexión de servicio
              </div>
              <label>
                Servicio publicado
                <select
                  aria-label="Servicio conectado"
                  value={String(node.props.operationId ?? '')}
                  onChange={(e) => prop('operationId', e.target.value)}
                >
                  <option value="">Seleccionar servicio…</option>
                  {data?.operations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} · v{o.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título del formulario
                <input
                  value={String(node.props.title ?? '')}
                  onChange={(e) => prop('title', e.target.value)}
                />
              </label>
              <label>
                Texto del botón
                <input
                  value={String(node.props.buttonText ?? 'Ejecutar servicio')}
                  onChange={(e) => prop('buttonText', e.target.value)}
                />
              </label>
              <small>
                Publicar captura la versión predeterminada del servicio. El borrador y la vista
                previa no ejecutan escrituras.
              </small>
            </>
          )}
          {node.type === 'ApiQuery' && (
            <>
              <div className="panel-heading" data-kind="data">
                Conexión externa
              </div>
              <label>
                Conexión publicada
                <select
                  aria-label="Conexión externa seleccionada"
                  value={String(node.props.connectionId ?? '')}
                  onChange={(e) => prop('connectionId', e.target.value)}
                >
                  <option value="">Seleccionar conexión…</option>
                  {data?.connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · v{c.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Título de consulta
                <input
                  value={String(node.props.title ?? '')}
                  onChange={(e) => prop('title', e.target.value)}
                />
              </label>
              <label>
                Texto para consultar
                <input
                  value={String(node.props.buttonText ?? 'Consultar')}
                  onChange={(e) => prop('buttonText', e.target.value)}
                />
              </label>
              <small>
                Runtime consulta producción a través del backend. La vista previa no realiza
                consultas externas.
              </small>
            </>
          )}
          <CatalogProperties node={node} onChange={prop} />
          <StyleControls node={node} onChange={prop} />
          <div className="panel-heading">Organizar</div>
          <div className="actions">
            <button aria-label="Subir componente" onClick={() => onReorder(-1)}>
              <ChevronUp size={17} />
            </button>
            <button aria-label="Bajar componente" onClick={() => onReorder(1)}>
              <ChevronDown size={17} />
            </button>
            <button aria-label="Eliminar componente" onClick={onDelete}>
              <Trash2 size={17} />
            </button>
          </div>
          <label>
            Mover a
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">Nivel raíz</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type} · {c.id.slice(0, 6)}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => onMove(destination)}>Mover componente</button>
          <small>
            Arrastra desde el tirador del lienzo para mover. También puedes usar las flechas o
            elegir un destino.
          </small>
        </div>
      ) : (
        <div className="empty p-6">
          <Layers size={28} className="mx-auto mb-4" />
          <p>
            Haz clic en un elemento de tu página para cambiar su texto, colores y tamaño. También
            puedes seleccionarlo en la estructura de la izquierda.
          </p>
        </div>
      )}
    </aside>
  );
}
