import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { CityScene } from '../src/core/model';
import { configSchema, sceneSchema } from '../src/core/config';
import { applyHeightMetric, sceneStats } from '../src/core/metrics';
import { renderBanner } from '../src/renderers/svg/city';
import { applyTheme } from '../src/core/theme';
import { repositoryScene, repositorySlug } from '../src/core/repository-scene';
import rawConfig from '../codecity.config';
import { applyRepositorySignals } from '../src/core/repository-signals';
export async function writeAssets(scene: CityScene) {
  const config = configSchema.parse(rawConfig);
  sceneSchema.parse(scene);
  scene = applyRepositorySignals(applyHeightMetric(scene, config.appearance.heightMetric));
  const files = new Map<string, string>();
  const themed = applyTheme(scene, config.appearance.theme);
  files.set('scene.json', `${JSON.stringify(themed, null, 2)}\n`);
  function banners(name: string, scoped: CityScene) {
    const options = {
      ...config.profile,
      ...config.appearance,
      size: name.startsWith('repos/') ? ('repository' as const) : ('profile' as const),
    };
    files.set(`${name}.svg`, renderBanner(applyTheme(scoped, config.appearance.theme), options));
    files.set(`${name}.dark.svg`, renderBanner(applyTheme(scoped, 'github-dark'), options));
    files.set(`${name}.light.svg`, renderBanner(applyTheme(scoped, 'github-light'), options));
  }
  banners('profile', scene);
  const slugs = new Set<string>();
  for (const repo of [...scene.repositories].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const slug = repositorySlug(repo.name);
    if (slugs.has(slug)) throw new Error(`Repository export filename collision: ${repo.name}`);
    slugs.add(slug);
    banners(`repos/${slug}`, repositoryScene(scene, repo.name));
  }
  const manifest = [...files.keys()].sort();
  for (const directory of ['generated', 'public/assets']) {
    await mkdir(`${directory}/repos`, { recursive: true });
    let previous: unknown = [];
    try {
      previous = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    // Remove only previously generated repository banners, never arbitrary user files.
    if (Array.isArray(previous))
      for (const file of previous) {
        if (
          typeof file === 'string' &&
          /^repos\/[a-z0-9-]+(?:\.(?:dark|light))?\.svg$/.test(file) &&
          !files.has(file)
        )
          await rm(`${directory}/${file}`, { force: true });
      }
    for (const [file, contents] of files) await writeFile(`${directory}/${file}`, contents);
    await writeFile(`${directory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const svg = files.get('profile.svg')!;
  console.log(
    `Generated ${sceneStats(scene).files} ${scene.isFixture ? 'fixture' : 'real'} buildings · profile.svg ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB · 1200 × 420`,
  );
}
