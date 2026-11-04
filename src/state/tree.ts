import type { ComponentNode } from '../models/contracts';
export function findNode(nodes: ComponentNode[], id: string): ComponentNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findNode(n.children ?? [], id);
    if (child) return child;
  }
}
export function mapTree(
  nodes: ComponentNode[],
  id: string,
  update: (n: ComponentNode) => ComponentNode,
): ComponentNode[] {
  return nodes.map((n) =>
    n.id === id
      ? update(n)
      : {
          ...n,
          children: n.children ? mapTree(n.children, id, update) : undefined,
        },
  );
}
export function removeNode(nodes: ComponentNode[], id: string): ComponentNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({
      ...n,
      children: n.children ? removeNode(n.children, id) : undefined,
    }));
}
export function moveNode(
  nodes: ComponentNode[],
  id: string,
  parent: string,
  offset?: number,
): ComponentNode[] {
  const node = findNode(nodes, id);
  if (!node) return nodes;
  if (offset !== undefined) {
    const delta = offset;
    function reorder(items: ComponentNode[]): ComponentNode[] {
      const index = items.findIndex((n) => n.id === id);
      if (index >= 0) {
        const to = index + delta;
        if (to < 0 || to >= items.length) return items;
        const copy = [...items];
        [copy[index], copy[to]] = [copy[to], copy[index]];
        return copy;
      }
      return items.map((n) => ({
        ...n,
        children: n.children ? reorder(n.children) : undefined,
      }));
    }
    return reorder(nodes);
  }
  if (parent === id || findNode(node.children ?? [], parent)) return nodes;
  const target = parent ? findNode(nodes, parent) : undefined;
  if (parent && (!target || !['Container', 'Card'].includes(target.type))) return nodes;
  const rest = removeNode(nodes, id);
  return parent
    ? mapTree(rest, parent, (n) => ({
        ...n,
        children: [...(n.children ?? []), node],
      }))
    : [...rest, node];
}
