"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Calendar, ListOrdered, Mail } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { deleteMeeting, meetingActionsToTasks, saveMeeting } from "@/server/calendar";
import { fmtDay, today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { WEEKDAYS } from "@/lib/settings-defaults";
import { Empty } from "@/components/ui/bits";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntInput, AntTextArea, AntSelect, AntDatePicker, AntCheckbox } from "@/components/ui/antd";
import { MEETING_TYPES, meetingColor } from "@/lib/calendar";
export { MEETING_TYPES, meetingColor } from "@/lib/calendar";

export type MeetingDTO = {
  id: string; title: string; type: string; status: string; date: string; startTime: string; endTime: string; mode: string; location: string;
  projectId: string; companyId: string; organizer: string; remindMinutes: number; developerIds: string[]; inviteeRecordIds: string[];
  guests: string; agenda: string; minutes: string;
};
export type CalEvent = { kind: "meet" | "due" | "rem" | "live"; id: string; date: string; time: string; title: string; meetingType?: string; status?: string };
type Dev = { id: string; name: string; email: string; whatsapp: string };
type Rec = { id: string; name: string; email: string; sub: string };


const MODES = ["In person", "Microsoft Teams", "Zoom", "Google Meet", "Phone"];
const FILTERS: [string, string, string][] = [["meet", "Meetings", "var(--accent)"], ["due", "Task due dates", "var(--muted)"], ["rem", "Reminders", "var(--warn)"], ["live", "Go-lives", "var(--ok)"]];

const colorOf = (e: CalEvent) => (e.kind === "meet" ? (e.status === "Cancelled" ? "var(--hold)" : meetingColor(e.meetingType ?? "")) : e.kind === "due" ? (e.date < today() ? "var(--bad)" : "var(--muted)") : e.kind === "rem" ? "var(--warn)" : "var(--ok)");
const hrefOf = (e: CalEvent) => (e.kind === "due" ? `/tasks?edit=${e.id}` : e.kind === "rem" ? `/reminders?edit=${e.id}` : e.kind === "live" ? "/daily" : null);

type Props = {
  month: string; view: "month" | "agenda"; selected: string; show: string[]; gridStart: string; events: CalEvent[]; meetings: MeetingDTO[];
  developers: Dev[]; records: Rec[]; projects: { id: string; name: string }[]; companies: { id: string; name: string }[]; organizer: string;
  canEdit: boolean; canManage: boolean; openId?: string; openNew: boolean;
};

