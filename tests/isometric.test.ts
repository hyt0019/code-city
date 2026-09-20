import { describe, expect, it } from 'vitest';
import { project, unproject } from '../src/layout/isometric';
import { heightFromLines } from '../src/core/metrics';

describe('isometric projection', () => {
  it('projects the origin and both ground axes at 30 degrees', () => {
    expect(project({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(project({ x: 10, y: 0 }).x).toBeCloseTo(8.660254);
    expect(project({ x: 10, y: 0 }).y).toBe(5);
    expect(project({ x: 0, y: 10 }).x).toBeCloseTo(-8.660254);
    expect(project({ x: 0, y: 10 }).y).toBe(5);
  });
  it('raises buildings vertically without changing the ground position', () => {
    const camera = { origin: { x: 70, y: 40 }, scale: 2 };
    expect(project({ x: 0, y: 0 }, 10, camera)).toEqual({ x: 70, y: 20 });
  });
  it('round-trips ground coordinates with translation and scale', () => {
    const camera = { origin: { x: 123, y: -35 }, scale: 2.6 };
    for (const point of [
      { x: -50, y: 60 },
      { x: 100.25, y: 32.7 },
      { x: 0, y: 0 },
    ]) {
      const result = unproject(project(point, 0, camera), camera);
      expect(result.x).toBeCloseTo(point.x);
      expect(result.y).toBeCloseTo(point.y);
    }
  });
  it('scales lines logarithmically and clamps extreme values', () => {
    expect(heightFromLines(0)).toBe(3);
    expect(heightFromLines(-10)).toBe(3);
    expect(heightFromLines(10)).toBeLessThan(heightFromLines(100));
    expect(heightFromLines(1e10)).toBe(28);
  });
});
