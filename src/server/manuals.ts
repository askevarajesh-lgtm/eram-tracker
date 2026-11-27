"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { toDay, today } from "@/lib/dates";

const input = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Give the manual a title."),
  projectId: z.string().default(""),
  subModule: z.string().trim().default(""),
  level: z.enum(["Admin", "Manager", "Developer"]).default("Developer"),
  status: z.enum(["Draft", "In review", "Published", "Outdated"]).default("Draft"),
  version: z.string().trim().default(""),
  language: z.string().default("English"),
  owner: z.string().default(""),
  updatedOn: z.string().default(""),
  link: z.string().trim().refine(v => !v || /^https?:\/\//i.test(v), "The link must start with https://").default(""),
  notes: z.string().default(""),
});
export type ManualInput = z.input<typeof input>;

export async function saveManual(raw: ManualInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't change manuals.");
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, projectId, updatedOn, ...f } = p.data;
  const data = { ...f, projectId: projectId || null, updatedOn: toDay(updatedOn) ?? toDay(today()) };
  const m = await db.$transaction(async tx => {
    const r = id ? await tx.manual.update({ where: { id }, data }) : await tx.manual.create({ data });
    await audit(tx, viewer, id ? "update" : "create", "manual", r.id, r.title);
    return r;
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: m.id } };
}

export async function deleteManual(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can delete manuals.");
  const deleted = await db.$transaction(async tx => {
    const existing = await tx.manual.findUnique({ where: { id }, select: { id: true, title: true, files: true } });
    if (!existing) return null;
    await tx.manual.delete({ where: { id } });
    const ids = (Array.isArray(existing.files) ? existing.files : []).map(f => (f as { id?: string })?.id).filter((x): x is string => !!x);
    if (ids.length) await tx.asset.deleteMany({ where: { id: { in: ids } } });
    await audit(tx, viewer, "delete", "manual", id, existing.title);
    return existing;
  });
  if (!deleted) return fail("Manual not found or already deleted.");
  revalidatePath("/", "layout");
  return { ok: true };
}
