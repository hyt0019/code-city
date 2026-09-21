import type { CityScene, HeightMetric } from './model';

/** Height changes never allocate new land or move a building. */
export function applyHeightMetric(scene: CityScene, metric: HeightMetric): CityScene {
  if ((scene.heightMetric ?? 'lines') === metric) return scene;
  return {
    ...scene,
    heightMetric: metric,
    repositories: scene.repositories.map((repo) => ({
      ...repo,
      buildings: repo.buildings.map((building) => {
        const lineHeight = building.lineHeight ?? building.height;
        return {
          ...building,
          lineHeight,
          height: metric === 'lines' ? lineHeight : heightFromLines(building.bytes / 40),
        };
      }),
    })),
  };
}

export function heightFromLines(lines: number): number {
  // A global power curve keeps ordinary files low and makes large files landmarks.
  // Filtering or redacting a repository must never change the scale of its buildings.
  const value = Number.isNaN(lines) ? 0 : Math.max(0, lines);
  return Math.min(160, 4 + 0.27 * value ** 0.8);
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

export function sceneStats(scene: CityScene) {
  const buildings = scene.repositories.flatMap((repo) => repo.buildings);
  return {
    repositories: scene.repositories.length,
    files: buildings.length,
    lines: buildings.reduce((sum, building) => sum + building.lines, 0),
    languages: [
      ...new Set(
        scene.repositories
          .filter((repo) => repo.privacy !== 'city-only')
          .flatMap((repo) => repo.buildings.map((building) => building.language)),
      ),
    ],
  };
}

export function compactNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
