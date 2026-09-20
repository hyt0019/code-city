import { describe, expect, it } from 'vitest';
import type { RepositorySnapshot } from '../src/core/model';
import { layoutCity } from '../src/layout/treemap';
import { sceneSchema } from '../src/core/config';
import { renderBanner } from '../src/renderers/svg/city';

function snapshot(count: number, name = 'example'): RepositorySnapshot {
  return {
    schemaVersion: 1,
    name,
    source: 'local',
    dirty: true,
    snapshotHash: 'fixture',
    files: Array.from({ length: count }, (_, index) => ({
      path: `${index % 3 === 0 ? 'tests' : index % 3 === 1 ? 'src' : 'docs'}/file-${index}.ts`,
      language: 'TypeScript',
      category: 'source',
      lines: index % 91,
      bytes: (index % 71) * 40 + 1,
      contentHash: String(index),
    })),
    skipped: [],
  };
}
describe('deterministic treemap city', () => {
  it('is byte-identical after input reordering', () => {
    const a = snapshot(35, 'alpha'),
      b = snapshot(21, 'beta');
    const first = layoutCity([a, b]);
    a.files.reverse();
    b.files.reverse();
    const second = layoutCity([b, a]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(renderBanner(second)).toBe(renderBanner(first));
  });
  it.each([0, 1, 30, 5001])(
    'lays out %i files with finite positive dimensions and no overlap',
    (count) => {
      const scene = layoutCity([snapshot(count)]);
      expect(() => sceneSchema.parse(scene)).not.toThrow();
      const repo = scene.repositories[0];
      expect(repo.buildings).toHaveLength(count);
      const sorted = [...repo.buildings].sort((a, b) => a.position.x - b.position.x);
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        expect(a.position.x).toBeGreaterThanOrEqual(repo.bounds.x);
        expect(a.position.y).toBeGreaterThanOrEqual(repo.bounds.y);
        expect(a.position.x + a.width).toBeLessThanOrEqual(
          repo.bounds.x + repo.bounds.width + 1e-5,
        );
        expect(a.position.y + a.depth).toBeLessThanOrEqual(
          repo.bounds.y + repo.bounds.depth + 1e-5,
        );
        for (
          let j = i + 1;
          j < sorted.length && sorted[j].position.x < a.position.x + a.width - 1e-5;
          j++
        ) {
          const b = sorted[j];
          expect(
            a.position.y < b.position.y + b.depth - 1e-5 &&
              a.position.y + a.depth > b.position.y + 1e-5,
          ).toBe(false);
        }
      }
    },
  );
  it('handles an enormous file alongside tiny files without collapsing land', () => {
    const repo = snapshot(501);
    repo.files[0].bytes = 1e12;
    repo.files[0].lines = 1e9;
    const scene = layoutCity([repo]);
    expect(() => sceneSchema.parse(scene)).not.toThrow();
    expect(scene.repositories[0].buildings.every((b) => b.width > 0 && b.depth > 0)).toBe(true);
  });
  it('rejects ambiguous duplicate repository names', () => {
    expect(() => layoutCity([snapshot(1), snapshot(2)])).toThrow('names must be unique');
  });
  it('keeps IDs unique across repository and path separators', () => {
    const a = snapshot(1, 'a-b'),
      b = snapshot(1, 'a');
    a.files[0].path = 'c.ts';
    b.files[0].path = 'b-c.ts';
    const buildings = layoutCity([a, b]).repositories.flatMap((repo) => repo.buildings);
    expect(new Set(buildings.map((building) => building.id)).size).toBe(2);
  });
});
