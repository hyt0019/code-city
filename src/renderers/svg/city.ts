import type { Building, CityScene, Point } from '../../core/model';
import { compactNumber, sceneStats } from '../../core/metrics';
import { project } from '../../layout/isometric';
import {
  buildingAccent,
  cityLegend,
  cityPalette,
  languageColor,
  tonedBuilding,
} from '../../core/theme';
import { sceneSource } from '../../core/source-label';
import { windowColor as activityWindowColor } from '../../core/activity';
import { archivedColor, spireBase } from '../../core/repository-signals';
import { repositoryScene } from '../../core/repository-scene';
import { buildingArchitecture } from '../../core/architecture';
import { mix, shade } from '../../core/color';
import { stableHash } from '../../core/metrics';
import {
  defaultFrame,
  districtAnchors,
  fitCity,
  frameDistricts,
  labelLeader,
  placeDistrictLabels,
} from '../../core/district-labels';
import type { CityFrame } from '../../core/district-labels';

export interface RenderOptions {
  selectedId?: string;
  repository?: string;
  showLabels?: boolean;
  interactive?: boolean;
  /** Fit the city into a custom viewport instead of the 1040 × 660 explorer canvas. */
  frame?: CityFrame;
  /** Keeps gradient ids and animation classes unique when several cities share a document. */
  idPrefix?: string;
  /**
   * Ambient life. `calm` (the default) switches a few windows and blinks the beacons in step,
   * so an image repaints only a few times per second; README banners stay light. `full` adds
   * smooth flicker, independent beacons and moving traffic for the interactive page.
   */
  motion?: 'none' | 'calm' | 'full';
  /** Tag each building with a staggered delay so a page can let the city grow in. */
  intro?: boolean;
}

export const fontStack = `Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`;

export function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!,
  );
}

/** Rough text width for the label rails; avoids measuring fonts in Node and the browser. */
function textWidth(text: string, size: number): number {
  let units = 0;
  for (const character of text)
    units += /[⺀-￿]/.test(character)
      ? 1
      : /[A-Z0-9_]/.test(character)
        ? 0.64
        : /[iljtfr.\-']/.test(character)
          ? 0.32
          : 0.54;
  return units * size;
}

/**
 * A canvas coordinate to a tenth of a unit, without trailing zeros. Faces that share a vertex
 * round it identically, so no seams open; at banner size a tenth is below a pixel.
 */
function coordinate(value: number): string {
  return String(+value.toFixed(1));
}

/** Shorten text with an ellipsis until its estimated width fits. */
function fitText(text: string, size: number, max: number): string {
  if (textWidth(text, size) <= max) return text;
  let value = text;
  while (value.length > 1 && textWidth(`${value}…`, size) > max) value = value.slice(0, -1);
  return `${value.trimEnd()}…`;
}

/**
 * Break text into at most `lines` lines of estimated width `max`; the last line ends with an
 * ellipsis when text is left over. Latin words stay whole, CJK text breaks between characters
 * and closing punctuation never starts a line.
 */
function wrapText(text: string, size: number, max: number, lines = 2): string[] {
  const units = text.trim().match(/[⺀-￿]|[^\s⺀-￿]+\s*|\s+/g) ?? [];
  const result: string[] = [];
  let line = '';
  for (let index = 0; index < units.length; index++) {
    const unit = units[index];
    const closing = /^[，。、；：！？）」』】,.;:!?)]/.test(unit);
    if (line && !closing && textWidth((line + unit).trimEnd(), size) > max) {
      if (result.length === lines - 1)
        return [...result, fitText(line + units.slice(index).join(''), size, max)];
      // Prefer to break after punctuation or a space in the last third of the line.
      const pause = Math.max(...[...'，。；：、！？,;:!? '].map((mark) => line.lastIndexOf(mark)));
      const keep = pause >= line.length * 0.66 ? pause + 1 : line.length;
      const head = line.slice(0, keep).trimEnd();
      // Closing punctuation may hang past the margin, as in Chinese typesetting.
      const hangs = textWidth(head.replace(/[，。、；：！？,.;:!?)]$/, ''), size) <= max;
      result.push(hangs ? head : fitText(head, size, max));
      line = line.slice(keep).trimStart() + unit;
    } else line += unit;
  }
  if (line.trim()) result.push(fitText(line.trimEnd(), size, max));
  return result;
}

/** Filter and frame a scene exactly as the renderer will draw it. */
function prepareScene(scene: CityScene, options: RenderOptions): CityScene {
  const frame = options.frame ?? defaultFrame;
  scene = repositoryScene(scene, options.repository ?? '');
  if (scene.repositories.length > 1)
    return options.frame ? fitCity(scene, frame) : frameDistricts(scene);
  return options.frame
    ? fitCity(scene, {
        ...frame,
        rail: frame.width * 0.08,
        bottom: frame.bottom + (options.showLabels !== false ? 26 : 0),
      })
    : scene;
}

