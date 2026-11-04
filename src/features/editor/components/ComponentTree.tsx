import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import type { ComponentNode } from '../../../models/contracts';
import { moveNode } from '../../../state/tree';
interface Props {
  nodes: ComponentNode[];
  selected: string;
  onSelect: (id: string) => void;
  onChange: (nodes: ComponentNode[]) => void;
}
export function ComponentTree({ nodes, selected, onSelect: setSelected, onChange: change }: Props) {
  function tree(items: ComponentNode[]): ReactNode {
    return items.map((n) => (
      <div key={n.id} className="tree-item">
        <button
          className={'tree-row ' + (selected === n.id ? 'active' : '')}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', n.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            change(moveNode(nodes, e.dataTransfer.getData('text/plain'), n.id));
          }}
          onClick={() => setSelected(n.id)}
        >
          <Layers size={13} />
          <span>{n.type}</span>
          <small>{typeof n.props.text === 'string' ? n.props.text.slice(0, 16) : ''}</small>
        </button>
        {n.children && <div className="tree-children">{tree(n.children)}</div>}
      </div>
    ));
  }
  return (
    <div
      className="tree"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        change(moveNode(nodes, e.dataTransfer.getData('text/plain'), ''));
      }}
    >
      {tree(nodes)}
      {nodes.length === 0 && <p className="panel-help">Sin componentes.</p>}
    </div>
  );
}
