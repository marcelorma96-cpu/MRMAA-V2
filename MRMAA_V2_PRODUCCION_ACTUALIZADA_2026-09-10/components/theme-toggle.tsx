"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("mrmaa-theme") as Theme | null;
    const initial = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function changeTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("mrmaa-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={changeTheme}
      title={theme === "light" ? "Activar modo noche" : "Activar modo día"}
      aria-label={theme === "light" ? "Activar modo noche" : "Activar modo día"}
    >
      {theme === "light" ? <Moon /> : <Sun />}
    </button>
  );
}
