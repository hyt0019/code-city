import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

export function normalizeGitHubUrl(remote: string): string | undefined {
  const match = remote
    .trim()
    .match(
      /^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/,
    );
  return match ? `https://github.com/${match[1]}/${match[2]}` : undefined;
}

export async function readGitMetadata(
  root: string,
  environment?: NodeJS.ProcessEnv,
): Promise<{
  commitSha?: string;
  committedAt?: string;
  pathPrefix?: string;
  url?: string;
  dirty: boolean;
}> {
  const git = async (args: string[]) =>
    (
      await execute('git', ['-c', 'core.quotePath=false', ...args], {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
        env: { ...(environment ?? process.env), GIT_TERMINAL_PROMPT: '0' },
      })
    ).stdout.trim();
  try {
    await git(['rev-parse', '--is-inside-work-tree']);
  } catch {
    return { dirty: true };
  }
  const [head, status, remote, prefix] = await Promise.allSettled([
    git(['log', '-1', '--format=%H%n%cI']),
    git(['status', '--porcelain', '--untracked-files=normal', '--', '.']),
    git(['remote', 'get-url', 'origin']),
    git(['rev-parse', '--show-prefix']),
  ]);
  const [sha, date] = head.status === 'fulfilled' ? head.value.split('\n') : [];
  return {
    ...(prefix.status === 'fulfilled' && prefix.value ? { pathPrefix: prefix.value } : {}),
    ...(sha && /^[a-f0-9]{40,64}$/.test(sha) ? { commitSha: sha, committedAt: date } : {}),
    ...(remote.status === 'fulfilled' && normalizeGitHubUrl(remote.value)
      ? { url: normalizeGitHubUrl(remote.value) }
      : {}),
    dirty: status.status !== 'fulfilled' || status.value.length > 0,
  };
}
