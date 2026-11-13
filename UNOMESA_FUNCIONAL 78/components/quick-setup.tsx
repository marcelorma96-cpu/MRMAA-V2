"use client";
import { useEffect, useId, useRef } from "react";
import { ArrowRight, Check, ChevronLeft, Clock3, X } from "lucide-react";
import { quickStartSteps, type QuickStartTarget } from "@/lib/quick-start";
import type { useQuickStart } from "./use-quick-start";

export function QuickSetup({ en, plan, role, status, controller, offer, onNavigate, onCompleted }: {
  en: boolean; plan: string; role: string; status: string; controller: ReturnType<typeof useQuickStart>; offer: boolean;
  onNavigate: (target: QuickStartTarget) => boolean; onCompleted: () => void;
}) {
  const steps = quickStartSteps(en, plan, role, status), heading = useId(), title = useRef<HTMLHeadingElement>(null);
  const index = Math.max(0, steps.findIndex(step => step.id === controller.progress?.step));
  const step = steps[index], last = index === steps.length - 1;
  useEffect(() => { if (controller.open) title.current?.focus({ preventScroll: true }); }, [controller.open, index]);
  if (!controller.available || !step || (!controller.open && (!offer || controller.progress))) return null;
  async function finish() { if (await controller.finish("completed", step.id)) onCompleted(); }
  function go(next: number) { if (onNavigate(steps[next].id)) controller.move(steps[next].id); }
  return <section className={`quickStart moduleCard ${controller.open ? "quickStartActive" : "quickStartInvite"}`} aria-labelledby={heading} translate="no">
    {!controller.open ? <>
      <div className="quickStartWelcome"><span className="quickStartEyebrow"><Clock3 size={15}/>{en ? "Optional · About 5 minutes" : "Opcional · Unos 5 minutos"}</span>
        <h2 id={heading}>{en ? "Discover what UnoMesa can do for you" : "Descubra lo que puede hacer con UnoMesa"}</h2>
        <p>{en ? "Explore reservations, floor plans, quotes and customers. Get to know the essentials at your own pace." : "Explore reservas, plano de mesas, cotizaciones y clientes. Conozca lo esencial a su ritmo."}</p>
      </div>
      <div className="quickStartActions"><button type="button" className="primary" disabled={controller.saving} onClick={() => { if (onNavigate(step.id)) { controller.move(step.id); controller.start(); } }}>{en ? "Start quick tour" : "Empezar inicio rápido"}<ArrowRight size={17}/></button>
        <button type="button" className="secondary" disabled={controller.saving} onClick={() => void controller.finish("dismissed", step.id)}>{en ? "Skip" : "Omitir"}</button></div>
    </> : <>
      <div className="quickStartTop"><span className="quickStartEyebrow">{en ? "Quick start" : "Inicio rápido"} · {index + 1}/{steps.length} · {step.seconds} s</span>
        <button type="button" className="quickStartClose" aria-label={en ? "Close quick start" : "Cerrar inicio rápido"} disabled={controller.saving} onClick={() => controller.close(step.id)}><X size={18}/></button></div>
      <progress value={index + 1} max={steps.length} aria-label={en ? "Quick start progress" : "Progreso de inicio rápido"}/>
      <h2 id={heading} ref={title} tabIndex={-1}>{step.title}</h2><p className="quickStartValue">{step.value}</p>
      <ul>{step.instructions.map(text => <li key={text}>{text}</li>)}</ul>
      <div className="quickStartActions"><button type="button" className="secondary" disabled={controller.saving} onClick={() => onNavigate(step.id)}>{step.action}<ArrowRight size={16}/></button>
        <div className="quickStartPaging"><button type="button" className="secondary" disabled={!index || controller.saving} aria-label={en ? "Previous step" : "Paso anterior"} onClick={() => go(index - 1)}><ChevronLeft size={18}/></button>
          <button type="button" className="primary" disabled={controller.saving} onClick={() => last ? void finish() : go(index + 1)}>{controller.saving ? (en ? "Saving…" : "Guardando…") : last ? (en ? "Finish quick start" : "Finalizar inicio rápido") : (en ? "Next" : "Siguiente")}{last ? <Check size={17}/> : <ArrowRight size={17}/>}</button></div>
        <button type="button" className="link quickStartSkip" disabled={controller.saving} onClick={() => void controller.finish("dismissed", step.id)}>{en ? "Continue on my own" : "Continuar por mi cuenta"}</button></div>
      <small>{last ? (en ? "Finish to hide quick start. Help and Tutorial remain available." : "Al finalizar, el inicio rápido desaparece. Ayuda y Tutorial siguen disponibles.") : (en ? "Explore without filling in forms. Save only the records you want to keep." : "Explore sin completar formularios. Guarde solo los registros que quiera conservar.")}</small>
    </>}
    {controller.error && <p className="alert" role="alert">{en ? "We could not save your progress. Check your connection and try again." : "No pudimos guardar su progreso. Revise la conexión e inténtelo de nuevo."}<button type="button" className="link" onClick={() => controller.close(step.id)}>{en ? "Close for now" : "Cerrar por ahora"}</button></p>}
  </section>;
}
