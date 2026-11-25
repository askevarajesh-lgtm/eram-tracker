"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  LayoutGrid,
  List,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  Check,
  X,
  Clock,
  Zap,
  Layers,
  GitPullRequest,
  Info,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { AntInput } from "@/components/ui/antd";
import { projectColor } from "@/lib/constants";
import { duration, issuePriorityColor } from "@/lib/issues";
import type { QueueItem, Decision, DeveloperOption, ApprovalTab } from "./types";
import { ApprovalKpiCards } from "./ApprovalKpiCards";
import { ApprovalCard } from "./ApprovalCard";
import { ApprovalDetailModal } from "./ApprovalDetailModal";
import { DecideModal } from "./DecideModal";
import { ApprovalsEmptyState } from "./ApprovalsEmptyState";

export type { QueueItem, Decision } from "./types";

type Props = {
  queue: QueueItem[];
  history: Decision[];
  developers: DeveloperOption[];
  canManage: boolean;
};

export function ApprovalsView({ queue, history, developers, canManage }: Props) {
  const [activeTab, setActiveTab] = useState<ApprovalTab>("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected">("all");
  const [deciding, setDeciding] = useState<{ q: QueueItem; act: "approve" | "reject" } | null>(null);
  const [inspecting, setInspecting] = useState<QueueItem | null>(null);

  // Auto-refresh countdown every 60 seconds
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Compute counts for KPIs and Tab badges
  const issuesCount = useMemo(() => queue.filter((x) => x.kind === "issue").length, [queue]);
  const tasksCount = useMemo(() => queue.filter((x) => x.kind === "task").length, [queue]);
  const changesCount = useMemo(() => queue.filter((x) => x.kind === "change").length, [queue]);
  const approvedHistoryCount = useMemo(() => history.filter((h) => h.state === "approved").length, [history]);
  const rejectedHistoryCount = useMemo(() => history.filter((h) => h.state === "rejected").length, [history]);

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      // Tab filter
      if (activeTab === "issues" && item.kind !== "issue") return false;
      if (activeTab === "tasks" && item.kind !== "task") return false;
      if (activeTab === "changes" && item.kind !== "change") return false;

      // Text search
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase();
        const matchRef = item.ref.toLowerCase().includes(q);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchProject = item.projectName?.toLowerCase().includes(q) ?? false;
        const matchRaisedBy = item.raisedBy?.toLowerCase().includes(q) ?? false;
        const matchDevs = item.assigneeNames.some((d) => d.toLowerCase().includes(q));
        if (!matchRef && !matchTitle && !matchDesc && !matchProject && !matchRaisedBy && !matchDevs) {
          return false;
        }
      }

      return true;
    });
  }, [queue, activeTab, queueSearch]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      // Decision filter
      if (historyFilter === "approved" && h.state !== "approved") return false;
      if (historyFilter === "rejected" && h.state !== "rejected") return false;

      // Text search
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchRef = h.ref.toLowerCase().includes(q);
        const matchTitle = h.title.toLowerCase().includes(q);
        const matchBy = h.by.toLowerCase().includes(q);
        const matchNote = h.note.toLowerCase().includes(q);
        const matchProject = h.projectName?.toLowerCase().includes(q) ?? false;
        if (!matchRef && !matchTitle && !matchBy && !matchNote && !matchProject) {
          return false;
        }
      }

      return true;
    });
  }, [history, historyFilter, historySearch]);

  const hasActiveQueueFilters = queueSearch.trim() !== "" || activeTab !== "all";

  // Columns for Pending Queue Table View
  const queueColumns: ColumnsType<QueueItem> = [
    {
      title: "Type & Ref",
      key: "ref",
      width: 170,
      render: (_, r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {r.kind === "issue" ? (
              <Chip color="var(--bad)">
                <Zap size={10} style={{ marginRight: 2 }} />
                Issue
              </Chip>
            ) : r.kind === "task" ? (
              <Chip color="var(--warn)">
                <Layers size={10} style={{ marginRight: 2 }} />
                Task
              </Chip>
            ) : (
              <Chip color="var(--lms)">
                <GitPullRequest size={10} style={{ marginRight: 2 }} />
                Change
              </Chip>
            )}
          </div>
          <span className="mono" style={{ fontWeight: 700, fontSize: 12 }}>
            {r.ref}
          </span>
        </div>
      ),
    },
    {
      title: "Item & Description",
      key: "title",
      render: (_, r) => (
        <div>
          <div
            onClick={() => setInspecting(r)}
            style={{ fontWeight: 600, color: "var(--fg)", cursor: "pointer" }}
            title="Click to view details"
          >
            {r.title}
          </div>
          {r.description && (
            <div
              className="muted"
              style={{
                fontSize: 12,
                marginTop: 2,
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {r.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Project & Priority",
      key: "project",
      width: 170,
      render: (_, r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {r.projectName ? (
            <div>
              <Chip color={projectColor(r.projectName)} dot>
                {r.projectName}
              </Chip>
            </div>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>General</span>
          )}
          <div>
            <Chip color={issuePriorityColor(r.priority)}>
              {r.priority || "Normal"}
            </Chip>
          </div>
        </div>
      ),
    },
    {
      title: "Requester & Assignees",
      key: "requester",
      width: 190,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          {r.raisedBy && (
            <div style={{ color: "var(--fg)", fontWeight: 500 }}>
              By: {r.raisedBy}
            </div>
          )}
          <div className="muted" style={{ marginTop: 2 }}>
            {r.assigneeNames.length > 0
              ? `Devs: ${r.assigneeNames.join(", ")}`
              : "Unassigned"}
          </div>
        </div>
      ),
    },
    {
      title: "Waiting",
      key: "waiting",
      width: 130,
      render: (_, r) => {
        const waitMs = Math.max(0, now - Date.parse(r.at));
        const isLongWait = waitMs > 24 * 3600 * 1000;
        return (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 6,
              background: isLongWait ? "color-mix(in srgb, var(--bad) 10%, transparent)" : "color-mix(in srgb, var(--warn) 10%, transparent)",
              color: isLongWait ? "var(--bad)" : "var(--warn)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            }}
          >
            <Clock size={11} />
            {duration(waitMs)}
          </span>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 220,
      render: (_, r) => (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setInspecting(r)}
            style={{ padding: "4px 8px", fontSize: 12, height: 28 }}
            title="Inspect full details"
          >
            <Eye size={12} />
          </button>
          <Link
            href={r.href}
            className="btn"
            style={{ padding: "4px 7px", fontSize: 12, height: 28, color: "var(--muted)" }}
            title="Open in module"
          >
            <ExternalLink size={12} />
          </Link>
          {canManage ? (
            <>
              <button
                type="button"
                className="btn danger"
                onClick={() => setDeciding({ q: r, act: "reject" })}
                style={{ padding: "4px 9px", fontSize: 12, height: 28 }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => setDeciding({ q: r, act: "approve" })}
                style={{
                  padding: "4px 11px",
                  fontSize: 12,
                  height: 28,
                  background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                  borderColor: "#0f766e",
                  color: "#ffffff",
                }}
              >
                Approve
              </button>
            </>
          ) : (
            <Chip color="var(--warn)">Pending</Chip>
          )}
        </div>
      ),
    },
  ];

  // Columns for History Table
  const decisionColumns: ColumnsType<Decision> = [
    {
      title: "When",
      dataIndex: "at",
      key: "at",
      className: "mono",
      width: 170,
      render: (at: string) => {
        if (!at) return null;
        const d = new Date(at);
        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, color: "var(--fg)", fontSize: 12.5 }}>
              {d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <span className="muted" style={{ fontSize: 11 }}>
              {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        );
      },
    },
    {
      title: "Reference",
      dataIndex: "ref",
      key: "ref",
      className: "mono",
      width: 150,
      render: (ref: string, h: Decision) => (
        <Link
          href={h.href}
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {ref}
          <ArrowUpRight size={11} style={{ opacity: 0.7 }} />
        </Link>
      ),
    },
    {
      title: "Item & Project",
      dataIndex: "title",
      key: "title",
      render: (title: string, h: Decision) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>{title}</div>
          {h.projectName && (
            <div style={{ marginTop: 3 }}>
              <Chip color={projectColor(h.projectName)} dot>
                {h.projectName}
              </Chip>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Decision & Author",
      dataIndex: "state",
      key: "state",
      width: 200,
      render: (state: string, h: Decision) => {
        const isApproved = state === "approved";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 99,
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: isApproved
                    ? "color-mix(in srgb, var(--ok) 12%, var(--surface))"
                    : "color-mix(in srgb, var(--bad) 12%, var(--surface))",
                  color: isApproved ? "var(--ok)" : "var(--bad)",
                  border: `1px solid color-mix(in srgb, ${isApproved ? "var(--ok)" : "var(--bad)"} 25%, transparent)`,
                }}
              >
                {isApproved ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {isApproved ? "Approved" : "Rejected"}
              </span>
            </div>
            {h.by && (
              <span className="muted" style={{ fontSize: 11.5 }}>
                by <strong style={{ color: "var(--fg)" }}>{h.by}</strong>
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Decision Note / Feedback",
      dataIndex: "note",
      key: "note",
      render: (note: string) =>
        note ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--fg)",
              background: "var(--sunk)",
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--line-soft, var(--line))",
              display: "inline-block",
              maxWidth: 380,
            }}
          >
            {note}
          </div>
        ) : (
          <span className="muted" style={{ fontSize: 12, fontStyle: "italic" }}>
            No note recorded
          </span>
        ),
    },
    {
      title: "Link",
      key: "link",
      align: "right",
      width: 70,
      render: (_, h: Decision) => (
        <Link
          href={h.href}
          className="btn"
          style={{ padding: "4px 8px", height: 28, fontSize: 12, color: "var(--muted)" }}
          title="Open original record"
        >
          <ExternalLink size={13} />
        </Link>
      ),
    },
  ];

  return (
    <>
      {/* 1st ROW: Command KPI Summary Cards */}
      <ApprovalKpiCards
        pendingTotal={queue.length}
        issuesCount={issuesCount}
        tasksCount={tasksCount}
        changesCount={changesCount}
        historyCount={history.length}
        approvedCount={approvedHistoryCount}
        rejectedCount={rejectedHistoryCount}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setQueueSearch("");
        }}
      />

      {/* 2nd ROW: Recent Decisions (Moved to 2nd row as requested) */}
      <section
        aria-label="Recent Decisions Audit Log"
        style={{
          marginBottom: 28,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "18px 20px",
          boxShadow: "0 1px 4px rgba(15, 26, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="sec" style={{ margin: 0, fontSize: 16 }}>
                Recent decisions
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "var(--sunk)",
                  color: "var(--muted)",
                  border: "1px solid var(--line)",
                }}
              >
                {filteredHistory.length} record{filteredHistory.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="muted" style={{ margin: "3px 0 0", fontSize: 12.5 }}>
              Audit trail of approved and rejected requests with reviewer notes
            </p>
          </div>

          {/* Decision filters & search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="seg">
              <button
                type="button"
                aria-pressed={historyFilter === "all"}
                onClick={() => setHistoryFilter("all")}
                style={{ fontSize: 12, padding: "5px 10px" }}
              >
                All ({history.length})
              </button>
              <button
                type="button"
                aria-pressed={historyFilter === "approved"}
                onClick={() => setHistoryFilter("approved")}
                style={{ fontSize: 12, padding: "5px 10px" }}
              >
                <CheckCircle2 size={12} style={{ color: "var(--ok)" }} />
                Approved ({approvedHistoryCount})
              </button>
              <button
                type="button"
                aria-pressed={historyFilter === "rejected"}
                onClick={() => setHistoryFilter("rejected")}
                style={{ fontSize: 12, padding: "5px 10px" }}
              >
                <XCircle size={12} style={{ color: "var(--bad)" }} />
                Rejected ({rejectedHistoryCount})
              </button>
            </div>

            <div style={{ minWidth: 180, maxWidth: 240 }}>
              <AntInput
                placeholder="Search decisions…"
                value={historySearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHistorySearch(e.target.value)}
                prefix={<Search size={13} style={{ color: "var(--muted)", marginRight: 4 }} />}
                allowClear
                size="middle"
              />
            </div>
          </div>
        </div>

        <AntTable<Decision>
          dataSource={filteredHistory}
          columns={decisionColumns}
          rowKey={(h, i) => (h.id || h.ref) + h.at + i}
          emptyTitle="No decisions match criteria"
          emptyDescription="Approved and rejected items will appear here as they are processed."
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
            size: "small",
          }}
        />
      </section>

      {/* 3rd / LAST ROW: Pending Approvals Queue & "All Approvals Caught Up!" */}
      <section
        aria-label="Pending Approvals Queue"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "18px 20px",
          boxShadow: "0 1px 4px rgba(15, 26, 42, 0.04)",
          marginBottom: 24,
        }}
      >
        {/* Queue Header & Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: "1px solid var(--line)",
          }}
        >
          {/* Segmented Filter Tabs */}
          <div className="seg" role="tablist" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              aria-pressed={activeTab === "all"}
              onClick={() => setActiveTab("all")}
            >
              All Pending
              <span className="seg-badge">{queue.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "issues"}
              aria-pressed={activeTab === "issues"}
              onClick={() => setActiveTab("issues")}
            >
              <Zap size={13} style={{ color: "var(--bad)" }} />
              Issues
              <span className="seg-badge">{issuesCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "tasks"}
              aria-pressed={activeTab === "tasks"}
              onClick={() => setActiveTab("tasks")}
            >
              <Layers size={13} style={{ color: "var(--warn)" }} />
              Tasks
              <span className="seg-badge">{tasksCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "changes"}
              aria-pressed={activeTab === "changes"}
              onClick={() => setActiveTab("changes")}
            >
              <GitPullRequest size={13} style={{ color: "var(--lms)" }} />
              Changes
              <span className="seg-badge">{changesCount}</span>
            </button>
          </div>

          {/* Right Controls: Search & Layout Mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 190, maxWidth: 260 }}>
              <AntInput
                placeholder="Search pending queue…"
                value={queueSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQueueSearch(e.target.value)}
                prefix={<Search size={14} style={{ color: "var(--muted)", marginRight: 4 }} />}
                allowClear
                size="middle"
              />
            </div>

            {filteredQueue.length > 0 && (
              <div className="seg" style={{ padding: 2 }}>
                <button
                  type="button"
                  aria-pressed={viewMode === "cards"}
                  onClick={() => setViewMode("cards")}
                  title="Grid / Cards View"
                  style={{ padding: "5px 9px" }}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === "table"}
                  onClick={() => setViewMode("table")}
                  title="Table List View"
                  style={{ padding: "5px 9px" }}
                >
                  <List size={15} />
                </button>
              </div>
            )}

            {hasActiveQueueFilters && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setQueueSearch("");
                  setActiveTab("all");
                }}
                style={{
                  fontSize: 12.5,
                  padding: "6px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
                title="Reset search and filters"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Content: "All Approvals Caught Up!" (in last row when empty) or Pending items */}
        {filteredQueue.length === 0 ? (
          <ApprovalsEmptyState
            isFiltered={hasActiveQueueFilters}
            onResetFilters={() => {
              setQueueSearch("");
              setActiveTab("all");
            }}
            canManage={canManage}
          />
        ) : viewMode === "cards" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 14,
            }}
          >
            {filteredQueue.map((item) => (
              <ApprovalCard
                key={item.kind + item.id}
                item={item}
                now={now}
                canManage={canManage}
                onInspect={(q) => setInspecting(q)}
                onDecide={(q, act) => setDeciding({ q, act })}
              />
            ))}
          </div>
        ) : (
          <AntTable<QueueItem>
            dataSource={filteredQueue}
            columns={queueColumns}
            rowKey={(q) => q.kind + q.id}
            emptyTitle="No items in this queue"
            emptyDescription="No pending items match the selected filters."
            pagination={{
              defaultPageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
              size: "small",
            }}
          />
        )}
      </section>

      {/* Quick Record Inspection Modal */}
      {inspecting && (
        <ApprovalDetailModal
          item={inspecting}
          now={now}
          canManage={canManage}
          onClose={() => setInspecting(null)}
          onDecide={(q, act) => setDeciding({ q, act })}
        />
      )}

      {/* Decision Slide Panel */}
      {deciding && (
        <DecideModal
          q={deciding.q}
          act={deciding.act}
          developers={developers}
          onClose={() => setDeciding(null)}
        />
      )}
    </>
  );
}
