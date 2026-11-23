"use server";
// Actions shared by several pages: share / hand over work, availability, time log, attachments,
// data-health bulk fixes, bulk deletes and settings.
import { revalidatePath } from "next/cache";
import { Prisma, Priority } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage, isAdmin } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { toDay, today } from "@/lib/dates";
import { SIZE_HOURS, filesOf, type FileRef } from "@/lib/work";
import { LIST_DEFAULTS, TEMPLATE_DEFAULTS } from "@/lib/settings-defaults";

const done = () => revalidatePath("/", "layout");
type Tx = Prisma.TransactionClient;

async function setTaskDevs(tx: Tx, taskId: string, ids: string[]) {
  await tx.taskAssignee.deleteMany({ where: { taskId } });
  await tx.taskAssignee.createMany({ data: [...new Set(ids)].map((developerId, position) => ({ taskId, developerId, position })) });
}
async function setIssueDevs(tx: Tx, issueId: string, ids: string[]) {
  await tx.issueAssignee.deleteMany({ where: { issueId } });
  await tx.issueAssignee.createMany({ data: [...new Set(ids)].map((developerId, position) => ({ issueId, developerId, position })) });
}
const names = async (tx: Tx, ids: string[]) => (await tx.developer.findMany({ where: { id: { in: ids } }, select: { name: true } })).map(d => d.name).join(", ");

// ------------------------------------------------------------------ share / hand over

/** Add collaborators to a task or issue, or hand it over to them. */
export async function shareWork(kind: "task" | "issue", id: string, mode: "add" | "handover", toIds: string[], note: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't change assignments.");
  if (!toIds.length) return fail("Pick at least one developer.");
  await db.$transaction(async tx => {
    const cur = kind === "task"
      ? (await tx.taskAssignee.findMany({ where: { taskId: id }, orderBy: { position: "asc" } })).map(a => a.developerId)
      : (await tx.issueAssignee.findMany({ where: { issueId: id }, orderBy: { position: "asc" } })).map(a => a.developerId);
    const next = mode === "add" ? [...cur, ...toIds] : toIds;
    const msg = `${mode === "add" ? "Shared with" : "Handed over to"} ${await names(tx, toIds)}${note ? ": " + note : ""}`;
    if (kind === "task") {
      await setTaskDevs(tx, id, next);
      await tx.taskEvent.create({ data: { taskId: id, kind: "share", message: msg, data: { mode, from: cur, to: toIds, note, by: viewer.id } } });
    } else {
      await setIssueDevs(tx, id, next);
      await tx.issueEvent.create({ data: { issueId: id, message: msg } });
    }
    await audit(tx, viewer, "update", kind, id, msg);
  });
  done();
  return { ok: true };
}

/** Leave cover: move (or share) a developer's open work to someone else. */
export async function handOver(fromId: string, toId: string, scope: "active" | "all" | "issues", mode: "add" | "handover", note: string): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can hand over work.");
  if (!toId || toId === fromId) return fail("Pick who takes it over.");
  const count = await db.$transaction(async tx => {
    const tasks = scope === "issues" ? [] : await tx.task.findMany({
      where: { assignees: { some: { developerId: fromId } }, status: scope === "all" ? { not: "done" } : { in: ["progress", "qa", "uat", "hold"] } },
      include: { assignees: { orderBy: { position: "asc" } } },
    });
    const issues = await tx.issue.findMany({ where: { assignees: { some: { developerId: fromId } }, status: { notIn: ["resolved", "closed"] } }, include: { assignees: { orderBy: { position: "asc" } } } });
    const nx = (cur: string[]) => (mode === "add" ? [...cur, toId] : [...cur.filter(x => x !== fromId), toId]);
    const from = await names(tx, [fromId]), to = await names(tx, [toId]);
    const msg = `${mode === "add" ? "Shared" : "Handed over"} from ${from} to ${to}${note ? ": " + note : ""}`;
    for (const t of tasks) {
      await setTaskDevs(tx, t.id, nx(t.assignees.map(a => a.developerId)));
      await tx.taskEvent.create({ data: { taskId: t.id, kind: "share", message: msg } });
    }
    for (const x of issues) {
      await setIssueDevs(tx, x.id, nx(x.assignees.map(a => a.developerId)));
      await tx.issueEvent.create({ data: { issueId: x.id, message: msg } });
    }
    await audit(tx, viewer, "note", "developer", fromId, `${msg} (${tasks.length + issues.length} records)`);
    return tasks.length + issues.length;
  });
  done();
  return { ok: true, data: { count } };
}

