import { test, expect } from '@playwright/test';
test('inventario operativo, recuperación de conexión y usuarios sin acceso de construcción', async ({
  page,
  context,
  browser,
}) => {
  const api = 'http://127.0.0.1:5183/api/v1',
    headers = { 'X-Requested-With': 'AppBuilderDev' };
  const stamp = Date.now();
  const signup = await context.request.post(api + '/auth/register', {
    headers,
    data: {
      name: 'Administrador prueba',
      email: 'operations-' + stamp + '@example.com',
      password: 'Clave-operativa-1234',
      organization: 'Almacén operativo',
    },
  });
  expect(signup.ok()).toBe(true);
  const session = await signup.json(),
    project = session.projects[0].id;
  const root = api + '/projects/' + project;
  const template = await context.request.post(root + '/templates/inventory', { headers });
  const entities = await template.json();
  const category = entities.find((e: { key: string }) => e.key === 'categorias'),
    unit = entities.find((e: { key: string }) => e.key === 'unidades'),
    entity = entities.find((e: { key: string }) => e.key === 'productos');
  const cat = await (
    await context.request.post(root + '/services/' + category.id + '/records', {
      headers,
      data: { values: { nombre: 'Herramientas' } },
    })
  ).json();
  const u = await (
    await context.request.post(root + '/services/' + unit.id + '/records', {
      headers,
      data: { values: { nombre: 'Unidad' } },
    })
  ).json();
  const product = await (
    await context.request.post(root + '/services/' + entity.id + '/records', {
      headers,
      data: {
        values: { nombre: 'Martillo', sku: 'MAR-1', categoria: cat.id, unidad: u.id, precio: 2500 },
      },
    })
  ).json();
  await page.goto('/workspace/inventory');
  await page.getByRole('button', { name: 'Activar inventario', exact: true }).click();
  const stock = page.getByRole('table', { name: 'Existencias de inventario' });
  await expect(stock.getByRole('cell', { name: 'Martillo', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seleccionar Martillo', exact: true }).click();
  await page.getByLabel('Mínimo de existencias', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Guardar mínimo', exact: true }).click();
  await expect(stock.getByRole('cell', { name: 'Bajo mínimo', exact: true })).toBeVisible();
  const form = page.getByRole('form', { name: 'Registrar movimiento', exact: true });
  await form.getByLabel('Cantidad del movimiento', { exact: true }).fill('8');
  await form.getByLabel('Motivo', { exact: true }).fill('Recepción inicial');
  await form.getByRole('button', { name: 'Confirmar entrada', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saldo confirmado: 8' })).toBeVisible();
  await expect(stock.locator('tbody tr').first().locator('td').nth(3)).toHaveText('8');
  await form
    .getByRole('combobox', { name: 'Tipo de movimiento', exact: true })
    .selectOption('exit');
  await form.getByLabel('Cantidad del movimiento', { exact: true }).fill('2');
  await form.getByLabel('Motivo', { exact: true }).fill('Entrega al área técnica');
  await form.getByRole('button', { name: 'Confirmar salida', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saldo confirmado: 6' })).toBeVisible();
  await expect(stock.locator('tbody tr').first().locator('td').nth(3)).toHaveText('6');
  await expect(stock.getByRole('cell', { name: 'Activo', exact: true })).toBeVisible();
  await form
    .getByRole('combobox', { name: 'Tipo de movimiento', exact: true })
    .selectOption('adjust');
  await form.getByLabel('Cantidad del movimiento', { exact: true }).fill('-1');
  await form.getByLabel('Motivo', { exact: true }).fill('Diferencia de conteo justificada');
  await form.getByRole('button', { name: 'Confirmar ajuste', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saldo confirmado: 5' })).toBeVisible();
  await expect(stock.locator('tbody tr').first().locator('td').nth(3)).toHaveText('5');
  await expect(stock.getByRole('cell', { name: 'Bajo mínimo', exact: true })).toBeVisible();
  await page.getByLabel('Tipo del historial', { exact: true }).selectOption('adjust');
  await expect(
    page.getByRole('table', { name: 'Historial de inventario' }).locator('tbody tr'),
  ).toHaveCount(1);
  await page.getByLabel('Tipo del historial', { exact: true }).selectOption('');
  let lost = false;
  const ids: string[] = [];
  await page.route(
    (url) => url.pathname.endsWith('/inventory/movements'),
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      ids.push(route.request().postDataJSON().operationId);
      if (!lost) {
        lost = true;
        const result = await route.fetch();
        expect(result.status()).toBe(201);
        await route.abort('failed');
      } else await route.continue();
    },
  );
  await form
    .getByRole('combobox', { name: 'Tipo de movimiento', exact: true })
    .selectOption('entry');
  await form.getByLabel('Cantidad del movimiento', { exact: true }).fill('2');
  await form.getByLabel('Motivo', { exact: true }).fill('Entrega con respuesta interrumpida');
  await form.getByRole('button', { name: 'Confirmar entrada', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Reintentar movimiento pendiente', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reintentar movimiento pendiente', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Movimiento ya registrado. Saldo confirmado: 7' }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  await expect(
    page.getByRole('table', { name: 'Historial de inventario' }).locator('tbody tr'),
  ).toHaveCount(4);
  await page.screenshot({ path: 'test-results/inventory-operations.png', fullPage: true });
  await page.getByRole('link', { name: 'Mis páginas', exact: true }).click();
  await page.getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Inventario operativo');
  await page.getByLabel('Dirección de la página', { exact: true }).fill('inventario');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByRole('button', { name: 'Inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('publicados');
  await page.getByRole('link', { name: 'Volver a páginas', exact: true }).click();
  await page.getByRole('link', { name: 'Equipo y proyecto', exact: true }).click();
  const operatorEmail = 'operator-' + stamp + '@example.com';
  await page.getByLabel('Correo operativo', { exact: true }).fill(operatorEmail);
  await page
    .getByRole('combobox', { name: 'Permiso operativo', exact: true })
    .selectOption('operator');
  await page.getByRole('button', { name: 'Generar invitación operativa', exact: true }).click();
  const invitation = await page
    .getByLabel('Enlace privado de aplicación', { exact: true })
    .inputValue();
  const operatorContext = await browser.newContext();
  try {
    const operator = await operatorContext.newPage();
    await operator.goto(invitation);
    await operator.getByLabel('Tu nombre', { exact: true }).fill('Operador almacén');
    await operator.getByLabel('Correo', { exact: true }).fill(operatorEmail);
    await operator.getByLabel('Contraseña', { exact: true }).fill('Clave-operativa-1234');
    await operator.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await expect(
      operator.getByRole('heading', { name: 'Tus aplicaciones', exact: true }),
    ).toBeVisible();
    await operator.getByRole('link', { name: /Abrir Almacén operativo/ }).click();
    await expect(operator).toHaveURL(new RegExp('5184/' + session.projects[0].slug + '/'));
    await operator.getByRole('button', { name: 'Seleccionar Martillo', exact: true }).click();
    const operatorForm = operator.getByRole('form', { name: 'Registrar movimiento', exact: true });
    await expect(
      operatorForm
        .getByRole('combobox', { name: 'Tipo de movimiento', exact: true })
        .locator('option[value=adjust]'),
    ).toHaveCount(0);
    await expect(operator.getByRole('button', { name: 'Guardar mínimo', exact: true })).toHaveCount(
      0,
    );
    await operatorForm.getByLabel('Cantidad del movimiento', { exact: true }).fill('1');
    await operatorForm.getByLabel('Motivo', { exact: true }).fill('Recepción del operador');
    await operatorForm.getByRole('button', { name: 'Confirmar entrada', exact: true }).click();
    await expect(
      operator.getByRole('status').filter({ hasText: 'Saldo confirmado: 8' }),
    ).toBeVisible();
    expect((await operatorContext.request.get(root + '/pages')).status()).toBe(404);
    expect(
      (
        await operatorContext.request.post(root + '/inventory/movements', {
          headers,
          data: {
            operationId: crypto.randomUUID(),
            productId: product.id,
            type: 'adjust',
            quantity: 1,
            expectedBalance: 8,
            reason: 'No autorizado',
          },
        })
      ).status(),
    ).toBe(403);
    await operator.screenshot({
      path: 'test-results/inventory-operator-runtime.png',
      fullPage: true,
    });
    await page.reload();
    await page
      .getByLabel('Permiso operativo de Operador almacén', { exact: true })
      .selectOption('none');
    await expect(
      page.getByLabel('Permiso operativo de Operador almacén', { exact: true }),
    ).toHaveCount(0);
    expect((await operatorContext.request.get(root + '/inventory/stock')).status()).toBe(404);
  } finally {
    await operatorContext.close();
  }
});
