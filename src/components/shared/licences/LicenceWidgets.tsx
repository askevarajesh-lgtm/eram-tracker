"use client";
import React from "react";
import type { LicencePool } from "@/server/queries";
import { Package, Users, CheckCircle, AlertOctagon, TrendingUp, Layers } from "lucide-react";

export function Utilisation({ assigned, total }: { assigned: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((assigned / total) * 100)) : assigned ? 100 : 0;
  const color = assigned > total ? "var(--bad)" : pct >= 90 ? "var(--warn)" : "var(--accent)";
  return (
    <div className="progress">
      <div className="bar"><i style={{ width: pct + "%", background: color }} /></div>
      <span className="mono" style={{ fontSize: 12 }}>{total ? Math.round((assigned / total) * 100) : 0}%</span>
    </div>
  );
}

/** Purchased / assigned / available per licence type, for one software rendered as modern KPI cards. */
export function Summary({ pools }: { pools: LicencePool[] }) {
  const types = [...new Set(pools.map(p => p.type))];
  const P = pools.reduce((a, p) => a + p.quantity, 0);
  const A = pools.reduce((a, p) => a + p.assigned, 0);
  const V = P - A;
  const pct = P ? Math.round((A / P) * 100) : 0;

  return (
    <div style={{ margin: "12px 0 16px" }}>
      {/* High-Tech Telemetry HUD Console Strip (Horizontal Layout) */}
      <div
        aria-label="Software Pool Telemetry Summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {/* Telemetry Tile 1: Purchased Capacity */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 15px",
            display: "flex",
            alignItems: "center",
            gap: 13,
            boxShadow: "0 1px 3px rgba(15, 26, 42, 0.03)",
            transition: "border-color 0.15s ease, transform 0.15s ease",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Package size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Pool Capacity
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
              <span className="mono" style={{ font: "800 22px/1 var(--display)", color: "var(--fg)" }}>
                {P}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>seats total</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {types.length} {types.length === 1 ? "licence type" : "licence types"} in pool
            </div>
          </div>
        </div>

        {/* Telemetry Tile 2: Assigned Seats */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 15px",
            display: "flex",
            alignItems: "center",
            gap: 13,
            boxShadow: "0 1px 3px rgba(15, 26, 42, 0.03)",
            transition: "border-color 0.15s ease, transform 0.15s ease",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "color-mix(in srgb, #3b82f6 12%, transparent)",
              border: "1px solid color-mix(in srgb, #3b82f6 26%, transparent)",
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Users size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Active Allocation
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
              <span className="mono" style={{ font: "800 22px/1 var(--display)", color: "#3b82f6" }}>
                {A}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>active users</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Held by enterprise members
            </div>
          </div>
        </div>

        {/* Telemetry Tile 3: Available Capacity */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 15px",
            display: "flex",
            alignItems: "center",
            gap: 13,
            boxShadow: "0 1px 3px rgba(15, 26, 42, 0.03)",
            transition: "border-color 0.15s ease, transform 0.15s ease",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background:
                V < 0
                  ? "color-mix(in srgb, var(--bad) 12%, transparent)"
                  : "color-mix(in srgb, var(--ok) 12%, transparent)",
              border:
                V < 0
                  ? "1px solid color-mix(in srgb, var(--bad) 26%, transparent)"
                  : "1px solid color-mix(in srgb, var(--ok) 26%, transparent)",
              color: V < 0 ? "var(--bad)" : "var(--ok)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {V < 0 ? <AlertOctagon size={20} /> : <CheckCircle size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Available Headroom
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
              <span
                className="mono"
                style={{
                  font: "800 22px/1 var(--display)",
                  color: V < 0 ? "var(--bad)" : "var(--ok)",
                }}
              >
                {V}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
                {V < 0 ? "deficit" : "free seats"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {V < 0 ? "Exceeds purchased inventory" : "Ready for immediate allocation"}
            </div>
          </div>
        </div>

        {/* Telemetry Tile 4: Utilisation Efficiency */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "12px 15px",
            display: "flex",
            alignItems: "center",
            gap: 13,
            boxShadow: "0 1px 3px rgba(15, 26, 42, 0.03)",
            transition: "border-color 0.15s ease, transform 0.15s ease",
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
              color: V < 0 ? "var(--bad)" : pct >= 90 ? "var(--warn)" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Utilisation Rate
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
              <span
                className="mono"
                style={{
                  font: "800 22px/1 var(--display)",
                  color: V < 0 ? "var(--bad)" : pct >= 90 ? "var(--warn)" : "var(--fg)",
                }}
              >
                {pct}%
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)" }}>
                ({A}/{P} seats)
              </span>
            </div>
            <div style={{ width: "100%", height: 5, borderRadius: 99, background: "var(--sunk)", overflow: "hidden", marginTop: 4 }}>
              <div
                style={{
                  width: `${Math.min(100, pct)}%`,
                  height: "100%",
                  background: V < 0 ? "var(--bad)" : pct >= 90 ? "var(--warn)" : "var(--accent)",
                  borderRadius: 99,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Multi-type breakdown pills (if more than 1 licence type exists in this software) */}
      {types.length > 1 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            padding: "8px 12px",
            background: "var(--sunk)",
            borderRadius: 10,
            border: "1px solid var(--line)",
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Layers size={13} /> Type breakdown:
          </span>
          {types.map(t => {
            const list = pools.filter(p => p.type === t);
            const tp = list.reduce((a, p) => a + p.quantity, 0);
            const ta = list.reduce((a, p) => a + p.assigned, 0);
            const tv = tp - ta;
            return (
              <span
                key={t}
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <b>{t}</b>: {tp} purchased · <span style={{ color: "#3b82f6" }}>{ta} assigned</span> ·{" "}
                <span style={{ color: tv < 0 ? "var(--bad)" : "var(--ok)", fontWeight: 600 }}>{tv} free</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
