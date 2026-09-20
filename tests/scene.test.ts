import { createHash } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { sceneStats } from '../src/core/metrics';
import { renderBanner, renderCitySvg } from '../src/renderers/svg/city';

describe('fixture and deterministic SVG', () => {
  it('contains 30 unique buildings fully inside their districts, without overlaps', () => {
    const scene = createFixture();
    const buildings = scene.repositories.flatMap((repo) => repo.buildings);
    expect(sceneStats(scene).files).toBe(30);
    expect(new Set(buildings.map((building) => building.id)).size).toBe(30);
    for (const repo of scene.repositories) {
      for (const a of repo.buildings) {
        expect(a.position.x).toBeGreaterThanOrEqual(repo.bounds.x);
        expect(a.position.y).toBeGreaterThanOrEqual(repo.bounds.y);
        expect(a.position.x + a.width).toBeLessThanOrEqual(repo.bounds.x + repo.bounds.width);
        expect(a.position.y + a.depth).toBeLessThanOrEqual(repo.bounds.y + repo.bounds.depth);
        expect(a.height).toBeGreaterThan(0);
        for (const b of repo.buildings.filter((item) => item.id !== a.id)) {
          const overlaps =
            a.position.x < b.position.x + b.width &&
            a.position.x + a.width > b.position.x &&
            a.position.y < b.position.y + b.depth &&
            a.position.y + a.depth > b.position.y;
          expect(overlaps).toBe(false);
        }
      }
    }
  });
  it('renders byte-identical output independent of input order and generation time', () => {
    const original = createFixture();
    const shuffled = createFixture();
    shuffled.repositories.reverse().forEach((repo) => repo.buildings.reverse());
    shuffled.generatedAt = '2099-12-31T23:59:59.000Z';
    expect(renderBanner(shuffled)).toBe(renderBanner(original));
    expect(renderCitySvg(shuffled)).toBe(renderCitySvg(original));
    expect(renderBanner(createFixture())).toBe(renderBanner(original));
  });
  it('exports valid, self-contained XML at 1200 × 420 under 500 KB', () => {
    const svg = renderBanner(createFixture());
    const doc = new DOMParser({
      onError: (level, message) => {
        throw new Error(`${level}: ${message}`);
      },
    }).parseFromString(svg, 'image/svg+xml');
    expect(doc.documentElement?.getAttribute('width')).toBe('1200');
    expect(doc.documentElement?.getAttribute('height')).toBe('420');
    expect(doc.getElementsByTagName('script').length).toBe(0);
    expect(doc.getElementsByTagName('image').length).toBe(0);
    expect(svg).not.toMatch(/NaN|Infinity|[A-Z]:\\|<foreignObject|onload=/);
    expect(Buffer.byteLength(svg)).toBeLessThan(500 * 1024);
    expect(createHash('sha256').update(svg).digest('hex')).toMatchSnapshot();
  });
  it('escapes arbitrary titles, repository names and paths', () => {
    const scene = createFixture();
    scene.repositories[0].name = '中文 & <repo>';
    scene.repositories[0].buildings[0].path = '中文路径/a & b <x>.ts';
    const svg = renderBanner(scene, { title: '<script>alert("x")</script>' });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.getElementsByTagName('script').length).toBe(0);
    expect(svg).toContain('中文路径/a &amp; b &lt;x&gt;.ts');
    expect(svg).toContain('&lt;script&gt;');
  });
  it('handles empty scenes and label-free exports', () => {
    const scene = createFixture();
    scene.repositories = [];
    expect(renderBanner(scene)).toContain('0 demo repositories');
    expect(renderBanner(createFixture(), { showLabels: false })).not.toContain('>atlas</text>');
  });
});
