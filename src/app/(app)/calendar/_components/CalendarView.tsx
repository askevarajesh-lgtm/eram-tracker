"use client";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Calendar, ListOrdered, Mail, Plus } from "lucide-react";
import { deleteMeeting, meetingActionsToTasks, saveMeeting } from "@/server/calendar";
import { fmtDay, today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntInput, AntTextArea, AntSelect, AntDatePicker, AntTimePicker, AntCheckbox } from "@/components/ui/antd";
import { MEETING_TYPES, meetingColor } from "@/lib/calendar";

import "./calendar.css";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarTopBar } from "./CalendarTopBar";
import { MonthView } from "./MonthView";
import { AgendaView } from "./AgendaView";
import { EventQuickPopover } from "./EventQuickPopover";
import { MeetingDetailModal } from "./MeetingDetailModal";
import type { MeetingDTO, CalEvent, Dev, Rec, CalendarViewProps } from "./CalendarTypes";

export { MEETING_TYPES, meetingColor } from "@/lib/calendar";
export type { MeetingDTO, CalEvent } from "./CalendarTypes";

const MODES = ["In person", "Microsoft Teams", "Zoom", "Google Meet", "Phone"];

export function CalendarView(p: CalendarViewProps) {
  const router = useRouter();
  const { update } = useUrlUpdate();
  const T = today();

  const [activeDevFilter, setActiveDevFilter] = useState<string | undefined>(
    p.activeDevFilter
  );
  const [activeProjectFilter, setActiveProjectFilter] = useState<
    string | undefined
  >(p.activeProjectFilter);

  const [quickEvent, setQuickEvent] = useState<CalEvent | null>(null);
  const [presetDate, setPresetDate] = useState<string | null>(null);
  const [presetTime, setPresetTime] = useState<string | null>(null);

  const currentView: "month" | "agenda" =
    p.view === "agenda" ? "agenda" : "month";

  // Shift month by n months
  const shift = (n: number) => {
    const [y, m] = p.month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    update({ m: d.toISOString().slice(0, 7) });
  };

  // Toggle filter kind (meet, due, rem, live)
  const toggleFilter = (k: string, on: boolean) => {
    const next = on ? [...p.show, k] : p.show.filter((x) => x !== k);
    update({ f: next.join(",") || "none" });
  };

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return p.events.filter((e) => {
      if (activeDevFilter) {
        if (!e.developerIds || !e.developerIds.includes(activeDevFilter)) {
          return false;
        }
      }
      if (activeProjectFilter) {
        if (e.projectId && e.projectId !== activeProjectFilter) {
          return false;
        }
      }
      return true;
    });
  }, [p.events, activeDevFilter, activeProjectFilter]);

  const editing = p.openNew
    ? null
    : p.openId
    ? p.meetings.find((m) => m.id === p.openId) ?? null
    : undefined;

  const [viewingMeeting, setViewingMeeting] = useState<MeetingDTO | null>(() => {
    return p.openViewId ? p.meetings.find((m) => m.id === p.openViewId) ?? null : null;
  });

  useEffect(() => {
    if (p.openViewId) {
      setViewingMeeting(p.meetings.find((m) => m.id === p.openViewId) ?? null);
    } else {
      setViewingMeeting(null);
    }
  }, [p.openViewId, p.meetings]);

  const quickMeeting = quickEvent?.kind === "meet"
    ? p.meetings.find((m) => m.id === quickEvent.id)
    : undefined;

  return (
    <div className="cal-root">
      {/* 1. Left Sidebar Navigation & Filters */}
      <CalendarSidebar
        month={p.month}
        selected={p.selected}
        show={p.show}
        events={filteredEvents}
        developers={p.developers}
        projects={p.projects}
        activeDevFilter={activeDevFilter}
        activeProjectFilter={activeProjectFilter}
        canEdit={p.canEdit}
        onSelectDate={(d) => {
          update({ d, m: d.slice(0, 7) });
        }}
        onShiftMonth={shift}
        onToggleFilter={toggleFilter}
        onFilterDev={(devId) => setActiveDevFilter(devId)}
        onFilterProject={(prjId) => setActiveProjectFilter(prjId)}
        onOpenNew={() => {
          setPresetDate(p.selected);
          setPresetTime("10:00");
          update({ new: "1", edit: null });
        }}
      />

      {/* 2. Main Calendar Canvas */}
      <main className="cal-canvas">
        <CalendarTopBar
          month={p.month}
          view={currentView}
          canEdit={p.canEdit}
          onShiftMonth={shift}
          onSetView={(v) => update({ v })}
          onGoToday={() => update({ m: T.slice(0, 7), d: T })}
          onOpenNew={() => {
            setPresetDate(p.selected);
            setPresetTime("10:00");
            update({ new: "1", edit: null });
          }}
        />

        {/* Calendar Body: Month / Agenda */}
        {currentView === "month" && (
          <MonthView
            month={p.month}
            selected={p.selected}
            gridStart={p.gridStart}
            events={filteredEvents}
            canEdit={p.canEdit}
            onSelectDate={(d) => update({ d })}
            onSelectEvent={(e) => setQuickEvent(e)}
            onQuickAdd={(d) => {
              setPresetDate(d);
              setPresetTime("10:00");
              update({ new: "1", edit: null, d });
            }}
          />
        )}

        {currentView === "agenda" && (
          <AgendaView
            month={p.month}
            events={filteredEvents}
            meetings={p.meetings}
            developers={p.developers}
            records={p.records}
            onSelectEvent={(e) => setQuickEvent(e)}
          />
        )}
      </main>

      {/* 3. Floating Quick Popover (Reference style) */}
      {quickEvent && (
        <EventQuickPopover
          event={quickEvent}
          meeting={quickMeeting}
          developers={p.developers}
          records={p.records}
          canEdit={p.canEdit}
          onClose={() => setQuickEvent(null)}
          onOpenFullForm={(meetingId) => {
            if (meetingId) {
              const mt = p.meetings.find((m) => m.id === meetingId) ?? null;
              setViewingMeeting(mt);
              update({ view: meetingId, edit: null, new: null });
            }
          }}
          onDeleteMeeting={async (meetingId) => {
            const r = await deleteMeeting(meetingId);
            if (r.ok) {
              toast("Meeting deleted");
              router.refresh();
            } else {
              toast(r.error || "Failed to delete meeting");
            }
          }}
          onSaveQuickMeeting={async (changes) => {
            if (!quickMeeting) return;
            const updated = {
              ...quickMeeting,
              ...changes,
              status: (changes.status || quickMeeting.status) as "Planned" | "Done" | "Cancelled",
            };
            const r = await saveMeeting(updated);
            if (r.ok) {
              toast("Meeting saved");
              router.refresh();
            } else {
              toast(r.error || "Failed to save meeting");
            }
          }}
        />
      )}

      {/* 4. Full Meeting Form Slide-over Panel */}
      {editing !== undefined && (
        <MeetingForm
          key={editing?.id ?? "new"}
          meeting={editing}
          date={presetDate ?? p.selected}
          initialStartTime={presetTime ?? undefined}
          {...p}
          onClose={() => update({ edit: null, new: null })}
        />
      )}

      {/* 5. Meeting View Detail Modal */}
      {viewingMeeting && (
        <MeetingDetailModal
          meeting={viewingMeeting}
          developers={p.developers}
          records={p.records}
          projects={p.projects}
          companies={p.companies}
          canEdit={p.canEdit}
          canManage={p.canManage}
          onEdit={() => {
            const id = viewingMeeting.id;
            setViewingMeeting(null);
            update({ edit: id, view: null });
          }}
          onClose={() => {
            setViewingMeeting(null);
            update({ view: null });
          }}
        />
      )}
    </div>
  );
}

