import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createFixture } from '../../fixtures/city';
import { sceneSource } from '../../src/core/source-label';

test('loads the generated scene and exports the same real city', async ({ page }, testInfo) => {
  const scene = JSON.parse(await readFile('generated/scene.json', 'utf8'));
  const count = scene.repositories.reduce(
    (sum: number, repo: { buildings: unknown[] }) => sum + repo.buildings.length,
    0,
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(count);
  await expect(page.locator('.fixture-badge')).toContainText(
    scene.isFixture
      ? 'Demo data'
      : `${sceneSource(scene) === 'local' ? 'Local' : sceneSource(scene)} scan`,
  );
  await expect(page.locator('.stats-strip')).toContainText(String(count));
  await page.screenshot({
    path: `previews/local-city-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk as Buffer);
  const svg = Buffer.concat(chunks).toString();
  expect(svg).toContain(`${count} files`);
  expect(svg).toContain(`${sceneSource(scene).toUpperCase()} CITY`);
  expect(errors).toEqual([]);
});

test('empty directories and invalid JSON have usable states', async ({ page }) => {
  const scene = createFixture();
  scene.repositories = [];
  scene.isFixture = false;
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: scene }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My Code City.' })).toBeVisible();
  await expect(page.getByText('No source files to display')).toBeVisible();
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await page.unroute('**/assets/scene.json');
  await page.route('**/assets/scene.json', (route) =>
    route.fulfill({ json: { schemaVersion: 999 } }),
  );
  await page.reload();
  await expect(
    page.getByText('The city data could not be loaded.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Code City static skyline' })).toBeVisible();
  await page.unroute('**/assets/scene.json');
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: createFixture() }));
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
});
