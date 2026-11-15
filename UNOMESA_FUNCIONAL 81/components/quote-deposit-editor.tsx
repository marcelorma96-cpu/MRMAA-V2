"use client";
import { useEffect, useRef, useState } from "react";
import { depositTerms, suggestedDeposit, DEPOSIT_RATE_FIELD, type DepositBasis } from "../lib/quote-deposit";

const methods = [
  ["", "Sin especificar", "Unspecified"], ["efectivo", "Efectivo", "Cash"],
  ["tarjeta", "Tarjeta", "Card"], ["transferencia", "Transferencia", "Bank transfer"],
  ["deposito", "Depósito bancario", "Bank deposit"], ["otro", "Otro", "Other"],
];

type Props = {
  en: boolean; settings: Record<string,unknown>; fields: Record<string,string>;
  totals: {total: number; tip: number}; amount: number | string; method: string;
  focusAction?: boolean; money: (n:number)=>string;
  onRate: (v:string)=>void; onBasis: (v:DepositBasis)=>void;
  onPayment: (amount:number|string,method:string)=>void;
};

export function QuoteDepositEditor({en, settings, fields, totals, amount, method, money, onRate, onBasis, onPayment, focusAction}: Props) {
  const terms = depositTerms(settings, fields), suggested = suggestedDeposit(totals, terms);
  const [original, setOriginal] = useState<{amount: number|string; method:string} | null>(null);
  const action = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const paid = Number(amount) > 0;
  useEffect(() => { if (focusAction) action.current?.focus(); }, [focusAction]);
  useEffect(() => { if (original) input.current?.focus(); }, [original]);
  function start() {
    setOriginal({amount,method});
    // Only an explicit payment action changes the draft, and only Save writes it.
    if (!paid) onPayment(suggested || "", method);
  }
  return <section className="quoteDepositEditor" translate="no" aria-label={en?"Quote deposit":"Anticipo de la cotización"}>
    <div className="quoteDepositHeading"><strong>{en?"Suggested deposit":"Anticipo sugerido"}</strong><small>{en?"Internal only":"Solo interno"}</small></div>
    <div className="quoteDepositTerms">
      <span className="quoteDepositRate"><input type="number" min="0" max="100" step="0.01" inputMode="decimal"
        aria-label={en?"Suggested deposit percentage":"Porcentaje de anticipo sugerido"}
        value={fields[DEPOSIT_RATE_FIELD] ?? terms.rate} placeholder={String(depositTerms(settings).rate)} onChange={e=>onRate(e.target.value)}/>%</span>
      <select aria-label={en?"Tip in deposit calculation":"Propina para calcular el anticipo"} value={terms.basis} onChange={e=>onBasis(e.target.value as DepositBasis)}>
        <option value="without_tip">{en?"Without tip":"Sin propina"}</option><option value="with_tip">{en?"With tip":"Con propina"}</option>
      </select>
      <strong className="quoteDepositAmount" aria-live="polite">{money(suggested)}</strong>
    </div>
    {!original ? <div className="quoteDepositActions">
      {paid && <span>{en?"Received":"Recibido"}: <b>{money(Number(amount))}</b>{method && " · "+(methods.find(m=>m[0]===method)?.[en?2:1] || method)}</span>}
      <button type="button" ref={action} className="quoteDepositLink" onClick={start}>
        {paid ? (en?"Edit deposit":"Editar anticipo") : (en?"+ Add deposit":"+ Agregar anticipo")}
      </button>
    </div> : <div className="quoteDepositPayment">
      <label>{en?"Amount received":"Importe recibido"}
        <input ref={input} type="number" min="0" max={Number(totals.total.toFixed(2))} step="0.01" inputMode="decimal" required
          value={amount} onChange={e=>onPayment(e.target.value, method)}/>
      </label>
      <label>{en?"Payment method":"Método de pago"}
        <select value={method} onChange={e=>onPayment(amount, e.target.value)}>
          {method && !methods.some(m=>m[0]===method) && <option value={method}>{method}</option>}
          {methods.map(m=><option key={m[0]} value={m[0]}>{m[en?2:1]}</option>)}
        </select>
      </label>
      <div className="quoteDepositActions"><small>{en?"Confirm the amount with Save.":"Confirme el importe con Guardar."}</small>
        <button type="button" className="quoteDepositLink" onClick={()=>{onPayment(original.amount,original.method);setOriginal(null);requestAnimationFrame(()=>action.current?.focus());}}>{en?"Cancel":"Cancelar"}</button>
      </div>
    </div>}
  </section>;
}
