import { expect, test, type Locator } from '@playwright/test';

async function horizontalPosition(container: Locator, button: Locator) {
  const box = await container.boundingBox();
  const child = await button.boundingBox();
  if (!box || !child) throw new Error('Componente sin dimensiones');
  return (child.x + child.width / 2 - box.x) / box.width;
}

test('posiciona botones independientemente de la alineación del texto en editor, vista previa y Runtime', async ({
  page,
  request,
  context,
}) => {
  const response = await request.post('http://127.0.0.1:3001/api/pages', {
    data: {
      name: 'Alineación',
      code: `alignment-${Date.now()}`,
      status: 'draft',
      components: [
        {
          id: 'container',
          type: 'Container',
          props: { textAlign: 'center' },
          children: [
            { id: 'button', type: 'Button', props: { text: 'Comenzar', textAlign: 'right' } },
          ],
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  const initial = await response.json();
  try {
    await page.goto('/editor/' + initial.id);
    const container = page.locator('.builder-container:visible');
    const button = page.locator('.builder-button:visible');
    // Reproduce the configuration in the reported screenshot.
    await expect.poll(() => horizontalPosition(container, button)).toBeGreaterThan(0.6);
    await page.getByRole('button', { name: 'Seleccionar capa Container', exact: true }).click();
    await expect(page.getByLabel('Alineación del texto', { exact: true })).toHaveValue('center');
    for (const layout of ['column', 'row', 'grid']) {
      if (layout === 'grid') {
        await page.getByLabel('Diseño del contenedor', { exact: true }).selectOption('grid');
        await page
          .getByLabel('Columnas', { exact: true })
          .selectOption('repeat(1, minmax(0, 1fr))');
      } else {
        await page.getByLabel('Dirección', { exact: true }).selectOption(layout);
      }
      const alignment = page.getByLabel('Alineación horizontal', { exact: true });
      await alignment.selectOption('center');
      await expect.poll(() => horizontalPosition(container, button)).toBeCloseTo(0.5, 2);
      await alignment.selectOption(layout === 'grid' ? 'end' : 'flex-end');
      await expect.poll(() => horizontalPosition(container, button)).toBeGreaterThan(0.6);
      await alignment.selectOption(layout === 'grid' ? 'start' : 'flex-start');
      await expect.poll(() => horizontalPosition(container, button)).toBeLessThan(0.4);
      await alignment.selectOption('center');
    }
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await expect.poll(() => horizontalPosition(container, button)).toBeCloseTo(0.5, 2);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(
      page.getByText('Cambios guardados y publicados. Ya están disponibles en Runtime.'),
    ).toBeVisible();
    const saved = await (await request.get('http://127.0.0.1:3001/api/pages/' + initial.id)).json();
    expect(saved.components[0].children[0].props.textAlign).toBe('right');
    const runtime = await context.newPage();
    await runtime.goto('http://127.0.0.1:5174/' + initial.code);
    await expect
      .poll(() =>
        horizontalPosition(
          runtime.locator('.builder-container'),
          runtime.locator('.builder-button'),
        ),
      )
      .toBeCloseTo(0.5, 2);
    // A child can also explicitly return to inherited text alignment.
    await page.getByRole('button', { name: 'Seleccionar capa Button', exact: true }).click();
    await page.getByLabel('Alineación del texto', { exact: true }).selectOption('');
    await expect(page.locator('[data-component-id="button"] .node-content > div')).toHaveCSS(
      'text-align',
      'center',
    );
  } finally {
    await request.delete('http://127.0.0.1:3001/api/pages/' + initial.id);
  }
});

test('padding cero elimina el espacio real y el editor coincide con la página publicada', async ({
  page,
  request,
  context,
}) => {
  const response = await request.post('http://127.0.0.1:3001/api/pages', {
    data: {
      name: 'Espaciado',
      code: `padding-${Date.now()}`,
      status: 'draft',
      components: [
        {
          id: 'container',
          type: 'Container',
          props: { padding: '24px', backgroundColor: '#e11414', gap: '0px' },
          children: [{ id: 'button', type: 'Button', props: { text: 'Comenzar' } }],
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  const initial = await response.json();
  const offsets = async (container: Locator, button: Locator) => {
    const box = await container.boundingBox();
    const child = await button.boundingBox();
    if (!box || !child) throw new Error('Componente sin dimensiones');
    return {
      top: child.y - box.y,
      left: child.x - box.x,
      bottom: box.y + box.height - child.y - child.height,
    };
  };
  try {
    await page.goto('/editor/' + initial.id);
    await page.getByRole('button', { name: 'Seleccionar capa Container', exact: true }).click();
    const container = page.locator('.builder-container:visible');
    const button = page.locator('.builder-button:visible');
    await page.getByLabel('Espaciado interior', { exact: true }).fill('0');
    await expect(container).toHaveCSS('padding', '0px');
    await expect.poll(() => offsets(container, button)).toEqual({ top: 0, left: 0, bottom: 0 });
    await page.getByLabel('Espaciado interior', { exact: true }).fill('16');
    await expect.poll(() => offsets(container, button)).toEqual({ top: 16, left: 16, bottom: 16 });
    await page.getByLabel('Espaciado interior', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await expect.poll(() => offsets(container, button)).toEqual({ top: 0, left: 0, bottom: 0 });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(
      page.getByText('Cambios guardados y publicados. Ya están disponibles en Runtime.'),
    ).toBeVisible();
    const runtime = await context.newPage();
    await runtime.goto('http://127.0.0.1:5174/' + initial.code);
    await expect
      .poll(() =>
        offsets(runtime.locator('.builder-container'), runtime.locator('.builder-button')),
      )
      .toEqual({ top: 0, left: 0, bottom: 0 });
  } finally {
    await request.delete('http://127.0.0.1:3001/api/pages/' + initial.id);
  }
});
