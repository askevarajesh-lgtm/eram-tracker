"use client";
import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { taskExtras, type TaskExtras } from "@/server/extras";
import { deleteTime, logTime } from "@/server/work";
import { STATUS_MAP } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import { Chip } from "@/components/ui/Chip";
import { Files } from "@/components/ui/Files";
import { toast } from "@/components/ui/Toaster";
import { AntDatePicker, AntInput, AntSelect } from "@/components/ui/antd";

const small: React.CSSProperties = { font: "13px var(--body)", padding: 6, border: "1px solid var(--line2)", borderRadius: 8, background: "var(--surface)", color: "var(--fg)", minWidth: 0 };

/** Sign-off, time log, files and history shown inside an open task. */
export function TaskExtrasView({ taskId, estHours, assigneeIds, developers, canEdit, canManage, viewerDeveloperId, onLoaded }: {
  taskId: string; estHours: number | null; assigneeIds: string[]; developers: { id: string; name: string }[];
  canEdit: boolean; canManage: boolean; viewerDeveloperId: string | null; onLoaded?: (x: TaskExtras) => void;
}) {
  const [x, setX] = useState<TaskExtras | null>(null);
  const [form, setForm] = useState({ date: today(), hours: "", note: "", dev: viewerDeveloperId || assigneeIds[0] || "" });
  const [busy, start] = useTransition();
  const reload = () => taskExtras(taskId).then(r => { if (r) { setX(r); onLoaded?.(r); } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [taskId]);
  if (!x) return <p className="muted field full" style={{ margin: 0 }}>Loading details…</p>;

  const logged = x.time.reduce((a, t) => a + t.hours, 0);
  const add = () => start(async () => {
    const h = Number(form.hours);
    const r = await logTime(taskId, form.date, h, form.note, form.dev);
    if (!r.ok) { toast(r.error); return; }
    toast(`${h} h logged`);
    setForm(f => ({ ...f, hours: "", note: "" }));
    reload();
  });

  return (
    <>
      {x.signoff && (
        <div className="field full">
          <label>Business-user sign-off</label>
          <div style={{ fontSize: 13 }}><Chip color="var(--ok)">Accepted</Chip> by <b>{x.signoff.by}</b>{x.signoff.team && ` (${x.signoff.team})`} on {fmtDay(x.signoff.d)} · {x.signoff.how}{x.signoff.note && " · " + x.signoff.note}</div>
        </div>
      )}
      <div className="field full">
        <label>Time log</label>
        <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 6, flexWrap: "wrap" }}>
          <span>Logged <b>{logged.toFixed(1)} h</b></span><span>Estimate <b>{estHours ? estHours + " h" : "—"}</b></span>
          {estHours ? <span style={{ color: logged > estHours ? "var(--bad)" : "var(--ok)" }}>{logged > estHours ? `Over by ${(logged - estHours).toFixed(1)} h` : `${(estHours - logged).toFixed(1)} h left`}</span> : null}
        </div>
        {x.time.length > 0 && (
          <div style={{ maxHeight: 130, overflow: "auto", fontSize: 12.5, display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
            {x.time.map(t => (
              <div key={t.id}>
                <span className="mono muted">{fmtDay(t.date)}</span> · <b>{t.hours} h</b> · {t.developer}{t.note && " · " + t.note}
                {canManage && (
                  <button
                    type="button"
                    aria-label="Remove entry"
                    style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                    onClick={() => start(async () => { await deleteTime(t.id); reload(); })}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div style={{ display: "grid", gridTemplateColumns: `140px 90px 1fr ${canManage ? "140px " : ""}auto`, gap: 6, alignItems: "center" }}>
            <AntDatePicker aria-label="Date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <AntInput aria-label="Hours" type="number" min={0.25} step={0.25} placeholder="Hours" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} />
            <AntInput aria-label="What was done" placeholder="What was done" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            {canManage && <AntSelect aria-label="Developer" value={form.dev} empty="—" options={developers.map(d => [d.id, d.name])} onChange={e => setForm({ ...form, dev: e.target.value })} />}
            <button className="btn" type="button" disabled={busy || !form.hours} onClick={add}>+ Log</button>
          </div>
        )}
      </div>
      <div className="field full">
        <label>Files &amp; documents</label>
        <Files kind="task" id={taskId} files={x.files} canEdit={canEdit} canRemove={canManage} />
      </div>
      {x.events.length > 0 && (
        <div className="field full">
          <label>History</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, maxHeight: 200, overflow: "auto" }}>
            {x.events.map((e, i) => (
              <div key={i}>
                <span className="mono muted">{new Date(e.at).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span> ·{" "}
                {e.kind === "status" ? <>{e.from ? `${STATUS_MAP[e.from as TaskStatus]?.label ?? e.from} → ` : "Created as "}<b style={{ fontWeight: 600 }}>{STATUS_MAP[e.to as TaskStatus]?.label ?? e.to}</b>{e.message && <span className="muted"> · {e.message}</span>}</>
                  : e.kind === "uat_reject" ? <>Sent back from UAT: {e.message}</> : e.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
