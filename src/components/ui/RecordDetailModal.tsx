"use client";
import React, { useState, useTransition } from "react";
import {
  Edit2,
  Trash2,
  X,
  Copy,
  Check,
  Clock,
  User,
  CheckCircle2,
  FileText,
  Calendar,
  Shield,
  Building2,
  Layers,
  Activity,
  Tag,
} from "lucide-react";
import { Panel } from "./Panel";
import { confirmAction } from "./ConfirmCloseModal";
import { toast } from "./Toaster";

export type DetailItem = {
  label: React.ReactNode;
  value: React.ReactNode;
  span?: number;
  full?: boolean;
};

export type DetailSection = {
  title?: string;
  items: DetailItem[];
};

export type RecordDetailModalProps = {
  title: string;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  wide?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<unknown> | void;
  canEdit?: boolean;
  canDelete?: boolean;
  deleteTitle?: string;
  editTitle?: string;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
  sections?: DetailSection[];
  items?: DetailItem[];
  children?: React.ReactNode;
  extraFooter?: React.ReactNode;
};

function getSectionIcon(title?: string) {
  if (!title) return <Layers size={13} />;
  const t = title.toLowerCase();
  if (t.includes("info") || t.includes("personal") || t.includes("profile") || t.includes("contact") || t.includes("people")) {
    return <User size={13} />;
  }
  if (t.includes("response") || t.includes("resolution") || t.includes("decision") || t.includes("approval")) {
    return <CheckCircle2 size={13} />;
  }
  if (t.includes("description") || t.includes("note") || t.includes("detail")) {
    return <FileText size={13} />;
  }
  if (t.includes("schedule") || t.includes("progress") || t.includes("date") || t.includes("time") || t.includes("timeline")) {
    return <Calendar size={13} />;
  }
  if (t.includes("licence") || t.includes("access") || t.includes("system") || t.includes("security") || t.includes("auth")) {
    return <Shield size={13} />;
  }
  if (t.includes("company") || t.includes("organisation") || t.includes("branch")) {
    return <Building2 size={13} />;
  }
  if (t.includes("task") || t.includes("assignment") || t.includes("output")) {
    return <Layers size={13} />;
  }
  if (t.includes("activity") || t.includes("history") || t.includes("event") || t.includes("log")) {
    return <Activity size={13} />;
  }
  return <Tag size={13} />;
}

