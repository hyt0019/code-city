import type { Building } from './model';
import { stableHash } from './metrics';
import { mix } from './color';

export { mix };

export type BuildingStyle =
  'skyscraper' | 'tower' | 'terrace' | 'pavilion' | 'rowhouse' | 'cottage' | 'midrise' | 'utility';
/** How windows are cut into a facade. */
export type FacadePattern = 'ribbon' | 'grid' | 'vertical' | 'punched';
/** What tops a tower: a lit crown band, an antenna, a glass lantern or corner beacons. */
export type Crown = 'halo' | 'mast' | 'lantern' | 'corners' | 'none';
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
  /** Lit panes become the city's lights; unlit panes read as dark glass. */
  lit: boolean;
  /** Crown lighting in the district's accent color. */
  glow?: boolean;
  /** 1–3 selects a slow ambient flicker; 0 or undefined stays steady. */
  twinkle?: number;
}
/** A small aircraft-warning light on a roof or mast. */
export interface Beacon {
  x: number;
  y: number;
  z: number;
}
export interface BuildingLook {
  /** Daylight glass instead of lit windows. */
  light?: boolean;
  /** The bright language color used for crown lighting. */
  accent?: string;
}

export function buildingStyle(b: Building): BuildingStyle {
  const variant = (b.seed ?? stableHash(b.id)) % 3;
  if (b.height >= 90) return 'skyscraper';
  if (b.height >= 42) return 'tower';
  if (b.height >= 18) return variant === 0 ? 'terrace' : 'midrise';
  if (b.height >= 9) return b.category === 'docs' || variant === 0 ? 'pavilion' : 'rowhouse';
  if (b.height >= 6) return 'cottage';
  return 'utility';
}

const pitched = (style: BuildingStyle) => style === 'pavilion' || style === 'cottage';

/** Roof detail always fits inside the four-unit framing allowance. */
export function roofRise(b: Building): number {
  return pitched(buildingStyle(b))
    ? Math.min(3.4, Math.min(b.width, b.depth) * 0.28)
    : 0.4 + Math.min(2.6, Math.min(b.width, b.depth) * 0.16);
}

const warm = '#fbd094';
const neutral = '#f3e7ce';
const cool = '#b0d8ec';
const amber = '#f6ab6b';
/** Each building has its own light temperature; most of the city glows warm. */
const temperatures = [warm, warm, warm, warm, neutral, neutral, cool, amber];

/**
 * One deterministic architectural model shared by SVG and Three.js.
 * `b.color` is the facade tone. Every variation comes from the building's seed, so the same
 * code always produces the same skyline.
 */
