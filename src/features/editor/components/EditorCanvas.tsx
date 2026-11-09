import { useDragScroll } from '../hooks/useDragScroll';
import { Frame, useEditor } from '@craftjs/core';
import { useState, type ReactNode } from 'react';
import { Monitor, Smartphone, Minus, Plus } from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
import { RenderTree } from '../../../components/renderer';
import { toCraft } from '../craft/adapter';

export function EditorCanvas({
  nodes,
  initialNodes,
  name,
  preview,
  selectionBar,
}: {
  nodes: ComponentNode[];
  initialNodes: ComponentNode[];
  name: string;
  preview: boolean;
  selectionBar?: ReactNode;
}) {
  const ref = useDragScroll();
  const { dropTarget, invalid, before, where } = useEditor((state) => ({
    dropTarget: state.indicator
      ? state.indicator.placement.parent.id === 'ROOT'
        ? 'la página'
        : state.indicator.placement.parent.data.props.nodeType
      : '',
    invalid: !!state.indicator?.error,
    before: state.indicator?.placement.currentNode?.data.props.nodeType ?? '',
    where: state.indicator?.placement.where ?? '',
  }));
  const [mobile, setMobile] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [initialData] = useState(() => toCraft(initialNodes));
  return (
    <main className="canvas-area" ref={ref}>
      <div className="canvas-toolbar">
        <span>
          {preview ? 'Vista previa del borrador' : 'Página'} <small>/ {name}</small>
        </span>
        <div className="actions">
          <button
            aria-label="Vista escritorio"
            aria-pressed={!mobile}
            className={!mobile ? 'active' : ''}
            onClick={() => setMobile(false)}
          >
            <Monitor size={16} />
          </button>
          <button
            aria-label="Vista móvil"
            aria-pressed={mobile}
            className={mobile ? 'active' : ''}
            onClick={() => setMobile(true)}
          >
            <Smartphone size={16} />
          </button>
        </div>
      </div>
      {selectionBar}
      {dropTarget && !preview && (
        <div className={'drop-feedback ' + (invalid ? 'invalid' : '')} role="status">
          {invalid
            ? 'Este destino no admite el componente'
            : `Soltar en ${dropTarget}${before ? ` · ${where === 'before' ? 'antes' : 'después'} de ${before}` : ' · al final'}`}
        </div>
      )}
      <div className={'canvas ' + (mobile ? 'mobile' : '')} style={{ zoom: zoom / 100 }}>
        <div hidden={preview}>
          <Frame data={initialData} />
        </div>
        {preview && <RenderTree nodes={nodes} />}
      </div>
      <div className="canvas-viewbar">
        <span className="viewbar-hint">
          {preview
            ? 'Vista previa del borrador'
            : mobile
              ? 'Vista móvil · 375 px'
              : 'Vista de escritorio'}
        </span>
        <div className="zoom-control">
          <button
            aria-label="Alejar página"
            disabled={zoom <= 50}
            onClick={() => setZoom(Math.max(50, zoom - 10))}
          >
            <Minus size={15} />
          </button>
          <select
            aria-label="Zoom de la página"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {[...new Set([50, 75, 100, 125, 150, zoom])]
              .sort((a, b) => a - b)
              .map((value) => (
                <option value={value} key={value}>
                  {value}%
                </option>
              ))}
          </select>
          <button
            aria-label="Acercar página"
            disabled={zoom >= 150}
            onClick={() => setZoom(Math.min(150, zoom + 10))}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
    </main>
  );
}
