import { test, expect } from '@playwright/test';
test('configura ambientes, cifra credenciales, publica una conexión y la consulta desde Runtime', async ({
  page,
  context,
  browser,
}) => {
  const api = 'http://127.0.0.1:5183/api/v1',
    headers = { 'X-Requested-With': 'AppBuilderDev' },
    stamp = Date.now();
  const signup = await context.request.post(api + '/auth/register', {
    headers,
    data: {
      name: 'Dueño conexiones',
      organization: 'Catálogo conectado',
      email: 'connections-' + stamp + '@example.com',
      password: 'Clave-conexiones-1234',
    },
  });
  const session = await signup.json(),
    project = session.projects[0].id,
    root = api + '/projects/' + project;
  await page.goto('/workspace/services');
  await page.getByRole('button', { name: 'Crear conexión externa', exact: true }).click();
  const designer = page.getByRole('dialog');
  await designer.getByLabel('Nombre de conexión', { exact: true }).fill('Catálogo externo');
  await designer.getByLabel('Identificador de conexión', { exact: true }).fill('catalogo_externo');
  await designer.getByRole('checkbox', { name: 'Usuarios de consulta', exact: true }).check();
  await designer.getByRole('button', { name: 'Agregar campo de respuesta', exact: true }).click();
  await designer.getByLabel('Etiqueta de respuesta 2', { exact: true }).fill('Precio');
  await designer.getByLabel('Identificador de respuesta 2', { exact: true }).fill('precio');
  await designer.getByLabel('Ruta del campo 2', { exact: true }).fill('precio');
  await designer
    .getByRole('combobox', { name: 'Tipo de respuesta 2', exact: true })
    .selectOption('money');
  await designer.getByRole('button', { name: 'Guardar contrato de conexión', exact: true }).click();
  await expect(designer).toHaveCount(0);
  const connection = (await (await context.request.get(root + '/connections')).json())[0];
  await page.getByRole('button', { name: 'Configurar pruebas', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Origen HTTPS', { exact: true }).fill('https://catalog.example.test');
  await dialog.getByLabel('Ruta fija', { exact: true }).fill('/test/catalog');
  await dialog
    .getByRole('combobox', { name: 'Autenticación de ambiente', exact: true })
    .selectOption('apiKey');
  await dialog.getByLabel('Credencial', { exact: true }).fill('e2e-test-credential');
  await dialog.getByRole('button', { name: 'Guardar ambiente', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Configurar producción', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Origen HTTPS', { exact: true }).fill('https://catalog.example.test');
  await dialog.getByLabel('Ruta fija', { exact: true }).fill('/production/catalog');
  await dialog
    .getByRole('combobox', { name: 'Autenticación de ambiente', exact: true })
    .selectOption('bearer');
  await dialog.getByLabel('Credencial', { exact: true }).fill('e2e-prod-credential');
  await dialog.getByRole('button', { name: 'Guardar ambiente', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const settings = await (
    await context.request.get(root + '/connections/' + connection.id + '/environments')
  ).text();
  expect(settings).not.toContain('e2e-prod-credential');
  expect(settings).not.toContain('e2e-test-credential');
  await page
    .getByRole('button', { name: 'Publicar conexión Catálogo externo', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Comprueba este contrato en producción');
  await page.getByRole('button', { name: 'Probar conexión Catálogo externo', exact: true }).click();
  const probe = page.getByRole('dialog');
  await probe.getByRole('button', { name: 'Ejecutar prueba de conexión', exact: true }).click();
  await expect(probe.getByRole('cell', { name: 'Producto de prueba', exact: true })).toBeVisible();
  await probe
    .getByRole('combobox', { name: 'Ambiente de prueba', exact: true })
    .selectOption('production');
  await probe.getByRole('button', { name: 'Ejecutar prueba de conexión', exact: true }).click();
  await expect(
    probe.getByRole('cell', { name: 'Producto de producción', exact: true }),
  ).toBeVisible();
  await expect(probe.getByRole('cell', { name: 'S/ 19.90', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/connection-probe.png' });
  await probe.getByRole('button', { name: 'Cerrar prueba', exact: true }).click();
  await page
    .getByRole('button', { name: 'Publicar conexión Catálogo externo', exact: true })
    .click();
  await expect(page.getByText('Versión predeterminada 1', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mis páginas', exact: true }).click();
  await page.getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Catálogo del proveedor');
  await page.getByLabel('Dirección de la página', { exact: true }).fill('proveedor');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByRole('button', { name: 'Consulta externa', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Conexión externa seleccionada', exact: true })
    .selectOption(connection.id);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('publicados');
  const published = await (
    await context.request.get(
      api + '/runtime/projects/' + project + '/pages/by-path?path=/proveedor',
    )
  ).text();
  for (const hidden of [
    'e2e-prod-credential',
    'e2e-test-credential',
    'catalog.example.test',
    'responsePath',
  ])
    expect(published).not.toContain(hidden);
  const invitation = await (
    await context.request.post(root + '/application/invitations', {
      headers,
      data: { email: 'viewer-' + stamp + '@example.com', role: 'viewer' },
    })
  ).json();
  const viewerContext = await browser.newContext();
  try {
    const registration = await viewerContext.request.post(api + '/auth/register', {
      headers,
      data: {
        name: 'Consulta externa',
        email: 'viewer-' + stamp + '@example.com',
        password: 'Clave-conexiones-1234',
        invitation: invitation.token,
      },
    });
    const viewer = await registration.json();
    expect(viewer.projects).toHaveLength(0);
    expect(viewer.applications[0].id).toBe(project);
    const runtime = await viewerContext.newPage();
    const remoteRequests: string[] = [];
    runtime.on('request', (request) => {
      if (new URL(request.url()).hostname === 'catalog.example.test')
        remoteRequests.push(request.url());
    });
    await runtime.goto('http://127.0.0.1:5184/p/' + project + '/proveedor');
    await runtime.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(
      runtime.getByRole('cell', { name: 'Producto de producción', exact: true }),
    ).toBeVisible();
    await expect(runtime.getByRole('cell', { name: 'S/ 19.90', exact: true })).toBeVisible();
    expect(remoteRequests).toEqual([]);
    await runtime.getByLabel('Buscar', { exact: true }).fill('incompatible');
    await runtime.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(runtime.getByRole('alert')).toContainText('tipo de Precio');
    await runtime.getByLabel('Buscar', { exact: true }).fill('empty');
    await runtime.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(
      runtime.getByText('La consulta no devolvió resultados.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Volver a páginas', exact: true }).click();
    await page.getByRole('link', { name: 'Acciones y conexiones', exact: true }).click();
    await page.getByRole('button', { name: 'Configurar producción', exact: true }).click();
    const rotate = page.getByRole('dialog');
    await rotate.getByLabel('Ruta fija', { exact: true }).fill('/production/rotated');
    await rotate.getByLabel('Credencial', { exact: true }).fill('e2e-rotated-credential');
    await rotate.getByRole('button', { name: 'Guardar ambiente', exact: true }).click();
    await expect(rotate).toHaveCount(0);
    await runtime.getByLabel('Buscar', { exact: true }).fill('');
    await runtime.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(runtime.getByRole('alert')).toContainText('necesita comprobarse');
    await page
      .getByRole('button', { name: 'Probar conexión Catálogo externo', exact: true })
      .click();
    const verify = page.getByRole('dialog');
    await verify
      .getByRole('combobox', { name: 'Ambiente de prueba', exact: true })
      .selectOption('production');
    await verify
      .getByRole('combobox', { name: 'Contrato de prueba', exact: true })
      .selectOption('1');
    await verify.getByRole('button', { name: 'Ejecutar prueba de conexión', exact: true }).click();
    await expect(
      verify.getByRole('cell', { name: 'Producto actualizado', exact: true }),
    ).toBeVisible();
    await verify.getByRole('button', { name: 'Cerrar prueba', exact: true }).click();
    await runtime.getByRole('button', { name: 'Consultar', exact: true }).click();
    await expect(
      runtime.getByRole('cell', { name: 'Producto actualizado', exact: true }),
    ).toBeVisible();
    await runtime.screenshot({ path: 'test-results/connection-runtime.png', fullPage: true });
    expect(
      (
        await viewerContext.request.get(root + '/connections/' + connection.id + '/environments')
      ).status(),
    ).toBe(404);
    expect(
      (
        await viewerContext.request.post(root + '/connections/' + connection.id + '/query', {
          headers,
          data: { version: 1, input: {}, environment: 'test' },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await viewerContext.close();
  }
});
