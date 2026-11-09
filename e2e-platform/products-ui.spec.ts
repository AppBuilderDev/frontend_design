import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Setup and all CRUD actions use the UI; network responses are observed only as evidence.
test('productos: recurso, rutas, pagina visual y CRUD completos desde el frontend', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1710, height: 1000 });
  const email = process.env.PRODUCTS_LOGIN_EMAIL ?? `productos-${Date.now()}@example.test`;
  const password = process.env.PRODUCTS_LOGIN_PASSWORD ?? 'Productos-demo-123456';
  const runtimeOrigin = process.env.PRODUCTS_RUNTIME_URL ?? 'http://127.0.0.1:5184';
  const evidence: { method: string; status: number; path: string }[] = [];
  const errors: string[] = [];
  context.on('page', (tab) => tab.on('pageerror', (error) => errors.push(error.message)));
  page.on('pageerror', (error) => errors.push(error.message));
  context.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (/\/resources\/productos(?:\/[^/]+)?$/.test(path)) {
      evidence.push({ method: response.request().method(), status: response.status(), path });
    }
  });
  const output = process.env.PRODUCTS_EVIDENCE_DIR ?? testInfo.outputPath('products-flow');
  await mkdir(output, { recursive: true });

  await page.goto('/workspace');
  if (!process.env.PRODUCTS_LOGIN_EMAIL) {
    await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
    await page.getByLabel('Tu nombre', { exact: true }).fill('Demo Productos');
    await page.getByLabel('Nombre de tu negocio o equipo').fill('Prueba CRUD Productos');
  }
  await page.getByLabel('Correo', { exact: true }).fill(email);
  await page.getByLabel('Contrase\u00f1a', { exact: true }).fill(password);
  await page
    .getByRole('button', {
      name: process.env.PRODUCTS_LOGIN_EMAIL ? 'Iniciar sesi\u00f3n' : 'Crear cuenta',
      exact: true,
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Mis p\u00e1ginas', exact: true })).toBeVisible();

  if (process.env.PRODUCTS_PROJECT_LABEL) {
    await page
      .getByLabel('Proyecto activo', { exact: true })
      .selectOption({ label: process.env.PRODUCTS_PROJECT_LABEL });
    await expect(
      page.getByRole('heading', { name: 'Mis p\u00e1ginas', exact: true }),
    ).toBeVisible();
  }

  await page.getByRole('link', { name: 'Rutas y endpoints', exact: true }).click();
  await page.getByRole('button', { name: 'Crear recurso en backend', exact: true }).click();
  let dialog = page.getByRole('dialog');
  const fields = [
    { key: 'nombre', label: 'Nombre', type: 'text', required: true },
    { key: 'stock', label: 'Stock', type: 'integer', required: true },
  ];
  await dialog.getByLabel('Campos del recurso JSON').fill(JSON.stringify(fields, null, 2));
  await dialog.getByRole('button', { name: 'Crear recurso', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    await page.getByRole('button', { name: 'Registrar ruta', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre', { exact: true }).fill('Productos ' + method);
    await dialog.getByLabel('Metodo', { exact: true }).selectOption(method);
    await dialog
      .getByLabel('Ruta HTTP')
      .fill(
        '/api/v1/projects/{projectId}/resources/productos' +
          (['PUT', 'DELETE'].includes(method) ? '/:id' : ''),
      );
    await dialog.locator('textarea[name=fields]').fill(JSON.stringify(fields, null, 2));
    await dialog.getByRole('button', { name: 'Guardar ruta', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('cell', { name: 'Productos ' + method, exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({ path: output + '/01-rutas.png', fullPage: true });

  await page.getByRole('link', { name: 'Mis p\u00e1ginas', exact: true }).click();
  await page.getByRole('button', { name: 'Crear p\u00e1gina', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Productos');
  await dialog.getByLabel('Direcci\u00f3n de la p\u00e1gina').fill('productos');
  await dialog.getByRole('button', { name: 'Crear p\u00e1gina', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspace\/editor\//);
  await expect(page.locator('.canvas')).toBeVisible();
  await page.getByRole('button', { name: 'T\u00edtulo', exact: true }).click();
  const heading = page
    .locator('.canvas [data-component-id]')
    .filter({ has: page.locator('h1') })
    .last();
  await heading.click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('Productos de mi tienda');
  await page.getByRole('button', { name: 'Tabla HTTP', exact: true }).click();
  await page
    .locator('.canvas [data-component-id]')
    .filter({ hasText: 'Selecciona la ruta GET' })
    .last()
    .click();
  for (const [label, method] of [
    ['Ruta GET', 'GET'],
    ['Ruta POST', 'POST'],
    ['Ruta PUT o PATCH', 'PUT'],
    ['Ruta DELETE', 'DELETE'],
  ]) {
    await page
      .getByLabel(label, { exact: true })
      .selectOption({ label: 'Productos ' + method + ' - ' + method });
  }
  await page.getByLabel('Titulo de tabla', { exact: true }).fill('Cat\u00e1logo de productos');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('guardados y publicados');
  await page.screenshot({ path: output + '/02-editor.png', fullPage: true });
  const href = await page.getByRole('link', { name: /Ver aplicaci/ }).getAttribute('href');
  expect(href).toBeTruthy();
  const runtimeUrl = new URL(href!, runtimeOrigin);
  const runtime = await context.newPage();
  await runtime.goto(runtimeOrigin + runtimeUrl.pathname);
  await expect(
    runtime.getByRole('heading', { name: 'Productos de mi tienda', exact: true }),
  ).toBeVisible();
  await expect(runtime.getByText('No hay registros.', { exact: true })).toBeVisible();
  await runtime.screenshot({ path: output + '/03-get-vacio.png', fullPage: true });

  for (const [nombre, stock] of [
    ['Teclado mec\u00e1nico', '10'],
    ['Mouse de prueba', '5'],
  ]) {
    await runtime.getByRole('button', { name: 'Nuevo registro', exact: true }).click();
    await runtime.getByLabel('Nombre', { exact: true }).fill(nombre);
    await runtime.getByLabel('Stock', { exact: true }).fill(stock);
    await runtime.getByRole('button', { name: 'Guardar registro', exact: true }).click();
    await expect(runtime.getByRole('cell', { name: nombre, exact: true })).toBeVisible();
  }
  await runtime.screenshot({ path: output + '/04-post.png', fullPage: true });
  await runtime
    .getByRole('row')
    .filter({ hasText: 'Teclado mec\u00e1nico' })
    .getByRole('button', { name: /Editar registro/ })
    .click();
  await runtime.getByLabel('Nombre', { exact: true }).fill('Teclado mec\u00e1nico actualizado');
  await runtime.getByLabel('Stock', { exact: true }).fill('25');
  await runtime.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(
    runtime.getByRole('cell', { name: 'Teclado mec\u00e1nico actualizado', exact: true }),
  ).toBeVisible();
  await runtime.reload();
  const updated = runtime.getByRole('row').filter({ hasText: 'Teclado mec\u00e1nico actualizado' });
  await expect(updated.getByRole('cell', { name: '25', exact: true })).toBeVisible();
  await runtime.screenshot({ path: output + '/05-put-persistido.png', fullPage: true });
  runtime.once('dialog', (confirmation) => confirmation.accept());
  await runtime
    .getByRole('row')
    .filter({ hasText: 'Mouse de prueba' })
    .getByRole('button', { name: /Eliminar registro/ })
    .click();
  await expect(runtime.getByRole('cell', { name: 'Mouse de prueba', exact: true })).toHaveCount(0);
  await runtime.reload();
  await expect(
    runtime.getByRole('cell', { name: 'Teclado mec\u00e1nico actualizado', exact: true }),
  ).toBeVisible();
  await expect(runtime.getByRole('cell', { name: 'Mouse de prueba', exact: true })).toHaveCount(0);
  await runtime.screenshot({ path: output + '/06-delete-persistido.png', fullPage: true });
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    expect(
      evidence.some((item) => item.method === method && item.status >= 200 && item.status < 300),
      method,
    ).toBe(true);
  }
  expect(evidence.filter((item) => item.status >= 400)).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(
    output + '/resultado.json',
    JSON.stringify(
      { email, runtimeUrl: runtimeOrigin + runtimeUrl.pathname, evidence, errors },
      null,
      2,
    ),
  );
  console.log(
    'PRODUCTS_DEMO ' +
      JSON.stringify({ email, runtimeUrl: runtimeOrigin + runtimeUrl.pathname, output }),
  );
});
