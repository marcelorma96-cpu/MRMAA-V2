import type { QuoteItem } from "./types";

export function numberValue(value: unknown) {
  const parsed =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function calculateQuote(
  items: QuoteItem[],
  discountInput: unknown,
  tipInput: unknown,
  depositInput: unknown,
) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + numberValue(item.quantity) * numberValue(item.unit_price),
    0,
  );
  const discountPct = Math.min(numberValue(discountInput), 100);
  const discount = (subtotal * discountPct) / 100;
  const afterDiscount = subtotal - discount;
  const tipPct = numberValue(tipInput);
  const tip = (afterDiscount * tipPct) / 100;
  const total = afterDiscount + tip;
  const deposit = Math.min(numberValue(depositInput), total);
  return {
    subtotal,
    discountPct,
    discount,
    afterDiscount,
    tipPct,
    tip,
    total,
    deposit,
    balance: total - deposit,
  };
}
