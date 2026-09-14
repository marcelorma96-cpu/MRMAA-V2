import { jsPDF } from "jspdf";

export type QuotePageImage = {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One PDF encoder for downloading and native PDF printing. */
export function createQuoteDocument(pages: readonly QuotePageImage[], title: string, print = false) {
  if (!pages.length) throw new Error("No se pudo preparar el documento.");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({ title });
  pages.forEach((page, index) => {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(page.image)
      || ![page.x, page.y, page.width, page.height].every(Number.isFinite)
      || page.x < 0 || page.y < 0 || page.width <= 0 || page.height <= 0
      || page.x + page.width > 210.01 || page.y + page.height > 297.01)
      throw new Error("No se pudo preparar el documento.");
    if (index) pdf.addPage();
    pdf.addImage(page.image, "PNG", page.x, page.y, page.width, page.height);
  });
  // A viewer may ignore this request; its native Print control remains usable.
  // Never invoke window.print() on an HTML copy of these already-paged images.
  if (print) pdf.autoPrint({ variant: "javascript" });
  return pdf;
}
