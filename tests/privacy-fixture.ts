import type { RepositorySnapshot } from '../src/core/model';
import { layoutCity } from '../src/layout/treemap';

export const privateMarkers = [
  'confidential-project',
  'secret-folder',
  'customer-ledger.ts',
  'internal-plan.md',
  'ignored-secret.bin',
  'confidential-description',
  'private-content-digest',
  'private-snapshot-digest',
  'fedcba9876543210fedcba9876543210fedcba98',
  '2026-08-12',
];

export function privateSnapshot(): RepositorySnapshot {
  return {
    schemaVersion: 1,
    privacy: 'city-only',
    name: 'private-one',
    source: 'github',
    dirty: false,
    description: 'confidential-description',
    url: 'https://github.com/example/confidential-project',
    pathPrefix: 'secret-folder/',
    commitSha: privateMarkers[8],
    committedAt: '2026-08-12T12:00:00.000Z',
    snapshotHash: 'private-snapshot-digest',
    stars: 100,
    archived: true,
    files: [
      {
        path: 'secret-folder/customer-ledger.ts',
        language: 'TypeScript',
        category: 'source',
        lines: 300,
        bytes: 4500,
        modifiedAt: '2026-08-12T12:00:00.000Z',
        contentHash: 'private-content-digest',
      },
      {
        path: 'secret-folder/internal-plan.md',
        language: 'Markdown',
        category: 'docs',
        lines: 30,
        bytes: 600,
        contentHash: 'private-content-digest',
      },
    ],
    skipped: [{ path: 'ignored-secret.bin', reason: 'binary content' }],
  };
}

export function publicSnapshot(): RepositorySnapshot {
  return {
    schemaVersion: 1,
    name: 'public-project',
    source: 'github',
    dirty: false,
    url: 'https://github.com/example/public-project',
    commitSha: 'a'.repeat(40),
    snapshotHash: 'public-hash',
    files: [
      {
        path: 'src/main.ts',
        language: 'TypeScript',
        category: 'source',
        lines: 120,
        bytes: 1800,
        contentHash: 'public-content',
      },
    ],
    skipped: [],
  };
}

export function privacyFixture(onlyPrivate = false) {
  return layoutCity(
    onlyPrivate ? [privateSnapshot()] : [privateSnapshot(), publicSnapshot()],
    'example',
  );
}
