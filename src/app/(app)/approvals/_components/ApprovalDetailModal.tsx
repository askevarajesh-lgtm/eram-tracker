"use client";

import React from "react";
import Link from "next/link";
import {
  Zap,
  Layers,
  GitPullRequest,
  Clock,
  Check,
  X,
  ExternalLink,
  User,
  Building2,
  FolderGit2,
  FileText,
} from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { duration, issuePriorityColor } from "@/lib/issues";
import { projectColor } from "@/lib/constants";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import type { QueueItem } from "./types";

export type ApprovalDetailModalProps = {
  item: QueueItem;
  now: number;
  canManage: boolean;
  onClose: () => void;
  onDecide: (item: QueueItem, act: "approve" | "reject") => void;
};

export function ApprovalDetailModal({
  item,
  now,
  canManage,
  onClose,
  onDecide,
}: ApprovalDetailModalProps) {
  const waitMs = Math.max(0, now - Date.parse(item.at));

  const getKindLabel = () => {
    switch (item.kind) {
      case "issue":
        return "Urgent Support Issue";
      case "task":
        return "Development Task";
      case "change":
        return "Change Request";
    }
  };

  const getKindChip = () => {
    switch (item.kind) {
      case "issue":
        return (
          <Chip color="var(--bad)">
            <Zap size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            Urgent Issue
          </Chip>
        );
      case "task":
        return (
          <Chip color="var(--warn)">
            <Layers size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            Dev Task
          </Chip>
        );
      case "change":
        return (
          <Chip color="var(--lms)">
            <GitPullRequest size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            Change Request
          </Chip>
        );
    }
  };

  return (
    <RecordDetailModal
      title={`${item.ref}: ${item.title}`}
      subtitle={`Submitted on ${new Date(item.at).toLocaleString()} · In queue for ${duration(waitMs)}`}
      badges={
        <>
          {getKindChip()}
          {item.projectName && (
            <Chip color={projectColor(item.projectName)} dot>
              {item.projectName}
            </Chip>
          )}
          {item.priority && (
            <Chip color={issuePriorityColor(item.priority)}>
              {item.priority}
            </Chip>
          )}
          <Chip color="var(--warn)">
            <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }} />
            Awaiting Approval
          </Chip>
        </>
      }
      onClose={onClose}
      canEdit={false}
      canDelete={false}
      extraFooter={
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "space-between" }}>
          <Link
            href={item.href}
            className="btn"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <ExternalLink size={14} />
            Open in {item.kind === "issue" ? "Issues" : item.kind === "task" ? "Tasks" : "Plan"}
          </Link>

          {canManage ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  onClose();
                  onDecide(item, "reject");
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px" }}
              >
                <X size={15} />
                Reject
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onClose();
                  onDecide(item, "approve");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                  borderColor: "#0f766e",
                  color: "#ffffff",
                  boxShadow: "0 2px 8px rgba(15, 118, 110, 0.28)",
                }}
              >
                <Check size={15} />
                Approve
              </button>
            </div>
          ) : (
            <span className="muted" style={{ fontSize: 12.5 }}>Admin / PM approval required</span>
          )}
        </div>
      }
      sections={[
        {
          title: "Request Details",
          items: [
            { label: "Item Type", value: getKindLabel() },
            { label: "Reference Code", value: <span className="mono" style={{ fontWeight: 700 }}>{item.ref}</span> },
            { label: "Priority", value: item.priority || "Normal" },
            { label: "Project", value: item.projectName || "General" },
            ...(item.subModule ? [{ label: "Sub-Module", value: item.subModule }] : []),
            ...(item.companyName ? [{ label: "Company", value: item.companyName }] : []),
            ...(item.effort ? [{ label: "Estimated Effort", value: item.effort }] : []),
          ],
        },
        {
          title: "Origin & Queue Context",
          items: [
            { label: "Raised By", value: item.raisedBy || "System / Unspecified" },
            { label: "Submitted At", value: new Date(item.at).toLocaleString() },
            { label: "Waiting Time", value: <strong style={{ color: "var(--warn)" }}>{duration(waitMs)}</strong> },
            {
              label: "Assigned Developers",
              value: item.assigneeNames.length > 0 ? (
                <span>{item.assigneeNames.join(", ")}</span>
              ) : (
                <span className="muted" style={{ fontStyle: "italic" }}>Not yet assigned</span>
              ),
            },
          ],
        },
        {
          title: "Description & Notes",
          items: [
            {
              label: "Summary / Notes",
              value: item.description ? (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{item.description}</div>
              ) : (
                <span className="muted" style={{ fontStyle: "italic" }}>No description provided.</span>
              ),
              full: true,
            },
          ],
        },
      ]}
    />
  );
}
