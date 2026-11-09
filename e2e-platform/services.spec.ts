import { test, expect } from '@playwright/test';
test('diseña cuatro pasos, simula sin cambios y ejecuta versiones desde Runtime con reintento seguro', async ({
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
      name: 'Constructor servicios',
      organization: 'Operaciones propias',
      email: 'service-' + stamp + '@example.com',
      password: 'Clave-servicios-1234',
    },
  });
  const session = await signup.json(),
    project = session.projects[0].id,
    root = api + '/projects/' + project;
  const box = await (
    await context.request.post(root + '/entities', {
      headers,
      data: {
        name: 'Cajas',
        key: 'cajas',
        labelField: 'nombre',
        fields: [
          { key: 'nombre', label: 'Nombre', type: 'text', required: true },
          { key: 'capacidad', label: 'Capacidad', type: 'integer', required: true, min: 0 },
        ],
      },
    })
  ).json();
  const logs = await (
    await context.request.post(root + '/entities', {
      headers,
      data: {
        name: 'Reservas',
        key: 'reservas',
        labelField: 'motivo',
        fields: [
          { key: 'motivo', label: 'Motivo', type: 'text', required: true },
          {
            key: 'caja',
            label: 'Caja',
            type: 'relation',
            required: true,
            relationEntityId: box.id,
          },
          { key: 'cantidad', label: 'Cantidad', type: 'integer', required: true, min: 1 },
        ],
      },
    })
  ).json();
  const record = await (
    await context.request.post(root + '/services/' + box.id + '/records', {
      headers,
      data: { values: { nombre: 'Principal', capacidad: 5 } },
    })
  ).json();
  await page.goto('/workspace/services');
  await page
    .getByRole('combobox', { name: 'Entidad inicial del servicio', exact: true })
    .selectOption(box.id);
  await page
    .getByRole('combobox', { name: 'Plantilla del servicio', exact: true })
    .selectOption('decrement');
  await page.getByRole('button', { name: 'Crear servicio', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre del servicio', { exact: true }).fill('Reservar capacidad');
  await dialog.getByLabel('Identificador del servicio', { exact: true }).fill('reservar_capacidad');
  await dialog
    .getByRole('checkbox', {
      name: 'Permitir ejecución a operadores de la aplicación',
      exact: true,
    })
    .check();
  await dialog.getByRole('tab', { name: 'Pasos', exact: true }).click();
  await dialog.getByRole('button', { name: 'Agregar: Crear registro', exact: true }).click();
  const create = dialog.locator('.operation-step').nth(3);
  await create
    .getByRole('combobox', { name: 'Entidad del paso 4', exact: true })
    .selectOption(logs.id);
  async function addField(key: string) {
    await create
      .getByRole('combobox', { name: 'Agregar campo de destino', exact: true })
      .selectOption(key);
    await create.getByRole('button', { name: 'Agregar valor', exact: true }).click();
    return create
      .locator('.operation-assignment')
      .filter({ has: page.locator('small', { hasText: new RegExp('^' + key + '$') }) });
  }
  const reason = await addField('motivo');
  await reason
    .getByRole('textbox', { name: 'Valor fijo', exact: true })
    .fill('Reserva de capacidad');
  const relation = await addField('caja');
  await relation
    .getByRole('combobox', { name: 'Origen del valor', exact: true })
    .selectOption('record');
  const quantity = await addField('cantidad');
  await quantity
    .getByRole('combobox', { name: 'Origen del valor', exact: true })
    .selectOption('input');
  await quantity
    .getByRole('combobox', { name: 'Entrada de origen', exact: true })
    .selectOption('cantidad');
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: 'test-results/services-designer.png' });
  await dialog.getByRole('button', { name: 'Guardar borrador del servicio', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const operation = (await (await context.request.get(root + '/operations')).json())[0];
  expect(operation.draft.steps).toHaveLength(4);
  await page.getByRole('button', { name: 'Simular Reservar capacidad', exact: true }).click();
  const simulation = page.getByRole('dialog');
  await simulation
    .getByRole('combobox', { name: 'Registro *', exact: true })
    .selectOption({ label: 'Principal' });
  await simulation.getByLabel('Cantidad *', { exact: true }).fill('2');
  await simulation.getByRole('button', { name: 'Ejecutar simulación', exact: true }).click();
  await expect(simulation.getByRole('status')).toContainText('Ningún cambio fue guardado');
  expect(
    (
      await (
        await context.request.get(root + '/services/' + box.id + '/records/' + record.id)
      ).json()
    ).values.capacidad,
  ).toBe(5);
  expect(
    (await (await context.request.get(root + '/services/' + logs.id + '/records')).json()).total,
  ).toBe(0);
  await simulation.getByRole('button', { name: 'Cerrar simulación', exact: true }).click();
  await page
    .getByRole('button', { name: 'Publicar servicio Reservar capacidad', exact: true })
    .click();
  await expect(page.getByText('Versión predeterminada 1', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Mis páginas', exact: true }).click();
  await page.getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Reserva de cajas');
  await page.getByLabel('Dirección de la página', { exact: true }).fill('reservar');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear página', exact: true }).click();
  await page.getByRole('button', { name: 'Formulario de acción', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Servicio conectado', exact: true })
    .selectOption(operation.id);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('publicados');
  const pageId = page.url().split('/').pop()!;
  const runtime = await context.newPage();
  await runtime.goto('http://127.0.0.1:5184/p/' + project + '/reservar');
  const runtimeForm = runtime.getByRole('form', {
    name: 'Ejecutar Reservar capacidad',
    exact: true,
  });
  await runtimeForm
    .getByRole('combobox', { name: 'Registro *', exact: true })
    .selectOption({ label: 'Principal' });
  await runtimeForm.getByLabel('Cantidad *', { exact: true }).fill('2');
  await runtimeForm.getByRole('button', { name: 'Ejecutar servicio', exact: true }).click();
  await expect(runtime.getByRole('status')).toContainText('Servicio ejecutado');
  await expect(runtime.locator('dd')).toContainText(['3']);
  let lost = false;
  const ids: string[] = [];
  await runtime.route(
    (url) => url.pathname.endsWith('/operations/' + operation.id + '/execute'),
    async (route) => {
      ids.push(route.request().postDataJSON().operationId);
      if (!lost) {
        lost = true;
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        await route.abort('failed');
      } else await route.continue();
    },
  );
  await runtimeForm
    .getByRole('combobox', { name: 'Registro *', exact: true })
    .selectOption({ label: 'Principal' });
  await runtimeForm.getByLabel('Cantidad *', { exact: true }).fill('1');
  await runtimeForm.getByRole('button', { name: 'Ejecutar servicio', exact: true }).click();
  await expect(
    runtime.getByRole('button', { name: 'Reintentar ejecución pendiente', exact: true }),
  ).toBeVisible();
  await runtime.reload();
  await runtime
    .getByRole('button', { name: 'Reintentar ejecución pendiente', exact: true })
    .click();
  await expect(
    runtime.getByRole('status').filter({ hasText: 'La ejecución ya estaba confirmada' }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  expect(
    (await (await context.request.get(root + '/services/' + logs.id + '/records')).json()).total,
  ).toBe(2);
  await page.getByRole('link', { name: 'Volver a páginas', exact: true }).click();
  await page.getByRole('link', { name: 'Acciones y conexiones', exact: true }).click();
  await page
    .getByRole('button', { name: 'Editar servicio Reservar capacidad', exact: true })
    .click();
  const edit = page.getByRole('dialog');
  await edit.getByRole('tab', { name: 'Resultado', exact: true }).click();
  await edit
    .getByRole('textbox', { name: 'Nuevo campo de resultado', exact: true })
    .fill('version_resultado');
  await edit.getByRole('button', { name: 'Agregar valor', exact: true }).last().click();
  await edit.getByRole('textbox', { name: 'Valor fijo', exact: true }).fill('v2');
  await edit.getByRole('button', { name: 'Guardar borrador del servicio', exact: true }).click();
  await expect(edit).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Publicar servicio Reservar capacidad', exact: true })
    .click();
  await expect(page.getByText('Versión predeterminada 2', { exact: true })).toBeVisible();
  await runtime.reload();
  await expect(runtime.getByText('Versión 1', { exact: true })).toBeVisible();
  await page.goto('/workspace/editor/' + pageId);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('publicados');
  const invitation = await (
    await context.request.post(root + '/application/invitations', {
      headers,
      data: { email: 'service-operator-' + stamp + '@example.com', role: 'operator' },
    })
  ).json();
  const operatorContext = await browser.newContext();
  try {
    const registration = await operatorContext.request.post(api + '/auth/register', {
      headers,
      data: {
        name: 'Operador servicios',
        email: 'service-operator-' + stamp + '@example.com',
        password: 'Clave-servicios-1234',
        invitation: invitation.token,
      },
    });
    const accepted = await registration.json();
    expect(accepted.projects).toHaveLength(0);
    expect(accepted.applications[0].id).toBe(project);
    const operator = await operatorContext.newPage();
    await operator.goto('http://127.0.0.1:5184/p/' + project + '/reservar');
    await expect(operator.getByText('Versión 2', { exact: true })).toBeVisible();
    const form = operator.getByRole('form', { name: 'Ejecutar Reservar capacidad', exact: true });
    await form
      .getByRole('combobox', { name: 'Registro *', exact: true })
      .selectOption({ label: 'Principal' });
    await form.getByLabel('Cantidad *', { exact: true }).fill('1');
    await form.getByRole('button', { name: 'Ejecutar servicio', exact: true }).click();
    await expect(operator.getByRole('status')).toContainText('Servicio ejecutado');
    await expect(operator.locator('dd')).toContainText(['1', 'v2']);
    expect((await operatorContext.request.get(root + '/entities')).status()).toBe(404);
    await operator.screenshot({ path: 'test-results/service-runtime.png', fullPage: true });
  } finally {
    await operatorContext.close();
  }
});
