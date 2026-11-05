import { Element, useEditor } from '@craftjs/core';
import { useEffect, useState } from 'react';
import type { ComponentNode } from '../../../models/contracts';
import { validTree } from '../../../models/contracts';
import { findNode } from '../../../state/tree';
import { defaults } from '../config/catalog';
import { CraftBlock } from '../craft/CraftComponents';
import { fromCraft, isContainer, ROOT } from '../craft/adapter';
import {
  cloneComponents,
  decodeClipboard,
  encodeClipboard,
  isTextInput,
} from '../state/components';

const CLIPBOARD_KEY = 'frontend-builder:clipboard:v1';
export function useEditorCommands({
  preview,
  onSave,
}: {
  preview: boolean;
  onSave: (nodes: ComponentNode[]) => void;
}) {
  const craft = useEditor((state, query) => ({
    serialized: query.getSerializedNodes(),
    selected: [...state.events.selected][0] ?? ROOT,
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));
  const { serialized, selected, actions, query } = craft;
  const nodes = fromCraft(serialized);
  const ids = new Map(
    Object.entries(serialized)
      .filter(([id]) => id !== ROOT)
      .map(([id, n]) => [String(n.props.nodeId ?? id), id]),
  );
  const selectedId = serialized[selected]?.props.nodeId ?? selected;
  const node = findNode(nodes, selectedId);
  const containers = nodes.flatMap(function collect(n): ComponentNode[] {
    return [
      ...(isContainer(n.type) && n.id !== selectedId && !findNode(node?.children ?? [], n.id)
        ? [n]
        : []),
      ...(n.children ?? []).flatMap(collect),
    ];
  });
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  const element = (node: ComponentNode) => (
    <Element
      key={node.id}
      is={CraftBlock}
      canvas={isContainer(node.type) || !!node.children?.length}
      nodeId={node.id}
      nodeType={node.type}
      nodeProps={node.props}
    >
      {node.children?.map(element)}
    </Element>
  );
  function insert(components: ComponentNode[], parent?: string, index?: number) {
    const current = query.getSerializedNodes();
    const destination =
      parent ?? (selected === ROOT || (node && isContainer(node.type)) ? selected : ROOT);
    const fresh = cloneComponents(components);
    const projected = fromCraft(current);
    const target =
      destination === ROOT
        ? undefined
        : findNode(projected, current[destination].props.nodeId ?? destination);
    if (target) target.children = [...(target.children ?? []), ...fresh];
    else projected.push(...fresh);
    if (!validTree(projected)) {
      setMessage('La página admite hasta 500 componentes y 20 niveles de anidamiento.');
      return;
    }
    const insertionIndex = index ?? current[destination].nodes.length;
    fresh.forEach((component, offset) => {
      const tree = query.parseReactElement(element(component)).toNodeTree();
      if (offset) actions.history.merge().addNodeTree(tree, destination, insertionIndex + offset);
      else actions.addNodeTree(tree, destination, insertionIndex);
      if (offset === fresh.length - 1) actions.selectNode(tree.rootNodeId);
    });
  }
  function add(type: string) {
    insert([
      {
        id: '',
        type,
        props: { ...defaults[type] },
        ...(isContainer(type) ? { children: [] } : {}),
      },
    ]);
  }
  function duplicate() {
    if (!node) return;
    const parent = serialized[selected].parent!;
    insert([node], parent, serialized[parent].nodes.indexOf(selected) + 1);
  }
  function remove() {
    if (!node) return;
    const parent = serialized[selected].parent ?? ROOT;
    actions.delete(selected);
    actions.selectNode(parent);
  }
  function selectParent() {
    if (selected !== ROOT) actions.selectNode(serialized[selected]?.parent ?? ROOT);
  }
  function history(direction: 'undo' | 'redo') {
    const previous = query.getSerializedNodes();
    const selection = query.getEvent('selected').first() ?? ROOT;
    actions.history[direction]();
    const current = query.getSerializedNodes();
    const added = Object.keys(current).filter((id) => !previous[id]);
    const restoredRoot = added.find((id) => !added.includes(current[id].parent ?? ''));
    const parent = previous[selection]?.parent ?? ROOT;
    actions.selectNode(
      restoredRoot ?? (current[selection] ? selection : current[parent] ? parent : ROOT),
    );
  }
  function reorder(offset: number) {
    const parent = serialized[selected]?.parent;
    if (!parent) return;
    const target = serialized[parent].nodes.indexOf(selected) + offset;
    if (target >= 0 && target < serialized[parent].nodes.length)
      actions.move(selected, parent, offset > 0 ? target + 1 : target);
  }
  function copyText() {
    if (!node) return;
    const text = encodeClipboard([node]);
    try {
      sessionStorage.setItem(CLIPBOARD_KEY, text);
    } catch {
      /* System clipboard may still be available. */
    }
    return text;
  }
  async function copy() {
    const text = copyText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Componente copiado con todos sus hijos.');
    } catch {
      setMessage('Componente copiado para pegarlo dentro de este editor.');
    }
  }
  async function paste() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      try {
        text = sessionStorage.getItem(CLIPBOARD_KEY) ?? '';
      } catch {
        /* Report unavailable clipboard below. */
      }
    }
    const components = decodeClipboard(text);
    if (components) insert(components);
    else setMessage('Copia un componente del editor antes de pegar.');
  }
  // Listeners are scoped to this mounted editor. Native text editing keeps its shortcuts.
  const keydown = (event: KeyboardEvent) => {
    if (
      event.target instanceof globalThis.Element &&
      event.target.closest('dialog,[role="dialog"]')
    )
      return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 's') {
      event.preventDefault();
      onSave(fromCraft(query.getSerializedNodes()));
      return;
    }
    if (preview || isTextInput(event.target)) return;
    if (mod && key === 'd') {
      event.preventDefault();
      duplicate();
    } else if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey ? craft.canRedo : craft.canUndo) {
        history(event.shiftKey ? 'redo' : 'undo');
      }
    } else if (mod && key === 'y') {
      event.preventDefault();
      if (craft.canRedo) history('redo');
    } else if (!mod && (key === 'delete' || key === 'backspace') && node) {
      event.preventDefault();
      remove();
    } else if (key === 'escape') {
      event.preventDefault();
      selectParent();
    } else if (event.altKey && (key === 'arrowup' || key === 'arrowdown')) {
      event.preventDefault();
      reorder(key === 'arrowup' ? -1 : 1);
    }
  };
  // Effect events deliberately use the latest selection and history on every render.
  const onCopy = (event: ClipboardEvent) => {
    if (
      preview ||
      isTextInput(event.target) ||
      !event.clipboardData ||
      (event.target instanceof globalThis.Element && event.target.closest('dialog'))
    )
      return;
    const text = copyText();
    if (text) {
      event.preventDefault();
      event.clipboardData.setData('text/plain', text);
      setMessage('Componente copiado.');
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    if (
      preview ||
      isTextInput(event.target) ||
      (event.target instanceof globalThis.Element && event.target.closest('dialog'))
    )
      return;
    const components = decodeClipboard(event.clipboardData?.getData('text/plain') ?? '');
    if (components) {
      event.preventDefault();
      insert(components);
    }
  };
  // React effects install exactly one listener of each kind, with fresh command closures.
  useEffect(() => {
    window.addEventListener('keydown', keydown);
    window.addEventListener('copy', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  });
  const path: { id: string; label: string }[] = [];
  let cursor: string | null = selected;
  while (cursor && serialized[cursor]) {
    path.unshift({
      id: cursor,
      label: cursor === ROOT ? 'Página' : serialized[cursor].props.nodeType,
    });
    cursor = serialized[cursor].parent;
  }
  return {
    ...craft,
    nodes,
    ids,
    node,
    containers,
    element,
    add,
    insert,
    duplicate,
    remove,
    copy,
    paste,
    reorder,
    selectParent,
    history,
    path,
    message,
  };
}
