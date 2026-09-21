import { expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { applyHeightMetric } from '../src/core/metrics';
import { sceneSchema } from '../src/core/config';
import { layoutCity } from '../src/layout/treemap';
import { privateSnapshot } from './privacy-fixture';
import { repositoryScene } from '../src/core/repository-scene';

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

it('uses the same height scale for public and anonymized files, including after filtering', () => {
  const input = privateSnapshot();
  const publicScene = layoutCity([{ ...input, privacy: 'full' }]);
  const privateScene = layoutCity([input]);
  for (const metric of ['lines', 'bytes'] as const) {
    const publicBuildings = applyHeightMetric(publicScene, metric).repositories[0].buildings;
    const privateBuildings = repositoryScene(applyHeightMetric(privateScene, metric), input.name)
      .repositories[0].buildings;
    const heights = (buildings: typeof publicBuildings) =>
      buildings
        .map((b) => ({ lines: b.lines, height: b.height }))
        .sort((a, b) => a.lines - b.lines);
    expect(heights(privateBuildings)).toEqual(heights(publicBuildings));
    expect(privateBuildings.every((b) => b.path === '' && !b.githubUrl)).toBe(true);
  }
});
