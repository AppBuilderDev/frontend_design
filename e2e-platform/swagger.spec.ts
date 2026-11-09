import { test, expect } from '@playwright/test';
test('Swagger permite iniciar sesion y crear un recurso desde Try it out', async ({
  page,
  context,
}) => {
  const api = 'http://127.0.0.1:3101';
  const email = 'swagger-ui-' + Date.now() + '@example.test',
    password = 'Swagger-UI-test-1234';
  const response = await context.request.post(api + '/api/v1/auth/register', {
    headers: { 'X-Requested-With': 'AppBuilderDev' },
    data: { name: 'Swagger UI', email, password, organization: 'Swagger Demo' },
  });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  const projectId = session.projects[0].id;
  await context.clearCookies();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(api + '/docs/');
  await expect(page.getByRole('heading', { name: /AppBuilderDev API/ })).toBeVisible();
  const login = page
    .locator('.opblock-post')
    .filter({ has: page.locator('[data-path="/api/v1/auth/login"]') });
  await login.locator('.opblock-summary').click();
  await login.getByRole('button', { name: 'Try it out' }).click();
  await login.locator('textarea').fill(JSON.stringify({ email, password }));
  await login.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(
    login.locator('.live-responses-table .response-col_status:not(.col_header)'),
  ).toContainText('200');
  const create = page
    .locator('.opblock-post')
    .filter({ has: page.locator('[data-path="/api/v1/projects/{projectId}/resources"]') });
  await create.locator('.opblock-summary').click();
  await create.getByRole('button', { name: 'Try it out' }).click();
  await create.locator('input[placeholder="projectId"]').fill(projectId);
  await create
    .locator('textarea')
    .fill(
      JSON.stringify({
        name: 'Productos',
        key: 'productos',
        labelField: 'nombre',
        fields: [{ key: 'nombre', label: 'Nombre', type: 'text', required: true }],
      }),
    );
  await create.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(
    create.locator('.live-responses-table .response-col_status:not(.col_header)'),
  ).toContainText('201');
  const records = await context.request.get(
    api + '/api/v1/projects/' + projectId + '/resources/productos',
  );
  expect(records.status()).toBe(200);
  expect((await records.json()).items).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/swagger.png', fullPage: true });
});
