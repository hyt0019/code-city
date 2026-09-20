import { posix } from 'node:path';
import type { Category } from '../core/model';

const extensions: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.pyi': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.swift': 'Swift',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'Less',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.md': 'Markdown',
  '.mdx': 'Markdown',
  '.rst': 'Documentation',
  '.txt': 'Text',
  '.json': 'JSON',
  '.jsonc': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.ps1': 'PowerShell',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.svg': 'SVG',
  '.ini': 'INI',
  '.cfg': 'INI',
  '.conf': 'Config',
  '.dart': 'Dart',
  '.r': 'R',
  '.ex': 'Elixir',
};

export function classify(path: string): { language: string; category: Category } | null {
  const name = posix.basename(path).toLowerCase();
  const extension = posix.extname(name);
  const language =
    extensions[extension] ??
    (name === 'dockerfile'
      ? 'Dockerfile'
      : name === 'makefile'
        ? 'Makefile'
        : name.startsWith('.')
          ? 'Config'
          : /^(license|copying|authors|notice)$/i.test(name)
            ? 'Text'
            : null);
  if (!language) return null;
  let category: Category = 'source';
  if (
    /(^|\/)(__tests__|tests?|specs?)(\/|$)|(?:[._-](?:test|spec)\.)|(?:^|\/)test_[^/]+$|_test\.[^/]+$/.test(
      path.toLowerCase(),
    )
  )
    category = 'test';
  else if (
    language === 'Markdown' ||
    language === 'Documentation' ||
    /(^|\/)docs?(\/|$)|^(readme|license|contributing)/i.test(path)
  )
    category = 'docs';
  else if (
    ['JSON', 'YAML', 'TOML', 'XML', 'INI', 'Config', 'Dockerfile', 'Makefile'].includes(language) ||
    /(?:^|\/)[^/]*config[^/]*\.[^/]+$/i.test(path)
  )
    category = 'config';
  else if (language === 'SVG') category = 'asset';
  return { language, category };
}

/** Counts nonblank, non-comment lines; string contents are preserved. */
export function countLines(content: string, language: string): number {
  const cStyle = [
    'TypeScript',
    'JavaScript',
    'Java',
    'C',
    'C++',
    'C#',
    'Kotlin',
    'Swift',
    'Go',
    'Rust',
    'CSS',
    'SCSS',
    'Less',
    'PHP',
    'Dart',
    'JSON',
  ].includes(language);
  const hashStyle = [
    'Python',
    'Ruby',
    'Shell',
    'PowerShell',
    'YAML',
    'TOML',
    'R',
    'Elixir',
    'Dockerfile',
    'Makefile',
    'INI',
    'Config',
  ].includes(language);
  if (!cStyle)
    return content
      .split(/\r\n|\n|\r/)
      .filter((line) => line.trim() && !(hashStyle && line.trimStart().startsWith('#'))).length;
  let block = false,
    quote = '',
    escaped = false,
    count = 0;
  for (const line of content.split(/\r\n|\n|\r/)) {
    let hasCode = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i],
        next = line[i + 1];
      if (block) {
        if (ch === '*' && next === '/') {
          block = false;
          i++;
        }
        continue;
      }
      if (quote) {
        hasCode = true;
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '/' && next === '/') break;
      if (ch === '/' && next === '*') {
        block = true;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      if (ch.trim()) hasCode = true;
    }
    if (hasCode) count++;
    if (quote !== '`') quote = '';
    escaped = false;
  }
  return count;
}
