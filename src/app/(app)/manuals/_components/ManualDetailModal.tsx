"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { projectColor } from "@/lib/constants";
import { fmtDay } from "@/lib/dates";
import { deleteManual } from "@/server/manuals";
import { Chip } from "@/components/ui/Chip";
import { Files } from "@/components/ui/Files";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { toast } from "@/components/ui/Toaster";
import type { ManualDTO } from "./ManualsView";

const STATUS_COLOR: Record<string, string> = {
  Draft: "var(--hold)",
  "In review": "var(--warn)",
  Published: "var(--ok)",
  Outdated: "var(--bad)",
};

const LEVEL_COLOR: Record<string, string> = {
  Admin: "var(--accent)",
  Manager: "var(--info)",
  Developer: "var(--lms)",
};

type Props = {
  manual: ManualDTO;
  projectName: string;
  ownerName: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export function ManualDetailModal({
  manual,
  projectName,
  ownerName,
  canEdit,
  canDelete,
  onEdit,
  onClose,
}: Props) {
  const handleDelete = async () => {
    const r = await deleteManual(manual.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete manual");
      return;
    }
    toast(`Manual "${manual.title}" deleted`);
  };

  return (
    <RecordDetailModal
      title={manual.title}
      subtitle={manual.updatedOn ? `Last updated ${fmtDay(manual.updatedOn)}` : undefined}
      badges={
        <>
          {projectName && (
            <Chip color={projectColor(projectName)} dot>
              {projectName}
            </Chip>
          )}
          <Chip color={LEVEL_COLOR[manual.level] ?? "var(--lms)"}>{manual.level}</Chip>
          <Chip color={STATUS_COLOR[manual.status] ?? "var(--hold)"} dot>
            {manual.status}
          </Chip>
          {manual.version && (
            <span className="mono muted" style={{ fontSize: 12, fontWeight: 600 }}>
              {manual.version}
            </span>
          )}
        </>
      }
      onClose={onClose}
      onEdit={canEdit ? onEdit : undefined}
      onDelete={canDelete ? handleDelete : undefined}
      canEdit={canEdit}
      canDelete={canDelete}
      deleteConfirmTitle={`Delete manual "${manual.title}"?`}
      deleteConfirmMessage="Are you sure you want to delete this user manual and all attached files? This action cannot be undone."
      extraFooter={
        manual.link ? (
          <a
            className="btn"
            href={manual.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            Open link
            <ExternalLink size={13} />
          </a>
        ) : undefined
      }
      sections={[
        {
          title: "Manual Information",
          items: [
            { label: "Project", value: projectName || "General / All projects" },
            { label: "Module", value: manual.subModule || "All modules" },
            { label: "Audience Level", value: manual.level },
            { label: "Status", value: manual.status },
            { label: "Version", value: <span className="mono">{manual.version || "—"}</span> },
            { label: "Language", value: manual.language || "English" },
            { label: "Owner", value: ownerName || "—" },
            { label: "Last Updated", value: manual.updatedOn ? fmtDay(manual.updatedOn) : "—" },
          ],
        },
        {
          title: "Links & Attachments",
          items: [
            {
              label: "External Link",
              full: true,
              value: manual.link ? (
                <a
                  href={manual.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", wordBreak: "break-all", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span>{manual.link}</span>
                  <ExternalLink size={13} style={{ flexShrink: 0 }} />
                </a>
              ) : (
                "—"
              ),
            },
            {
              label: `Attached Files (${manual.files.length})`,
              full: true,
              value: (
                <Files
                  kind="manual"
                  id={manual.id}
                  files={manual.files}
                  canEdit={canEdit}
                  canRemove={canDelete}
                />
              ),
            },
          ],
        },
        ...(manual.notes
          ? [
              {
                title: "Notes / Coverage Scope",
                items: [
                  {
                    label: "What it covers",
                    value: <span style={{ whiteSpace: "pre-wrap" }}>{manual.notes}</span>,
                    full: true,
                  },
                ],
              },
            ]
          : []),
      ]}
    />
  );
}
