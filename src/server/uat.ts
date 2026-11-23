"use server";
// UAT: business users test developed items, then sign them off or send them back.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { fmtDay, today } from "@/lib/dates";

const signoffInput = z.object({
  by: z.string().trim().min(1, "Who signed it off?"),
  team: z.string().trim().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  how: z.string().trim().default("Email confirmation"),
  note: z.string().trim().default(""),
});
export type SignoffInput = z.input<typeof signoffInput>;

export async function recordSignoff(taskIds: string[], raw: SignoffInput): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can record sign-off.");
  const p = signoffInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const s = p.data;
  const signoff = { by: s.by, team: s.team, d: s.date || today(), how: s.how, note: s.note };
  const n = await db.$transaction(async tx => {
    const r = await tx.task.updateMany({ where: { id: { in: taskIds } }, data: { testStatus: "Completed", acceptStatus: "Accepted", signoff } });
    await audit(tx, viewer, "note", "task", "", `UAT sign-off for ${r.count} items by ${s.by}`);
    return r.count;
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { count: n } };
}

/** Business users found problems: the items go back to development. */
export async function sendBack(taskIds: string[], by: string, note: string): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can send items back.");
  if (!by.trim()) return fail("Who raised it?");
  if (!note.trim()) return fail("Describe what needs to change.");
  const tasks = await db.task.findMany({ where: { id: { in: taskIds } } });
  await db.$transaction(async tx => {
    for (const t of tasks) {
      await tx.task.update({
        where: { id: t.id },
        data: { status: "progress", acceptStatus: "Open", testStatus: "Open", progress: 80, completedDate: null, notes: [t.notes, `UAT ${fmtDay(today())}: ${note.trim()}`].filter(Boolean).join("\n") },
      });
      await tx.taskEvent.create({ data: { taskId: t.id, kind: "uat_reject", fromStatus: t.status, toStatus: "progress", message: note.trim(), data: { d: today(), by: by.trim(), note: note.trim() } } });
    }
    await audit(tx, viewer, "note", "task", "", `UAT returned ${tasks.length} items (${by.trim()})`);
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { count: tasks.length } };
}
