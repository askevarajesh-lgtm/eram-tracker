"use client";
import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Briefcase,
  Users,
} from "lucide-react";
import { addDays, initials } from "@/lib/work";
import { today } from "@/lib/dates";
import { getAvatarColor } from "./calendar-helpers";
import type { Dev, CalEvent } from "./CalendarTypes";

type Props = {
  month: string;
  selected: string;
  show: string[];
  events: CalEvent[];
  developers: Dev[];
  projects: { id: string; name: string }[];
  activeDevFilter?: string;
  activeProjectFilter?: string;
  canEdit: boolean;
  onSelectDate: (d: string) => void;
  onShiftMonth: (n: number) => void;
  onToggleFilter: (k: string, on: boolean) => void;
  onFilterDev: (devId?: string) => void;
  onFilterProject: (prjId?: string) => void;
  onOpenNew: () => void;
};

const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function CalendarSidebar({
  month,
  selected,
  show,
  events,
  developers,
  projects,
  activeDevFilter,
  activeProjectFilter,
  canEdit,
  onSelectDate,
  onShiftMonth,
  onToggleFilter,
  onFilterDev,
  onFilterProject,
  onOpenNew,
}: Props) {
  const T = today();
  const [collapsedMyCal, setCollapsedMyCal] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState(false);
  const [collapsedFavorites, setCollapsedFavorites] = useState(false);

  // Parse Month for mini-calendar
  const [yStr, mStr] = month.split("-");
  const year = parseInt(yStr, 10);
  const monthNum = parseInt(mStr, 10);
  const monthTitle = new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  // Build 42 days for mini calendar starting on Monday
  const firstOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
  const dayOfWeek = (firstOfMonth.getUTCDay() + 6) % 7; // Monday = 0
  const miniGridStart = addDays(`${month}-01`, -dayOfWeek);
  const miniDays = Array.from({ length: 42 }, (_, i) => addDays(miniGridStart, i));

  const filterItems = [
    { key: "meet", label: "Meetings & Discussions", color: "#38bdf8" },
    { key: "due", label: "Task due dates", color: "#818cf8" },
    { key: "rem", label: "Reminders", color: "#fbbf24" },
    { key: "live", label: "Rollouts & Go-lives", color: "#34d399" },
  ];

  const categoryDots = [
    { label: "Discussion", color: "#c084fc" },
    { label: "Requirements", color: "#a855f7" },
    { label: "Demo & Technical", color: "#f59e0b" },
    { label: "Training & Handover", color: "#10b981" },
    { label: "UAT Session", color: "#f43f5e" },
    { label: "Review", color: "#38bdf8" },
  ];

  return (
    <aside className="cal-sidebar" aria-label="Calendar navigation">
      {/* Top Action Buttons */}
      <div className="cal-sb-header">
        <button
          className="cal-sb-icon-btn"
          type="button"
          title="Calendar Overview"
          onClick={() => onSelectDate(T)}
        >
          <CalendarIcon size={20} />
        </button>
        {canEdit && (
          <button
            className="cal-sb-add-btn"
            type="button"
            title="Schedule new meeting"
            onClick={onOpenNew}
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Teammates Avatar Rail */}
      {developers.length > 0 && (
        <div className="cal-sb-team-rail">
          <div className="cal-sb-team-label">
            <span>Teammates</span>
            {activeDevFilter && (
              <button
                type="button"
                onClick={() => onFilterDev(undefined)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--cal-accent-lime)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="cal-sb-team-avatars">
            {developers.slice(0, 7).map((d) => {
              const active = activeDevFilter === d.id;
              return (
                <button
                  key={d.id}
                  className={`cal-sb-avatar-chip ${active ? "active" : ""}`}
                  type="button"
                  title={`${d.name} (${d.email || "No email"})`}
                  style={{ background: getAvatarColor(d.name) }}
                  onClick={() => onFilterDev(active ? undefined : d.id)}
                >
                  {initials(d.name)}
                </button>
              );
            })}
            {canEdit && (
              <button
                className="cal-sb-avatar-chip"
                type="button"
                title="Schedule with team"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  borderStyle: "dashed",
                }}
                onClick={onOpenNew}
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mini Calendar Widget */}
      <div className="cal-mini-box">
        <div className="cal-mini-header">
          <span className="cal-mini-title">{monthTitle}</span>
          <div className="cal-mini-nav">
            <button
              className="cal-mini-btn"
              type="button"
              aria-label="Previous month"
              onClick={() => onShiftMonth(-1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              className="cal-mini-btn"
              type="button"
              aria-label="Next month"
              onClick={() => onShiftMonth(1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="cal-mini-weekdays">
          {WEEKDAY_HEADERS.map((w) => (
            <span key={w} className="cal-mini-wday">
              {w}
            </span>
          ))}
        </div>

        <div className="cal-mini-grid">
          {miniDays.map((d) => {
            const inMonth = d.slice(0, 7) === month;
            const isToday = d === T;
            const isSelected = d === selected;
            const dayNum = parseInt(d.slice(8), 10);
            const hasEvents = events.some((e) => e.date === d);

            return (
              <button
                key={d}
                type="button"
                className={`cal-mini-day ${!inMonth ? "other-month" : ""} ${
                  isToday ? "today" : ""
                } ${isSelected ? "selected" : ""} ${
                  hasEvents && !isSelected ? "has-events" : ""
                }`}
                onClick={() => onSelectDate(d)}
                title={d}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>

      {/* My Calendars Filter Checkboxes */}
      <div className="cal-sb-sec">
        <div
          className={`cal-sb-sec-head ${collapsedMyCal ? "collapsed" : ""}`}
          onClick={() => setCollapsedMyCal(!collapsedMyCal)}
        >
          <span>My Calendars</span>
          <ChevronDown size={14} />
        </div>
        {!collapsedMyCal && (
          <div className="cal-sb-items">
            {filterItems.map((item) => {
              const checked = show.includes(item.key);
              return (
                <div
                  key={item.key}
                  className={`cal-sb-item ${checked ? "checked" : ""}`}
                  onClick={() => onToggleFilter(item.key, !checked)}
                >
                  <span
                    className="cal-sb-check"
                    style={{
                      background: checked ? item.color : "transparent",
                    }}
                  >
                    {checked && <Check size={11} color="#ffffff" strokeWidth={3} />}
                  </span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Favorites / Systems Filter */}
      {projects.length > 0 && (
        <div className="cal-sb-sec">
          <div
            className={`cal-sb-sec-head ${
              collapsedFavorites ? "collapsed" : ""
            }`}
            onClick={() => setCollapsedFavorites(!collapsedFavorites)}
          >
            <span>Systems &amp; Projects</span>
            <ChevronDown size={14} />
          </div>
          {!collapsedFavorites && (
            <div className="cal-sb-items">
              {projects.slice(0, 6).map((p) => {
                const active = activeProjectFilter === p.id;
                return (
                  <div
                    key={p.id}
                    className={`cal-sb-item ${active ? "active" : ""}`}
                    onClick={() =>
                      onFilterProject(active ? undefined : p.id)
                    }
                  >
                    <Briefcase size={13} style={{ opacity: 0.7 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Categories Section */}
      <div className="cal-sb-sec">
        <div
          className={`cal-sb-sec-head ${
            collapsedCategories ? "collapsed" : ""
          }`}
          onClick={() => setCollapsedCategories(!collapsedCategories)}
        >
          <span>Categories</span>
          <ChevronDown size={14} />
        </div>
        {!collapsedCategories && (
          <div className="cal-sb-items">
            {categoryDots.map((c) => (
              <div key={c.label} className="cal-sb-item">
                <span
                  className="cal-sb-dot"
                  style={{ background: c.color }}
                />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer with Avatar Cluster */}
      <div className="cal-sb-footer">
        <div className="cal-sb-avatar-stack">
          {developers.slice(0, 4).map((d) => (
            <div
              key={d.id}
              className="cal-sb-stack-av"
              style={{ background: getAvatarColor(d.name) }}
              title={d.name}
            >
              {initials(d.name)}
            </div>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "var(--cal-sidebar-muted)" }}>
          {developers.length} team members
        </span>
      </div>
    </aside>
  );
}
