"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, FileText, MapPin, RotateCcw, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useAppPreferences, type AppCurrency } from "@/components/app-preferences";
import { calculateQuote, numberValue } from "@/lib/calculations";
import { trackDemoEvent, type DemoFlow } from "@/lib/demo-analytics";
import styles from "./public-demo.module.css";

type Draft = {
  client: string; area: string; date: string; time: string; guests: string;
  menu: string; price: string; discount: string; tip: string; deposit: string;
};

function sample(currency: AppCurrency): Draft {
  const date = new Date(); date.setDate(date.getDate() + 7);
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return {
    client: "Ana López", area: "terrace", date: localDate, time: "19:00", guests: "24",
    menu: "celebration", price: currency === "GTQ" ? "175" : currency === "MXN" ? "450" : "25",
    discount: "0", tip: "10", deposit: currency === "GTQ" ? "1000" : currency === "MXN" ? "2500" : "100",
  };
}

/** Local React state only: no account, database, storage, email or payment calls. */
export default function PublicDemo({ onClose, onStartTrial, signupEnabled }: {
  onClose: () => void; onStartTrial: () => void; signupEnabled: boolean;
}) {
  const { language, currency: preferredCurrency } = useAppPreferences();
  const en = language === "en", copy = (es: string, english: string) => en ? english : es;
  const dialog = useRef<HTMLDialogElement>(null), opened = useRef(false);
  const [currency, setCurrency] = useState<AppCurrency>(preferredCurrency);
  const [draft, setDraft] = useState<Draft>(() => sample(preferredCurrency));
  const [flow, setFlow] = useState<DemoFlow>("quote");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const money = (value: number) => new Intl.NumberFormat(en ? "en-US" : "es-GT", {
    style: "currency", currency, currencyDisplay: "symbol", minimumFractionDigits: 2,
  }).format(value);
  const menu = draft.menu === "celebration" ? copy("Menú de celebración", "Celebration menu") : copy("Menú corporativo", "Corporate menu");
  const area = draft.area === "terrace" ? copy("Terraza", "Terrace") : copy("Salón principal", "Main dining room");
  const totals = calculateQuote([{ name: menu, description: "", quantity: numberValue(draft.guests), unit_price: numberValue(draft.price) }], draft.discount, draft.tip, draft.deposit);
  const dateLabel = draft.date ? new Intl.DateTimeFormat(en ? "en-US" : "es-GT", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${draft.date}T12:00:00`)) : "—";
  const update = (field: keyof Draft, value: string) => setDraft(current => ({ ...current, [field]: value }));

  useEffect(() => {
    const node = dialog.current, previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    if (!opened.current) { opened.current = true; trackDemoEvent("Demo_abierta", "quote"); }
    return () => {
      node?.close(); document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (step > 1) { heading.current?.focus(); dialog.current?.scrollTo({ top: 0 }); }
  }, [step]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (flow === "direct") {
      setStep(3); trackDemoEvent("Demo_reserva_creada", "direct");
    } else {
      setStep(2); trackDemoEvent("Demo_cotizacion_vista", "quote");
    }
  }
  function reset(nextFlow = flow) { setFlow(nextFlow); setDraft(sample(currency)); setStep(1); }
  function startTrial() { trackDemoEvent("Demo_registro_click", flow); onStartTrial(); }
  const title = step === 3 ? copy("Su reserva de ejemplo está lista.", "Your sample reservation is ready.")
    : step === 2 ? copy("Una cotización lista para presentar.", "A quote ready to present.")
    : flow === "quote" ? copy("Pruebe con su próximo evento.", "Try it with your next event.")
    : copy("Cree una reserva directamente.", "Create a reservation directly.");

  return <dialog ref={dialog} className={styles.window} aria-labelledby="public-demo-title" aria-describedby="public-demo-notice"
    onCancel={event => { event.preventDefault(); onClose(); }} translate="no">
    <header className={styles.header}>
      <div className={styles.brand}><BrandLogo /><span>{copy("Demo interactiva", "Interactive demo")}</span></div>
      <button type="button" className={styles.close} onClick={onClose} aria-label={copy("Cerrar demo", "Close demo")}><X size={22} /></button>
    </header>
    <div className={styles.content}>
      <p className={styles.notice} id="public-demo-notice"><span className={styles.dot}/>{copy("Sin registro · Datos de ejemplo · Los cambios se borran al cerrar", "No signup · Sample data · Changes are cleared when you close")}</p>
      <div className={styles.intro}>
        <div><span className={styles.eyebrow}>{copy("DE COTIZACIÓN A RESERVACIÓN", "FROM QUOTE TO RESERVATION")}</span>
          <h1 id="public-demo-title" ref={heading} tabIndex={-1}>{title}</h1>
          <p>{step === 1 ? copy("El ejemplo ya está listo. Puede cambiar los datos o continuar para ver el resultado.", "The example is ready. Change the details or continue to see the result.")
            : step === 2 ? copy("Revise los datos. Cuando el cliente confirme, conviértala en reservación.", "Review the details. When your customer confirms, convert it to a reservation.")
            : copy("Fecha, área, invitados y anticipo, juntos en una sola reserva.", "Date, area, guests and deposit, together in one reservation.")}</p>
        </div>
        {step > 1 && <button type="button" className={styles.textButton} onClick={() => reset()}><RotateCcw size={16}/>{copy("Reiniciar demo", "Restart demo")}</button>}
      </div>
      <ol className={styles.steps} aria-label={copy("Progreso de la demo", "Demo progress")}>
        {(flow === "quote" ? [copy("Crear cotización", "Create quote"), copy("Ver cotización", "View quote"), copy("Reservación", "Reservation")]
          : [copy("Datos de la reserva", "Reservation details"), copy("Reservación", "Reservation")]).map((label, index) => {
          const current = flow === "direct" ? (step === 3 ? 1 : 0) : step - 1;
          return <li key={label} className={index === current ? styles.current : index < current ? styles.complete : ""} aria-current={index === current ? "step" : undefined}>
            <span>{index < current ? <Check size={16}/> : index + 1}</span>{label}
          </li>;
        })}
      </ol>

      {step === 1 && <>
        <div className={styles.mode} role="group" aria-label={copy("Tipo de recorrido", "Demo flow")}>
          <button type="button" aria-pressed={flow === "quote"} onClick={() => reset("quote")}><FileText size={17}/>{copy("Con cotización", "With a quote")}</button>
          <button type="button" aria-pressed={flow === "direct"} onClick={() => reset("direct")}><CalendarDays size={17}/>{copy("Reserva directa", "Direct reservation")}</button>
        </div>
        <form id="unomesa-demo-form" onSubmit={submit} className={styles.form}>
          <section className={styles.editor} aria-label={copy("Editar ejemplo", "Edit example")}>
            <div className={styles.cardHeading}><h2>{copy("Datos del evento", "Event details")}</h2><span>{copy("Ejemplo editable", "Editable example")}</span></div>
            <div className={styles.fields}>
              <label>{copy("Cliente de ejemplo", "Sample customer")}<input value={draft.client} onChange={e => update("client", e.target.value)} required maxLength={70} autoComplete="off" /></label>
              <label>{copy("Área", "Area")}<select value={draft.area} onChange={e => update("area", e.target.value)}><option value="terrace">{copy("Terraza", "Terrace")}</option><option value="dining">{copy("Salón principal", "Main dining room")}</option></select></label>
              <label>{copy("Fecha", "Date")}<input type="date" value={draft.date} min="2020-01-01" max="2099-12-31" onChange={e => update("date", e.target.value)} required /></label>
              <label>{copy("Hora", "Time")}<input type="time" value={draft.time} onChange={e => update("time", e.target.value)} required /></label>
              <label>{copy("Invitados", "Guests")}<input type="number" inputMode="numeric" min="1" max="500" step="1" value={draft.guests} onChange={e => update("guests", e.target.value)} required /></label>
              <label>{copy("Moneda del ejemplo", "Example currency")}<select value={currency} onChange={e => {
                const next = e.target.value as AppCurrency, example = sample(next); setCurrency(next);
                setDraft(current => ({ ...current, price: example.price, deposit: example.deposit }));
              }}><option value="GTQ">GTQ · Q</option><option value="USD">USD · $</option><option value="MXN">MXN · $</option></select></label>
            </div>
            <div className={styles.sectionDivider}/>
            <div className={styles.fields}>
              <label>{copy("Menú de ejemplo", "Sample menu")}<select value={draft.menu} onChange={e => update("menu", e.target.value)}><option value="celebration">{copy("Menú de celebración", "Celebration menu")}</option><option value="corporate">{copy("Menú corporativo", "Corporate menu")}</option></select></label>
              <label>{copy("Precio por persona", "Price per guest")}<input type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={draft.price} onChange={e => update("price", e.target.value)} required /></label>
              <label>{copy("Anticipo de ejemplo", "Sample deposit")}<input type="number" inputMode="decimal" min="0" max={totals.total} step="0.01" value={draft.deposit} onChange={e => update("deposit", e.target.value)} required aria-describedby="demo-deposit-hint" /></label>
              <div className={styles.fieldHint} id="demo-deposit-hint">{numberValue(draft.deposit) > totals.total
                ? copy("Ajuste el anticipo: no puede superar el total.", "Adjust the deposit: it cannot exceed the total.")
                : copy("Solo es un ejemplo. Aquí no se cobra ni se envía nada.", "This is only an example. Nothing is charged or sent here.")}</div>
            </div>
            <details className={styles.adjustments}><summary>{copy("Descuento y propina", "Discount and tip")}</summary><div className={styles.fields}>
              <label>{copy("Descuento (%)", "Discount (%)")}<input type="number" min="0" max="100" step="0.01" value={draft.discount} onChange={e => update("discount", e.target.value)} required /></label>
              <label>{copy("Propina (%)", "Tip (%)")}<input type="number" min="0" max="100" step="0.01" value={draft.tip} onChange={e => update("tip", e.target.value)} required /></label>
            </div></details>
          </section>
          <aside className={styles.summary} aria-label={copy("Resumen del ejemplo", "Example summary")}>
            <span className={styles.eyebrow}>{copy("TODO CONECTADO", "EVERYTHING CONNECTED")}</span><h2>{copy("Su evento, en orden.", "Your event, organized.")}</h2>
            <div className={styles.eventMeta}><span><Users size={17}/>{numberValue(draft.guests)} {copy("invitados", "guests")}</span><span><MapPin size={17}/>{area}</span></div>
            <div className={styles.summaryLines} aria-live="polite" aria-atomic="true">
              <div><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
              {totals.discount > 0 && <div><span>{copy("Descuento", "Discount")}</span><strong>−{money(totals.discount)}</strong></div>}
              <div><span>{copy("Propina", "Tip")} ({totals.tipPct}%)</span><strong>{money(totals.tip)}</strong></div>
              <div className={styles.total}><span>Total</span><strong>{money(totals.total)}</strong></div>
              <div><span>{copy("Anticipo", "Deposit")}</span><strong>{money(totals.deposit)}</strong></div>
              <div className={styles.balance}><span>{copy("Saldo pendiente", "Outstanding balance")}</span><strong>{money(totals.balance)}</strong></div>
            </div>
            <button type="submit" className={styles.primary}>{flow === "quote" ? copy("Ver cotización", "View quote") : copy("Crear reserva de ejemplo", "Create sample reservation")}<ArrowRight size={18}/></button>
            <p className={styles.summaryHint}>{copy("Pruebe con datos ficticios. Nada se guarda al salir.", "Use sample data. Nothing is saved when you leave.")}</p>
          </aside>
        </form>
      </>}

      {step === 2 && <>
        <article className={styles.document} aria-label={copy("Cotización de ejemplo", "Sample quote")}>
          <div className={styles.documentHeader}><div><BrandLogo /><p>{copy("Restaurante de ejemplo", "Sample restaurant")}</p></div><div><span>{copy("COTIZACIÓN", "QUOTE")}</span><strong>DEMO-001</strong></div></div>
          <div className={styles.documentMeta}><div><small>{copy("CLIENTE", "CUSTOMER")}</small><strong>{draft.client}</strong></div><div><small>{copy("FECHA Y HORA", "DATE AND TIME")}</small><strong>{dateLabel} · {draft.time}</strong></div><div><small>{copy("ÁREA E INVITADOS", "AREA AND GUESTS")}</small><strong>{area} · {draft.guests}</strong></div></div>
          <div className={styles.tableWrap}><table><caption>{copy("Detalle de la cotización de ejemplo", "Sample quote details")}</caption><thead><tr><th>{copy("Producto / servicio", "Product / service")}</th><th>{copy("Cantidad", "Quantity")}</th><th>{copy("Precio", "Price")}</th><th>Total</th></tr></thead><tbody><tr><td>{menu}</td><td>{draft.guests}</td><td>{money(numberValue(draft.price))}</td><td>{money(totals.subtotal)}</td></tr></tbody></table></div>
          <dl className={styles.documentTotals}><div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>{totals.discount > 0 && <div><dt>{copy("Descuento", "Discount")}</dt><dd>−{money(totals.discount)}</dd></div>}<div><dt>{copy("Propina", "Tip")}</dt><dd>{money(totals.tip)}</dd></div><div><dt>Total</dt><dd>{money(totals.total)}</dd></div><div><dt>{copy("Anticipo", "Deposit")}</dt><dd>{money(totals.deposit)}</dd></div><div className={styles.documentBalance}><dt>{copy("Saldo pendiente", "Outstanding balance")}</dt><dd>{money(totals.balance)}</dd></div></dl>
          <p className={styles.documentNote}>{copy("Documento de demostración con datos ficticios. No se ha enviado a ningún cliente.", "Demonstration document with sample data. It has not been sent to a customer.")}</p>
        </article>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setStep(1)}><ArrowLeft size={17}/>{copy("Editar ejemplo", "Edit example")}</button><button type="button" className={styles.primary} onClick={() => { setStep(3); trackDemoEvent("Demo_reserva_creada", "quote"); }}>{copy("Convertir en reserva", "Convert to reservation")}<ArrowRight size={18}/></button></div>
      </>}

      {step === 3 && <div className={styles.resultGrid}>
        <article className={styles.reservation} aria-label={copy("Reservación de ejemplo", "Sample reservation")}>
          <div className={styles.confirmation}><CheckCircle2 size={20}/>{copy("Confirmada · Solo demo", "Confirmed · Demo only")}</div>
          <h2>{draft.client}</h2><p>{menu}</p>
          <div className={styles.reservationDetails}>{[
            [CalendarDays, copy("Fecha", "Date"), dateLabel], [Clock3, copy("Hora", "Time"), draft.time],
            [Users, copy("Invitados", "Guests"), draft.guests], [MapPin, copy("Área", "Area"), area],
          ].map(([Icon, label, value]) => {
            const DetailIcon = Icon as typeof CalendarDays;
            return <div key={String(label)}><DetailIcon size={21}/><span><small>{String(label)}</small><strong>{String(value)}</strong></span></div>;
          })}</div>
          <div className={styles.reservationMoney}><div><small>{copy("Anticipo registrado", "Recorded deposit")}</small><strong>{money(totals.deposit)}</strong></div><div><small>{copy("Saldo pendiente", "Outstanding balance")}</small><strong>{money(totals.balance)}</strong></div></div>
          <p className={styles.linked}><Check size={16}/>{flow === "quote" ? copy("Vinculada a la cotización DEMO-001", "Linked to quote DEMO-001") : copy("Creada directamente, sin cotización", "Created directly, without a quote")}</p>
          <button type="button" className={styles.textButton} onClick={() => setStep(flow === "quote" ? 2 : 1)}><ArrowLeft size={16}/>{flow === "quote" ? copy("Volver a la cotización", "Back to quote") : copy("Editar ejemplo", "Edit example")}</button>
        </article>
        <aside className={styles.trial}>
          <span className={styles.eyebrow}>{copy("AHORA, CON SU RESTAURANTE", "NOW, WITH YOUR RESTAURANT")}</span>
          <h2>{copy("Ponga en orden su próxima reserva.", "Organize your next reservation.")}</h2>
          <p>{copy("Cree su cuenta y use UnoMesa con sus propios clientes, cotizaciones y reservaciones.", "Create your account and use UnoMesa with your own customers, quotes and reservations.")}</p>
          <ul><li><Check size={17}/>{copy("10 días de Advanced gratis", "10 free days of Advanced")}</li><li><Check size={17}/>{copy("Sin tarjeta para comenzar", "No card required to start")}</li><li><Check size={17}/>{copy("Ayuda dentro de la app y por email", "In-app help and email support")}</li></ul>
          {signupEnabled ? <button type="button" className={styles.primary} onClick={startTrial}>{copy("Crear mi cuenta gratis", "Create my free account")}<ArrowRight size={18}/></button> : <button type="button" className={styles.primary} onClick={onClose}>{copy("Volver a UnoMesa", "Back to UnoMesa")}</button>}
          <small>{copy("La cuenta empieza vacía. Los datos de la demo no se transfieren.", "Your account starts empty. Demo data is not transferred.")}</small>
          <button type="button" className={styles.textButton} onClick={() => reset(flow === "quote" ? "direct" : "quote")}>{flow === "quote" ? copy("Probar una reserva sin cotización", "Try a reservation without a quote") : copy("Probar el recorrido con cotización", "Try the quote workflow")}<ArrowRight size={16}/></button>
        </aside>
      </div>}
    </div>
    {step === 1 && <footer className={styles.mobileAction}>
      <div><small>Total</small><strong>{money(totals.total)}</strong></div>
      <button type="submit" form="unomesa-demo-form" className={styles.primary}>{flow === "quote" ? copy("Ver cotización", "View quote") : copy("Crear reserva de ejemplo", "Create sample reservation")}<ArrowRight size={17}/></button>
    </footer>}
  </dialog>;
}
