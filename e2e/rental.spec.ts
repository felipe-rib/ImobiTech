import { test, expect } from './fixtures';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
// Respect the production login limiter after the preceding suite/browser.
test.beforeAll(async () => {
  test.setTimeout(90000);
  await new Promise((resolve) => setTimeout(resolve, 61000));
});

test('US04–US07: agenda, contrato, pagamento e consulta em três tamanhos', async ({
  page,
  browser,
}, testInfo) => {
  testInfo.annotations.push({ type: 'browser-version', description: browser.version() });
  const suffix = randomBytes(5).toString('hex');
  const password = `QA-rental-${randomBytes(16).toString('hex')}`;
  const capture = async (name: string) => {
    await mkdir('docs/evidence/mvp/screenshots', { recursive: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      await page.screenshot({
        path: `docs/evidence/mvp/screenshots/${testInfo.project.name || 'Chromium'}-${width}-${name}.png`,
        fullPage: true,
      });
    }
  };
  const login = async (email: string, pass: string) => {
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
    await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();
  };
  await login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  const headers = { origin: 'https://localhost' };
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post(`/api${path}`, { headers, data });
    expect(r.status(), await r.text()).toBe(201);
    return r.json();
  };
  const owner = await post('/users', {
    name: `Owner ${suffix}`,
    email: `owner-${suffix}@qa.test`,
    role: 'owner',
    password,
  });
  const tenant = await post('/users', {
    name: `Tenant ${suffix}`,
    email: `tenant-${suffix}@qa.test`,
    role: 'tenant',
    password,
  });
  const broker = await post('/users', {
    name: `Broker ${suffix}`,
    email: `broker-${suffix}@qa.test`,
    role: 'broker',
    password,
  });
  const property = await post('/properties', {
    title: `Imóvel MVP ${suffix}`,
    type: 'apartment',
    street: 'Rua Teste',
    number: '1',
    neighborhood: 'Centro',
    city: 'Brasília',
    state: 'DF',
    postal_code: '70000000',
    rent: 1800,
    owner_id: owner.id,
  });
  await page.getByRole('button', { name: 'Sair' }).click();
  await login(broker.email, password);
  await page.goto('/visits/new');
  await page.getByLabel('Buscar imóvel', { exact: true }).fill(suffix);
  await page.getByRole('combobox').selectOption(property.id);
  await page.locator('[name=participant_name]').fill('Participante de avaliação');
  const future = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
  await page.locator('[name=starts_at]').fill(`${future}T10:00`);
  await page.locator('[name=ends_at]').fill(`${future}T11:00`);
  await capture('visit-form');
  await page.getByRole('button', { name: 'Salvar visita' }).click();
  await expect(page.getByText('Visita agendada.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar visita', exact: true }).click();
  await expect(page.getByText('Visita confirmada.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar visita', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText('Visita cancelada.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  await page.goto('/contracts/new');
  await page.getByLabel('Buscar imóvel disponível', { exact: true }).fill(suffix);
  await page.getByRole('combobox', { name: /Imóvel disponível/ }).selectOption(property.id);
  await page.getByLabel('Buscar inquilino', { exact: true }).fill(suffix);
  await page.getByRole('combobox', { name: /Inquilino/ }).selectOption(tenant.id);
  const year = new Date().getFullYear();
  await page.locator('[name=start_date]').fill(`${year - 1}-01-01`);
  await page.locator('[name=end_date]').fill(`${year + 1}-12-31`);
  await page.locator('[name=monthly_rent]').fill('1800');
  await page.getByRole('button', { name: 'Salvar contrato' }).click();
  await expect(page).toHaveURL(/\/contracts\/[a-f0-9-]+$/);
  const contractPath = new URL(page.url()).pathname;
  await page.getByRole('link', { name: 'Consultar financeiro' }).click();
  await page.getByRole('link', { name: 'Novo lançamento' }).click();
  await page.locator('[name=competence]').fill(`${year - 1}-01`);
  await page.locator('[name=due_date]').fill(`${year - 1}-01-10`);
  await capture('payment-form');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByRole('article').getByText('Atrasado', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Atualizar lançamento' }).click();
  await page.locator('[name=paid_at]').fill(`${year - 1}-01-10`);
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByRole('article').getByText('Pago', { exact: true })).toBeVisible();
  await mkdir('docs/evidence/mvp/screenshots', { recursive: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/contracts',
      contractPath,
      `${contractPath}/finance`,
      '/contracts/new',
      '/visits',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Carregando…', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Buscando opções…', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width + 1,
      );
      await page.screenshot({
        path: `docs/evidence/mvp/screenshots/${testInfo.project.name || 'Chromium'}-${width}-${path === contractPath ? 'detail' : path.split('/').pop()}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(contractPath);
  await page.getByRole('button', { name: 'Encerrar contrato', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar encerramento' }).click();
  await expect(page.getByText('Encerrado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await login(tenant.email, password);
  await page.goto(`${contractPath}/finance`);
  await expect(page.getByRole('article').getByText('Pago', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Novo lançamento' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Atualizar lançamento' })).toHaveCount(0);
  await capture('tenant-finance');
  await page.getByRole('button', { name: 'Sair' }).click();
  await login(owner.email, password);
  await page.goto(`${contractPath}/finance`);
  await expect(page.getByRole('article').getByText('Pago', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Atualizar lançamento' })).toHaveCount(0);
  await capture('owner-finance');
});
