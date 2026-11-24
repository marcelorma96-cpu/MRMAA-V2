"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { depositTerms, showDepositDue, suggestedDeposit, DEPOSIT_RATE_FIELD, type DepositBasis } from "../lib/quote-deposit";

const methods = [
  ["", "Sin especificar", "Unspecified"], ["efectivo", "Efectivo", "Cash"],
  ["tarjeta", "Tarjeta", "Card"], ["transferencia", "Transferencia", "Bank transfer"],
  ["deposito", "Depósito bancario", "Bank deposit"], ["otro", "Otro", "Other"],
];

type Payment = { amount: number|string; method: string };
type Props = Payment & {
  en: boolean; settings: Record<string,unknown>; fields: Record<string,string>;
  totals: {total: number; tip: number}; focusAction?: boolean; money: (n:number)=>string;
  onRate: (v:string)=>void; onBasis: (v:DepositBasis)=>void;
  onShowDue: (v:boolean)=>void; canSetDefaults: boolean; savingDefault: boolean; preferenceError: string;
  onPayment: (amount:number|string,method:string)=>void;
};

export function QuoteDepositEditor({en, settings, fields, totals, amount, method, money, onRate, onBasis, onShowDue, canSetDefaults, savingDefault, preferenceError, onPayment, focusAction}: Props) {
  const terms = depositTerms(settings, fields), suggested = suggestedDeposit(totals, terms);
  const [original, setOriginal] = useState<Payment | null>(null);
  const [removed, setRemoved] = useState<{payment: Payment; original: Payment|null} | null>(null);
  const action = useRef<HTMLButtonElement>(null), undo = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const paid = Number(amount) > 0;
  const label = (es:string, english:string)=>en ? english : es;
  const focusActionNext = () => requestAnimationFrame(()=>action.current?.focus({preventScroll:true}));
  useEffect(() => {
    const target=action.current, panel=target?.closest<HTMLElement>('.eventEditorLayer .modal');
    if (!focusAction || !target) return;
    target.focus({preventScroll:true});
    if(panel){
      const rect=target.getBoundingClientRect(), bounds=panel.getBoundingClientRect();
      if(rect.bottom>bounds.bottom||rect.top<bounds.top+64)panel.scrollTop+=rect.top-bounds.top-panel.clientHeight/2;
    }
  }, [focusAction]);
  useEffect(() => { if (original) input.current?.focus({preventScroll:true}); }, [original]);
  useEffect(() => { if (removed) undo.current?.focus({preventScroll:true}); }, [removed]);

  function start() {
    setRemoved(null);
    setOriginal({amount,method});
    if (!paid) onPayment(suggested || "", "");
  }
  function cancel() {
    if (!original) return;
    onPayment(original.amount, original.method);
    setOriginal(null);
    focusActionNext();
  }
  function remove() {
    // As with edits, removing only changes the draft until the quote is saved.
    setRemoved({payment: {amount, method}, original});
    setOriginal(null);
    onPayment(0, "");
  }
  function restore() {
    if (!removed) return;
    onPayment(removed.payment.amount, removed.payment.method);
    setOriginal(removed.original);
    setRemoved(null);
    if (!removed.original) focusActionNext();
  }

  const addOrEdit = <button type="button" ref={action} className={'qdAction '+(paid?'qdEdit':'qdAdd')} onClick={start}
    aria-label={paid?label("Editar anticipo","Edit deposit"):label("Agregar anticipo","Add deposit")}>
    {paid?<Pencil/>:<Plus/>}{paid?label("Editar","Edit"):label("Agregar anticipo","Add deposit")}
  </button>;
  const removeButton = <button type="button" className="qdAction qdRemove" onClick={remove}
    aria-label={label("Quitar anticipo","Remove deposit")}><Trash2/>{label("Quitar anticipo","Remove deposit")}</button>;

  return <section className="quoteDepositEditor" translate="no" aria-label={label("Anticipo de la cotización","Quote deposit")}>
    <div className="qdHeader">
      <div className="qdTitle"><span className="qdPrivate">{label("Anticipos","Deposits")}</span>
        <strong>{label("Anticipo sugerido","Suggested deposit")}</strong></div>
      <strong className="qdAmount" aria-live="polite">{money(suggested)}</strong>
    </div>
    <div className="qdTools">
      <div className="qdTerms">
        <label className="qdRate"><input type="number" min="0" max="100" step="0.01" inputMode="decimal"
          aria-label={label("Porcentaje de anticipo sugerido","Suggested deposit percentage")}
          value={fields[DEPOSIT_RATE_FIELD] ?? terms.rate} placeholder={String(depositTerms(settings).rate)} onChange={e=>onRate(e.target.value)}/><span aria-hidden="true">%</span></label>
        <button className="qdBasis" type="button" role="switch" aria-label={label("Incluir propina en el anticipo","Include tip in deposit")}
          disabled={!canSetDefaults || savingDefault} aria-describedby="qd-defaults-hint" aria-checked={terms.basis === "with_tip"} onClick={()=>onBasis(terms.basis === "with_tip" ? "without_tip" : "with_tip")}>
          <span className="qdSwitch" aria-hidden="true"><i/></span>{label("Incluir propina","Include tip")}
        </button>
        <button className="qdBasis" type="button" role="switch" aria-label={label("Mostrar anticipo a pagar en PDF e impresión","Show deposit due in PDF and print")}
          disabled={!canSetDefaults || savingDefault} aria-describedby="qd-defaults-hint" aria-checked={showDepositDue(settings)} onClick={()=>onShowDue(!showDepositDue(settings))}>
          <span className="qdSwitch" aria-hidden="true"><i/></span>{label("Mostrar en PDF e impresión","Show in PDF & print")}
        </button>
      </div>
      {!original && !paid && addOrEdit}
    </div>
    <small id="qd-defaults-hint" className="qdHint">{canSetDefaults
      ?label("Ambos interruptores se guardan para todas las cotizaciones.","Both switches are saved for all quotes.")
      :label("Estos ajustes los administra el restaurante.","These settings are managed by the restaurant.")}</small>
    {preferenceError && <small role="alert" className="qdError">{preferenceError}</small>}
    {removed && <div className="qdStatus">
      <span role="status">{label("Anticipo quitado · Por guardar","Deposit removed · Save to apply")}</span>
      <button ref={undo} type="button" className="qdAction" onClick={restore}><Undo2/>{label("Deshacer","Undo")}</button>
    </div>}
    {!original && paid && <div className="qdStatus">
      <div className="qdReceived"><Check/><span>{label("Recibido","Received")} <b>{money(Number(amount))}</b>
        {method && <small>{methods.find(m=>m[0]===method)?.[en?2:1] || method}</small>}</span></div>
      <div className="qdActions">{addOrEdit}{removeButton}</div>
    </div>}
    {original && <div className="qdEntry">
      <div className="qdEntryFields">
        <label>{label("Importe recibido","Amount received")}<input ref={input} type="number" min="0" max={Number(totals.total.toFixed(2))} step="0.01" inputMode="decimal"
          placeholder="0.00" value={amount} onChange={e=>onPayment(e.target.value,method)} /></label>
        <label>{label("Método de pago","Payment method")}<span className="qdSelect">
          <select value={method} onChange={e=>onPayment(amount,e.target.value)}>
            {method && !methods.some(m=>m[0]===method) && <option value={method}>{method}</option>}
            {methods.map(m=><option key={m[0]} value={m[0]}>{m[en?2:1]}</option>)}
          </select><ChevronDown aria-hidden="true"/></span></label>
      </div>
      <div className="qdEntryActions">{removeButton}<button type="button" className="qdAction qdCancel" onClick={cancel}>{label("Cancelar edición","Cancel edit")}</button></div>
    </div>}
  </section>;
}
