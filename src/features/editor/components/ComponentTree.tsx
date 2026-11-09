import { componentLabels } from '../config/labels';
import { useEditor } from '@craftjs/core';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ComponentNode } from '../../../models/contracts';
import { ROOT } from '../craft/adapter';

export function ComponentTree({
  nodes,
  selected,
  ids,
}: {
  nodes: ComponentNode[];
  selected: string;
  ids: Map<string, string>;
}) {
  const { actions, connectors } = useEditor();
  function tree(items: ComponentNode[]): ReactNode {
    return items.map((node) => {
      const id = ids.get(node.id)!;
      return (
        <div key={id} className="tree-item">
          <button
            ref={(el) => {
              if (el) connectors.drag(connectors.select(el, id), id);
            }}
            className={'tree-row ' + (selected === id ? 'active' : '')}
            aria-label={'Seleccionar elemento ' + (componentLabels[node.type] ?? node.type)}
            onClick={() => actions.selectNode(id)}
          >
            <GripVertical size={13} />
            <span>{componentLabels[node.type] ?? node.type}</span>
            <small>{typeof node.props.text === 'string' ? node.props.text.slice(0, 16) : ''}</small>
          </button>
          {node.children && <div className="tree-children">{tree(node.children)}</div>}
        </div>
      );
    });
  }
  return (
    <>
      <button className="root-select" onClick={() => actions.selectNode(ROOT)}>
        Toda la página
      </button>
      <div className="tree">
        {tree(nodes)}
        {!nodes.length && <p className="panel-help">Añade tu primer elemento desde arriba.</p>}
      </div>
    </>
  );
}
