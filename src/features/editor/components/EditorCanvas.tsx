import { useState } from 'react';
import { Plus, Monitor, Smartphone } from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
import { RenderTree } from '../../../components/renderer';
interface Props {
  nodes: ComponentNode[];
  name: string;
  preview: boolean;
  selected: string;
  onSelect: (id: string) => void;
  onAdd: (type: string) => void;
}
export function EditorCanvas({
  nodes,
  name,
  preview,
  selected,
  onSelect: setSelected,
  onAdd: add,
}: Props) {
  const [mobile, setMobile] = useState(false);
  return (
    <main className="canvas-area">
      <div className="canvas-toolbar">
        <span>
          {preview ? 'VISTA PREVIA DEL BORRADOR' : 'CANVAS'} <small> / {name}</small>
        </span>
        <div className="actions">
          <button
            aria-label="Vista escritorio"
            className={!mobile ? 'active' : ''}
            onClick={() => setMobile(false)}
          >
            <Monitor size={16} />
          </button>
          <button
            aria-label="Vista móvil"
            className={mobile ? 'active' : ''}
            onClick={() => setMobile(true)}
          >
            <Smartphone size={16} />
          </button>
        </div>
      </div>
      <div className={'canvas ' + (mobile ? 'mobile' : '')}>
        <RenderTree
          nodes={nodes}
          decorate={
            preview
              ? undefined
              : (n, view) => (
                  <div
                    className={'canvas-node ' + (n.id === selected ? 'selected' : '')}
                    role="button"
                    tabIndex={0}
                    aria-label={'Seleccionar ' + n.type}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelected(n.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelected(n.id);
                      }
                    }}
                  >
                    <span className="node-label">{n.type}</span>
                    <div className="node-content">{view}</div>
                  </div>
                )
          }
        />
        {!nodes.length && (
          <div className="canvas-empty">
            <div className="empty-icon">
              <Plus size={28} />
            </div>
            <h2>Un lienzo, infinitas posibilidades</h2>
            <p>
              Selecciona un componente del panel izquierdo
              <br />
              para empezar a diseñar tu página.
            </p>
            <button onClick={() => add('Heading')} className="primary">
              Agregar Heading
            </button>
          </div>
        )}
      </div>
      <div className="canvas-foot">
        {mobile ? '375 px · Móvil' : 'Escritorio · Ancho adaptable'}
        <span>Frontend Builder</span>
      </div>
    </main>
  );
}
