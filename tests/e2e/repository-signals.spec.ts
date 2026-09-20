import { expect, test } from '@playwright/test';
import { createFixture } from '../../fixtures/city';

test('shows star spires and archived districts in SVG, 3D and repository exports', async ({
  page,
}, info) => {
  const scene = createFixture();
  scene.repositories[0].stars = 16;
  scene.repositories[1].stars = 2000;
  scene.repositories[1].archived = true;
  const archived = scene.repositories[1];
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: scene }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.city-art [data-star-spire]')).toHaveCount(2);
  await expect(page.locator('.city-art [data-archived]')).toHaveCount(archived.buildings.length);
  expect(
    await page.locator('.city-art svg').evaluate((svg) => {
      const root = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('[data-star-spire]')].every((spire) => {
        const box = spire.getBoundingClientRect();
        return box.top >= root.top && box.bottom <= root.bottom;
      });
    }),
  ).toBe(true);
  await page.getByRole('button', { name: 'Repositories', exact: false }).first().click();
  const card = page.locator('.repository-card').filter({ hasText: archived.name });
  await expect(card).toContainText('2.0k stars');
  await expect(card).toContainText('Archived');
  await card.click();
  await expect(page.getByLabel('File details')).toContainText('Archived');
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await page.getByLabel('Export scope').selectOption(archived.name);
  await expect(page.locator('.export-preview [data-star-spire]')).toHaveCount(1);
  await expect(page.locator('.export-preview [data-archived]')).toHaveCount(
    archived.buildings.length,
  );
  await page.keyboard.press('Escape');
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Filter repository').selectOption('');
  await page.screenshot({ path: `previews/signals-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
