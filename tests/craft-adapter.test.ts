import { expect, it } from 'vitest';
import type { ComponentNode } from '../src/models/contracts';
import { ROOT, craftId, fromCraft, toCraft } from '../src/features/editor/craft/adapter';

it('preserva páginas existentes, IDs, propiedades y componentes desconocidos al pasar por Craft', () => {
  const page: ComponentNode[] = [
    {
      id: 'ROOT',
      type: 'Container',
      props: { padding: '32px', options: [true, null, 3] },
      children: [
        { id: 'title', type: 'Heading', props: { text: 'Página existente', level: 'h2' } },
        { id: 'custom', type: 'MiComponente', props: { config: { enabled: true } }, children: [] },
        {
          id: 'legacy',
          type: 'Paragraph',
          props: {},
          children: [{ id: 'child', type: 'Input', props: {} }],
        },
      ],
    },
  ];
  const craft = toCraft(page);
  expect(craft[ROOT].nodes).toEqual([craftId('ROOT')]);
  expect(fromCraft(craft)).toEqual(page);
  expect(fromCraft(toCraft([]))).toEqual([]);
});

it('exporta movimientos y nuevos nodos sin filtrar metadatos de Craft al contrato público', () => {
  const craft = toCraft([
    { id: 'card', type: 'Card', props: { title: 'Tarjeta' }, children: [] },
    { id: 'heading', type: 'Heading', props: { text: 'Mover' } },
  ]);
  craft[ROOT].nodes = [craftId('card')];
  craft[craftId('card')].nodes = [craftId('heading'), 'new-craft-id'];
  craft[craftId('heading')].parent = craftId('card');
  craft['new-craft-id'] = {
    ...craft[craftId('heading')],
    parent: craftId('card'),
    props: { nodeType: 'Button', nodeProps: { text: 'Nuevo', href: '/inicio' } },
  };
  const page = fromCraft(craft);
  expect(page[0].children?.map((node) => node.id)).toEqual(['heading', 'new-craft-id']);
  expect(page[0].children?.[1]).toEqual({
    id: 'new-craft-id',
    type: 'Button',
    props: { text: 'Nuevo', href: '/inicio' },
  });
  expect(fromCraft(toCraft(page))).toEqual(page);
});
