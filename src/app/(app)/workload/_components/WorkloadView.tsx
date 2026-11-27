"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import type { Priority, TaskStatus } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ListChecks,
  RotateCcw,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { handOver, setAvailability } from "@/server/work";
import { PRIORITY_COLOR, projectColor } from "@/lib/constants";
import { ISSUE_STATUS_MAP, duration, issuePriorityColor } from "@/lib/issues";
import { fmtDay, today } from "@/lib/dates";
import { initials } from "@/lib/work";
import { Empty, StatusChip } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { SharePanel, LoadChip } from "@/components/shared/collaboration/SharePanel";
import { AntInput, AntSelect, AntTextArea, AntTable, type ColumnsType } from "@/components/ui/antd";
import "./workload-dashboard.css";

export type DevTaskItem = {
  id: string;
  sno?: number;
  title: string;
  subModule?: string;
  priority?: Priority | null;
  status: TaskStatus;
  progress?: number;
  estHoursLeft?: number;
  due: string;
  project: string;
  projectCode?: string;
  others: string[];
};

export type DevIssueItem = {
  id: string;
  title: string;
  status?: string;
  priority: string;
  project?: string;
  createdAt: string;
  others: string[];
};

export type DevLoad = {
  id: string;
  name: string;
  title: string;
  availability: string;
  urgent: number;
  issues: number;
  active: number;
  open: number;
  hold: number;
  overdue: number;
  hoursLeft: number;
  score: number;
  tasks: DevTaskItem[];
  issueList: DevIssueItem[];
};

type WorkItemRow = {
  key: string;
  kind: "task" | "issue";
  id: string;
  ref: string;
  title: string;
  subModule: string;
  project: string;
  status: string;
  priority: string;
  due: string;
  createdAt: string;
  isUrgent: boolean;
  isActive: boolean;
  isOpen: boolean;
  isHold: boolean;
  isOverdue: boolean;
  estHoursLeft: number;
  assigneeIds: string[];
};

type Props = {
  loads: DevLoad[];
  sla: { Urgent: number; High: number; Normal: number };
  canManage: boolean;
  canEdit: boolean;
};

const BOARD_PAGE_SIZE = 6;
const PRIORITY_RANK: Record<string, number> = { Urgent: 5, Critical: 4, High: 3, Medium: 2, Normal: 2, Low: 1 };

const loadBandOf = (d: DevLoad): "leave" | "overloaded" | "busy" | "capacity" => {
  if (d.availability === "On leave") return "leave";
  if (d.score >= 8) return "overloaded";
  if (d.score >= 4) return "busy";
  return "capacity";
};

const formatTaskRef = (t: DevTaskItem) => {
  if (!t.sno) return "TASK";
  const prefix = t.projectCode || t.project?.slice(0, 3).toUpperCase() || "TSK";
  return `${prefix}-${String(t.sno).padStart(3, "0")}`;
};

