import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'https://localhost:9443', ignoreHTTPSErrors: true },
  webServer: { command: 'node tests/browser/server.mjs', url: 'https://localhost:9443', ignoreHTTPSErrors: true },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: {
      ...(process.env.S2B_CHROMIUM_PATH ? { executablePath: process.env.S2B_CHROMIUM_PATH } : {}),
      args: ['--test-third-party-cookie-phaseout'],
    } } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
