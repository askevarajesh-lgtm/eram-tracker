"use client";

import Link from "next/link";
import { Zap, Inbox, UserX, ClockAlert, CheckCircle2 } from "lucide-react";

export type IssueKpiProps = {
  urgent: number;
  open: number;
  unassigned: number;
  late: number;
  resolvedToday: number;
  currentPr?: string;
  currentDev?: string;
  currentSt?: string;
  currentSla?: string;
};

export function IssueKpiCards({
  urgent,
  open,
  unassigned,
  late,
  resolvedToday,
  currentPr,
  currentDev,
  currentSt,
  currentSla,
}: IssueKpiProps) {
  const isUrgentActive = currentPr === "Urgent";
  const isUnassignedActive = currentDev === "_none";
  const isLateActive = currentSla === "late";
  const isResolvedActive = currentSt === "resolved";
  const isOpenActive = !currentPr && !currentDev && !currentSla && (currentSt === "" || !currentSt);

  return (
    <section
      aria-label="Urgent Issues Incident Triage KPIs"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {/* 1. Urgent Open */}
      <Link
        href={isUrgentActive ? "/issues" : "/issues?pr=Urgent"}
        title={isUrgentActive ? "Clear filter" : "Filter by Urgent priority"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "13px 16px",
          borderRadius: 12,
          background: urgent > 0 ? "color-mix(in srgb, var(--bad) 4%, var(--surface))" : "var(--surface)",
          border: isUrgentActive ? "1.5px solid var(--bad)" : "1px solid var(--line)",
          borderLeft: "4px solid var(--bad)",
          textDecoration: "none",
          color: "inherit",
          boxShadow: isUrgentActive
            ? "0 0 0 2px color-mix(in srgb, var(--bad) 30%, transparent), 0 4px 12px rgba(15, 26, 42, 0.06)"
            : "0 1px 3px rgba(15, 26, 42, 0.03)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            Critical Triage
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 99,
              background: urgent > 0 ? "color-mix(in srgb, var(--bad) 14%, transparent)" : "color-mix(in srgb, var(--ok) 12%, transparent)",
              color: urgent > 0 ? "var(--bad)" : "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: urgent > 0 ? "var(--bad)" : "var(--ok)" }} />
            {urgent > 0 ? "Action needed" : "All clear"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span className="mono" style={{ font: "800 28px/1 var(--display)", color: urgent > 0 ? "var(--bad)" : "var(--fg)" }}>
            {urgent}
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "color-mix(in srgb, var(--bad) 12%, transparent)",
              color: "var(--bad)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={16} strokeWidth={2.4} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>Urgent open</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {urgent > 0 ? "Immediate priority escalation" : "Zero critical blockers"}
          </div>
        </div>
      </Link>

      {/* 2. All Open Issues */}
      <Link
        href="/issues"
        title="View all open issues"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "13px 16px",
          borderRadius: 12,
          background: "var(--surface)",
          border: isOpenActive ? "1.5px solid var(--accent)" : "1px solid var(--line)",
          borderLeft: "4px solid var(--accent)",
          textDecoration: "none",
          color: "inherit",
          boxShadow: isOpenActive
            ? "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent), 0 4px 12px rgba(15, 26, 42, 0.06)"
            : "0 1px 3px rgba(15, 26, 42, 0.03)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            Incident Queue
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 99,
              background: open > 0 ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--ok) 12%, transparent)",
              color: open > 0 ? "var(--accent)" : "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: open > 0 ? "var(--accent)" : "var(--ok)" }} />
            {open > 0 ? "Active queue" : "Zero open"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span className="mono" style={{ font: "800 28px/1 var(--display)", color: "var(--fg)" }}>
            {open}
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Inbox size={16} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>All open issues</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Active across all systems</div>
        </div>
      </Link>

      {/* 3. Unassigned */}
      <Link
        href={isUnassignedActive ? "/issues" : "/issues?dev=_none"}
        title={isUnassignedActive ? "Clear filter" : "Filter by unassigned issues"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "13px 16px",
          borderRadius: 12,
          background: unassigned > 0 ? "color-mix(in srgb, var(--warn) 4%, var(--surface))" : "var(--surface)",
          border: isUnassignedActive ? "1.5px solid var(--warn)" : "1px solid var(--line)",
          borderLeft: "4px solid var(--warn)",
          textDecoration: "none",
          color: "inherit",
          boxShadow: isUnassignedActive
            ? "0 0 0 2px color-mix(in srgb, var(--warn) 30%, transparent), 0 4px 12px rgba(15, 26, 42, 0.06)"
            : "0 1px 3px rgba(15, 26, 42, 0.03)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            Unstaffed Queue
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 99,
              background: unassigned > 0 ? "color-mix(in srgb, var(--warn) 14%, transparent)" : "color-mix(in srgb, var(--ok) 12%, transparent)",
              color: unassigned > 0 ? "var(--warn)" : "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: unassigned > 0 ? "var(--warn)" : "var(--ok)" }} />
            {unassigned > 0 ? "Needs pickup" : "All staffed"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span className="mono" style={{ font: "800 28px/1 var(--display)", color: unassigned > 0 ? "var(--warn)" : "var(--fg)" }}>
            {unassigned}
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "color-mix(in srgb, var(--warn) 12%, transparent)",
              color: "var(--warn)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserX size={16} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>Unassigned tickets</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {unassigned > 0 ? "Awaiting developer assignment" : "All active tickets assigned"}
          </div>
        </div>
      </Link>

      {/* 4. Past Response Time */}
      <Link
        href={isLateActive ? "/issues" : "/issues?sla=late"}
        title={isLateActive ? "Clear filter" : "Filter by past response time (SLA breached)"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "13px 16px",
          borderRadius: 12,
          background: late > 0 ? "color-mix(in srgb, var(--bad) 4%, var(--surface))" : "var(--surface)",
          border: isLateActive ? "1.5px solid var(--bad)" : "1px solid var(--line)",
          borderLeft: "4px solid var(--bad)",
          textDecoration: "none",
          color: "inherit",
          boxShadow: isLateActive
            ? "0 0 0 2px color-mix(in srgb, var(--bad) 30%, transparent), 0 4px 12px rgba(15, 26, 42, 0.06)"
            : "0 1px 3px rgba(15, 26, 42, 0.03)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            SLA Threshold
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 99,
              background: late > 0 ? "color-mix(in srgb, var(--bad) 14%, transparent)" : "color-mix(in srgb, var(--ok) 12%, transparent)",
              color: late > 0 ? "var(--bad)" : "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: late > 0 ? "var(--bad)" : "var(--ok)" }} />
            {late > 0 ? "SLA breached" : "Within SLA"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span className="mono" style={{ font: "800 28px/1 var(--display)", color: late > 0 ? "var(--bad)" : "var(--fg)" }}>
            {late}
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "color-mix(in srgb, var(--bad) 12%, transparent)",
              color: "var(--bad)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClockAlert size={16} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>Past response time</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {late > 0 ? "Target turnaround exceeded" : "All tickets on schedule"}
          </div>
        </div>
      </Link>

      {/* 5. Resolved Today */}
      <Link
        href={isResolvedActive ? "/issues" : "/issues?st=resolved"}
        title={isResolvedActive ? "Clear filter" : "Filter by resolved status"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "13px 16px",
          borderRadius: 12,
          background: "var(--surface)",
          border: isResolvedActive ? "1.5px solid var(--ok)" : "1px solid var(--line)",
          borderLeft: "4px solid var(--ok)",
          textDecoration: "none",
          color: "inherit",
          boxShadow: isResolvedActive
            ? "0 0 0 2px color-mix(in srgb, var(--ok) 30%, transparent), 0 4px 12px rgba(15, 26, 42, 0.06)"
            : "0 1px 3px rgba(15, 26, 42, 0.03)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
            Daily Velocity
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--ok) 12%, transparent)",
              color: "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ok)" }} />
            Today
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span className="mono" style={{ font: "800 28px/1 var(--display)", color: "var(--ok)" }}>
            {resolvedToday}
          </span>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "color-mix(in srgb, var(--ok) 12%, transparent)",
              color: "var(--ok)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={16} strokeWidth={2.2} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>Resolved today</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Closed since 12:00 AM</div>
        </div>
      </Link>
    </section>
  );
}
