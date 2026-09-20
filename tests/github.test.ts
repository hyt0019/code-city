import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectGitHub,
  githubMetadata,
  PrivateRepositoryError,
  publicGitEnvironment,
} from '../src/scanner/github';
import { configSchema } from '../src/core/config';
import { layoutCity } from '../src/layout/treemap';

const execute = promisify(execFile);
const roots: string[] = [];
async function temporary() {
  const root = await mkdtemp(join(tmpdir(), 'code-city-github-test-'));
  roots.push(root);
  return root;
}
const publicData = { private: false, description: 'A public project', stargazers_count: 12 };
const metadata = async () => Response.json(publicData);
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  for (const root of roots) {
    if (
      dirname(resolve(root)) !== resolve(tmpdir()) ||
      !basename(root).startsWith('code-city-github-test-')
    )
      throw new Error('Unsafe fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('public GitHub collection', () => {
  it('validates mixed inputs and rejects URLs, paths and option-like refs', () => {
    expect(
      configSchema.parse({
        repositories: [
          { path: '.' },
          { github: 'example/project', ref: 'release/v1', name: 'Project' },
        ],
      }).repositories,
    ).toHaveLength(2);
    for (const input of [
      { github: 'https://github.com/example/project' },
      { github: '../project' },
      { github: 'example/..' },
      { github: 'example/project', ref: '--upload-pack=evil' },
      { github: 'example/project', ref: 'main~1' },
    ])
      expect(() => configSchema.parse({ repositories: [input] })).toThrow();
    vi.stubEnv('GIT_CONFIG_COUNT', '1');
    vi.stubEnv('GIT_DIR', '/wrong');
    const env = publicGitEnvironment('/empty.config');
    expect(env.GIT_CONFIG_GLOBAL).toBe('/empty.config');
    expect(env.GIT_CONFIG_COUNT).toBeUndefined();
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
  });
  it('caches public metadata, strips extra fields and tolerates rate limits with stale data', async () => {
    const cache = join(await temporary(), 'metadata.json');
    const fetcher = vi.fn(async () => Response.json({ ...publicData, secret: 'must-not-persist' }));
    await expect(
      githubMetadata('example/project', cache, { fetcher, token: 'test-token', now: 1000 }),
    ).resolves.toEqual(publicData);
    await githubMetadata('example/project', cache, { fetcher, now: 2000 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await readFile(cache, 'utf8')).not.toMatch(/test-token|must-not-persist/);
    const warn = vi.fn();
    await expect(
      githubMetadata('example/project', cache, {
        fetcher: async () => new Response('', { status: 429, headers: { 'retry-after': '60' } }),
        now: 30_000_000,
        warn,
      }),
    ).resolves.toEqual(publicData);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cached public metadata'));
  });
  it('rejects private repositories and continues without metadata on API failures', async () => {
    const root = await temporary();
    const runGit = vi.fn(async () => '');
    await expect(
      collectGitHub(
        { github: 'example/private' },
        { cacheDirectory: root },
        { fetcher: async () => Response.json({ ...publicData, private: true }), runGit },
      ),
    ).rejects.toBeInstanceOf(PrivateRepositoryError);
    expect(runGit).not.toHaveBeenCalled();
    await expect(
      githubMetadata('example/public', join(root, 'missing.json'), {
        fetcher: async () => new Response('', { status: 503 }),
      }),
    ).resolves.toBeUndefined();
  });
  it('fetches new commits through a reusable shallow cache and emits encoded pinned URLs', async () => {
    const root = await temporary();
    const source = join(root, 'source');
    await mkdir(source);
    const git = async (args: string[]) =>
      (await execute('git', args, { cwd: source, windowsHide: true })).stdout.trim();
    await git(['init']);
    await writeFile(join(source, '中文 & file.ts'), 'export const value = 1;');
    await git(['add', '.']);
    const commit = () =>
      git([
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-m',
        'fixture',
      ]);
    await commit();
    const runGit = async (args: string[], cwd: string, env: NodeJS.ProcessEnv) => {
      const local = args.map((arg) =>
        arg === 'protocol.file.allow=never' ? 'protocol.file.allow=always' : arg,
      );
      if (local.includes('fetch') || local.includes('ls-remote'))
        local[local.indexOf('origin')] = source;
      return (await execute('git', local, { cwd, env, windowsHide: true })).stdout.trim();
    };
    const options = { cacheDirectory: join(root, 'cache') };
    const first = await collectGitHub({ github: 'example/project' }, options, {
      fetcher: metadata,
      runGit,
    });
    expect(first.dirty).toBe(false);
    expect(first.source).toBe('github');
    expect(first.commitSha).toBe(await git(['rev-parse', 'HEAD']));
    expect(layoutCity([first]).repositories[0].buildings[0].githubUrl).toBe(
      `https://github.com/example/project/blob/${first.commitSha}/${encodeURIComponent('中文 & file.ts')}`,
    );
    expect(first.stars).toBe(12);
    expect(JSON.stringify(first)).not.toContain(root);
    expect(
      await collectGitHub({ github: 'example/project' }, options, { fetcher: metadata, runGit }),
    ).toEqual(first);
    await writeFile(join(source, 'other.py'), 'print("next")');
    await git(['add', '.']);
    await commit();
    const next = await collectGitHub({ github: 'example/project' }, options, {
      fetcher: metadata,
      runGit,
    });
    expect(next.commitSha).not.toBe(first.commitSha);
    expect(next.files).toHaveLength(2);
    expect(next.files.some((file) => file.path === '中文 & file.ts')).toBe(true);
  });
  it('generates an empty scene only when Git confirms the public repository has no refs', async () => {
    const options = { cacheDirectory: await temporary() };
    const runGit = vi.fn(async (args: string[]) => {
      if (args.includes('fetch')) throw new Error('no HEAD');
      return '';
    });
    const empty = await collectGitHub({ github: 'example/empty' }, options, {
      fetcher: metadata,
      runGit,
    });
    expect(empty.files).toEqual([]);
    expect(empty.commitSha).toBeUndefined();
    expect(layoutCity([empty]).repositories[0].buildings).toEqual([]);
    const failingGit = async (args: string[]) => {
      if (args.includes('fetch') || args.includes('ls-remote')) throw new Error('offline');
      return '';
    };
    await expect(
      collectGitHub({ github: 'example/offline' }, options, {
        fetcher: metadata,
        runGit: failingGit,
      }),
    ).rejects.toThrow('Unable to fetch public');
  });
});
