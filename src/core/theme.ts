import type { CityScene, CityTheme } from './model';
import { stableHash } from './metrics';
export const midnightTheme: CityTheme = {
  name: 'Midnight Skyline',
  background: '#0d1117',
  text: '#edf3fb',
  muted: '#8998aa',
  languages: {
    TypeScript: '#459fd5',
    JavaScript: '#d1a352',
    Python: '#9573d4',
    Markdown: '#a2b5ba',
    Rust: '#bd8968',
    Go: '#63b9bf',
    Java: '#bf7863',
    CSS: '#8b7acf',
    SCSS: '#b97aa1',
    HTML: '#c68b69',
    JSON: '#96aa81',
    YAML: '#849c72',
    TOML: '#9ba980',
    Shell: '#78b497',
    Config: '#8195aa',
    Private: '#8195aa',
  },
};
export type ThemeId = 'github-dark' | 'github-light';

export const daylightTheme: CityTheme = {
  ...midnightTheme,
  name: 'Daylight Skyline',
  background: '#f5f8fc',
  text: '#24364b',
  muted: '#61748b',
};

export function applyTheme(scene: CityScene, theme: ThemeId): CityScene {
  return { ...scene, theme: theme === 'github-light' ? daylightTheme : midnightTheme };
}

export function cityPalette(scene: CityScene) {
  const light = scene.theme.background === daylightTheme.background;
  return {
    light,
    slab: light ? '#adbccd' : '#344052',
    ground: light ? '#d9e2ec' : '#151d27',
    road: light ? '#b8c8d9' : '#202936',
    district: light ? '#c3d1df' : '#28313c',
    border: light ? '#95a9bf' : '#414c5a',
    pavement: light ? '#e7edf4' : '#1d2731',
    park: light ? '#d1e2d2' : '#26372f',
    block: light ? '#d9e5ef' : '#202c37',
    blockBorder: light ? '#acbdcd' : '#465564',
    label: light ? '#ffffff' : '#0c121b',
    labelBorder: light ? '#b3c5d7' : '#394657',
    labelText: light ? '#314a63' : '#dce8f5',
    blockText: light ? '#4e657d' : '#c1d2e1',
    blockOutline: light ? '#edf3f8' : '#0b1420',
    highlight: light ? '#147ba9' : '#9be4ff',
  };
}
export function languageColor(language: string): string {
  return (
    midnightTheme.languages[language] ??
    ['#78a9b2', '#a594c2', '#b2a078', '#7aa69b', '#9e8f9c'][stableHash(language) % 5]
  );
}
export function cityLegend(scene: CityScene): { name: string; color: string }[] {
  const totals = new Map<string, number>();
  for (const repo of scene.repositories)
    for (const b of repo.buildings)
      totals.set(b.language, (totals.get(b.language) ?? 0) + b.lines + 1);
  const languages = [...totals]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3)
    .map(([name]) => ({ name, color: scene.theme.languages[name] ?? languageColor(name) }));
  if (scene.repositories.some((repo) => repo.buildings.some((b) => b.category === 'test')))
    languages.push({ name: 'Tests', color: '#78a967' });
  return languages;
}
