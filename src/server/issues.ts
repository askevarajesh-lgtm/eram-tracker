"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer, type Viewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { getNotifySettings } from "@/lib/settings";
import { lockSno, nextSno } from "@/lib/sno";
import { ISSUE_PRIORITY_KEYS, ISSUE_STATUS_KEYS, ISSUE_STATUS_MAP, isOpenIssue } from "@/lib/issues";

const TOKEN_LOCK = 360362;

type Tx = Prisma.TransactionClient;
type IssueWithAssignees = Prisma.IssueGetPayload<{ include: { assignees: true } }>;

const devIdsOf = (x: IssueWithAssignees) => x.assignees.sort((a, b) => a.position - b.position).map(a => a.developerId);

/** Who may change an issue (same rules as the old app). Anyone signed in may raise one. */
function mayEdit(v: Viewer, existing: IssueWithAssignees | null) {
  if (canManage(v)) return true;
  if (!existing) return true;
  if (v.role !== "Developer" || !v.developerId) return false;
  const devs = devIdsOf(existing);
  return devs.length === 0 || devs.includes(v.developerId);
}

/** TKN-YYMMDD-NNN, numbered per day. Reuses any deleted or missing sequence numbers. */
async function nextToken(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TOKEN_LOCK})`;
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const prefix = `TKN-${d}-`;
  const rows = await tx.issue.findMany({ where: { id: { startsWith: prefix } }, select: { id: true } });
  const used = new Set(
    rows
      .map(r => parseInt(r.id.slice(prefix.length), 10))
      .filter(n => Number.isInteger(n) && n > 0)
  );
  let candidate = 1;
  while (used.has(candidate)) {
    candidate++;
  }
  return prefix + String(candidate).padStart(3, "0");
}

const devName = async (tx: Tx, ids: string[]) =>
  (await tx.developer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }))
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).map(d => d.name).join(", ");

const done = () => revalidatePath("/", "layout");

// ------------------------------------------------------------------ save

const input = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Describe the issue."),
  description: z.string().default(""),
  projectId: z.string().default(""),
  priority: z.enum(ISSUE_PRIORITY_KEYS),
  raisedBy: z.string().trim().default(""),
  contact: z.string().trim().default(""),
  companyId: z.string().default(""),
  status: z.enum(ISSUE_STATUS_KEYS),
  assigneeIds: z.array(z.string()).default([]),
  resolution: z.string().default(""),
});
export type IssueInput = z.input<typeof input>;

export async function saveIssue(raw: IssueInput): Promise<ActionResult<{ id: string; pendingApproval: boolean }>> {
  const viewer = await requireViewer();
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const f = p.data;
  const existing = f.id ? await db.issue.findUnique({ where: { id: f.id }, include: { assignees: true } }) : null;
  if (f.id && !existing) return fail("This issue no longer exists.");
  if (!mayEdit(viewer, existing)) return fail(`Your role (${viewer.role}) can't change this issue.`);

  const cfg = await getNotifySettings();
  const manager = canManage(viewer);
  const devs = [...new Set(f.assigneeIds)];
  const status = f.status === "new" && devs.length ? "assigned" : f.status;

  // approval: urgent/high issues (configurable) need an Admin or Manager before work starts
  let approval: Pick<Prisma.IssueUncheckedCreateInput, "approvalState" | "approvalBy" | "approvalAt" | "approvalNote"> = {};
  const needs = cfg.approvalPriorities.includes(f.priority);
  if (!existing && needs) approval = manager ? { approvalState: "approved", approvalBy: viewer.name, approvalAt: new Date(), approvalNote: "Raised by manager" } : { approvalState: "pending" };
  if (existing && !existing.approvalState && needs && !manager) approval = { approvalState: "pending" };
  const pending = (approval.approvalState ?? existing?.approvalState) === "pending";
  if (pending && !manager && ["progress", "waiting", "resolved"].includes(status)) return fail("This issue is waiting for approval before work starts.");

  const now = new Date();
  const data = {
    title: f.title, description: f.description, projectId: f.projectId || null, priority: f.priority, raisedBy: f.raisedBy, contact: f.contact,
    companyId: f.companyId || null, status, resolution: f.resolution,
    resolvedAt: isOpenIssue(status) ? null : existing?.resolvedAt ?? now,
    ...approval,
  };
  const assignees = { create: devs.map((developerId, position) => ({ developerId, position })) };

  const saved = await db.$transaction(async tx => {
    const events: string[] = [];
    let id: string;
    if (existing) {
      id = existing.id;
      await tx.issue.update({ where: { id }, data: { ...data, assignees: { deleteMany: {}, ...assignees } } });
      if (existing.status !== status) events.push(`${ISSUE_STATUS_MAP[existing.status]?.label ?? existing.status} → ${ISSUE_STATUS_MAP[status].label}`);
      if (devIdsOf(existing).join() !== devs.join()) events.push(`Assigned to ${(await devName(tx, devs)) || "nobody"}`);
    } else {
      id = await nextToken(tx);
      await tx.issue.create({ data: { ...data, id, raisedById: viewer.id, assignees } });
      events.push(`Raised (${f.priority})`);
    }
    if (events.length) await tx.issueEvent.createMany({ data: events.map(message => ({ issueId: id, message })) });
    await audit(tx, viewer, existing ? "update" : "create", "issue", id, f.title);
    return id;
  });
  done();
  return { ok: true, data: { id: saved, pendingApproval: pending } };
}

// ------------------------------------------------------------------ quick actions

