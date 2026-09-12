import { currentAppLanguage } from "@/components/app-preferences";
import { translateMarkup } from "@/lib/translations";

export type QuotePageImage = {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function quotePrintHtml(pages: readonly QuotePageImage[], title: string) {
  if (!pages.length) throw new Error("No se pudo preparar el documento.");
  const safeTitle = title.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
  const sheets = pages.map(page => {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(page.image)
      || ![page.x,page.y,page.width,page.height].every(Number.isFinite)
      || page.x < 0 || page.y < 0 || page.width <= 0 || page.height <= 0
      || page.x + page.width > 210.01 || page.y + page.height > 297.01)
      throw new Error("No se pudo preparar el documento.");
    return `<section class="quotePrintPage"><img alt="" src="${page.image}" style="left:${page.x}mm;top:${page.y}mm;width:${page.width}mm;height:${page.height}mm"></section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    @page{size:A4 portrait;margin:0}
    html,body{margin:0;padding:0;background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .quotePrintPage{position:relative;width:210mm;height:297mm;margin:0;padding:0;box-sizing:border-box;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}
    .quotePrintPage:last-child{break-after:auto;page-break-after:auto}
    .quotePrintPage img{display:block;position:absolute;max-width:none;margin:0;padding:0}
  </style></head><body>${sheets}</body></html>`;
}

export async function printQuotePages(pages: readonly QuotePageImage[], title: string) {
  const html = quotePrintHtml(pages, title);
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "297mm", border: "0", pointerEvents: "none" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument, printWindow = frame.contentWindow;
  if (!doc || !printWindow) { frame.remove(); throw new Error("No se pudo preparar el documento."); }
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    clearTimeout(cleanupTimer);
    frame.remove();
  };
  try {
    doc.open();
    // This already contains the translated PDF pixels. Do not translate or
    // reflow customer names, descriptions, totals or images during printing.
    doc.write(html);
    doc.close();
    await Promise.all(Array.from(doc.images, async image => {
      if (image.decode) await image.decode();
      else if (!image.complete) await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("No se pudo preparar el documento."));
      });
      if (!image.naturalWidth) throw new Error("No se pudo preparar el documento.");
    }));
    printWindow.addEventListener("afterprint", cleanup, { once: true });
    // Retain the document through the print dialog, including cancellation.
    // A long fallback only handles browsers that never emit afterprint.
    cleanupTimer = setTimeout(cleanup, 10 * 60 * 1000);
    printWindow.focus();
    printWindow.print();
  } catch (error) { cleanup(); throw error; }
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return frame.remove();
  doc.open();
  doc.write(translateMarkup(html, currentAppLanguage()));
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  }, 150);
}
