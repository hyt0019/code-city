import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createFixture } from '../fixtures/city';
import rawConfig from '../codecity.config';
import { configSchema } from '../src/core/config';
import { scanLocal } from '../src/scanner/scan-local';
import { layoutCity } from '../src/layout/treemap';
import { writeAssets } from './write-assets';

const config = configSchema.parse(rawConfig);
const args = process.argv.slice(2);
const paths: string[] = [];
let demo = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--demo') demo = true;
  else if (args[index] === '--repo' && args[index + 1] && !args[index + 1].startsWith('--'))
    paths.push(args[++index]);
  else if (args[index] === '--help') {
    console.log(
      'Usage: npm run generate -- [--repo PATH ... | --demo]\nWithout flags, uses repositories in codecity.config.ts or the demo.',
    );
    process.exit(0);
  } else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
}
if (demo && paths.length) throw new Error('--demo and --repo cannot be combined.');
const inputs = paths.length
  ? paths.map((path) => ({ path, name: undefined }))
  : config.repositories;
if (!demo && inputs.length > 8) throw new Error('Select at most 8 repositories.');
if (demo || !inputs.length) await writeAssets(createFixture());
else {
  const snapshots = [];
  for (const input of inputs) {
    const snapshot = await scanLocal(resolve(input.path), {
      ...config.scanner,
      exclude: config.exclude,
      name: input.name,
    });
    snapshots.push(snapshot);
    console.log(
      `Scanned ${snapshot.name}: ${snapshot.files.length} text files, ${snapshot.skipped.length} skipped, ${snapshot.commitSha?.slice(0, 7) ?? 'no Git commit'}`,
    );
  }
  const scene = layoutCity(snapshots, config.owner);
  await mkdir('generated', { recursive: true });
  await writeFile('generated/snapshots.json', `${JSON.stringify(snapshots, null, 2)}\n`);
  await writeAssets(scene);
}
