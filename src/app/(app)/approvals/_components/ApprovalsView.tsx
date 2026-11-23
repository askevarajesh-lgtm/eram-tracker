"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { decideIssue } from "@/server/issues";
import { decideChange, decideTask } from "@/server/approvals";
import { duration } from "@/lib/issues";
import { AItem, Empty } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntCheckbox, AntTextArea, AntTable, type ColumnsType } from "@/components/ui/antd";

export type QueueItem = { kind: "issue" | "task" | "change"; id: string; ref: string; title: string; sub: string; color: string; at: string; href: string; assigneeIds: string[] };
export type Decision = { ref: string; title: string; state: string; by: string; at: string; note: string; href: string };

type Props = { queue: QueueItem[]; history: Decision[]; developers: { id: string; name: string }[]; canManage: boolean };

export function ApprovalsView({ queue, history, developers, canManage }: Props) {
  const [deciding, setDeciding] = useState<{ q: QueueItem; act: "approve" | "reject" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  return (
    <>
      <p className="muted" style={{ margin: "0 0 14px" }}>
        Urgent work waits here for an Admin before developers start. Change what needs approval in Admin panel → Notifications.
      </p>
      {!queue.length ? <Empty title="Nothing waiting for approval">Urgent issues, tasks raised by developers and change requests appear here.</Empty> : (
        <div className="alist">
          {queue.map(q => (
            <AItem key={q.kind + q.id} color={q.color}
              title={<><span className="mono">{q.ref}</span> · {q.title}</>}
              sub={<span style={{ whiteSpace: "normal" }}>{q.sub} · waiting {duration(now - Date.parse(q.at))}</span>}
              right={
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Link className="btn" href={q.href}>Details</Link>
                  {canManage ? (
                    <>
                      <button className="btn danger" type="button" onClick={() => setDeciding({ q, act: "reject" })}>Reject</button>
                      <button className="btn primary" type="button" onClick={() => setDeciding({ q, act: "approve" })}>Approve</button>
                    </>
                  ) : <Chip color="var(--warn)">Awaiting approval</Chip>}
                </span>
              } />
          ))}
        </div>
      )}

      <h2 className="sec">Recent decisions</h2>
      {(() => {
        const decisionColumns: ColumnsType<Decision> = [
          {
            title: "When",
            dataIndex: "at",
            key: "at",
            className: "mono",
            render: (at: string) => at && new Date(at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          },
          {
            title: "Ref",
            dataIndex: "ref",
            key: "ref",
            className: "mono",
            render: (ref: string, h: Decision) => <Link href={h.href} style={{ color: "inherit", fontWeight: 600 }}>{ref}</Link>,
          },
          {
            title: "Item",
            dataIndex: "title",
            key: "title",
          },
          {
            title: "Decision",
            dataIndex: "state",
            key: "state",
            render: (state: string, h: Decision) => (
              <span>
                <Chip color={state === "approved" ? "var(--ok)" : "var(--bad)"}>{state === "approved" ? "Approved" : "Rejected"}</Chip>{" "}
                <span className="muted" style={{ fontSize: 12 }}>{h.by}</span>
              </span>
            ),
          },
          {
            title: "Note",
            dataIndex: "note",
            key: "note",
            className: "muted",
          },
        ];

        return (
          <AntTable<Decision>
            dataSource={history}
            columns={decisionColumns}
            rowKey={(h, i) => h.ref + h.at + i}
            emptyTitle="No decisions yet"
            emptyDescription="Approved and rejected items will appear here."
          />
        );
      })()}
      {deciding && <DecidePanel q={deciding.q} act={deciding.act} developers={developers} onClose={() => setDeciding(null)} />}
    </>
  );
}

function DecidePanel({ q, act, developers, onClose }: { q: QueueItem; act: "approve" | "reject"; developers: { id: string; name: string }[]; onClose: () => void }) {
  const [devs, setDevs] = useState<string[]>(q.assigneeIds);
  const [note, setNote] = useState("");
  const [convert, setConvert] = useState(true);
  const [message, setMessage] = useState(true);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const compose = useCompose();
  const approve = act === "approve";

  const go = () => start(async () => {
    setError("");
    const decision = approve ? "approved" : "rejected";
    const r = q.kind === "issue" ? await decideIssue(q.id, decision, note, approve ? devs : undefined)
      : q.kind === "task" ? await decideTask(q.id, decision, note, approve ? devs : undefined)
      : await decideChange(q.id, decision, note, convert);
    if (!r.ok) { setError(r.error); return; }
    toast(approve ? (q.kind === "change" && convert ? "Change approved and task created" : "Approved") : "Rejected");
    onClose();
    if (approve && message && q.kind !== "change" && devs.length) {
      compose(q.kind === "task"
        ? { tpl: "assign", devIds: devs, item: { title: q.title, project: "", due: "" } }
        : { tpl: "custom", devIds: devs, subject: `${q.ref}: ${q.title}`, body: `Hi {name},\n\n${q.ref} is approved and assigned to you:\n${q.title}\n\n{link}` });
    }
  });

  return (
    <Panel title={`${approve ? "Approve" : "Reject"}: ${q.title}`} subtitle={q.ref} onClose={onClose} dirty={!!note}
      footer={<><span /><div>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className={"btn " + (approve ? "primary" : "danger")} type="button" disabled={busy} onClick={go}>{approve ? "Approve" : "Reject"}</button>
      </div></>}>
      <form className="form" onSubmit={e => e.preventDefault()}>
        {approve && q.kind !== "change" && (
          <div className="field full">
            <label>Assign to</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              {developers.map(d => (
                <label key={d.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", font: "inherit", color: "var(--fg)" }}>
                  <AntCheckbox checked={devs.includes(d.id)} onChange={e => setDevs(e.target.checked ? [...devs, d.id] : devs.filter(x => x !== d.id))}>
                    {d.name}
                  </AntCheckbox>
                </label>
              ))}
            </div>
          </div>
        )}
        {approve && q.kind === "change" && (
          <label className="field full" style={{ flexDirection: "row", gap: 8, alignItems: "center", color: "var(--fg)", fontSize: 14 }}>
            <AntCheckbox checked={convert} onChange={e => setConvert(e.target.checked)}>
              Create a development task from it
            </AntCheckbox>
          </label>
        )}
        <div className="field full">
          <label htmlFor="ap_n">{approve ? "Note (optional)" : "Reason"}</label>
          <AntTextArea id="ap_n" rows={3} value={note} onChange={e => setNote(e.target.value)} autoFocus={!approve} />
        </div>
        {approve && q.kind !== "change" && (
          <label className="field full" style={{ flexDirection: "row", gap: 8, alignItems: "center", color: "var(--fg)", fontSize: 14 }}>
            <AntCheckbox checked={message} onChange={e => setMessage(e.target.checked)}>
              Message the developers after approving
            </AntCheckbox>
          </label>
        )}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
