import type { CityScene, Point, RepositoryDistrict } from './model';
import { project } from '../layout/isometric';

export interface DistrictLabelInput {
  key: string;
  center: Point;
  left: Point;
  right: Point;
}

/** Put names outside the skyline; route every label back to its own district. */
export function placeDistrictLabels(input: DistrictLabelInput[], width: number, height: number) {
  const margin = Math.min(16, width * 0.025);
  const labelWidth = Math.min(182, width * 0.2);
  const labelHeight = width < 600 ? 24 : 30;
  const gap = 12;
  const top = height * 0.14;
  const bottom = height * 0.85 - labelHeight;
  const compare = (a: DistrictLabelInput, b: DistrictLabelInput) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  const sorted = [...input].sort((a, b) => a.center.x - b.center.x || compare(a, b));
  return (['left', 'right'] as const).flatMap((side, index) => {
    const split = Math.ceil(sorted.length / 2);
    const items = (index ? sorted.slice(split) : sorted.slice(0, split))
      .map((item) => ({ ...item, anchor: item[side] }))
      .sort((a, b) => a.anchor.y - b.anchor.y || compare(a, b));
    const positions: number[] = [];
    items.forEach((item, i) => {
      positions.push(
        Math.max(item.anchor.y - labelHeight / 2, i ? positions[i - 1] + labelHeight + gap : top),
      );
    });
    for (let i = positions.length - 1; i >= 0; i--)
      positions[i] = Math.min(
        positions[i],
        i === positions.length - 1 ? bottom : positions[i + 1] - labelHeight - gap,
      );
    return items.map((item, i) => ({
      ...item,
      side,
      x: side === 'left' ? margin : width - margin - labelWidth,
      y: positions[i],
      width: labelWidth,
      height: labelHeight,
    }));
  });
}

export function labelLeader(
  label: Pick<
    ReturnType<typeof placeDistrictLabels>[number],
    'x' | 'y' | 'width' | 'height' | 'side' | 'anchor'
  >,
): Point[] {
  const x = label.side === 'left' ? label.x + label.width : label.x;
  const y = label.y + label.height / 2;
  return [{ x, y }, { x: x + (label.side === 'left' ? 10 : -10), y }, label.anchor];
}

export function districtAnchors(repo: RepositoryDistrict) {
  const { x, y, width, depth } = repo.bounds;
  return {
    center: { x: x + width / 2, y: y + depth / 2 },
    left: { x: x + width * 0.04, y: y + depth * 0.96 },
    right: { x: x + width * 0.96, y: y + depth * 0.04 },
  };
}

/** Reserve side rails for district labels while including every roof and spire. */
export function frameDistricts(scene: CityScene): CityScene {
  if (scene.repositories.length < 2) return scene;
  const unit = { origin: { x: 0, y: 0 }, scale: 1 };
  const points = scene.repositories.flatMap((repo) => {
    const r = repo.bounds;
    return [
      ...[r.x - 5, r.x + r.width + 5].flatMap((x) =>
        [r.y - 5, r.y + r.depth + 5].map((y) => project({ x, y }, -5, unit)),
      ),
      ...repo.buildings.flatMap((b) =>
        [b.position.x, b.position.x + b.width].flatMap((x) =>
          [b.position.y, b.position.y + b.depth].map((y) =>
            project({ x, y }, b.height + 4 + (b.spireHeight ?? 0), unit),
          ),
        ),
      ),
    ];
  });
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
  const scale = Math.min(620 / Math.max(1, maxX - minX), 460 / Math.max(1, maxY - minY));
  return {
    ...scene,
    camera: {
      scale,
      origin: { x: 520 - ((minX + maxX) / 2) * scale, y: 315 - ((minY + maxY) / 2) * scale },
    },
  };
}
