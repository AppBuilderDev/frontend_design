import { test, expect } from '@playwright/test';

test('ruta corta exige acceso y publicación y abre la URL del proyecto', async ({
  page,
  context,
  browser,
}) => {
  const headers = { 'X-Requested-With': 'AppBuilderDev' };
  const api = 'http://127.0.0.1:5183/api/v1';
  const email = `route-${Date.now()}@example.com`;
  const password = 'Ruta-segura-123456';
  const signup = await context.request.post(api + '/auth/register', {
    headers,
    data: { name: 'Ruta', organization: 'UNSA', email, password },
  });
  expect(signup.ok()).toBe(true);
  const session = await signup.json();
  const project = session.projects[0].id;
  const body = {
    name: 'UNSA',
    code: 'unsa',
    status: 'draft',
    components: [{ id: 'title', type: 'Heading', props: { text: 'UNSA Tareas', level: 'h1' } }],
  };
  const created = await context.request.post(`${api}/projects/${project}/pages`, {
    headers,
    data: body,
  });
  expect(created.ok()).toBe(true);
  const draft = await created.json();
  await page.goto('http://127.0.0.1:5184/unsa');
  await expect(
    page.getByRole('heading', { name: 'Página no encontrada', exact: true }),
  ).toBeVisible();
  const published = await context.request.put(`${api}/projects/${project}/pages/${draft.id}`, {
    headers,
    data: { ...body, revision: draft.revision, status: 'published' },
  });
  expect(published.ok()).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(`http://127.0.0.1:5184/p/${project}/unsa`);
  await expect(page.getByRole('heading', { name: 'UNSA Tareas', exact: true })).toBeVisible();

  const anonymous = await browser.newContext();
  const login = await anonymous.newPage();
  await login.goto('http://127.0.0.1:5184/unsa');
  await expect(
    login.getByRole('heading', { name: 'Accede a tu aplicación', exact: true }),
  ).toBeVisible();
  await login.getByLabel('Correo', { exact: true }).fill(email);
  await login.getByLabel('Contraseña', { exact: true }).fill(password);
  await login.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(login.getByRole('heading', { name: 'UNSA Tareas', exact: true })).toBeVisible();
  await anonymous.close();

  // Multiple authorized matches must offer a choice, never guess a project.
  await page.route('**/api/v1/auth/session', (route) =>
    route.fulfill({
      json: {
        ...session,
        projects: [
          session.projects[0],
          { ...session.projects[0], id: 'second-project', name: 'Otro proyecto' },
        ],
      },
    }),
  );
  await page.route('**/api/v1/runtime/projects/second-project/navigation', (route) =>
    route.fulfill({ json: { pages: [{ name: 'Otra UNSA', code: 'unsa' }] } }),
  );
  await page.goto('http://127.0.0.1:5184/unsa');
  await expect(
    page.getByRole('heading', { name: '¿Qué aplicación quieres abrir?', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Elegir aplicación' }).getByRole('link'),
  ).toHaveCount(2);
});
