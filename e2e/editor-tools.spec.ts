import { expect, test, type APIRequestContext } from '@playwright/test';

async function createPage(request: APIRequestContext, suffix: string, components: unknown[] = []) {
  const response = await request.post('http://127.0.0.1:3001/api/pages', {
    data: {
      name: 'Herramientas ' + suffix,
      code: `tools-${Date.now()}-${suffix}`,
      status: 'draft',
      components,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
const seed = [
  {
    id: 'box',
    type: 'Container',
    props: {},
    children: [{ id: 'title', type: 'Heading', props: { text: 'Título original', level: 'h1' } }],
  },
];

test('duplica y copia árboles, navega por padres y respeta los atajos de edición de texto', async ({
  page,
  request,
  context,
}) => {
  const initial = await createPage(request, 'edicion', seed);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  try {
    await page.goto(`/editor/${initial.id}`);
    const boxes = page.locator('[data-component-type="Container"]');
    await expect(boxes).toHaveCount(1);
    await page.getByRole('button', { name: 'Seleccionar capa Container', exact: true }).click();
    await page.getByRole('button', { name: 'Duplicar componente', exact: true }).click();
    await expect(boxes).toHaveCount(2);
    await boxes.nth(1).locator('[data-component-type="Heading"]').click();
    const text = page.getByLabel('Texto', { exact: true });
    await text.fill('Copia independiente');
    // Ctrl+D inside text fields must not duplicate components.
    await text.press('Control+d');
    await expect(boxes).toHaveCount(2);
    await expect(boxes.first().getByRole('heading', { name: 'Título original' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Ruta del componente' })
      .getByRole('button', { name: 'Container', exact: true })
      .click();
    await page.getByRole('button', { name: 'Copiar componente', exact: true }).click();
    await page.getByRole('button', { name: 'Página · nivel raíz', exact: true }).click();
    await page.getByRole('button', { name: 'Pegar componente', exact: true }).click();
    await expect(boxes).toHaveCount(3);
    await expect(boxes.nth(2).getByRole('heading', { name: 'Copia independiente' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Ruta del componente' })
      .getByRole('button', { name: 'Container', exact: true })
      .focus();
    await page.keyboard.press('Control+d');
    await expect(boxes).toHaveCount(4);
    await page.keyboard.press('Control+z');
    await expect(boxes).toHaveCount(3);
    await page.keyboard.press('Control+Shift+z');
    await expect(boxes).toHaveCount(4);
    await page.keyboard.press('Delete');
    await expect(boxes).toHaveCount(3);
    await page.keyboard.press('Control+z');
    await expect(boxes).toHaveCount(4);
    await boxes.first().locator('[data-component-type="Heading"]').click();
    await page.keyboard.press('Escape');
    await expect(
      page
        .getByRole('navigation', { name: 'Ruta del componente' })
        .getByRole('button', { name: 'Heading', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Control+s');
    await expect(
      page.getByText('Cambios guardados y publicados. Ya están disponibles en Runtime.'),
    ).toBeVisible();
    const saved = await (await request.get('http://127.0.0.1:3001/api/pages/' + initial.id)).json();
    const ids = saved.components.flatMap((node: { id: string; children: { id: string }[] }) => [
      node.id,
      ...node.children.map((child) => child.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(errors).toEqual([]);
  } finally {
    await request.delete('http://127.0.0.1:3001/api/pages/' + initial.id);
  }
});

test('guarda bloques en el backend y los reutiliza en otra página con estilos publicados', async ({
  page,
  request,
  context,
}) => {
  const source = await createPage(request, 'bloque');
  const target = await createPage(request, 'destino');
  const blockName = `Sección ${Date.now()}`;
  let blockId: string | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`/editor/${source.id}`);
    await page.getByRole('tab', { name: 'Bloques', exact: true }).click();
    await page.getByRole('button', { name: 'Insertar bloque Presentación', exact: true }).click();
    const container = page.locator('[data-component-type="Container"]');
    await expect(container).toHaveCount(1);
    await page.getByLabel('Color de fondo', { exact: true }).fill('#ddeeff');
    await page.getByLabel('Espaciado interior', { exact: true }).fill('40');
    await page
      .locator('.spacing-control')
      .first()
      .getByText('Ajustar por lado', { exact: true })
      .click();
    await page.getByLabel('Espaciado interior · superior', { exact: true }).fill('8');
    await page.getByLabel('Espaciado interior', { exact: true }).fill('44');
    await expect(container.locator('.builder-container').first()).toHaveCSS('padding-top', '8px');
    await expect(container.locator('.builder-container').first()).toHaveCSS(
      'padding-right',
      '44px',
    );
    await page.getByLabel('Espaciado interior', { exact: true }).fill('40');
    await page.getByLabel('Diseño del contenedor', { exact: true }).selectOption('grid');
    await page.getByLabel('Columnas', { exact: true }).selectOption('repeat(2, minmax(0, 1fr))');
    await page.getByLabel('Separación', { exact: true }).fill('24');
    await expect(container.locator('.builder-container').first()).toHaveCSS('display', 'grid');
    await expect(container.locator('.builder-container').first()).toHaveCSS('gap', '24px');
    await page.getByRole('button', { name: 'Guardar como bloque', exact: true }).click();
    await page.getByLabel('Nombre del bloque', { exact: true }).fill(blockName);
    // Saving a block is separate from publishing a page.
    await page.getByRole('button', { name: 'Guardar bloque', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Insertar bloque ' + blockName, exact: true }),
    ).toBeVisible();
    const blocks = await (await request.get('http://127.0.0.1:3001/api/blocks')).json();
    blockId = blocks.find((block: { name: string }) => block.name === blockName).id;
    const original = blocks.find((block: { id: string }) => block.id === blockId);
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto(`/editor/${target.id}`);
    await page.getByRole('tab', { name: 'Bloques', exact: true }).click();
    await page.getByRole('button', { name: 'Insertar bloque ' + blockName, exact: true }).click();
    await expect(container).toHaveCount(1);
    await container.locator('[data-component-type="Heading"]').click();
    await page.getByLabel('Texto', { exact: true }).fill('Bloque reutilizado');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(
      page.getByText('Cambios guardados y publicados. Ya están disponibles en Runtime.'),
    ).toBeVisible();
    const saved = await (await request.get('http://127.0.0.1:3001/api/pages/' + target.id)).json();
    expect(saved.components[0].id).not.toBe(original.components[0].id);
    expect(saved.components[0].props.padding).toBe('40px');
    const unchanged = await (await request.get('http://127.0.0.1:3001/api/blocks')).json();
    expect(unchanged.find((block: { id: string }) => block.id === blockId)).toEqual(original);
    const runtime = await context.newPage();
    await runtime.goto('http://127.0.0.1:5174/' + target.code);
    await expect(runtime.getByRole('heading', { name: 'Bloque reutilizado' })).toBeVisible();
    await expect(runtime.locator('.builder-container')).toHaveCSS('display', 'grid');
    await expect(runtime.locator('.builder-container')).toHaveCSS('gap', '24px');
    await expect(runtime.locator('.builder-container').locator('..')).toHaveCSS(
      'background-color',
      'rgb(221, 238, 255)',
    );
    await page.screenshot({ path: 'test-results/editor-tools.png', fullPage: true });
    await page.getByRole('button', { name: 'Eliminar bloque ' + blockName, exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Insertar bloque ' + blockName, exact: true }),
    ).toHaveCount(0);
    await expect(container.getByRole('heading', { name: 'Bloque reutilizado' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (blockId) await request.delete('http://127.0.0.1:3001/api/blocks/' + blockId);
    await request.delete('http://127.0.0.1:3001/api/pages/' + source.id);
    await request.delete('http://127.0.0.1:3001/api/pages/' + target.id);
  }
});

test('resalta el destino y desplaza el lienzo mientras se mantiene un arrastre en el borde', async ({
  page,
  request,
}) => {
  const initial = await createPage(
    request,
    'scroll',
    Array.from({ length: 24 }, (_, i) => ({
      id: 'paragraph-' + i,
      type: 'Paragraph',
      props: { text: 'Contenido de la sección ' + i, margin: '36px' },
    })),
  );
  try {
    await page.goto(`/editor/${initial.id}`);
    const canvas = page.getByRole('main');
    const source = page.getByRole('button', { name: 'Paragraph', exact: true });
    await source.hover();
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Lienzo sin dimensiones');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + bounds.height - 18, { steps: 15 });
    await page.mouse.move(bounds.x + 201, bounds.y + bounds.height - 19);
    await expect.poll(() => canvas.evaluate((el) => el.scrollTop)).toBeGreaterThan(60);
    await expect(page.locator('.drop-feedback')).toContainText('Soltar en');
    await expect(page.locator('.craft-root.drop-target')).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('[data-component-type="Paragraph"]')).toHaveCount(25);
    await expect(page.locator('.drop-feedback')).toHaveCount(0);
  } finally {
    await page.mouse.up();
    await request.delete('http://127.0.0.1:3001/api/pages/' + initial.id);
  }
});
