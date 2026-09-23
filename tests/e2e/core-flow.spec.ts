import { expect, test } from '@playwright/test';
import { createPilotClient, createPilotEquipment, loginAsGestor } from './support';

test.describe('CRONOS · fluxo operacional principal', () => {
  test('gestor acessa os módulos centrais do sistema', async ({ page }) => {
    await loginAsGestor(page);

    await expect(page.getByText('CRONOS', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Comercial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Operação Técnica/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Estoque/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Financeiro/i })).toBeVisible();
  });

  test('cria cliente, equipamento e uma nova OS com dados de teste', async ({ page }) => {
    await loginAsGestor(page);

    const client = await createPilotClient(page, '001');
    const equipment = await createPilotEquipment(page, client.name, '001');

    // Continua pelo menu do próprio sistema, como acontece na loja.
    await page.getByRole('link', { name: 'Nova Ordem de Serviço' }).click();
    await expect(page).toHaveURL(/\/ordens\/nova$/);
    await page.getByLabel('Cliente').selectOption({ label: client.name });

    const equipmentSelect = page.getByLabel('Equipamento');
    await expect(equipmentSelect).toContainText('ThinkPad E2E');
    const equipmentValue = await equipmentSelect.locator('option').filter({ hasText: 'ThinkPad E2E' }).getAttribute('value');
    expect(equipmentValue).toBeTruthy();
    await equipmentSelect.selectOption(equipmentValue!);

    const specialty = page.getByLabel('Especialidade técnica');
    await expect(specialty).not.toHaveValue('');

    await page.getByLabel('Prioridade').selectOption('high');
    await page.getByLabel('Problema relatado pelo cliente').fill('Equipamento não inicia e apresenta falha intermitente de energia.');
    await page.getByRole('button', { name: 'Criar Ordem de Serviço' }).click();

    await expect(page).toHaveURL(/\/ordens\/[a-zA-Z0-9-]+$/);
    await expect(page.getByText(client.name)).toBeVisible();
    await expect(page.getByText(equipment.serial)).toBeVisible();
    await expect(page.getByRole('link', { name: /Imprimir OS \/ orçamento/i })).toBeVisible();
  });

  test('gera visualização imprimível de OS e orçamento', async ({ page }) => {
    await loginAsGestor(page);
    await page.goto('/ordens/os-1047/documentos');

    await expect(page.getByRole('heading', { name: /OS #001047 · Impressão/i })).toBeVisible();
    await page.getByRole('button', { name: 'Imprimir OS' }).click();

    const orderDialog = page.getByRole('dialog', { name: /Ordem de Serviço OS #001047/i });
    await expect(orderDialog).toBeVisible();
    await expect(orderDialog).toContainText('Maria Santos');
    await expect(orderDialog).toContainText('Impressora Epson L3250');
    await expect(orderDialog.getByRole('button', { name: /Imprimir \/ Salvar PDF/i })).toBeVisible();
    await orderDialog.getByRole('button', { name: 'Fechar' }).click();

    await page.getByRole('button', { name: 'Imprimir orçamento' }).click();
    const quoteDialog = page.getByRole('dialog', { name: /Orçamento OS #001047/i });
    await expect(quoteDialog).toBeVisible();
    await expect(quoteDialog).toContainText('Condições do orçamento');
    await expect(quoteDialog).toContainText('Maria Santos');
  });

  test('atalhos abrem a OS focada no Técnico e no Comercial', async ({ page }) => {
    await loginAsGestor(page);

    await page.goto('/ordens/os-1047');
    await page.getByRole('link', { name: /Abrir esta OS no Técnico/i }).click();
    await expect(page).toHaveURL(/\/tecnico\?os=os-1047$/);
    await expect(page.getByText('OS #001047 · OS selecionada')).toBeVisible();

    await page.goto('/ordens/os-1046');
    await page.getByRole('link', { name: /Abrir esta OS no Comercial/i }).click();
    await expect(page).toHaveURL(/\/comercial\?os=os-1046$/);
    await expect(page.getByText('OS #001046 · OS selecionada')).toBeVisible();
  });
});
