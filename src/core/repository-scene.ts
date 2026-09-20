import type { CityScene } from './model';
import { project } from '../layout/isometric';
import { stableHash } from './metrics';

/** Keep file geometry unchanged; only frame the selected district. */
export function repositoryScene(scene: CityScene, name: string): CityScene {
  if (!name) return scene;
  const repository = scene.repositories.find((repo) => repo.name === name);
  if (!repository) throw new Error(`Unknown repository: ${name}`);
  const { x, y, width, depth } = repository.bounds;
  const camera = { origin: { x: 0, y: 0 }, scale: 1 };
  const points = [
    project({ x: x - 5, y: y - 5 }, 0, camera),
    project({ x: x + width + 5, y: y - 5 }, 0, camera),
    project({ x: x - 5, y: y + depth + 5 }, 0, camera),
    project({ x: x + width + 5, y: y + depth + 5 }, -5, camera),
    ...repository.buildings.flatMap((b) => [
      project(b.position, b.height + 4, camera),
      project({ x: b.position.x + b.width, y: b.position.y }, b.height + 4, camera),
      project({ x: b.position.x, y: b.position.y + b.depth }, b.height + 4, camera),
    ]),
  ];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const scale = Math.min(850 / (maxX - minX), 480 / (maxY - minY));
  return {
    ...scene,
    repositories: [repository],
    bounds: { ...repository.bounds },
    camera: {
      scale,
      origin: { x: 520 - ((minX + maxX) / 2) * scale, y: 315 - ((minY + maxY) / 2) * scale },
    },
  };
}

/** Portable filenames; hash transformed names to avoid normalization collisions. */
export function repositorySlug(name: string): string {
  if (/^[a-z0-9][a-z0-9-]{0,79}$/.test(name) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name))
    return name;
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'repository';
  return `${slug}-${stableHash(name).toString(16)}`;
}
