"use client";
import React, { useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  User,
  RotateCcw,
  Folder,
  Send,
  ExternalLink,
  Check,
} from "lucide-react";
import { fmtDay } from "@/lib/dates";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal, type DetailSection } from "@/components/ui/RecordDetailModal";
import { toast } from "@/components/ui/Toaster";
import { useCompose } from "@/components/shared/compose/Compose";
import type { TemplateKey } from "@/lib/settings-defaults";
import { deleteReminder, reminderDone } from "@/server/calendar";
import type { ReminderDTO } from "@/server/reminders-data";

const REPEAT: Record<string, string> = {
  none: "Once",
  daily: "Daily",
  weekdays: "Working days",
  weekly: "Weekly",
};

const SOURCE_LABEL: Record<string, string> = {
  milestone: "Milestone",
  task: "Task",
  meeting: "Meeting",
  licence: "Licence",
  rollout: "Rollout",
  standup: "Standup",
  issue: "Issue",
  manual: "Manual",
};

type ReminderDetailModalProps = {
  reminder: ReminderDTO;
  developers: { id: string; name: string }[];
  canEdit?: boolean;
  canManage?: boolean;
  onEdit?: () => void;
  onClose: () => void;
  onUpdated?: () => void;
};

export function ReminderDetailModal({
  reminder,
  developers,
  canEdit = true,
  canManage = true,
  onEdit,
  onClose,
  onUpdated,
}: ReminderDetailModalProps) {
  const compose = useCompose();
  const [busy, start] = useTransition();

  const devNames = reminder.developerIds
    .map((id) => developers.find((d) => d.id === id)?.name)
    .filter(Boolean);

  const srcLabel = SOURCE_LABEL[reminder.sourceType || "manual"] || reminder.sourceType || "Manual";

  const getSourceHref = () => {
    if (reminder.taskId) return `/tasks?view=${reminder.taskId}`;
    if (reminder.sourceType === "meeting" && reminder.id) return `/calendar?view=${reminder.id}`;
    if (reminder.sourceType === "issue") return `/issues`;
    if (reminder.sourceType === "licence") return `/licences`;
    return null;
  };

  const sourceHref = getSourceHref();

  const sections: DetailSection[] = [
    {
      title: "Schedule & Repeat",
      items: [
        {
          label: "Scheduled Date",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Calendar size={13} style={{ color: "var(--muted)" }} />
              <b>{fmtDay(reminder.date)}</b>
            </span>
          ),
        },
        {
          label: "Time",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} style={{ color: "var(--muted)" }} />
              <span>{reminder.time || "09:00"}</span>
            </span>
          ),
        },
        {
          label: "Repeat",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={13} style={{ color: "var(--muted)" }} />
              <span>{REPEAT[reminder.repeat] || reminder.repeat || "Once"}</span>
            </span>
          ),
        },
        {
          label: "Status",
          value: reminder.done ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ok)" }}>
              <CheckCircle2 size={14} />
              <b>Completed</b>
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--info)" }}>
              <Clock size={14} />
              <b>Pending</b>
            </span>
          ),
        },
      ],
    },
    {
      title: "Context & Assignments",
      items: [
        {
          label: "Source",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Bell size={13} style={{ color: "var(--accent)" }} />
              <span>{srcLabel}</span>
            </span>
          ),
        },
        {
          label: "Project",
          value: reminder.projectName ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Folder size={13} style={{ color: "var(--accent)" }} />
              <b>{reminder.projectName}</b>
            </span>
          ) : (
            <span className="muted">—</span>
          ),
        },
        {
          label: "Notify",
          full: true,
          value: devNames.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {devNames.map((name) => (
                <span
                  key={name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "var(--sunk)",
                    fontSize: 12,
                    border: "1px solid var(--line)",
                  }}
                >
                  <User size={12} style={{ color: "var(--muted)" }} />
                  <span>{name}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="muted">Unassigned</span>
          ),
        },
        ...(reminder.taskTitle || sourceHref
          ? [
              {
                label: "Linked Item",
                full: true,
                value: (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>{reminder.taskTitle || "Linked record"}</span>
                    {sourceHref && (
                      <Link
                        href={sourceHref}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "var(--accent)",
                          fontSize: 12,
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>Open</span>
                      </Link>
                    )}
                  </div>
                ),
              },
            ]
          : []),
      ],
    },
    ...(reminder.note
      ? [
          {
            title: "Notes & Details",
            items: [
              {
                label: "",
                full: true,
                value: (
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 13 }}>
                    {reminder.note}
                  </div>
                ),
              },
            ],
          },
        ]
      : []),
  ];

  const handleSend = () => {
    const custom = !reminder.template || reminder.template === "custom";
    compose({
      tpl: (reminder.template as TemplateKey) || "custom",
      devIds: reminder.developerIds,
      ...(custom
        ? {
            subject: "Reminder: " + reminder.title,
            body: `Hi {name},\n\nReminder: ${reminder.title}${
              reminder.note ? "\n" + reminder.note : ""
            }\n\n{link}`,
          }
        : {}),
      item: reminder.taskTitle
        ? { title: reminder.taskTitle, project: reminder.projectName || "", due: "" }
        : undefined,
    });
  };

  const handleDone = (snooze: boolean) => {
    start(async () => {
      const r = await reminderDone(reminder.id, snooze);
      if (r.ok) {
        toast(snooze ? "Snoozed +1 day" : reminder.repeat !== "none" ? "Moved to next cycle" : "Marked completed");
        onClose();
        if (onUpdated) onUpdated();
        else if (typeof window !== "undefined") window.location.reload();
      } else {
        toast(r.error || "Failed to update reminder");
      }
    });
  };

  const extraFooter = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {!reminder.done && canEdit && (
        <>
          <button
            type="button"
            className="btn"
            disabled={busy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              color: "var(--ok)",
              background: "rgba(21, 146, 74, 0.09)",
              border: "1px solid rgba(21, 146, 74, 0.28)",
            }}
            onClick={() => handleDone(false)}
          >
            <Check size={13} />
            <span>{reminder.repeat !== "none" ? "Done · Next" : "Mark Done"}</span>
          </button>

          <button
            type="button"
            className="btn"
            disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={() => handleDone(true)}
          >
            <Clock size={13} />
            <span>+1 Day</span>
          </button>
        </>
      )}

      <button
        type="button"
        className="btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
        onClick={handleSend}
      >
        <Send size={13} />
        <span>Send</span>
      </button>
    </div>
  );

  return (
    <RecordDetailModal
      title={reminder.title}
      subtitle={`${fmtDay(reminder.date)} · ${reminder.time || "09:00"}`}
      badges={
        <>
          <Chip color="var(--accent)">{srcLabel}</Chip>
          {reminder.done ? (
            <Chip color="var(--ok)" dot>Completed</Chip>
          ) : (
            <Chip color="var(--info)" dot>Pending</Chip>
          )}
          {reminder.repeat && reminder.repeat !== "none" && (
            <Chip color="var(--sunk)">{REPEAT[reminder.repeat] || reminder.repeat}</Chip>
          )}
        </>
      }
      sections={sections}
      onClose={onClose}
      onEdit={onEdit}
      canEdit={canEdit}
      canDelete={canManage}
      deleteConfirmTitle="Delete this reminder?"
      deleteConfirmMessage={`Are you sure you want to delete reminder "${reminder.title}"?`}
      onDelete={async () => {
        const r = await deleteReminder(reminder.id);
        if (!r.ok) {
          toast(r.error || "Failed to delete reminder");
          throw new Error(r.error);
        }
        toast("Reminder deleted");
        onClose();
        if (typeof window !== "undefined") window.location.reload();
      }}
      extraFooter={extraFooter}
    />
  );
}
