import type { CameraPreset, Point } from '../core/model';

const COS_30 = Math.sqrt(3) / 2;

/** Orthographic isometric projection. Height is measured along the vertical axis. */
export function project(
  point: Point,
  height = 0,
  camera: CameraPreset = { origin: { x: 0, y: 0 }, scale: 1 },
): Point {
  return {
    x: camera.origin.x + (point.x - point.y) * COS_30 * camera.scale,
    y: camera.origin.y + ((point.x + point.y) * 0.5 - height) * camera.scale,
  };
}

export function unproject(point: Point, camera: CameraPreset): Point {
  const dx = (point.x - camera.origin.x) / (COS_30 * camera.scale);
  const dy = (point.y - camera.origin.y) / camera.scale;
  return { x: dy + dx / 2, y: dy - dx / 2 };
}
