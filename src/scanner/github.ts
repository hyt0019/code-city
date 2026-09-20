import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { githubRef, githubRepository } from '../core/config';
import { scanLocal } from './scan-local';
import type { ScanOptions } from './scan-local';
import { HISTORY_LIMIT } from './file-history';

const execute = promisify(execFile);
const metadataSchema = z.object({
  private: z.boolean(),
  description: z.string().nullable(),
  stargazers_count: z.number().int().nonnegative(),
  archived: z.boolean().optional(),
});
const cacheSchema = z.object({ checkedAt: z.number().finite(), data: metadataSchema });
export class PrivateRepositoryError extends Error {}

export async function githubMetadata(
  repository: string,
  cacheFile: string,
  options: {
    fetcher?: typeof fetch;
    token?: string;
    now?: number;
    warn?: (message: string) => void;
  } = {},
) {
  githubRepository.parse(repository);
  const now = options.now ?? Date.now();
  let cached: z.infer<typeof cacheSchema> | undefined;
  try {
    cached = cacheSchema.parse(JSON.parse(await readFile(cacheFile, 'utf8')));
  } catch {
    /* Optional metadata cache. */
  }
  if (cached && cached.data.private)
    throw new PrivateRepositoryError('Private repositories are not supported.');
  if (
    cached &&
    cached.data.archived !== undefined &&
    now >= cached.checkedAt &&
    now - cached.checkedAt < 6 * 60 * 60 * 1000
  )
    return cached.data;
  try {
    const response = await (options.fetcher ?? fetch)(
      `https://api.github.com/repos/${repository}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      },
    );
    if (!response.ok)
      throw new Error(
        `GitHub metadata HTTP ${response.status}${response.headers.get('retry-after') ? `; retry after ${response.headers.get('retry-after')} seconds` : ''}`,
      );
    const data = metadataSchema.parse(await response.json());
    if (data.private) throw new PrivateRepositoryError('Private repositories are not supported.');
    await writeFile(cacheFile, `${JSON.stringify({ checkedAt: now, data })}\n`);
    return data;
  } catch (error) {
    if (error instanceof PrivateRepositoryError) throw error;
    options.warn?.(
      `Metadata unavailable for ${repository}; ${cached ? 'using cached public metadata' : 'continuing with Git file data only'}.`,
    );
    return cached?.data;
  }
}

export function publicGitEnvironment(emptyConfig: string): NodeJS.ProcessEnv {
  // Fetch public code without forwarding local Git credentials, hooks, filters or repository overrides.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never',
    GIT_LFS_SKIP_SMUDGE: '1',
  };
}

export async function collectGitHub(
  input: { github: string; ref?: string; name?: string },
  options: ScanOptions & {
    cacheDirectory?: string;
    metadataToken?: string;
    warn?: (message: string) => void;
  } = {},
  dependencies: {
    fetcher?: typeof fetch;
    runGit?: (args: string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<string>;
  } = {},
) {
  const repository = githubRepository.parse(input.github).toLowerCase();
  const ref = input.ref ? githubRef.parse(input.ref) : 'HEAD';
  const cacheRoot = resolve(options.cacheDirectory ?? '.cache/github');
  await mkdir(cacheRoot, { recursive: true });
  if ((await realpath(cacheRoot)) !== cacheRoot)
    throw new Error('GitHub cache must not be a symbolic link.');
  const key = createHash('sha256')
    .update(`${repository.toLowerCase()}@${ref}`)
    .digest('hex')
    .slice(0, 24);
  const directory = resolve(cacheRoot, key);
  await mkdir(directory, { recursive: true });
  if ((await realpath(directory)) !== directory) throw new Error('Invalid GitHub cache directory.');
  const metadata = await githubMetadata(repository, resolve(directory, 'metadata.json'), {
    fetcher: dependencies.fetcher,
    token: options.metadataToken,
    warn: options.warn,
  });
  const checkout = resolve(directory, 'checkout');
  await mkdir(checkout, { recursive: true });
  if ((await realpath(checkout)) !== checkout)
    throw new Error('Invalid GitHub checkout directory.');
  const hooks = resolve(directory, 'empty-hooks');
  await mkdir(hooks, { recursive: true });
  const emptyConfig = resolve(directory, 'empty.gitconfig');
  try {
    await writeFile(emptyConfig, '', { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  if ((await lstat(emptyConfig)).isSymbolicLink() || (await readFile(emptyConfig, 'utf8')) !== '')
    throw new Error('Invalid isolated Git config.');
  const environment = publicGitEnvironment(emptyConfig);
  const runGit =
    dependencies.runGit ??
    (async (args: string[], cwd: string, env: NodeJS.ProcessEnv) =>
      (
        await execute('git', args, {
          cwd,
          windowsHide: true,
          encoding: 'utf8',
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
          env,
        })
      ).stdout.trim());
  const git = async (args: string[]) => {
    try {
      return await runGit(
        [
          '-c',
          'credential.helper=',
          '-c',
          'http.extraHeader=',
          '-c',
          'protocol.file.allow=never',
          ...(process.platform === 'win32' ? ['-c', 'http.sslBackend=schannel'] : []),
          '-c',
          `core.hooksPath=${hooks}`,
          ...args,
        ],
        checkout,
        environment,
      );
    } catch {
      throw new Error(
        `Unable to fetch public GitHub repository ${repository} (${ref}). Check the repository/ref, network and cache permissions.`,
      );
    }
  };
  const url = `https://github.com/${repository}.git`;
  let initialized = false;
  try {
    const stat = await lstat(resolve(checkout, '.git'));
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error('Invalid cached Git directory.');
    initialized = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!initialized) {
    await git(['init', `--template=${hooks}`]);
    await git(['remote', 'add', 'origin', url]);
  } else {
    if ((await git(['remote', 'get-url', 'origin'])) !== url)
      throw new Error('GitHub cache origin does not match the configured repository.');
    if (await git(['status', '--porcelain', '--untracked-files=normal']))
      throw new Error('Cached checkout has local changes. Use a fresh cache directory.');
  }
  try {
    await git(['fetch', `--depth=${HISTORY_LIMIT + 1}`, '--no-tags', 'origin', ref]);
  } catch (error) {
    // An accessible repository with no refs is an empty city, not a network failure.
    if (ref !== 'HEAD' || (await git(['ls-remote', 'origin']))) throw error;
    return {
      schemaVersion: 1 as const,
      name: input.name ?? repository.split('/')[1],
      source: 'github' as const,
      url: `https://github.com/${repository}`,
      dirty: false,
      snapshotHash: createHash('sha256').update('[]').digest('hex'),
      files: [],
      skipped: [],
      description: metadata?.description ?? 'Empty public GitHub repository',
      stars: metadata?.stargazers_count,
      archived: metadata?.archived,
    };
  }
  await git(['checkout', '--detach', 'FETCH_HEAD']);
  const snapshot = await scanLocal(checkout, {
    ...options,
    gitEnvironment: environment,
    name: input.name ?? repository.split('/')[1],
  });
  return {
    ...snapshot,
    source: 'github' as const,
    url: `https://github.com/${repository}`,
    description:
      metadata?.description ?? `Public GitHub repository · ${snapshot.commitSha?.slice(0, 7)}`,
    stars: metadata?.stargazers_count,
    archived: metadata?.archived,
  };
}
