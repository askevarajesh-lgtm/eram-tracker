"use server";
// Extra details loaded when a task is opened: files, time log, history, sign-off, and developer load
// (for the share / hand over panel).
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { dayStr } from "@/lib/dates";
import { filesOf, type FileRef } from "@/lib/work";
import { OPEN_STATUSES } from "@/lib/issues";

export type DevLoadLite = { id: string; name: string; availability: string; score: number };
export type TaskExtras = {
  files: FileRef[];
  time: { id: string; date: string; hours: number; developer: string; note: string }[];
  events: { at: string; kind: string; from: string | null; to: string | null; message: string }[];
  signoff: { by?: string; team?: string; d?: string; how?: string; note?: string } | null;
  loads: DevLoadLite[];
};

/** Rough workload per developer: active work counts fully, open items lightly, urgent issues double. */
export async function developerLoads(): Promise<DevLoadLite[]> {
  await requireViewer();
  const [devs, tasks, issues] = await Promise.all([
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, availability: true } }),
    db.taskAssignee.findMany({ where: { task: { status: { not: "done" } } }, select: { developerId: true, task: { select: { status: true } } } }),
    db.issueAssignee.findMany({ where: { issue: { status: { in: OPEN_STATUSES } } }, select: { developerId: true, issue: { select: { priority: true } } } }),
  ]);
  return devs.map(d => {
    const t = tasks.filter(x => x.developerId === d.id), i = issues.filter(x => x.developerId === d.id);
    const score = t.filter(x => ["progress", "qa", "uat"].includes(x.task.status)).length + t.filter(x => x.task.status === "pending").length * 0.3 + i.length + i.filter(x => x.issue.priority === "Urgent").length * 2;
    return { id: d.id, name: d.name, availability: d.availability || "Available", score };
  });
}

export async function taskExtras(id: string): Promise<TaskExtras | null> {
  await requireViewer();
  const t = await db.task.findUnique({
    where: { id },
    select: {
      files: true, signoff: true,
      timeEntries: { orderBy: { date: "desc" }, include: { developer: { select: { name: true } } } },
      events: { orderBy: { at: "desc" }, take: 60 },
    },
  });
  if (!t) return null;
  return {
    files: filesOf(t.files),
    time: t.timeEntries.map(e => ({ id: e.id, date: dayStr(e.date), hours: Number(e.hours), developer: e.developer?.name ?? "", note: e.note })),
    events: t.events.map(e => ({ at: e.at.toISOString(), kind: e.kind, from: e.fromStatus, to: e.toStatus, message: e.message })),
    signoff: t.signoff && typeof t.signoff === "object" ? (t.signoff as TaskExtras["signoff"]) : null,
    loads: await developerLoads(),
  };
}

