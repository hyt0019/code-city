import { z } from 'zod';
import { repositoryInput } from '../core/config';
import type { RepositoryInput } from '../core/config';

const FORMAT_ERROR =
  'CODECITY_PRIVATE_REPOSITORIES must list one owner/repo per line (optionally "owner/repo as alias"), or be a JSON array of { github, name, ref? }; name is a public alias.';

/**
 * Secret values are never interpolated into diagnostics or schema error messages.
 *
 * Plain form, one repository per line; blank lines and # comments are ignored:
 *   owner/secret-project
 *   owner/another-project@main as side-project
 *   third-project            (uses the configured owner)
 * Without "as", aliases are private-1, private-2, ... in order.
 */
export function privateInputs(value: string | undefined, owner?: string): RepositoryInput[] {
  if (!value?.trim()) return [];
  try {
    if (value.trim().startsWith('[')) {
      const inputs = z
        .array(
          z
            .object({
              github: z.string(),
              name: z.string(),
              ref: z.string().optional(),
            })
            .strict(),
        )
        .max(50)
        .parse(JSON.parse(value));
      return inputs.map((input) => repositoryInput.parse({ ...input, privacy: 'city-only' }));
    }
    const lines = value
      .split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    if (lines.length > 50) throw new Error();
    return lines.map((line, index) => {
      const match = /^([^\s@]+)(?:@(\S+))?(?:\s+as\s+(\S.*))?$/i.exec(line);
      if (!match) throw new Error();
      const [, repository, ref, alias] = match;
      if (!repository.includes('/') && (!owner || owner === 'local')) throw new Error();
      return repositoryInput.parse({
        github: repository.includes('/') ? repository : `${owner}/${repository}`,
        name: alias?.trim() || `private-${index + 1}`,
        ...(ref ? { ref } : {}),
        privacy: 'city-only',
      });
    });
  } catch {
    throw new Error(FORMAT_ERROR);
  }
}
