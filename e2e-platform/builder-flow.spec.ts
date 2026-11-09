import { test, expect } from '@playwright/test';
test('Nest -> catalogo HTTP -> TSX bidireccional -> tabla CRUD en Runtime', async ({
  page,
  context,
}) => {
  const api = 'http://127.0.0.1:3101/api/v1';
  const call = async (path: string, method = 'GET', data?: unknown) => {
    const r = await context.request.fetch(api + path, {
      method,
      headers: { 'X-Requested-With': 'AppBuilderDev' },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.status() === 204 ? undefined : r.json();
  };
  const session = await call('/auth/register', 'POST', {
    name: 'Constructor',
    organization: 'Experimento',
    email: 'builder-' + Date.now() + '@example.test',
    password: 'Password-builder-1234',
  });
  const id = session.projects[0].id,
    root = '/projects/' + id;
  const field = { key: 'nombre', label: 'Nombre', type: 'text', required: true };
  await call(root + '/resources', 'POST', {
    name: 'Productos',
    key: 'productos',
    labelField: 'nombre',
    fields: [field],
  });
  await page.goto('/workspace/routes');
  const routes: Record<string, string> = {};
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    await page.getByRole('button', { name: 'Registrar ruta', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre', { exact: true }).fill('Productos ' + method);
    await dialog.getByLabel('Metodo', { exact: true }).selectOption(method);
    await dialog
      .getByLabel('Ruta HTTP')
      .fill(
        '/api/v1/projects/{projectId}/resources/productos' +
          (['PUT', 'DELETE'].includes(method) ? '/:id' : ''),
      );
    await dialog.getByRole('button', { name: 'Guardar ruta' }).click();
    await expect(dialog).toHaveCount(0);
  }
  const endpoints = await call(root + '/endpoints');
  for (const endpoint of endpoints) routes[endpoint.method] = endpoint.id;
  const components = [
    { id: 'heading-sync', type: 'Heading', props: { text: 'Titulo visual', level: 'h1' } },
    {
      id: 'table-sync',
      type: 'RestTable',
      props: {
        title: 'Productos conectados',
        listEndpointId: routes.GET,
        createEndpointId: routes.POST,
        updateEndpointId: routes.PUT,
        deleteEndpointId: routes.DELETE,
      },
    },
  ];
  const saved = await call(root + '/pages', 'POST', {
    name: 'Experimento',
    code: 'experimento',
    status: 'draft',
    components,
  });
  await page.goto('/workspace/editor/' + saved.id);
  await page.getByRole('button', { name: 'Codigo', exact: true }).click();
  const source = page.getByRole('textbox', { name: 'Codigo TSX' });
  await expect(source).toContainText('Titulo visual');
  const before = await source.inputValue();
  await source.fill(before.replace('Titulo visual', 'Titulo desde codigo'));
  await page.getByRole('button', { name: 'Aplicar codigo al diseno' }).click();
  await expect(page.locator('[data-component-id="heading-sync"]')).toContainText(
    'Titulo desde codigo',
  );
  // Visual change must regenerate code, while preserving route IDs.
  await page.locator('[data-component-id="heading-sync"]').click();
  await page.getByRole('textbox', { name: 'Texto', exact: true }).fill('Titulo final visual');
  await expect(source).toContainText('Titulo final visual');
  await expect(source).toContainText(routes.GET);
  const valid = await source.inputValue();
  await source.fill(valid.replace('"Titulo final visual"', 'window.location'));
  await page.getByRole('button', { name: 'Aplicar codigo al diseno' }).click();
  await expect(page.getByRole('alert')).toContainText('Solo literales JSON');
  await expect(page.locator('[data-component-id="heading-sync"]')).toContainText(
    'Titulo final visual',
  );
  await source.fill(valid);
  await page.getByRole('button', { name: 'Aplicar codigo al diseno' }).click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('guardados y publicados');
  const runtime = await context.newPage();
  await runtime.goto('http://127.0.0.1:5184/p/' + id + '/experimento');
  await expect(runtime.getByRole('heading', { name: 'Titulo final visual' })).toBeVisible();
  await expect(runtime.getByText('No hay registros.', { exact: true })).toBeVisible();
  await runtime.getByRole('button', { name: 'Nuevo registro', exact: true }).click();
  await runtime.getByLabel('Nombre', { exact: true }).fill('Creado con POST');
  await runtime.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(runtime.getByRole('cell', { name: 'Creado con POST', exact: true })).toBeVisible();
  await runtime.getByRole('button', { name: /Editar registro/ }).click();
  await runtime.getByLabel('Nombre', { exact: true }).fill('Editado con PUT');
  await runtime.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(runtime.getByRole('cell', { name: 'Editado con PUT', exact: true })).toBeVisible();
  runtime.on('dialog', (dialog) => dialog.accept());
  await runtime.getByRole('button', { name: /Eliminar registro/ }).click();
  await expect(runtime.getByText('No hay registros.', { exact: true })).toBeVisible();
  const data = await call('/runtime' + root + '/pages/by-path?path=/experimento');
  expect(data.endpoints).toHaveLength(4);
  expect(data.components[1].props.listEndpointId).toBe(routes.GET);
  await page.screenshot({ path: 'test-results/code-sync.png', fullPage: true });
  await runtime.screenshot({ path: 'test-results/rest-runtime.png', fullPage: true });
});
