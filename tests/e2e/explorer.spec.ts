import { expect, test } from '@playwright/test';
import { createFixture } from '../../fixtures/city';
import { createHash } from 'node:crypto';

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/scene.json', (route) => route.fulfill({ json: createFixture() }));
});

test('light theme and single-repository exports preserve the selected buildings', async ({
  page,
}, testInfo) => {
  await page.goto('/?repo=tools');
  await expect(page.getByLabel('Filter repository')).toHaveValue('tools');
  const ids = await page
    .locator('.city-art [data-building]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-building')));
  await page.getByLabel('Switch to light theme').click();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'light');
  expect(
    await page
      .locator('.city-art [data-building]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-building'))),
  ).toEqual(ids);
  await page.getByLabel('Reset view').click();
  await page.screenshot({ path: `previews/daylight-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await page.getByLabel('Export scope').selectOption('tools');
  await expect(page.locator('.export-preview [data-building]')).toHaveCount(7);
  await expect(page.locator('.embed-section code')).toContainText('repos/tools.light.svg');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('code-city-tools-light.svg');
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
  const svg = Buffer.concat(chunks).toString();
  expect(svg.match(/data-building=/g)).toHaveLength(7);
  expect(svg).toContain('DAYLIGHT SKYLINE');
  expect(svg).toContain('width="900" height="315"');
  expect(svg).not.toContain('src/main.ts');
  const fits = await page.locator('.export-preview svg').evaluate((svg) => {
    const bounds = svg.getBoundingClientRect();
    return [...svg.querySelectorAll('text')].every((text) => {
      const b = text.getBoundingClientRect();
      return (
        b.left >= bounds.left &&
        b.right <= bounds.right &&
        b.top >= bounds.top &&
        b.bottom <= bounds.bottom
      );
    });
  });
  expect(fits).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('3D renders, rotates with keyboard, inspects files and resets without idle motion', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { cityDrawCalls: number };
    state.cityDrawCalls = 0;
    const draw = WebGL2RenderingContext.prototype.drawElementsInstanced;
    WebGL2RenderingContext.prototype.drawElementsInstanced = function (...args) {
      state.cityDrawCalls++;
      return draw.apply(this, args);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  const loaded3D = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .some((entry) => /three\/viewer|three\.js|three\.module/.test(entry.name)),
  );
  expect(loaded3D).toBe(false);
  await page.getByLabel('3D view', { exact: true }).click();
  const canvas = page.locator('.city-three canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await canvas.focus();
  const screenshotHash = async () =>
    createHash('sha256')
      .update(await canvas.screenshot())
      .digest('hex');
  const initial = await screenshotHash();
  const initialLabels = await page.locator('.three-label').evaluateAll((labels) =>
    labels.map((label) => ({
      x: label.getBoundingClientRect().x,
      y: label.getBoundingClientRect().y,
    })),
  );
  await page.keyboard.press('ArrowRight');
  await expect.poll(screenshotHash).not.toBe(initial);
  await page.keyboard.press('Home');
  await expect
    .poll(async () =>
      page.locator('.three-label').evaluateAll(
        (labels, positions) =>
          labels.every((label, index) => {
            const box = label.getBoundingClientRect();
            return (
              Math.abs(box.x - positions[index].x) < 0.5 &&
              Math.abs(box.y - positions[index].y) < 0.5
            );
          }),
        initialLabels,
      ),
    )
    .toBe(true);
  const idleFrames = await page.evaluate(async () => {
    const state = window as typeof window & { cityDrawCalls: number };
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    await frame();
    const before = state.cityDrawCalls;
    for (let i = 0; i < 8; i++) await frame();
    return { before, after: state.cityDrawCalls };
  });
  expect(idleFrames.before).toBeGreaterThan(0);
  expect(idleFrames.after).toBe(idleFrames.before);
  const bounds = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height * 0.24 } });
  await expect(page.locator('.file-inspector h3')).toHaveText('src/index.js');
  const labelBeforeDrag = await page.locator('.three-label').first().boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.4 + 50, bounds.y + bounds.height * 0.3 + 10, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Math.abs((await page.locator('.three-label').first().boundingBox())!.x - labelBeforeDrag!.x),
    )
    .toBeGreaterThan(2);
  await page.getByLabel('Reset view').click();
  await page.getByLabel('Filter repository').selectOption('tools');
  await page.getByLabel('Inspect file', { exact: true }).selectOption({ index: 1 });
  await expect(page.getByLabel('File details')).toContainText('src/analysis.py');
  await page.getByLabel('Zoom in', { exact: true }).click();
  await expect(page.locator('.zoom-controls')).toContainText('110%');
  await page.getByLabel('Reset view').click();
  await expect(page.locator('.zoom-controls')).toContainText('100%');
  await page.getByLabel('Toggle district labels').click();
  await expect(page.locator('.three-label:visible')).toHaveCount(0);
  await page.getByLabel('Toggle district labels').click();
  await expect(page.locator('.three-label:visible')).toHaveCount(4);
  await page.screenshot({ path: `previews/three-${testInfo.project.name}.png`, fullPage: true });
  await page.getByLabel('Switch to light theme').click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.city-three canvas')).toHaveCount(1);
  await page.screenshot({
    path: `previews/three-daylight-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('2.5D view', { exact: true }).click();
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  await expect(canvas).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('missing WebGL falls back to SVG and remains exportable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.three-error')).toContainText('3D is unavailable');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await expect(page.locator('.export-preview [data-building]')).toHaveCount(30);
});

test('a lost WebGL context restores the SVG city', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three')).toHaveAttribute('aria-busy', 'false');
  await page
    .locator('.city-three canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(page.locator('.three-error')).toContainText('3D is unavailable');
  await expect(page.locator('.city-art [data-building]')).toHaveCount(30);
});
