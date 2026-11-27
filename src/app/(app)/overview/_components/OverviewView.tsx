"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { TaskStatus, Priority } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  FolderKanban,
  Layers,
  ListChecks,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ACTIVE_STATUSES, PRIORITY_COLOR, TASK_STATUSES, projectColor } from "@/lib/constants";
import { addDays, averageProgress, initials, progressOf } from "@/lib/work";
import { fmtDay } from "@/lib/dates";
import { SegBar, StatusChip } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { AntInput, AntSelect, AntTable, type ColumnsType } from "@/components/ui/antd";
import "./overview-dashboard.css";

export type OverviewTask = {
  id: string;
  sno?: number;
  title: string;
  projectId: string | null;
  subModule: string;
  type: string;
  status: TaskStatus;
  progress: number | null;
  dueDate: string | null;
  priority: Priority | null;
  testStatus: string;
  acceptStatus: string;
  projectName?: string;
  projectCode?: string;
  assignees: { developerId: string; developerName: string }[];
};

export type OverviewProject = {
  id: string;
  name: string;
  code?: string;
  fullName: string;
  phase: string | null;
  target: string | null;
  lead?: string | null;
};

export type OverviewDeveloper = {
  id: string;
  name: string;
  title: string | null;
};

type Props = {
  todayStr: string;
  projects: OverviewProject[];
  tasks: OverviewTask[];
  developers: OverviewDeveloper[];
  canEdit?: boolean;
  canManage?: boolean;
};

const PRIORITY_RANK: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const STATUS_RANK: Record<string, number> = { hold: 1, pending: 2, progress: 3, qa: 4, uat: 5, done: 6 };
const ATTN_PAGE_SIZE = 6;

const formatTaskRef = (t: OverviewTask) => {
  if (!t.sno) return "—";
  const prefix = t.projectCode || t.projectName?.slice(0, 3).toUpperCase() || "TSK";
  return `${prefix}-${String(t.sno).padStart(3, "0")}`;
};