/** A developer takes an unassigned issue. */
export async function takeIssue(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!viewer.developerId) return fail("Your account isn't linked to a developer.");
  const x = await db.issue.findUnique({ where: { id }, include: { assignees: true } });
  if (!x) return fail("This issue no longer exists.");
  if (x.assignees.length && !canManage(viewer)) return fail("Someone already has this issue.");
  const pending = x.approvalState === "pending";
  const me = viewer.developerId;
  await db.$transaction(async tx => {
    await tx.issue.update({ where: { id }, data: { status: pending ? "assigned" : "progress", assignees: { deleteMany: {}, create: [{ developerId: me, position: 0 }] } } });
    await tx.issueEvent.create({ data: { issueId: id, message: `Taken by ${await devName(tx, [me])}` } });
    await audit(tx, viewer, "update", "issue", id, `Took ${id}`);
  });
  done();
  return { ok: true };
}

export async function resolveIssue(id: string, resolution: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const note = resolution.trim();
  if (!note) return fail("Write what was done.");
  const x = await db.issue.findUnique({ where: { id }, include: { assignees: true } });
  if (!x) return fail("This issue no longer exists.");
  const mine = !!viewer.developerId && x.assignees.some(a => a.developerId === viewer.developerId);
  if (!canManage(viewer) && !mine) return fail("Only the assigned developer or a manager can resolve this issue.");
  if (x.approvalState === "pending" && !canManage(viewer)) return fail("This issue is waiting for approval before work starts.");
  await db.$transaction(async tx => {
    await tx.issue.update({ where: { id }, data: { status: "resolved", resolution: note, resolvedAt: new Date() } });
    await tx.issueEvent.create({ data: { issueId: id, message: "Resolved: " + note.slice(0, 80) } });
    await audit(tx, viewer, "update", "issue", id, `Resolved ${id}`);
  });
  done();
  return { ok: true };
}

/** Approve (optionally assigning developers) or reject an issue. A rejected issue is closed. */
export async function decideIssue(id: string, decision: "approved" | "rejected", note: string, assignIds?: string[]): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and project managers can approve issues.");
  if (decision === "rejected" && !note.trim()) return fail("Give a reason for rejecting.");
  const x = await db.issue.findUnique({ where: { id }, include: { assignees: true } });
  if (!x) return fail("This issue no longer exists.");
  const now = new Date();
  await db.$transaction(async tx => {
    const devs = assignIds?.length ? [...new Set(assignIds)] : x.assignees.sort((a, b) => a.position - b.position).map(a => a.developerId);
    if (assignIds?.length) {
      await tx.issueAssignee.deleteMany({ where: { issueId: id } });
      await tx.issueAssignee.createMany({ data: devs.map((developerId, position) => ({ issueId: id, developerId, position })) });
    }
    await tx.issue.update({
      where: { id },
      data: {
        approvalState: decision, approvalBy: viewer.name, approvalAt: now, approvalNote: note.trim() || null,
        ...(decision === "rejected" ? { status: "closed", resolution: "Rejected: " + note.trim(), resolvedAt: now } : x.status === "new" && devs.length ? { status: "assigned" } : {}),
      },
    });
    await tx.issueEvent.create({ data: { issueId: id, message: `${decision === "approved" ? "Approved" : "Rejected"} by ${viewer.name}${note.trim() ? ": " + note.trim() : ""}` } });
    await audit(tx, viewer, "update", "issue", id, `${decision} ${id}`);
  });
  done();
  return { ok: true };
}

export async function deleteIssue(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and project managers can delete issues.");
  const x = await db.issue.findUnique({ where: { id } });
  if (!x) return { ok: true };
  await db.$transaction(async tx => {
    await tx.issue.delete({ where: { id } });
    await audit(tx, viewer, "delete", "issue", id, x.title);
  });
  done();
  return { ok: true };
}

/** Turns an issue into a development task (Bug fix), linked both ways. */
export async function issueToTask(id: string): Promise<ActionResult<{ taskId: string; sno: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and project managers can convert issues to tasks.");
  const x = await db.issue.findUnique({ where: { id }, include: { assignees: true } });
  if (!x) return fail("This issue no longer exists.");
  if (x.taskId) return fail("A task already exists for this issue.");
  const cfg = await getNotifySettings();
  const due = new Date(x.createdAt.getTime() + (cfg.sla[x.priority as keyof typeof cfg.sla] ?? 72) * 3600e3);
  const devs = devIdsOf(x);
  const t = await db.$transaction(async tx => {
    await lockSno(tx);
    const task = await tx.task.create({
      data: {
        sno: await nextSno(tx, x.projectId), title: `[${x.id}] ${x.title}`, projectId: x.projectId, type: "Bug fix", reqStatus: "Open",
        status: devs.length ? "progress" : "pending", priority: x.priority === "Urgent" ? "Critical" : x.priority === "High" ? "High" : "Medium",
        companyId: x.companyId, endUsers: x.raisedBy, description: x.description, notes: `From urgent issue ${x.id}`,
        startDate: new Date(new Date().toISOString().slice(0, 10)), dueDate: new Date(due.toISOString().slice(0, 10)),
        assignees: { create: devs.map((developerId, position) => ({ developerId, position })) },
        events: { create: { kind: "status", toStatus: devs.length ? "progress" : "pending", message: `Created from issue ${x.id}` } },
      },
    });
    await tx.issue.update({ where: { id }, data: { taskId: task.id } });
    await tx.issueEvent.create({ data: { issueId: id, message: `Converted to development task #${task.sno}` } });
    await audit(tx, viewer, "create", "task", task.id, task.title);
    return task;
  });
  done();
  return { ok: true, data: { taskId: t.id, sno: t.sno } };
}
