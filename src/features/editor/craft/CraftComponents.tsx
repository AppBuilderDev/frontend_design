import { componentLabels } from '../config/labels';
import { useEditor, useNode } from '@craftjs/core';
import { GripVertical, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { ComponentView } from '../../../components/renderer';
import { isContainer } from './adapter';

export function CraftRoot({ children }: { children?: ReactNode }) {
  const {
    connectors: { connect },
    empty,
  } = useNode((node) => ({ empty: !node.data.nodes.length }));
  const { dropTarget, invalid } = useEditor((state) => ({
    dropTarget: state.indicator?.placement.parent.id === 'ROOT',
    invalid: !!state.indicator?.error,
  }));
  return (
    <div
      ref={(el) => {
        if (el) connect(el);
      }}
      className={`craft-root ${dropTarget ? 'drop-target' : ''} ${dropTarget && invalid ? 'drop-invalid' : ''}`}
      data-testid="craft-root"
    >
      {children}
      {empty && (
        <div className="canvas-empty">
          <div className="empty-icon">
            <Plus size={28} />
          </div>
          <h2>Añade tu primer elemento</h2>
          <p>
            Arrástralo desde el panel izquierdo hasta aquí.
            <br />
            También puedes hacer clic para añadirlo.
          </p>
        </div>
      )}
    </div>
  );
}

export interface BlockProps {
  nodeId?: string;
  nodeType: string;
  nodeProps: Record<string, unknown>;
  children?: ReactNode;
}

export function CraftBlock({ nodeId, nodeType, nodeProps, children }: BlockProps) {
  const {
    id,
    connectors: { connect, drag },
    selected,
    hovered,
    empty,
  } = useNode((node) => ({
    selected: node.events.selected,
    hovered: node.events.hovered,
    empty: !node.data.nodes.length,
  }));
  const { actions, dropTarget, invalid } = useEditor((state) => ({
    dropTarget: state.indicator?.placement.parent.id === id,
    invalid: !!state.indicator?.error,
  }));
  return (
    <div
      ref={(el) => {
        if (el) connect(drag(el));
      }}
      className={`canvas-node ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''} ${dropTarget ? 'drop-target' : ''} ${dropTarget && invalid ? 'drop-invalid' : ''}`}
      data-component-id={nodeId ?? id}
      data-component-type={nodeType}
      tabIndex={0}
      aria-label={'Seleccionar ' + nodeType}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.selectNode(id);
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          event.stopPropagation();
          actions.selectNode(id);
        }
      }}
    >
      <button
        ref={(el) => {
          if (el) drag(el);
        }}
        className="node-label node-handle"
        aria-label={'Arrastrar ' + nodeType}
        title="Arrastra para mover este componente"
      >
        <GripVertical size={13} />
        {componentLabels[nodeType] ?? nodeType}
      </button>
      <div className="node-content">
        <ComponentView node={{ id: nodeId ?? id, type: nodeType, props: nodeProps }}>
          {children}
          {isContainer(nodeType) && empty && (
            <div className="container-hint">Arrastra elementos aquí</div>
          )}
        </ComponentView>
      </div>
    </div>
  );
}

CraftBlock.craft = {
  rules: {
    canMoveIn: (_incoming: unknown, self: { data: { props: BlockProps } }) =>
      isContainer(self.data.props.nodeType),
  },
};
