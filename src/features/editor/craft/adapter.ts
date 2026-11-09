import { extraDefinitions } from '../../../components/catalog/definitions';
import type { SerializedNodes } from '@craftjs/core';
import type { ComponentNode } from '../../../models/contracts';

export const ROOT = 'ROOT';
export const isContainer = (type: string) =>
  type === 'Container' || type === 'Card' || !!extraDefinitions[type]?.container;
export const craftId = (id: string) => `page:${id}`;

/** Keep Craft's editor state out of the public page contract. */
export function toCraft(nodes: ComponentNode[]): SerializedNodes {
  const result: SerializedNodes = {
    [ROOT]: {
      type: { resolvedName: 'CraftRoot' },
      isCanvas: true,
      props: {},
      displayName: 'Página',
      parent: null,
      nodes: nodes.map((n) => craftId(n.id)),
      linkedNodes: {},
      hidden: false,
      custom: {},
    },
  };
  function visit(items: ComponentNode[], parent: string) {
    items.forEach((node) => {
      const id = craftId(node.id);
      result[id] = {
        type: { resolvedName: 'CraftBlock' },
        isCanvas: isContainer(node.type) || !!node.children?.length,
        props: { nodeId: node.id, nodeType: node.type, nodeProps: node.props },
        displayName: node.type,
        parent,
        nodes: (node.children ?? []).map((n) => craftId(n.id)),
        linkedNodes: {},
        hidden: false,
        custom: { hadChildren: node.children !== undefined },
      };
      visit(node.children ?? [], id);
    });
  }
  visit(nodes, ROOT);
  return result;
}

export function fromCraft(nodes: SerializedNodes): ComponentNode[] {
  function visit(id: string): ComponentNode {
    const node = nodes[id];
    return {
      id: node.props.nodeId ?? id,
      type: node.props.nodeType,
      props: node.props.nodeProps,
      ...(node.nodes.length || isContainer(node.props.nodeType) || node.custom?.hadChildren
        ? { children: node.nodes.map(visit) }
        : {}),
    };
  }
  return (nodes[ROOT]?.nodes ?? []).map(visit);
}
