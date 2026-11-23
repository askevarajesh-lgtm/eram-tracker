"use server";
// Approvals for tasks raised by developers and for change requests (issues: see issues.ts → decideIssue).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { lockSno, nextSno } from "@/lib/sno";
import { toDay, today } from "@/lib/dates";
import { SIZE_HOURS } from "@/lib/work";
import type { Priority } from "@prisma/client";

const done = () => revalidatePath("/", "layout");

/** Approve (optionally assigning developers) or reject a task. A rejected task goes on hold with the reason in its notes. */
export async function decideTask(id: string, decision: "approved" | "rejected", note: string, assignIds?: string[]): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and project managers can approve tasks.");
  if (decision === "rejected" && !note.trim()) return fail("Give a reason for rejecting.");
  const t = await db.task.findUnique({ where: { id } });
  if (!t) return fail("This task no longer exists.");
  await db.$transaction(async tx => {
    if (assignIds?.length) {
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskAssignee.createMany({ data: [...new Set(assignIds)].map((developerId, position) => ({ taskId: id, developerId, position })) });
    }
    await tx.task.update({
      where: { id },
      data: {
        approvalState: decision, approvalBy: viewer.name, approvalAt: new Date(), approvalNote: note.trim() || null,
        ...(decision === "rejected" ? { status: "hold", notes: [t.notes, `Not approved ${today()}: ${note.trim()}`].filter(Boolean).join("\n") } : {}),
      },
    });
    if (decision === "rejected" && t.status !== "hold") await tx.taskEvent.create({ data: { taskId: id, kind: "status", fromStatus: t.status, toStatus: "hold", message: "Not approved" } });
    await audit(tx, viewer, "update", "task", id, `${decision}: ${t.title}`);
  });
  done();
  return { ok: true };
}

/** Approve or reject a change request; approving can create the development task straight away. */
export async function decideChange(id: string, decision: "approved" | "rejected", note: string, createTask: boolean): Promise<ActionResult<{ taskSno?: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and project managers can decide change requests.");
  if (decision === "rejected" && !note.trim()) return fail("Give a reason for rejecting.");
  const c = await db.changeRequest.findUnique({ where: { id } });
  if (!c) return fail("This change request no longer exists.");
  const sno = await db.$transaction(async tx => {
    let taskId = c.taskId, taskSno: number | undefined;
    if (decision === "approved" && createTask && !taskId) {
      await lockSno(tx);
      const prio = (["Critical", "High", "Medium", "Low"] as Priority[]).includes(c.priority as Priority) ? (c.priority as Priority) : null;
      const t = await tx.task.create({
        data: {
          sno: await nextSno(tx, c.projectId), title: c.title, projectId: c.projectId, subModule: c.subModule, type: "Enhancement", reqStatus: "Open", status: "pending",
          companyId: c.companyId, endUsers: c.requestedBy, priority: prio, size: c.effort, estHours: SIZE_HOURS[c.effort] ?? null, description: c.description,
          notes: `From change request ${c.id}`, startDate: toDay(today()), approvalState: "approved", approvalBy: viewer.name, approvalAt: new Date(),
          events: { create: { kind: "status", toStatus: "pending", message: `Created from change request ${c.id}` } },
        },
      });
      taskId = t.id; taskSno = t.sno;
    }
    await tx.changeRequest.update({
      where: { id },
      data: { status: decision === "approved" ? (taskId ? "Converted" : "Approved") : "Rejected", decisionBy: viewer.name, decisionNote: note.trim() || null, decidedAt: new Date(), taskId, approvalState: decision },
    });
    await audit(tx, viewer, "update", "change", id, `${decision}: ${c.title}`);
    return taskSno;
  });
  done();
  return { ok: true, data: { taskSno: sno } };
}
