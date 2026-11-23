"use server";
// "Users & access" register: records of people in the companies, the systems they can use and the
// licences allocated to them. These people are NOT app accounts; only Admins/Managers maintain them.
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { USER_TYPES, isBusinessUser } from "@/lib/licensing";
import { toDay, today } from "@/lib/dates";

type Tx = Prisma.TransactionClient;
const done = () => revalidatePath("/", "layout");
const guard = async () => {
  const v = await requireViewer();
  return canManage(v) ? v : null;
};
const DENIED = "Only admins and project managers can change users & access.";

const input = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a name."),
  email: z.string().trim().email("Enter a valid email or leave it empty.").or(z.literal("")).default(""),
  sapCode: z.string().trim().default(""),
  companyId: z.string().default(""),
  branch: z.string().trim().default(""),
  dept: z.string().trim().default(""),
  designation: z.string().trim().default(""),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  userType: z.enum(USER_TYPES).default("Business user"),
  apps: z.array(z.object({ projectId: z.string(), role: z.string().trim().default("") })).default([]),
  licenceIds: z.array(z.string()).default([]),
});
export type AccessRecordInput = z.input<typeof input>;

/**
 * Applies the licence rules and returns what to store:
 *  - one licence per software
 *  - business-user licences only for business users
 *  - a licence linked to a system also gives access to that system
 */
async function planLicences(tx: Tx, userType: string, licenceIds: string[], apps: { projectId: string; role: string }[]) {
  const pools = await tx.licence.findMany({ where: { id: { in: [...new Set(licenceIds)] } } });
  const bySoftware = new Map<string, string>();
  for (const p of pools) {
    if (bySoftware.has(p.software)) throw new UserError(`Only one ${p.software} licence per person.`);
    bySoftware.set(p.software, p.id);
  }
  const kept = pools.filter(p => p.audience !== "endusers" || isBusinessUser(userType));
  const appMap = new Map(apps.map(a => [a.projectId, a.role]));
  for (const p of kept) if (p.projectId && !appMap.has(p.projectId)) appMap.set(p.projectId, "");
  return { licenceIds: kept.map(p => p.id), apps: [...appMap].map(([projectId, role]) => ({ projectId, role })), dropped: pools.length - kept.length };
}

class UserError extends Error {}

export async function saveAccessRecord(raw: AccessRecordInput): Promise<ActionResult<{ id: string; dropped: number }>> {
  const viewer = await guard();
  if (!viewer) return fail(DENIED);
  const p = input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, apps, licenceIds, companyId, ...fields } = p.data;
  try {
    const res = await db.$transaction(async tx => {
      const plan = await planLicences(tx, fields.userType, licenceIds, apps);
      const data = { ...fields, companyId: companyId || null };
      const rec = id ? await tx.accessRecord.update({ where: { id }, data }) : await tx.accessRecord.create({ data });
      // keep the original grant / assignment dates for anything that was already there
      const [oldApps, oldLic] = await Promise.all([
        tx.appAccess.findMany({ where: { recordId: rec.id } }),
        tx.licenceAssignment.findMany({ where: { recordId: rec.id } }),
      ]);
      const now = toDay(today());
      await tx.appAccess.deleteMany({ where: { recordId: rec.id } });
      await tx.appAccess.createMany({ data: plan.apps.map(a => ({ ...a, recordId: rec.id, grantedOn: oldApps.find(o => o.projectId === a.projectId)?.grantedOn ?? now })) });
      await tx.licenceAssignment.deleteMany({ where: { recordId: rec.id } });
      await tx.licenceAssignment.createMany({ data: plan.licenceIds.map(licenceId => ({ licenceId, recordId: rec.id, assignedOn: oldLic.find(o => o.licenceId === licenceId)?.assignedOn ?? now })) });
      await audit(tx, viewer, id ? "update" : "create", "access-record", rec.id, rec.name);
      return { id: rec.id, dropped: plan.dropped };
    });
    done();
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("This record no longer exists.");
    throw e;
  }
}

export async function deleteAccessRecord(id: string): Promise<ActionResult> {
  const viewer = await guard();
  if (!viewer) return fail(DENIED);
  const r = await db.accessRecord.findUnique({ where: { id } });
  if (!r) return { ok: true };
  await db.$transaction(async tx => {
    await tx.accessRecord.delete({ where: { id } }); // access and licence assignments go with it
    await audit(tx, viewer, "delete", "access-record", id, r.name);
  });
  done();
  return { ok: true };
}

/** Give or remove access to one system for several records. Removing access also releases that system's licences. */
export async function setAppAccess(recordIds: string[], projectId: string, on: boolean): Promise<ActionResult<{ changed: number; released: number }>> {
  const viewer = await guard();
  if (!viewer) return fail(DENIED);
  const ids = [...new Set(recordIds)].slice(0, 2000);
  const res = await db.$transaction(async tx => {
    let changed = 0, released = 0;
    if (on) {
      changed = (await tx.appAccess.createMany({ data: ids.map(recordId => ({ recordId, projectId, grantedOn: toDay(today()) })), skipDuplicates: true })).count;
    } else {
      changed = (await tx.appAccess.deleteMany({ where: { projectId, recordId: { in: ids } } })).count;
      released = (await tx.licenceAssignment.deleteMany({ where: { recordId: { in: ids }, licence: { projectId } } })).count;
    }
    const proj = await tx.project.findUnique({ where: { id: projectId }, select: { name: true } });
    await audit(tx, viewer, "update", "access-record", ids.length === 1 ? ids[0] : "", `${on ? "Gave" : "Removed"} ${proj?.name ?? "system"} access (${changed})`);
    return { changed, released };
  });
  done();
  return { ok: true, data: res };
}
