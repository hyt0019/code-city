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
        const bytesHeight = Math.max(3, Math.min(28, 2 + Math.log2(building.bytes + 1) * 1.1));
        return {
          ...building,
          lineHeight,
          height:
            metric === 'lines'
              ? lineHeight
              : bytesHeight * (building.landmark ? 2.5 : building.category === 'docs' ? 0.7 : 1.3),
        };
      }),
    })),
  };
}

export function heightFromLines(lines: number): number {
  return Math.max(3, Math.min(28, 2 + Math.log2(Math.max(0, lines) + 1) * 1.5));
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
    languages: [...new Set(buildings.map((building) => building.language))],
  };
}

export function compactNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}
