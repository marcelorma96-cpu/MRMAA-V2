"use client";
import {useFloorAreaLabels} from './use-floor-area-labels';
import {readEventAreaLabels} from '@/lib/floor-area-label';
import { ReservationQuoteLink } from "./reservation-quote-link";
import { useAppPreferences } from "./app-preferences";
import { exportBudget, EXPORT_ROW_LIMIT, PRINT_ROW_LIMIT } from "@/lib/export-limits";
import { useDataRefresh } from "@/components/restaurant-sync";

import { useExcelExportAccess } from "@/components/excel-permission";

import { userMessage } from "@/lib/user-message";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  MoreHorizontal,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Pencil,
  Printer,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { requirePermission, ACCESS_DENIED } from "@/lib/permissions";
import { printHtml, needsNativePdfViewer, reserveQuotePrintWindow, openQuotePrintDocument } from "@/lib/print";
import { Modal } from "./dashboard-ui";
import { reservationReportHtml, type ReservationReport, type ReservationReportMode } from "@/lib/reservation-report";
import type { Reservation } from "@/lib/types";
import { readListPage, useCursorPagination } from "@/lib/cursor-pagination";
import { Pagination } from "@/components/pagination";
import { appLocale, currentAppLanguage, formatAppMoney } from "@/components/app-preferences";
import { translate, translateRecord } from "@/lib/translations";
import { recordAuditActivity } from "@/lib/audit-activity";
import { findExactReservationArea } from "@/lib/reservation-area";
import { localDateISO, formatEventTime } from "@/lib/local-date";
import { useListSearch } from "@/lib/list-search";
import { useListQuery } from "@/lib/list-query";
import { ReservationStatus } from "@/components/reservation-status";
import { reservationGuestTotal } from "@/lib/reservation-totals";

const today = () => localDateISO();
const displayDate = (value?: string | null) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const money = (n: number) => formatAppMoney(n);

