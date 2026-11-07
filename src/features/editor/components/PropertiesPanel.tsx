import { useDataContext } from '../../../components/dataComponents';
import { StyleControls } from './StyleControls';
import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Layers } from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
interface Props {
  node?: ComponentNode;
  containers: ComponentNode[];
  onProperty: (key: string, value: string) => void;
  onReorder: (offset: number) => void;
  onMove: (parent: string) => void;
  onDelete: () => void;
}
export function PropertiesPanel({
  node,
  containers,
  onProperty: prop,
  onReorder,
  onMove,
  onDelete,
}: Props) {
  const [destination, setDestination] = useState('');
  const data = useDataContext();
  return (
    <aside className="editor-right">
      <div className="panel-heading">Propiedades</div>
      {node ? (
        <div className="properties">
          <div className="selected-type">
            <Layers size={18} />
            <strong>{node.type}</strong>
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
                {['h1', 'h2', 'h3'].map((v) => (
                  <option key={v}>{v}</option>
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
                ['placeholder', 'Placeholder'],
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
          {['DataForm', 'DataTable', 'DataDetail'].includes(node.type) && (
            <>
              <div className="panel-heading">Conexión de datos</div>
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
              <div className="panel-heading">Conexión de servicio</div>
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
          <p>Selecciona un componente en el canvas o en las capas para editar sus propiedades.</p>
        </div>
      )}
    </aside>
  );
}
