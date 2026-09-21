import type { Building, CityScene, Point } from '../../core/model';
import { compactNumber, sceneStats } from '../../core/metrics';
import { project } from '../../layout/isometric';
import { cityLegend, cityPalette, languageColor } from '../../core/theme';
import { sceneSource } from '../../core/source-label';
import { windowColor as activityWindowColor } from '../../core/activity';
import { archivedColor, spireBase } from '../../core/repository-signals';
import { repositoryScene } from '../../core/repository-scene';
import { buildingArchitecture } from '../../core/architecture';
import {
  districtAnchors,
  frameDistricts,
  labelLeader,
  placeDistrictLabels,
} from '../../core/district-labels';

export interface RenderOptions {
  selectedId?: string;
  repository?: string;
  showLabels?: boolean;
  interactive?: boolean;
}

export function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!,
  );
}

function shade(hex: string, amount: number): string {
  const rgb = [1, 3, 5].map((index) =>
    Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(index, index + 2), 16) * amount))),
  );
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function renderCityContents(scene: CityScene, options: RenderOptions = {}): string {
  scene = frameDistricts(repositoryScene(scene, options.repository ?? ''));
  const palette = cityPalette(scene);
  const count = sceneStats(scene).files;
  const p = (x: number, y: number, z = 0): Point => project({ x, y }, z, scene.camera);
  const points = (vertices: Point[]): string =>
    vertices.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const polygon = (vertices: Point[], fill: string, extra = ''): string =>
    `<polygon points="${points(vertices)}" fill="${fill}" ${extra}/>`;
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
    `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;

  function box(
    x: number,
    y: number,
    width: number,
    depth: number,
    height: number,
    color: string,
    base = 0,
  ): string {
    return (
      polygon(
        [
          p(x, y + depth, base),
          p(x + width, y + depth, base),
          p(x + width, y + depth, height),
          p(x, y + depth, height),
        ],
        shade(color, 0.67),
      ) +
      polygon(
        [
          p(x + width, y, base),
          p(x + width, y + depth, base),
          p(x + width, y + depth, height),
          p(x + width, y, height),
        ],
        shade(color, 0.45),
      ) +
      ground(
        x,
        y,
        width,
        depth,
        shade(color, 1.16),
        height,
        `stroke="${shade(color, 1.3)}" stroke-width="0.5" stroke-linejoin="round"`,
      )
    );
  }

  function tree(x: number, y: number, variant: number, archived = false): string {
    const height = 5 + (variant % 3);
    const color = archivedColor(['#365d50', '#426d57', '#2a554d'][variant % 3], archived);
    return (
      box(x - 0.4, y - 0.4, 0.8, 0.8, 2, '#7b7361') +
      polygon([p(x - 1.6, y + 1.6, 2), p(x + 1.6, y + 1.6, 2), p(x, y, height + 2)], color) +
      polygon(
        [p(x + 1.6, y + 1.6, 2), p(x + 1.6, y - 1.6, 2), p(x, y, height + 2)],
        shade(color, 0.68),
      ) +
      polygon(
        [p(x - 1.6, y + 1.6, 2), p(x - 1.6, y - 1.6, 2), p(x, y, height + 2)],
        shade(color, 1.16),
      )
    );
  }

  function building(b: Building, cityOnly = false, repository = ''): string {
    b = { ...b, color: archivedColor(b.color, b.archived) };
    const { x, y } = b.position;
    const { width: w, depth: d, height: h } = b;
    const isSelected = !cityOnly && b.id === options.selectedId;
    const design = buildingArchitecture(b, count);
    let output = ground(x + 1, y + 1, w + 1.5, d + 1.5, '#070b10', 0, 'opacity="0.28"');
    for (const part of design.solids) {
      output += box(
        x + part.x,
        y + part.y,
        part.width,
        part.depth,
        part.z + part.height,
        archivedColor(part.color, b.archived),
        part.z,
      );
    }
    // Batch windows by color: dense cities keep readable facades without thousands of SVG nodes.
    const panes = new Map<string, string[]>();
    for (const pane of design.windows) {
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
      const color = activityWindowColor(
        b,
        pane.face === 'right' ? shade(pane.color, 0.82) : pane.color,
      );
      if (!panes.has(color)) panes.set(color, []);
      panes
        .get(color)!
        .push('M' + vertices.map((v) => v.x.toFixed(2) + ',' + v.y.toFixed(2)).join('L') + 'Z');
    }
    for (const [color, paths] of panes)
      output += '<path data-windows="true" d="' + paths.join('') + '" fill="' + color + '"/>';
    if (design.pitchedRoof) {
      const roof = design.pitchedRoof;
      const rx = x + roof.x,
        ry = y + roof.y,
        rw = roof.width,
        rd = roof.depth;
      const z = roof.z,
        top = z + roof.height;
      const color = archivedColor(roof.color, b.archived);
      output += polygon(
        [p(rx, ry, z), p(rx + rw / 2, ry, top), p(rx + rw / 2, ry + rd, top), p(rx, ry + rd, z)],
        shade(color, 1.2),
      );
      output += polygon(
        [
          p(rx + rw, ry, z),
          p(rx + rw, ry + rd, z),
          p(rx + rw / 2, ry + rd, top),
          p(rx + rw / 2, ry, top),
        ],
        shade(color, 0.78),
      );
      output += polygon(
        [p(rx, ry + rd, z), p(rx + rw, ry + rd, z), p(rx + rw / 2, ry + rd, top)],
        shade(color, 0.95),
      );
    }
    if (b.spireHeight) {
      const base = spireBase(b);
      const tip = base + b.spireHeight;
      const thickness = Math.min(w, d, 8) * 0.09;
      const color = archivedColor('#e1bf74', b.archived);
      output += `<g data-star-spire="${b.spireHeight}">${box(x + w / 2 - thickness / 2, y + d / 2 - thickness / 2, thickness, thickness, tip, color, base)}${box(x + w / 2 - thickness, y + d / 2 - thickness, thickness * 2, thickness * 2, tip + 0.6, color, tip)}</g>`;
    }
    if (isSelected) {
      output += polygon(
        [p(x, y, h), p(x + w, y, h), p(x + w, y + d, h), p(x, y + d, h)],
        'none',
        `stroke="${palette.highlight}" stroke-width="1.8"`,
      );
      output +=
        line(p(x, y + d), p(x, y + d, h), palette.highlight, 1.8) +
        line(p(x + w, y + d), p(x + w, y + d, h), palette.highlight, 1.8) +
        line(p(x + w, y), p(x + w, y, h), palette.highlight, 1.8);
    }
    const metric = scene.heightMetric === 'bytes' ? `${b.bytes} bytes` : `${b.lines} lines`;
    if (cityOnly)
      return `<g data-building="${escapeXml(b.id)}" data-private="true" data-architecture="${design.style}" aria-hidden="true">${output}</g>`;
    return `<g data-building="${escapeXml(b.id)}" data-architecture="${design.style}" ${b.archived ? 'data-archived="true" ' : ''}${options.interactive ? `role="button" tabindex="0" aria-label="${escapeXml(b.path)}, ${metric}" aria-pressed="${isSelected}"` : ''}><title>${escapeXml(repository)} / ${escapeXml(b.path)} · ${metric}${b.archived ? ' · archived repository' : ''}</title>${output}</g>`;
  }

  let output =
    '<ellipse cx="520" cy="462" rx="380" ry="136" fill="#030609" opacity="0.09"/><ellipse cx="520" cy="465" rx="350" ry="116" fill="#030609" opacity="0.09"/>';
  const bounds = scene.bounds ?? { x: 0, y: 0, width: 168, depth: 168 };
  output += box(
    bounds.x - 5,
    bounds.y - 5,
    bounds.width + 10,
    bounds.depth + 10,
    0,
    palette.slab,
    -5,
  );
  output += ground(
    bounds.x - 5,
    bounds.y - 5,
    bounds.width + 10,
    bounds.depth + 10,
    palette.ground,
    0,
  );
  if (scene.isFixture && scene.repositories.length > 1) {
    output +=
      ground(79, -3, 10, 174, palette.road, 0.1) + ground(-3, 79, 174, 10, palette.road, 0.1);
    for (const offset of [80.2, 87.8]) {
      output += line(p(offset, -3, 0.2), p(offset, 171, 0.2), '#455160', 0.6);
      output += line(p(-3, offset, 0.2), p(171, offset, 0.2), '#455160', 0.6);
    }
    output += line(
      p(84, 0, 0.2),
      p(84, 168, 0.2),
      '#738092',
      0.7,
      'stroke-dasharray="7 10" opacity="0.6"',
    );
    output += line(
      p(0, 84, 0.2),
      p(168, 84, 0.2),
      '#738092',
      0.7,
      'stroke-dasharray="7 10" opacity="0.6"',
    );
  }
  const repos = [...scene.repositories].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const objects: { depth: number; key: string; markup: string; repo: string }[] = [];
  for (const repo of repos) {
    const { x, y, width, depth } = repo.bounds;
    const border = Math.min(2, width * 0.08, depth * 0.08);
    output += ground(
      x,
      y,
      width,
      depth,
      palette.district,
      0.3,
      `stroke="${palette.border}" stroke-width="0.7"`,
    );
    output += ground(
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
        output += ground(
          b.x,
          b.y,
          b.width,
          b.depth,
          archivedColor(palette.block, repo.archived),
          0.4,
          `stroke="${palette.blockBorder}" stroke-width="0.7"`,
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
      output += ground(x + 9, y + 54, 49, 16, '#65716a', 0.5);
      output += ground(x + 11, y + 56, 45, 12, '#8f9582', 0.6);
      objects.push({
        depth: x + y + 100,
        key: 'docs-fountain',
        markup:
          box(x + 29, y + 57, 10, 8, 2, '#9fbbb5') +
          ground(x + 30, y + 58, 8, 6, '#3e809b', 2.1) +
          box(x + 33, y + 60, 2, 2, 7, '#79bbcf', 2),
        repo: repo.name,
      });
    }
  }
  objects.sort((a, b) => a.depth - b.depth || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  output += objects
    .map(
      (o) =>
        `<g opacity="${options.repository && options.repository !== o.repo ? '0.18' : '1'}">${o.markup}</g>`,
    )
    .join('');
  if (options.showLabels !== false) {
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
      1040,
      660,
    );
    for (const repo of repos) {
      const label = p(
        repo.bounds.x + repo.bounds.width / 2 + 2,
        repo.bounds.y + repo.bounds.depth + 1,
        0,
      );
      const color = archivedColor(
        scene.theme.languages[repo.primaryLanguage] ?? languageColor(repo.primaryLanguage),
        repo.archived,
      );
      const name = repo.name.length > 22 ? `${repo.name.slice(0, 21)}…` : repo.name;
      const width = Math.max(68, name.length * 7 + 28);
      if (repos.length > 1) {
        const c = callouts.find((item) => item.key === repo.name)!;
        const number = String(repos.indexOf(repo) + 1).padStart(2, '0');
        output += `<g data-district-label="${escapeXml(repo.name)}" pointer-events="none" font-family="system-ui,sans-serif"><polyline data-district-leader="true" points="${points(labelLeader(c))}" fill="none" stroke="${color}" stroke-opacity="0.7" stroke-width="1.2"/><circle cx="${c.anchor.x.toFixed(2)}" cy="${c.anchor.y.toFixed(2)}" r="10" fill="${palette.label}" stroke="${color}"/><text x="${c.anchor.x.toFixed(2)}" y="${(c.anchor.y + 3).toFixed(2)}" fill="${palette.labelText}" text-anchor="middle" font-size="8">${number}</text><rect x="${c.x}" y="${c.y.toFixed(2)}" width="${c.width}" height="${c.height}" rx="5" fill="${palette.label}" stroke="${palette.labelBorder}"/><text x="${c.x + 9}" y="${(c.y + 19).toFixed(2)}" fill="${color}" font-size="9">${number}</text><text x="${c.x + 29}" y="${(c.y + 19).toFixed(2)}" fill="${palette.labelText}" font-size="11">${escapeXml(name)}</text></g>`;
      } else
        output += `<g><rect x="${(label.x - width / 2).toFixed(2)}" y="${(label.y + 5).toFixed(2)}" width="${width}" height="27" rx="6" fill="${palette.label}" stroke="${palette.labelBorder}"/><circle cx="${(label.x - width / 2 + 13).toFixed(2)}" cy="${(label.y + 18.5).toFixed(2)}" r="3" fill="${color}"/><text x="${(label.x + 5).toFixed(2)}" y="${(label.y + 22).toFixed(2)}" fill="${palette.labelText}" text-anchor="middle" font-size="12" font-family="system-ui,sans-serif">${escapeXml(name)}</text></g>`;
      if (!scene.isFixture && count <= 120 && repo.privacy !== 'city-only')
        for (const block of repo.blocks ?? []) {
          const pos = p(
            block.bounds.x + block.bounds.width / 2,
            block.bounds.y + block.bounds.depth - 1,
            0.6,
          );
          if (Math.min(block.bounds.width, block.bounds.depth) * scene.camera.scale < 22) continue;
          output += `<text x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}" fill="${palette.blockText}" stroke="${palette.blockOutline}" stroke-width="3" paint-order="stroke" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9">${escapeXml(block.name.slice(0, 18))}</text>`;
        }
    }
  }
  return output;
}

export function renderCitySvg(scene: CityScene, options: RenderOptions = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 660" ${options.interactive ? 'role="group" aria-label="Interactive code city"' : 'role="img" aria-label="Isometric code city"'}>${renderCityContents(scene, options)}</svg>`;
}

