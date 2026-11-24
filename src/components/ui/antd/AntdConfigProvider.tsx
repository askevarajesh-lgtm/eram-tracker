"use client";
import React, { useEffect, useMemo, useState } from "react";
import { ConfigProvider, theme } from "antd";

export function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const syncAndCheck = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("dev360theme");
      } catch {}

      const isLogin = typeof window !== "undefined" && window.location.pathname.startsWith("/login");

      if (saved === "light") {
        if (document.documentElement.getAttribute("data-theme") !== "light") {
          document.documentElement.setAttribute("data-theme", "light");
        }
        return false;
      }

      if (saved === "dark") {
        if (document.documentElement.getAttribute("data-theme") !== "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
        }
        return true;
      }

      if (isLogin) {
        if (document.documentElement.getAttribute("data-theme") !== "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
        }
        return true;
      }

      if (saved === "auto") {
        const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const target = sysDark ? "dark" : "light";
        if (document.documentElement.getAttribute("data-theme") !== target) {
          document.documentElement.setAttribute("data-theme", target);
        }
        return sysDark;
      }

      // Default for all new users: dark mode
      if (document.documentElement.getAttribute("data-theme") !== "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      }
      return true;
    };

    setIsDark(syncAndCheck());

    const obs = new MutationObserver(() => {
      setIsDark(syncAndCheck());
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = () => setIsDark(syncAndCheck());
    mq.addEventListener("change", mqHandler);

    const onThemeEvent = () => setIsDark(syncAndCheck());
    window.addEventListener("dev360themechange", onThemeEvent);
    window.addEventListener("storage", onThemeEvent);

    return () => {
      obs.disconnect();
      mq.removeEventListener("change", mqHandler);
      window.removeEventListener("dev360themechange", onThemeEvent);
      window.removeEventListener("storage", onThemeEvent);
    };
  }, []);

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: isDark ? "#2dd4bf" : "#0f766e",
        colorPrimaryHover: isDark ? "#5eead4" : "#14b8a6",
        colorInfo: isDark ? "#60a5fa" : "#2563eb",
        colorSuccess: isDark ? "#4ade80" : "#15924a",
        colorWarning: isDark ? "#fbbf24" : "#c77408",
        colorError: isDark ? "#f87171" : "#d32f2f",
        fontFamily: "var(--body)",
        borderRadius: 8,
        colorBgContainer: isDark ? "#111a24" : "#ffffff",
        colorBgElevated: isDark ? "#16212d" : "#ffffff",
        colorBorder: isDark ? "#2b3c50" : "#d2d9e3",
        colorBorderSecondary: isDark ? "#213041" : "#e4e9f0",
        colorText: isDark ? "#e7edf5" : "#0f1a2a",
        colorTextSecondary: isDark ? "#8e9db2" : "#5f6c7e",
        colorTextPlaceholder: isDark ? "#64748b" : "#8a96a8",
        controlHeight: 38,
      },
      components: {
        Input: {
          controlHeight: 38,
          borderRadius: 8,
          paddingInline: 12,
        },
        Select: {
          controlHeight: 38,
          borderRadius: 8,
        },
        DatePicker: {
          controlHeight: 38,
          borderRadius: 8,
        },
        InputNumber: {
          controlHeight: 38,
          borderRadius: 8,
        },
        Button: {
          borderRadius: 8,
          controlHeight: 38,
        },
        Table: {
          headerBg: isDark ? "#141e2a" : "#f8fafc",
          headerColor: isDark ? "#8e9db2" : "#64748b",
          headerSplitColor: "transparent",
          rowHoverBg: isDark ? "#172332" : "#f1f5f9",
          borderColor: isDark ? "#213041" : "#e4e9f0",
          cellPaddingBlock: 11,
          cellPaddingInline: 12,
          borderRadius: 12,
          fontSize: 13,
        },
        Pagination: {
          borderRadius: 8,
          itemActiveBg: isDark ? "#1a2c3d" : "#e6f7f5",
          colorPrimary: isDark ? "#2dd4bf" : "#0f766e",
        },
      },
    }),
    [isDark]
  );

  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}
