"use client";

import React from "react";
import { ClockAlert, Zap, Layers, ShieldCheck, CheckCheck, CheckCircle2, ArrowRight } from "lucide-react";
import type { ApprovalTab } from "./types";

export type ApprovalKpiProps = {
  pendingTotal: number;
  issuesCount: number;
  tasksCount: number;
  changesCount: number;
  historyCount: number;
  approvedCount: number;
  rejectedCount: number;
  activeTab: ApprovalTab;
  onTabChange: (tab: ApprovalTab) => void;
};

export function ApprovalKpiCards({
  pendingTotal,
  issuesCount,
  tasksCount,
  changesCount,
  historyCount,
  approvedCount,
  rejectedCount,
  activeTab,
  onTabChange,
}: ApprovalKpiProps) {
  const isAllActive = activeTab === "all";
  const isIssuesActive = activeTab === "issues";
  const isDevActive = activeTab === "tasks" || activeTab === "changes";
  const isHistoryActive = activeTab === "history";

  const approvalRate = historyCount > 0 ? Math.round((approvedCount / historyCount) * 100) : 100;

  return (
    <section
      aria-label="Approvals Command Metrics"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: 14,
        marginBottom: 20,
      }}
    >
      {/* 1. Pending Approvals Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTabChange("all")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTabChange("all");
          }
        }}
        title="View all pending approval items"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "16px 18px",
          borderRadius: 16,
          background: "linear-gradient(145deg, color-mix(in srgb, var(--accent) 9%, var(--surface)) 0%, var(--surface) 75%)",
          border: isAllActive
            ? "1.5px solid var(--accent)"
            : "1px solid color-mix(in srgb, var(--accent) 25%, var(--line))",
          boxShadow: isAllActive
            ? "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent), 0 8px 24px color-mix(in srgb, var(--accent) 14%, transparent)"
            : "0 2px 8px rgba(15, 26, 42, 0.04)",
          cursor: "pointer",
          overflow: "hidden",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      >
        {/* Top curved gradient glow bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 30%, transparent) 100%)",
          }}
        />

        {/* Top Row: Pill Tag + Icon Squircle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
              color: "var(--accent)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: pendingTotal > 0 ? "var(--warn)" : "var(--accent)",
              }}
            />
            Queue Status
          </span>

          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, transparent) 0%, color-mix(in srgb, var(--accent) 8%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px color-mix(in srgb, var(--accent) 15%, transparent)",
            }}
          >
            <ClockAlert size={18} strokeWidth={2.3} />
          </div>
        </div>

        {/* Metric Row */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="mono"
              style={{
                font: "800 32px/1 var(--display)",
                color: pendingTotal > 0 ? "var(--fg)" : "var(--muted)",
                letterSpacing: "-0.02em",
              }}
            >
              {pendingTotal}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
              Pending Sign-Off
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            Urgent requests awaiting admin / PM review
          </div>
        </div>

        {/* Micro Status Bar */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid color-mix(in srgb, var(--accent) 15%, var(--line))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: pendingTotal > 0 ? "var(--warn)" : "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {pendingTotal > 0 ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warn)" }} />
                Action required
              </>
            ) : (
              <>
                <CheckCheck size={13} style={{ color: "var(--ok)" }} />
                All caught up
              </>
            )}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {pendingTotal > 0 ? `${pendingTotal} in queue` : "0 in queue"}
          </span>
        </div>
      </div>

      {/* 2. Urgent Issues Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTabChange("issues")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTabChange("issues");
          }
        }}
        title="Filter by Urgent Issues"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "16px 18px",
          borderRadius: 16,
          background: "linear-gradient(145deg, color-mix(in srgb, var(--bad) 9%, var(--surface)) 0%, var(--surface) 75%)",
          border: isIssuesActive
            ? "1.5px solid var(--bad)"
            : "1px solid color-mix(in srgb, var(--bad) 25%, var(--line))",
          boxShadow: isIssuesActive
            ? "0 0 0 2px color-mix(in srgb, var(--bad) 30%, transparent), 0 8px 24px color-mix(in srgb, var(--bad) 14%, transparent)"
            : "0 2px 8px rgba(15, 26, 42, 0.04)",
          cursor: "pointer",
          overflow: "hidden",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      >
        {/* Top curved gradient glow bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, var(--bad) 0%, color-mix(in srgb, var(--bad) 30%, transparent) 100%)",
          }}
        />

        {/* Top Row: Pill Tag + Icon Squircle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--bad) 14%, var(--surface))",
              color: "var(--bad)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: issuesCount > 0 ? "var(--bad)" : "var(--ok)",
              }}
            />
            Urgent Triage
          </span>

          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg, color-mix(in srgb, var(--bad) 24%, transparent) 0%, color-mix(in srgb, var(--bad) 8%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--bad) 30%, transparent)",
              color: "var(--bad)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px color-mix(in srgb, var(--bad) 15%, transparent)",
            }}
          >
            <Zap size={18} strokeWidth={2.3} />
          </div>
        </div>

        {/* Metric Row */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="mono"
              style={{
                font: "800 32px/1 var(--display)",
                color: issuesCount > 0 ? "var(--bad)" : "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              {issuesCount}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
              Support Escalations
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            Critical client & developer urgent tickets
          </div>
        </div>

        {/* Micro Status Bar */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid color-mix(in srgb, var(--bad) 15%, var(--line))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: issuesCount > 0 ? "var(--bad)" : "var(--ok)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {issuesCount > 0 ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--bad)" }} />
                {issuesCount} priority blockers
              </>
            ) : (
              <>
                <CheckCircle2 size={13} style={{ color: "var(--ok)" }} />
                Zero blockers
              </>
            )}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            SLA on track
          </span>
        </div>
      </div>

      {/* 3. Tasks & Change Requests Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTabChange(tasksCount > 0 ? "tasks" : changesCount > 0 ? "changes" : "tasks")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTabChange(tasksCount > 0 ? "tasks" : "changes");
          }
        }}
        title="Filter by Tasks and Change Requests"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "16px 18px",
          borderRadius: 16,
          background: "linear-gradient(145deg, color-mix(in srgb, var(--warn) 9%, var(--surface)) 0%, var(--surface) 75%)",
          border: isDevActive
            ? "1.5px solid var(--warn)"
            : "1px solid color-mix(in srgb, var(--warn) 25%, var(--line))",
          boxShadow: isDevActive
            ? "0 0 0 2px color-mix(in srgb, var(--warn) 30%, transparent), 0 8px 24px color-mix(in srgb, var(--warn) 14%, transparent)"
            : "0 2px 8px rgba(15, 26, 42, 0.04)",
          cursor: "pointer",
          overflow: "hidden",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      >
        {/* Top curved gradient glow bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, var(--warn) 0%, color-mix(in srgb, var(--warn) 30%, transparent) 100%)",
          }}
        />

        {/* Top Row: Pill Tag + Icon Squircle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--warn) 14%, var(--surface))",
              color: "var(--warn)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: tasksCount + changesCount > 0 ? "var(--warn)" : "var(--ok)",
              }}
            />
            Dev Pipeline
          </span>

          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg, color-mix(in srgb, var(--warn) 24%, transparent) 0%, color-mix(in srgb, var(--warn) 8%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
              color: "var(--warn)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px color-mix(in srgb, var(--warn) 15%, transparent)",
            }}
          >
            <Layers size={18} strokeWidth={2.3} />
          </div>
        </div>

        {/* Metric Row */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="mono"
              style={{
                font: "800 32px/1 var(--display)",
                color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              {tasksCount + changesCount}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
              Tasks & Changes
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            Feature enhancements and change orders
          </div>
        </div>

        {/* Micro Status Bar */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid color-mix(in srgb, var(--warn) 15%, var(--line))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--fg)" }}>
            {tasksCount} tasks · {changesCount} CRs
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            {tasksCount + changesCount > 0 ? "Pending sign-off" : "Pipeline clear"}
          </span>
        </div>
      </div>

      {/* 4. Decision Audit Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onTabChange("history")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTabChange("history");
          }
        }}
        title="View decisions history audit log"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "16px 18px",
          borderRadius: 16,
          background: "linear-gradient(145deg, color-mix(in srgb, var(--ok) 9%, var(--surface)) 0%, var(--surface) 75%)",
          border: isHistoryActive
            ? "1.5px solid var(--ok)"
            : "1px solid color-mix(in srgb, var(--ok) 25%, var(--line))",
          boxShadow: isHistoryActive
            ? "0 0 0 2px color-mix(in srgb, var(--ok) 30%, transparent), 0 8px 24px color-mix(in srgb, var(--ok) 14%, transparent)"
            : "0 2px 8px rgba(15, 26, 42, 0.04)",
          cursor: "pointer",
          overflow: "hidden",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      >
        {/* Top curved gradient glow bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, var(--ok) 0%, color-mix(in srgb, var(--ok) 30%, transparent) 100%)",
          }}
        />

        {/* Top Row: Pill Tag + Icon Squircle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: 99,
              background: "color-mix(in srgb, var(--ok) 14%, var(--surface))",
              color: "var(--ok)",
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--ok)",
              }}
            />
            Decision Audit
          </span>

          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg, color-mix(in srgb, var(--ok) 24%, transparent) 0%, color-mix(in srgb, var(--ok) 8%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--ok) 30%, transparent)",
              color: "var(--ok)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px color-mix(in srgb, var(--ok) 15%, transparent)",
            }}
          >
            <ShieldCheck size={18} strokeWidth={2.3} />
          </div>
        </div>

        {/* Metric Row */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="mono"
              style={{
                font: "800 32px/1 var(--display)",
                color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              {historyCount}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
              Decisions Recorded
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
            {approvedCount} approved · {rejectedCount} rejected
          </div>
        </div>

        {/* Micro Status Bar with progress track */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid color-mix(in srgb, var(--ok) 15%, var(--line))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 48,
                height: 5,
                borderRadius: 99,
                background: "var(--line)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${approvalRate}%`,
                  height: "100%",
                  background: "var(--ok)",
                  borderRadius: 99,
                }}
              />
            </div>
            <span style={{ fontWeight: 700, color: "var(--ok)", fontSize: 11.5 }}>
              {approvalRate}% Approved
            </span>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            Full history
          </span>
        </div>
      </div>
    </section>
  );
}
