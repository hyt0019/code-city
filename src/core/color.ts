/** Linear sRGB-space mix of two #rrggbb colors; deterministic for snapshot-stable output. */
export function mix(color: string, target: string, amount: number): string {
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(color.slice(i, i + 2), 16) * (1 - amount) +
          parseInt(target.slice(i, i + 2), 16) * amount,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Multiply every channel, clamped to the valid range. */
export function shade(hex: string, amount: number): string {
  const rgb = [1, 3, 5].map((index) =>
    Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(index, index + 2), 16) * amount))),
  );
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
