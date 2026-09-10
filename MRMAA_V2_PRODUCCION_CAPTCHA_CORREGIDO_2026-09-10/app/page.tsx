"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  FileSpreadsheet,
  FileText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { configured, supabase } from "@/lib/supabase";
import { Dashboard } from "@/components/dashboard";
import { SecurityCenter } from "@/components/security-center";
import { LEGAL_VERSION } from "@/components/legal-page";

type PlanCode = "basic" | "intermediate" | "advanced";
type Account = {
  restaurantId: string;
  restaurantName: string;
  planCode: PlanCode;
  trialEndsAt: string;
  subscriptionStatus: string;
  accessStatus: string;
  billingEnforcementEnabled: boolean;
  graceEndsAt: string | null;
  exportUntil: string | null;
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
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
const PUBLIC_SIGNUP_ENABLED = false;
const CANONICAL_SITE_URL = "https://mrmaa.com";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const passwordIsStrong = (value: string) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function Home() {
  const [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState<"landing" | "login" | "signup">("landing"),
    [selectedPlan, setSelectedPlan] = useState<PlanCode>("intermediate"),
    [needsPassword, setNeedsPassword] = useState(false),
    [passwordReason, setPasswordReason] = useState<"invite" | "reset">(
      "invite",
    ),
    [message, setMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      hashParams = new URLSearchParams(window.location.hash.replace(/^#/, "")),
      invited = params.get("invite") === "1",
      resetting = params.get("reset") === "1",
      authType = hashParams.get("type");
    if (params.get("login") === "1") setView("login");
    setNeedsPassword(
      invited || resetting || authType === "invite" || authType === "recovery",
    );
    if (resetting || authType === "recovery") setPasswordReason("reset");
    const completeAuthReturn = async () => {
      // Supabase puede devolver invitaciones/recuperaciones mediante PKCE (?code=)
      // o mediante los tokens del hash. El cliente procesa el hash; para PKCE
      // intercambiamos el código explícitamente antes de mostrar el portal.
      const code = params.get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(
            "El enlace ya venció o fue utilizado. Solicite uno nuevo desde Iniciar sesión.",
          );
          setView("login");
        } else if (data.session) {
          setSession(data.session);
          if (resetting) {
            setPasswordReason("reset");
            setNeedsPassword(true);
          }
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    void completeAuthReturn();
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setAccount(null);
        setNeedsPassword(false);
        setView("login");
        history.replaceState({}, "", `${window.location.pathname}?login=1`);
        window.scrollTo({ top: 0 });
      }
      if (event === "PASSWORD_RECOVERY") {
        setSession(s);
        setPasswordReason("reset");
        setNeedsPassword(true);
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED")
        setSession((current) =>
          current?.user.id === s?.user.id ? current : s,
        );
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const activityKey = "mrmaa-last-activity";
    const logout = async () => {
      await supabase.auth.signOut();
      setView("login");
      setNeedsPassword(false);
      history.replaceState({}, "", `${window.location.pathname}?login=1`);
      window.scrollTo({ top: 0 });
    };
    const resetTimer = () => {
      localStorage.setItem(activityKey, String(Date.now()));
      clearTimeout(timer);
      timer = setTimeout(logout, INACTIVITY_LIMIT_MS);
    };
    const verify = () => {
      const elapsed = Date.now() - Number(localStorage.getItem(activityKey) || Date.now());
      if (elapsed >= INACTIVITY_LIMIT_MS) void logout();
      else { clearTimeout(timer); timer = setTimeout(logout, INACTIVITY_LIMIT_MS - elapsed); }
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true }),
    );
    if (localStorage.getItem(activityKey)) verify(); else resetTimer();
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, [session]);
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
    const membership = await supabase
      .from("v2_members")
      .select("status")
      .eq("restaurant_id", ensured.data)
      .eq("user_id", session?.user.id)
      .maybeSingle();
    if (membership.data?.status === "inactivo") {
      setMessage("Su acceso fue desactivado por el administrador.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    const result = await supabase
      .from("v2_restaurants")
      .select("id,name,plan_code,trial_ends_at,subscription_status,access_status,billing_enforcement_enabled,grace_ends_at,export_until")
      .eq("id", ensured.data)
      .single();
    if (result.error) setMessage(result.error.message);
    else
      setAccount({
        restaurantId: result.data.id,
        restaurantName: result.data.name,
        planCode: result.data.plan_code,
        trialEndsAt: result.data.trial_ends_at,
        subscriptionStatus: result.data.subscription_status,
        accessStatus: result.data.access_status || result.data.subscription_status,
        billingEnforcementEnabled: Boolean(result.data.billing_enforcement_enabled),
        graceEndsAt: result.data.grace_ends_at,
        exportUntil: result.data.export_until,
      });
    setLoading(false);
  }
  function startTrial(plan: PlanCode) {
    setSelectedPlan(plan);
    setView(PUBLIC_SIGNUP_ENABLED ? "signup" : "login");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (loading)
    return (
      <main className="center">
        <div className="loader" />
      </main>
    );
  if (session && needsPassword) {
    return (
      <SetInvitedPassword
        reason={passwordReason}
        done={() => {
          history.replaceState({}, "", window.location.pathname);
          setNeedsPassword(false);
          loadAccount();
        }}
      />
    );
  }
  if (session && account) {
    const now = Date.now();
    const trialExpired = account.subscriptionStatus === "trialing" && new Date(account.trialEndsAt).getTime() < now;
    const graceExpired = account.subscriptionStatus === "past_due" && (!account.graceEndsAt || new Date(account.graceEndsAt).getTime() < now);
    const restricted = account.billingEnforcementEnabled && (
      ["restricted", "cancelled", "suspended", "deleted"].includes(account.accessStatus) || trialExpired || graceExpired
    );
    if (restricted) return <RestrictedAccount account={account} />;
    return (
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

function RestrictedAccount({ account }: { account: Account }) {
  const exportExpired = account.exportUntil && new Date(account.exportUntil).getTime() < Date.now();
  return (
    <main className="expired">
      <section style={{ maxWidth: 920 }}>
        <span className="mark">M</span>
        <span className="heroTag">Acceso restringido</span>
        <h1>Sus datos permanecen protegidos.</h1>
        <p>La suscripción no permite realizar cambios. Cuando se reactive el pago, el acceso completo volverá automáticamente.</p>
        {!exportExpired ? <SecurityCenter restaurantId={account.restaurantId} exportOnly /> : <p>El periodo disponible para descargar información terminó. Contacte a soporte.</p>}
        <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </section>
    </main>
  );
}

function SetInvitedPassword({
  done,
  reason,
}: {
  done: () => void;
  reason: "invite" | "reset";
}) {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [accepted, setAccepted] = useState(false),
    [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordIsStrong(password))
      return setMessage("Use 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.");
    if (password !== confirm)
      return setMessage("Las contraseñas no coinciden.");
    if (!accepted)
      return setMessage("Debe aceptar los Términos y la Política de privacidad.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMessage(error.message);
    const activation = await supabase.rpc("v2_activate_my_membership");
    if (activation.error) return setMessage(activation.error.message);
    const consent = await supabase.rpc("v2_accept_legal", {
      version: LEGAL_VERSION,
      browser: navigator.userAgent.slice(0, 500),
    });
    if (consent.error) return setMessage(consent.error.message);
    done();
  }
  return (
    <main className="auth">
      <section className="authBrand">
        <div className="mark">M</div>
        <h1>
          {reason === "reset" ? "Recupere su acceso." : "Active su acceso."}
        </h1>
        <p>
          {reason === "reset"
            ? "Cree una nueva contraseña para MRMAA."
            : "Cree la contraseña con la que ingresará a MRMAA."}
        </p>
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
          <PasswordRequirements value={password} />
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
          <label className="legalConsent">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              Acepto los <a href="/terminos" target="_blank">Términos y condiciones</a> y la <a href="/privacidad" target="_blank">Política de privacidad</a>.
            </span>
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
          {PUBLIC_SIGNUP_ENABLED && <button className="primary" onClick={() => startTrial("intermediate")}>Registrarse</button>}
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
              onClick={login}
            >
              Iniciar sesión <ArrowRight />
            </button>
            <span>Acceso privado durante la fase de prueba</span>
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
          <span>Todo conectado</span>
          <h2>Administre la operación completa desde un solo lugar.</h2>
          <p>
            Menos hojas sueltas, menos tareas repetitivas y más claridad para
            todo su equipo.
          </p>
        </div>
        <div className="featureGrid">
          <article>
            <CalendarDays />
            <h3>Reservaciones organizadas</h3>
            <p>
              Búsqueda, filtros por fecha, menús, observaciones, anticipos,
              métodos de pago, importación, Excel e impresión.
            </p>
          </article>
          <article>
            <FileText />
            <h3>Cotizaciones profesionales</h3>
            <p>
              Diseños personalizables, logo, productos, campos configurables,
              descuentos, propina y PDF profesional.
            </p>
          </article>
          <article>
            <Users />
            <h3>Clientes sin duplicados</h3>
            <p>
              Historial conectado con reservaciones y cotizaciones, búsqueda
              rápida y protección contra registros repetidos.
            </p>
          </article>
          <article>
            <Clock3 />
            <h3>Horarios en menos tiempo</h3>
            <p>
              Calendario mensual, empleados por área, selección masiva,
              comidas, descansos, permisos y patrón automático de dos semanas.
            </p>
          </article>
          <article>
            <BarChart3 />
            <h3>Reportes útiles</h3>
            <p>
              Analice clientes frecuentes, ventas, cotizaciones pendientes,
              reservaciones y anticipos por método de pago.
            </p>
          </article>
          <article>
            <UserPlus />
            <h3>Acceso para su equipo</h3>
            <p>
              Invite colaboradores, asigne niveles de acceso y administre sus
              usuarios desde Configuración.
            </p>
          </article>
          <article>
            <Settings />
            <h3>Adaptado a su negocio</h3>
            <p>
              Configure áreas, turnos, empleados, menús, moneda, identidad
              visual y campos según su forma de trabajar.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h3>Información protegida</h3>
            <p>
              Papelera, respaldos descargables, historial de cambios y cierre
              automático de sesiones inactivas.
            </p>
          </article>
          <article>
            <FileSpreadsheet />
            <h3>Preparado para crecer</h3>
            <p>
              Listados paginados, exportaciones y herramientas pensadas para
              manejar miles de registros con orden.
            </p>
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
                onClick={() => PUBLIC_SIGNUP_ENABLED && startTrial(p.code)}
                disabled={!PUBLIC_SIGNUP_ENABLED}
              >
                {PUBLIC_SIGNUP_ENABLED ? `Probar ${p.name}` : "Registro temporalmente cerrado"}
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
        <div className="legalLinks">
          <a href="/terminos">Términos</a>
          <a href="/privacidad">Privacidad</a>
          <a href="/suscripciones">Suscripciones y reembolsos</a>
          <a href="/tratamiento-datos">Tratamiento de datos</a>
        </div>
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
    [currentMode, setCurrentMode] = useState(mode),
    [showRecovery, setShowRecovery] = useState(false),
    [captchaToken, setCaptchaToken] = useState("");
  const plan = plans.find((x) => x.code === selectedPlan)!;
  const field = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback("");
    if (!configured)
      return setFeedback("Faltan las variables de Supabase en Vercel.");
    if (currentMode === "signup" && !PUBLIC_SIGNUP_ENABLED)
      return setFeedback("El registro público está temporalmente deshabilitado. Ingrese con una cuenta existente o mediante una invitación.");
    if (currentMode === "signup" && form.password !== form.confirmPassword)
      return setFeedback("Las contraseñas no coinciden.");
    if (currentMode === "signup" && !passwordIsStrong(form.password))
      return setFeedback("Use 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.");
    if (TURNSTILE_SITE_KEY && !captchaToken)
      return setFeedback("Complete la verificación de seguridad.");
    setBusy(true);
    if (currentMode === "login") {
      const r = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
        options: { captchaToken: captchaToken || undefined },
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
          captchaToken: captchaToken || undefined,
          emailRedirectTo: CANONICAL_SITE_URL,
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
  async function resetPassword() {
    setFeedback("");
    if (!form.email.trim())
      return setFeedback(
        "Escriba su correo electrónico para recuperar la contraseña.",
      );
    if (TURNSTILE_SITE_KEY && !captchaToken)
      return setFeedback("Complete la verificación de seguridad.");
    setBusy(true);
    const recoveryUrl = new URL(CANONICAL_SITE_URL);
    recoveryUrl.searchParams.set("reset", "1");
    const { error } = await supabase.auth.resetPasswordForEmail(
      form.email.trim(),
      { redirectTo: recoveryUrl.toString(), captchaToken: captchaToken || undefined },
    );
    setBusy(false);
    setFeedback(
      error
        ? error.message
        : "Le enviamos un enlace para crear una nueva contraseña. Revise también la carpeta de correo no deseado.",
    );
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
            {showRecovery
              ? "Recupere su acceso."
              : currentMode === "signup"
              ? "Comience su prueba."
              : "Bienvenido de nuevo."}
          </h1>
          <p>
            {showRecovery
              ? "Le enviaremos un enlace seguro para crear una contraseña nueva."
              : currentMode === "signup"
              ? `Plan ${plan.name}: 10 días gratis, sin tarjeta.`
              : "Ingrese para continuar administrando su restaurante."}
          </p>
        </div>
      </section>
      <section className="accessContent">
        <form
          className="accessCard"
          onSubmit={(event) => {
            if (!showRecovery) return submit(event);
            event.preventDefault();
            void resetPassword();
          }}
        >
          <h2>
            {showRecovery
              ? "Restablecer contraseña"
              : currentMode === "signup"
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </h2>
          {showRecovery && (
            <p>
              Escriba el correo electrónico asociado con su cuenta de MRMAA.
            </p>
          )}
          {!showRecovery && currentMode === "signup" && (
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
          {!showRecovery && <label>
            Contraseña
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => field("password", e.target.value)}
            />
            {currentMode === "signup" && <small>Mínimo 8 caracteres; incluya mayúscula, minúscula, número y símbolo.</small>}
          </label>}
          {!showRecovery && currentMode === "signup" && <PasswordRequirements value={form.password} />}
          {!showRecovery && currentMode === "signup" && (
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
          {TURNSTILE_SITE_KEY && <Turnstile onToken={setCaptchaToken} />}
          {feedback && (
            <p
              className={
                feedback.startsWith("Cuenta creada") ||
                feedback.startsWith("Registro completado") ||
                feedback.startsWith("Le enviamos")
                  ? "success"
                  : "error"
              }
            >
              {feedback}
            </p>
          )}
          <button className="primary fullButton" disabled={busy}>
            {busy
              ? "Procesando…"
              : showRecovery
                ? "Enviar enlace de recuperación"
                : currentMode === "signup"
                ? "Comenzar prueba gratis"
                : "Entrar"}
          </button>
          {!showRecovery && currentMode === "login" && (
            <button
              className="link"
              type="button"
              onClick={() => {
                setShowRecovery(true);
                setFeedback("");
              }}
              disabled={busy}
            >
              ¿Olvidó su contraseña?
            </button>
          )}
          {showRecovery && (
            <button
              className="link"
              type="button"
              onClick={() => {
                setShowRecovery(false);
                setFeedback("");
              }}
              disabled={busy}
            >
              ← Volver a iniciar sesión
            </button>
          )}
          {!showRecovery && PUBLIC_SIGNUP_ENABLED && <button
              className="link"
              type="button"
              onClick={() => {
                setCurrentMode(currentMode === "login" ? "signup" : "login");
                setFeedback("");
              }}
            >
              {currentMode === "login" ? "¿No tiene cuenta? Pruebe gratis" : "¿Ya tiene cuenta? Inicie sesión"}
            </button>}
          <p className="authLegal">Al ingresar, reconoce los <a href="/terminos">Términos</a> y la <a href="/privacidad">Política de Privacidad</a> vigentes.</p>
        </form>
      </section>
    </main>
  );
}

function PasswordRequirements({ value }: { value: string }) {
  const rules = [
    [value.length >= 8, "8 caracteres o más"],
    [/[A-Z]/.test(value), "Una letra mayúscula"],
    [/[a-z]/.test(value), "Una letra minúscula"],
    [/\d/.test(value), "Un número"],
    [/[^A-Za-z0-9]/.test(value), "Un carácter especial"],
  ] as const;
  return <ul className="passwordRules" aria-label="Requisitos de contraseña">
    {rules.map(([ok, label]) => <li className={ok ? "met" : ""} key={label}>{ok ? "✓" : "○"} {label}</li>)}
  </ul>;
}

function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !container.current || !(window as any).turnstile || widgetId) return;
      widgetId = (window as any).turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "auto",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-mrmaa-turnstile]');
    if (!script) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.mrmaaTurnstile = "true";
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    } else if ((window as any).turnstile) render();
    else script.addEventListener("load", render, { once: true });
    return () => {
      cancelled = true;
      if (widgetId && (window as any).turnstile) (window as any).turnstile.remove(widgetId);
    };
  }, [onToken]);
  return <div className="turnstileWrap"><div ref={container} /></div>;
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
