import { expect, test } from '@playwright/test';

test('muestra y oculta la contraseña sin enviar el formulario ni perder su valor', async ({
  page,
}) => {
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Crear una cuenta', exact: true }).click();
  const password = page.getByLabel('Contraseña', { exact: true });
  await password.fill('Clave-de-prueba-123');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('Clave-de-prueba-123');
  await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('Clave-de-prueba-123');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await page.getByRole('button', { name: 'Ya tengo una cuenta', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('Clave-de-prueba-123');
});
