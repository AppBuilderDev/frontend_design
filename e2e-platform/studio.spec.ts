import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('editor compacto: biblioteca, formato, historial, zoom, publicación y móvil', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1710, height: 920 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const headers = { 'X-Requested-With': 'AppBuilderDev' };
  const api = 'http://127.0.0.1:5183/api/v1';
  const signup = await context.request.post(api + '/auth/register', {
    headers,
    data: {
      name: 'Diseñador',
      organization: 'UNSA',
      email: `studio-${Date.now()}@example.com`,
      password: 'Clave-visual-123456',
    },
  });
  expect(signup.ok()).toBe(true);
  const session = await signup.json();
  const project = session.projects[0].id;
  const created = await context.request.post(`${api}/projects/${project}/pages`, {
    headers,
    data: {
      name: 'Inventario',
      code: 'inventario',
      status: 'draft',
      components: [
        {
          id: 'title',
          type: 'Heading',
          props: { text: 'Inventario', level: 'h1', fontSize: '36px', color: '#111827' },
        },
        {
          id: 'intro',
          type: 'Paragraph',
          props: { text: 'Administra tus productos y consulta sus existencias.', color: '#718098' },
        },
        {
          id: 'search',
          type: 'Input',
          props: {
            label: 'Buscar productos',
            placeholder: 'Buscar producto…',
            marginTop: '24px',
            marginBottom: '24px',
          },
        },
        ...[
          'Laptop 14” · LAP-001 · 12 unidades',
          'Audífonos Bluetooth · AUD-002 · 25 unidades',
          'Mouse inalámbrico · MOU-003 · 48 unidades',
          'Teclado mecánico · TEC-004 · 15 unidades',
        ].map((text, i) => ({
          id: 'row-' + i,
          type: 'Card',
          props: { title: text, padding: '16px', marginBottom: '10px', backgroundColor: '#ffffff' },
          children: [
            {
              id: 'row-detail-' + i,
              type: 'Paragraph',
              props: {
                text: 'Disponible en almacén',
                color: '#7b879e',
                fontSize: '13px',
                margin: '0px',
              },
            },
          ],
        })),
      ],
    },
  });
  expect(created.ok()).toBe(true);
  const initial = await created.json();
  await page.goto('/workspace/editor/' + initial.id);
  await expect(page.getByRole('heading', { name: 'Añadir elementos', exact: true })).toBeVisible();
  await page.getByLabel('Buscar elementos', { exact: true }).fill('titulo');
  await expect(page.getByRole('button', { name: 'Título', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Botón', exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar elementos', { exact: true }).fill('');
  const canvasBox = await page.locator('.canvas').boundingBox();
  const rootBeforeSelection = await page.getByTestId('craft-root').boundingBox();
  expect(canvasBox && rootBeforeSelection && rootBeforeSelection.y - canvasBox.y).toBeLessThan(60);
  await page.locator('[data-component-id="title"]').click();
  const rootAfterSelection = await page.getByTestId('craft-root').boundingBox();
  expect(rootAfterSelection?.y).toBe(rootBeforeSelection?.y);

  await expect(page.getByRole('toolbar', { name: 'Formato del texto' })).toBeVisible();
  await page.getByLabel('Tamaño del texto seleccionado', { exact: true }).selectOption('36px');
  await expect(page.locator('.editor-right')).toHaveCSS('position', 'relative');
  await expect(page.locator('.editor-right')).toHaveCSS('width', '280px');
  await expect(page.locator('.studio-library')).toHaveCSS('width', '240px');
  await expect(page.locator('.element-list').first()).toHaveCSS('display', 'grid');
  await page.getByRole('button', { name: 'Cursiva', exact: true }).click();
  await expect(page.locator('[data-component-id="title"] h1')).toHaveCSS('font-style', 'italic');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.locator('[data-component-id="title"] h1')).toHaveCSS('font-style', 'normal');
  await page.getByRole('button', { name: 'Cursiva', exact: true }).click();
  await page.getByRole('button', { name: 'Subrayado', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('contentinfo')).toContainText('Todos los cambios guardados');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'publicados' })).toBeVisible();
  const runtime = await context.newPage();
  await runtime.goto(`http://127.0.0.1:5184/p/${project}/inventario`);
  await expect(runtime.getByRole('heading', { name: 'Inventario', exact: true })).toHaveCSS(
    'font-style',
    'italic',
  );
  await expect(runtime.getByRole('heading', { name: 'Inventario', exact: true })).toHaveCSS(
    'text-decoration-line',
    'underline',
  );
  await runtime.close();
  await page.getByRole('button', { name: 'Cursiva', exact: true }).click();
  await page.getByRole('button', { name: 'Subrayado', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cursiva', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Subrayado', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('contentinfo')).toContainText('Todos los cambios guardados');
  await expect(page.locator('.notice')).toHaveCount(0, { timeout: 10000 });
  mkdirSync('design-review', { recursive: true });
  await page.screenshot({ path: 'design-review/editor-desktop.png' });
  await page.getByRole('button', { name: 'Ver capas', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Seleccionar elemento Título', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Añadir elementos', exact: true }).click();
  await page.getByLabel('Zoom de la página', { exact: true }).selectOption('75');
  await expect(page.locator('.canvas')).toHaveCSS('zoom', '0.75');
  await page.getByLabel('Zoom de la página', { exact: true }).selectOption('100');
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  await expect(page.locator('.studio-library')).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Cerrar biblioteca', exact: true }).click();
  await expect(page.locator('.editor-right')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Añadir elementos', exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: 'design-review/editor-mobile.png' });
  expect(errors).toEqual([]);
});
