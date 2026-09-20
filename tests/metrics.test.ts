import { expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { applyHeightMetric } from '../src/core/metrics';
import { sceneSchema } from '../src/core/config';

it('switches height metrics without moving buildings and restores original heights after serialization', () => {
  const scene = createFixture();
  const original = JSON.stringify(scene);
  const bytes = applyHeightMetric(scene, 'bytes');
  const restored = applyHeightMetric(sceneSchema.parse(JSON.parse(JSON.stringify(bytes))), 'lines');
  scene.repositories.forEach((repo, r) =>
    repo.buildings.forEach((building, b) => {
      const changed = bytes.repositories[r].buildings[b];
      expect(changed.position).toEqual(building.position);
      expect([changed.id, changed.width, changed.depth]).toEqual([
        building.id,
        building.width,
        building.depth,
      ]);
      expect(changed.height).toBeGreaterThan(0);
      expect(Number.isFinite(changed.height)).toBe(true);
      expect(restored.repositories[r].buildings[b].height).toBe(building.height);
    }),
  );
  expect(bytes.repositories[0].buildings.map((b) => b.height)).not.toEqual(
    scene.repositories[0].buildings.map((b) => b.height),
  );
  expect(JSON.stringify(scene)).toBe(original);
});
