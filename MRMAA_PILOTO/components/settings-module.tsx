"use client";
import { BillingPanel } from "@/components/billing-panel";
import { planFor } from "@/lib/plans";
import { useDataRefresh, useOnDataRefresh } from "@/components/restaurant-sync";
import { confirmApp } from "@/components/app-preferences";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges } from "@/lib/unsaved-changes";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requirePermission, ACCESS_DENIED } from "@/lib/permissions";
import { UsersModule } from "@/components/users-module";
import { SecurityCenter } from "@/components/security-center";
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
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useUnsavedChanges(email !== savedEmail || Boolean(targetUserId || confirmation), () => {
    setEmail(savedEmail); setTargetUserId(""); setConfirmation("");
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
      setEmail(data.user?.email || "");
      setSavedEmail(data.user?.email || "");
    });
    authorizedFetch("/api/users").then(setMembers).catch((error) => setNotice(userMessage(error)));
  }, [authorizedFetch]);

  useOnDataRefresh(remoteVersion, () => {
    void authorizedFetch('/api/users').then(setMembers).catch(error => setNotice(userMessage(error)));
  });
  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    const result = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: "https://mrmaa.com/?login=1" });
    setBusy(false);
    if (!result.error) setSavedEmail(email);
    setNotice(result.error ? userMessage(result.error) : "Revise el correo nuevo y confirme el cambio desde el enlace recibido.");
  }

  async function accountAction(action: "transfer" | "delete_account", extra: Record<string, string>) {
    setBusy(true); setNotice("");
    try {
      await authorizedFetch("/api/account", { method: "POST", body: JSON.stringify({ action, ...extra }) });
      if (action === "transfer") {
        setNotice("Administración transferida. Su cuenta ahora tiene rol de gerente.");
        window.setTimeout(() => window.location.reload(), 1200);
      } else {
        await supabase.auth.signOut();
        window.location.assign("/?login=1");
      }
    } catch (error: any) { setNotice(userMessage(error)); }
    finally { setBusy(false); }
  }

  const eligible = members.filter((member) => member.user_id !== currentUserId && member.status === "activo");
  return <div className="moduleStack">
    <section className="moduleCard settingsPanel">
      <div className="moduleTitle"><div><h2>Cuenta</h2><p>Administre su correo y la propiedad del restaurante.</p></div></div>
      <form className="formStack" onSubmit={changeEmail}>
        <label>Correo de acceso
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <small>Supabase enviará una confirmación al nuevo correo. El cambio no se aplicará hasta confirmarlo.</small>
        <button className="primary" disabled={busy}>Cambiar correo electrónico</button>
      </form>
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
}: {
  restaurantId: string;
  restaurantName: string;
  onNameChange: (x: string) => void;
  onSettingsChange: (x: any) => void;
  onAreasChange?: (areas: Area[]) => void;
  onProductsChange?: (products: Product[]) => void;
  catalogsOnly?: boolean;
  planCode?: string;
}) {
  const { setPreferences } = useAppPreferences();
  const persistedSettingsRef = useRef<any>({});
  const remoteVersion = useDataRefresh(restaurantId, 'v2_restaurants,v2_reservation_areas,v2_quote_products,v2_areas,v2_shifts,v2_employees');
  const loadGeneration = useRef(0);
  const dirtyRef = useRef(false);
  const settingsSnapshot = useRef('');
  const [settingsConflict, setSettingsConflict] = useState(false);
  const productSavingRef = useRef(false);
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
    [shift, setShift] = useState({
      name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 0,
    }),
    [product, setProduct] = useState<any>({ name: "", description: "", price: 0 }),
    [productEditId, setProductEditId] = useState(""),
    [productBusy, setProductBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [removeLogoBackground, setRemoveLogoBackground] = useState(true),
    [savedSignature, setSavedSignature] = useState("");
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
      supabase
        .from("v2_areas")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
      supabase
        .from("v2_employees")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
      supabase
        .from("v2_shifts")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("start_time"),
      supabase
        .from("v2_quote_products")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name"),
      supabase.from("v2_reservation_areas").select("*").eq("restaurant_id", restaurantId).eq("active", true).order("name"),
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
    if (catalogsOnly && !["reservaciones", "cotizaciones"].includes(tab)) setTab("reservaciones");
    if (!planFor(planCode).schedules && tab === "horarios") setTab("general");
  }, [catalogsOnly, planCode, tab]);
  const sectionSignature = (source: any, section: string) => {
    const s = source?.settings || {};
    if (section === "general") return JSON.stringify({ name: source?.name, phone: source?.phone, country: source?.country, language: source?.language, currency: source?.currency, logo: s.logo_data_url, address: s.business_address, email: s.business_email });
    if (section === "reservaciones") return JSON.stringify({ people: s.reservation_show_people, deposits: s.reservation_show_deposits, listDeposits: s.reservation_show_deposits_list, allowDeposits: s.reservation_allow_deposits });
    if (section === "cotizaciones") return JSON.stringify({ quote_number_start: source?.quote_number_start, ...Object.fromEntries(Object.entries(s).filter(([key]) => key.startsWith("quote_") || ["discounts", "tips", "fixed_customer_note", "customer_note"].includes(key))) });
    return "saved-immediately";
  };
  const savedForm = savedSignature ? JSON.parse(savedSignature) : null;
  const sectionChanged = Boolean(savedForm && sectionSignature(form, tab) !== sectionSignature(savedForm, tab));
  const pendingDraft = tab === "horarios"
    ? Boolean(areaName.trim() || employee.name.trim() || employee.employee_code.trim() || employee.phone.trim() || employee.area_id || shift.name.trim() || shift.start_time !== "09:00" || shift.end_time !== "17:00" || shift.break_minutes !== 0)
    : tab === "cotizaciones"
      ? Boolean(product.name.trim() || product.description?.trim() || Number(product.price) || customClientField.label.trim() || customAdjustment.label.trim())
      : tab === "reservaciones" ? Boolean(reservationAreaName.trim()) : false;
  const settingsDirty = sectionChanged || pendingDraft;
  const anySettingsDirty = Boolean(savedForm && ["general", "reservaciones", "cotizaciones"].some((section) => sectionSignature(form, section) !== sectionSignature(savedForm, section))) || pendingDraft;
  dirtyRef.current = anySettingsDirty;
  useOnDataRefresh(remoteVersion, () => { void load(true); });
  useEffect(() => { if (settingsConflict && !anySettingsDirty) void load(true); }, [settingsConflict, anySettingsDirty, load]);
  useUnsavedChanges(anySettingsDirty, () => {
    ["general", "reservaciones", "cotizaciones", "horarios"].forEach(discardCurrentSection);
  });
  const settingBelongsToSection = (key: string, section: string) => {
    if (section === "general")
      return [
        "logo_data_url",
        "business_address",
        "business_email",
        "business_phone",
        "business_country",
        "business_currency",
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
    if (savedForm && ["general", "reservaciones", "cotizaciones"].includes(section)) {
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
      setAreaName("");
      setEmployee({ name: "", employee_code: "", phone: "", area_id: "" });
      setEmployeeEditId("");
      setShift({
        name: "",
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: 0,
      });
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
      await requirePermission(supabase, restaurantId, "isAdmin");
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
  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorizeSettings())) return;
    const r = await supabase
      .from("v2_areas")
      .insert({ restaurant_id: restaurantId, name: areaName });
    if (r.error) return setNotice(userMessage(r.error));
    setAreaName("");
    load();
  }
  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorizeSettings())) return;
    const r = await supabase
      .from("v2_shifts")
      .insert({ restaurant_id: restaurantId, ...shift });
    if (r.error) return setNotice(userMessage(r.error));
    setShift({
      name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 0,
    });
    load();
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
  const tabs = catalogsOnly ? ["reservaciones", "cotizaciones"] : [
    "general",
    "reservaciones",
    "cotizaciones",
    ...(planFor(planCode).schedules ? ["horarios"] : []),
    "usuarios",
    "cuenta",
    "suscripción",
    "seguridad",
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
            {x}
          </button>
        ))}
      </aside>
      {tab === "usuarios" ? (
        <UsersModule restaurantId={restaurantId} defaultLanguage={emailLanguage(savedForm?.language)} />
      ) : tab === "cuenta" ? (
        <AccountSettings restaurantId={restaurantId} />
      ) : tab === "suscripción" ? (<BillingPanel restaurantId={restaurantId} />
      ) : tab === "seguridad" ? (
        <SecurityCenter restaurantId={restaurantId} />
      ) : (
        <section className="moduleCard settingsPanel">
          {settingsConflict && <div className="moduleNotice" role="status">
            La configuración cambió. Su borrador se conserva. Cargar la versión actual descartará sus cambios pendientes.
            <button className="secondary" type="button" onClick={() => { if (confirmDiscardChanges()) void load(false); }}>Cargar versión actual</button>
          </div>}
          <div className="moduleTitle">
            <div>
              <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
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
              <section className="moduleCard"><h3>Áreas para reservaciones</h3>
                <form className="inlineForm" onSubmit={saveReservationArea}>
                  <input required value={reservationAreaName} onChange={e=>setReservationAreaName(e.target.value)} placeholder="Nombre del área" />
                  <button className="primary" disabled={areaBusy}>{reservationAreaEdit ? "Guardar" : "Agregar"}</button>
                  {reservationAreaEdit && <button type="button" onClick={()=>{setReservationAreaEdit("");setReservationAreaName("");}}>Cancelar</button>}
                </form>
                <div className="compactList">{reservationAreas.map(a=><article key={a.id}><b>{a.name}</b><div className="rowActions"><button type="button" disabled={areaBusy} onClick={()=>{setReservationAreaEdit(a.id);setReservationAreaName(a.name);}}>Editar</button><button type="button" disabled={areaBusy} onClick={()=>removeReservationArea(a)}><Trash2 /> Eliminar</button></div></article>)}</div>
                {!reservationAreas.length && <p>No hay áreas de reservaciones. Agregue su primera área.</p>}
                <small>Estas áreas son independientes de Horarios.</small>
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
                <div className="compactList">
                  {employees.map((e) => (
                    <article key={e.id}>
                      <div>
                        <b>{e.name}{e.employee_code ? ` · ID ${e.employee_code}` : ""}</b>
                        <small>
                          {areas.find((a) => a.id === e.area_id)?.name ||
                            "Sin área"}{" "}
                          · {e.phone}
                        </small>
                      </div>
                      <div className="rowActions">
                        <button title="Editar empleado" onClick={() => { setEmployeeEditId(e.id); setEmployee({ name: e.name, employee_code: e.employee_code || "", phone: e.phone || "", area_id: e.area_id || "" }); }}><Pencil /></button>
                        <button title="Eliminar empleado" onClick={() => del("v2_employees", e.id)}><Trash2 /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="settingsColumns">
                <div>
                  <h3>Áreas</h3>
                  <form className="inlineForm" onSubmit={addArea}>
                    <input
                      required
                      value={areaName}
                      onChange={(e) => setAreaName(e.target.value)}
                      placeholder="Nombre del área"
                    />
                    <button className="primary">Agregar</button>
                  </form>
                  <div className="compactList">
                    {areas.map((a) => (
                      <article key={a.id}>
                        <b>{a.name}</b>
                        <button onClick={() => del("v2_areas", a.id)}>
                          <Trash2 />
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Turnos</h3>
                  <form className="formStack" onSubmit={addShift}>
                    <input
                      required
                      placeholder="Nombre"
                      value={shift.name}
                      onChange={(e) =>
                        setShift({ ...shift, name: e.target.value })
                      }
                    />
                    <div className="grid2">
                      <input
                        type="time"
                        value={shift.start_time}
                        onChange={(e) =>
                          setShift({ ...shift, start_time: e.target.value })
                        }
                      />
                      <input
                        type="time"
                        value={shift.end_time}
                        onChange={(e) =>
                          setShift({ ...shift, end_time: e.target.value })
                        }
                      />
                    </div>
                    <button className="primary">Agregar turno</button>
                  </form>
                  <div className="compactList">
                    {shifts.map((s) => (
                      <article key={s.id}>
                        <div>
                          <b>{s.name}</b>
                          <small>
                            {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          </small>
                        </div>
                        <button onClick={() => del("v2_shifts", s.id)}>
                          <Trash2 />
                        </button>
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
        </section>
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
