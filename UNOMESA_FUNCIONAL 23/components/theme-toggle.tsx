"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useAppPreferences } from "./app-preferences";

type Theme = "light" | "dark";
const THEME_CHANGED = "unomesa:theme-changed";

export function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");
  const { language } = useAppPreferences();
  const en = language === "en";

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("mrmaa-theme"); } catch {}
    const current = document.documentElement.dataset.theme;
    const initial: Theme = current === "light" || current === "dark" ? current
      : saved === "light" || saved === "dark" ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    const sync = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const onStorage = (event: StorageEvent) => {
      if (event.key === "mrmaa-theme" && (event.newValue === "light" || event.newValue === "dark")) {
        document.documentElement.dataset.theme = event.newValue;
        sync();
      }
    };
    window.addEventListener(THEME_CHANGED, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGED, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function changeTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("mrmaa-theme", next); } catch {}
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(THEME_CHANGED));
  }

  const label = theme === "light" ? (en ? "Switch to dark mode" : "Activar modo oscuro") : (en ? "Switch to light mode" : "Activar modo claro");
  return (
    <button
      type="button"
      className={inline ? "appThemeToggle" : "themeToggle"}
      onClick={changeTheme}
      title={label}
      aria-label={label}
      translate="no"
    >
      {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      {inline && <><span><strong>{en ? "Appearance" : "Apariencia"}</strong><small>{theme === "dark" ? (en ? "Dark mode" : "Modo oscuro") : (en ? "Light mode" : "Modo claro")}</small></span><span className="appThemeAction">{en ? "Change" : "Cambiar"}</span></>}
    </button>
  );
}