export function buildingArchitecture(b: Building, count: number, look: BuildingLook = {}) {
  const light = look.light ?? false;
  const style = buildingStyle(b);
  const tall = style === 'tower' || style === 'skyscraper';
  const banded = tall || style === 'terrace' || style === 'midrise';
  const seed = b.seed ?? stableHash(b.id);
  const pick = (salt: string, options: number) => stableHash(`${seed}:${salt}`) % options;
  const accent = look.accent ?? mix(b.color, '#ffffff', 0.45);
  const pattern: FacadePattern = !banded
    ? 'punched'
    : tall
      ? (['ribbon', 'grid', 'vertical'] as const)[pick('pattern', 3)]
      : (['ribbon', 'grid'] as const)[pick('pattern', 2)];
  const w = b.width,
    d = b.depth,
    h = b.height;
  const unit = Math.min(1, w / 10, d / 10);
  const inset = Math.min(w, d) * 0.055;
  const base = Math.min(1.5, h * 0.15);
  const trim = light ? mix(b.color, '#ffffff', 0.62) : mix(b.color, '#c9ced6', 0.3);
  const glassTone = light ? mix(b.color, '#71859b', 0.5) : mix(b.color, '#0b0f15', 0.62);
  const glassBody = light ? mix(b.color, '#dfe6ee', 0.25) : mix(b.color, '#1a222c', 0.3);
  const primary = temperatures[pick('temperature', temperatures.length)];
  const secondary = primary === warm ? neutral : warm;
  const litShare = 38 + pick('occupancy', 40);
  const solids: BuildingPart[] = [];
  const windows: FacadeWindow[] = [];
  const beacons: Beacon[] = [];
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
  add(
    0,
    0,
    0.4,
    w,
    d,
    Math.max(0.1, base - 0.4),
    light ? mix(b.color, '#c0beb8', 0.45) : mix(b.color, '#16181c', 0.55),
  );

  const lower: BuildingPart = {
    x: inset,
    y: inset,
    z: base,
    width: w - 2 * inset,
    depth: d - 2 * inset,
    height: h - base,
    // Towers read as glass; low buildings keep their solid facade tone.
    color: tall ? glassBody : b.color,
  };
  const masses = [lower];
  if ((tall || style === 'terrace') && h > 9) {
    const split = tall ? 0.26 : 0.58;
    lower.height = h * split - base;
    lower.color = b.color;
    const setback = Math.min(w, d) * (tall ? 0.11 : 0.19);
    // Some towers rise off-center, which breaks up a row of identical silhouettes.
    const offset = tall && pick('offset', 3) === 0 ? setback * 0.8 : 0;
    masses.push({
      x: inset + setback - offset,
      y: inset + setback + offset,
      z: h * split,
      width: lower.width - 2 * setback,
      depth: lower.depth - 2 * setback,
      height: h * (1 - split),
      color: tall ? glassBody : mix(b.color, light ? '#ffffff' : '#c8cdd4', 0.06),
    });
    if (style === 'skyscraper') {
      const shaft = masses[1];
      shaft.height = h * 0.48;
      masses.push({
        ...shaft,
        x: shaft.x + setback + offset,
        y: shaft.y + setback - offset,
        z: h * 0.74,
        width: shaft.width - 2 * setback,
        depth: shaft.depth - 2 * setback,
        height: h * 0.26,
        color: light ? mix(b.color, '#eef2f6', 0.35) : mix(b.color, '#222b36', 0.2),
      });
    }
  }
  // Dense cities keep their lights; only the number of bands and the hidden faces are reduced.
  const maxRows = count > 2500 ? 2 : count > 600 ? 6 : 18;
  const maxColumns = count > 600 ? 2 : 3;
  const faces =
    count > 2500 ? (['front', 'right'] as const) : (['front', 'back', 'left', 'right'] as const);
  const doorWidth = Math.min(lower.width * 0.2, 2.5);
  for (const mass of masses) {
    solids.push(mass);
    const rows =
      pattern === 'punched'
        ? 1
        : Math.min(
            maxRows,
            Math.max(1, Math.floor(mass.height / { ribbon: 3.4, grid: 3, vertical: 6.5 }[pattern])),
          );
    const floor = mass.height / rows;
    for (const face of faces) {
      const horizontal = face === 'front' || face === 'back';
      const length = horizontal ? mass.width : mass.depth;
      const columns =
        pattern === 'ribbon'
          ? Math.min(maxColumns, Math.max(1, Math.floor(length / 4)))
          : pattern === 'grid'
            ? Math.min(maxColumns + 1, Math.max(2, Math.floor(length / 2.6)))
            : pattern === 'vertical'
              ? Math.min(maxColumns + 1, Math.max(2, Math.floor(length / 2.4)))
              : face === 'front' && mass === lower
                ? length >= 5
                  ? 2
                  : 0
                : Math.min(2, Math.max(1, Math.floor(length / 5)));
      const bay = length / Math.max(1, columns);
      const span = bay * { ribbon: 0.86, grid: 0.5, vertical: 0.32, punched: 0.42 }[pattern];
      const rise = {
        ribbon: Math.min(floor * 0.5, 2.2),
        grid: Math.min(floor * 0.56, 2),
        vertical: Math.min(floor * 0.84, 3.2),
        punched: Math.min(mass.height * 0.34, 2.4, floor * 0.6),
      }[pattern];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const hash = stableHash(`${seed}:${face}:${row}:${col}`);
          const lit = hash % 100 < (banded ? litShare : 48);
          const z =
            pattern === 'punched'
              ? mass.z + mass.height * 0.52 - rise / 2
              : mass.z + (row + 0.5) * floor - rise / 2;
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
            z,
            width: horizontal ? span : 0.025,
            depth: horizontal ? 0.025 : span,
            height: rise,
            lit,
            twinkle: lit && !light && hash % 13 === 0 ? 1 + ((hash >>> 8) % 3) : 0,
            color: light
              ? hash % 4 === 0
                ? '#c3d2e0'
                : mix(glassTone, '#a9bccf', 0.55)
              : lit
                ? (hash >>> 4) % 7 === 0
                  ? secondary
                  : primary
                : glassTone,
          });
        }
      }
    }
    // A single cornice per mass articulates the silhouette without striping every storey.
    add(
      mass.x - inset * 0.4,
      mass.y - inset * 0.4,
      mass.z + mass.height - 0.25,
      mass.width + inset * 0.8,
      mass.depth + inset * 0.8,
      0.35,
      trim,
    );
    if (tall && mass !== lower) {
      const fin = Math.min(mass.width, mass.depth) * 0.04;
      for (const x of [mass.x, mass.x + mass.width - fin])
        for (const y of [mass.y, mass.y + mass.depth - fin])
          add(x, y, mass.z, fin, fin, mass.height, trim);
    }
  }

  const top = masses.at(-1)!;
  const choice = (['halo', 'mast', 'lantern', 'corners'] as const)[pick('crown', 4)];
  // A star spire already occupies the roof's center, so it keeps a crown that leaves it free.
  const crown: Crown = !tall
    ? 'none'
    : b.spireHeight && (choice === 'mast' || choice === 'lantern')
      ? 'halo'
      : choice;
  const roof: BuildingPart = {
    x: top.x - inset * 0.4,
    y: top.y - inset * 0.4,
    z: h,
    width: top.width + inset * 0.8,
    depth: top.depth + inset * 0.8,
    height: roofRise(b),
    color: light ? mix(b.color, '#8e98a5', 0.32) : mix(b.color, '#2b2f36', 0.45),
  };
  let pitchedRoof: BuildingPart | undefined;
  if (pitched(style)) {
    pitchedRoof = roof;
    if (style === 'cottage' && pick('chimney', 2) === 0)
      add(
        roof.x + roof.width * 0.68,
        roof.y + roof.depth * 0.22,
        h,
        Math.max(0.3, roof.width * 0.12),
        Math.max(0.3, roof.depth * 0.12),
        roof.height * 0.92,
        light ? mix(b.color, '#8e98a5', 0.45) : mix(b.color, '#22252b', 0.5),
      );
  } else {
    add(roof.x, roof.y, h, roof.width, roof.depth, 0.4, trim);
    const rim = Math.min(0.5, unit * 0.55);
    add(
      top.x + rim,
      top.y + rim,
      h + 0.4,
      top.width - 2 * rim,
      top.depth - 2 * rim,
      0.1,
      b.category === 'test'
        ? light
          ? '#a8d1a9'
          : '#537e54'
        : light
          ? mix(b.color, '#ffffff', 0.35)
          : mix(b.color, '#1c1f24', 0.4),
    );
    const roofTop = Math.max(0.6, roof.height - 0.4);
    if (crown === 'halo') {
      // A band of light just under the roof: the district's signature color at night.
      const band = Math.min(1.1, top.height * 0.05);
      for (const face of ['front', 'back', 'left', 'right'] as const) {
        const horizontal = face === 'front' || face === 'back';
        windows.push({
          face,
          x: horizontal
            ? top.x + top.width * 0.03
            : face === 'right'
              ? top.x + top.width
              : top.x - 0.025,
          y: !horizontal
            ? top.y + top.depth * 0.03
            : face === 'front'
              ? top.y + top.depth
              : top.y - 0.025,
          z: h - 0.45 - band,
          width: horizontal ? top.width * 0.94 : 0.025,
          depth: horizontal ? 0.025 : top.depth * 0.94,
          height: band,
          lit: true,
          glow: true,
          color: light ? mix(accent, '#ffffff', 0.15) : mix(accent, '#ffffff', 0.25),
        });
      }
    }
    if (crown === 'mast') {
      const mast = Math.max(0.25, Math.min(top.width, top.depth) * 0.05);
      add(
        top.x + top.width / 2 - mast / 2,
        top.y + top.depth / 2 - mast / 2,
        h + 0.4,
        mast,
        mast,
        3.3,
        trim,
      );
      beacons.push({ x: top.x + top.width / 2, y: top.y + top.depth / 2, z: h + 3.85 });
    } else if (crown === 'lantern') {
      // A small glass lantern whose every pane is lit.
      const lantern = {
        x: top.x + top.width * 0.22,
        y: top.y + top.depth * 0.22,
        z: h + 0.4,
        width: top.width * 0.56,
        depth: top.depth * 0.56,
        height: Math.min(roofTop + 0.6, 2.6),
        color: glassBody,
      };
      solids.push(lantern);
      for (const face of ['front', 'right', 'back', 'left'] as const) {
        const horizontal = face === 'front' || face === 'back';
        windows.push({
          face,
          x: horizontal
            ? lantern.x + lantern.width * 0.08
            : face === 'right'
              ? lantern.x + lantern.width
              : lantern.x - 0.025,
          y: !horizontal
            ? lantern.y + lantern.depth * 0.08
            : face === 'front'
              ? lantern.y + lantern.depth
              : lantern.y - 0.025,
          z: lantern.z + lantern.height * 0.18,
          width: horizontal ? lantern.width * 0.84 : 0.025,
          depth: horizontal ? 0.025 : lantern.depth * 0.84,
          height: lantern.height * 0.6,
          lit: true,
          glow: true,
          color: light ? mix(accent, '#ffffff', 0.35) : mix(accent, warm, 0.35),
        });
      }
    } else if (crown === 'corners') {
      for (const [x, y] of [
        [top.x + 0.3, top.y + 0.3],
        [top.x + top.width - 0.3, top.y + 0.3],
        [top.x + 0.3, top.y + top.depth - 0.3],
        [top.x + top.width - 0.3, top.y + top.depth - 0.3],
      ])
        beacons.push({ x, y, z: h + 0.7 });
    }
    if (banded && crown !== 'lantern' && crown !== 'mast') {
      const variant = tall ? 0 : pick('roof', 3);
      if (variant === 0)
        add(
          top.x + top.width * 0.3,
          top.y + top.depth * 0.28,
          h + 0.4,
          top.width * 0.38,
          top.depth * 0.34,
          roofTop,
          light ? mix(b.color, '#ffffff', 0.5) : mix(b.color, '#8b929b', 0.25),
        );
      else if (variant === 1) {
        // A rooftop water tank.
        const tank = Math.min(top.width, top.depth) * 0.22;
        add(
          top.x + top.width * 0.62,
          top.y + top.depth * 0.18,
          h + 0.4,
          tank,
          tank,
          Math.min(2.8, roofTop + 1),
          light ? mix(b.color, '#a7a091', 0.4) : mix(b.color, '#3a3128', 0.45),
        );
      } else {
        // Solar panels in two dark rows.
        for (const row of [0.2, 0.55])
          add(
            top.x + top.width * 0.12,
            top.y + top.depth * row,
            h + 0.5,
            top.width * 0.76,
            top.depth * 0.22,
            0.3,
            light ? '#7d8fa8' : '#253247',
          );
      }
    }
    if (style === 'terrace') {
      add(
        lower.x + lower.width * 0.08,
        lower.y + lower.depth * 0.78,
        lower.z + lower.height + 0.1,
        lower.width * 0.3,
        lower.depth * 0.12,
        0.65 * unit,
        light ? '#a8c9a5' : '#33493a',
      );
    }
    if (style === 'rowhouse') {
      // A parapet around an open roof gives low residential blocks a distinct silhouette.
      const rimWidth = Math.min(top.width, top.depth) * 0.05;
      add(top.x, top.y, h + 0.4, top.width, rimWidth, 0.8, trim);
      add(top.x, top.y + top.depth - rimWidth, h + 0.4, top.width, rimWidth, 0.8, trim);
      add(top.x, top.y, h + 0.4, rimWidth, top.depth, 0.8, trim);
      add(top.x + top.width - rimWidth, top.y, h + 0.4, rimWidth, top.depth, 0.8, trim);
    }
  }

  // A recessed, softly lit entrance makes even a low building read as architecture.
  const doorHeight = Math.min(lower.height * 0.32, 3.2);
  windows.push({
    face: 'front',
    x: w / 2 - doorWidth / 2,
    y: lower.y + lower.depth + 0.03,
    z: base,
    width: doorWidth,
    depth: 0.025,
    height: doorHeight,
    lit: !light,
    color: light ? mix(b.color, '#4c5866', 0.6) : '#a57d4a',
  });
  return { style, pattern, crown, solids, windows, pitchedRoof, beacons };
}
