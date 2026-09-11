import { quotePageEnd } from "./pdf-pagination";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Quote } from "./types";
import { calculateQuote } from "./calculations";
import { appCurrency, formatAppMoney } from "@/components/app-preferences";
import { translate } from "@/lib/translations";
import { currentAppLanguage } from "@/components/app-preferences";

const money = (n: number, currency: string) =>
  formatAppMoney(n, appCurrency(currency));

export async function downloadQuotePreviewPdf(
  element: HTMLElement,
  quoteNumber: number,
) {
  await document.fonts.ready;
  let protectedRanges: { top: number; bottom: number }[] = [];
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    onclone: (_document, paper) => {
      // Measure the same unscrolled layout that html2canvas will capture.
      paper.style.height = "auto";
      paper.style.maxHeight = "none";
      paper.style.overflow = "visible";
      paper.querySelectorAll<HTMLElement>('[data-html2canvas-ignore]').forEach(node => node.style.display = "none");
      const origin = paper.getBoundingClientRect();
      const pageHeight = origin.width * 281 / 194;
      const protect = (rect: DOMRect) => {
        if (rect.height > 0 && rect.height <= pageHeight - 4)
          protectedRanges.push({ top: rect.top - origin.top - 1, bottom: rect.bottom - origin.top + 1 });
      };
      paper.querySelectorAll("header, .quoteInfo, .previewTable > div, .previewTotals, .note, img")
        .forEach(node => protect(node.getBoundingClientRect()));
      // Oversized rows/notes may span pages, but never split a line of text.
      const walker = _document.createTreeWalker(paper, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const range = _document.createRange();
        range.selectNodeContents(node);
        Array.from(range.getClientRects()).forEach(protect);
      }
    },
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 8,
    pageWidth = 194,
    pageHeight = 281,
    imageHeight = (canvas.height * pageWidth) / canvas.width;
  if (imageHeight <= pageHeight * 1.18) {
    const fittedWidth = Math.min(
        pageWidth,
        (canvas.width * pageHeight) / canvas.height,
      ),
      fittedHeight = (canvas.height * fittedWidth) / canvas.width,
      x = (210 - fittedWidth) / 2;
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      x,
      margin,
      fittedWidth,
      fittedHeight,
    );
  } else {
    const sourcePageHeight = Math.floor(canvas.width * pageHeight / pageWidth);
    const scale = 2; // html2canvas scale; do not derive it from a scroll container.
    const ranges = protectedRanges.map(range => ({
      top: Math.max(0, Math.floor(range.top * scale)),
      bottom: Math.ceil(range.bottom * scale),
    }));
    let top = 0, page = 0;
    while (top < canvas.height) {
      const bottom = quotePageEnd(top, sourcePageHeight, canvas.height, ranges);
      const sliceHeight = Math.max(1, bottom - top),
        pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageCanvas
        .getContext("2d")
        ?.drawImage(
          canvas,
          0,
          top,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );
      if (page > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        margin,
        margin,
        pageWidth,
        (sliceHeight * pageWidth) / canvas.width,
      );
      top = bottom;
      page++;
    }
  }
  pdf.save(`${currentAppLanguage() === "en" ? "Quote" : "Cotizacion"}-${quoteNumber}.pdf`);
}

