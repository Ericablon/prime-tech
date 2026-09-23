import { expect, type Page } from '@playwright/test';

const DEMO_STORAGE_KEY = 'cronos-demo-data-v2';

async function expectDemoStorageContains(page: Page, value: string) {
  await expect.poll(
    () => page.evaluate(({ key, expected }) => {
      const raw = localStorage.getItem(key) ?? '';
      return raw.includes(expected);
    }, { key: DEMO_STORAGE_KEY, expected: value }),
    { timeout: 5_000 },
  ).toBe(true);
}

export async function loginAsGestor(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Gestor' }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function createPilotClient(page: Page, suffix = 'E2E') {
  const name = `Cliente Automação ${suffix}`;
  const document = `11122233${suffix.replace(/\D/g, '').slice(-3).padStart(3, '0')}44`;

  await page.goto('/clientes');
  await page.getByRole('button', { name: 'Novo cliente' }).click();
  await page.getByLabel('Nome / Razão social').fill(name);
  await page.getByLabel('CPF / CNPJ').fill(document);
  await page.getByLabel('Telefone / WhatsApp').fill('(75) 99999-0000');
  await page.getByLabel('E-mail').fill('e2e@primetech.local');
  await page.getByLabel('Município').fill('Itaberaba');
  await page.getByLabel('UF').fill('BA');
  await page.getByRole('button', { name: 'Salvar cliente' }).click();

  await expect(page.getByRole('table')).toContainText(name);
  await expectDemoStorageContains(page, name);
  return { name, document };
}

export async function createPilotEquipment(page: Page, clientName: string, suffix = 'E2E') {
  const serial = `CRONOS-${suffix}`.toUpperCase();

  // Usa a navegação SPA real do Cronos para preservar o mesmo contexto da operação.
  await page.getByRole('link', { name: 'Equipamentos' }).click();
  await expect(page).toHaveURL(/\/equipamentos$/);
  await page.getByRole('button', { name: 'Novo equipamento' }).click();

  const clientSelect = page.getByLabel('Cliente proprietário');
  await expect(clientSelect).toContainText(clientName);
  const clientValue = await clientSelect.locator('option').filter({ hasText: clientName }).getAttribute('value');
  expect(clientValue).toBeTruthy();
  await clientSelect.selectOption(clientValue!);

  await page.getByLabel('Categoria').selectOption('Notebook');
  await page.getByLabel('Marca').fill('Lenovo');
  await page.getByLabel('Modelo').fill('ThinkPad E2E');
  await page.getByLabel('Número de série').fill(serial);
  await page.getByLabel('Acessórios recebidos').fill('Carregador');
  await page.getByRole('button', { name: 'Salvar equipamento' }).click();

  await expect(page.getByRole('table')).toContainText(serial);
  await expectDemoStorageContains(page, serial);
  return { serial };
}
