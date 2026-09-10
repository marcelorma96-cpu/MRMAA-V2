"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Globe, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { EMAIL_LANGUAGES, emailLanguage, emailLanguageUpdate, type EmailLanguage } from "@/lib/email-language";

export function EmailLanguagePreference({ panel = false, onDirtyChange }: { panel?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<EmailLanguage>("es");
  const [savedLanguage, setSavedLanguage] = useState<EmailLanguage>("es");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const selectId = useId();
  const visible = panel || open;
  const dirty = visible && !loading && language !== savedLanguage;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setNotice("");
    setFailed(false);
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        setNotice("No se pudo cargar su preferencia. Vuelva a abrir esta opción.");
        setFailed(true);
        return;
      }
      const current = emailLanguage(data.user.user_metadata?.language);
      setLanguage(current);
      setSavedLanguage(current);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setNotice("No se pudo cargar su preferencia. Revise la conexión e intente nuevamente.");
        setFailed(true);
      }
    });
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    if (open && !panel) dialog.current?.showModal();
  }, [open, panel]);

  const close = () => {
    if (busy) return;
    if (language !== savedLanguage && !window.confirm("Hay cambios sin guardar. ¿Desea descartarlos?")) return;
    dialog.current?.close();
    setOpen(false);
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || loading) return;
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      const { error } = await supabase.auth.updateUser(emailLanguageUpdate(language));
      if (error) throw error;
      setSavedLanguage(language);
      const messages = {
        es: "Preferencia guardada. Recibirá sus próximos correos de acceso en español.",
        en: "Preference saved. Your next account emails will be in English.",
        fr: "Préférence enregistrée. Vos prochains e-mails de connexion seront en français.",
      };
      setNotice(messages[language]);
    } catch {
      setFailed(true);
      setNotice("No se pudo guardar el idioma. Revise la conexión e intente nuevamente.");
    } finally { setBusy(false); }
  }

  const content = <>
    <header className="emailLanguageHeading">
      <h2 id={titleId}>Idioma de mis correos</h2>
      {!panel && <button className="icon" type="button" disabled={busy} aria-label="Cerrar" onClick={close}><X /></button>}
    </header>
    <p>Elija el idioma de sus invitaciones, restablecimientos y confirmaciones de acceso.</p>
    <form className="formStack" onSubmit={save}>
      <label htmlFor={selectId}>Idioma / Language / Langue</label>
      {loading && !failed && <small role="status">Cargando preferencia…</small>}
      <select id={selectId} value={language} disabled={loading || busy} onChange={(event) => setLanguage(event.target.value as EmailLanguage)}>
        {EMAIL_LANGUAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <button className="primary" disabled={loading || busy}>{busy ? "Guardando…" : "Guardar idioma"}</button>
      {notice && <p role={failed ? "alert" : "status"} className={`moduleNotice ${failed ? "moduleError" : ""}`}>{notice}</p>}
    </form>
  </>;

  if (panel) return <section className="moduleCard settingsPanel emailLanguagePanel">{content}</section>;
  return <>
    <button className="tutorialLauncher" type="button" onClick={() => setOpen(true)}><Globe /><span>Idioma de mis correos</span></button>
    {open && <dialog ref={dialog} className="emailLanguageDialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }}>
      {content}
    </dialog>}
  </>;
}
