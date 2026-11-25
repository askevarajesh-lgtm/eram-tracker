"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  Layers,
  GitPullRequest,
  Clock,
  User,
  Eye,
  Check,
  X,
  ExternalLink,
  Copy,
  CheckCheck,
  Building2,
  FolderGit2,
} from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { duration, issuePriorityColor } from "@/lib/issues";
import { projectColor } from "@/lib/constants";
import { toast } from "@/components/ui/Toaster";
import type { QueueItem } from "./types";

export type ApprovalCardProps = {
  item: QueueItem;
  now: number;
  canManage: boolean;
  onInspect: (item: QueueItem) => void;
  onDecide: (item: QueueItem, act: "approve" | "reject") => void;
};

export function ApprovalCard({
  item,
  now,
  canManage,
  onInspect,
  onDecide,
}: ApprovalCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.ref);
    setCopied(true);
    toast(`Copied ${item.ref} to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const waitMs = Math.max(0, now - Date.parse(item.at));
  const isUrgent = item.priority === "Urgent" || item.kind === "issue";
  const isLongWait = waitMs > 24 * 3600 * 1000;

  const getKindBadge = () => {
    switch (item.kind) {
      case "issue":
        return (
          <Chip color="var(--bad)">
            <Zap size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            Urgent Issue
          </Chip>
        );
      case "task":
        return (
          <Chip color="var(--warn)">
            <Layers size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            Dev Task
          </Chip>
        );
      case "change":
        return (
          <Chip color="var(--lms)">
            <GitPullRequest size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            Change Request
          </Chip>
        );
    }
  };

  const getAccentBorder = () => {
    switch (item.kind) {
      case "issue":
        return "4px solid var(--bad)";
      case "task":
        return "4px solid var(--warn)";
      case "change":
        return "4px solid var(--lms, #8b5cf6)";
      default:
        return "4px solid var(--accent)";
    }
  };

  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderLeft: getAccentBorder(),
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 1px 3px rgba(15, 26, 42, 0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        position: "relative",
      }}
      className="approval-card"
    >
      {/* Top Header Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {getKindBadge()}
          <button
            type="button"
            onClick={handleCopyRef}
            title="Click to copy reference"
            style={{
              background: "var(--sunk)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: "2px 7px",
              fontFamily: "var(--mono)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--fg)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
          >
            {item.ref}
            {copied ? <CheckCheck size={11} style={{ color: "var(--ok)" }} /> : <Copy size={11} style={{ color: "var(--muted)" }} />}
          </button>
          {item.projectName && (
            <Chip color={projectColor(item.projectName)} dot>
              {item.projectName}
            </Chip>
          )}
          {item.priority && item.kind !== "issue" && (
            <Chip color={issuePriorityColor(item.priority)}>
              {item.priority}
            </Chip>
          )}
        </div>

        {/* Time waiting pill */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 99,
            background: isLongWait ? "color-mix(in srgb, var(--bad) 10%, transparent)" : "color-mix(in srgb, var(--warn) 10%, transparent)",
            color: isLongWait ? "var(--bad)" : "var(--warn)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
          }}
          title={`Created at ${new Date(item.at).toLocaleString()}`}
        >
          <Clock size={12} />
          waiting {duration(waitMs)}
        </span>
      </div>

      {/* Title & Body */}
      <div>
        <h3
          onClick={() => onInspect(item)}
          style={{
            margin: "0 0 6px",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "var(--display)",
            color: "var(--fg)",
            cursor: "pointer",
            lineHeight: 1.35,
          }}
          title="Click to review details"
        >
          {item.title}
        </h3>
        {item.description ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>
            No additional notes provided.
          </p>
        )}
      </div>

      {/* Metadata tags */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          padding: "8px 10px",
          borderRadius: 8,
          background: "var(--sunk)",
          fontSize: 12,
          color: "var(--muted)",
          alignItems: "center",
        }}
      >
        {item.raisedBy && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <User size={13} style={{ color: "var(--muted)" }} />
            <span>Raised by: <strong style={{ color: "var(--fg)" }}>{item.raisedBy}</strong></span>
          </span>
        )}
        {item.companyName && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Building2 size={13} style={{ color: "var(--muted)" }} />
            <span>{item.companyName}</span>
          </span>
        )}
        {item.subModule && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <FolderGit2 size={13} style={{ color: "var(--muted)" }} />
            <span>Module: <strong style={{ color: "var(--fg)" }}>{item.subModule}</strong></span>
          </span>
        )}
        {item.effort && (
          <span>
            Effort: <strong style={{ color: "var(--fg)" }}>{item.effort}</strong>
          </span>
        )}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span>Assignees: </span>
          {item.assigneeNames.length > 0 ? (
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>
              {item.assigneeNames.join(", ")}
            </span>
          ) : (
            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Unassigned</span>
          )}
        </span>
      </div>

      {/* Action Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          paddingTop: 4,
          borderTop: "1px solid var(--line-soft, var(--line))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="btn"
            onClick={() => onInspect(item)}
            style={{
              padding: "5px 11px",
              height: 30,
              fontSize: 12.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Eye size={13} />
            Review
          </button>
          <Link
            href={item.href}
            className="btn"
            style={{
              padding: "5px 9px",
              height: 30,
              fontSize: 12.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--muted)",
            }}
            title="Open in original module"
          >
            <ExternalLink size={13} />
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {canManage ? (
            <>
              <button
                type="button"
                className="btn danger"
                onClick={() => onDecide(item, "reject")}
                style={{
                  padding: "5px 12px",
                  height: 30,
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <X size={14} />
                Reject
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => onDecide(item, "approve")}
                style={{
                  padding: "5px 14px",
                  height: 30,
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                  borderColor: "#0f766e",
                  color: "#ffffff",
                  boxShadow: "0 2px 6px rgba(15, 118, 110, 0.25)",
                }}
              >
                <Check size={14} />
                Approve
              </button>
            </>
          ) : (
            <Chip color="var(--warn)">Awaiting approval</Chip>
          )}
        </div>
      </div>
    </article>
  );
}
