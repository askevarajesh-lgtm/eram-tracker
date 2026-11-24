"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  ArrowLeft,
  LayoutDashboard,
  ListTodo,
  Key,
  Zap,
  Milestone,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

type Props = {
  standalone?: boolean;
};

const SUGGESTED_MODULES = [
  {
    title: "Tasks & Assignment",
    desc: "Active tasks, assignments & kanban",
    href: "/tasks",
    icon: ListTodo,
    color: "#3b82f6",
  },
  {
    title: "Urgent Issues",
    desc: "Critical tickets & SLA response",
    href: "/issues",
    icon: Zap,
    color: "var(--bad)",
  },
  {
    title: "Software Licences",
    desc: "Purchased pools & user assignments",
    href: "/licences",
    icon: Key,
    color: "var(--accent)",
  },
  {
    title: "Plan & Control",
    desc: "Milestones, releases & risk tracking",
    href: "/plan",
    icon: Milestone,
    color: "#8b5cf6",
  },
];

export function NotFoundView({ standalone = false }: Props) {
  const pathname = usePathname();

  return (
    <div
      style={{
        width: "100%",
        minHeight: standalone ? "100vh" : "calc(100vh - 160px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: standalone ? "24px 20px" : "20px 0 40px",
        position: "relative",
      }}
    >
      {/* If rendered outside the CRM shell (standalone root level) */}
      {standalone && (
        <header
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--accent)",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              E
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "var(--fg)", lineHeight: 1.1 }}>ERAM HCM</span>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Business Tools Tracker</span>
            </div>
          </Link>
          <ThemeToggle />
        </header>
      )}

      {/* Main 404 Hero Container */}
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "36px 32px 32px",
          textAlign: "center",
          boxShadow: "0 4px 24px -4px rgba(15, 26, 42, 0.06), 0 1px 3px rgba(15, 26, 42, 0.04)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle Ambient Radial Glow */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: "50%",
            transform: "translateX(-50%)",
            width: 360,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Floating Holographic Compass Badge */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            border: "2px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            boxShadow: "0 0 0 8px color-mix(in srgb, var(--accent) 8%, transparent)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          <Compass size={36} strokeWidth={2.2} />
        </div>

        {/* 404 Large Display Watermark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              font: "900 68px/1 var(--display)",
              letterSpacing: "-0.04em",
              background: "linear-gradient(135deg, var(--accent) 0%, #3b82f6 50%, #8b5cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            404
          </div>
          <h1 style={{ font: "800 24px/1.2 var(--display)", color: "var(--fg)", margin: 0 }}>
            Module or Page Not Found
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, maxWidth: 480, margin: "4px 0 0", lineHeight: 1.5 }}>
            The requested page does not exist in ERAM Tracker, may have been retired, or you may have entered an incorrect URL path.
          </p>
        </div>

        {/* Mismatched Route Indicator Tag */}
        {pathname && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 14px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--bad) 6%, var(--sunk))",
              border: "1px solid color-mix(in srgb, var(--bad) 22%, var(--line))",
              fontSize: 12,
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--fg)",
            }}
          >
            <ShieldAlert size={14} style={{ color: "var(--bad)" }} />
            <span style={{ color: "var(--muted)" }}>Target:</span>
            <span style={{ fontWeight: 600, color: "var(--bad)" }}>{pathname}</span>
          </div>
        )}

        {/* Action Buttons Row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 6,
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 22px",
              borderRadius: 10,
              background: "var(--accent)",
              color: "var(--accent-ink, #ffffff)",
              fontWeight: 600,
              fontSize: 13.5,
              textDecoration: "none",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px color-mix(in srgb, var(--accent) 45%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent)";
            }}
          >
            <LayoutDashboard size={16} />
            Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = "/";
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--fg)",
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
              transition: "background 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--sunk)";
              e.currentTarget.style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.borderColor = "var(--line)";
            }}
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>

        {/* Quick Jump Suggestions */}
        <div style={{ width: "100%", marginTop: 14, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted)",
              marginBottom: 10,
              textAlign: "left",
            }}
          >
            Jump to Active CRM Modules
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {SUGGESTED_MODULES.map((m) => {
              const IconComp = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 13px",
                    borderRadius: 12,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    textDecoration: "none",
                    color: "inherit",
                    textAlign: "left",
                    transition: "transform 0.15s ease, border-color 0.15s ease, background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.background = "var(--sunk)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "var(--line)";
                    e.currentTarget.style.background = "var(--surface)";
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${m.color} 24%, transparent)`,
                      color: m.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>{m.title}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.desc}
                    </div>
                  </div>
                  <ArrowRight size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
