"use client";

import { userMessage } from "@/lib/user-message";
import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
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
  Eye,
  EyeOff,
} from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { configured, supabase } from "@/lib/supabase";
import { ACTIVITY_KEY, remainingIdleTime } from "@/lib/session-activity";
import { Dashboard } from "@/components/dashboard";
import { SecurityCenter } from "@/components/security-center";
import { LEGAL_VERSION } from "@/components/legal-page";
import { loadTurnstile, type TurnstileApi } from "@/lib/turnstile";
import { emailLanguage } from "@/lib/email-language";
import { appCurrency, appLanguage, useAppPreferences } from "@/components/app-preferences";

type PlanCode = "basic" | "intermediate" | "advanced";

function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const { language } = useAppPreferences();
  const label = language === "en"
    ? (visible ? "Hide password" : "Show password")
    : (visible ? "Ocultar contraseña" : "Mostrar contraseña");
  return (
    <span className="passwordInputWrap">
      <input {...props} type={visible ? "text" : "password"} />
      <button type="button" className="passwordVisibility" aria-label={label}
        title={label} aria-pressed={visible} disabled={props.disabled}
        onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </span>
  );
}
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
  const accountRequest = useRef(0);
  const invitationValidation = useRef(false);
  const [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState<"landing" | "login" | "signup">("landing"),
    [selectedPlan, setSelectedPlan] = useState<PlanCode>("intermediate"),
    [needsPassword, setNeedsPassword] = useState(false),
    [passwordReason, setPasswordReason] = useState<"invite" | "reset">(
      "invite",
    ),
    [authReturnPending, setAuthReturnPending] = useState(true),
    [invitationAttempt, setInvitationAttempt] = useState(false),
    [invitationToken, setInvitationToken] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      hashParams = new URLSearchParams(window.location.hash.replace(/^#/, "")),
      invited = params.get("invite") === "1",
      invitation = params.get("invitation") || "",
      resetting = params.get("reset") === "1",
      authType = hashParams.get("type");
    if (params.get("login") === "1") setView("login");
    setInvitationAttempt(invited || authType === "invite");
    setInvitationToken(invitation);
    setNeedsPassword(resetting || authType === "recovery");
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
          setAuthReturnPending(false);
          setLoading(false);
        } else if (data.session) {
          setSession(data.session);
          if (resetting) {
            setPasswordReason("reset");
            setNeedsPassword(true);
            setAuthReturnPending(false);
            setLoading(false);
          }
          if (!invited && !resetting) setAuthReturnPending(false);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (!data.session && (invited || resetting || authType === "invite" || authType === "recovery")) {
        setMessage("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        setView("login");
        setInvitationAttempt(false);
        setNeedsPassword(false);
        setLoading(false);
      }
      setAuthReturnPending(false);
    };
    void completeAuthReturn();
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        accountRequest.current += 1;
        sessionStorage.removeItem(ACTIVITY_KEY);
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
    if (!invitationAttempt || !session || invitationValidation.current) return;
    invitationValidation.current = true;
    const validateInvitation = async () => {
      try {
        if (!invitationToken) throw new Error("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        const response = await fetch("/api/invitation", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ invitation: invitationToken }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        setPasswordReason("invite");
        setNeedsPassword(true);
        setAuthReturnPending(false);
        setLoading(false);
      } catch (error) {
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setAccount(null);
        setNeedsPassword(false);
        setInvitationAttempt(false);
        setAuthReturnPending(false);
        setView("login");
        setMessage(error instanceof Error ? error.message : "El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        history.replaceState({}, "", `${window.location.pathname}?login=1`);
        setLoading(false);
      }
    };
    void validateInvitation();
  }, [invitationAttempt, invitationToken, session]);
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    let closing = false;
    const logout = async () => {
      if (closing) return;
      closing = true;
      clearTimeout(timer);
      await supabase.auth.signOut({ scope: "local" });
      setView("login");
      setNeedsPassword(false);
      history.replaceState({}, "", `${window.location.pathname}?login=1`);
      window.scrollTo({ top: 0 });
    };
    const resetTimer = () => {
      if (closing) return;
      if (remainingIdleTime(sessionStorage.getItem(ACTIVITY_KEY)) === 0) {
        void logout();
        return;
      }
      sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      clearTimeout(timer);
      timer = setTimeout(logout, INACTIVITY_LIMIT_MS);
    };
    const verify = () => {
      if (closing) return;
      const remaining = remainingIdleTime(sessionStorage.getItem(ACTIVITY_KEY));
      if (remaining === 0) void logout();
      else { clearTimeout(timer); timer = setTimeout(logout, remaining); }
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) =>
      window.addEventListener(event, resetTimer, { passive: true }),
    );
    if (sessionStorage.getItem(ACTIVITY_KEY)) verify(); else resetTimer();
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      closing = true;
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, [session]);
  useEffect(() => {
    // Do not decide between the public landing and the private dashboard until
    // Supabase has finished restoring the persisted session. Otherwise the
    // landing can flash briefly before an authenticated account is loaded.
    if (authReturnPending) return;
    if (!session) {
      setAccount(null);
      setLoading(false);
      return;
    }
    if (needsPassword || invitationAttempt) return;
    loadAccount();
  }, [session, authReturnPending, needsPassword, invitationAttempt]);
  async function loadAccount() {
    const request = ++accountRequest.current;
    setLoading(true);
    setMessage("");
    const expectedUserId = session?.user.id;
    const verified = await supabase.auth.getUser();
    if (request !== accountRequest.current) return;
    if (
      verified.error ||
      !verified.data.user ||
      !expectedUserId ||
      verified.data.user.id !== expectedUserId
    ) {
      // getSession() can temporarily return a cached JWT after its Auth user was
      // deleted. Clear only this browser's copy before calling any database RPC.
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setAccount(null);
      setNeedsPassword(false);
      setView("login");
      setMessage("Su sesión ya no es válida. Inicie sesión nuevamente.");
      history.replaceState({}, "", `${window.location.pathname}?login=1`);
      setLoading(false);
      return;
    }
    const ensured = await supabase.rpc("v2_ensure_restaurant");
    if (request !== accountRequest.current) return;
    if (ensured.error) {
      const rejected = /acceso no autorizado|permission denied|foreign key constraint/i.test(ensured.error.message);
      if (rejected) {
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setAccount(null);
        setView("login");
        history.replaceState({}, "", `${window.location.pathname}?login=1`);
      }
      setMessage(rejected
        ? "Esta cuenta no tiene acceso activo a MRMAA. Solicite una invitación nueva al administrador."
        : userMessage(ensured.error.message));
      setLoading(false);
      return;
    }
    const membership = await supabase
      .from("v2_members")
      .select("status")
      .eq("restaurant_id", ensured.data)
      .eq("user_id", session?.user.id)
      .maybeSingle();
    if (request !== accountRequest.current) return;
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
    if (request !== accountRequest.current) return;
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
        invitationToken={invitationToken}
        done={() => {
          history.replaceState({}, "", window.location.pathname);
          setNeedsPassword(false);
          setInvitationAttempt(false);
          setInvitationToken("");
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
        initialRestaurantId={account.restaurantId}
        initialRestaurantName={account.restaurantName}
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
  invitationToken,
}: {
  done: () => void;
  reason: "invite" | "reset";
  invitationToken: string;
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
    if (reason === "invite") {
      const current = await supabase.auth.getSession();
      const accessToken = current.data.session?.access_token;
      if (!accessToken || !invitationToken)
        return setMessage("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
      const response = await fetch("/api/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ invitation: invitationToken, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        return setMessage(result.error || "No fue posible activar el acceso. Solicite una invitación nueva.");
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return setMessage(error.message);
    }
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
            <PasswordInput
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <PasswordRequirements value={password} />
          <label>
            Confirmar contraseña
            <PasswordInput
              required
              autoComplete="new-password"
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
          {message && <p className="error">{userMessage(message)}</p>}
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
  const { setPreferences } = useAppPreferences();
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
    [captchaToken, setCaptchaToken] = useState(""),
    [captchaAttempt, setCaptchaAttempt] = useState(0);
  const plan = plans.find((x) => x.code === selectedPlan)!;
  const field = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v }));
  const renewCaptcha = () => {
    setCaptchaToken("");
    setCaptchaAttempt((attempt) => attempt + 1);
  };
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
    try {
    if (currentMode === "login") {
      // Reiniciar antes de que SIGNED_IN monte el control de inactividad.
      sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
      const r = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
        options: { captchaToken: captchaToken || undefined },
      });
      if (r.error)
        setFeedback(
          accessError(r.error.message),
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
            language: emailLanguage(form.language),
            currency: form.currency,
            plan_code: selectedPlan,
          },
        },
      });
      if (r.error) setFeedback(accessError(r.error.message));
      else if (r.data.session)
        setFeedback("Registro completado. Abriendo su dashboard…");
      else if (!r.data.session)
        setFeedback(
          "Cuenta creada. Revise su correo y confirme el registro; después vuelva para iniciar sesión.",
        );
    }
    } catch {
      setFeedback("No se pudo conectar. Intente nuevamente.");
    } finally {
      // Cloudflare tokens are single-use, even when the password was incorrect.
      renewCaptcha();
      setBusy(false);
    }
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
    try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      form.email.trim(),
      { redirectTo: recoveryUrl.toString(), captchaToken: captchaToken || undefined },
    );
    setFeedback(
      error
        ? accessError(error.message)
        : "Le enviamos un enlace para crear una nueva contraseña. Revise también la carpeta de correo no deseado.",
    );
    } catch {
      setFeedback("No se pudo conectar. Intente nuevamente.");
    } finally {
      renewCaptcha();
      setBusy(false);
    }
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
                    onChange={(e) => {
                      const language = appLanguage(e.target.value);
                      field("language", language);
                      setPreferences(language, form.currency);
                    }}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  Moneda
                  <select
                    value={form.currency}
                    onChange={(e) => {
                      const currency = appCurrency(e.target.value);
                      field("currency", currency);
                      setPreferences(form.language, currency);
                    }}
                  >
                    <option value="GTQ">Quetzal (GTQ)</option>
                    <option value="USD">Dólar (USD)</option>
                    <option value="MXN">Peso mexicano (MXN)</option>
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
            <PasswordInput
              key={currentMode}
              required
              minLength={currentMode === "signup" ? 8 : undefined}
              autoComplete={currentMode === "signup" ? "new-password" : "current-password"}
              value={form.password}
              onChange={(e) => field("password", e.target.value)}
            />
            {currentMode === "signup" && <small>Mínimo 8 caracteres; incluya mayúscula, minúscula, número y símbolo.</small>}
          </label>}
          {!showRecovery && currentMode === "signup" && <PasswordRequirements value={form.password} />}
          {!showRecovery && currentMode === "signup" && (
            <label>
              Confirmar contraseña
              <PasswordInput
                autoComplete="new-password"
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
          {TURNSTILE_SITE_KEY && <Turnstile key={captchaAttempt} onToken={setCaptchaToken} />}
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
              {userMessage(feedback)}
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
                renewCaptcha();
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
                renewCaptcha();
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
                renewCaptcha();
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
  const [status, setStatus] = useState("Cargando verificación de seguridad…");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let widgetId: string | undefined;
    let api: TurnstileApi | undefined;
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let challengeTimer: ReturnType<typeof setTimeout> | undefined;
    onToken("");
    setFailed(false);
    setStatus("Cargando verificación de seguridad…");
    const fail = (message: string) => {
      if (cancelled) return;
      clearTimeout(expiryTimer);
      clearTimeout(challengeTimer);
      onToken("");
      setFailed(true);
      setStatus(message);
    };
    void loadTurnstile().then((loadedApi) => {
      if (cancelled || !container.current) return;
      api = loadedApi;
      setStatus("Complete la verificación de seguridad.");
      challengeTimer = setTimeout(() => fail("La verificación está tardando. Intente nuevamente."), 60000);
      widgetId = api.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "auto",
        language: "es",
        size: "flexible",
        callback: (token: string) => {
          if (cancelled) return;
          clearTimeout(challengeTimer);
          clearTimeout(expiryTimer);
          setFailed(false);
          setStatus("Verificación completada.");
          onToken(token);
          // Invalidate locally before the provider's five-minute expiry.
          expiryTimer = setTimeout(() => fail("La verificación venció. Vuelva a verificar."), 290000);
        },
        "expired-callback": () => fail("La verificación venció. Vuelva a verificar."),
        "timeout-callback": () => fail("La verificación agotó el tiempo. Intente nuevamente."),
        "error-callback": (code) => {
          console.warn("MRMAA Turnstile:", code);
          fail("No se pudo completar la verificación. Intente nuevamente.");
          return true;
        },
      });
    }).catch(() => fail("No se pudo cargar la verificación. Revise su conexión e intente nuevamente."));
    return () => {
      cancelled = true;
      clearTimeout(challengeTimer);
      clearTimeout(expiryTimer);
      if (widgetId !== undefined && api) api.remove(widgetId);
    };
  }, [onToken, retry]);
  return <div className="turnstileWrap">
    <div ref={container} />
    <small role="status">{status}</small>
    {failed && <button className="link" type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar verificación</button>}
  </div>;
}

function accessError(message: string) {
  if (message === "Invalid login credentials") return "Correo o contraseña incorrectos.";
  if (/captcha/i.test(message)) return "La verificación no fue aceptada. Complete la nueva verificación e intente nuevamente.";
  if (/rate.limit|too many requests|request rate/i.test(message)) return "Demasiados intentos. Espere un momento antes de volver a intentar.";
  return message;
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
