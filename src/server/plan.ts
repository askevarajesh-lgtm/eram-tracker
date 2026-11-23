"use server";
// Plan & control: milestones, change requests, releases, risks & dependencies.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { toDay, today } from "@/lib/dates";

const done = () => revalidatePath("/", "layout");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default("");
const opt = (v: string) => v || null;
const MANAGE = "Only admins and managers can change the plan.";

// ---------------------------------------------------------------- milestones
const milestoneInput = z.object({
  id: z.string().optional(), title: z.string().trim().min(1, "Enter the milestone."), projectId: z.string().default(""),
  target: day.refine(v => !!v, "Pick a target date."), status: z.enum(["Planned", "On track", "At risk", "Done"]).default("Planned"),
  doneOn: day, owner: z.string().trim().default(""), note: z.string().default(""),
});
export type MilestoneInput = z.input<typeof milestoneInput>;

export async function saveMilestone(raw: MilestoneInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(MANAGE);
  const p = milestoneInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, projectId, target, doneOn, ...f } = p.data;
  const data = { ...f, projectId: opt(projectId), target: toDay(target), doneOn: f.status === "Done" ? toDay(doneOn || today()) : toDay(doneOn) };
  await db.$transaction(async tx => {
    const m = id ? await tx.milestone.update({ where: { id }, data }) : await tx.milestone.create({ data });
    await audit(tx, viewer, id ? "update" : "create", "milestone", m.id, m.title);
  });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- change requests
const changeInput = z.object({
  id: z.string().optional(), title: z.string().trim().min(1, "Describe the change."), description: z.string().default(""), projectId: z.string().default(""),
  subModule: z.string().trim().default(""), requestedBy: z.string().trim().default(""), companyId: z.string().default(""),
  priority: z.string().default("Medium"), effort: z.string().default(""),
  status: z.enum(["Submitted", "Under review", "Approved", "Rejected", "Converted"]).optional(),
});
export type ChangeInput = z.input<typeof changeInput>;

export async function saveChange(raw: ChangeInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  const p = changeInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, projectId, companyId, status, ...f } = p.data;
  // anyone may raise a change request; only managers change existing ones
  if (id ? !canManage(viewer) : !canEdit(viewer)) return fail(id ? MANAGE : "Viewers can't raise change requests.");
  const data = { ...f, projectId: opt(projectId), companyId: opt(companyId) };
  const saved = await db.$transaction(async tx => {
    let crId = id;
    if (id) await tx.changeRequest.update({ where: { id }, data: { ...data, ...(status ? { status } : {}) } });
    else {
      // CR-YYMMDD-NN, numbered per day
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(360363)`;
      const prefix = `CR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-`;
      const last = await tx.changeRequest.findFirst({ where: { id: { startsWith: prefix } }, orderBy: { id: "desc" }, select: { id: true } });
      crId = prefix + String((last ? parseInt(last.id.slice(prefix.length), 10) : 0) + 1).padStart(2, "0");
      await tx.changeRequest.create({ data: { ...data, id: crId, status: "Submitted" } });
    }
    await audit(tx, viewer, id ? "update" : "create", "change", crId!, f.title);
    return crId!;
  });
  done();
  return { ok: true, data: { id: saved } };
}

// ---------------------------------------------------------------- releases
const releaseInput = z.object({
  id: z.string().optional(), version: z.string().trim().min(1, "Enter the version."), projectId: z.string().default(""),
  date: day, status: z.enum(["Planned", "Released"]).default("Planned"), notes: z.string().default(""), taskIds: z.array(z.string()).max(2000).default([]),
});
export type ReleaseInput = z.input<typeof releaseInput>;

export async function saveRelease(raw: ReleaseInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(MANAGE);
  const p = releaseInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, projectId, date, taskIds, ...f } = p.data;
  const data = { ...f, projectId: opt(projectId), date: toDay(date) };
  await db.$transaction(async tx => {
    const r = id
      ? await tx.release.update({ where: { id }, data: { ...data, tasks: { set: taskIds.map(t => ({ id: t })) } } })
      : await tx.release.create({ data: { ...data, tasks: { connect: taskIds.map(t => ({ id: t })) } } });
    // released items carry the version and count as Live
    if (f.status === "Released" && taskIds.length) await tx.task.updateMany({ where: { id: { in: taskIds } }, data: { version: f.version, reqStatus: "Live" } });
    await audit(tx, viewer, id ? "update" : "create", "release", r.id, `${f.version} (${taskIds.length} items)`);
  });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- risks
const riskInput = z.object({
  id: z.string().optional(), type: z.enum(["Risk", "Dependency", "Assumption", "Decision needed"]).default("Risk"), status: z.enum(["Open", "Mitigating", "Closed"]).default("Open"),
  title: z.string().trim().min(1, "Give it a title."), projectId: z.string().default(""), companyId: z.string().default(""),
  impact: z.enum(["High", "Medium", "Low"]).default("Medium"), likelihood: z.enum(["High", "Medium", "Low"]).default("Medium"),
  owner: z.string().trim().default(""), dueDate: day, mitigation: z.string().default(""),
});
export type RiskInput = z.input<typeof riskInput>;

export async function saveRisk(raw: RiskInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(MANAGE);
  const p = riskInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, projectId, companyId, dueDate, ...f } = p.data;
  const data = { ...f, projectId: opt(projectId), companyId: opt(companyId), dueDate: toDay(dueDate) };
  await db.$transaction(async tx => {
    const r = id ? await tx.risk.update({ where: { id }, data }) : await tx.risk.create({ data });
    await audit(tx, viewer, id ? "update" : "create", "risk", r.id, r.title);
  });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- delete
export async function deletePlanItem(kind: "milestone" | "change" | "release" | "risk", id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail(MANAGE);
  await db.$transaction(async tx => {
    if (kind === "milestone") await tx.milestone.deleteMany({ where: { id } });
    if (kind === "change") await tx.changeRequest.deleteMany({ where: { id } });
    if (kind === "release") await tx.release.deleteMany({ where: { id } });
    if (kind === "risk") await tx.risk.deleteMany({ where: { id } });
    await audit(tx, viewer, "delete", kind, id, `${kind} ${id}`);
  });
  done();
  return { ok: true };
}
