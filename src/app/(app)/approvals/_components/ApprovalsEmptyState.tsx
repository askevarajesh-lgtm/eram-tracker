"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  RotateCcw,
  Zap,
  Layers,
  GitPullRequest,
  BellRing,
  ArrowRight,
} from "lucide-react";

export type ApprovalsEmptyStateProps = {
  isFiltered?: boolean;
  onResetFilters?: () => void;
  canManage?: boolean;
};

export function ApprovalsEmptyState({
  isFiltered = false,
  onResetFilters,
  canManage = false,
}: ApprovalsEmptyStateProps) {
  if (isFiltered) {
    return (
      <div
        style={{
          border: "1px dashed var(--line)",
          borderRadius: 14,
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search size={22} />
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "var(--display)",
            color: "var(--fg)",
          }}
        >
          No matching items found
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 380 }}>
          No pending approvals match your current search query or filter selection. Try adjusting your search keywords.
        </p>
        {onResetFilters && (
          <button
            type="button"
            className="btn"
            onClick={onResetFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              fontSize: 13,
            }}
          >
            <RotateCcw size={13} />
            Reset all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "42px 28px",
        textAlign: "center",
        background: "radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 6%, var(--surface)) 0%, var(--surface) 70%)",
        boxShadow: "0 2px 8px rgba(15, 26, 42, 0.04)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Icon with glowing ring */}
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--ok) 20%, transparent) 0%, color-mix(in srgb, var(--accent) 20%, transparent) 100%)",
          color: "var(--ok)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 0 6px color-mix(in srgb, var(--ok) 8%, transparent)",
        }}
      >
        <ShieldCheck size={30} strokeWidth={2.2} />
      </div>

      <div>
        <h3
          style={{
            margin: "0 0 6px",
            fontSize: 18,
            fontWeight: 800,
            fontFamily: "var(--display)",
            color: "var(--fg)",
          }}
        >
          All Approvals Caught Up!
        </h3>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", maxWidth: 520, lineHeight: 1.5 }}>
          There is nothing waiting for approval right now. Urgent issues, developer tasks, and change requests appear here whenever an Admin or Project Manager sign-off is needed.
        </p>
      </div>

      {/* SLA / Health Badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
          marginTop: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 99,
            background: "color-mix(in srgb, var(--ok) 10%, var(--surface))",
            color: "var(--ok)",
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid color-mix(in srgb, var(--ok) 20%, transparent)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }} />
          Urgent Issues: Zero blockers
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 99,
            background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
            color: "var(--accent)",
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
          Dev Pipeline: 100% triaged
        </span>
      </div>

      {/* Quick shortcuts */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 10,
          paddingTop: 16,
          borderTop: "1px solid var(--line)",
          width: "100%",
          maxWidth: 600,
        }}
      >
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Quick Navigation:</span>
        <Link
          href="/issues"
          className="btn"
          style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <Zap size={12} style={{ color: "var(--bad)" }} />
          Urgent Issues
        </Link>
        <Link
          href="/tasks"
          className="btn"
          style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <Layers size={12} style={{ color: "var(--warn)" }} />
          Dev Tasks
        </Link>
        <Link
          href="/plan?tab=changes"
          className="btn"
          style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <GitPullRequest size={12} style={{ color: "var(--lms)" }} />
          Change Requests
        </Link>
        {canManage && (
          <Link
            href="/admin-panel"
            className="btn"
            style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <BellRing size={12} style={{ color: "var(--accent)" }} />
            Notification Rules
          </Link>
        )}
      </div>
    </div>
  );
}
