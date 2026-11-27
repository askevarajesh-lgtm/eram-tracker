"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  BookX,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileEdit,
  Paperclip,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { deleteManual, saveManual } from "@/server/manuals";
import { projectColor } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import type { FileRef } from "@/lib/work";
import { AntSelect, AntTable, type ColumnsType } from "@/components/ui/antd";
import { Chip } from "@/components/ui/Chip";
import { EntityEditor, type FieldDef } from "@/components/ui/EntityEditor";
import { Files } from "@/components/ui/Files";
import { RecordActions } from "@/components/ui/RecordActions";
import { toast } from "@/components/ui/Toaster";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { ManualDetailModal } from "./ManualDetailModal";
import "./manuals-dashboard.css";

export type ManualDTO = {
  id: string;
  title: string;
  projectId: string;
  subModule: string;
  level: string;
  status: string;
  version: string;
  language: string;
  owner: string;
  updatedOn: string;
  link: string;
  notes: string;
  files: FileRef[];
};

export type CoverageRow = {
  projectId: string;
  projectName: string;
  subModule: string;
  delivered: number;
  manuals: { id: string; title: string; status: string }[];
  state: string;
};

const STATUS_COLOR: Record<string, string> = {
  Draft: "var(--hold)",
  "In review": "var(--warn)",
  Published: "var(--ok)",
  Outdated: "var(--bad)",
};

const LEVEL_COLOR: Record<string, string> = {
  Admin: "var(--accent)",
  Manager: "var(--info)",
  Developer: "var(--lms)",
};

const LEVELS = ["Admin", "Manager", "Developer"];

// Built-in guides for using the tracker.
const GUIDE: { who: string; steps: [string, React.ReactNode][] } = {
  who: "How to use this tracker",
  steps: [
    ["Start your day", <>Open <Link href="/">Development stats</Link>. Each developer card shows what they are working on, what is open and what is overdue.</>],
    ["Write your daily update", <>On your card press <b>Write daily update</b>: what you completed, your plan for the next working day, blockers and hours. Send it before the daily cut-off time on working days.</>],
    ["Update your items", <>In <Link href="/tasks">Tasks &amp; assignment</Link> filter by your name and open an item. Change <b>Development status</b> (Open → In progress → Testing → UAT → Completed), move the progress slider, log time and attach files.</>],
    ["Urgent issues", <>In <Link href="/issues">Urgent issues</Link> press <b>Take it</b> on unassigned issues, then <b>Resolve</b> and write what was done.</>],
    ["Share or hand over", <>In <Link href="/workload">Work on hand</Link> use <b>⇄</b> on an item to add a collaborator or hand it over, for example before leave.</>],
    ["Approve and plan", <><Link href="/approvals">Approvals</Link> lists urgent issues, tasks waiting for approval and change requests. <Link href="/plan">Plan &amp; control</Link> holds milestones, change requests, releases and risks.</>],
    ["Business-user testing", <>In <Link href="/uat">UAT &amp; sign-off</Link> select developed items, <b>Send for UAT</b>, then <b>Record sign-off</b> or send them back.</>],
    ["Users, licences and companies", <>Keep the register in <Link href="/users">Users &amp; access</Link> and <Link href="/licences">Licences</Link> current; companies and the licence position are on the <Link href="/admin">Admin dashboard</Link>.</>],
    ["Excel", <>Use <b>Upload</b> (top right) to import the SAP status report and <b>Download Excel</b> for the full workbook. <Link href="/reports">Reports</Link> has the week report and management summary.</>],
    ["Accounts and settings", <>Admins add the team under <Link href="/accounts">Sign-in accounts</Link>. Notification rules, message templates, lists and the activity log are in the <Link href="/admin-panel">Admin panel</Link>.</>],
  ],
};

