"use client";
import {AppModuleBoundary,ModuleChunkLoading} from "./presentation-loading";
import {DashboardFrame,DashboardMenuButton} from "./dashboard-frame";
import {notifyFloorChange} from '@/lib/floor-sync';
import { SuccessToastProvider, useSuccessToast } from "@/components/success-toast";
import { BrandLogo } from "@/components/brand-logo";
import { QuickSetup } from "./quick-setup";
import { availableHelpTopics, quickTutorial, type HelpSection as GuideSection } from "@/lib/tutorial-tour";
import { HelpGuide } from "@/components/help-guide";
import { planFor } from "@/lib/plans";
import { useDataRefresh, useOnDataRefresh, useRestaurantSync } from "@/components/restaurant-sync";

import { useExcelExportAccess } from "@/components/excel-permission";
import { confirmApp } from "@/components/app-preferences";
import { AccountAccessError, LOAD_RETRY_MESSAGE, readDashboardData } from "@/lib/account-access";
import { userMessage } from "@/lib/user-message";
import { confirmDiscardChanges, useUnsavedChanges, useDraftBaseline } from "@/lib/unsaved-changes";

import { useCallback, useEffect, useId, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { normalizeArea } from "./area-picker";
import { QuoteAreaSelect } from "./quote-area-select";
import { QuoteItemsEditor, newQuoteItem } from "./quote-items-editor";
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
  Mail,
  MessageSquare,
} from "lucide-react";
import { supabase, signOutCurrentSession } from "@/lib/supabase";
import { calculateQuoteWithAdjustments, numberValue } from "@/lib/calculations";
import type {
  Client,
  Quote,
  QuoteAdjustment,
  QuoteCustomField,
  QuoteItem,
  Reservation,
} from "@/lib/types";
import {useFloorConflictConfirmation} from "./floor-conflict-confirmation";
import {saveWithFloorConfirmation} from "@/lib/floor-conflict-confirmation";
import { FloorFormFields } from "@/components/floor-form-fields";
import { floorError, missingFloorFunction, type FloorCreateSeed, type FloorFormState } from "@/lib/floor-plan";
import { ReservationsWorkspace as ReservationsEnhanced } from "@/components/reservations-workspace";
import { ReservationStatus } from "@/components/reservation-status";
import { TransparentLogo } from "@/components/transparent-logo";
import { Pagination } from "@/components/pagination";
import { printHtml, reserveQuotePrintWindow } from "@/lib/print";
import { permissionsFor, requirePermission, ACCESS_DENIED, type Permission } from "@/lib/permissions";
import { currentAppLanguage, formatAppMoney, useAppPreferences } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
import { recordAuditActivity } from "@/lib/audit-activity";
import { localDateISO, formatEventTime } from "@/lib/local-date";
import { readQuoteDeleteBlockers, linkedQuoteDeleteMessage, unlinkQuoteReservation, type QuoteDeleteBlocker, readQuoteDetail, readQuotePage, saveQuote as writeQuote, type QuoteSavePayload, type QuoteSummary } from "@/lib/quote-data";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { money, displayDate, Nav, Field, EventTimeInput, Actions, Total, HelpSection, Modal } from "@/components/dashboard-ui";
import { ClientSearchSelect, type ClientSuggestion } from "@/components/clients-panel";

const EventPendingHost = dynamic(() => import("./event-pending").then(module => module.EventPendingHost));
const ModuleLoading = ModuleChunkLoading;
const AiAssistant = dynamic(() => import("@/components/ai-assistant").then(module => module.AiAssistant));
const EnhancedReports = dynamic(() => import("@/components/reports-enhanced").then((module) => module.EnhancedReports), { loading: ModuleLoading });
const PersonalSettings = dynamic(() => import("@/components/password-settings").then(module => module.PersonalSettings), { loading: ModuleLoading });
const EnhancedSettings = dynamic(() => import("@/components/settings-module").then((module) => module.EnhancedSettings), { loading: ModuleLoading });
const MonthlySchedules = dynamic(() => import("@/components/schedules-module").then((module) => module.MonthlySchedules), { loading: ModuleLoading });
// Reservations is the landing tab, so it stays a normal (non-lazy) import.
// Clients/Quotes are alternate tabs and QuotePreview is a modal opened on
// demand — none of the three are needed for first paint, so each is its own
// chunk fetched only when the user actually goes there. Same pattern as the
// three modules above.
const Clients = dynamic(() => import("@/components/clients-panel").then((module) => module.Clients), { loading: ModuleLoading });
const Quotes = dynamic(() => import("@/components/quotes-panel").then((module) => module.Quotes), { loading: ModuleLoading });
const QuotePreview = dynamic(() => import("@/components/quote-preview").then((module) => module.QuotePreview), { loading: ModuleLoading });

type Tab =
  "reservations" | "clients" | "quotes" | "schedules" | "reports" | "settings";
type TrashIntent = { entity: "clientes" | "cotizaciones" | "reservaciones"; ids: string[]; label: string };
const emptyItem = newQuoteItem;
const emptyQuote = () => ({
  request_id: crypto.randomUUID(),
  client_id: "",
  client_name: "",
  client_phone: "",
  client_email: "",
  event_date: localDateISO(),
  event_time: "12:00",
  area: "",
  area_id: "",
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
  request_id: crypto.randomUUID(),
  client_id: "",
  client_name: "",
  phone: "",
  event_date: localDateISO(),
  event_time: "12:00",
  area: "",
  area_id: "",
  guests: 2,
  menu: "",
  deposit: 0,
  payment_method: "",
  notes: "",
  status: "pendiente",
});
// Toasts belong to the current restaurant session and disappear on sign-out.
export function Dashboard(props: Parameters<typeof DashboardContent>[0]) {
  return <SuccessToastProvider key={props.initialRestaurantId}><DashboardContent {...props} /></SuccessToastProvider>;
}

