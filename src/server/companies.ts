"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";

const input = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter the company name."),
  country: z.string().trim().default(""),
  code: z.string().trim().max(8).default(""),
  sapDb: z.string().trim().default(""),
  branches: z.string().default(""),
  notes: z.string().default(""),
  holding: z.boolean().default(false),
  parentId: z.string().default(""),
});
export type CompanyInput = z.input<typeof input>;

export async function saveCompany(raw: CompanyInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can change companies.");
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, branches, parentId, ...f } = p.data;
  const data = { ...f, branches: branches.split(",").map(s => s.trim()).filter(Boolean), parentId: f.holding ? null : parentId || null };
  await db.$transaction(async tx => {
    // only one holding company
    if (f.holding) await tx.company.updateMany({ where: { holding: true, NOT: id ? { id } : undefined }, data: { holding: false } });
    const c = id ? await tx.company.update({ where: { id }, data }) : await tx.company.create({ data: { ...data, sortOrder: await tx.company.count() } });
    await audit(tx, viewer, id ? "update" : "create", "company", c.id, c.name);
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can delete companies.");
  await db.$transaction(async tx => {
    const c = await tx.company.delete({ where: { id } }); // tasks, users & access and licences keep working without it
    const remaining = await tx.company.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await tx.company.update({ where: { id: remaining[i].id }, data: { sortOrder: i } });
      }
    }
    await audit(tx, viewer, "delete", "company", id, c.name);
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
