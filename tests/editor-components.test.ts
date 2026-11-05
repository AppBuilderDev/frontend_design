import { expect, it } from 'vitest';
import {
  cloneComponents,
  encodeClipboard,
  decodeClipboard,
} from '../src/features/editor/state/components';
import { starterBlocks } from '../src/features/editor/config/blocks';
import { validTree } from '../src/models/contracts';

it('duplica árboles con IDs únicos sin compartir propiedades con el origen o con otras copias', () => {
  const source = starterBlocks[1].components;
  const a = cloneComponents(source);
  const b = cloneComponents(source);
  const ids = (nodes: typeof source): string[] =>
    nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])]);
  const all = [...ids(source), ...ids(a), ...ids(b)];
  expect(new Set(all).size).toBe(all.length);
  a[0].children![0].props.text = 'Copia editada';
  expect(source[0].children![0].props.text).not.toBe('Copia editada');
  expect(b[0].children![0].props.text).not.toBe('Copia editada');
  expect(validTree(a)).toBe(true);
});
it('acepta solo componentes válidos del portapapeles y rechaza texto, versiones y árboles inválidos', () => {
  const source = starterBlocks[0].components;
  expect(decodeClipboard(encodeClipboard(source))).toEqual(source);
  for (const text of [
    'hola',
    '{}',
    encodeClipboard([...source, ...source]),
    encodeClipboard([]),
    '{',
    JSON.stringify({ kind: 'frontend-builder/components', version: 2, components: source }),
  ]) {
    expect(decodeClipboard(text)).toBeUndefined();
  }
});
it('los bloques iniciales usan árboles válidos y componentes disponibles', () => {
  for (const block of starterBlocks) expect(validTree(block.components)).toBe(true);
});
