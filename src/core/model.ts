export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  depth: number;
}
export type Category = 'source' | 'test' | 'docs' | 'config' | 'asset';
export type HeightMetric = 'lines' | 'bytes';
export interface CityTheme {
  name: string;
  background: string;
  text: string;
  muted: string;
  languages: Record<string, string>;
}
export interface CameraPreset {
  origin: Point;
  scale: number;
}
export interface Building {
  id: string;
  path: string;
  category: Category;
  language: string;
  lines: number;
  bytes: number;
  modifiedAt?: string;
  windowBrightness?: number;
  position: Point;
  width: number;
  depth: number;
  height: number;
  lineHeight?: number;
  color: string;
  landmark?: boolean;
  seed?: number;
  githubUrl?: string;
}
export interface RepositoryDistrict {
  source?: 'local' | 'github';
  name: string;
  description: string;
  url?: string;
  commitSha: string;
  primaryLanguage: string;
  stars: number;
  bounds: Rect;
  buildings: Building[];
  blocks?: CityBlock[];
}
export interface CityBlock {
  name: string;
  bounds: Rect;
}
export interface CityScene {
  heightMetric?: HeightMetric;
  schemaVersion: 1;
  generatedAt: string;
  owner: string;
  isFixture: boolean;
  theme: CityTheme;
  camera: CameraPreset;
  repositories: RepositoryDistrict[];
  bounds?: Rect;
  snapshotHash?: string;
}

export interface FileSnapshot {
  modifiedAt?: string;
  path: string;
  language: string;
  category: Category;
  lines: number;
  bytes: number;
  contentHash: string;
}

export interface RepositorySnapshot {
  schemaVersion: 1;
  name: string;
  source: 'local' | 'github';
  description?: string;
  stars?: number;
  commitSha?: string;
  committedAt?: string;
  pathPrefix?: string;
  url?: string;
  dirty: boolean;
  snapshotHash: string;
  files: FileSnapshot[];
  skipped: { path: string; reason: string }[];
}
