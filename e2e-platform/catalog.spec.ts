import { test, expect } from '@playwright/test';
import { extraDefinitions } from '../src/components/catalog/definitions';

test('catalogo ampliado: inspector, TSX, publicacion y componentes interactivos en Runtime', async ({
  page,
  context,
}) => {
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 1710, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const api = 'http://127.0.0.1:5183/api/v1';
  const call = async (path: string, method = 'GET', data?: unknown) => {
    const response = await context.request.fetch(api + path, {
      method,
      headers: { 'X-Requested-With': 'AppBuilderDev' },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const session = await call('/auth/register', 'POST', {
    name: 'Componentes',
    organization: 'Catalogo completo',
    email: 'catalog-' + Date.now() + '@example.test',
    password: 'Catalogo-seguro-1234',
  });
  const project = session.projects[0];
  const base = '/projects/' + project.id;
  const components = Object.entries(extraDefinitions).map(([type, definition]) => ({
    id: 'sample-' + type,
    type,
    props: definition.defaults,
    ...(definition.container ? { children: [] } : {}),
  }));
  const saved = await call(base + '/pages', 'POST', {
    name: 'Catalogo',
    code: 'catalogo',
    status: 'draft',
    components,
  });
  await call(base + '/pages', 'POST', {
    name: 'Productos',
    code: 'productos',
    status: 'published',
    components: [
      { id: 'destination', type: 'Heading', props: { text: 'Destino de navegacion', level: 'h1' } },
    ],
  });
  await page.goto('/workspace/editor/' + saved.id);
  await expect(page.locator('.canvas [data-component-type]')).toHaveCount(32);
  await page.locator('[data-component-id="sample-Navbar"]').click();
  await page.getByLabel('Marca', { exact: true }).fill('Mi tienda conectada');
  await expect(page.locator('.canvas .bc-navbar')).toContainText('Mi tienda conectada');
  await page.getByLabel('Buscar elementos', { exact: true }).fill('fecha');
  await expect(page.getByRole('button', { name: 'Fecha', exact: true })).toBeVisible();
  await page.getByLabel('Buscar elementos', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Codigo', exact: true }).click();
  const source = page.getByRole('textbox', { name: 'Codigo TSX', exact: true });
  await expect(source).toContainText('Mi tienda conectada');
  await expect(source).toContainText('<Range');
  await source.fill((await source.inputValue()) + '\n');
  await page.getByRole('button', { name: 'Aplicar codigo al diseno', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'publicados' })).toBeVisible();
  const runtime = await context.newPage();
  runtime.on('pageerror', (error) => errors.push(error.message));
  await runtime.goto('http://127.0.0.1:5184/' + project.slug + '/catalogo');
  await expect(runtime.locator('.bc-navbar')).toContainText('Mi tienda conectada');
  await expect(runtime.locator('.bc-accordion summary')).toHaveCount(2);
  await runtime.locator('.bc-accordion summary').first().click();
  await expect(runtime.locator('.bc-accordion details').first()).toHaveAttribute('open', '');
  const tabs = runtime.getByRole('tab');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(runtime.getByRole('tabpanel')).toContainText('adicional');
  await tabs.nth(1).press('ArrowRight');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await runtime.getByRole('switch').check();
  await expect(runtime.getByRole('switch')).toBeChecked();
  await runtime.getByRole('combobox').selectOption({ index: 1 });
  await runtime.getByRole('slider').press('End');
  await expect(runtime.locator('.bc-range output')).toHaveText('100');
  await expect(runtime.getByRole('progressbar')).toHaveAttribute('value', '65');
  await runtime.screenshot({ path: 'test-results/catalog-runtime.png', fullPage: true });
  await runtime.setViewportSize({ width: 390, height: 844 });
  expect(await runtime.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
    false,
  );
  await runtime.screenshot({ path: 'test-results/catalog-mobile.png', fullPage: true });
  await runtime.locator('.bc-navbar').getByRole('link', { name: 'Productos', exact: true }).click();
  await expect(runtime).toHaveURL('http://127.0.0.1:5184/' + project.slug + '/productos');
  await expect(
    runtime.getByRole('heading', { name: 'Destino de navegacion', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
