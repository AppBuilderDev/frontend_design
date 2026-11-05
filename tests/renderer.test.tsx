import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenderTree, registerComponent } from '../src/components/renderer';
it('renderiza nodos anidados y componentes desconocidos', () => {
  const html = renderToStaticMarkup(
    <RenderTree
      nodes={[
        {
          id: 'a',
          type: 'Card',
          props: { title: 'Tarjeta' },
          children: [
            {
              id: 'b',
              type: 'Heading',
              props: { text: 'Hola desde Frontend Builder' },
            },
            { id: 'c', type: 'Personalizado', props: {} },
          ],
        },
      ]}
    />,
  );
  expect(html).toContain('Hola desde Frontend Builder');
  expect(html).toContain('Componente no disponible');
});
it('permite registrar componentes y evita enlaces ejecutables', () => {
  registerComponent('Custom', () => <p>Personalizado</p>);
  const html = renderToStaticMarkup(
    <RenderTree
      nodes={[
        { id: 'a', type: 'Custom', props: {} },
        {
          id: 'b',
          type: 'Button',
          props: { text: 'Abrir', href: 'javascript:alert(1)' },
        },
      ]}
    />,
  );
  expect(html).toContain('Personalizado');
  expect(html).not.toContain('javascript:');
});

it('aplica distribución y espaciado por lado y filtra valores CSS inseguros', () => {
  const html = renderToStaticMarkup(
    <RenderTree
      nodes={[
        {
          id: 'layout',
          type: 'Container',
          props: {
            display: 'grid',
            gap: '20px',
            padding: '24px',
            paddingTop: '8px',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            marginLeft: 'expression(alert(1))',
          },
          children: [{ id: 'child', type: 'Heading', props: { text: 'Cuadrícula' } }],
        },
      ]}
    />,
  );
  expect(html).toContain('display:grid');
  expect(html).toContain('gap:20px');
  expect(html).toContain('padding-top:8px');
  expect(html).toContain('grid-template-columns:repeat(3, minmax(0, 1fr))');
  expect(html).not.toContain('expression');
});
