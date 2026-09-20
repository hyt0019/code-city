import type { CityScene } from './model';

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
