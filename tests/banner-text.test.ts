import { describe, expect, it } from 'vitest';
import { createFixture } from '../fixtures/city';
import { configSchema } from '../src/core/config';
import { renderBanner, renderCitySvg } from '../src/renderers/svg/city';

const subtitleLines = (svg: string) =>
  [...svg.matchAll(/<tspan x="48" dy="\d+">([^<]*)<\/tspan>/g)].map((match) => match[1]);

describe('banner text', () => {
  it('keeps a short subtitle on one line', () => {
    expect(subtitleLines(renderBanner(createFixture(), { subtitle: 'One skyline' }))).toEqual([
      'One skyline',
    ]);
  });

  it('wraps a long description onto a second line at a pause instead of cutting it', () => {
    const lines = subtitleLines(
      renderBanner(createFixture(), {
        subtitle: '按住说话，松开就是一段干净的文字。本地语音识别，AI 整理口误与重复。',
      }),
    );
    expect(lines).toEqual([
      '按住说话，松开就是一段干净的文字。',
      '本地语音识别，AI 整理口误与重复。',
    ]);
  });

  it('lets closing punctuation hang at the end of a full line', () => {
    const lines = subtitleLines(
      renderBanner(createFixture(), {
        subtitle: '把代码仓库变成一座城市：每个仓库一片城区，每个文件一栋建筑。',
      }),
    );
    expect(lines).toEqual(['把代码仓库变成一座城市：每个仓库一片城区，', '每个文件一栋建筑。']);
  });

  it('ends the second line with an ellipsis only when text is left over', () => {
    const lines = subtitleLines(
      renderBanner(createFixture(), { subtitle: '很长的描述'.repeat(20) }),
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].endsWith('…')).toBe(false);
    expect(lines[1].endsWith('…')).toBe(true);
    const words = subtitleLines(
      renderBanner(createFixture(), {
        subtitle: 'Turn local and GitHub repositories into deterministic isometric code cities',
      }),
    );
    expect(words).toHaveLength(2);
    // Latin words are never split across lines.
    for (const line of words) expect(line).toMatch(/^\S.*\S$/);
    expect(words.join(' ').replace('…', '')).toContain('Turn local and GitHub');
  });

  it('writes canvas coordinates to a tenth of a unit', () => {
    const svg = renderCitySvg(createFixture());
    const coordinates = [...svg.matchAll(/points="([^"]+)"/g)].flatMap((match) =>
      match[1].split(/[ ,]/),
    );
    expect(coordinates.length).toBeGreaterThan(1000);
    for (const value of coordinates) expect(value).toMatch(/^-?\d+(?:\.\d)?$/);
  });
});

describe('repository descriptions', () => {
  it('accepts a description that replaces the repository’s own', () => {
    const config = configSchema.parse({
      owner: 'octo',
      repositories: [{ github: 'octo/tool', description: '  A short pitch  ' }],
    });
    expect(config.repositories[0]).toMatchObject({
      github: 'octo/tool',
      description: 'A short pitch',
    });
  });

  it('refuses a description on a city-only repository, whose description stays fixed', () => {
    expect(() =>
      configSchema.parse({
        owner: 'octo',
        repositories: [
          { github: 'octo/secret', privacy: 'city-only', name: 'private-1', description: 'Leaks' },
        ],
      }),
    ).toThrow(/fixed public description/);
  });
});
