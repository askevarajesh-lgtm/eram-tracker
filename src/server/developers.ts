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
  name: z.string().trim().min(1, "Enter the developer's name."),
  title: z.string().trim().default(""),
  email: z.string().trim().email("Enter a valid email or leave it empty.").or(z.literal("")).default(""),
  whatsapp: z.string().trim().default(""),
  skills: z.string().trim().default(""),
});
export type DeveloperInput = z.input<typeof input>;

export async function saveDeveloper(raw: DeveloperInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return { ok: false, error: "Only admins and project managers can change developers." };
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { id, ...data } = p.data;
  const dev = await db.$transaction(async tx => {
    const d = id ? await tx.developer.update({ where: { id }, data }) : await tx.developer.create({ data });
    await audit(tx, viewer, id ? "update" : "create", "developer", d.id, d.name);
    return d;
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: dev.id } };
}

export async function deleteDeveloper(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return { ok: false, error: "Only admins and project managers can remove developers." };
  const d = await db.developer.findUnique({ where: { id }, include: { _count: { select: { tasks: true } } } });
  if (!d) return { ok: true };
  if (d._count.tasks) return { ok: false, error: `${d.name} is assigned to ${d._count.tasks} task(s). Reassign them first.` };
  await db.$transaction(async tx => {
    await tx.developer.delete({ where: { id } });
    await audit(tx, viewer, "delete", "developer", id, d.name);
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
