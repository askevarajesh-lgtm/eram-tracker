"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { AUDIENCES, isBusinessUser, type Audience } from "@/lib/licensing";
import { toDay, today } from "@/lib/dates";

const done = () => revalidatePath("/", "layout");
const DENIED = "Only admins and project managers can change licences.";

const input = z.object({
  id: z.string().optional(),
  software: z.string().trim().min(1, "Enter the software."),
  type: z.string().trim().min(1, "Enter the licence type."),
  quantity: z.coerce.number().int().min(0).default(0),
  companyId: z.string().default(""),
  projectId: z.string().default(""),
  audience: z.enum(Object.keys(AUDIENCES) as [Audience, ...Audience[]]).default("endusers"),
  model: z.string().default(""),
  renewal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  vendor: z.string().trim().default(""),
  cost: z.union([z.literal(""), z.coerce.number().min(0)]).default(""), // "" first: coerce would turn "" into 0
  currency: z.string().trim().max(4).default(""),
  contract: z.string().trim().default(""),
  notes: z.string().default(""),
});
export type LicenceInput = z.input<typeof input>;

export async function saveLicence(raw: LicenceInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(DENIED);
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, companyId, projectId, renewal, cost, ...f } = p.data;
  const data = { ...f, companyId: companyId || null, projectId: projectId || null, renewal: toDay(renewal), cost: cost === "" ? null : cost };
  const lic = await db.$transaction(async tx => {
    const l = id ? await tx.licence.update({ where: { id }, data }) : await tx.licence.create({ data: { ...data, sortOrder: await tx.licence.count() } });
    await audit(tx, viewer, id ? "update" : "create", "licence", l.id, `${l.software} · ${l.type}`);
    return l;
  });
  done();
  return { ok: true, data: { id: lic.id } };
}

export async function deleteLicence(id: string): Promise<ActionResult<{ released: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(DENIED);
  const l = await db.licence.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } });
  if (!l) return { ok: true, data: { released: 0 } };
  await db.$transaction(async tx => {
    await tx.licence.delete({ where: { id } }); // assignments are released with it
    await audit(tx, viewer, "delete", "licence", id, `${l.software} · ${l.type}`);
  });
  done();
  return { ok: true, data: { released: l._count.assignments } };
}

/**
 * Sets exactly who holds this licence. A new holder's other licence for the same software is released
 * (moved to this one), and they get access to the linked system.
 */
export async function setLicenceHolders(licenceId: string, recordIds: string[]): Promise<ActionResult<{ added: number; removed: number; skipped: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(DENIED);
  const lic = await db.licence.findUnique({ where: { id: licenceId }, include: { assignments: true } });
  if (!lic) return fail("This licence no longer exists.");
  const records = await db.accessRecord.findMany({ where: { id: { in: [...new Set(recordIds)] } }, select: { id: true, userType: true } });
  // business-user licences can only go to business users
  const allowed = records.filter(r => lic.audience !== "endusers" || isBusinessUser(r.userType)).map(r => r.id);
  const skipped = records.length - allowed.length;
  const before = new Set(lic.assignments.map(a => a.recordId));
  const want = new Set(allowed);
  const add = allowed.filter(id => !before.has(id));
  const remove = [...before].filter(id => !want.has(id));
  const day = toDay(today());

  await db.$transaction(async tx => {
    if (remove.length) await tx.licenceAssignment.deleteMany({ where: { licenceId, recordId: { in: remove } } });
    if (add.length) {
      await tx.licenceAssignment.deleteMany({ where: { recordId: { in: add }, licence: { software: lic.software }, NOT: { licenceId } } });
      await tx.licenceAssignment.createMany({ data: add.map(recordId => ({ licenceId, recordId, assignedOn: day })) });
      if (lic.projectId) await tx.appAccess.createMany({ data: add.map(recordId => ({ recordId, projectId: lic.projectId!, grantedOn: day })), skipDuplicates: true });
    }
    await audit(tx, viewer, "update", "licence", licenceId, `${lic.software} · ${lic.type}: +${add.length} / -${remove.length} holders`);
  });
  done();
  return { ok: true, data: { added: add.length, removed: remove.length, skipped } };
}