export async function setAvailability(developerId: string, availability: "Available" | "On leave"): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can change availability.");
  await db.developer.update({ where: { id: developerId }, data: { availability } });
  done();
  return { ok: true };
}

// ------------------------------------------------------------------ time log

export async function logTime(taskId: string, date: string, hours: number, note: string, developerId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't log time.");
  if (!(hours > 0 && hours <= 24)) return fail("Enter hours between 0 and 24.");
  const d = toDay(date) ?? toDay(today());
  await db.$transaction(async tx => {
    await tx.timeEntry.create({ data: { taskId, date: d!, hours, note: note.trim().slice(0, 500), developerId: developerId || viewer.developerId || null } });
    await audit(tx, viewer, "update", "task", taskId, `Logged ${hours} h`);
  });
  done();
  return { ok: true };
}

export async function deleteTime(entryId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can remove time entries.");
  await db.timeEntry.deleteMany({ where: { id: entryId } });
  done();
  return { ok: true };
}

// ------------------------------------------------------------------ attachments (files live in Asset; records keep a list)

const fileList = z.array(z.object({ id: z.string().max(60), name: z.string().max(300), type: z.string().max(120), size: z.number().int().min(0), t: z.string().optional(), by: z.string().optional() })).max(100);

/** Replaces the file list of a task, issue or manual (after an upload or a removal). */
export async function setFiles(kind: "task" | "issue" | "manual", id: string, files: FileRef[]): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't attach files.");
  const p = fileList.safeParse(files);
  if (!p.success) return fail("That file list isn't valid.");
  const before = filesOf(
    kind === "task" ? (await db.task.findUnique({ where: { id }, select: { files: true } }))?.files
      : kind === "issue" ? (await db.issue.findUnique({ where: { id }, select: { files: true } }))?.files
      : (await db.manual.findUnique({ where: { id }, select: { files: true } }))?.files,
  );
  const removed = before.filter(f => !p.data.some(n => n.id === f.id)).map(f => f.id);
  await db.$transaction(async tx => {
    if (kind === "task") await tx.task.update({ where: { id }, data: { files: p.data } });
    else if (kind === "issue") await tx.issue.update({ where: { id }, data: { files: p.data } });
    else await tx.manual.update({ where: { id }, data: { files: p.data } });
    if (removed.length) await tx.asset.deleteMany({ where: { id: { in: removed } } });
    await audit(tx, viewer, "update", kind, id, `Files: ${p.data.length}`);
  });
  done();
  return { ok: true };
}

// ------------------------------------------------------------------ data health bulk fixes

export type BulkFixField = "due" | "priority" | "progress" | "lead" | "assignee" | "status" | "subModule" | "size" | "completed";

export async function bulkFix(field: BulkFixField, taskIds: string[], value: string): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can fix items in bulk.");
  if (value === "" && field !== "progress") return fail("Choose a value.");
  const tasks = await db.task.findMany({ where: { id: { in: taskIds } }, include: { assignees: { orderBy: { position: "asc" } } } });
  await db.$transaction(async tx => {
    for (const t of tasks) {
      const devs = t.assignees.map(a => a.developerId);
      let data: Prisma.TaskUpdateInput = {};
      switch (field) {
        case "due": data = { dueDate: toDay(value) }; break;
        case "priority": data = { priority: value as Priority }; break;
        case "progress": data = { progress: Math.max(0, Math.min(100, Number(value) || 0)) }; break;
        case "lead": data = { lead: value === "_first" ? devs[0] ?? "" : devs.includes(value) ? value : devs[0] ?? "" }; break;
        case "assignee": await setTaskDevs(tx, t.id, [value]); break;
        case "status":
          if (value === "progress") { data = { status: "progress" }; await tx.taskEvent.create({ data: { taskId: t.id, kind: "status", fromStatus: t.status, toStatus: "progress", message: "Bulk fix" } }); }
          else data = { reqStatus: "Pending" };
          break;
        case "subModule": data = { subModule: value }; break;
        case "size": data = { size: value, estHours: SIZE_HOURS[value] ?? null }; break;
        case "completed": data = { completedDate: value === "_today" ? toDay(today()) : new Date(t.createdAt.toISOString().slice(0, 10)) }; break;
      }
      if (Object.keys(data).length) await tx.task.update({ where: { id: t.id }, data });
    }
    await audit(tx, viewer, "note", "task", "", `Bulk fix ${field} on ${tasks.length} items`);
  }, { timeout: 120_000 });
  done();
  return { ok: true, data: { count: tasks.length } };
}

