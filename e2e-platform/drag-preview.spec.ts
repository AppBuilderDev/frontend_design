import { test, expect } from '@playwright/test';

test('reordena componentes colocados, anida y muestra GET real sin escrituras en Design', async ({
  page,
  context,
}) => {
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1710, height: 1000 });
  const headers = { 'X-Requested-With': 'AppBuilderDev' };
  const call = async (path: string, method = 'GET', data?: unknown) => {
    const response = await context.request.fetch('http://127.0.0.1:5183/api/v1' + path, {
      method,
      headers,
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const session = await call('/auth/register', 'POST', {
    name: 'Arrastre',
    email: 'drag-' + Date.now() + '@example.test',
    password: 'Arrastre-prueba-1234',
    organization: 'Editor arrastre',
  });
  const base = '/projects/' + session.projects[0].id;
  const fields = [{ key: 'nombre', label: 'Nombre', type: 'text', required: true }];
  await call(base + '/resources', 'POST', {
    name: 'Productos',
    key: 'productos',
    labelField: 'nombre',
    fields,
  });
  await call(base + '/resources/productos', 'POST', { nombre: 'Producto visible en Design' });
  const endpoints: Record<string, string> = {};
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const endpoint = await call(base + '/endpoints', 'POST', {
      name: 'Productos ' + method,
      method,
      path:
        '/api/v1/projects/{projectId}/resources/productos' +
        (['PUT', 'DELETE'].includes(method) ? '/:id' : ''),
      fields,
      itemsPath: 'items',
    });
    endpoints[method] = endpoint.id;
  }
  const created = await call(base + '/pages', 'POST', {
    name: 'Arrastre',
    code: 'arrastre',
    status: 'draft',
    components: [
      { id: 'first', type: 'Heading', props: { text: 'Primero', level: 'h1' } },
      { id: 'second', type: 'Paragraph', props: { text: 'Segundo' } },
      { id: 'box', type: 'Container', props: { padding: '30px' }, children: [] },
      {
        id: 'table',
        type: 'RestTable',
        props: {
          title: 'Productos reales',
          listEndpointId: endpoints.GET,
          createEndpointId: endpoints.POST,
          updateEndpointId: endpoints.PUT,
          deleteEndpointId: endpoints.DELETE,
        },
      },
    ],
  });
  const writes: string[] = [];
  page.on('request', (request) => {
    if (/\/resources\/productos/.test(request.url()) && request.method() !== 'GET')
      writes.push(request.method());
  });
  await page.goto('/workspace/editor/' + created.id);
  await expect(
    page.getByRole('cell', { name: 'Producto visible en Design', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nombre', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo registro', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Editar registro/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Eliminar registro/ })).toBeDisabled();
  const root = page.getByTestId('craft-root');
  const first = page.locator('[data-component-id="first"]');
  const second = page.locator('[data-component-id="second"]');
  await second.dragTo(first, { targetPosition: { x: 40, y: 2 } });
  await expect(root.locator(':scope > .canvas-node').first()).toHaveAttribute(
    'data-component-id',
    'second',
  );
  const container = page.locator('[data-component-id="box"]');
  await second.dragTo(container);
  await expect(container.locator('[data-component-id="second"]')).toHaveCount(1);
  await second.hover();
  await second.locator(':scope > .node-handle').dragTo(first, { targetPosition: { x: 60, y: 2 } });
  await expect(root.locator(':scope > .canvas-node').first()).toHaveAttribute(
    'data-component-id',
    'second',
  );
  await expect(container.locator('[data-component-id="second"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('guardad');
  await page.reload();
  await expect(root.locator(':scope > .canvas-node').first()).toHaveAttribute(
    'data-component-id',
    'second',
  );
  await expect(
    page.getByRole('cell', { name: 'Producto visible en Design', exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({ path: 'test-results/drag-table-design.png', fullPage: true });
});
