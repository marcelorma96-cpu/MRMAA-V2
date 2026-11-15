// Internal quote preferences. Customer document fields are rendered from configured field IDs only.
export const DEPOSIT_RATE_FIELD = "_unomesa_deposit_rate";
export const DEPOSIT_BASIS_FIELD = "_unomesa_deposit_basis";
export const DEFAULT_DEPOSIT_RATE = 40;
export type DepositBasis = "without_tip" | "with_tip";

export function validDepositRate(value: unknown): boolean {
  if (typeof value !== "number" && typeof value !== "string") return false;
  const text = String(value).trim();
  return /^\d+(?:\.\d{1,2})?$/.test(text) && Number(text) <= 100;
}

export function depositTerms(settings: Record<string, unknown>, fields?: Record<string, unknown> | null) {
  const rate = fields?.[DEPOSIT_RATE_FIELD], defaultRate = settings.quote_deposit_suggestion_pct;
  const basis = fields?.[DEPOSIT_BASIS_FIELD] ?? settings.quote_deposit_suggestion_basis;
  return {
    rate: validDepositRate(rate) ? Number(rate) : validDepositRate(defaultRate) ? Number(defaultRate) : DEFAULT_DEPOSIT_RATE,
    basis: (basis === "with_tip" ? "with_tip" : "without_tip") as DepositBasis,
  };
}

export function suggestedDeposit(totals: {total: number; tip: number}, terms: ReturnType<typeof depositTerms>) {
  // Use the final adjusted quote *before* payments; existing payments must not lower the target.
  const base = Math.max(0, totals.total - (terms.basis === "without_tip" ? totals.tip : 0));
  const cents = Math.round((base + Math.abs(base) * Number.EPSILON) * 100);
  const basisPoints = Math.round(terms.rate * 100);
  return Math.round(cents * basisPoints / 10000) / 100;
}

export function quoteDepositFields(fields: Record<string,string>, terms: ReturnType<typeof depositTerms>) {
  return {...fields, [DEPOSIT_RATE_FIELD]: String(terms.rate), [DEPOSIT_BASIS_FIELD]: terms.basis};
}
