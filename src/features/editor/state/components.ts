import type { ComponentNode } from '../../../models/contracts';
import { nodeSchema, validTree } from '../../../models/contracts';

/** Every insertion gets independent IDs and props, including nested descendants. */
export function cloneComponents(nodes: ComponentNode[]): ComponentNode[] {
  return nodes.map((node) => ({
    ...structuredClone(node),
    id: crypto.randomUUID(),
    ...(node.children ? { children: cloneComponents(node.children) } : {}),
  }));
}
export function encodeClipboard(nodes: ComponentNode[]): string {
  return JSON.stringify({ kind: 'frontend-builder/components', version: 1, components: nodes });
}
export function decodeClipboard(text: string): ComponentNode[] | undefined {
  if (text.length > 1_000_000) return;
  try {
    const data = JSON.parse(text);
    if (data.kind !== 'frontend-builder/components' || data.version !== 1) return;
    const result = nodeSchema.array().min(1).max(500).safeParse(data.components);
    if (result.success && validTree(result.data)) return result.data;
  } catch {
    /* Text from another application is not a component. */
  }
}
export const isTextInput = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');
