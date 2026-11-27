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
  const basis = settings.quote_deposit_suggestion_basis;
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
  const { [DEPOSIT_BASIS_FIELD]: _legacyBasis, ...rest } = fields;
  return {...rest, [DEPOSIT_RATE_FIELD]: String(terms.rate)};
}

// Older restaurants that hid deposits keep that choice until an explicit change.
export function showDepositDue(settings: Record<string,unknown>): boolean {
  return typeof settings.quote_show_deposit_due === "boolean" ? settings.quote_show_deposit_due : settings.quote_show_deposit_view !== false;
}

export function documentDepositDue(totals: {total:number; tip:number; deposit:number; balance:number}, settings: Record<string,unknown>, fields?: Record<string,unknown> | null) {
  // The customer is asked for a first deposit only, never for a top-up.
  if (totals.deposit > 0 || !showDepositDue(settings)) return 0;
  const cents = (n:number) => Math.round((n + Math.abs(n)*Number.EPSILON)*100);
  const target = cents(suggestedDeposit(totals, depositTerms(settings,fields)));
  return Math.max(0, Math.min(cents(totals.balance), target)) / 100;
}

/** Describe the portion still due without changing the agreed deposit or the balance. */
export function depositDueCaption(due:number,balance:number,terms:ReturnType<typeof depositTerms>,en:boolean):string[] {
  if(!(due>0&&balance>0))return [];
  const number=new Intl.NumberFormat(en?'en-US':'es-GT',{maximumFractionDigits:2});
  const ratio=100*due/balance;
  const share=ratio<0.01?'<' + number.format(0.01):number.format(ratio);
  const shareText=share+(en?'% of the outstanding balance':'% del saldo pendiente');
  const basis=terms.basis==='with_tip'?(en?'with tip':'con propina'):(en?'without tip':'sin propina');
  if(share===number.format(terms.rate))return [shareText+' · '+basis];
  return [shareText,(en?'Agreed deposit: ':'Anticipo pactado: ')+number.format(terms.rate)+'% '+basis];
}
