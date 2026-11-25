"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  Clock,
  MapPin,
  Video,
  Users,
  Trash2,
  ExternalLink,
  CheckSquare,
  Bell,
  Rocket,
  Briefcase,
  Building2,
  FileText,
} from "lucide-react";
import { formatTimeRange, getAttendees } from "./calendar-helpers";
import type { CalEvent, Dev, Rec, MeetingDTO } from "./CalendarTypes";

type Props = {
  event: CalEvent;
  meeting?: MeetingDTO;
  developers: Dev[];
  records: Rec[];
  canEdit: boolean;
  onClose: () => void;
  onOpenFullForm: (meetingId?: string) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onSaveQuickMeeting?: (m: Partial<MeetingDTO>) => void;
};

const QUICK_TYPES = [
  "Discussion",
  "User requirement session",
  "Demo",
  "Training",
  "UAT session",
  "Review",
];

const KIND_META: Record<
  CalEvent["kind"],
  { label: string; bg: string; color: string }
> = {
  meet: { label: "Meeting", bg: "#ede9fe", color: "#5b21b6" },
  due: { label: "Task Due Date", bg: "#e0f2fe", color: "#0369a1" },
  rem: { label: "Reminder", bg: "#fef3c7", color: "#92400e" },
  live: { label: "Rollout / Go-live", bg: "#ccfbf1", color: "#0f766e" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  progress: "In Progress",
  qa: "QA",
  uat: "UAT",
  hold: "On Hold",
  done: "Done",
  live: "Live",
  planned: "Planned",
};

export function EventQuickPopover({
  event,
  meeting,
  developers,
  records,
  canEdit,
  onClose,
  onOpenFullForm,
  onDeleteMeeting,
  onSaveQuickMeeting,
}: Props) {
  const [title, setTitle] = useState(event.title);
  const [selectedType, setSelectedType] = useState(
    event.meetingType || meeting?.type || "Discussion"
  );

  const attendees = meeting
    ? getAttendees(
        meeting.developerIds,
        meeting.inviteeRecordIds,
        meeting.guests,
        developers,
        records
      )
    : getAttendees(event.developerIds ?? [], [], "", developers, records);

  const dateLabel = new Date(event.date + "T00:00:00Z").toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
  );

  const kindInfo = KIND_META[event.kind];

  return (
    <div
      className="cal-popover-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cal-popover-card">
        {/* Kind Badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: kindInfo.bg,
              color: kindInfo.color,
            }}
          >
            {event.kind === "due" && <CheckSquare size={12} />}
            {event.kind === "rem" && <Bell size={12} />}
            {event.kind === "live" && <Rocket size={12} />}
            <span>{kindInfo.label}</span>
          </span>
          <button
            className="cal-popover-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Header: Title */}
        <div className="cal-popover-head">
          {event.kind === "meet" && canEdit ? (
            <input
              className="cal-popover-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event Title"
            />
          ) : (
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.35,
                color: "var(--fg)",
                fontFamily: "var(--display)",
                wordBreak: "break-word",
              }}
            >
              {event.title}
            </h3>
          )}
        </div>

        {/* Category Pills (Meetings only) */}
        {event.kind === "meet" && (
          <div className="cal-popover-tags">
            {QUICK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`cal-popover-tag ${
                  selectedType === t ? "active" : ""
                }`}
                onClick={() => canEdit && setSelectedType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Status / Priority / Progress Pills for Tasks & Rollouts */}
        {event.kind !== "meet" && (event.status || event.priority || event.progress != null || event.subtitle) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {event.status && (
              <span className="cal-popover-tag active" style={{ cursor: "default" }}>
                {STATUS_LABELS[event.status] ?? event.status}
              </span>
            )}
            {event.priority && (
              <span
                className="cal-popover-tag"
                style={{
                  cursor: "default",
                  background:
                    event.priority === "Urgent"
                      ? "color-mix(in srgb, var(--bad) 14%, transparent)"
                      : undefined,
                  color: event.priority === "Urgent" ? "var(--bad)" : undefined,
                  borderColor:
                    event.priority === "Urgent"
                      ? "color-mix(in srgb, var(--bad) 30%, transparent)"
                      : undefined,
                }}
              >
                {event.priority}
              </span>
            )}
            {event.progress != null && (
              <span className="cal-popover-tag" style={{ cursor: "default" }}>
                {event.progress}% complete
              </span>
            )}
            {event.subtitle && (
              <span className="cal-popover-tag" style={{ cursor: "default" }}>
                {event.subtitle}
              </span>
            )}
          </div>
        )}

        {/* Date and Time Row */}
        <div className="cal-popover-row">
          <Clock size={16} />
          <span>
            {dateLabel}
            {event.time && ` · ${formatTimeRange(event.time, event.endTime)}`}
          </span>
        </div>

        {/* Project / Company for non-meeting events */}
        {(event.projectName || event.companyName) && (
          <div className="cal-popover-row">
            {event.projectName ? <Briefcase size={16} /> : <Building2 size={16} />}
            <span>
              {[event.projectName, event.companyName].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}

        {/* Note / Description */}
        {event.note && (
          <div className="cal-popover-row" style={{ alignItems: "flex-start" }}>
            <FileText size={16} style={{ marginTop: 2 }} />
            <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
              {event.note}
            </span>
          </div>
        )}

        {/* Location / Mode (Meetings) */}
        {meeting && meeting.mode && (
          <div className="cal-popover-row">
            {meeting.mode.includes("Teams") || meeting.mode.includes("Meet") ? (
              <Video size={16} />
            ) : (
              <MapPin size={16} />
            )}
            <span>
              {meeting.mode}
              {meeting.location ? ` · ${meeting.location}` : ""}
            </span>
          </div>
        )}

        {/* Teammates / Assignees Section */}
        {(event.kind === "meet" || attendees.length > 0) && (
          <div className="cal-popover-teammates">
            <span className="cal-popover-subhead">
              <Users size={14} />
              <span>
                {event.kind === "meet"
                  ? `Teammates & Attendees (${attendees.length})`
                  : `Assigned (${attendees.length})`}
              </span>
            </span>
            <div className="cal-popover-chips">
              {attendees.map((a) => (
                <div key={a.id} className="cal-popover-chip">
                  <span
                    className="cal-popover-chip-av"
                    style={{ background: a.color }}
                  >
                    {a.initials}
                  </span>
                  <span>{a.name}</span>
                </div>
              ))}
              {attendees.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  No attendees assigned yet.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="cal-popover-actions">
          {meeting && canEdit && onDeleteMeeting ? (
            <button
              type="button"
              className="btn danger"
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={() => {
                if (confirm("Delete this meeting?")) {
                  onDeleteMeeting(meeting.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={13} style={{ marginRight: 4 }} />
              Delete
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {event.kind !== "meet" && event.href && (
              <Link
                href={event.href}
                className="btn primary"
                style={{ padding: "6px 14px", fontSize: 12, textDecoration: "none" }}
                onClick={onClose}
              >
                <ExternalLink size={13} style={{ marginRight: 4 }} />
                {event.kind === "due"
                  ? "Open Task"
                  : event.kind === "rem"
                  ? "Open Reminder"
                  : "Open Daily Board"}
              </Link>
            )}

            {meeting && (
              <button
                type="button"
                className="btn"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => {
                  onClose();
                  onOpenFullForm(meeting.id);
                }}
              >
                <ExternalLink size={13} style={{ marginRight: 4 }} />
                Full Details
              </button>
            )}

            {canEdit && event.kind === "meet" && onSaveQuickMeeting && meeting && (
              <button
                type="button"
                className="btn primary"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => {
                  onSaveQuickMeeting({
                    id: meeting.id,
                    title,
                    type: selectedType,
                  });
                  onClose();
                }}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
