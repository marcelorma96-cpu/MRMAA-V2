"use client";
import { readCatalog } from "@/lib/account-access";
import { ShiftEndpointInput } from "@/components/dashboard-ui";
import { newShiftDraft, shiftDraftFromRow, shiftDraftPayload, scheduleShiftLabel } from "@/lib/schedule-range";
import { BillingPanel } from "@/components/billing-panel";
import { planFor } from "@/lib/plans";
import { useDataRefresh, useOnDataRefresh } from "@/components/restaurant-sync";
import { confirmApp } from "@/components/app-preferences";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges } from "@/lib/unsaved-changes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { supabase, signOutCurrentSession } from "@/lib/supabase";
import { requirePermission, ACCESS_DENIED } from "@/lib/permissions";
import { UsersModule } from "@/components/users-module";
import { SecurityCenter } from "@/components/security-center";
import { MfaSettings } from "@/components/mfa-settings";
import { TransparentLogo } from "@/components/transparent-logo";
import { emailLanguage } from "@/lib/email-language";
import { appCurrency, appLanguage, formatAppMoney, useAppPreferences } from "@/components/app-preferences";
import { normalizeArea } from "@/components/area-picker";
import type { Area, Employee, Shift } from "@/components/schedules-module";

// Extracted verbatim from components/advanced-modules.tsx — no behavior
// change, only moved to its own file so EnhancedSettings is a separate bundle
// chunk from MonthlySchedules (previously both lived in the same file, so
// dynamic-importing either one likely pulled in the other's code too).
//
// Note: the original file also had a ~250-line `SimpleCommunication`
// component defined between MonthlySchedules and this section. It was never
// imported or rendered anywhere in the app — dead code, so it was dropped
// rather than moved.

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
};

