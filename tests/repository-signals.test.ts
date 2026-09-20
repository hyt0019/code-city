import { expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { applyRepositorySignals, archivedColor } from '../src/core/repository-signals';
import { windowColor } from '../src/core/activity';
import { renderBanner } from '../src/renderers/svg/city';
import { sceneSchema } from '../src/core/config';
import { repositoryScene } from '../src/core/repository-scene';
import { project } from '../src/layout/isometric';

it('adds exactly one bounded star spire per nonempty starred repository without moving files', () => {
  const input = createFixture();
  input.repositories[0].stars = 4;
  input.repositories[1].stars = 1000000;
  const scene = applyRepositorySignals(input);
  expect(() => sceneSchema.parse(scene)).not.toThrow();
  const [small, large, zero] = scene.repositories.map((repo) =>
    repo.buildings.filter((b) => b.spireHeight),
  );
  expect(small).toHaveLength(1);
  expect(large).toHaveLength(1);
  expect(zero).toHaveLength(0);
  expect(large[0].spireHeight).toBeGreaterThan(small[0].spireHeight!);
  expect(large[0].spireHeight).toBeLessThanOrEqual(18);
  input.repositories.forEach((repo, r) =>
    repo.buildings.forEach((b, i) => {
      const after = scene.repositories[r].buildings[i];
      expect([after.position, after.width, after.depth, after.height]).toEqual([
        b.position,
        b.width,
        b.depth,
        b.height,
      ]);
    }),
  );
  expect(applyRepositorySignals(scene)).toEqual(scene);
  expect(renderBanner(scene).match(/data-star-spire=/g)).toHaveLength(2);
  const scoped = repositoryScene(scene, scene.repositories[1].name);
  for (const b of scoped.repositories[0].buildings) {
    expect(
      project(b.position, b.height + 4 + (b.spireHeight ?? 0), scoped.camera).y,
    ).toBeGreaterThan(0);
  }
  input.repositories.forEach((repo) => repo.buildings.reverse());
  expect(
    applyRepositorySignals(input).repositories.map(
      (repo) => repo.buildings.find((b) => b.spireHeight)?.id,
    ),
  ).toEqual(scene.repositories.map((repo) => repo.buildings.find((b) => b.spireHeight)?.id));
});

it('gives archived buildings gray surfaces and dim windows in the shared scene', () => {
  const input = createFixture();
  input.repositories[0].archived = true;
  const scene = applyRepositorySignals(input);
  const b = scene.repositories[0].buildings[0];
  expect(b.archived).toBe(true);
  expect(archivedColor('#459fd5', true)).toMatch(/^#([a-f0-9]{2})\1\1$/);
  expect(windowColor(b, '#ffffff')).not.toBe('#ffffff');
  const svg = renderBanner(scene);
  expect(svg.match(/data-archived="true"/g)).toHaveLength(input.repositories[0].buildings.length);
  expect(input.repositories[0].buildings[0].archived).toBeUndefined();
});
