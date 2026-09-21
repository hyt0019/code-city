import { describe, expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import {
  districtAnchors,
  frameDistricts,
  labelLeader,
  placeDistrictLabels,
} from '../src/core/district-labels';
import { project } from '../src/layout/isometric';
import { renderCitySvg } from '../src/renderers/svg/city';

describe('district callouts', () => {
  it('keeps crowded names outside the skyline without overlap at desktop and mobile sizes', () => {
    for (const [width, height] of [
      [1040, 660],
      [360, 420],
    ]) {
      const input = Array.from({ length: 6 }, (_, i) => ({
        key: String(i),
        center: { x: width * (0.4 + i * 0.035), y: height / 2 },
        left: { x: width * 0.35, y: height / 2 + i },
        right: { x: width * 0.65, y: height / 2 + i },
      }));
      const labels = placeDistrictLabels(input, width, height);
      expect(placeDistrictLabels([...input].reverse(), width, height)).toEqual(labels);
      for (const c of labels) {
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y + c.height).toBeLessThanOrEqual(height);
        expect(labelLeader(c).at(-1)).toEqual(input.find((item) => item.key === c.key)![c.side]);
        for (const other of labels.filter((item) => item !== c && item.side === c.side))
          expect(c.y + c.height <= other.y || other.y + other.height <= c.y).toBe(true);
      }
    }
  });

  it('frames every roof inside the label rails, with one leader per district', () => {
    const scene = createFixture();
    scene.repositories[0].buildings[0].height = 180;
    const fitted = frameDistricts(scene);
    for (const repo of fitted.repositories) {
      const anchors = districtAnchors(repo);
      expect(anchors.left.x).toBeGreaterThan(repo.bounds.x);
      expect(anchors.left.y).toBeLessThan(repo.bounds.y + repo.bounds.depth);
      for (const b of repo.buildings) {
        const p = project(b.position, b.height + 4 + (b.spireHeight ?? 0), fitted.camera);
        expect(p.x).toBeGreaterThanOrEqual(210);
        expect(p.x).toBeLessThanOrEqual(830);
        expect(p.y).toBeGreaterThanOrEqual(85 - 1e-8);
      }
    }
    const svg = renderCitySvg(scene);
    expect(svg.match(/data-district-leader=/g)).toHaveLength(4);
    expect(svg).toContain('<title>atlas / src/main.ts');
    expect(renderCitySvg(scene, { showLabels: false })).not.toContain('data-district-leader');
    expect(renderCitySvg(scene, { repository: 'tools' })).not.toContain('data-district-leader');
  });
});
