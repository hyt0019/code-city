import { expect, test } from '@playwright/test';
import { createFixture } from '../../fixtures/city';

test('file inspection distinguishes known Git dates from missing history', async ({ page }) => {
  const fixture = createFixture();
  fixture.repositories.forEach((repo) =>
    repo.buildings.forEach((building) => {
      delete building.modifiedAt;
    }),
  );
  const file = fixture.repositories[0].buildings.find((building) => building.landmark)!;
  file.modifiedAt = '2026-09-01T12:00:00.000Z';
  file.windowBrightness = 0.7;
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: fixture }));
  await page.goto('/');
  await expect(page.getByLabel('File details')).toContainText('2026-09-01');
  await page.getByLabel('Filter repository').selectOption(fixture.repositories[1].name);
  await expect(page.getByLabel('File details')).toContainText('Unknown');
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