export function RecordDetailModal({
  title,
  subtitle,
  badges,
  wide = true,
  onClose,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  deleteTitle = "Delete",
  editTitle = "Edit",
  deleteConfirmTitle = "Delete this record?",
  deleteConfirmMessage = "Are you sure you want to delete this record? This action cannot be undone.",
  sections,
  items,
  children,
  extraFooter,
}: RecordDetailModalProps) {
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleDelete = async () => {
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
        onClose();
      });
    }
  };

  const allSections: DetailSection[] = sections
    ? sections
    : items
    ? [{ items }]
    : [];

  // Parse Title into ID/Category badge and main title if colon is present
  const colonIdx = title.indexOf(":");
  let idOrCategory: string | null = null;
  let displayTitle = title;
  let isCopyableId = false;

  if (colonIdx > 0 && colonIdx < 35) {
    idOrCategory = title.slice(0, colonIdx).trim();
    displayTitle = title.slice(colonIdx + 1).trim();
    // Check if it's an ID/code token (e.g. TKN-..., Task #..., Issue #...)
    isCopyableId = /^(TKN|Task|Issue|Ref|ID|DOC|TICKET|SNO|BUG)[\s#_-]/i.test(idOrCategory) || /^[A-Z0-9_-]{4,}$/i.test(idOrCategory);
  }

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast(`Copied ${text} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const customHead = ({ requestClose }: { requestClose: () => void }) => (
    <div className="record-detail-head">
      <div className="record-detail-head-main">
        <div className="record-detail-title-row">
          {idOrCategory && (
            <span className={isCopyableId ? "record-detail-id-badge" : "record-detail-category-badge"}>
              {idOrCategory}
              {isCopyableId && (
                <button
                  type="button"
                  className="record-detail-copy-btn"
                  onClick={() => handleCopy(idOrCategory!)}
                  title={`Copy ${idOrCategory}`}
                  aria-label={`Copy ${idOrCategory}`}
                >
                  {copied ? <Check size={12} style={{ color: "var(--ok)" }} /> : <Copy size={12} />}
                </button>
              )}
            </span>
          )}
          <h2 className="record-detail-title-text">{displayTitle}</h2>
        </div>
        {subtitle && (
          <div className="record-detail-subtitle">
            <Clock size={12} style={{ opacity: 0.7 }} />
            <span>{subtitle}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        className="record-detail-close-btn"
        onClick={requestClose}
        aria-label="Close"
        title="Close (Esc)"
      >
        <X size={18} />
      </button>
    </div>
  );

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      wide={wide}
      onClose={onClose}
      panelClassName="record-detail-panel"
      customHead={customHead}
      footer={({ requestClose }) => (
        <div className="record-detail-footer">
          <div className="record-detail-footer-left">
            {onDelete && canDelete && (
              <button
                type="button"
                className="btn record-detail-btn-danger"
                disabled={busy}
                onClick={handleDelete}
              >
                <Trash2 size={14} />
                <span>{busy ? "Deleting…" : deleteTitle}</span>
              </button>
            )}
          </div>
          <div className="record-detail-footer-right">
            {extraFooter}
            <button
              type="button"
              className="btn record-detail-btn-secondary"
              onClick={requestClose}
            >
              <span>Close</span>
              <kbd className="record-detail-kbd">Esc</kbd>
            </button>
            {onEdit && canEdit && (
              <button
                type="button"
                className="btn primary record-detail-btn-primary"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
              >
                <Edit2 size={14} />
                <span>{editTitle}</span>
              </button>
            )}
          </div>
        </div>
      )}
    >
      {badges && (
        <div className="record-detail-status-banner">
          <div className="record-detail-badges-list">
            {badges}
          </div>
          <div className="record-detail-status-indicator">
            <span className="record-detail-status-pulse" />
            <span>Record Details</span>
          </div>
        </div>
      )}

      {allSections.map((sec, sIdx) => {
        const regularItems = sec.items.filter(it => !it.full && it.span !== 2);
        const fullItems = sec.items.filter(it => it.full || it.span === 2);

        return (
          <div key={sIdx} className="record-detail-section">
            {sec.title && (
              <div className="record-detail-section-header">
                <div className="record-detail-section-icon">
                  {getSectionIcon(sec.title)}
                </div>
                <h4 className="record-detail-section-title">{sec.title}</h4>
                <span className="record-detail-section-count">
                  {sec.items.length} {sec.items.length === 1 ? "field" : "fields"}
                </span>
                <div className="record-detail-section-line" />
              </div>
            )}

            <div className="record-detail-card">
              {regularItems.length > 0 && (
                <div className="record-detail-grid">
                  {regularItems.map((it, iIdx) => (
                    <div key={iIdx} className="record-detail-field-card">
                      <div className="record-detail-field-label">{it.label}</div>
                      <div className="record-detail-field-value">
                        {it.value !== null && it.value !== undefined && it.value !== "" ? (
                          it.value
                        ) : (
                          <span className="record-detail-empty-dash">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {fullItems.length > 0 && (
                <div
                  className="record-detail-content-list"
                  style={{ marginTop: regularItems.length > 0 ? 12 : 0 }}
                >
                  {fullItems.map((it, fIdx) => (
                    <div key={fIdx} className="record-detail-content-card">
                      <div className="record-detail-content-header">
                        <span className="record-detail-content-label">{it.label}</span>
                      </div>
                      <div className="record-detail-content-body">
                        {it.value !== null && it.value !== undefined && it.value !== "" ? (
                          it.value
                        ) : (
                          <span className="record-detail-empty-dash">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {children}
    </Panel>
  );
}
