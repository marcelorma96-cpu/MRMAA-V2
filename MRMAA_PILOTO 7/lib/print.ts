import { currentAppLanguage } from "@/components/app-preferences";
import { translateMarkup } from "@/lib/translations";

/** Reserve a visible PDF viewer during the user's click, before any awaits. */
export function reserveQuotePrintWindow(title: string, loading: string): Window | null {
  let target: Window | null = null;
  try {
    target = window.open("", "_blank");
    if (!target) return null;
    target.opener = null;
    target.document.title = title;
    const message = target.document.createElement("p");
    message.textContent = loading;
    message.style.cssText = "font:16px system-ui;padding:24px;color:#18181b";
    target.document.body.appendChild(message);
    return target;
  } catch { target?.close(); return null; }
}

/** iPhone and iPad Safari do not reliably honor a delayed `download` click.
 * Opening a viewer during the original tap keeps the action authorized. */
export function needsNativePdfViewer(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  maxTouchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
) {
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

/** Open the PDF itself: A4/Letter selection can scale pages but cannot reflow
 * their rows, numbers or headers. The viewer owns the print dialog. */
export function openQuotePrintDocument(blob: Blob, target: Window | null) {
  if (blob.type !== "application/pdf" || !blob.size) throw new Error("No se pudo preparar el documento.");
  const url = URL.createObjectURL(blob);
  let opened = false;
  if (target && !target.closed) {
    try { target.location.replace(url); opened = true; }
    catch { target.close(); }
  }
  if (opened && target) {
    // Keep the PDF alive as long as its viewer. Do not revoke it on afterprint:
    // cancelling or printing again must leave a usable document.
    const timer = setInterval(() => {
      if (target.closed) { clearInterval(timer); URL.revokeObjectURL(url); }
    }, 5000);
  }
  // If popups were blocked, the caller shows a normal link and owns its URL.
  return { url, opened };
}

/** Fixed physical pages for schedules; never reflow this document as HTML. */
export async function printScheduleHtml(html: string, target: Window | null, download = false) {
  const { jsPDF } = await import("jspdf");
  const source = new DOMParser().parseFromString(translateMarkup(html, currentAppLanguage()), "text/html");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: "Horarios A4" });
  pdf.viewerPreferences({ PrintScaling: "AppDefault", PickTrayByPDFSize: true });
  const margin = 10, width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let first = true;
  for (const section of Array.from(source.querySelectorAll(".print-page"))) {
    const table = section.querySelector("table");
    if (!table) continue;
    const headers = Array.from(table.querySelectorAll("thead th")).map(cell => cell.textContent || "");
    if (headers.length < 2) continue;
    const widths = headers.map((_, index) => index === 0 ? 34 : (width - 34) / (headers.length - 1));
    const lineHeight = 3, padding = 1.5;
    const wrap = (text: string, index: number): string[] => pdf.splitTextToSize(text, widths[index] - padding * 2);
    const drawRow = (cells: string[][], y: number, header = false) => {
      const height = Math.max(...cells.map(lines => lines.length), 1) * lineHeight + padding * 2;
      let x = margin;
      cells.forEach((lines, index) => {
        pdf.setFillColor(header ? "#181818" : "#ffffff");
        pdf.setDrawColor("#a0a0a0");
        pdf.setLineWidth(0.15);
        pdf.rect(x, y, widths[index], height, "FD");
        pdf.setTextColor(header ? 255 : 24);
        if (lines.length) pdf.text(lines, x + padding, y + padding + 2.3, { lineHeightFactor: 1.215 });
        x += widths[index];
      });
      return y + height;
    };
    const newPage = () => {
      if (!first) pdf.addPage("a4", "landscape");
      first = false;
      pdf.setTextColor(24);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text(section.querySelector("h1")?.textContent || "Horarios", margin, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const subtitle: string[] = pdf.splitTextToSize(section.querySelector("p")?.textContent || "", width);
      pdf.text(subtitle, margin, 22);
      pdf.setFontSize(7);
      return drawRow(headers.map(wrap), 25 + subtitle.length * 4, true);
    };
    let y = newPage();
    for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
      const cells = Array.from(row.querySelectorAll("td")).map((cell, index) => {
        const parts = cell.children.length ? Array.from(cell.childNodes).map(node => node.textContent || "").join("\n") : cell.textContent || "";
        return wrap(parts, index);
      });
      if (cells.length !== widths.length) continue;
      let remaining = Math.max(...cells.map(lines => lines.length));
      const fullHeight = remaining * lineHeight + padding * 2;
      if (y + fullHeight > bottom && y > 45) y = newPage();
      while (remaining > 0) {
        const capacity = Math.floor((bottom - y - padding * 2) / lineHeight);
        if (capacity < 1) { y = newPage(); continue; }
        const count = Math.min(remaining, capacity);
        y = drawRow(cells.map(lines => lines.splice(0, count)), y);
        remaining -= count;
        if (remaining > 0) y = newPage();
      }
    }
  }
  if (first) throw new Error("No hay horarios para imprimir.");
  if (download) {
    pdf.save(`${currentAppLanguage() === "en" ? "Schedules" : "Horarios"}-A4.pdf`);
    return;
  }
  const blob = pdf.output("blob");
  const result = openQuotePrintDocument(blob, target);
  if (!result.opened) {
    pdf.save(`${currentAppLanguage() === "en" ? "Schedules" : "Horarios"}-A4.pdf`);
    URL.revokeObjectURL(result.url);
  }
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  // Give Chromium on Windows a real layout viewport. A 1px iframe can be
  // paginated before print CSS is ready, producing clipped tables.
  frame.style.left = "-10000px";
  frame.style.top = "0";
  frame.style.width = "1200px";
  frame.style.height = "800px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return frame.remove();
  const a4PrintDefaults = `<style id="mrmaa-a4-print-defaults">
    @page{size:A4 portrait;margin:10mm}
    *,*::before,*::after{box-sizing:border-box}
    html,body{width:auto!important;max-width:100%!important;margin:0!important;padding:0!important;background:#fff!important;color:#18181b}
    img,svg,canvas{max-width:100%!important;height:auto}
    table{width:100%!important;max-width:100%!important;border-collapse:collapse}
    thead{display:table-header-group}
    tr,img,section,article{break-inside:avoid;page-break-inside:avoid}
    @media print{
      html,body{overflow:visible!important}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    }
  </style>`;
  const translated = translateMarkup(html, currentAppLanguage());
  const printable = /<head(?:\s[^>]*)?>/i.test(translated)
    ? translated.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${a4PrintDefaults}`)
    : `<html><head>${a4PrintDefaults}</head><body>${translated}</body></html>`;
  doc.open();
  doc.write(printable);
  doc.close();
  const target = frame.contentWindow;
  const cleanup = () => { if (frame.isConnected) frame.remove(); };
  target?.addEventListener("afterprint", cleanup, { once: true });
  void (async () => {
    try { await doc.fonts?.ready; } catch {}
    window.setTimeout(() => {
      target?.focus();
      target?.print();
      // Windows can keep the native dialog open much longer than macOS. Keep
      // the source document alive until afterprint; this is only a safety net.
      window.setTimeout(cleanup, 120000);
    }, 300);
  })();
}
