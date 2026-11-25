"use client";
import React, { useTransition } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Building2,
  Folder,
  User,
  Download,
  Mail,
  ListTodo,
} from "lucide-react";
import { fmtDay } from "@/lib/dates";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal, type DetailSection } from "@/components/ui/RecordDetailModal";
import { toast } from "@/components/ui/Toaster";
import { useCompose } from "@/components/shared/compose/Compose";
import { deleteMeeting, meetingActionsToTasks } from "@/server/calendar";
import { getAttendees, icsDownload } from "./calendar-helpers";
import type { Dev, MeetingDTO, Rec } from "./CalendarTypes";

type MeetingDetailModalProps = {
  meeting: MeetingDTO;
  developers: Dev[];
  records: Rec[];
  projects: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  canEdit?: boolean;
  canManage?: boolean;
  onEdit?: () => void;
  onClose: () => void;
};

const STATUS_COLOR: Record<string, string> = {
  Planned: "var(--info)",
  Done: "var(--ok)",
  Cancelled: "var(--bad)",
};

export function MeetingDetailModal({
  meeting,
  developers,
  records,
  projects,
  companies,
  canEdit = true,
  canManage = true,
  onEdit,
  onClose,
}: MeetingDetailModalProps) {
  const compose = useCompose();
  const [busy, start] = useTransition();

  const projectName = projects.find((p) => p.id === meeting.projectId)?.name;
  const companyName = companies.find((c) => c.id === meeting.companyId)?.name;

  const allAttendees = getAttendees(
    meeting.developerIds,
    meeting.inviteeRecordIds,
    meeting.guests,
    developers,
    records
  );

  const devAttendees = allAttendees.filter((a) => a.type === "Developer");
  const userAttendees = allAttendees.filter((a) => a.type === "User");
  const guestAttendees = allAttendees.filter((a) => a.type === "Guest");

  const isLink = meeting.location?.startsWith("http://") || meeting.location?.startsWith("https://");

  const sections: DetailSection[] = [
    {
      title: "Schedule & Location",
      items: [
        {
          label: "Date",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Calendar size={13} style={{ color: "var(--muted)" }} />
              <b>{fmtDay(meeting.date)}</b>
            </span>
          ),
        },
        {
          label: "Time",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} style={{ color: "var(--muted)" }} />
              <span>
                {meeting.startTime}
                {meeting.endTime ? ` – ${meeting.endTime}` : ""}
              </span>
            </span>
          ),
        },
        {
          label: "Where",
          value: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {meeting.mode.includes("Teams") || meeting.mode.includes("Meet") || meeting.mode.includes("Zoom") ? (
                <Video size={13} style={{ color: "var(--accent)" }} />
              ) : (
                <MapPin size={13} style={{ color: "var(--muted)" }} />
              )}
              <span>{meeting.mode}</span>
            </span>
          ),
        },
        {
          label: "Meeting Link / Room",
          value: meeting.location ? (
            isLink ? (
              <a
                href={meeting.location}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)", textDecoration: "underline", wordBreak: "break-all" }}
              >
                {meeting.location}
              </a>
            ) : (
              <span>{meeting.location}</span>
            )
          ) : (
            <span className="muted">—</span>
          ),
        },
        {
          label: "Reminder",
          value: meeting.remindMinutes ? (
            meeting.remindMinutes >= 1440
              ? `${Math.round(meeting.remindMinutes / 1440)} day before`
              : meeting.remindMinutes >= 60
              ? `${Math.round(meeting.remindMinutes / 60)} hour before`
              : `${meeting.remindMinutes} min before`
          ) : (
            <span className="muted">No reminder</span>
          ),
        },
      ],
    },
    {
      title: "Context & Organization",
      items: [
        {
          label: "System",
          value: projectName ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Folder size={13} style={{ color: "var(--accent)" }} />
              <b>{projectName}</b>
            </span>
          ) : (
            <span className="muted">—</span>
          ),
        },
        {
          label: "Company",
          value: companyName ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Building2 size={13} style={{ color: "var(--muted)" }} />
              <span>{companyName}</span>
            </span>
          ) : (
            <span className="muted">—</span>
          ),
        },
        {
          label: "Organizer",
          value: meeting.organizer ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <User size={13} style={{ color: "var(--muted)" }} />
              <span>{meeting.organizer}</span>
            </span>
          ) : (
            <span className="muted">—</span>
          ),
        },
      ],
    },
    {
      title: "Attendees",
      items: [
        {
          label: "Developers",
          full: true,
          value: devAttendees.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {devAttendees.map((d) => (
                <span
                  key={d.id}
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
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: d.color,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {d.initials}
                  </span>
                  <span>{d.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="muted">No developers assigned</span>
          ),
        },
        {
          label: "Business Users",
          full: true,
          value: userAttendees.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {userAttendees.map((u) => (
                <span
                  key={u.id}
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
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: u.color,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {u.initials}
                  </span>
                  <span>{u.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="muted">None</span>
          ),
        },
        ...(guestAttendees.length
          ? [
              {
                label: "Other Guests",
                full: true,
                value: (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {guestAttendees.map((g) => (
                      <span
                        key={g.id}
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
                        <Users size={12} style={{ color: "var(--muted)" }} />
                        <span>{g.name}</span>
                      </span>
                    ))}
                  </div>
                ),
              },
            ]
          : []),
      ],
    },
    ...(meeting.agenda
      ? [
          {
            title: "Agenda",
            items: [
              {
                label: "",
                full: true,
                value: (
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 13 }}>
                    {meeting.agenda}
                  </div>
                ),
              },
            ],
          },
        ]
      : []),
    ...(meeting.minutes
      ? [
          {
            title: "Minutes & Decisions",
            items: [
              {
                label: "",
                full: true,
                value: (
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 13 }}>
                    {meeting.minutes}
                  </div>
                ),
              },
            ],
          },
        ]
      : []),
  ];

  const handleInvite = () => {
    const when = new Date(meeting.date + "T00:00:00Z").toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    compose({
      tpl: "custom",
      devIds: devAttendees.map((a) => a.id),
      extra: [...userAttendees, ...guestAttendees].map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        whatsapp: "",
      })),
      subject: `Invitation: ${meeting.title} – ${fmtDay(meeting.date)} ${meeting.startTime}`,
      body: `Hi {name},\n\nYou're invited to ${
        meeting.type || "a meeting"
      }: ${meeting.title}\n\nWhen: ${when}, ${meeting.startTime}${
        meeting.endTime ? "–" + meeting.endTime : ""
      }\nWhere: ${meeting.mode}${meeting.location ? " · " + meeting.location : ""}${
        meeting.organizer ? "\nOrganizer: " + meeting.organizer : ""
      }${meeting.agenda ? "\n\nAgenda:\n" + meeting.agenda : ""}\n\n{link}`,
    });
  };

  const extraFooter = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
        onClick={() => {
          icsDownload(
            meeting,
            allAttendees.map((a) => ({ name: a.name, email: a.email }))
          );
          toast("Calendar file downloaded");
        }}
      >
        <Download size={13} />
        <span>.ics</span>
      </button>

      {allAttendees.length > 0 && (
        <button
          type="button"
          className="btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          onClick={handleInvite}
        >
          <Mail size={13} />
          <span>Invite</span>
        </button>
      )}

      {canManage && meeting.minutes && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          onClick={() =>
            start(async () => {
              const r = await meetingActionsToTasks(meeting.id);
              if (!r.ok) {
                toast(r.error || "Failed to convert actions to tasks");
              } else {
                const cnt = r.data?.count ?? 0;
                toast(
                  `Created ${cnt} task${cnt === 1 ? "" : "s"} from action items`
                );
              }
            })
          }
        >
          <ListTodo size={13} />
          <span>Actions → tasks</span>
        </button>
      )}
    </div>
  );

  return (
    <RecordDetailModal
      title={meeting.title}
      subtitle={`${fmtDay(meeting.date)} · ${meeting.startTime}${meeting.endTime ? " – " + meeting.endTime : ""}`}
      badges={
        <>
          <Chip color="var(--accent)">{meeting.type || "Meeting"}</Chip>
          <Chip color={STATUS_COLOR[meeting.status] || "var(--info)"} dot>
            {meeting.status}
          </Chip>
          {meeting.mode && <Chip color="var(--sunk)">{meeting.mode}</Chip>}
        </>
      }
      sections={sections}
      onClose={onClose}
      onEdit={onEdit}
      canEdit={canEdit}
      canDelete={canManage}
      deleteConfirmTitle="Delete this meeting?"
      deleteConfirmMessage={`Are you sure you want to delete meeting "${meeting.title}"? This cannot be undone.`}
      onDelete={async () => {
        const r = await deleteMeeting(meeting.id);
        if (!r.ok) {
          toast(r.error || "Failed to delete meeting");
          throw new Error(r.error);
        }
        toast("Meeting deleted");
        onClose();
        if (typeof window !== "undefined") window.location.reload();
      }}
      extraFooter={extraFooter}
    />
  );
}
