import { calculateQuoteWithAdjustments, numberValue } from "./calculations";
import { localDateISO } from "./local-date";
import type { Quote, QuoteAdjustment, QuoteCustomField } from "./types";

/** Local sample only. Never reserves a number or writes a quote/customer. */
export function buildSettingsQuotePreview(form: any, products: { name: string; description?: string; price: number; active?: boolean }[], language: string): Quote {
  const en = language === "en", settings = form.settings || {}, day = localDateISO();
  const items = products.filter(product => product.active !== false).slice(0, 2).map(product => ({
    name: product.name, description: product.description || "", quantity: 10, unit_price: numberValue(product.price),
  }));
  if (!items.length) items.push({ name: en ? "Sample menu" : "Menú de ejemplo",
    description: en ? "Main course\nSide dish and beverage" : "Plato principal\nAcompañamiento y bebida", quantity: 10, unit_price: 100 });
  const adjustments: QuoteAdjustment[] = (settings.quote_custom_adjustments || [])
    .filter((row: any) => row.active !== false).map((row: any) => ({
      id: row.id, label: row.label, kind: row.kind, mode: row.mode, value: numberValue(row.default_value),
    }));
  const discount = settings.discounts === false ? 0 : 5, tip = settings.tips === false ? 0 : 10;
  const totals = calculateQuoteWithAdjustments(items, discount, tip, 50, adjustments);
  const customFields = Object.fromEntries((settings.quote_custom_client_fields || [])
    .filter((row: QuoteCustomField) => row.active !== false)
    .map((row: QuoteCustomField) => [row.id, row.type === "date" ? day : row.type === "number" ? "10" : en ? "Sample value" : "Valor de ejemplo"]));
  return {
    id: "settings-preview", restaurant_id: "", client_id: null,
    quote_number: Math.trunc(numberValue(form.quote_number_start)) || 2000,
    client_name: en ? "Sample customer" : "Cliente de ejemplo", client_phone: "0000-0000", client_email: "cliente@example.com",
    event_date: day, event_time: "13:00", area: en ? "Table 1" : "Mesa 1", guests: 10,
    discount_pct: discount, tip_pct: tip, subtotal: totals.subtotal, total: totals.total,
    deposit: totals.deposit, payment_method: en ? "Cash" : "Efectivo", balance: totals.balance,
    customer_note: settings.fixed_customer_note ? settings.customer_note || "" : en ? "Thank you for choosing our restaurant." : "Gracias por elegir nuestro restaurante.",
    internal_notes: "", custom_fields: customFields, adjustments, status: "pendiente", items,
  };
}
