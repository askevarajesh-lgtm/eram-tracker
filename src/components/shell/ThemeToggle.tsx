"use client";
import { useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";
export const THEME_KEY = "dev360theme";

export function applyTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
  const r = document.documentElement;
  if (t === "auto") {
    r.removeAttribute("data-theme");
  } else {
    r.setAttribute("data-theme", t);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dev360themechange", { detail: t }));
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    let saved: Theme = "auto";
    try {
      const s = localStorage.getItem(THEME_KEY);
      if (s === "light" || s === "dark" || s === "auto") saved = s;
    } catch {}
    setTheme(saved);

    // Ensure DOM attribute is strictly synchronized with saved preference on mount
    const r = document.documentElement;
    if (saved === "auto") {
      r.removeAttribute("data-theme");
    } else {
      r.setAttribute("data-theme", saved);
    }

    const handler = (e: any) => {
      const next = e.detail || (localStorage.getItem(THEME_KEY) as Theme) || "auto";
      setTheme(next);
    };

    window.addEventListener("dev360themechange", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("dev360themechange", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  return (
    <div className="themebtn" role="group" aria-label="Theme">
      {(["auto", "light", "dark"] as Theme[]).map(t => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => choose(t)}>
          {t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}
