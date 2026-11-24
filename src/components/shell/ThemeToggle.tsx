"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export type Theme = "auto" | "light" | "dark";
export const THEME_KEY = "dev360theme";

export function applyTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
  const r = document.documentElement;
  if (t === "auto") {
    const sysDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    r.setAttribute("data-theme", sysDark ? "dark" : "light");
  } else {
    r.setAttribute("data-theme", t);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dev360themechange", { detail: t }));
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let saved: Theme = "dark";
    try {
      const s = localStorage.getItem(THEME_KEY);
      if (s === "light" || s === "dark" || s === "auto") saved = s;
      else {
        // Fallback to existing document attribute if present
        const cur = document.documentElement.getAttribute("data-theme");
        if (cur === "light" || cur === "dark") saved = cur;
      }
    } catch {}
    setTheme(saved);

    // Synchronize DOM attribute
    const r = document.documentElement;
    if (saved === "auto") {
      const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      r.setAttribute("data-theme", sysDark ? "dark" : "light");
    } else {
      r.setAttribute("data-theme", saved);
    }

    const handler = (e: any) => {
      const next = e.detail || (localStorage.getItem(THEME_KEY) as Theme) || "dark";
      setTheme(next);
    };

    window.addEventListener("dev360themechange", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("dev360themechange", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const isDark = !mounted
    ? true
    : theme === "dark" || (theme === "auto" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Dark mode active · Click to switch to light mode" : "Light mode active · Click to switch to dark mode"}
      onClick={toggle}
      style={{
        position: "relative",
        width: 58,
        height: 32,
        borderRadius: 999,
        background: isDark ? "var(--sunk)" : "color-mix(in srgb, var(--sunk) 80%, #cbd5e1)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 6px",
        outline: "none",
        transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.12)",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--line)";
      }}
    >
      {/* Left Slot: Sun */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isDark ? "var(--muted)" : "#f59e0b",
          opacity: isDark ? 0.35 : 1,
          transition: "opacity 0.25s ease, color 0.25s ease",
        }}
      >
        <Sun size={13} strokeWidth={2.4} />
      </span>

      {/* Right Slot: Moon */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isDark ? "#38bdf8" : "var(--muted)",
          opacity: isDark ? 1 : 0.35,
          transition: "opacity 0.25s ease, color 0.25s ease",
        }}
      >
        <Moon size={13} strokeWidth={2.4} />
      </span>

      {/* Sliding Thumb Knob with active icon */}
      <span
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: isDark ? "var(--surface)" : "#ffffff",
          border: isDark ? "1px solid color-mix(in srgb, var(--line) 80%, transparent)" : "1px solid rgba(0, 0, 0, 0.08)",
          boxShadow: isDark ? "0 2px 6px rgba(0, 0, 0, 0.45)" : "0 2px 5px rgba(0, 0, 0, 0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: isDark ? "translateX(26px)" : "translateX(0px)",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease",
          color: isDark ? "#38bdf8" : "#f59e0b",
        }}
      >
        {isDark ? <Moon size={12} strokeWidth={2.4} /> : <Sun size={12} strokeWidth={2.4} />}
      </span>
    </button>
  );
}
