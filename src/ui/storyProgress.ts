/**
 * Story progress from the page's sections: 0 when the first section is centred in the
 * viewport, 1 when the last one is, and linear between neighbouring section centres. So
 * every section lands exactly on its director key, whatever the section heights are.
 */
export function storyProgress(centers: readonly number[], viewportCenter: number): number {
  const n = centers.length;
  if (n < 2) return 0;
  if (viewportCenter <= centers[0]!) return 0;
  if (viewportCenter >= centers[n - 1]!) return 1;
  for (let i = 0; i < n - 1; i++) {
    const a = centers[i]!;
    const b = centers[i + 1]!;
    if (viewportCenter <= b) return (i + (viewportCenter - a) / Math.max(1, b - a)) / (n - 1);
  }
  return 1;
}
