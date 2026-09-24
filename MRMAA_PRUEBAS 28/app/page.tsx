"use client";
import { siteOrigin } from "@/lib/site-origin";
import { startLandingPixel } from "@/lib/meta-pixel";
import { LandingAnalytics } from "@/components/landing-analytics";
import { confirmDiscardChanges } from "@/lib/unsaved-changes";

import { AccountAccessError, LOAD_RETRY_MESSAGE, isInvalidSessionError, readVerifiedAccount, type VerifiedAccount } from "@/lib/account-access";
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
import { configured, supabase, signOutCurrentSession } from "@/lib/supabase";
import { ACTIVITY_KEY, ACTIVITY_EVENT, IDLE_LIMIT, remainingIdleTime } from "@/lib/session-activity";
import { Dashboard } from "@/components/dashboard";
import { SecurityCenter } from "@/components/security-center";
import { LEGAL_VERSION } from "@/components/legal-page";
import { loadTurnstile, type TurnstileApi } from "@/lib/turnstile";
import { MfaSessionGate } from "@/components/mfa-settings";
import { emailLanguage } from "@/lib/email-language";
import { appCurrency, appLanguage, useAppPreferences } from "@/components/app-preferences";

import { PLANS, PUBLIC_SIGNUP_ENABLED, type PlanCode, type BillingInterval } from "@/lib/plans";
import { PlanCards } from "@/components/plan-cards";
import { BillingPanel } from "@/components/billing-panel";

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
type Account = VerifiedAccount;
const plans = PLANS;
const INACTIVITY_LIMIT_MS = IDLE_LIMIT;

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const passwordIsStrong = (value: string) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export default function Home() {
  return <MfaSessionGate><HomeContent /></MfaSessionGate>;
}

