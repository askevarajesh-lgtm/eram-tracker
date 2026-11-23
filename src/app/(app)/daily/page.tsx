import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { dayStr, today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { historyTasks, isNewOn, openAtEnd, movedOn, ACTIVE } from "@/server/history";
import { DailyView, type DailyData } from "./_components/DailyView";

export const metadata: Metadata = { title: "Eram HCM board" };

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ d?: string; p?: string; c?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const T = today();
  const D = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") && sp.d! <= T ? sp.d! : T;
  const [projects, companies, rollouts] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.company.findMany({ orderBy: [{ country: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.rollout.findMany(),
  ]);
  const P = sp.p && projects.some(p => p.id === sp.p) ? sp.p : "_all";
  const holding = companies.find(c => c.holding) ?? null;
  const subs = companies.filter(c => !c.holding);
  const CF = subs.find(c => c.id === sp.c) ?? null;
  const all = await historyTasks({ ...(P !== "_all" ? { projectId: P } : {}), ...(CF ? { companyId: CF.id } : {}) });
  const note = await db.dailyNote.findFirst({ where: { projectId: P === "_all" ? null : P, date: new Date(D) } });

  const isToday = D === T;
  const open = isToday ? all.filter(t => t.status !== "done") : all.filter(t => openAtEnd(t, D));
  const order = (a: (typeof all)[number], b: (typeof all)[number]) => ["pending", "progress", "qa", "uat", "done", "hold"].indexOf(a.status) - ["pending", "progress", "qa", "uat", "done", "hold"].indexOf(b.status) || (a.dueDate?.getTime() ?? 9e15) - (b.dueDate?.getTime() ?? 9e15);
  const rows = (L: typeof all) => L.map(t => ({ id: t.id, ref: t.ref, subModule: t.subModule, title: t.title, notes: t.notes, owner: t.devNames, status: t.status, priority: t.priority ?? "", progress: t.status === "done" ? 100 : t.progress ?? 0, due: dayStr(t.dueDate), doneOn: t.doneOn, created: t.created }));
  const dueToday = open.filter(t => dayStr(t.dueDate) === D), over = open.filter(t => t.dueDate && dayStr(t.dueDate) < D);
  const days14 = Array.from({ length: 14 }, (_, x) => addDays(D, x - 13));
  const roToday = rollouts.flatMap(r => (Array.isArray(r.log) ? (r.log as { d: string; from: string; to: string }[]) : []).filter(l => l.d === D).map(l => ({ companyId: r.companyId, projectId: r.projectId, from: l.from, to: l.to, notes: r.notes }))).filter(x => !CF || x.companyId === CF.id);
  const cells = rollouts.filter(r => subs.some(c => c.id === r.companyId));

  const data: DailyData = {
    D, isToday, P, C: CF?.id ?? "",
    projects, companies: subs.map(c => ({ id: c.id, name: c.name, country: c.country, code: c.code, branches: c.branches })), holdingName: holding?.name ?? "",
    rollouts: rollouts.map(r => ({ companyId: r.companyId, projectId: r.projectId, status: r.status || "none", progress: r.progress, startDate: dayStr(r.startDate), targetDate: dayStr(r.targetDate), actualDate: dayStr(r.actualDate), owner: r.owner, branches: r.branches, notes: r.notes, log: Array.isArray(r.log) ? (r.log as { d: string; from: string; to: string }[]) : [] })),
    kpis: {
      live: cells.filter(r => r.status === "live").length, implementing: cells.filter(r => r.status === "progress" || r.status === "uat").length, rolloutToday: roToday.length,
      open: open.length, notStarted: open.filter(t => t.status === "pending").length, inProgress: open.filter(t => ACTIVE.includes(t.status)).length,
      hold: open.filter(t => t.status === "hold").length, newToday: all.filter(t => isNewOn(t, D)).length, doneToday: all.filter(t => t.doneOn === D).length,
      dueToday: dueToday.length, overdue: over.length,
    },
    trend: days14.map(x => ({ d: x, open: all.filter(t => openAtEnd(t, x)).length, done: all.filter(t => t.doneOn === x).length, created: all.filter(t => isNewOn(t, x)).length })),
    note: { done: note?.done ?? "", blockers: note?.blockers ?? "", next: note?.next ?? "", updatedAt: note?.updatedAt.toISOString() ?? "" },
    moved: all.flatMap(t => movedOn(t, D).map(m => ({ id: t.id, title: t.title, from: m.from, to: m.to, owner: t.devNames, subModule: t.subModule }))).slice(-40).reverse(),
    rolloutMoves: roToday,
    lists: {
      due: rows([...dueToday, ...over].sort(order)),
      done: rows(all.filter(t => t.doneOn === D)),
      created: rows(all.filter(t => isNewOn(t, D))),
      open: rows(open.slice().sort(order)),
    },
    total: all.length,
  };
  return <DailyView data={data} canEdit={canEdit(viewer)} canManage={canManage(viewer)} />;
}
