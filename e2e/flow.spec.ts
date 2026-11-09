import { test, expect } from '@playwright/test';
test('guardar publica y actualiza la página en Runtime', async ({ page, context }) => {
  test.setTimeout(90000);
  const code = 'inicio-e2e-' + Date.now();
  let id = '';
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Crear página', exact: true }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Inicio');
    await page.getByLabel('Dirección de la página', { exact: true }).fill(code);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Crear página', exact: true })
      .click();
    await expect(page).toHaveURL(/editor/);
    id = page.url().split('/').pop()!;
    await page.getByRole('button', { name: 'Título', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Texto', exact: true })
      .fill('Hola desde Frontend Builder');
    await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0);
    const runtime = await context.newPage();
    await runtime.goto('http://127.0.0.1:5174/' + code);
    await expect(runtime.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Cambios guardados y publicados');
    await runtime.reload();
    await expect(
      runtime.getByRole('heading', { name: 'Hola desde Frontend Builder' }),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('Hola actualizado');
    await runtime.reload();
    await expect(
      runtime.getByRole('heading', { name: 'Hola desde Frontend Builder' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Cambios guardados y publicados');
    await runtime.reload();
    await expect(runtime.getByRole('heading', { name: 'Hola actualizado' })).toBeVisible();
    await page.screenshot({ path: 'test-results/editor.png', fullPage: true });
    await page.getByRole('link', { name: 'Volver a páginas' }).click();
    await page.getByRole('button', { name: 'Editar Inicio', exact: true }).click();
    await page.getByLabel('Dirección de la página', { exact: true }).fill(code + '-editado');
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await runtime.reload();
    await expect(runtime.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
    await runtime.goto('http://127.0.0.1:5174/' + code + '-editado');
    await expect(runtime.getByRole('heading', { name: 'Hola actualizado' })).toBeVisible();
  } finally {
    if (id) await fetch('http://127.0.0.1:3001/api/pages/' + id, { method: 'DELETE' });
  }
});
