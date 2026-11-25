"use client";
import React from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  CheckSquare,
  ExternalLink,
  Rocket,
} from "lucide-react";
import { today } from "@/lib/dates";
import { getAttendees, getEventTheme } from "./calendar-helpers";
import type { CalEvent, Dev, Rec, MeetingDTO } from "./CalendarTypes";

type Props = {
  month: string;
  events: CalEvent[];
  meetings: MeetingDTO[];
  developers: Dev[];
  records: Rec[];
  onSelectEvent: (e: CalEvent) => void;
};

const KIND_LABEL: Record<CalEvent["kind"], string> = {
  meet: "Meeting",
  due: "Task due",
  rem: "Reminder",
  live: "Rollout",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  progress: "In Progress",
  qa: "QA",
  uat: "UAT",
  hold: "On Hold",
  done: "Done",
  live: "Live",
  planned: "Planned",
};

export function AgendaView({
  month,
  events,
  meetings,
  developers,
  records,
  onSelectEvent,
}: Props) {
  const T = today();
  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  // Show all events in the selected month's visible grid range, sorted chronologically
  const monthEvents = [...events].sort((a, b) =>
    (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99"))
  );

  return (
    <div className="cal-agenda-wrap">
      <div className="cal-agenda-summary">
        <span className="cal-agenda-count">
          {monthEvents.length} item{monthEvents.length === 1 ? "" : "s"} in{" "}
          {monthLabel}
        </span>
      </div>

      {monthEvents.length === 0 ? (
        <div className="empty">
          <b>Nothing scheduled in {monthLabel}</b>
          <p>
            Use the month arrows or mini-calendar to browse other months, or
            schedule a meeting.
          </p>
        </div>
      ) : (
        <div className="cal-agenda-table-wrap">
          <table className="cal-agenda-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Type</th>
                <th>Event / Details</th>
                <th>Status</th>
                <th>Assignees</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {monthEvents.map((e) => {
                const mt =
                  e.kind === "meet"
                    ? meetings.find((x) => x.id === e.id)
                    : undefined;
                const attendees = mt
                  ? getAttendees(
                      mt.developerIds,
                      mt.inviteeRecordIds,
                      mt.guests,
                      developers,
                      records
                    )
                  : getAttendees(
                      e.developerIds ?? [],
                      [],
                      "",
                      developers,
                      records
                    );
                const themeClass = getEventTheme(e);
                const isToday = e.date === T;
                const dateText = new Date(
                  e.date + "T00:00:00Z"
                ).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                });

                const subText = mt
                  ? [mt.type, mt.mode, mt.location].filter(Boolean).join(" · ")
                  : [e.subtitle, e.projectName, e.companyName]
                      .filter(Boolean)
                      .join(" · ");

                const statusText = e.status
                  ? STATUS_LABEL[e.status] ?? e.status
                  : e.priority ?? "—";

                return (
                  <tr
                    key={e.kind + e.id}
                    className="cal-agenda-row"
                    onClick={() => onSelectEvent(e)}
                  >
                    <td className="cal-agenda-date-cell">
                      <span>{dateText}</span>
                      {isToday && (
                        <span className="cal-agenda-today-pill">Today</span>
                      )}
                    </td>

                    <td>
                      <span className="cal-agenda-time">
                        {e.time
                          ? `${e.time}${mt?.endTime ? `–${mt.endTime}` : ""}`
                          : "All day"}
                      </span>
                    </td>

                    <td>
                      <span className={`cal-agenda-type-pill ${themeClass}`}>
                        {e.kind === "meet" && <Calendar size={12} />}
                        {e.kind === "due" && <CheckSquare size={12} />}
                        {e.kind === "rem" && <Bell size={12} />}
                        {e.kind === "live" && <Rocket size={12} />}
                        <span>{KIND_LABEL[e.kind]}</span>
                      </span>
                    </td>

                    <td>
                      <div
                        className="cal-agenda-title"
                        style={
                          e.status === "Cancelled"
                            ? { textDecoration: "line-through", opacity: 0.7 }
                            : undefined
                        }
                      >
                        {e.title}
                      </div>
                      {subText && (
                        <div className="cal-agenda-sub">{subText}</div>
                      )}
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            e.priority === "Urgent"
                              ? "var(--bad)"
                              : "var(--muted)",
                        }}
                      >
                        {statusText}
                        {e.priority && e.status ? ` · ${e.priority}` : ""}
                      </span>
                    </td>

                    <td>
                      {attendees.length > 0 ? (
                        <div className="cal-card-avatars">
                          {attendees.slice(0, 4).map((a) => (
                            <div
                              key={a.id}
                              className="cal-card-av"
                              style={{
                                background: a.color,
                                width: 24,
                                height: 24,
                                fontSize: 9,
                              }}
                              title={a.name}
                            >
                              {a.initials}
                            </div>
                          ))}
                          {attendees.length > 4 && (
                            <div
                              className="cal-card-av"
                              style={{
                                background: "var(--muted)",
                                width: 24,
                                height: 24,
                                fontSize: 9,
                              }}
                            >
                              +{attendees.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>
                          —
                        </span>
                      )}
                    </td>

                    <td
                      style={{ textAlign: "right", whiteSpace: "nowrap" }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.href ? (
                        <Link
                          href={e.href}
                          className="btn"
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ExternalLink size={12} />
                          Open
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => onSelectEvent(e)}
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
