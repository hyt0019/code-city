import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
export const HISTORY_LIMIT = 256;

/** Dates of the most recent committed changes on the current first-parent history. */
export async function fileHistory(
  root: string,
  environment?: NodeJS.ProcessEnv,
): Promise<Map<string, string>> {
  const git = async (args: string[]) =>
    (
      await execute('git', args, {
        cwd: root,
        encoding: 'utf8',
        timeout: 20_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        env: { ...(environment ?? process.env), GIT_TERMINAL_PROMPT: '0' },
      })
    ).stdout;
  try {
    const shallowFile = (await git(['rev-parse', '--git-path', 'shallow'])).trim();
    let boundaries = new Set<string>();
    try {
      boundaries = new Set(
        (await readFile(resolve(root, shallowFile), 'utf8')).trim().split(/\s+/),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const output = await git([
      'log',
      `--max-count=${HISTORY_LIMIT}`,
      '--first-parent',
      '--diff-merges=first-parent',
      '--raw',
      '-z',
      '--no-renames',
      '--no-abbrev',
      '--relative',
      '--no-ext-diff',
      '--no-textconv',
      '--format=%x00%H%x00%cI',
      'HEAD',
      '--',
      '.',
    ]);
    const tokens = output.split('\0');
    const dates = new Map<string, string>();
    const seen = new Set<string>();
    let date: string | undefined;
    for (let i = 0; i < tokens.length; i++) {
      if (!tokens[i] && /^[a-f0-9]{40,64}$/.test(tokens[i + 1] ?? '')) {
        const sha = tokens[++i];
        const timestamp = tokens[++i];
        // A shallow boundary pretends its entire tree was added in one commit.
        date =
          boundaries.has(sha) || !Number.isFinite(Date.parse(timestamp))
            ? undefined
            : new Date(timestamp).toISOString();
      } else if (/^\n?:\d{6} \d{6} [a-f0-9]+ [a-f0-9]+ [A-Z]\d*$/.test(tokens[i])) {
        const deleted = tokens[i].endsWith(' D');
        const path = tokens[++i];
        if (seen.has(path)) continue;
        seen.add(path);
        if (date && !deleted) dates.set(path, date);
      }
    }
    return dates;
  } catch {
    // Missing, truncated or oversized history must not invent file timestamps.
    return new Map();
  }
}
