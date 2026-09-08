"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, CalendarDays, Check, FileText, Users } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { configured, supabase } from "@/lib/supabase";
import { Dashboard } from "@/components/dashboard";

type PlanCode = "basic" | "intermediate" | "advanced";
type Account = {
  restaurantName: string;
  planCode: PlanCode;
  trialEndsAt: string;
  subscriptionStatus: string;
};
const plans = [
  {
    code: "basic" as PlanCode,
    name: "Basic",
    price: 20,
    description: "Para organizar la operación esencial.",
    features: [
      "Clientes y reservaciones",
      "Cotizaciones y PDF",
      "1 usuario administrador",
    ],
  },
  {
    code: "intermediate" as PlanCode,
    name: "Intermediate",
    price: 40,
    description: "Para restaurantes con más movimiento.",
    features: [
      "Todo lo incluido en Basic",
      "Horarios y empleados",
      "Reportes operativos",
    ],
  },
  {
    code: "advanced" as PlanCode,
    name: "Advanced",
    price: 50,
    description: "Para una operación administrativa completa.",
    features: [
      "Todo lo incluido en Intermediate",
      "Comunicación y recordatorios",
      "Configuración avanzada",
    ],
  },
];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState<"landing" | "login" | "signup">("landing"),
    [selectedPlan, setSelectedPlan] = useState<PlanCode>("intermediate"),
    [needsPassword, setNeedsPassword] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setNeedsPassword(
      new URLSearchParams(window.location.search).get("invite") === "1",
    );
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") setSession(null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED")
        setSession((current) =>
          current?.user.id === s?.user.id ? current : s,
        );
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setAccount(null);
      setLoading(false);
      return;
    }
    loadAccount();
  }, [session]);
  async function loadAccount() {
    setLoading(true);
    setMessage("");
    const ensured = await supabase.rpc("v2_ensure_restaurant");
    if (ensured.error) {
      setMessage(ensured.error.message);
      setLoading(false);
      return;
    }
    const result = await supabase
      .from("v2_restaurants")
      .select("name,plan_code,trial_ends_at,subscription_status")
      .eq("id", ensured.data)
      .single();
    if (result.error) setMessage(result.error.message);
    else
      setAccount({
        restaurantName: result.data.name,
        planCode: result.data.plan_code,
        trialEndsAt: result.data.trial_ends_at,
        subscriptionStatus: result.data.subscription_status,
      });
    setLoading(false);
  }
  function startTrial(plan: PlanCode) {
    setSelectedPlan(plan);
    setView("signup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (loading)
    return (
      <main className="center">
        <div className="loader" />
      </main>
    );
  if (session && account) {
    return needsPassword ? (
      <SetInvitedPassword
        done={() => {
          history.replaceState({}, "", window.location.pathname);
          setNeedsPassword(false);
        }}
      />
    ) : (
      <Dashboard
        session={session}
        trialEndsAt={account.trialEndsAt}
        planCode={account.planCode}
      />
    );
  }
  if (view !== "landing")
    return (
      <AccessForm
        mode={view}
        selectedPlan={selectedPlan}
        message={message}
        back={() => setView("landing")}
      />
    );
  return <Landing startTrial={startTrial} login={() => setView("login")} />;
}

function SetInvitedPassword({ done }: { done: () => void }) {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8)
      return setMessage("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm)
      return setMessage("Las contraseñas no coinciden.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMessage(error.message);
    done();
  }
  return (
    <main className="auth">
      <section className="authBrand">
        <div className="mark">M</div>
        <h1>Active su acceso.</h1>
        <p>Cree la contraseña con la que ingresará a MRMAA.</p>
      </section>
      <section className="authCard">
        <h2>Crear contraseña</h2>
        <form className="form" onSubmit={save}>
          <label>
            Contraseña
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirmar contraseña
            <input
              required
              type="password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {message && <p className="error">{message}</p>}
          <button className="primary">Guardar y entrar</button>
        </form>
      </section>
    </main>
  );
}

function Landing({
  startTrial,
  login,
}: {
  startTrial: (p: PlanCode) => void;
  login: () => void;
}) {
  return (
    <main className="landing">
      <nav className="landingNav">
        <a className="landingLogo" href="#top">
          <span className="mark">M</span>
          <strong>MRMAA</strong>
        </a>
        <div>
          <a href="#funciones">Funciones</a>
          <a href="#planes">Planes</a>
          <button className="secondary" onClick={login}>
            Iniciar sesión
          </button>
        </div>
      </nav>
      <section className="hero" id="top">
        <div>
          <span className="heroTag">Administración para restaurantes</span>
          <h1>
            Más control.
            <br />
            <em>Menos improvisación.</em>
          </h1>
          <p>
            Centralice reservaciones, clientes, cotizaciones y operación
            administrativa en un solo lugar.
          </p>
          <div className="heroActions">
            <button
              className="primary"
              onClick={() => startTrial("intermediate")}
            >
              Probar gratis 10 días <ArrowRight />
            </button>
            <span>Sin tarjeta de crédito</span>
          </div>
        </div>
        <div className="heroPanel">
          <div className="miniTop">
            <span>Resumen de hoy</span>
            <b>MRMAA</b>
          </div>
          <div className="metric">
            <small>Reservaciones</small>
            <strong>18</strong>
            <span>142 invitados</span>
          </div>
          <div className="miniGrid">
            <div>
              <CalendarDays />
              <b>7</b>
              <small>Confirmadas</small>
            </div>
            <div>
              <FileText />
              <b>4</b>
              <small>Cotizaciones</small>
            </div>
            <div>
              <Users />
              <b>12</b>
              <small>Clientes nuevos</small>
            </div>
          </div>
        </div>
      </section>
      <section className="featuresSection" id="funciones">
        <div className="sectionIntro">
          <span>Una operación conectada</span>
          <h2>La información que necesita, donde la necesita.</h2>
        </div>
        <div className="featureGrid">
          <article>
            <CalendarDays />
            <h3>Reservaciones claras</h3>
            <p>Fechas, horarios, invitados, anticipos y estados organizados.</p>
          </article>
          <article>
            <FileText />
            <h3>Cotizaciones precisas</h3>
            <p>
              Productos, descuentos, propina, anticipos y PDF profesional A4.
            </p>
          </article>
          <article>
            <Users />
            <h3>Clientes relacionados</h3>
            <p>Clientes vinculados con sus cotizaciones y eventos.</p>
          </article>
        </div>
      </section>
      <section className="plansSection" id="planes">
        <div className="sectionIntro">
          <span>Planes simples</span>
          <h2>Comience gratis. Crezca cuando lo necesite.</h2>
          <p>Pruebe durante 10 días. No solicitaremos información de pago.</p>
        </div>
        <div className="planGrid">
          {plans.map((p) => (
            <article
              className={p.code === "intermediate" ? "featuredPlan" : ""}
              key={p.code}
            >
              {p.code === "intermediate" && (
                <span className="popular">Más elegido</span>
              )}
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="price">
                <strong>${p.price}</strong>
                <span>USD / mes</span>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={p.code === "intermediate" ? "primary" : "secondary"}
                onClick={() => startTrial(p.code)}
              >
                Probar {p.name}
              </button>
            </article>
          ))}
        </div>
      </section>
      <footer className="landingFooter">
        <div className="landingLogo">
          <span className="mark">M</span>
          <strong>MRMAA</strong>
        </div>
        <p>Modern Restaurant Management & Administrative Automation</p>
      </footer>
    </main>
  );
}

function AccessForm({
  mode,
  selectedPlan,
  message,
  back,
}: {
  mode: "login" | "signup";
  selectedPlan: PlanCode;
  message: string;
  back: () => void;
}) {
  const [form, setForm] = useState({
      name: "",
      restaurant: "",
      phone: "",
      country: "Guatemala",
      language: "es",
      currency: "GTQ",
      email: "",
      password: "",
      confirmPassword: "",
    }),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(message),
    [currentMode, setCurrentMode] = useState(mode);
  const plan = plans.find((x) => x.code === selectedPlan)!;
  const field = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback("");
    if (!configured)
      return setFeedback("Faltan las variables de Supabase en Vercel.");
    if (currentMode === "signup" && form.password !== form.confirmPassword)
      return setFeedback("Las contraseñas no coinciden.");
    setBusy(true);
    if (currentMode === "login") {
      const r = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (r.error)
        setFeedback(
          r.error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : r.error.message,
        );
    } else {
      const r = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: form.name.trim(),
            restaurant_name: form.restaurant.trim(),
            phone: form.phone.trim(),
            country: form.country,
            language: form.language,
            currency: form.currency,
            plan_code: selectedPlan,
          },
        },
      });
      if (r.error) setFeedback(r.error.message);
      else if (r.data.session)
        setFeedback("Registro completado. Abriendo su dashboard…");
      else if (!r.data.session)
        setFeedback(
          "Cuenta creada. Revise su correo y confirme el registro; después vuelva para iniciar sesión.",
        );
    }
    setBusy(false);
  }
  return (
    <main className="accessPage">
      <section className="accessAside">
        <button className="backLink" onClick={back}>
          ← Volver a MRMAA
        </button>
        <div>
          <span className="mark">M</span>
          <h1>
            {currentMode === "signup"
              ? "Comience su prueba."
              : "Bienvenido de nuevo."}
          </h1>
          <p>
            {currentMode === "signup"
              ? `Plan ${plan.name}: 10 días gratis, sin tarjeta.`
              : "Ingrese para continuar administrando su restaurante."}
          </p>
        </div>
      </section>
      <section className="accessContent">
        <form className="accessCard" onSubmit={submit}>
          <h2>
            {currentMode === "signup" ? "Crear cuenta" : "Iniciar sesión"}
          </h2>
          {currentMode === "signup" && (
            <>
              <div className="grid2">
                <label>
                  Su nombre
                  <input
                    required
                    value={form.name}
                    onChange={(e) => field("name", e.target.value)}
                  />
                </label>
                <label>
                  Restaurante
                  <input
                    required
                    value={form.restaurant}
                    onChange={(e) => field("restaurant", e.target.value)}
                  />
                </label>
                <label>
                  Teléfono
                  <PhoneInput
                    required
                    international
                    defaultCountry="GT"
                    countryCallingCodeEditable={false}
                    value={form.phone}
                    onChange={(value) => field("phone", value || "")}
                  />
                </label>
                <label>
                  País
                  <input
                    required
                    value={form.country}
                    onChange={(e) => field("country", e.target.value)}
                  />
                </label>
                <label>
                  Idioma
                  <select
                    value={form.language}
                    onChange={(e) => field("language", e.target.value)}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  Moneda
                  <select
                    value={form.currency}
                    onChange={(e) => field("currency", e.target.value)}
                  >
                    <option value="GTQ">Quetzal (GTQ)</option>
                    <option value="USD">Dólar (USD)</option>
                  </select>
                </label>
              </div>
              <div className="chosenPlan">
                <span>Plan seleccionado</span>
                <strong>
                  {plan.name} · ${plan.price}/mes
                </strong>
              </div>
            </>
          )}
          <label>
            Correo electrónico
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => field("email", e.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => field("password", e.target.value)}
            />
            <small>Mínimo 8 caracteres.</small>
          </label>
          {currentMode === "signup" && (
            <label>
              Confirmar contraseña
              <input
                type="password"
                required
                minLength={8}
                value={form.confirmPassword}
                onChange={(e) => field("confirmPassword", e.target.value)}
              />
              {form.confirmPassword &&
                form.password !== form.confirmPassword && (
                  <small className="passwordMismatch">
                    Las contraseñas no coinciden.
                  </small>
                )}
            </label>
          )}
          {feedback && (
            <p
              className={
                feedback.startsWith("Cuenta creada") ? "success" : "error"
              }
            >
              {feedback}
            </p>
          )}
          <button className="primary fullButton" disabled={busy}>
            {busy
              ? "Procesando…"
              : currentMode === "signup"
                ? "Comenzar prueba gratis"
                : "Entrar"}
          </button>
          <button
            className="link"
            type="button"
            onClick={() => {
              setCurrentMode(currentMode === "login" ? "signup" : "login");
              setFeedback("");
            }}
          >
            {currentMode === "login"
              ? "¿No tiene cuenta? Pruebe gratis"
              : "¿Ya tiene cuenta? Inicie sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}

function TrialExpired({ account }: { account: Account }) {
  return (
    <main className="expired">
      <section>
        <span className="mark">M</span>
        <span className="heroTag">Prueba finalizada</span>
        <h1>Sus datos siguen seguros.</h1>
        <p>
          La prueba de 10 días del plan{" "}
          {plans.find((x) => x.code === account.planCode)?.name} terminó. Active
          una suscripción para recuperar el acceso.
        </p>
        <button className="primary" disabled>
          Pagos próximamente
        </button>
        <button className="link" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}
