"use client";
import { useDataRefresh, useOnDataRefresh, useRestaurantSync } from "@/components/restaurant-sync";

import { useExcelExportAccess } from "@/components/excel-permission";
import { confirmApp } from "@/components/app-preferences";
import { AccountAccessError, LOAD_RETRY_MESSAGE, readDashboardData } from "@/lib/account-access";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges, useDraftBaseline } from "@/lib/unsaved-changes";

import { useCallback, useEffect, useId, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { AreaPicker, normalizeArea } from "./area-picker";
import type { Session } from "@supabase/supabase-js";
import {
  CalendarDays,
  FileText,
  LogOut,
  Pencil,
  Plus,
  Users,
  X,
  Download,
  ArrowRight,
  Clock3,
  BarChart3,
  Settings,
  Trash2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calculateQuoteWithAdjustments, numberValue } from "@/lib/calculations";
import type {
  Client,
  Quote,
  QuoteAdjustment,
  QuoteCustomField,
  QuoteItem,
  Reservation,
} from "@/lib/types";
import { ReservationsEnhanced } from "@/components/reservations-enhanced";
import { ReservationStatus } from "@/components/reservation-status";
import { TransparentLogo } from "@/components/transparent-logo";
import { Pagination } from "@/components/pagination";
import { printHtml, reserveQuotePrintWindow } from "@/lib/print";
import { permissionsFor, requirePermission, ACCESS_DENIED, type Permission } from "@/lib/permissions";
import { currentAppLanguage, formatAppMoney, useAppPreferences } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
import { recordAuditActivity } from "@/lib/audit-activity";
import { localDateISO } from "@/lib/local-date";
import { readQuoteDetail, readQuotePage, type QuoteSummary } from "@/lib/quote-data";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";

const ModuleLoading = () => <div className="empty">Cargando módulo…</div>;
const EnhancedReports = dynamic(() => import("@/components/reports-enhanced").then((module) => module.EnhancedReports), { loading: ModuleLoading });
const EnhancedSettings = dynamic(() => import("@/components/advanced-modules").then((module) => module.EnhancedSettings), { loading: ModuleLoading });
const MonthlySchedules = dynamic(() => import("@/components/advanced-modules").then((module) => module.MonthlySchedules), { loading: ModuleLoading });

type Tab =
  "reservations" | "clients" | "quotes" | "schedules" | "reports" | "settings";
const emptyItem = (): QuoteItem => ({
  name: "",
  description: "",
  quantity: 1,
  unit_price: 0,
});
const emptyQuote = () => ({
  client_id: "",
  client_name: "",
  client_phone: "",
  client_email: "",
  event_date: localDateISO(),
  event_time: "12:00",
  area: "",
  guests: 1,
  discount_pct: 0,
  tip_pct: 10,
  deposit: 0,
  payment_method: "",
  customer_note: "",
  internal_notes: "",
  custom_fields: {},
  adjustments: [],
  items: [emptyItem()],
});
const emptyReservation = () => ({
  client_id: "",
  client_name: "",
  phone: "",
  event_date: localDateISO(),
  event_time: "12:00",
  area: "",
  guests: 2,
  menu: "",
  deposit: 0,
  payment_method: "",
  notes: "",
  status: "pendiente",
});
const money = (n: number) => formatAppMoney(n);
const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

export function Dashboard({
  session,
  trialEndsAt,
  planCode,
  initialRestaurantId,
  initialRestaurantName,
}: {
  session: Session;
  trialEndsAt: string;
  planCode: string;
  initialRestaurantId: string;
  initialRestaurantName: string;
}) {
  const { setPreferences, language, t } = useAppPreferences();
  const [tab, setTab] = useState<Tab>(() => {
      if (typeof window === "undefined") return "reservations";
      const saved = sessionStorage.getItem("mrmaa-tab");
      if (saved === "users") return "settings";
      return [
        "reservations",
        "clients",
        "quotes",
        "schedules",
        "reports",
        "settings",
      ].includes(saved || "")
        ? (saved as Tab)
        : "reservations";
    }),
    [restaurantId, setRestaurantId] = useState(initialRestaurantId),
    [restaurantName, setRestaurantName] = useState(initialRestaurantName || "Mi restaurante"),
    [quoteStart, setQuoteStart] = useState(2000),
    [memberRole, setMemberRole] = useState(""),
    [memberStatus, setMemberStatus] = useState(""),
    [dataVersion, setDataVersion] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false),
    [tutorialStep, setTutorialStep] = useState(0),
    [tutorialChecked, setTutorialChecked] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false),
    [clientEdit, setClientEdit] = useState<Client | null>(null),
    [clientForm, setClientForm] = useState({
      name: "",
      phone: "",
      email: "",
      notes: "",
    });
  const [quoteOpen, setQuoteOpen] = useState(false),
    [quoteEdit, setQuoteEdit] = useState<Quote | null>(null),
    [quoteForm, setQuoteForm] = useState<any>(emptyQuote()),
    [preview, setPreview] = useState<Quote | null>(null);
  const [quoteProducts, setQuoteProducts] = useState<any[]>([]),
    [areas, setAreas] = useState<any[]>([]),
    [appSettings, setAppSettings] = useState<any>({});
  const [reservationOpen, setReservationOpen] = useState(false),
    [reservationEdit, setReservationEdit] = useState<Reservation | null>(null),
    [reservationForm, setReservationForm] = useState<any>(emptyReservation());

  const hasOpenDraft = clientOpen || quoteOpen || reservationOpen;
  const [tipsOpen,setTipsOpen] = useState(false);
  const [nearby,setNearby] = useState<any[] | null>(null);
  const warningAnswer = useRef<((answer: boolean)=>void) | null>(null);
  const reservationSaving = useRef(false);
  const lastDashboardLoad = useRef(0);
  const dashboardLoadRequest = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const catalogVersion = useDataRefresh(restaurantId, 'v2_restaurants,v2_members,v2_quote_products,v2_reservation_areas');
  const recordVersion = useDataRefresh(restaurantId, 'v2_clients,v2_quotes,v2_quote_items,v2_reservations');
  const [remoteDraftNotice, setRemoteDraftNotice] = useState(false);
  const [previewExporting, setPreviewExporting] = useState(false);
  useOnDataRefresh(recordVersion, () => { if (hasOpenDraft) setRemoteDraftNotice(true); });
  useEffect(() => { setRemoteDraftNotice(false); }, [clientOpen, quoteOpen, reservationOpen]);
  useEffect(()=>()=>{warningAnswer.current?.(false);},[]);
  function answerWarning(answer: boolean) {
    const resolve=warningAnswer.current;
    warningAnswer.current=null;setNearby(null);resolve?.(answer);
  }
  function selectedArea(name: string, id?: string) {
    if (id) return areas.find(a=>a.id===id);
    const matches=areas.filter(a=>normalizeArea(a.name)===normalizeArea(name || ''));
    return matches.length===1 ? matches[0] : undefined;
  }
  async function checkNearby(name: string, id: string | undefined, date: string, time: string, exclude?: string) {
    const area=selectedArea(name,id);
    if (!area) {setError('Seleccione un área configurada. Si viene de una cotización, edite su área primero.');return false;}
    if (!date || !time) {setError('Indique fecha y hora para revisar las reservaciones cercanas.');return false;}
    const result=await supabase.rpc('v2_nearby_reservations',{
      p_restaurant:restaurantId,p_area:area.id,p_date:date,p_time:time,p_exclude:exclude || null,
    });
    if(result.error){setError('No se pudo comprobar las reservaciones cercanas. '+result.error.message);return false;}
    if(!result.data?.length)return true;
    setNearby(result.data);
    return new Promise<boolean>(resolve=>{warningAnswer.current=resolve;});
  }
  const clientDraft = useDraftBaseline(clientForm, clientOpen);
  const quoteDraft = useDraftBaseline(quoteForm, quoteOpen);
  const reservationDraft = useDraftBaseline(reservationForm, reservationOpen);
  useUnsavedChanges(clientDraft.dirty || quoteDraft.dirty || reservationDraft.dirty, () => {
    setClientOpen(false); setQuoteOpen(false); setReservationOpen(false);
  });
  const discardDraft = (close: () => void) => {
    if (confirmDiscardChanges()) close();
  };
  const navigateTab = (next: Tab) => {
    if (next === tab) return;
    if (confirmDiscardChanges()) setTab(next);
  };

  const load = useCallback(async (showLoading = false) => {
    const request = ++dashboardLoadRequest.current;
    if (showLoading) setBusy(true);
    setError("");
    setLoadFailed(false);
    const id = initialRestaurantId;
    try {
      const snapshot = await readDashboardData(supabase, id, session.user.id);
      if (request !== dashboardLoadRequest.current) return;
      const { restaurant: r, products, areas: areaRows, membership } = snapshot;
      setRestaurantId(id);
      setMemberRole(membership.role);
      setMemberStatus(membership.status);
      const loadedPermissions = permissionsFor(membership.role, membership.status);
      if (!loadedPermissions.isAdmin)
        setTab((current) => current === "reports" || (current === "settings" && !loadedPermissions.canManageQuoteProducts) ? "reservations" : current);
      if (r.name) setRestaurantName(r.name);
      setPreferences(r.language, r.currency);
      if (r.quote_number_start) setQuoteStart(r.quote_number_start);
      setAppSettings(r.settings || {});
      setQuoteProducts(products);
      setAreas(areaRows);
      lastDashboardLoad.current = Date.now();
    } catch (error) {
      if (request !== dashboardLoadRequest.current) return;
      if (error instanceof AccountAccessError && error.kind === "revoked") {
        setMemberRole(""); setMemberStatus("");
        setError(error.message);
      } else {
        // Preserve the last verified view and open drafts. Mutations continue to
        // recheck membership and remain protected by the existing database rules.
        setError(LOAD_RETRY_MESSAGE);
        setLoadFailed(true);
      }
    } finally {
      if (request === dashboardLoadRequest.current) setBusy(false);
    }
  }, [initialRestaurantId, session.user.id, setPreferences]);
  useOnDataRefresh(catalogVersion, () => { void load(false); });
  useEffect(() => {
    void load(true);
    return () => { dashboardLoadRequest.current++; };
  }, [load]);
  useEffect(() => {
    if (!restaurantId) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastDashboardLoad.current < 10_000) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(false), 150);
    };
    window.addEventListener("focus", refreshVisibleData);
    window.addEventListener("online", refreshVisibleData);
    document.addEventListener("visibilitychange", refreshVisibleData);
    return () => {
      clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshVisibleData);
      window.removeEventListener("online", refreshVisibleData);
      document.removeEventListener("visibilitychange", refreshVisibleData);
    };
  }, [restaurantId, load]);
  useEffect(() => {
    sessionStorage.setItem("mrmaa-tab", tab);
  }, [tab]);
  const { isAdmin, canRead, canOperate, canDeleteReservations, canManageSchedules, canManageQuoteProducts, canManageReservationAreas } = permissionsFor(memberRole, memberStatus);
  const sync = useRestaurantSync(restaurantId, session.user.id, canRead);
  const previewRefreshVersion = useRef(recordVersion);
  useEffect(() => {
    if (previewExporting || recordVersion === previewRefreshVersion.current) return;
    if (!preview) { previewRefreshVersion.current = recordVersion; return; }
    const controller = new AbortController();
    const id = preview.id;
    void (async () => {
      const quote = await readQuoteDetail(supabase, restaurantId, id, controller.signal);
      if (controller.signal.aborted) return;
      previewRefreshVersion.current = recordVersion;
      setPreview(current => current?.id === id ? quote : current);
    })().catch(() => { if (!controller.signal.aborted) setError(LOAD_RETRY_MESSAGE); });
    return () => { controller.abort(); };
  }, [recordVersion, preview?.id, previewExporting, restaurantId]);
  useEffect(() => {
    if (!canOperate) {
      setClientOpen(false);
      setQuoteOpen(false);
      setReservationOpen(false);
    }
    if (!canRead) setPreview(null);
  }, [canOperate, canRead]);
  async function authorize(permission: Permission) {
    try {
      await requirePermission(supabase, restaurantId, permission);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : ACCESS_DENIED);
      const membership = await supabase.from("v2_members").select("role,status")
        .eq("restaurant_id", restaurantId).eq("user_id", session.user.id).maybeSingle();
      if (!membership.error) {
        setMemberRole(membership.data?.role || "");
        setMemberStatus(membership.data?.status || "");
      }
      return false;
    }
  }
  const tutorialSteps = useMemo(() => {
    const steps: { tab?: Tab; title: string; text: string }[] = [
      { title: "Bienvenido a MRMAA", text: "En este recorrido conocerá las herramientas principales. Puede cerrarlo y volver a abrirlo desde el botón Tutorial." },
      { tab: canManageReservationAreas ? "settings" : "reservations", title: "Primero: configure las áreas de reservaciones", text: "Antes de crear reservas, Administrador, Gerente u Operador deben abrir Configuración → Reservaciones → Áreas para reservaciones, escribir el nombre y pulsar Agregar. Por ejemplo: Salón, Terraza o Jardín. El listado empieza vacío y es independiente de las áreas de Horarios. Los usuarios de solo lectura deben solicitar estos cambios al equipo." },
      { tab: "reservations", title: "Seleccione un área del listado", text: "En reservaciones y cotizaciones, seleccione un área configurada. Al escribir aparecen sugerencias de áreas. Seleccione una sugerencia o use el listado: ambos campos se actualizan con la misma área. Solo se admiten áreas configuradas. Las cotizaciones pueden quedar sin área mientras se preparan; para convertirlas en reserva debe seleccionarla. El aviso de tres horas compara reservas del mismo día y área." },
      { tab: "reservations", title: "Reservaciones", text: "Cree, busque, filtre, importe, imprima y administre reservaciones. También puede registrar anticipos y abrir la cotización relacionada." },
      { tab: "reservations", title: "Reservaciones canceladas y papelera", text: "Las reservaciones canceladas se identifican con una etiqueta roja. Administrador y Gerente pueden enviar una o varias reservaciones a la papelera, después de confirmar. Solo el Administrador puede restaurarlas durante 365 días. Si una reserva tiene cotización, al enviarla a la papelera la cotización vuelve a pendiente y puede convertirse nuevamente." },
      { tab: "clients", title: "Clientes", text: "Consulte y edite sus clientes. Los clientes creados desde reservaciones o cotizaciones quedan enlazados automáticamente." },
      { tab: "quotes", title: "Cotizaciones", text: "Prepare cotizaciones, seleccione productos, revise el preview y PDF, registre anticipos y convierta una cotización pendiente en reserva. Una cotización convertida no puede eliminarse hasta retirar primero su reservación." },
      { tab: "schedules", title: "Horarios", text: "Organice empleados por área, asigne horarios y comidas, copie patrones y trabaje con varios empleados. Puede minimizar el cuadro con el botón superior. En computadora, arrastre su esquina inferior derecha para cambiar la altura; el aviso está junto a esa esquina. Excel e Imprimir utilizan el rango de fechas seleccionado." },
    ];
    if (canManageQuoteProducts) {
      steps.push({ tab: "settings", title: "Menús y productos", text: "En Configuración → Cotizaciones, Administrador, Gerente y Operación pueden agregar o editar productos con nombre, descripción en varias líneas y precio. Solo el Administrador puede eliminarlos." });
    }
    if (canManageReservationAreas) {
      steps.push(
        { tab: "settings", title: "Editar o eliminar áreas", text: "Administrador, Gerente y Operador pueden agregar, editar o eliminar áreas en Configuración → Reservaciones. Cada acción guarda el catálogo inmediatamente. Eliminar pide confirmación y retira el área de nuevas selecciones; conserva el historial de reservas y cotizaciones anteriores. Las demás preferencias de reservaciones son exclusivas del Administrador." },
      );
    }
    if (isAdmin) {
      steps.push(
        { tab: "reports", title: "Reportes", text: "Revise actividad, ventas, clientes frecuentes y anticipos. Los filtros y la impresión incluyen todos los resultados seleccionados." },
        { tab: "settings", title: "Configuración y usuarios", text: "Personalice el negocio, reservaciones, cotizaciones, empleados, usuarios y seguridad. Las invitaciones son de un solo uso; reenviar genera un enlace nuevo e invalida el anterior. Una cuenta eliminada requiere una invitación nueva." },
      );
    }
    steps.push({ title: "Permiso de descargas de Excel", text: "El Administrador puede permitir o bloquear las descargas de Excel del equipo en Configuración → Usuarios. El permiso aplica a Gerente, Operador y Solo lectura; el Administrador conserva sus descargas. La impresión y la importación mantienen sus permisos habituales." });
    if (process.env.NEXT_PUBLIC_MRMAA_REALTIME === "true") steps.push({ title: "Actualizaciones del equipo", text: "Los cambios guardados se actualizan para los usuarios del mismo restaurante sin recargar la página. Los filtros y formularios abiertos se conservan. Si aparece un aviso de cambios recientes, revise los datos antes de guardar. Al recuperar la conexión se consultan las versiones actuales." });
    steps.push({ title: "Todo listo", text: "Ya conoce las funciones principales. Puede iniciar este recorrido nuevamente en cualquier momento desde Tutorial." });
    return steps;
  }, [isAdmin, canManageQuoteProducts, canManageReservationAreas]);
  useEffect(() => {
    if (!restaurantId || !memberRole || tutorialChecked) return;
    setTutorialChecked(true);
    if (session.user.user_metadata?.mrmaa_tutorial_completed !== true) {
      setTutorialStep(0);
      setTutorialOpen(true);
    }
  }, [restaurantId, memberRole, tutorialChecked, session.user.user_metadata]);
  useEffect(() => {
    const target = tutorialSteps[tutorialStep]?.tab;
    if (tutorialOpen && target && target !== tab) {
      if (confirmDiscardChanges()) setTab(target);
      else setTutorialOpen(false);
    }
  }, [tutorialOpen, tutorialStep, tutorialSteps]);
  async function finishTutorial() {
    setTutorialOpen(false);
    await supabase.auth.updateUser({ data: { mrmaa_tutorial_completed: true } });
  }
  function startTutorial() {
    setTutorialStep(0);
    setTutorialOpen(true);
  }
  const totals = useMemo(
    () =>
      calculateQuoteWithAdjustments(
        quoteForm.items,
        appSettings.discounts === false ? 0 : quoteForm.discount_pct,
        appSettings.tips === false ? 0 : quoteForm.tip_pct,
        quoteForm.deposit,
        quoteForm.adjustments || [],
      ),
    [quoteForm, appSettings],
  );
  const field = (key: string, value: any) =>
    setQuoteForm((f: any) => ({ ...f, [key]: value }));
  const item = (index: number, key: keyof QuoteItem, value: any) =>
    setQuoteForm((f: any) => ({
      ...f,
      items: f.items.map((x: QuoteItem, i: number) =>
        i === index
          ? {
              ...x,
              [key]:
                key === "name" || key === "description"
                  ? value
                  : value === ""
                    ? ""
                    : numberValue(value),
            }
          : x,
      ),
    }));
  const newQuote = () => ({
    ...emptyQuote(),
    tip_pct: appSettings.tips === false ? 0 : 10,
    customer_note: appSettings.fixed_customer_note
      ? appSettings.customer_note || ""
      : "",
    adjustments: (appSettings.quote_custom_adjustments || [])
      .filter((x: any) => x.active !== false)
      .map((x: any) => ({
        id: x.id,
        label: x.label,
        kind: x.kind,
        mode: x.mode,
        value: numberValue(x.default_value),
      })),
  });
  const chooseProduct = (id: string) => {
    const product = quoteProducts.find((x) => x.id === id);
    if (!product) return;
    setQuoteForm((f: any) => {
      const next = {
        name: product.name,
        description: product.description || "",
        quantity: 1,
        unit_price: Number(product.price),
      };
      const emptyIndex = f.items.findIndex((x: QuoteItem) => !x.name.trim());
      return {
        ...f,
        items:
          emptyIndex >= 0
            ? f.items.map((x: QuoteItem, i: number) =>
                i === emptyIndex ? next : x,
              )
            : [...f.items, next],
      };
    });
  };
  function chooseClient(c: Client | null, target: "quote" | "reservation") {
    const id = c?.id || "";
    if (target === "quote")
      setQuoteForm((f: any) => ({
        ...f,
        client_id: id,
        client_name: c?.name || "",
        client_phone: c?.phone || "",
        client_email: c?.email || "",
      }));
    else
      setReservationForm((f: any) => ({
        ...f,
        client_id: id,
        client_name: c?.name || "",
        phone: c?.phone || "",
      }));
  }
  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorize("canOperate"))) return;
    setError("");
    const duplicateResult = await supabase.rpc("v2_find_duplicate_client", {
      p_restaurant_id: restaurantId,
      p_name: clientForm.name.trim(),
      p_phone: clientForm.phone.trim(),
      p_email: clientForm.email.trim(),
      p_exclude_id: clientEdit?.id || null,
    });
    if (duplicateResult.error) return setError(duplicateResult.error.message);
    const duplicate = duplicateResult.data?.[0];
    if (duplicate) {
      return setError(`Ya existe el cliente ${duplicate.name} con ese ${duplicate.match_reason}.`);
    }
    const payload = {
      restaurant_id: restaurantId,
      name: clientForm.name.trim(),
      phone: clientForm.phone.trim() || null,
      email: clientForm.email.trim() || null,
      notes: clientForm.notes.trim() || null,
    };
    const res = clientEdit
      ? await supabase
          .from("v2_clients")
          .update(payload)
          .eq("id", clientEdit.id)
      : await supabase.from("v2_clients").insert(payload);
    if (res.error) return setError(res.error.message);
    setClientOpen(false);
    setClientEdit(null);
    setDataVersion((value) => value + 1);
  }
  async function quotesCanBeDeleted(ids: string[]) {
    const result = await supabase.from("v2_reservations").select("id")
      .eq("restaurant_id", restaurantId).is("deleted_at", null).in("quote_id", ids).limit(1);
    if (result.error) { setError(result.error.message); return false; }
    if (result.data?.length) {
      setError("Primero elimine la reserva vinculada para poder eliminar la cotización.");
      return false;
    }
    return true;
  }
  async function moveToTrash(
    entity: "clientes" | "cotizaciones" | "reservaciones",
    id: string,
    label: string,
  ) {
    if (!(await authorize(entity === "reservaciones" ? "canDeleteReservations" : "isAdmin"))) return;
    if (entity === "cotizaciones" && !(await quotesCanBeDeleted([id]))) return;
    if (
      !confirmApp(
        `¿Enviar ${label} a la papelera? El Administrador podrá restaurarlo durante 365 días.`,
      )
    )
      return;
    setError("");
    const { error } = await supabase.rpc("v2_soft_delete", {
      entity,
      target_id: id,
    });
    if (error) return setError(error.message);
    setPreview(null);
    setDataVersion((value) => value + 1);
  }
  async function moveManyToTrash(
    entity: "clientes" | "cotizaciones" | "reservaciones",
    ids: string[],
  ) {
    if (!ids.length || !(await authorize(entity === "reservaciones" ? "canDeleteReservations" : "isAdmin"))) return;
    if (entity === "cotizaciones" && !(await quotesCanBeDeleted(ids))) return;
    if (
      !confirmApp(
        `¿Enviar ${ids.length} registro(s) seleccionados a la papelera? El Administrador podrá restaurarlos durante 365 días.`,
      )
    )
      return;
    setError("");
    const results = await Promise.all(
      ids.map((id) =>
        supabase.rpc("v2_soft_delete", { entity, target_id: id }),
      ),
    );
    const failed = results.find((result) => result.error)?.error;
    if (failed) return setError(failed.message);
    setPreview(null);
    setDataVersion((value) => value + 1);
  }
  async function ensureClient(data: {
    name: string;
    phone?: string;
    email?: string;
    client_id?: string;
  }) {
    if (data.client_id) return data.client_id;
    const result = await supabase.rpc("v2_find_or_create_client", {
      p_restaurant_id: restaurantId,
      p_name: data.name.trim(),
      p_phone: (data.phone || "").trim(),
      p_email: (data.email || "").trim(),
    });
    if (result.error) throw result.error;
    return result.data as string;
  }
  async function saveQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!(await authorize("canOperate"))) return;
    setError("");
    if (quoteForm.area && !selectedArea(quoteForm.area,quoteForm.area_id))
      return setError('Seleccione un área del listado.');
    const valid = quoteForm.items.filter((x: QuoteItem) => x.name.trim());
    if (!valid.length)
      return setError("Agregue al menos un producto o servicio.");
    const t = calculateQuoteWithAdjustments(
      valid,
      appSettings.discounts === false ? 0 : quoteForm.discount_pct,
      appSettings.tips === false ? 0 : quoteForm.tip_pct,
      quoteForm.deposit,
      quoteForm.adjustments || [],
    );
    let quoteId = quoteEdit?.id;
    let clientId: string;
    try {
      clientId = await ensureClient({
        name: quoteForm.client_name,
        phone: quoteForm.client_phone,
        email: quoteForm.client_email,
        client_id: quoteForm.client_id,
      });
    } catch (err: any) {
      return setError(err.message || "No se pudo crear el cliente.");
    }
    const payload = {
      restaurant_id: restaurantId,
      client_id: clientId,
      client_name: quoteForm.client_name.trim(),
      client_phone: quoteForm.client_phone.trim(),
      client_email: quoteForm.client_email.trim(),
      event_date: quoteForm.event_date,
      event_time: quoteForm.event_time || null,
      area: quoteForm.area.trim(),
      area_id: selectedArea(quoteForm.area,quoteForm.area_id)?.id || null,
      guests: Number(quoteForm.guests) || 0,
      discount_pct: t.discountPct,
      tip_pct: t.tipPct,
      subtotal: t.subtotal,
      total: t.total,
      deposit: t.deposit,
      payment_method: quoteForm.payment_method || "",
      balance: t.balance,
      customer_note: quoteForm.customer_note.trim(),
      internal_notes: quoteForm.internal_notes.trim(),
      custom_fields: quoteForm.custom_fields || {},
      adjustments: (quoteForm.adjustments || []).map((x: QuoteAdjustment) => ({
        id: x.id,
        label: x.label,
        kind: x.kind,
        mode: x.mode,
        value: numberValue(x.value),
      })),
      ...(quoteEdit ? {} : { status: "pendiente" }),
    };
    if (quoteEdit) {
      const u = await supabase
        .from("v2_quotes")
        .update(payload)
        .eq("id", quoteEdit.id);
      if (u.error) return setError(u.error.message);
      const d = await supabase
        .from("v2_quote_items")
        .delete()
        .eq("quote_id", quoteEdit.id);
      if (d.error) return setError(d.error.message);
    } else {
      let insertedId = "";
      for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
        const latest = await supabase
          .from("v2_quotes")
          .select("quote_number")
          .eq("restaurant_id", restaurantId)
          .order("quote_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest.error) return setError(latest.error.message);
        const nextNumber = Math.max(
          quoteStart,
          Number(latest.data?.quote_number || quoteStart - 1) + 1,
        );
        const ins = await supabase
          .from("v2_quotes")
          .insert({ ...payload, quote_number: nextNumber })
          .select("id")
          .single();
        if (!ins.error) insertedId = ins.data.id;
        else if (ins.error.code !== "23505") return setError(ins.error.message);
      }
      if (!insertedId)
        return setError(
          "No se pudo asignar el número de cotización. Intente nuevamente.",
        );
      quoteId = insertedId;
    }
    const rows = valid.map((x: QuoteItem, index: number) => ({
      quote_id: quoteId,
      position: index,
      name: x.name.trim(),
      description: x.description.trim() || null,
      quantity: numberValue(x.quantity),
      unit_price: numberValue(x.unit_price),
      line_total: numberValue(x.quantity) * numberValue(x.unit_price),
    }));
    const added = await supabase.from("v2_quote_items").insert(rows);
    if (added.error) return setError(added.error.message);
    setQuoteOpen(false);
    setQuoteEdit(null);
    setDataVersion((value) => value + 1);
  }
  async function saveReservation(e: React.FormEvent) {
    e.preventDefault();
    if(reservationSaving.current)return;
    reservationSaving.current=true;
    try {
    if (!(await authorize("canOperate"))) return;
    if (!(await checkNearby(reservationForm.area,reservationForm.area_id,reservationForm.event_date,reservationForm.event_time,reservationEdit?.id)))return;
    let clientId: string;
    try {
      clientId = await ensureClient({
        name: reservationForm.client_name,
        phone: reservationForm.phone,
        client_id: reservationForm.client_id,
      });
    } catch (err: any) {
      return setError(err.message || "No se pudo crear el cliente.");
    }
    const payload = {
      restaurant_id: restaurantId,
      client_id: clientId,
      client_name: reservationForm.client_name.trim(),
      phone: reservationForm.phone.trim(),
      event_date: reservationForm.event_date,
      event_time: reservationForm.event_time || null,
      area: reservationForm.area.trim(),
      area_id: selectedArea(reservationForm.area,reservationForm.area_id)?.id,
      guests: Number(reservationForm.guests) || 0,
      menu: reservationForm.menu.trim(),
      deposit:
        appSettings.reservation_allow_deposits === false
          ? 0
          : numberValue(reservationForm.deposit),
      payment_method:
        appSettings.reservation_allow_deposits === false
          ? ""
          : reservationForm.payment_method || "",
      notes: reservationForm.notes.trim(),
      status: reservationForm.status,
      subtotal: 0,
      discount_pct: 0,
      tip_pct: 0,
      total: 0,
      balance: 0,
    };
    const res = reservationEdit
      ? await supabase
          .from("v2_reservations")
          .update(payload)
          .eq("id", reservationEdit.id)
      : await supabase.from("v2_reservations").insert(payload);
    if (res.error) return setError(res.error.message);
    setReservationOpen(false);
    setReservationEdit(null);
    setDataVersion((value) => value + 1);
    } finally {reservationSaving.current=false;}
  }
  async function convertQuote(q: Quote) {
    if(reservationSaving.current)return;
    reservationSaving.current=true;
    try {
    if (!(await authorize("canOperate"))) return;
    const linked = await supabase.from("v2_reservations").select("id")
      .eq("restaurant_id", restaurantId).eq("quote_id", q.id).is("deleted_at", null).limit(1);
    if (linked.error) return setError(linked.error.message);
    if (linked.data?.length) {
      setDataVersion(value => value + 1);
      return setError("Esta cotización ya tiene una reservación vinculada.");
    }
    if (!(await checkNearby(q.area,(q as any).area_id,q.event_date,q.event_time || '')))return;
    const menu = q.items
      .map((x) => `${x.name}${x.quantity !== 1 ? ` × ${x.quantity}` : ""}`)
      .join(", ");
    let clientId = q.client_id;
    if (!clientId) {
      try {
        clientId = await ensureClient({
          name: q.client_name,
          phone: q.client_phone,
          email: q.client_email,
        });
      } catch (err: any) {
        return setError(err.message || "No se pudo crear el cliente.");
      }
    }
    const payload = {
      restaurant_id: restaurantId,
      quote_id: q.id,
      client_id: clientId,
      client_name: q.client_name,
      phone: q.client_phone,
      event_date: q.event_date,
      event_time: q.event_time || null,
      area: q.area,
      area_id: selectedArea(q.area,(q as any).area_id)?.id,
      guests: q.guests,
      menu,
      subtotal: q.subtotal,
      discount_pct: q.discount_pct,
      tip_pct: q.tip_pct,
      total: q.total,
      deposit: q.deposit,
      payment_method: q.payment_method || "",
      balance: q.balance,
      notes: q.internal_notes,
      status: "confirmada",
    };
    const res = await supabase
      .from("v2_reservations")
      .insert(payload)
      .select("*")
      .single();
    if (res.error)
      return setError(
        res.error.code === "23505"
          ? "Esta cotización ya tiene una reservación vinculada."
          : res.error.message,
      );
    setDataVersion((value) => value + 1);
    setTab("reservations");
    } finally {reservationSaving.current=false;}
  }
  async function openQuoteById(quoteId: string) {
    try {
      const quote = await readQuoteDetail(supabase, restaurantId, quoteId);
      if (!quote) throw new Error("No se pudo abrir la cotización.");
      setPreview(quote);
    } catch (error) { setError(userMessage(error)); }
  }
  function editQuote(q: Quote) {
    if (!canOperate) return setError(ACCESS_DENIED);
    if (tab !== "quotes" && !confirmDiscardChanges()) return;
    setTab("quotes");
    const savedAdjustments = q.adjustments || [];
    const missingActiveAdjustments = (appSettings.quote_custom_adjustments || [])
      .filter(
        (configured: any) =>
          configured.active !== false &&
          !savedAdjustments.some((saved) => saved.id === configured.id),
      )
      .map((configured: any) => ({
        id: configured.id,
        label: configured.label,
        kind: configured.kind,
        mode: configured.mode,
        value: numberValue(configured.default_value),
      }));
    setQuoteEdit(q);
    setQuoteForm({
      ...q,
      custom_fields: q.custom_fields || {},
      adjustments: [...savedAdjustments, ...missingActiveAdjustments],
      items: q.items.map((x) => ({ ...x })),
    });
    setQuoteOpen(true);
    setPreview(null);
  }
  function editReservation(r: Reservation) {
    if (!canOperate) return setError(ACCESS_DENIED);
    setReservationEdit(r);
    setReservationForm({
      ...r,
      guests: r.guests ?? "",
      deposit: r.deposit ?? "",
    });
    setReservationOpen(true);
  }
  function openClient(c?: Client) {
    if (!canOperate) return setError(ACCESS_DENIED);
    setClientEdit(c || null);
    setClientForm(
      c
        ? {
            name: c.name,
            phone: c.phone || "",
            email: c.email || "",
            notes: c.notes || "",
          }
        : { name: "", phone: "", email: "", notes: "" },
    );
    setClientOpen(true);
  }
  return (
    <>
      <div className="shell">
        <aside>
          <div className="brand">
            {appSettings.logo_data_url ? (
              <TransparentLogo
                className="brandBusinessLogo"
                src={appSettings.logo_data_url}
                alt={`Logo de ${restaurantName}`}
              />
            ) : (
              <div className="mark">M</div>
            )}
            <div>
              <strong>MRMAA</strong>
              <span>{restaurantName}</span>
            </div>
          </div>
          <nav>
            <Nav
              active={tab === "reservations"}
              onClick={() => navigateTab("reservations")}
              icon={<CalendarDays />}
            >
              Reservaciones
            </Nav>
            <Nav
              active={tab === "clients"}
              onClick={() => navigateTab("clients")}
              icon={<Users />}
            >
              Clientes
            </Nav>
            <Nav
              active={tab === "quotes"}
              onClick={() => navigateTab("quotes")}
              icon={<FileText />}
            >
              Cotizaciones
            </Nav>
            <Nav
              active={tab === "schedules"}
              onClick={() => navigateTab("schedules")}
              icon={<Clock3 />}
            >
              Horarios
            </Nav>
            {isAdmin && (
              <>
                <Nav
                  active={tab === "reports"}
                  onClick={() => navigateTab("reports")}
                  icon={<BarChart3 />}
                >
                  Reportes
                </Nav>
              </>
            )}
            {canManageQuoteProducts && (
              <Nav
                active={tab === "settings"}
                onClick={() => navigateTab("settings")}
                icon={<Settings />}
              >
                Configuración
              </Nav>
            )}
          </nav>
          <button className="tutorialLauncher helpLauncher" onClick={() => setHelpOpen(true)}>
            <BookOpen />
            <span>Instructivo</span>
          </button>
          <button className="tutorialLauncher" onClick={startTutorial}>
            <HelpCircle />
            <span>Tutorial</span>
          </button>
          <button className="tutorialLauncher" onClick={()=>setTipsOpen(true)}><BookOpen /><span>Consejos para tu restaurante</span></button>
          <button className="logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { if (confirmDiscardChanges()) supabase.auth.signOut(); }}>
            <LogOut />
            <span>Cerrar sesión</span>
          </button>
        </aside>
        <main className="workspace">
          <header>
            <div>
              <span className="eyebrow">{restaurantName}</span>
              <h1>
                {
                  {
                    reservations: "Reservaciones",
                    clients: "Clientes",
                    quotes: "Cotizaciones",
                    schedules: "Horarios",
                    reports: "Reportes",
                    settings: "Configuración",
                  }[tab]
                }
              </h1>
            </div>
            {canOperate && (tab === "reservations" ||
              tab === "clients" ||
              tab === "quotes") && (
              <button
                className="primary"
                onClick={() => {
                  if (tab === "clients") openClient();
                  if (tab === "quotes") {
                    setQuoteEdit(null);
                    setQuoteForm(newQuote());
                    setQuoteOpen(true);
                  }
                  if (tab === "reservations") {
                    setReservationEdit(null);
                    setReservationForm(emptyReservation());
                    setReservationOpen(true);
                  }
                }}
              >
                <Plus />
                Nuevo
              </button>
            )}
          </header>
          {error && (
            <div className="alert">
              {userMessage(error)}
              {loadFailed && <button type="button" className="secondary" onClick={() => void load(false)}>Reintentar</button>}
              <button onClick={() => setError("")}>
                <X />
              </button>
            </div>
          )}
          {sync.enabled && canRead && sync.status === 'reconnecting' && <p className="moduleNotice" role="status">Reconectando las actualizaciones. Puede continuar; sus cambios sin guardar se conservan.</p>}
          {remoteDraftNotice && hasOpenDraft && <p className="moduleNotice" role="status">Hay cambios recientes en los datos. Su formulario se conserva; revise la versión actual antes de guardar.</p>}
          {busy ? (
            <div className="empty">Cargando información…</div>
          ) : !canRead ? (
            <div className="empty">No tiene acceso activo a este restaurante.
              <button className="secondary" onClick={() => load(true)}>Verificar acceso</button>
            </div>
          ) : tab === "clients" ? (
            <Clients
              canEdit={canOperate}
              canDelete={isAdmin}
              restaurantId={restaurantId}
              refreshToken={dataVersion}
              edit={openClient}
              removeMany={(ids) => moveManyToTrash("clientes", ids)}
              remove={(client) =>
                moveToTrash("clientes", client.id, client.name)
              }
            />
          ) : tab === "quotes" ? (
            <Quotes
              canEdit={canOperate}
              canDelete={isAdmin}
              restaurantId={restaurantId}
              refreshToken={dataVersion}
              edit={editQuote}
              preview={setPreview}
              convert={convertQuote}
              removeMany={(ids) => moveManyToTrash("cotizaciones", ids)}
              remove={(quote) =>
                moveToTrash(
                  "cotizaciones",
                  quote.id,
                  `la cotización #${quote.quote_number}`,
                )
              }
            />
          ) : tab === "reservations" ? (
            <ReservationsEnhanced
              canEdit={canOperate}
              canDelete={canDeleteReservations}
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              refreshToken={dataVersion}
              preferences={appSettings}
              reload={async () => setDataVersion((value) => value + 1)}
              edit={editReservation}
              removeMany={(ids) => moveManyToTrash("reservaciones", ids)}
              remove={(reservation) =>
                moveToTrash(
                  "reservaciones",
                  reservation.id,
                  `la reservación de ${reservation.client_name}`,
                )
              }
              openQuote={openQuoteById}
            />
          ) : tab === "schedules" ? (
            <MonthlySchedules restaurantId={restaurantId} canEdit={canManageSchedules} />
          ) : tab === "reports" && isAdmin ? (
            <EnhancedReports
              restaurantId={restaurantId}
            />
          ) : tab === "settings" && canManageQuoteProducts ? (
            <EnhancedSettings
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              onNameChange={setRestaurantName}
              onSettingsChange={setAppSettings}
              onAreasChange={setAreas}
              onProductsChange={setQuoteProducts}
              catalogsOnly={!isAdmin}
            />
          ) : (
            <ReservationsEnhanced
              canEdit={canOperate}
              canDelete={isAdmin}
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              refreshToken={dataVersion}
              reload={async () => setDataVersion((value) => value + 1)}
              edit={editReservation}
              removeMany={(ids) => moveManyToTrash("reservaciones", ids)}
              remove={(reservation) => moveToTrash("reservaciones", reservation.id, `la reservación de ${reservation.client_name}`)}
              openQuote={openQuoteById}
            />
          )}
        </main>
      </div>
      {helpOpen && (
        <div className="modalBackdrop helpBackdrop" onMouseDown={(event) => event.target === event.currentTarget && setHelpOpen(false)}>
          <section className="helpCenter" role="dialog" aria-modal="true" aria-label="Instructivo de MRMAA">
            <header>
              <div><span className="eyebrow">AYUDA PERMANENTE</span><h2>Instructivo de MRMAA</h2></div>
              <button className="icon" onClick={() => setHelpOpen(false)} aria-label="Cerrar"><X /></button>
            </header>
            <div className="helpContent">
              <section>
                <h3>Roles y permisos</h3>
                <div className="permissionTable">
                  <div className="permissionHead"><b>Rol</b><b>Puede hacer</b></div>
                  <div><strong>Administrador</strong><span>Acceso total, reportes, configuración, usuarios, seguridad, papelera y eliminación definitiva.</span></div>
                  <div><strong>Gerente</strong><span>Crear y modificar reservaciones, clientes, cotizaciones, horarios, menús y productos. Enviar reservaciones a la papelera. Agregar, editar y eliminar áreas de reservaciones. Sin reportes, usuarios ni configuración administrativa.</span></div>
                  <div><strong>Operación</strong><span>Crear y modificar reservaciones, clientes, cotizaciones, menús y productos. Agregar, editar y eliminar áreas de reservaciones. Horarios de consulta.</span></div>
                  <div><strong>Solo lectura</strong><span>Consultar, buscar, imprimir y exportar; no puede crear, modificar, convertir, importar ni eliminar.</span></div>
                </div>
              </section>
              <HelpSection title="Primero: configure las áreas de reservaciones" text="Antes de crear reservas, Administrador, Gerente u Operador deben abrir Configuración → Reservaciones → Áreas para reservaciones, escribir el nombre y pulsar Agregar. Por ejemplo: Salón, Terraza o Jardín. El listado empieza vacío y es independiente de las áreas de Horarios. Los usuarios de solo lectura deben solicitar estos cambios al equipo." />
              <HelpSection title="Reservaciones canceladas y papelera" text="Las reservaciones canceladas se identifican con una etiqueta roja. Administrador y Gerente pueden enviar una o varias reservaciones a la papelera, después de confirmar. Solo el Administrador puede restaurarlas durante 365 días. Si una reserva tiene cotización, al enviarla a la papelera la cotización vuelve a pendiente y puede convertirse nuevamente." />
              <HelpSection title="Seleccione un área del listado" text="En reservaciones y cotizaciones, seleccione un área configurada. Al escribir aparecen sugerencias de áreas. Seleccione una sugerencia o use el listado: ambos campos se actualizan con la misma área. Solo se admiten áreas configuradas. Las cotizaciones pueden quedar sin área mientras se preparan; para convertirlas en reserva debe seleccionarla. El aviso de tres horas compara reservas del mismo día y área." />
              <HelpSection title="Editar o eliminar áreas" text="Administrador, Gerente y Operador pueden agregar, editar o eliminar áreas en Configuración → Reservaciones. Cada acción guarda el catálogo inmediatamente. Eliminar pide confirmación y retira el área de nuevas selecciones; conserva el historial de reservas y cotizaciones anteriores. Las demás preferencias de reservaciones son exclusivas del Administrador." />
              <HelpSection title="Reservaciones" text="Nuevo crea una reserva. Hoy, Anterior, Siguiente, Una fecha y De–a filtran el calendario. Plantilla descarga el formato; Importar crea reservas desde Excel y avisa sobre posibles cruces en áreas iguales o similares dentro de tres horas; Excel descarga los resultados filtrados; Imprimir genera el reporte completo. Editar modifica y Cotización abre el documento relacionado." />
              <HelpSection title="Permiso de descargas de Excel" text="El Administrador puede permitir o bloquear las descargas de Excel del equipo en Configuración → Usuarios. El permiso aplica a Gerente, Operador y Solo lectura; el Administrador conserva sus descargas. La impresión y la importación mantienen sus permisos habituales." />
              <HelpSection title="Clientes" text="Nuevo registra un cliente. Busque por nombre, teléfono o correo. Excel e Imprimir incluyen todos los resultados filtrados. Editar actualiza datos y Papelera conserva el registro durante 365 días." />
              {process.env.NEXT_PUBLIC_MRMAA_REALTIME === "true" && <HelpSection title="Actualizaciones del equipo" text="Los cambios guardados se actualizan para los usuarios del mismo restaurante sin recargar la página. Los filtros y formularios abiertos se conservan. Si aparece un aviso de cambios recientes, revise los datos antes de guardar. Al recuperar la conexión se consultan las versiones actuales." />}
              <HelpSection title="Cotizaciones" text="Nuevo abre el formulario. Ingrese cliente, evento, productos, descuentos, propina, anticipo y método de pago. Ver abre el preview sin cambiar de sección; PDF descarga el documento completo; Imprimir abre el PDF para imprimirlo con sus páginas originales; si el diálogo no aparece, use el botón de impresión del visor y seleccione Ajustar al área imprimible; Editar modifica; Convertir en reserva transfiere la información y marca ambos registros como confirmados. Para eliminar una cotización convertida, elimine primero la reservación vinculada." />
              {canManageQuoteProducts && <HelpSection title="Menús y productos" text="Abra Configuración → Cotizaciones. Administrador, Gerente y Operación pueden agregar o editar nombre, descripción en varias líneas y precio. Los productos guardados aparecen en el selector de nuevas cotizaciones. Solo el Administrador puede eliminarlos." />}
              <HelpSection title="Horarios" text="Seleccione uno o varios empleados y un día o periodo. Minimice el cuadro con el botón superior o, en computadora, cambie su altura arrastrando la esquina inferior derecha, junto al aviso. Asigne turno, descanso, comida y notas. Generar automáticamente necesita dos semanas completas. Excel e Imprimir descargan el rango seleccionado. Gerente y Administrador pueden modificar; los demás consultan e imprimen. El equipo puede descargar Excel si el Administrador lo permite." />
              {isAdmin && <>
                <HelpSection title="Reportes" text="Revise reservaciones, anticipos, métodos de pago, clientes y actividad mediante filtros. Cada pantalla muestra hasta 50 registros; exportar o imprimir incluye todos los resultados filtrados." />
                <HelpSection title="Configuración" text="Administra negocio, campos, cotizaciones, horarios, empleados, usuarios, seguridad, papelera e historial. Los cambios de correo requieren confirmación desde la nueva dirección. Las invitaciones funcionan una sola vez; reenviar invalida el enlace anterior y eliminar el usuario impide reutilizarlo." />
                <HelpSection title="Respaldos e historial" text="Seguridad permite descargar el respaldo completo en Excel. El Historial registra modificaciones, exportaciones a Excel e impresiones con usuario, rol, fecha y sección." />
              </>}
            </div>
          </section>
        </div>
      )}
      {tipsOpen && <Modal title="Consejos para tu restaurante" close={()=>setTipsOpen(false)}>
        <div className="moduleStack">{[
          ['Mesas y áreas','Numere sus mesas y configure nombres claros para cada área. Seleccione el área del listado al reservar.'],
          ['Reservaciones cercanas','Antes de guardar o convertir una cotización, MRMAA avisa si hay otra reservación el mismo día y área hasta 3 horas antes o después. Revise horarios y personas antes de continuar. El aviso no garantiza disponibilidad ni considera la duración del evento.'],
          ['Confirmaciones','Confirme con anticipación y actualice el estado cuando el cliente cancele.'],
          ['Anticipos','Registre monto y método de pago para mantener informado al equipo.'],
          ['Clientes','Busque al cliente antes de crearlo para conservar su historial y evitar duplicados.'],
          ['Cotizaciones','Revise cantidades, precios, descuentos y propina antes de enviar. Convierta la cotización aprobada en reservación.'],
          ['Observaciones','Anote cumpleaños, accesibilidad y solicitudes alimentarias relevantes para el servicio.'],
          ['Horarios','Revise cobertura por área, descansos y tiempos de comida antes de publicar.'],
          ['Usuarios','Use una cuenta por colaborador y asigne solo los permisos necesarios.'],
          ['Conexión a internet','Use una conexión estable y con buena señal de Wi-Fi o datos móviles. Si la carga tarda, revise su conexión y espere la confirmación antes de repetir un guardado o envío.'],
          ['Cierre del día','Revise las reservas de mañana, anticipos pendientes y cotizaciones por confirmar.'],
        ].map(([title,body])=><article className="moduleCard" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
      </Modal>}
      {tutorialOpen && (
        <aside className="tutorialCard" role="dialog" aria-modal="false" aria-label="Tutorial de MRMAA">
          <div className="tutorialProgress">
            <span>Paso {tutorialStep + 1} de {tutorialSteps.length}</span>
            <button type="button" onClick={finishTutorial}>Omitir</button>
          </div>
          <div className="tutorialDots" aria-hidden="true">
            {tutorialSteps.map((_, index) => <i key={index} className={index <= tutorialStep ? "active" : ""} />)}
          </div>
          <HelpCircle className="tutorialIcon" />
          <h2>{t(tutorialSteps[tutorialStep].title)}</h2>
          <p>{t(tutorialSteps[tutorialStep].text)}</p>
          <div className="tutorialActions">
            <button type="button" className="secondary" disabled={tutorialStep === 0} onClick={() => setTutorialStep((step) => Math.max(0, step - 1))}><ChevronLeft /> Anterior</button>
            {tutorialStep === tutorialSteps.length - 1 ? (
              <button type="button" className="primary" onClick={finishTutorial}>Finalizar</button>
            ) : (
              <button type="button" className="primary" onClick={() => setTutorialStep((step) => Math.min(tutorialSteps.length - 1, step + 1))}>Siguiente <ChevronRight /></button>
            )}
          </div>
        </aside>
      )}
      {canOperate && clientOpen && (
        <Modal
          title={clientEdit ? "Editar cliente" : "Nuevo cliente"}
          close={() => discardDraft(() => setClientOpen(false))}
        >
          {remoteDraftNotice && <p className="moduleNotice" role="status">Hay cambios recientes en los datos. Su formulario se conserva; revise la versión actual antes de guardar.</p>}
          <form onSubmit={saveClient} className="form">
            <Field label="Nombre">
              <input
                required
                value={clientForm.name}
                onChange={(e) =>
                  setClientForm({ ...clientForm, name: e.target.value })
                }
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={clientForm.phone}
                onChange={(e) =>
                  setClientForm({ ...clientForm, phone: e.target.value })
                }
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={clientForm.email}
                onChange={(e) =>
                  setClientForm({ ...clientForm, email: e.target.value })
                }
              />
            </Field>
            <Field label="Notas">
              <input
                value={clientForm.notes}
                onChange={(e) =>
                  setClientForm({ ...clientForm, notes: e.target.value })
                }
              />
            </Field>
            <Actions />
          </form>
        </Modal>
      )}
      {canOperate && reservationOpen && (
        <Modal
          title={reservationEdit ? "Editar reservación" : "Nueva reservación"}
          close={() => discardDraft(() => setReservationOpen(false))}
        >
          {remoteDraftNotice && <p className="moduleNotice" role="status">Hay cambios recientes en los datos. Su formulario se conserva; revise la versión actual antes de guardar.</p>}
          <form onSubmit={saveReservation} className="form grid2">
            <Field label="Cliente registrado">
              <ClientSearchSelect
                restaurantId={restaurantId}
                value={reservationForm.client_id}
                initialLabel={reservationForm.client_name}
                onSelect={(client) => chooseClient(client, "reservation")}
              />
            </Field>
            <Field label="Nombre">
              <input
                required
                value={reservationForm.client_name}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    client_name: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                required
                value={reservationForm.event_date}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    event_date: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={reservationForm.event_time}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    event_time: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Área">
              <AreaPicker required areas={areas} value={reservationForm.area} areaId={reservationForm.area_id}
                onChange={(area,area_id)=>setReservationForm({...reservationForm,area,area_id})} />
            </Field>
            <Field label="Invitados">
              <input
                type="number"
                min="1"
                value={reservationForm.guests}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    guests: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={reservationForm.phone}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    phone: e.target.value,
                  })
                }
              />
            </Field>
            {appSettings.reservation_allow_deposits !== false && (
              <>
                <Field label="Anticipo">
                  <input
                    type="number"
                    min="0"
                    value={reservationForm.deposit}
                    onChange={(e) =>
                      setReservationForm({
                        ...reservationForm,
                        deposit: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Método de pago del anticipo">
                  <select
                    value={reservationForm.payment_method}
                    onChange={(e) =>
                      setReservationForm({
                        ...reservationForm,
                        payment_method: e.target.value,
                      })
                    }
                  >
                    <option value="">Sin especificar</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito bancario</option>
                    <option value="otro">Otro</option>
                  </select>
                </Field>
              </>
            )}
            <Field label="Menú">
              <input
                list="restaurant-menus"
                value={reservationForm.menu}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    menu: e.target.value,
                  })
                }
              />
            </Field>
            <datalist id="restaurant-areas">
              {areas.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
            <datalist id="restaurant-menus">
              {quoteProducts.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <Field label="Estado">
              <select
                value={reservationForm.status}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    status: e.target.value,
                  })
                }
              >
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </Field>
            <Field label="Observaciones">
              <textarea
                value={reservationForm.notes}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    notes: e.target.value,
                  })
                }
              />
            </Field>
            <Actions />
          </form>
        </Modal>
      )}
      {canOperate && quoteOpen && (
        <Modal
          wide
          title={
            quoteEdit
              ? `Editar cotización #${quoteEdit.quote_number}`
              : "Nueva cotización"
          }
          close={() => discardDraft(() => setQuoteOpen(false))}
        >
          {remoteDraftNotice && <p className="moduleNotice" role="status">Hay cambios recientes en los datos. Su formulario se conserva; revise la versión actual antes de guardar.</p>}
          <form onSubmit={saveQuote} className="quoteForm">
            <div className="grid3">
              <Field label="Cliente registrado">
                <ClientSearchSelect
                  restaurantId={restaurantId}
                  value={quoteForm.client_id}
                  initialLabel={quoteForm.client_name}
                  onSelect={(client) => chooseClient(client, "quote")}
                />
              </Field>
              <Field label="Nombre del cliente">
                <input
                  required
                  value={quoteForm.client_name}
                  onChange={(e) => field("client_name", e.target.value)}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  value={quoteForm.client_phone}
                  onChange={(e) => field("client_phone", e.target.value)}
                />
              </Field>
              <Field label="Fecha del evento">
                <input
                  type="date"
                  required
                  value={quoteForm.event_date}
                  onChange={(e) => field("event_date", e.target.value)}
                />
              </Field>
              <Field label="Hora">
                <input
                  type="time"
                  value={quoteForm.event_time}
                  onChange={(e) => field("event_time", e.target.value)}
                />
              </Field>
              <Field label="Área">
                <AreaPicker areas={areas} value={quoteForm.area} areaId={quoteForm.area_id}
                  onChange={(area,area_id)=>setQuoteForm({...quoteForm,area,area_id})} />
              </Field>
              <Field label="Invitados">
                <input
                  type="number"
                  min="1"
                  value={quoteForm.guests}
                  onChange={(e) => field("guests", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={quoteForm.client_email}
                  onChange={(e) => field("client_email", e.target.value)}
                />
              </Field>
              {(appSettings.quote_custom_client_fields || [])
                .filter((x: QuoteCustomField) => x.active !== false)
                .map((custom: QuoteCustomField) => (
                  <Field key={custom.id} label={custom.label}>
                    {custom.type === "textarea" ? (
                      <textarea
                        value={quoteForm.custom_fields?.[custom.id] || ""}
                        onChange={(e) =>
                          field("custom_fields", {
                            ...(quoteForm.custom_fields || {}),
                            [custom.id]: e.target.value,
                          })
                        }
                      />
                    ) : (
                      <input
                        type={custom.type || "text"}
                        value={quoteForm.custom_fields?.[custom.id] || ""}
                        onChange={(e) =>
                          field("custom_fields", {
                            ...(quoteForm.custom_fields || {}),
                            [custom.id]: e.target.value,
                          })
                        }
                      />
                    )}
                  </Field>
                ))}
            </div>
            <div className="items">
              {quoteProducts.length > 0 && (
                <label className="productPicker">
                  Agregar desde menús y productos
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      chooseProduct(e.target.value);
                      e.currentTarget.value = "";
                    }}
                  >
                    <option value="">Seleccione una opción…</option>
                    {quoteProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {money(Number(product.price))}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="itemHead">
                <span>Producto o servicio</span>
                <span>Descripción</span>
                <span>Cantidad</span>
                <span>Precio</span>
                <span>Total</span>
              </div>
              {quoteForm.items.map((x: QuoteItem, i: number) => (
                <div className="itemRow" key={i}>
                  <input
                    required
                    value={x.name}
                    onChange={(e) => item(i, "name", e.target.value)}
                  />
                  <textarea
                    rows={3}
                    style={{ resize: "vertical" }}
                    value={x.description}
                    onChange={(e) => item(i, "description", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.quantity}
                    onChange={(e) => item(i, "quantity", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.unit_price}
                    onChange={(e) => item(i, "unit_price", e.target.value)}
                  />
                  <strong>
                    {money(numberValue(x.quantity) * numberValue(x.unit_price))}
                  </strong>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  field("items", [...quoteForm.items, emptyItem()])
                }
              >
                <Plus />
                Agregar línea
              </button>
            </div>
            <div className="quoteBottom">
              <div>
                <Field label="Nota para el cliente">
                  <textarea
                    value={quoteForm.customer_note}
                    onChange={(e) => field("customer_note", e.target.value)}
                  />
                </Field>
                <Field label="Observaciones internas">
                  <textarea
                    value={quoteForm.internal_notes}
                    onChange={(e) => field("internal_notes", e.target.value)}
                  />
                </Field>
              </div>
              <div className="totals">
                <Total label="Subtotal" value={totals.subtotal} />
                {appSettings.discounts !== false && (
                  <>
                    <label>
                      <span>Descuento</span>
                      <span className="percent">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={quoteForm.discount_pct}
                          onChange={(e) =>
                            field("discount_pct", e.target.value)
                          }
                        />
                        %
                      </span>
                    </label>
                    <Total
                      label="Descuento aplicado"
                      value={-totals.discount}
                    />
                  </>
                )}
                {appSettings.tips !== false && (
                  <>
                    <label>
                      <span>Propina</span>
                      <span className="percent">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={quoteForm.tip_pct}
                          onChange={(e) => field("tip_pct", e.target.value)}
                        />
                        %
                      </span>
                    </label>
                    <Total label="Propina calculada" value={totals.tip} />
                  </>
                )}
                {(quoteForm.adjustments || []).map(
                  (adjustment: QuoteAdjustment, index: number) => {
                    const calculated = totals.adjustmentLines[index];
                    return (
                      <div className="customAdjustment" key={adjustment.id}>
                        <label>
                          <span>{adjustment.label}</span>
                          <span className={adjustment.mode === "percent" ? "percent" : ""}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={adjustment.value}
                              onChange={(e) =>
                                field(
                                  "adjustments",
                                  quoteForm.adjustments.map(
                                    (x: QuoteAdjustment, i: number) =>
                                      i === index
                                        ? {
                                            ...x,
                                            value:
                                              e.target.value === ""
                                                ? ("" as any)
                                                : numberValue(e.target.value),
                                          }
                                        : x,
                                  ),
                                )
                              }
                            />
                            {adjustment.mode === "percent" && "%"}
                          </span>
                        </label>
                        <Total
                          label={`${adjustment.kind === "discount" ? "Descuento" : "Cobro"} aplicado`}
                          value={
                            (adjustment.kind === "discount" ? -1 : 1) *
                            (calculated?.amount || 0)
                          }
                        />
                      </div>
                    );
                  },
                )}
                {
                  <>
                    <label>
                      <span>Anticipo</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quoteForm.deposit}
                        onChange={(e) => field("deposit", e.target.value)}
                      />
                    </label>
                    <label>
                      <span>Método de pago</span>
                      <select
                        value={quoteForm.payment_method}
                        onChange={(e) =>
                          field("payment_method", e.target.value)
                        }
                      >
                        <option value="">Sin especificar</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="deposito">Depósito bancario</option>
                        <option value="otro">Otro</option>
                      </select>
                    </label>
                  </>
                }
                <Total big label="Saldo pendiente" value={totals.balance} />
              </div>
            </div>
            <Actions />
          </form>
        </Modal>
      )}
      {canRead && preview && (
        <QuotePreview
          restaurantId={restaurantId}
          canEdit={canOperate}
          quote={preview}
          onOutputBusy={setPreviewExporting}
          restaurant={restaurantName}
          settings={appSettings}
          close={() => setPreview(null)}
          edit={() => editQuote(preview)}
        />
      )}
      {nearby && <Modal title={language==='en'?'Nearby reservations':'Reservaciones cercanas'} close={()=>answerWarning(false)}>
        <p>{language==='en'?'There are reservations in the same area and day within 3 hours before or after. Continue?':'Hay reservaciones el mismo día y área hasta 3 horas antes o después. ¿Desea continuar?'}</p>
        <ul>{nearby.slice(0,10).map(r=><li key={r.id}>{r.event_time?.slice(0,5)} · {r.guests} {language==='en'?'guests':'personas'}</li>)}</ul>
        {nearby.length>10 && <p>{language==='en'?'More matches exist.':'Hay más coincidencias.'}</p>}
        <div className="actions"><button type="button" className="secondary" autoFocus onClick={()=>answerWarning(false)}>{language==='en'?'Review':'Revisar'}</button>
          <button type="button" className="primary" onClick={()=>answerWarning(true)}>{language==='en'?'Save anyway':'Guardar de todos modos'}</button></div>
      </Modal>}
    </>
  );
}

function Nav({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Actions() {
  return (
    <div className="actions">
      <button className="primary" type="submit">
        Guardar
      </button>
    </div>
  );
}
function Total({
  label,
  value,
  big,
}: {
  label: string;
  value: number;
  big?: boolean;
}) {
  return (
    <div className={big ? "total big" : "total"}>
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}
function HelpSection({ title, text }: { title: string; text: string }) {
  const { t } = useAppPreferences();
  return <details className="helpSection"><summary>{t(title)}</summary><p>{t(text)}</p></details>;
}

function Modal({
  title,
  close,
  wide,
  children,
}: {
  title: string;
  close: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section className={wide ? "modal wide" : "modal"}>
        <header>
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Clients({
  canEdit = false,
  canDelete = false,
  restaurantId,
  refreshToken = 0,
  rows: initialRows = [],
  edit,
  remove,
  removeMany,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId?: string;
  refreshToken?: number;
  rows?: Client[];
  edit: (c: Client) => void;
  remove: (c: Client) => void;
  removeMany: (ids: string[]) => Promise<void>;
}) {
  const remoteVersion = useDataRefresh(restaurantId, "v2_clients");
  const excelAccess = useExcelExportAccess(restaurantId);
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [rows, setRows] = useState<Client[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const normalizedSearch = search.trim().replace(/[%(),]/g, " ");
  const querySearch = useListSearch(search, () => setPage(1));
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, querySearch, page]) : undefined,
    version: `${refreshToken}:${remoteVersion}`,
    read: async signal => {
      const from = (page - 1) * 50;
      let query = supabase.from("v2_clients").select("*", { count: "exact" })
        .eq("restaurant_id", restaurantId).is("deleted_at", null);
      if (querySearch)
        query = query.or(`name.ilike.%${querySearch}%,phone.ilike.%${querySearch}%,email.ilike.%${querySearch}%,notes.ilike.%${querySearch}%`);
      const result = await query.order("name").range(from, from + 49).abortSignal(signal);
      if (result.error) throw result.error;
      return result;
    },
    onData: result => { setRows((result.data || []) as Client[]); setTotal(result.count || 0); setLoadError(""); },
    onError: error => setLoadError(userMessage(error)),
    onLoading: setLoading,
  });
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = rows.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  async function allMatchingClients() {
    const result: Client[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase.from("v2_clients").select("*").eq("restaurant_id", restaurantId).is("deleted_at", null);
      if (normalizedSearch)
        query = query.or(`name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%,notes.ilike.%${normalizedSearch}%`);
      const batch = await query.order("name").range(from, from + 999);
      if (batch.error) throw batch.error;
      result.push(...((batch.data || []) as Client[]));
      if ((batch.data || []).length < 1000) return result;
    }
  }
  async function exportClients() {
    try {
      await excelAccess.ensureAllowed();
      const XLSX = await import("xlsx");
      const outputRows = await allMatchingClients();
      const language = currentAppLanguage();
      const data = outputRows.map((client) => translateRecord({
        Nombre: client.name,
        Telefono: client.phone || "",
        Correo: client.email || "",
        Notas: client.notes || "",
      }, language));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), translate("Clientes", language));
      await excelAccess.ensureAllowed();
      XLSX.writeFile(workbook, `${language === "en" ? "customers" : "clientes"}-${localDateISO()}.xlsx`);
      await recordAuditActivity(restaurantId, "excel_exportado", "clientes", { label: "Listado de clientes", rows: outputRows.length });
    } catch (error) { setLoadError(userMessage(error)); }
  }
  async function printClients() {
    const outputRows = await allMatchingClients();
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
    printHtml(`<html><head><title>Clientes</title><style>@page{margin:12mm}body{font-family:Arial;color:#18181b}h1{font-family:Georgia;margin-bottom:4px}p{color:#71717a}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left;font-size:11px;vertical-align:top}th{background:#18181b;color:#fff}</style></head><body><h1>Clientes</h1><p>${outputRows.length} cliente(s)</p><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Notas</th></tr></thead><tbody>${outputRows.map((client) => `<tr><td>${esc(client.name)}</td><td>${esc(client.phone)}</td><td>${esc(client.email)}</td><td>${esc(client.notes)}</td></tr>`).join("")}</tbody></table></body></html>`);
    await recordAuditActivity(restaurantId, "impresion", "clientes", { label: "Listado de clientes", rows: outputRows.length });
  }
  return (
    <div className="moduleStack">
      <div className="listToolbar">
        <input className="moduleSearch moduleCard" placeholder="Buscar cliente, teléfono o correo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
        {canDelete && selected.length > 0 && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionados ({selected.length})</button>}
        <button type="button" className="secondary" disabled={!excelAccess.allowed} title={excelAccess.allowed ? undefined : excelAccess.hint} onClick={exportClients}><FileSpreadsheet /> Descargar Excel</button>
        <button type="button" className="secondary" onClick={printClients}><Printer /> Imprimir</button>
      </div>
      {loadError && <p className="moduleNotice">{userMessage(loadError)}</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="cards">
          {rows.map((c) => (
            <article key={c.id} className={selected.includes(c.id) ? "selectedRecord" : ""}>
              {canDelete ? (<input className="recordCheckbox" type="checkbox" aria-label={`Seleccionar ${c.name}`} checked={selected.includes(c.id)} onChange={() => setSelected((ids) => ids.includes(c.id) ? ids.filter((id) => id !== c.id) : [...ids, c.id])} />) : null}
              <div>
                <h3>{c.name}</h3>
                <p>
                  {c.phone || "Sin teléfono"} · {c.email || "Sin email"}
                </p>
                {c.notes && <small>{c.notes}</small>}
              </div>
              <div className="rowActions">
                {canEdit && <button title="Editar cliente" onClick={() => edit(c)}>
                  <Pencil /> Editar
                </button>}
                {canDelete && <button title="Enviar a la papelera" onClick={() => remove(c)}>
                  <Trash2 /> Papelera
                </button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">Todavía no hay clientes.</div>
      )}
      <Pagination total={total} page={page} onPage={setPage} />
    </div>
  );
}
function ClientSearchSelect({
  restaurantId,
  value,
  initialLabel,
  onSelect,
}: {
  restaurantId: string;
  value: string;
  initialLabel?: string;
  onSelect: (client: Client | null) => void;
}) {
  const listId = useId();
  const label = (client: Client) =>
    [client.name, client.phone, client.email].filter(Boolean).join(" · ");
  const remoteVersion = useDataRefresh(restaurantId, "v2_clients");
  const [query, setQuery] = useState(initialLabel || "");
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);
  useEffect(() => {
    const term = query.trim().replace(/[%(),]/g, " ");
    if (term.length < 2) return setClients([]);
    const timer = window.setTimeout(async () => {
      const result = await supabase.from("v2_clients").select("id,restaurant_id,name,phone,email,notes")
        .eq("restaurant_id", restaurantId).is("deleted_at", null)
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
        .order("name").limit(20);
      setClients((result.data || []) as Client[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, restaurantId, remoteVersion]);
  return (
    <>
      <input
        type="search"
        list={listId}
        placeholder="Buscar nombre, teléfono o correo…"
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          const normalized = next.trim().toLowerCase();
          const match = clients.find((client) =>
            label(client).toLowerCase() === normalized,
          );
          if (match) onSelect(match);
          else if (!next) onSelect(null);
        }}
      />
      <datalist id={listId}>
        {clients.map((client) => (
          <option key={client.id} value={label(client)} />
        ))}
      </datalist>
    </>
  );
}

export function Quotes({
  canEdit = false,
  canDelete = false,
  restaurantId,
  refreshToken = 0,
  rows: initialRows = [],
  edit,
  preview,
  convert,
  remove,
  removeMany,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId?: string;
  refreshToken?: number;
  rows?: Quote[];
  edit: (q: Quote) => void;
  preview: (q: Quote) => void;
  convert: (q: Quote) => void;
  remove: (q: QuoteSummary) => void;
  removeMany: (ids: string[]) => Promise<void>;
}) {
  const remoteVersion = useDataRefresh(restaurantId, "v2_quotes,v2_quote_items,v2_reservations");
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [rows, setRows] = useState<QuoteSummary[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const querySearch = useListSearch(search, () => setPage(1));
  const actionRequest = useRef<AbortController | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  useEffect(() => () => { actionRequest.current?.abort(); }, [restaurantId]);
  useListQuery({
    queryKey: restaurantId ? JSON.stringify([restaurantId, querySearch, page]) : undefined,
    version: `${refreshToken}:${remoteVersion}`,
    read: signal => readQuotePage(supabase, restaurantId!, querySearch, page, signal),
    onData: result => { setRows(result.rows); setTotal(result.total); setLoadError(""); },
    onError: error => setLoadError(userMessage(error)),
    onLoading: setLoading,
  });
  async function openAction(row: QuoteSummary, action: (quote: Quote) => void) {
    if (actionRequest.current) return;
    const controller = new AbortController();
    actionRequest.current = controller;
    setActionId(row.id); setLoadError("");
    try {
      const quote = restaurantId
        ? await readQuoteDetail(supabase, restaurantId, row.id, controller.signal)
        : initialRows.find(quote => quote.id === row.id);
      if (controller.signal.aborted) return;
      if (!quote) throw new Error("No se pudo abrir la cotización.");
      await action(quote);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(userMessage(error));
    } finally {
      if (actionRequest.current === controller) actionRequest.current = null;
      if (!controller.signal.aborted) setActionId(null);
    }
  }
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id && row.status !== "convertida"))), [rows]);
  const visibleIds = rows.filter((row) => row.status !== "convertida").map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  return (
    <div className="moduleStack">
      <div className="listToolbar">
        <input className="moduleSearch moduleCard" placeholder="Buscar cotización, cliente, área o estado…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {canDelete && rows.length > 0 && <label className="selectVisible"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
        {canDelete && selected.length > 0 && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionadas ({selected.length})</button>}
      </div>
      {loadError && <p className="moduleNotice moduleError" role="alert">{userMessage(loadError)}</p>}
      {actionId && <p role="status">Cargando cotización…</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="table">
          <div className="tr head quoteRow">
            <span aria-hidden="true" />
            <span>Número</span>
            <span>Cliente</span>
            <span>Fecha</span>
            <span>Hora</span>
            <span>Área</span>
            <span>Total</span>
            <span>Estado</span>
            <span />
          </div>
          {rows.map((q) => (
            <div className={`tr quoteRow ${selected.includes(q.id) ? "selectedRecord" : ""}`} key={q.id}>
              <div className="quoteIdentity">
                {canDelete ? (<input className="recordCheckbox quoteCheckbox" type="checkbox" aria-label={`Seleccionar cotización ${q.quote_number}`} disabled={q.status === "convertida"} checked={selected.includes(q.id)} onChange={() => setSelected((ids) => ids.includes(q.id) ? ids.filter((id) => id !== q.id) : [...ids, q.id])} />) : <span aria-hidden="true" />}
                <strong>#{q.quote_number}</strong>
              </div>
              <span className="quoteClient"><small className="quoteFieldLabel">Cliente</small><span className="quoteFieldValue">{q.client_name || "—"}</span></span>
              <span className="quoteDate"><small className="quoteFieldLabel">Fecha</small><span className="quoteFieldValue">{displayDate(q.event_date)}</span></span>
              <span className="quoteTime"><small className="quoteFieldLabel">Hora</small><span className="quoteFieldValue">{q.event_time?.slice(0, 5) || "—"}</span></span>
              <span className="quoteArea"><small className="quoteFieldLabel">Área</small><span className="quoteFieldValue">{q.area || "—"}</span></span>
              <span className="quoteTotal"><small className="quoteFieldLabel">Total</small><strong className="quoteFieldValue">{money(q.total)}</strong></span>
              <span className="status quoteStatus">{q.status === "convertida" ? <><span>Convertida</span>{" · "}<span>Confirmada</span></> : q.status}</span>
              <div className="rowActions">
                {canEdit && <button title="Editar cotización" disabled={Boolean(actionId)} onClick={() => { void openAction(q, edit); }}>
                  <Pencil />
                  Editar
                </button>}
                <button title="Ver cotización" disabled={Boolean(actionId)} onClick={() => { void openAction(q, preview); }}>
                  <FileText />
                  Ver
                </button>
                {canEdit && q.status !== "convertida" && (
                  <button
                    className="convertAction"
                    title="Convertir en reservación"
                    disabled={Boolean(actionId)}
                    onClick={() => { void openAction(q, convert); }}
                  >
                    <ArrowRight />
                    Convertir en reserva
                  </button>
                )}
                {canDelete && q.status !== "convertida" && <button className="quoteDeleteAction" title="Enviar a la papelera" aria-label={`Enviar cotización ${q.quote_number} a la papelera`} onClick={() => remove(q)}>
                  <Trash2 />
                </button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Todavía no hay cotizaciones.</div>
      )}
      <Pagination total={total} page={page} onPage={setPage} />
    </div>
  );
}
function Reservations({
  rows,
  quotes,
  edit,
  openQuote,
}: {
  rows: Reservation[];
  quotes: Quote[];
  edit: (r: Reservation) => void;
  openQuote: (q: Quote) => void;
}) {
  return rows.length ? (
    <div className="table">
      <div className="tr res head">
        <span>Fecha</span>
        <span>Cliente</span>
        <span>Área</span>
        <span>Invitados</span>
        <span>Estado</span>
        <span />
      </div>
      {rows.map((r) => (
        <div className="tr res" key={r.id}>
          <strong>
            {displayDate(r.event_date)} · {r.event_time?.slice(0, 5)}
          </strong>
          <span>{r.client_name}</span>
          <span>{r.area || "—"}</span>
          <span>{r.guests}</span>
          <ReservationStatus status={r.status} />
          <div className="rowActions">
            {r.quote_id && quotes.find((q) => q.id === r.quote_id) && (
              <button
                title="Ver cotización"
                onClick={() =>
                  openQuote(quotes.find((q) => q.id === r.quote_id)!)
                }
              >
                <FileText />
              </button>
            )}
            <button onClick={() => edit(r)}>
              <Pencil />
            </button>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty">Todavía no hay reservaciones.</div>
  );
}
export function QuotePreview({
  restaurantId,
  onOutputBusy,
  canEdit = false,
  quote,
  restaurant,
  settings,
  close,
  edit,
}: {
  restaurantId?: string;
  onOutputBusy?: (busy: boolean) => void;
  canEdit?: boolean;
  quote: Quote;
  restaurant: string;
  settings: any;
  close: () => void;
  edit: () => void;
}) {
  const paperRef = useRef<HTMLElement>(null);
  const outputBusy = useRef(false);
  const [output, setOutput] = useState<"pdf" | "print" | null>(null);
  const [outputError, setOutputError] = useState("");
  const [printUrl, setPrintUrl] = useState("");
  const [printReady, setPrintReady] = useState(false);
  useEffect(() => () => { if (printUrl) URL.revokeObjectURL(printUrl); }, [printUrl]);
  async function exportDocument(action: "pdf" | "print") {
    if (outputBusy.current || !paperRef.current) return;
    outputBusy.current = true; onOutputBusy?.(true);
    setOutput(action); setOutputError(""); setPrintReady(false);
    const printWindow = action === "print"
      ? reserveQuotePrintWindow(`${currentAppLanguage() === "en" ? "Quote" : "Cotizacion"}-${quote.quote_number}`, translate("Preparando documento…", currentAppLanguage()))
      : null;
    try {
      const { downloadQuotePreviewPdf, printQuotePreview } = await import("@/lib/pdf");
      if (action === "pdf") await downloadQuotePreviewPdf(paperRef.current, quote.quote_number);
      else {
        const result = await printQuotePreview(paperRef.current, quote.quote_number, printWindow);
        setPrintUrl(result.opened ? "" : result.url);
        setPrintReady(true);
        void recordAuditActivity(restaurantId, "impresion", "cotizaciones", { quote_id: quote.id, quote_number: quote.quote_number, pages: result.pages });
      }
    } catch {
      printWindow?.close();
      setOutputError(userMessage(null));
    } finally { outputBusy.current = false; onOutputBusy?.(false); setOutput(null); }
  }
  const t = calculateQuoteWithAdjustments(
    quote.items,
    quote.discount_pct,
    quote.tip_pct,
    quote.deposit,
    quote.adjustments || [],
  );
  const quoteMoney = (value: number) => formatAppMoney(value);
  const accent = settings.quote_accent || "#ea580c";
  const textColor = settings.quote_text_color || settings.quote_color || "#18181b";
  const headerColor = settings.quote_header_color || settings.quote_color || "#18181b";
  const middleColor = settings.quote_middle_color || textColor;
  const middleTextColor = contrastingTextColor(middleColor);
  const headerTextColor = contrastingTextColor(headerColor);
  return (
    <div className="overlay">
      <section
        ref={paperRef}
        id="quote-preview-paper"
        className={`paper quoteStyle-${settings.quote_style || "moderna"}`}
        style={
          {
            fontFamily: settings.quote_font || "Georgia",
            color: textColor,
            borderTop: `6px solid ${accent}`,
            "--quote-main": textColor,
            "--quote-accent": accent,
            "--quote-header": headerColor,
            "--quote-header-text": headerTextColor,
            "--quote-soft": hexToRgba(accent, 0.075),
            "--quote-middle": middleColor,
            "--quote-middle-text": middleTextColor,
          } as React.CSSProperties
        }
      >
        <header>
          <div className="quoteHeaderIdentity">
            {settings.logo_data_url && (
              <TransparentLogo
                className="quoteLogo"
                src={settings.logo_data_url}
                alt={`Logo de ${restaurant}`}
              />
            )}
            <div>
              <small>{restaurant}</small>
              <h2>COTIZACIÓN</h2>
              <p>Propuesta para evento</p>
              <div className="quoteBusinessDetails">
                {settings.business_address && (
                  <span>{settings.business_address}</span>
                )}
                {settings.business_country && (
                  <span>{settings.business_country}</span>
                )}
                {settings.business_email && (
                  <span>{settings.business_email}</span>
                )}
                {settings.business_phone && (
                  <span>{settings.business_phone}</span>
                )}
              </div>
            </div>
          </div>
          <strong>#{quote.quote_number}</strong>
        </header>
        <div className="quoteInfo">
          {settings.quote_show_client_name !== false && (
            <span>
              <small>Cliente</small>
              {quote.client_name}
            </span>
          )}
          {settings.quote_show_client_email !== false && quote.client_email && (
            <span>
              <small>Email</small>
              {quote.client_email}
            </span>
          )}
          {settings.quote_show_event_date !== false && (
            <span>
              <small>Fecha</small>
              {displayDate(quote.event_date)}
            </span>
          )}
          {settings.quote_show_event_time !== false && (
            <span>
              <small>Hora</small>
              {quote.event_time?.slice(0, 5) || "—"}
            </span>
          )}
          {settings.quote_show_area !== false && (
            <span>
              <small>Área</small>
              {quote.area || "—"}
            </span>
          )}
          {settings.quote_show_guests !== false && (
            <span>
              <small>Invitados</small>
              {quote.guests}
            </span>
          )}
          {settings.quote_show_client_phone !== false && (
            <span>
              <small>Teléfono</small>
              {quote.client_phone || "—"}
            </span>
          )}
          {(settings.quote_custom_client_fields || [])
            .filter((x: QuoteCustomField) => x.active !== false)
            .map((custom: QuoteCustomField) => {
              const value = quote.custom_fields?.[custom.id];
              return value ? (
                <span key={custom.id}>
                  <small>{custom.label}</small>
                  {value}
                </span>
              ) : null;
            })}
        </div>
        <div className="previewTable">
          <div>
            <b>Producto / servicio</b>
            <b>Descripción</b>
            <b>Cant.</b>
            <b>Precio</b>
            <b>Total</b>
          </div>
          {quote.items.map((x, i) => (
            <div key={i}>
              <strong>{x.name}</strong>
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.description || "—"}</span>
              <span>{x.quantity}</span>
              <span>{quoteMoney(x.unit_price)}</span>
              <strong>{quoteMoney(x.quantity * x.unit_price)}</strong>
            </div>
          ))}
        </div>
        <div className="previewTotals">
          <QuotePreviewTotal
            label="Subtotal"
            value={t.subtotal}
            money={quoteMoney}
          />
          {settings.discounts !== false && t.discount > 0 && (
            <QuotePreviewTotal
              label={`Descuento ${t.discountPct}%`}
              value={-t.discount}
              money={quoteMoney}
            />
          )}
          {settings.tips !== false && (
            <QuotePreviewTotal
              label={`Propina ${t.tipPct}%`}
              value={t.tip}
              money={quoteMoney}
            />
          )}
          {t.adjustmentLines.map((line) => (
            <QuotePreviewTotal
              key={line.id}
              label={`${line.label}${line.mode === "percent" ? ` ${line.value}%` : ""}`}
              value={(line.kind === "discount" ? -1 : 1) * line.amount}
              money={quoteMoney}
            />
          ))}
          {
            <>
              <QuotePreviewTotal
                label="Anticipo"
                value={-t.deposit}
                money={quoteMoney}
              />
              {quote.payment_method && (
                <div className="paymentMethod">
                  <span>Método de pago</span>
                  <b>{quote.payment_method}</b>
                </div>
              )}
            </>
          }
          <QuotePreviewTotal
            big
            label="Saldo pendiente"
            value={t.balance}
            money={quoteMoney}
          />
        </div>
        {settings.quote_show_customer_note !== false && quote.customer_note && (
          <div className="note">
            <strong>Nota para el cliente</strong>
            <p>{quote.customer_note}</p>
          </div>
        )}
        <footer data-html2canvas-ignore="true">
          {outputError && <p role="alert">{outputError}</p>}
          {output && <span role="status">Preparando documento…</span>}
          {!output && printReady && <p className="quotePrintHelp" role="status">Use el botón de impresión del PDF si el diálogo no se abre automáticamente. Seleccione Ajustar al área imprimible.</p>}
          {!output && printUrl && <a className="secondary" href={printUrl} target="_blank" rel="noopener noreferrer">Abrir PDF para imprimir</a>}
          <button type="button" className="secondary" onClick={close} disabled={Boolean(output)}>
            Cerrar
          </button>
          {canEdit && <button type="button" className="secondary" onClick={edit} disabled={Boolean(output)}>
            <Pencil />
            Editar
          </button>}
          <button type="button" className="secondary" disabled={Boolean(output)} onClick={() => void exportDocument("print")}>
            <Printer /> Imprimir
          </button>
          <button
            type="button"
            className="primary"
            disabled={Boolean(output)}
            onClick={() => void exportDocument("pdf")}
          >
            <Download />
            PDF
          </button>
        </footer>
      </section>
    </div>
  );
}
function contrastingTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";
  const red = parseInt(normalized.slice(0, 2), 16),
    green = parseInt(normalized.slice(2, 4), 16),
    blue = parseInt(normalized.slice(4, 6), 16),
    luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 155 ? "#18181b" : "#ffffff";
}
function QuotePreviewTotal({
  label,
  value,
  money: formatMoney,
  big,
}: {
  label: string;
  value: number;
  money: (value: number) => string;
  big?: boolean;
}) {
  return (
    <div className={big ? "total big" : "total"}>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </div>
  );
}
function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(234,88,12,${alpha})`;
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
}
