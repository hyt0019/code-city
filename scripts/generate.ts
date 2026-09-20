import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createFixture } from '../fixtures/city';
import rawConfig from '../codecity.config';
import { configSchema } from '../src/core/config';
import { scanLocal } from '../src/scanner/scan-local';
import { layoutCity } from '../src/layout/treemap';
import { writeAssets } from './write-assets';
import { collectGitHub } from '../src/scanner/github';
import type { z } from 'zod';
import { repositoryInput } from '../src/core/config';
import { publishableSnapshot } from '../src/core/privacy';
import { privateInputs } from '../src/scanner/private-inputs';
import type { RepositorySnapshot } from '../src/core/model';

const config = configSchema.parse(rawConfig);
const args = process.argv.slice(2);
const inputsFromArgs: z.infer<typeof repositoryInput>[] = [];
let demo = false;
let cityOnly = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--demo') demo = true;
  else if (args[index] === '--city-only') cityOnly = true;
  else if (args[index] === '--repo' && args[index + 1] && !args[index + 1].startsWith('--'))
    inputsFromArgs.push({ path: args[++index] });
  else if (args[index] === '--github' && args[index + 1] && !args[index + 1].startsWith('--'))
    inputsFromArgs.push(repositoryInput.parse({ github: args[++index] }));
  else if (args[index] === '--help') {
    console.log(
      'Usage: npm run generate -- [--repo PATH ... | --github OWNER/REPO ...] [--city-only] | --demo\nCity-only CLI inputs use private-1, private-2, ... as public aliases. Local and GitHub inputs may be combined (maximum 8). Without flags, uses codecity.config.ts plus CODECITY_PRIVATE_REPOSITORIES, or the demo.',
    );
    process.exit(0);
  } else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
}
if (demo && inputsFromArgs.length)
  throw new Error('--demo cannot be combined with repository inputs.');
if (cityOnly && (demo || !inputsFromArgs.length))
  throw new Error('--city-only requires --repo or --github inputs.');
if (cityOnly)
  inputsFromArgs.forEach((input, index) => {
    input.privacy = 'city-only';
    input.name = `private-${index + 1}`;
  });
const secretInputs =
  demo || inputsFromArgs.length ? [] : privateInputs(process.env.CODECITY_PRIVATE_REPOSITORIES);
if (secretInputs.length && !process.env.CODECITY_GITHUB_TOKEN)
  throw new Error('CODECITY_PRIVATE_REPOSITORIES requires CODECITY_GITHUB_TOKEN.');
const inputs = inputsFromArgs.length ? inputsFromArgs : [...config.repositories, ...secretInputs];
if (!demo && inputs.length > 8) throw new Error('Select at most 8 repositories.');
if (demo || !inputs.length) await writeAssets(createFixture());
else {
  const snapshots = [];
  for (const input of inputs) {
    const options = {
      ...config.scanner,
      exclude: config.exclude,
      name: input.name,
    };
    let snapshot: RepositorySnapshot;
    try {
      snapshot =
        'github' in input
          ? await collectGitHub(input, {
              ...options,
              metadataToken: process.env.GITHUB_TOKEN,
              privateToken: process.env.CODECITY_GITHUB_TOKEN,
              warn: console.warn,
            })
          : await scanLocal(resolve(input.path), options);
    } catch (error) {
      if (input.privacy === 'city-only')
        throw new Error(
          `Unable to scan city-only input ${input.name}. Check its location, credentials, ref and network; details are suppressed.`,
        );
      throw error;
    }
    snapshot.privacy = input.privacy;
    snapshots.push(snapshot);
    console.log(
      input.privacy === 'city-only'
        ? `Scanned ${input.name}: ${snapshot.files.length} buildings · city-only`
        : `Scanned ${snapshot.name}: ${snapshot.files.length} text files, ${snapshot.skipped.length} skipped, ${snapshot.commitSha?.slice(0, 7) ?? 'no Git commit'}`,
    );
  }
  const scene = layoutCity(snapshots, config.owner);
  await mkdir('generated', { recursive: true });
  await writeFile(
    'generated/snapshots.json',
    `${JSON.stringify(snapshots.map(publishableSnapshot), null, 2)}\n`,
  );
  await writeAssets(scene);
}
