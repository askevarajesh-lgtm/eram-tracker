"use server";
import { revalidatePath } from "next/cache";
import { Prisma, Priority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage, canWriteTask } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { lockSno, nextSno } from "@/lib/sno";
import { toDay, today } from "@/lib/dates";

const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""))
  .default("");
const taskInput = z.object({
  id: z.string().optional(),
  sno: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return undefined;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({
          code: "custom",
          message: "S.No must be a whole number from 1.",
        });
        return z.NEVER;
      }
      return n;
    }),
  title: z.string().trim().min(1, "Enter the task details."),
  projectId: z.string().default(""),
  subModule: z.string().trim().default(""),
  type: z.string().trim().default(""),
  reqStatus: z.string().trim().default("Open"),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(Priority).or(z.literal("")).default(""),
  assigneeIds: z.array(z.string()).default([]),
  companyId: z.string().default(""),
  branch: z.string().trim().default(""),
  endUsers: z.string().trim().default(""),
  testStatus: z.string().trim().default(""),
  acceptStatus: z.string().trim().default(""),
  progress: z.coerce.number().int().min(0).max(100).nullable().default(null),
  startDate: optDate,
  dueDate: optDate,
  completedDate: optDate,
  estHours: z.coerce.number().min(0).nullable().default(null),
  size: z.string().default(""),
  version: z.string().trim().default(""),
  lead: z.string().default(""),
  description: z.string().default(""),
  notes: z.string().default(""),
});
export type TaskInput = z.input<typeof taskInput>;

export async function saveTask(
  raw: TaskInput,
): Promise<ActionResult<{ id: string; sno: number }>> {
  const viewer = await requireViewer();
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const f = parsed.data;

  const existing = f.id
    ? await db.task.findUnique({
        where: { id: f.id },
        include: { assignees: true },
      })
    : null;
  if (f.id && !existing)
    return fail("This task no longer exists. It may have been deleted.");
  if (
    !canWriteTask(
      viewer,
      f.assigneeIds,
      existing?.assignees.map((a) => a.developerId),
    )
  )
    return fail(`Your role (${viewer.role}) can't change this task.`);

  const projectId = f.projectId || null;
  const assigneeIds = [...new Set(f.assigneeIds)];
  const becameDone = f.status === "done" && existing?.status !== "done";
  const data = {
    title: f.title,
    projectId,
    subModule: f.subModule,
    type: f.type,
    reqStatus: f.reqStatus,
    status: f.status,
    priority: f.priority || null,
    companyId: f.companyId || null,
    branch: f.branch,
    endUsers: f.endUsers,
    testStatus: f.testStatus,
    acceptStatus: f.acceptStatus,
    progress: f.status === "done" ? 100 : f.progress,
    startDate: toDay(f.startDate),
    dueDate: toDay(f.dueDate),
    completedDate:
      toDay(f.completedDate) ?? (becameDone ? toDay(today()) : null),
    estHours: f.estHours,
    size: f.size,
    version: f.version,
    lead: f.lead,
    description: f.description,
    notes: f.notes,
  };

  try {
    const saved = await db.$transaction(async (tx) => {
      await lockSno(tx);
      // keep the S.No unless it was typed in, or the task moved to another project
      const movedProject = existing && existing.projectId !== projectId;
      const sno =
        f.sno ??
        (existing && !movedProject
          ? existing.sno
          : await nextSno(tx, projectId, existing?.id));
      const assignees = {
        create: assigneeIds.map((developerId, position) => ({
          developerId,
          position,
        })),
      };

      const task = existing
        ? await tx.task.update({
            where: { id: existing.id },
            data: { ...data, sno, assignees: { deleteMany: {}, ...assignees } },
          })
        : await tx.task.create({
            data: {
              ...data,
              sno,
              assignees,
              approvalState: viewer.role === "Developer" ? "pending" : null,
            },
          });

      if (!existing || existing.status !== f.status) {
        await tx.taskEvent.create({
          data: {
            taskId: task.id,
            kind: "status",
            fromStatus: existing?.status ?? null,
            toStatus: f.status,
          },
        });
      }
      await audit(
        tx,
        viewer,
        existing ? "update" : "create",
        "task",
        task.id,
        task.title,
      );
      return task;
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: saved.id, sno: saved.sno } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003")
      return fail(
        "A selected project, company or developer no longer exists. Reload and try again.",
      );
    throw e;
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const t = await db.task.findUnique({
    where: { id },
    include: { assignees: true },
  });
  if (!t) return { ok: true };
  if (!canManage(viewer))
    return fail("Only admins and project managers can delete tasks.");
  await db.$transaction([
    db.task.delete({ where: { id } }),
    db.auditEntry.create({
      data: {
        accountId: viewer.id,
        action: "delete",
        entity: "task",
        entityId: id,
        label: t.title,
      },
    }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Renumber tasks 1..N per project (one project, or all), keeping their current order. */
export async function renumberTasks(
  projectId?: string | null,
): Promise<ActionResult<{ changed: number; total: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer))
    return fail("Only admins and project managers can renumber tasks.");
  const result = await db.$transaction(
    async (tx) => {
      await lockSno(tx);
      const rows = await tx.task.findMany({
        where: projectId === undefined ? {} : { projectId },
        select: { id: true, projectId: true, sno: true },
        orderBy: [
          { projectId: "asc" },
          { sno: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });
      const counters = new Map<string, number>();
      let changed = 0;
      for (const r of rows) {
        const k = r.projectId ?? "";
        const n = (counters.get(k) ?? 0) + 1;
        counters.set(k, n);
        if (r.sno !== n) {
          await tx.task.update({ where: { id: r.id }, data: { sno: n } });
          changed++;
        }
      }
      await audit(
        tx,
        viewer,
        "note",
        "task",
        "",
        `Renumbered task S.No: ${changed} changed`,
      );
      return { changed, total: rows.length };
    },
    { timeout: 60_000 },
  );
  revalidatePath("/", "layout");
  return { ok: true, data: result };
}
