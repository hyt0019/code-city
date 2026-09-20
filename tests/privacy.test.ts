import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { configSchema, sceneSchema } from '../src/core/config';
import { publishableSnapshot, redactScene } from '../src/core/privacy';
import { applyHeightMetric, sceneStats } from '../src/core/metrics';
import { layoutCity } from '../src/layout/treemap';
import { renderBanner, renderCitySvg } from '../src/renderers/svg/city';
import { repositoryScene } from '../src/core/repository-scene';
import { privateInputs } from '../src/scanner/private-inputs';
import { sceneSource } from '../src/core/source-label';
import { privateMarkers, privateSnapshot, publicSnapshot } from './privacy-fixture';

const execute = promisify(execFile);
const geometry = (scene: ReturnType<typeof layoutCity>) =>
  scene.repositories.map((repo) => ({
    name: repo.name,
    bounds: repo.bounds,
    buildings: repo.buildings.map(({ position, height, width, depth, lines, bytes }) => ({
      position,
      height,
      width,
      depth,
      lines,
      bytes,
    })),
  }));

describe('city-only publication', () => {
  it('removes identifiers, source metadata and hashes while preserving geometry and public inspection', () => {
    const secret = privateSnapshot();
    const scene = layoutCity([secret, publicSnapshot()]);
    expect(sceneSource(scene)).toBe('mixed');
    expect(sceneSource(layoutCity([secret]))).toBe('private');
    const ordinary = layoutCity([{ ...secret, privacy: 'full' }, publicSnapshot()]);
    expect(geometry(scene)).toEqual(geometry(ordinary));
    expect(scene.repositories[1]).toEqual(ordinary.repositories[1]);
    expect(sceneStats(scene)).toMatchObject({
      repositories: 2,
      files: 3,
      lines: 450,
      languages: ['TypeScript'],
    });
    expect(sceneSchema.parse(scene)).toEqual(scene);
    const snapshot = publishableSnapshot(secret);
    expect(snapshot).toEqual({
      schemaVersion: 1,
      privacy: 'city-only',
      name: 'private-one',
      totals: { files: 2, lines: 330, bytes: 5100 },
    });
    for (const metric of ['lines', 'bytes'] as const) {
      const result = redactScene(applyHeightMetric(scene, metric));
      const exported = [
        JSON.stringify(result),
        JSON.stringify(snapshot),
        renderBanner(result),
        renderBanner(repositoryScene(result, 'private-one')),
      ];
      for (const output of exported)
        for (const marker of privateMarkers) {
          expect(output).not.toContain(marker);
          expect(output).not.toContain(encodeURIComponent(marker));
        }
    }
    const svg = renderCitySvg(repositoryScene(scene, 'private-one'), {
      interactive: true,
      showLabels: true,
    });
    expect(svg.match(/data-building=/g)).toHaveLength(2);
    expect(svg).not.toMatch(/role="button"|tabindex|<title>|href=|aria-pressed/);
    expect(JSON.stringify(secret)).toContain('customer-ledger.ts');
    expect(redactScene(scene)).toEqual(scene);
    secret.files.reverse();
    expect(layoutCity([publicSnapshot(), secret])).toEqual(scene);
  });

  it('requires aliases and keeps secret inputs city-only, bounded and out of error messages', () => {
    expect(() =>
      configSchema.parse({ repositories: [{ path: '.', privacy: 'city-only' }] }),
    ).toThrow();
    expect(() =>
      configSchema.parse({ repositories: [{ github: 'example/repo', privacy: 'city-only' }] }),
    ).toThrow();
    const inputs = privateInputs(
      JSON.stringify([
        { github: 'example/confidential-project', name: 'private-one', ref: 'main' },
      ]),
    );
    expect(inputs).toEqual([
      {
        github: 'example/confidential-project',
        name: 'private-one',
        ref: 'main',
        privacy: 'city-only',
      },
    ]);
    expect(
      configSchema.parse({
        repositories: Array.from({ length: 8 }, (_, i) => ({
          path: '.',
          name: `district-${i}`,
          privacy: i % 2 ? 'full' : 'city-only',
        })),
      }).repositories,
    ).toHaveLength(8);
    expect(() =>
      configSchema.parse({ repositories: Array.from({ length: 9 }, () => ({ path: '.' })) }),
    ).toThrow();
    for (const value of [
      'confidential-project',
      '[{"github":"example/confidential-project"}]',
      JSON.stringify([
        { github: 'example/confidential-project', name: 'private-one', privacy: 'full' },
      ]),
    ]) {
      expect(() => privateInputs(value)).toThrow('CODECITY_PRIVATE_REPOSITORIES');
      try {
        privateInputs(value);
      } catch (error) {
        expect(String(error)).not.toContain('confidential-project');
      }
    }
  });

  it('publishes only redacted JSON and SVG when generating a local private input through the CLI', async () => {
    const root = await mkdtemp(join(tmpdir(), 'code-city-privacy-test-'));
    try {
      const input = join(root, 'confidential-project');
      await mkdir(join(input, 'secret-folder'), { recursive: true });
      await writeFile(
        join(input, 'secret-folder/customer-ledger.ts'),
        'export const confidentialValue = 42;',
      );
      const { stdout } = await execute(
        process.execPath,
        [
          resolve('node_modules/tsx/dist/cli.mjs'),
          resolve('scripts/generate.ts'),
          '--repo',
          input,
          '--city-only',
        ],
        { cwd: root, windowsHide: true },
      );
      expect(stdout).toContain('private-1: 1 buildings');
      expect(stdout).not.toContain('confidential-project');
      const outputs: string[] = [];
      async function inspect(directory: string) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) await inspect(path);
          else outputs.push(path.slice(root.length), await readFile(path, 'utf8'));
        }
      }
      await inspect(join(root, 'generated'));
      await inspect(join(root, 'public'));
      for (const output of outputs)
        expect(output).not.toMatch(
          /confidential-project|secret-folder|customer-ledger|confidentialValue/,
        );
      const display = JSON.parse(await readFile(join(root, 'generated/display.json'), 'utf8'));
      expect(Object.keys(display).sort()).toEqual(['appearance', 'profile']);
      const scene = sceneSchema.parse(
        JSON.parse(await readFile(join(root, 'public/assets/scene.json'), 'utf8')),
      );
      expect(scene.repositories[0].privacy).toBe('city-only');
      expect(scene.repositories[0].buildings[0].path).toBe('');
      expect(
        JSON.parse(await readFile(join(root, 'generated/snapshots.json'), 'utf8'))[0].files,
      ).toBeUndefined();
    } finally {
      if (
        dirname(resolve(root)) !== resolve(tmpdir()) ||
        !basename(root).startsWith('code-city-privacy-test-')
      )
        throw new Error('Unsafe test cleanup');
      await rm(root, { recursive: true, force: true });
    }
  });
});