export function WorkloadView({ loads, sla, canManage, canEdit }: Props) {
  const router = useRouter();
  const [share, setShare] = useState<{ kind: "task" | "issue"; id: string; title: string; current: string[] } | null>(null);
  const [handFrom, setHandFrom] = useState<DevLoad | null>(null);
  const [, start] = useTransition();

  // Live SLA timer
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Developer capacity table filters & pagination
  const [devSearch, setDevSearch] = useState("");
  const [devBandFilter, setDevBandFilter] = useState("");
  const [devPage, setDevPage] = useState(1);
  const [devPageSize, setDevPageSize] = useState(10);

  // Unified Work Items queue filters & pagination
  const [itemSearch, setItemSearch] = useState("");
  const [itemDevFilter, setItemDevFilter] = useState("");
  const [itemStateFilter, setItemStateFilter] = useState("");
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(10);

  // Developer board pagination
  const [boardPage, setBoardPage] = useState(1);

  const T = today();
  const mx = Math.max(1, ...loads.map(d => d.score));
  const nameById = useMemo(() => new Map(loads.map(d => [d.id, d.name])), [loads]);
  const devName = (id: string) => nameById.get(id) ?? "";

  // Deduplicated work items carried across the team
  const workItems = useMemo<WorkItemRow[]>(() => {
    const map = new Map<string, WorkItemRow>();

    for (const d of loads) {
      for (const x of d.issueList) {
        const key = `issue:${x.id}`;
        const existing = map.get(key);
        const ids = [d.id, ...x.others];
        if (!existing) {
          const slaHours = sla[x.priority as keyof typeof sla] ?? 72;
          const late = Date.parse(x.createdAt) + slaHours * 3600e3 < nowMs;
          map.set(key, {
            key,
            kind: "issue",
            id: x.id,
            ref: x.id,
            title: x.title,
            subModule: "",
            project: x.project || "",
            status: x.status || "open",
            priority: x.priority || "Normal",
            due: "",
            createdAt: x.createdAt,
            isUrgent: x.priority === "Urgent",
            isActive: true,
            isOpen: false,
            isHold: false,
            isOverdue: late,
            estHoursLeft: 0,
            assigneeIds: [...new Set(ids)],
          });
        } else {
          existing.assigneeIds = [...new Set([...existing.assigneeIds, ...ids])];
        }
      }

      for (const t of d.tasks) {
        const key = `task:${t.id}`;
        const existing = map.get(key);
        const ids = [d.id, ...t.others];
        if (!existing) {
          const isActive = ["progress", "qa", "uat"].includes(t.status);
          const isOpen = t.status === "pending";
          const isHold = t.status === "hold";
          const isOverdue = !!t.due && t.due < T;
          map.set(key, {
            key,
            kind: "task",
            id: t.id,
            ref: formatTaskRef(t),
            title: t.title,
            subModule: t.subModule || "",
            project: t.project,
            status: t.status,
            priority: t.priority || "",
            due: t.due,
            createdAt: "",
            isUrgent: t.priority === "Critical",
            isActive,
            isOpen,
            isHold,
            isOverdue,
            estHoursLeft: t.estHoursLeft ?? 0,
            assigneeIds: [...new Set(ids)],
          });
        } else {
          existing.assigneeIds = [...new Set([...existing.assigneeIds, ...ids])];
        }
      }
    }

    return [...map.values()].sort(
      (a, b) =>
        Number(b.kind === "issue" && b.isUrgent) - Number(a.kind === "issue" && a.isUrgent) ||
        Number(b.isOverdue) - Number(a.isOverdue) ||
        Number(b.kind === "issue") - Number(a.kind === "issue") ||
        (a.due || "9999").localeCompare(b.due || "9999")
    );
  }, [loads, sla, nowMs, T]);

  // Portfolio KPIs
  const availableDevs = useMemo(() => loads.filter(d => d.availability !== "On leave").length, [loads]);
  const onLeaveDevs = loads.length - availableDevs;
  const overloadedDevs = useMemo(() => loads.filter(d => loadBandOf(d) === "overloaded").length, [loads]);
  const urgentIssuesCount = useMemo(() => workItems.filter(w => w.kind === "issue" && w.priority === "Urgent").length, [workItems]);
  const totalIssuesCount = useMemo(() => workItems.filter(w => w.kind === "issue").length, [workItems]);
  const activeItemsCount = useMemo(() => workItems.filter(w => w.kind === "task" && w.isActive).length, [workItems]);
  const openItemsCount = useMemo(() => workItems.filter(w => w.kind === "task" && w.isOpen).length, [workItems]);
  const holdItemsCount = useMemo(() => workItems.filter(w => w.kind === "task" && w.isHold).length, [workItems]);
  const overdueTasksCount = useMemo(() => workItems.filter(w => w.kind === "task" && w.isOverdue).length, [workItems]);
  const totalHoursLeft = useMemo(() => workItems.reduce((acc, w) => acc + w.estHoursLeft, 0), [workItems]);
  const avgScore = loads.length ? loads.reduce((acc, d) => acc + d.score, 0) / loads.length : 0;

  const availPct = loads.length ? Math.round((availableDevs / loads.length) * 100) : 0;
  const totalWorkCount = workItems.length || 1;

  // Quick KPI Card toggle helpers
  const toggleDevBand = (band: string) => {
    setDevBandFilter(prev => (prev === band ? "" : band));
    setDevPage(1);
    document.getElementById("wl-dev-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleItemState = (stateKey: string) => {
    setItemStateFilter(prev => (prev === stateKey ? "" : stateKey));
    setItemsPage(1);
    document.getElementById("wl-items-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Filtered Developer table
  const filteredLoads = useMemo(() => {
    const q = devSearch.trim().toLowerCase();
    return loads.filter(d => {
      if (devBandFilter === "available" && d.availability === "On leave") return false;
      if (devBandFilter === "capacity" && loadBandOf(d) !== "capacity") return false;
      if (devBandFilter === "busy" && loadBandOf(d) !== "busy") return false;
      if (devBandFilter === "overloaded" && loadBandOf(d) !== "overloaded") return false;
      if (devBandFilter === "leave" && d.availability !== "On leave") return false;

      if (q) {
        const matchName = d.name.toLowerCase().includes(q);
        const matchTitle = (d.title || "").toLowerCase().includes(q);
        if (!matchName && !matchTitle) return false;
      }
      return true;
    });
  }, [loads, devSearch, devBandFilter]);

  const hasDevFilters = Boolean(devSearch.trim() || devBandFilter);
  const resetDevFilters = () => {
    setDevSearch("");
    setDevBandFilter("");
    setDevPage(1);
  };
  const safeDevPage = Math.min(devPage, Math.max(1, Math.ceil(filteredLoads.length / devPageSize)));

  // Filtered Work Items queue
  const filteredWorkItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return workItems.filter(w => {
      if (itemDevFilter && !w.assigneeIds.includes(itemDevFilter)) return false;

      if (itemStateFilter === "urgent" && !(w.kind === "issue" && w.priority === "Urgent")) return false;
      if (itemStateFilter === "issues" && w.kind !== "issue") return false;
      if (itemStateFilter === "active" && !(w.kind === "task" && w.isActive)) return false;
      if (itemStateFilter === "pending" && !(w.kind === "task" && w.isOpen)) return false;
      if (itemStateFilter === "hold" && !(w.kind === "task" && w.isHold)) return false;
      if (itemStateFilter === "overdue" && !w.isOverdue) return false;

      if (q) {
        const matchRef = w.ref.toLowerCase().includes(q);
        const matchTitle = w.title.toLowerCase().includes(q);
        const matchProj = w.project.toLowerCase().includes(q);
        const matchMod = w.subModule.toLowerCase().includes(q);
        const matchDevs = w.assigneeIds.some(id => devName(id).toLowerCase().includes(q));
        if (!matchRef && !matchTitle && !matchProj && !matchMod && !matchDevs) return false;
      }
      return true;
    });
  }, [workItems, itemSearch, itemDevFilter, itemStateFilter, nameById]);

  const hasItemFilters = Boolean(itemSearch.trim() || itemDevFilter || itemStateFilter);
  const resetItemFilters = () => {
    setItemSearch("");
    setItemDevFilter("");
    setItemStateFilter("");
    setItemsPage(1);
  };
  const safeItemsPage = Math.min(itemsPage, Math.max(1, Math.ceil(filteredWorkItems.length / itemsPageSize)));

  // Developer capacity table columns
  const devColumns: ColumnsType<DevLoad> = [
    {
      title: "Developer",
      key: "developer",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_: unknown, d: DevLoad) => (
        <div className="wl-dev-cell">
          <span className="wl-avatar">{initials(d.name)}</span>
          <div style={{ minWidth: 0 }}>
            <Link href={`/tasks?dev=${d.id}`} style={{ color: "var(--fg)", fontWeight: 700, textDecoration: "none" }}>
              {d.name}
            </Link>
            <div className="muted" style={{ fontSize: 11.5 }}>
              {d.title || "Developer"}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 220,
      render: (_: unknown, d: DevLoad) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <LoadChip d={d} />
          {canManage && (
            <AntSelect
              aria-label={`${d.name} availability`}
              value={d.availability}
              style={{ width: 112, minWidth: 112 }}
              options={[
                ["Available", "Available"],
                ["On leave", "On leave"],
              ]}
              onChange={e => {
                const v = e.target.value as "Available" | "On leave";
                start(async () => {
                  const r = await setAvailability(d.id, v);
                  toast(r.ok ? `${d.name}: ${v}` : r.error);
                });
              }}
            />
          )}
        </div>
      ),
    },
    {
      title: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
          <Zap size={13} style={{ color: "var(--bad)" }} /> Urgent
        </span>
      ),
      dataIndex: "urgent",
      key: "urgent",
      className: "num",
      align: "right",
      sorter: (a, b) => a.urgent - b.urgent,
      render: (urgent: number) => <span className="mono" style={urgent ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{urgent}</span>,
    },
    {
      title: "Issues",
      dataIndex: "issues",
      key: "issues",
      className: "num",
      align: "right",
      sorter: (a, b) => a.issues - b.issues,
      render: (v: number) => <span className="mono">{v}</span>,
    },
    {
      title: "Active",
      dataIndex: "active",
      key: "active",
      className: "num",
      align: "right",
      sorter: (a, b) => a.active - b.active,
      render: (active: number) => <span className="mono" style={{ color: active ? "var(--info)" : undefined, fontWeight: active ? 700 : 500 }}>{active}</span>,
    },
    {
      title: "Open",
      dataIndex: "open",
      key: "open",
      className: "num",
      align: "right",
      sorter: (a, b) => a.open - b.open,
      render: (v: number) => <span className="mono">{v}</span>,
    },
    {
      title: "On hold",
      dataIndex: "hold",
      key: "hold",
      className: "num",
      align: "right",
      sorter: (a, b) => a.hold - b.hold,
      render: (v: number) => <span className="mono" style={v ? { color: "var(--warn)", fontWeight: 600 } : undefined}>{v}</span>,
    },
    {
      title: "Overdue",
      dataIndex: "overdue",
      key: "overdue",
      className: "num",
      align: "right",
      sorter: (a, b) => a.overdue - b.overdue,
      render: (overdue: number) => <span className="mono" style={overdue ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{overdue}</span>,
    },
    {
      title: "Est. hours left",
      dataIndex: "hoursLeft",
      key: "hoursLeft",
      className: "num mono",
      align: "right",
      sorter: (a, b) => a.hoursLeft - b.hoursLeft,
      render: (hoursLeft: number) => (hoursLeft ? hoursLeft.toFixed(1) : "—"),
    },
    {
      title: "Load",
      key: "load",
      width: 150,
      sorter: (a, b) => a.score - b.score,
      render: (_: unknown, d: DevLoad) => (
        <div className="progress">
          <div className="bar">
            <i style={{ width: `${(d.score / mx) * 100}%`, background: d.score >= 8 ? "var(--bad)" : d.score >= 4 ? "var(--warn)" : "var(--ok)" }} />
          </div>
          <span className="mono">{d.score.toFixed(1)}</span>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            title: "",
            key: "action",
            align: "right" as const,
            width: 120,
            render: (_: unknown, d: DevLoad) =>
              d.tasks.length > 0 || d.issueList.length > 0 ? (
                <button className="btn" type="button" onClick={() => setHandFrom(d)}>
                  Hand over…
                </button>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>—</span>
              ),
          },
        ]
      : []),
  ];

  // Unified Work Items queue columns
  const workItemColumns: ColumnsType<WorkItemRow> = [
    {
      title: "Type & Ref",
      key: "ref",
      width: 150,
      sorter: (a, b) => a.ref.localeCompare(b.ref),
      render: (_: unknown, w: WorkItemRow) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className={`wl-ref-pill${w.kind === "issue" ? " is-issue" : ""}`}>
            {w.kind === "issue" && <Zap size={11} />}
            {w.ref}
          </span>
        </div>
      ),
    },
    {
      title: "Work item",
      dataIndex: "title",
      key: "title",
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (title: string, w: WorkItemRow) => (
        <div style={{ minWidth: 200 }}>
          <Link
            href={w.kind === "issue" ? `/issues?view=${w.id}` : `/tasks?view=${w.id}`}
            onClick={e => e.stopPropagation()}
            style={{ color: "var(--fg)", fontWeight: 600, textDecoration: "none" }}
          >
            {title}
          </Link>
          {w.subModule && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              {w.subModule}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Project",
      dataIndex: "project",
      key: "project",
      width: 120,
      sorter: (a, b) => a.project.localeCompare(b.project),
      render: (proj: string) =>
        proj ? (
          <span className="mtag" style={{ ["--mc" as string]: projectColor(proj) }}>
            {proj}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: "Assigned to",
      key: "assignees",
      width: 190,
      render: (_: unknown, w: WorkItemRow) => {
        const names = w.assigneeIds.map(devName).filter(Boolean);
        if (!names.length) return <span className="muted">Unassigned</span>;
        return (
          <div className="wl-dev-cell" title={names.join(", ")}>
            <span className="wl-avatar" style={{ width: 24, height: 24, borderRadius: 7, fontSize: 10 }}>
              {initials(names[0])}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {names[0]}
              {names.length > 1 && <span className="muted"> +{names.length - 1}</span>}
            </span>
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 150,
      render: (_: unknown, w: WorkItemRow) => {
        if (w.kind === "issue") {
          const st = ISSUE_STATUS_MAP[w.status];
          return (
            <Chip color={st?.color ?? "var(--bad)"} dot>
              {st?.label ?? w.status}
            </Chip>
          );
        }
        return <StatusChip status={w.status as TaskStatus} />;
      },
    },
    {
      title: "Priority",
      key: "priority",
      width: 110,
      sorter: (a, b) => (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0),
      render: (_: unknown, w: WorkItemRow) => {
        if (!w.priority) return <span className="muted">—</span>;
        const color = w.kind === "issue" ? issuePriorityColor(w.priority) : (PRIORITY_COLOR[w.priority as Priority] ?? "var(--info)");
        return <Chip color={color}>{w.priority}</Chip>;
      },
    },
    {
      title: "Due / SLA",
      key: "due",
      width: 145,
      sorter: (a, b) => (a.due || a.createdAt || "9999").localeCompare(b.due || b.createdAt || "9999"),
      render: (_: unknown, w: WorkItemRow) => {
        if (w.kind === "issue") {
          const slaHours = sla[w.priority as keyof typeof sla] ?? 72;
          const left = Date.parse(w.createdAt) + slaHours * 3600e3 - nowMs;
          return left < 0 ? (
            <Chip color="var(--bad)">Late {duration(-left)}</Chip>
          ) : (
            <Chip color={left < 3600e3 ? "var(--warn)" : "var(--ok)"}>{duration(left)} left</Chip>
          );
        }
        if (!w.due) return <span className="muted">—</span>;
        return (
          <span className="mono" style={{ color: w.isOverdue ? "var(--bad)" : undefined, fontWeight: w.isOverdue ? 700 : 500, whiteSpace: "nowrap" }}>
            {fmtDay(w.due)}
          </span>
        );
      },
    },
    ...(canEdit
      ? [
          {
            title: "Share",
            key: "share",
            align: "right" as const,
            width: 90,
            render: (_: unknown, w: WorkItemRow) => (
              <button
                className="btn"
                type="button"
                style={{ padding: "4px 10px" }}
                title="Share or hand over"
                onClick={e => {
                  e.stopPropagation();
                  setShare({ kind: w.kind, id: w.id, title: w.title, current: w.assigneeIds });
                }}
              >
                ⇄
              </button>
            ),
          },
        ]
      : []),
  ];

  // Developer board card slicing
  const boardTotalPages = Math.max(1, Math.ceil(loads.length / BOARD_PAGE_SIZE));
  const safeBoardPage = Math.min(boardPage, boardTotalPages);
  const boardSlice = loads.slice((safeBoardPage - 1) * BOARD_PAGE_SIZE, safeBoardPage * BOARD_PAGE_SIZE);

  return (
    <div className="wl-container">
      {/* 1. Redesigned KPI Cards Grid */}
      <section className="wl-kpi-grid" aria-label="Work on hand KPIs">
        {/* Card 1: Team Availability */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleDevBand("available")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleDevBand("available");
            }
          }}
          title="Filter Developer capacity table to available developers"
          className={`wl-kpi-card is-interactive${devBandFilter === "available" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: "var(--accent)" }}
        >
          <div className="wl-kpi-top">
            <span className="wl-kpi-badge">
              <span className="wl-kpi-badge-dot" />
              Team Availability
            </span>
            <span className="wl-kpi-icon">
              <Users size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="wl-kpi-body">
            <div className="wl-kpi-val-row">
              <span className="wl-kpi-val">
                {availableDevs}/{loads.length}
              </span>
              <span className="wl-kpi-pill">{availPct}% online</span>
            </div>
            <div className="wl-kpi-label">Available developers</div>
            <div className="wl-kpi-sub">
              {onLeaveDevs} on leave · {overloadedDevs} overloaded
            </div>
          </div>
          <div className="wl-kpi-foot">
            <div className="wl-kpi-track">
              <i style={{ width: `${availPct}%` }} />
            </div>
            <div className="wl-kpi-foot-meta">
              <span>Active team capacity</span>
              <span className="wl-kpi-cue">{devBandFilter === "available" ? "Filtered" : "Filter devs"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Urgent Issues */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleItemState("urgent")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleItemState("urgent");
            }
          }}
          title="Filter Work items table to urgent issues"
          className={`wl-kpi-card is-interactive${urgentIssuesCount > 0 ? " is-bad" : ""}${itemStateFilter === "urgent" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: urgentIssuesCount > 0 ? "var(--bad)" : "var(--ok)" }}
        >
          <div className="wl-kpi-top">
            <span className="wl-kpi-badge">
              <span className="wl-kpi-badge-dot" />
              {urgentIssuesCount > 0 ? "SLA Priority" : "Issues Clear"}
            </span>
            <span className="wl-kpi-icon">
              <Zap size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="wl-kpi-body">
            <div className="wl-kpi-val-row">
              <span className="wl-kpi-val">{urgentIssuesCount}</span>
              <span className="wl-kpi-pill">{totalIssuesCount} open issues</span>
            </div>
            <div className="wl-kpi-label">Urgent issues</div>
            <div className="wl-kpi-sub">
              {urgentIssuesCount > 0 ? "Double-weighted in load score" : "Zero urgent escalations"}
            </div>
          </div>
          <div className="wl-kpi-foot">
            <div className="wl-kpi-track">
              <i style={{ width: `${totalIssuesCount ? Math.round((urgentIssuesCount / totalIssuesCount) * 100) : 0}%` }} />
            </div>
            <div className="wl-kpi-foot-meta">
              <span>Support queue</span>
              <span className="wl-kpi-cue">{itemStateFilter === "urgent" ? "Filtered" : "Filter queue"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Work */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleItemState("active")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleItemState("active");
            }
          }}
          title="Filter Work items table to active work"
          className={`wl-kpi-card is-interactive${itemStateFilter === "active" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: "var(--info)" }}
        >
          <div className="wl-kpi-top">
            <span className="wl-kpi-badge">
              <span className="wl-kpi-badge-dot" />
              In Flight
            </span>
            <span className="wl-kpi-icon">
              <Activity size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="wl-kpi-body">
            <div className="wl-kpi-val-row">
              <span className="wl-kpi-val">{activeItemsCount}</span>
              <span className="wl-kpi-pill">{Math.round((activeItemsCount / totalWorkCount) * 100)}% of queue</span>
            </div>
            <div className="wl-kpi-label">Active work</div>
            <div className="wl-kpi-sub">In progress, testing QA &amp; UAT</div>
          </div>
          <div className="wl-kpi-foot">
            <div className="wl-kpi-track">
              <i style={{ width: `${Math.round((activeItemsCount / totalWorkCount) * 100)}%` }} />
            </div>
            <div className="wl-kpi-foot-meta">
              <span>Full-weight active load</span>
              <span className="wl-kpi-cue">{itemStateFilter === "active" ? "Filtered" : "Filter queue"}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Open Backlog & Hold */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleItemState("pending")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleItemState("pending");
            }
          }}
          title="Filter Work items table to open backlog"
          className={`wl-kpi-card is-interactive${itemStateFilter === "pending" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: holdItemsCount > 0 ? "var(--warn)" : "var(--hold)" }}
        >
          <div className="wl-kpi-top">
            <span className="wl-kpi-badge">
              <span className="wl-kpi-badge-dot" />
              Queued / Hold
            </span>
            <span className="wl-kpi-icon">
              <Layers size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="wl-kpi-body">
            <div className="wl-kpi-val-row">
              <span className="wl-kpi-val">{openItemsCount}</span>
              <span className="wl-kpi-pill">{holdItemsCount} on hold</span>
            </div>
            <div className="wl-kpi-label">Open backlog</div>
            <div className="wl-kpi-sub">Assigned items awaiting start or blocked</div>
          </div>
          <div className="wl-kpi-foot">
            <div className="wl-kpi-track">
              <i style={{ width: `${Math.round((openItemsCount / totalWorkCount) * 100)}%` }} />
            </div>
            <div className="wl-kpi-foot-meta">
              <span>Light-weighted backlog</span>
              <span className="wl-kpi-cue">{itemStateFilter === "pending" ? "Filtered" : "Filter queue"}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Overdue Tasks */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleItemState("overdue")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleItemState("overdue");
            }
          }}
          title="Filter Work items table to overdue items"
          className={`wl-kpi-card is-interactive${overdueTasksCount > 0 ? " is-bad" : ""}${itemStateFilter === "overdue" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: overdueTasksCount > 0 ? "var(--bad)" : "var(--ok)" }}
        >
          <div className="wl-kpi-top">
            <span className="wl-kpi-badge">
              <span className="wl-kpi-badge-dot" />
              {overdueTasksCount > 0 ? "Action Needed" : "Schedule"}
            </span>
            <span className="wl-kpi-icon">
              {overdueTasksCount > 0 ? <AlertTriangle size={18} strokeWidth={2.2} /> : <CheckCircle2 size={18} strokeWidth={2.2} />}
            </span>
          </div>
          <div className="wl-kpi-body">
            <div className="wl-kpi-val-row">
              <span className="wl-kpi-val">{overdueTasksCount}</span>
              <span className="wl-kpi-pill">{overdueTasksCount > 0 ? "Late" : "On track"}</span>
            </div>
            <div className="wl-kpi-label">Overdue tasks</div>
            <div className="wl-kpi-sub">
              {overdueTasksCount > 0 ? "Past due date across team" : "Zero overdue tasks on hand"}
            </div>
          </div>
          <div className="wl-kpi-foot">
            <div className="wl-kpi-track">
              <i style={{ width: `${Math.round((overdueTasksCount / totalWorkCount) * 100)}%` }} />
            </div>
            <div className="wl-kpi-foot-meta">
              <span>Deadline compliance</span>
              <span className="wl-kpi-cue">{itemStateFilter === "overdue" ? "Filtered" : "Inspect"}</span>
            </div>
          </div>
        </div>

        {/* Card 6: Estimated Hours Left */}
        <div className="wl-kpi-card" style={{ ["--kpi-c" as string]: "var(--lms)" }}>
          <div className="wl-kpi-top">
            <span className="wl-kpi-badge">
              <span className="wl-kpi-badge-dot" />
              Remaining Effort
            </span>
            <span className="wl-kpi-icon">
              <Clock size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="wl-kpi-body">
            <div className="wl-kpi-val-row">
              <span className="wl-kpi-val">{totalHoursLeft > 0 ? `${totalHoursLeft.toFixed(1)}h` : "0h"}</span>
              <span className="wl-kpi-pill">Avg {avgScore.toFixed(1)} load</span>
            </div>
            <div className="wl-kpi-label">Est. hours left</div>
            <div className="wl-kpi-sub">Remaining effort from item estimates &amp; progress</div>
          </div>
          <div className="wl-kpi-foot">
            <div className="wl-kpi-track">
              <i style={{ width: `${Math.min(100, Math.round((avgScore / 8) * 100))}%` }} />
            </div>
            <div className="wl-kpi-foot-meta">
              <span>{workItems.length} total items on hand</span>
              <span className="wl-kpi-cue">
                <Link href="/tasks" style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  Tasks <ArrowUpRight size={12} />
                </Link>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Developer Capacity Paginated Table */}
      <section id="wl-dev-table" className="wl-table-card" aria-label="Developer capacity table">
        <div className="wl-card-head">
          <div className="wl-card-head-left">
            <span className="wl-sec-icon">
              <Users size={16} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 className="wl-sec-title">Developer capacity</h2>
                <span className="wl-count-pill">
                  {hasDevFilters ? `${filteredLoads.length} of ${loads.length}` : loads.length}
                </span>
              </div>
              <div className="wl-card-sub">Availability, workload breakdown, and hand-over controls per developer</div>
            </div>
          </div>
          <div className="wl-card-head-right">
            <Link href="/developers" className="btn">
              Manage developers
            </Link>
          </div>
        </div>

        <div className="wl-toolbar">
          <div className="wl-search-wrap">
            <AntInput
              value={devSearch}
              onChange={e => {
                setDevSearch(e.target.value);
                setDevPage(1);
              }}
              placeholder="Search developer by name or role..."
              prefix={<Search size={14} style={{ color: "var(--muted)" }} />}
              allowClear
              aria-label="Search developers"
            />
          </div>
          <div className="wl-filter-select">
            <AntSelect
              aria-label="Filter by load status"
              value={devBandFilter}
              onChange={e => {
                setDevBandFilter(e.target.value);
                setDevPage(1);
              }}
              options={[
                ["", "All statuses"],
                ["available", "Available only"],
                ["capacity", "Has capacity"],
                ["busy", "Busy"],
                ["overloaded", "Overloaded"],
                ["leave", "On leave"],
              ]}
            />
          </div>
          {hasDevFilters && (
            <button type="button" className="btn" onClick={resetDevFilters}>
              <RotateCcw size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <AntTable<DevLoad>
          dataSource={filteredLoads}
          columns={devColumns}
          rowKey="id"
          scroll={{ x: "max-content" }}
          pagination={{
            current: safeDevPage,
            pageSize: devPageSize,
            total: filteredLoads.length,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "50"],
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total} developers`,
            onChange: (nextPage, nextSize) => {
              if (nextSize !== devPageSize) {
                setDevPageSize(nextSize);
                setDevPage(1);
              } else {
                setDevPage(nextPage);
              }
            },
          }}
          emptyTitle={hasDevFilters ? "No developers match these filters" : "No developers yet"}
          emptyDescription={
            hasDevFilters
              ? "Try clearing your search or status filter."
              : "Add developers in People & access to see their work on hand."
          }
          emptyAction={
            hasDevFilters ? (
              <button type="button" className="btn" onClick={resetDevFilters}>
                Clear filters
              </button>
            ) : canManage ? (
              <Link href="/developers" className="btn primary">
                + Add developer
              </Link>
            ) : undefined
          }
        />

        <div className="wl-table-foot-note">
          Load counts active work fully, open items lightly, and urgent issues double. Est. hours left uses each item&apos;s estimate and progress.
        </div>
      </section>

      {/* 3. Unified Work Items on Hand Paginated Table */}
      <section id="wl-items-table" className="wl-table-card" aria-label="Work items on hand">
        <div className="wl-card-head">
          <div className="wl-card-head-left">
            <span className="wl-sec-icon">
              <Briefcase size={16} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 className="wl-sec-title">Work items on hand</h2>
                <span className="wl-count-pill">
                  {hasItemFilters ? `${filteredWorkItems.length} of ${workItems.length}` : workItems.length}
                </span>
              </div>
              <div className="wl-card-sub">Every open task and support issue currently assigned across the team</div>
            </div>
          </div>
          <div className="wl-card-head-right">
            <Link href="/tasks" className="btn">
              <ListChecks size={14} />
              <span>All tasks</span>
            </Link>
            <Link href="/issues" className="btn">
              <Zap size={14} />
              <span>Urgent issues</span>
            </Link>
          </div>
        </div>

        <div className="wl-toolbar">
          <div className="wl-search-wrap">
            <AntInput
              value={itemSearch}
              onChange={e => {
                setItemSearch(e.target.value);
                setItemsPage(1);
              }}
              placeholder="Search item ref, title, project, or developer..."
              prefix={<Search size={14} style={{ color: "var(--muted)" }} />}
              allowClear
              aria-label="Search work items on hand"
            />
          </div>
          <div className="wl-filter-select">
            <AntSelect
              aria-label="Filter by developer"
              value={itemDevFilter}
              onChange={e => {
                setItemDevFilter(e.target.value);
                setItemsPage(1);
              }}
              options={[
                ["", "All developers"],
                ...loads.map(d => [d.id, d.name] as [string, string]),
              ]}
            />
          </div>
          <div className="wl-filter-select">
            <AntSelect
              aria-label="Filter by item state"
              value={itemStateFilter}
              onChange={e => {
                setItemStateFilter(e.target.value);
                setItemsPage(1);
              }}
              options={[
                ["", "All work items"],
                ["urgent", "Urgent issues"],
                ["issues", "All open issues"],
                ["active", "Active tasks"],
                ["pending", "Open backlog"],
                ["hold", "On hold / blocked"],
                ["overdue", "Overdue"],
              ]}
            />
          </div>
          {hasItemFilters && (
            <button type="button" className="btn" onClick={resetItemFilters}>
              <RotateCcw size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <AntTable<WorkItemRow>
          dataSource={filteredWorkItems}
          columns={workItemColumns}
          rowKey="key"
          onRowClick={w => router.push(w.kind === "issue" ? `/issues?view=${w.id}` : `/tasks?view=${w.id}`)}
          scroll={{ x: "max-content" }}
          pagination={{
            current: safeItemsPage,
            pageSize: itemsPageSize,
            total: filteredWorkItems.length,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "50", "100"],
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total} items`,
            onChange: (nextPage, nextSize) => {
              if (nextSize !== itemsPageSize) {
                setItemsPageSize(nextSize);
                setItemsPage(1);
              } else {
                setItemsPage(nextPage);
              }
            },
          }}
          emptyTitle={hasItemFilters ? "No work items match these filters" : "No work on hand"}
          emptyDescription={
            hasItemFilters
              ? "Try clearing your search or switching developer / state filters."
              : "Assigned open tasks and urgent issues appear here with live SLA tracking, sharing, and pagination."
          }
          emptyAction={
            hasItemFilters ? (
              <button type="button" className="btn" onClick={resetItemFilters}>
                Clear filters
              </button>
            ) : undefined
          }
        />
      </section>

      {/* 4. Work on Hand by Developer Board (Paginated Developer Cards) */}
      <section className="wl-board-section" aria-label="Work on hand by developer">
        <div className="wl-board-head">
          <div className="wl-card-head-left">
            <span className="wl-sec-icon">
              <ArrowRightLeft size={16} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 className="wl-sec-title">Work on hand by developer</h2>
                <span className="wl-count-pill">{loads.length}</span>
              </div>
              <div className="wl-card-sub">Per-developer card view for quick sharing and handover</div>
            </div>
          </div>
        </div>

        {!loads.length ? (
          <Empty title="No developers yet">Add developers to see their work on hand.</Empty>
        ) : (
          <>
            <div className="wl-dev-grid">
              {boardSlice.map(d => {
                const act = d.tasks.filter(t => ["progress", "qa", "uat", "hold"].includes(t.status));
                const op = d.tasks.filter(t => t.status === "pending");
                const shareBtn = (kind: "task" | "issue", id: string, title: string, others: string[]) =>
                  canEdit && (
                    <button
                      className="btn"
                      type="button"
                      style={{ padding: "3px 8px" }}
                      title="Share or hand over"
                      onClick={e => {
                        e.preventDefault();
                        setShare({ kind, id, title, current: [d.id, ...others] });
                      }}
                    >
                      ⇄
                    </button>
                  );
                const sharedWith = (others: string[]) =>
                  others.length > 0 && <> · shared with {others.map(o => devName(o).split(" ")[0]).join(", ")}</>;

                return (
                  <div key={d.id} className="wl-dev-card">
                    <div className="wl-dev-card-head">
                      <div className="wl-dev-cell">
                        <span className="wl-avatar">{initials(d.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--fg)" }}>{d.name}</div>
                          <div className="muted" style={{ fontSize: 11.5 }}>{d.title || "Developer"}</div>
                        </div>
                      </div>
                      <LoadChip d={d} />
                    </div>

                    <div className="wl-dev-card-stats">
                      <div className="wl-dev-stat">
                        <b style={d.issues ? { color: "var(--bad)" } : undefined}>{d.issues}</b>
                        <span>Issues</span>
                      </div>
                      <div className="wl-dev-stat">
                        <b style={d.active ? { color: "var(--info)" } : undefined}>{d.active}</b>
                        <span>Active</span>
                      </div>
                      <div className="wl-dev-stat">
                        <b>{d.open}</b>
                        <span>Open</span>
                      </div>
                      <div className="wl-dev-stat">
                        <b style={d.overdue ? { color: "var(--bad)" } : undefined}>{d.overdue}</b>
                        <span>Overdue</span>
                      </div>
                    </div>

                    <div className="wl-dev-card-body">
                      {d.issueList.map(x => {
                        const left = Date.parse(x.createdAt) + (sla[x.priority as keyof typeof sla] ?? 72) * 3600e3 - nowMs;
                        return (
                          <Link
                            key={x.id}
                            href={`/issues?view=${x.id}`}
                            className="card"
                            style={{ ["--mc" as string]: "var(--bad)", textDecoration: "none", color: "inherit" }}
                          >
                            <div className="r">
                              <span className="mono" style={{ fontWeight: 700, color: "var(--bad)" }}>
                                {x.id}
                              </span>
                              <Chip color={issuePriorityColor(x.priority)}>{x.priority}</Chip>
                            </div>
                            <div className="t">{x.title}</div>
                            <div className="r">
                              <span>
                                {left < 0 ? (
                                  <Chip color="var(--bad)">Late {duration(-left)}</Chip>
                                ) : (
                                  <Chip color={left < 3600e3 ? "var(--warn)" : "var(--ok)"}>{duration(left)} left</Chip>
                                )}
                                {sharedWith(x.others)}
                              </span>
                              {shareBtn("issue", x.id, x.title, x.others)}
                            </div>
                          </Link>
                        );
                      })}

                      {[...act, ...op.slice(0, 8)].map((t, i) => (
                        <Fragment key={t.id}>
                          {i === act.length && (
                            <div
                              className="muted"
                              style={{ font: "600 11px var(--body)", letterSpacing: ".06em", textTransform: "uppercase", margin: "6px 4px 0" }}
                            >
                              Open · {op.length}
                            </div>
                          )}
                          <Link
                            href={`/tasks?view=${t.id}`}
                            className="card"
                            style={{ ["--mc" as string]: projectColor(t.project), textDecoration: "none", color: "inherit" }}
                          >
                            <div className="r">
                              <span className="mtag" style={{ ["--mc" as string]: projectColor(t.project) }}>
                                {t.project || "General"}
                              </span>
                              <StatusChip status={t.status} />
                            </div>
                            <div className="t">{t.title}</div>
                            <div className="r">
                              <span>
                                {t.due && <span style={{ color: t.due < T ? "var(--bad)" : undefined }}>Due {fmtDay(t.due)}</span>}
                                {sharedWith(t.others)}
                              </span>
                              {shareBtn("task", t.id, t.title, t.others)}
                            </div>
                          </Link>
                        </Fragment>
                      ))}

                      {op.length > 8 && (
                        <Link className="muted" style={{ fontSize: 12, padding: "2px 4px" }} href={`/tasks?dev=${d.id}&status=pending`}>
                          +{op.length - 8} more
                        </Link>
                      )}

                      {!d.issueList.length && !d.tasks.length && (
                        <div className="wl-dev-empty">
                          <CheckCircle2 size={15} style={{ color: "var(--ok)" }} />
                          <span>No work on hand</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {loads.length > BOARD_PAGE_SIZE && (
              <div className="wl-pager-bar">
                <span>
                  Showing {(safeBoardPage - 1) * BOARD_PAGE_SIZE + 1}–{Math.min(safeBoardPage * BOARD_PAGE_SIZE, loads.length)} of{" "}
                  {loads.length} developers
                </span>
                <div className="wl-pager-btns">
                  <button
                    type="button"
                    className="wl-pager-btn"
                    disabled={safeBoardPage <= 1}
                    onClick={() => setBoardPage(p => Math.max(1, p - 1))}
                    aria-label="Previous developer cards page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    {safeBoardPage} / {boardTotalPages}
                  </span>
                  <button
                    type="button"
                    className="wl-pager-btn"
                    disabled={safeBoardPage >= boardTotalPages}
                    onClick={() => setBoardPage(p => Math.min(boardTotalPages, p + 1))}
                    aria-label="Next developer cards page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {share && <SharePanel {...share} loads={loads} onClose={() => setShare(null)} />}
      {handFrom && <HandoverPanel from={handFrom} loads={loads} onClose={() => setHandFrom(null)} />}
    </div>
  );
}

function HandoverPanel({ from, loads, onClose }: { from: DevLoad; loads: DevLoad[]; onClose: () => void }) {
  const others = loads.filter(d => d.id !== from.id);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [scope, setScope] = useState<"active" | "all" | "issues">("active");
  const [mode, setMode] = useState<"add" | "handover">("add");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <Panel
      title={`Hand over ${from.name}'s work`}
      subtitle={`For leave cover or re-balancing. ${from.tasks.length} open items and ${from.issueList.length} open issues.`}
      onClose={onClose}
      dirty={!!note}
      footer={({ requestClose }) => (
        <>
          <span />
          <div>
            <button className="btn" type="button" onClick={requestClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={busy || !to}
              onClick={() =>
                start(async () => {
                  setError("");
                  const r = await handOver(from.id, to, scope, mode, note);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  toast(`${r.data!.count} handed over to ${others.find(d => d.id === to)?.name}`);
                  onClose();
                })
              }
            >
              Hand over
            </button>
          </div>
        </>
      )}
    >
      <div className="field">
        <label htmlFor="ho_to">Hand over to</label>
        <AntSelect
          id="ho_to"
          value={to}
          onChange={e => setTo(e.target.value)}
          options={others.map(d => [d.id, `${d.name} · ${d.score.toFixed(1)} load`])}
        />
      </div>
      <div className="field">
        <label htmlFor="ho_sc">What to hand over</label>
        <AntSelect
          id="ho_sc"
          value={scope}
          onChange={e => setScope(e.target.value as "active")}
          options={[
            ["active", "Active items and open issues"],
            ["all", "All open items and issues"],
            ["issues", "Open issues only"],
          ]}
        />
      </div>
      <div className="field">
        <label htmlFor="ho_md">How</label>
        <AntSelect
          id="ho_md"
          value={mode}
          onChange={e => setMode(e.target.value as "add")}
          options={[
            ["add", `Add as collaborator (keep ${from.name} on them)`],
            ["handover", "Hand over fully"],
          ]}
        />
      </div>
      <div className="field">
        <label htmlFor="ho_n">Note</label>
        <AntTextArea id="ho_n" rows={3} placeholder="e.g. Annual leave 22–30 Oct" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>
          {error}
        </p>
      )}
    </Panel>
  );
}
