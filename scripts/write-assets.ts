import { mkdir, writeFile } from 'node:fs/promises';
import type { CityScene } from '../src/core/model';
import { configSchema, sceneSchema } from '../src/core/config';
import { sceneStats } from '../src/core/metrics';
import { renderBanner } from '../src/renderers/svg/city';
import rawConfig from '../codecity.config';
export async function writeAssets(scene: CityScene) {
  const config = configSchema.parse(rawConfig);
  sceneSchema.parse(scene);
  await mkdir('generated', { recursive: true });
  await mkdir('public/assets', { recursive: true });
  const json = `${JSON.stringify(scene, null, 2)}\n`;
  const svg = renderBanner(scene, { ...config.profile, ...config.appearance });
  await writeFile('generated/scene.json', json);
  await writeFile('generated/profile.svg', svg);
  await writeFile('public/assets/scene.json', json);
  await writeFile('public/assets/profile.svg', svg);
  console.log(
    `Generated ${sceneStats(scene).files} ${scene.isFixture ? 'fixture' : 'real'} buildings · profile.svg ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB · 1200 × 420`,
  );
}
