import { expect, it } from 'vitest';
import { moveNode, findNode, removeNode } from '../src/state/tree';
const nodes = [
  {
    id: 'a',
    type: 'Container',
    props: {},
    children: [{ id: 'b', type: 'Card', props: {}, children: [] }],
  },
  { id: 'c', type: 'Heading', props: { text: 'Hola' } },
];
it('anida, reordena, elimina y rechaza ciclos', () => {
  expect(moveNode(nodes, 'a', 'b')).toBe(nodes);
  const nested = moveNode(nodes, 'c', 'b');
  expect(findNode(nested, 'b')?.children?.[0].id).toBe('c');
  expect(moveNode(nodes, 'c', '', -1)[0].id).toBe('c');
  expect(findNode(removeNode(nested, 'a'), 'c')).toBeUndefined();
  expect(moveNode(nodes, 'b', 'c')).toBe(nodes);
});
