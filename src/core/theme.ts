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
  },
};
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
