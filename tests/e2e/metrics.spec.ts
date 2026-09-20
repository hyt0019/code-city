import { expect, test } from '@playwright/test';
import { createFixture } from '../../fixtures/city';

test('height metric follows SVG, 3D and exports without changing selected files', async ({
  page,
}) => {
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: createFixture() }));
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  const lines = await page.locator('.city-art').innerHTML();
  const selected = await page.locator('.file-inspector h3').innerText();
  await page.getByLabel('Building height', { exact: true }).selectOption('bytes');
  await expect(page.locator('.city-art [data-building]').first()).toHaveAttribute(
    'aria-label',
    /bytes$/,
  );
  expect(await page.locator('.city-art').innerHTML()).not.toBe(lines);
  await expect(page.locator('.file-inspector h3')).toHaveText(selected);
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await expect(page.locator('.export-preview [data-building] title').first()).toContainText(
    'bytes',
  );
  await page.keyboard.press('Escape');
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Building height', { exact: true }).selectOption('lines');
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('2.5D view', { exact: true }).click();
  expect(await page.locator('.city-art').innerHTML()).toBe(lines);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