/** Admin panel → Data: delete every task from one imported file, or one project's tasks. */
export async function deleteTasksWhere(by: "source" | "project", value: string, confirm: string): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) return fail("Only admins can delete in bulk.");
  if (confirm !== "DELETE") return fail("Type DELETE to confirm.");
  const where: Prisma.TaskWhereInput = by === "source" ? { source: value } : { projectId: value };
  const count = await db.$transaction(async tx => {
    const n = (await tx.task.deleteMany({ where })).count;
    await audit(tx, viewer, "delete", "task", "", `Bulk delete ${by} "${value}": ${n} items`);
    return n;
  });
  done();
  return { ok: true, data: { count } };
}

// ------------------------------------------------------------------ settings

const notifyInput = z.object({
  managerName: z.string().max(100), managerEmail: z.string().max(200), managerWa: z.string().max(40), link: z.string().max(300),
  dailyTime: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)), dailyOn: z.boolean(), overdueOn: z.boolean(),
  sla: z.object({ Urgent: z.number().positive(), High: z.number().positive(), Normal: z.number().positive() }),
  approvalPriorities: z.array(z.enum(["Urgent", "High", "Normal"])), approveDevTasks: z.boolean(),
  templates: z.record(z.string(), z.object({ subject: z.string().max(300), body: z.string().max(4000) })),
});
export type NotifyInput = z.input<typeof notifyInput>;

export async function saveNotifySettings(raw: NotifyInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) return fail("Only admins can change settings.");
  const p = notifyInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const f = p.data;
  // stored with the old app's field names
  const value = {
    managerName: f.managerName, managerEmail: f.managerEmail, managerWa: f.managerWa, link: f.link, dailyTime: f.dailyTime, days: f.days,
    dailyOn: f.dailyOn, overdueOn: f.overdueOn, slaUrgent: f.sla.Urgent, slaHigh: f.sla.High, slaNormal: f.sla.Normal,
    apIss: f.approvalPriorities, apDevTasks: f.approveDevTasks,
    tpl: Object.fromEntries(Object.keys(TEMPLATE_DEFAULTS).map(k => [k, f.templates[k] ?? TEMPLATE_DEFAULTS[k as keyof typeof TEMPLATE_DEFAULTS]])),
  };
  await db.$transaction(async tx => {
    await tx.setting.upsert({ where: { key: "notify" }, update: { value }, create: { key: "notify", value } });
    await audit(tx, viewer, "update", "settings", "notify", "Notification settings");
  });
  done();
  return { ok: true };
}

export async function saveLists(lists: Record<string, string[]>): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) return fail("Only admins can change lists.");
  const value: Record<string, string[]> = {};
  for (const k of Object.keys(LIST_DEFAULTS)) value[k] = [...new Set((lists[k] ?? []).map(s => s.trim()).filter(Boolean))].slice(0, 300);
  await db.$transaction(async tx => {
    await tx.setting.upsert({ where: { key: "lists" }, update: { value }, create: { key: "lists", value } });
    await audit(tx, viewer, "update", "settings", "lists", "Lists");
  });
  done();
  return { ok: true };
}

export async function saveDeveloperContact(id: string, field: "email" | "whatsapp", value: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can change contacts.");
  await db.developer.update({ where: { id }, data: { [field]: value.trim().slice(0, 200) } });
  done();
  return { ok: true };
}