interface Segment {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

/** Roads run down the middle of the 8-unit gaps between districts and around the city. */
function citySegments(scene: CityScene): Segment[] {
  const bounds = scene.bounds ?? { x: 0, y: 0, width: 168, depth: 168 };
  const segments: Segment[] = [
    {
      a: { x: bounds.x - 4, y: bounds.y - 4 },
      b: { x: bounds.x + bounds.width + 4, y: bounds.y - 4 },
    },
    {
      a: { x: bounds.x - 4, y: bounds.y - 4 },
      b: { x: bounds.x - 4, y: bounds.y + bounds.depth + 4 },
    },
  ];
  const seen = new Set<string>();
  for (const repo of [...scene.repositories].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const r = repo.bounds;
    for (const segment of [
      {
        a: { x: r.x - 4, y: r.y + r.depth + 4 },
        b: { x: r.x + r.width + 4, y: r.y + r.depth + 4 },
      },
      {
        a: { x: r.x + r.width + 4, y: r.y - 4 },
        b: { x: r.x + r.width + 4, y: r.y + r.depth + 4 },
      },
    ]) {
      const key = [segment.a.x, segment.a.y, segment.b.x, segment.b.y]
        .map((value) => value.toFixed(1))
        .join();
      if (!seen.has(key)) {
        seen.add(key);
        segments.push(segment);
      }
    }
  }
  return segments;
}

/** The selection outline, drawn as a separate layer so the city itself never re-renders. */
export function renderSelection(scene: CityScene, options: RenderOptions = {}): string {
  scene = prepareScene(scene, options);
  const repo = scene.repositories.find((item) =>
    item.buildings.some((b) => b.id === options.selectedId),
  );
  const b = repo?.buildings.find((item) => item.id === options.selectedId);
  if (!b || repo?.privacy === 'city-only') return '';
  const palette = cityPalette(scene);
  const p = (x: number, y: number, z = 0) => project({ x, y }, z, scene.camera);
  const { x, y } = b.position;
  const { width: w, depth: d, height: h } = b;
  const path = [
    [p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h), p(x, y, h)],
    [p(x, y + d, h), p(x, y + d), p(x + w, y + d), p(x + w, y)],
    [p(x + w, y + d), p(x + w, y + d, h)],
    [p(x + w, y), p(x + w, y, h)],
  ]
    .map((run) => 'M' + run.map((v) => `${coordinate(v.x)},${coordinate(v.y)}`).join('L'))
    .join('');
  return `<path data-selection="${escapeXml(b.id)}" d="${path}" fill="none" stroke="${palette.highlight}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/** One car on a loop along a street, in canvas coordinates. */
export interface TrafficCar {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Seconds per trip. */
  duration: number;
  /** Seconds into the trip at time zero, so cars are spread along the street. */
  offset: number;
  size: number;
  color: string;
  glow: boolean;
}

export interface CityLayers {
  /** Plinth, districts, streets and lamps. Static. */
  ground: string;
  /** Moving traffic, drawn between the ground and the buildings; empty unless motion is `full`. */
  cars: TrafficCar[];
  /** Buildings, trees and labels. */
  buildings: string;
}

/** The whole city as one SVG fragment, layers in painting order. */
export function renderCityContents(scene: CityScene, options: RenderOptions = {}): string {
  const layers = renderCityLayers(scene, options);
  return layers.ground + layers.buildings;
}

/**
 * The city split into stacked layers. A page can paint the static ground and animate the
 * traffic on its own, so moving cars never force the large building layer to repaint.
 */
export function renderCityLayers(scene: CityScene, options: RenderOptions = {}): CityLayers {
  const frame = options.frame ?? defaultFrame;
  const showLabels = options.showLabels !== false;
  const level = options.motion ?? 'calm';
  const motion = level !== 'none';
  const full = level === 'full';
  scene = prepareScene(scene, options);
  const id = options.idPrefix ?? 'cc';
  const palette = cityPalette(scene);
  const light = palette.light;
  const count = sceneStats(scene).files;
  const p = (x: number, y: number, z = 0): Point => project({ x, y }, z, scene.camera);
  const points = (vertices: Point[]): string =>
    vertices.map(({ x, y }) => `${coordinate(x)},${coordinate(y)}`).join(' ');
  const polygon = (vertices: Point[], fill: string, extra = ''): string =>
    `<polygon points="${points(vertices)}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
  const ground = (
    x: number,
    y: number,
    w: number,
    d: number,
    fill: string,
    z = 0,
    extra = '',
  ): string =>
    polygon([p(x, y, z), p(x + w, y, z), p(x + w, y + d, z), p(x, y + d, z)], fill, extra);
  const line = (a: Point, b: Point, stroke: string, width = 1, extra = ''): string =>
    `<line x1="${coordinate(a.x)}" y1="${coordinate(a.y)}" x2="${coordinate(b.x)}" y2="${coordinate(b.y)}" stroke="${stroke}" stroke-width="${width}"${extra ? ` ${extra}` : ''}/>`;

