import { expect, test } from '@playwright/test';
import { privacyFixture, privateMarkers } from '../privacy-fixture';

test('mixes public and private districts without exposing private inspection or export details', async ({
  page,
}, info) => {
  const scene = privacyFixture();
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: scene }));
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(3);
  await expect(page.getByLabel('File details')).toContainText('src/main.ts');
  const privateBuildings = page.locator('.city-art [data-private]');
  await expect(privateBuildings).toHaveCount(2);
  await expect(privateBuildings.locator('title')).toHaveCount(0);
  await expect(privateBuildings.first()).not.toHaveAttribute('tabindex');
  await privateBuildings.first().dispatchEvent('mouseover');
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await privateBuildings.first().dispatchEvent('click');
  await page.locator('.city-art').dispatchEvent('mouseleave');
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await page.getByLabel('Filter repository').selectOption('private-one');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(2);
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View committed source' })).toHaveCount(0);
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.three-label')).toHaveCount(1);
  await expect(page.locator('.three-label')).toHaveText('private-one');
  await expect(page.getByLabel('Inspect file', { exact: true })).toHaveCount(0);
  const canvas = page.locator('.city-three canvas');
  await canvas.click();
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await page.getByLabel('Filter repository').selectOption('public-project');
  await expect(page.getByLabel('Inspect file', { exact: true }).locator('option')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'View committed source' })).toHaveAttribute(
    'href',
    /public-project\/blob\/a{40}\/src\/main.ts/,
  );
  await page.getByLabel('Filter repository').selectOption('private-one');
  await page.screenshot({ path: `previews/privacy-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await page.getByLabel('Export scope').selectOption('private-one');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click();
  const download = await pending;
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
  const svg = Buffer.concat(chunks).toString();
  expect(svg.match(/data-building=/g)).toHaveLength(2);
  expect(svg).not.toContain('href=');
  for (const marker of privateMarkers) {
    expect(await page.content()).not.toContain(marker);
    expect(svg).not.toContain(marker);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('redacts private metadata again when loading scene data', async ({ page }) => {
  const scene = privacyFixture();
  const privateRepo = scene.repositories.find((repo) => repo.privacy === 'city-only')!;
  privateRepo.description = 'confidential-description';
  privateRepo.blocks![0].name = 'secret-folder';
  privateRepo.buildings[0].id = 'secret-folder/customer-ledger.ts';
  privateRepo.buildings[0].path = 'secret-folder/customer-ledger.ts';
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: scene }));
  await page.goto('/');
  await expect(page.locator('.city-art [data-private]')).toHaveCount(2);
  await page.locator('.city-art [data-private]').first().dispatchEvent('mouseover');
  await expect(page.getByLabel('File details')).toHaveCount(0);
  for (const marker of privateMarkers) expect(await page.content()).not.toContain(marker);
});

test('hovering a private 3D building dismisses a previously selected public file', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: privacyFixture() }));
  await page.goto('/');
  await expect(page.getByLabel('File details')).toContainText('src/main.ts');
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  const foundPrivate = await page.locator('.city-three canvas').evaluate(async (canvas) => {
    const rect = canvas.getBoundingClientRect();
    for (let y = 0.15; y < 0.85; y += 0.07) {
      for (let x = 0.15; x < 0.85; x += 0.07) {
        const point = { clientX: rect.left + x * rect.width, clientY: rect.top + y * rect.height };
        canvas.dispatchEvent(new PointerEvent('pointermove', point));
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        if (!document.querySelector('.file-inspector')) {
          return point;
        }
      }
    }
    return null;
  });
  expect(foundPrivate).not.toBeNull();
  await page.mouse.click(foundPrivate!.clientX, foundPrivate!.clientY);
  await page.mouse.move(1, 1);
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View committed source' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a city containing only private districts stays viewable and exportable without a file inspector', async ({
  page,
}) => {
  await page.route('**/assets/scene.json', (route) =>
    route.fulfill({ json: privacyFixture(true) }),
  );
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(2);
  await expect(page.getByLabel('File details')).toHaveCount(0);
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.city-three canvas').click();
  await expect(page.getByLabel('Inspect file', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const chunks: Buffer[] = [];
  for await (const chunk of (await (await pending).createReadStream())!)
    chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
