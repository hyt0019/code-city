import { describe, expect, it } from 'vitest';
import { pageRoute } from '../src/core/site-paths';
import { repositoryPageHtml } from '../scripts/repository-page';

describe('standalone repository routes', () => {
  it('resolves root and prefixed Pages URLs, including direct index.html requests', () => {
    expect(pageRoute('/repos/atlas/')).toEqual({ slug: 'atlas', root: '/' });
    expect(pageRoute('/code-city/repos/atlas/index.html')).toEqual({
      slug: 'atlas',
      root: '/code-city/',
    });
    expect(pageRoute('/code-city/')).toBeNull();
    expect(pageRoute('/repos/../../private/')).toBeNull();
  });
  it('keeps entry resources relative to the root and escapes repository titles', () => {
    const html = repositoryPageHtml(
      '<html><head><title>Code City</title><link href="./favicon.svg"><link href="./assets/index.css"></head><body><script src="./assets/index.js"></script></body></html>',
      '<repo> & "one"',
    );
    expect(html).toContain('src="../../assets/index.js"');
    expect(html).toContain('href="../../favicon.svg"');
    expect(html).toContain('&lt;repo&gt; &amp; &quot;one&quot;');
    expect(html).toContain('<noscript>');
    expect(html).not.toContain('<repo>');
  });
});
