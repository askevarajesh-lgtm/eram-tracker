"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/action";

const input = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter the project name."),
  code: z.string().trim().max(8).default(""),
  fullName: z.string().trim().default(""),
  phase: z.string().trim().default(""),
  target: z.string().trim().default(""),
  lead: z.string().trim().default(""),
});
export type ProjectInput = z.input<typeof input>;

export async function saveProject(raw: ProjectInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return { ok: false, error: "Only admins and project managers can change projects." };
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { id, ...rest } = p.data;
  const data = { ...rest, code: (rest.code || rest.name.slice(0, 3)).toUpperCase() };
  const proj = await db.$transaction(async tx => {
    const r = id
      ? await tx.project.update({ where: { id }, data })
      : await tx.project.create({ data: { ...data, sortOrder: await tx.project.count() } });
    await audit(tx, viewer, id ? "update" : "create", "project", r.id, r.name);
    return r;
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: proj.id } };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return { ok: false, error: "Only admins and project managers can delete projects." };
  const p = await db.project.findUnique({ where: { id }, include: { _count: { select: { tasks: true } } } });
  if (!p) return { ok: true };
  if (p._count.tasks) return { ok: false, error: `${p.name} has ${p._count.tasks} task(s). Move or delete them first.` };
  await db.$transaction(async tx => {
    await tx.project.delete({ where: { id } });
    const remaining = await tx.project.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await tx.project.update({ where: { id: remaining[i].id }, data: { sortOrder: i } });
      }
    }
    await audit(tx, viewer, "delete", "project", id, p.name);
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