function AccountSettings({ restaurantId }: { restaurantId: string }) {
  const remoteVersion = useDataRefresh(restaurantId, 'v2_members');
  const { language } = useAppPreferences();
  const confirmationText = language === "en" ? "DELETE MRMAA" : "ELIMINAR MRMAA";
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [repeatEmail, setRepeatEmail] = useState("");
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [emailLoading, setEmailLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState<{id:string;old_email:string;new_email:string;expires_at:string} | null>(null);
  const emailBusyRef = useRef(false);
  const emailText = (es:string,en:string) => language === "en" ? en : es;
  function emailError(error: unknown) {
    const code = error instanceof Error ? error.message : String(error);
    const messages: Record<string,[string,string]> = {
      EMAIL_CHANGE_ADDRESS: ["Revise que ambos correos coincidan, sean válidos y distintos del actual. La dirección podría no estar disponible.","Check that both addresses match, are valid and differ from your current address. The address may be unavailable."],
      EMAIL_CHANGE_INVALID: ["Los códigos no son válidos, vencieron o se agotaron los intentos. Use la sesión original; puede cancelar y solicitar otros códigos.","The codes are invalid, expired or out of attempts. Use the original session; you can cancel and request new codes."],
      EMAIL_CHANGE_DELIVERY: ["No se pudieron enviar ambos códigos. La solicitud se canceló y su correo no cambió. Espere un minuto y vuelva a intentarlo.","Both codes could not be sent. The request was cancelled and your email did not change. Wait one minute and try again."],
      EMAIL_CHANGE_RETRY: ["No se pudo completar el cambio. Revise el estado o intente nuevamente con los códigos; si esa dirección ya está en uso, cancele y elija otra.","The change could not be completed. Check the status or retry the codes; if the address is already in use, cancel and choose another."],
      EMAIL_RATE: ["Demasiados intentos. Espere antes de volver a intentarlo.","Too many attempts. Wait before trying again."],
      EMAIL_WAIT: ["Espere un minuto y revise el estado antes de intentar nuevamente.","Wait one minute and check the status before trying again."],
      EMAIL_AUTH: ["Complete la verificación de su cuenta o vuelva a iniciar sesión.","Complete account verification or sign in again."],
      EMAIL_PASSWORD: ["Para cambiar el correo, inicie sesión con su contraseña y vuelva a Configuración → Cuenta.","To change your email, sign in with your password and return to Settings → Account."],
    };
    return messages[code]?.[language === "en" ? 1 : 0] || emailText("No se pudo comprobar el cambio de correo. Revise el estado antes de intentar nuevamente.","The email change could not be checked. Check the status before trying again.");
  }
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useUnsavedChanges(Boolean(email || repeatEmail || oldCode || newCode || targetUserId || confirmation), () => {
    setEmail(""); setRepeatEmail(""); setOldCode(""); setNewCode(""); setTargetUserId(""); setConfirmation("");
  });
  const authorizedFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}`, ...(options.headers || {}) },
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "No se pudo completar la operación.");
    return json;
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || "");
      setSavedEmail(data.user?.email || "");
    });
    authorizedFetch("/api/users").then(setMembers).catch((error) => setNotice(userMessage(error)));
  }, [authorizedFetch]);

  useOnDataRefresh(remoteVersion, () => {
    void authorizedFetch('/api/users').then(setMembers).catch(error => setNotice(userMessage(error)));
  });
  const refreshEmailStatus = useCallback(async () => {
    const result = await authorizedFetch("/api/security/email", { method:"POST", body:JSON.stringify({action:"account_email_status",language}) });
    setSavedEmail(result.email); setPendingEmail(result.pending);
    return result;
  }, [authorizedFetch,language]);
  useEffect(() => {
    let active=true;
    setEmailLoading(true);
    refreshEmailStatus().catch(() => { if(active) setNotice(language === "en" ? "Email changes are unavailable. Refresh the status to try again." : "El cambio de correo no está disponible. Actualice el estado para reintentar."); })
      .finally(() => { if(active) setEmailLoading(false); });
    return () => {active=false;};
  }, [refreshEmailStatus,language]);
  async function emailAction(action: "start" | "verify" | "cancel" | "status") {
    if(emailBusyRef.current)return;
    emailBusyRef.current=true; setBusy(true); setNotice("");
    try {
      if(action === "status") {
        const result=await refreshEmailStatus();
        if(result.elsewhere) setNotice(emailText("Hay una solicitud en otra sesión. Continúe allí o solicite códigos nuevos aquí para reemplazarla.","A request is pending in another session. Continue there or request new codes here to replace it."));
        return;
      }
      const result=await authorizedFetch("/api/security/email", {method:"POST",body:JSON.stringify({action:`account_email_${action}`,language,
        email:pendingEmail?.new_email || email,repeat_email:pendingEmail?.new_email || repeatEmail,id:pendingEmail?.id,old_code:oldCode,new_code:newCode})});
      if(result.completed) {
        setSavedEmail(result.email);setEmail("");setRepeatEmail("");setOldCode("");setNewCode("");setPendingEmail(null);
        const refreshed=await supabase.auth.refreshSession();
        setNotice(refreshed.error ? emailText("Correo actualizado. Vuelva a iniciar sesión con su correo nuevo.","Email updated. Sign in again using your new email.") : emailText("Correo actualizado. Use el correo nuevo para ingresar. Se cerraron las demás sesiones.","Email updated. Use the new address to sign in. Other sessions have been closed."));
      } else if(result.cancelled) {
        setPendingEmail(null);setOldCode("");setNewCode("");setEmail("");setRepeatEmail("");
        setNotice(emailText("Solicitud cancelada. Su correo de acceso no cambió.","Request cancelled. Your login email did not change."));
      } else if(result.pending) {
        setPendingEmail(result.pending);setEmail("");setRepeatEmail("");setOldCode("");setNewCode("");
        setNotice(emailText("Códigos enviados. Revise ambas bandejas y la carpeta de spam. El correo todavía no cambió.","Codes sent. Check both inboxes and spam folders. Your email has not changed yet."));
      }
    } catch(error) {setNotice(emailError(error));}
    finally {emailBusyRef.current=false;setBusy(false);}
  }

  async function accountAction(action: "transfer" | "delete_account", extra: Record<string, string>) {
    setBusy(true); setNotice("");
    try {
      await authorizedFetch("/api/account", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      if (action === "transfer") {
        setNotice("Administración transferida. Su cuenta ahora tiene rol de gerente.");
        window.setTimeout(() => window.location.reload(), 1200);
      } else {
        await signOutCurrentSession();
        window.location.assign("/?login=1");
      }
    } catch (error: any) { setNotice(userMessage(error)); }
    finally { setBusy(false); }
  }

  const eligible = members.filter((member) => member.user_id !== currentUserId && member.status === "activo");
  return <div className="moduleStack">
    <section className="moduleCard settingsPanel">
      <div className="moduleTitle"><div><h2>Cuenta</h2><p>Administre su correo y la propiedad del restaurante.</p></div></div>
      <div className="formStack accountEmailFlow" translate="no">
        <p>{emailText("Correo de acceso actual","Current login email")}: <strong>{savedEmail || "…"}</strong></p>
        {!pendingEmail ? <form className="formStack" onSubmit={event => {event.preventDefault();void emailAction("start");}}>
          <label>{emailText("Correo nuevo","New email")}<input required type="email" autoComplete="off" autoCapitalize="none" maxLength={254} disabled={busy || emailLoading} value={email} onChange={event=>setEmail(event.target.value)} /></label>
          <label>{emailText("Repita el correo nuevo","Repeat new email")}<input required type="email" autoComplete="off" autoCapitalize="none" maxLength={254} disabled={busy || emailLoading} value={repeatEmail} onChange={event=>setRepeatEmail(event.target.value)} /></label>
          <small>{emailText("Enviaremos un código al correo actual y otro al nuevo. Debe escribir ambos aquí, en esta misma sesión. Su correo no cambia hasta completar la verificación.","We will send one code to your current email and another to the new address. Enter both here, in this same session. Your email will not change until verification is complete.")}</small>
          <button className="primary" disabled={busy || emailLoading || !email.trim() || email.trim().toLowerCase() !== repeatEmail.trim().toLowerCase() || email.trim().toLowerCase() === savedEmail.toLowerCase()}>{emailText("Enviar códigos","Send codes")}</button>
        </form> : <form className="formStack" onSubmit={event=>{event.preventDefault();void emailAction("verify");}}>
          <p>{emailText("Cambio pendiente a","Pending change to")}: <strong>{pendingEmail.new_email}</strong></p>
          <label>{emailText("Código del correo actual","Current email code")} · {pendingEmail.old_email}<input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} disabled={busy} value={oldCode} onChange={event=>setOldCode(event.target.value.replace(/\D/g,""))} /></label>
          <label>{emailText("Código del correo nuevo","New email code")} · {pendingEmail.new_email}<input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} disabled={busy} value={newCode} onChange={event=>setNewCode(event.target.value.replace(/\D/g,""))} /></label>
          <small>{emailText("Vencen en 10 minutos y admiten hasta 5 intentos. No comparta los códigos. Confirmar cerrará sus demás sesiones.","Codes expire in 10 minutes and allow up to 5 attempts. Never share them. Confirming will close your other sessions.")}</small>
          <button className="primary" disabled={busy || oldCode.length!==6 || newCode.length!==6}>{emailText("Confirmar cambio de correo","Confirm email change")}</button>
          <button className="secondary" type="button" disabled={busy} onClick={()=>void emailAction("start")}>{emailText("Solicitar códigos nuevos","Request new codes")}</button>
          <button className="secondary" type="button" disabled={busy} onClick={()=>void emailAction("cancel")}>{emailText("Cancelar cambio","Cancel change")}</button>
        </form>}
        <button className="secondary" type="button" disabled={busy || emailLoading} onClick={()=>void emailAction("status")}>{emailText("Actualizar estado","Refresh status")}</button>
        <small>{emailText("Si ya no tiene acceso al correo actual, contacte a support@mrmaa.com para revisar su identidad.","If you no longer have access to your current email, contact support@mrmaa.com for an identity review.")}</small>
      </div>
    </section>
    <section className="moduleCard settingsPanel">
      <div className="moduleTitle"><div><h2>Transferir administración</h2><p>Convierta a otro usuario activo en administrador principal. Su cuenta pasará a Gerente.</p></div></div>
      <div className="formStack">
        <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
          <option value="">Seleccione un usuario activo…</option>
          {eligible.map((member) => <option value={member.user_id} key={member.user_id}>{member.name} · {member.email}</option>)}
        </select>
        <button type="button" className="secondary" disabled={busy || !targetUserId} onClick={() => {
          if (confirmApp("¿Confirma que desea transferir la administración de este restaurante?"))
            accountAction("transfer", { target_user_id: targetUserId });
        }}>Transferir administración</button>
      </div>
    </section>
    <section className="moduleCard settingsPanel dangerZone">
      <div className="moduleTitle"><div><h2>Eliminar mi cuenta</h2><p>Primero debe existir otro administrador activo. Esta acción elimina su acceso personal, no los datos del restaurante.</p></div></div>
      <div className="formStack">
        <label>Escriba <b>{confirmationText}</b> para confirmar
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        </label>
        <button type="button" className="dangerButton" disabled={busy || confirmation !== confirmationText} onClick={() => {
          if (confirmApp("Esta acción eliminará permanentemente su cuenta de acceso. ¿Desea continuar?"))
            accountAction("delete_account", { confirmation: "ELIMINAR MRMAA" });
        }}><Trash2 /> Eliminar definitivamente mi cuenta</button>
      </div>
    </section>
    {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
  </div>;
}

export function EnhancedSettings({
  restaurantId,
  restaurantName,
  onNameChange,
  onSettingsChange,
  onAreasChange,
  onProductsChange,
  catalogsOnly = false,
  planCode = "advanced",
  supportAccess,
}: {
  restaurantId: string;
  restaurantName: string;
  onNameChange: (x: string) => void;
  onSettingsChange: (x: any) => void;
  onAreasChange?: (areas: Area[]) => void;
  onProductsChange?: (products: Product[]) => void;
  catalogsOnly?: boolean;
  planCode?: string;
  supportAccess?: "view" | "edit";
}) {
  const { language, setPreferences } = useAppPreferences();
  const tabLabels: Record<string, [string, string]> = {
    soporte: ["Soporte", "Support"],
    general: ["General", "General"], reservaciones: ["Reservaciones", "Reservations"],
    cotizaciones: ["Cotizaciones", "Quotes"], horarios: ["Horarios", "Schedules"],
    usuarios: ["Usuarios", "Users"], cuenta: ["Cuenta", "Account"],
    suscripción: ["Suscripción", "Subscription"], seguridad: ["Seguridad", "Security"],
    "verificación en dos pasos": ["Verificación en dos pasos", "Two-step verification"],
  };
  const tabLabel = (key: string) => tabLabels[key]?.[language === "en" ? 1 : 0] || key;
  const persistedSettingsRef = useRef<any>({});
  const remoteVersion = useDataRefresh(restaurantId, 'v2_restaurants,v2_reservation_areas,v2_quote_products,v2_areas,v2_shifts,v2_employees');
  const loadGeneration = useRef(0);
  const dirtyRef = useRef(false);
  const settingsSnapshot = useRef('');
  const [settingsConflict, setSettingsConflict] = useState(false);
  const productSavingRef = useRef(false);
  const shiftSavingRef = useRef(false);
  const scheduleAreaSavingRef = useRef(false);
  const scheduleAreaNameRef = useRef<HTMLInputElement>(null);
  const reservationAreaNameRef = useRef<HTMLInputElement>(null);
  const [scheduleAreaBusy, setScheduleAreaBusy] = useState(false);
  const [scheduleAreaEditId, setScheduleAreaEditId] = useState("");
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftEditId, setShiftEditId] = useState("");
  const shiftNameRef = useRef<HTMLInputElement>(null);
  const logoPendingRef = useRef(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [tab, setTab] = useState(catalogsOnly ? "reservaciones" : "general"),
    [form, setForm] = useState<any>({
      name: restaurantName,
      phone: "",
      country: "Guatemala",
      language: "es",
      currency: "GTQ",
      quote_number_start: 2000,
      settings: {
        time_format: "24h",
        reservation_show_people: true,
        reservation_show_deposits: true,
        reservation_show_deposits_list: true,
        reservation_allow_deposits: true,
        quote_show_deposit_form: true,
        quote_show_deposit_view: true,
        discounts: true,
        tips: true,
        quote_font: "Georgia",
        quote_style: "moderna",
        quote_color: "#18181b",
        quote_text_color: "#18181b",
        quote_header_color: "#18181b",
        quote_middle_color: "#18181b",
        quote_accent: "#ea580c",
        fixed_customer_note: true,
        customer_note: "",
        logo_data_url: "",
        business_address: "",
        business_email: "",
        business_country: "Guatemala",
        business_phone: "",
        business_currency: "GTQ",
        quote_show_client_name: true,
        quote_show_client_phone: true,
        quote_show_client_email: true,
        quote_show_event_date: true,
        quote_show_event_time: true,
        quote_show_area: true,
        quote_show_guests: true,
        quote_show_customer_note: true,
        quote_custom_client_fields: [],
        quote_custom_adjustments: [],
      },
    }),
    [areas, setAreas] = useState<Area[]>([]),
    [employees, setEmployees] = useState<Employee[]>([]),
    [shifts, setShifts] = useState<Shift[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [reservationAreas, setReservationAreas] = useState<Area[]>([]),
    [reservationAreaName, setReservationAreaName] = useState(""),
    [reservationAreaEdit, setReservationAreaEdit] = useState(""),
    [areaBusy, setAreaBusy] = useState(false),
    [areaName, setAreaName] = useState(""),
    [employee, setEmployee] = useState({ name: "", employee_code: "", phone: "", area_id: "" }),
    [employeeEditId, setEmployeeEditId] = useState(""),
    [shift, setShift] = useState(newShiftDraft),
    [product, setProduct] = useState<any>({ name: "", description: "", price: 0 }),
    [productEditId, setProductEditId] = useState(""),
    [productBusy, setProductBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [removeLogoBackground, setRemoveLogoBackground] = useState(true),
    [savedSignature, setSavedSignature] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const employeeListRef = useRef<HTMLDivElement>(null);
  const employeeAreas = useMemo(() => new Map(areas.map(area => [area.id, area.name])), [areas]);
  const filteredEmployees = useMemo(() => {
    const terms = normalizeArea(employeeSearch).split(" ").filter(Boolean);
    if (!terms.length) return employees;
    return employees.filter(row => {
      const area = employeeAreas.get(row.area_id || "") || (language === "en" ? "No area" : "Sin área");
      const text = normalizeArea([row.name, row.employee_code, row.phone, area].filter(Boolean).join(" "));
      const phone = (row.phone || "").replace(/\D/g, "");
      return terms.every(term => text.includes(term) || (/^\+?[\d()-]+$/.test(term) && /\d/.test(term) && phone.includes(term.replace(/\D/g, ""))));
    });
  }, [employees, employeeAreas, employeeSearch, language]);
  useEffect(() => {
    if (employeeListRef.current) employeeListRef.current.scrollTop = 0;
  }, [employeeSearch, tab, restaurantId]);
  function editShift(row: Shift) {
    if (shiftBusy || !confirmDiscardChanges()) return;
    setShiftEditId(row.id); setShift(shiftDraftFromRow(row));
    requestAnimationFrame(() => {
      shiftNameRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
      shiftNameRef.current?.focus({ preventScroll: true });
    });
  }
  const [customClientField, setCustomClientField] = useState({
    label: "",
    type: "text",
  });
  const [customAdjustment, setCustomAdjustment] = useState<any>({
    label: "",
    kind: "discount",
    mode: "fixed",
    default_value: 0,
  });
  const load = useCallback(async (background = true) => {
    const generation = ++loadGeneration.current;
    try {
    const [r, a, e, s, p, ra] = await Promise.all([
      supabase
        .from("v2_restaurants")
        .select(
          "name,phone,country,language,currency,quote_number_start,settings",
        )
        .eq("id", restaurantId)
        .single(),
      readCatalog(supabase, restaurantId, "v2_areas", "name", false),
      readCatalog(supabase, restaurantId, "v2_employees", "name", false),
      readCatalog(supabase, restaurantId, "v2_shifts", "start_time", false),
      readCatalog(supabase, restaurantId, "v2_quote_products", "name", false),
      readCatalog(supabase, restaurantId, "v2_reservation_areas", "name", true),
    ]);
    if (generation !== loadGeneration.current) return;
    const error = r.error || a.error || e.error || s.error || p.error || ra.error;
    if (error) throw error;
    const snapshot = JSON.stringify(r.data);
    if (background && dirtyRef.current && settingsSnapshot.current && snapshot !== settingsSnapshot.current) setSettingsConflict(true);
    if (r.data && !(background && dirtyRef.current)) {
      settingsSnapshot.current = snapshot;
      setSettingsConflict(false);
      const loadedLanguage = appLanguage(r.data.language);
      const loadedCurrency = appCurrency(r.data.currency);
      persistedSettingsRef.current = r.data.settings || {};
      setForm((old: any) => {
        const loaded = {
          ...old,
          ...r.data,
          language: loadedLanguage,
          currency: loadedCurrency,
          settings: { ...old.settings, ...(r.data.settings || {}) },
        };
        loaded.settings.business_currency = loaded.currency;
        setSavedSignature(JSON.stringify(loaded));
        return loaded;
      });
      setPreferences(loadedLanguage, loadedCurrency);
    }
    setAreas((a.data || []) as Area[]);
    setEmployees((e.data || []) as Employee[]);
    setShifts((s.data || []) as Shift[]);
    setProducts((p.data || []) as Product[]);
    if (!p.error) onProductsChange?.(((p.data || []) as Product[]).filter(p => p.active));
    setReservationAreas((ra.data || []) as Area[]);
    if (!ra.error) onAreasChange?.((ra.data || []) as Area[]);
    } catch (error) {
      if (generation === loadGeneration.current) setNotice(userMessage(error));
    }
  }, [restaurantId, setPreferences, onAreasChange, onProductsChange]);
  useEffect(() => {
    void load(false);
    return () => { loadGeneration.current++; };
  }, [load]);
  useEffect(() => {
    if (catalogsOnly && !["reservaciones", "cotizaciones", "verificación en dos pasos"].includes(tab)) setTab("reservaciones");
    if (!planFor(planCode).schedules && tab === "horarios") setTab("general");
  }, [catalogsOnly, planCode, tab]);
  const sectionSignature = (source: any, section: string) => {
    const s = source?.settings || {};
    if (section === "general") return JSON.stringify({ name: source?.name, phone: source?.phone, country: source?.country, language: source?.language, currency: source?.currency, logo: s.logo_data_url, address: s.business_address, email: s.business_email, time_format: s.time_format });
    if (section === "reservaciones") return JSON.stringify({ people: s.reservation_show_people, deposits: s.reservation_show_deposits, listDeposits: s.reservation_show_deposits_list, allowDeposits: s.reservation_allow_deposits });
    if (section === "cotizaciones") return JSON.stringify({ quote_number_start: source?.quote_number_start, ...Object.fromEntries(Object.entries(s).filter(([key]) => key.startsWith("quote_") || ["discounts", "tips", "fixed_customer_note", "customer_note"].includes(key))) });
    if (section === "horarios") return JSON.stringify({ time_format: s.time_format });
    return "saved-immediately";
  };
  const savedForm = savedSignature ? JSON.parse(savedSignature) : null;
  const sectionChanged = Boolean(savedForm && sectionSignature(form, tab) !== sectionSignature(savedForm, tab));
  const pendingDraft = tab === "horarios"
    ? Boolean(scheduleAreaEditId || areaName.trim() || employee.name.trim() || employee.employee_code.trim() || employee.phone.trim() || employee.area_id || shift.name.trim() || shift.start_time !== "09:00" || shift.end_time !== "17:00" || shift.break_minutes !== 0 || shift.start_mode !== "time" || shift.end_mode !== "time" || shift.start_text.trim() || shift.end_text.trim() || shift.start_calculate || shift.end_calculate || shift.calculation_start_time || shift.calculation_end_time)
    : tab === "cotizaciones"
      ? Boolean(product.name.trim() || product.description?.trim() || Number(product.price) || customClientField.label.trim() || customAdjustment.label.trim())
      : tab === "reservaciones" ? Boolean(reservationAreaName.trim()) : false;
  const settingsDirty = sectionChanged || pendingDraft;
  const anySettingsDirty = Boolean(savedForm && ["general", "reservaciones", "cotizaciones", "horarios"].some((section) => sectionSignature(form, section) !== sectionSignature(savedForm, section))) || pendingDraft;
  dirtyRef.current = anySettingsDirty;
  useOnDataRefresh(remoteVersion, () => { void load(true); });
  useEffect(() => { if (settingsConflict && !anySettingsDirty) void load(true); }, [settingsConflict, anySettingsDirty, load]);
  useUnsavedChanges(anySettingsDirty, () => {
    ["general", "reservaciones", "cotizaciones", "horarios"].forEach(discardCurrentSection);
  });
  const settingBelongsToSection = (key: string, section: string) => {
    if (section === "horarios") return key === "time_format";
    if (section === "general")
      return [
        "logo_data_url",
        "business_address",
        "business_email",
        "business_phone",
        "business_country",
        "business_currency",
        "time_format",
      ].includes(key);
    if (section === "reservaciones")
      return [
        "reservation_show_people",
        "reservation_show_deposits",
        "reservation_show_deposits_list",
        "reservation_allow_deposits",
      ].includes(key);
    if (section === "cotizaciones")
      return (
        key.startsWith("quote_") ||
        [
          "discounts",
          "tips",
          "fixed_customer_note",
          "customer_note",
        ].includes(key)
      );
    return false;
  };
  function discardCurrentSection(section: string) {
    if (section === "reservaciones") { setReservationAreaName(""); setReservationAreaEdit(""); }
    if (savedForm && ["general", "reservaciones", "cotizaciones", "horarios"].includes(section)) {
      setForm((current: any) => {
        const restoredSettings = { ...(current.settings || {}) };
        const savedSettings = savedForm.settings || {};
        const keys = new Set([
          ...Object.keys(restoredSettings),
          ...Object.keys(savedSettings),
        ]);
        keys.forEach((key) => {
          if (!settingBelongsToSection(key, section)) return;
          if (Object.prototype.hasOwnProperty.call(savedSettings, key))
            restoredSettings[key] = savedSettings[key];
          else delete restoredSettings[key];
        });
        const restored = { ...current, settings: restoredSettings };
        if (section === "general") {
          restored.name = savedForm.name;
          restored.phone = savedForm.phone;
          restored.country = savedForm.country;
          restored.language = savedForm.language;
          restored.currency = savedForm.currency;
          setPreferences(savedForm.language, savedForm.currency);
        }
        if (section === "cotizaciones")
          restored.quote_number_start = savedForm.quote_number_start;
        return restored;
      });
    }
    if (section === "horarios") {
      setShiftEditId("");
      setAreaName("");
      setScheduleAreaEditId("");
      setEmployee({ name: "", employee_code: "", phone: "", area_id: "" });
      setEmployeeEditId("");
      setShift(newShiftDraft());
    }
    if (section === "cotizaciones") {
      setProduct({ name: "", description: "", price: 0 });
      setProductEditId("");
      setCustomClientField({ label: "", type: "text" });
      setCustomAdjustment({
        label: "",
        kind: "discount",
        mode: "fixed",
        default_value: 0,
      });
    }
  }
  async function authorizeSettings() {
    try {
      await requirePermission(supabase, restaurantId, "canManageSettings");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? userMessage(error) : ACCESS_DENIED);
      return false;
    }
  }
  async function authorizeProducts() {
    try {
      await requirePermission(supabase, restaurantId, "canManageQuoteProducts");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? userMessage(error) : ACCESS_DENIED);
      return false;
    }
  }
  async function authorizeReservationAreas() {
    try {
      await requirePermission(supabase, restaurantId, "canManageReservationAreas");
      return true;
    } catch (error) {
      setNotice(userMessage(error));
      return false;
    }
  }
  async function save() {
    if (logoPendingRef.current) { setNotice("Espere a que termine de cargar el logo antes de guardar."); return; }
    if (settingsConflict) { setNotice('La configuración cambió. Cargue la versión actual antes de guardar.'); return; }
    if (!(await authorizeSettings())) return;
    // Preserve assets from the settings loaded from Supabase without adding a
    // second network round trip every time the administrator presses Save.
    const currentSettings = persistedSettingsRef.current || {};
    const nextForm = {
      ...form,
      settings: {
        ...currentSettings,
        ...form.settings,
        logo_data_url:
          form.settings?.logo_data_url || currentSettings.logo_data_url || "",
        business_phone: form.phone,
        business_country: form.country,
        business_currency: form.currency,
      },
    };
    const r = await supabase
      .from("v2_restaurants")
      .update(nextForm)
      .eq("id", restaurantId).select("id").single();
    if (r.error) return setNotice(userMessage(r.error));
    persistedSettingsRef.current = nextForm.settings;
    onNameChange(form.name);
    setForm(nextForm);
    setSavedSignature(JSON.stringify(nextForm));
    onSettingsChange(nextForm.settings);
    setPreferences(nextForm.language, nextForm.currency);
    setNotice("Configuración guardada.");
  }
  async function selectLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || logoPendingRef.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return setNotice("Seleccione una imagen válida.");
    if (file.size > 8000000)
      return setNotice("El logo debe pesar menos de 8 MB.");
    logoPendingRef.current = true;
    setLogoBusy(true);
    const localUrl = URL.createObjectURL(file);
    try {
      if (!(await authorizeSettings())) return;
      setNotice("Cargando logo…");
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("No se pudo leer la imagen. Use PNG, JPG o WebP."));
        image.src = localUrl;
      });
        const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No se pudo procesar el logo.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (removeLogoBackground) removeConnectedLogoBackground(canvas);
        const legacyDataUrl = canvas.toDataURL("image/png");
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("No se pudo procesar el logo.")), "image/png"));
          const path = `${restaurantId}/logo-${crypto.randomUUID()}.png`;
          const uploaded = await supabase.storage.from("mrmaa-branding").upload(path, blob, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: false,
          });
          if (uploaded.error) {
            // Keeps existing projects functional even if Storage isn't set up
            // yet. The technical reason goes to the console for whoever is
            // debugging — never to the on-screen notice, which every admin
            // user sees; a raw Supabase/Postgres error there would leak
            // internal details to them, the same reason userMessage() exists.
            console.error("MRMAA logo upload (Storage) falló:", uploaded.error);
            setting("logo_data_url", legacyDataUrl);
            return setNotice("Logo cargado en modo de compatibilidad. Presione Guardar configuración.");
          }
          const publicUrl = supabase.storage.from("mrmaa-branding").getPublicUrl(path).data.publicUrl;
          // An upload can succeed even when a bucket is private or the URL is
          // blocked. Only use the remote asset after the browser can display it.
          const visible = await new Promise<boolean>((resolve) => {
            const probe = new Image();
            const finish = (ok: boolean) => {
              clearTimeout(timer);
              probe.onload = null;
              probe.onerror = null;
              resolve(ok);
            };
            const timer = setTimeout(() => finish(false), 10000);
            probe.onload = () => finish(probe.naturalWidth > 0);
            probe.onerror = () => finish(false);
            probe.src = publicUrl;
          });
          setting("logo_data_url", visible ? publicUrl : legacyDataUrl);
          setNotice("Logo cargado. Presione Guardar configuración.");
    } catch (error) {
      // Same reasoning as the Storage branch above: log the real error for
      // whoever is debugging in DevTools, but keep the on-screen message
      // safe/generic (userMessage intentionally hides technical details from
      // end users — that's correct for them, but it means this console.error
      // is the only way to actually diagnose a logo-upload failure).
      console.error("MRMAA logo upload falló:", error);
      setNotice(userMessage(error));
    } finally {
      URL.revokeObjectURL(localUrl);
      logoPendingRef.current = false;
      setLogoBusy(false);
    }
  }
  async function removeReservationArea(area: Area) {
    if (areaBusy || !(await authorizeReservationAreas())) return;
    const en = appLanguage(form.language) === "en";
    if (!confirmApp(en
      ? `Remove “${area.name}” from available areas? Existing reservations and quotes will keep their history.`
      : `¿Eliminar “${area.name}” de las áreas disponibles? Las reservas y cotizaciones anteriores conservarán su historial.`)) return;
    setAreaBusy(true);
    try {
      const result = await supabase.from("v2_reservation_areas")
        .update({ active: false }).eq("id", area.id).eq("restaurant_id", restaurantId).select("id").single();
      if (result.error) { setNotice(userMessage(result.error)); return; }
      if (reservationAreaEdit === area.id) {
        setReservationAreaEdit(""); setReservationAreaName("");
      }
      await load();
    } catch (error) { setNotice(userMessage(error)); }
    finally { setAreaBusy(false); }
  }
  async function saveReservationArea(event: React.FormEvent) {
    event.preventDefault();
    const name = reservationAreaName.trim();
    if (!name || areaBusy || !(await authorizeReservationAreas())) return;
    setAreaBusy(true);
    try {
      let result = reservationAreaEdit
        ? await supabase.from("v2_reservation_areas").update({ name }).eq("id", reservationAreaEdit).eq("restaurant_id", restaurantId).select("id").single()
        : await supabase.from("v2_reservation_areas").insert({ restaurant_id: restaurantId, name }).select("id").single();
      if (result.error?.code === "23505" && !reservationAreaEdit) {
        // Re-adding a removed area restores its identity and historical links.
        const previous = await supabase.from("v2_reservation_areas").select("id,name,active").eq("restaurant_id", restaurantId);
        if (previous.error) { setNotice(userMessage(previous.error)); return; }
        const match = previous.data?.find(area => normalizeArea(area.name) === normalizeArea(name));
        if (match && !match.active) {
          result = await supabase.from("v2_reservation_areas").update({ name, active: true })
            .eq("restaurant_id", restaurantId).eq("id", match.id).eq("active", false).select("id").single();
        } else { setNotice("Ya existe un área con ese nombre."); return; }
      }
      if (result.error) { setNotice(userMessage(result.error)); return; }
      setReservationAreaName(""); setReservationAreaEdit("");
      await load();
    } catch (error) { setNotice(userMessage(error)); }
    finally { setAreaBusy(false); }
  }
  function editScheduleArea(area: Area) {
    if (scheduleAreaSavingRef.current || !confirmDiscardChanges()) return;
    setScheduleAreaEditId(area.id); setAreaName(area.name);
    requestAnimationFrame(() => {
      scheduleAreaNameRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
      scheduleAreaNameRef.current?.focus({ preventScroll: true });
    });
  }
  function editReservationArea(area: Area) {
    if (areaBusy || !confirmDiscardChanges()) return;
    setReservationAreaEdit(area.id); setReservationAreaName(area.name);
    requestAnimationFrame(() => {
      reservationAreaNameRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
      reservationAreaNameRef.current?.focus({ preventScroll: true });
    });
  }
  async function saveScheduleArea(e: React.FormEvent) {
    e.preventDefault();
    const name = areaName.trim();
    if (!name || scheduleAreaSavingRef.current) return;
    scheduleAreaSavingRef.current = true; setScheduleAreaBusy(true);
    try {
      if (!(await authorizeSettings())) return;
      // Rename the existing ID so employee and schedule references stay intact.
      const result = scheduleAreaEditId
        ? await supabase.from("v2_areas").update({ name }).eq("id", scheduleAreaEditId).eq("restaurant_id", restaurantId).select("id").single()
        : await supabase.from("v2_areas").insert({ restaurant_id: restaurantId, name }).select("id").single();
      if (result.error) { setNotice(userMessage(result.error)); return; }
      setAreaName(""); setScheduleAreaEditId("");
      setNotice(language === "en" ? "Area saved." : "Área guardada.");
      await load();
    } catch (error) { setNotice(userMessage(error)); }
    finally { scheduleAreaSavingRef.current = false; setScheduleAreaBusy(false); }
  }
  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    if (shiftSavingRef.current) return;
    const payload = shiftDraftPayload(shift);
    if (!payload) return setNotice(language === "en" ? "Complete the shift name, start and end, including any enabled calculation times." : "Complete el nombre, entrada y salida; revise también las horas de cálculo activadas.");
    shiftSavingRef.current = true; setShiftBusy(true);
    try {
      if (!(await authorizeSettings())) return;
      const r = shiftEditId
        ? await supabase.from("v2_shifts").update(payload).eq("restaurant_id", restaurantId).eq("id", shiftEditId).select("id").single()
        : await supabase.from("v2_shifts").insert({ restaurant_id: restaurantId, ...payload }).select("id").single();
      if (r.error) return setNotice(userMessage(r.error));
      setShift(newShiftDraft());
      setShiftEditId("");
      setNotice(language === "en" ? "Shift saved." : "Turno guardado.");
      await load();
    } catch (error) { setNotice(userMessage(error)); }
    finally { shiftSavingRef.current = false; setShiftBusy(false); }
  }
  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorizeSettings())) return;
    const payload = {
      restaurant_id: restaurantId,
      ...employee,
      area_id: employee.area_id || null,
    };
    const r = employeeEditId
      ? await supabase.from("v2_employees").update(payload).eq("id", employeeEditId)
      : await supabase.from("v2_employees").insert(payload);
    if (r.error) return setNotice(userMessage(r.error));
    setEmployee({ name: "", employee_code: "", phone: "", area_id: "" });
    setEmployeeEditId("");
    setNotice(employeeEditId ? "Empleado actualizado." : "Empleado agregado.");
    load();
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (productSavingRef.current) return;
    const name = product.name.trim();
    if (!name) return;
    productSavingRef.current = true;
    setProductBusy(true);
    setNotice("");
    try {
      if (!(await authorizeProducts())) return;
      const payload = { name, description: product.description, price: Number(product.price) };
      const current = await supabase.auth.getSession();
      const accessToken = current.data.session?.access_token;
      if (!accessToken) return setNotice("Su sesión no es válida. Inicie sesión nuevamente.");
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ restaurant_id: restaurantId, id: productEditId || undefined, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(result.error || "No fue posible guardar el menú o producto. Intente nuevamente.");
      setNotice(productEditId ? "Menú o producto actualizado." : "Menú o producto agregado.");
      setProduct({ name: "", description: "", price: 0 }); setProductEditId("");
      await load();
    } finally { productSavingRef.current = false; setProductBusy(false); }
  }
  async function del(table: string, id: string) {
    if (!(await authorizeSettings())) return;
    if (!confirmApp("¿Desea eliminar este elemento?")) return;
    const r = await supabase.from(table).delete().eq("id", id);
    if (r.error) return setNotice(userMessage(r.error));
    if (table === "v2_areas" && scheduleAreaEditId === id) {
      setScheduleAreaEditId(""); setAreaName("");
    }
    load();
  }
  const setting = (key: string, value: any) =>
    setForm((current: any) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  const configId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `field-${Date.now()}`;
  function addCustomClientField(e: React.FormEvent) {
    e.preventDefault();
    const label = customClientField.label.trim();
    if (!label) return;
    setting("quote_custom_client_fields", [
      ...(form.settings.quote_custom_client_fields || []),
      { id: configId(), label, type: customClientField.type, active: true },
    ]);
    setCustomClientField({ label: "", type: "text" });
  }
  function addCustomAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const label = customAdjustment.label.trim();
    if (!label) return;
    setting("quote_custom_adjustments", [
      ...(form.settings.quote_custom_adjustments || []),
      { ...customAdjustment, id: configId(), label, active: true },
    ]);
    setCustomAdjustment({
      label: "",
      kind: "discount",
      mode: "fixed",
      default_value: 0,
    });
  }
  const tabs = supportAccess ? ["general", "reservaciones", "cotizaciones", ...(planFor(planCode).schedules ? ["horarios"] : [])] : catalogsOnly ? ["reservaciones", "cotizaciones", "verificación en dos pasos"] : [
    "general",
    "reservaciones",
    "cotizaciones",
    ...(planFor(planCode).schedules ? ["horarios"] : []),
    "usuarios",
    "verificación en dos pasos",
    "cuenta",
    "suscripción",
    "seguridad",
    "soporte",
  ];
  return (
    <div className="settingsLayout">
      <aside>
        {tabs.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => {
              if (x === tab) return;
              if (!confirmDiscardChanges()) return;
              setTab(x);
            }}
            key={x}
          >
            <span translate="no">{tabLabel(x)}</span>
          </button>
        ))}
      </aside>
      {tab === "soporte" && !supportAccess && !catalogsOnly ? (<SupportAuthorization restaurantId={restaurantId} />) : tab === "usuarios" ? (
        <UsersModule restaurantId={restaurantId} defaultLanguage={emailLanguage(savedForm?.language)} />
      ) : tab === "verificación en dos pasos" ? (
        <MfaSettings />
      ) : tab === "cuenta" ? (
        <AccountSettings restaurantId={restaurantId} />
      ) : tab === "suscripción" ? (<BillingPanel restaurantId={restaurantId} />
      ) : tab === "seguridad" ? (
        <SecurityCenter restaurantId={restaurantId} />
      ) : (
        <fieldset disabled={supportAccess === "view"} className="moduleCard settingsPanel" style={{minWidth:0}}>
          {settingsConflict && <div className="moduleNotice" role="status">
            La configuración cambió. Su borrador se conserva. Cargar la versión actual descartará sus cambios pendientes.
            <button className="secondary" type="button" onClick={() => { if (confirmDiscardChanges()) void load(false); }}>Cargar versión actual</button>
          </div>}
          <div className="moduleTitle">
            <div>
              <h2 translate="no">{tabLabel(tab)}</h2>
              <p>Preferencias de esta sección.</p>
            </div>
          </div>
          {tab === "general" && (
            <div className="formStack">
              <div className="grid2">
                <label>
                  Restaurante
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  País
                  <input
                    value={form.country}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                  />
                </label>
                <label>
                  Dirección del negocio
                  <input
                    placeholder="Dirección que aparecerá en la cotización"
                    value={form.settings.business_address || ""}
                    onChange={(e) =>
                      setting("business_address", e.target.value)
                    }
                  />
                </label>
                <label>
                  Correo del negocio
                  <input
                    type="email"
                    placeholder="Correo que aparecerá en la cotización"
                    value={form.settings.business_email || ""}
                    onChange={(e) => setting("business_email", e.target.value)}
                  />
                </label>
                <label>
                  Idioma del restaurante
                  <select
                    value={form.language}
                    onChange={(e) => {
                      const language = appLanguage(e.target.value);
                      setForm({ ...form, language });
                      setPreferences(language, form.currency);
                    }}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                  <small>Este idioma se aplicará a toda la aplicación y será el idioma inicial de las nuevas invitaciones.</small>
                </label>
                <label>
                  Moneda
                  <select
                    value={form.currency}
                    onChange={(e) => {
                      const currency = appCurrency(e.target.value);
                      setForm({ ...form, currency });
                      setPreferences(form.language, currency);
                    }}
                  >
                    <option>GTQ</option>
                    <option>USD</option>
                    <option>MXN</option>
                  </select>
                </label>
                <label translate="no">
                  {language === "en" ? "Time format" : "Formato de hora"}
                  <select value={form.settings.time_format === "12h" ? "12h" : "24h"} onChange={e => setting("time_format", e.target.value)}>
                    <option value="24h">{language === "en" ? "24 hours · 19:00" : "24 horas · 19:00"}</option>
                    <option value="12h">{language === "en" ? "12 hours · 07:00 PM" : "12 horas · 07:00 PM"}</option>
                  </select>
                  <small>{language === "en" ? "Applies to reservations, quotes and schedules for the whole restaurant. Save to apply." : "Se aplica a reservaciones, cotizaciones y horarios de todo el restaurante. Guarde para aplicar."}</small>
                </label>
              </div>
              <label className="logoUploader">
                Logo del negocio (hasta 8 MB)
                <span className="checkLine">
                  <input
                    type="checkbox"
                    checked={removeLogoBackground}
                    onChange={(e) => setRemoveLogoBackground(e.target.checked)}
                  />
                  Quitar automáticamente el fondo blanco
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={logoBusy}
                  onChange={selectLogo}
                />
                {form.settings.logo_data_url && (
                  <TransparentLogo
                    src={form.settings.logo_data_url}
                    alt="Vista previa del logo"
                  />
                )}
              </label>
            </div>
          )}
          {tab === "reservaciones" && (
            <div className="automationList">
              <section className="moduleCard" translate="no"><h3>{language === "en" ? "Reservation areas" : "Áreas para reservaciones"}</h3>
                <form className="inlineForm areaSettingsForm" onSubmit={saveReservationArea}>
                  <input ref={reservationAreaNameRef} required disabled={areaBusy} value={reservationAreaName} onChange={e => setReservationAreaName(e.target.value)} aria-label={language === "en" ? "Reservation area name" : "Nombre del área de reservaciones"} placeholder={language === "en" ? "Area name" : "Nombre del área"} />
                  <button className="primary" disabled={areaBusy}>{language === "en" ? (reservationAreaEdit ? "Save changes" : "Add") : (reservationAreaEdit ? "Guardar cambios" : "Agregar")}</button>
                  {reservationAreaEdit && <button type="button" disabled={areaBusy} onClick={() => { setReservationAreaEdit(""); setReservationAreaName(""); }}>{language === "en" ? "Cancel" : "Cancelar"}</button>}
                </form>
                <div className="compactList areaSettingsList" role="region" tabIndex={0} aria-label={language === "en" ? "Saved reservation areas" : "Áreas de reservaciones guardadas"}>
                  {reservationAreas.map(a => <article key={a.id} className={reservationAreaEdit === a.id ? "catalogSettingsEditing" : undefined}>
                    <b>{a.name}</b>
                    <div className="rowActions">
                      <button type="button" disabled={areaBusy} aria-label={`${language === "en" ? "Edit area" : "Editar área"}: ${a.name}`} onClick={() => editReservationArea(a)}><Pencil aria-hidden="true"/>{language === "en" ? "Edit" : "Editar"}</button>
                      <button type="button" disabled={areaBusy} aria-label={`${language === "en" ? "Delete area" : "Eliminar área"}: ${a.name}`} onClick={() => removeReservationArea(a)}><Trash2 aria-hidden="true"/>{language === "en" ? "Delete" : "Eliminar"}</button>
                    </div>
                  </article>)}
                </div>
                {!reservationAreas.length && <p>{language === "en" ? "No reservation areas yet. Add your first area." : "No hay áreas de reservaciones. Agregue su primera área."}</p>}
                <small>{language === "en" ? "These areas are independent of Schedules. Scroll the list to see more." : "Estas áreas son independientes de Horarios. Desplace la lista para ver más."}</small>
              </section>
              {!catalogsOnly && <><Toggle
                title="Mostrar total de personas"
                checked={form.settings.reservation_show_people}
                set={(v) => setting("reservation_show_people", v)}
              />
              <Toggle
                title="Mostrar total de anticipos en el encabezado de Reservaciones"
                checked={form.settings.reservation_show_deposits}
                set={(v) => setting("reservation_show_deposits", v)}
              />
              <Toggle
                title="Mostrar anticipo y método de pago en la lista de Reservaciones"
                checked={form.settings.reservation_show_deposits_list !== false}
                set={(v) => setting("reservation_show_deposits_list", v)}
              />
              <Toggle
                title="Mostrar anticipos en el formulario de reservación"
                checked={form.settings.reservation_allow_deposits !== false}
                set={(v) => setting("reservation_allow_deposits", v)}
              />
              <p>Ocultar anticipos conserva los importes registrados y el cálculo del saldo.</p>
              </>}
            </div>
          )}
          {tab === "cotizaciones" && (
            <div className="formStack">
              {!catalogsOnly && <>
              <Toggle title="Mostrar anticipos en el formulario de cotización" checked={form.settings.quote_show_deposit_form !== false} set={v=>setting("quote_show_deposit_form",v)} />
              <Toggle title="Mostrar anticipos en la cotización (vista previa, PDF e impresión)" checked={form.settings.quote_show_deposit_view !== false} set={v=>setting("quote_show_deposit_view",v)} />
              <p>Ocultar anticipos conserva los importes registrados y el cálculo del saldo.</p>
              <div>
                <h3>Estilo de cotización</h3>
                <div className="styleChoices">
                  {[
                    ["moderna", "Moderna", "Limpia, visual y contemporánea"],
                    ["clasica", "Clásica", "Formal, elegante y tradicional"],
                    ["basica", "Básica", "Directa, compacta y sencilla"],
                  ].map(([value, title, description]) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        form.settings.quote_style === value ? "active" : ""
                      }
                      onClick={() => setting("quote_style", value)}
                    >
                      <b>{title}</b>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid2">
                <label>
                  Numeración inicial
                  <input
                    type="number"
                    value={form.quote_number_start}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quote_number_start:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Tipografía
                  <select
                    value={form.settings.quote_font}
                    onChange={(e) => setting("quote_font", e.target.value)}
                  >
                    <option>Georgia</option>
                    <option>Arial</option>
                    <option>Helvetica</option>
                    <option>Times New Roman</option>
                  </select>
                </label>
                <label>
                  Color de la letra
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_text_color || form.settings.quote_color}
                      onChange={(e) => setting("quote_text_color", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_text_color || form.settings.quote_color} />
                  </span>
                </label>
                <label>
                  Color del encabezado
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_header_color || form.settings.quote_color}
                      onChange={(e) => setting("quote_header_color", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_header_color || form.settings.quote_color} />
                  </span>
                </label>
                <label>
                  Color del encabezado de productos
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_middle_color || "#18181b"}
                      onChange={(e) => setting("quote_middle_color", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_middle_color || "#18181b"} />
                  </span>
                </label>
                <label>
                  Color de acento
                  <span className="colorControl">
                    <input
                      type="color"
                      value={form.settings.quote_accent}
                      onChange={(e) => setting("quote_accent", e.target.value)}
                    />
                    <input readOnly value={form.settings.quote_accent} />
                  </span>
                </label>
              </div>
              <div>
                <h3>Campos visibles en la cotización</h3>
                <p className="sectionHint">
                  Quite los campos que no desea mostrar al cliente en el
                  preview y PDF.
                </p>
                <div className="automationList quoteFieldToggles">
                  {[
                    ["quote_show_client_name", "Nombre del cliente"],
                    ["quote_show_client_phone", "Teléfono del cliente"],
                    ["quote_show_client_email", "Correo del cliente"],
                    ["quote_show_event_date", "Fecha del evento"],
                    ["quote_show_event_time", "Hora del evento"],
                    ["quote_show_area", "Área del evento"],
                    ["quote_show_guests", "Número de invitados"],
                    ["quote_show_customer_note", "Nota para el cliente"],
                  ].filter(([key]) => form.settings[key] !== false).map(([key, title]) => (
                    <article key={key} className="configFieldRow">
                      <b>{title}</b>
                      <button type="button" className="iconButton" title="Quitar campo" onClick={() => setting(key, false)}><Trash2 /></button>
                    </article>
                  ))}
                </div>
                {[
                  ["quote_show_client_name", "Nombre del cliente"],
                  ["quote_show_client_phone", "Teléfono del cliente"],
                  ["quote_show_client_email", "Correo del cliente"],
                  ["quote_show_event_date", "Fecha del evento"],
                  ["quote_show_event_time", "Hora del evento"],
                  ["quote_show_area", "Área del evento"],
                  ["quote_show_guests", "Número de invitados"],
                  ["quote_show_customer_note", "Nota para el cliente"],
                ].some(([key]) => form.settings[key] === false) && <div className="buttonRow">
                  <span>Restaurar:</span>
                  {[
                    ["quote_show_client_name", "Nombre"], ["quote_show_client_phone", "Teléfono"],
                    ["quote_show_client_email", "Correo"], ["quote_show_event_date", "Fecha"],
                    ["quote_show_event_time", "Hora"], ["quote_show_area", "Área"],
                    ["quote_show_guests", "Invitados"], ["quote_show_customer_note", "Nota"],
                  ].filter(([key]) => form.settings[key] === false).map(([key, title]) =>
                    <button key={key} type="button" className="secondary" onClick={() => setting(key, true)}>+ {title}</button>
                  )}
                </div>}
              </div>
              <div className="configBuilder">
                <div>
                  <h3>Campos adicionales del cliente</h3>
                  <p className="sectionHint">
                    Agregue datos como empresa, NIT, dirección o notas. Se
                    completarán por separado en cada cotización.
                  </p>
                </div>
                <form className="customConfigForm" onSubmit={addCustomClientField}>
                  <input
                    required
                    placeholder="Nombre del campo"
                    value={customClientField.label}
                    onChange={(e) =>
                      setCustomClientField({
                        ...customClientField,
                        label: e.target.value,
                      })
                    }
                  />
                  <select
                    value={customClientField.type}
                    onChange={(e) =>
                      setCustomClientField({
                        ...customClientField,
                        type: e.target.value,
                      })
                    }
                  >
                    <option value="text">Texto corto</option>
                    <option value="textarea">Notas</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                  </select>
                  <button className="secondary" type="submit">Agregar campo</button>
                </form>
                <div className="configRows">
                  {(form.settings.quote_custom_client_fields || []).map((field: any) => (
                    <article key={field.id}>
                      <div><b>{field.label}</b><small>{field.type}</small></div>
                      <Toggle
                        title="Mostrar"
                        checked={field.active !== false}
                        set={(active) =>
                          setting(
                            "quote_custom_client_fields",
                            form.settings.quote_custom_client_fields.map((x: any) =>
                              x.id === field.id ? { ...x, active } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="iconButton"
                        aria-label={`Eliminar ${field.label}`}
                        onClick={() =>
                          setting(
                            "quote_custom_client_fields",
                            form.settings.quote_custom_client_fields.filter((x: any) => x.id !== field.id),
                          )
                        }
                      ><Trash2 /></button>
                    </article>
                  ))}
                </div>
              </div>
              <Toggle
                title="Permitir descuentos"
                checked={form.settings.discounts}
                set={(v) => setting("discounts", v)}
              />
              <Toggle
                title="Calcular propina"
                checked={form.settings.tips}
                set={(v) => setting("tips", v)}
              />
              <div className="configBuilder">
                <div>
                  <h3>Cobros y descuentos adicionales</h3>
                  <p className="sectionHint">
                    Estos conceptos aparecerán debajo de la propina y afectarán
                    el total, el saldo, el preview y el PDF.
                  </p>
                </div>
                <form className="customConfigForm adjustmentBuilder" onSubmit={addCustomAdjustment}>
                  <input
                    required
                    placeholder="Ej. Descuento de anticipo de evento"
                    value={customAdjustment.label}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, label: e.target.value })}
                  />
                  <select
                    value={customAdjustment.kind}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, kind: e.target.value })}
                  >
                    <option value="discount">Descuento</option>
                    <option value="charge">Cobro</option>
                  </select>
                  <select
                    value={customAdjustment.mode}
                    onChange={(e) => setCustomAdjustment({ ...customAdjustment, mode: e.target.value })}
                  >
                    <option value="fixed">Monto fijo</option>
                    <option value="percent">Porcentaje</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    aria-label="Valor predeterminado"
                    value={customAdjustment.default_value}
                    onChange={(e) => setCustomAdjustment({
                      ...customAdjustment,
                      default_value: e.target.value === "" ? "" : Number(e.target.value),
                    })}
                  />
                  <button className="secondary" type="submit">Agregar concepto</button>
                </form>
                <div className="configRows">
                  {(form.settings.quote_custom_adjustments || []).map((charge: any) => (
                    <article key={charge.id}>
                      <div>
                        <b>{charge.label}</b>
                        <small>{charge.kind === "discount" ? "Descuento" : "Cobro"} · {charge.mode === "percent" ? "Porcentaje" : "Monto fijo"}</small>
                      </div>
                      <Toggle
                        title="Usar"
                        checked={charge.active !== false}
                        set={(active) =>
                          setting(
                            "quote_custom_adjustments",
                            form.settings.quote_custom_adjustments.map((x: any) =>
                              x.id === charge.id ? { ...x, active } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="iconButton"
                        aria-label={`Eliminar ${charge.label}`}
                        onClick={() =>
                          setting(
                            "quote_custom_adjustments",
                            form.settings.quote_custom_adjustments.filter((x: any) => x.id !== charge.id),
                          )
                        }
                      ><Trash2 /></button>
                    </article>
                  ))}
                </div>
              </div>
              <Toggle
                title="Mensaje fijo para cliente"
                checked={form.settings.fixed_customer_note}
                set={(v) => setting("fixed_customer_note", v)}
              />
              {form.settings.fixed_customer_note && (
                <label>
                  Mensaje fijo
                  <textarea
                    value={form.settings.customer_note}
                    onChange={(e) => setting("customer_note", e.target.value)}
                  />
                </label>
              )}
              </>}
              <h3>Menús y productos</h3>
              <p>Puede escribir la descripción en varias líneas. Presione Enter para agregar otra línea.</p>
              <form className="productForm" onSubmit={addProduct}>
                <input
                  required
                  placeholder="Nombre"
                  value={product.name}
                  onChange={(e) =>
                    setProduct({ ...product, name: e.target.value })
                  }
                />
                <textarea
                  rows={5}
                  style={{ resize: "vertical" }}
                  placeholder="Descripción"
                  value={product.description}
                  onChange={(e) =>
                    setProduct({ ...product, description: e.target.value })
                  }
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Precio"
                  value={product.price}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      price: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
                <button className="primary" disabled={productBusy}>{productEditId ? "Guardar cambios" : "Agregar"}</button>
                {productEditId && <button type="button" disabled={productBusy} onClick={() => { if (confirmDiscardChanges()) { setProductEditId(""); setProduct({name:"",description:"",price:0}); } }}>Cancelar</button>}
              </form>
              <div className="compactList">
                {products.map((p) => (
                  <article key={p.id}>
                    <div>
                      <b>
                        {p.name} · {formatAppMoney(p.price)}
                      </b>
                      <small style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.description}</small>
                    </div>
                    <div className="rowActions">
                    <button type="button" disabled={productBusy} onClick={() => {
                      if (!confirmDiscardChanges()) return;
                      setProductEditId(p.id); setProduct({name:p.name,description:p.description || "",price:p.price});
                    }}><Pencil /> Editar</button>
                    {!catalogsOnly && <button type="button" disabled={productBusy} onClick={() => del("v2_quote_products", p.id)}>
                      <Trash2 />
                    </button>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
          {tab === "horarios" && (
            <div className="formStack">
              <div>
                <h3>Empleados</h3>
                <form className="productForm" onSubmit={addEmployee}>
                  <input
                    required
                    placeholder="Nombre"
                    value={employee.name}
                    onChange={(e) =>
                      setEmployee({ ...employee, name: e.target.value })
                    }
                  />
                  <input
                    placeholder="ID del empleado (opcional)"
                    value={employee.employee_code}
                    onChange={(e) =>
                      setEmployee({ ...employee, employee_code: e.target.value })
                    }
                  />
                  <input
                    placeholder="Teléfono"
                    value={employee.phone}
                    onChange={(e) =>
                      setEmployee({ ...employee, phone: e.target.value })
                    }
                  />
                  <select
                    required
                    value={employee.area_id}
                    onChange={(e) =>
                      setEmployee({ ...employee, area_id: e.target.value })
                    }
                  >
                    <option value="">Seleccione área</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button className="primary">{employeeEditId ? "Guardar cambios" : "Agregar empleado"}</button>
                  {employeeEditId && <button type="button" className="secondary" onClick={() => { setEmployeeEditId(""); setEmployee({ name: "", employee_code: "", phone: "", area_id: "" }); }}><X /> Cancelar</button>}
                </form>
                <div className="employeeSettingsSearch" translate="no">
                  <label htmlFor="settings-employee-search">{language === "en" ? "Search employees" : "Buscar empleados"}</label>
                  <div className="employeeSettingsSearchControls">
                    <input id="settings-employee-search" type="search" value={employeeSearch}
                      placeholder={language === "en" ? "Name, ID, phone or area…" : "Nombre, ID, teléfono o área…"}
                      aria-controls="settings-employee-list" onChange={event => setEmployeeSearch(event.target.value)} />
                    {employeeSearch && <button type="button" className="secondary" onClick={() => setEmployeeSearch("")}>{language === "en" ? "Clear" : "Limpiar"}</button>}
                  </div>
                  <small role="status">{language === "en" ? `${filteredEmployees.length} of ${employees.length} employees` : `${filteredEmployees.length} de ${employees.length} empleados`}</small>
                  {filteredEmployees.length > 0 && <small id="settings-employee-scroll-hint">{language === "en" ? "Scroll within the list to see more employees. Up to 10 rows are visible at once." : "Desplace dentro de la lista para ver más empleados. Se muestran hasta 10 filas a la vez."}</small>}
                </div>
                <div id="settings-employee-list" ref={employeeListRef} className="compactList employeeSettingsList"
                  role="region" aria-label={language === "en" ? "Employee list" : "Lista de empleados"}
                  aria-describedby={filteredEmployees.length ? "settings-employee-scroll-hint" : undefined}
                  tabIndex={filteredEmployees.length ? 0 : undefined}>
                  {filteredEmployees.map((e) => (
                    <article key={e.id}>
                      <div className="employeeSettingsDetails">
                        <b translate="no">{e.name}{e.employee_code ? ` · ID ${e.employee_code}` : ""}</b>
                        <small>
                          <span translate="no">{employeeAreas.get(e.area_id || "") || (language === "en" ? "No area" : "Sin área")}</span>
                          {e.phone && <span translate="no"> · {e.phone}</span>}
                        </small>
                      </div>
                      <div className="rowActions">
                        <button title="Editar empleado" onClick={() => { setEmployeeEditId(e.id); setEmployee({ name: e.name, employee_code: e.employee_code || "", phone: e.phone || "", area_id: e.area_id || "" }); }}><Pencil /></button>
                        <button title="Eliminar empleado" onClick={() => del("v2_employees", e.id)}><Trash2 /></button>
                      </div>
                    </article>
                  ))}
                  {!filteredEmployees.length && <p className="employeeSettingsEmpty" translate="no">{employeeSearch.trim()
                    ? (language === "en" ? "No employees match your search." : "No hay empleados que coincidan con la búsqueda.")
                    : (language === "en" ? "No employees yet. Add the first employee above." : "Todavía no hay empleados. Agregue el primero arriba.")}</p>}
                </div>
              </div>
              <div className="settingsColumns">
                <div translate="no">
                  <h3>{language === "en" ? "Areas" : "Áreas"}</h3>
                  <form className="inlineForm areaSettingsForm" onSubmit={saveScheduleArea}>
                    <input ref={scheduleAreaNameRef} required disabled={scheduleAreaBusy} value={areaName}
                      onChange={e => setAreaName(e.target.value)} aria-label={language === "en" ? "Schedule area name" : "Nombre del área de horarios"}
                      placeholder={language === "en" ? "Area name" : "Nombre del área"} />
                    <button className="primary" disabled={scheduleAreaBusy}>{language === "en" ? (scheduleAreaEditId ? "Save changes" : "Add") : (scheduleAreaEditId ? "Guardar cambios" : "Agregar")}</button>
                    {scheduleAreaEditId && <button type="button" disabled={scheduleAreaBusy} onClick={() => { setScheduleAreaEditId(""); setAreaName(""); }}>{language === "en" ? "Cancel" : "Cancelar"}</button>}
                  </form>
                  <div className="compactList areaSettingsList" role="region" tabIndex={0} aria-label={language === "en" ? "Saved schedule areas" : "Áreas de horarios guardadas"}>
                    {areas.map(a => <article key={a.id} className={scheduleAreaEditId === a.id ? "catalogSettingsEditing" : undefined}>
                      <b>{a.name}</b>
                      <div className="rowActions">
                        <button type="button" disabled={scheduleAreaBusy} aria-label={`${language === "en" ? "Edit area" : "Editar área"}: ${a.name}`} onClick={() => editScheduleArea(a)}><Pencil aria-hidden="true"/>{language === "en" ? "Edit" : "Editar"}</button>
                        <button type="button" disabled={scheduleAreaBusy} aria-label={`${language === "en" ? "Delete area" : "Eliminar área"}: ${a.name}`} onClick={() => del("v2_areas", a.id)}><Trash2 aria-hidden="true"/></button>
                      </div>
                    </article>)}
                  </div>
                  <small>{language === "en" ? "Scroll the list to see more areas." : "Desplace la lista para ver más áreas."}</small>
                </div>
                <div>
                  <div className="shiftSettingsHeading" translate="no">
                    <h3>{language === "en" ? "Shifts" : "Turnos"}</h3>
                    <label className="shiftTimeFormat">{language === "en" ? "Time format" : "Formato de hora"}
                      <select aria-label={language === "en" ? "Time format" : "Formato de hora"} value={form.settings.time_format === "12h" ? "12h" : "24h"} onChange={e => setting("time_format", e.target.value)}>
                        <option value="12h">AM / PM</option><option value="24h">{language === "en" ? "24 hours" : "24 horas"}</option>
                      </select>
                    </label>
                  </div>
                  {savedForm && form.settings.time_format !== savedForm.settings?.time_format && <small className="shiftFormatHint" translate="no">{language === "en" ? "Save settings to apply this format to the whole restaurant." : "Guarde la configuración para aplicar este formato a todo el restaurante."}</small>}
                  <form className="formStack" onSubmit={addShift} translate="no">
                    {shiftEditId && <strong role="status">{language === "en" ? "Editing shift" : "Editando turno"}</strong>}
                    <label>{language === "en" ? "Shift name" : "Nombre del turno"}
                      <input ref={shiftNameRef} required maxLength={120} disabled={shiftBusy} placeholder={language === "en" ? "e.g. Morning" : "Ej. Mañana"} value={shift.name} onChange={e => setShift({ ...shift, name: e.target.value })}/>
                    </label>
                    <div className="shiftEndpoints">
                      {(["start", "end"] as const).map(side => <ShiftEndpointInput key={side}
                        label={side === "start" ? (language === "en" ? "Start" : "Entrada") : (language === "en" ? "End" : "Salida")}
                        mode={shift[`${side}_mode`]} time={shift[`${side}_time`]} text={shift[`${side}_text`]} format={form.settings.time_format} disabled={shiftBusy}
                        calculate={shift[`${side}_calculate`]} calculationTime={shift[`calculation_${side}_time`]}
                        onCalculate={value => setShift(current => ({ ...current, [`${side}_calculate`]: value }))}
                        onCalculationTime={value => setShift(current => ({ ...current, [`calculation_${side}_time`]: value }))}
                        placeholder={side === "start" ? (language === "en" ? "e.g. OPENING" : "Ej. APERTURA") : (language === "en" ? "e.g. CLOSING" : "Ej. CIERRE")}
                        onMode={mode => setShift(current => ({ ...current, [`${side}_mode`]: mode }))}
                        onTime={value => setShift(current => ({ ...current, [`${side}_time`]: value }))}
                        onText={value => setShift(current => ({ ...current, [`${side}_text`]: value }))}/>) }
                    </div>
                    {(shift.start_mode === "text" || shift.end_mode === "text") && <small>{language === "en" ? "Duration requires a numeric time for both ends. Text stays visible; optional calculation times stay hidden. Hour reports are included in Advanced." : "La duración requiere una hora numérica en ambos extremos. Se muestra el texto y se ocultan las horas de cálculo opcionales. Los reportes de horas están incluidos en Advanced."}</small>}
                    {shiftEditId && <small>{language === "en" ? "Editing a shift updates schedules already linked to it." : "Editar un turno actualiza los horarios que ya lo tienen asignado."}</small>}
                    <button className="primary" disabled={shiftBusy}>{language === "en" ? (shiftEditId ? "Save changes" : "Add shift") : (shiftEditId ? "Guardar cambios" : "Agregar turno")}</button>
                    {shiftEditId && <button type="button" disabled={shiftBusy} className="secondary" onClick={() => { setShiftEditId(""); setShift(newShiftDraft()); }}>{language === "en" ? "Cancel" : "Cancelar"}</button>}
                  </form>
                  <div id="settings-shift-list" className="compactList shiftSettingsList" role="region" tabIndex={0} aria-label={language === "en" ? "Saved shifts" : "Turnos guardados"}>
                    {shifts.map((s) => (
                      <article key={s.id} className={shiftEditId === s.id ? 'shiftSettingsEditing' : undefined}>

                        <div>
                          <b translate="no">{s.name}</b>
                          <small translate="no">
                            {scheduleShiftLabel(s,form.settings.time_format,true)}
                          </small>
                        </div>
                        <div className="rowActions">
                          <button type="button" disabled={shiftBusy} aria-label={`${language === "en" ? "Edit shift" : "Editar turno"}: ${s.name}`} onClick={() => editShift(s)}><Pencil aria-hidden="true"/><span translate="no">{language === "en" ? "Edit" : "Editar"}</span></button>
                          <button type="button" disabled={shiftBusy} aria-label={`${language === "en" ? "Delete shift" : "Eliminar turno"}: ${s.name}`} onClick={() => del("v2_shifts", s.id)}><Trash2 aria-hidden="true"/></button>
                        </div>
                      </article>
                    ))}

                  </div>
                </div>
              </div>
            </div>
          )}
          {!catalogsOnly && <button className="primary settingsSave" disabled={logoBusy} onClick={save}>
            Guardar configuración
          </button>}
          {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
        </fieldset>
      )}
    </div>
  );
}
function removeConnectedLogoBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height),
    data = image.data,
    width = canvas.width,
    height = canvas.height,
    borderPixels: number[] = [];
  for (let x = 0; x < width; x++) borderPixels.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) borderPixels.push(y * width, y * width + width - 1);
  const buckets = new Map<string, { count: number; rgb: [number, number, number] }>();
  borderPixels.forEach((pixel) => {
    const i = pixel * 4;
    if (data[i + 3] < 20) return;
    const key = `${Math.round(data[i] / 24)},${Math.round(data[i + 1] / 24)},${Math.round(data[i + 2] / 24)}`;
    const bucket = buckets.get(key) || { count: 0, rgb: [0, 0, 0] };
    bucket.count++;
    bucket.rgb[0] += data[i]; bucket.rgb[1] += data[i + 1]; bucket.rgb[2] += data[i + 2];
    buckets.set(key, bucket);
  });
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant) return;
  const background = dominant.rgb.map((value) => value / dominant.count),
    queue = borderPixels,
    visited = new Uint8Array(width * height);
  const distance = (pixel: number) => {
    const i = pixel * 4;
    return Math.sqrt(
      (data[i] - background[0]) ** 2 +
        (data[i + 1] - background[1]) ** 2 +
        (data[i + 2] - background[2]) ** 2,
    );
  };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const pixel = queue[cursor];
    if (pixel < 0 || pixel >= width * height || visited[pixel]) continue;
    visited[pixel] = 1;
    const delta = distance(pixel);
    if (delta > 78) continue;
    const i = pixel * 4;
    data[i + 3] = delta < 28 ? 0 : Math.round(((delta - 28) / 50) * 255);
    const x = pixel % width;
    if (x > 0) queue.push(pixel - 1);
    if (x < width - 1) queue.push(pixel + 1);
    if (pixel >= width) queue.push(pixel - width);
    if (pixel < width * (height - 1)) queue.push(pixel + width);
  }
  ctx.putImageData(image, 0, 0);
  const refined = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < refined.data.length; i += 4) {
    const r = refined.data[i],
      g = refined.data[i + 1],
      b = refined.data[i + 2],
      lightest = Math.min(r, g, b),
      neutral = Math.max(r, g, b) - lightest < 24;
    if (neutral && lightest > 205) {
      const opacity = Math.max(0, Math.min(1, (245 - lightest) / 40));
      refined.data[i + 3] = Math.round(refined.data[i + 3] * opacity);
    }
  }
  ctx.putImageData(refined, 0, 0);
}
function Toggle({
  title,
  checked,
  set,
}: {
  title: string;
  checked: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <article>
      <b>{title}</b>
      <label className="switch">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => set(e.target.checked)}
        />
        <span />
      </label>
    </article>
  );
}

function SupportAuthorization({ restaurantId }: { restaurantId: string }) {
  const { language } = useAppPreferences(), en = language === 'en';
  const [rows, setRows] = useState<any[]>([]), [reason, setReason] = useState(''), [permission, setPermission] = useState('view');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true);
  const lock = useRef(false), requestId = useRef<string | null>(null);
  const copy = (es: string, english: string) => en ? english : es;
  async function load(older = false) {
    setLoading(true);
    const result = await supabase.rpc('v2_support_requests', { p_restaurant: restaurantId, p_before: older ? rows.at(-1)?.id : null });
    if (result.error) setNotice(copy('No se pudieron cargar las solicitudes. Reintente.', 'Could not load requests. Please retry.'));
    else setRows(previous => older ? [...previous, ...result.data] : result.data);
    setLoading(false);
  }
  useEffect(() => { setRows([]); void load(); }, [restaurantId]); // Tenant switch remounts the dashboard.
  async function notify(id: string) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/security/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ action: 'support_notify', id, restaurant_id: restaurantId, language }) });
    if (!response.ok) throw new Error('NOTIFICATION');
  }
  async function authorize(event: React.FormEvent) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try {
      requestId.current ||= crypto.randomUUID();
      const result = await supabase.rpc('v2_support_authorize', { p_restaurant: restaurantId, p_id: requestId.current, p_permission: permission, p_reason: reason.trim() });
      if (result.error) throw new Error(result.error.message);
      requestId.current = null; setReason('');
      try { await notify(result.data); setNotice(copy('Acceso autorizado por 24 horas. Se envió el aviso a soporte.', 'Access authorized for 24 hours. Support was notified.')); }
      catch { setNotice(copy('Acceso autorizado. El correo no se pudo enviar; la solicitud ya aparece en soporte. Puede reintentar el aviso.', 'Access authorized. Email could not be sent; support can already see the request. You can retry the notification.')); }
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const errors: Record<string,string> = {
        'La cuenta de soporte todavía no está activada.': 'The support account has not been activated yet.',
        'Ya hay una solicitud activa para este restaurante. Revóquela antes de continuar.': 'This restaurant already has an active request. Revoke it before continuing.',
        'Solo el administrador puede autorizar soporte.': 'Only the restaurant administrator can authorize support.',
      };
      setNotice(en ? (errors[message] || 'Could not authorize access. Check your connection and retry.') : (message || 'No se pudo autorizar.'));
    }
    finally { lock.current = false; setBusy(false); }
  }
  async function revoke(id: string) {
    if (lock.current || !window.confirm(copy('¿Revocar este acceso de soporte ahora?', 'Revoke this support access now?'))) return;
    lock.current = true; setBusy(true);
    try { const result = await supabase.rpc('v2_support_revoke', { p_id: id }); if (result.error) throw result.error; await load(); setNotice(copy('Acceso revocado.', 'Access revoked.')); }
    catch { setNotice(copy('No se pudo revocar. Reintente.', 'Could not revoke access. Please retry.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="moduleCard settingsPanel supportPanel" translate="no">
    <h2>{copy('Acceso temporal a soporte', 'Temporary support access')}</h2>
    <p>{copy('Autorice a support@mrmaa.com para revisar este restaurante durante 24 horas. Puede revocar el acceso cuando lo desee. No consume un usuario de su plan.', 'Authorize support@mrmaa.com to review this restaurant for 24 hours. Revoke access at any time. This does not use a plan seat.')}</p>
    <form className="formStack" onSubmit={authorize}>
      <label>{copy('¿Qué necesita revisar?', 'What needs attention?')}<textarea required minLength={5} maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder={copy('Describa el problema. No incluya contraseñas ni códigos.', 'Describe the issue. Do not include passwords or security codes.')} /></label>
      <label>{copy('Permiso por 24 horas', 'Permission for 24 hours')}<select value={permission} disabled={busy} onChange={e => setPermission(e.target.value)}><option value="view">{copy('Solo lectura', 'View only')}</option><option value="edit">{copy('Ver y editar', 'View and edit')}</option></select></label>
      <p className="muted">{copy('Editar permite corregir clientes, reservas, cotizaciones, horarios y configuración operativa. No permite administrar usuarios, pagos, propiedad, borrar la cuenta ni vaciar la papelera. Si existe otra solicitud activa para este restaurante, revóquela primero.', 'Editing allows corrections to customers, reservations, quotes, schedules and operational settings. It does not allow managing users, payments or ownership, deleting the account or emptying the trash. Revoke an existing active request for this restaurant before creating another.')}</p>
      <button className="primary" disabled={busy || reason.trim().length < 5}>{busy ? copy('Procesando…', 'Processing…') : copy('Autorizar acceso por 24 horas', 'Authorize access for 24 hours')}</button>
    </form>
    {notice && <p role="status" className="moduleNotice">{notice}</p>}
    <div className="supportListHeading"><h3>{copy('Solicitudes e historial', 'Requests and history')}</h3><button className="secondary" disabled={loading || busy} onClick={() => void load()}>{copy('Actualizar', 'Refresh')}</button></div>
    {loading && <p role="status">{copy('Cargando…', 'Loading…')}</p>}
    {!loading && !rows.length && <p>{copy('Todavía no ha autorizado accesos.', 'No support access has been authorized yet.')}</p>}
    <div className="supportRequestList">{rows.map(row => {
      const active = !row.revoked_at && Date.parse(row.expires_at) > Date.now();
      return <article className="supportRequest" key={row.id}>
        <strong>{row.permission === 'edit' ? copy('Ver y editar', 'View and edit') : copy('Solo lectura', 'View only')}</strong>
        <p className="supportReason">{row.reason}</p>
        {row.resolved_at && <p role="status" className="moduleNotice"><strong>{copy('Solicitud resuelta', 'Request resolved')}</strong><br/>{row.resolution_note}<br/>{new Date(row.resolved_at).toLocaleString(en ? 'en-US' : 'es-GT')}</p>}
        <small>{row.resolved_at ? copy('Acceso finalizado', 'Access ended') : row.revoked_at ? copy('Revocado', 'Revoked') : active ? copy('Activo hasta ', 'Active until ') : copy('Venció el ', 'Expired on ')}{!row.revoked_at && new Date(row.expires_at).toLocaleString(en ? 'en-US' : 'es-GT')}</small>
        {active && <div className="supportActions"><button className="secondary" disabled={busy} onClick={() => void revoke(row.id)}>{copy('Revocar acceso', 'Revoke access')}</button>{!row.notified_at && <button className="secondary" disabled={busy} onClick={async () => { if(lock.current)return;lock.current=true;setBusy(true);try { await notify(row.id); setNotice(copy('Aviso enviado.', 'Notification sent.')); await load(); } catch { setNotice(copy('No se pudo enviar el correo. Reintente.', 'Could not send email. Please retry.')); } finally {lock.current=false;setBusy(false);} }}>{copy('Reintentar correo', 'Retry email')}</button>}</div>}
      </article>;
    })}</div>
    {rows.length > 0 && rows.length % 50 === 0 && <button className="secondary" disabled={loading} onClick={() => void load(true)}>{copy('Ver anteriores', 'Load older requests')}</button>}
    <p className="muted">{copy('Las autorizaciones, entradas y cambios de soporte quedan registrados en Configuración → Seguridad → Historial.', 'Support authorizations, entries and changes are recorded in Settings → Security → History.')}</p>
  </section>;
}
