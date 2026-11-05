import { expect, test } from '@playwright/test';

test('arrastra, anida, reordena, deshace y publica conservando el contrato de Runtime', async ({
  page,
  request,
  context,
}) => {
  const code = `craft-${Date.now()}`;
  const created = await request.post('http://127.0.0.1:3001/api/pages', {
    data: { name: 'Craft prueba', code, status: 'draft', components: [] },
  });
  expect(created.ok()).toBeTruthy();
  const initial = await created.json();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`/editor/${initial.id}`);
    const root = page.getByTestId('craft-root');
    await expect(root).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeDisabled();
    // Real browser drag from the component palette to an empty canvas.
    await page
      .getByRole('button', { name: 'Card', exact: true })
      .dragTo(root, { targetPosition: { x: 150, y: 100 } });
    const card = page.locator('[data-component-type="Card"]');
    await expect(card).toHaveCount(1);
    await page
      .getByRole('button', { name: 'Heading', exact: true })
      .dragTo(card, { targetPosition: { x: 80, y: 90 } });
    await expect(card.locator('[data-component-type="Heading"]')).toHaveCount(1);
    await card.locator('[data-component-type="Heading"]').click();
    await page.getByLabel('Texto', { exact: true }).fill('Título arrastrado');
    await page.getByRole('button', { name: 'Página · nivel raíz', exact: true }).click();
    await page.getByRole('button', { name: 'Paragraph', exact: true }).click();
    await page.getByLabel('Texto', { exact: true }).fill('Párrafo movido');
    const paragraph = page.locator('[data-component-type="Paragraph"]');
    await paragraph
      .getByRole('button', { name: 'Arrastrar Paragraph', exact: true })
      .dragTo(card, { targetPosition: { x: 80, y: 90 } });
    await expect(card.locator('[data-component-type="Paragraph"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(card.locator('[data-component-type="Paragraph"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await expect(card.locator('[data-component-type="Paragraph"]')).toHaveCount(1);
    await paragraph.click();
    // Keyboard/click alternative reorders siblings without dragging.
    await page.getByRole('button', { name: 'Subir componente', exact: true }).click();
    await expect(card.locator('[data-component-type]').first()).toHaveAttribute(
      'data-component-type',
      'Paragraph',
    );
    await page.getByRole('button', { name: 'Bajar componente', exact: true }).click();
    await expect(card.locator('[data-component-type]').first()).toHaveAttribute(
      'data-component-type',
      'Heading',
    );
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Título arrastrado' })).toBeVisible();
    await expect(page.locator('.node-handle:visible')).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Cambios guardados y publicados');
    const response = await request.get(
      'http://127.0.0.1:3001/api/public/pages/by-path?path=/' + code,
    );
    const saved = await response.json();
    expect(saved.components).toHaveLength(1);
    expect(saved.components[0].children.map((n: { type: string }) => n.type)).toEqual([
      'Heading',
      'Paragraph',
    ]);
    expect(JSON.stringify(saved)).not.toContain('resolvedName');
    await page.reload();
    await expect(page.getByText('Todos los cambios guardados')).toBeVisible();
    await expect(card.locator('[data-component-type="Paragraph"]')).toHaveCount(1);
    // Restoring the saved state through history must clear the dirty flag.
    await paragraph.click();
    await page.getByLabel('Texto', { exact: true }).fill('Cambio temporal');
    await expect(page.getByRole('contentinfo')).toContainText('Cambios pendientes');
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(page.getByText('Todos los cambios guardados')).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar componente', exact: true }).click();
    await expect(paragraph).toHaveCount(0);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(paragraph).toHaveCount(1);
    await expect(page.getByText('Todos los cambios guardados')).toBeVisible();
    // Layer rows use the same Craft connectors as the canvas handles.
    await page
      .getByRole('button', { name: 'Seleccionar capa Paragraph', exact: true })
      .dragTo(root, { targetPosition: { x: 100, y: 450 } });
    await expect(card.locator('[data-component-type="Paragraph"]')).toHaveCount(0);
    await expect(paragraph).toHaveCount(1);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(card.locator('[data-component-type="Paragraph"]')).toHaveCount(1);
    await expect(page.getByText('Todos los cambios guardados')).toBeVisible();
    const runtime = await context.newPage();
    await runtime.goto('http://127.0.0.1:5174/' + code);
    await expect(runtime.getByRole('heading', { name: 'Título arrastrado' })).toBeVisible();
    await expect(runtime.getByText('Párrafo movido')).toBeVisible();
    await page.screenshot({ path: 'test-results/craft-editor.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await request.delete('http://127.0.0.1:3001/api/pages/' + initial.id);
  }
});