function DashboardContent({
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
  const showSuccess = useSuccessToast();
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
    [setupOpen, setSetupOpen] = useState(false),
    [setupChecked, setSetupChecked] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [helpSection, setHelpSection] = useState<GuideSection>("all");
  const [trashIntent, setTrashIntent] = useState<TrashIntent | null>(null);
  const [trashBusy, setTrashBusy] = useState(false), [trashError, setTrashError] = useState("");
  const trashLock = useRef(false);
  const [quoteDeleteBlockers, setQuoteDeleteBlockers] = useState<QuoteDeleteBlocker[]>([]);
  const [unlinkError, setUnlinkError] = useState("");
  const [focusedReservationId, setFocusedReservationId] = useState<string | null>(null);
  const [focusedReservationDate, setFocusedReservationDate] = useState<string | null>(null);
  const [reservationJustCreated, setReservationJustCreated] = useState(false);
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
  const floorConfirmation=useFloorConflictConfirmation(language==="en");
  const warningAnswer = useRef<((answer: boolean)=>void) | null>(null);
  const reservationSaving = useRef(false);
  const [reservationSaveBusy,setReservationSaveBusy]=useState(false);
  const [reservationAreaSummary,setReservationAreaSummary]=useState<FloorFormState['areaSummary']>(),[quoteAreaSummary,setQuoteAreaSummary]=useState<FloorFormState['areaSummary']>();
  const reservationFloor=useRef<FloorFormState>({ready:false,installed:false,value:null});
  const quoteFloor=useRef<FloorFormState>({ready:false,installed:false,value:null});
  const eventSaveMessage=(error:any)=>String(error?.message||error).includes("FLOOR_")?floorError(error,language==="en"):userMessage(error);
  const quoteSaving = useRef(false);
  const [quoteSaveBusy, setQuoteSaveBusy] = useState(false);
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
    if(!String(name||'').trim()&&!id)return 'clear' as const;
    const area=selectedArea(name,id);
    if (!area) {setError('Seleccione un área configurada. Si viene de una cotización, edite su área primero.');return false;}
    if (!date || !time) {setError('Indique fecha y hora para revisar las reservaciones cercanas.');return false;}
    const result=await supabase.rpc('v2_nearby_reservations',{
      p_restaurant:restaurantId,p_area:area.id,p_date:date,p_time:time,p_exclude:exclude || null,
    });
    if(result.error){setError('No se pudo comprobar las reservaciones cercanas. '+userMessage(result.error));return false;}
    if(!result.data?.length)return 'clear' as const;
    setNearby(result.data);
    return await new Promise<boolean>(resolve=>{warningAnswer.current=resolve;})?'confirmed' as const:false;
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
  useEffect(() => { if (((tab === "schedules" && !planFor(planCode).schedules) || (tab === "reports" && !planFor(planCode).reports))) setTab("reservations"); }, [planCode, tab]);
  const navigateTab = (next: Tab) => {
    if (next === tab || (next === "schedules" && !planFor(planCode).schedules) || (next === "reports" && !planFor(planCode).reports)) return;
    if (confirmDiscardChanges()) { setFocusedReservationId(null); setTab(next); }
  };

  // Keep browser navigation inside the dashboard; history stores only an opaque key.
  const navigation = useRef<{
    owner: string; index: number; restoring: boolean;
    entries: Map<number, { tab: Tab; preview: Quote | null }>;
  } | null>(null);
  const browserNavigation = useRef({ tab, preview, previewExporting });
  browserNavigation.current = { tab, preview, previewExporting };
  useEffect(() => {
    const state = { owner: crypto.randomUUID(), index: 0, restoring: false,
      entries: new Map([[0, { tab: browserNavigation.current.tab, preview: null as Quote | null }]]) };
    navigation.current = state;
    history.replaceState({ ...history.state, mrmaaDashboard: { owner: state.owner, index: 0 } }, "");
    const back = (event: PopStateEvent) => {
      const target = event.state?.mrmaaDashboard;
      if (target?.owner !== state.owner) return;
      const entry = state.entries.get(target.index);
      if (!entry || target.index === state.index) return;
      if (trashLock.current || browserNavigation.current.previewExporting || !confirmDiscardChanges()) {
        history.go(state.index - target.index);
        return;
      }
      state.index = target.index;
      state.restoring = browserNavigation.current.tab !== entry.tab || browserNavigation.current.preview !== entry.preview;
      setClientOpen(false); setQuoteOpen(false); setReservationOpen(false);
      setHelpOpen(false); setTipsOpen(false); setTutorialOpen(false);
      setQuoteDeleteBlockers([]); setTrashIntent(null); setUnlinkError(""); setTrashError("");
      setFocusedReservationId(null);
      setTab(entry.tab); setPreview(entry.preview);
    };
    window.addEventListener("popstate", back);
    return () => { window.removeEventListener("popstate", back); navigation.current = null; };
  }, []);
  useEffect(() => {
    const state = navigation.current;
    if (!state) return;
    if (state.restoring) { state.restoring = false; return; }
    const current = state.entries.get(state.index);
    if (current?.tab === tab && current.preview === preview) return;
    // Closing with the on-screen button updates this entry without reopening the preview on Back.
    const replace = current?.tab === tab && current.preview && !preview;
    if (!replace) {
      for (const index of state.entries.keys()) if (index > state.index) state.entries.delete(index);
      state.index += 1;
    }
    state.entries.set(state.index, { tab, preview });
    const next = { ...history.state, mrmaaDashboard: { owner: state.owner, index: state.index } };
    if (replace) history.replaceState(next, "");
    else history.pushState(next, "");
  }, [tab, preview]);

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
        setTab((current) => current === "reports" ? "reservations" : current);
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
        setError(userMessage(error));
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
  const { isAdmin, isSupport, canManageSettings, canRead, canOperate, canDeleteReservations, canManageSchedules, canManageFloorPlan, canManageQuoteProducts, canManageReservationAreas } = permissionsFor(memberRole, memberStatus);
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
      setError(error instanceof Error ? userMessage(error) : ACCESS_DENIED);
      const membership = await supabase.rpc("v2_effective_membership", { p_restaurant: restaurantId });
      if (!membership.error) {
        setMemberRole(membership.data?.role || "");
        setMemberStatus(membership.data?.status || "");
      }
      return false;
    }
  }
  const guideTopics = useMemo(() => availableHelpTopics(language, planCode, isAdmin), [language, planCode, isAdmin]);
  const tutorialSteps = useMemo(() => quickTutorial(language, planCode, memberRole, memberStatus), [language, planCode, memberRole, memberStatus]);
  function openGuide(section: GuideSection = "all") {
    setTutorialOpen(false); setHelpSection(section); setHelpOpen(true);
  }
  const currentTutorialStep = tutorialSteps[Math.min(tutorialStep, tutorialSteps.length - 1)];
  useEffect(() => { setTutorialStep(step => Math.min(step, tutorialSteps.length - 1)); }, [tutorialSteps.length]);
  const closeSetup = () => {
    setSetupOpen(false);
    try { localStorage.setItem(`mrmaa-setup-later:${restaurantId}:${session.user.id}`, "1"); } catch { /* Optional preference. */ }
  };
  useEffect(() => {
    if (busy || !memberRole || setupChecked || loadFailed) return;
    setSetupChecked(true);
    let dismissed = false;
    try { dismissed = localStorage.getItem(`mrmaa-setup-later:${restaurantId}:${session.user.id}`) === "1"; } catch { /* Optional preference. */ }
    if (isAdmin && !appSettings.google_onboarding?.direct_dashboard && !appSettings.quick_setup?.completed_at && !areas.length && !quoteProducts.length && !dismissed) setSetupOpen(true);
  }, [busy, memberRole, setupChecked, loadFailed, restaurantId, isAdmin, appSettings, areas.length, quoteProducts.length, session.user.id]);
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
  function chooseClient(c: ClientSuggestion | null, target: "quote" | "reservation") {
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
    if (duplicateResult.error) return setError(userMessage(duplicateResult.error));
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
    if (res.error) return setError(userMessage(res.error));
    setClientOpen(false);
    setClientEdit(null);
    showSuccess(language === "en" ? "Customer saved." : "Cliente guardado.");
    setDataVersion((value) => value + 1);
  }
  async function quotesCanBeDeleted(ids: string[]) {
    const blockers = await readQuoteDeleteBlockers(supabase, restaurantId, ids);
    if (!blockers.length) return true;
    setUnlinkError(""); setQuoteDeleteBlockers(blockers);
    return false;
  }
  async function checkLinkedQuotes(ids: string[]) {
    if (trashLock.current) return;
    trashLock.current = true; setTrashBusy(true);
    try { if (await authorize("canDeleteQuotes")) await quotesCanBeDeleted(ids); }
    catch (error) { setError(userMessage(error)); }
    finally { trashLock.current = false; setTrashBusy(false); }
  }
  async function prepareTrash(intent: TrashIntent) {
    if (trashLock.current || !intent.ids.length) return;
    trashLock.current = true; setTrashBusy(true); setTrashError("");
    try {
      if (intent.entity === "cotizaciones") {
        if (!(await authorize("canDeleteQuotes"))) return;
        if (!(await quotesCanBeDeleted(intent.ids))) return;
      }
      setTrashIntent(intent);
    } catch (error) { setError(userMessage(error)); }
    finally { trashLock.current = false; setTrashBusy(false); }
  }
  async function moveToTrash(entity: TrashIntent["entity"], id: string, label: string) {
    await prepareTrash({ entity, ids: [id], label });
  }
  async function moveManyToTrash(entity: TrashIntent["entity"], ids: string[]) {
    await prepareTrash({ entity, ids: [...new Set(ids)], label: language === "en" ? `${ids.length} selected records` : `${ids.length} registros seleccionados` });
  }
  async function unlinkForDeletion(link: QuoteDeleteBlocker) {
    if (trashLock.current) return;
    const prompt = language === "en"
      ? `Unlink the quote from the reservation for ${link.client_name} (${displayDate(link.event_date)})? Both records are kept. The quote returns to Pending; the reservation keeps its date, status, deposit and other data. Nothing will be deleted automatically.`
      : `¿Desvincular la cotización de la reservación de ${link.client_name} (${displayDate(link.event_date)})? Ambos registros se conservan. La cotización vuelve a Pendiente; la reservación conserva su fecha, estado, anticipo y demás datos. No se borrará nada automáticamente.`;
    if (!confirmApp(prompt)) return;
    trashLock.current = true; setTrashBusy(true); setUnlinkError("");
    try {
      if (!(await authorize("canDeleteQuotes"))) throw new Error(language === "en" ? "Your current access does not allow this action. Check your session and permissions." : "Su acceso actual no permite esta acción. Revise su sesión y permisos.");
      await unlinkQuoteReservation(supabase, restaurantId, link);
      notifyFloorChange(restaurantId);
      setQuoteDeleteBlockers(current => current.filter(row => row.id !== link.id));
      setDataVersion(value => value + 1);
    } catch (error) { setUnlinkError(userMessage(error)); }
    finally { trashLock.current = false; setTrashBusy(false); }
  }
  function viewLinkedReservation(link: QuoteDeleteBlocker) {
    if (trashLock.current || !confirmDiscardChanges()) return;
    setFocusedReservationId(link.id);
    setFocusedReservationDate(link.event_date);
    setReservationJustCreated(false);
    setQuoteDeleteBlockers([]); setUnlinkError("");
    setTab("reservations");
  }
  async function confirmTrash() {
    if (!trashIntent || trashLock.current) return;
    trashLock.current=true;setTrashBusy(true);setTrashError("");
    const intent=trashIntent;
    try {
      const permission=intent.entity === "reservaciones" ? "canDeleteReservations" : intent.entity === "cotizaciones" ? "canDeleteQuotes" : "isAdmin";
      if (!(await authorize(permission))) throw new Error(language === "en" ? "Your current access does not allow this action. Check your session and permissions." : "Su acceso actual no permite esta acción. Revise su sesión y permisos.");
      if (intent.entity === "cotizaciones" && !(await quotesCanBeDeleted(intent.ids))) { setTrashIntent(null); return; }
      const results=await Promise.allSettled(intent.ids.map(id=>supabase.rpc("v2_soft_delete",{entity:intent.entity,target_id:id})));
      const failed=results.flatMap((result,index)=>result.status === "rejected" || result.value.error ? [{id:intent.ids[index],error:result.status === "rejected" ? result.reason : result.value.error}] : []);
      if (failed.length < intent.ids.length) {
        setPreview(null);setDataVersion(value=>value+1);
        if(intent.entity==='reservaciones'||intent.entity==='cotizaciones')notifyFloorChange(restaurantId);
      }
      if (failed.length) {
        const failureMessage=userMessage(failed[0].error);
        const message=failureMessage.startsWith("Primero elimine la reserva vinculada") ? linkedQuoteDeleteMessage(language) : failureMessage;
        setTrashIntent({...intent,ids:failed.map(item=>item.id),label:language === "en" ? `${failed.length} remaining record(s)` : `${failed.length} registro(s) pendiente(s)`});
        setTrashError(`${language === "en" ? "Could not move every record to trash. " : "No se pudieron enviar todos los registros a la papelera. "}${message}`);
        return;
      }
      setError("");setTrashIntent(null);
    } catch(error) {setTrashError(userMessage(error));}
    finally {trashLock.current=false;setTrashBusy(false);}
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
    if (quoteSaving.current) return;
    quoteSaving.current = true;
    setQuoteSaveBusy(true);
    try {
    if (!(await authorize("canOperate"))) return;
    setError("");
    if (!quoteFloor.current.ready) return setError(language==="en"?"Wait for tables to load or refresh the table section.":"Espere a que carguen las mesas o actualice esa sección.");
    const quoteArea = selectedArea(quoteForm.area, quoteForm.area_id);
    if (!quoteArea && (quoteForm.area?.trim() || quoteForm.area_id))
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
    let clientId: string;
    try {
      clientId = await ensureClient({
        name: quoteForm.client_name,
        phone: quoteForm.client_phone,
        email: quoteForm.client_email,
        client_id: quoteForm.client_id,
      });
    } catch (err: any) {
      return setError(userMessage(err, "No se pudo crear el cliente."));
    }
    const payload: QuoteSavePayload = {
      client_id: clientId,
      client_name: quoteForm.client_name.trim(),
      client_phone: quoteForm.client_phone.trim(),
      client_email: quoteForm.client_email.trim(),
      event_date: quoteForm.event_date,
      event_time: quoteForm.event_time || null,
      area: quoteArea?.name || "",
      area_id: quoteArea?.id || null,
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
    };
    // Number allocation + quote row + items are one round trip via v2_save_quote
    // (see lib/quote-data.ts) instead of a client-side read/retry loop.
    try {
      const saved=await saveWithFloorConfirmation(async (confirmed,extraSeats)=>{try{return {data:await writeQuote(supabase, restaurantId, quoteEdit?.id || null, payload, valid, quoteEdit ? null : quoteForm.request_id, quoteForm.source_reservation_id, quoteFloor.current.installed ? quoteFloor.current.value?{...quoteFloor.current.value,allow_conflict:confirmed,allow_extra_seats:extraSeats}:null : undefined),error:null}}catch(error){return {data:null,error}}},floorConfirmation.confirm);
      if(!saved)return;if(saved.error)throw saved.error;
    } catch (err: any) {
      console.error("MRMAA quote save failed", err);
      return setError(eventSaveMessage(err));
    }
    notifyFloorChange(restaurantId);
    quoteDraft.markSaved();
    setQuoteOpen(false);
    setQuoteEdit(null);
    showSuccess(language === "en" ? "Quote saved." : "Cotización guardada.");
    setDataVersion((value) => value + 1);
    } finally {
      quoteSaving.current = false;
      setQuoteSaveBusy(false);
    }
  }
  async function saveReservation(e: React.FormEvent) {
    e.preventDefault();
    if(reservationSaving.current)return;
    reservationSaving.current=true;setReservationSaveBusy(true);
    try {
    if (!(await authorize("canOperate"))) return;
    setError("");
    if (!reservationFloor.current.ready) return setError(language==="en"?"Wait for tables to load or refresh the table section.":"Espere a que carguen las mesas o actualice esa sección.");
    const nearbyDecision=await checkNearby(reservationForm.area,reservationForm.area_id,reservationForm.event_date,reservationForm.event_time,reservationEdit?.id);if(!nearbyDecision)return;
    let clientId: string;
    try {
      clientId = await ensureClient({
        name: reservationForm.client_name,
        phone: reservationForm.phone,
        client_id: reservationForm.client_id,
      });
    } catch (err: any) {
      return setError(userMessage(err, "No se pudo crear el cliente."));
    }
    const payload = {
      restaurant_id: restaurantId,
      client_id: clientId,
      client_name: reservationForm.client_name.trim(),
      phone: reservationForm.phone.trim(),
      event_date: reservationForm.event_date,
      event_time: reservationForm.event_time || null,
      area: (reservationForm.area || "").trim(),
      area_id: selectedArea(reservationForm.area,reservationForm.area_id)?.id || null,
      guests: Number(reservationForm.guests) || 0,
      menu: reservationForm.menu.trim(),
      ...(appSettings.reservation_allow_deposits === false && reservationEdit ? {} : {
        deposit: numberValue(reservationForm.deposit),
        payment_method: reservationForm.payment_method || "",
      }),
      notes: reservationForm.notes.trim(),
      status: reservationForm.status,
      subtotal: 0,
      discount_pct: 0,
      tip_pct: 0,
      total: 0,
      balance: 0,
    };
    const res = reservationFloor.current.installed
      ? await saveWithFloorConfirmation((confirmed,extraSeats)=>supabase.rpc("v2_floor_save_reservation",{p_restaurant:restaurantId,p_id:reservationEdit?.id||reservationForm.request_id,p_new:!reservationEdit,p_payload:payload,p_floor:reservationFloor.current.value?{...reservationFloor.current.value,allow_conflict:confirmed,allow_extra_seats:extraSeats}:null}),floorConfirmation.confirm,nearbyDecision==='confirmed')
      : reservationEdit
      ? await supabase
          .from("v2_reservations")
          .update(payload)
          .eq("id", reservationEdit.id)
      : await supabase.from("v2_reservations").insert(payload);
    if(!res)return;
    if (res.error) return setError(eventSaveMessage(res.error));
    notifyFloorChange(restaurantId);
    reservationDraft.markSaved();
    setReservationOpen(false);
    setReservationEdit(null);
    showSuccess(language === "en" ? "Reservation saved." : "Reservación guardada.");
    setDataVersion((value) => value + 1);
    } finally {reservationSaving.current=false;setReservationSaveBusy(false);}
  }
  async function convertQuote(q: Quote) {
    if(reservationSaving.current)return;
    reservationSaving.current=true;
    try {
    if (!(await authorize("canOperate"))) return;
    const linked = await supabase.from("v2_reservations").select("id")
      .eq("restaurant_id", restaurantId).eq("quote_id", q.id).is("deleted_at", null).limit(1);
    if (linked.error) return setError(userMessage(linked.error));
    if (linked.data?.length) {
      setDataVersion(value => value + 1);
      return setError("Esta cotización ya tiene una reservación vinculada.");
    }
    const nearbyDecision=await checkNearby(q.area,(q as any).area_id,q.event_date,q.event_time || '');if(!nearbyDecision)return;
    const converted=await saveWithFloorConfirmation<any>((confirmed,extraSeats)=>supabase.rpc("v2_floor_convert_quote",{p_restaurant:restaurantId,p_quote:q.id,p_expected:{event_date:q.event_date,event_time:q.event_time||null,guests:q.guests,allow_conflict:confirmed,allow_extra_seats:extraSeats}}),floorConfirmation.confirm,nearbyDecision==='confirmed');
    if(!converted)return;
    if (!converted.error) {
      notifyFloorChange(restaurantId);
      setPreview(null);setFocusedReservationId(converted.data.id);setFocusedReservationDate(converted.data.event_date);setReservationJustCreated(true);setError("");setDataVersion(v=>v+1);setTab("reservations");return;
    }
    if (!missingFloorFunction(converted.error,"v2_floor_convert_quote")) return setError(eventSaveMessage(converted.error));
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
        return setError(userMessage(err, "No se pudo crear el cliente."));
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
      area_id: selectedArea(q.area,(q as any).area_id)?.id || null,
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
          : userMessage(res.error),
      );
    setPreview(null);
    setFocusedReservationId(res.data.id);
    setFocusedReservationDate(res.data.event_date);
    setReservationJustCreated(true);
    setError("");
    setDataVersion((value) => value + 1);
    setTab("reservations");
    } finally {reservationSaving.current=false;}
  }
  function createReservationFromFloor(seed:FloorCreateSeed) {
    if(!canOperate||!confirmDiscardChanges())return;
    const match=selectedArea(seed.areaName,seed.areaId);
    setReservationEdit(null);setError("");setReservationForm({...emptyReservation(),event_date:seed.date,event_time:seed.time,area:match?.name||seed.areaName,area_id:match?.id||seed.areaId||"",floor_seed:structuredClone(seed.selection)});setReservationOpen(true);
  }
  async function editReservationFromFloor(id:string) {
    if(!canOperate||!confirmDiscardChanges())return;
    const result=await supabase.from("v2_reservations").select("*").eq("restaurant_id",restaurantId).eq("id",id).is("deleted_at",null).single();
    if(result.error)return setError(userMessage(result.error));editReservation(result.data);
  }
  async function quoteFromFloor(id:string) {
    if(!canOperate||!confirmDiscardChanges())return;
    const result=await supabase.from("v2_reservations").select("*").eq("restaurant_id",restaurantId).eq("id",id).is("deleted_at",null).single();
    if(result.error)return setError(userMessage(result.error));if(result.data.quote_id)await openQuoteById(result.data.quote_id);else createQuoteForReservation(result.data);
  }
  function createQuoteForReservation(r: Reservation) {
    if (!canOperate || r.quote_id || r.status === "cancelada") return;
    if (!confirmDiscardChanges()) return;
    setError("");
    setQuoteEdit(null);
    setQuoteForm({ ...newQuote(), source_reservation_id: r.id,
      client_id: r.client_id || "", client_name: r.client_name, client_phone: r.phone || "",
      event_date: r.event_date, event_time: r.event_time || "", area: r.area || "", area_id: r.area_id || "",
      guests: r.guests, deposit: r.deposit || 0, payment_method: r.payment_method || "",
      internal_notes: r.notes || "", items: [{ ...emptyItem(), name: r.menu || "" }],
    });
    setQuoteOpen(true);
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
      items: q.items.map((x) => ({ ...x, id: x.id || crypto.randomUUID() })),
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
      {restaurantId && <EventPendingHost key={restaurantId} restaurantId={restaurantId} canRead={canRead} canEdit={canOperate} en={language==="en"}/>}
      <DashboardFrame onRefresh={()=>load(false)} activeTab={tab} onNavigate={navigateTab} en={language==="en"} preferenceKey={`unomesa:${restaurantId}:${session.user.id}:sidebar`} sidebar={<>
          <div className="brand unomesaBrand">
            <BrandLogo inverse />
            <div className="brandRestaurant">
              {appSettings.logo_data_url && <TransparentLogo className="brandBusinessLogo" src={appSettings.logo_data_url} alt={language === "en" ? `${restaurantName} logo` : `Logo de ${restaurantName}`} />}
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
            {planFor(planCode).schedules && (            <Nav
              active={tab === "schedules"}
              onClick={() => navigateTab("schedules")}
              icon={<Clock3 />}
            >
              Horarios
            </Nav>)}
            {isAdmin && planFor(planCode).reports && (
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
            {canRead && (
              <Nav
                active={tab === "settings"}
                onClick={() => navigateTab("settings")}
                icon={<Settings />}
              >
                Configuración
              </Nav>
            )}
          </nav>
          <details className="sidebarHelp">
            <summary><HelpCircle/><span>{language === "en" ? "Help" : "Ayuda"}</span></summary>
            {isAdmin && <button className="tutorialLauncher" onClick={() => { if (confirmDiscardChanges()) setSetupOpen(true); }}><ArrowRight/><span>{language === "en" ? "Quick setup" : "Inicio rápido"}</span></button>}
          {canRead && !isSupport && restaurantId && <AiAssistant page={tab} key={`${restaurantId}:${session.user.id}`} restaurantId={restaurantId} onTutorial={startTutorial} />}
          <button className="tutorialLauncher helpLauncher" onClick={() => openGuide()}>
            <BookOpen />
            <span>Instructivo</span>
          </button>
          <button className="tutorialLauncher" onClick={startTutorial}>
            <HelpCircle />
            <span>Tutorial</span>
          </button>
          <button className="tutorialLauncher" onClick={()=>setTipsOpen(true)}><BookOpen /><span>Consejos para tu restaurante</span></button>
          <a
            className="tutorialLauncher"
            href={`mailto:support@unomesa.com?subject=${encodeURIComponent(`${language === "en" ? "UnoMesa support request" : "Solicitud de soporte UnoMesa"} - ${restaurantName}`)}`}
          >
            <Mail />
            <span>Soporte</span>
          </a>
          <a
            className="tutorialLauncher"
            href={`mailto:suggestions@unomesa.com?subject=${encodeURIComponent(`${language === "en" ? "Suggestion for UnoMesa" : "Sugerencia para UnoMesa"} - ${restaurantName}`)}`}
          >
            <MessageSquare />
            <span>Sugerencias</span>
          </a>
          </details>
          <button className="logout" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => { if (confirmDiscardChanges()) signOutCurrentSession(); }}>
            <LogOut />
            <span>Cerrar sesión</span>
          </button>
        </>}>
        {setupOpen && isAdmin && <QuickSetup restaurantId={restaurantId} schedules={planFor(planCode).schedules} completed={Boolean(appSettings.quick_setup?.completed_at)} format={appSettings.time_format} close={closeSetup} onSaved={() => load(false)} onStart={target => {
          closeSetup(); setTab(target);
          const product = quoteProducts.find(item => item.id === appSettings.quick_setup?.product_id);
          if (target === "quotes") {
            const draft = newQuote();
            if (product) draft.items = [{ ...newQuoteItem(), name: product.name, description: product.description || "", unit_price: numberValue(product.price) }];
            setQuoteEdit(null); setQuoteForm(draft); setQuoteOpen(true);
          }
          if (target === "reservations") { setReservationEdit(null); setReservationForm(emptyReservation()); setReservationOpen(true); }
        }}/>}
        <main className="workspace">
          <DashboardMenuButton/>
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
                aria-label={language==="en"?`New ${tab==='clients'?'customer':tab==='quotes'?'quote':'reservation'}`:`${tab==='clients'?'Nuevo cliente':tab==='quotes'?'Nueva cotización':'Nueva reservación'}`}
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
          {!busy && isAdmin && appSettings.google_onboarding?.direct_dashboard &&
            (appSettings.google_onboarding?.profile_pending || !appSettings.quick_setup?.completed_at) && <section className="googleOnboarding moduleCard" translate="no">
            <div><h2>{language === 'en' ? 'Welcome to your restaurant' : 'Bienvenido a su restaurante'}</h2>
              <p>{language === 'en' ? 'You can explore now. Set up your areas, first employee and menu item with Quick setup.' : 'Ya puede explorar. Prepare sus áreas, primer empleado y producto del menú con Inicio rápido.'}</p>
              {appSettings.google_onboarding?.profile_pending && <small>{language === 'en' ? 'Add your restaurant name and contact details in Settings.' : 'Agregue el nombre y los datos de contacto de su restaurante en Configuración.'}</small>}</div>
            <div className="quickSetupActions">
              {!appSettings.quick_setup?.completed_at && <button type="button" className="primary" onClick={() => { if (confirmDiscardChanges()) setSetupOpen(true); }}>{language === 'en' ? 'Quick setup' : 'Inicio rápido'}</button>}
              {appSettings.google_onboarding?.profile_pending && <button type="button" className="secondary" onClick={() => navigateTab('settings')}>{language === 'en' ? 'Restaurant details' : 'Datos del restaurante'}</button>}
            </div>
          </section>}
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
          <AppModuleBoundary key={`${restaurantId}:${tab}`} pending={busy} en={language==='en'}>
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
              timeFormat={appSettings.time_format}
              canEdit={canOperate}
              canDelete={permissionsFor(memberRole, memberStatus).canDeleteQuotes}
              restaurantId={restaurantId}
              refreshToken={dataVersion}
              edit={editQuote}
              preview={setPreview}
              convert={convertQuote}
              onLinked={() => setDataVersion(value => value + 1)}
              checkLinked={(ids) => void checkLinkedQuotes(ids)}
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
            eventAreas={areas}
            onAreaCreated={area=>setAreas(current=>current.some(a=>a.id===area.id)?current:[...current,area])}
              onCreateFromFloor={createReservationFromFloor}
              onEditFromFloor={editReservationFromFloor}
              onQuoteFromFloor={quoteFromFloor}
              onDeleteFromFloor={reservation=>moveToTrash('reservaciones',reservation.id,`la reservación de ${reservation.client_name}`)}
              canManageLayout={canManageFloorPlan}
              focusedReservationId={focusedReservationId}
              focusedReservationDate={focusedReservationDate}
              newlyCreated={reservationJustCreated}
              clearFocusedReservation={() => setFocusedReservationId(null)}
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
              createQuote={createQuoteForReservation}
            />
          ) : tab === "schedules" && planFor(planCode).schedules ? (
            <MonthlySchedules restaurantId={restaurantId} canEdit={canManageSchedules} preferences={appSettings} />
          ) : tab === "reports" && isAdmin && planFor(planCode).reports ? (
            <EnhancedReports
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              timeFormat={appSettings.time_format}
            />
          ) : tab === "settings" && canRead ? (
            (canManageQuoteProducts || isSupport) ? <EnhancedSettings
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              onNameChange={setRestaurantName}
              onSettingsChange={setAppSettings}
              onAreasChange={setAreas}
              onProductsChange={setQuoteProducts}
              catalogsOnly={!canManageSettings}
              supportAccess={isSupport ? (canManageSettings ? "edit" : "view") : undefined}
              planCode={planCode}
            /> : <PersonalSettings />
          ) : (
            <ReservationsEnhanced
            eventAreas={areas}
            onAreaCreated={area=>setAreas(current=>current.some(a=>a.id===area.id)?current:[...current,area])}
              onCreateFromFloor={createReservationFromFloor}
              onEditFromFloor={editReservationFromFloor}
              onQuoteFromFloor={quoteFromFloor}
              onDeleteFromFloor={reservation=>moveToTrash('reservaciones',reservation.id,`la reservación de ${reservation.client_name}`)}
              canManageLayout={canManageFloorPlan}
              canEdit={canOperate}
              canDelete={canDeleteReservations}
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              refreshToken={dataVersion}
              reload={async () => setDataVersion((value) => value + 1)}
              edit={editReservation}
              removeMany={(ids) => moveManyToTrash("reservaciones", ids)}
              remove={(reservation) => moveToTrash("reservaciones", reservation.id, `la reservación de ${reservation.client_name}`)}
              openQuote={openQuoteById}
              createQuote={createQuoteForReservation}
            />
          )}
          </AppModuleBoundary>
        </main>
      </DashboardFrame>
      {quoteDeleteBlockers.length > 0 && <Modal title={language === "en" ? "Linked quote" : "Cotización vinculada"} close={() => { if (!trashLock.current) setQuoteDeleteBlockers([]); }}>
        <div className="formStack" translate="no">
          <p role="alert">{linkedQuoteDeleteMessage(language)}</p>
          <p>{language === "en" ? "You can unlink without deleting either record. Canceling a reservation does not remove its link." : "Puede desvincular sin borrar ninguno de los dos registros. Cancelar una reservación no elimina su vínculo."}</p>
          <div className="compactList quoteDeleteLinks">{quoteDeleteBlockers.map(link => <article key={link.id}>
            <div><b>{link.client_name || "—"}</b><small>{displayDate(link.event_date)}</small></div>
            <div className="quoteDeleteLinkActions">
              {quoteDeleteBlockers.length > 1 && <button type="button" className="primary" disabled={trashBusy} onClick={() => viewLinkedReservation(link)}>{language === "en" ? "View reservation" : "Ver reservación"}</button>}
              <button type="button" className="secondary" disabled={trashBusy} onClick={() => void unlinkForDeletion(link)}>{language === "en" ? "Unlink quote" : "Desvincular cotización"}</button>
            </div>
          </article>)}</div>
          {unlinkError && <p className="error" role="alert">{t(unlinkError)}</p>}
          <div className="rowActions">
            <button type="button" className="secondary" disabled={trashBusy} onClick={() => setQuoteDeleteBlockers([])}>{language === "en" ? "Close" : "Cerrar"}</button>
            {quoteDeleteBlockers.length === 1 && <button type="button" className="primary" disabled={trashBusy} onClick={() => viewLinkedReservation(quoteDeleteBlockers[0])}>{language === "en" ? "Go to reservations" : "Ir a reservaciones"}</button>}
          </div>
        </div>
      </Modal>}
      {trashIntent && <Modal title={language === "en" ? "Move to trash" : "Enviar a la papelera"} close={()=>{if(!trashLock.current){setTrashIntent(null);setTrashError("");}}}>
        <div translate="no" className="formStack">
          <p>{language === "en" ? `Move ${trashIntent.ids.length} record(s) to trash?` : `¿Enviar ${trashIntent.label} a la papelera?`}</p>
          <p>{language === "en" ? "The administrator can restore them within 365 days. This is not permanent deletion." : "El Administrador podrá restaurarlos durante 365 días. No es una eliminación definitiva."}</p>
          {trashIntent.entity === "reservaciones" && <p>{language === "en" ? "If a reservation is linked to a quote, the quote returns to Pending." : "Si una reservación está vinculada a una cotización, esa cotización vuelve a Pendiente."}</p>}
          {trashError && <p className="error" role="alert">{t(trashError)}</p>}
          <div className="rowActions">
            <button type="button" className="secondary" disabled={trashBusy} onClick={()=>{setTrashIntent(null);setTrashError("");}}>{language === "en" ? "Cancel" : "Cancelar"}</button>
            <button type="button" className="dangerButton" disabled={trashBusy} onClick={()=>void confirmTrash()}>{trashBusy ? (language === "en" ? "Processing…" : "Procesando…") : (language === "en" ? "Confirm deletion" : "Confirmar eliminación")}</button>
          </div>
        </div>
      </Modal>}
      {helpOpen && <HelpGuide topics={guideTopics} language={language} initialSection={helpSection}
        close={() => setHelpOpen(false)} navigate={target => {
          if (confirmDiscardChanges()) { setHelpOpen(false); setTab(target); }
        }} />}
      {tipsOpen && <Modal title="Consejos para tu restaurante" close={()=>setTipsOpen(false)}>
        <div className="moduleStack">{[
          ['Mesas y áreas','Numere sus mesas y configure nombres claros para cada área. Seleccione el área del listado al reservar.'],
          ['Reservaciones cercanas','Antes de guardar o convertir una cotización, UnoMesa avisa si hay otra reservación el mismo día y área hasta 3 horas antes o después. Revise horarios y personas antes de continuar. El aviso no garantiza disponibilidad ni considera la duración del evento.'],
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
        <aside translate="no" className="tutorialCard tutorialPro" role="dialog" aria-modal="false" aria-label={language === "en" ? "UnoMesa quick tutorial" : "Tutorial rápido de UnoMesa"}>
          <div className="tutorialProgress">
            <span>{language === "en" ? "Quick tour · Step" : "Guía rápida · Paso"} {Math.min(tutorialStep + 1, tutorialSteps.length)} / {tutorialSteps.length}</span>
            <button type="button" onClick={() => setTutorialOpen(false)}>{language === "en" ? "Close" : "Cerrar"}</button>
          </div>
          <progress value={tutorialStep + 1} max={tutorialSteps.length} aria-label={language === "en" ? "Tutorial progress" : "Progreso del tutorial"}/>
          <label className="tutorialIndex">{language === "en" ? "Jump to a step" : "Ir a un paso"}
            <select value={Math.min(tutorialStep, tutorialSteps.length - 1)} onChange={event => setTutorialStep(Number(event.target.value))}>{tutorialSteps.map((step,index) => <option key={index} value={index}>{index+1}. {step.title}</option>)}</select>
          </label>
          <h2>{currentTutorialStep.title}</h2>
          <p>{currentTutorialStep.text}</p>
          <ol className="tutorialChecklist">{currentTutorialStep.details.map(detail => <li key={detail}>{detail}</li>)}</ol>
          <button type="button" className="tutorialMore link" onClick={() => openGuide(currentTutorialStep.guideSection)}><BookOpen />{language === "en" ? "View instructions" : "Ver instrucciones"}</button>
          <div className="tutorialActions">
            <button type="button" className="secondary" disabled={tutorialStep === 0} onClick={() => setTutorialStep((step) => Math.max(0, step - 1))}><ChevronLeft /> {language === "en" ? "Previous" : "Anterior"}</button>
            {tutorialStep === tutorialSteps.length - 1 ? (
              <button type="button" className="primary" onClick={finishTutorial}>{language === "en" ? "Finish" : "Finalizar"}</button>
            ) : (
              <button type="button" className="primary" onClick={() => setTutorialStep((step) => Math.min(tutorialSteps.length - 1, step + 1))}>{language === "en" ? "Next" : "Siguiente"} <ChevronRight /></button>
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
          close={() => {if(!reservationSaving.current)discardDraft(() => setReservationOpen(false));}}
        >
          {remoteDraftNotice && <p className="moduleNotice" role="status">Hay cambios recientes en los datos. Su formulario se conserva; revise la versión actual antes de guardar.</p>}
          {reservationEdit?.quote_id && <p className="moduleNotice" translate="no">{language === 'en' ? 'Changes to customer, phone, date, time, area and guests also update the linked quote. Amounts and notes stay separate.' : 'Los cambios de cliente, teléfono, fecha, hora, área e invitados también actualizan la cotización vinculada. Importes y notas permanecen separados.'}</p>}
          {error && <p className="moduleNotice moduleError" role="alert" translate="no">{error}</p>}
          <form onSubmit={saveReservation} className="form" aria-busy={reservationSaveBusy}>
            <fieldset disabled={reservationSaveBusy} className="quoteSaveFields grid2">
            <ClientSearchSelect
              restaurantId={restaurantId}
              value={reservationForm.client_name}
              selectedId={reservationForm.client_id}
              onType={name => setReservationForm((form: any) => ({
                ...form, client_name: name, client_id: "",
                ...(form.client_id ? { phone: "" } : {}),
              }))}
              onSelect={client => chooseClient(client, "reservation")}
            />
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
              <EventTimeInput value={reservationForm.event_time} format={appSettings.time_format}
                onChange={event_time => setReservationForm({ ...reservationForm, event_time })} />
            </Field>
            <QuoteAreaSelect selectionSummary={reservationAreaSummary?.areaId===reservationForm.area_id?reservationAreaSummary?.label:undefined} areas={areas} value={reservationForm.area || ""} areaId={reservationForm.area_id}
              onChange={(area,area_id)=>setReservationForm((form: any)=>({...form,area,area_id}))}
              onClear={()=>setReservationForm((form:any)=>({...form,area:"",area_id:"",floor_clear_area:(form.floor_clear_area||0)+1}))} />
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
            <FloorFormFields canManageDefault={canManageFloorPlan} key={reservationEdit?.id||reservationForm.request_id} restaurantId={restaurantId} reservationId={reservationEdit?.id} eventAreas={areas} eventArea={reservationForm.area} eventAreaId={reservationForm.area_id} onAreaChange={area=>setReservationForm((form:any)=>({...form,area:area.name,area_id:area.id}))} clearAreaRequest={reservationForm.floor_clear_area||0} kind="reservation" date={reservationForm.event_date} time={reservationForm.event_time} guests={Number(reservationForm.guests)||0} initial={reservationForm.floor_seed} timeFormat={appSettings.time_format} onState={state=>{reservationFloor.current=state;setReservationAreaSummary(state.areaSummary)}}/>
            {appSettings.reservation_form_phone !== false && (<Field label="Teléfono">
              <input
                value={reservationForm.phone}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    phone: e.target.value,
                  })
                }
              />
            </Field>)}
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
            {appSettings.reservation_form_menu !== false && (<Field label="Menú">
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
            </Field>)}
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
            {appSettings.reservation_form_status !== false && (<Field label="Estado">
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
            </Field>)}
            {appSettings.reservation_form_notes !== false && (<Field label="Observaciones">
              <textarea
                value={reservationForm.notes}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    notes: e.target.value,
                  })
                }
              />
            </Field>)}

            <Actions />
            </fieldset>
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
          close={() => { if (!quoteSaving.current) discardDraft(() => setQuoteOpen(false)); }}
        >
          {remoteDraftNotice && <p className="moduleNotice" role="status">Hay cambios recientes en los datos. Su formulario se conserva; revise la versión actual antes de guardar.</p>}
          {!quoteProducts.length && <p className="moduleNotice" role="status">También puede guardar menús con descripción y precio en Configuración → Cotizaciones → Menús y productos para reutilizarlos.</p>}
          {quoteForm.source_reservation_id && <p className="moduleNotice" translate="no">{language === "en"
            ? "This quote will be linked to the existing reservation. Saving confirms that reservation without creating another. Review products and prices; its other details remain unchanged."
            : "Esta cotización se vinculará a la reserva existente. Al guardar se confirma esa reserva sin crear otra. Revise productos y precios; los demás datos de la reserva se conservan."}</p>}
          {quoteEdit?.status === 'convertida' && <p className="moduleNotice" translate="no">{language === 'en' ? 'Changes to customer, phone, date, time, area and guests also update the linked reservation. Amounts and notes stay separate.' : 'Los cambios de cliente, teléfono, fecha, hora, área e invitados también actualizan la reservación vinculada. Importes y notas permanecen separados.'}</p>}
          {error && <p className="moduleNotice moduleError" role="alert" translate="no">{error}</p>}
          <form onSubmit={saveQuote} className="quoteForm" aria-busy={quoteSaveBusy}>
            <fieldset disabled={quoteSaveBusy} className="quoteSaveFields">
            <div className="grid3">
              <ClientSearchSelect
                restaurantId={restaurantId}
                value={quoteForm.client_name}
                selectedId={quoteForm.client_id}
                onType={name => setQuoteForm((form: any) => ({
                  ...form, client_name: name, client_id: "",
                  ...(form.client_id ? { client_phone: "", client_email: "" } : {}),
                }))}
                onSelect={client => chooseClient(client, "quote")}
              />
              {appSettings.quote_form_phone !== false && (<Field label="Teléfono">
                <input
                  value={quoteForm.client_phone}
                  onChange={(e) => field("client_phone", e.target.value)}
                />
              </Field>)}
              <Field label="Fecha del evento">
                <input
                  type="date"
                  required
                  value={quoteForm.event_date}
                  onChange={(e) => field("event_date", e.target.value)}
                />
              </Field>
              <Field label="Hora">
                <EventTimeInput value={quoteForm.event_time} format={appSettings.time_format}
                  onChange={value => field("event_time", value)} />
              </Field>
              <QuoteAreaSelect selectionSummary={quoteAreaSummary?.areaId===quoteForm.area_id?quoteAreaSummary?.label:undefined} areas={areas} value={quoteForm.area || ""} areaId={quoteForm.area_id}
                onChange={(area,area_id)=>setQuoteForm((form: any)=>({...form,area,area_id}))}
                onClear={()=>setQuoteForm((form:any)=>({...form,area:"",area_id:"",floor_clear_area:(form.floor_clear_area||0)+1}))} />
              <Field label="Invitados">
                <input
                  type="number"
                  min="1"
                  value={quoteForm.guests}
                  onChange={(e) => field("guests", e.target.value)}
                />
              </Field>
              {appSettings.quote_form_email !== false && (<Field label="Email">
                <input
                  type="email"
                  value={quoteForm.client_email}
                  onChange={(e) => field("client_email", e.target.value)}
                />
              </Field>)}
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
            <FloorFormFields canManageDefault={canManageFloorPlan} key={quoteEdit?.id||quoteForm.request_id} restaurantId={restaurantId} quoteId={quoteEdit?.id} reservationId={quoteForm.source_reservation_id} eventAreas={areas} eventArea={quoteForm.area} eventAreaId={quoteForm.area_id} onAreaChange={area=>setQuoteForm((form:any)=>({...form,area:area.name,area_id:area.id}))} clearAreaRequest={quoteForm.floor_clear_area||0} kind="quote" date={quoteForm.event_date} time={quoteForm.event_time} guests={Number(quoteForm.guests)||0} timeFormat={appSettings.time_format} onState={state=>{quoteFloor.current=state;setQuoteAreaSummary(state.areaSummary)}}/>
            <QuoteItemsEditor items={quoteForm.items} products={quoteProducts}
              onChange={update => setQuoteForm((form: any) => ({ ...form, items: update(form.items) }))} />
            <div className="quoteBottom">
              <div>
                {appSettings.quote_form_customer_note !== false && (<Field label="Nota para el cliente">
                  <textarea
                    value={quoteForm.customer_note}
                    onChange={(e) => field("customer_note", e.target.value)}
                  />
                </Field>)}
                {appSettings.quote_form_internal_notes !== false && (<Field label="Observaciones internas">
                  <textarea
                    value={quoteForm.internal_notes}
                    onChange={(e) => field("internal_notes", e.target.value)}
                  />
                </Field>)}
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
                {appSettings.quote_show_deposit_form !== false && (
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
                )}
                <Total big label="Saldo pendiente" value={totals.balance} />
              </div>
            </div>
            <Actions busy={quoteSaveBusy} />
            </fieldset>
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
      {floorConfirmation.dialog}
      {nearby && <Modal title={language==='en'?'Nearby reservations':'Reservaciones cercanas'} close={()=>answerWarning(false)}>
        <p>{language==='en'?'There are reservations in the same area and day within 3 hours before or after. Continue?':'Hay reservaciones el mismo día y área hasta 3 horas antes o después. ¿Desea continuar?'}</p><p translate="no">{language==='en'?'Save anyway also allows overlapping table assignments for this save. Both reservations are kept.':'Guardar de todos modos también permite que las mesas coincidan en este guardado. Se conservan ambas reservas.'}</p>
        <ul>{nearby.slice(0,10).map(r=><li key={r.id}>{formatEventTime(r.event_time, appSettings.time_format)} · {r.guests} {language==='en'?'guests':'personas'}</li>)}</ul>
        {nearby.length>10 && <p>{language==='en'?'More matches exist.':'Hay más coincidencias.'}</p>}
        <div className="actions"><button type="button" className="secondary" autoFocus onClick={()=>answerWarning(false)}>{language==='en'?'Review':'Revisar'}</button>
          <button type="button" className="primary" onClick={()=>answerWarning(true)}>{language==='en'?'Save anyway':'Guardar de todos modos'}</button></div>
      </Modal>}
    </>
  );
}
