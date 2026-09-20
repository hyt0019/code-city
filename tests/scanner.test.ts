import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { scanLocal } from '../src/scanner/scan-local';
import { classify, countLines } from '../src/scanner/languages';
import { normalizeGitHubUrl } from '../src/scanner/git-metadata';
import { configSchema } from '../src/core/config';
import { layoutCity } from '../src/layout/treemap';
const exec = promisify(execFile);
const fixtureRoots: string[] = [];
afterAll(async () => {
  for (const root of fixtureRoots) {
    if (
      dirname(resolve(root)) !== resolve(tmpdir()) ||
      !basename(root).startsWith('code-city-test-')
    )
      throw new Error('Unsafe fixture cleanup path');
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
async function fixture(files: Record<string, string | Buffer>) {
  // Outside this checkout so Git cannot discover the project's own parent repository.
  const root = await mkdtemp(join(tmpdir(), 'code-city-test-'));
  fixtureRoots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    await mkdir(resolve(full, '..'), { recursive: true });
    await writeFile(full, content);
  }
  return root;
}

describe('local repository scanner', () => {
  it('scans more than 5,000 small files without dropping entries', async () => {
    const root = await fixture({});
    for (let offset = 0; offset < 5001; offset += 100) {
      await Promise.all(
        Array.from({ length: Math.min(100, 5001 - offset) }, (_, index) =>
          writeFile(join(root, `file-${offset + index}.ts`), 'export const value = 1;\n'),
        ),
      );
    }
    const result = await scanLocal(root);
    expect(result.files).toHaveLength(5001);
    expect(result.files.reduce((sum, file) => sum + file.lines, 0)).toBe(5001);
    expect(result.skipped).toEqual([]);
  }, 30000);
  it('respects nested gitignore rules, negation and excluded parent directories', async () => {
    const root = await fixture({
      '.gitignore': 'ignored/\n*.secret.ts\n*.gitignore\n',
      'src/.gitignore': '!keep.secret.ts\nlocal.ts\n',
      'src/keep.secret.ts': 'export const yes=1;',
      'src/hide.secret.ts': 'no',
      'src/local.ts': 'no',
      'ignored/.gitignore': '!keep.ts\n',
      'ignored/keep.ts': 'no',
      'src/main.ts': 'export const app = true;',
    });
    const snapshot = await scanLocal(root);
    expect(snapshot.files.map((file) => file.path)).toEqual(['src/keep.secret.ts', 'src/main.ts']);
  });
  it('excludes generated, binary, locked, large and dependency files', async () => {
    const root = await fixture({
      'src/main.ts':
        '// comment\n\nconst url = "https://example.org";\n/* multi\nline */\nexport {url};',
      'node_modules/x/index.js': 'no',
      'dist/bundle.js': 'no',
      'file.lock': 'no',
      'package-lock.json': '{}',
      'src/data.ts': Buffer.from([0, 1, 2]),
      'src/gen.ts': '// @generated\nconst auto = 1;',
      'src/huge.ts': 'x'.repeat(1000),
      'src/invalid.py': Buffer.from([0xff, 0xfe, 0xff]),
      'tests/main.test.ts': 'test("one",()=>{});',
    });
    const snapshot = await scanLocal(root, { maxFileBytes: 500 });
    expect(snapshot.files.map((file) => file.path)).toEqual(['src/main.ts', 'tests/main.test.ts']);
    expect(snapshot.files[0].lines).toBe(2);
    expect(snapshot.files[1].category).toBe('test');
    expect(snapshot.skipped).toHaveLength(4);
    expect(JSON.stringify(snapshot)).not.toContain(root);
  });
  it('handles empty and non-Git directories, Unicode paths, renames and stable hashes', async () => {
    const root = await fixture({});
    expect((await scanLocal(root)).files).toEqual([]);
    await writeFile(join(root, '中文 & file #1.ts'), 'export const one = 1;\n');
    const first = await scanLocal(root);
    expect(first.commitSha).toBeUndefined();
    expect(first).toEqual(await scanLocal(root));
    await rename(join(root, '中文 & file #1.ts'), join(root, 'renamed.ts'));
    const after = await scanLocal(root);
    expect(after.snapshotHash).not.toBe(first.snapshotHash);
    expect(after.files.map((file) => file.path)).toEqual(['renamed.ts']);
  });
  it('reads only local Git metadata and creates commit-pinned encoded URLs', async () => {
    const root = await fixture({ '子目录/中文 & file #1.ts': 'export const value = 1;' });
    const git = (args: string[]) => exec('git', args, { cwd: root, windowsHide: true });
    await git(['init']);
    await git(['add', '.']);
    await git([
      '-c',
      'user.name=Code City Test',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-m',
      'fixture',
    ]);
    await git(['remote', 'add', 'origin', 'git@github.com:example/demo.git']);
    const snapshot = await scanLocal(join(root, '子目录'));
    expect(snapshot.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(snapshot.pathPrefix).toBe('子目录/');
    expect(snapshot.dirty).toBe(false);
    const url = layoutCity([snapshot]).repositories[0].buildings[0].githubUrl;
    expect(url).toBe(
      `https://github.com/example/demo/blob/${snapshot.commitSha}/${encodeURIComponent('子目录')}/${encodeURIComponent('中文 & file #1.ts')}`,
    );
    await writeFile(join(root, '子目录/中文 & file #1.ts'), 'changed');
    expect(
      layoutCity([await scanLocal(root)]).repositories[0].buildings[0].githubUrl,
    ).toBeUndefined();
  });
  it('reports file limits instead of silently returning a partial city', async () => {
    const root = await fixture({ 'a.ts': 'a', 'b.py': 'b' });
    await expect(scanLocal(root, { maxFiles: 1 })).rejects.toThrow('file limit');
  });
  it('normalizes safe GitHub remotes without credentials', () => {
    expect(normalizeGitHubUrl('https://token@github.com/user/repo.git')).toBe(
      'https://github.com/user/repo',
    );
    expect(normalizeGitHubUrl('git@github.com:user/repo.git')).toBe('https://github.com/user/repo');
    expect(normalizeGitHubUrl('https://github.com.evil.org/user/repo')).toBeUndefined();
    expect(normalizeGitHubUrl('javascript:alert(1)')).toBeUndefined();
  });
  it('classifies languages and counts comment-aware source lines', () => {
    expect(classify('src/main.tsx')).toEqual({ language: 'TypeScript', category: 'source' });
    expect(classify('tests/test_cli.py')?.category).toBe('test');
    expect(classify('docs/guide.md')?.category).toBe('docs');
    expect(countLines('# comment\n\nprint("# hello")\n', 'Python')).toBe(1);
    expect(
      countLines('const x = "// literal"; /* comment */\n// skip\nexport {x};', 'TypeScript'),
    ).toBe(2);
  });
  it('validates configuration boundaries', () => {
    expect(configSchema.parse({}).repositories).toEqual([]);
    expect(() => configSchema.parse({ scanner: { maxFiles: 0 } })).toThrow();
    expect(() => configSchema.parse({ appearance: { theme: 'unknown' } })).toThrow();
    expect(() => configSchema.parse({ unknown: true })).toThrow();
  });
});
