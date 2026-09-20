import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/pages',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4173/code-city/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /code-city/',
    url: 'http://127.0.0.1:4173/code-city/',
    reuseExistingServer: !process.env.CI,
  },
});
