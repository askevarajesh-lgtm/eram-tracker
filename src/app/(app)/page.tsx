import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { getNotifySettings } from "@/lib/settings";
import { dayStr, today } from "@/lib/dates";
import { addDays, averageProgress } from "@/lib/work";
import { OPEN_STATUSES } from "@/lib/issues";
import { historyTasks, movedOn, ACTIVE } from "@/server/history";
import { remindersData } from "@/server/reminders-data";
import { HomeView, type HomeData } from "./_components/HomeView";

export const metadata: Metadata = { title: "Development stats" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const T = today();
  const D = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") && sp.d! <= T ? sp.d! : T;
  const W = Array.from({ length: 7 }, (_, x) => addDays(D, x - 6));
  const manage = canManage(viewer);
  const [tasks, projects, developers, standups, meetings, issues, cfg, rem, pendingApprovals] = await Promise.all([
    historyTasks(),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.developer.findMany({ orderBy: { name: "asc" } }),
    db.standup.findMany({ where: { date: { gte: new Date(W[0]), lte: new Date(D) } } }),
    db.meeting.findMany({ where: { date: new Date(D), status: { not: "Cancelled" } }, orderBy: { startTime: "asc" }, include: { _count: { select: { developers: true } } } }),
    db.issue.findMany({ where: { status: { in: OPEN_STATUSES } }, include: { assignees: { orderBy: { position: "asc" }, include: { developer: { select: { name: true } } } } } }),
    getNotifySettings(),
    manage && D === T ? remindersData() : null,
    manage ? Promise.all([
      db.issue.count({ where: { approvalState: "pending", status: { in: OPEN_STATUSES } } }),
      db.task.count({ where: { approvalState: "pending" } }),
      db.changeRequest.count({ where: { status: { in: ["Submitted", "Under review"] } } }),
    ]).then(a => a.reduce((x, y) => x + y, 0)) : 0,
  ]);

  const open = tasks.filter(t => t.status !== "done");
  const slaLate = (x: (typeof issues)[number]) => x.createdAt.getTime() + (cfg.sla[x.priority as keyof typeof cfg.sla] ?? 72) * 3600e3 < Date.now();
  const su = (dev: string, d: string) => standups.find(s => s.developerId === dev && dayStr(s.date) === d);

  const data: HomeData = {
    D, isToday: D === T, W,
    kpis: {
      urgent: issues.filter(x => x.priority === "Urgent").length, progress: averageProgress(tasks), developed: tasks.filter(t => t.status === "done").length,
      accepted: tasks.filter(t => t.acceptStatus === "Accepted").length, active: open.filter(t => ACTIVE.includes(t.status)).length,
      notStarted: open.filter(t => t.status === "pending").length, overdue: open.filter(t => t.dueDate && dayStr(t.dueDate) < D).length,
      hold: open.filter(t => t.status === "hold").length, doneToday: tasks.filter(t => t.doneOn === D).length,
      updates: developers.filter(d => su(d.id, D)).length, developers: developers.length,
    },
    meetings: meetings.map(m => ({ id: m.id, title: m.title, type: m.type, startTime: m.startTime, endTime: m.endTime, mode: m.mode, location: m.location, status: m.status, attendees: m._count.developers + m.inviteeRecordIds.length })),
    urgentIssues: issues.filter(x => x.priority === "Urgent" || slaLate(x)).slice(0, 6).map(x => ({ id: x.id, title: x.title, status: x.status, priority: x.priority, createdAt: x.createdAt.toISOString(), devs: x.assignees.map(a => a.developer.name).join(", ") })),
    sla: cfg.sla,
    projects: projects.map(p => {
      const L = tasks.filter(t => t.projectId === p.id);
      const o = L.filter(t => t.status !== "done");
      return { id: p.id, name: p.name, statuses: L.map(t => t.status), pct: averageProgress(L), total: L.length, done: L.length - o.length, active: o.filter(t => ACTIVE.includes(t.status)).length, open: o.filter(t => t.status === "pending").length, overdue: o.filter(t => t.dueDate && dayStr(t.dueDate) < D).length, moved: L.filter(t => movedOn(t, D).length).length };
    }),
    developers: developers.map(d => {
      const L = tasks.filter(t => t.devIds.includes(d.id));
      const o = L.filter(t => t.status !== "done");
      const a = o.filter(t => ACTIVE.includes(t.status));
      const s = su(d.id, D);
      const lastMove = L.flatMap(t => t.moves.map(m => m.d)).sort().pop() ?? "";
      return {
        id: d.id, name: d.name, title: d.title, statuses: L.map(t => t.status), total: L.length, active: a.length, open: o.filter(t => t.status === "pending").length,
        overdue: o.filter(t => t.dueDate && dayStr(t.dueDate) < D).length, doneWeek: L.filter(t => t.doneOn && t.doneOn >= W[0] && t.doneOn <= D).length,
        moved: L.filter(t => movedOn(t, D).length).length, doneToday: L.filter(t => t.doneOn === D).length,
        issues: issues.filter(x => x.assignees.some(z => z.developerId === d.id)).length, lastMove,
        standup: s ? { done: s.done, plan: s.plan, blockers: s.blockers, hours: s.hours == null ? "" : String(s.hours) } : null,
        working: a.slice(0, 4).map(t => ({ id: t.id, title: t.title, status: t.status, project: t.project?.name ?? "", progress: t.progress ?? 0 })), workingMore: Math.max(0, a.length - 4),
        week: W.map(x => L.filter(t => movedOn(t, x).length).length), weekUpdates: W.filter(x => su(d.id, x)).length,
        movedTodayTitles: L.filter(t => movedOn(t, D).length).map(t => t.title),
        mine: viewer.developerId === d.id,
      };
    }),
    feed: tasks.flatMap(t => movedOn(t, D).map(m => ({ id: t.id, title: t.title, from: m.from, to: m.to, devs: t.devNames, project: t.project?.name ?? "" }))).slice(-30).reverse(),
    attention: open.filter(t => (t.dueDate && dayStr(t.dueDate) <= D) || t.status === "hold").sort((a, b) => (a.dueDate?.getTime() ?? 9e15) - (b.dueDate?.getTime() ?? 9e15)).slice(0, 12)
      .map(t => ({ id: t.id, title: t.title, status: t.status, due: dayStr(t.dueDate), devs: t.devNames, project: t.project?.name ?? "" })),
    reminders: rem ? { list: rem.reminders.filter(r => !r.done), auto: rem.auto } : null,
    pendingApprovals,
  };
  return <HomeView data={data} canManage={manage} viewerDeveloperId={viewer.developerId} />;
}