type Props = {
  manuals: ManualDTO[];
  counts: { total: number; published: number; draft: number; outdated: number };
  coverage: CoverageRow[];
  projects: { id: string; name: string }[];
  developers: { id: string; name: string }[];
  modules: string[];
  level: string;
  currentStatus?: string;
  filtered?: boolean;
  editing: ManualDTO | null;
  viewing?: ManualDTO | null;
  openNew: boolean;
  preset: string;
  canEdit: boolean;
  canManage: boolean;
};

export function ManualsView(p: Props) {
  const { update } = useUrlUpdate();
  const [guideOpen, setGuideOpen] = useState(false);

  // View modal state synced with URL `?view=`
  const [viewing, setViewing] = useState<ManualDTO | null>(p.viewing ?? null);
  useEffect(() => {
    setViewing(p.viewing ?? null);
  }, [p.viewing]);

  // Controlled pagination for Team manuals table
  const [manualPage, setManualPage] = useState(1);
  const [manualPageSize, setManualPageSize] = useState(10);

  // Filter & Controlled pagination for Coverage table
  const [covFilter, setCovFilter] = useState("");
  const [covPage, setCovPage] = useState(1);
  const [covPageSize, setCovPageSize] = useState(10);

  const projName = (id: string) => p.projects.find(x => x.id === id)?.name ?? "";
  const devName = (id: string) => p.developers.find(x => x.id === id)?.name ?? id;

  const coveredCount = useMemo(() => p.coverage.filter(r => r.state === "Covered").length, [p.coverage]);
  const coveredPct = p.coverage.length ? Math.round((coveredCount / p.coverage.length) * 100) : 0;
  const coveredLabel = p.coverage.length ? `${coveredPct}%` : "—";
  const gaps = useMemo(() => p.coverage.filter(r => r.state === "No manual" && r.delivered).length, [p.coverage]);

  const sharePct = (n: number) => (p.counts.total > 0 ? Math.round((n / p.counts.total) * 100) : 0);

  const close = () => update({ edit: null, new: null, for: null, view: null });
  const [presetProject, presetModule] = p.preset.split("|");

  const safeManualPage = Math.min(manualPage, Math.max(1, Math.ceil(p.manuals.length / manualPageSize)));

  const filteredCoverage = useMemo(() => {
    if (!covFilter) return p.coverage;
    return p.coverage.filter(r => r.state === covFilter);
  }, [p.coverage, covFilter]);

  const safeCovPage = Math.min(covPage, Math.max(1, Math.ceil(filteredCoverage.length / covPageSize)));

  const toggleStatusFilter = (st: string) => {
    setManualPage(1);
    update({ st: p.currentStatus === st ? null : st });
  };

  const toggleCoverageGapFilter = () => {
    setCovFilter(prev => (prev === "No manual" ? "" : "No manual"));
    setCovPage(1);
    document.getElementById("mn-coverage-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const manualColumns: ColumnsType<ManualDTO> = [
    {
      title: "Manual",
      dataIndex: "title",
      key: "title",
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (title: string, m: ManualDTO) => (
        <div style={{ minWidth: 200 }}>
          <b style={{ fontWeight: 600, color: "var(--fg)" }}>{title}</b>
          {m.notes && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {m.notes.length > 100 ? `${m.notes.slice(0, 100)}…` : m.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Project",
      key: "project",
      width: 120,
      sorter: (a, b) => projName(a.projectId).localeCompare(projName(b.projectId)),
      render: (_: unknown, m: ManualDTO) =>
        m.projectId ? (
          <span className="mtag" style={{ ["--mc" as string]: projectColor(projName(m.projectId)) }}>
            {projName(m.projectId)}
          </span>
        ) : (
          <span className="muted">General</span>
        ),
    },
    {
      title: "Module",
      dataIndex: "subModule",
      key: "subModule",
      width: 140,
      sorter: (a, b) => (a.subModule || "").localeCompare(b.subModule || ""),
      render: (subModule?: string) => subModule || <span className="muted">All modules</span>,
    },
    {
      title: "Level",
      dataIndex: "level",
      key: "level",
      width: 115,
      sorter: (a, b) => a.level.localeCompare(b.level),
      render: (level: string) => <Chip color={LEVEL_COLOR[level] ?? "var(--lms)"}>{level}</Chip>,
    },
    {
      title: "Version",
      dataIndex: "version",
      key: "version",
      width: 95,
      className: "mono",
      render: (v: string) => (v ? <span className="mono">{v}</span> : <span className="muted">—</span>),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 125,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status: string) => (
        <Chip color={STATUS_COLOR[status] ?? "var(--hold)"} dot>
          {status}
        </Chip>
      ),
    },
    {
      title: "Owner",
      key: "owner",
      width: 135,
      render: (_: unknown, m: ManualDTO) => (m.owner ? devName(m.owner) : <span className="muted">—</span>),
    },
    {
      title: "Updated",
      dataIndex: "updatedOn",
      key: "updatedOn",
      width: 125,
      className: "mono",
      sorter: (a, b) => (a.updatedOn || "").localeCompare(b.updatedOn || ""),
      render: (d: string) => (d ? fmtDay(d) : <span className="muted">—</span>),
    },
    {
      title: "Links / Files",
      key: "open",
      width: 150,
      render: (_: unknown, m: ManualDTO) => (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
          {m.link && (
            <a className="mn-action-link" href={m.link} target="_blank" rel="noopener noreferrer" title="Open external manual link">
              <span>Open</span>
              <ExternalLink size={12} />
            </a>
          )}
          {m.files.length > 0 && (
            <a
              className="mn-action-link"
              href={`/api/assets/${m.files[0].id}`}
              target="_blank"
              rel="noopener"
              title={m.files[0].name}
            >
              <Paperclip size={12} />
              <span>{m.files.length > 1 ? `${m.files.length} files` : (m.files[0].name.split(".").pop() || "file").toUpperCase().slice(0, 4)}</span>
            </a>
          )}
          {!m.link && !m.files.length && <span className="muted" style={{ fontSize: 12 }}>—</span>}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 120,
      render: (_: unknown, m: ManualDTO) => (
        <RecordActions
          onView={() => {
            setViewing(m);
            update({ view: m.id, edit: null, new: null });
          }}
          onEdit={p.canEdit ? () => update({ edit: m.id, view: null, new: null }) : undefined}
          onDelete={
            p.canManage
              ? async () => {
                  const r = await deleteManual(m.id);
                  if (!r.ok) {
                    toast(r.error ?? "Failed to delete manual");
                  } else {
                    toast(`Manual "${m.title}" deleted`);
                  }
                }
              : undefined
          }
          deleteConfirmTitle={`Delete manual "${m.title}"?`}
          deleteConfirmMessage="Are you sure you want to delete this user manual and all attached files? This action cannot be undone."
          canEdit={p.canEdit}
          canDelete={p.canManage}
        />
      ),
    },
  ];

  const coverageColumns: ColumnsType<CoverageRow> = [
    {
      title: "Project",
      dataIndex: "projectName",
      key: "project",
      width: 130,
      sorter: (a, b) => a.projectName.localeCompare(b.projectName),
      render: (name: string) => (
        <span className="mtag" style={{ ["--mc" as string]: projectColor(name) }}>
          {name}
        </span>
      ),
    },
    {
      title: "Module",
      dataIndex: "subModule",
      key: "subModule",
      sorter: (a, b) => (a.subModule || "").localeCompare(b.subModule || ""),
      render: (sub?: string) => <span style={{ fontWeight: 600 }}>{sub || "(no module)"}</span>,
    },
    {
      title: "Delivered items",
      dataIndex: "delivered",
      key: "delivered",
      className: "num",
      align: "right",
      width: 135,
      sorter: (a, b) => a.delivered - b.delivered,
      render: (val: number) => <span className="mono">{val}</span>,
    },
    {
      title: "Manuals",
      key: "manuals",
      render: (_: unknown, r: CoverageRow) =>
        r.manuals.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {r.manuals.map(m => (
              <div key={m.id}>
                <Link href={`/manuals?view=${m.id}`} style={{ fontWeight: 500 }}>
                  {m.title}
                </Link>{" "}
                <span className="muted" style={{ fontSize: 11.5 }}>
                  ({m.status})
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: "Coverage",
      dataIndex: "state",
      key: "state",
      width: 135,
      sorter: (a, b) => a.state.localeCompare(b.state),
      render: (state: string) => (
        <Chip color={state === "Covered" ? "var(--ok)" : state === "In progress" ? "var(--warn)" : "var(--bad)"} dot>
          {state}
        </Chip>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "right",
      width: 120,
      render: (_: unknown, r: CoverageRow) =>
        p.canEdit && r.state === "No manual" ? (
          <button
            className="btn primary"
            type="button"
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={() => update({ new: "1", for: `${r.projectId}|${r.subModule}`, edit: null, view: null })}
          >
            + Manual
          </button>
        ) : r.manuals.length > 0 ? (
          <Link className="mn-action-link" href={`/manuals?view=${r.manuals[0].id}`}>
            View
          </Link>
        ) : null,
    },
  ];

  return (
    <div className="mn-container">
      {/* 1. Collapsible Built-in Guide Banner */}
      <details
        className="mn-guide-card"
        open={guideOpen}
        onToggle={e => setGuideOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="mn-guide-summary">
          <div className="mn-guide-left">
            <span className="mn-guide-icon">
              <BookMarked size={16} />
            </span>
            <Chip color="var(--accent)">Guide</Chip>
            <span className="mn-guide-title">{GUIDE.who}</span>
          </div>
          <div className="mn-guide-right">
            <span>Built-in guide · {GUIDE.steps.length} steps</span>
            <ChevronDown size={16} className="mn-guide-chev" />
          </div>
        </summary>
        <div className="mn-guide-body">
          <div className="mn-guide-steps">
            {GUIDE.steps.map(([title, body], idx) => (
              <div key={title} className="mn-guide-step">
                <span className="mn-guide-num">{idx + 1}</span>
                <div>
                  <b>{title}.</b> {body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>

      {/* 2. Redesigned KPI Cards Grid (3x2) */}
      <section className="mn-kpi-grid" aria-label="User manuals metrics">
        {/* Card 1: Total Manuals */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setManualPage(1);
            update({ st: null });
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setManualPage(1);
              update({ st: null });
            }
          }}
          title="Show all manuals"
          className={`mn-kpi-card is-interactive${!p.currentStatus ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: "var(--accent)" }}
        >
          <div className="mn-kpi-top">
            <span className="mn-kpi-tag">
              <span className="mn-kpi-tag-dot" />
              Library
            </span>
            <span className="mn-kpi-icon">
              <BookOpen size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mn-kpi-body">
            <div className="mn-kpi-val-row">
              <span className="mn-kpi-val">{p.counts.total}</span>
              <span className="mn-kpi-pill">{p.projects.length} projects</span>
            </div>
            <div className="mn-kpi-label">Manuals</div>
            <div className="mn-kpi-sub">Total documentation records tracked</div>
          </div>
          <div className="mn-kpi-foot">
            <div className="mn-kpi-track">
              <i style={{ width: p.counts.total > 0 ? "100%" : "0%" }} />
            </div>
            <div className="mn-kpi-foot-meta">
              <span>All guides &amp; SOPs</span>
              <span className="mn-kpi-cue">{!p.currentStatus ? "Showing all" : "Show all"}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Published */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleStatusFilter("Published")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleStatusFilter("Published");
            }
          }}
          title="Filter by Published manuals"
          className={`mn-kpi-card is-interactive${p.currentStatus === "Published" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: "var(--ok)" }}
        >
          <div className="mn-kpi-top">
            <span className="mn-kpi-tag">
              <span className="mn-kpi-tag-dot" />
              Live Docs
            </span>
            <span className="mn-kpi-icon">
              <CheckCircle2 size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mn-kpi-body">
            <div className="mn-kpi-val-row">
              <span className="mn-kpi-val">{p.counts.published}</span>
              <span className="mn-kpi-pill">{sharePct(p.counts.published)}%</span>
            </div>
            <div className="mn-kpi-label">Published</div>
            <div className="mn-kpi-sub">Approved and available to teams</div>
          </div>
          <div className="mn-kpi-foot">
            <div className="mn-kpi-track">
              <i style={{ width: `${sharePct(p.counts.published)}%` }} />
            </div>
            <div className="mn-kpi-foot-meta">
              <span>Share of library</span>
              <span className="mn-kpi-cue">{p.currentStatus === "Published" ? "Filtered" : "Filter published"}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Draft / In Review */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleStatusFilter("Draft")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleStatusFilter("Draft");
            }
          }}
          title="Filter by Draft manuals"
          className={`mn-kpi-card is-interactive${p.currentStatus === "Draft" || p.currentStatus === "In review" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: "var(--warn)" }}
        >
          <div className="mn-kpi-top">
            <span className="mn-kpi-tag">
              <span className="mn-kpi-tag-dot" />
              Authoring
            </span>
            <span className="mn-kpi-icon">
              <FileEdit size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mn-kpi-body">
            <div className="mn-kpi-val-row">
              <span className="mn-kpi-val">{p.counts.draft}</span>
              <span className="mn-kpi-pill">{sharePct(p.counts.draft)}%</span>
            </div>
            <div className="mn-kpi-label">Draft / in review</div>
            <div className="mn-kpi-sub">Guides currently being authored or reviewed</div>
          </div>
          <div className="mn-kpi-foot">
            <div className="mn-kpi-track">
              <i style={{ width: `${sharePct(p.counts.draft)}%` }} />
            </div>
            <div className="mn-kpi-foot-meta">
              <span>Work in progress</span>
              <span className="mn-kpi-cue">{p.currentStatus === "Draft" ? "Filtered" : "Filter drafts"}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Outdated */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleStatusFilter("Outdated")}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleStatusFilter("Outdated");
            }
          }}
          title="Filter by Outdated manuals"
          className={`mn-kpi-card is-interactive${p.counts.outdated > 0 ? " is-bad" : ""}${p.currentStatus === "Outdated" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: p.counts.outdated > 0 ? "var(--bad)" : "var(--ok)" }}
        >
          <div className="mn-kpi-top">
            <span className="mn-kpi-tag">
              <span className="mn-kpi-tag-dot" />
              {p.counts.outdated > 0 ? "Needs Update" : "Current"}
            </span>
            <span className="mn-kpi-icon">
              <AlertTriangle size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mn-kpi-body">
            <div className="mn-kpi-val-row">
              <span className="mn-kpi-val">{p.counts.outdated}</span>
              <span className="mn-kpi-pill">{p.counts.outdated > 0 ? "Stale" : "Up to date"}</span>
            </div>
            <div className="mn-kpi-label">Outdated</div>
            <div className="mn-kpi-sub">
              {p.counts.outdated > 0 ? "Manuals flagged for revision" : "No outdated manuals"}
            </div>
          </div>
          <div className="mn-kpi-foot">
            <div className="mn-kpi-track">
              <i style={{ width: `${sharePct(p.counts.outdated)}%` }} />
            </div>
            <div className="mn-kpi-foot-meta">
              <span>Freshness check</span>
              <span className="mn-kpi-cue">{p.currentStatus === "Outdated" ? "Filtered" : "Inspect"}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Delivered Modules Covered */}
        <div className="mn-kpi-card" style={{ ["--kpi-c" as string]: "var(--info)" }}>
          <div className="mn-kpi-top">
            <span className="mn-kpi-tag">
              <span className="mn-kpi-tag-dot" />
              Coverage Rate
            </span>
            <span className="mn-kpi-icon">
              <ShieldCheck size={18} strokeWidth={2.2} />
            </span>
          </div>
          <div className="mn-kpi-body">
            <div className="mn-kpi-val-row">
              <span className="mn-kpi-val">{coveredLabel}</span>
              <span className="mn-kpi-pill">
                {coveredCount}/{p.coverage.length}
              </span>
            </div>
            <div className="mn-kpi-label">Delivered modules covered</div>
            <div className="mn-kpi-sub">Modules with at least one published guide</div>
          </div>
          <div className="mn-kpi-foot">
            <div className="mn-kpi-track">
              <i style={{ width: `${coveredPct}%` }} />
            </div>
            <div className="mn-kpi-foot-meta">
              <span>{p.coverage.length ? `${coveredCount} of ${p.coverage.length} modules` : "No delivered modules yet"}</span>
            </div>
          </div>
        </div>

        {/* Card 6: Delivered Modules with No Manual */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleCoverageGapFilter}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCoverageGapFilter();
            }
          }}
          title="Filter coverage table to modules missing manuals"
          className={`mn-kpi-card is-interactive${gaps > 0 ? " is-bad" : ""}${covFilter === "No manual" ? " is-active" : ""}`}
          style={{ ["--kpi-c" as string]: gaps > 0 ? "var(--bad)" : "var(--ok)" }}
        >
          <div className="mn-kpi-top">
            <span className="mn-kpi-tag">
              <span className="mn-kpi-tag-dot" />
              {gaps > 0 ? "Missing Docs" : "Full Coverage"}
            </span>
            <span className="mn-kpi-icon">
              {gaps > 0 ? <BookX size={18} strokeWidth={2.2} /> : <CheckCheck size={18} strokeWidth={2.2} />}
            </span>
          </div>
          <div className="mn-kpi-body">
            <div className="mn-kpi-val-row">
              <span className="mn-kpi-val">{gaps}</span>
              <span className="mn-kpi-pill">{gaps > 0 ? "Gaps" : "Complete"}</span>
            </div>
            <div className="mn-kpi-label">Delivered modules with no manual</div>
            <div className="mn-kpi-sub">
              {gaps > 0 ? "Delivered modules needing documentation" : "All delivered modules documented"}
            </div>
          </div>
          <div className="mn-kpi-foot">
            <div className="mn-kpi-track">
              <i style={{ width: `${p.coverage.length ? Math.round((gaps / p.coverage.length) * 100) : 0}%` }} />
            </div>
            <div className="mn-kpi-foot-meta">
              <span>Documentation gaps</span>
              <span className="mn-kpi-cue">{covFilter === "No manual" ? "Filtered" : "View gaps"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Team Manuals CRUD Table Card (Always visible, with Search, Filters, Actions & Pagination) */}
      <section className="mn-table-card" aria-label="Team manuals">
        <div className="mn-card-head">
          <div className="mn-card-head-left">
            <span className="mn-sec-icon">
              <BookOpen size={16} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 className="mn-sec-title">Team manuals</h2>
                <span className="mn-count-pill">
                  {p.filtered ? `${p.manuals.length} of ${p.counts.total}` : p.counts.total}
                </span>
              </div>
              <div className="mn-card-sub">Guides, links, and attached PDFs organized by project, module, and audience level</div>
            </div>
          </div>
          {p.canEdit && (
            <div className="mn-card-head-right">
              <button
                className="btn primary"
                type="button"
                onClick={() => update({ new: "1", edit: null, view: null })}
              >
                <Plus size={14} />
                <span>Add manual</span>
              </button>
            </div>
          )}
        </div>

        <div className="mn-toolbar">
          <UrlFilters
            search={{ placeholder: "Search manuals by title, module, version, or notes…" }}
            selects={[
              { key: "mod", all: "All projects", options: p.projects.map(x => [x.id, x.name]) },
              { key: "st", all: "All statuses", options: Object.keys(STATUS_COLOR).map(s => [s, s]) },
              { key: "lv", all: "All levels", options: LEVELS.map(l => [l, l]) },
            ]}
          />
        </div>

        <AntTable<ManualDTO>
          dataSource={p.manuals}
          columns={manualColumns}
          rowKey="id"
          scroll={{ x: "max-content" }}
          onRowClick={m => {
            setViewing(m);
            update({ view: m.id, edit: null, new: null });
          }}
          pagination={{
            current: safeManualPage,
            pageSize: manualPageSize,
            total: p.manuals.length,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "50", "100"],
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total} manuals`,
            onChange: (nextPage, nextSize) => {
              if (nextSize !== manualPageSize) {
                setManualPageSize(nextSize);
                setManualPage(1);
              } else {
                setManualPage(nextPage);
              }
            },
          }}
          emptyTitle={p.filtered ? "No manuals match these filters" : "No team manuals yet"}
          emptyDescription={
            p.filtered
              ? "Try clearing search or filter parameters to find manuals."
              : "Add your own manuals for each project or module: link to SharePoint, OneDrive, or Google Drive, or attach PDFs."
          }
          emptyAction={
            !p.filtered && p.canEdit ? (
              <button className="btn primary" type="button" onClick={() => update({ new: "1", edit: null, view: null })}>
                + Add manual
              </button>
            ) : undefined
          }
        />
      </section>

      {/* 4. Coverage of Delivered Software Paginated Table Card */}
      <section id="mn-coverage-table" className="mn-table-card" aria-label="Coverage of delivered software">
        <div className="mn-card-head">
          <div className="mn-card-head-left">
            <span className="mn-sec-icon">
              <ShieldCheck size={16} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 className="mn-sec-title">Coverage of delivered software</h2>
                <span className="mn-count-pill">
                  {covFilter ? `${filteredCoverage.length} of ${p.coverage.length}` : p.coverage.length}
                </span>
              </div>
              <div className="mn-card-sub">
                Each module with completed items, and whether a published manual covers it. A manual with no module set covers the whole project.
              </div>
            </div>
          </div>
          <div className="mn-card-head-right" style={{ minWidth: 165 }}>
            <AntSelect
              aria-label="Filter coverage state"
              value={covFilter}
              onChange={e => {
                setCovFilter(e.target.value);
                setCovPage(1);
              }}
              options={[
                ["", "All coverage"],
                ["Covered", "Covered"],
                ["In progress", "In progress"],
                ["No manual", "No manual"],
              ]}
            />
          </div>
        </div>

        <AntTable<CoverageRow>
          dataSource={filteredCoverage}
          columns={coverageColumns}
          rowKey={r => `${r.projectId}__${r.subModule}`}
          scroll={{ x: "max-content" }}
          pagination={{
            current: safeCovPage,
            pageSize: covPageSize,
            total: filteredCoverage.length,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20", "50"],
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total} modules`,
            onChange: (nextPage, nextSize) => {
              if (nextSize !== covPageSize) {
                setCovPageSize(nextSize);
                setCovPage(1);
              } else {
                setCovPage(nextPage);
              }
            },
          }}
          emptyTitle={covFilter ? "No modules in this coverage state" : "Nothing delivered yet"}
          emptyDescription={
            covFilter
              ? "Try switching the coverage filter back to All coverage."
              : "Modules appear here once their items are completed."
          }
          emptyAction={
            covFilter ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCovFilter("");
                  setCovPage(1);
                }}
              >
                Show all modules
              </button>
            ) : undefined
          }
        />
      </section>

      {/* 5. Detail View Modal */}
      {viewing && (
        <ManualDetailModal
          manual={viewing}
          projectName={projName(viewing.projectId)}
          ownerName={viewing.owner ? devName(viewing.owner) : ""}
          canEdit={p.canEdit}
          canDelete={p.canManage}
          onEdit={() => {
            const id = viewing.id;
            setViewing(null);
            update({ edit: id, view: null, new: null });
          }}
          onClose={() => {
            setViewing(null);
            update({ view: null });
          }}
        />
      )}

      {/* 6. Create / Edit CRUD Side Panel */}
      {(p.editing || p.openNew) && (
        <ManualEditor
          key={p.editing?.id ?? `new-${p.preset}`}
          manual={p.editing}
          {...p}
          presetProject={presetProject}
          presetModule={presetModule}
          onClose={close}
        />
      )}
    </div>
  );
}

