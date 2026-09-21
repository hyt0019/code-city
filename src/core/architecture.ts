import type { Building } from './model';
import { stableHash } from './metrics';

export type BuildingStyle = 'tower' | 'terrace' | 'pavilion' | 'midrise' | 'utility';
export interface BuildingPart {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
}
export interface FacadeWindow extends BuildingPart {
  face: 'front' | 'back' | 'left' | 'right';
}

function mix(color: string, target: string, amount: number): string {
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(color.slice(i, i + 2), 16) * (1 - amount) +
          parseInt(target.slice(i, i + 2), 16) * amount,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function buildingStyle(b: Building): BuildingStyle {
  if (Math.min(b.width, b.depth) < 2.5 || b.category === 'config') return 'utility';
  if (b.category === 'docs') return 'pavilion';
  if (b.landmark || b.height > Math.min(b.width, b.depth) * 1.6) return 'tower';
  return (b.seed ?? stableHash(b.id)) % 3 === 0 ? 'terrace' : 'midrise';
}

/** Roof detail always fits inside the four-unit framing allowance. */
export function roofRise(b: Building): number {
  return buildingStyle(b) === 'pavilion'
    ? Math.min(3.4, Math.min(b.width, b.depth) * 0.28)
    : 0.4 + Math.min(2.6, Math.min(b.width, b.depth) * 0.16);
}

/** One deterministic architectural model shared by SVG and Three.js. */
export function buildingArchitecture(b: Building, count: number) {
  const style = buildingStyle(b);
  const seed = b.seed ?? stableHash(b.id);
  const w = b.width,
    d = b.depth,
    h = b.height;
  const unit = Math.min(1, w / 10, d / 10);
  const inset = Math.min(w, d) * 0.055;
  const base = Math.min(1.5, h * 0.15);
  const trim = mix(b.color, '#d8e4e8', 0.38);
  const glass = mix(b.color, '#15303d', 0.58);
  const solids: BuildingPart[] = [];
  const windows: FacadeWindow[] = [];
  const add = (
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    color: string,
  ) => {
    solids.push({ x, y, z, width, depth, height, color });
  };
  add(0, 0, 0.4, w, d, Math.max(0.1, base - 0.4), mix(b.color, '#6d7c87', 0.55));

  const lower: BuildingPart = {
    x: inset,
    y: inset,
    z: base,
    width: w - 2 * inset,
    depth: d - 2 * inset,
    height: h - base,
    color: style === 'tower' ? mix(b.color, '#214352', 0.22) : b.color,
  };
  const masses = [lower];
  if ((style === 'tower' || style === 'terrace') && h > 9) {
    const split = style === 'tower' ? 0.64 : 0.58;
    lower.height = h * split - base;
    const setback = Math.min(w, d) * (style === 'tower' ? 0.14 : 0.19);
    masses.push({
      x: inset + setback,
      y: inset + setback,
      z: h * split,
      width: lower.width - 2 * setback,
      depth: lower.depth - 2 * setback,
      height: h * (1 - split),
      color: mix(b.color, '#c8e0e6', 0.09),
    });
  }
  // Smaller or denser cities still retain windows; only their number is reduced.
  const maxRows = count > 2500 ? 1 : count > 600 ? 2 : count > 150 ? 3 : 5;
  const maxColumns = count > 600 ? 2 : 3;
  for (const mass of masses) {
    solids.push(mass);
    const rows = Math.min(maxRows, Math.max(1, Math.floor(mass.height / 4)));
    const floor = mass.height / rows;
    for (const face of ['front', 'back', 'left', 'right'] as const) {
      const horizontal = face === 'front' || face === 'back';
      const length = horizontal ? mass.width : mass.depth;
      const columns = Math.min(maxColumns, Math.max(1, Math.floor(length / 3)));
      const bay = length / columns;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const lit = (seed + row * 7 + col * 13 + (horizontal ? 0 : 3)) % 5 !== 0;
          const span = bay * (style === 'tower' ? 0.66 : 0.46);
          const rise = floor * (style === 'tower' ? 0.58 : 0.46);
          windows.push({
            face,
            x: horizontal
              ? mass.x + (col + 0.5) * bay - span / 2
              : face === 'right'
                ? mass.x + mass.width
                : mass.x - 0.025,
            y: !horizontal
              ? mass.y + (col + 0.5) * bay - span / 2
              : face === 'front'
                ? mass.y + mass.depth
                : mass.y - 0.025,
            z: mass.z + (row + 0.5) * floor - rise / 2,
            width: horizontal ? span : 0.025,
            depth: horizontal ? 0.025 : span,
            height: rise,
            color: lit ? ((seed + col) % 3 === 0 ? '#f3d9a1' : '#a9dbe8') : glass,
          });
        }
      }
    }
    // Thin slab edges, rather than giant roof blocks, articulate each storey.
    if (count <= 2500) {
      for (let row = 1; row < rows; row++)
        add(
          mass.x - inset * 0.25,
          mass.y - inset * 0.25,
          mass.z + row * floor - 0.15,
          mass.width + inset * 0.5,
          mass.depth + inset * 0.5,
          0.3,
          trim,
        );
    }
    add(
      mass.x - inset * 0.4,
      mass.y - inset * 0.4,
      mass.z + mass.height - 0.25,
      mass.width + inset * 0.8,
      mass.depth + inset * 0.8,
      0.35,
      trim,
    );
  }

  const top = masses.at(-1)!;
  const roof: BuildingPart = {
    x: top.x - inset * 0.4,
    y: top.y - inset * 0.4,
    z: h,
    width: top.width + inset * 0.8,
    depth: top.depth + inset * 0.8,
    height: roofRise(b),
    color: mix(b.color, '#566879', 0.4),
  };
  let pitchedRoof: BuildingPart | undefined;
  if (style === 'pavilion') pitchedRoof = roof;
  else {
    add(roof.x, roof.y, h, roof.width, roof.depth, 0.4, trim);
    const rim = Math.min(0.5, unit * 0.55);
    add(
      top.x + rim,
      top.y + rim,
      h + 0.4,
      top.width - 2 * rim,
      top.depth - 2 * rim,
      0.1,
      b.category === 'test' ? '#78a967' : mix(b.color, '#253442', 0.5),
    );
    add(
      top.x + top.width * 0.3,
      top.y + top.depth * 0.28,
      h + 0.4,
      top.width * 0.38,
      top.depth * 0.34,
      roof.height - 0.4,
      mix(b.color, '#9eabb3', 0.35),
    );
    if (style === 'terrace') {
      add(
        lower.x + lower.width * 0.08,
        lower.y + lower.depth * 0.78,
        lower.z + lower.height + 0.1,
        lower.width * 0.3,
        lower.depth * 0.12,
        0.65 * unit,
        '#72957a',
      );
    }
  }

  // A recessed entrance and a canopy make even a low building read as architecture.
  const doorWidth = Math.min(lower.width * 0.2, 2.5);
  const doorHeight = Math.min(lower.height * 0.32, 3.2);
  windows.push({
    face: 'front',
    x: w / 2 - doorWidth / 2,
    y: lower.y + lower.depth + 0.03,
    z: base,
    width: doorWidth,
    depth: 0.025,
    height: doorHeight,
    color: '#183241',
  });
  add(
    w / 2 - doorWidth * 0.75,
    lower.y + lower.depth - inset,
    base + doorHeight,
    doorWidth * 1.5,
    Math.min(inset * 1.6, d * 0.1),
    0.22,
    trim,
  );
  return { style, solids, windows, pitchedRoof };
}
