import { describe, expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { buildingArchitecture, buildingStyle, roofRise } from '../src/core/architecture';
import { renderCitySvg } from '../src/renderers/svg/city';
import { privacyFixture, privateMarkers } from './privacy-fixture';

describe('shared building architecture', () => {
  it('keeps detailed geometry finite, bounded and deterministic without changing file metrics', () => {
    const scene = createFixture();
    const before = JSON.stringify(scene);
    const styles = new Set();
    const buildings = scene.repositories.flatMap((repo) => repo.buildings);
    const lowRise = { ...buildings[0], width: 24, depth: 22, height: 14, landmark: false };
    const examples = [4, 7, 14, 30, 65, 130].flatMap((height) =>
      [0, 1].map((seed) => ({ ...lowRise, height, seed })),
    );
    for (const b of [...buildings, ...examples]) {
      const design = buildingArchitecture(b, 340);
      styles.add(design.style);
      expect(buildingArchitecture(b, 340)).toEqual(design);
      expect(design.windows.length).toBeGreaterThan(0);
      for (const part of [
        ...design.solids,
        ...design.windows,
        ...(design.pitchedRoof ? [design.pitchedRoof] : []),
      ]) {
        for (const value of [part.x, part.y, part.z, part.width, part.depth, part.height])
          expect(Number.isFinite(value)).toBe(true);
        expect(Math.min(part.width, part.depth, part.height)).toBeGreaterThan(0);
        expect(part.x).toBeGreaterThanOrEqual(-0.03);
        expect(part.y).toBeGreaterThanOrEqual(-0.03);
        expect(part.x + part.width).toBeLessThanOrEqual(b.width + 0.06);
        expect(part.y + part.depth).toBeLessThanOrEqual(b.depth + 0.06);
        expect(part.z + part.height).toBeLessThanOrEqual(b.height + 4);
      }
      expect(roofRise(b)).toBeLessThanOrEqual(4);
    }
    expect(styles.size).toBe(8);
    expect(JSON.stringify(scene)).toBe(before);
  });

  it('uses low houses, stepped midrises and taller tiered towers according to height', () => {
    const b = createFixture().repositories[0].buildings[0];
    expect(buildingStyle({ ...b, height: 7 })).toBe('cottage');
    expect(buildingArchitecture({ ...b, height: 7 }, 340).pitchedRoof).toBeDefined();
    expect(buildingStyle({ ...b, height: 65 })).toBe('tower');
    expect(buildingStyle({ ...b, height: 130 })).toBe('skyscraper');
    const medium = buildingArchitecture({ ...b, height: 30 }, 340);
    const tall = buildingArchitecture({ ...b, height: 130 }, 340);
    expect(tall.windows.length).toBeGreaterThan(medium.windows.length);
    expect(tall.windows.every((window) => window.height <= 3.2)).toBe(true);
  });

  it('retains windows beyond the old 300-building cutoff, with a bounded detail budget', () => {
    const scene = createFixture();
    const b = scene.repositories[0].buildings[0];
    scene.repositories[0].buildings = Array.from({ length: 301 }, (_, i) => ({
      ...b,
      id: `building-${i}`,
    }));
    const svg = renderCitySvg(scene);
    const count = scene.repositories.reduce((sum, repo) => sum + repo.buildings.length, 0);
    expect(svg.match(/data-building=/g)).toHaveLength(count);
    expect(svg.match(/data-windows=/g)!.length).toBeGreaterThanOrEqual(count);
    expect(svg).not.toMatch(/NaN|Infinity/);
    const dense = buildingArchitecture(b, 10000);
    expect(dense.windows.length).toBeGreaterThan(0);
    expect(dense.windows.length).toBeLessThan(buildingArchitecture(b, 30).windows.length);
  });

  it('adds architecture to anonymized cities without restoring identifiers or interaction', () => {
    const svg = renderCitySvg(privacyFixture(true), { interactive: true });
    expect(svg).toContain('data-architecture=');
    expect(svg).toContain('data-windows=');
    expect(svg).not.toMatch(/<title|tabindex|role="button"|href=/);
    for (const marker of privateMarkers) expect(svg).not.toContain(marker);
  });
});
