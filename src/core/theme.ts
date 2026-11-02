import type { Building, CityScene, CityTheme } from './model';
import { stableHash } from './metrics';
import { mix } from './color';

/**
 * Language swatches share one OKLCH lightness and chroma; only the hue tells them apart.
 * Buildings use quieter tones of the same hues, so the city reads as one architectural model.
 */
const swatches: Record<string, string> = {
  TypeScript: '#6da9e7',
  JavaScript: '#c99d4e',
  Python: '#af95df',
  Markdown: '#8aabb4',
  Rust: '#de8e69',
  Go: '#35b9c0',
  Java: '#e1897e',
  CSS: '#909fe9',
  SCSS: '#d887ae',
  HTML: '#da8f77',
  JSON: '#8db179',
  YAML: '#7cb487',
  TOML: '#a8aa68',
  Shell: '#63b895',
  Config: '#96a7b4',
  Private: '#9fa5ad',
};
const nightTones: Record<string, string> = {
  TypeScript: '#41668d',
  JavaScript: '#7a5e2e',
  Python: '#6a5988',
  Markdown: '#50686e',
  Rust: '#87553e',
  Go: '#1f7074',
  Java: '#89524b',
  CSS: '#57608e',
  SCSS: '#845169',
  HTML: '#855647',
  JSON: '#546b48',
  YAML: '#4a6d51',
  TOML: '#65663d',
  Shell: '#3b705a',
  Config: '#58656f',
  Private: '#5f646a',
};
const dayTones: Record<string, string> = {
  TypeScript: '#c6e1ff',
  JavaScript: '#f0dbb9',
  Python: '#e3d7fb',
  Markdown: '#d0e2e6',
  Rust: '#fcd4c3',
  Go: '#b8e9eb',
  Java: '#fed2cc',
  CSS: '#d4dcff',
  SCSS: '#f9d1e3',
  HTML: '#fad5c9',
  JSON: '#d3e4ca',
  YAML: '#cce6d0',
  TOML: '#dfe1c3',
  Shell: '#c3e8d7',
  Config: '#d6e0e7',
  Private: '#dadee3',
};
const fallback = {
  swatch: ['#d29190', '#b4a46a', '#66b5ab', '#bb95c4', '#6eaecd'],
  night: ['#825555', '#6e633a', '#376f68', '#735879', '#3d6a7f'],
  day: ['#f8d4d3', '#e6dec1', '#c2e7e1', '#ead6ef', '#c4e4f4'],
};
/**
 * City-only districts hide their languages, so each gets one quiet tint of its own
 * (slate, sage, teal, stone, mauve, steel) chosen from its public alias, not its files.
 */
const privateTints = {
  night: ['#58666e', '#5b675d', '#556767', '#6d6157', '#63616f', '#5c6470'],
  day: ['#d4e0e7', '#d7e1d8', '#d3e2e1', '#e6dcd4', '#dddce8', '#d8dee9'],
};

export const midnightTheme: CityTheme = {
  name: 'Midnight Skyline',
  background: '#0b0c0f',
  text: '#eceff2',
  muted: '#9499a0',
  languages: swatches,
};
export type ThemeId = 'github-dark' | 'github-light';

export const daylightTheme: CityTheme = {
  ...midnightTheme,
  name: 'Daylight Skyline',
  background: '#f6f5f2',
  text: '#1f2227',
  muted: '#5f636a',
};

export function applyTheme(scene: CityScene, theme: ThemeId): CityScene {
  return { ...scene, theme: theme === 'github-light' ? daylightTheme : midnightTheme };
}

export function isLight(scene: CityScene): boolean {
  return scene.theme.background === daylightTheme.background;
}

