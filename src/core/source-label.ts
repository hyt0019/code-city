import type { CityScene } from './model';

export function sceneSource(scene: CityScene): 'demo' | 'local' | 'GitHub' | 'mixed' {
  if (scene.isFixture) return 'demo';
  const github = scene.repositories.filter((repo) => repo.source === 'github').length;
  return github && github === scene.repositories.length ? 'GitHub' : github ? 'mixed' : 'local';
}