function ManualEditor({
  manual,
  projects,
  developers,
  modules,
  canEdit,
  canManage,
  presetProject,
  presetModule,
  onClose,
}: Props & { manual: ManualDTO | null; presetProject?: string; presetModule?: string; onClose: () => void }) {
  const projName = (id: string) => projects.find(x => x.id === id)?.name ?? "";
  const fields: FieldDef<Record<string, string>>[] = [
    { key: "title", label: "Title", required: true, full: true, placeholder: "e.g. SAP B1 Finance – user guide" },
    { key: "projectId", label: "Project", type: "select", options: projects.map(x => [x.id, x.name]), empty: "— General / All projects —" },
    { key: "subModule", label: "Module", list: modules, placeholder: "Blank = whole project" },
    { key: "level", label: "Level (who it's for)", type: "select", options: [["Admin", "Admin"], ["Manager", "Manager"], ["Developer", "Developer"]] },
    { key: "status", label: "Status", type: "select", options: Object.keys(STATUS_COLOR).map(s => [s, s]) },
    { key: "version", label: "Version", placeholder: "v1.0" },
    { key: "language", label: "Language", type: "select", options: ["English", "Arabic", "English & Arabic"].map(s => [s, s]) },
    { key: "owner", label: "Owner", type: "select", options: developers.map(d => [d.id, d.name]), empty: "—" },
    { key: "updatedOn", label: "Last updated", type: "date" },
    { key: "link", label: "Link to the manual", type: "url", full: true, placeholder: "https://… (SharePoint, OneDrive, Google Drive)" },
    { key: "notes", label: "Notes / what it covers", type: "textarea" },
  ];
  const pp = presetProject || projects[0]?.id || "";
  return (
    <EntityEditor
      title={manual ? "Edit user manual" : "Add user manual"}
      isNew={!manual}
      fields={fields}
      onClose={onClose}
      canSave={canEdit}
      initial={{
        title: manual?.title ?? (presetProject ? `${projName(presetProject)}${presetModule ? " " + presetModule : ""} – user guide` : ""),
        projectId: manual?.projectId ?? pp,
        subModule: manual?.subModule ?? presetModule ?? "",
        level: manual?.level ?? "Developer",
        status: manual?.status ?? "Draft",
        version: manual?.version ?? "",
        language: manual?.language || "English",
        owner: manual?.owner ?? "",
        updatedOn: manual?.updatedOn || today(),
        link: manual?.link ?? "",
        notes: manual?.notes ?? "",
      }}
      onSave={async v => {
        const r = await saveManual({ ...v, id: manual?.id, level: v.level as "Developer", status: v.status as "Draft" });
        return r.ok ? { ok: true } : r;
      }}
      onDelete={manual && canManage ? () => deleteManual(manual.id) : undefined}
      deleteLabel={manual ? `Delete manual "${manual.title}"?` : undefined}
    >
      <div className="field">
        <label>Files (PDF, images, video)</label>
        {manual ? (
          <Files kind="manual" id={manual.id} files={manual.files} canEdit={canEdit} canRemove={canManage} />
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            Save the manual first, then open it again to attach the PDF or screenshots.
          </span>
        )}
      </div>
    </EntityEditor>
  );
}
