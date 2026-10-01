import type { QuoteAdjustment, QuoteItem } from "./types";

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

export function calculateQuoteWithAdjustments(
  items: QuoteItem[],
  discountInput: unknown,
  tipInput: unknown,
  depositInput: unknown,
  adjustments: QuoteAdjustment[] = [],
) {
  const base = calculateQuote(items, discountInput, tipInput, 0);
  const adjustmentLines = adjustments.map((adjustment) => {
    const raw = numberValue(adjustment.value);
    const amount =
      adjustment.mode === "percent" ? (base.subtotal * raw) / 100 : raw;
    return { ...adjustment, value: raw, amount };
  });
  const adjustmentTotal = adjustmentLines.reduce(
    (sum, line) => sum + (line.kind === "discount" ? -line.amount : line.amount),
    0,
  );
  const total = Math.max(0, base.total + adjustmentTotal);
  const deposit = Math.min(numberValue(depositInput), total);
  return {
    ...base,
    total,
    deposit,
    balance: total - deposit,
    adjustmentLines,
    adjustmentTotal,
  };
}
