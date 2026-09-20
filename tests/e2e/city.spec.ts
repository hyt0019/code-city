import { expect, test } from '@playwright/test';
import { createFixture } from '../../fixtures/city';

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: createFixture() }));
});

test('city renders, filters, zooms and supports building inspection', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My Code City.' })).toBeVisible();
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  await expect(page.getByLabel('File details')).toContainText('src/main.ts');
  await page.getByLabel('Filter repository').selectOption('tools');
  await expect(page.getByLabel('File details')).toContainText('src/cli.py');
  await expect(page.locator('.city-caption')).toContainText('7 buildings');
  await page.getByLabel('Zoom in', { exact: true }).click();
  await expect(page.locator('.zoom-controls')).toContainText('110%');
  await page.getByLabel('Reset view').click();
  await expect(page.getByLabel('Filter repository')).toHaveValue('');
  await page.getByRole('button', { name: 'src/router.ts, 426 lines', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('File details')).toContainText('src/router.ts');
  await page.getByLabel('Toggle district labels').click();
  await expect(page.locator('.city-art svg text').filter({ hasText: /^atlas$/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('exports the customized SVG and navigates repositories', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await page.getByLabel('City title', { exact: true }).fill('My test skyline');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('code-city-profile.svg');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk as Buffer);
  const svg = Buffer.concat(chunks).toString();
  expect(svg).toContain('My test skyline');
  expect(svg).toContain('width="1200" height="420"');
  expect(svg).not.toContain('<script');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Repositories', exact: false }).first().click();
  await expect(page.getByRole('region', { name: 'Repository list' })).toBeVisible();
  await page.locator('.repository-card').filter({ hasText: 'orbit' }).click();
  await expect(page.getByLabel('Filter repository')).toHaveValue('orbit');
});

test('captures the selected A design', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  await page.screenshot({
    path: `previews/implemented-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('standalone banner renders without JavaScript and keeps text inside its bounds', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 420 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto('/assets/profile.svg');
  await expect(page.locator('svg')).toHaveAttribute('width', '1200');
  const textFits = await page.locator('svg text').evaluateAll((elements) =>
    elements.every((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.x >= 0 && bounds.y >= 0 && bounds.right <= 1200 && bounds.bottom <= 420;
    }),
  );
  expect(textFits).toBe(true);
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'previews/implemented-banner.png' });
  await context.close();
});
