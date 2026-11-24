"use client";
import React, { useTransition } from "react";
import Link from "next/link";
import { Zap, Clock, Activity } from "lucide-react";
import { ISSUE_STATUS_MAP, issuePriorityColor, duration, isOpenIssue } from "@/lib/issues";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { deleteIssue, issueToTask } from "@/server/issues";
import { toast } from "@/components/ui/Toaster";
import { SlaCell } from "./IssuesView";
import type { IssueDTO, IssueViewer, Sla } from "./types";

type Props = {
  issue: IssueDTO;
  sla: Sla;
  viewer: IssueViewer;
  now: number;
  onEdit: () => void;
  onClose: () => void;
};

export function IssueDetailModal({ issue, sla, viewer, now, onEdit, onClose }: Props) {
  const [busy, start] = useTransition();
  const st = ISSUE_STATUS_MAP[issue.status];
  const canEdit = viewer.canManage || (viewer.role === "Developer" && (!issue.assigneeIds.length || issue.assigneeIds.includes(viewer.developerId ?? "")));
  const canDelete = viewer.canManage;

  const handleDelete = async () => {
    const r = await deleteIssue(issue.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete issue");
      return;
    }
    toast(`Issue ${issue.id} deleted`);
  };

  const convertToTask = () => {
    start(async () => {
      const r = await issueToTask(issue.id);
      if (!r.ok) {
        toast(r.error ?? "Failed to convert issue");
        return;
      }
      toast(`Created development task #${r.data!.sno}`);
      onClose();
    });
  };

  return (
    <RecordDetailModal
      title={`${issue.id}: ${issue.title}`}
      subtitle={`Raised: ${new Date(issue.createdAt).toLocaleString()}`}
      badges={
        <>
          <Chip color={issuePriorityColor(issue.priority)}>
            {issue.priority === "Urgent" && (
              <Zap size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
            )}
            {issue.priority || "Normal"}
          </Chip>
          <Chip color={st?.color ?? "var(--hold)"} dot>
            {st?.label ?? issue.status}
          </Chip>
          {issue.projectName && <Chip color="var(--accent)">{issue.projectName}</Chip>}
          {issue.approvalState === "pending" && (
            <Chip color="var(--warn)">
              <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }} />
              Awaiting approval
            </Chip>
          )}
          {issue.taskSno != null && (
            <Link href={`/tasks?edit=${issue.id}`} onClick={(e) => e.stopPropagation()}>
              <Chip color="var(--ok)">Linked to Dev Task #{issue.taskSno}</Chip>
            </Link>
          )}
        </>
      }
      onClose={onClose}
      onEdit={canEdit ? onEdit : undefined}
      onDelete={canDelete ? handleDelete : undefined}
      canEdit={canEdit}
      canDelete={canDelete}
      deleteConfirmTitle={`Delete ${issue.id}?`}
      deleteConfirmMessage={`Are you sure you want to delete urgent issue ${issue.id} "${issue.title}"? This action cannot be undone.`}
      extraFooter={
        viewer.canManage && issue.taskSno == null ? (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={convertToTask}
            title="Convert to development task"
          >
            {busy ? "Converting…" : "→ Dev task"}
          </button>
        ) : undefined
      }
      sections={[
        {
          title: "Issue Information",
          items: [
            { label: "Token ID", value: <span className="mono font-semibold">{issue.id}</span> },
            { label: "System / Project", value: issue.projectName || "—" },
            { label: "Company", value: issue.companyName || "—" },
            { label: "Raised By", value: issue.raisedBy || "—" },
            { label: "Contact Info", value: issue.contact || "—" },
            {
              label: "Assigned Developers",
              value: issue.assigneeNames.length ? issue.assigneeNames.join(", ") : "Unassigned",
            },
          ],
        },
        {
          title: "Response & Resolution",
          items: [
            {
              label: "Response Target / Status",
              value: <SlaCell x={issue} sla={sla} now={now} />,
            },
            {
              label: "Resolved At",
              value: issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString() : "Not resolved yet",
            },
            {
              label: "Approval Decision",
              value: issue.approvalState
                ? `${issue.approvalState.toUpperCase()} by ${issue.approvalBy || "Manager"}`
                : "Not required",
            },
            {
              label: "Resolution Summary",
              value: issue.resolution || "No resolution details entered.",
              full: true,
            },
          ],
        },
        {
          title: "Description",
          items: [
            {
              label: "Issue Details",
              value: (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {issue.description || "No description entered."}
                </div>
              ),
              full: true,
            },
          ],
        },
      ]}
    >
      {issue.events && issue.events.length > 0 && (
        <div className="record-detail-section" style={{ marginTop: 20 }}>
          <div className="record-detail-section-header">
            <div className="record-detail-section-icon">
              <Activity size={13} />
            </div>
            <h4 className="record-detail-section-title">Activity & History</h4>
            <span className="record-detail-section-count">
              {issue.events.length} {issue.events.length === 1 ? "event" : "events"}
            </span>
            <div className="record-detail-section-line" />
          </div>
          <div className="record-detail-timeline-card">
            {issue.events.map((ev, idx) => (
              <div key={idx} className="record-detail-timeline-item">
                <div className="record-detail-timeline-rail">
                  <div className="record-detail-timeline-dot" />
                  {idx < issue.events.length - 1 && <div className="record-detail-timeline-track" />}
                </div>
                <div className="record-detail-timeline-content">
                  <div className="record-detail-timeline-time">
                    {new Date(ev.at).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(ev.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="record-detail-timeline-message">{ev.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </RecordDetailModal>
  );
}
