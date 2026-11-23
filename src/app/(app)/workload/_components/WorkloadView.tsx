"use client";
import Link from "next/link";
import { Zap } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Fragment, useState, useTransition } from "react";
import { handOver, setAvailability, shareWork } from "@/server/work";
import { projectColor } from "@/lib/constants";
import { duration, issuePriorityColor } from "@/lib/issues";
import { fmtDay, today } from "@/lib/dates";
import { Empty, StatusChip } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useCompose } from "@/components/shared/compose/Compose";
import { SharePanel, LoadChip } from "@/components/shared/collaboration/SharePanel";
import { AntSelect, AntCheckbox, AntTextArea, AntTable, type ColumnsType } from "@/components/ui/antd";

export type DevLoad = {
  id: string; name: string; title: string; availability: string; urgent: number; issues: number; active: number; open: number; hold: number; overdue: number;
  hoursLeft: number; score: number;
  tasks: { id: string; title: string; status: TaskStatus; due: string; project: string; others: string[] }[];
  issueList: { id: string; title: string; priority: string; createdAt: string; others: string[] }[];
};



type Props = { loads: DevLoad[]; sla: { Urgent: number; High: number; Normal: number }; canManage: boolean; canEdit: boolean };

export function WorkloadView({ loads, sla, canManage, canEdit }: Props) {
  const [share, setShare] = useState<{ kind: "task" | "issue"; id: string; title: string; current: string[] } | null>(null);
  const [handFrom, setHandFrom] = useState<DevLoad | null>(null);
  const [, start] = useTransition();
  if (!loads.length) return <Empty title="No developers yet">Add developers to see their work on hand.</Empty>;
  const mx = Math.max(1, ...loads.map(d => d.score));
  const name = (id: string) => loads.find(d => d.id === id)?.name ?? "";
  const T = today();

  return (
    <>
      {(() => {
        const columns: ColumnsType<DevLoad> = [
          {
            title: "Developer",
            key: "developer",
            render: (_: unknown, d: DevLoad) => (
              <div>
                <b style={{ fontWeight: 600 }}>{d.name}</b>
                <div className="muted" style={{ fontSize: 12 }}>{d.title}</div>
              </div>
            ),
          },
          {
            title: "Status",
            key: "status",
            render: (_: unknown, d: DevLoad) => (
              <div>
                <LoadChip d={d} />
                {canManage && (
                  <div style={{ marginTop: 4 }}>
                    <AntSelect
                      aria-label={`${d.name} availability`}
                      value={d.availability}
                      style={{ width: 110 }}
                      options={[["Available", "Available"], ["On leave", "On leave"]]}
                      onChange={e => { const v = e.target.value as "Available"; start(async () => { const r = await setAvailability(d.id, v); toast(r.ok ? `${d.name}: ${v}` : r.error); }); }}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            title: (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                <Zap size={13} style={{ color: "var(--bad)" }} /> Urgent
              </span>
            ),
            dataIndex: "urgent",
            key: "urgent",
            className: "num",
            align: "right",
            render: (urgent: number) => <span style={urgent ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{urgent}</span>,
          },
          {
            title: "Issues",
            dataIndex: "issues",
            key: "issues",
            className: "num",
            align: "right",
          },
          {
            title: "Active",
            dataIndex: "active",
            key: "active",
            className: "num",
            align: "right",
            render: (active: number) => <span style={{ color: "var(--info)", fontWeight: 600 }}>{active}</span>,
          },
          {
            title: "Open",
            dataIndex: "open",
            key: "open",
            className: "num",
            align: "right",
          },
          {
            title: "On hold",
            dataIndex: "hold",
            key: "hold",
            className: "num",
            align: "right",
          },
          {
            title: "Overdue",
            dataIndex: "overdue",
            key: "overdue",
            className: "num",
            align: "right",
            render: (overdue: number) => <span style={overdue ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{overdue}</span>,
          },
          {
            title: "Est. hours left",
            dataIndex: "hoursLeft",
            key: "hoursLeft",
            className: "num mono",
            align: "right",
            render: (hoursLeft: number) => (hoursLeft ? hoursLeft.toFixed(1) : "—"),
          },
          {
            title: "Load",
            key: "load",
            width: 150,
            render: (_: unknown, d: DevLoad) => (
              <div className="progress">
                <div className="bar">
                  <i style={{ width: (d.score / mx) * 100 + "%", background: d.score >= 8 ? "var(--bad)" : d.score >= 4 ? "var(--warn)" : "var(--ok)" }} />
                </div>
              </div>
            ),
          },
          ...(canManage
            ? [
                {
                  title: "",
                  key: "action",
                  align: "right" as const,
                  render: (_: unknown, d: DevLoad) =>
                    (d.tasks.length > 0 || d.issueList.length > 0) && (
                      <button className="btn" type="button" onClick={() => setHandFrom(d)}>
                        Hand over…
                      </button>
                    ),
                },
              ]
            : []),
        ];

        return (
          <AntTable<DevLoad>
            dataSource={loads}
            columns={columns}
            rowKey="id"
            pagination={false}
            emptyTitle="No developers recorded"
            emptyDescription="Add developers in People & access to view workloads."
          />
        );
      })()}
      <p className="muted" style={{ fontSize: 12 }}>Load counts active work fully, open items lightly, and urgent issues double. Est. hours left uses each item&apos;s estimate and progress.</p>

      <h2 className="sec">Work on hand by developer</h2>
      <div className="board" style={{ gridAutoColumns: "minmax(290px,1fr)" }}>
        {loads.map(d => {
          const act = d.tasks.filter(t => ["progress", "qa", "uat", "hold"].includes(t.status));
          const op = d.tasks.filter(t => t.status === "pending");
          const shareBtn = (kind: "task" | "issue", id: string, title: string, others: string[]) => canEdit && (
            <button className="btn" type="button" style={{ padding: "3px 8px" }} title="Share or hand over" onClick={e => { e.preventDefault(); setShare({ kind, id, title, current: [d.id, ...others] }); }}>⇄</button>
          );
          const sharedWith = (others: string[]) => others.length > 0 && <> · shared with {others.map(o => name(o).split(" ")[0]).join(", ")}</>;
          return (
            <div key={d.id} className="col">
              <h4><span>{d.name}</span><LoadChip d={d} /></h4>
              {d.issueList.map(x => {
                const left = Date.parse(x.createdAt) + (sla[x.priority as keyof typeof sla] ?? 72) * 3600e3 - Date.now();
                return (
                  <Link key={x.id} href={`/issues?edit=${x.id}`} className="card" style={{ ["--mc" as string]: "var(--bad)", textDecoration: "none", color: "inherit" }}>
                    <div className="r"><span className="mono" style={{ fontWeight: 700, color: "var(--bad)" }}>{x.id}</span><Chip color={issuePriorityColor(x.priority)}>{x.priority}</Chip></div>
                    <div className="t">{x.title}</div>
                    <div className="r"><span>{left < 0 ? <Chip color="var(--bad)">Late {duration(-left)}</Chip> : <Chip color={left < 3600e3 ? "var(--warn)" : "var(--ok)"}>{duration(left)} left</Chip>}{sharedWith(x.others)}</span>{shareBtn("issue", x.id, x.title, x.others)}</div>
                  </Link>
                );
              })}
              {[...act, ...op.slice(0, 8)].map((t, i) => (
                <Fragment key={t.id}>
                  {i === act.length && <div className="muted" style={{ font: "600 11px var(--body)", letterSpacing: ".06em", textTransform: "uppercase", margin: "6px 4px 0" }}>Open · {op.length}</div>}
                  <Link href={`/tasks?edit=${t.id}`} className="card" style={{ ["--mc" as string]: projectColor(t.project), textDecoration: "none", color: "inherit" }}>
                    <div className="r"><span className="mtag" style={{ ["--mc" as string]: projectColor(t.project) }}>{t.project}</span><StatusChip status={t.status} /></div>
                    <div className="t">{t.title}</div>
                    <div className="r"><span>{t.due && <span style={{ color: t.due < T ? "var(--bad)" : undefined }}>Due {fmtDay(t.due)}</span>}{sharedWith(t.others)}</span>{shareBtn("task", t.id, t.title, t.others)}</div>
                  </Link>
                </Fragment>
              ))}
              {op.length > 8 && <Link className="muted" style={{ fontSize: 12, padding: "2px 4px" }} href={`/tasks?dev=${d.id}&status=pending`}>+{op.length - 8} more</Link>}
              {!d.issueList.length && !d.tasks.length && <div className="muted" style={{ fontSize: 13, padding: 8 }}>No work on hand.</div>}
            </div>
          );
        })}
      </div>
      {share && <SharePanel {...share} loads={loads} onClose={() => setShare(null)} />}
      {handFrom && <HandoverPanel from={handFrom} loads={loads} onClose={() => setHandFrom(null)} />}
    </>
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
    <Panel title={`Hand over ${from.name}'s work`} subtitle={`For leave cover or re-balancing. ${from.tasks.length} open items and ${from.issueList.length} open issues.`} onClose={onClose} dirty={!!note}
      footer={<><span /><div><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" disabled={busy || !to} onClick={() => start(async () => { setError(""); const r = await handOver(from.id, to, scope, mode, note); if (!r.ok) { setError(r.error); return; } toast(`${r.data!.count} handed over to ${others.find(d => d.id === to)?.name}`); onClose(); })}>Hand over</button></div></>}>
      <div className="field"><label htmlFor="ho_to">Hand over to</label><AntSelect id="ho_to" value={to} onChange={e => setTo(e.target.value)} options={others.map(d => [d.id, `${d.name} · ${d.score.toFixed(1)} load`])} /></div>
      <div className="field"><label htmlFor="ho_sc">What to hand over</label><AntSelect id="ho_sc" value={scope} onChange={e => setScope(e.target.value as "active")} options={[["active", "Active items and open issues"], ["all", "All open items and issues"], ["issues", "Open issues only"]]} /></div>
      <div className="field"><label htmlFor="ho_md">How</label><AntSelect id="ho_md" value={mode} onChange={e => setMode(e.target.value as "add")} options={[["add", `Add as collaborator (keep ${from.name} on them)`], ["handover", "Hand over fully"]]} /></div>
      <div className="field"><label htmlFor="ho_n">Note</label><AntTextArea id="ho_n" rows={3} placeholder="e.g. Annual leave 22–30 Oct" value={note} onChange={e => setNote(e.target.value)} /></div>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}
