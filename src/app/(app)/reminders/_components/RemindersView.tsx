"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { deleteReminder, reminderDone, saveReminder } from "@/server/calendar";
import type { AutoData, ReminderDTO } from "@/server/reminders-data";
import { fmtDay, today } from "@/lib/dates";
import { TEMPLATE_DEFAULTS, WEEKDAYS, type TemplateKey } from "@/lib/settings-defaults";
import { AItem } from "@/components/ui/bits";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntInput, AntTextArea, AntSelect, AntDatePicker, AntCheckbox } from "@/components/ui/antd";
import { autoReminders, isDue, type AutoReminder } from "@/lib/reminders";
export { autoReminders, isDue, type AutoReminder } from "@/lib/reminders";

const REPEAT: Record<string, string> = { none: "Once", daily: "Daily", weekdays: "Working days", weekly: "Weekly" };

type Props = {
  reminders: ReminderDTO[]; auto: AutoData; developers: { id: string; name: string }[]; tasks: { id: string; label: string }[];
  canEdit: boolean; canManage: boolean; openId?: string; openNew: boolean;
};

export function RemindersView({ reminders, auto, developers, tasks, canEdit, canManage, openId, openNew }: Props) {
  const { update } = useUrlUpdate();
  const compose = useCompose();
  const [, start] = useTransition();
  // due-ness depends on the clock: render after mount and refresh every minute
  const [tick, setTick] = useState(0);
  useEffect(() => { setTick(1); const t = setInterval(() => setTick(x => x + 1), 60_000); return () => clearInterval(t); }, []);
  const A = tick ? autoReminders(auto) : [];
  const due = tick ? reminders.filter(isDue) : [];
  const up = reminders.filter(r => !r.done && !due.includes(r));
  const dn = reminders.filter(r => r.done).slice(-20).reverse();
  const devName = (id: string) => developers.find(d => d.id === id)?.name;
  const editing = openNew ? null : openId ? reminders.find(r => r.id === openId) ?? null : undefined;

  const send = (r: ReminderDTO) => {
    const custom = !r.template || r.template === "custom";
    compose({ tpl: (r.template as TemplateKey) || "custom", devIds: r.developerIds, ...(custom ? { subject: "Reminder: " + r.title, body: `Hi {name},\n\nReminder: ${r.title}${r.note ? "\n" + r.note : ""}\n\n{link}` } : {}), item: r.taskTitle ? { title: r.taskTitle, project: "", due: "" } : undefined });
  };
  const mark = (r: ReminderDTO, snooze: boolean) => start(async () => { const x = await reminderDone(r.id, snooze); toast(x.ok ? (snooze ? "Moved to tomorrow" : "Done") : x.error); });

  const table = (title: string, L: ReminderDTO[], mode: "due" | "up" | "done") => {
    const columns: ColumnsType<ReminderDTO> = [
      {
        title: "Reminder",
        dataIndex: "title",
        key: "title",
        render: (t: string, r: ReminderDTO) => (
          <div>
            <b style={{ fontWeight: 600 }}>{t}</b>
            {r.note && <div className="muted" style={{ fontSize: 12 }}>{r.note}</div>}
          </div>
        ),
      },
      {
        title: "When",
        key: "when",
        className: "mono",
        render: (_: unknown, r: ReminderDTO) => (
          <span style={{ whiteSpace: "nowrap", ...(mode === "due" ? { color: "var(--bad)", fontWeight: 700 } : {}) }}>
            {fmtDay(r.date)} {r.time}
          </span>
        ),
      },
      {
        title: "Repeat",
        dataIndex: "repeat",
        key: "repeat",
        render: (repeat: string) => REPEAT[repeat] ?? "Once",
      },
      {
        title: "For",
        key: "for",
        render: (_: unknown, r: ReminderDTO) => r.developerIds.map(devName).filter(Boolean).join(", ") || "—",
      },
      {
        title: "Item",
        key: "item",
        render: (_: unknown, r: ReminderDTO) => (r.taskId ? <Link href={`/tasks?edit=${r.taskId}`}>{r.taskTitle}</Link> : "—"),
      },
      {
        title: "",
        key: "action",
        align: "right",
        render: (_: unknown, r: ReminderDTO) => (
          <div style={{ whiteSpace: "nowrap" }}>
            {mode !== "done" && canEdit && (
              <>
                <button className="btn" type="button" onClick={() => send(r)}>Send</button>{" "}
                <button className="btn" type="button" onClick={() => mark(r, true)}>+1 day</button>{" "}
                <button className="btn" type="button" onClick={() => mark(r, false)}>
                  {r.repeat !== "none" ? "Done · next" : "Done"}
                </button>{" "}
              </>
            )}
            {canEdit && <button className="btn" type="button" onClick={() => update({ edit: r.id })}>Edit</button>}
          </div>
        ),
      },
    ];

    return (
      <>
        <h2 className="sec">{title} <span className="mono muted" style={{ fontSize: 13 }}>{L.length}</span></h2>
        <AntTable<ReminderDTO>
          dataSource={L}
          columns={columns}
          rowKey="id"
          pagination={false}
          emptyTitle="No reminders"
          emptyDescription={mode === "due" ? "No overdue reminders." : mode === "up" ? "No upcoming reminders scheduled." : "No completed reminders."}
        />
      </>
    );
  };

  return (
    <>
      <div className="filters">
        <span className="muted" style={{ flex: 1 }}>
          Reminders show here and on the Development stats page when they fall due. Automatic ones follow Admin panel → Notifications (daily update by {auto.dailyTime} on {auto.days.map(x => WEEKDAYS[x]).join(", ")}).
        </span>
        {canManage && <button className="btn" type="button" onClick={() => compose({ tpl: "summary", manager: true })}>Send status summary</button>}
        {canEdit && <button className="btn primary" type="button" onClick={() => update({ new: "1", edit: null })}>+ New reminder</button>}
      </div>
      <h2 className="sec" style={{ marginTop: 0 }}>Automatic</h2>
      {!A.length ? <p className="muted" style={{ margin: 0 }}>Nothing due right now. Daily-update reminders appear after {auto.dailyTime} on working days.</p> : (
        <div className="alist">
          {A.map(a => (
            <AItem key={a.key} color={a.color} title={a.title} sub={<span style={{ whiteSpace: "normal" }}>{a.sub}</span>}
              right={a.meetingId ? <Link className="btn primary" href={`/calendar?edit=${a.meetingId}`}>Open meeting</Link> : <button className="btn primary" type="button" onClick={() => compose({ tpl: a.tpl, devIds: a.devIds })}>Send reminder</button>} />
          ))}
        </div>
      )}
      {table("Due now", due, "due")}
      {table("Upcoming", up, "up")}
      {table("Recently done", dn, "done")}
      {editing !== undefined && <ReminderForm key={editing?.id ?? "new"} reminder={editing} developers={developers} tasks={tasks} onClose={() => update({ edit: null, new: null })} />}
    </>
  );
}

