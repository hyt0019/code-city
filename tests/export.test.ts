import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { createFixture } from '../fixtures/city';
import { applyTheme, cityPalette } from '../src/core/theme';
import { repositoryScene, repositorySlug } from '../src/core/repository-scene';
import { renderBanner } from '../src/renderers/svg/city';
import { project } from '../src/layout/isometric';

describe('theme and repository exports', () => {
  it('switches the surface palette without mutating file geometry, colors or source data', () => {
    const source = createFixture();
    const before = JSON.stringify(source);
    const light = applyTheme(source, 'github-light');
    expect(light.repositories).toBe(source.repositories);
    expect(cityPalette(light).ground).not.toBe(cityPalette(source).ground);
    expect(renderBanner(light)).toContain('DAYLIGHT SKYLINE');
    expect(renderBanner(light)).not.toMatch(/\$\{|NaN|Infinity/);
    expect(JSON.stringify(source)).toBe(before);
    expect(renderBanner(applyTheme(light, 'github-dark'))).toBe(renderBanner(source));
  });
  it('exports each repository alone, framing existing coordinates inside the viewport', () => {
    const source = createFixture();
    for (const repo of source.repositories) {
      const scene = repositoryScene(source, repo.name);
      expect(scene.repositories).toEqual([repo]);
      expect(scene.repositories[0].buildings).toBe(repo.buildings);
      for (const b of repo.buildings) {
        for (const height of [0, b.height + 4]) {
          const p = project(b.position, height, scene.camera);
          expect(p.x).toBeGreaterThan(0);
          expect(p.x).toBeLessThan(1040);
          expect(p.y).toBeGreaterThan(0);
          expect(p.y).toBeLessThan(660);
        }
      }
      for (const theme of ['github-dark', 'github-light'] as const) {
        const svg = renderBanner(applyTheme(scene, theme), { size: 'repository' });
        const doc = new DOMParser({
          onError: (_level, message) => {
            throw new Error(message);
          },
        }).parseFromString(svg, 'image/svg+xml');
        const groups = Array.from(doc.getElementsByTagName('g')).filter((g) =>
          g.hasAttribute('data-building'),
        );
        expect(doc.documentElement?.getAttribute('width')).toBe('900');
        expect(doc.documentElement?.getAttribute('height')).toBe('315');
        expect(groups).toHaveLength(repo.buildings.length);
        expect(svg).toContain(`1 demo repositories, ${repo.buildings.length} files`);
        expect(svg).not.toMatch(/<script|<image|<foreignObject|\$\{/);
      }
    }
    expect(repositoryScene(source, '')).toBe(source);
    expect(() => repositoryScene(source, 'missing')).toThrow('Unknown repository');
  });
  it('produces portable export names for Unicode, punctuation, case and reserved Windows names', () => {
    const names = ['atlas', 'Atlas', 'a/b', 'a-b', '..', 'con', 'COM1', '中文仓库', 'repo #1'];
    const slugs = names.map(repositorySlug);
    expect(new Set(slugs).size).toBe(names.length);
    expect(repositorySlug('atlas')).toBe('atlas');
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/);
    }
  });
});
