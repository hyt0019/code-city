import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createFixture } from '../../fixtures/city';

async function png(page: Page, button: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  const download = await pending;
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const pixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 30;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, 40, 30);
    const data = context.getImageData(0, 0, 40, 30).data;
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4) colors.add([...data.slice(i, i + 4)].join(','));
    return { colors: colors.size, corner: [...data.slice(0, 4)] };
  }, bytes.toString('base64'));
  expect(pixels.colors).toBeGreaterThan(20);
  return {
    bytes,
    pixels,
    filename: download.suggestedFilename(),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test('exports nonblank PNG banners and the current 2D / rotated 3D view', async ({ page }) => {
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: createFixture() }));
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  const flat = await png(page, 'Download view PNG');
  expect([flat.width, flat.height]).toEqual([2080, 1320]);
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  const profile = await png(page, 'Download PNG');
  expect([profile.width, profile.height]).toEqual([2400, 840]);
  await page.getByLabel('City title', { exact: true }).fill('Custom PNG title');
  expect((await png(page, 'Download PNG')).bytes.equals(profile.bytes)).toBe(false);
  await page.getByLabel('Export scope').selectOption('tools');
  const repo = await png(page, 'Download PNG');
  expect([repo.width, repo.height]).toEqual([1800, 630]);
  await page.keyboard.press('Escape');
  await page.getByLabel('Switch to light theme').click();
  const light = await png(page, 'Download view PNG');
  expect(light.pixels.corner).not.toEqual(flat.pixels.corner);
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  const before = await png(page, 'Download view PNG');
  expect(before.filename).toBe('code-city-view-3d-light.png');
  expect(before.width).toBeGreaterThan(100);
  const canvas = page.locator('.city-three canvas');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect((await png(page, 'Download view PNG')).bytes.equals(before.bytes)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
