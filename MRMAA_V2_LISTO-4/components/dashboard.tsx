"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  MessageCircle,
  BarChart3,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calculateQuote, numberValue } from "@/lib/calculations";
import { downloadQuotePdf } from "@/lib/pdf";
import type { Client, Quote, QuoteItem, Reservation } from "@/lib/types";
import {
  CommunicationModule,
  ReportsModule,
  SchedulesModule,
  SettingsModule,
} from "@/components/operations";

type Tab =
  | "reservations"
  | "clients"
  | "quotes"
  | "schedules"
  | "communication"
  | "reports"
  | "settings";
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
  event_date: new Date().toISOString().slice(0, 10),
  event_time: "12:00",
  area: "",
  guests: 1,
  discount_pct: 0,
  tip_pct: 10,
  deposit: 0,
  customer_note: "",
  internal_notes: "",
  items: [emptyItem()],
});
const emptyReservation = () => ({
  client_id: "",
  client_name: "",
  phone: "",
  event_date: new Date().toISOString().slice(0, 10),
  event_time: "12:00",
  area: "",
  guests: 2,
  menu: "",
  deposit: 0,
  notes: "",
  status: "pendiente",
});
const money = (n: number) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(
    n || 0,
  );

export function Dashboard({
  session,
  trialEndsAt,
  planCode,
}: {
  session: Session;
  trialEndsAt: string;
  planCode: string;
}) {
  const trialDays = Math.max(
    1,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000),
  );
  const [tab, setTab] = useState<Tab>("reservations"),
    [restaurantId, setRestaurantId] = useState(""),
    [restaurantName, setRestaurantName] = useState("Mi restaurante"),
    [quoteStart, setQuoteStart] = useState(2000),
    [clients, setClients] = useState<Client[]>([]),
    [quotes, setQuotes] = useState<Quote[]>([]),
    [reservations, setReservations] = useState<Reservation[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
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
  const [reservationOpen, setReservationOpen] = useState(false),
    [reservationEdit, setReservationEdit] = useState<Reservation | null>(null),
    [reservationForm, setReservationForm] = useState<any>(emptyReservation());

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    const ensured = await supabase.rpc("v2_ensure_restaurant");
    if (ensured.error) {
      setError(ensured.error.message);
      setBusy(false);
      return;
    }
    const id = String(ensured.data);
    setRestaurantId(id);
    const [r, c, q, i, rv] = await Promise.all([
      supabase
        .from("v2_restaurants")
        .select("name,quote_number_start")
        .eq("id", id)
        .single(),
      supabase
        .from("v2_clients")
        .select("*")
        .eq("restaurant_id", id)
        .order("name"),
      supabase
        .from("v2_quotes")
        .select("*")
        .eq("restaurant_id", id)
        .order("quote_number", { ascending: false }),
      supabase.from("v2_quote_items").select("*"),
      supabase
        .from("v2_reservations")
        .select("*")
        .eq("restaurant_id", id)
        .order("event_date"),
    ]);
    if (r.data?.name) setRestaurantName(r.data.name);
    if (r.data?.quote_number_start) setQuoteStart(r.data.quote_number_start);
    if (c.error || q.error || i.error || rv.error)
      setError(
        c.error?.message ||
          q.error?.message ||
          i.error?.message ||
          rv.error?.message ||
          "",
      );
    setClients((c.data || []) as Client[]);
    const items = i.data || [];
    setQuotes(
      (q.data || []).map((x: any) => ({
        ...x,
        items: items
          .filter((z: any) => z.quote_id === x.id)
          .map((z: any) => ({
            id: z.id,
            name: z.name,
            description: z.description || "",
            quantity: Number(z.quantity),
            unit_price: Number(z.unit_price),
          })),
      })) as Quote[],
    );
    setReservations((rv.data || []) as Reservation[]);
    setBusy(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const totals = useMemo(
    () =>
      calculateQuote(
        quoteForm.items,
        quoteForm.discount_pct,
        quoteForm.tip_pct,
        quoteForm.deposit,
      ),
    [quoteForm],
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
                  : numberValue(value),
            }
          : x,
      ),
    }));
  function chooseClient(id: string, target: "quote" | "reservation") {
    const c = clients.find((x) => x.id === id);
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
    await load();
  }
  async function saveQuote(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const valid = quoteForm.items.filter((x: QuoteItem) => x.name.trim());
    if (!valid.length)
      return setError("Agregue al menos un producto o servicio.");
    const t = calculateQuote(
      valid,
      quoteForm.discount_pct,
      quoteForm.tip_pct,
      quoteForm.deposit,
    );
    let quoteId = quoteEdit?.id;
    const payload = {
      restaurant_id: restaurantId,
      client_id: quoteForm.client_id || null,
      client_name: quoteForm.client_name.trim(),
      client_phone: quoteForm.client_phone.trim(),
      client_email: quoteForm.client_email.trim(),
      event_date: quoteForm.event_date,
      event_time: quoteForm.event_time || null,
      area: quoteForm.area.trim(),
      guests: Number(quoteForm.guests) || 0,
      discount_pct: t.discountPct,
      tip_pct: t.tipPct,
      subtotal: t.subtotal,
      total: t.total,
      deposit: t.deposit,
      balance: t.balance,
      customer_note: quoteForm.customer_note.trim(),
      internal_notes: quoteForm.internal_notes.trim(),
      status: quoteEdit?.status || "borrador",
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
      const last = quotes[0]?.quote_number || quoteStart - 1;
      const ins = await supabase
        .from("v2_quotes")
        .insert({ ...payload, quote_number: last + 1 })
        .select("id")
        .single();
      if (ins.error) return setError(ins.error.message);
      quoteId = ins.data.id;
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
    await load();
  }
  async function saveReservation(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      restaurant_id: restaurantId,
      client_id: reservationForm.client_id || null,
      client_name: reservationForm.client_name.trim(),
      phone: reservationForm.phone.trim(),
      event_date: reservationForm.event_date,
      event_time: reservationForm.event_time || null,
      area: reservationForm.area.trim(),
      guests: Number(reservationForm.guests) || 0,
      menu: reservationForm.menu.trim(),
      deposit: numberValue(reservationForm.deposit),
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
    await load();
  }
  async function convertQuote(q: Quote) {
    const menu = q.items
      .map((x) => `${x.name}${x.quantity !== 1 ? ` × ${x.quantity}` : ""}`)
      .join(", ");
    const payload = {
      restaurant_id: restaurantId,
      quote_id: q.id,
      client_id: q.client_id,
      client_name: q.client_name,
      phone: q.client_phone,
      event_date: q.event_date,
      event_time: q.event_time || null,
      area: q.area,
      guests: q.guests,
      menu,
      subtotal: q.subtotal,
      discount_pct: q.discount_pct,
      tip_pct: q.tip_pct,
      total: q.total,
      deposit: q.deposit,
      balance: q.balance,
      notes: q.internal_notes,
      status: "pendiente",
    };
    const res = await supabase.from("v2_reservations").insert(payload);
    if (res.error)
      return setError(
        res.error.code === "23505"
          ? "Esta cotización ya tiene una reservación vinculada."
          : res.error.message,
      );
    await supabase
      .from("v2_quotes")
      .update({ status: "convertida" })
      .eq("id", q.id);
    await load();
    setTab("reservations");
  }
  function editQuote(q: Quote) {
    setQuoteEdit(q);
    setQuoteForm({ ...q, items: q.items.map((x) => ({ ...x })) });
    setQuoteOpen(true);
    setPreview(null);
  }
  function editReservation(r: Reservation) {
    setReservationEdit(r);
    setReservationForm({ ...r });
    setReservationOpen(true);
  }
  function openClient(c?: Client) {
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
            <div className="mark">M</div>
            <div>
              <strong>MRMAA</strong>
              <span>{restaurantName}</span>
            </div>
          </div>
          <nav>
            <Nav
              active={tab === "reservations"}
              onClick={() => setTab("reservations")}
              icon={<CalendarDays />}
            >
              Reservaciones
            </Nav>
            <Nav
              active={tab === "clients"}
              onClick={() => setTab("clients")}
              icon={<Users />}
            >
              Clientes
            </Nav>
            <Nav
              active={tab === "quotes"}
              onClick={() => setTab("quotes")}
              icon={<FileText />}
            >
              Cotizaciones
            </Nav>
            <Nav
              active={tab === "communication"}
              onClick={() => setTab("communication")}
              icon={<MessageCircle />}
            >
              Comunicación
            </Nav>
            <Nav
              active={tab === "schedules"}
              onClick={() => setTab("schedules")}
              icon={<Clock3 />}
            >
              Horarios
            </Nav>
            <Nav
              active={tab === "reports"}
              onClick={() => setTab("reports")}
              icon={<BarChart3 />}
            >
              Reportes
            </Nav>
            <Nav
              active={tab === "settings"}
              onClick={() => setTab("settings")}
              icon={<Settings />}
            >
              Configuración
            </Nav>
          </nav>
          <button className="logout" onClick={() => supabase.auth.signOut()}>
            <LogOut />
            Cerrar sesión
          </button>
        </aside>
        <main className="workspace">
          <div className="trialBanner">
            <span>
              Prueba gratuita · {trialDays}{" "}
              {trialDays === 1 ? "día restante" : "días restantes"}
            </span>
            <strong>
              Plan {planCode.charAt(0).toUpperCase() + planCode.slice(1)}
            </strong>
          </div>
          <header>
            <div>
              <span className="eyebrow">{restaurantName}</span>
              <h1>
                {
                  {
                    reservations: "Reservaciones",
                    clients: "Clientes",
                    quotes: "Cotizaciones",
                    communication: "Comunicación",
                    schedules: "Horarios",
                    reports: "Reportes",
                    settings: "Configuración",
                  }[tab]
                }
              </h1>
            </div>
            {(tab === "reservations" ||
              tab === "clients" ||
              tab === "quotes") && (
              <button
                className="primary"
                onClick={() => {
                  if (tab === "clients") openClient();
                  if (tab === "quotes") {
                    setQuoteEdit(null);
                    setQuoteForm(emptyQuote());
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
              {error}
              <button onClick={() => setError("")}>
                <X />
              </button>
            </div>
          )}
          {busy ? (
            <div className="empty">Cargando información…</div>
          ) : tab === "clients" ? (
            <Clients rows={clients} edit={openClient} />
          ) : tab === "quotes" ? (
            <Quotes
              rows={quotes}
              edit={editQuote}
              preview={setPreview}
              convert={convertQuote}
            />
          ) : tab === "reservations" ? (
            <Reservations
              rows={reservations}
              quotes={quotes}
              edit={editReservation}
              openQuote={(q) => {
                setTab("quotes");
                setPreview(q);
              }}
            />
          ) : tab === "schedules" ? (
            <SchedulesModule restaurantId={restaurantId} />
          ) : tab === "communication" ? (
            <CommunicationModule
              restaurantId={restaurantId}
              clients={clients}
            />
          ) : tab === "reports" ? (
            <ReportsModule
              clients={clients}
              quotes={quotes}
              reservations={reservations}
            />
          ) : (
            <SettingsModule
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              onNameChange={setRestaurantName}
            />
          )}
        </main>
      </div>
      {clientOpen && (
        <Modal
          title={clientEdit ? "Editar cliente" : "Nuevo cliente"}
          close={() => setClientOpen(false)}
        >
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
              <textarea
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
      {reservationOpen && (
        <Modal
          title={reservationEdit ? "Editar reservación" : "Nueva reservación"}
          close={() => setReservationOpen(false)}
        >
          <form onSubmit={saveReservation} className="form grid2">
            <Field label="Cliente registrado">
              <select
                value={reservationForm.client_id}
                onChange={(e) => chooseClient(e.target.value, "reservation")}
              >
                <option value="">Escribir nombre manualmente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
              <input
                value={reservationForm.area}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    area: e.target.value,
                  })
                }
              />
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
            <Field label="Menú">
              <textarea
                value={reservationForm.menu}
                onChange={(e) =>
                  setReservationForm({
                    ...reservationForm,
                    menu: e.target.value,
                  })
                }
              />
            </Field>
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
      {quoteOpen && (
        <Modal
          wide
          title={
            quoteEdit
              ? `Editar cotización #${quoteEdit.quote_number}`
              : "Nueva cotización"
          }
          close={() => setQuoteOpen(false)}
        >
          <form onSubmit={saveQuote} className="quoteForm">
            <div className="grid3">
              <Field label="Cliente registrado">
                <select
                  value={quoteForm.client_id}
                  onChange={(e) => chooseClient(e.target.value, "quote")}
                >
                  <option value="">Escribir nombre manualmente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
                <input
                  value={quoteForm.area}
                  onChange={(e) => field("area", e.target.value)}
                />
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
            </div>
            <div className="items">
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
                  <input
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
                <label>
                  <span>Descuento</span>
                  <span className="percent">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={quoteForm.discount_pct}
                      onChange={(e) => field("discount_pct", e.target.value)}
                    />
                    %
                  </span>
                </label>
                <Total label="Descuento aplicado" value={-totals.discount} />
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
                <Total big label="Saldo pendiente" value={totals.balance} />
              </div>
            </div>
            <Actions />
          </form>
        </Modal>
      )}
      {preview && (
        <QuotePreview
          quote={preview}
          restaurant={restaurantName}
          close={() => setPreview(null)}
          edit={() => editQuote(preview)}
        />
      )}
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
function Clients({
  rows,
  edit,
}: {
  rows: Client[];
  edit: (c: Client) => void;
}) {
  return rows.length ? (
    <div className="cards">
      {rows.map((c) => (
        <article key={c.id}>
          <div>
            <h3>{c.name}</h3>
            <p>
              {c.phone || "Sin teléfono"} · {c.email || "Sin email"}
            </p>
            {c.notes && <small>{c.notes}</small>}
          </div>
          <button className="icon" onClick={() => edit(c)}>
            <Pencil />
          </button>
        </article>
      ))}
    </div>
  ) : (
    <div className="empty">Todavía no hay clientes.</div>
  );
}
function Quotes({
  rows,
  edit,
  preview,
  convert,
}: {
  rows: Quote[];
  edit: (q: Quote) => void;
  preview: (q: Quote) => void;
  convert: (q: Quote) => void;
}) {
  return rows.length ? (
    <div className="table">
      <div className="tr head">
        <span>Número</span>
        <span>Cliente</span>
        <span>Evento</span>
        <span>Total</span>
        <span>Estado</span>
        <span />
      </div>
      {rows.map((q) => (
        <div className="tr" key={q.id}>
          <strong>#{q.quote_number}</strong>
          <span>{q.client_name}</span>
          <span>
            {q.event_date} · {q.event_time?.slice(0, 5)}
          </span>
          <strong>{money(q.total)}</strong>
          <span className="status">{q.status}</span>
          <div className="rowActions">
            <button onClick={() => edit(q)}>
              <Pencil />
            </button>
            <button onClick={() => preview(q)}>
              <FileText />
            </button>
            {q.status !== "convertida" && (
              <button
                title="Convertir en reservación"
                onClick={() => convert(q)}
              >
                <ArrowRight />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty">Todavía no hay cotizaciones.</div>
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
            {r.event_date} · {r.event_time?.slice(0, 5)}
          </strong>
          <span>{r.client_name}</span>
          <span>{r.area || "—"}</span>
          <span>{r.guests}</span>
          <span className="status">{r.status}</span>
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
function QuotePreview({
  quote,
  restaurant,
  close,
  edit,
}: {
  quote: Quote;
  restaurant: string;
  close: () => void;
  edit: () => void;
}) {
  const t = calculateQuote(
    quote.items,
    quote.discount_pct,
    quote.tip_pct,
    quote.deposit,
  );
  return (
    <div className="overlay">
      <section className="paper">
        <header>
          <div>
            <small>{restaurant}</small>
            <h2>COTIZACIÓN</h2>
            <p>Propuesta para evento</p>
          </div>
          <strong>#{quote.quote_number}</strong>
        </header>
        <div className="quoteInfo">
          <span>
            <small>Cliente</small>
            {quote.client_name}
          </span>
          <span>
            <small>Fecha</small>
            {quote.event_date}
          </span>
          <span>
            <small>Hora</small>
            {quote.event_time}
          </span>
          <span>
            <small>Área</small>
            {quote.area || "—"}
          </span>
          <span>
            <small>Invitados</small>
            {quote.guests}
          </span>
          <span>
            <small>Teléfono</small>
            {quote.client_phone || "—"}
          </span>
        </div>
        <div className="previewTable">
          <div>
            <b>Producto / servicio</b>
            <b>Cant.</b>
            <b>Precio</b>
            <b>Total</b>
          </div>
          {quote.items.map((x, i) => (
            <div key={i}>
              <span>
                <strong>{x.name}</strong>
                <small>{x.description}</small>
              </span>
              <span>{x.quantity}</span>
              <span>{money(x.unit_price)}</span>
              <strong>{money(x.quantity * x.unit_price)}</strong>
            </div>
          ))}
        </div>
        <div className="previewTotals">
          <Total label="Subtotal" value={t.subtotal} />
          {t.discount > 0 && (
            <Total label={`Descuento ${t.discountPct}%`} value={-t.discount} />
          )}
          <Total label={`Propina ${t.tipPct}%`} value={t.tip} />
          <Total label="Anticipo" value={-t.deposit} />
          <Total big label="Saldo pendiente" value={t.balance} />
        </div>
        {quote.customer_note && (
          <div className="note">
            <strong>Nota para el cliente</strong>
            <p>{quote.customer_note}</p>
          </div>
        )}
        <footer>
          <button className="secondary" onClick={close}>
            Cerrar
          </button>
          <button className="secondary" onClick={edit}>
            <Pencil />
            Editar
          </button>
          <button
            className="primary"
            onClick={() => downloadQuotePdf(quote, restaurant, "GTQ")}
          >
            <Download />
            Descargar PDF A4
          </button>
        </footer>
      </section>
    </div>
  );
}
