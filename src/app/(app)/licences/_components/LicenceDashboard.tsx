"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Key,
  Shield,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowRight,
  ArrowUpRight,
  PieChart,
  BarChart3,
  AlertOctagon,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { AUDIENCES, daysUntil, type Audience } from "@/lib/licensing";
import { fmtDay } from "@/lib/dates";
import { projectColor } from "@/lib/constants";
import type { CompanyOption, LicencePool } from "@/server/queries";
import type { AssignRecord } from "./AssignPanel";
import { Chip } from "@/components/ui/Chip";
import { AntTable, type ColumnsType } from "@/components/ui/antd";

type Props = {
  pools: LicencePool[];
  companies: CompanyOption[];
  projects: { id: string; name: string }[];
  records: AssignRecord[];
  canManage: boolean;
  onGoToList: (software?: string) => void;
  onView: (pool: LicencePool) => void;
  onEdit: (poolId: string) => void;
  onAssign: (poolId: string) => void;
  onAdd: () => void;
};

// ============================================================================
// Donut / Circular Capacity Gauge (Pure SVG)
// ============================================================================
function CapacityDonut({
  total,
  assigned,
  available,
  utilPct,
}: {
  total: number;
  assigned: number;
  available: number;
  utilPct: number;
}) {
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Clamped percentage for visual ring
  const safeUtil = Math.max(0, Math.min(100, utilPct));
  const assignedOffset = circumference * (1 - safeUtil / 100);

  const ringColor =
    available < 0
      ? "var(--bad)"
      : utilPct >= 90
      ? "var(--warn)"
      : "var(--accent)";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--accent) 70%, #3b82f6)" />
          </linearGradient>
          <linearGradient id="donutWarnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--warn)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--warn) 70%, red)" />
          </linearGradient>
        </defs>

        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--sunk)"
          strokeWidth={strokeWidth}
        />

        {/* Headroom / Available Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--line) 80%, transparent)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />

        {/* Assigned Arc */}
        {total > 0 && assigned > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={available < 0 ? "var(--bad)" : utilPct >= 90 ? "url(#donutWarnGrad)" : "url(#donutGrad)"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={assignedOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
          />
        )}
      </svg>

      {/* Center Label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            font: "800 24px/1 var(--display)",
            letterSpacing: "-0.03em",
            color: ringColor,
          }}
        >
          {utilPct}%
        </span>
        <span
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 4,
          }}
        >
          {available < 0 ? "OVER CAPACITY" : "UTILIZED"}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Renewal Countdown Badge Component
// ============================================================================
function RenewalHorizonBadge({ day }: { day: string }) {
  const n = daysUntil(day);
  if (n == null) return <span className="muted">—</span>;

  if (n < 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          borderRadius: 99,
          fontSize: 11.5,
          fontWeight: 700,
          background: "color-mix(in srgb, var(--bad) 14%, var(--surface))",
          color: "var(--bad)",
          border: "1px solid color-mix(in srgb, var(--bad) 30%, transparent)",
        }}
      >
        <AlertOctagon size={12} /> Expired ({fmtDay(day)})
      </span>
    );
  }

  if (n <= 60) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          borderRadius: 99,
          fontSize: 11.5,
          fontWeight: 700,
          background: "color-mix(in srgb, var(--warn) 14%, var(--surface))",
          color: "var(--warn)",
          border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
        }}
      >
        <Clock size={12} /> {n} days ({fmtDay(day)})
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 600,
        background: "var(--sunk)",
        color: "var(--fg)",
        border: "1px solid var(--line)",
      }}
    >
      <Calendar size={12} className="muted" /> {fmtDay(day)}
    </span>
  );
}

// ============================================================================
// Main Licence Dashboard Component
// ============================================================================
export function LicenceDashboard({
  pools,
  companies,
  projects,
  records,
  canManage,
  onGoToList,
  onView,
  onEdit,
  onAssign,
  onAdd,
}: Props) {
  // --------------------------------------------------------------------------
  // 1. Core Computations & KPIs
  // --------------------------------------------------------------------------
  const totalPurchased = useMemo(() => pools.reduce((a, p) => a + p.quantity, 0), [pools]);
  const totalAssigned = useMemo(() => pools.reduce((a, p) => a + p.assigned, 0), [pools]);
  const totalAvailable = totalPurchased - totalAssigned;
  const overallUtilPct = totalPurchased ? Math.round((totalAssigned / totalPurchased) * 100) : 0;

  const renewalsDue = useMemo(
    () =>
      pools.filter(p => {
        if (!p.renewal) return false;
        const n = daysUntil(p.renewal);
        return n != null && n <= 60;
      }),
    [pools],
  );

  const expiredCount = useMemo(
    () => pools.filter(p => p.renewal && (daysUntil(p.renewal) ?? 0) < 0).length,
    [pools],
  );

  const allSoftware = useMemo(() => [...new Set(pools.map(p => p.software))], [pools]);
  const totalCost = useMemo(() => pools.reduce((acc, p) => acc + (Number(p.cost) || 0), 0), [pools]);
  const mainCurrency = pools.find(p => p.currency)?.currency || "SAR";

  // Active holders stats
  const uniqueHolders = useMemo(() => new Set(pools.flatMap(p => p.holderIds)).size, [pools]);
  const bizHoldersCount = useMemo(
    () =>
      records.filter(r => r.licenceIds.length > 0 && (!r.userType || r.userType === "Business user"))
        .length,
    [records],
  );
  const techHoldersCount = uniqueHolders - bizHoldersCount;

  // Attention Engine
  const overAllocated = useMemo(() => pools.filter(p => p.assigned > p.quantity), [pools]);
  const inactiveHolders = useMemo(
    () => records.filter(r => r.status === "Inactive" && r.licenceIds.length > 0),
    [records],
  );
  const missingRenewals = useMemo(() => pools.filter(p => !p.renewal), [pools]);

  // Software & pools comparison data for bar graph
  const comparisonItems = useMemo<
    { label: string; purchased: number; assigned: number; available: number; company?: string }[]
  >(() => {
    // If we have multiple software, compare by software. If single software, compare by license types!
    if (allSoftware.length > 1) {
      return allSoftware.map(sw => {
        const list = pools.filter(p => p.software === sw);
        const P = list.reduce((a, p) => a + p.quantity, 0);
        const A = list.reduce((a, p) => a + p.assigned, 0);
        return { label: sw, purchased: P, assigned: A, available: P - A };
      });
    }
    // Single software -> compare by license type (Professional, Limited Financial, etc.)
    return pools.map(p => ({
      label: p.type || p.software,
      purchased: p.quantity,
      assigned: p.assigned,
      available: p.quantity - p.assigned,
      company: p.companyName || "Group-wide",
    }));
  }, [allSoftware, pools]);

  const maxBarValue = useMemo(
    () => Math.max(1, ...comparisonItems.map(i => Math.max(i.purchased, i.assigned))),
    [comparisonItems],
  );

  // Renewals watchlist sorted
  const renewalsWatchlist = useMemo(() => {
    return [...pools].sort((a, b) => {
      if (!a.renewal) return 1;
      if (!b.renewal) return -1;
      return a.renewal.localeCompare(b.renewal);
    });
  }, [pools]);

  // Company Usage
  const companyUsage = useMemo(() => {
    return companies
      .map(c => {
        const inComp = records.filter(r => r.companyId === c.id);
        const assignedCount = inComp.reduce((acc, r) => acc + r.licenceIds.length, 0);
        const activeUsers = inComp.filter(r => r.status !== "Inactive").length;
        const swUsed = [
          ...new Set(
            inComp.flatMap(r =>
              r.licenceIds.map(id => pools.find(p => p.id === id)?.software).filter(Boolean),
            ),
          ),
        ];
        return {
          id: c.id,
          name: c.name,
          country: c.country,
          activeUsers,
          assignedCount,
          swUsed,
        };
      })
      .filter(c => c.assignedCount > 0 || c.activeUsers > 0)
      .sort((a, b) => b.assignedCount - a.assignedCount);
  }, [companies, records, pools]);

  if (pools.length === 0) {
    return (
      <div className="empty" style={{ margin: "40px auto", maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--sunk)",
            color: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Key size={28} />
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>No Licences Recorded Yet</h3>
        <p className="muted" style={{ margin: "8px 0 20px", fontSize: 13.5 }}>
          Add your purchased software licences (such as SAP B1 Professional or Microsoft 365) to activate the analytics dashboard.
        </p>
        {canManage && (
          <button className="ds-btn ds-btn-primary" type="button" onClick={onAdd}>
            <Key size={14} /> Add your first licence
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="ds-container" style={{ marginTop: 14 }}>
      {/* ====================================================================
          1. Bespoke Executive Asset & Entitlement KPI Cards
             Customized design: floating circular double-ring badges,
             subtle gradient mesh backgrounds, high-contrast display numbers,
             and contextual micro-metric progress meters.
         ==================================================================== */}
      <section
        aria-label="Executive Licence Performance Indicators"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
        }}
      >
        {/* Card 1: Licences Purchased */}
        <div
          onClick={() => onGoToList()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onGoToList(); }}
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, var(--surface)) 0%, var(--surface) 100%)",
            border: "1px solid color-mix(in srgb, var(--accent) 22%, var(--line))",
            borderRadius: 16,
            padding: "16px 18px",
            boxShadow: "0 2px 10px rgba(15, 26, 42, 0.04)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(15, 26, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(15, 26, 42, 0.04)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                border: "1.5px solid color-mix(in srgb, var(--accent) 32%, transparent)",
                boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent)",
                color: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Key size={19} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 99,
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
              {allSoftware.length} {allSoftware.length === 1 ? "System" : "Systems"}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Total Entitlements
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
              <span className="mono" style={{ font: "800 32px/1 var(--display)", color: "var(--fg)", letterSpacing: "-0.02em" }}>
                {totalPurchased}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>licences</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginTop: 2 }}>
              Licences purchased
            </div>
          </div>
          <div
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: "var(--muted)",
            }}
          >
            <span>Total pool inventory</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--accent)", fontWeight: 600 }}>
              View list <ArrowRight size={11} />
            </span>
          </div>
        </div>

        {/* Card 2: Licences Assigned */}
        <div
          onClick={() => onGoToList()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onGoToList(); }}
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, #2563eb 7%, var(--surface)) 0%, var(--surface) 100%)",
            border: "1px solid color-mix(in srgb, #2563eb 22%, var(--line))",
            borderRadius: 16,
            padding: "16px 18px",
            boxShadow: "0 2px 10px rgba(15, 26, 42, 0.04)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(15, 26, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(15, 26, 42, 0.04)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "color-mix(in srgb, #2563eb 14%, transparent)",
                border: "1.5px solid color-mix(in srgb, #2563eb 32%, transparent)",
                boxShadow: "0 0 0 3px color-mix(in srgb, #2563eb 8%, transparent)",
                color: "#2563eb",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={19} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 99,
                background: "color-mix(in srgb, #2563eb 12%, transparent)",
                color: "#2563eb",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb" }} />
              {overallUtilPct}% Allocated
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Active Allocation
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
              <span className="mono" style={{ font: "800 32px/1 var(--display)", color: "#2563eb", letterSpacing: "-0.02em" }}>
                {totalAssigned}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>active</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginTop: 2 }}>
              Licences assigned
            </div>
          </div>
          <div style={{ width: "100%", height: 5, borderRadius: 99, background: "var(--sunk)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, overallUtilPct)}%`,
                height: "100%",
                background: "#2563eb",
                borderRadius: 99,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: "var(--muted)",
            }}
          >
            <span>{uniqueHolders} individual holders</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#2563eb", fontWeight: 600 }}>
              Holders <ArrowRight size={11} />
            </span>
          </div>
        </div>

        {/* Card 3: Licences Available */}
        <div
          onClick={() => onGoToList()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onGoToList(); }}
          style={{
            background:
              totalAvailable < 0
                ? "linear-gradient(135deg, color-mix(in srgb, var(--bad) 7%, var(--surface)) 0%, var(--surface) 100%)"
                : "linear-gradient(135deg, color-mix(in srgb, #10b981 7%, var(--surface)) 0%, var(--surface) 100%)",
            border:
              totalAvailable < 0
                ? "1px solid color-mix(in srgb, var(--bad) 25%, var(--line))"
                : "1px solid color-mix(in srgb, #10b981 22%, var(--line))",
            borderRadius: 16,
            padding: "16px 18px",
            boxShadow: "0 2px 10px rgba(15, 26, 42, 0.04)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(15, 26, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(15, 26, 42, 0.04)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background:
                  totalAvailable < 0
                    ? "color-mix(in srgb, var(--bad) 14%, transparent)"
                    : "color-mix(in srgb, #10b981 14%, transparent)",
                border:
                  totalAvailable < 0
                    ? "1.5px solid color-mix(in srgb, var(--bad) 32%, transparent)"
                    : "1.5px solid color-mix(in srgb, #10b981 32%, transparent)",
                boxShadow:
                  totalAvailable < 0
                    ? "0 0 0 3px color-mix(in srgb, var(--bad) 8%, transparent)"
                    : "0 0 0 3px color-mix(in srgb, #10b981 8%, transparent)",
                color: totalAvailable < 0 ? "var(--bad)" : "#10b981",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {totalAvailable < 0 ? <AlertOctagon size={19} /> : <CheckCircle size={19} />}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 99,
                background:
                  totalAvailable < 0
                    ? "color-mix(in srgb, var(--bad) 12%, transparent)"
                    : "color-mix(in srgb, #10b981 12%, transparent)",
                color: totalAvailable < 0 ? "var(--bad)" : "#10b981",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: totalAvailable < 0 ? "var(--bad)" : "#10b981",
                }}
              />
              {totalAvailable < 0
                ? "Over-allocated"
                : `${totalPurchased ? Math.round((totalAvailable / totalPurchased) * 100) : 0}% Headroom`}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Available Headroom
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
              <span
                className="mono"
                style={{
                  font: "800 32px/1 var(--display)",
                  color: totalAvailable < 0 ? "var(--bad)" : "#10b981",
                  letterSpacing: "-0.02em",
                }}
              >
                {totalAvailable}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                {totalAvailable < 0 ? "deficit" : "free seats"}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginTop: 2 }}>
              Licences available
            </div>
          </div>
          <div
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: "var(--muted)",
            }}
          >
            <span>{totalAvailable < 0 ? "Exceeds purchased" : "Seats ready to assign"}</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                color: totalAvailable < 0 ? "var(--bad)" : "#10b981",
                fontWeight: 600,
              }}
            >
              Assign <ArrowRight size={11} />
            </span>
          </div>
        </div>

        {/* Card 4: Renewals <= 60 days */}
        <div
          style={{
            background:
              renewalsDue.length > 0
                ? "linear-gradient(135deg, color-mix(in srgb, var(--warn) 8%, var(--surface)) 0%, var(--surface) 100%)"
                : "linear-gradient(135deg, color-mix(in srgb, #64748b 5%, var(--surface)) 0%, var(--surface) 100%)",
            border:
              renewalsDue.length > 0
                ? "1px solid color-mix(in srgb, var(--warn) 30%, var(--line))"
                : "1px solid var(--line)",
            borderRadius: 16,
            padding: "16px 18px",
            boxShadow: "0 2px 10px rgba(15, 26, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(15, 26, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(15, 26, 42, 0.04)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background:
                  renewalsDue.length > 0
                    ? "color-mix(in srgb, var(--warn) 14%, transparent)"
                    : "color-mix(in srgb, #64748b 14%, transparent)",
                border:
                  renewalsDue.length > 0
                    ? "1.5px solid color-mix(in srgb, var(--warn) 32%, transparent)"
                    : "1.5px solid color-mix(in srgb, #64748b 32%, transparent)",
                boxShadow:
                  renewalsDue.length > 0
                    ? "0 0 0 3px color-mix(in srgb, var(--warn) 8%, transparent)"
                    : "0 0 0 3px color-mix(in srgb, #64748b 8%, transparent)",
                color: renewalsDue.length > 0 ? "var(--warn)" : "#64748b",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Calendar size={19} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 99,
                background:
                  renewalsDue.length > 0
                    ? "color-mix(in srgb, var(--warn) 14%, transparent)"
                    : "color-mix(in srgb, #64748b 12%, transparent)",
                color: renewalsDue.length > 0 ? "var(--warn)" : "var(--muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: renewalsDue.length > 0 ? "var(--warn)" : "#64748b",
                }}
              />
              {renewalsDue.length > 0
                ? expiredCount > 0
                  ? `${expiredCount} Expired`
                  : "Attention Needed"
                : "All Active"}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Contract Lifecycle
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 3 }}>
              <span
                className="mono"
                style={{
                  font: "800 32px/1 var(--display)",
                  color: renewalsDue.length > 0 ? "var(--warn)" : "var(--fg)",
                  letterSpacing: "-0.02em",
                }}
              >
                {renewalsDue.length}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>contracts</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginTop: 2 }}>
              Renewals ≤ 60 days
            </div>
          </div>
          <div
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: "var(--muted)",
            }}
          >
            <span>{renewalsDue.length > 0 ? "Renewal actions upcoming" : "No contracts near expiry"}</span>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>365d view</span>
          </div>
        </div>

        {/* Card 5: Annual Spend */}
        <div
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, #8b5cf6 7%, var(--surface)) 0%, var(--surface) 100%)",
            border: "1px solid color-mix(in srgb, #8b5cf6 22%, var(--line))",
            borderRadius: 16,
            padding: "16px 18px",
            boxShadow: "0 2px 10px rgba(15, 26, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(15, 26, 42, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 10px rgba(15, 26, 42, 0.04)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "color-mix(in srgb, #8b5cf6 14%, transparent)",
                border: "1.5px solid color-mix(in srgb, #8b5cf6 32%, transparent)",
                boxShadow: "0 0 0 3px color-mix(in srgb, #8b5cf6 8%, transparent)",
                color: "#8b5cf6",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <DollarSign size={19} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 99,
                background: "color-mix(in srgb, #8b5cf6 12%, transparent)",
                color: "#8b5cf6",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6" }} />
              Annual Spend
            </span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
              Commercial Commitment
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
              <span className="mono" style={{ font: "800 28px/1 var(--display)", color: "#8b5cf6", letterSpacing: "-0.02em" }}>
                {totalCost > 0 ? Number(totalCost).toLocaleString() : "—"}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)" }}>
                {totalCost > 0 ? mainCurrency : "Tracked"}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginTop: 2 }}>
              Total commercial cost
            </div>
          </div>
          <div
            style={{
              marginTop: "auto",
              paddingTop: 10,
              borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: "var(--muted)",
            }}
          >
            <span>{pools.filter((p) => p.cost).length} costed pools</span>
            <span style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 600 }}>Active contracts</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Attention & Compliance Banners (if any actionable items exist)
         ==================================================================== */}
      {(overAllocated.length > 0 || renewalsDue.length > 0 || inactiveHolders.length > 0 || missingRenewals.length > 0) && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {overAllocated.map(p => (
            <div
              key={p.id}
              className="banner"
              style={{
                background: "color-mix(in srgb, var(--bad) 10%, var(--surface))",
                borderColor: "color-mix(in srgb, var(--bad) 30%, transparent)",
                padding: "10px 16px",
                borderRadius: 12,
              }}
            >
              <span style={{ color: "var(--bad)", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                <AlertOctagon size={16} /> Over-allocated Capacity:
              </span>
              <span>
                <b>{p.software} ({p.type})</b> has <b>{p.assigned}</b> assigned but only <b>{p.quantity}</b> purchased ({p.assigned - p.quantity} seats over limit).
              </span>
              <span style={{ flex: 1 }} />
              {canManage && (
                <button
                  className="ds-btn"
                  type="button"
                  onClick={() => onAssign(p.id)}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  Rebalance holders
                </button>
              )}
            </div>
          ))}

          {renewalsDue.length > 0 && (
            <div
              className="banner warn"
              style={{ padding: "10px 16px", borderRadius: 12 }}
            >
              <span style={{ color: "var(--warn)", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                <Clock size={16} /> Renewals Due:
              </span>
              <span>
                {renewalsDue.length} licence pool{renewalsDue.length === 1 ? " is" : "s are"} expiring within 60 days
                {expiredCount > 0 ? ` (${expiredCount} already expired)` : ""}.
              </span>
              <span style={{ flex: 1 }} />
              <button
                className="ds-btn"
                type="button"
                onClick={() => onGoToList()}
                style={{ padding: "4px 10px", fontSize: 12 }}
              >
                Review contracts in list
              </button>
            </div>
          )}

          {inactiveHolders.length > 0 && (
            <div
              className="banner warn"
              style={{ padding: "10px 16px", borderRadius: 12 }}
            >
              <span style={{ color: "var(--warn)", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                <Users size={16} /> Inactive Employees with Licences:
              </span>
              <span>
                <b>{inactiveHolders.length}</b> inactive employee{inactiveHolders.length === 1 ? "" : "s"} still holding assigned licences:{" "}
                {inactiveHolders.slice(0, 3).map(r => r.name).join(", ")}
                {inactiveHolders.length > 3 ? ` +${inactiveHolders.length - 3} more` : ""}.
              </span>
              <span style={{ flex: 1 }} />
              <Link
                className="ds-btn"
                href="/users"
                style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none" }}
              >
                Reclaim seats in Users &amp; access
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ====================================================================
          3. Visual Analytics Grid: Donut Capacity Gauge & Bar Chart
         ==================================================================== */}
      <section className="ds-analytics-grid">
        {/* Left Column: Radial Capacity & Allocation Donut */}
        <div className="ds-chart-card">
          <div className="ds-chart-head">
            <div className="ds-chart-title">
              <PieChart size={17} />
              <span>Seat Capacity &amp; Allocation Ratio</span>
            </div>
            <div className="ds-chart-metrics">
              <span className="ds-chart-metric-pill">
                Total: <b>{totalPurchased} seats</b>
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-around",
              gap: 20,
              padding: "10px 0",
            }}
          >
            {/* SVG Donut */}
            <CapacityDonut
              total={totalPurchased}
              assigned={totalAssigned}
              available={totalAvailable}
              utilPct={overallUtilPct}
            />

            {/* Donut Legend & Stat Badges */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 200, flex: 1 }}>
              {/* Assigned Item */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "var(--sunk)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Assigned Seats</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>
                    {totalAssigned}
                  </span>
                  <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
                    ({overallUtilPct}%)
                  </span>
                </div>
              </div>

              {/* Available Item */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "var(--sunk)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: totalAvailable < 0 ? "var(--bad)" : "#3b82f6",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Available Capacity</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    className="mono"
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: totalAvailable < 0 ? "var(--bad)" : "inherit",
                    }}
                  >
                    {totalAvailable}
                  </span>
                  <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
                    ({totalPurchased ? Math.round((totalAvailable / totalPurchased) * 100) : 0}%)
                  </span>
                </div>
              </div>

              {/* Audience Breakdown */}
              <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span className="muted">Audience Split:</span>
                <span style={{ fontWeight: 600 }}>{bizHoldersCount} Business</span>
                <span className="muted">·</span>
                <span style={{ fontWeight: 600 }}>{techHoldersCount} Dev/IT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Comparative Horizontal Bar Chart */}
        <div className="ds-chart-card">
          <div className="ds-chart-head">
            <div className="ds-chart-title">
              <BarChart3 size={17} />
              <span>Pool Distribution &amp; Usage</span>
            </div>
            <div className="ds-chart-metrics">
              <span className="ds-chart-metric-pill">
                <b>{comparisonItems.length}</b> pools
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
            {comparisonItems.map(item => {
              const utilRate = item.purchased ? Math.min(100, Math.round((item.assigned / item.purchased) * 100)) : 0;
              const barWidthPct = (item.purchased / maxBarValue) * 100;
              const assignedWidthPct = item.purchased ? (item.assigned / item.purchased) * 100 : 0;

              return (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 600, color: "var(--fg)" }}>{item.label}</span>
                      {Boolean(item.company) && (
                        <span className="muted" style={{ fontSize: 11 }}>({item.company})</span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 12 }}>
                      <b>{item.assigned}</b> / <span className="muted">{item.purchased}</span>{" "}
                      <span
                        style={{
                          fontWeight: 600,
                          color: item.available < 0 ? "var(--bad)" : utilRate >= 90 ? "var(--warn)" : "var(--accent)",
                          marginLeft: 4,
                        }}
                      >
                        ({utilRate}%)
                      </span>
                    </div>
                  </div>

                  {/* Dual Bar (Purchased background track with assigned fill) */}
                  <div
                    style={{
                      width: "100%",
                      height: 12,
                      borderRadius: 6,
                      background: "var(--sunk)",
                      overflow: "hidden",
                      position: "relative",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {/* Capacity scale track */}
                    <div
                      style={{
                        width: `${barWidthPct}%`,
                        height: "100%",
                        background: "color-mix(in srgb, var(--accent) 15%, var(--sunk))",
                        position: "relative",
                        borderRadius: 5,
                      }}
                    >
                      {/* Assigned fill */}
                      <div
                        style={{
                          width: `${assignedWidthPct}%`,
                          height: "100%",
                          background:
                            item.available < 0
                              ? "var(--bad)"
                              : utilRate >= 90
                              ? "var(--warn)"
                              : "linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, #3b82f6) 100%)",
                          borderRadius: 5,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 12,
                fontSize: 11.5,
                marginTop: 4,
                color: "var(--muted)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)" }} /> Assigned
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "color-mix(in srgb, var(--accent) 25%, var(--sunk))" }} /> Purchased Capacity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. Software Portfolio Cards (Elevated UI with Micro-Gauges)
         ==================================================================== */}
      <section>
        <div className="grouph" style={{ margin: "6px 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Software Portfolios &amp; Systems</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>Integrated view of active software, assigned seats, and available capacity</span>
          </div>
          <button
            className="ds-btn"
            type="button"
            onClick={() => onGoToList()}
            style={{ fontSize: 12 }}
          >
            All licences list <ArrowRight size={13} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: 16,
          }}
        >
          {allSoftware.map(sw => {
            const list = pools.filter(p => p.software === sw);
            const P = list.reduce((a, p) => a + p.quantity, 0);
            const A = list.reduce((a, p) => a + p.assigned, 0);
            const V = P - A;
            const pct = P ? Math.round((A / P) * 100) : 0;
            const proj = list.find(p => p.projectId);
            const projName = proj ? proj.projectName : projects.find(pr => pr.name.toLowerCase() === sw.toLowerCase())?.name;
            const color = projName ? projectColor(projName) : "var(--accent)";

            return (
              <div
                key={sw}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  boxShadow: "0 1px 3px rgba(15, 26, 42, 0.04)",
                  transition: "all 0.2s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Brand indicator bar at top */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: color,
                  }}
                />

                {/* Card Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span className="mtag" style={{ ["--mc" as string]: color, fontSize: 13, padding: "3px 10px" }}>
                      {sw}
                    </span>
                    {projName && projName !== sw && (
                      <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
                        {projName}
                      </span>
                    )}
                  </div>

                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: V < 0 ? "var(--bad)" : "var(--ok)",
                      background: V < 0 ? "color-mix(in srgb, var(--bad) 10%, transparent)" : "color-mix(in srgb, var(--ok) 10%, transparent)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {V < 0 ? `${Math.abs(V)} over limit` : `${V} free seats`}
                  </span>
                </div>

                {/* Metrics Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "var(--sunk)", padding: "10px 14px", borderRadius: 10 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Purchased</div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{P}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Assigned</div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: "#3b82f6", marginTop: 2 }}>{A}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>Available</div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: V < 0 ? "var(--bad)" : "var(--ok)", marginTop: 2 }}>{V}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span className="muted">Seat Allocation</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{A} / {P} ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "var(--sunk)", overflow: "hidden", display: "flex" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        background: V < 0 ? "var(--bad)" : pct >= 90 ? "var(--warn)" : "var(--accent)",
                        borderRadius: 99,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>

                {/* Types Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                  {list.map(p => (
                    <span
                      key={p.id}
                      style={{
                        fontSize: 11.5,
                        padding: "3px 8px",
                        background: "var(--sunk)",
                        borderRadius: 6,
                        border: "1px solid var(--line)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.type}</span>: {p.quantity} ({p.assigned} used)
                    </span>
                  ))}
                </div>

                {/* Action button */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    className="ds-btn"
                    type="button"
                    onClick={() => onGoToList(sw)}
                    style={{ fontSize: 12, padding: "5px 12px", width: "100%", justifyContent: "center" }}
                  >
                    Manage {sw} Licences <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          5. Renewals & Commercial Contracts Watchlist
         ==================================================================== */}
      <section>
        <div className="grouph" style={{ margin: "8px 0 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Renewals &amp; Commercial Watchlist</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>Contract milestones, renewal dates, and commercial terms</span>
          </div>
          {canManage && (
            <button className="ds-btn ds-btn-primary" type="button" onClick={onAdd} style={{ fontSize: 12 }}>
              <Key size={13} /> + Add Licence
            </button>
          )}
        </div>

        {(() => {
          const columns: ColumnsType<LicencePool> = [
            {
              title: "Software & Licence Type",
              key: "software",
              render: (_: unknown, p: LicencePool) => (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <b style={{ fontWeight: 600 }}>{p.software}</b>
                    <span className="muted">·</span>
                    <span>{p.type}</span>
                    {p.audience && (
                      <Chip color={p.audience === "endusers" ? "var(--accent)" : "var(--lms)"}>
                        {AUDIENCES[p.audience as Audience] ?? p.audience}
                      </Chip>
                    )}
                  </div>
                  {p.contract && (
                    <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>
                      Contract: {p.contract}
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: "Scope",
              dataIndex: "companyName",
              key: "companyName",
              render: (name?: string) => name || <span className="muted">Group-wide</span>,
            },
            {
              title: "Model",
              dataIndex: "model",
              key: "model",
              className: "muted",
              render: (m: string) => m || "Perpetual",
            },
            {
              title: "Allocation",
              key: "seats",
              align: "center",
              render: (_: unknown, p: LicencePool) => (
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {p.assigned} / {p.quantity}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: p.quantity - p.assigned < 0 ? "var(--bad)" : "var(--muted)",
                    }}
                  >
                    {p.quantity - p.assigned < 0
                      ? `${p.assigned - p.quantity} over`
                      : `${p.quantity - p.assigned} free`}
                  </span>
                </div>
              ),
            },
            {
              title: "Renewal / Expiry",
              dataIndex: "renewal",
              key: "renewal",
              render: (r: string) => (r ? <RenewalHorizonBadge day={r} /> : <span className="muted">None recorded</span>),
            },
            {
              title: "Vendor",
              dataIndex: "vendor",
              key: "vendor",
              className: "muted",
              render: (v: string) => v || "—",
            },
            {
              title: "Annual Cost",
              key: "cost",
              align: "right",
              render: (_: unknown, p: LicencePool) =>
                p.cost ? (
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {Number(p.cost).toLocaleString()} {p.currency || "SAR"}
                  </span>
                ) : (
                  <span className="muted">—</span>
                ),
            },
            {
              title: "Actions",
              key: "actions",
              align: "right",
              render: (_: unknown, p: LicencePool) => (
                <div style={{ display: "inline-flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button
                    className="ds-btn"
                    type="button"
                    onClick={() => onView(p)}
                    style={{ padding: "4px 8px", fontSize: 11.5 }}
                  >
                    Details
                  </button>
                  {canManage && (
                    <button
                      className="ds-btn"
                      type="button"
                      onClick={() => onAssign(p.id)}
                      style={{ padding: "4px 8px", fontSize: 11.5 }}
                    >
                      Assign
                    </button>
                  )}
                </div>
              ),
            },
          ];

          return (
            <div className="tablewrap">
              <AntTable<LicencePool>
                dataSource={renewalsWatchlist}
                columns={columns}
                rowKey="id"
                onRowClick={p => onView(p)}
                pagination={renewalsWatchlist.length > 6 ? { defaultPageSize: 6, showSizeChanger: true } : false}
                emptyTitle="No renewal dates recorded"
                emptyDescription="Set renewal dates on your licence pools to track expiration dates here."
              />
            </div>
          );
        })()}
      </section>

      {/* ====================================================================
          6. Subsidiary & Company Allocation Matrix
         ==================================================================== */}
      {companyUsage.length > 0 && (
        <section>
          <div className="grouph" style={{ margin: "8px 0 12px" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Subsidiary &amp; Entity Distribution</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>Active staff and allocated licences per operating company</span>
          </div>

          {(() => {
            type CompRow = (typeof companyUsage)[number];
            const compColumns: ColumnsType<CompRow> = [
              {
                title: "Operating Entity",
                dataIndex: "name",
                key: "name",
                render: (name: string, r: CompRow) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "var(--sunk)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                      }}
                    >
                      <Building2 size={15} />
                    </div>
                    <div>
                      <b style={{ fontWeight: 600 }}>{name}</b>
                      {r.country && (
                        <span className="muted" style={{ fontSize: 11.5, marginLeft: 6 }}>
                          ({r.country})
                        </span>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                title: "Active Staff",
                dataIndex: "activeUsers",
                key: "activeUsers",
                align: "center",
                className: "mono",
              },
              {
                title: "Assigned Licences",
                dataIndex: "assignedCount",
                key: "assignedCount",
                align: "center",
                render: (n: number) => (
                  <span
                    className="mono"
                    style={{
                      fontWeight: 700,
                      color: "var(--accent)",
                      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {n} seats
                  </span>
                ),
              },
              {
                title: "Software Deployed",
                dataIndex: "swUsed",
                key: "swUsed",
                render: (sw: string[]) => (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {sw.map(s => (
                      <Chip key={s} color="var(--accent)">
                        {s}
                      </Chip>
                    ))}
                  </div>
                ),
              },
              {
                title: "Action",
                key: "action",
                align: "right",
                render: (_: unknown, r: CompRow) => (
                  <Link
                    className="ds-btn"
                    href={`/users?comp=${r.id}`}
                    style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none" }}
                  >
                    View users <ExternalLink size={11} />
                  </Link>
                ),
              },
            ];

            return (
              <div className="tablewrap">
                <AntTable<CompRow>
                  dataSource={companyUsage}
                  columns={compColumns}
                  rowKey="id"
                  pagination={false}
                />
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
