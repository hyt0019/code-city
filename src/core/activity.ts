import type { Building } from './model';
import { archivedColor } from './repository-signals';

/** Relative to the scanned commit, never the wall clock or filesystem mtime. */
export function activityBrightness(modifiedAt?: string, committedAt?: string): number | undefined {
  if (!modifiedAt || !committedAt) return undefined;
  const days = Math.max(0, (Date.parse(committedAt) - Date.parse(modifiedAt)) / 86_400_000);
  return Number.isFinite(days)
    ? Number((0.25 + 0.75 * Math.exp(-days / 90)).toFixed(4))
    : undefined;
}

export function windowColor(building: Building, color: string): string {
  color = archivedColor(color, building.archived);
  const brightness = (building.windowBrightness ?? 1) * (building.archived ? 0.55 : 1);
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(parseInt(color.slice(i, i + 2), 16) * brightness)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
