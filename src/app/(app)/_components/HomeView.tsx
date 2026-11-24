"use client";

import Link from "next/link";
import { MessageSquare, Zap, Check, Folder, AlertTriangle, Clock, Bell } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveStandup } from "@/server/daily";
import type { AutoData, ReminderDTO } from "@/server/reminders-data";
import { STATUS_MAP, TASK_STATUSES, projectColor } from "@/lib/constants";
import { ISSUE_STATUS_MAP, duration } from "@/lib/issues";
import { fmtDay, today } from "@/lib/dates";
import { addDays, initials } from "@/lib/work";
import { SegBar } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntDatePicker, AntTextArea, AntInput } from "@/components/ui/antd";
import { autoReminders, isDue } from "@/lib/reminders";
import { meetingColor } from "@/lib/calendar";

// ============================================================================
// Types
// ============================================================================
type Standup = { done: string; plan: string; blockers: string; hours: string };

type DevCard = {
  id: string;
  name: string;
  title: string;
  statuses: TaskStatus[];
  total: number;
  active: number;
  open: number;
  overdue: number;
  doneWeek: number;
  moved: number;
  doneToday: number;
  issues: number;
  lastMove: string;
  standup: Standup | null;
  working: { id: string; title: string; status: TaskStatus; project: string; progress: number }[];
  workingMore: number;
  week: number[];
  weekUpdates: number;
  movedTodayTitles: string[];
  mine: boolean;
};

export type HomeData = {
  D: string;
  isToday: boolean;
  W: string[];
  kpis: {
    urgent: number;
    progress: number;
    developed: number;
    accepted: number;
    active: number;
    notStarted: number;
    overdue: number;
    hold: number;
    doneToday: number;
    updates: number;
    developers: number;
  };
  meetings: {
    id: string;
    title: string;
    type: string;
    startTime: string;
    endTime: string;
    mode: string;
    location: string;
    status: string;
    attendees: number;
  }[];
  urgentIssues: {
    id: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    devs: string;
  }[];
  sla: { Urgent: number; High: number; Normal: number };
  projects: {
    id: string;
    name: string;
    statuses: TaskStatus[];
    pct: number;
    total: number;
    done: number;
    active: number;
    open: number;
    overdue: number;
    moved: number;
  }[];
  developers: DevCard[];
  feed: { id: string; title: string; from: string | null; to: string; devs: string; project: string }[];
  attention: { id: string; title: string; status: TaskStatus; due: string; devs: string; project: string }[];
  reminders: { list: ReminderDTO[]; auto: AutoData } | null;
  pendingApprovals: number;
};

// ============================================================================
// Strict SVG Icon Wrapper to Guarantee Exact Size & Alignment
// ============================================================================
function IconWrapper({
  children,
  size = 18,
  strokeWidth = 2,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
      }}
    >
      {children}
    </svg>
  );
}

const Icons = {
  Bolt: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size} strokeWidth={2.2}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </IconWrapper>
  ),
  Gauge: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83M18 12h4M16.24 16.24l2.83 2.83" />
      <circle cx="12" cy="12" r="3" />
    </IconWrapper>
  ),
  Rocket: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </IconWrapper>
  ),
  ShieldCheck: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </IconWrapper>
  ),
  Sync: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </IconWrapper>
  ),
  Layers: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </IconWrapper>
  ),
  Clock: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </IconWrapper>
  ),
  Pause: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </IconWrapper>
  ),
  CheckCircle: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </IconWrapper>
  ),
  Clipboard: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="m9 14 2 2 4-4" />
    </IconWrapper>
  ),
  Calendar: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </IconWrapper>
  ),
  Download: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </IconWrapper>
  ),
  Search: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </IconWrapper>
  ),
  Trend: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </IconWrapper>
  ),
  Team: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconWrapper>
  ),
  Activity: ({ size = 18 }: { size?: number }) => (
    <IconWrapper size={size}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </IconWrapper>
  ),
};

const tag = (name: string) =>
  name ? (
    <span className="mtag" style={{ ["--mc" as string]: projectColor(name) }}>
      {name}
    </span>
  ) : null;