export interface BannerOptions {
  size?: 'profile' | 'repository';
  title?: string;
  subtitle?: string;
  showLabels?: boolean;
  showLegend?: boolean;
}

export function renderBanner(scene: CityScene, options: BannerOptions = {}): string {
  const width = options.size === 'repository' ? 900 : 1200;
  const height = options.size === 'repository' ? 315 : 420;
  const palette = cityPalette(scene);
  const stats = sceneStats(scene);
  const title = options.title ?? 'My Code City';
  const subtitle = options.subtitle ?? 'A skyline built from code';
  const titleSize = Math.min(43, Math.floor(510 / Math.max(title.length, 1)));
  const subtitleSize = Math.min(16, Math.floor(570 / Math.max(subtitle.length, 1)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 420" role="img" aria-labelledby="banner-title banner-desc"><title id="banner-title">${escapeXml(title)}</title><desc id="banner-desc">${stats.repositories} ${sceneSource(scene)} repositories, ${stats.files} files and ${stats.lines} lines of code, shown as an isometric city.</desc><rect width="1200" height="420" rx="12" fill="${scene.theme.background}"/><rect x="0.5" y="0.5" width="1199" height="419" rx="12" fill="none" stroke="${palette.light ? palette.labelBorder : '#283444'}"/><g font-family="system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><path d="M46 40 62 49 46 58 30 49Z" fill="#80d6fb"/><path d="M30 49 46 58 46 77 30 68Z" fill="#389ace"/><path d="M46 58 62 49 62 68 46 77Z" fill="#236489"/><text x="78" y="65" fill="${palette.light ? scene.theme.text : '#e5edf7'}" font-size="15" font-weight="600" letter-spacing="3.4">CODE CITY</text><text x="32" y="156" fill="${scene.theme.text}" font-size="${titleSize}" font-weight="700" letter-spacing="-1.4">${escapeXml(title)}</text><text x="34" y="186" fill="${scene.theme.muted}" font-size="${subtitleSize}">${escapeXml(subtitle)}</text>${[
    { value: String(stats.repositories), label: 'repositories' },
    { value: String(stats.files), label: 'files' },
    { value: compactNumber(stats.lines), label: 'lines of code' },
  ]
    .map(
      (stat, i) =>
        `<text x="${34 + i * 106}" y="270" fill="${palette.light ? scene.theme.text : '#e5edf7'}" font-size="26" font-weight="600">${stat.value}</text><text x="${34 + i * 106}" y="293" fill="${palette.light ? scene.theme.muted : '#8d9db0'}" font-size="12">${stat.label}</text>`,
    )
    .join(
      '',
    )}<text x="34" y="385" fill="${palette.light ? scene.theme.muted : '#677b90'}" font-size="10" letter-spacing="1.6">${sceneSource(scene).toUpperCase()} CITY · ${escapeXml(scene.theme.name.toUpperCase())}</text></g><g transform="translate(348 2) scale(0.75 0.62)">${renderCityContents(scene, { showLabels: options.showLabels })}</g>${
    options.showLegend === false
      ? ''
      : `<g font-family="system-ui,sans-serif" font-size="11">${cityLegend(scene)
          .map(
            (item, i) =>
              `<rect x="${738 + i * 108}" y="388" width="8" height="8" rx="2" fill="${item.color}"/><text x="${752 + i * 108}" y="396" fill="${palette.light ? scene.theme.muted : '#b4c1d1'}">${escapeXml(item.name)}</text>`,
          )
          .join('')}</g>`
  }</svg>`;
}
