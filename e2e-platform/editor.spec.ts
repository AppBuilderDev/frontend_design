import { expect, test, type Locator } from '@playwright/test';
test('conserva arrastre Craft, alineación y espaciado cero en el proyecto privado', async ({
  page,
  context,
}) => {
  const headers = { 'X-Requested-With': 'AppBuilderDev' };
  const api = 'http://127.0.0.1:5183/api/v1';
  const signup = await context.request.post(api + '/auth/register', {
    headers,
    data: {
      name: 'Diseñador',
      organization: 'Prueba visual',
      email: 'visual-' + Date.now() + '@example.com',
      password: 'Clave-visual-123456',
    },
  });
  expect(signup.ok()).toBe(true);
  const session = await signup.json();
  const project = session.projects[0].id;
  const created = await context.request.post(api + '/projects/' + project + '/pages', {
    headers,
    data: {
      name: 'Distribución',
      code: 'distribucion',
      status: 'draft',
      components: [
        {
          id: 'container',
          type: 'Container',
          props: { padding: '24px', gap: '0px' },
          children: [
            { id: 'button', type: 'Button', props: { text: 'Comenzar', textAlign: 'right' } },
          ],
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  const initial = await created.json();
  await page.goto('/workspace/editor/' + initial.id);
  await page.getByRole('button', { name: 'Seleccionar capa Container', exact: true }).click();
  const container = page.locator('.builder-container:visible'),
    button = page.locator('.builder-button:visible');
  const offsets = async (c: Locator, b: Locator) => {
    const outer = await c.boundingBox(),
      inner = await b.boundingBox();
    if (!outer || !inner) throw Error('Sin dimensiones');
    return {
      top: inner.y - outer.y,
      left: inner.x - outer.x,
      bottom: outer.y + outer.height - inner.y - inner.height,
    };
  };
  await page.getByLabel('Espaciado interior', { exact: true }).fill('0');
  await page.getByLabel('Alineación horizontal', { exact: true }).selectOption('flex-start');
  await expect.poll(() => offsets(container, button)).toEqual({ top: 0, left: 0, bottom: 0 });
  await page.getByLabel('Alineación horizontal', { exact: true }).selectOption('center');
  await expect
    .poll(async () => {
      const c = await container.boundingBox(),
        b = await button.boundingBox();
      return c && b ? (b.x + b.width / 2 - c.x) / c.width : 0;
    })
    .toBeCloseTo(0.5, 2);
  await page.getByRole('button', { name: 'Página · nivel raíz', exact: true }).click();
  const root = page.getByTestId('craft-root');
  await page
    .getByRole('button', { name: 'Card', exact: true })
    .dragTo(root, { targetPosition: { x: 180, y: 180 } });
  await expect(page.locator('[data-component-type="Card"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await expect(page.locator('[data-component-type="Card"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await expect(page.locator('[data-component-type="Card"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('publicados');
  const runtime = await context.newPage();
  await runtime.goto('http://127.0.0.1:5184/p/' + project + '/distribucion');
  await expect(runtime.locator('.builder-container')).toHaveCSS('padding', '0px');
  await expect
    .poll(async () => {
      const c = await runtime.locator('.builder-container').boundingBox(),
        b = await runtime.locator('.builder-button').boundingBox();
      return c && b ? (b.x + b.width / 2 - c.x) / c.width : 0;
    })
    .toBeCloseTo(0.5, 2);
});