  /** Moonlight from the upper left: a bright roof, a soft front face and a deep side. */
  const faces = (color: string) =>
    light
      ? {
          top: mix(color, '#ffffff', 0.5),
          front: mix(color, '#ffffff', 0.08),
          right: mix(shade(color, 0.84), '#7f8da0', 0.18),
          edge: '#ffffff',
        }
      : {
          top: mix(color, '#d6dce4', 0.16),
          front: shade(color, 0.8),
          right: shade(color, 0.54),
          edge: mix(color, '#e6ebf1', 0.34),
        };

  function box(
    x: number,
    y: number,
    width: number,
    depth: number,
    height: number,
    color: string,
    base = 0,
    shadowed = false,
  ): string {
    const tone = faces(color);
    const front = [
      p(x, y + depth, base),
      p(x + width, y + depth, base),
      p(x + width, y + depth, height),
      p(x, y + depth, height),
    ];
    const right = [
      p(x + width, y, base),
      p(x + width, y + depth, base),
      p(x + width, y + depth, height),
      p(x + width, y, height),
    ];
    return (
      polygon(front, tone.front) +
      polygon(right, tone.right) +
      (shadowed ? polygon(front, `url(#${id}-ao)`) + polygon(right, `url(#${id}-ao)`) : '') +
      ground(
        x,
        y,
        width,
        depth,
        tone.top,
        height,
        // Shared roof-edge settings live in one class: thousands of roofs repeat them.
        `stroke="${tone.edge}" class="${id}-e"`,
      )
    );
  }

  function tree(x: number, y: number, variant: number, archived = false): string {
    const color = archivedColor(palette.tree[variant % 3], archived);
    const radius = (1.5 + (variant % 3) * 0.25) * scene.camera.scale;
    const crown = p(x, y, 2.4 + (variant % 2) * 0.6);
    return (
      line(p(x, y), p(x, y, 1.4), light ? '#9c9588' : '#2a2825', Math.max(0.6, radius * 0.18)) +
      `<circle cx="${crown.x.toFixed(2)}" cy="${crown.y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${color}"/>` +
      `<circle cx="${(crown.x - radius * 0.28).toFixed(2)}" cy="${(crown.y - radius * 0.3).toFixed(2)}" r="${(radius * 0.52).toFixed(2)}" fill="${mix(color, light ? '#ffffff' : '#9fb7a6', light ? 0.35 : 0.14)}"/>`
    );
  }

  // Farther buildings sink slightly into the night air, giving the model depth.
  const extent = scene.repositories.flatMap((repo) => [
    repo.bounds.x + repo.bounds.y,
    repo.bounds.x + repo.bounds.width + repo.bounds.y + repo.bounds.depth,
  ]);
  const nearest = Math.max(...extent, 1);
  const farthest = Math.min(...extent, 0);
  const haze = (b: Building) =>
    (1 - (b.position.x + b.position.y - farthest) / Math.max(1, nearest - farthest)) *
    (light ? 0.3 : 0.26);
  const air = light ? '#f6f5f2' : '#14171b';

  /** A red aviation light; each one blinks on its own rhythm. */
  function beaconMarkup(at: Point, archived: boolean | undefined, seed: number, size: number) {
    const color = archivedColor(palette.beacon, archived);
    const blink = full
      ? ` class="${id}-bk" style="animation-delay:-${((seed % 26) / 10).toFixed(1)}s"`
      : motion
        ? ` class="${id}-bk"`
        : '';
    return `<g${blink}><circle cx="${at.x.toFixed(2)}" cy="${at.y.toFixed(2)}" r="${(scene.camera.scale * 1.3 * size).toFixed(2)}" fill="${color}" opacity="0.22"/><circle cx="${at.x.toFixed(2)}" cy="${at.y.toFixed(2)}" r="${Math.max(0.8, scene.camera.scale * 0.45 * size).toFixed(2)}" fill="${color}"/></g>`;
  }

