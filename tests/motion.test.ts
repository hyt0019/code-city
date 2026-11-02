import { describe, expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { buildingArchitecture } from '../src/core/architecture';
import {
  renderBanner,
  renderCityContents,
  renderCityLayers,
  renderCitySvg,
  renderSelection,
} from '../src/renderers/svg/city';
import { privacyFixture } from './privacy-fixture';

describe('ambient motion', () => {
  it('keeps README banners calm: stepped lights, synchronized beacons and no traffic', () => {
    const svg = renderBanner(createFixture());
    expect(svg).toContain('steps(1,end)');
    expect(svg).toContain('prefers-reduced-motion:reduce');
    expect(svg).not.toMatch(/ease-in-out|-car|translate\(var/);
    expect(svg).not.toMatch(/class="cbp-bk" style=/);
    const still = renderCitySvg(createFixture(), { motion: 'none' });
    expect(still).not.toMatch(/@keyframes|animation|class="cc-(?:t\d|bk)"/);
  });

  it('separates traffic from the drawing, so cars never enter static exports', () => {
    const scene = createFixture();
    const layers = renderCityLayers(scene, { motion: 'full' });
    expect(layers.cars.length).toBeGreaterThan(4);
    for (const car of layers.cars) {
      for (const value of [car.x, car.y, car.dx, car.dy, car.duration, car.offset])
        expect(Number.isFinite(value)).toBe(true);
      expect(car.offset).toBeGreaterThanOrEqual(0);
      expect(car.offset).toBeLessThan(car.duration);
    }
    expect(renderCityLayers(scene).cars).toEqual([]);
    expect(renderCityContents(scene, { motion: 'full' })).toBe(layers.ground + layers.buildings);
    expect(renderCityLayers(scene, { motion: 'full' })).toEqual(layers);
  });

  it('outlines a selection on its own layer and never for private buildings', () => {
    const scene = createFixture();
    const id = scene.repositories[0].buildings[0].id;
    expect(renderSelection(scene, { selectedId: id })).toContain(`data-selection="`);
    expect(renderSelection(scene, { selectedId: 'missing' })).toBe('');
    const hidden = privacyFixture(true);
    const secret = hidden.repositories.find((repo) => repo.privacy === 'city-only')!;
    expect(renderSelection(hidden, { selectedId: secret.buildings[0].id })).toBe('');
    expect(renderCitySvg(scene, { interactive: true })).toContain('data-selection-layer');
  });

  it('staggers the intro from the center only when asked', () => {
    const scene = createFixture();
    expect(renderCitySvg(scene)).not.toContain('--rise');
    const delays = [...renderCitySvg(scene, { intro: true }).matchAll(/--rise:(\d+)ms/g)].map(
      (match) => Number(match[1]),
    );
    expect(delays).toHaveLength(30);
    expect(Math.max(...delays)).toBeLessThanOrEqual(810);
  });

  it('varies facades and crowns by seed while keeping every detail inside the frame', () => {
    const b = createFixture().repositories[0].buildings[0];
    const patterns = new Set<string>();
    const crowns = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const tower = { ...b, height: 120, seed, spireHeight: 0 };
      const design = buildingArchitecture(tower, 340);
      patterns.add(design.pattern);
      crowns.add(design.crown);
      for (const beacon of design.beacons) expect(beacon.z).toBeLessThanOrEqual(tower.height + 4);
      for (const part of [...design.solids, ...design.windows])
        expect(part.z + part.height).toBeLessThanOrEqual(tower.height + 4);
    }
    expect(patterns).toEqual(new Set(['ribbon', 'grid', 'vertical']));
    expect(crowns).toEqual(new Set(['halo', 'mast', 'lantern', 'corners']));
    // A star spire keeps the roof's center free.
    for (let seed = 0; seed < 40; seed++) {
      const crown = buildingArchitecture({ ...b, height: 120, seed, spireHeight: 6 }, 340).crown;
      expect(['halo', 'corners']).toContain(crown);
    }
  });
});
