"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { EXCEL_CHECK_FAILED, EXCEL_DENIED, readExcelAccess, saveTeamExcelAccess, type ExcelAccess } from "@/lib/excel-permission";
import { useUnsavedChanges } from "@/lib/unsaved-changes";
import { userMessage } from "@/lib/user-message";

const changedEvent = "mrmaa-excel-permission-changed";
export function useExcelExportAccess(restaurantId?: string) {
  const [result, setResult] = useState<{ restaurantId?: string; access: ExcelAccess } | null>(null);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    try {
      const access = await readExcelAccess(supabase, restaurantId);
      if (request === revision.current) { setResult({ restaurantId, access }); setError(""); }
      return access;
    } catch {
      if (request === revision.current) { setResult(null); setError(EXCEL_CHECK_FAILED); }
      throw new Error(EXCEL_CHECK_FAILED);
    }
  }, [restaurantId]);
  useEffect(() => {
    const update = () => { void refresh().catch(() => {}); };
    update();
    window.addEventListener("focus", update);
    window.addEventListener(changedEvent, update);
    return () => {
      revision.current++;
      window.removeEventListener("focus", update);
      window.removeEventListener(changedEvent, update);
    };
  }, [refresh]);
  const access = result?.restaurantId === restaurantId ? result?.access : undefined;
  const ensureAllowed = useCallback(async () => {
    const latest = await refresh();
    if (!latest.allowed) throw new Error(EXCEL_DENIED);
  }, [refresh]);
  return {
    access, allowed: access?.allowed === true, error, refresh, ensureAllowed,
    hint: error || (access && !access.allowed ? EXCEL_DENIED : "Verificando permiso de descarga…"),
  };
}

export function ExcelExportControl({ restaurantId }: { restaurantId: string }) {
  const permission = useExcelExportAccess(restaurantId);
  const [draft, setDraft] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const dirty = draft !== null && draft !== permission.access?.teamEnabled;
  useUnsavedChanges(dirty, () => setDraft(null));
  useEffect(() => { setDraft(null); setNotice(""); }, [restaurantId]);
  if (permission.error) return <p className="moduleNotice moduleError">{userMessage(permission.error)} <button type="button" className="secondary" onClick={() => { void permission.refresh().catch(() => {}); }}>Reintentar</button></p>;
  if (!permission.access?.canManage) return null;
  async function save() {
    if (draft === null || saving) return;
    setSaving(true); setNotice("");
    try {
      await saveTeamExcelAccess(supabase, restaurantId, draft);
      await permission.refresh();
      setDraft(null);
      setNotice("Permiso de descargas guardado.");
      window.dispatchEvent(new Event(changedEvent));
    } catch (error) { setNotice(userMessage(error)); }
    finally { setSaving(false); }
  }
  return <section className="teamExcelControl">
    <div className="teamExcelControlRow">
      <div><h3>Permitir descargas de Excel al equipo</h3><p>Aplica a Gerente, Operador y Solo lectura. El Administrador siempre puede descargar.</p></div>
      <label className="switch"><input type="checkbox" role="switch" aria-label="Permitir descargas de Excel al equipo" checked={draft ?? permission.access.teamEnabled} disabled={saving} onChange={(event) => { setDraft(event.target.checked); setNotice(""); }} /><span /></label>
    </div>
    <button type="button" className="secondary" disabled={!dirty || saving} onClick={save}>{saving ? "Guardando…" : "Guardar permiso"}</button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
