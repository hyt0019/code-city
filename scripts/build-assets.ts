import { readFile } from 'node:fs/promises';
import { createFixture } from '../fixtures/city';
import { configSchema, sceneSchema } from '../src/core/config';
import rawConfig from '../codecity.config';
import { writeAssets } from './write-assets';
let scene;
try {
  scene = sceneSchema.parse(JSON.parse(await readFile('generated/scene.json', 'utf8')));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  scene = createFixture();
}
for (const input of configSchema.parse(rawConfig).repositories)
  if (
    input.privacy === 'city-only' &&
    !scene.repositories.every((repo) => repo.privacy === 'city-only') &&
    !scene.repositories.some((repo) => repo.name === input.name && repo.privacy === 'city-only')
  )
    throw new Error('Privacy configuration changed. Run npm run generate before building.');
await writeAssets(scene);
