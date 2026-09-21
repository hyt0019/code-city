import type { Building, Category, CityScene, RepositoryDistrict } from '../src/core/model';
import { heightFromLines, stableHash } from '../src/core/metrics';

type FileSpec = [path: string, lines: number, category?: Category];
const commitSha = '9b7e4c12f083ec962835470681ab35960b51d9a2';
const palette = {
  TypeScript: '#459fd5',
  JavaScript: '#d1a352',
  Python: '#9573d4',
  Markdown: '#a2b5ba',
};

function district(
  name: string,
  description: string,
  primaryLanguage: keyof typeof palette,
  x: number,
  y: number,
  files: FileSpec[],
): RepositoryDistrict {
  const buildings: Building[] = files.map(([path, lines, category = 'source'], index) => {
    const language = category === 'docs' ? 'Markdown' : primaryLanguage;
    const hash = stableHash(`${name}/${path}@${commitSha}`);
    const landmark = index === 0;
    return {
      id: `${name}-${hash.toString(16)}`,
      path,
      category,
      language,
      lines,
      bytes: lines * (23 + (hash % 14)),
      modifiedAt: '2026-09-01T00:00:00.000Z',
      position: { x: x + 8 + (index % 3) * 22, y: y + 8 + Math.floor(index / 3) * 22 },
      width: category === 'docs' ? 17 : 11 + (hash % 5),
      depth: category === 'docs' ? 16 : 11 + ((hash >>> 4) % 5),
      height: heightFromLines(lines),
      color: palette[language],
      landmark,
    };
  });
  return {
    name,
    description,
    primaryLanguage,
    commitSha,
    stars: 0,
    bounds: { x, y, width: 78, depth: 78 },
    buildings,
  };
}

/** Explicit fixture positions; no random or wall-clock input. These are fictional repositories. */
export function createFixture(): CityScene {
  return {
    schemaVersion: 1,
    generatedAt: '2026-09-01T00:00:00.000Z',
    owner: 'demo',
    isFixture: true,
    theme: {
      name: 'Midnight Skyline',
      background: '#0d1117',
      text: '#edf3fb',
      muted: '#8998aa',
      languages: palette,
    },
    camera: { origin: { x: 520, y: 134 }, scale: 2.6 },
    repositories: [
      district('atlas', 'The foundation. A TypeScript application.', 'TypeScript', 0, 90, [
        ['src/main.ts', 824],
        ['src/router.ts', 426],
        ['src/store.ts', 368],
        ['src/components/City.tsx', 652],
        ['src/hooks/useScene.ts', 312],
        ['src/core/model.ts', 248],
        ['tests/layout.test.ts', 285, 'test'],
        ['tests/render.test.ts', 198, 'test'],
        ['vite.config.ts', 62, 'config'],
      ]),
      district('orbit', 'Small utilities. A wider orbit.', 'JavaScript', 0, 0, [
        ['src/index.js', 712],
        ['src/parser.js', 524],
        ['src/transform.js', 468],
        ['src/utils.js', 216],
        ['src/format.js', 346],
        ['src/cache.js', 182],
        ['tests/parser.test.js', 276, 'test'],
        ['package.json', 48, 'config'],
      ]),
      district('tools', 'Python tools for the everyday.', 'Python', 90, 90, [
        ['src/cli.py', 682],
        ['src/analysis.py', 538],
        ['src/metrics.py', 364],
        ['src/export.py', 294],
        ['src/config.py', 186],
        ['tests/test_cli.py', 248, 'test'],
        ['pyproject.toml', 42, 'config'],
      ]),
      district('docs', 'A little space for shared knowledge.', 'Markdown', 90, 0, [
        ['README.md', 168, 'docs'],
        ['guide/getting-started.md', 224, 'docs'],
        ['guide/configuration.md', 186, 'docs'],
        ['guide/architecture.md', 312, 'docs'],
        ['guide/examples.md', 142, 'docs'],
        ['CONTRIBUTING.md', 96, 'docs'],
      ]),
    ],
  };
}
