import { readFile } from 'node:fs/promises';
import { createFixture } from '../fixtures/city';
import { sceneSchema } from '../src/core/config';
import { writeAssets } from './write-assets';
let scene;
try {
  scene = sceneSchema.parse(JSON.parse(await readFile('generated/scene.json', 'utf8')));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  scene = createFixture();
}
await writeAssets(scene);
