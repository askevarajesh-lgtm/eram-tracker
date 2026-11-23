"use server";
// Day-to-day records: developers' daily updates, the project day note, and the company rollout matrix.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { toDay, today } from "@/lib/dates";

const done = () => revalidatePath("/", "layout");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A developer's daily update (done / plan / blockers / hours). */
export async function saveStandup(developerId: string, date: string, f: { done: string; plan: string; blockers: string; hours: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer) && viewer.developerId !== developerId) return fail("You can only write your own daily update.");
  if (!day.safeParse(date).success) return fail("Pick a date.");
  if (!f.done.trim() && !f.plan.trim() && !f.blockers.trim()) return fail("Write at least one line.");
  const hours = f.hours === "" ? null : Number(f.hours);
  if (hours != null && !(hours >= 0 && hours <= 24)) return fail("Hours must be between 0 and 24.");
  const d = toDay(date)!;
  const data = { done: f.done.trim(), plan: f.plan.trim(), blockers: f.blockers.trim(), hours };
  await db.$transaction(async tx => {
    await tx.standup.upsert({ where: { developerId_date: { developerId, date: d } }, update: data, create: { ...data, developerId, date: d } });
    await audit(tx, viewer, "update", "standup", developerId, `Daily update ${date}`);
  });
  done();
  return { ok: true };
}

/** Status update for a day on the Eram HCM board (one per project per day; no project = all projects). */
export async function saveDailyNote(projectId: string, date: string, f: { done: string; blockers: string; next: string }): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't write day notes.");
  if (!day.safeParse(date).success) return fail("Pick a date.");
  const d = toDay(date)!;
  const pid = projectId && projectId !== "_all" ? projectId : null;
  const data = { done: f.done.trim(), blockers: f.blockers.trim(), next: f.next.trim() };
  await db.$transaction(async tx => {
    const ex = await tx.dailyNote.findFirst({ where: { projectId: pid, date: d } });
    if (ex) await tx.dailyNote.update({ where: { id: ex.id }, data });
    else await tx.dailyNote.create({ data: { ...data, projectId: pid, date: d } });
    await audit(tx, viewer, "update", "daily", pid ?? "", `Day note ${date}`);
  });
  done();
  return { ok: true };
}

const ROLLOUT = ["none", "planned", "progress", "uat", "live", "hold"] as const;
const rolloutInput = z.object({
  companyId: z.string(), projectId: z.string(), status: z.enum(ROLLOUT), progress: z.string().default(""),
  startDate: z.string().default(""), targetDate: z.string().default(""), actualDate: z.string().default(""),
  owner: z.string().trim().default(""), branches: z.string().trim().default(""), notes: z.string().default(""),
});
export type RolloutInput = z.input<typeof rolloutInput>;

/** One cell of the company × system rollout matrix. Status changes are kept in its history. */
export async function saveRollout(raw: RolloutInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can update the rollout.");
  const p = rolloutInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const f = p.data;
  const ex = await db.rollout.findUnique({ where: { companyId_projectId: { companyId: f.companyId, projectId: f.projectId } } });
  const log = Array.isArray(ex?.log) ? [...(ex!.log as Prisma.JsonArray)].slice(-39) : [];
  if ((ex?.status || "none") !== f.status) log.push({ d: today(), from: ex?.status || "none", to: f.status });
  const progress = f.progress === "" ? null : Math.max(0, Math.min(100, Math.round(Number(f.progress) || 0)));
  const data = {
    status: f.status, progress: f.status === "live" ? 100 : progress, startDate: toDay(f.startDate), targetDate: toDay(f.targetDate),
    actualDate: toDay(f.actualDate) ?? (f.status === "live" ? toDay(today()) : null), owner: f.owner, branches: f.branches, notes: f.notes, log,
  };
  await db.$transaction(async tx => {
    await tx.rollout.upsert({ where: { companyId_projectId: { companyId: f.companyId, projectId: f.projectId } }, update: data, create: { ...data, companyId: f.companyId, projectId: f.projectId } });
    await audit(tx, viewer, "update", "rollout", `${f.companyId}|${f.projectId}`, `Rollout → ${f.status}`);
  });
  done();
  return { ok: true };
}
