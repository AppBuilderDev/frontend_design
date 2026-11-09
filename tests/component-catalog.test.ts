import { expect, it } from 'vitest';
import { extraDefinitions } from '../src/components/catalog/definitions';
import { generatePageCode, parsePageCode } from '../src/features/editor/code/pageCode';
import { safeUrl } from '../src/components/catalog/helpers';

it('roundtrips every extended component with its properties and nested children', () => {
  const nodes = Object.entries(extraDefinitions).map(([type, definition], index) => ({
    id: 'extra-' + index,
    type,
    props: definition.defaults,
    ...(definition.container
      ? {
          children: [
            { id: 'child-' + index, type: 'Paragraph', props: { text: 'Contenido anidado' } },
          ],
        }
      : {}),
  }));
  const parsed = parsePageCode(generatePageCode(nodes));
  expect(parsed).toEqual(nodes);
});
it('rejects executable and protocol-relative navigation or media URLs', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,<script>',
    '//otro-sitio.test',
    'vbscript:test',
  ])
    expect(safeUrl(url)).toBeUndefined();
  expect(safeUrl('/productos')).toBe('/productos');
  expect(safeUrl('https://example.test/image.png')).toBe('https://example.test/image.png');
});
