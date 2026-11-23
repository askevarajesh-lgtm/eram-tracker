import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { dayStr, today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { getNotifySettings } from "@/lib/settings";
import { CalendarView, type CalEvent, type MeetingDTO } from "./_components/CalendarView";

export const metadata: Metadata = { title: "Calendar" };

type Search = { m?: string; v?: string; d?: string; f?: string; edit?: string; new?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const T = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : T.slice(0, 7);
  const view = sp.v === "agenda" ? "agenda" : "month";
  const show = new Set((sp.f ?? "meet,due,rem,live").split(",").filter(Boolean));
  // the month grid starts on the Sunday before the 1st and shows 6 weeks
  const first = new Date(month + "-01T00:00:00Z");
  const gridStart = addDays(month + "-01", -first.getUTCDay());
  const from = view === "month" ? gridStart : addDays(T, -30);
  const to = view === "month" ? addDays(gridStart, 41) : addDays(T, 60);
  const range = { gte: new Date(from), lte: new Date(to) };

  const [meetings, tasks, reminders, rollouts, developers, records, projects, companies, cfg] = await Promise.all([
    db.meeting.findMany({ where: { date: range }, orderBy: [{ date: "asc" }, { startTime: "asc" }], include: { developers: true } }),
    show.has("due") ? db.task.findMany({ where: { status: { not: "done" }, dueDate: range }, select: { id: true, title: true, dueDate: true } }) : [],
    show.has("rem") ? db.reminder.findMany({ where: { done: false, date: range }, select: { id: true, title: true, date: true, time: true } }) : [],
    show.has("live") ? db.rollout.findMany({ where: { OR: [{ targetDate: range }, { actualDate: range }] }, include: { company: { select: { name: true } }, project: { select: { name: true } } } }) : [],
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, whatsapp: true } }),
    // Users & access register: business users who can be invited (they don't sign in)
    db.accessRecord.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, dept: true, company: { select: { name: true } } } }),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.company.findMany({ where: { holding: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    getNotifySettings(),
  ]);

  const meetingDTOs: MeetingDTO[] = meetings.map(m => ({
    id: m.id, title: m.title, type: m.type, status: m.status, date: dayStr(m.date), startTime: m.startTime, endTime: m.endTime, mode: m.mode, location: m.location,
    projectId: m.projectId ?? "", companyId: m.companyId ?? "", organizer: m.organizer, remindMinutes: m.remindMinutes ?? 0, developerIds: m.developers.map(d => d.developerId),
    inviteeRecordIds: m.inviteeRecordIds, guests: m.guests, agenda: m.agenda, minutes: m.minutes,
  }));
  // a meeting opened by link may be outside the visible range
  if (sp.edit && !meetingDTOs.some(m => m.id === sp.edit)) {
    const m = await db.meeting.findUnique({ where: { id: sp.edit }, include: { developers: true } });
    if (m) meetingDTOs.push({
      id: m.id, title: m.title, type: m.type, status: m.status, date: dayStr(m.date), startTime: m.startTime, endTime: m.endTime, mode: m.mode, location: m.location,
      projectId: m.projectId ?? "", companyId: m.companyId ?? "", organizer: m.organizer, remindMinutes: m.remindMinutes ?? 0, developerIds: m.developers.map(d => d.developerId),
      inviteeRecordIds: m.inviteeRecordIds, guests: m.guests, agenda: m.agenda, minutes: m.minutes,
    });
  }

  const events: CalEvent[] = [
    ...(show.has("meet") ? meetingDTOs.filter(m => m.date >= from && m.date <= to).map(m => ({ kind: "meet" as const, id: m.id, date: m.date, time: m.startTime, title: m.title, meetingType: m.type, status: m.status })) : []),
    ...tasks.map(t => ({ kind: "due" as const, id: t.id, date: dayStr(t.dueDate), time: "", title: "Due: " + t.title })),
    ...reminders.map(r => ({ kind: "rem" as const, id: r.id, date: dayStr(r.date), time: r.time, title: r.title })),
    ...rollouts.map(r => {
      const live = r.status === "live";
      return { kind: "live" as const, id: `${r.companyId}|${r.projectId}`, date: dayStr(live ? r.actualDate : r.targetDate), time: "", title: `${live ? "Go-live" : "Target"}: ${r.project.name} · ${r.company.name}` };
    }).filter(e => e.date >= from && e.date <= to),
  ].sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));

  return (
    <CalendarView
      month={month} view={view} selected={sp.d ?? T} show={[...show]} gridStart={gridStart} events={events} meetings={meetingDTOs}
      developers={developers} records={records.map(r => ({ id: r.id, name: r.name, email: r.email, sub: [r.dept, r.company?.name].filter(Boolean).join(" · ") }))}
      projects={projects} companies={companies} organizer={cfg.managerName}
      canEdit={canEdit(viewer)} canManage={canManage(viewer)} openId={sp.edit} openNew={sp.new === "1"}
    />
  );
}
