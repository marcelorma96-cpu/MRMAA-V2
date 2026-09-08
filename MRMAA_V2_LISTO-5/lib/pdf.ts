import { jsPDF } from "jspdf";
import type { Quote } from "./types";
import { calculateQuote } from "./calculations";

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency }).format(n);

export function downloadQuotePdf(
  quote: Quote,
  restaurantName: string,
  currency: string,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const totals = calculateQuote(
    quote.items,
    quote.discount_pct,
    quote.tip_pct,
    quote.deposit,
  );
  const orange = [234, 88, 12] as const,
    dark = [24, 24, 27] as const;
  pdf.setFillColor(...dark);
  pdf.rect(0, 0, 210, 38, "F");
  pdf.setFillColor(...orange);
  pdf.rect(0, 0, 5, 297, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(restaurantName || "MRMAA", 14, 17);
  pdf.setFontSize(10);
  pdf.text("COTIZACIÓN", 14, 27);
  pdf.setFontSize(18);
  pdf.text(`#${quote.quote_number}`, 190, 20, { align: "right" });
  pdf.setTextColor(24, 24, 27);
  pdf.setFillColor(248, 248, 248);
  pdf.roundedRect(12, 46, 186, 37, 3, 3, "F");
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text("CLIENTE", 17, 55);
  pdf.text("FECHA", 110, 55);
  pdf.text("HORA", 157, 55);
  pdf.setFontSize(11);
  pdf.setTextColor(24);
  pdf.text(quote.client_name || "Sin cliente", 17, 63);
  pdf.text(quote.event_date || "—", 110, 63);
  pdf.text(quote.event_time || "—", 157, 63);
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text("ÁREA", 17, 71);
  pdf.text("INVITADOS", 110, 71);
  pdf.text("TELÉFONO", 157, 71);
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
  pdf.text("PRODUCTO / SERVICIO", 16, y + 6.5);
  pdf.text("CANT.", 133, y + 6.5, { align: "right" });
  pdf.text("PRECIO", 163, y + 6.5, { align: "right" });
  pdf.text("TOTAL", 193, y + 6.5, { align: "right" });
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
  pdf.text("Subtotal", labelX, y);
  pdf.text(money(totals.subtotal, currency), valueX, y, { align: "right" });
  y += 7;
  if (totals.discount > 0) {
    pdf.text(`Descuento (${totals.discountPct}%)`, labelX, y);
    pdf.text(`- ${money(totals.discount, currency)}`, valueX, y, {
      align: "right",
    });
    y += 7;
  }
  if (totals.tip > 0) {
    pdf.text(`Propina (${totals.tipPct}%)`, labelX, y);
    pdf.text(money(totals.tip, currency), valueX, y, { align: "right" });
    y += 7;
  }
  pdf.text("Anticipo", labelX, y);
  pdf.text(`- ${money(totals.deposit, currency)}`, valueX, y, {
    align: "right",
  });
  y += 9;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...orange);
  pdf.text("SALDO PENDIENTE", labelX, y);
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
    pdf.text("NOTA PARA EL CLIENTE", 17, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(55);
    pdf.text(pdf.splitTextToSize(quote.customer_note, 174), 17, y + 7);
  }
  pdf.save(`Cotizacion-${quote.quote_number}.pdf`);
}
