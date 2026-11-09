import { expect, test } from '@playwright/test';

test('conserva e informa cambios locales realizados mientras se guarda', async ({
  page,
  request,
}) => {
  const created = await request.post('http://127.0.0.1:3001/api/pages', {
    data: {
      name: 'Guardado pendiente',
      code: `pending-${Date.now()}`,
      status: 'draft',
      components: [{ id: 'heading', type: 'Heading', props: { text: 'Versión enviada' } }],
    },
  });
  expect(created.ok()).toBeTruthy();
  const initial = await created.json();
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const path = '**/api/pages/' + initial.id;
  await page.route(path, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const response = await route.fetch();
    await responseGate;
    await route.fulfill({ response });
  });
  try {
    await page.goto('/editor/' + initial.id);
    await page.getByRole('button', { name: 'Seleccionar elemento Título', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Guardando…', exact: true })).toBeDisabled();
    await page
      .getByRole('textbox', { name: 'Texto', exact: true })
      .fill('Cambio posterior al envío');
    release();
    await expect(
      page.getByText('Guardado. Tienes cambios locales pendientes adicionales.'),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Texto', exact: true })).toHaveValue(
      'Cambio posterior al envío',
    );
    await expect(page.getByRole('contentinfo')).toContainText('Cambios pendientes');
    const url = 'http://127.0.0.1:3001/api/public/pages/by-path?path=/' + initial.code;
    expect((await (await request.get(url)).json()).components[0].props.text).toBe(
      'Versión enviada',
    );
    await page.unroute(path);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(
      page.getByText('Cambios guardados y publicados. Ya están disponibles en Runtime.'),
    ).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('Todos los cambios guardados');
    expect((await (await request.get(url)).json()).components[0].props.text).toBe(
      'Cambio posterior al envío',
    );
  } finally {
    release();
    await request.delete('http://127.0.0.1:3001/api/pages/' + initial.id);
  }
});
