import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const port = Number(process.env.CODECITY_PREVIEW_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}/code-city/`;

export default defineConfig({
  ...base,
  testDir: './tests/pages',
  use: { ...base.use, baseURL },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort --base /code-city/`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
