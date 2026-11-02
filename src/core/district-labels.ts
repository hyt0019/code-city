import type { CityScene, Point, RepositoryDistrict } from './model';
import { project } from '../layout/isometric';

export interface DistrictLabelInput {
  key: string;
  center: Point;
  left: Point;
  right: Point;
}

/** Put names outside the skyline; route every label back to its own district. */
export function placeDistrictLabels(
  input: DistrictLabelInput[],
  width: number,
  height: number,
  options: { labelWidth?: number; labelHeight?: number; top?: number; bottom?: number } = {},
) {
  const margin = Math.min(16, width * 0.025);
  const labelWidth = options.labelWidth ?? Math.min(182, width * 0.2);
  const labelHeight = options.labelHeight ?? (width < 600 ? 24 : 30);
  const gap = labelHeight < 26 ? 8 : 12;
  const top = options.top ?? height * 0.14;
  const bottom = (options.bottom ?? height * 0.85) - labelHeight;
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

export interface CityFrame {
  width: number;
  height: number;
  /** Horizontal space kept free on each side for district labels. */
  rail: number;
  top: number;
  bottom: number;
}
export const defaultFrame: CityFrame = {
  width: 1040,
  height: 660,
  rail: 210,
  top: 85,
  bottom: 115,
};

/** Reserve side rails for district labels while including every roof and spire. */
export function frameDistricts(scene: CityScene, frame: CityFrame = defaultFrame): CityScene {
  if (scene.repositories.length < 2) return scene;
  return fitCity(scene, frame);
}

/** Uniformly scale and center the whole city, every roof and spire included, inside a frame. */
export function fitCity(scene: CityScene, frame: CityFrame): CityScene {
  if (!scene.repositories.length) return scene;
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
  const innerHeight = frame.height - frame.top - frame.bottom;
  const scale = Math.min(
    (frame.width - 2 * frame.rail) / Math.max(1, maxX - minX),
    innerHeight / Math.max(1, maxY - minY),
  );
  return {
    ...scene,
    camera: {
      scale,
      origin: {
        x: frame.width / 2 - ((minX + maxX) / 2) * scale,
        y: frame.top + innerHeight / 2 - ((minY + maxY) / 2) * scale,
      },
    },
  };
}