export function OverviewView({
  todayStr,
  projects,
  tasks,
  developers,
  canEdit = false,
  canManage = false,
}: Props) {
  const router = useRouter();

  // Filters & Pagination state for Development items table
  const [itemSearch, setItemSearch] = useState("");
  const [itemProject, setItemProject] = useState("");
  const [itemStatus, setItemStatus] = useState("");
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(10);

  // Filters & Pagination state for Module status report
  const [modProject, setModProject] = useState("");
  const [modPage, setModPage] = useState(1);
  const [modPageSize, setModPageSize] = useState(10);

  // Pagination state for Developer workload table
  const [devPage, setDevPage] = useState(1);
  const [devPageSize, setDevPageSize] = useState(5);

  // Pagination state for Needs attention list
  const [attnPage, setAttnPage] = useState(1);

  const over = (t: OverviewTask) => t.status !== "done" && !!t.dueDate && t.dueDate < todayStr;
  const active = (s: string) => (ACTIVE_STATUSES as readonly string[]).includes(s);
  const weekLimit = useMemo(() => addDays(todayStr, 7), [todayStr]);
  const dueThisWeek = (t: OverviewTask) => t.status !== "done" && !!t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekLimit;

  // Core KPI counts
  const totalCount = tasks.length;
  const ongoingCount = useMemo(() => tasks.filter(t => active(t.status)).length, [tasks]);
  const pendingCount = useMemo(() => tasks.filter(t => t.status === "pending").length, [tasks]);
  const developedCount = useMemo(() => tasks.filter(t => t.status === "done").length, [tasks]);
  const acceptedCount = useMemo(() => tasks.filter(t => t.acceptStatus === "Accepted").length, [tasks]);
  const overdueCount = useMemo(() => tasks.filter(over).length, [tasks, todayStr]);
  const overallProgress = useMemo(() => averageProgress(tasks), [tasks]);

  const sharePct = (n: number) => (totalCount > 0 ? Math.round((n / totalCount) * 100) : 0);
  const acceptanceRate = developedCount > 0 ? Math.round((acceptedCount / developedCount) * 100) : 0;

  // Circular SVG ring geometry for Overall Progress Hero KPI
  const ringRadius = 25;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - overallProgress / 100);

  // Status counts for hero breakdown
  const statusCounts = useMemo(
    () =>
      TASK_STATUSES.map(s => ({
        ...s,
        short:
          s.key === "pending"
            ? "Open"
            : s.key === "progress"
              ? "In prog"
              : s.key === "qa"
                ? "QA"
                : s.key === "uat"
                  ? "UAT"
                  : s.key === "done"
                    ? "Done"
                    : "Hold",
        count: tasks.filter(t => t.status === s.key).length,
      })),
    [tasks]
  );

  // Scroll to Development items table and apply quick KPI filter
  const toggleItemQuickFilter = (filterKey: "active" | "overdue") => {
    setItemStatus(prev => (prev === filterKey ? "" : filterKey));
    setItemsPage(1);
    if (typeof document !== "undefined") {
      document.getElementById("ov-items-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filtered Development items
  const hasUnassignedProject = useMemo(() => tasks.some(t => !t.projectId), [tasks]);
  const filteredTasks = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return tasks.filter(t => {
      if (itemProject === "_none" && t.projectId) return false;
      if (itemProject && itemProject !== "_none" && t.projectId !== itemProject) return false;

      if (itemStatus === "active" && !active(t.status)) return false;
      else if (itemStatus === "overdue" && !over(t)) return false;
      else if (itemStatus && itemStatus !== "active" && itemStatus !== "overdue" && t.status !== itemStatus) return false;

      if (q) {
        const ref = formatTaskRef(t).toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(q);
        const modMatch = t.subModule.toLowerCase().includes(q);
        const projMatch = (t.projectName || "").toLowerCase().includes(q);
        const devMatch = t.assignees.some(a => a.developerName.toLowerCase().includes(q));
        if (!ref.includes(q) && !titleMatch && !modMatch && !projMatch && !devMatch) return false;
      }
      return true;
    });
  }, [tasks, itemSearch, itemProject, itemStatus, todayStr]);

  const hasActiveItemFilters = Boolean(itemSearch.trim() || itemProject || itemStatus);
  const resetItemFilters = () => {
    setItemSearch("");
    setItemProject("");
    setItemStatus("");
    setItemsPage(1);
  };

  const safeItemsPage = Math.min(itemsPage, Math.max(1, Math.ceil(filteredTasks.length / itemsPageSize)));

  const itemColumns: ColumnsType<OverviewTask> = [
    {
      title: "Ref",
      key: "ref",
      width: 104,
      sorter: (a, b) => (a.sno ?? 0) - (b.sno ?? 0),
      render: (_: unknown, t: OverviewTask) => <span className="ov-ref-pill">{formatTaskRef(t)}</span>,
    },
    {
      title: "Item",
      dataIndex: "title",
      key: "title",
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (title: string, t: OverviewTask) => (
        <div style={{ minWidth: 200 }}>
          <Link
            href={`/tasks?view=${t.id}`}
            onClick={e => e.stopPropagation()}
            style={{ color: "var(--fg)", fontWeight: 600, textDecoration: "none" }}
          >
            {title}
          </Link>
          {(t.subModule || t.type) && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              {[t.subModule, t.type].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Project",
      dataIndex: "projectName",
      key: "projectName",
      width: 120,
      sorter: (a, b) => (a.projectName || "").localeCompare(b.projectName || ""),
      render: (name?: string) =>
        name ? (
          <span className="mtag" style={{ ["--mc" as string]: projectColor(name) }}>
            {name}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 155,
      sorter: (a, b) => (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0),
      render: (status: TaskStatus) => <StatusChip status={status} />,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 110,
      sorter: (a, b) => (PRIORITY_RANK[a.priority ?? ""] ?? 0) - (PRIORITY_RANK[b.priority ?? ""] ?? 0),
      render: (p: Priority | null) => (p ? <Chip color={PRIORITY_COLOR[p] ?? "var(--info)"}>{p}</Chip> : <span className="muted">—</span>),
    },
    {
      title: "Developers",
      key: "developers",
      width: 175,
      render: (_: unknown, t: OverviewTask) => {
        if (!t.assignees.length) return <span className="muted">Unassigned</span>;
        const leadDev = t.assignees[0].developerName;
        const extra = t.assignees.length - 1;
        return (
          <div className="ov-dev-cell" title={t.assignees.map(a => a.developerName).join(", ")}>
            <span className="ov-avatar">{initials(leadDev)}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {leadDev}
              {extra > 0 && <span className="muted"> +{extra}</span>}
            </span>
          </div>
        );
      },
    },
    {
      title: "Due date",
      dataIndex: "dueDate",
      key: "dueDate",
      width: 130,
      sorter: (a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
      render: (due: string | null, t: OverviewTask) => {
        if (!due) return <span className="muted">—</span>;
        const late = over(t);
        return (
          <span className="mono" style={{ color: late ? "var(--bad)" : undefined, fontWeight: late ? 700 : 500, whiteSpace: "nowrap" }}>
            {fmtDay(due)}
          </span>
        );
      },
    },
    {
      title: "Progress",
      key: "progress",
      width: 140,
      sorter: (a, b) => progressOf(a) - progressOf(b),
      render: (_: unknown, t: OverviewTask) => {
        const pct = progressOf(t);
        const col = t.projectName ? projectColor(t.projectName) : "var(--accent)";
        return (
          <div className="progress">
            <div className="bar">
              <i style={{ width: `${pct}%`, background: t.status === "done" ? "var(--ok)" : col }} />
            </div>
            <span className="mono">{pct}%</span>
          </div>
        );
      },
    },
  ];

  // Module status report rows (pure module rows, with project summary via AntTable.Summary)
  const sum = (G: OverviewTask[]) => ({
    total: G.length,
    screens: G.filter(t => t.type === "Screen").length,
    reports: G.filter(t => t.type === "Report").length,
    process: G.filter(t => t.type === "Process").length,
    done: G.filter(t => t.status === "done").length,
    prog: G.filter(t => active(t.status)).length,
    open: G.filter(t => t.status === "pending" || t.status === "hold").length,
    tested: G.filter(t => t.testStatus === "Completed").length,
    accepted: G.filter(t => t.acceptStatus === "Accepted").length,
    pct: averageProgress(G),
  });

  type ModuleStatusRow = {
    key: string;
    projectId: string;
    projectName: string;
    module: string;
    total: number;
    screens: number;
    reports: number;
    process: number;
    done: number;
    prog: number;
    open: number;
    tested: number;
    accepted: number;
    pct: number;
  };

  const hasSubModules = useMemo(() => tasks.some(t => t.subModule), [tasks]);
  const projectsWithModules = useMemo(
    () => projects.filter(p => tasks.some(t => t.projectId === p.id && t.subModule)),
    [projects, tasks]
  );

  const moduleRows: ModuleStatusRow[] = useMemo(() => {
    const scopeProjects = modProject ? projectsWithModules.filter(p => p.id === modProject) : projectsWithModules;
    return scopeProjects.flatMap(p => {
      const L = tasks.filter(t => t.projectId === p.id);
      const subs = [...new Set(L.map(t => t.subModule))].sort();
      return subs.map(sb => {
        const r = sum(L.filter(t => t.subModule === sb));
        return {
          key: `${p.id}_${sb}`,
          projectId: p.id,
          projectName: p.name,
          module: sb || "(no module)",
          total: r.total,
          screens: r.screens,
          reports: r.reports,
          process: r.process,
          done: r.done,
          prog: r.prog,
          open: r.open,
          tested: r.tested,
          accepted: r.accepted,
          pct: r.pct,
        };
      });
    });
  }, [projectsWithModules, modProject, tasks]);

  const moduleTotals = useMemo(() => {
    const matchingTasks = tasks.filter(t => t.projectId && (modProject ? t.projectId === modProject : projectsWithModules.some(p => p.id === t.projectId)));
    return sum(matchingTasks);
  }, [tasks, modProject, projectsWithModules]);

  const safeModPage = Math.min(modPage, Math.max(1, Math.ceil(moduleRows.length / modPageSize)));

  const moduleColumns: ColumnsType<ModuleStatusRow> = [
    {
      title: "Project",
      dataIndex: "projectName",
      key: "projectName",
      width: 115,
      sorter: (a, b) => a.projectName.localeCompare(b.projectName),
      render: (name: string) => (
        <span className="mtag" style={{ ["--mc" as string]: projectColor(name) }}>
          {name}
        </span>
      ),
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      sorter: (a, b) => a.module.localeCompare(b.module),
      render: (mod: string, r) => (
        <Link href={`/tasks?project=${r.projectId}&q=${encodeURIComponent(mod)}`} style={{ color: "var(--fg)", fontWeight: 600 }}>
          {mod}
        </Link>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
      sorter: (a, b) => a.total - b.total,
      render: (val: number) => <span className="mono" style={{ fontWeight: 600 }}>{val}</span>,
    },
    {
      title: "Screens",
      dataIndex: "screens",
      key: "screens",
      align: "right",
      render: (val: number) => <span className="muted mono">{val}</span>,
    },
    {
      title: "Reports",
      dataIndex: "reports",
      key: "reports",
      align: "right",
      render: (val: number) => <span className="muted mono">{val}</span>,
    },
    {
      title: "Process",
      dataIndex: "process",
      key: "process",
      align: "right",
      render: (val: number) => <span className="muted mono">{val}</span>,
    },
    {
      title: "Developed",
      dataIndex: "done",
      key: "done",
      align: "right",
      sorter: (a, b) => a.done - b.done,
      render: (val: number) => <span className="mono" style={val ? { color: "var(--ok)", fontWeight: 600 } : undefined}>{val}</span>,
    },
    {
      title: "In progress",
      dataIndex: "prog",
      key: "prog",
      align: "right",
      sorter: (a, b) => a.prog - b.prog,
      render: (val: number) => <span className="mono" style={val ? { color: "var(--info)", fontWeight: 600 } : undefined}>{val}</span>,
    },
    {
      title: "Open",
      dataIndex: "open",
      key: "open",
      align: "right",
      sorter: (a, b) => a.open - b.open,
      render: (val: number) => <span className="mono" style={val ? { color: "var(--warn)", fontWeight: 600 } : undefined}>{val}</span>,
    },
    {
      title: "Tested",
      dataIndex: "tested",
      key: "tested",
      align: "right",
      render: (val: number) => <span className="mono">{val}</span>,
    },
    {
      title: "Accepted",
      dataIndex: "accepted",
      key: "accepted",
      align: "right",
      render: (val: number) => <span className="mono">{val}</span>,
    },
    {
      title: "Progress",
      dataIndex: "pct",
      key: "pct",
      width: 145,
      sorter: (a, b) => a.pct - b.pct,
      render: (pct: number, r) => (
        <div className="progress">
          <div className="bar">
            <i style={{ width: `${pct}%`, background: projectColor(r.projectName) }} />
          </div>
          <span className="mono">{pct}%</span>
        </div>
      ),
    },
  ];

  // Developer workload rows
  const maxLoad = Math.max(
    1,
    ...developers.map(d =>
      tasks.filter(t => t.assignees.some(a => a.developerId === d.id) && t.status !== "done" && t.status !== "pending").length
    )
  );

  type DevWorkloadRow = {
    id: string;
    name: string;
    title: string | null;
    total: number;
    ongoing: number;
    open: number;
    done: number;
    overdue: number;
    loadRatio: number;
  };

  const devRows: DevWorkloadRow[] = useMemo(
    () =>
      developers.map(d => {
        const L = tasks.filter(t => t.assignees.some(a => a.developerId === d.id));
        const on = L.filter(t => ["progress", "qa", "uat", "hold"].includes(t.status)).length;
        const ov = L.filter(over).length;
        return {
          id: d.id,
          name: d.name,
          title: d.title,
          total: L.length,
          ongoing: on,
          open: L.filter(t => t.status === "pending").length,
          done: L.filter(t => t.status === "done").length,
          overdue: ov,
          loadRatio: (on / maxLoad) * 100,
        };
      }),
    [developers, tasks, maxLoad, todayStr]
  );

  const safeDevPage = Math.min(devPage, Math.max(1, Math.ceil(devRows.length / devPageSize)));

  const devColumns: ColumnsType<DevWorkloadRow> = [
    {
      title: "Developer",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, r) => (
        <div className="ov-dev-cell">
          <span className="ov-avatar">{initials(name)}</span>
          <div style={{ minWidth: 0 }}>
            <Link href={`/tasks?dev=${r.id}`} style={{ color: "var(--fg)", fontWeight: 700, textDecoration: "none" }}>
              {name}
            </Link>
            {r.title && (
              <div className="muted" style={{ fontSize: 11.5 }}>
                {r.title}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      align: "right",
      sorter: (a, b) => a.total - b.total,
      render: (v: number) => <span className="mono">{v}</span>,
    },
    {
      title: "Ongoing",
      dataIndex: "ongoing",
      key: "ongoing",
      align: "right",
      sorter: (a, b) => a.ongoing - b.ongoing,
      render: (v: number) => <span className="mono" style={v ? { color: "var(--info)", fontWeight: 600 } : undefined}>{v}</span>,
    },
    {
      title: "Open",
      dataIndex: "open",
      key: "open",
      align: "right",
      sorter: (a, b) => a.open - b.open,
      render: (v: number) => <span className="mono">{v}</span>,
    },
    {
      title: "Done",
      dataIndex: "done",
      key: "done",
      align: "right",
      sorter: (a, b) => a.done - b.done,
      render: (v: number) => <span className="mono" style={v ? { color: "var(--ok)", fontWeight: 600 } : undefined}>{v}</span>,
    },
    {
      title: "Overdue",
      dataIndex: "overdue",
      key: "overdue",
      align: "right",
      sorter: (a, b) => a.overdue - b.overdue,
      render: (ov: number) => <span className="mono" style={ov ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{ov}</span>,
    },
    {
      title: "Load",
      dataIndex: "loadRatio",
      key: "loadRatio",
      width: 120,
      sorter: (a, b) => a.loadRatio - b.loadRatio,
      render: (pct: number) => (
        <div className="progress">
          <div className="bar">
            <i style={{ width: `${pct}%`, background: pct >= 85 ? "var(--bad)" : pct >= 55 ? "var(--warn)" : "var(--accent)" }} />
          </div>
        </div>
      ),
    },
  ];

  // Needs attention items (with client-side pagination)
  const attentionAll = useMemo(
    () =>
      tasks
        .filter(t => t.status !== "done" && (over(t) || t.status === "hold" || t.priority === "Critical" || dueThisWeek(t)))
        .sort(
          (a, b) =>
            Number(over(b)) - Number(over(a)) ||
            Number(b.status === "hold") - Number(a.status === "hold") ||
            Number(b.priority === "Critical") - Number(a.priority === "Critical") ||
            (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
        ),
    [tasks, todayStr, weekLimit]
  );

  const attnTotalPages = Math.max(1, Math.ceil(attentionAll.length / ATTN_PAGE_SIZE));
  const safeAttnPage = Math.min(attnPage, attnTotalPages);
  const attentionSlice = attentionAll.slice((safeAttnPage - 1) * ATTN_PAGE_SIZE, safeAttnPage * ATTN_PAGE_SIZE);

  return (
    <div className="ov-container">
      {/* 1. Top Portfolio Command Strip */}
      <section className="ov-topbar" aria-label="Portfolio summary bar">
        <div className="ov-topbar-left">
          <span className="ov-eyebrow-pill">
            <span className="ov-eyebrow-dot" />
            Portfolio · As of {fmtDay(todayStr)}
          </span>
          {overdueCount > 0 ? (
            <button
              type="button"
              className="ov-health-pill is-bad"
              onClick={() => toggleItemQuickFilter("overdue")}
              title="Click to inspect overdue items in table"
            >
              <AlertTriangle size={13} />
              <span>{overdueCount} overdue item{overdueCount === 1 ? "" : "s"}</span>
            </button>
          ) : totalCount > 0 ? (
            <span className="ov-health-pill is-ok">
              <CheckCircle2 size={13} />
              <span>All active items on schedule</span>
            </span>
          ) : (
            <span className="ov-health-pill">
              <span>Ready for setup</span>
            </span>
          )}
          <span className="ov-meta-text">
            {projects.length} project{projects.length === 1 ? "" : "s"} · {developers.length} developer{developers.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="ov-topbar-right">
          <Link href="/tasks" className="ov-quick-link">
            <ListChecks size={14} />
            <span>Task board</span>
          </Link>
          <Link href="/projects" className="ov-quick-link">
            <FolderKanban size={14} />
            <span>Projects</span>
          </Link>
          {canEdit && (
            <Link href="/tasks?new=1" className="ov-quick-link is-primary">
              <Plus size={14} />
              <span>New task</span>
            </Link>
          )}
        </div>
      </section>

      {/* 2. Redesigned Bento KPI Cards Grid */}
      <section className="ov-kpi-grid" aria-label="Development overview KPIs">
        {/* Card 1: Total Items */}
        <Link
          href="/tasks"
          className="ov-kpi-card is-interactive"
          style={{ ["--kpi-c" as string]: "var(--accent)" }}
        >
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              Portfolio Scope
            </span>
            <span className="ov-kpi-icon">
              <Layers size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="ov-kpi-main">
            <div className="ov-kpi-val-row">
              <span className="ov-kpi-val">{totalCount}</span>
              <span className="ov-kpi-share">{projects.length} proj</span>
            </div>
            <div className="ov-kpi-label">Total items</div>
            <div className="ov-kpi-sub">Tracked across all modules</div>
          </div>
          <div className="ov-kpi-foot">
            <div className="ov-kpi-track">
              <i style={{ width: totalCount > 0 ? "100%" : "0%" }} />
            </div>
            <div className="ov-kpi-foot-meta">
              <span>All development records</span>
              <span className="ov-kpi-cue">
                View all <ArrowUpRight size={12} />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 2: Ongoing */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleItemQuickFilter("active")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleItemQuickFilter("active");
            }
          }}
          title="Filter Development items table to ongoing work"
          className={`ov-kpi-card is-interactive${itemStatus === "active" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: "var(--info)" }}
        >
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              Active Work
            </span>
            <span className="ov-kpi-icon">
              <Activity size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="ov-kpi-main">
            <div className="ov-kpi-val-row">
              <span className="ov-kpi-val">{ongoingCount}</span>
              <span className="ov-kpi-share">{sharePct(ongoingCount)}%</span>
            </div>
            <div className="ov-kpi-label">Ongoing</div>
            <div className="ov-kpi-sub">In progress, testing QA &amp; UAT</div>
          </div>
          <div className="ov-kpi-foot">
            <div className="ov-kpi-track">
              <i style={{ width: `${sharePct(ongoingCount)}%` }} />
            </div>
            <div className="ov-kpi-foot-meta">
              <span>Active delivery sprint</span>
              <span className="ov-kpi-cue">
                {itemStatus === "active" ? "Filtered" : "Filter table"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Start */}
        <Link
          href="/tasks?status=pending"
          className="ov-kpi-card is-interactive"
          style={{ ["--kpi-c" as string]: "var(--warn)" }}
        >
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              Backlog Queue
            </span>
            <span className="ov-kpi-icon">
              <Clock size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="ov-kpi-main">
            <div className="ov-kpi-val-row">
              <span className="ov-kpi-val">{pendingCount}</span>
              <span className="ov-kpi-share">{sharePct(pendingCount)}%</span>
            </div>
            <div className="ov-kpi-label">Pending start</div>
            <div className="ov-kpi-sub">Open items awaiting pickup</div>
          </div>
          <div className="ov-kpi-foot">
            <div className="ov-kpi-track">
              <i style={{ width: `${sharePct(pendingCount)}%` }} />
            </div>
            <div className="ov-kpi-foot-meta">
              <span>Ready to assign</span>
              <span className="ov-kpi-cue">
                Backlog <ArrowUpRight size={12} />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 4: Developed */}
        <Link
          href="/delivered"
          className="ov-kpi-card is-interactive"
          style={{ ["--kpi-c" as string]: "var(--ok)" }}
        >
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              Completed Build
            </span>
            <span className="ov-kpi-icon">
              <CheckCircle2 size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="ov-kpi-main">
            <div className="ov-kpi-val-row">
              <span className="ov-kpi-val">{developedCount}</span>
              <span className="ov-kpi-share">{sharePct(developedCount)}%</span>
            </div>
            <div className="ov-kpi-label">Developed</div>
            <div className="ov-kpi-sub">Finished and delivered items</div>
          </div>
          <div className="ov-kpi-foot">
            <div className="ov-kpi-track">
              <i style={{ width: `${sharePct(developedCount)}%` }} />
            </div>
            <div className="ov-kpi-foot-meta">
              <span>Delivered software</span>
              <span className="ov-kpi-cue">
                View register <ArrowUpRight size={12} />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 5: User Accepted */}
        <Link
          href="/uat"
          className="ov-kpi-card is-interactive"
          style={{ ["--kpi-c" as string]: "var(--lms)" }}
        >
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              UAT Sign-off
            </span>
            <span className="ov-kpi-icon">
              <ShieldCheck size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="ov-kpi-main">
            <div className="ov-kpi-val-row">
              <span className="ov-kpi-val">{acceptedCount}</span>
              <span className="ov-kpi-share">{acceptanceRate}% of done</span>
            </div>
            <div className="ov-kpi-label">User accepted</div>
            <div className="ov-kpi-sub">Business user approved items</div>
          </div>
          <div className="ov-kpi-foot">
            <div className="ov-kpi-track">
              <i style={{ width: `${acceptanceRate}%` }} />
            </div>
            <div className="ov-kpi-foot-meta">
              <span>Verification rate</span>
              <span className="ov-kpi-cue">
                UAT queue <ArrowUpRight size={12} />
              </span>
            </div>
          </div>
        </Link>

        {/* Card 6: Overdue */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleItemQuickFilter("overdue")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleItemQuickFilter("overdue");
            }
          }}
          title="Filter Development items table to overdue tasks"
          className={`ov-kpi-card is-interactive${overdueCount > 0 ? " is-bad" : ""}${itemStatus === "overdue" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: overdueCount > 0 ? "var(--bad)" : "var(--ok)" }}
        >
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              {overdueCount > 0 ? "SLA Alert" : "Schedule"}
            </span>
            <span className="ov-kpi-icon">
              {overdueCount > 0 ? <AlertTriangle size={18} strokeWidth={2.2} /> : <CalendarCheck size={18} strokeWidth={2.2} />}
            </span>
          </div>
          <div className="ov-kpi-main">
            <div className="ov-kpi-val-row">
              <span className="ov-kpi-val">{overdueCount}</span>
              <span className="ov-kpi-share">{overdueCount > 0 ? "Late" : "On track"}</span>
            </div>
            <div className="ov-kpi-label">Overdue</div>
            <div className="ov-kpi-sub">{overdueCount > 0 ? "Items past target due date" : "Zero overdue items"}</div>
          </div>
          <div className="ov-kpi-foot">
            <div className="ov-kpi-track">
              <i style={{ width: `${sharePct(overdueCount)}%` }} />
            </div>
            <div className="ov-kpi-foot-meta">
              <span>{overdueCount > 0 ? "Requires follow-up" : "Schedule healthy"}</span>
              <span className="ov-kpi-cue">
                {itemStatus === "overdue" ? "Filtered" : "Inspect"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 7 (2-column Hero): Overall Progress & Pipeline Balance */}
        <div className="ov-kpi-card ov-kpi-hero" style={{ ["--kpi-c" as string]: "var(--accent)" }}>
          <div className="ov-kpi-top">
            <span className="ov-kpi-tag">
              <span className="ov-kpi-tag-dot" />
              Overall Progress · Delivery Velocity
            </span>
            <span className="ov-kpi-share">
              {developedCount}/{totalCount} completed
            </span>
          </div>

          <div className="ov-hero-body">
            <div className="ov-hero-metric">
              <div className="ov-ring-wrap" aria-hidden="true">
                <svg width="62" height="62" viewBox="0 0 62 62">
                  <circle
                    cx="31"
                    cy="31"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--sunk)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="31"
                    cy="31"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 31 31)"
                    style={{ transition: "stroke-dashoffset 0.55s ease" }}
                  />
                </svg>
                <span className="ov-ring-center">{overallProgress}%</span>
              </div>
              <div>
                <div className="ov-kpi-val">{overallProgress}%</div>
                <div className="ov-kpi-label">Overall progress</div>
                <div className="ov-kpi-sub">Weighted completion across portfolio</div>
              </div>
            </div>

            <div className="ov-hero-stages" aria-label="Status distribution">
              {statusCounts.map(s => (
                <div key={s.key} className="ov-stage-pill">
                  <span className="ov-stage-left">
                    <span className="ov-stage-dot" style={{ background: s.color }} />
                    <span>{s.short}</span>
                  </span>
                  <b>{s.count}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="ov-kpi-foot">
            <SegBar statuses={tasks.map(t => t.status)} height={7} />
          </div>
        </div>
      </section>

      {/* 3. Projects Portfolio Section */}
      <section className="ov-section" aria-label="Projects">
        <div className="ov-sec-head">
          <div className="ov-sec-title-wrap">
            <span className="ov-sec-icon">
              <FolderKanban size={16} />
            </span>
            <h2 className="ov-sec-title">Projects</h2>
            <span className="ov-count-pill">{projects.length}</span>
          </div>
          <Link href="/projects" className="ov-quick-link">
            <span>Manage projects</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {!projects.length ? (
          <div className="ov-empty-card">
            <span className="ov-empty-icon">
              <FolderKanban size={22} />
            </span>
            <h3>No projects yet</h3>
            <p>Add projects under Setup → Projects (such as SAP B1, ATS, CRM, or LMS) to track delivery progress across your portfolio.</p>
            {canManage && (
              <Link href="/projects" className="btn primary" style={{ marginTop: 8 }}>
                + Add project
              </Link>
            )}
          </div>
        ) : (
          <div className="ov-proj-grid">
            {projects.map(p => {
              const L = tasks.filter(t => t.projectId === p.id);
              const devs = new Set(L.filter(t => t.status !== "done").flatMap(t => t.assignees.map(a => a.developerId)));
              const next = L.filter(t => t.status !== "done" && t.dueDate).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
              const late = L.filter(over).length;
              const pct = averageProgress(L);
              const col = projectColor(p.name);

              return (
                <Link
                  key={p.id}
                  href={`/tasks?project=${p.id}`}
                  className="ov-proj-card"
                  style={{ ["--mc" as string]: col }}
                >
                  <div className="ov-proj-top">
                    <div style={{ minWidth: 0 }}>
                      <div className="ov-proj-name-row">
                        <span className="mtag" style={{ ["--mc" as string]: col }}>
                          {p.name}
                        </span>
                        {p.phase && (
                          <span className="ov-count-pill" style={{ fontFamily: "var(--body)" }}>
                            {p.phase}
                          </span>
                        )}
                      </div>
                      {p.fullName && <div className="ov-proj-full">{p.fullName}</div>}
                    </div>
                    <span className="ov-proj-pct">{pct}%</span>
                  </div>

                  {(p.target || p.lead) && (
                    <div className="ov-proj-meta">
                      {p.lead && <span>Lead: {p.lead}</span>}
                      {p.target && <span>Go-live {p.target}</span>}
                    </div>
                  )}

                  <SegBar statuses={L.map(t => t.status)} height={7} />

                  <div className="legend">
                    {TASK_STATUSES.map(s => {
                      const c = L.filter(t => t.status === s.key).length;
                      return c ? (
                        <span key={s.key}>
                          <i className="dot" style={{ background: s.color }} />
                          {s.label} {c}
                        </span>
                      ) : null;
                    })}
                    {!L.length && <span>No items yet</span>}
                  </div>

                  <div className="ov-proj-foot">
                    <span>
                      <b>{L.length}</b> item{L.length === 1 ? "" : "s"} · <b>{devs.size}</b> active dev{devs.size === 1 ? "" : "s"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {late > 0 && <span style={{ color: "var(--bad)", fontWeight: 700 }}>{late} overdue</span>}
                      {next && <span>Next {fmtDay(next.dueDate)}</span>}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Development Items Table with Search, Filters & Controlled Pagination */}
      <section id="ov-items-table" className="ov-table-card" aria-label="Development items">
        <div className="ov-card-head">
          <div className="ov-card-head-left">
            <span className="ov-sec-icon">
              <ListChecks size={16} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 className="ov-sec-title">Development items</h2>
                <span className="ov-count-pill">
                  {hasActiveItemFilters ? `${filteredTasks.length} of ${tasks.length}` : tasks.length}
                </span>
              </div>
              <div className="ov-card-sub">Search, filter, sort, and paginate tracked items across all projects</div>
            </div>
          </div>

          <div className="ov-card-head-right">
            <Link href="/tasks" className="ov-quick-link">
              <span>Full task board</span>
              <ArrowUpRight size={13} />
            </Link>
            {canEdit && (
              <Link href="/tasks?new=1" className="ov-quick-link is-primary">
                <Plus size={13} />
                <span>New task</span>
              </Link>
            )}
          </div>
        </div>

        <div className="ov-table-toolbar">
          <div className="ov-search-wrap">
            <AntInput
              value={itemSearch}
              onChange={e => {
                setItemSearch(e.target.value);
                setItemsPage(1);
              }}
              placeholder="Search by ref, title, module, or developer..."
              prefix={<Search size={14} style={{ color: "var(--muted)" }} />}
              allowClear
              aria-label="Search development items"
            />
          </div>

          <div className="ov-filter-select">
            <AntSelect
              aria-label="Filter by project"
              value={itemProject}
              onChange={e => {
                setItemProject(e.target.value);
                setItemsPage(1);
              }}
              options={[
                ["", "All projects"],
                ...projects.map(p => [p.id, p.name] as [string, string]),
                ...(hasUnassignedProject ? [["_none", "No project"] as [string, string]] : []),
              ]}
            />
          </div>

          <div className="ov-filter-select">
            <AntSelect
              aria-label="Filter by status"
              value={itemStatus}
              onChange={e => {
                setItemStatus(e.target.value);
                setItemsPage(1);
              }}
              options={[
                ["", "All statuses"],
                ["active", "Ongoing (In prog / QA / UAT)"],
                ["overdue", "Overdue"],
                ...TASK_STATUSES.map(s => [s.key, s.label] as [string, string]),
              ]}
            />
          </div>

          {hasActiveItemFilters && (
            <button type="button" className="btn" onClick={resetItemFilters}>
              <RotateCcw size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>

        <AntTable<OverviewTask>
          dataSource={filteredTasks}
          columns={itemColumns}
          rowKey="id"
          onRowClick={r => router.push(`/tasks?view=${r.id}`)}
          scroll={{ x: "max-content" }}
          pagination={{
            current: safeItemsPage,
            pageSize: itemsPageSize,
            total: filteredTasks.length,
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
          emptyTitle={hasActiveItemFilters ? "No items match these filters" : "No development items yet"}
          emptyDescription={
            hasActiveItemFilters
              ? "Try clearing your search term or switching the project / status filter."
              : "Tasks added on Tasks & assignment appear here with live search and pagination."
          }
          emptyAction={
            hasActiveItemFilters ? (
              <button type="button" className="btn" onClick={resetItemFilters}>
                Clear filters
              </button>
            ) : canEdit ? (
              <Link href="/tasks?new=1" className="btn primary">
                + New task
              </Link>
            ) : undefined
          }
        />
      </section>

      {/* 5. Module Status Report Table (With Controlled Pagination & Totals Summary) */}
      {hasSubModules && (
        <section className="ov-table-card" aria-label="Module status report">
          <div className="ov-card-head">
            <div className="ov-card-head-left">
              <span className="ov-sec-icon">
                <BarChart3 size={16} />
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 className="ov-sec-title">Module status report</h2>
                  <span className="ov-count-pill">{moduleRows.length} modules</span>
                </div>
                <div className="ov-card-sub">Breakdown by sub-module, deliverable type, QA, and acceptance</div>
              </div>
            </div>

            {projectsWithModules.length > 1 && (
              <div className="ov-card-head-right" style={{ minWidth: 170 }}>
                <AntSelect
                  aria-label="Filter modules by project"
                  value={modProject}
                  onChange={e => {
                    setModProject(e.target.value);
                    setModPage(1);
                  }}
                  options={[["", "All projects"], ...projectsWithModules.map(p => [p.id, p.name] as [string, string])]}
                />
              </div>
            )}
          </div>

          <AntTable<ModuleStatusRow>
            dataSource={moduleRows}
            columns={moduleColumns}
            rowKey="key"
            scroll={{ x: "max-content" }}
            pagination={{
              current: safeModPage,
              pageSize: modPageSize,
              total: moduleRows.length,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "50"],
              showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total} modules`,
              onChange: (nextPage, nextSize) => {
                if (nextSize !== modPageSize) {
                  setModPageSize(nextSize);
                  setModPage(1);
                } else {
                  setModPage(nextPage);
                }
              },
            }}
            summary={() =>
              moduleRows.length > 0 ? (
                <AntTable.Summary.Row style={{ background: "var(--sunk)", fontWeight: 700 }}>
                  <AntTable.Summary.Cell index={0} colSpan={2}>
                    <b>Total ({moduleRows.length} module{moduleRows.length === 1 ? "" : "s"})</b>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={2} align="right">
                    <span className="mono">{moduleTotals.total}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={3} align="right">
                    <span className="mono muted">{moduleTotals.screens}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={4} align="right">
                    <span className="mono muted">{moduleTotals.reports}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={5} align="right">
                    <span className="mono muted">{moduleTotals.process}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={6} align="right">
                    <span className="mono" style={{ color: "var(--ok)" }}>{moduleTotals.done}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={7} align="right">
                    <span className="mono" style={{ color: "var(--info)" }}>{moduleTotals.prog}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={8} align="right">
                    <span className="mono" style={{ color: "var(--warn)" }}>{moduleTotals.open}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={9} align="right">
                    <span className="mono">{moduleTotals.tested}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={10} align="right">
                    <span className="mono">{moduleTotals.accepted}</span>
                  </AntTable.Summary.Cell>
                  <AntTable.Summary.Cell index={11}>
                    <span className="mono">{moduleTotals.pct}%</span>
                  </AntTable.Summary.Cell>
                </AntTable.Summary.Row>
              ) : null
            }
            emptyTitle="No module tasks recorded"
            emptyDescription="Assign a sub-module to tasks to see module-by-module progress."
          />
        </section>
      )}

      {/* 6. Bottom Two-Column Section: Developer Workload Table + Needs Attention */}
      <section className="ov-two" aria-label="Team workload and flagged items">
        {/* Developer Workload Paginated Table */}
        <div className="ov-table-card">
          <div className="ov-card-head">
            <div className="ov-card-head-left">
              <span className="ov-sec-icon">
                <Users size={16} />
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 className="ov-sec-title">Developer workload</h2>
                  <span className="ov-count-pill">{developers.length}</span>
                </div>
                <div className="ov-card-sub">Assigned capacity, active items, and overdue count</div>
              </div>
            </div>
            <div className="ov-card-head-right">
              <Link href="/workload" className="ov-quick-link">
                <span>Work on hand</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>

          <AntTable<DevWorkloadRow>
            dataSource={devRows}
            columns={devColumns}
            rowKey="id"
            scroll={{ x: "max-content" }}
            pagination={{
              current: safeDevPage,
              pageSize: devPageSize,
              total: devRows.length,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "50"],
              showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
              onChange: (nextPage, nextSize) => {
                if (nextSize !== devPageSize) {
                  setDevPageSize(nextSize);
                  setDevPage(1);
                } else {
                  setDevPage(nextPage);
                }
              },
            }}
            emptyTitle="No developers yet"
            emptyDescription="Add your team on the Developers page to track individual workload and capacity."
            emptyAction={
              canManage ? (
                <Link href="/developers" className="btn primary">
                  + Add developer
                </Link>
              ) : undefined
            }
          />
        </div>

        {/* Needs Attention Card (Paginated) */}
        <div className="ov-attn-card">
          <div className="ov-card-head">
            <div className="ov-card-head-left">
              <span
                className="ov-sec-icon"
                style={
                  attentionAll.length > 0
                    ? {
                        background: "color-mix(in srgb, var(--bad) 12%, transparent)",
                        color: "var(--bad)",
                        borderColor: "color-mix(in srgb, var(--bad) 25%, transparent)",
                      }
                    : undefined
                }
              >
                <Flame size={16} />
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 className="ov-sec-title">Needs attention</h2>
                  <span className="ov-count-pill">{attentionAll.length}</span>
                </div>
                <div className="ov-card-sub">Overdue, blocked, critical &amp; due-this-week items</div>
              </div>
            </div>
          </div>

          {!attentionAll.length ? (
            <div className="ov-attn-empty">
              <span className="ov-attn-empty-ico">
                <CheckCircle2 size={20} />
              </span>
              <b>Nothing flagged</b>
              <span>Overdue, blocked, critical and due-this-week items appear here.</span>
            </div>
          ) : (
            <>
              <div className="ov-attn-list">
                {attentionSlice.map(t => {
                  const isOver = over(t);
                  const isHold = t.status === "hold";
                  const isCritical = t.priority === "Critical";
                  const c = isOver || isHold ? "var(--bad)" : isCritical ? "var(--warn)" : "var(--info)";
                  const why = isOver ? "Overdue" : isHold ? "On hold / blocked" : isCritical ? "Critical" : "Due this week";
                  const devName = t.assignees[0]?.developerName;
                  return (
                    <Link
                      key={t.id}
                      href={`/tasks?view=${t.id}`}
                      className="ov-attn-item"
                      style={{ ["--c" as string]: c }}
                    >
                      <span className="ov-attn-stripe" />
                      <div style={{ minWidth: 0 }}>
                        <div className="ov-attn-title">{t.title}</div>
                        <div className="ov-attn-meta">
                          <Chip color={c}>{why}</Chip>
                          {t.projectName && <span>{t.projectName}</span>}
                          {devName && <span>· {devName}</span>}
                          {t.dueDate && <span>· due {fmtDay(t.dueDate)}</span>}
                        </div>
                      </div>
                      <ArrowUpRight size={14} className="muted" />
                    </Link>
                  );
                })}
              </div>

              {attentionAll.length > ATTN_PAGE_SIZE && (
                <div className="ov-attn-footer">
                  <span>
                    Showing {(safeAttnPage - 1) * ATTN_PAGE_SIZE + 1}–{Math.min(safeAttnPage * ATTN_PAGE_SIZE, attentionAll.length)} of{" "}
                    {attentionAll.length}
                  </span>
                  <div className="ov-pager-btns">
                    <button
                      type="button"
                      className="ov-pager-btn"
                      disabled={safeAttnPage <= 1}
                      onClick={() => setAttnPage(p => Math.max(1, p - 1))}
                      aria-label="Previous flagged items page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {safeAttnPage} / {attnTotalPages}
                    </span>
                    <button
                      type="button"
                      className="ov-pager-btn"
                      disabled={safeAttnPage >= attnTotalPages}
                      onClick={() => setAttnPage(p => Math.min(attnTotalPages, p + 1))}
                      aria-label="Next flagged items page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
