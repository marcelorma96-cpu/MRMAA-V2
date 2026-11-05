"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppPreferences } from "@/components/app-preferences";
import { MfaSettings } from "@/components/mfa-settings";
import { useSuccessToast } from "@/components/success-toast";
import { passwordIsStrong, PASSWORD_MAX_LENGTH } from "@/lib/password-settings";
import { supabase } from "@/lib/supabase";
import { confirmDiscardChanges, useUnsavedChanges } from "@/lib/unsaved-changes";

type PasswordState = { email: string; mode: "create" | "change"; google: boolean };
async function passwordRequest(body?: object) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("PASSWORD_AUTH");
  const response = await fetch("/api/security/password", { method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "PASSWORD_UNAVAILABLE");
  return result;
}

export function PasswordSettings() {
  const { language } = useAppPreferences(), en = language === "en";
  const toast = useSuccessToast();
  const [state, setState] = useState<PasswordState | null>(null);
  const [loading, setLoading] = useState(true), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState("");
  const [current, setCurrent] = useState(""), [nonce, setNonce] = useState("");
  const [show, setShow] = useState(false), [needsCurrent, setNeedsCurrent] = useState(false), [needsCode, setNeedsCode] = useState(false);
  const [sent, setSent] = useState(false), [cooldown, setCooldown] = useState(0), [error, setError] = useState("");
  const locked = useRef(false), mounted = useRef(true), generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError("");
    try { const result = await passwordRequest(); if (mounted.current && generation.current === request) setState(result); }
    catch { if (mounted.current && generation.current === request) setError("PASSWORD_LOAD"); }
    finally { if (mounted.current && generation.current === request) setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  function clear() {
    setPassword(""); setConfirmation(""); setCurrent(""); setNonce(""); setShow(false);
    setNeedsCurrent(false); setNeedsCode(false); setSent(false); setOpen(false); setError("");
  }
  const markSaved = useUnsavedChanges(Boolean(password || confirmation || current || nonce), clear);
  const creating = state?.mode === "create";
  const title = creating ? (en ? "Create password" : "Crear contraseña") : (en ? "Change password" : "Cambiar contraseña");
  function errorText(code: string) {
    const messages: Record<string, [string, string]> = {
      PASSWORD_LOAD: ["No se pudo cargar la cuenta. Reintente.", "Could not load your account. Retry."],
      PASSWORD_AUTH: ["Vuelva a iniciar sesión para gestionar su contraseña.", "Sign in again to manage your password."],
      PASSWORD_MFA: ["Complete la verificación en dos pasos antes de cambiar la contraseña.", "Complete two-step verification before changing your password."],
      PASSWORD_MISMATCH: ["Las contraseñas no coinciden.", "Passwords do not match."],
      PASSWORD_WEAK: ["Use entre 8 y 128 caracteres con mayúscula, minúscula, número y símbolo. Evite contraseñas comunes o filtradas.", "Use 8–128 characters with uppercase, lowercase, a number and a symbol. Avoid common or leaked passwords."],
      PASSWORD_CURRENT: ["Confirme su contraseña actual de UnoMesa para continuar.", "Confirm your current UnoMesa password to continue."],
      PASSWORD_CURRENT_INVALID: ["La contraseña actual no es correcta.", "Your current password is incorrect."],
      PASSWORD_REAUTH: ["Confirme su identidad con un código por correo para continuar.", "Confirm your identity with an email code to continue."],
      PASSWORD_CODE_INVALID: ["El código no es válido o venció. Solicite uno nuevo.", "The code is invalid or expired. Request a new one."],
      PASSWORD_SAME: ["Elija una contraseña distinta de la actual.", "Choose a password different from your current one."],
      PASSWORD_RATE: ["Espere un minuto antes de volver a intentarlo.", "Wait a minute before trying again."],
    };
    return messages[code]?.[en ? 1 : 0] || (en ? "Could not complete the request. Check your connection and retry." : "No se pudo completar la solicitud. Revise su conexión e intente nuevamente.");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    if (!passwordIsStrong(password)) { setError("PASSWORD_WEAK"); return; }
    if (password !== confirmation) { setError("PASSWORD_MISMATCH"); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      await passwordRequest({ action: "update", password, confirmation, ...(needsCurrent ? { current_password: current } : {}), ...(sent && nonce ? { nonce } : {}) });
      markSaved();
      if (mounted.current) { setState(previous => previous ? { ...previous, mode: "change" } : previous); clear(); }
      toast(creating ? (en ? "Password created." : "Contraseña creada.") : (en ? "Password changed." : "Contraseña actualizada."));
    } catch (failure) {
      if (!mounted.current) return;
      const code = failure instanceof Error ? failure.message : "PASSWORD_UNAVAILABLE";
      setError(code);
      if (["PASSWORD_CURRENT", "PASSWORD_CURRENT_INVALID"].includes(code)) {
        setNeedsCurrent(true); setCurrent(""); setState(previous => previous ? { ...previous, mode: "change" } : previous);
      }
      if (["PASSWORD_REAUTH", "PASSWORD_CODE_INVALID"].includes(code)) setNeedsCode(true);
      if (code === "PASSWORD_CODE_INVALID") setNonce("");
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function sendCode() {
    if (locked.current || cooldown) return;
    locked.current = true; setBusy(true); setError("");
    try {
      await passwordRequest({ action: "reauthenticate" });
      if (mounted.current) { setSent(true); setNonce(""); setCooldown(60); }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "PASSWORD_UNAVAILABLE");
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  const mismatch = Boolean(confirmation && password !== confirmation);
  return <section className="moduleCard settingsPanel passwordSettings" translate="no" aria-labelledby="account-password-title">
    <div className="moduleTitle"><div><h2 id="account-password-title">{loading || !state ? (en ? "Password" : "Contraseña") : title}</h2>
      <p>{en ? "Manage the password for your own UnoMesa account." : "Administre la contraseña de su propia cuenta de UnoMesa."}</p></div></div>
    {loading ? <p role="status">{en ? "Loading…" : "Cargando…"}</p> : !state ? <button type="button" className="secondary" onClick={() => void load()}>{en ? "Retry" : "Reintentar"}</button> : <>
      <p className="passwordAccountEmail">{state.email}</p>
      {state.google && <p className="muted">{en ? "This password is only for UnoMesa. You can keep signing in with Google; your Google password stays the same." : "Esta contraseña es solo para UnoMesa. Puede seguir entrando con Google; su contraseña de Google permanece igual."}</p>}
      {!open ? <button type="button" className="primary" onClick={() => setOpen(true)}>{title}</button> : <form className="formStack" onSubmit={save}>
        <input type="text" name="username" autoComplete="username" value={state.email} readOnly hidden />
        {needsCurrent && <label>{en ? "Current UnoMesa password" : "Contraseña actual de UnoMesa"}<input required type="password" autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} disabled={busy} value={current} onChange={event => setCurrent(event.target.value)} /></label>}
        <label>{en ? "New password" : "Nueva contraseña"}<input autoFocus required type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={PASSWORD_MAX_LENGTH} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} aria-describedby="account-password-help" /></label>
        <small id="account-password-help">{en ? "8–128 characters, including uppercase, lowercase, a number and a symbol." : "Entre 8 y 128 caracteres, con mayúscula, minúscula, número y símbolo."}</small>
        <label>{en ? "Confirm new password" : "Confirmar nueva contraseña"}<input required type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={PASSWORD_MAX_LENGTH} disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-invalid={mismatch} aria-describedby={mismatch ? "account-password-mismatch" : undefined} /></label>
        {mismatch && <small id="account-password-mismatch" className="passwordMismatch" role="status">{en ? "Passwords do not match." : "Las contraseñas no coinciden."}</small>}
        <label className="checkLine passwordShow"><input type="checkbox" checked={show} disabled={busy} onChange={event => setShow(event.target.checked)} />{en ? "Show new password" : "Mostrar nueva contraseña"}</label>
        {needsCode && <div className="formStack">
          {sent && <><p role="status">{en ? "Code sent. Check your inbox and spam folder." : "Código enviado. Revise su bandeja y correo no deseado."}</p><label>{en ? "Email verification code" : "Código de verificación por correo"}<input required type="text" autoComplete="one-time-code" maxLength={128} disabled={busy} value={nonce} onChange={event => setNonce(event.target.value.replace(/\s/g, ""))} /></label></>}
          <button type="button" className="secondary" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown ? `${en ? "Resend in" : "Reenviar en"} ${cooldown}s` : sent ? (en ? "Resend code" : "Reenviar código") : (en ? "Send verification code" : "Enviar código de verificación")}</button>
        </div>}
        <div className="buttonRow"><button className="primary" disabled={busy || !passwordIsStrong(password) || password !== confirmation || (needsCurrent && !current) || (needsCode && (!sent || !nonce))}>{busy ? (en ? "Saving…" : "Guardando…") : title}</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => { markSaved(); clear(); }}>{en ? "Cancel" : "Cancelar"}</button></div>
      </form>}
    </>}
    {error && <p className="moduleNotice moduleError" role="alert">{errorText(error)}</p>}
  </section>;
}

/** Personal settings for members without access to business administration. */
export function PersonalSettings() {
  const { language } = useAppPreferences(), en = language === "en";
  const [tab, setTab] = useState<"account" | "mfa">("account");
  return <div className="settingsLayout" translate="no"><aside>
    {(["account", "mfa"] as const).map(value => <button type="button" className={tab === value ? "active" : ""} key={value} onClick={() => { if (value !== tab && confirmDiscardChanges()) setTab(value); }}>
      {value === "account" ? (en ? "Account" : "Cuenta") : (en ? "Two-step verification" : "Verificación en dos pasos")}
    </button>)}
  </aside>{tab === "account" ? <PasswordSettings /> : <MfaSettings />}</div>;
}
