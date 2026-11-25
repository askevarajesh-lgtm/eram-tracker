"use client";
import { useEffect, useState, useTransition } from "react";
import { Zap, Clock, ClockAlert, AlertTriangle, CheckCircle2, UserX, Check, UserPlus } from "lucide-react";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_STATUS_MAP, duration, isOpenIssue, issuePriorityColor } from "@/lib/issues";
import type { Lookups } from "@/server/queries";
import { resolveIssue, takeIssue } from "@/server/issues";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntTextArea } from "@/components/ui/antd";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { RecordActions } from "@/components/ui/RecordActions";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { deleteIssue } from "@/server/issues";
import { IssueDetailModal } from "./IssueDetailModal";
import { IssueForm } from "./IssueForm";
import type { IssueDTO, IssueViewer, Sla } from "./types";

type Props = {
  issues: IssueDTO[];
  lookups: Lookups;
  sla: Sla;
  viewer: IssueViewer;
  openNew: boolean;
  openId?: string;
  openViewId?: string;
  anyIssues: boolean;
  filtered?: boolean;
  totalOpen?: number;
};

export const slaDue = (x: IssueDTO, sla: Sla) => new Date(x.createdAt).getTime() + (sla[x.priority as keyof Sla] ?? 72) * 3600e3;

export function SlaCell({ x, sla, now }: { x: IssueDTO; sla: Sla; now: number }) {
  if (!isOpenIssue(x.status)) {
    return (
      <span className="muted mono" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <CheckCircle2 size={12} style={{ color: "var(--ok)" }} />
        {x.resolvedAt ? "Resolved in " + duration(Date.parse(x.resolvedAt) - Date.parse(x.createdAt)) : "Resolved"}
      </span>
    );
  }
  const left = slaDue(x, sla) - now;
  const isLate = left < 0;
  return isLate ? (
    <Chip color="var(--bad)">
      <ClockAlert size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
      Late {duration(-left)}
    </Chip>
  ) : (
    <Chip color={left < 3600e3 ? "var(--warn)" : "var(--ok)"}>
      <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />
      {duration(left)} left
    </Chip>
  );
}

export const PriorityChip = ({ p }: { p: string }) => {
  const isUrgent = p === "Urgent";
  const isHigh = p === "High";
  return (
    <Chip color={issuePriorityColor(p)}>
      {isUrgent && <Zap size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />}
      {isHigh && <AlertTriangle size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />}
      {p || "Normal"}
    </Chip>
  );
};

