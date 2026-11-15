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

/** Use the same numeric column widths in the scaled preview and PDF capture. */
export function sizeQuoteColumns(paper: HTMLElement, owner: Document) {
  const rows = Array.from(paper.querySelectorAll<HTMLElement>(".previewTable > div"));
  const scale = paper.getBoundingClientRect().width / (paper.offsetWidth || 900) || 1;
  const widths = [2, 3, 4].map((column, index) => rows.reduce((width, row) => {
    const cell = row.children[column];
    if (!cell) return width;
    const range = owner.createRange(); range.selectNodeContents(cell);
    return Math.max(width, Math.ceil(range.getBoundingClientRect().width / scale) + 4);
  }, index === 0 ? 60 : 100));
  const template = `minmax(0,1fr) minmax(0,1.4fr) ${widths.map(width => `${width}px`).join(" ")}`;
  rows.forEach(row => { if (row.style.gridTemplateColumns !== template) row.style.gridTemplateColumns = template; });
}
