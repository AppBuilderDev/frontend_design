import { test, expect } from '@playwright/test';
test('organización → inventario → editor → publicación → datos en Runtime', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
  await page.getByLabel('Tu nombre', { exact: true }).fill('Carlo prueba');
  await page.getByLabel('Nombre de tu negocio o equipo', { exact: true }).fill('Almacén de prueba');
  await page.getByLabel('Correo', { exact: true }).fill('browser-' + Date.now() + '@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-del-almacen-123');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Mis datos', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mis datos', exact: true }).click();
  await page.getByRole('button', { name: 'Comenzar con inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Categorías', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Alimentos');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Registro guardado' })).toBeVisible();
  await page.getByRole('button', { name: 'Unidades', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Unidad');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Registro guardado' })).toBeVisible();
  await page.getByRole('button', { name: 'Productos', exact: true }).click();
  await page.getByLabel('Nombre *', { exact: true }).fill('Arroz');
  await page.getByLabel('SKU *', { exact: true }).fill('ARR-1');
  await page
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption({ label: 'Alimentos' });
  await page
    .getByRole('combobox', { name: 'Unidad', exact: true })
    .selectOption({ label: 'Unidad' });
  await page.getByLabel('Precio (S/) *', { exact: true }).fill('12.345');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(
    page.getByText('Usa un importe con hasta dos decimales', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Precio (S/) *', { exact: true }).fill('12.34');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Arroz', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver registro', exact: true }).click();
  await page.getByLabel('Precio (S/) *', { exact: true }).fill('13.10');
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Registro guardado' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'S/ 13.10', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/inventory-workspace.png', fullPage: true });
  await page.getByRole('link', { name: 'Acciones y conexiones', exact: true }).click();
  await page.getByRole('button', { name: 'Probar consulta de Productos', exact: true }).click();
  await expect(page.locator('.service-response')).toContainText('1310');
  await page.getByRole('link', { name: 'Mis páginas', exact: true }).click();
  await page.getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Mi inventario');
  await page.getByLabel('Dirección de la página', { exact: true }).fill('inventario');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear página', exact: true }).click();
  await expect(page).toHaveURL(/workspace\/editor/);
  await page.getByRole('button', { name: 'Título', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('Mi almacén');
  await page.getByRole('button', { name: 'Tabla de datos', exact: true }).click();
  await page.getByLabel('Entidad conectada', { exact: true }).selectOption({ label: 'Productos' });
  await page.getByRole('button', { name: 'Formulario', exact: true }).click();
  await page.getByLabel('Entidad conectada', { exact: true }).selectOption({ label: 'Productos' });
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Borrador guardado');
  const session = await (
    await context.request.get('http://127.0.0.1:5183/api/v1/auth/session')
  ).json();
  const id = session.projects[0].id;
  const runtime = await context.newPage();
  runtime.on('pageerror', (e) => errors.push(e.message));
  await runtime.goto('http://127.0.0.1:5184/p/' + id + '/inventario');
  await expect(runtime.getByText('Página no encontrada', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('publicad');
  await runtime.reload();
  await expect(runtime.getByRole('heading', { name: 'Mi almacén', exact: true })).toBeVisible();
  await expect(runtime.getByRole('cell', { name: 'Arroz', exact: true })).toBeVisible();
  await runtime.getByLabel('Nombre *', { exact: true }).fill('Aceite');
  await runtime.getByLabel('SKU *', { exact: true }).fill('ACE-1');
  await runtime
    .getByRole('combobox', { name: 'Categoría', exact: true })
    .selectOption({ label: 'Alimentos' });
  await runtime
    .getByRole('combobox', { name: 'Unidad', exact: true })
    .selectOption({ label: 'Unidad' });
  await runtime.getByLabel('Precio (S/) *', { exact: true }).fill('7.10');
  await runtime.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(runtime.getByRole('cell', { name: 'Aceite', exact: true })).toBeVisible();
  await runtime.screenshot({ path: 'test-results/inventory-runtime.png', fullPage: true });
  expect(errors).toEqual([]);
});