export function IssuesView({ issues, lookups, sla, viewer, openNew, openId, openViewId, anyIssues, filtered = false }: Props) {
  const { update } = useUrlUpdate();
  const [resolving, setResolving] = useState<IssueDTO | null>(null);
  const [viewing, setViewing] = useState<IssueDTO | null>(() => {
    return openViewId ? issues.find((x) => x.id === openViewId) ?? null : null;
  });
  const [busy, start] = useTransition();
  // response-time countdowns tick every minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (openViewId) {
      setViewing(issues.find((x) => x.id === openViewId) ?? null);
    } else {
      setViewing(null);
    }
  }, [openViewId, issues]);

  const editing = openNew ? "new" : openId ? issues.find(x => x.id === openId) ?? null : null;
  const setOpen = (v: string | null) => update({ new: v === "new" ? "1" : null, edit: v && v !== "new" ? v : null, view: null });

  const take = (x: IssueDTO) => start(async () => {
    const r = await takeIssue(x.id);
    toast(r.ok ? (x.approvalState === "pending" ? `${x.id} assigned to you. Waiting for approval before you start.` : `${x.id} is yours`) : r.error);
  });

  const raiseBtn = (
    <button
      className="btn primary"
      type="button"
      onClick={() => setOpen("new")}
      style={{
        background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
        borderColor: "#be123c",
        color: "#ffffff",
        boxShadow: "0 2px 8px rgba(225, 29, 72, 0.28)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 600,
        fontSize: "13px",
        padding: "7px 15px",
        borderRadius: "var(--r, 8px)",
        whiteSpace: "nowrap",
        transition: "all 0.15s ease",
      }}
    >
      <Zap size={14} />
      <span>Raise urgent issue</span>
    </button>
  );

  const list = issues.filter(x => !x.hidden);

  const columns: ColumnsType<IssueDTO> = [
    {
      title: "Token",
      dataIndex: "id",
      key: "id",
      className: "mono",
      width: 140,
      render: (id: string) => (
        <span
          className="mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: "6px",
            background: "var(--sunk)",
            border: "1px solid var(--line)",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            color: "var(--fg)",
          }}
        >
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>#</span>
          {id}
        </span>
      ),
    },
    {
      title: "Issue",
      dataIndex: "title",
      key: "title",
      render: (title: string, x: IssueDTO) => (
        <div style={{ minWidth: 200, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--fg)" }}>{title}</span>
          {x.description && (
            <span
              className="muted"
              style={{
                fontSize: "12px",
                lineHeight: "1.4",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {x.description}
            </span>
          )}
        </div>
      ),
    },
    {
      title: "System",
      dataIndex: "projectName",
      key: "projectName",
      render: (name?: string) =>
        name ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: "6px",
              background: "var(--sunk)",
              border: "1px solid var(--line)",
              fontSize: "12px",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: "Raised by",
      dataIndex: "raisedBy",
      key: "raisedBy",
      render: (raisedBy: string, x: IssueDTO) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--accent) 15%, transparent)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              flexShrink: 0,
            }}
          >
            {(raisedBy || "U").slice(0, 2).toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: "13px" }}>{raisedBy}</div>
            {x.companyName && <div className="muted" style={{ fontSize: "11.5px" }}>{x.companyName}</div>}
          </div>
        </div>
      ),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (p: string) => <PriorityChip p={p} />,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string, x: IssueDTO) => {
        const st = ISSUE_STATUS_MAP[status];
        return (
          <div>
            <Chip color={st?.color ?? "var(--hold)"} dot>{st?.label ?? status}</Chip>
            {x.approvalState === "pending" && (
              <div style={{ marginTop: 4 }}>
                <Chip color="var(--warn)">
                  <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }} />
                  Awaiting approval
                </Chip>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Assigned to",
      dataIndex: "assigneeNames",
      key: "assigneeNames",
      render: (names: string[]) =>
        names && names.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {names.map(n => (
              <span
                key={n}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "2px 7px",
                  borderRadius: "99px",
                  background: "var(--sunk)",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "9px",
                    fontWeight: 700,
                  }}
                >
                  {n.slice(0, 1)}
                </span>
                {n}
              </span>
            ))}
          </div>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: "99px",
              background: "color-mix(in srgb, var(--warn) 10%, transparent)",
              color: "var(--warn)",
              border: "1px solid color-mix(in srgb, var(--warn) 25%, transparent)",
              fontSize: "11.5px",
              fontWeight: 600,
            }}
          >
            <UserX size={12} />
            Unassigned
          </span>
        ),
    },
    {
      title: "Response",
      key: "response",
      render: (_: unknown, x: IssueDTO) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <SlaCell x={x} sla={sla} now={now} />
          <div className="muted mono" style={{ fontSize: 11 }}>raised {duration(now - Date.parse(x.createdAt))} ago</div>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_: unknown, x: IssueDTO) => {
        const mine = !!viewer.developerId && x.assigneeIds.includes(viewer.developerId);
        const open = isOpenIssue(x.status);
        const canEdit = viewer.canManage || (viewer.role === "Developer" && (!x.assigneeIds.length || x.assigneeIds.includes(viewer.developerId ?? "")));
        const canDelete = viewer.canManage;
        return (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
            {open && !x.assigneeIds.length && viewer.developerId && (
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => take(x)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 8px" }}
              >
                <UserPlus size={12} />
                <span>Take it</span>
              </button>
            )}
            {open && (mine || viewer.canManage) && (
              <button
                className="btn"
                type="button"
                onClick={() => setResolving(x)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  padding: "4px 8px",
                  borderColor: "var(--ok)",
                  color: "var(--ok)",
                }}
              >
                <Check size={12} />
                <span>Resolve</span>
              </button>
            )}
            <RecordActions
              onView={() => {
                setViewing(x);
                update({ view: x.id, edit: null });
              }}
              onEdit={canEdit ? () => setOpen(x.id) : undefined}
              onDelete={
                canDelete
                  ? async () => {
                      const r = await deleteIssue(x.id);
                      if (!r.ok) {
                        toast(r.error ?? "Failed to delete issue");
                      } else {
                        toast(`Issue ${x.id} deleted`);
                      }
                    }
                  : undefined
              }
              deleteConfirmTitle={`Delete ${x.id}?`}
              deleteConfirmMessage={`Are you sure you want to delete urgent issue ${x.id} "${x.title}"? This action cannot be undone.`}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <UrlFilters
          search={{ placeholder: "Search token, issue, raised by…" }}
          selects={[
            { key: "st", all: "Open issues", options: [["all", "All issues"], ...ISSUE_STATUSES.map(s => [s.key, s.label] as [string, string])] },
            { key: "pr", all: "All priorities", options: ISSUE_PRIORITIES.map(p => [p.key, p.key]) },
            { key: "dev", all: "All developers", options: [["_none", "Unassigned"], ...lookups.developers.map(d => [d.id, d.name] as [string, string])] },
            { key: "mod", all: "All systems", options: lookups.projects.map(p => [p.id, p.name]) },
          ]}
        >
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {raiseBtn}
          </div>
        </UrlFilters>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            {list.length} {list.length === 1 ? "issue" : "issues"}
            {filtered ? " matching current filters" : ""}
          </span>
        </div>
      </div>

      {!anyIssues ? (
        <div className="empty">
          <b>No issues raised yet</b>
          When something breaks or needs a quick fix, raise an issue here. It gets a token number, a response-time target, and can be assigned to a developer straight away.
          <div style={{ marginTop: 12 }}>{raiseBtn}</div>
        </div>
      ) : (
        <AntTable<IssueDTO>
          dataSource={list}
          columns={columns}
          rowKey="id"
          onRowClick={x => {
            setViewing(x);
            update({ view: x.id, edit: null });
          }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          emptyTitle={filtered ? "No issues match these filters" : "No issues yet"}
          emptyDescription={filtered ? "Try clearing a filter or searching for another term." : "Raise an issue to start tracking."}
          emptyAction={raiseBtn}
        />
      )}

      {viewing && (
        <IssueDetailModal
          issue={viewing}
          sla={sla}
          viewer={viewer}
          now={now}
          onEdit={() => {
            const id = viewing.id;
            setViewing(null);
            setOpen(id);
          }}
          onClose={() => {
            setViewing(null);
            update({ view: null });
          }}
        />
      )}

      {editing !== null && (
        <IssueForm
          key={editing === "new" ? "new" : editing.id}
          issue={editing === "new" ? null : editing}
          lookups={lookups}
          sla={sla}
          viewer={viewer}
          now={now}
          onClose={() => setOpen(null)}
        />
      )}
      {resolving && <ResolvePanel issue={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}

function ResolvePanel({ issue, onClose }: { issue: IssueDTO; onClose: () => void }) {
  const [note, setNote] = useState(issue.resolution);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <Panel
      title={`Resolve ${issue.id}`}
      dirty={note !== issue.resolution}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            <button className="btn primary" type="button" disabled={busy} onClick={() => start(async () => {
              const r = await resolveIssue(issue.id, note);
              if (!r.ok) { setError(r.error); return; }
              toast(`${issue.id} resolved`);
              onClose();
            })}>Mark resolved</button>
          </div>
        </>
      )}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>{issue.title}</p>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="rz_n">What was done</label>
        <AntTextArea id="rz_n" rows={3} value={note} onChange={e => setNote(e.target.value)} autoFocus />
      </div>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}

