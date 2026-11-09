import { expect, it } from 'vitest';
import { generatePageCode, parsePageCode } from '../src/features/editor/code/pageCode';
import type { ComponentNode } from '../src/models/contracts';
const nodes: ComponentNode[] = [
  {
    id: 'root',
    type: 'Container',
    props: { padding: '24px' },
    children: [
      { id: 'heading', type: 'Heading', props: { text: 'Original', level: 'h1' } },
      {
        id: 'table',
        type: 'RestTable',
        props: {
          listEndpointId: 'get-1',
          createEndpointId: 'post-1',
          updateEndpointId: 'put-1',
          deleteEndpointId: 'delete-1',
          title: 'Datos',
        },
      },
    ],
  },
];
it('genera TSX y recupera identicos IDs, estilos, anidamiento y enlaces HTTP', () => {
  expect(parsePageCode(generatePageCode(nodes))).toEqual(nodes);
});
it('refleja cambios de codigo en el modelo preservando endpoints', () => {
  const source = generatePageCode(nodes).replace('Original', 'Desde codigo');
  const result = parsePageCode(source);
  expect(result[0].children?.[0].props.text).toBe('Desde codigo');
  expect(result[0].children?.[1].props).toEqual(nodes[0].children?.[1].props);
});
it('preserva hijos vacios, propiedades JSON y pagina vacia', () => {
  const value: ComponentNode[] = [
    {
      id: 'a',
      type: 'Card',
      props: { title: 'Texto "citado"', nested: { values: [null, true, -2, 'x'] } },
      children: [],
    },
  ];
  expect(parsePageCode(generatePageCode(value))).toEqual(value);
  expect(parsePageCode(generatePageCode([]))).toEqual([]);
});
it.each(['fetch("http://example.test")', '(()=>123)()', 'window.location', 'undefined'])(
  'rechaza expresiones sin ejecutar %s',
  (expression) => {
    const source = generatePageCode(nodes).replace('"Original"', expression);
    expect(() => parsePageCode(source)).toThrow();
  },
);
it('rechaza imports, spreads, nodos duplicados y sintaxis incompleta', () => {
  const source = generatePageCode(nodes);
  expect(() => parsePageCode(source.replace('./builder-components', './other'))).toThrow();
  expect(() =>
    parsePageCode(source.replace('builderId={"heading"}', 'builderId={"root"}')),
  ).toThrow();
  expect(() => parsePageCode(source + 'bad')).toThrow();
  expect(() => parsePageCode(source.replace('config={', '{...anything} config={'))).toThrow();
});
it('cien recorridos reproducibles preservan conexiones y comportamiento declarativo', () => {
  let value = structuredClone(nodes);
  for (let i = 0; i < 100; i++) {
    value[0].children![0].props.text = 'Cambio ' + i;
    const parsed = parsePageCode(generatePageCode(value));
    expect(parsed).toEqual(value);
    value = parsed;
  }
  expect(value[0].children![1].props.listEndpointId).toBe('get-1');
});

it('acepta agregar y eliminar nodos en TSX sin perder la tabla conectada', () => {
  const source = generatePageCode(nodes).replace('import {', 'import { Paragraph,');
  const extra = '<Paragraph builderId={"new"} config={{"text":"Nuevo desde TSX"}} />';
  const result = parsePageCode(source.replace('</Container>', extra + '\n</Container>'));
  expect(result[0].children?.[2]).toEqual({
    id: 'new',
    type: 'Paragraph',
    props: { text: 'Nuevo desde TSX' },
  });
  const removed = source.replace(/<Heading[\s\S]*?\/>/, '');
  const without = parsePageCode(removed);
  expect(without[0].children).toHaveLength(1);
  expect(without[0].children?.[0].props.listEndpointId).toBe('get-1');
});
it('preserva IDs con caracteres escapados y rechaza IDs no textuales', () => {
  const items: ComponentNode[] = [{ id: 'a"<&amp;', type: 'Heading', props: { text: 'Hola' } }];
  const source = generatePageCode(items);
  expect(parsePageCode(source)).toEqual(items);
  expect(() => parsePageCode(source.replace(/builderId=\{[^}]+\}/, 'builderId={123}'))).toThrow(
    'builderId',
  );
});
