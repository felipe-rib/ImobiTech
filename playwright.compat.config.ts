import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'rental.spec.ts',
  workers: 1,
  timeout: 120000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'docs/evidence/mvp/compatibility.json' }]],
  use: {
    baseURL: 'https://localhost',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ignoreHTTPSErrors: false,
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'Chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'Edge', use: { browserName: 'chromium', channel: 'msedge' } },
    {
      name: 'Firefox',
      use: {
        browserName: 'firefox',
        launchOptions: { firefoxUserPrefs: { 'security.enterprise_roots.enabled': true } },
      },
    },
  ],
});
