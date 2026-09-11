/** Return a contiguous slice boundary without cutting protected content. */
export function quotePageEnd(
  top: number,
  pageHeight: number,
  totalHeight: number,
  ranges: readonly { top: number; bottom: number }[],
): number {
  let bottom = Math.min(top + pageHeight, totalHeight);
  if (bottom === totalHeight) return bottom;
  let previous: number;
  do {
    previous = bottom;
    for (const range of ranges) {
      if (range.top < bottom && range.bottom > bottom && range.top > top)
        bottom = Math.min(bottom, range.top);
    }
  } while (bottom < previous);
  return bottom;
}
