import type { CityScene, RepositoryDistrict, RepositorySnapshot } from './model';
import { stableHash } from './metrics';

/** Explicit allowlists keep new scanner metadata private unless deliberately published. */
export function redactRepository(repo: RepositoryDistrict): RepositoryDistrict {
  if (repo.privacy !== 'city-only') return repo;
  return {
    privacy: 'city-only',
    name: repo.name,
    description: 'City view only · file details are private',
    commitSha: '',
    primaryLanguage: 'Private',
    stars: 0,
    bounds: { ...repo.bounds },
    blocks: repo.blocks?.map((block) => ({ name: '', bounds: { ...block.bounds } })),
    buildings: repo.buildings.map((building, index) => ({
      id: `private-${encodeURIComponent(repo.name)}-${index + 1}`,
      path: '',
      category: 'source',
      language: 'Private',
      lines: building.lines,
      bytes: building.bytes,
      position: { ...building.position },
      width: building.width,
      depth: building.depth,
      height: building.height,
      ...(building.lineHeight === undefined ? {} : { lineHeight: building.lineHeight }),
      color: '#8195aa',
      seed: stableHash(`${repo.name}/${index + 1}`),
    })),
  };
}

export function redactScene(scene: CityScene): CityScene {
  if (!scene.repositories.some((repo) => repo.privacy === 'city-only')) return scene;
  const repositories = scene.repositories.map(redactRepository);
  return {
    schemaVersion: 1,
    heightMetric: scene.heightMetric,
    generatedAt: '1970-01-01T00:00:00.000Z',
    owner: scene.owner,
    isFixture: scene.isFixture,
    theme: {
      ...scene.theme,
      languages: Object.fromEntries(
        repositories.flatMap((repo) => repo.buildings.map((b) => [b.language, b.color])),
      ),
    },
    camera: scene.camera,
    bounds: scene.bounds,
    repositories,
  };
}

export function publishableSnapshot(snapshot: RepositorySnapshot) {
  if (snapshot.privacy !== 'city-only') return snapshot;
  return {
    schemaVersion: 1,
    privacy: 'city-only',
    name: snapshot.name,
    totals: {
      files: snapshot.files.length,
      lines: snapshot.files.reduce((sum, file) => sum + file.lines, 0),
      bytes: snapshot.files.reduce((sum, file) => sum + file.bytes, 0),
    },
  };
}
