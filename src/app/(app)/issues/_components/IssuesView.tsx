"use client";
import { useEffect, useState, useTransition } from "react";
import { Zap, Clock } from "lucide-react";
import { ISSUE_STATUS_MAP, duration, isOpenIssue, issuePriorityColor } from "@/lib/issues";
import type { Lookups } from "@/server/queries";
import { resolveIssue, takeIssue } from "@/server/issues";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntTextArea } from "@/components/ui/antd";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { IssueForm } from "./IssueForm";
import type { IssueDTO, IssueViewer, Sla } from "./types";

type Props = { issues: IssueDTO[]; lookups: Lookups; sla: Sla; viewer: IssueViewer; openNew: boolean; openId?: string; anyIssues: boolean };

export const slaDue = (x: IssueDTO, sla: Sla) => new Date(x.createdAt).getTime() + (sla[x.priority as keyof Sla] ?? 72) * 3600e3;

export function SlaCell({ x, sla, now }: { x: IssueDTO; sla: Sla; now: number }) {
  if (!isOpenIssue(x.status)) {
    return <span className="muted mono" style={{ fontSize: 12 }}>{x.resolvedAt ? "in " + duration(Date.parse(x.resolvedAt) - Date.parse(x.createdAt)) : "—"}</span>;
  }
  const left = slaDue(x, sla) - now;
  return left < 0
    ? <Chip color="var(--bad)">Late {duration(-left)}</Chip>
    : <Chip color={left < 3600e3 ? "var(--warn)" : "var(--ok)"}>{duration(left)} left</Chip>;
}

export const PriorityChip = ({ p }: { p: string }) => (
  <Chip color={issuePriorityColor(p)}>
    {p === "Urgent" && <Zap size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />}
    {p || "Normal"}
  </Chip>
);

export function IssuesView({ issues, lookups, sla, viewer, openNew, openId, anyIssues }: Props) {
  const { update } = useUrlUpdate();
  const [resolving, setResolving] = useState<IssueDTO | null>(null);
  const [busy, start] = useTransition();
  // response-time countdowns tick every minute
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const editing = openNew ? "new" : openId ? issues.find(x => x.id === openId) ?? null : null;
  const setOpen = (v: string | null) => update({ new: v === "new" ? "1" : null, edit: v && v !== "new" ? v : null });

  const take = (x: IssueDTO) => start(async () => {
    const r = await takeIssue(x.id);
    toast(r.ok ? (x.approvalState === "pending" ? `${x.id} assigned to you. Waiting for approval before you start.` : `${x.id} is yours`) : r.error);
  });

  const raiseBtn = <button className="btn primary" type="button" onClick={() => setOpen("new")} style={{ background: "var(--bad)", borderColor: "var(--bad)", color: "#fff" }}>+ Raise urgent issue</button>;
  const list = issues.filter(x => !x.hidden);

  const columns: ColumnsType<IssueDTO> = [
    {
      title: "Token",
      dataIndex: "id",
      key: "id",
      className: "mono",
      width: 130,
      render: (id: string) => <span style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{id}</span>,
    },
    {
      title: "Issue",
      dataIndex: "title",
      key: "title",
      render: (title: string, x: IssueDTO) => (
        <div style={{ minWidth: 200 }}>
          <b style={{ fontWeight: 600 }}>{title}</b>
          {x.description && <div className="muted" style={{ fontSize: 12 }}>{x.description.slice(0, 120)}</div>}
        </div>
      ),
    },
    {
      title: "System",
      dataIndex: "projectName",
      key: "projectName",
      render: (name?: string) => name || "—",
    },
    {
      title: "Raised by",
      dataIndex: "raisedBy",
      key: "raisedBy",
      render: (raisedBy: string, x: IssueDTO) => (
        <div>
          {raisedBy}
          {x.companyName && <div className="muted" style={{ fontSize: 12 }}>{x.companyName}</div>}
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
      render: (names: string[]) => names?.join(", ") || "—",
    },
    {
      title: "Response",
      key: "response",
      render: (_: unknown, x: IssueDTO) => (
        <div>
          <SlaCell x={x} sla={sla} now={now} />
          <div className="muted mono" style={{ fontSize: 11 }}>raised {duration(now - Date.parse(x.createdAt))} ago</div>
        </div>
      ),
    },
    {
      title: "",
      key: "actions",
      align: "right",
      render: (_: unknown, x: IssueDTO) => {
        const mine = !!viewer.developerId && x.assigneeIds.includes(viewer.developerId);
        const open = isOpenIssue(x.status);
        return (
          <div style={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
            {open && !x.assigneeIds.length && viewer.developerId && (
              <button className="btn" type="button" disabled={busy} onClick={() => take(x)}>Take it</button>
            )}{" "}
            {open && (mine || viewer.canManage) && (
              <button className="btn" type="button" onClick={() => setResolving(x)}>Resolve</button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>{raiseBtn}</div>
      {!anyIssues ? (
        <div className="empty">
          <b>No issues raised yet</b>
          When something breaks or needs a quick fix, raise an issue here. It gets a token number, a response-time target, and can be assigned to a developer straight away.
          <div>{raiseBtn}</div>
        </div>
      ) : (
        <AntTable<IssueDTO>
          dataSource={list}
          columns={columns}
          rowKey="id"
          onRowClick={x => setOpen(x.id)}
          emptyTitle="No issues match these filters"
          emptyDescription="Try adjusting search or status filters to view more issues."
        />
      )}

      {editing !== null && (
        <IssueForm key={editing === "new" ? "new" : editing.id} issue={editing === "new" ? null : editing} lookups={lookups} sla={sla} viewer={viewer} now={now} onClose={() => setOpen(null)} />
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
      footer={<><span /><div>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={busy} onClick={() => start(async () => {
          const r = await resolveIssue(issue.id, note);
          if (!r.ok) { setError(r.error); return; }
          toast(`${issue.id} resolved`);
          onClose();
        })}>Mark resolved</button>
      </div></>}
    >
      <p style={{ margin: 0 }}>{issue.title}</p>
      <div className="field">
        <label htmlFor="rz_n">What was done</label>
        <AntTextArea id="rz_n" rows={3} value={note} onChange={e => setNote(e.target.value)} autoFocus />
      </div>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}
