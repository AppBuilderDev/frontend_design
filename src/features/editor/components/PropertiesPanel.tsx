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
          {node.type === 'Card' && (
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
