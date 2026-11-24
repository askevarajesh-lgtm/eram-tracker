"use client";
import React, { useTransition } from "react";
import { Eye, Edit2, Trash2 } from "lucide-react";
import { confirmAction } from "./ConfirmCloseModal";

export type RecordActionsProps = {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<unknown> | void;
  viewTitle?: string;
  editTitle?: string;
  deleteTitle?: string;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  extra?: React.ReactNode;
  showLabels?: boolean;
};

export function RecordActions({
  onView,
  onEdit,
  onDelete,
  viewTitle = "View details",
  editTitle = "Edit",
  deleteTitle = "Delete",
  deleteConfirmTitle = "Delete this record?",
  deleteConfirmMessage = "Are you sure you want to delete this record? This action cannot be undone.",
  canEdit = true,
  canDelete = true,
  extra,
  showLabels = false,
}: RecordActionsProps) {
  const [busy, start] = useTransition();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete || busy) return;

    const ok = await confirmAction({
      title: deleteConfirmTitle,
      message: deleteConfirmMessage,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });

    if (ok) {
      start(async () => {
        await onDelete();
      });
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: showLabels ? "4px 9px" : "4px 7px",
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    fontSize: 12,
    lineHeight: 1,
    borderRadius: 6,
    cursor: "pointer",
  };

  return (
    <div
      className="record-actions"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {extra}

      {onView && (
        <button
          type="button"
          className="btn"
          style={btnStyle}
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          title={viewTitle}
          aria-label={viewTitle}
        >
          <Eye size={13} style={{ display: "inline-block", verticalAlign: "-1px" }} />
          {showLabels && <span>View</span>}
        </button>
      )}

      {onEdit && canEdit && (
        <button
          type="button"
          className="btn"
          style={btnStyle}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title={editTitle}
          aria-label={editTitle}
        >
          <Edit2 size={13} style={{ display: "inline-block", verticalAlign: "-1px" }} />
          {showLabels && <span>Edit</span>}
        </button>
      )}

      {onDelete && canDelete && (
        <button
          type="button"
          className="btn danger"
          style={btnStyle}
          disabled={busy}
          onClick={handleDelete}
          title={deleteTitle}
          aria-label={deleteTitle}
        >
          <Trash2 size={13} style={{ display: "inline-block", verticalAlign: "-1px" }} />
          {showLabels && <span>{busy ? "Deleting…" : "Delete"}</span>}
        </button>
      )}
    </div>
  );
}
