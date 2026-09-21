import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { repositorySlug } from '../../src/core/repository-scene';

test('built repository pages refresh and load assets under a Pages prefix', async ({
  page,
}, info) => {
  const scene = JSON.parse(await readFile('generated/scene.json', 'utf8'));
  const repo = scene.repositories[0];
  const slug = repositorySlug(repo.name);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`repos/${slug}/`);
  await expect(page.getByRole('heading', { name: `${repo.name}.`, exact: true })).toBeVisible();
  await expect(page.locator('.city-art [data-building]')).toHaveCount(repo.buildings.length);
  await page.reload();
  await expect(page.locator('.city-art [data-building]')).toHaveCount(repo.buildings.length);
  await page.getByLabel('3D view', { exact: true }).click();
  await expect(page.locator('.city-three canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await expect(page.getByLabel('Export scope')).toHaveValue(repo.name);
  const siteRoot = new URL('/code-city/', page.url()).href;
  const snippet = `[![Code City](${siteRoot}assets/repos/${slug}.dark.svg)](${siteRoot}repos/${slug}/)`;
  await expect(page.locator('.embed-section code')).toHaveText(snippet);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('Copy README snippet', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(snippet);
  await expect(page.locator('.export-preview svg')).toHaveAttribute('width', '900');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `previews/repository-${info.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'All repositories', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Code City.' })).toBeVisible();
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click();
  await expect(page.locator('.embed-section code')).toHaveText(
    `[![Code City](${siteRoot}assets/profile.dark.svg)](${siteRoot})`,
  );
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('built repository page has a usable skyline with JavaScript disabled', async ({
  browser,
  baseURL,
}) => {
  const scene = JSON.parse(await readFile('generated/scene.json', 'utf8'));
  const slug = repositorySlug(scene.repositories[0].name);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(`repos/${slug}/`, baseURL).href);
  const img = page.getByRole('img', { name: `${scene.repositories[0].name} code city` });
  await expect(img).toBeVisible();
  expect(await img.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(900);
  await context.close();
});
