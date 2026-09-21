import type { Building, CityScene } from './model';
import { project } from '../layout/isometric';
import { roofRise } from './architecture';

export function archivedColor(color: string, archived?: boolean): string {
  if (!archived) return color;
  const gray = Math.round(
    parseInt(color.slice(1, 3), 16) * 0.3 +
      parseInt(color.slice(3, 5), 16) * 0.59 +
      parseInt(color.slice(5, 7), 16) * 0.11,
  )
    .toString(16)
    .padStart(2, '0');
  return `#${gray}${gray}${gray}`;
}

export function spireBase(building: Building): number {
  return building.height + roofRise(building);
}

export function applyRepositorySignals(scene: CityScene): CityScene {
  const repositories = scene.repositories.map((repo) => {
    const sorted = [...repo.buildings].sort((a, b) => (a.id < b.id ? -1 : 1));
    const landmark = sorted.find((building) => building.landmark) ?? sorted[0];
    return {
      ...repo,
      buildings: repo.buildings.map((building) => ({
        ...building,
        archived: repo.archived ?? false,
        spireHeight:
          repo.stars > 0 && building.id === landmark?.id
            ? Number(Math.min(18, 2 + Math.log2(repo.stars + 1) * 1.6).toFixed(4))
            : 0,
      })),
    };
  });
  // Fit tall spires without moving any parcels or changing the default composition.
  const buildings = repositories.flatMap((repo) => repo.buildings);
  let camera = scene.camera;
  if (buildings.some((building) => building.spireHeight > 0)) {
    const bounds = scene.bounds ?? { x: 0, y: 0, width: 168, depth: 168 };
    const unit = { origin: { x: 0, y: 0 }, scale: 1 };
    const top = buildings.reduce(
      (minimum, building) =>
        Math.min(
          minimum,
          project(building.position, building.height + 4 + building.spireHeight, unit).y,
        ),
      Infinity,
    );
    const bottom = project(
      { x: bounds.x + bounds.width + 5, y: bounds.y + bounds.depth + 5 },
      -5,
      unit,
    ).y;
    if (
      camera.origin.y + top * camera.scale < 20 ||
      camera.origin.y + bottom * camera.scale > 640
    ) {
      const scale = Math.min(camera.scale, 600 / (bottom - top));
      camera = {
        scale,
        origin: {
          x: 520 - ((520 - camera.origin.x) / camera.scale) * scale,
          y: 330 - ((top + bottom) / 2) * scale,
        },
      };
    }
  }
  return { ...scene, repositories, camera };
}
