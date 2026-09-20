import type { CityScene } from './model';

export function sceneSource(scene: CityScene): 'demo' | 'local' | 'GitHub' | 'mixed' | 'private' {
  if (scene.isFixture) return 'demo';
  const privateCount = scene.repositories.filter((repo) => repo.privacy === 'city-only').length;
  if (privateCount) return privateCount === scene.repositories.length ? 'private' : 'mixed';
  const github = scene.repositories.filter((repo) => repo.source === 'github').length;
  return github && github === scene.repositories.length ? 'GitHub' : github ? 'mixed' : 'local';
}
