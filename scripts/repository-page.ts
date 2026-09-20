import { escapeXml } from '../src/renderers/svg/city';
import { repositorySlug } from '../src/core/repository-scene';

export function repositoryPageHtml(template: string, name: string): string {
  const slug = repositorySlug(name);
  return template
    .replace(/((?:src|href)=")\.\/(assets\/|favicon\.svg)/g, '$1../../$2')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeXml(name)} — Code City</title>`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
    .replace(
      '</body>',
      `<noscript><p><a href="../../">All repositories</a></p><img src="../../assets/repos/${slug}.svg" alt="${escapeXml(name)} code city" style="max-width:100%;height:auto" /></noscript></body>`,
    );
}
