"use client";
import React from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, ListOrdered } from "lucide-react";

type Props = {
  month: string;
  view: "month" | "agenda";
  canEdit: boolean;
  onShiftMonth: (n: number) => void;
  onSetView: (v: "month" | "agenda") => void;
  onGoToday: () => void;
  onOpenNew: () => void;
};

export function CalendarTopBar({
  month,
  view,
  canEdit,
  onShiftMonth,
  onSetView,
  onGoToday,
  onOpenNew,
}: Props) {
  const [y, m] = month.split("-").map(Number);
  const monthTitle = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  return (
    <header className="cal-topbar">
      <div className="cal-topbar-row">
        {/* Left: Month title & Nav */}
        <div className="cal-topbar-left">
          <h1 className="cal-month-title">{monthTitle}</h1>
          <button
            className="cal-today-pill"
            type="button"
            onClick={onGoToday}
          >
            Today
          </button>
          <div className="cal-nav-arrows">
            <button
              className="cal-nav-btn"
              type="button"
              aria-label="Previous month"
              onClick={() => onShiftMonth(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="cal-nav-btn"
              type="button"
              aria-label="Next month"
              onClick={() => onShiftMonth(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right: View switcher & Schedule button */}
        <div className="cal-topbar-right">
          <div className="cal-view-pills" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "month"}
              className={`cal-view-pill ${view === "month" ? "active" : ""}`}
              onClick={() => onSetView("month")}
            >
              <Calendar size={14} />
              <span>Month</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "agenda"}
              className={`cal-view-pill ${view === "agenda" ? "active" : ""}`}
              onClick={() => onSetView("agenda")}
            >
              <ListOrdered size={14} />
              <span>Agenda</span>
            </button>
          </div>

          {canEdit && (
            <button
              className="cal-schedule-btn"
              type="button"
              onClick={onOpenNew}
            >
              <Plus size={16} />
              <span>Schedule meeting</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
