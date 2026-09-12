/** Shared row edges must become the same source pixel. Outward rounding of
 * each row independently creates overlaps that cascade back through a table. */
export function quoteSourceRanges(ranges: readonly { top: number; bottom: number }[], scale: number) {
  return ranges.map(range => ({
    top: Math.max(0, Math.round(range.top * scale)),
    bottom: Math.max(0, Math.round(range.bottom * scale)),
  }));
}
/** Return a contiguous slice boundary without cutting protected content. */
export function quotePageEnd(
  top: number,
  pageHeight: number,
  totalHeight: number,
  ranges: readonly { top: number; bottom: number }[],
): number {
  const target = Math.min(top + pageHeight, totalHeight);
  if (target === totalHeight) return target;

  let bottom = target;
  let previous: number;
  do {
    previous = bottom;
    const crossing = ranges.filter(
      (range) => range.top < bottom && range.bottom > bottom && range.top > top,
    );
    if (crossing.length)
      bottom = Math.min(...crossing.map((range) => range.top));
  } while (bottom < previous);
  return bottom;
}