  const bounds = scene.bounds ?? { x: 0, y: 0, width: 168, depth: 168 };
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.depth / 2 };
  const reach = Math.hypot(bounds.width, bounds.depth) / 2 || 1;

  function building(b: Building, cityOnly = false, repository = ''): string {
    const fog = haze(b);
    const district = cityOnly ? repository : undefined;
    const accent = archivedColor(buildingAccent(b.language, light, district), b.archived);
    b = {
      ...b,
      color: mix(archivedColor(tonedBuilding(b, light, district).color, b.archived), air, fog),
    };
    const { x, y } = b.position;
    const { width: w, depth: d } = b;
    const seed = b.seed ?? stableHash(b.id);
    const isSelected = !cityOnly && b.id === options.selectedId;
    const design = buildingArchitecture(b, count, { light, accent });
    let output = ground(
      x + 0.6,
      y + 0.6,
      w + 2.2,
      d + 2.2,
      light ? '#8d8a82' : '#000000',
      0,
      `opacity="${light ? 0.16 : 0.42}"`,
    );
    for (const part of design.solids)
      output += box(
        x + part.x,
        y + part.y,
        part.width,
        part.depth,
        part.z + part.height,
        archivedColor(part.color, b.archived),
        part.z,
        part.height > 3,
      );
    // Batch windows by color: dense cities keep readable facades without thousands of SVG nodes.
    const panes = new Map<string, string[]>();
    for (const pane of design.windows) {
      const twinkle = motion ? (pane.twinkle ?? 0) : 0;
      if (pane.face !== 'front' && pane.face !== 'right') continue;
      const px = x + pane.x,
        py = y + pane.y,
        z = pane.z;
      const vertices =
        pane.face === 'front'
          ? [
              p(px, py, z),
              p(px + pane.width, py, z),
              p(px + pane.width, py, z + pane.height),
              p(px, py, z + pane.height),
            ]
          : [
              p(px, py, z),
              p(px, py + pane.depth, z),
              p(px, py + pane.depth, z + pane.height),
              p(px, py, z + pane.height),
            ];
      const facing = pane.face === 'right' ? shade(pane.color, pane.lit ? 0.86 : 0.8) : pane.color;
      const color = mix(
        light || pane.glow ? facing : activityWindowColor(b, facing),
        air,
        pane.lit && !light ? fog * 0.35 : fog,
      );
      const key = `${color}|${twinkle}`;
      if (!panes.has(key)) panes.set(key, []);
      panes
        .get(key)!
        .push('M' + vertices.map((v) => coordinate(v.x) + ',' + coordinate(v.y)).join('L') + 'Z');
    }
    for (const [key, paths] of panes) {
      const [color, twinkle] = key.split('|');
      output += `<path data-windows="true"${twinkle !== '0' ? ` class="${id}-t${twinkle}"` : ''} d="${paths.join('')}" fill="${color}"/>`;
    }
    if (design.pitchedRoof) {
      const roof = design.pitchedRoof;
      const rx = x + roof.x,
        ry = y + roof.y,
        rw = roof.width,
        rd = roof.depth;
      const z = roof.z,
        top = z + roof.height;
      const tone = faces(archivedColor(roof.color, b.archived));
      output += polygon(
        [p(rx, ry, z), p(rx + rw / 2, ry, top), p(rx + rw / 2, ry + rd, top), p(rx, ry + rd, z)],
        tone.top,
      );
      output += polygon(
        [
          p(rx + rw, ry, z),
          p(rx + rw, ry + rd, z),
          p(rx + rw / 2, ry + rd, top),
          p(rx + rw / 2, ry, top),
        ],
        tone.right,
      );
      output += polygon(
        [p(rx, ry + rd, z), p(rx + rw, ry + rd, z), p(rx + rw / 2, ry + rd, top)],
        tone.front,
      );
      output += line(
        p(rx + rw / 2, ry, top),
        p(rx + rw / 2, ry + rd, top),
        tone.edge,
        0.45,
        `stroke-opacity="${light ? 0.9 : 0.5}"`,
      );
    }
    if (b.spireHeight) {
      const base = spireBase(b);
      const tip = base + b.spireHeight;
      const thickness = Math.min(w, d, 8) * 0.07;
      const color = archivedColor(palette.spire, b.archived);
      const beacon = p(x + w / 2, y + d / 2, tip + 0.9);
      output += `<g data-star-spire="${b.spireHeight}">${box(x + w / 2 - thickness / 2, y + d / 2 - thickness / 2, thickness, thickness, tip, color, base)}${beaconMarkup(beacon, b.archived, seed, 1.25)}</g>`;
    }
    for (const [index, lamp] of design.beacons.entries())
      output += beaconMarkup(p(x + lamp.x, y + lamp.y, lamp.z), b.archived, seed + index, 0.8);
    const metric = scene.heightMetric === 'bytes' ? `${b.bytes} bytes` : `${b.lines} lines`;
    // Buildings near the center rise first, and the wave spreads outward.
    const rise = options.intro
      ? ` style="--rise:${Math.round((Math.hypot(x + w / 2 - center.x, y + d / 2 - center.y) / reach) * 650 + (seed % 160))}ms"`
      : '';
    if (cityOnly)
      return `<g data-building="${escapeXml(b.id)}" data-private="true" data-architecture="${design.style}" aria-hidden="true"${rise}>${output}</g>`;
    return `<g data-building="${escapeXml(b.id)}" data-architecture="${design.style}"${rise} ${b.archived ? 'data-archived="true" ' : ''}${options.interactive ? `role="button" tabindex="0" aria-label="${escapeXml(b.path)}, ${metric}" aria-pressed="${isSelected}"` : ''}><title>${escapeXml(repository)} / ${escapeXml(b.path)} · ${metric}${b.archived ? ' · archived repository' : ''}</title>${output}</g>`;
  }

  const middle = p(bounds.x + bounds.width / 2, bounds.y + bounds.depth / 2);
  const span = Math.abs(
    p(bounds.x + bounds.width, bounds.y).x - p(bounds.x, bounds.y + bounds.depth).x,
  );
  // Lights switch in steps, so nothing repaints between steps; only traffic moves smoothly.
  const reduce = `@media (prefers-reduced-motion:reduce){.${id}-t1,.${id}-t2,.${id}-t3,.${id}-bk{animation:none}}`;
  const roofEdge = `.${id}-e{stroke-width:.45;stroke-opacity:${light ? 0.9 : 0.55};stroke-linejoin:round}`;
  let buildingsLayer = `<defs>${
    motion
      ? `<style>${roofEdge}.${id}-t1{animation:${id}-switch 9s steps(1,end) infinite}.${id}-t2{animation:${id}-switch 13s steps(1,end) -5s infinite}.${id}-t3{animation:${id}-switch 17s steps(1,end) -9s infinite}.${id}-bk{animation:${id}-blink 2.8s steps(1,end) infinite}@keyframes ${id}-switch{0%{opacity:1}60%{opacity:.08}}@keyframes ${id}-blink{0%{opacity:.12}8%{opacity:1}24%{opacity:.12}}${reduce}</style>`
      : `<style>${roofEdge}</style>`
  }<linearGradient id="${id}-ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0.35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${light ? 0.1 : 0.34}"/></linearGradient></defs>`;
  const cars: TrafficCar[] = [];
  let groundLayer =
    `<defs><radialGradient id="${id}-glow"><stop offset="0" stop-color="${palette.glow}" stop-opacity="${light ? 1 : 0.95}"/><stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/></radialGradient></defs>` +
    `<ellipse cx="${middle.x.toFixed(2)}" cy="${(middle.y + span * 0.04).toFixed(2)}" rx="${(span * 0.82).toFixed(2)}" ry="${(span * 0.4).toFixed(2)}" fill="url(#${id}-glow)"/>`;
  // A thin model plinth with a crisp lit edge, rather than a heavy slab.
  groundLayer += box(
    bounds.x - 5,
    bounds.y - 5,
    bounds.width + 10,
    bounds.depth + 10,
    0,
    palette.slab,
    -1.6,
  );
  groundLayer += ground(
    bounds.x - 5,
    bounds.y - 5,
    bounds.width + 10,
    bounds.depth + 10,
    palette.ground,
    0,
    `stroke="${palette.edge}" stroke-width="0.7" stroke-linejoin="round"`,
  );
  if (scene.isFixture && scene.repositories.length > 1) {
    groundLayer +=
      ground(79, -3, 10, 174, palette.road, 0.1) + ground(-3, 79, 174, 10, palette.road, 0.1);
    groundLayer += line(
      p(84, -3, 0.2),
      p(84, 171, 0.2),
      palette.faint,
      0.6,
      'stroke-dasharray="5 9" opacity="0.5"',
    );
    groundLayer += line(
      p(-3, 84, 0.2),
      p(171, 84, 0.2),
      palette.faint,
      0.6,
      'stroke-dasharray="5 9" opacity="0.5"',
    );
  }
  const repos = [...scene.repositories].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const objects: { depth: number; key: string; markup: string; repo: string }[] = [];
  for (const repo of repos) {
    const { x, y, width, depth } = repo.bounds;
    const border = Math.min(2, width * 0.08, depth * 0.08);
    groundLayer += ground(
      x,
      y,
      width,
      depth,
      palette.district,
      0.3,
      `stroke="${palette.border}" stroke-width="0.6"`,
    );
    groundLayer += ground(
      x + border,
      y + border,
      width - 2 * border,
      depth - 2 * border,
      archivedColor(repo.name === 'docs' ? palette.park : palette.pavement, repo.archived),
      0.35,
    );
    if (repo.blocks) {
      for (const block of repo.blocks) {
        const b = block.bounds;
        groundLayer += ground(
          b.x,
          b.y,
          b.width,
          b.depth,
          archivedColor(palette.block, repo.archived),
          0.4,
          `stroke="${palette.blockBorder}" stroke-width="0.5"`,
        );
      }
    }
    for (const b of repo.buildings)
      objects.push({
        depth: b.position.x + b.position.y + (b.width + b.depth) / 2,
        key: b.id,
        markup: building(b, repo.privacy === 'city-only', repo.name),
        repo: repo.name,
      });
    if (!scene.isFixture && Math.min(width, depth) > 20) {
      for (let i = 0; i < 7; i++) {
        const tx = x + 3 + ((width - 6) * i) / 6,
          ty = y + depth - 2.5;
        objects.push({
          depth: tx + ty,
          key: `${repo.name}-tree-${i}`,
          markup: tree(tx, ty, i, repo.archived),
          repo: repo.name,
        });
      }
    }
    if (scene.isFixture)
      for (let i = 0; i < 6; i++) {
        const tx = x + 4 + i * 13,
          ty = y + 74;
        objects.push({
          depth: tx + ty,
          key: `${repo.name}-tree-${i}`,
          markup: tree(tx, ty, i, repo.archived),
          repo: repo.name,
        });
        if (i < 5)
          objects.push({
            depth: x + 74 + y + 7 + i * 13,
            key: `${repo.name}-side-${i}`,
            markup: tree(x + 74, y + 7 + i * 13, i + 2, repo.archived),
            repo: repo.name,
          });
      }
    if (scene.isFixture && repo.name === 'docs') {
      groundLayer += ground(x + 9, y + 54, 49, 16, light ? '#d8d6cf' : '#22262b', 0.5);
      groundLayer += ground(x + 11, y + 56, 45, 12, light ? '#e8e6e0' : '#2a2f35', 0.6);
      objects.push({
        depth: x + y + 100,
        key: 'docs-fountain',
        markup:
          box(x + 29, y + 57, 10, 8, 2, light ? '#dcdad3' : '#3a4048') +
          ground(x + 30, y + 58, 8, 6, light ? '#9ec3d6' : '#2c5566', 2.1) +
          box(x + 33, y + 60, 2, 2, 7, light ? '#cfe2ea' : '#6f9fb1', 2),
        repo: repo.name,
      });
    }
  }
  for (const [index, segment] of citySegments(scene).entries()) {
    const along = segment.a.y === segment.b.y;
    const length = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
    const at = (t: number, lane: number, z = 0.45) =>
      p(segment.a.x + (along ? t : lane), segment.a.y + (along ? lane : t), z);
    groundLayer += line(
      at(0, 0),
      at(length, 0),
      palette.lane,
      0.5,
      `stroke-dasharray="3 6" opacity="${light ? 0.8 : 0.55}"`,
    );
    if (!light)
      for (let t = 6; t < length - 3; t += 16) {
        const lamp = at(t, 2.3, 0.5);
        groundLayer += `<circle cx="${lamp.x.toFixed(2)}" cy="${lamp.y.toFixed(2)}" r="${(scene.camera.scale * 1.15).toFixed(2)}" fill="${palette.lamp}" opacity="0.1"/><circle cx="${lamp.x.toFixed(2)}" cy="${lamp.y.toFixed(2)}" r="${Math.max(0.55, scene.camera.scale * 0.24).toFixed(2)}" fill="${palette.lamp}"/>`;
      }
    if (!full) continue;
    // Two lanes: traffic coming toward the viewer shows headlights, traffic leaving shows tail lights.
    const count = Math.max(1, Math.round(length / 70));
    const duration = Math.max(4, length / 12);
    for (const direction of [1, -1])
      for (let car = 0; car < count; car++) {
        const hash = stableHash(`${index}:${direction}:${car}`);
        const start = at(direction > 0 ? 0 : length, direction * 0.9, 0.5);
        const end = at(direction > 0 ? length : 0, direction * 0.9, 0.5);
        cars.push({
          x: start.x,
          y: start.y,
          dx: end.x - start.x,
          dy: end.y - start.y,
          duration,
          offset:
            ((car / count) * duration + ((hash % 1000) / 1000) * (duration / count)) % duration,
          size: Math.max(1.4, scene.camera.scale * (light ? 1 : 0.72)),
          color: light
            ? palette.cars[hash % palette.cars.length]
            : direction > 0
              ? palette.headlight
              : palette.taillight,
          glow: !light,
        });
      }
  }
  objects.sort((a, b) => a.depth - b.depth || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  buildingsLayer += objects
    .map(
      (o) =>
        `<g opacity="${options.repository && options.repository !== o.repo ? '0.18' : '1'}">${o.markup}</g>`,
    )
    .join('');
  if (showLabels) {
    const labelWidth = Math.min(
      frame.rail - 20,
      Math.max(96, ...repos.map((repo) => textWidth(repo.name, 11.5) + 34)),
    );
    const names = new Map(
      repos.map((repo) => {
        let name = repo.name;
        if (repos.length > 1)
          while (name.length > 4 && textWidth(name, 11.5) > labelWidth - 34)
            name = name.slice(0, -2) + '…';
        else if (name.length > 28) name = `${name.slice(0, 27)}…`;
        return [repo.name, name];
      }),
    );
    // Labels hug the model instead of the canvas edges, keeping every leader short.
    const leftCorner = p(bounds.x - 5, bounds.y + bounds.depth + 5).x;
    const rightCorner = p(bounds.x + bounds.width + 5, bounds.y - 5).x;
    const margin = Math.min(16, frame.width * 0.025);
    const callouts = placeDistrictLabels(
      repos.map((repo) => {
        const anchors = districtAnchors(repo);
        return {
          key: repo.name,
          center: p(anchors.center.x, anchors.center.y),
          left: p(anchors.left.x, anchors.left.y),
          right: p(anchors.right.x, anchors.right.y),
        };
      }),
      frame.width,
      frame.height,
      {
        labelWidth,
        labelHeight: 22,
        top: frame.top + 6,
        bottom: frame.height - frame.bottom * 0.4,
      },
    ).map((c) => ({
      ...c,
      x:
        c.side === 'left'
          ? Math.max(margin, leftCorner - 26 - c.width)
          : Math.min(frame.width - margin - c.width, rightCorner + 26),
    }));
    for (const repo of repos) {
      const color = archivedColor(languageColor(repo.primaryLanguage), repo.archived);
      const name = names.get(repo.name)!;
      if (repos.length > 1) {
        const c = callouts.find((item) => item.key === repo.name)!;
        const number = String(repos.indexOf(repo) + 1).padStart(2, '0');
        const left = c.side === 'left';
        const textX = left ? c.x + c.width - 8 : c.x + 8;
        const baseline = c.y + c.height / 2 + 4;
        const [start, elbow, anchor] = labelLeader(c);
        buildingsLayer += `<g data-district-label="${escapeXml(repo.name)}" pointer-events="none" font-family="${fontStack}"><polyline data-district-leader="true" points="${points([start, elbow, anchor])}" fill="none" stroke="${palette.muted}" stroke-opacity="${light ? 0.55 : 0.45}" stroke-width="0.8"/><circle cx="${anchor.x.toFixed(2)}" cy="${anchor.y.toFixed(2)}" r="5.5" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.55" stroke-width="0.8"/><circle cx="${anchor.x.toFixed(2)}" cy="${anchor.y.toFixed(2)}" r="2.2" fill="${color}"/><text x="${textX.toFixed(2)}" y="${baseline.toFixed(2)}" text-anchor="${left ? 'end' : 'start'}" font-size="11.5" fill="${palette.labelText}" font-weight="500">${left ? `${escapeXml(name)}<tspan dx="8" font-size="9" fill="${palette.faint}" font-weight="400" letter-spacing="0.8">${number}</tspan>` : `<tspan font-size="9" fill="${palette.faint}" font-weight="400" letter-spacing="0.8">${number}</tspan><tspan dx="8">${escapeXml(name)}</tspan>`}</text></g>`;
      } else {
        // A single district is named just below its nearest corner, clear of every roof.
        const corner = p(
          repo.bounds.x + repo.bounds.width + 5,
          repo.bounds.y + repo.bounds.depth + 5,
          -1.6,
        );
        const width = textWidth(name, 12) + 14;
        buildingsLayer += `<g data-district-label="${escapeXml(repo.name)}" pointer-events="none" font-family="${fontStack}"><circle cx="${(corner.x - width / 2 + 3).toFixed(2)}" cy="${(corner.y + 18).toFixed(2)}" r="3" fill="${color}"/><text x="${(corner.x + 7).toFixed(2)}" y="${(corner.y + 22).toFixed(2)}" fill="${palette.labelText}" text-anchor="middle" font-size="12" font-weight="500">${escapeXml(name)}</text></g>`;
      }
      if (options.interactive && !scene.isFixture && count <= 120 && repo.privacy !== 'city-only')
        for (const block of repo.blocks ?? []) {
          const pos = p(
            block.bounds.x + block.bounds.width / 2,
            block.bounds.y + block.bounds.depth - 1,
            0.6,
          );
          if (Math.min(block.bounds.width, block.bounds.depth) * scene.camera.scale < 22) continue;
          buildingsLayer += `<text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" fill="${palette.blockText}" stroke="${palette.blockOutline}" stroke-width="3" paint-order="stroke" text-anchor="middle" font-family="${fontStack}" font-size="8.5" letter-spacing="0.6">${escapeXml(block.name.slice(0, 18))}</text>`;
        }
    }
  }
  return { ground: groundLayer, cars, buildings: buildingsLayer };
}