function ReminderForm({ reminder, developers, tasks, onClose }: { reminder: ReminderDTO | null; developers: { id: string; name: string }[]; tasks: { id: string; label: string }[]; onClose: () => void }) {
  const initial = { title: reminder?.title ?? "", date: reminder?.date ?? today(), time: reminder?.time ?? "09:00", repeat: reminder?.repeat ?? "none", template: reminder?.template ?? "custom", developerIds: reminder?.developerIds ?? [], taskId: reminder?.taskId ?? "", note: reminder?.note ?? "" };
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const taskOptions = reminder?.taskId && !tasks.some(t => t.id === reminder.taskId) ? [{ id: reminder.taskId, label: reminder.taskTitle }, ...tasks] : tasks;
  return (
    <Panel title={reminder ? "Edit reminder" : "New reminder"} dirty={dirty} onClose={onClose}
      footer={<>
        <span>{reminder && <button className="btn danger" type="button" disabled={busy} onClick={() => confirm("Delete this reminder?") && start(async () => { const r = await deleteReminder(reminder.id); if (r.ok) { toast("Reminder deleted"); onClose(); } })}>Delete</button>}</span>
        <div>
          <button className="btn" type="button" onClick={() => { if (!dirty || confirm("You have unsaved changes. Close without saving?")) onClose(); }}>Cancel</button>
          <button className="btn primary" type="submit" form="remform" disabled={busy}>Save reminder</button>
        </div>
      </>}>
      <form className="form" id="remform" onSubmit={e => { e.preventDefault(); start(async () => { setError(""); const r = await saveReminder({ ...f, id: reminder?.id, repeat: f.repeat as "none" }); if (!r.ok) { setError(r.error); return; } toast("Reminder saved"); onClose(); }); }}>
        <div className="field full"><label htmlFor="rm_t">Reminder</label><AntInput id="rm_t" required value={f.title} placeholder="e.g. Follow up Pipeline Report with MPD" onChange={e => set("title", e.target.value)} autoFocus={!reminder} /></div>
        <div className="field"><label htmlFor="rm_d">Date</label><AntDatePicker id="rm_d" value={f.date} onChange={e => set("date", e.target.value)} /></div>
        <div className="field"><label htmlFor="rm_tm">Time</label><AntInput id="rm_tm" type="time" value={f.time} onChange={e => set("time", e.target.value)} /></div>
        <div className="field"><label htmlFor="rm_r">Repeat</label><AntSelect id="rm_r" value={f.repeat} onChange={e => set("repeat", e.target.value)} options={Object.entries(REPEAT).map(([k, l]) => [k, l])} /></div>
        <div className="field"><label htmlFor="rm_tpl">Message to send</label><AntSelect id="rm_tpl" value={f.template} onChange={e => set("template", e.target.value)} options={(Object.keys(TEMPLATE_DEFAULTS) as TemplateKey[]).map(k => [k, TEMPLATE_DEFAULTS[k].label])} /></div>
        <div className="field full">
          <label>Notify</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {developers.map(d => (
              <label key={d.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", color: "var(--fg)", font: "inherit" }}>
                <AntCheckbox checked={f.developerIds.includes(d.id)} onChange={e => set("developerIds", e.target.checked ? [...f.developerIds, d.id] : f.developerIds.filter(x => x !== d.id))}>
                  {d.name}
                </AntCheckbox>
              </label>
            ))}
          </div>
        </div>
        <div className="field full"><label htmlFor="rm_i">Linked item</label><AntSelect id="rm_i" value={f.taskId} onChange={e => set("taskId", e.target.value)} empty="—" options={taskOptions.map(t => [t.id, t.label])} /></div>
        <div className="field full"><label htmlFor="rm_n">Note</label><AntTextArea id="rm_n" rows={3} value={f.note} onChange={e => set("note", e.target.value)} /></div>
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
