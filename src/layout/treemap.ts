import { createHash } from 'node:crypto';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import type {
  Rect,
  FileSnapshot,
  RepositorySnapshot,
  CityScene,
  Building,
  RepositoryDistrict,
} from '../core/model';
import { heightFromLines, stableHash } from '../core/metrics';
import { languageColor, midnightTheme } from '../core/theme';
interface Parcel {
  key: string;
  value: number;
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const round = (n: number) => Number(n.toFixed(6));
function allocate(items: Parcel[], bounds: Rect, gap: number): Map<string, Rect> {
  if (!items.length) return new Map();
  const root = hierarchy<{ key: string; value?: number; children?: Parcel[] }>({
    key: 'root',
    children: [...items].sort((a, b) => compare(a.key, b.key)),
  })
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || compare(a.data.key, b.data.key));
  const layout = treemap<{ key: string; value?: number; children?: Parcel[] }>()
    .tile(treemapSquarify)
    .size([bounds.width, bounds.depth])
    .paddingInner(gap)(root);
  return new Map(
    layout.leaves().map((node) => [
      node.data.key,
      {
        x: bounds.x + node.x0,
        y: bounds.y + node.y0,
        width: Math.max(0.001, node.x1 - node.x0),
        depth: Math.max(0.001, node.y1 - node.y0),
      },
    ]),
  );
}
function inset(rect: Rect, padding: number): Rect {
  const pad = Math.min(padding, rect.width * 0.08, rect.depth * 0.08);
  return {
    x: rect.x + pad,
    y: rect.y + pad,
    width: rect.width - 2 * pad,
    depth: rect.depth - 2 * pad,
  };
}
const landWeight = (files: FileSnapshot[]) =>
  [...files]
    .sort((a, b) => compare(a.path, b.path))
    .reduce((sum, file) => sum + 4 + Math.log2(file.lines + 1), 0) || 4;
export function layoutCity(input: RepositorySnapshot[], owner = 'local'): CityScene {
  const snapshots = [...input].sort((a, b) => compare(a.name, b.name));
  if (new Set(snapshots.map((snapshot) => snapshot.name)).size !== snapshots.length)
    throw new Error('Repository names must be unique; configure a distinct name for each path.');
  const fileCount = snapshots.reduce((sum, snapshot) => sum + snapshot.files.length, 0);
  const side = Math.max(168, Math.ceil(Math.sqrt(fileCount) * 23));
  const bounds: Rect = { x: 0, y: 0, width: side, depth: side };
  const repoRects = allocate(
    snapshots.map((snapshot) => ({ key: snapshot.name, value: landWeight(snapshot.files) })),
    bounds,
    8,
  );
  const languages: Record<string, string> = {};
  const repositories: RepositoryDistrict[] = snapshots.map((snapshot) => {
    const repoBounds = repoRects.get(snapshot.name)!;
    const grouped = new Map<string, FileSnapshot[]>();
    for (const file of [...snapshot.files].sort((a, b) => compare(a.path, b.path))) {
      const name = file.path.includes('/') ? file.path.split('/')[0] : '(root)';
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(file);
      languages[file.language] = languageColor(file.language);
    }
    const repoInner = inset(repoBounds, 5);
    const blockRects = allocate(
      [...grouped].map(([key, files]) => ({ key, value: landWeight(files) })),
      repoInner,
      Math.min(3, repoInner.width * 0.015, repoInner.depth * 0.015),
    );
    const buildings: Building[] = [];
    const candidates = [...snapshot.files]
      .sort((a, b) => compare(a.path, b.path))
      .filter((file) => file.category === 'source');
    const entry = candidates.find((file) =>
      /(^|\/)(?:main|index|app|cli)\.(?:[cm]?[jt]sx?|py|rs|go|java)$/i.test(file.path),
    )?.path;
    for (const [name, files] of grouped) {
      const block = inset(blockRects.get(name)!, 2);
      const cells = allocate(
        files.map((file) => ({ key: file.path, value: 4 + Math.log2(file.bytes + 1) })),
        block,
        0,
      );
      for (const file of files) {
        const cell = cells.get(file.path)!;
        const footprint = {
          x: cell.x + cell.width * 0.17,
          y: cell.y + cell.depth * 0.17,
          width: cell.width * 0.66,
          depth: cell.depth * 0.66,
        };
        const landmark = file.path === entry;
        const height =
          heightFromLines(file.lines) * (landmark ? 2.5 : file.category === 'docs' ? 0.7 : 1.3);
        buildings.push({
          id: `b-${encodeURIComponent(snapshot.name)}:${encodeURIComponent(file.path)}`,
          path: file.path,
          category: file.category,
          language: file.language,
          lines: file.lines,
          bytes: file.bytes,
          position: { x: round(footprint.x), y: round(footprint.y) },
          width: round(footprint.width),
          depth: round(footprint.depth),
          height: round(height),
          color: languageColor(file.language),
          landmark,
          seed: stableHash(
            `${snapshot.name}/${file.path}@${snapshot.commitSha ?? snapshot.snapshotHash}`,
          ),
          ...(snapshot.url && snapshot.commitSha && !snapshot.dirty
            ? {
                githubUrl: `${snapshot.url}/blob/${snapshot.commitSha}/${((snapshot.pathPrefix ?? '') + file.path).split('/').map(encodeURIComponent).join('/')}`,
              }
            : {}),
        });
      }
    }
    const totals = new Map<string, number>();
    for (const file of snapshot.files)
      totals.set(file.language, (totals.get(file.language) ?? 0) + file.lines + 1);
    const primaryLanguage =
      [...totals].sort((a, b) => b[1] - a[1] || compare(a[0], b[0]))[0]?.[0] ?? 'Config';
    return {
      name: snapshot.name,
      description: snapshot.commitSha
        ? `Local repository · ${snapshot.commitSha.slice(0, 7)}${snapshot.dirty ? ' · uncommitted changes' : ''}`
        : 'Local directory · no Git commit',
      url: snapshot.url,
      commitSha: snapshot.commitSha ?? '',
      primaryLanguage,
      stars: 0,
      bounds: repoBounds,
      buildings: buildings.sort((a, b) => compare(a.path, b.path)),
      blocks: [...blockRects]
        .sort((a, b) => compare(a[0], b[0]))
        .map(([name, bounds]) => ({ name, bounds })),
    };
  });
  const dates = snapshots
    .map((snapshot) => snapshot.committedAt)
    .filter((value): value is string => !!value)
    .sort();
  const snapshotHash = createHash('sha256')
    .update(
      JSON.stringify(
        snapshots.map((snapshot) => ({
          name: snapshot.name,
          commitSha: snapshot.commitSha,
          hash: snapshot.snapshotHash,
        })),
      ),
    )
    .digest('hex');
  return {
    schemaVersion: 1,
    generatedAt: dates.at(-1) ?? '1970-01-01T00:00:00.000Z',
    owner,
    isFixture: false,
    theme: { ...midnightTheme, languages },
    camera: { origin: { x: 520, y: 120 }, scale: Math.min(2.6, 440 / side) },
    bounds,
    repositories,
    snapshotHash,
  };
}