export function CalendarView(p: Props) {
  const { update } = useUrlUpdate();
  const T = today();
  const days = Array.from({ length: 42 }, (_, k) => addDays(p.gridStart, k));
  const monthLabel = new Date(p.month + "-01T00:00:00Z").toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const shift = (n: number) => { const [y, m] = p.month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); update({ m: d.toISOString().slice(0, 7) }); };
  const toggleFilter = (k: string, on: boolean) => update({ f: (on ? [...p.show, k] : p.show.filter(x => x !== k)).join(",") || "none" });
  const editing = p.openNew ? null : p.openId ? p.meetings.find(m => m.id === p.openId) ?? null : undefined;
  const [presetDate, setPresetDate] = useState<string | null>(null);

  const agenda = (E: CalEvent[]) => (
    <div className="alist">
      {E.map(e => {
        const m = e.kind === "meet" ? p.meetings.find(x => x.id === e.id) : undefined;
        const n = m ? m.developerIds.length + m.inviteeRecordIds.length + m.guests.split(/[,;\n]/).filter(s => s.trim()).length : 0;
        const href = hrefOf(e);
        const body = (
          <>
            <span className="stripe" />
            <div style={{ minWidth: 0 }}>
              <div className="t" style={e.status === "Cancelled" ? { textDecoration: "line-through" } : undefined}>
                {e.kind === "rem" && <Bell size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 4, color: "var(--warn)" }} />}
                {e.time && <><span className="mono">{e.time}{m?.endTime ? "–" + m.endTime : ""}</span> · </>}{e.title}
              </div>
              <div className="s">{m ? `${m.type} · ${m.mode}${m.location ? " · " + m.location : ""} · ${n} attendee${n === 1 ? "" : "s"}${m.status !== "Planned" ? " · " + m.status : ""}` : { due: "Task due date", rem: "Reminder", live: "Software rollout", meet: "" }[e.kind]}</div>
            </div>
            <span />
          </>
        );
        const style = { ["--c" as string]: colorOf(e), textDecoration: "none", color: "inherit" };
        return href
          ? <Link key={e.kind + e.id} className="aitem" href={href} style={style}>{body}</Link>
          : <div key={e.kind + e.id} className="aitem" style={{ ...style, cursor: "pointer" }} onClick={() => update({ edit: e.id })}>{body}</div>;
      })}
    </div>
  );

  return (
    <>
      <div className="filters">
        <button className="btn" type="button" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
        <b style={{ font: "700 17px var(--display)", minWidth: 150, textAlign: "center" }}>{monthLabel}</b>
        <button className="btn" type="button" aria-label="Next month" onClick={() => shift(1)}>›</button>
        <button className="btn" type="button" onClick={() => update({ m: T.slice(0, 7), d: T })}>Today</button>
        <span className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-pressed={p.view === "month" || !p.view}
            onClick={() => update({ v: null })}
          >
            <Calendar size={14} />
            <span>Month</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-pressed={p.view === "agenda"}
            onClick={() => update({ v: "agenda" })}
          >
            <ListOrdered size={14} />
            <span>Agenda</span>
          </button>
        </span>
        <span className="legend" style={{ marginLeft: 6 }}>
          {FILTERS.map(([k, l, c]) => (
            <label key={k} style={{ display: "inline-flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
              <AntCheckbox checked={p.show.includes(k)} onChange={e => toggleFilter(k, e.target.checked)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <i className="dot" style={{ background: c }} />{l}
                </span>
              </AntCheckbox>
            </label>
          ))}
        </span>
        <span style={{ flex: 1 }} />
        {p.canEdit && <button className="btn primary" type="button" onClick={() => { setPresetDate(p.selected); update({ new: "1", edit: null }); }}>+ Schedule meeting</button>}
      </div>

      {p.view === "month" ? (
        <>
          <div className="tablewrap" style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(110px,1fr))", minWidth: 770 }}>
              {WEEKDAYS.map(w => <div key={w} style={{ padding: "9px 10px", font: "600 11px var(--body)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", background: "var(--sunk)", borderBottom: "1px solid var(--line)" }}>{w}</div>)}
              {days.map(x => {
                const E = p.events.filter(e => e.date === x);
                const inMonth = x.slice(0, 7) === p.month;
                return (
                  <div key={x} onClick={() => update({ d: x })} onDoubleClick={() => { if (p.canEdit) { setPresetDate(x); update({ new: "1", d: x }); } }}
                    style={{ minHeight: 112, padding: 6, borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
                      background: x === p.selected ? "color-mix(in srgb,var(--accent) 12%,var(--surface))" : x === T ? "color-mix(in srgb,var(--accent) 7%,var(--surface))" : inMonth ? "var(--surface)" : "var(--sunk)" }}>
                    <span style={{ font: `${x === T ? 800 : 600} 12px var(--mono)`, color: x === T ? "var(--accent)" : inMonth ? "var(--fg)" : "var(--muted)" }}>{+x.slice(8)}</span>
                    {E.slice(0, 3).map(e => {
                      const c = colorOf(e);
                      return (
                        <span key={e.kind + e.id} title={e.title} style={{ display: "block", fontSize: 11.5, lineHeight: 1.3, padding: "2px 6px", borderRadius: 5, background: `color-mix(in srgb,${c} 15%,transparent)`, color: `color-mix(in srgb,${c} 80%,var(--fg))`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: e.status === "Cancelled" ? "line-through" : undefined }}>
                          {e.kind === "rem" && <Bell size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 3 }} />}
                          {e.time && <b>{e.time} </b>}{e.title}
                        </span>
                      );
                    })}
                    {E.length > 3 && <span className="muted" style={{ fontSize: 11 }}>+{E.length - 3} more</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <h2 className="sec">{new Date(p.selected + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</h2>
          {p.events.filter(e => e.date === p.selected).length
            ? agenda(p.events.filter(e => e.date === p.selected))
            : <p className="muted" style={{ margin: 0 }}>Nothing planned. Click a day to see it here; double-click to schedule a meeting.</p>}
        </>
      ) : (
        (() => {
          const future = p.events.filter(e => e.date >= T);
          const by = new Map<string, CalEvent[]>();
          future.forEach(e => by.set(e.date, [...(by.get(e.date) ?? []), e]));
          const past = p.meetings.filter(m => m.date < T).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
          return (
            <>
              {!by.size && <Empty title="Nothing in the next 60 days">Schedule meetings and discussions with business users and developers.</Empty>}
              {[...by].map(([x, E]) => (
                <section key={x}>
                  <h2 className="sec">{x === T ? "Today · " : ""}{new Date(x + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</h2>
                  {agenda(E)}
                </section>
              ))}
              {past.length > 0 && (<><h2 className="sec">Recent meetings</h2>{agenda(past.map(m => ({ kind: "meet", id: m.id, date: m.date, time: m.startTime, title: m.title, meetingType: m.type, status: m.status })))}</>)}
            </>
          );
        })()
      )}

      {editing !== undefined && (
        <MeetingForm key={editing?.id ?? "new"} meeting={editing} date={presetDate ?? p.selected} {...p} onClose={() => update({ edit: null, new: null })} />
      )}
    </>
  );
}

function icsDownload(m: MeetingDTO, attendees: { name: string; email: string }[]) {
  const esc = (s: string) => String(s || "").replace(/[\\;,]/g, c => "\\" + c).replace(/\n/g, "\\n");
  const local = (d: string, t: string) => new Date(`${d}T${t || "09:00"}:00`);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = local(m.date, m.startTime);
  let end = local(m.date, m.endTime || m.startTime || "10:00");
  if (end <= start) end = new Date(start.getTime() + 3600e3);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ERAM HCM Business Tools//EN", "METHOD:REQUEST", "BEGIN:VEVENT",
    `UID:${m.id}@eram-hcm-tools`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(m.title)}`, `LOCATION:${esc([m.mode, m.location].filter(Boolean).join(" · "))}`, `DESCRIPTION:${esc(m.agenda + "\n\n" + window.location.origin)}`,
    ...attendees.filter(a => a.email).map(a => `ATTENDEE;CN=${esc(a.name)}:mailto:${a.email}`),
    ...(m.remindMinutes ? ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", `TRIGGER:-PT${m.remindMinutes}M`, "END:VALARM"] : []),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${m.title.replace(/[^\w\- ]+/g, "").slice(0, 40) || "meeting"}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Calendar file downloaded. Open it to add to Outlook or Google Calendar.");
}

function MeetingForm({ meeting, date, developers, records, projects, companies, organizer, canEdit, canManage, onClose }: Props & { meeting: MeetingDTO | null; date: string; onClose: () => void }) {
  const router = useRouter();
  const compose = useCompose();
  const initial = useMemo(() => meeting ?? {
    id: "", title: "", type: "Discussion", status: "Planned", date, startTime: "10:00", endTime: "11:00", mode: "Microsoft Teams", location: "", projectId: "", companyId: "",
    organizer, remindMinutes: 30, developerIds: [], inviteeRecordIds: [], guests: "", agenda: "", minutes: "",
  }, [meeting, date, organizer]);
  const [f, setF] = useState<MeetingDTO>(initial);
  const [uq, setUq] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof MeetingDTO>(k: K, v: MeetingDTO[K]) => setF(x => ({ ...x, [k]: v }));

  const attendees = (m: MeetingDTO) => [
    ...developers.filter(d => m.developerIds.includes(d.id)).map(d => ({ id: d.id, name: d.name, email: d.email, whatsapp: d.whatsapp, dev: true })),
    ...records.filter(r => m.inviteeRecordIds.includes(r.id)).map(r => ({ id: "u:" + r.id, name: r.name, email: r.email, whatsapp: "", dev: false })),
    ...m.guests.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).map(g => ({ id: "g:" + g, name: g.includes("@") ? g.split("@")[0] : g, email: g.includes("@") ? g : "", whatsapp: /^\+?[\d\s-]{8,}$/.test(g) ? g : "", dev: false })),
  ];
  const invite = (m: MeetingDTO) => {
    const A = attendees(m);
    const when = new Date(m.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    compose({
      tpl: "custom", devIds: A.filter(a => a.dev).map(a => a.id), extra: A.filter(a => !a.dev),
      subject: `Invitation: ${m.title} – ${fmtDay(m.date)} ${m.startTime}`,
      body: `Hi {name},\n\nYou're invited to ${m.type || "a meeting"}: ${m.title}\n\nWhen: ${when}, ${m.startTime}${m.endTime ? "–" + m.endTime : ""}\nWhere: ${m.mode}${m.location ? " · " + m.location : ""}${m.organizer ? "\nOrganizer: " + m.organizer : ""}${m.agenda ? "\n\nAgenda:\n" + m.agenda : ""}\n\n{link}`,
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await saveMeeting({ ...f, id: meeting?.id, status: f.status as "Planned" });
      if (!r.ok) { setError(r.error); return; }
      toast(meeting ? "Saved" : "Meeting scheduled");
      onClose();
      if (!meeting && attendees(f).length) invite(f);
    });
  };
  const input = (k: "title" | "location" | "organizer", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => (
    <div className={"field" + (full ? " full" : "")}>
      <label htmlFor={"mt_" + k}>{label}</label>
      <AntInput id={"mt_" + k} value={f[k]} onChange={e => set(k, e.target.value)} {...extra} />
    </div>
  );
  const recs = records.filter(r => !uq || (r.name + " " + r.sub).toLowerCase().includes(uq.toLowerCase()));

  return (
    <Panel title={meeting ? "Meeting" : "Schedule meeting"} dirty={dirty} onClose={onClose}
      footer={<>
        <span>{meeting && canEdit && <button className="btn danger" type="button" disabled={busy} onClick={() => confirm("Delete this meeting?") && start(async () => { const r = await deleteMeeting(meeting.id); if (r.ok) { toast("Meeting deleted"); onClose(); } else setError(r.error); })}>Delete</button>}</span>
        <div>
          {meeting && canManage && meeting.minutes && <button className="btn" type="button" disabled={busy} onClick={() => start(async () => { const r = await meetingActionsToTasks(meeting.id); if (!r.ok) { setError(r.error); return; } toast(`${r.data!.count} task${r.data!.count === 1 ? "" : "s"} created`); router.refresh(); })}>Actions → tasks</button>}
          {meeting && (
            <button className="btn" type="button" onClick={() => icsDownload(meeting, attendees(meeting))}>
              <Calendar size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
              .ics
            </button>
          )}
          {meeting && (
            <button className="btn" type="button" onClick={() => invite(meeting)}>
              <Mail size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
              Invite
            </button>
          )}
          <button className="btn" type="button" onClick={() => { if (!dirty || confirm("You have unsaved changes. Close without saving?")) onClose(); }}>Cancel</button>
          {canEdit && <button className="btn primary" type="submit" form="meetform" disabled={busy}>{busy ? "Saving…" : meeting ? "Save" : "Schedule"}</button>}
        </div>
      </>}>
      <form className="form" id="meetform" onSubmit={save}>
        {input("title", "Title", { required: true, placeholder: "e.g. Payroll requirements with HR team", autoFocus: !meeting }, true)}
        <div className="field">
          <label htmlFor="mt_ty">Type</label>
          <AntSelect id="mt_ty" value={f.type} onChange={e => set("type", e.target.value)} options={MEETING_TYPES.map(([t]) => [t, t])} />
        </div>
        <div className="field">
          <label htmlFor="mt_st">Status</label>
          <AntSelect id="mt_st" value={f.status} onChange={e => set("status", e.target.value)} options={["Planned", "Done", "Cancelled"].map(s => [s, s])} />
        </div>
        <div className="field">
          <label htmlFor="mt_d">Date</label>
          <AntDatePicker id="mt_d" value={f.date} onChange={e => set("date", e.target.value)} />
        </div>
        <div className="field">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="field"><label htmlFor="mt_s">Start</label><AntInput id="mt_s" type="time" value={f.startTime} onChange={e => set("startTime", e.target.value)} /></div>
            <div className="field"><label htmlFor="mt_e">End</label><AntInput id="mt_e" type="time" value={f.endTime} onChange={e => set("endTime", e.target.value)} /></div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="mt_mo">Where</label>
          <AntSelect id="mt_mo" value={f.mode} onChange={e => set("mode", e.target.value)} options={MODES.map(m => [m, m])} />
        </div>
        {input("location", "Room or meeting link")}
        <div className="field">
          <label htmlFor="mt_p">System</label>
          <AntSelect id="mt_p" value={f.projectId} onChange={e => set("projectId", e.target.value)} empty="—" options={projects.map(x => [x.id, x.name])} />
        </div>
        <div className="field">
          <label htmlFor="mt_c">Company</label>
          <AntSelect id="mt_c" value={f.companyId} onChange={e => set("companyId", e.target.value)} empty="—" options={companies.map(x => [x.id, x.name])} />
        </div>
        {input("organizer", "Organizer")}
        <div className="field">
          <label htmlFor="mt_r">Remind attendees</label>
          <AntSelect
            id="mt_r"
            value={String(f.remindMinutes)}
            onChange={e => set("remindMinutes", Number(e.target.value))}
            options={[["0", "No reminder"], ["15", "15 min before"], ["30", "30 min before"], ["60", "1 hour before"], ["1440", "1 day before"]]}
          />
        </div>
        <div className="field full">
          <label>Developers</label>
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
        <div className="field full">
          <label htmlFor="mt_uq">Business users (from Users &amp; access)</label>
          {records.length ? (
            <>
              <AntInput id="mt_uq" type="search" placeholder="Filter…" value={uq} onChange={e => setUq(e.target.value)} />
              <div style={{ maxHeight: 150, overflow: "auto", display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                {recs.map(r => (
                  <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13, color: "var(--fg)" }}>
                    <AntCheckbox checked={f.inviteeRecordIds.includes(r.id)} onChange={e => set("inviteeRecordIds", e.target.checked ? [...f.inviteeRecordIds, r.id] : f.inviteeRecordIds.filter(x => x !== r.id))}>
                      {r.name} <span className="muted">{r.sub}</span>
                    </AntCheckbox>
                  </label>
                ))}
              </div>
            </>
          ) : <span className="muted" style={{ fontSize: 13 }}>No one in the Users &amp; access register yet. Add guests below.</span>}
        </div>
        <div className="field full"><label htmlFor="mt_g">Other guests (emails or WhatsApp numbers, comma separated)</label><AntInput id="mt_g" value={f.guests} placeholder="name@company.com, +9665…" onChange={e => set("guests", e.target.value)} /></div>
        <div className="field full"><label htmlFor="mt_a">Agenda</label><AntTextArea id="mt_a" rows={3} value={f.agenda} onChange={e => set("agenda", e.target.value)} /></div>
        <div className="field full"><label htmlFor="mt_mn">Minutes, decisions and action items</label><AntTextArea id="mt_mn" rows={4} placeholder="Start action items with - to turn them into tasks." value={f.minutes} onChange={e => set("minutes", e.target.value)} /></div>
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
