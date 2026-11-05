import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, Layers } from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
import { moveNode, removeNode } from '../../../state/tree';
interface Props {
  node?: ComponentNode;
  nodes: ComponentNode[];
  selected: string;
  containers: ComponentNode[];
  onProperty: (key: string, value: string) => void;
  onChange: (nodes: ComponentNode[]) => void;
  onSelect: (id: string) => void;
}
export function PropertiesPanel({
  node,
  nodes,
  selected,
  containers,
  onProperty: prop,
  onChange: change,
  onSelect: setSelected,
}: Props) {
  const [destination, setDestination] = useState('');
  return (
    <aside className="editor-right">
      <div className="panel-heading">PROPIEDADES</div>
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
          <div className="panel-heading">ESTILOS</div>
          {[
            ['color', 'Color de texto'],
            ['backgroundColor', 'Color de fondo'],
            ['fontSize', 'Tamaño de texto'],
            ['padding', 'Espaciado interior'],
            ['margin', 'Margen'],
            ['borderRadius', 'Radio de borde'],
            ['maxWidth', 'Ancho máximo'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                placeholder={key.includes('Color') || key === 'color' ? '#ffffff' : '24px'}
                value={String(node.props[key] ?? '')}
                onChange={(e) => prop(key, e.target.value)}
              />
            </label>
          ))}
          <label>
            Alineación
            <select
              value={String(node.props.textAlign ?? 'left')}
              onChange={(e) => prop('textAlign', e.target.value)}
            >
              {['left', 'center', 'right'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="panel-heading">ORGANIZAR</div>
          <div className="actions">
            <button
              aria-label="Subir componente"
              onClick={() => change(moveNode(nodes, selected, '', -1))}
            >
              <ChevronUp size={17} />
            </button>
            <button
              aria-label="Bajar componente"
              onClick={() => change(moveNode(nodes, selected, '', 1))}
            >
              <ChevronDown size={17} />
            </button>
            <button
              aria-label="Eliminar componente"
              onClick={() => {
                change(removeNode(nodes, selected));
                setSelected('');
              }}
            >
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
          <button onClick={() => change(moveNode(nodes, selected, destination))}>
            Mover componente
          </button>
          <small>
            Arrastra capas sobre Container o Card para anidar. Las flechas reordenan entre hermanos.
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
