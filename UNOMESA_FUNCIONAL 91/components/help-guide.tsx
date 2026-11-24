"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { searchHelpTopics, helpSections, type HelpModule, type HelpSection, type HelpTopic } from "@/lib/tutorial-tour";
import type { AppLanguage } from "@/lib/translations";

export function HelpGuide({ topics, language, initialSection = "all", close, navigate }: {
  topics: HelpTopic[]; language: AppLanguage; initialSection?: HelpSection; close: () => void; navigate: (tab: HelpModule) => void;
}) {
  const en = language === "en", [search, setSearch] = useState(""), [section, setSection] = useState<HelpSection>(initialSection), [expanded, setExpanded] = useState<string | null>(null);
  const dialog = useRef<HTMLElement>(null), input = useRef<HTMLInputElement>(null), closer = useRef(close);
  closer.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closer.current(); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,summary,[tabindex="0"]') || []).filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus(); };
  }, []);
  const sections = (Object.keys(helpSections) as HelpSection[]).filter(key => key === "all" || topics.some(topic => (topic.tab || "general") === key));
  const matches = searchHelpTopics(topics, section, search);
  const groups = search.trim() ? (matches.length ? [{ key: "all" as HelpSection, topics: matches }] : []) : sections.filter(key => key !== "all").map(key => ({ key, topics: matches.filter(topic => (topic.tab || "general") === key) })).filter(group => group.topics.length);
  return <div className="modalBackdrop helpBackdrop" translate="no" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section ref={dialog} className="helpCenter" role="dialog" aria-modal="true" aria-labelledby="help-guide-title">
      <header><div><span className="eyebrow">{en ? "FIND A TASK" : "ENCUENTRE UNA TAREA"}</span><h2 id="help-guide-title">{en ? "UnoMesa guide" : "Instructivo de UnoMesa"}</h2></div><button type="button" className="icon" onClick={close} aria-label={en ? "Close guide" : "Cerrar instructivo"}><X /></button></header>
      <div className="helpGuideFilters">
        <label className="helpSearch">{en ? "What do you want to do?" : "¿Qué quiere hacer?"}<input ref={input} type="search" value={search} onChange={event => { setSearch(event.target.value); setExpanded(null); }} placeholder={en ? "Public page, inbox, payments…" : "Página pública, buzón, pagos…"} /></label>
        <label>{en ? "Module" : "Módulo"}<select value={section} onChange={event => { setSection(event.target.value as HelpSection); setExpanded(null); }}>{sections.map(key => <option key={key} value={key}>{helpSections[key][en ? 1 : 0]}</option>)}</select></label>
      </div>
      <div className="helpContent">
        <p className="helpResultCount" role="status">{matches.length} {en ? "topics · Open one to see the steps." : "temas · Abra uno para ver los pasos."}</p>
        {groups.map(group => <section className="helpTopicGroup" key={group.key}><h3>{search.trim() ? (en ? "Best matches" : "Mejores coincidencias") : helpSections[group.key][en ? 1 : 0]}</h3>{group.topics.map(topic => <details className="helpTopic" key={topic.title} open={expanded === topic.title}>
          <summary onClick={event => { event.preventDefault(); setExpanded(current => current === topic.title ? null : topic.title); }}>{topic.title}</summary>
          <p>{topic.text}</p><ol>{topic.details.map(detail => <li key={detail}>{detail}</li>)}</ol>
          {topic.tab && <button type="button" className="secondary" onClick={() => navigate(topic.tab!)}>{en ? "Go to" : "Ir a"} {helpSections[topic.tab][en ? 1 : 0]}<ArrowRight /></button>}
        </details>)}</section>)}
        {!matches.length && <div className="empty"><p>{en ? "No matches. Try a field name or another module." : "Sin coincidencias. Pruebe el nombre del campo u otro módulo."}</p><button className="secondary" type="button" onClick={() => { setSearch(""); setSection("all"); }}>{en ? "Show all topics" : "Ver todos los temas"}</button></div>}
      </div>
    </section>
  </div>;
}
