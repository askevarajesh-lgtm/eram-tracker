"use client";
import React, { useEffect, useState } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast, type ExternalToast } from "sonner";
import { CheckCircle2, AlertOctagon, Trash2, AlertTriangle, Info } from "lucide-react";

const EVENT = "dev360:toast";

/**
 * Intelligent Toast Dispatcher
 * Automatically detects whether an operation is a Creation, Update, Deletion, Warning, or Error,
 * and formats the notification with rich modern icons, borders, and animations.
 */
function smartToast(message: string | React.ReactNode, options?: ExternalToast) {
  if (typeof message !== "string") {
    return sonnerToast(message, options);
  }

  const lower = message.toLowerCase();

  // 1. Errors and Failures
  if (
    lower.includes("failed") ||
    lower.includes("error") ||
    lower.includes("denied") ||
    lower.includes("invalid") ||
    lower.includes("cannot")
  ) {
    return sonnerToast.error(message, {
      icon: <AlertOctagon size={18} style={{ color: "var(--bad)", flexShrink: 0 }} />,
      ...options,
    });
  }

  // 2. Deletions and Removals (Destructive actions)
  if (
    lower.includes("delete") ||
    lower.includes("removed") ||
    lower.includes("discarded") ||
    lower.includes("dropped") ||
    lower.includes("revoked")
  ) {
    return sonnerToast.warning(message, {
      icon: <Trash2 size={18} style={{ color: "var(--bad)", flexShrink: 0 }} />,
      ...options,
    });
  }

  // 3. Warnings and Alerts
  if (
    lower.includes("warn") ||
    lower.includes("caution") ||
    lower.includes("over-allocated") ||
    lower.includes("exceed") ||
    lower.includes("late") ||
    lower.includes("breached")
  ) {
    return sonnerToast.warning(message, {
      icon: <AlertTriangle size={18} style={{ color: "var(--warn)", flexShrink: 0 }} />,
      ...options,
    });
  }

  // 4. Success Operations (Creation, resolution, update, sign-off, approval, assignment)
  if (
    lower.includes("success") ||
    lower.includes("created") ||
    lower.includes("saved") ||
    lower.includes("updated") ||
    lower.includes("resolved") ||
    lower.includes("raised") ||
    lower.includes("accepted") ||
    lower.includes("assigned") ||
    lower.includes("imported") ||
    lower.includes("done") ||
    lower.includes("connected")
  ) {
    return sonnerToast.success(message, {
      icon: <CheckCircle2 size={18} style={{ color: "var(--ok)", flexShrink: 0 }} />,
      ...options,
    });
  }

  // Default informational toast
  return sonnerToast(message, {
    icon: <Info size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />,
    ...options,
  });
}

// Bind rich helper methods for direct calling
smartToast.success = (message: string | React.ReactNode, options?: ExternalToast) =>
  sonnerToast.success(message, {
    icon: <CheckCircle2 size={18} style={{ color: "var(--ok)", flexShrink: 0 }} />,
    ...options,
  });

smartToast.error = (message: string | React.ReactNode, options?: ExternalToast) =>
  sonnerToast.error(message, {
    icon: <AlertOctagon size={18} style={{ color: "var(--bad)", flexShrink: 0 }} />,
    ...options,
  });

smartToast.warning = (message: string | React.ReactNode, options?: ExternalToast) =>
  sonnerToast.warning(message, {
    icon: <AlertTriangle size={18} style={{ color: "var(--warn)", flexShrink: 0 }} />,
    ...options,
  });

smartToast.info = (message: string | React.ReactNode, options?: ExternalToast) =>
  sonnerToast.info(message, {
    icon: <Info size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />,
    ...options,
  });

smartToast.promise = sonnerToast.promise;
smartToast.dismiss = sonnerToast.dismiss;
smartToast.custom = sonnerToast.custom;

export const toast = smartToast;

/**
 * Modern Toaster Host Component
 * Renders stacked notifications in the top-right corner with smooth spring animations,
 * automatic light/dark theme tracking, and glassmorphic styling.
 */
export function Toaster() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Synchronize initial theme
    const cur = document.documentElement.getAttribute("data-theme");
    if (cur === "light" || cur === "dark") {
      setTheme(cur);
    }

    const onTheme = (e: any) => {
      const next = e.detail || document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(next === "light" ? "light" : "dark");
    };

    const onLegacyEvent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) smartToast(detail);
    };

    window.addEventListener("dev360themechange", onTheme);
    window.addEventListener(EVENT, onLegacyEvent);

    return () => {
      window.removeEventListener("dev360themechange", onTheme);
      window.removeEventListener(EVENT, onLegacyEvent);
    };
  }, []);

  return (
    <SonnerToaster
      position="top-right"
      theme={theme}
      richColors={false}
      closeButton
      expand={true}
      duration={3600}
      gap={10}
      toastOptions={{
        style: {
          borderRadius: 14,
          padding: "12px 16px",
          fontFamily: "var(--body)",
          fontSize: 13.5,
          fontWeight: 600,
        },
      }}
    />
  );
}