export function downloadQuotePdf(
  quote: Quote,
  restaurantName: string,
  currency: string,
  settings: Record<string, any> = {},
) {
  const t = (value: string) => translate(value, currentAppLanguage());
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const totals = calculateQuote(
    quote.items,
    quote.discount_pct,
    quote.tip_pct,
    quote.deposit,
  );
  const orange = hexColor(settings.quote_accent || "#ea580c"),
    dark = hexColor(settings.quote_color || "#18181b"),
    font = pdfFont(settings.quote_font);
  pdf.setFillColor(...dark);
  pdf.rect(0, 0, 210, 38, "F");
  pdf.setFillColor(...orange);
  pdf.rect(0, 0, 5, 297, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont(font, "bold");
  pdf.setFontSize(20);
  if (settings.logo_data_url) {
    try {
      pdf.addImage(settings.logo_data_url, "AUTO", 14, 6, 24, 24);
    } catch {}
  }
  pdf.text(restaurantName || "MRMAA", settings.logo_data_url ? 43 : 14, 17);
  pdf.setFontSize(10);
  pdf.text(t("COTIZACIÓN"), 14, 27);
  pdf.setFontSize(18);
  pdf.text(`#${quote.quote_number}`, 190, 20, { align: "right" });
  pdf.setTextColor(24, 24, 27);
  pdf.setFillColor(248, 248, 248);
  pdf.roundedRect(12, 46, 186, 37, 3, 3, "F");
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(t("CLIENTE"), 17, 55);
  pdf.text(t("FECHA"), 110, 55);
  pdf.text(t("HORA"), 157, 55);
  pdf.setFontSize(11);
  pdf.setTextColor(24);
  pdf.text(quote.client_name || t("Sin cliente"), 17, 63);
  pdf.text(quote.event_date || "—", 110, 63);
  pdf.text(quote.event_time || "—", 157, 63);
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(t("ÁREA"), 17, 71);
  pdf.text(t("INVITADOS"), 110, 71);
  pdf.text(t("TELÉFONO"), 157, 71);
  pdf.setFontSize(10);
  pdf.setTextColor(24);
  pdf.text(quote.area || "—", 17, 78);
  pdf.text(String(quote.guests || 0), 110, 78);
  pdf.text(quote.client_phone || "—", 157, 78);
  let y = 94;
  pdf.setFillColor(...dark);
  pdf.rect(12, y, 186, 10, "F");
  pdf.setTextColor(255);
  pdf.setFontSize(8);
  pdf.text(t("PRODUCTO / SERVICIO"), 16, y + 6.5);
  pdf.text(t("CANT."), 133, y + 6.5, { align: "right" });
  pdf.text(t("PRECIO"), 163, y + 6.5, { align: "right" });
  pdf.text(t("TOTAL"), 193, y + 6.5, { align: "right" });
  y += 10;
  for (const item of quote.items) {
    const lines = pdf.splitTextToSize(
      `${item.name}${item.description ? ` — ${item.description}` : ""}`,
      105,
    );
    const h = Math.max(11, lines.length * 5 + 4);
    if (y + h > 235) {
      pdf.addPage();
      y = 18;
    }
    pdf.setTextColor(35);
    pdf.setFontSize(9);
    pdf.text(lines, 16, y + 6);
    pdf.text(String(item.quantity), 133, y + 6, { align: "right" });
    pdf.text(money(item.unit_price, currency), 163, y + 6, { align: "right" });
    pdf.text(money(item.quantity * item.unit_price, currency), 193, y + 6, {
      align: "right",
    });
    pdf.setDrawColor(225);
    pdf.line(12, y + h, 198, y + h);
    y += h;
  }
  y += 8;
  const labelX = 132,
    valueX = 193;
  pdf.setTextColor(70);
  pdf.text(t("Subtotal"), labelX, y);
  pdf.text(money(totals.subtotal, currency), valueX, y, { align: "right" });
  y += 7;
  if (totals.discount > 0) {
    pdf.text(`${t("Descuento")} (${totals.discountPct}%)`, labelX, y);
    pdf.text(`- ${money(totals.discount, currency)}`, valueX, y, {
      align: "right",
    });
    y += 7;
  }
  if (totals.tip > 0) {
    pdf.text(`${t("Propina")} (${totals.tipPct}%)`, labelX, y);
    pdf.text(money(totals.tip, currency), valueX, y, { align: "right" });
    y += 7;
  }
  pdf.text(t("Anticipo"), labelX, y);
  pdf.text(`- ${money(totals.deposit, currency)}`, valueX, y, {
    align: "right",
  });
  y += 9;
  pdf.setFont(font, "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...orange);
  pdf.text(t("SALDO PENDIENTE"), labelX, y);
  pdf.text(money(totals.balance, currency), valueX, y, { align: "right" });
  if (quote.customer_note) {
    y += 14;
    pdf.setFillColor(255, 247, 237);
    pdf.roundedRect(
      12,
      y - 6,
      186,
      Math.min(
        42,
        12 + pdf.splitTextToSize(quote.customer_note, 174).length * 5,
      ),
      3,
      3,
      "F",
    );
    pdf.setTextColor(...orange);
    pdf.setFontSize(9);
    pdf.text(t("NOTA PARA EL CLIENTE"), 17, y);
    pdf.setFont(font, "normal");
    pdf.setTextColor(55);
    pdf.text(pdf.splitTextToSize(quote.customer_note, 174), 17, y + 7);
  }
  pdf.save(`${currentAppLanguage() === "en" ? "Quote" : "Cotizacion"}-${quote.quote_number}.pdf`);
}

function hexColor(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return [24, 24, 27];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function pdfFont(font: string) {
  if (/times|georgia/i.test(font || "")) return "times";
  if (/courier/i.test(font || "")) return "courier";
  return "helvetica";
}