export function renderCitySvg(scene: CityScene, options: RenderOptions = {}): string {
  return citySvgDocument(renderCityContents(scene, options), options.interactive);
}

/**
 * Wrap explorer content in the 1040 × 660 canvas. An interactive city also gets an empty
 * selection layer that the page fills, so selecting never rebuilds the city itself.
 */
export function citySvgDocument(content: string, interactive = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 660" ${interactive ? 'role="group" aria-label="Interactive code city"' : 'role="img" aria-label="Isometric code city"'}>${content}${interactive ? '<g data-selection-layer="true" pointer-events="none"></g>' : ''}</svg>`;
}

/** A self-contained image URL for a static or animated background layer. */
export function cityLayerImage(content: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(citySvgDocument(content))}`;
}

export interface BannerOptions {
  size?: 'profile' | 'repository';
  title?: string;
  subtitle?: string;
  showLabels?: boolean;
  showLegend?: boolean;
}

/** The isometric mark used by the site and the banners. */
export function logoMark(light: boolean, x = 0, y = 0, size = 18): string {
  const s = size / 20;
  const t = (px: number, py: number) => `${(x + px * s).toFixed(2)},${(y + py * s).toFixed(2)}`;
  const [top, left, right] = light
    ? ['#1f2227', '#5f636a', '#9499a0']
    : ['#eceff2', '#9499a0', '#4a4e55'];
  return `<polygon points="${t(10, 0)} ${t(20, 5.8)} ${t(10, 11.6)} ${t(0, 5.8)}" fill="${top}"/><polygon points="${t(0, 5.8)} ${t(10, 11.6)} ${t(10, 23)} ${t(0, 17.2)}" fill="${left}"/><polygon points="${t(10, 11.6)} ${t(20, 5.8)} ${t(20, 17.2)} ${t(10, 23)}" fill="${right}"/>`;
}

export function renderBanner(scene: CityScene, options: BannerOptions = {}): string {
  const width = options.size === 'repository' ? 900 : 1200;
  const height = options.size === 'repository' ? 315 : 420;
  const palette = cityPalette(scene);
  const stats = sceneStats(scene);
  const fullTitle = options.title ?? 'My Code City';
  const titleSize = Math.max(
    24,
    Math.min(40, Math.floor(300 / Math.max(textWidth(fullTitle, 1), 1))),
  );
  const title = fitText(fullTitle, titleSize, 300);
  const subtitleSize = 14.5;
  // A long description wraps onto a second line instead of being cut mid-sentence.
  const subtitleLines = wrapText(
    options.subtitle ?? 'A skyline built from code',
    subtitleSize,
    290,
  );
  const wrap = (subtitleLines.length - 1) * 20;
  const id = options.size === 'repository' ? 'cbr' : 'cbp';
  const multi = scene.repositories.length > 1;
  const statLine = [
    ...(stats.repositories === 1 ? [] : [[String(stats.repositories), 'repositories']]),
    [String(stats.files), stats.files === 1 ? 'file' : 'files'],
    [compactNumber(stats.lines), 'lines'],
  ]
    .map(
      ([value, label], i) =>
        `${i ? `<tspan fill="${palette.faint}" dx="9">·</tspan>` : ''}<tspan ${i ? 'dx="9" ' : ''}fill="${palette.text}" font-weight="500">${value}</tspan><tspan dx="5">${label}</tspan>`,
    )
    .join('');
  let legendX = 48;
  const legend =
    options.showLegend === false
      ? ''
      : cityLegend(scene)
          .map((item) => {
            const x = legendX;
            legendX += textWidth(item.name, 11) + 30;
            return `<circle cx="${x + 3.5}" cy="372" r="3.5" fill="${item.color}"/><text x="${x + 13}" y="376" fill="${palette.muted}">${escapeXml(item.name)}</text>`;
          })
          .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 420" role="img" aria-labelledby="banner-title banner-desc"><title id="banner-title">${escapeXml(title)}</title><desc id="banner-desc">${stats.repositories} ${sceneSource(scene)} repositories, ${stats.files} files and ${stats.lines} lines of code, shown as an isometric city.</desc><defs><radialGradient id="${id}-sky" cx="0.68" cy="0.62" r="0.62"><stop offset="0" stop-color="${palette.light ? '#ffffff' : '#161a21'}"/><stop offset="1" stop-color="${palette.background}"/></radialGradient></defs><rect width="1200" height="420" rx="14" fill="url(#${id}-sky)"/><rect x="0.5" y="0.5" width="1199" height="419" rx="13.5" fill="none" stroke="${palette.light ? '#dcdad5' : '#202328'}"/><g transform="translate(330 0)">${renderCityContents(
    scene,
    {
      // A single-repository banner already carries the name in its title.
      showLabels: options.showLabels !== false && multi,
      idPrefix: id,
      frame: { width: 860, height: 420, rail: 170, top: 30, bottom: multi ? 26 : 22 },
    },
  )}</g><g font-family="${fontStack}">${logoMark(palette.light, 48, 44, 15)}<text x="72" y="58" fill="${palette.muted}" font-size="10.5" font-weight="500" letter-spacing="2.6">CODE CITY</text><text x="46" y="176" fill="${palette.text}" font-size="${titleSize}" font-weight="600" letter-spacing="${(-titleSize * 0.025).toFixed(2)}">${escapeXml(title)}</text><text x="48" y="${176 + Math.max(26, titleSize * 0.82)}" fill="${palette.muted}" font-size="${subtitleSize}">${subtitleLines.map((line, index) => `<tspan x="48" dy="${index ? 20 : 0}">${escapeXml(line)}</tspan>`).join('')}</text><line x1="48" y1="${226 + wrap + Math.max(0, titleSize * 0.82 - 26)}" x2="76" y2="${226 + wrap + Math.max(0, titleSize * 0.82 - 26)}" stroke="${palette.light ? '#c0beb8' : '#32363c'}"/><text x="48" y="${256 + wrap + Math.max(0, titleSize * 0.82 - 26)}" fill="${palette.muted}" font-size="12.5">${statLine}</text><g font-size="11">${legend}</g></g></svg>`;
}