// ============================================================================
// Main HomeView Component
// ============================================================================
export function HomeView({
  data,
  canManage,
  viewerDeveloperId,
}: {
  data: HomeData;
  canManage: boolean;
  viewerDeveloperId: string | null;
}) {
  const { update } = useUrlUpdate();
  const compose = useCompose();
  const [standup, setStandup] = useState<DevCard | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [devFilter, setDevFilter] = useState<"all" | "active" | "missing_update" | "overdue">("all");

  const { D, isToday, kpis } = data;
  const go = (d: string) => update({ d: d >= today() ? null : d });
  const missing = data.developers.filter(d => !d.standup).map(d => d.id);
  const mx = Math.max(1, ...data.developers.flatMap(d => d.week));
  const lbl = isToday ? "today" : "that day";

  // Filtered Developers
  const filteredDevs = useMemo(() => {
    return data.developers.filter(d => {
      if (devFilter === "active" && d.active === 0) return false;
      if (devFilter === "missing_update" && d.standup) return false;
      if (devFilter === "overdue" && d.overdue === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesTitle = d.title.toLowerCase().includes(q);
        const matchesTask = d.working.some(w => w.title.toLowerCase().includes(q) || w.project.toLowerCase().includes(q));
        if (!matchesName && !matchesTitle && !matchesTask) return false;
      }
      return true;
    });
  }, [data.developers, devFilter, searchQuery]);

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return data.projects;
    const q = searchQuery.toLowerCase();
    return data.projects.filter(p => p.name.toLowerCase().includes(q));
  }, [data.projects, searchQuery]);

  // Aggregate Team Velocity for the 7 days
  const velocityData = useMemo(() => {
    const dailyMoves = data.W.map(date => {
      const idx = data.W.indexOf(date);
      const dayTotal = data.developers.reduce((sum, d) => {
        return sum + (idx >= 0 ? d.week[idx] || 0 : 0);
      }, 0);
      return { date, moves: dayTotal };
    });
    const totalMoves = dailyMoves.reduce((acc, x) => acc + x.moves, 0);
    const avg = (totalMoves / 7).toFixed(1);
    const maxMoves = Math.max(1, ...dailyMoves.map(x => x.moves));
    return { dailyMoves, totalMoves, avg, maxMoves };
  }, [data.W, data.developers]);

  // Pipeline distribution across all statuses
  const pipelineStats = useMemo(() => {
    const counts = {
      pending: kpis.notStarted,
      progress: kpis.active,
      qa: 0,
      uat: kpis.accepted,
      done: kpis.developed,
      hold: kpis.hold,
    };
    data.developers.forEach(d => {
      d.statuses.forEach(s => {
        if (s === "qa") counts.qa++;
      });
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return { counts, total };
  }, [kpis, data.developers]);

  return (
    <div className="ds-container">
      {/* 1. Reminder Banner (Preserved 100%) */}
      {isToday && canManage && <ReminderBanner data={data} />}

      {/* 2. Redesigned Command Toolbar & Controls */}
      <section className="ds-toolbar" aria-label="Dashboard controls">
        <div className="ds-toolbar-left">
          {/* Stepper & Date Picker */}
          <div className="ds-date-stepper">
            <button
              className="ds-step-btn"
              type="button"
              aria-label="Previous day"
              title="Previous day"
              onClick={() => go(addDays(D, -1))}
            >
              ‹
            </button>
            <AntDatePicker
              aria-label="Select Date"
              value={D}
              max={today()}
              onChange={e => e.target.value && go(e.target.value)}
              style={{ width: 130, border: "none", background: "transparent", fontWeight: 600 }}
            />
            <button
              className="ds-step-btn"
              type="button"
              aria-label="Next day"
              title="Next day"
              disabled={isToday}
              onClick={() => go(addDays(D, 1))}
            >
              ›
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <button
            type="button"
            className={`ds-preset-btn ${isToday ? "active" : ""}`}
            onClick={() => go(today())}
          >
            Today
          </button>
          <button
            type="button"
            className={`ds-preset-btn ${D === addDays(today(), -1) ? "active" : ""}`}
            onClick={() => go(addDays(today(), -1))}
          >
            Yesterday
          </button>

          {/* Formatted Date Pill */}
          <div className="ds-date-display">
            <Icons.Calendar size={14} />
            <span>
              {new Date(D + "T00:00:00Z").toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="ds-toolbar-center">
          <div className="ds-search-bar">
            <Icons.Search size={14} />
            <input
              type="search"
              placeholder="Search developer, project, or task..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right Actions & Reports */}
        <div className="ds-toolbar-right">
          {canManage && (
            <>
              <button
                className="ds-btn"
                type="button"
                onClick={() => compose({ tpl: "daily", devIds: missing })}
              >
                <MessageSquare size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
                Remind for updates
                {missing.length > 0 && <span className="ds-btn-badge">{missing.length}</span>}
              </button>
              <button
                className="ds-btn"
                type="button"
                onClick={() => compose({ tpl: "summary", manager: true })}
              >
                Send summary
              </button>
            </>
          )}
          <a className="ds-btn" href={`/api/reports/home?d=${D}`} download>
            <Icons.Download size={14} />
            Day report
          </a>
          <a className="ds-btn" href={`/api/reports/week?d=${D}`} download>
            <Icons.Download size={14} />
            Week report
          </a>
        </div>
      </section>

      {/* 3. Redesigned KPI Cards: STRICTLY EXACTLY 5 IN ROW 1 & 5 IN ROW 2 */}
      <section className="ds-kpis-grid" aria-label="Key Performance Indicators">
        {/* ROW 1 - CARD 1: Urgent Issues Open */}
        <Link
          href="/issues?pr=Urgent"
          className={`ds-kpi-card ${kpis.urgent > 0 ? "is-bad" : ""}`}
          style={{ ["--card-accent" as string]: "var(--bad)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Bolt size={20} />
            </div>
            {kpis.urgent > 0 ? (
              <span className="ds-kpi-chip is-bad">Action needed</span>
            ) : (
              <span className="ds-kpi-chip is-ok">All clear</span>
            )}
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.urgent}</div>
            <div className="ds-kpi-label">Urgent issues open</div>
          </div>
          <div className="ds-kpi-footer">
            <span>{kpis.urgent > 0 ? "SLA breach / priority alert" : "Zero open urgent issues"}</span>
          </div>
        </Link>

        {/* ROW 1 - CARD 2: Overall Progress */}
        <Link
          href="/overview"
          className="ds-kpi-card"
          style={{ ["--card-accent" as string]: "var(--accent)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Gauge size={20} />
            </div>
            <span className="ds-kpi-chip is-ok">
              <Icons.Trend size={11} /> Tracked
            </span>
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.progress}%</div>
            <div className="ds-kpi-label">Overall progress</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Average across active modules</span>
          </div>
        </Link>

        {/* ROW 1 - CARD 3: Developed */}
        <Link
          href="/delivered"
          className="ds-kpi-card"
          style={{ ["--card-accent" as string]: "var(--ok)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Rocket size={20} />
            </div>
            <span className="ds-kpi-chip is-ok">Done</span>
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.developed}</div>
            <div className="ds-kpi-label">Developed</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Total completed tasks</span>
          </div>
        </Link>

        {/* ROW 1 - CARD 4: Accepted by Business Users */}
        <Link
          href="/uat"
          className="ds-kpi-card"
          style={{ ["--card-accent" as string]: "var(--lms)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.ShieldCheck size={20} />
            </div>
            <span className="ds-kpi-chip is-ok">Verified</span>
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.accepted}</div>
            <div className="ds-kpi-label">Accepted by business users</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Approved in UAT stage</span>
          </div>
        </Link>

        {/* ROW 1 - CARD 5: In Progress Now */}
        <div
          className="ds-kpi-card"
          style={{ ["--card-accent" as string]: "var(--info)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Sync size={20} />
            </div>
            <span className="ds-kpi-chip is-info">Live</span>
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.active}</div>
            <div className="ds-kpi-label">In progress now</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Currently under active work</span>
          </div>
        </div>

        {/* ROW 2 - CARD 6: Open, Not Started */}
        <Link
          href="/tasks?status=pending"
          className="ds-kpi-card"
          style={{ ["--card-accent" as string]: "var(--warn)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Layers size={20} />
            </div>
            <span className="ds-kpi-chip is-warn">Backlog</span>
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.notStarted}</div>
            <div className="ds-kpi-label">Open, not started</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Ready for developer pickup</span>
          </div>
        </Link>

        {/* ROW 2 - CARD 7: Overdue */}
        <div
          className={`ds-kpi-card ${kpis.overdue > 0 ? "is-bad" : ""}`}
          style={{ ["--card-accent" as string]: "var(--bad)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Clock size={20} />
            </div>
            {kpis.overdue > 0 ? (
              <span className="ds-kpi-chip is-bad">Late</span>
            ) : (
              <span className="ds-kpi-chip is-ok">On schedule</span>
            )}
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.overdue}</div>
            <div className="ds-kpi-label">Overdue</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Tasks past due date</span>
          </div>
        </div>

        {/* ROW 2 - CARD 8: Blocked / On Hold */}
        <Link
          href="/tasks?status=hold"
          className={`ds-kpi-card ${kpis.hold > 0 ? "is-bad" : ""}`}
          style={{ ["--card-accent" as string]: "var(--hold)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Pause size={20} />
            </div>
            {kpis.hold > 0 ? (
              <span className="ds-kpi-chip is-bad">Blocked</span>
            ) : (
              <span className="ds-kpi-chip is-neutral">Zero</span>
            )}
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.hold}</div>
            <div className="ds-kpi-label">Blocked / on hold</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Awaiting resolution or dependencies</span>
          </div>
        </Link>

        {/* ROW 2 - CARD 9: Completed Today / That Day */}
        <div
          className="ds-kpi-card"
          style={{ ["--card-accent" as string]: "var(--ats)" }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.CheckCircle size={20} />
            </div>
            <span className="ds-kpi-chip is-neutral">{isToday ? "Today" : "Selected day"}</span>
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">{kpis.doneToday}</div>
            <div className="ds-kpi-label">{isToday ? "Completed today" : "Completed that day"}</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Delivered during this date</span>
          </div>
        </div>

        {/* ROW 2 - CARD 10: Daily Updates In */}
        <div
          className={`ds-kpi-card ${kpis.developers > 0 && kpis.updates < kpis.developers ? "is-bad" : ""}`}
          style={{
            ["--card-accent" as string]:
              kpis.updates === kpis.developers ? "var(--ok)" : "var(--warn)",
          }}
        >
          <div className="ds-kpi-header">
            <div className="ds-kpi-icon">
              <Icons.Clipboard size={20} />
            </div>
            {kpis.developers > 0 && kpis.updates === kpis.developers ? (
              <span className="ds-kpi-chip is-ok">100% In</span>
            ) : (
              <span className="ds-kpi-chip is-warn">
                {kpis.developers - kpis.updates} missing
              </span>
            )}
          </div>
          <div className="ds-kpi-body">
            <div className="ds-kpi-val">
              {kpis.updates}/{kpis.developers}
            </div>
            <div className="ds-kpi-label">Daily updates in</div>
          </div>
          <div className="ds-kpi-footer">
            <span>Developer standup submission status</span>
          </div>
        </div>
      </section>

      {/* 4. Team Velocity Momentum Chart & Status Distribution Bar */}
      <section className="ds-analytics-grid">
        {/* Velocity Chart */}
        <div className="ds-chart-card">
          <div className="ds-chart-head">
            <div className="ds-chart-title">
              <Icons.Activity size={17} />
              <span>Sprint Momentum · 7-Day Team Status Moves</span>
            </div>
            <div className="ds-chart-metrics">
              <span className="ds-chart-metric-pill">
                Week total: <b>{velocityData.totalMoves}</b>
              </span>
              <span className="ds-chart-metric-pill">
                Daily avg: <b>{velocityData.avg}</b>
              </span>
            </div>
          </div>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg
              viewBox="0 0 540 100"
              style={{ width: "100%", minWidth: 400, height: 100, display: "block" }}
              aria-label="Velocity chart"
            >
              <defs>
                <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="velGradActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ats)" stopOpacity="1" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              <line x1="20" y1="78" x2="520" y2="78" stroke="var(--line)" strokeWidth="1" />
              {velocityData.dailyMoves.map((item, idx) => {
                const bw = 46;
                const gap = 24;
                const x = 28 + idx * (bw + gap);
                const h = Math.max(4, (item.moves / velocityData.maxMoves) * 58);
                const y = 78 - h;
                const isSelected = item.date === D;

                return (
                  <g key={item.date} style={{ cursor: "pointer" }} onClick={() => go(item.date)}>
                    {isSelected && (
                      <rect
                        x={x - 4}
                        y={12}
                        width={bw + 8}
                        height={72}
                        rx="8"
                        fill="color-mix(in srgb, var(--accent) 10%, transparent)"
                      />
                    )}
                    <rect
                      x={x}
                      y={y}
                      width={bw}
                      height={h}
                      rx="6"
                      fill={isSelected ? "url(#velGradActive)" : "url(#velGrad)"}
                    >
                      <title>{`${item.date}: ${item.moves} status transitions`}</title>
                    </rect>
                    {item.moves > 0 && (
                      <text
                        x={x + bw / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="var(--mono)"
                        fill="var(--fg)"
                      >
                        {item.moves}
                      </text>
                    )}
                    <text
                      x={x + bw / 2}
                      y="92"
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight={isSelected ? "700" : "500"}
                      fill={isSelected ? "var(--accent)" : "var(--muted)"}
                    >
                      {new Date(item.date + "T00:00:00Z").toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Task Pipeline Status Breakdown */}
        <div className="ds-chart-card">
          <div className="ds-chart-head">
            <div className="ds-chart-title">
              <Icons.Layers size={17} />
              <span>Pipeline Health</span>
            </div>
            <span className="ds-chart-metric-pill">
              <b>{pipelineStats.total}</b> tasks tracked
            </span>
          </div>

          <div className="ds-pipeline-bars">
            <div className="ds-pipeline-bar-wrapper">
              {TASK_STATUSES.map(s => {
                const count = pipelineStats.counts[s.key] || 0;
                const pct = (count / pipelineStats.total) * 100;
                if (!count) return null;
                return (
                  <div
                    key={s.key}
                    style={{ width: `${pct}%`, background: s.color }}
                    title={`${s.label}: ${count} (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>

            <div className="ds-pipeline-legend-grid">
              {TASK_STATUSES.map(s => {
                const count = pipelineStats.counts[s.key] || 0;
                return (
                  <div key={s.key} className="ds-pipeline-legend-item">
                    <span className="ds-pipeline-legend-left">
                      <span className="dot" style={{ background: s.color, width: 7, height: 7, borderRadius: 99 }} />
                      <span>{s.label}</span>
                    </span>
                    <b>{count}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Meetings & Urgent Issues Two-Column Layout */}
      <section className="ds-two-col">
        {/* Column 1: Meetings */}
        <div className="ds-panel-card">
          <div className="ds-panel-head">
            <h2 className="ds-panel-title">
              <Icons.Calendar size={17} />
              <span>Meetings {lbl}</span>
            </h2>
            <Link className="ds-btn" href="/calendar">
              Calendar
            </Link>
          </div>
          {!data.meetings.length ? (
            <div className="ds-empty-box">
              <Icons.Calendar size={24} />
              <b>No meetings scheduled</b>
              <p>Your calendar is clear for {lbl}.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.meetings.map(m => (
                <Link
                  key={m.id}
                  href={`/calendar?edit=${m.id}`}
                  className="ds-item-card"
                  style={{ ["--stripe-c" as string]: meetingColor(m.type) }}
                >
                  <div className="ds-item-main">
                    <div className="ds-item-title">
                      {m.startTime && (
                        <span style={{ fontFamily: "var(--mono)", color: "var(--accent)", marginRight: 6 }}>
                          {m.startTime}
                          {m.endTime && "–" + m.endTime}
                        </span>
                      )}
                      {m.title}
                    </div>
                    <div className="ds-item-sub">
                      <span>{m.type}</span>
                      <span>·</span>
                      <span>{m.mode}</span>
                      {m.location && (
                        <>
                          <span>·</span>
                          <span>{m.location}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {m.attendees} attendee{m.attendees === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  {m.status !== "Planned" && <Chip color="var(--warn)">{m.status}</Chip>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Urgent Issues */}
        <div className="ds-panel-card">
          <div className="ds-panel-head">
            <h2 className="ds-panel-title">
              <Icons.Bolt size={17} />
              <span>Urgent issues</span>
            </h2>
            <Link className="ds-btn" href="/issues">
              All issues
            </Link>
          </div>
          {!data.urgentIssues.length ? (
            <div className="ds-empty-box">
              <Icons.ShieldCheck size={24} />
              <b>All caught up!</b>
              <p>Zero urgent issues open. SLA compliance is healthy.</p>
            </div>
          ) : (
            <UrgentList issues={data.urgentIssues} sla={data.sla} />
          )}
        </div>
      </section>

      {/* 6. All Development (Projects Grid) */}
      <section className="ds-section">
        <div className="ds-section-header">
          <div className="ds-section-title-wrap">
            <h2 className="ds-section-title">
              <Icons.Layers size={17} />
              <span>All development</span>
            </h2>
            {filteredProjects.length > 0 && (
              <span className="ds-section-badge">{filteredProjects.length} modules</span>
            )}
          </div>
          <p className="ds-section-subtitle">Real-time completion & status movement per project</p>
        </div>

        {filteredProjects.length > 0 ? (
          <div className="ds-projects-grid">
            {filteredProjects.map(p => (
              <Link
                key={p.id}
                href={`/tasks?project=${p.id}`}
                className="ds-project-card"
                style={{ ["--mc" as string]: projectColor(p.name) }}
              >
                <div className="ds-project-header">
                  <h3 className="ds-project-title">
                    <span className="ds-project-tag">{p.name}</span>
                  </h3>
                  <span className="ds-project-pct">{p.pct}%</span>
                </div>
                <SegBar statuses={p.statuses} height={7} />
                <div className="ds-project-metrics">
                  <div className="ds-project-m-item">
                    <span className="ds-project-m-val">{p.total}</span>
                    <span className="ds-project-m-lbl">Total</span>
                  </div>
                  <div className="ds-project-m-item">
                    <span className="ds-project-m-val" style={{ color: "var(--ok)" }}>
                      {p.done}
                    </span>
                    <span className="ds-project-m-lbl">Done</span>
                  </div>
                  <div className="ds-project-m-item">
                    <span className="ds-project-m-val" style={{ color: "var(--info)" }}>
                      {p.active}
                    </span>
                    <span className="ds-project-m-lbl">Active</span>
                  </div>
                  <div className="ds-project-m-item">
                    <span
                      className="ds-project-m-val"
                      style={{ color: p.overdue > 0 ? "var(--bad)" : "inherit" }}
                    >
                      {p.overdue > 0 ? p.overdue : p.open}
                    </span>
                    <span className="ds-project-m-lbl">{p.overdue > 0 ? "Late" : "Open"}</span>
                  </div>
                </div>
                <div className="ds-project-footer">
                  <span>
                    {p.moved ? (
                      <>
                        <b><Zap size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 2 }} />{p.moved}</b> moved {lbl}
                      </>
                    ) : (
                      <span>No movement {lbl}</span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--accent)" }}>View tasks →</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ds-empty-box" style={{ padding: "16px 20px", flexDirection: "row", justifyContent: "center" }}>
            <Icons.Layers size={16} />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>No project modules configured yet.</span>
          </div>
        )}
      </section>

      {/* 7. Developers Section ("Developers today" / on date) */}
      <section className="ds-section">
        <div className="ds-section-header">
          <div className="ds-section-title-wrap">
            <h2 className="ds-section-title">
              <Icons.Team size={17} />
              <span>Developers {isToday ? "today" : "on " + fmtDay(D)}</span>
            </h2>
            <span className="ds-section-badge">{filteredDevs.length} active</span>
          </div>

          {/* Quick Filter Tabs & Legend */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div className="ds-date-stepper" style={{ background: "var(--surface)" }}>
              <button
                type="button"
                className={`ds-preset-btn ${devFilter === "all" ? "active" : ""}`}
                style={{ border: "none" }}
                onClick={() => setDevFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`ds-preset-btn ${devFilter === "active" ? "active" : ""}`}
                style={{ border: "none" }}
                onClick={() => setDevFilter("active")}
              >
                Active now
              </button>
              <button
                type="button"
                className={`ds-preset-btn ${devFilter === "missing_update" ? "active" : ""}`}
                style={{ border: "none" }}
                onClick={() => setDevFilter("missing_update")}
              >
                Pending update
              </button>
              <button
                type="button"
                className={`ds-preset-btn ${devFilter === "overdue" ? "active" : ""}`}
                style={{ border: "none" }}
                onClick={() => setDevFilter("overdue")}
              >
                Overdue
              </button>
            </div>

            {/* Status Legend */}
            <div className="ds-status-legend">
              {TASK_STATUSES.map(s => (
                <span key={s.key} className="ds-status-legend-item">
                  <span className="dot" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {!filteredDevs.length ? (
          <div className="ds-panel-card" style={{ textAlign: "center", padding: "32px 20px" }}>
            <Icons.Team size={24} />
            <h3 style={{ margin: "10px 0 4px", fontSize: 14 }}>No developers match your filters</h3>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          <div className="ds-devs-grid">
            {filteredDevs.map(v => {
              const canWrite = canManage || v.id === viewerDeveloperId;
              return (
                <div key={v.id} className={`ds-dev-card ${v.mine ? "is-mine" : ""}`}>
                  {/* Developer Identity Header */}
                  <div className="ds-dev-header">
                    <div className="ds-dev-avatar">
                      {initials(v.name)}
                      <span className={`ds-dev-avatar-dot ${v.standup ? "" : "no-update"}`} />
                    </div>
                    <div className="ds-dev-identity">
                      <div className="ds-dev-name-row">
                        <span className="ds-dev-name">{v.name}</span>
                        {v.mine && <Chip color="var(--accent)">You</Chip>}
                      </div>
                      <div className="ds-dev-title">
                        {v.title}
                        {v.lastMove ? ` · last update ${fmtDay(v.lastMove)}` : " · no recent updates"}
                      </div>
                    </div>
                    {v.standup ? (
                      <Chip color="var(--ok)">
                        Update in {v.standup.hours ? `· ${v.standup.hours}h` : ""}
                      </Chip>
                    ) : (
                      <Chip color={isToday ? "var(--warn)" : "var(--hold)"}>No update</Chip>
                    )}
                  </div>

                  {/* 4 Metric Boxes */}
                  <div className="ds-dev-metrics-quad">
                    <div className="ds-dev-quad-box">
                      <span className="ds-dev-quad-val" style={{ color: "var(--info)" }}>
                        {v.active}
                      </span>
                      <span className="ds-dev-quad-lbl">Active</span>
                    </div>
                    <div className="ds-dev-quad-box">
                      <span className="ds-dev-quad-val">{v.open}</span>
                      <span className="ds-dev-quad-lbl">Open</span>
                    </div>
                    <div className="ds-dev-quad-box">
                      <span
                        className="ds-dev-quad-val"
                        style={{ color: v.overdue ? "var(--bad)" : "inherit" }}
                      >
                        {v.overdue}
                      </span>
                      <span className="ds-dev-quad-lbl">Overdue</span>
                    </div>
                    <div className="ds-dev-quad-box">
                      <span className="ds-dev-quad-val" style={{ color: "var(--ok)" }}>
                        {v.doneWeek}
                      </span>
                      <span className="ds-dev-quad-lbl">Done 7d</span>
                    </div>
                  </div>

                  {/* SegBar for developer status distribution */}
                  <SegBar statuses={v.statuses} height={7} />

                  {/* Movement and summary badges */}
                  <div className="ds-dev-moves-summary">
                    <span className="ds-dev-move-badge">
                      <Zap size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 2 }} /> <b>{v.moved}</b> moved {lbl}
                    </span>
                    <span className="ds-dev-move-badge is-ok">
                      <Check size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 2 }} /> <b>{v.doneToday}</b> completed
                    </span>
                    <span className="ds-dev-move-badge">
                      <Folder size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 2 }} /> <b>{v.total}</b> total
                    </span>
                    {v.issues > 0 && (
                      <span className="ds-dev-move-badge is-bad">
                        <AlertTriangle size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 2 }} /> <b>{v.issues}</b> issue{v.issues === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>

                  {/* Standup Card Log */}
                  {v.standup && (
                    <div className="ds-dev-standup-card">
                      {v.standup.done && (
                        <div className="ds-dev-standup-row">
                          <span className="ds-dev-standup-tag" style={{ color: "var(--ok)" }}>
                            Done:
                          </span>
                          <span>{v.standup.done}</span>
                        </div>
                      )}
                      {v.standup.plan && (
                        <div className="ds-dev-standup-row">
                          <span className="ds-dev-standup-tag" style={{ color: "var(--info)" }}>
                            Next:
                          </span>
                          <span>{v.standup.plan}</span>
                        </div>
                      )}
                      {v.standup.blockers && (
                        <div className="ds-dev-standup-row" style={{ color: "var(--bad)" }}>
                          <span className="ds-dev-standup-tag" style={{ color: "var(--bad)" }}>
                            Blocker:
                          </span>
                          <span>{v.standup.blockers}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Working on tasks list */}
                  <div className="ds-dev-tasks-box">
                    <div className="ds-dev-tasks-title">Currently working on</div>
                    {v.working.length ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {v.working.map(t => (
                          <Link
                            key={t.id}
                            href={`/tasks?edit=${t.id}`}
                            className="ds-dev-task-item"
                          >
                            <div className="ds-dev-task-left">
                              <span
                                className="dot"
                                style={{
                                  background: STATUS_MAP[t.status]?.color ?? "var(--info)",
                                  width: 7,
                                  height: 7,
                                  borderRadius: 99,
                                  flexShrink: 0,
                                }}
                              />
                              {tag(t.project)}
                              <span className="ds-dev-task-title">{t.title}</span>
                            </div>
                            <span className="ds-dev-task-pct">{t.progress}%</span>
                          </Link>
                        ))}
                        {v.workingMore > 0 && (
                          <Link
                            href={`/tasks?dev=${v.id}`}
                            className="muted"
                            style={{ fontSize: 12, paddingLeft: 6, textDecoration: "none" }}
                          >
                            +{v.workingMore} more tasks →
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12.5, fontStyle: "italic" }}>
                        Nothing currently in progress.
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="ds-dev-actions-row">
                    {canWrite && (
                      <button
                        className={`ds-btn ${v.mine && !v.standup ? "ds-btn-primary" : ""}`}
                        type="button"
                        onClick={() => setStandup(v)}
                      >
                        {v.standup ? "Edit daily update" : "Write daily update"}
                      </button>
                    )}
                    <Link className="ds-btn" href={`/tasks?dev=${v.id}`}>
                      All tasks
                    </Link>
                    {canManage && (
                      <button
                        className="ds-btn"
                        type="button"
                        onClick={() =>
                          compose({
                            tpl: v.overdue ? "overdue" : "daily",
                            devIds: [v.id],
                          })
                        }
                      >
                        <MessageSquare size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 4 }} />
                        Message
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 8. Redesigned 7-Day Developer Activity Heatmap Table - STRICT MATHEMATICAL ALIGNMENT */}
      <section className="ds-heatmap-wrap">
        <div className="ds-heatmap-head">
          <div className="ds-section-title-wrap">
            <h2 className="ds-section-title">
              <Icons.Activity size={17} />
              <span>Last 7 days · Status changes per developer</span>
            </h2>
          </div>
          <span className="ds-chart-metric-pill">
            Peak activity day: <b>{fmtDay(D)}</b>
          </span>
        </div>

        <div className="ds-heatmap-scroll">
          <table className="ds-heatmap-table">
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "8.5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7.5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="ds-th-dev">Developer</th>
                {data.W.map(x => {
                  const isActive = x === D;
                  const dObj = new Date(x + "T00:00:00Z");
                  const dayNum = dObj.getUTCDate();
                  const dayWk = dObj.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }).toUpperCase();
                  return (
                    <th key={x} className={`ds-th-day ${isActive ? "is-selected-day" : ""}`}>
                      <div className="ds-day-header-cell">
                        <span>{dayNum} {dayWk}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="ds-th-metric">Week</th>
                <th className="ds-th-metric">Updates</th>
              </tr>
            </thead>
            <tbody>
              {data.developers.map(v => (
                <tr key={v.id}>
                  <td className="ds-td-dev">
                    <div className="ds-heatmap-dev-col">
                      <div className="ds-heatmap-avatar">{initials(v.name)}</div>
                      <div className="ds-heatmap-dev-info">
                        <span className="ds-heatmap-dev-name">{v.name}</span>
                        <span className="ds-heatmap-dev-title">{v.title}</span>
                      </div>
                    </div>
                  </td>
                  {v.week.map((n, i) => {
                    const ratio = n / mx;
                    const isSelected = data.W[i] === D;
                    const bg = n > 0
                      ? `color-mix(in srgb, var(--accent) ${Math.round(20 + ratio * 70)}%, var(--surface))`
                      : isSelected
                      ? "color-mix(in srgb, var(--accent) 5%, transparent)"
                      : "transparent";
                    const isDark = ratio > 0.55;
                    return (
                      <td key={i} className={`ds-td-day ${isSelected ? "is-selected-col" : ""}`}>
                        <span
                          className={`ds-heatmap-cell ${n > 0 ? "has-val" : "is-empty"}`}
                          style={{
                            background: bg,
                            color: isDark ? "var(--accent-ink)" : n > 0 ? "var(--fg)" : "var(--muted)",
                            border: n > 0 ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" : undefined,
                          }}
                          title={`${v.name} · ${data.W[i]}: ${n} changes`}
                        >
                          {n > 0 ? n : "·"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="ds-td-metric">
                    <span className="ds-heatmap-total-badge">
                      {v.week.reduce((a, b) => a + b, 0)}
                    </span>
                  </td>
                  <td className="ds-td-metric">
                    <span className="ds-heatmap-updates-badge">
                      {v.weekUpdates}/7
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 9. Activity Feed & Due or Blocked Two-Column Section */}
      <section className="ds-two-col">
        {/* Activity Feed */}
        <div className="ds-panel-card">
          <div className="ds-panel-head">
            <h2 className="ds-panel-title">
              <Icons.Activity size={17} />
              <span>
                Activity {lbl}{" "}
                <span className="ds-section-badge">{data.feed.length}</span>
              </span>
            </h2>
          </div>
          {!data.feed.length ? (
            <div className="ds-empty-box">
              <Icons.Activity size={24} />
              <b>No status changes yet</b>
              <p>
                {isToday
                  ? "Each time a developer moves an item (started, testing, completed) it appears here."
                  : "Nothing moved on this day."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.feed.map((f, i) => (
                <Link
                  key={i}
                  href={`/tasks?edit=${f.id}`}
                  className="ds-item-card"
                  style={{
                    ["--stripe-c" as string]: STATUS_MAP[f.to as TaskStatus]?.color ?? "var(--muted)",
                  }}
                >
                  <div className="ds-item-main">
                    <div className="ds-item-title">{f.title}</div>
                    <div className="ds-item-sub">
                      <span>{f.devs || "Unassigned"}</span>
                      <span>·</span>
                      <span style={{ fontWeight: 600 }}>
                        {f.from
                          ? `${STATUS_MAP[f.from as TaskStatus]?.label ?? f.from} → `
                          : "Created as "}
                        {STATUS_MAP[f.to as TaskStatus]?.label ?? f.to}
                      </span>
                    </div>
                  </div>
                  {tag(f.project)}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Due or Blocked */}
        <div className="ds-panel-card">
          <div className="ds-panel-head">
            <h2 className="ds-panel-title">
              <Icons.Clock size={17} />
              <span>
                Due or blocked{" "}
                {data.attention.length > 0 && (
                  <span className="ds-btn-badge">{data.attention.length}</span>
                )}
              </span>
            </h2>
          </div>
          {!data.attention.length ? (
            <div className="ds-empty-box">
              <Icons.CheckCircle size={24} />
              <b>Nothing due or blocked</b>
              <p>All scheduled milestones and tasks are progressing cleanly.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.attention.map(t => {
                const isOverdue = t.due < D;
                const isHold = t.status === "hold";
                const stripeColor = isHold || isOverdue ? "var(--bad)" : "var(--warn)";
                return (
                  <Link
                    key={t.id}
                    href={`/tasks?edit=${t.id}`}
                    className="ds-item-card"
                    style={{ ["--stripe-c" as string]: stripeColor }}
                  >
                    <div className="ds-item-main">
                      <div className="ds-item-title">{t.title}</div>
                      <div className="ds-item-sub">
                        <span
                          style={{
                            fontWeight: 700,
                            color: isHold || isOverdue ? "var(--bad)" : "var(--warn)",
                          }}
                        >
                          {isHold ? "Blocked" : isOverdue ? `Overdue ${fmtDay(t.due)}` : "Due today"}
                        </span>
                        <span>·</span>
                        <span>{t.devs || "Unassigned"}</span>
                      </div>
                    </div>
                    {tag(t.project)}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 10. Standup Modal Drawer (Preserved 100%) */}
      {standup && <StandupPanel dev={standup} date={D} onClose={() => setStandup(null)} />}
    </div>
  );
}

// ============================================================================
// Urgent Issues List with Live SLA Timer
// ============================================================================
function UrgentList({ issues, sla }: { issues: HomeData["urgentIssues"]; sla: HomeData["sla"] }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {issues.map(x => {
        const left = Date.parse(x.createdAt) + (sla[x.priority as keyof typeof sla] ?? 72) * 3600e3 - now;
        return (
          <Link
            key={x.id}
            href={`/issues?edit=${x.id}`}
            className="ds-item-card"
            style={{ ["--stripe-c" as string]: "var(--bad)" }}
          >
            <div className="ds-item-main">
              <div className="ds-item-title">
                <span style={{ fontFamily: "var(--mono)", color: "var(--bad)", marginRight: 6 }}>
                  {x.id}
                </span>
                {x.title}
              </div>
              <div className="ds-item-sub">
                <span>{x.devs || "Unassigned"}</span>
                <span>·</span>
                <span>{ISSUE_STATUS_MAP[x.status]?.label ?? x.status}</span>
              </div>
            </div>
            {now ? (
              left < 0 ? (
                <Chip color="var(--bad)">Late {duration(-left)}</Chip>
              ) : (
                <Chip color={left < 3600e3 ? "var(--warn)" : "var(--ok)"}>{duration(left)} left</Chip>
              )
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================================
// Reminder Banner (Preserved 100%)
// ============================================================================
function ReminderBanner({ data }: { data: HomeData }) {
  const compose = useCompose();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(1);
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!tick || !data.reminders) return null;
  const A = autoReminders(data.reminders.auto);
  const M = data.reminders.list.filter(isDue);
  if (!A.length && !M.length && !data.pendingApprovals) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid color-mix(in srgb, var(--warn) 45%, var(--line))",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(15, 26, 42, 0.04)",
      }}
    >
      {data.pendingApprovals > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "color-mix(in srgb, var(--warn) 10%, transparent)",
            borderRadius: 8,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--fg)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Clock size={15} style={{ color: "var(--warn)" }} />
            {data.pendingApprovals} request{data.pendingApprovals === 1 ? "" : "s"} waiting for your approval
          </span>
          <Link className="ds-btn ds-btn-primary" href="/approvals">
            Review
          </Link>
        </div>
      )}
      {A.map(a => (
        <div
          key={a.key}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "var(--sunk)",
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Bell size={14} style={{ color: "var(--warn)" }} />
              {a.title}
            </div>
            {a.sub && <div className="muted" style={{ fontSize: 11.5 }}>{a.sub}</div>}
          </div>
          {a.meetingId ? (
            <Link className="ds-btn ds-btn-primary" href={`/calendar?edit=${a.meetingId}`}>
              Open meeting
            </Link>
          ) : (
            <button
              className="ds-btn ds-btn-primary"
              type="button"
              onClick={() => compose({ tpl: a.tpl, devIds: a.devIds })}
            >
              Send reminder
            </button>
          )}
        </div>
      ))}
      {M.slice(0, 5).map(r => (
        <div
          key={r.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "var(--sunk)",
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Bell size={14} style={{ color: "var(--warn)" }} />
              {r.title}
            </div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              Due {fmtDay(r.date)} {r.time}
            </div>
          </div>
          <Link className="ds-btn" href={`/reminders?edit=${r.id}`}>
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Standup Panel Drawer (Preserved 100%)
// ============================================================================
function StandupPanel({ dev, date, onClose }: { dev: DevCard; date: string; onClose: () => void }) {
  const initial = dev.standup ?? { done: "", plan: "", blockers: "", hours: "" };
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (k: keyof Standup, v: string) => setF(x => ({ ...x, [k]: v }));

  return (
    <Panel
      title={`Daily update · ${dev.name}`}
      subtitle={new Date(date + "T00:00:00Z").toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })}
      dirty={dirty}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ds-btn" type="button" onClick={requestClose}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" type="submit" form="suform" disabled={busy}>
              Save update
            </button>
          </div>
        </>
      )}
    >
      {dev.movedTodayTitles.length > 0 && (
        <div className="banner" style={{ margin: "0 0 16px" }}>
          <span>Moved that day: {dev.movedTodayTitles.join("; ")}</span>
        </div>
      )}
      <form
        className="form"
        id="suform"
        onSubmit={e => {
          e.preventDefault();
          start(async () => {
            setError("");
            const r = await saveStandup(dev.id, date, f);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast("Daily update saved");
            onClose();
          });
        }}
      >
        <div className="field full">
          <label htmlFor="su_done">What I completed / worked on</label>
          <AntTextArea
            id="su_done"
            rows={3}
            value={f.done}
            onChange={e => set("done", e.target.value)}
            autoFocus
          />
        </div>
        <div className="field full">
          <label htmlFor="su_plan">Plan for next working day</label>
          <AntTextArea
            id="su_plan"
            rows={3}
            value={f.plan}
            onChange={e => set("plan", e.target.value)}
          />
        </div>
        <div className="field full">
          <label htmlFor="su_block">Blockers / help needed</label>
          <AntTextArea
            id="su_block"
            rows={2}
            value={f.blockers}
            onChange={e => set("blockers", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="su_hrs">Hours worked</label>
          <AntInput
            id="su_hrs"
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={f.hours}
            onChange={e => set("hours", e.target.value)}
          />
        </div>
        {error && (
          <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}