export function ReservationsEnhanced({
  canEdit = false,
  canDelete = false,
  restaurantId,
  restaurantName,
  refreshToken = 0,
  preferences = {},
  rows: initialRows = [],
  edit,
  openQuote,
  createQuote,
  reload,
  remove,
  removeMany,
  focusedReservationId = null,
  focusedReservationDate = null,
  newlyCreated = false,
  clearFocusedReservation,
}: {
  canEdit?: boolean;
  canDelete?: boolean;
  restaurantId: string;
  restaurantName: string;
  refreshToken?: number;
  preferences?: { time_format?: string; reservation_show_people?: boolean; reservation_show_deposits?: boolean; reservation_show_deposits_list?: boolean };
  rows?: Reservation[];
  edit: (r: Reservation) => void;
  openQuote: (quoteId: string) => void;
  createQuote: (reservation: Reservation) => void;
  reload: () => Promise<void>;
  remove: (r: Reservation) => void;
  removeMany?: (ids: string[]) => Promise<void>;
  focusedReservationId?: string | null;
  focusedReservationDate?: string | null;
  newlyCreated?: boolean;
  clearFocusedReservation?: () => void;
}) {
  const { language } = useAppPreferences();
  const [linkReservation, setLinkReservation] = useState<Reservation | null>(null);
  const remoteVersion = useDataRefresh(restaurantId, "v2_reservations,v2_reservation_areas,v2_restaurants,v2_quotes");
  const excelAccess = useExcelExportAccess(restaurantId);
  const [mode, setMode] = useState<"today" | "single" | "range" | "all">(
      focusedReservationId && focusedReservationDate ? "single" : "today",
    ),
    [date, setDate] = useState(focusedReservationId && focusedReservationDate || today()),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [printMode, setPrintMode] = useState<ReservationReportMode>("both"),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [rows, setRows] = useState<Reservation[]>(initialRows),
    [total, setTotal] = useState(initialRows.length),
    [summaryCount, setSummaryCount] = useState(0),
    [people, setPeople] = useState(0),
    [deposits, setDeposits] = useState(0),
    [loading, setLoading] = useState(false),
    [summaryLoading, setSummaryLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [summaryError, setSummaryError] = useState("");
  const settings = { reservation_show_people: true, reservation_show_deposits: true, reservation_show_deposits_list: true, ...preferences };
  const fileRef = useRef<HTMLInputElement>(null);
  const moreRef=useRef<HTMLDetailsElement>(null),outputLock=useRef(false);
  const [reportAction,setReportAction]=useState<'print'|'pdf'|null>(null),[reportBusy,setReportBusy]=useState(false),[reportError,setReportError]=useState(''),[pdfUrl,setPdfUrl]=useState('');
  const en=language==='en',say=(es:string,eng:string)=>en?eng:es;
  const areaLabels=useFloorAreaLabels(restaurantId,'reservation',rows,en,`${refreshToken}:${remoteVersion}`);
  const closeMore=()=>{if(moreRef.current)moreRef.current.open=false};
  useEffect(()=>{const close=(event:PointerEvent)=>{if(moreRef.current?.open&&!moreRef.current.contains(event.target as Node))closeMore()};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
  useEffect(()=>()=>{if(pdfUrl)URL.revokeObjectURL(pdfUrl)},[pdfUrl]);
  function chooseOutput(action:'print'|'pdf'){closeMore();setReportError('');setReportAction(action)}

  const focusedCardRef = useRef<HTMLElement>(null);
  const lastFocusedId = useRef<string | null>(null);
  const normalizedSearch = search.trim().replace(/[%(),]/g, " ");
  const querySearch = useListSearch(search, () => {});
  const pager = useCursorPagination(JSON.stringify([restaurantId, focusedReservationId, mode, mode === "today" ? today() : date, from, to, querySearch]));
  const { page, setPage } = pager;
  const applyFilters = (query: any, term = normalizedSearch) => {
    if (focusedReservationId) return query.eq("id", focusedReservationId);
    if (mode === "today") query = query.eq("event_date", today());
    else if (mode === "single") query = query.eq("event_date", date);
    else if (mode === "range") query = query.gte("event_date", from).lte("event_date", to);
    if (term)
      query = query.or(`client_name.ilike.%${term}%,phone.ilike.%${term}%,area.ilike.%${term}%,menu.ilike.%${term}%,notes.ilike.%${term}%,status.ilike.%${term}%`);
    return query;
  };
  useEffect(() => {
    setRows([]); setTotal(0); setSelected([]); setPage(1);
    lastFocusedId.current = null;
    if (focusedReservationId && focusedReservationDate) { setMode("single"); setDate(focusedReservationDate); setSearch(""); }
  }, [restaurantId, focusedReservationId, focusedReservationDate]);
  useEffect(() => {
    if (!focusedReservationId || lastFocusedId.current === focusedReservationId || !rows.some(row => row.id === focusedReservationId)) return;
    const frame = requestAnimationFrame(() => {
      if (!focusedCardRef.current) return;
      focusedCardRef.current.scrollIntoView({ block: "start" });
      focusedCardRef.current.focus({ preventScroll: true });
      lastFocusedId.current = focusedReservationId;
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedReservationId, rows]);
  useEffect(() => setPage(1), [mode, date, from, to]);
  useListQuery({
    queryKey: restaurantId ? JSON.stringify(focusedReservationId ? [restaurantId, "linked", focusedReservationId] : [restaurantId, mode, mode === "today" ? today() : date, from, to, querySearch, page]) : undefined,
    version: `${refreshToken}:${remoteVersion}`,
    read: signal => readListPage<Reservation>(supabase, restaurantId, "reservations", {
      id: focusedReservationId, mode, date: mode === "today" ? today() : date, from, to, search: querySearch,
    }, pager.after, signal),
    onData: result => { setRows(result.rows); setTotal(result.rows.length); pager.accept(result); setLoadError(""); },
    onError: error => { setLoadError(userMessage(error)); if (focusedReservationId) { setRows([]); setTotal(0); } },
    onLoading: setLoading,
  });
  // Totals cover the filter, not the current page. They load alongside the rows.
  const pageSummary = !!focusedReservationId || mode === "all";
  const showSummary = !pageSummary && (settings.reservation_show_people || settings.reservation_show_deposits);
  const visiblePeople = pageSummary ? reservationGuestTotal(rows) : people;
  const visibleDeposits = pageSummary ? rows.reduce((sum, row) => sum + Number(row.deposit || 0), 0) : deposits;
  useListQuery({
    queryKey: restaurantId && showSummary ? JSON.stringify([restaurantId, mode, date, from, to, querySearch]) : undefined,
    version: `${refreshToken}:${remoteVersion}`,
    read: async signal => {
      const result = await supabase.rpc("v2_reservation_summary", {
        p_restaurant_id: restaurantId, p_mode: mode,
        p_date: mode === "today" ? today() : date, p_from: from, p_to: to, p_search: querySearch,
      }).abortSignal(signal);
      if (result.error) throw result.error;
      return Array.isArray(result.data) ? result.data[0] : result.data;
    },
    onData: metrics => { setSummaryCount(Number(metrics?.reservations ?? 0)); setPeople(Number(metrics?.people ?? 0)); setDeposits(Number(metrics?.deposits ?? 0)); setSummaryError(""); },
    onError: error => setSummaryError(userMessage(error)),
    onLoading: setSummaryLoading,
  });
  useEffect(() => setSelected((ids) => ids.filter((id) => rows.some((row) => row.id === id))), [rows]);
  const visibleIds = rows.map((row) => row.id),
    allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  async function allMatchingReservations(maxRows = EXPORT_ROW_LIMIT) {
    const budget = exportBudget(maxRows);
    const output: Reservation[] = [];
    for (let first = 0; ; first += 1000) {
      const batch = await applyFilters(supabase.from("v2_reservations").select("*")
        .eq("restaurant_id", restaurantId).is("deleted_at", null))
        .order("event_date").order("event_time").order("id").range(first, first + 999);
      if (batch.error) throw batch.error;
      budget.add(batch.data || []);
      output.push(...((batch.data || []) as Reservation[]));
      if ((batch.data || []).length < 1000) return output;
    }
  }
  async function exportRows() {
    try {
      await excelAccess.ensureAllowed();
      const [XLSX, outputRows] = await Promise.all([import("xlsx"), allMatchingReservations()]);
      const language = currentAppLanguage();
      const data = outputRows.map((r) => translateRecord({
        Fecha: r.event_date,
        Hora: formatEventTime(r.event_time, settings.time_format, ""),
        Cliente: r.client_name,
        Telefono: r.phone,
        Area: r.area,
        Invitados: r.guests,
        Menu: r.menu,
        Anticipo: money(Number(r.deposit || 0)),
        MetodoPago: r.payment_method || "",
        Saldo: money(Number(r.balance || 0)),
        Estado: translate(r.status, language),
        Observaciones: r.notes,
      }, language));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data),
        translate("Reservaciones", language),
      );
      await excelAccess.ensureAllowed();
      XLSX.writeFile(wb, `${language === "en" ? "reservations" : "reservaciones"}-${today()}.xlsx`);
      await recordAuditActivity(restaurantId, "excel_exportado", "reservaciones", { label: "Listado de reservaciones", rows: outputRows.length, mode, date, from, to });
    } catch (error) { setNotice(userMessage(error)); }
  }
  const navigationDate = mode === "range" ? from : mode === "single" ? date : today();
  function showNextDay() {
    const base = navigationDate;
    const next = new Date(`${base}T12:00:00`);
    next.setDate(next.getDate() + 1);
    setDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
    setMode("single");
  }
  function showPreviousDay() {
    const base = navigationDate;
    const previous = new Date(`${base}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    setDate(`${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}-${String(previous.getDate()).padStart(2, "0")}`);
    setMode("single");
  }
  async function template() {
    try {
      await excelAccess.ensureAllowed();
      const XLSX = await import("xlsx");
      const language = currentAppLanguage();
      const data = [translateRecord({
          Fecha: "2026-12-15",
          Hora: formatEventTime("19:00", settings.time_format),
          Cliente: translate("Nombre del cliente", language),
          Telefono: "+502 5555 5555",
          Area: language === "en" ? "Dining room" : "Salón",
          Invitados: 12,
          Menu: language === "en" ? "Selected menu" : "Menú seleccionado",
          Anticipo: 500,
          MetodoPago: "transferencia",
          Estado: language === "en" ? "pending" : "pendiente",
          Observaciones: language === "en" ? "Special request" : "Solicitud especial",
        }, language),
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data),
        translate("Plantilla", language),
      );
      await excelAccess.ensureAllowed();
      XLSX.writeFile(wb, language === "en" ? "reservation-import-template.xlsx" : "plantilla-importacion-reservaciones.xlsx");
    } catch (error) { setNotice(userMessage(error)); }
  }
  async function importRows(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!canEdit) throw new Error(ACCESS_DENIED);
      await requirePermission(supabase, restaurantId, "canOperate");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("El archivo supera el límite de 5 MB.");
      if (!/\.(xlsx|xls|csv)$/i.test(file.name))
        throw new Error("Use únicamente archivos XLSX, XLS o CSV.");
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer()),
        sheet = book.Sheets[book.SheetNames[0]],
        data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
      if (!data.length) throw new Error("El archivo está vacío.");
      if (data.length > 5000)
        throw new Error("La importación admite un máximo de 5,000 filas por archivo.");
      const omitted: number[] = [];
      const reservationAreasResult = await supabase.from("v2_reservation_areas")
        .select("id,name").eq("restaurant_id", restaurantId).eq("active", true).order("name");
      if (reservationAreasResult.error) throw reservationAreasResult.error;
      const reservationAreas = reservationAreasResult.data || [];
      const payload = data
        .map((original, index) => {
          const x = Object.fromEntries(
              Object.entries(original).map(([key, value]) => [normalizeHeader(key), value]),
            ),
            rawDate = importCell(x, "fecha", "fechadelevento", "eventdate"),
            eventDate = excelDate(rawDate),
            clientName = String(importCell(x, "cliente", "nombre", "nombredecliente") || "").trim();
          if (!rawDate || !eventDate || !clientName) {
            omitted.push(index + 2);
            return null;
          }
          const importedArea = String(importCell(x, "area", "salon") || "").trim();
          const matchedArea = findExactReservationArea(reservationAreas, importedArea);
          return {
            restaurant_id: restaurantId,
            client_name: clientName,
            phone: String(importCell(x, "telefono", "tel", "phone") || "").trim(),
            event_date: eventDate,
            event_time: excelTime(importCell(x, "hora", "horadelevento", "eventtime")),
            area: matchedArea?.name || importedArea,
            guests: importOptionalNumber(importCell(x, "invitados", "personas", "noinvitados"), true),
            menu: String(importCell(x, "menu", "producto", "servicio") || "").trim(),
            deposit: importOptionalNumber(importCell(x, "anticipo", "deposito", "deposit")),
            payment_method: String(importCell(x, "metodopago", "metododepago", "paymentmethod") || "").trim().toLowerCase(),
            status: String(importCell(x, "estado", "status") || "").trim().toLowerCase(),
            notes: String(importCell(x, "observaciones", "notas", "notes") || "").trim(),
            subtotal: 0,
            discount_pct: 0,
            tip_pct: 0,
            total: 0,
            balance: 0,
            client_id: null as string | null,
          };
        })
        .filter(Boolean) as any[];
      if (!payload.length) throw new Error("No se encontraron filas válidas.");
      const warningResult = await supabase.rpc("v2_import_reservation_warnings", {
        p_restaurant_id: restaurantId,
        p_rows: payload,
      });
      if (warningResult.error) throw new Error("No se pudo comprobar si hay reservas cercanas. Intente nuevamente o contacte al administrador.");
      const warnings = Array.isArray(warningResult.data) ? warningResult.data : [];
      if (warnings.length) {
        const examples = warnings.slice(0, 5).map((warning: any) =>
          `${warning.client_name || "Reserva"}: ${displayDate(warning.event_date)} ${formatEventTime(warning.event_time, settings.time_format, "")} · ${warning.area || "Sin área"}`,
        ).join("\n");
        const count = `${warnings.length === 100 ? (currentAppLanguage() === "en" ? "at least " : "al menos ") : ""}${warnings.length}`;
        const question = currentAppLanguage() === "en"
          ? `Found ${count} possible conflicts in the same or a similar area, on the same day, within 3 hours before or after:\n\n${examples}${warnings.length > 5 ? "\n…" : ""}\n\nContinue importing?`
          : `Se encontraron ${count} posible(s) coincidencia(s) en áreas iguales o similares, el mismo día y hasta 3 horas antes o después:\n\n${examples}${warnings.length > 5 ? "\n…" : ""}\n\n¿Desea continuar con la importación?`;
        if (!window.confirm(question)) {
          setNotice("Importación cancelada para revisar posibles cruces de horario.");
          return;
        }
      }
      let created = 0, updated = 0, unchanged = 0;
      for (let start = 0; start < payload.length; start += 500) {
        const result = await supabase.rpc("v2_import_reservations", {
          p_restaurant_id: restaurantId,
          p_rows: payload.slice(start, start + 500),
        });
        if (result.error) throw result.error;
        const counts: any = Array.isArray(result.data) ? result.data[0] : result.data;
        created += Number(counts?.created || 0);
        updated += Number(counts?.updated || 0);
        unchanged += Number(counts?.unchanged || 0);
      }
      setNotice(`Importación terminada: ${created} nuevas, ${updated} actualizadas, ${unchanged} sin cambios y ${omitted.length} omitidas.`);
      await reload();
    } catch (err: any) {
      setNotice(userMessage(err, "No se pudo importar el archivo."));
    } finally {
      e.target.value = "";
    }
  }
  function reportContext(){
    const period=focusedReservationId?say('Reservación seleccionada','Selected reservation'):mode==='all'?say('Todas las fechas','All dates'):mode==='range'?`${displayDate(from)} - ${displayDate(to)}`:displayDate(mode==='today'?today():date);
    return period+(normalizedSearch?` · ${say('Búsqueda','Search')}: ${normalizedSearch}`:'');
  }
  function buildReport(outputRows:Reservation[],labels:Record<string,string>={}):ReservationReport {
    const t=(text:string)=>translate(text,language);
    return {restaurant:restaurantName,title:say('Reporte de reservaciones','Reservation report'),context:reportContext(),generated:`${say('Generado','Generated')}: ${new Date().toLocaleDateString(appLocale())}`,language,mode:printMode,
      metrics:[{label:t('Reservaciones'),value:String(outputRows.length)},...(settings.reservation_show_people?[{label:say('Personas','Guests'),value:String(reservationGuestTotal(outputRows))}]:[]),...(settings.reservation_show_deposits?[{label:t('Anticipos'),value:money(outputRows.reduce((sum,r)=>sum+Number(r.deposit||0),0))}]:[])],
      repeatColumns:4,
      columns:[['Fecha',22],['Hora',18],['Cliente',35],[say('Teléfono','Phone'),31],['Área',28],[say('Inv.','Guests'),13],['Menú',26],...(settings.reservation_show_deposits_list?[['Anticipo',23],[say('Método','Method'),23]]:[]),['Estado',22],['Observaciones',32]].map(([label,weight])=>({label:t(String(label)),weight:Number(weight)})),
      rows:outputRows.map(r=>[displayDate(r.event_date),formatEventTime(r.event_time,settings.time_format,''),r.client_name||'',r.phone?.trim()||'—',labels[r.id]||r.area||'',String(r.guests??''),r.menu||'',...(settings.reservation_show_deposits_list?[r.deposit==null?'':money(Number(r.deposit)),t(paymentMethodLabel(r.payment_method))]:[]),t(r.status||''),r.notes||''])};
  }
  async function exportReport(){
    if(!reportAction||outputLock.current)return;
    outputLock.current=true;setReportBusy(true);setReportError('');setPdfUrl('');
    const action=reportAction,nativeViewer=action==='pdf'&&needsNativePdfViewer();
    const target=nativeViewer?reserveQuotePrintWindow(say('Reservaciones','Reservations'),say('Preparando PDF…','Preparing PDF…')):null;
    try{
      const outputRows=await allMatchingReservations(PRINT_ROW_LIMIT);
      if(!outputRows.length)throw Error(say('No hay reservaciones en las fechas y búsqueda seleccionadas.','No reservations match the selected dates and search.'));
      const labels=printMode==='summary'?{}:await readEventAreaLabels(supabase,restaurantId,'reservation',outputRows,en,new AbortController().signal);
      const report=buildReport(outputRows,labels);
      if(action==='pdf'){
        const {createReservationPdf}=await import('@/lib/reservation-pdf');
        const document=createReservationPdf(report);
        if(nativeViewer){const result=openQuotePrintDocument(document.output('blob'),target);if(!result.opened)setPdfUrl(result.url)}
        else document.save(`${en?'reservations':'reservaciones'}-${today()}.pdf`);
      }else{
        printHtml(reservationReportHtml(report),{translated:true});
        void recordAuditActivity(restaurantId,'impresion','reservaciones',{label:'Reporte de reservaciones',rows:outputRows.length,mode,date,from,to,print_mode:printMode});
      }
      setReportAction(null);
    }catch(error){target?.close();setReportError(userMessage(error,say('No se pudo preparar el documento.','Could not prepare the document.')))}
    finally{outputLock.current=false;setReportBusy(false)}
  }
  const focusedDay = rows.find(row => row.id === focusedReservationId)?.event_date || focusedReservationDate;
  return (
    <div className="moduleStack">
      {areaLabels.error&&<p className="moduleNotice moduleError" role="alert">{say('No se pudieron consultar las mesas asignadas. Actualice para reintentar.','Could not load assigned tables. Refresh to retry.')}</p>}
      {canEdit && linkReservation && <ReservationQuoteLink restaurantId={restaurantId} reservation={linkReservation}
        close={() => setLinkReservation(null)} linked={() => { setLinkReservation(null); void reload(); }} />}

      {reportAction&&<Modal title={say(reportAction==='pdf'?'Descargar PDF':'Opciones de impresión',reportAction==='pdf'?'Download PDF':'Print options')} close={()=>{if(!reportBusy)setReportAction(null)}}>
        <div className="reservationReportOptions" translate="no">
          <p>{reportContext()}</p><small>{say('Incluye todas las páginas del filtro actual. Para otro período, cambie las fechas del listado.','Includes every page of the current filter. Change the list dates to use a different period.')}</small>
          <fieldset disabled={reportBusy}><legend>{say('¿Qué desea incluir?','What would you like to include?')}</legend>
            {([['both','Todo: reservaciones y resumen','Everything: reservations and summary'],['reservations','Solo reservaciones','Reservations only'],['summary','Solo resumen','Summary only']] as const).map(([value,es,eng])=><label key={value} className={printMode===value?'active':''}><input type="radio" name="reservation-report-content" value={value} checked={printMode===value} onChange={()=>setPrintMode(value)}/><span>{say(es,eng)}</span></label>)}
          </fieldset>
          {reportError&&<p className="moduleError" role="alert">{reportError}</p>}
          <div className="buttonRow"><button type="button" className="secondary" disabled={reportBusy} onClick={()=>setReportAction(null)}>{say('Cancelar','Cancel')}</button><button type="button" className="primary" disabled={reportBusy} onClick={exportReport}>{reportBusy?say('Preparando…','Preparing…'):reportAction==='pdf'?say('Descargar PDF','Download PDF'):say('Imprimir','Print')}</button></div>
        </div>
      </Modal>}
      <section className="reservationToolbar moduleCard">
        {focusedReservationId ? <div className="reservationFocusNotice" translate="no">
          <div><strong>{newlyCreated ? (language === "en" ? "Reservation created" : "Reservación creada") : (language === "en" ? "Linked reservation" : "Reservación vinculada")}</strong>
            <p>{newlyCreated ? (language === "en" ? "Your quote was converted successfully." : "Su cotización se convirtió correctamente.") : (language === "en" ? "Showing the reservation linked to your selected quote." : "Está viendo la reservación vinculada a la cotización seleccionada.")}
              {focusedDay && <> · <time dateTime={focusedDay}>{displayDate(focusedDay)}</time></>}</p></div>
          <button type="button" className="secondary" onClick={() => { setMode(focusedDay ? "single" : "all"); if (focusedDay) setDate(focusedDay); setSearch(""); setPage(1); clearFocusedReservation?.(); }}>{focusedDay ? (language === "en" ? "View this day's reservations" : "Ver reservaciones de esta fecha") : (language === "en" ? "View all reservations" : "Ver todas las reservaciones")}</button>
        </div> : <>
        <div className="reservationDateFilters" translate="no">
        <div className="reservationDateFields">
          <label className="reservationCurrentDate">
            <span>{mode==='range'?say('Desde','From'):say('Fecha','Date')}</span>
            <input type="date" aria-label={mode==='range'?say('Desde','From'):say('Fecha de reservaciones','Reservation date')} value={navigationDate}
              onChange={e=>{if(!e.target.value)return;if(mode==='range'){setFrom(e.target.value);if(to<e.target.value)setTo(e.target.value)}else{setDate(e.target.value);setMode('single')}}}/>
          </label>
          {mode==='range'&&<label className="reservationCurrentDate">
            <span>{say('Hasta','To')}</span>
            <input type="date" aria-label={say('Hasta','To')} min={from} value={to} onChange={e=>{if(e.target.value)setTo(e.target.value)}}/>
          </label>}
        </div>
        <div className="filterButtons reservationDayNavigation" role="group" aria-label={say('Navegar fechas de reservaciones','Browse reservation dates')}>
          <button
            className={mode === "today" ? "active" : ""}
            onClick={() => {
              setDate(today());
              setMode("today");
            }}
          >
            {say('Hoy','Today')}
          </button>
          <button
            onClick={showPreviousDay}
            title={say('Mostrar el día anterior','Show previous day')}
          >
            {say('‹ Anterior','‹ Previous')}
          </button>
          <button
            onClick={showNextDay}
            title={say('Mostrar el día siguiente','Show next day')}
          >
            {say('Siguiente ›','Next ›')}
          </button>
        </div>
        <div className="filterButtons reservationPeriodFilters">
          <button
            className={mode === "single" ? "active" : ""}
            onClick={() => {setDate(navigationDate);setMode("single")}}
          >
            {say('Una fecha','One date')}
          </button>
          <button
            className={mode === "range" ? "active" : ""}
            onClick={() => {if(mode!=="range"){setFrom(navigationDate);if(to<navigationDate)setTo(navigationDate)}setMode("range")}}
          >
            {say('De–a','From–to')}
          </button>
          <button
            className={mode === "all" ? "active" : ""}
            onClick={() => setMode("all")}
          >
            {say('Todas','All')}
          </button>
        </div>
        </div>
        <div className="filterDates">
          <input
            className="moduleSearch"
            placeholder="Buscar cliente, área, menú…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        </>}
        <div className="exportButtons reservationActions">
          {canDelete && <label className="selectVisible"><input type="checkbox" disabled={!visibleIds.length} checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])))} /> Seleccionar esta página</label>}
          {canDelete && removeMany && selected.length>0 && <button className="dangerButton" onClick={async () => { await removeMany(selected); setSelected([]); }}><Trash2 /> Eliminar seleccionadas (<span className="reservationSelectionCount">{selected.length}</span>)</button>}
          <div className="reservationOutputActions" translate="no">
            <button type="button" className="primary" disabled={reportBusy} onClick={()=>chooseOutput('print')}><Printer/>{say('Imprimir','Print')}</button>
            <details ref={moreRef} className="reservationMoreOptions" onKeyDown={e=>{if(e.key==='Escape'){closeMore();moreRef.current?.querySelector('summary')?.focus()}}}>
              <summary className="secondary"><MoreHorizontal/>{say('Más opciones','More options')}<ChevronDown size={15}/></summary>
              <div className="reservationOptionsMenu">
                <button type="button" disabled={reportBusy} onClick={()=>chooseOutput('pdf')}><FileText/>{say('Descargar PDF','Download PDF')}</button>
                <button type="button" disabled={!excelAccess.allowed} title={excelAccess.allowed?undefined:excelAccess.hint} onClick={()=>{closeMore();void exportRows()}}><FileSpreadsheet/>{say('Descargar Excel','Download Excel')}</button>
                {canEdit&&!focusedReservationId&&<>
                  <button type="button" disabled={!excelAccess.allowed} title={excelAccess.allowed?undefined:excelAccess.hint} onClick={()=>{closeMore();void template()}}><Download/>{say('Descargar plantilla','Download template')}</button>
                  <button type="button" onClick={()=>{closeMore();fileRef.current?.click()}}><Upload/>{say('Importar reservaciones','Import reservations')}</button>
                </>}
              </div>
            </details>
          </div>
          {canEdit&&!focusedReservationId&&<input hidden ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={importRows}/>}
        </div>
        {pdfUrl&&<p role="status" translate="no">{say('PDF listo. Puede guardarlo o compartirlo desde el visor.','PDF ready. Save or share it from the viewer.')} <a href={pdfUrl} target="_blank" rel="noopener noreferrer">{say('Abrir PDF','Open PDF')}</a></p>}

      </section>
      <section className="reservationSummary">
        <div className="reservationMetrics" aria-busy={loading || (showSummary && summaryLoading)}>
          <article>
            <small>{pageSummary || !showSummary ? (language === "en" ? "Reservations on this page" : "Reservaciones en esta página") : (language === "en" ? "Reservations in period" : "Reservaciones del período")}</small>
            <strong>{showSummary ? summaryCount : rows.length}</strong>
          </article>
          {settings.reservation_show_people && (
            <article>
              <small>Total de personas</small>
              <strong>{visiblePeople}</strong>
            </article>
          )}
          {settings.reservation_show_deposits && (
            <article>
              <small>Total de anticipos</small>
              <strong>{money(visibleDeposits)}</strong>
            </article>
          )}
        </div>
        <small className="reservationSummaryStatus" role="status">
          {(loading || (showSummary && summaryLoading)) ? "Actualizando resumen…" : "\u00a0"}
        </small>
      </section>
      {notice && <p className="moduleNotice">{userMessage(notice)}</p>}
      {loadError && <p className="moduleNotice moduleError" role="alert">{loadError}</p>}
      {mode === "all" && (settings.reservation_show_people || settings.reservation_show_deposits) && <p>{language === "en" ? "Totals on this page. Select a date or range for period totals." : "Totales de esta página. Elija una fecha o rango para ver los totales del período."}</p>}
      {showSummary && summaryError && <p className="moduleNotice moduleError" role="alert">{summaryError}</p>}
      {loading && !rows.length ? <div className="empty">Cargando información…</div> : rows.length ? (
        <div className="reservationCards">
          {rows.map((r) => (
            <article key={r.id} ref={r.id === focusedReservationId ? focusedCardRef : undefined} tabIndex={r.id === focusedReservationId ? -1 : undefined}
              className={`${selected.includes(r.id) ? "selectedRecord" : ""} ${r.id === focusedReservationId ? "reservationFocusCard" : ""}`}>
              {canDelete && <input className="recordCheckbox" type="checkbox" aria-label={`Seleccionar reservación de ${r.client_name}`} checked={selected.includes(r.id)} onChange={() => setSelected((ids) => ids.includes(r.id) ? ids.filter((id) => id !== r.id) : [...ids, r.id])} />}
              <div className="reservationTime">
                <small>Fecha</small>
                <span>{displayDate(r.event_date)}</span>
                <small>Hora</small>
                <strong>{formatEventTime(r.event_time, settings.time_format)}</strong>
              </div>
              <div className="reservationMain">
                <h3>{r.client_name}</h3>
                <p className="reservationPhone">
                  <b>Teléfono:</b> <span dir="ltr">{r.phone?.trim() || "Sin teléfono"}</span>
                </p>
                <p>
                  {areaLabels.labels[r.id] || r.area || "Sin área"} · {r.guests ?? "—"} invitados · <ReservationStatus status={r.status} />
                </p>
                {r.menu && (
                  <small>
                    <b>Menú:</b> {r.menu}
                  </small>
                )}
                {settings.reservation_show_deposits_list && <div className="reservationDeposit">
                  <span>
                    <b>Anticipo:</b> {r.deposit == null ? "—" : money(Number(r.deposit))}
                  </span>
                  <span>
                    <b>Método:</b> {paymentMethodLabel(r.payment_method)}
                  </span>
                </div>}
                {r.notes && (
                  <div className="reservationNotes">
                    <b>Observaciones:</b> {r.notes}
                  </div>
                )}
              </div>
              <div className="rowActions">
                {canEdit && !r.quote_id && r.status !== "cancelada" && <>
                  <button type="button" translate="no" onClick={() => createQuote(r)}><FileText />{language === "en" ? "Create quote" : "Crear cotización"}</button>
                  <button type="button" translate="no" onClick={() => setLinkReservation(r)}>{language === "en" ? "Link quote" : "Vincular cotización"}</button>
                </>}
                {r.quote_id && (
                  <button
                    title="Ver cotización"
                    onClick={() => openQuote(r.quote_id!)}
                  >
                    <FileText />
                    Cotización
                  </button>
                )}
                {canEdit && <button title="Editar reservación" onClick={() => edit(r)}>
                  <Pencil />
                  Editar
                </button>}
                {canDelete && <button title="Enviar a la papelera" onClick={() => remove(r)}>
                  <Trash2 />
                </button>}
              </div>
            </article>
          ))}
        </div>
      ) : loadError ? null : (
        <div className="empty" translate="no">
          {focusedReservationId
            ? (language === "en" ? "This reservation is no longer available. It may have been moved to trash or your access may have changed." : "Esta reservación ya no está disponible. Puede haberse enviado a la papelera o haber cambiado su acceso.")
            : (language === "en" ? "No reservations for the selected dates." : "No hay reservaciones en las fechas seleccionadas.")}
        </div>
      )}
      {!focusedReservationId && <Pagination total={total} page={page} onPage={setPage} hasNext={pager.hasNext} shown={rows.length} loading={loading} />}
    </div>
  );
}

function paymentMethodLabel(value?: string | null) {
  return (
    {
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      transferencia: "Transferencia",
      deposito: "Depósito bancario",
      otro: "Otro",
    }[String(value || "").toLowerCase()] || "Sin especificar"
  );
}

function excelDate(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    return year >= 1900 && year <= 2999
      ? `${year}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
      : "";
  }
  if (typeof value === "number") {
    const digits = String(Math.trunc(value));
    if (/^(19|20)\d{6}$/.test(digits)) {
      const year = digits.slice(0, 4), month = digits.slice(4, 6), day = digits.slice(6, 8);
      return validImportDate(year, month, day) ? `${year}-${month}-${day}` : "";
    }
    const parsed = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86400000),
      year = parsed.getUTCFullYear(), month = parsed.getUTCMonth() + 1, day = parsed.getUTCDate();
    return year >= 1900 && year <= 2999 && validImportDate(String(year), String(month), String(day))
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  }
  const text = String(value || "").trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return validImportDate(isoDate[1], isoDate[2], isoDate[3]) ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}` : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const local = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (local) {
    const [, day, month, year] = local,
      result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      date = new Date(`${result}T12:00:00`);
    return Number.isNaN(date.getTime()) || !validImportDate(year, month, day) ? "" : result;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? "" : localDateISO(d);
}

function validImportDate(year: string, month: string, day: string) {
  const y = Number(year), m = Number(month), d = Number(day);
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function importCell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function importNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") && text.includes(".") ? text.replace(/,/g, "") : text.replace(",", "."),
    result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}

function importOptionalNumber(value: unknown, integer = false) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Math.max(0, importNumber(value));
  return integer ? Math.trunc(number) : number;
}

function excelTime(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") {
    const totalMinutes = Math.round((value % 1) * 1440) % 1440;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }
  const text = String(value).trim(),
    match = text.match(/^(\d{1,2})(?::(\d{1,2}))?(?:\s*([ap])\.?\s*m\.?)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0), period = match[3]?.toLowerCase();
  if (period === "p" && hours < 12) hours += 12;
  if (period === "a" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
