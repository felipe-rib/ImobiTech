import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const password = `Teste-e2e-${randomBytes(12).toString('hex')}`;
const suffix = randomBytes(4).toString('hex');
const accounts = {
  owner: {
    name: `Proprietário QA ${suffix}`,
    email: `owner-${suffix}@example.test`,
    role: 'owner',
  },
  broker: { name: `Corretor QA ${suffix}`, email: `broker-${suffix}@example.test`, role: 'broker' },
  tenant: {
    name: `Inquilino QA ${suffix}`,
    email: `tenant-${suffix}@example.test`,
    role: 'tenant',
  },
};
let propertyPath = '';
let tenantPath = '';
let adminCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
const title = `Apartamento QA ${suffix}`;
test.describe.configure({ mode: 'serial' });

async function login(
  page: Page,
  email = process.env.ADMIN_EMAIL!,
  pass = process.env.ADMIN_PASSWORD!,
) {
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();
}
async function noOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    outside: [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 12)
      .map((el) => ({
        tag: el.tagName,
        classes: el.className,
        right: el.getBoundingClientRect().right,
      })),
  }));
  expect(
    geometry.document,
    `${new URL(page.url()).pathname}: ${JSON.stringify(geometry)}`,
  ).toBeLessThanOrEqual(geometry.viewport + 1);
}
async function screenshot(page: Page, name: string) {
  await mkdir('docs/evidence/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/evidence/screenshots/${name}.png`, fullPage: true });
}

test('UI-01: login, cadastro dos três perfis e edição de usuário', async ({ page }) => {
  await login(page);
  adminCookies = await page.context().cookies();
  for (const account of Object.values(accounts)) {
    await page.goto('/users/new');
    await page.getByLabel('Nome completo *', { exact: true }).fill(account.name);
    await page.getByLabel('E-mail *', { exact: true }).fill(account.email);
    await page.getByRole('combobox', { name: 'Perfil *', exact: true }).selectOption(account.role);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Salvar usuário' }).click();
    await expect(page.getByText('Usuário cadastrado.', { exact: true })).toBeVisible();
  }
  await page
    .getByRole('textbox', { name: 'Buscar por nome ou e-mail' })
    .fill(accounts.tenant.email);
  const row = page.getByRole('row').filter({ hasText: accounts.tenant.email });
  await row.getByRole('link', { name: 'Consultar / editar' }).click();
  await expect(page).toHaveURL(/\/users\/[a-f0-9-]+$/);
  tenantPath = new URL(page.url()).pathname;
  await page
    .getByLabel('Nome completo *', { exact: true })
    .fill(`${accounts.tenant.name} atualizado`);
  await page.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Usuário atualizado.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${accounts.tenant.name} atualizado`, { exact: true })).toBeVisible();
});

test('UI-02: cadastro e edição de imóvel persistem após recarga', async ({ page }) => {
  await login(page);
  await page.goto('/properties/new');
  await page.getByLabel('Título *', { exact: true }).fill(title);
  await page.getByLabel('Logradouro *', { exact: true }).fill('Rua de demonstração');
  await page.getByLabel('Número *', { exact: true }).fill('100');
  await page.getByLabel('Bairro *', { exact: true }).fill('Centro');
  await page.getByLabel('Cidade *', { exact: true }).fill('Brasília');
  await page.locator('[name="postal_code"]').fill('70000000');
  await page.getByLabel('Valor mensal de locação (R$)', { exact: true }).fill('1800.50');
  await page
    .getByRole('combobox', { name: 'Proprietário vinculado *', exact: true })
    .selectOption({ label: accounts.owner.name });
  await page.getByRole('button', { name: 'Salvar imóvel' }).click();
  await expect(page.getByText('Imóvel cadastrado.', { exact: true })).toBeVisible();
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .click();
  await expect(page).toHaveURL(/\/properties\/[a-f0-9-]+$/);
  propertyPath = new URL(page.url()).pathname;
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Disponível', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Editar imóvel' }).click();
  await page.getByLabel('Valor mensal de locação (R$)', { exact: true }).fill('2250.75');
  await page
    .getByLabel('Descrição', { exact: true })
    .fill('Descrição atualizada pelo teste de interface.');
  await page.getByRole('button', { name: 'Salvar imóvel' }).click();
  await expect(page.getByText('Imóvel atualizado.', { exact: true })).toBeVisible();
  await page.goto(propertyPath);
  await expect(page.getByText('Descrição atualizada pelo teste de interface.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /2.250,75/ })).toBeVisible();
});

test('UI-03: proprietário, corretor e inquilino recebem a área correta', async ({ page }) => {
  for (const [role, account] of Object.entries(accounts)) {
    await page.context().clearCookies();
    await login(page, account.email, password);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    await page.goto('/properties');
    if (role === 'tenant')
      await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    else {
      await expect(
        page.getByRole('heading', {
          name: role === 'owner' ? 'Meus imóveis' : 'Imóveis',
          exact: true,
        }),
      ).toBeVisible();
      await page.goto(propertyPath);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      if (role === 'owner')
        await expect(page.getByRole('link', { name: 'Editar imóvel' })).toHaveCount(0);
      else await expect(page.getByRole('link', { name: 'Editar imóvel' })).toBeVisible();
    }
  }
});

test('UI-04: credenciais inválidas e usuário inativo são bloqueados', async ({ page }) => {
  await login(page);
  await page.goto(tenantPath);
  await page.getByRole('combobox', { name: 'Situação *', exact: true }).selectOption('false');
  await page.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Usuário atualizado.', { exact: true })).toBeVisible();
  await page.context().clearCookies();
  for (const pass of ['senha incorreta', password]) {
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill(accounts.tenant.email);
    await page.getByLabel('Senha', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`UI-05: telas essenciais em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
    await noOverflow(page);
    await screenshot(page, `login-${viewport.width}`);
    // Reuse an authenticated server session to avoid hitting the intentional login throttle.
    await page.context().addCookies(adminCookies);
    for (const [path, heading, name] of [
      ['/', 'Olá, Administrador.', 'inicio'],
      ['/users', 'Usuários', 'usuarios'],
      [tenantPath, 'Informações do usuário', 'usuario-form'],
      ['/properties', 'Imóveis', 'imoveis'],
      [propertyPath, title, 'imovel-detalhe'],
      [`${propertyPath}/edit`, 'Editar imóvel', 'imovel-form'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText('Carregando…', { exact: true })).toHaveCount(0);
      if (name === 'imovel-form') {
        await expect(page.getByText('Buscando proprietários…', { exact: true })).toHaveCount(0);
      }
      await noOverflow(page);
      await screenshot(page, `${name}-${viewport.width}`);
    }
    if (viewport.width === 390) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Usuários', exact: true })
        .click();
      await expect(page.getByRole('heading', { name: 'Usuários', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
    }
    await page.goto('/properties');
    await page
      .getByRole('textbox', { name: 'Buscar por título, cidade ou bairro' })
      .fill('nenhum-resultado-qa');
    await expect(page.getByRole('heading', { name: 'Nenhum imóvel encontrado' })).toBeVisible();
    await noOverflow(page);
  });
}
