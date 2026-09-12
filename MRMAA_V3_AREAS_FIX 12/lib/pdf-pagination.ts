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
