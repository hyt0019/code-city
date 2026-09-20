import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { githubRef, githubRepository } from '../core/config';
import { scanLocal } from './scan-local';
import type { ScanOptions } from './scan-local';
import { publicGitEnvironment } from './github';

const execute = promisify(execFile);

/** Authenticated inputs are scanned in disposable storage and always published city-only. */
export async function collectPrivateGitHub(
  input: { github: string; ref?: string; name: string },
  options: ScanOptions & { token: string },
  dependencies: {
    fetcher?: typeof fetch;
    runGit?: (args: string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<string>;
  } = {},
) {
  let directory: string | undefined;
  try {
    const repository = githubRepository.parse(input.github).toLowerCase();
    const ref = input.ref ? githubRef.parse(input.ref) : 'HEAD';
    if (!input.name.trim()) throw new Error('Missing display alias');
    // Do not use a cached visibility check or continue after failed authorization.
    const response = await (dependencies.fetcher ?? fetch)(
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
    if (!response.ok) throw new Error('Repository access could not be verified');
    const metadata: unknown = await response.json();
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      !('private' in metadata) ||
      typeof metadata.private !== 'boolean' ||
      (metadata.private && !options.token)
    )
      throw new Error('Repository access could not be verified');

    directory = await mkdtemp(join(tmpdir(), 'code-city-private-'));
    const emptyConfig = join(directory, 'empty.gitconfig');
    const hooks = join(directory, 'empty-hooks');
    const checkout = join(directory, 'checkout');
    await writeFile(emptyConfig, '');
    await mkdir(hooks);
    await mkdir(checkout);
    const environment = publicGitEnvironment(emptyConfig);
    const runGit =
      dependencies.runGit ??
      (async (args, cwd, env) =>
        (
          await execute('git', args, {
            cwd,
            env,
            windowsHide: true,
            encoding: 'utf8',
            timeout: 120_000,
            maxBuffer: 4 * 1024 * 1024,
          })
        ).stdout.trim());
    const git = (args: string[], network = false) =>
      runGit(
        [
          '-c',
          'credential.helper=',
          '-c',
          'http.extraHeader=',
          '-c',
          'http.followRedirects=false',
          '-c',
          'protocol.file.allow=never',
          '-c',
          `core.hooksPath=${hooks}`,
          ...(process.platform === 'win32' ? ['-c', 'http.sslBackend=schannel'] : []),
          ...(network && options.token
            ? ['--config-env=http.https://github.com/.extraHeader=CODECITY_GIT_AUTH']
            : []),
          ...args,
        ],
        checkout,
        network && options.token
          ? {
              ...environment,
              CODECITY_GIT_AUTH: `Authorization: Basic ${Buffer.from(`x-access-token:${options.token}`).toString('base64')}`,
            }
          : environment,
      );
    await git(['init', `--template=${hooks}`]);
    const url = `https://github.com/${repository}.git`;
    try {
      await git(['fetch', '--depth=1', '--no-tags', url, ref], true);
      await git(['checkout', '--detach', 'FETCH_HEAD']);
    } catch (error) {
      if (ref !== 'HEAD' || (await git(['ls-remote', url], true))) throw error;
    }
    return {
      ...(await scanLocal(checkout, { ...options, gitEnvironment: environment, name: input.name })),
      privacy: 'city-only' as const,
    };
  } catch {
    throw new Error(
      'Unable to read a city-only GitHub input. Check CODECITY_GITHUB_TOKEN, repository/ref and network access.',
    );
  } finally {
    if (directory) {
      if (
        dirname(resolve(directory)) !== resolve(tmpdir()) ||
        !basename(directory).startsWith('code-city-private-')
      )
        throw new Error('Invalid private checkout cleanup path.');
      await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}
