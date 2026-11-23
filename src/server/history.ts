import "server-only";
import type { Prisma, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dayStr } from "@/lib/dates";

// Day-by-day history of tasks, from their status-change events. Used by the Home page, the
// Eram HCM board and Reports.

const taskSelect = {
  id: true, sno: true, title: true, projectId: true, subModule: true, status: true, progress: true, priority: true, dueDate: true, completedDate: true,
  createdAt: true, source: true, notes: true, companyId: true, estHours: true, type: true, testStatus: true, acceptStatus: true, reqStatus: true,
  project: { select: { name: true, code: true } },
  assignees: { orderBy: { position: "asc" as const }, select: { developerId: true, developer: { select: { name: true } } } },
  events: { where: { kind: "status" }, orderBy: { at: "asc" as const }, select: { at: true, fromStatus: true, toStatus: true } },
} satisfies Prisma.TaskSelect;

export type HistTask = Prisma.TaskGetPayload<{ select: typeof taskSelect }> & {
  /** YYYY-MM-DD it was created / completed ("" when unknown) */
  created: string;
  doneOn: string;
  /** status changes by day: [{ d, from, to }] */
  moves: { d: string; from: string | null; to: string }[];
  devIds: string[];
  devNames: string;
  ref: string;
};

export async function historyTasks(where: Prisma.TaskWhereInput = {}): Promise<HistTask[]> {
  const rows = await db.task.findMany({ where, select: taskSelect, orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }] });
  return rows.map(t => {
    const moves = t.events.filter(e => e.toStatus).map(e => ({ d: e.at.toISOString().slice(0, 10), from: e.fromStatus, to: e.toStatus! }));
    const lastDone = [...moves].reverse().find(m => m.to === "done")?.d ?? "";
    return {
      ...t,
      created: t.createdAt.toISOString().slice(0, 10),
      doneOn: dayStr(t.completedDate) || (t.status === "done" ? lastDone : ""),
      moves,
      devIds: t.assignees.map(a => a.developerId),
      devNames: t.assignees.map(a => a.developer.name).join(", "),
      ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`,
    };
  });
}

/** Created on this day by hand (imported rows don't count as "new"). */
export const isNewOn = (t: HistTask, D: string) => !t.source && t.created === D;
/** Still open at the end of day D. */
export const openAtEnd = (t: HistTask, D: string) => {
  if (t.created > D) return false;
  if (t.status === "done") return !!t.doneOn && t.doneOn > D;
  return true;
};
export const movedOn = (t: HistTask, D: string) => t.moves.filter(m => m.d === D);
export const ACTIVE: TaskStatus[] = ["progress", "qa", "uat"];