export function cityPalette(scene: CityScene) {
  const light = isLight(scene);
  return {
    light,
    background: light ? daylightTheme.background : midnightTheme.background,
    text: light ? daylightTheme.text : midnightTheme.text,
    muted: light ? daylightTheme.muted : midnightTheme.muted,
    faint: light ? '#82868e' : '#656970',
    hairline: light ? '#d3d1cc' : '#26292e',
    glow: light ? '#ffffff' : '#1f2735',
    slab: light ? '#d3d1cc' : '#1c1f24',
    ground: light ? '#e9e8e4' : '#121417',
    edge: light ? '#ffffff' : '#32363c',
    road: light ? '#dedcd7' : '#171a1e',
    district: light ? '#e3e1dd' : '#171a1e',
    border: light ? '#d3d1cc' : '#26292e',
    pavement: light ? '#efeeea' : '#15171b',
    park: light ? '#d9e5d6' : '#18211b',
    block: light ? '#f6f5f2' : '#1b1e22',
    blockBorder: light ? '#dcdad5' : '#23262b',
    label: light ? '#f6f5f2' : '#0b0c0f',
    labelBorder: light ? '#d3d1cc' : '#32363c',
    labelText: light ? '#1f2227' : '#d8dce1',
    blockText: light ? '#82868e' : '#7d828a',
    blockOutline: light ? '#f6f5f2' : '#121417',
    highlight: light ? '#1f2227' : '#fbd094',
    tree: light ? ['#a9c3a3', '#9cb996', '#b4ccae'] : ['#22302a', '#273629', '#1f2c2a'],
    spire: light ? '#b48a3c' : '#e3b76a',
    beacon: light ? '#d9534f' : '#ff8f6b',
    lane: light ? '#cfccc5' : '#2c3036',
    lamp: '#ffd59a',
    headlight: '#fff1d6',
    taillight: '#ff5b4a',
    cars: ['#5f6b7a', '#b8513b', '#3f6fa0', '#8a8f96', '#d9a441'],
  };
}

/** The legend and UI swatch for a language. */
export function languageColor(language: string): string {
  return swatches[language] ?? fallback.swatch[stableHash(language) % 5];
}

/** The facade tone used by buildings in the current theme. */
export function buildingTone(language: string, light: boolean, district?: string): string {
  if (language === 'Private' && district)
    return (light ? privateTints.day : privateTints.night)[stableHash(district) % 6];
  const tones = light ? dayTones : nightTones;
  return tones[language] ?? (light ? fallback.day : fallback.night)[stableHash(language) % 5];
}

/** The bright accent for crowns and lights: the language swatch, or a district's own tint. */
export function buildingAccent(language: string, light: boolean, district?: string): string {
  if (language === 'Private' && district)
    return mix(buildingTone(language, false, district), light ? '#6b7480' : '#ffffff', 0.38);
  return languageColor(language);
}

/**
 * Give a stored building the current theme's facade tone without changing its geometry.
 * A small, seed-based lightness variation keeps a district from reading as one flat block.
 */
export function tonedBuilding<T extends Building>(
  building: T,
  light: boolean,
  district?: string,
): T {
  const tone = buildingTone(building.language, light, district);
  const variation = (((building.seed ?? stableHash(building.id)) >>> 4) % 17) - 8;
  return {
    ...building,
    color:
      variation >= 0
        ? mix(tone, '#ffffff', (variation / 100) * (light ? 0.7 : 1.1))
        : mix(tone, light ? '#8d97a3' : '#000000', -variation / 100),
  };
}

export const testRoofColor = '#77b779';

export function cityLegend(scene: CityScene): { name: string; color: string }[] {
  const totals = new Map<string, number>();
  for (const repo of scene.repositories)
    for (const b of repo.buildings)
      totals.set(b.language, (totals.get(b.language) ?? 0) + b.lines + 1);
  const languages = [...totals]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3)
    .map(([name]) => ({ name, color: languageColor(name) }));
  if (scene.repositories.some((repo) => repo.buildings.some((b) => b.category === 'test')))
    languages.push({ name: 'Tests', color: testRoofColor });
  return languages;
}
