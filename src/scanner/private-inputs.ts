import { z } from 'zod';
import { repositoryInput } from '../core/config';

/** Secret values are never interpolated into diagnostics or schema error messages. */
export function privateInputs(value: string | undefined): z.infer<typeof repositoryInput>[] {
  if (!value?.trim()) return [];
  try {
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
      .max(8)
      .parse(JSON.parse(value));
    return inputs.map((input) => repositoryInput.parse({ ...input, privacy: 'city-only' }));
  } catch {
    throw new Error(
      'CODECITY_PRIVATE_REPOSITORIES must be a JSON array of { github, name, ref? }; name is a public alias.',
    );
  }
}