function HomeContent() {
  const accountRequest = useRef(0);
  const invitationValidation = useRef(false);
  const currentUserId = useRef<string | null>(null);
  const authRevision = useRef(0);
  const retryLoad = useRef<() => Promise<void>>(async () => {});
  const retrying = useRef(false);
  const [loadFailure, setLoadFailure] = useState(false);
  const [supportAccount, setSupportAccount] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState<"landing" | "login" | "signup">("landing"),
    [selectedPlan, setSelectedPlan] = useState<PlanCode>("intermediate"),
    [selectedInterval, setSelectedInterval] = useState<BillingInterval>("month"),
    [billingOpen, setBillingOpen] = useState(false),
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
    const supportLink = params.get("support");
    if (supportLink && /^[a-f0-9-]{36}$/i.test(supportLink)) sessionStorage.setItem("mrmaa-support-link", supportLink);
    if (params.get("login") === "1" || supportLink) setView("login");
    if (params.get("billing")) setBillingOpen(true);
    setInvitationAttempt(invited || authType === "invite");
    setInvitationToken(invitation);
    setNeedsPassword(resetting || authType === "recovery");
    if (resetting || authType === "recovery") setPasswordReason("reset");
    let cancelled = false;
    let linkActivityRecorded = false;
    const recordLinkActivity = () => {
      if (!linkActivityRecorded && (params.has("code") || hashParams.has("access_token"))) {
        sessionStorage.setItem(ACTIVITY_KEY, String(Date.now())); linkActivityRecorded = true;
      }
    };
    const completeAuthReturn = async () => {
      if (cancelled) return;
      setLoading(true);
      setLoadFailure(false);
      const revision = authRevision.current;
      try {
      // The SDK owns both implicit and PKCE callbacks. Never exchange a
      // single-use code twice (the SDK starts processing it during creation).
      const initialized = await supabase.auth.initialize();
      if (cancelled || revision !== authRevision.current) return;
      if (initialized.error) {
        const error = initialized.error;
        if (error.name === "AuthRetryableFetchError" || error.status === 0 || error.status === 429 || (error.status && error.status >= 500)) throw error;
        setMessage("El enlace ya venció o fue utilizado. Solicite uno nuevo desde Iniciar sesión.");
        setView("login"); setAuthReturnPending(false); setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      // A late restore must not replace a newer explicit login or sign-out.
      if (revision !== authRevision.current) return;
      if (data.session) recordLinkActivity();
      if (data.session && (params.has("code") || hashParams.has("access_token"))) {
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code"); clean.searchParams.delete("flow_id"); clean.hash = "";
        history.replaceState({}, "", clean.pathname + clean.search);
      }
      if (error) {
        if (!isInvalidSessionError(error)) throw error;
        setView("login");
        setMessage("Su sesión ya no es válida. Inicie sesión nuevamente.");
      }
      currentUserId.current = data.session?.user.id || null;
      setSession(data.session);
      if (!data.session || resetting || authType === "recovery") setLoading(false);
      if (!data.session && (params.has("code") || hashParams.has("error") || invited || resetting || authType === "invite" || authType === "recovery")) {
        setMessage("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        setView("login");
        setInvitationAttempt(false);
        setNeedsPassword(false);
        setLoading(false);
      }
      setAuthReturnPending(false);
      } catch {
        if (cancelled || revision !== authRevision.current) return;
        retryLoad.current = completeAuthReturn;
        setMessage(LOAD_RETRY_MESSAGE);
        setLoadFailure(true);
        setLoading(false);
      }
    };
    void completeAuthReturn();
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        authRevision.current++;
        accountRequest.current += 1;
        currentUserId.current = null;
        invitationValidation.current = false;
        setLoadFailure(false);
        setLoading(false);
        setAuthReturnPending(false);
        setInvitationAttempt(false);
        sessionStorage.removeItem(ACTIVITY_KEY);
        setSession(null);
        setAccount(null);
        setNeedsPassword(false);
        setView("login");
        history.replaceState({}, "", `${window.location.pathname}?login=1`);
        window.scrollTo({ top: 0 });
      }
      if (event === "PASSWORD_RECOVERY") {
        authRevision.current++;
        setAuthReturnPending(false); setLoading(false);
        currentUserId.current = s?.user.id || null;
        setSession(s);
        setPasswordReason("reset");
        setNeedsPassword(true);
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        authRevision.current++;
        if (s) recordLinkActivity();
        setAuthReturnPending(false);
        if (s && currentUserId.current !== s.user.id) setLoading(true);
        if (s && currentUserId.current !== s.user.id) {
          currentUserId.current = s.user.id;
          accountRequest.current++;
          setAccount(null);
          setLoadFailure(false);
        }
        setSession((current) => current?.user.id === s?.user.id ? current : s);
      }
    });
    return () => { cancelled = true; accountRequest.current++; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!invitationAttempt || !session || invitationValidation.current) return;
    invitationValidation.current = true;
    const validateInvitation = async () => {
      setLoading(true);
      setLoadFailure(false);
      try {
        if (!invitationToken) throw new Error("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        const current = await supabase.auth.getSession();
        if (current.error) {
          if (isInvalidSessionError(current.error)) throw new Error("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
          throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
        }
        if (!current.data.session) throw new Error("El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        const response = await fetch("/api/invitation", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.data.session.access_token}` },
          body: JSON.stringify({ invitation: invitationToken }),
        });
        const result = await response.json().catch(() => ({}));
        if (currentUserId.current !== session.user.id) return;
        if (response.status >= 500 || response.status === 429 || response.status === 408) throw new AccountAccessError("retry", LOAD_RETRY_MESSAGE);
        if (!response.ok) throw new Error(result.error || "El enlace ya venció o fue utilizado. Solicite uno nuevo.");
        setPasswordReason("invite");
        setNeedsPassword(true);
        setAuthReturnPending(false);
        setLoading(false);
      } catch (error) {
        if (currentUserId.current !== session.user.id) return;
        if ((error instanceof AccountAccessError && error.kind === "retry") || error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
          retryLoad.current = validateInvitation;
          setMessage(LOAD_RETRY_MESSAGE);
          setLoadFailure(true);
          setLoading(false);
          return;
        }
        await signOutCurrentSession();
        setSession(null);
        setAccount(null);
        setNeedsPassword(false);
        setInvitationAttempt(false);
        setAuthReturnPending(false);
        setView("login");
        setMessage(error instanceof Error ? userMessage(error) : "El enlace ya venció o fue utilizado. Solicite uno nuevo.");
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
      await signOutCurrentSession();
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
      window.dispatchEvent(new Event(ACTIVITY_EVENT));
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
      setSupportAccount(false);
      setLoading(false);
      return;
    }
    if (needsPassword || invitationAttempt) return;
    loadAccount();
  }, [session, authReturnPending, needsPassword, invitationAttempt]);
  async function loadAccount() {
    const request = ++accountRequest.current;
    setLoading(!account);
    setLoadFailure(false);
    setMessage("");
    try {
      const support = await supabase.rpc("v2_is_support_agent");
      if (support.error) throw new Error(LOAD_RETRY_MESSAGE);
      if (request !== accountRequest.current) return;
      setSupportAccount(support.data === true);
      if (support.data === true) { setAccount(null); return; }
      let verifiedAccount: Account | undefined;
      let lastError: unknown;
      // Confirmation links can restore Auth a moment before every dependent
      // service is ready. Retry briefly instead of flashing the landing page or
      // forcing the user to submit the login form twice.
      for (const delay of [0, 300, 700, 1400]) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (request !== accountRequest.current) return;
        try { verifiedAccount = await readVerifiedAccount(supabase, session?.user.id || ""); break; }
        catch (error) { lastError = error; }
      }
      if (!verifiedAccount) throw lastError;
      if (request !== accountRequest.current) return;
      setAccount(verifiedAccount);
    } catch (error) {
      if (request !== accountRequest.current) return;
      if (error instanceof AccountAccessError && error.kind !== "retry") {
        await signOutCurrentSession();
        setSession(null);
        setAccount(null);
        setNeedsPassword(false);
        setView("login");
        setMessage(userMessage(error));
        history.replaceState({}, "", `${window.location.pathname}?login=1`);
      } else {
        retryLoad.current = loadAccount;
        setMessage(LOAD_RETRY_MESSAGE);
        setLoadFailure(true);
      }
    } finally {
      if (request === accountRequest.current) setLoading(false);
    }
  }
  async function retryFailedLoad() {
    if (retrying.current) return;
    retrying.current = true;
    try { await retryLoad.current(); }
    finally { retrying.current = false; }
  }
  useEffect(() => {
    if (!loadFailure) return;
    const retry = () => { void retryFailedLoad(); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [loadFailure]);
  useEffect(() => {
    if (!session || !account) return;
    let lastRefresh = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      // A known unpaid trial deadline closes cached business screens even if the
      // verification request is interrupted. Only a fresh server result reopens it.
      if (account.billingEnforcementEnabled && !account.trialExempt && !account.paidUntil && Date.parse(account.trialEndsAt) <= Date.now())
        setAccount(current => current && !current.trialExempt && !current.paidUntil && Date.parse(current.trialEndsAt) <= Date.now() ? { ...current, canWrite: false } : current);
      if (Date.now() - lastRefresh > 15000) { lastRefresh = Date.now(); void loadAccount(); }
    };
    const paymentRefresh = () => { void loadAccount(); };
    window.addEventListener("mrmaa:billing-updated", paymentRefresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const deadlines = [account.trialEndsAt, account.paidUntil, account.graceEndsAt].filter(Boolean).map(value => new Date(value!).getTime()).filter(value => value > Date.now());
    const delay = Math.min(2147480000, Math.max(1000, Math.max(...deadlines) - Date.now() + 1000));
    const timer = !account.trialExempt && account.canWrite && deadlines.length ? setTimeout(() => { lastRefresh = 0; refresh(); }, delay) : undefined;
    return () => { window.removeEventListener("mrmaa:billing-updated", paymentRefresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); if (timer) clearTimeout(timer); };
  }, [session?.user.id, account]);
  function startTrial(plan: PlanCode, interval: BillingInterval = "month") {
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setView(PUBLIC_SIGNUP_ENABLED ? "signup" : "login");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (loading || (authReturnPending && !loadFailure))
    return (
      <main className="center">
        <div role="status" aria-live="polite"><div className="loader" /><p>Validando acceso. Un momento…</p></div>
      </main>
    );
  if (loadFailure && !account) return (
    <main className="center"><section className="moduleCard loadRetryPanel" role="alert">
      <h1>No se pudo completar la carga</h1>
      <p>{userMessage(message)}</p>
      <button type="button" className="primary" onClick={() => void retryFailedLoad()}>Reintentar</button>
    </section></main>
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
  if (session && supportAccount) return <SupportWorkspace session={session} />;
  if (session && account) {
    if (billingOpen) return <main className="billingPage"><button type="button" className="secondary" onClick={() => { setBillingOpen(false); history.replaceState({}, "", window.location.pathname); void loadAccount(); }}>← Volver al dashboard</button><BillingPanel restaurantId={account.restaurantId} /></main>;
    if (!account.canWrite) return <RestrictedAccount account={account} />;
    return (
      <>
      {!account.trialExempt && account.cancelAtPeriodEnd && account.paidUntil && <ExpiryBanner endsAt={account.paidUntil} canManage={account.isOwner} onManage={() => setBillingOpen(true)} />}
      {!account.trialExempt && account.subscriptionStatus === "trialing" && <TrialBanner endsAt={account.trialEndsAt} canManage={account.isOwner} onManage={() => setBillingOpen(true)} />}
      {loadFailure && <div className="moduleNotice" role="alert">{userMessage(message)} <button type="button" className="secondary" onClick={() => void retryFailedLoad()}>Reintentar</button></div>}
      <Dashboard
        key={session.user.id}
        session={session}
        trialEndsAt={account.trialEndsAt}
        planCode={account.planCode}
        initialRestaurantId={account.restaurantId}
        initialRestaurantName={account.restaurantName}
      />
      </>
    );
  }
  if (session) return <main className="center"><div className="loader" /></main>;
  if (view !== "landing")
    return (
      <AccessForm
        mode={view}
        selectedPlan={selectedPlan}
        selectedInterval={selectedInterval}
        message={message}
        signedIn={(next) => {
          authRevision.current++; currentUserId.current = next.user.id;
          setAuthReturnPending(false); setLoading(true); setLoadFailure(false);
          setSession(current => current === next ? { ...next } : next);
        }}
        back={() => setView("landing")}
      />
    );
  return <Landing startTrial={startTrial} login={() => setView("login")} />;
}

function ExpiryBanner({ endsAt, canManage, onManage }: { endsAt: string; canManage: boolean; onManage: () => void }) {
  const { language } = useAppPreferences(), en = language === "en";
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const remaining = Date.parse(endsAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 7 * 86400000) return null;
  const days = Math.ceil(remaining / 86400000);
  const date = new Intl.DateTimeFormat(en ? "en-US" : "es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(endsAt));
  return <div className={`trialBanner ${days <= 3 ? "urgent" : ""}`} role="status" translate="no"><span><strong>{en ? `Subscription ends in ${days} day(s) · ${date}` : `Su suscripción vence en ${days} día(s) · ${date}`}</strong><small>{en ? "Renewal is canceled. Reactivate it to keep access to your restaurant modules." : "La renovación está cancelada. Reactívela para conservar el acceso a los módulos del restaurante."}{!canManage && (en ? " Contact your administrator." : " Contacte al administrador principal.")}</small></span>{canManage && <button type="button" onClick={onManage}>{en ? "Manage subscription" : "Gestionar suscripción"}</button>}</div>;
}

function TrialBanner({ endsAt, canManage, onManage }: { endsAt: string; canManage: boolean; onManage: () => void }) {
  const { language } = useAppPreferences(), en = language === "en";
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const minutes = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 60000));
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60);
  const remaining = en ? `${days}d ${hours}h ${minutes % 60}m` : `${days}d ${hours}h ${minutes % 60}min`;
  return <div className={`trialBanner ${minutes <= 2880 ? "urgent" : ""}`} translate="no"><span><strong>{en ? `10-day free trial · ${remaining} left` : `Prueba de 10 días · Quedan ${remaining}`}</strong><small>{canManage ? (en ? "Choose a plan to keep access when your trial ends." : "Elija un plan para mantener el acceso al terminar su prueba.") : (en ? "Ask your restaurant owner to activate a plan before the trial ends." : "Pida al administrador principal activar un plan antes del vencimiento.")}</small></span>{canManage && <button type="button" onClick={onManage}>{en ? (minutes <= 2880 ? "Activate a plan" : "Choose a plan") : (minutes <= 2880 ? "Activar plan" : "Elegir plan")}</button>}</div>;
}

function RestrictedAccount({ account }: { account: Account }) {
  const { language } = useAppPreferences(), en = language === "en";
  const trialExpired = !account.paidUntil && !account.trialExempt && !account.canWrite;
  const exportExpired = account.exportUntil && new Date(account.exportUntil).getTime() < Date.now();
  return (
    <main className="expired">
      <section style={{ maxWidth: 920 }}>
        <span className="mark">M</span>
        <span className="heroTag">Acceso restringido</span>
        <h1 translate="no">{trialExpired ? (en ? "Your free trial has ended" : "Su prueba gratuita terminó") : (en ? "Your account is restricted" : "Su cuenta tiene acceso restringido")}</h1>
        <p translate="no">{en ? "Activate a plan to regain access. Payment must be confirmed before your account is reactivated." : "Active un plan para recuperar el acceso. La cuenta se reactiva cuando se confirma el pago."}</p>
        {!account.isOwner && <p translate="no">{en ? "Contact your restaurant’s main administrator to activate a plan." : "Contacte al administrador principal de su restaurante para activar un plan."}</p>}
        {account.deletionScheduledAt && <p role="alert">Si no reactiva la suscripción, los datos de este restaurante se eliminarán el {new Intl.DateTimeFormat("es-GT", { dateStyle: "long" }).format(new Date(account.deletionScheduledAt))}.</p>}
        {account.isOwner && <BillingPanel restaurantId={account.restaurantId} />}
        {!trialExpired && (!exportExpired ? <SecurityCenter restaurantId={account.restaurantId} exportOnly /> : <p>El periodo disponible para descargar información terminó. Contacte a soporte.</p>)}
        <button className="link" onClick={() => signOutCurrentSession()}>Cerrar sesión</button>
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
    if (reason === "reset") {
      await signOutCurrentSession();
      window.location.assign("/?login=1");
      return;
    }
    const consent = await supabase.rpc("v2_accept_legal", {
      version: LEGAL_VERSION,
      browser: navigator.userAgent.slice(0, 500),
    });
    if (consent.error) return setMessage(userMessage(consent.error));
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

function Landing({ startTrial, login }: { startTrial: (p: PlanCode, interval?: BillingInterval) => void; login: () => void }) {
  useEffect(() => startLandingPixel(), []);
  const [preview, setPreview] = useState(0);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const { language, currency, setPreferences } = useAppPreferences();
  const en = language === "en";
  const copy = (es: string, english: string) => en ? english : es;
  const features = [
    [ShieldCheck, copy("Ayuda cuando la necesita", "Help when you need it"), copy("Tutorial paso a paso sin límite y asistente de IA en español e inglés para explicar cómo usar MRMAA. 50 consultas al mes compartidas por restaurante.", "Unlimited step-by-step tutorial and an AI assistant in Spanish and English to explain how to use MRMAA. 50 questions per month shared by each restaurant."), copy("Todos los planes", "All plans")],
    [CalendarDays, copy("Reservaciones en orden", "Reservations in order"), copy("Busque por cliente, fecha y área. Registre invitados, anticipos y métodos de pago, y revise avisos de coincidencia de área y horario.", "Search by customer, date and area. Track guests, deposits and payment methods, and review area and time overlap alerts."), "Basic +"],
    [FileText, copy("De cotización a reserva", "From quote to reservation"), copy("Busque productos y áreas mientras escribe. Agregue o quite líneas, calcule descuentos y propina, personalice el diseño y descargue el PDF en A4.", "Search products and areas as you type. Add or remove lines, calculate discounts and tips, customize your layout and download an A4 PDF."), "Basic +"],
    [Clock3, copy("Seguimiento a tiempo", "Timely follow-up"), copy("Avisos 5 días antes del evento, con cliente y fecha. Quite o restaure cada aviso. Identifique cotizaciones por contactar y fechas pasadas sin confirmar.", "Reminders 5 days before the event, with customer and date. Dismiss or restore each reminder. Identify quotes to follow up and past dates without confirmation."), "Basic +"],
    [Users, copy("Clientes conectados", "Connected customer records"), copy("Importe clientes desde Excel con una plantilla y revisión de duplicados. Busque, edite y vincule sus datos con cotizaciones y reservaciones.", "Import customers from Excel with a template and duplicate review. Search, edit and link their details to quotes and reservations."), "Basic +"],
    [Clock3, copy("Horarios claros para el equipo", "Clear team schedules"), copy("Empleados y turnos por área, asignación por fechas, descansos, permisos y comidas. Colores claros a elección, copia de horarios y descarga PDF e impresión A4 por rango.", "Employees and shifts by area, date-based assignments, days off, leave and meal breaks. Choose light colors, copy schedules, download PDFs and print a date range on A4."), "Intermediate +"],
    [BarChart3, copy("Resultados para decidir", "Results to guide decisions"), copy("Reportes de conversión, valor de cotizaciones aprobadas, anticipos, saldos, clientes frecuentes y horas programadas. Filtre, compare y exporte.", "Reports on conversion, approved quote value, deposits, balances, frequent customers and scheduled hours. Filter, compare and export."), "Advanced"],
    [UserPlus, copy("Cada persona, su acceso", "The right access for each person"), copy("Hasta 1, 5 o 15 usuarios según el plan. Asigne roles y controle las descargas de Excel del equipo. Cada usuario puede activar la verificación en dos pasos.", "Up to 1, 5 or 15 users depending on your plan. Assign roles and control team Excel downloads. Each user can enable two-step verification."), copy("Según plan", "By plan")],
    [ShieldCheck, copy("Datos privados por restaurante", "Private data for each restaurant"), copy("Acceso según permisos y datos separados por negocio. Sus datos personales y operativos no se venden ni se utilizan para publicidad de terceros.", "Permission-based access and data separated by business. Your personal and operational data is not sold or used for third-party advertising."), copy("Todos los planes", "All plans")],
  ] as const;
  const faqs = [
    [copy("¿Qué incluye la prueba?", "What does the trial include?"), copy("10 días sin tarjeta para probar el plan elegido. Después necesita una suscripción para continuar con el acceso de pago.", "10 days without a card to try your selected plan. A subscription is then required to continue paid access.")],
    [copy("¿Qué cambia entre los planes?", "How do plans differ?"), copy("Basic incluye clientes, reservaciones y cotizaciones para 1 usuario. Intermediate añade empleados y horarios para hasta 5 usuarios. Advanced añade reportes completos y amplía el equipo a 15.", "Basic includes customers, reservations and quotes for 1 user. Intermediate adds employees and schedules for up to 5 users. Advanced adds full reports and expands the team to 15.")],
    [copy("¿Puedo usarlo en mi teléfono?", "Can I use it on my phone?"), copy("Sí, desde el navegador del teléfono, tableta o computadora. No necesita instalar una aplicación para comenzar.", "Yes, in your phone, tablet or computer browser. No app installation is needed to get started.")],
    [copy("¿Cómo aprendo a usarlo?", "How do I learn to use it?"), copy("El tutorial dentro de MRMAA tiene un índice por temas, instrucciones paso a paso y consejos para evitar errores. Puede volver a abrirlo cuando lo necesite.", "The tutorial inside MRMAA includes a topic index, step-by-step instructions and tips to avoid mistakes. Reopen it whenever you need.")],
    [copy("¿El aviso contacta al cliente automáticamente?", "Does a reminder contact the customer automatically?"), copy("No. El aviso aparece dentro de Cotizaciones para que su equipo haga el seguimiento. Quitar el aviso no elimina la cotización.", "No. It appears inside Quotes so your team can follow up. Dismissing the reminder does not delete the quote.")],
    [copy("¿Cómo recibo ayuda?", "How do I get help?"), copy("Use el tutorial y el instructivo dentro de la aplicación o escriba al correo de soporte. La atención se realiza por email.", "Use the in-app tutorial and guide, or contact support by email.")],
  ];
  return <main className="landing" translate="no">
    <LandingAnalytics />
    <nav className="landingNav"><a className="landingLogo" href="#top"><span className="mark">M</span><strong>MRMAA</strong></a>
      <div><a href="#funciones">{copy("Funciones", "Features")}</a><a href="#planes">{copy("Planes", "Plans")}</a>
      <select aria-label={copy("Idioma", "Language")} value={language} onChange={e => setPreferences(e.target.value, currency)}><option value="es">Español</option><option value="en">English</option></select>
      <div className="landingAuthActions">
        <button type="button" className="secondary" onClick={login}>{copy("Iniciar sesión", "Sign in")}</button>
        {PUBLIC_SIGNUP_ENABLED && <button type="button" className="primary" onClick={() => startTrial("intermediate", interval)}>{copy("Registrarse", "Sign up")}</button>}
      </div></div></nav>
    <section className="hero" id="top"><div><span className="heroTag">{copy("Administración para restaurantes", "Restaurant management")}</span>
      <h1>{copy("Menos administración.", "Less admin.")}<br/><em>{copy("Más tiempo para sus clientes.", "More time for your guests.")}</em></h1>
      <p>{copy("Conecte clientes, cotizaciones, reservaciones y horarios. Desde la primera consulta hasta la organización de su equipo, todo en un solo lugar.", "Connect customers, quotes, reservations and schedules. From the first inquiry to team planning, keep everything in one place.")}</p>
      <div className="heroActions"><button className="primary" onClick={() => PUBLIC_SIGNUP_ENABLED ? startTrial("intermediate") : login()}>{copy(PUBLIC_SIGNUP_ENABLED ? "Pruebe gratis 10 días" : "Iniciar sesión", PUBLIC_SIGNUP_ENABLED ? "Try free for 10 days" : "Sign in")}<ArrowRight/></button><a className="landingSecondary" href="#funciones">{copy("Explore las funciones", "Explore the features")}</a></div></div>
      <div className="heroPanel landingPreview"><div className="miniTop"><b>MRMAA</b><span>{copy("Vista de ejemplo", "Example preview")}</span></div>
        <div className="previewTabs" role="group" aria-label={copy("Explorar funciones", "Explore features")}>
          {[copy("Cotizaciones", "Quotes"), copy("Reservaciones", "Reservations"), copy("Horarios", "Schedules")].map((label, i) => <button type="button" aria-pressed={preview === i} className={preview === i ? "selected" : ""} onClick={() => setPreview(i)} key={i}>{label}</button>)}
        </div>
        <div className="previewContent" aria-live="polite">
          <span className="previewEyebrow">{copy("Su próximo evento, en orden", "Your next event, organized")}</span>
          <h2>{[copy("Cena de aniversario", "Anniversary dinner"), copy("Una reserva lista para recibir", "Ready to welcome your guests"), copy("Un equipo bien organizado", "A well-organized team")][preview]}</h2>
          <p>{copy("Terraza · 24 invitados", "Terrace · 24 guests")}</p>
          {preview === 0 ? <><div className="previewNotice"><Clock3 size={18}/><span>{copy("Contactar · Faltan 5 días", "Follow up · In 5 days")}</span></div><div className="previewLine"><span>{copy("Menú de celebración", "Celebration menu")}</span><strong>24 × $35</strong></div><div className="previewLine"><span>{copy("Subtotal de ejemplo", "Example subtotal")}</span><strong>$840</strong></div></> : preview === 1 ? <><div className="previewNotice confirmed"><Check size={18}/>{copy("Confirmada", "Confirmed")}</div><div className="previewLine"><span>{copy("Hora de llegada", "Arrival time")}</span><strong>19:00</strong></div><div className="previewLine"><span>{copy("Anticipo registrado", "Deposit recorded")}</span><strong>$336</strong></div></> : <div className="previewSchedule">{[["Ana", "16:00–22:00"], ["Luis", "16:00–22:00"], ["Sofía", copy("Descanso", "Day off")]].map(([name, shift], i) => <div key={name}><strong>{name}</strong><span className={i === 2 ? "dayOff" : ""}>{shift}</span></div>)}</div>}
          <div className="previewCaption"><ShieldCheck size={17}/>{[copy("Productos, seguimiento y PDF en un solo lugar.", "Products, follow-up and PDFs in one place."), copy("Cliente, área y anticipo conectados al evento.", "Customer, area and deposit linked to the event."), copy("Colores claros. Descarga PDF e impresión A4.", "Light colors. PDF downloads and A4 printing.")][preview]}</div>
        </div>
      </div></section>
    <div className="landingBenefits">{[copy("10 días de prueba sin tarjeta", "10-day trial, no card required"), copy("Español e inglés", "Spanish and English"), copy("Tutorial y asistente IA", "Tutorial and AI assistant")].map(text => <span key={text}><Check size={18}/>{text}</span>)}</div>
    <section className="featuresSection" id="funciones"><div className="sectionIntro"><span>{copy("Herramientas que trabajan juntas", "Tools that work together")}</span><h2>{copy("Menos tareas sueltas. Más claridad.", "Fewer scattered tasks. More clarity.")}</h2></div>
      <div className="featureGrid">{features.map(([Icon,title,body,plan]) => <article key={title}><Icon/><small className="landingPlanLabel">{plan}</small><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="plansSection" id="planes"><div className="sectionIntro"><span>{copy("Planes simples", "Simple plans")}</span><h2>{copy("Elija lo que necesita hoy.", "Choose what you need today.")}</h2><p>{copy("Precios en USD. El pago anual cubre 12 meses por el precio de 10 mensualidades.", "Prices in USD. Annual billing covers 12 months for the price of 10 monthly payments.")}</p></div>
      <PlanCards interval={interval} onInterval={setInterval} onChoose={plan => PUBLIC_SIGNUP_ENABLED && startTrial(plan, interval)} signup busy={!PUBLIC_SIGNUP_ENABLED}/></section>
    <section className="featuresSection landingFaq"><div className="sectionIntro"><span>{copy("Antes de comenzar", "Before you start")}</span><h2>{copy("Respuestas claras.", "Clear answers.")}</h2></div>{faqs.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <section className="landingFinal"><span className="heroTag">{copy("Su próximo evento empieza aquí", "Your next event starts here")}</span><h2>{copy("Todo conectado. Su equipo preparado.", "Everything connected. Your team ready.")}</h2><p>{copy("Empiece con el inicio rápido y encuentre el plan que se adapta a su restaurante.", "Start with quick setup and find the plan that fits your restaurant.")}</p><button className="primary" onClick={() => PUBLIC_SIGNUP_ENABLED ? startTrial("intermediate") : login()}>{copy(PUBLIC_SIGNUP_ENABLED ? "Comenzar mi prueba" : "Iniciar sesión", PUBLIC_SIGNUP_ENABLED ? "Start my free trial" : "Sign in")}<ArrowRight/></button></section>
    <footer className="landingFooter"><div className="landingLogo"><span className="mark">M</span><strong>MRMAA</strong></div><p>Modern Restaurant Management & Administrative Automation</p><a href="mailto:support@mrmaa.com">support@mrmaa.com</a><div className="legalLinks"><a href="/terminos">{copy("Términos", "Terms")}</a><a href="/privacidad">{copy("Privacidad", "Privacy")}</a><a href="/suscripciones">{copy("Suscripciones y reembolsos", "Subscriptions and refunds")}</a><a href="/tratamiento-datos">{copy("Tratamiento de datos", "Data processing")}</a></div></footer>
  </main>;
}

function AccessForm({
  mode,
  selectedPlan,
  selectedInterval,
  message,
  signedIn,
  back,
}: {
  mode: "login" | "signup";
  selectedPlan: PlanCode;
  selectedInterval: BillingInterval;
  message: string;
  signedIn: (session: Session) => void;
  back: () => void;
}) {
  const { setPreferences, t } = useAppPreferences();
  const submitting = useRef(false);
  const accessHeading = useRef<HTMLHeadingElement>(null);
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
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(message),
    [feedbackKind, setFeedbackKind] = useState<"error" | "success" | "info">("error"),
    [currentMode, setCurrentMode] = useState(mode),
    [signupPlan, setSignupPlan] = useState<PlanCode>(selectedPlan),
    [signupInterval, setSignupInterval] = useState<BillingInterval>(selectedInterval),
    [showRecovery, setShowRecovery] = useState(false),
    [captchaToken, setCaptchaToken] = useState(""),
    [captchaAttempt, setCaptchaAttempt] = useState(0);
  useEffect(() => {
    if (feedbackKind === "success" && currentMode === "login" && !showRecovery) {
      accessHeading.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [feedbackKind, currentMode, showRecovery]);
  const plan = plans.find((x) => x.code === signupPlan)!;
  const field = (k: string, v: string) => setForm((o) => ({ ...o, [k]: v }));
  const renewCaptcha = () => {
    setCaptchaToken("");
    setCaptchaAttempt((attempt) => attempt + 1);
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setFeedback("");
    setFeedbackKind("error");
    if (!configured)
      return setFeedback("Faltan las variables de Supabase en Vercel.");
    if (currentMode === "signup" && !PUBLIC_SIGNUP_ENABLED)
      return setFeedback("El registro público está temporalmente deshabilitado. Ingrese con una cuenta existente o mediante una invitación.");
    if (currentMode === "signup" && form.password !== form.confirmPassword)
      return setFeedback("Las contraseñas no coinciden.");
    if (currentMode === "signup" && !passwordIsStrong(form.password))
      return setFeedback("Use 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.");
    if (currentMode === "signup" && !accepted) return setFeedback("Debe aceptar los Términos y la Política de privacidad.");
    if (TURNSTILE_SITE_KEY && !captchaToken)
      return setFeedback("Complete la verificación de seguridad.");
    submitting.current = true;
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
      else if (r.data.session) signedIn(r.data.session);
    } else {
      const response = await fetch("/api/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password, captchaToken: captchaToken || undefined,
          full_name: form.name.trim(), restaurant_name: form.restaurant.trim(), phone: form.phone.trim(), country: form.country,
          language: emailLanguage(form.language), currency: form.currency, plan_code: signupPlan, billing_cycle: signupInterval, accepted }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (result.code === "REGISTRATION_IN_PROGRESS") setFeedbackKind("info");
        setFeedback(result.error || "No se pudo crear la cuenta. Intente nuevamente.");
      } else {
        setCurrentMode("login");
        setShowRecovery(false);
        setAccepted(false);
        setForm((current) => ({ ...current, email: current.email.trim(), password: "", confirmPassword: "" }));
        setFeedbackKind("success");
        setFeedback(result.requiresEmailConfirmation === false || result.session
          ? "Registro exitoso. Ya puede iniciar sesión con su correo y contraseña."
          : "Registro exitoso. Confirme su cuenta con el enlace enviado a su correo electrónico antes de iniciar sesión. Revise también la carpeta de correo no deseado.");
        try { history.replaceState({}, "", `${window.location.pathname}?login=1`); } catch {}
      }
    }
    } catch {
      setFeedbackKind("error");
      setFeedback("No se pudo conectar. Intente nuevamente.");
    } finally {
      // Cloudflare tokens are single-use, even when the password was incorrect.
      renewCaptcha();
      submitting.current = false;
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (submitting.current) return;
    setFeedback("");
    setFeedbackKind("error");
    if (!form.email.trim())
      return setFeedback(
        "Escriba su correo electrónico para recuperar la contraseña.",
      );
    if (TURNSTILE_SITE_KEY && !captchaToken)
      return setFeedback("Complete la verificación de seguridad.");
    submitting.current = true;
    setBusy(true);
    const recoveryUrl = new URL(siteOrigin());
    recoveryUrl.searchParams.set("reset", "1");
    try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      form.email.trim(),
      { redirectTo: recoveryUrl.toString(), captchaToken: captchaToken || undefined },
    );
    setFeedbackKind(error ? "error" : "success");
    setFeedback(
      error
        ? accessError(error.message)
        : "Le enviamos un enlace para crear una nueva contraseña. Revise también la carpeta de correo no deseado.",
    );
    } catch {
      setFeedbackKind("error");
      setFeedback("No se pudo conectar. Intente nuevamente.");
    } finally {
      renewCaptcha();
      submitting.current = false;
      setBusy(false);
    }
  }
  const feedbackNotice = feedback && (
    <p className={feedbackKind === "info" ? "accessNotice" : feedbackKind}
      role={feedbackKind === "error" ? "alert" : "status"} translate="no">
      {t(userMessage(feedback))}
    </p>
  );
  return (
    <main className="accessPage">
      <section className="accessAside">
        <button className="backLink" onClick={back} disabled={busy}>
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
          <h2 ref={accessHeading} tabIndex={-1}>
            {showRecovery
              ? "Restablecer contraseña"
              : currentMode === "signup"
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </h2>
          {feedbackKind === "success" && feedbackNotice}
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
              <div className="signupPlanControls">
                <label>
                  Plan
                  <select value={signupPlan} onChange={(event) => setSignupPlan(event.target.value as PlanCode)}>
                    {plans.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                  </select>
                </label>
                <label>
                  Modalidad de pago
                  <select value={signupInterval} onChange={(event) => setSignupInterval(event.target.value as BillingInterval)}>
                    <option value="month">Mensual</option>
                    <option value="year">Anual · 2 meses gratis</option>
                  </select>
                </label>
              </div>
              <div className="chosenPlan">
                <span>Plan seleccionado</span>
                <strong>
                  {plan.name} · US${signupInterval === "year" ? plan.annual : plan.monthly} {signupInterval === "year" ? "/ año" : "/ mes"}
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
          {!showRecovery && currentMode === "signup" && <label className="legalConsent"><input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} /><span>Acepto los <a href="/terminos" target="_blank" rel="noreferrer">Términos</a> y la <a href="/privacidad" target="_blank" rel="noreferrer">Política de privacidad</a>.</span></label>}
          {TURNSTILE_SITE_KEY && <Turnstile key={captchaAttempt} onToken={setCaptchaToken} />}
          {feedbackKind !== "success" && feedbackNotice}
          <button className="primary fullButton" disabled={busy} translate="no">
            {t(busy
              ? "Procesando…"
              : showRecovery
                ? "Enviar enlace de recuperación"
                : currentMode === "signup"
                ? "Comenzar prueba gratis"
                : "Entrar")}
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
              disabled={busy}
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
  const { language } = useAppPreferences();
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
        language,
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
  }, [onToken, retry, language]);
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
  // Anything not recognized above falls through to the same technical-message
  // filter used everywhere else, instead of handing the raw Auth/Postgres
  // text straight to whoever is looking at the login screen.
  return userMessage(message);
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
        <button className="link" onClick={() => signOutCurrentSession()}>
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}

function SupportWorkspace({ session }: { session: Session }) {
  const { language } = useAppPreferences(), en = language === 'en';
  const copy = (es: string, english: string) => en ? english : es;
  const [rows, setRows] = useState<any[]>([]), [selected, setSelected] = useState<any>(null);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [query, setQuery] = useState('');
  const generation = useRef(0), autoOpened = useRef(false);
  const exit = () => { generation.current++; setSelected(null); history.replaceState({}, '', '/?login=1'); sessionStorage.removeItem('mrmaa-support-link'); };
  async function load(older = false) {
    setBusy(true);
    const result = await supabase.rpc('v2_support_requests', { p_restaurant: null, p_before: older ? rows.at(-1)?.id : null });
    if (result.error) setNotice(copy('No se pudieron cargar las solicitudes.', 'Could not load support requests.'));
    else setRows(previous => older ? [...previous, ...result.data] : result.data);
    setBusy(false);
  }
  async function notifyResolved(id: string) {
    const current = await supabase.auth.getSession();
    const response = await fetch('/api/security/email', {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${current.data.session?.access_token || ''}`},body:JSON.stringify({action:'support_resolved_notify',id,language})});
    if (!response.ok) throw new Error('EMAIL');
  }
  async function resolveRequest(id: string) {
    if (busy || !confirmDiscardChanges()) return;
    const note = window.prompt(copy('Describa la solución (5–2000 caracteres). Se notificará al administrador y finalizará su acceso.', 'Describe the solution (5–2000 characters). The administrator will be notified and your access will end.'));
    if (note === null) return;
    if (note.trim().length < 5 || note.trim().length > 2000) { window.alert(copy('Escriba entre 5 y 2000 caracteres.', 'Enter 5 to 2000 characters.')); return; }
    setBusy(true);
    try {
      const result = await supabase.rpc('v2_support_resolve',{p_id:id,p_note:note.trim()});
      if(result.error) throw result.error;
      exit();
      try { await notifyResolved(id); setNotice(copy('Solicitud resuelta. Aviso enviado por correo.', 'Request resolved. Email notification sent.')); }
      catch { setNotice(copy('Solicitud resuelta y visible en el historial del restaurante. Falló el correo; puede reintentarlo.', 'Request resolved and visible in the restaurant history. Email failed; you can retry it.')); }
      await load();
    } catch { setNotice(copy('No se pudo resolver. Actualice y compruebe que el permiso siga vigente.', 'Could not resolve. Refresh and check that access is still valid.')); }
    finally {setBusy(false);}
  }
  async function retryResolution(id:string) {
    if(busy)return; setBusy(true);
    try {await notifyResolved(id);setNotice(copy('Aviso enviado.', 'Notification sent.'));await load();}
    catch {setNotice(copy('No se pudo enviar el correo. Reintente.', 'Could not send email. Please retry.'));}
    finally {setBusy(false);}
  }
  async function open(id: string) {
    const request = ++generation.current; setBusy(true); setNotice(''); setSelected(null);
    const result = await supabase.rpc('v2_support_open', { p_id: id });
    if (request !== generation.current) return;
    if (result.error || !result.data) { setNotice(copy('El acceso no está disponible. Puede haber vencido o sido revocado.', 'Access is unavailable. It may have expired or been revoked.')); sessionStorage.removeItem('mrmaa-support-link'); }
    else { setSelected(result.data); history.replaceState({}, '', `/?support=${encodeURIComponent(id)}`); }
    setBusy(false);
  }
  useEffect(() => {
    void load();
    if (!autoOpened.current) { autoOpened.current = true; const id = new URLSearchParams(location.search).get('support') || sessionStorage.getItem('mrmaa-support-link'); if (id && /^[a-f0-9-]{36}$/i.test(id)) void open(id); }
    return () => { generation.current++; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const request = generation.current;
    async function check() {
      const result = await supabase.rpc('v2_support_open', { p_id: selected.id, p_record: false });
      if (request !== generation.current) return;
      if (result.error || !result.data || Date.parse(selected.expires_at) <= Date.now()) {
        exit(); setNotice(copy('El acceso terminó o no se pudo verificar. Vuelva a abrir una solicitud vigente.', 'Access ended or could not be verified. Open a valid request again.')); void load();
      }
    }
    const timer = setInterval(() => void check(), 15000);
    const expires = setTimeout(() => { if (request === generation.current) { exit(); setNotice(copy('El permiso de soporte venció.', 'Support access expired.')); void load(); } }, Math.max(0, Date.parse(selected.expires_at) - Date.now()));
    const focus = () => void check(); window.addEventListener('focus', focus);
    return () => { clearInterval(timer); clearTimeout(expires); window.removeEventListener('focus', focus); };
  }, [selected?.id]);
  const back = () => { if (!confirmDiscardChanges()) return; exit(); void load(); };
  if (selected) return <div className="supportMode"><div className="supportBanner" role="status" translate="no"><div><strong>{copy('Acceso de soporte', 'Support access')} · {selected.restaurant_name}</strong><span>{selected.permission === 'edit' ? copy('Ver y editar', 'View and edit') : copy('Solo lectura', 'View only')} · {copy('Hasta ', 'Until ')}{new Date(selected.expires_at).toLocaleString(en ? 'en-US' : 'es-GT')}</span></div><button className="primary" disabled={busy} onClick={() => void resolveRequest(selected.id)}>{copy('Marcar como resuelta', 'Mark as resolved')}</button><button className="secondary" onClick={back}>{copy('Volver a solicitudes', 'Back to requests')}</button></div><Dashboard key={`${session.user.id}:${selected.id}`} session={session} initialRestaurantId={selected.restaurant_id} initialRestaurantName={selected.restaurant_name} planCode={selected.plan_code} trialEndsAt={selected.trial_ends_at} /></div>;
  const visible = rows.filter(row => `${row.restaurant_name} ${row.reason}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <main className="supportWorkspace" translate="no"><header className="supportListHeading"><div><p>MRMAA · support@mrmaa.com</p><h1>{copy('Solicitudes de soporte', 'Support requests')}</h1></div><button className="secondary" onClick={() => { sessionStorage.removeItem('mrmaa-support-link'); void signOutCurrentSession(); }}>{copy('Cerrar sesión', 'Sign out')}</button></header><p>{copy('Se muestran solicitudes vigentes y resueltas. Resolver una solicitud finaliza el acceso al restaurante.', 'Active and resolved requests appear here. Resolving a request ends restaurant access.')}</p><div className="supportActions"><input aria-label={copy('Buscar en las solicitudes cargadas', 'Search loaded requests')} placeholder={copy('Buscar en las solicitudes cargadas…', 'Search loaded requests…')} value={query} onChange={e => setQuery(e.target.value)} /><button className="secondary" disabled={busy} onClick={() => void load()}>{copy('Actualizar', 'Refresh')}</button></div>{notice && <p role="alert" className="moduleNotice">{notice}</p>}{busy && <p role="status">{copy('Cargando…', 'Loading…')}</p>}{!busy && !visible.length && <section className="moduleCard">{copy('No hay solicitudes de soporte activas que coincidan.', 'No matching active support requests.')}</section>}<div className="supportRequestList">{visible.map(row => <article className="moduleCard supportRequest" key={row.id}><div className="supportListHeading"><h2>{row.restaurant_name}</h2><span>{row.permission === 'edit' ? copy('Ver y editar', 'View and edit') : copy('Solo lectura', 'View only')}</span></div><p className="supportReason">{row.reason}</p><p>{copy('Vence: ', 'Expires: ')}{new Date(row.expires_at).toLocaleString(en ? 'en-US' : 'es-GT')}</p>{row.resolved_at ? <><strong style={{color:'#166534'}}>{copy('Resuelta','Resolved')}</strong><p className="supportReason">{row.resolution_note}</p>{!row.resolution_notified_at && <button className="secondary" disabled={busy} onClick={() => void retryResolution(row.id)}>{copy('Reintentar correo','Retry email')}</button>}</> : <div className="supportActions"><button className="primary" disabled={busy} onClick={() => void open(row.id)}>{copy('Abrir restaurante', 'Open restaurant')}</button><button className="secondary" disabled={busy} onClick={() => void resolveRequest(row.id)}>{copy('Marcar como resuelta','Mark as resolved')}</button></div>}</article>)}</div>{rows.length > 0 && rows.length % 50 === 0 && <button className="secondary" disabled={busy} onClick={() => void load(true)}>{copy('Cargar más', 'Load more')}</button>}</main>;
}
