import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sceneSchema } from '../src/core/config';
import { repositorySlug } from '../src/core/repository-scene';
import { repositoryPageHtml } from './repository-page';

const scene = sceneSchema.parse(JSON.parse(await readFile('dist/assets/scene.json', 'utf8')));
const template = await readFile('dist/index.html', 'utf8');
for (const repo of scene.repositories) {
  const directory = `dist/repos/${repositorySlug(repo.name)}`;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/index.html`, repositoryPageHtml(template, repo.name));
}
await writeFile('dist/.nojekyll', '');
console.log(`Built ${scene.repositories.length} standalone repository pages.`);
