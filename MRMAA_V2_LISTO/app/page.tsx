"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "@/lib/supabase";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState<"login" | "signup">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!configured)
      return setError("Configure las variables de Supabase en Vercel.");
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session)
      setError("Revise su correo para confirmar la cuenta.");
  }
  if (loading)
    return (
      <main className="center">
        <div className="loader" />
      </main>
    );
  if (session) return <Dashboard session={session} />;
  return (
    <main className="auth">
      <section className="authBrand">
        <div className="mark">M</div>
        <h1>MRMAA</h1>
        <p>Gestión clara para restaurantes que necesitan trabajar rápido.</p>
      </section>
      <form className="authCard" onSubmit={submit}>
        <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
        <label>
          Correo electrónico
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit">
          {mode === "login" ? "Entrar" : "Registrarme"}
        </button>
        <button
          className="link"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Crear una cuenta nueva" : "Ya tengo una cuenta"}
        </button>
      </form>
    </main>
  );
}