function icsDownload(m: MeetingDTO, attendees: { name: string; email: string }[]) {
  const esc = (s: string) =>
    String(s || "")
      .replace(/[\\;,]/g, (c) => "\\" + c)
      .replace(/\n/g, "\\n");
  const local = (d: string, t: string) => new Date(`${d}T${t || "09:00"}:00`);
  const stamp = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = local(m.date, m.startTime);
  let end = local(m.date, m.endTime || m.startTime || "10:00");
  if (end <= start) end = new Date(start.getTime() + 3600e3);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ERAM HCM Business Tools//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${m.id}@eram-hcm-tools`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(m.title)}`,
    `LOCATION:${esc([m.mode, m.location].filter(Boolean).join(" · "))}`,
    `DESCRIPTION:${esc(m.agenda + "\n\n" + window.location.origin)}`,
    ...attendees
      .filter((a) => a.email)
      .map((a) => `ATTENDEE;CN=${esc(a.name)}:mailto:${a.email}`),
    ...(m.remindMinutes
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          "DESCRIPTION:Reminder",
          `TRIGGER:-PT${m.remindMinutes}M`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${m.title.replace(/[^\w\- ]+/g, "").slice(0, 40) || "meeting"}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Calendar file downloaded. Open it to add to Outlook or Google Calendar.");
}

function MeetingForm({
  meeting,
  date,
  initialStartTime,
  developers,
  records,
  projects,
  companies,
  organizer,
  canEdit,
  canManage,
  onClose,
}: CalendarViewProps & {
  meeting: MeetingDTO | null;
  date: string;
  initialStartTime?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const compose = useCompose();
  const initial = useMemo<MeetingDTO>(
    () =>
      meeting ?? {
        id: "",
        title: "",
        type: "Discussion",
        status: "Planned" as const,
        date,
        startTime: initialStartTime ?? "10:00",
        endTime: "11:00",
        mode: "Microsoft Teams",
        location: "",
        projectId: "",
        companyId: "",
        organizer,
        remindMinutes: 30,
        developerIds: [],
        inviteeRecordIds: [],
        guests: "",
        agenda: "",
        minutes: "",
      },
    [meeting, date, initialStartTime, organizer]
  );
  const [f, setF] = useState<MeetingDTO>(initial);
  const [uq, setUq] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof MeetingDTO>(k: K, v: MeetingDTO[K]) =>
    setF((x) => ({ ...x, [k]: v }));

  const attendees = (m: MeetingDTO) => [
    ...developers
      .filter((d) => m.developerIds.includes(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        whatsapp: d.whatsapp,
        dev: true,
      })),
    ...records
      .filter((r) => m.inviteeRecordIds.includes(r.id))
      .map((r) => ({
        id: "u:" + r.id,
        name: r.name,
        email: r.email,
        whatsapp: "",
        dev: false,
      })),
    ...m.guests
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((g) => ({
        id: "g:" + g,
        name: g.includes("@") ? g.split("@")[0] : g,
        email: g.includes("@") ? g : "",
        whatsapp: /^\+?[\d\s-]{8,}$/.test(g) ? g : "",
        dev: false,
      })),
  ];

  const invite = (m: MeetingDTO) => {
    const A = attendees(m);
    const when = new Date(m.date + "T00:00:00Z").toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    compose({
      tpl: "custom",
      devIds: A.filter((a) => a.dev).map((a) => a.id),
      extra: A.filter((a) => !a.dev),
      subject: `Invitation: ${m.title} – ${fmtDay(m.date)} ${m.startTime}`,
      body: `Hi {name},\n\nYou're invited to ${
        m.type || "a meeting"
      }: ${m.title}\n\nWhen: ${when}, ${m.startTime}${
        m.endTime ? "–" + m.endTime : ""
      }\nWhere: ${m.mode}${m.location ? " · " + m.location : ""}${
        m.organizer ? "\nOrganizer: " + m.organizer : ""
      }${m.agenda ? "\n\nAgenda:\n" + m.agenda : ""}\n\n{link}`,
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await saveMeeting({
        ...f,
        id: meeting?.id,
        status: f.status as "Planned",
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast(meeting ? "Saved" : "Meeting scheduled");
      onClose();
      if (!meeting && attendees(f).length) invite(f);
      router.refresh();
    });
  };

  const input = (
    k: "title" | "location" | "organizer",
    label: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
    full = false
  ) => (
    <div className={"field" + (full ? " full" : "")}>
      <label htmlFor={"mt_" + k}>{label}</label>
      <AntInput
        id={"mt_" + k}
        value={f[k]}
        onChange={(e) => set(k, e.target.value)}
        {...extra}
      />
    </div>
  );

  const recs = records.filter(
    (r) => !uq || (r.name + " " + r.sub).toLowerCase().includes(uq.toLowerCase())
  );

  return (
    <Panel
      title={meeting ? "Meeting" : "Schedule meeting"}
      dirty={dirty}
      onClose={onClose}
      footer={
        <>
          <span>
            {meeting && canEdit && (
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={() =>
                  confirm("Delete this meeting?") &&
                  start(async () => {
                    const r = await deleteMeeting(meeting.id);
                    if (r.ok) {
                      toast("Meeting deleted");
                      onClose();
                      router.refresh();
                    } else setError(r.error);
                  })
                }
              >
                Delete
              </button>
            )}
          </span>
          <div>
            {meeting && canManage && meeting.minutes && (
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const r = await meetingActionsToTasks(meeting.id);
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    toast(
                      `${r.data!.count} task${
                        r.data!.count === 1 ? "" : "s"
                      } created`
                    );
                    router.refresh();
                  })
                }
              >
                Actions → tasks
              </button>
            )}
            {meeting && (
              <button
                className="btn"
                type="button"
                onClick={() => icsDownload(meeting, attendees(meeting))}
              >
                <Calendar
                  size={14}
                  style={{
                    display: "inline-block",
                    verticalAlign: "-2px",
                    marginRight: 6,
                  }}
                />
                .ics
              </button>
            )}
            {meeting && (
              <button
                className="btn"
                type="button"
                onClick={() => invite(meeting)}
              >
                <Mail
                  size={14}
                  style={{
                    display: "inline-block",
                    verticalAlign: "-2px",
                    marginRight: 6,
                  }}
                />
                Invite
              </button>
            )}
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (
                  !dirty ||
                  confirm("You have unsaved changes. Close without saving?")
                )
                  onClose();
              }}
            >
              Cancel
            </button>
            {canEdit && (
              <button
                className="btn primary"
                type="submit"
                form="meetform"
                disabled={busy}
              >
                {busy ? "Saving…" : meeting ? "Save" : "Schedule"}
              </button>
            )}
          </div>
        </>
      }
    >
      <form className="form" id="meetform" onSubmit={save}>
        {input(
          "title",
          "Title",
          {
            required: true,
            placeholder: "e.g. Payroll requirements with HR team",
            autoFocus: !meeting,
          },
          true
        )}
        <div className="field">
          <label htmlFor="mt_ty">Type</label>
          <AntSelect
            id="mt_ty"
            value={f.type}
            onChange={(e) => set("type", e.target.value)}
            options={MEETING_TYPES.map(([t]) => [t, t])}
          />
        </div>
        <div className="field">
          <label htmlFor="mt_st">Status</label>
          <AntSelect
            id="mt_st"
            value={f.status}
            onChange={(e) => set("status", e.target.value)}
            options={["Planned", "Done", "Cancelled"].map((s) => [s, s])}
          />
        </div>
        <div className="field">
          <label htmlFor="mt_d">Date</label>
          <AntDatePicker
            id="mt_d"
            value={f.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>
        <div className="field">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="field">
              <label htmlFor="mt_s">Start</label>
              <AntTimePicker
                id="mt_s"
                value={f.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="mt_e">End</label>
              <AntTimePicker
                id="mt_e"
                value={f.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="mt_mo">Where</label>
          <AntSelect
            id="mt_mo"
            value={f.mode}
            onChange={(e) => set("mode", e.target.value)}
            options={MODES.map((m) => [m, m])}
          />
        </div>
        {input("location", "Room or meeting link")}
        <div className="field">
          <label htmlFor="mt_p">System</label>
          <AntSelect
            id="mt_p"
            value={f.projectId}
            onChange={(e) => set("projectId", e.target.value)}
            empty="—"
            options={projects.map((x) => [x.id, x.name])}
          />
        </div>
        <div className="field">
          <label htmlFor="mt_c">Company</label>
          <AntSelect
            id="mt_c"
            value={f.companyId}
            onChange={(e) => set("companyId", e.target.value)}
            empty="—"
            options={companies.map((x) => [x.id, x.name])}
          />
        </div>
        {input("organizer", "Organizer")}
        <div className="field">
          <label htmlFor="mt_r">Remind attendees</label>
          <AntSelect
            id="mt_r"
            value={String(f.remindMinutes)}
            onChange={(e) => set("remindMinutes", Number(e.target.value))}
            options={[
              ["0", "No reminder"],
              ["15", "15 min before"],
              ["30", "30 min before"],
              ["60", "1 hour before"],
              ["1440", "1 day before"],
            ]}
          />
        </div>
        <div className="field full">
          <label>Developers</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {developers.map((d) => (
              <label
                key={d.id}
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  cursor: "pointer",
                  color: "var(--fg)",
                  font: "inherit",
                }}
              >
                <AntCheckbox
                  checked={f.developerIds.includes(d.id)}
                  onChange={(e) =>
                    set(
                      "developerIds",
                      e.target.checked
                        ? [...f.developerIds, d.id]
                        : f.developerIds.filter((x) => x !== d.id)
                    )
                  }
                >
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
              <AntInput
                id="mt_uq"
                type="search"
                placeholder="Filter…"
                value={uq}
                onChange={(e) => setUq(e.target.value)}
              />
              <div
                style={{
                  maxHeight: 150,
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {recs.map((r) => (
                  <label
                    key={r.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--fg)",
                    }}
                  >
                    <AntCheckbox
                      checked={f.inviteeRecordIds.includes(r.id)}
                      onChange={(e) =>
                        set(
                          "inviteeRecordIds",
                          e.target.checked
                            ? [...f.inviteeRecordIds, r.id]
                            : f.inviteeRecordIds.filter((x) => x !== r.id)
                        )
                      }
                    >
                      {r.name} <span className="muted">{r.sub}</span>
                    </AntCheckbox>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              No one in the Users &amp; access register yet. Add guests below.
            </span>
          )}
        </div>
        <div className="field full">
          <label htmlFor="mt_g">
            Other guests (emails or WhatsApp numbers, comma separated)
          </label>
          <AntInput
            id="mt_g"
            value={f.guests}
            placeholder="name@company.com, +9665…"
            onChange={(e) => set("guests", e.target.value)}
          />
        </div>
        <div className="field full">
          <label htmlFor="mt_a">Agenda</label>
          <AntTextArea
            id="mt_a"
            rows={3}
            value={f.agenda}
            onChange={(e) => set("agenda", e.target.value)}
          />
        </div>
        <div className="field full">
          <label htmlFor="mt_mn">Minutes, decisions and action items</label>
          <AntTextArea
            id="mt_mn"
            rows={4}
            placeholder="Start action items with - to turn them into tasks."
            value={f.minutes}
            onChange={(e) => set("minutes", e.target.value)}
          />
        </div>
        {error && (
          <p
            className="field full"
            role="alert"
            style={{ color: "var(--bad)", margin: 0 }}
          >
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}
