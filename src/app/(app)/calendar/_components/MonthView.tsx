"use client";
import React, { useState } from "react";
import {
  Bell,
  Calendar,
  CheckSquare,
  ChevronRight,
  Clock,
  Plus,
  Rocket,
  X,
} from "lucide-react";
import { today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { WEEKDAYS } from "@/lib/settings-defaults";
import { formatTimeRange, getEventTheme } from "./calendar-helpers";
import type { CalEvent } from "./CalendarTypes";

type Props = {
  month: string;
  selected: string;
  gridStart: string;
  events: CalEvent[];
  canEdit: boolean;
  onSelectDate: (d: string) => void;
  onSelectEvent: (e: CalEvent) => void;
  onQuickAdd: (d: string) => void;
};

const KIND_LABEL: Record<CalEvent["kind"], string> = {
  meet: "Meeting",
  due: "Task due",
  rem: "Reminder",
  live: "Rollout",
};

export function MonthView({
  month,
  selected,
  gridStart,
  events,
  canEdit,
  onSelectDate,
  onSelectEvent,
  onQuickAdd,
}: Props) {
  const T = today();
  const days = Array.from({ length: 42 }, (_, k) => addDays(gridStart, k));
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const expandedEvents = expandedDate
    ? events.filter((e) => e.date === expandedDate)
    : [];

  const expandedLabel = expandedDate
    ? new Date(expandedDate + "T00:00:00Z").toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

  return (
    <div className="cal-month-wrap">
      {/* 1. Weekday Table Header */}
      <div className="cal-month-head">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-month-th">
            {w}
          </div>
        ))}
      </div>

      {/* 2. 42-day Month Grid */}
      <div className="cal-month-grid">
        {days.map((x) => {
          const dayEvents = events.filter((e) => e.date === x);
          const inMonth = x.slice(0, 7) === month;
          const isToday = x === T;
          const isSelected = x === selected;
          const dayNum = parseInt(x.slice(8), 10);

          return (
            <div
              key={x}
              className={`cal-month-cell ${!inMonth ? "other-month" : ""} ${
                isToday ? "today" : ""
              } ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectDate(x)}
              onDoubleClick={() => {
                if (canEdit) onQuickAdd(x);
              }}
            >
              <div className="cal-month-cell-top">
                <span className="cal-month-daynum">{dayNum}</span>
                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    className="cal-more-btn"
                    style={{ marginTop: 0, fontSize: 10 }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectDate(x);
                      setExpandedDate(x);
                    }}
                    title="View all items on this day"
                  >
                    {dayEvents.length} items
                  </button>
                )}
              </div>

              {/* Event Chips */}
              {dayEvents.slice(0, 3).map((e) => {
                const themeClass = getEventTheme(e);
                return (
                  <div
                    key={e.kind + e.id}
                    className={`cal-month-chip ${themeClass}`}
                    title={e.title}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelectEvent(e);
                    }}
                  >
                    {e.kind === "rem" && <Bell size={10} />}
                    {e.time && (
                      <span style={{ fontWeight: 700, fontSize: 10 }}>
                        {e.time}
                      </span>
                    )}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textDecoration:
                          e.status === "Cancelled" ? "line-through" : undefined,
                      }}
                    >
                      {e.title}
                    </span>
                  </div>
                );
              })}

              {dayEvents.length > 3 && (
                <button
                  type="button"
                  className="cal-more-btn"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectDate(x);
                    setExpandedDate(x);
                  }}
                >
                  +{dayEvents.length - 3} more
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. All Events Modal for a Day */}
      {expandedDate && (
        <div
          className="cal-popover-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpandedDate(null);
          }}
        >
          <div className="cal-popover-card" style={{ maxWidth: 540 }}>
            <div className="cal-popover-head" style={{ alignItems: "center" }}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: "var(--fg)",
                    fontFamily: "var(--display)",
                  }}
                >
                  {expandedLabel}
                </h3>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {expandedEvents.length} scheduled item
                  {expandedEvents.length === 1 ? "" : "s"}
                </span>
              </div>
              <button
                className="cal-popover-close"
                type="button"
                onClick={() => setExpandedDate(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="cal-day-modal-list">
              {expandedEvents.map((e) => {
                const themeClass = getEventTheme(e);
                const meta = [e.subtitle, e.projectName, e.companyName]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <button
                    key={e.kind + e.id}
                    type="button"
                    className="cal-day-modal-item"
                    onClick={() => {
                      setExpandedDate(null);
                      onSelectEvent(e);
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          className={`cal-agenda-type-pill ${themeClass}`}
                          style={{ padding: "2px 8px", fontSize: 10.5 }}
                        >
                          {e.kind === "meet" && <Calendar size={11} />}
                          {e.kind === "due" && <CheckSquare size={11} />}
                          {e.kind === "rem" && <Bell size={11} />}
                          {e.kind === "live" && <Rocket size={11} />}
                          <span>{KIND_LABEL[e.kind]}</span>
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--muted)",
                            fontFamily: "var(--mono)",
                          }}
                        >
                          <Clock size={11} />
                          {e.time
                            ? formatTimeRange(e.time, e.endTime)
                            : "All day"}
                        </span>
                      </div>

                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: "var(--fg)",
                          lineHeight: 1.35,
                          textDecoration:
                            e.status === "Cancelled" ? "line-through" : undefined,
                        }}
                      >
                        {e.title}
                      </div>

                      {(meta || e.mode) && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginTop: 2,
                          }}
                        >
                          {meta ||
                            [e.meetingType, e.mode, e.location]
                              .filter(Boolean)
                              .join(" · ")}
                        </div>
                      )}
                    </div>

                    <ChevronRight
                      size={16}
                      style={{ color: "var(--muted)", flex: "none", marginTop: 4 }}
                    />
                  </button>
                );
              })}
            </div>

            <div className="cal-popover-actions">
              {canEdit ? (
                <button
                  type="button"
                  className="btn primary"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                  onClick={() => {
                    const d = expandedDate;
                    setExpandedDate(null);
                    onQuickAdd(d);
                  }}
                >
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Schedule meeting
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                className="btn"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => setExpandedDate(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
