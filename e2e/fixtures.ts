import { test as base, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Firefox's automated temporary profiles do not inherit the Linux system CA store.
// Seed an isolated profile with the QA public CA; never disable certificate checks.
export const test = base.extend({
  context: async (
    { browser, browserName, playwright, baseURL, locale, timezoneId, viewport, launchOptions },
    use,
  ) => {
    const options = { baseURL, locale, timezoneId, viewport, ignoreHTTPSErrors: false };
    if (browserName !== 'firefox') {
      const context = await browser.newContext(options);
      try {
        await use(context);
      } finally {
        await context.close();
      }
      return;
    }
    if (process.platform !== 'linux')
      throw new Error('Execute a homologação Firefox no container Linux indicado na matriz.');
    const profile = await mkdtemp(join(tmpdir(), 'imobitech-firefox-'));
    try {
      execFileSync('certutil', ['-N', '-d', `sql:${profile}`, '--empty-password']);
      execFileSync('certutil', [
        '-A',
        '-d',
        `sql:${profile}`,
        '-n',
        'imobitech-local-qa',
        '-t',
        'C,,',
        '-i',
        '/caddy/caddy/pki/authorities/local/root.crt',
      ]);
      const context = await playwright.firefox.launchPersistentContext(profile, {
        ...launchOptions,
        ...options,
        headless: true,
      });
      try {
        await use(context);
      } finally {
        await context.close();
      }
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  },
});
export { expect };
