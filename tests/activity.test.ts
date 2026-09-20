import { expect, it } from 'vitest';
import { activityBrightness, windowColor } from '../src/core/activity';
import { createFixture } from '../fixtures/city';
import { renderBanner } from '../src/renderers/svg/city';

it('dims older windows consistently without consulting generatedAt or changing geometry', () => {
  expect(activityBrightness(undefined, '2026-01-01')).toBeUndefined();
  expect(activityBrightness('bad-date', '2026-01-01')).toBeUndefined();
  const recent = activityBrightness('2026-01-01', '2026-01-01')!;
  const old = activityBrightness('2024-01-01', '2026-01-01')!;
  expect(old).toBeGreaterThanOrEqual(0.25);
  expect(recent).toBeGreaterThan(old);
  const scene = createFixture();
  const building = scene.repositories[0].buildings[0];
  building.windowBrightness = old;
  expect(windowColor(building, '#ffffff')).not.toBe('#ffffff');
  const svg = renderBanner(scene);
  scene.generatedAt = '2099-01-01T00:00:00.000Z';
  expect(renderBanner(scene)).toBe(svg);
});
