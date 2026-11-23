"use server";
// Meetings and reminders.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action";
import { lockSno, nextSno } from "@/lib/sno";
import { toDay, today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { getNotifySettings } from "@/lib/settings";

const done = () => revalidatePath("/", "layout");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hm = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).default("");

// ---------------------------------------------------------------- meetings
const meetingInput = z.object({
  id: z.string().optional(), title: z.string().trim().min(1, "Give the meeting a title."), type: z.string().default("Discussion"),
  status: z.enum(["Planned", "Done", "Cancelled"]).default("Planned"), date: day, startTime: hm, endTime: hm, mode: z.string().default(""),
  location: z.string().trim().default(""), projectId: z.string().default(""), companyId: z.string().default(""), organizer: z.string().trim().default(""),
  remindMinutes: z.number().int().min(0).default(30), developerIds: z.array(z.string()).default([]), inviteeRecordIds: z.array(z.string()).default([]),
  guests: z.string().default(""), agenda: z.string().default(""), minutes: z.string().default(""),
}).refine(m => !m.startTime || !m.endTime || m.endTime > m.startTime, { message: "End time must be after the start.", path: ["endTime"] });
export type MeetingInput = z.input<typeof meetingInput>;

export async function saveMeeting(raw: MeetingInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't schedule meetings.");
  const p = meetingInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, developerIds, projectId, companyId, date, ...f } = p.data;
  const data = { ...f, date: toDay(date)!, projectId: projectId || null, companyId: companyId || null };
  const m = await db.$transaction(async tx => {
    const devs = { create: [...new Set(developerIds)].map(developerId => ({ developerId })) };
    const r = id
      ? await tx.meeting.update({ where: { id }, data: { ...data, developers: { deleteMany: {}, ...devs } } })
      : await tx.meeting.create({ data: { ...data, createdById: viewer.id, developers: devs } });
    await audit(tx, viewer, id ? "update" : "create", "meeting", r.id, r.title);
    return r;
  });
  done();
  return { ok: true, data: { id: m.id } };
}

export async function deleteMeeting(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't delete meetings.");
  await db.$transaction(async tx => {
    const m = await tx.meeting.delete({ where: { id } });
    await audit(tx, viewer, "delete", "meeting", id, m.title);
  });
  done();
  return { ok: true };
}

/** Lines in the minutes starting with "-", "•", "1." or "Action:" become pending tasks. */
export async function meetingActionsToTasks(id: string): Promise<ActionResult<{ count: number }>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins and managers can create tasks from minutes.");
  const m = await db.meeting.findUnique({ where: { id }, include: { developers: true } });
  if (!m) return fail("This meeting no longer exists.");
  const lines = m.minutes.split("\n").map(s => s.trim()).filter(s => /^([-•*]|\d+[.)]|action:)/i.test(s)).map(s => s.replace(/^([-•*]|\d+[.)]|action:)\s*/i, "")).filter(Boolean);
  if (!lines.length) return fail("Write action items in the minutes as lines starting with - or 1.");
  const devs = m.developers.map(d => d.developerId);
  await db.$transaction(async tx => {
    await lockSno(tx);
    let sno = await nextSno(tx, m.projectId);
    for (const title of lines) {
      await tx.task.create({
        data: {
          sno: sno++, title: title.slice(0, 500), projectId: m.projectId, type: "Enhancement", reqStatus: "Open", status: "pending",
          notes: `Action from meeting “${m.title}” on ${m.date.toISOString().slice(0, 10)}`,
          assignees: { create: devs.map((developerId, position) => ({ developerId, position })) },
          events: { create: { kind: "status", toStatus: "pending", message: `From meeting ${m.title}` } },
        },
      });
    }
    await audit(tx, viewer, "create", "task", "", `${lines.length} tasks from meeting ${m.title}`);
  });
  done();
  return { ok: true, data: { count: lines.length } };
}

// ---------------------------------------------------------------- reminders
const reminderInput = z.object({
  id: z.string().optional(), title: z.string().trim().min(1, "Write what the reminder is for."), date: day, time: hm,
  repeat: z.enum(["none", "daily", "weekdays", "weekly"]).default("none"), template: z.string().default("custom"),
  developerIds: z.array(z.string()).default([]), taskId: z.string().default(""), note: z.string().default(""),
});
export type ReminderInput = z.input<typeof reminderInput>;

export async function saveReminder(raw: ReminderInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't add reminders.");
  const p = reminderInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0].message);
  const { id, developerIds, taskId, date, ...f } = p.data;
  const data = { ...f, date: toDay(date)!, taskId: taskId || null, done: false, doneOn: null };
  await db.$transaction(async tx => {
    const devs = { create: [...new Set(developerIds)].map(developerId => ({ developerId })) };
    const r = id
      ? await tx.reminder.update({ where: { id }, data: { ...data, developers: { deleteMany: {}, ...devs } } })
      : await tx.reminder.create({ data: { ...data, createdById: viewer.id, developers: devs } });
    await audit(tx, viewer, id ? "update" : "create", "reminder", r.id, r.title);
  });
  done();
  return { ok: true };
}

/** Done (a repeating reminder moves to its next date) or snooze one day. */
export async function reminderDone(id: string, snooze: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't change reminders.");
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r) return fail("This reminder no longer exists.");
  const t = today(), cur = r.date.toISOString().slice(0, 10);
  const base = cur > t ? cur : t;
  let data: { date?: Date; done?: boolean; doneOn?: Date | null };
  if (snooze) data = { date: toDay(addDays(base, 1))! };
  else if (r.repeat === "daily") data = { date: toDay(addDays(t, 1))! };
  else if (r.repeat === "weekly") data = { date: toDay(addDays(base, 7))! };
  else if (r.repeat === "weekdays") {
    const days = (await getNotifySettings()).days;
    let d = addDays(t, 1);
    for (let k = 0; k < 8 && !days.includes(new Date(d + "T00:00:00Z").getUTCDay()); k++) d = addDays(d, 1);
    data = { date: toDay(d)! };
  } else data = { done: true, doneOn: toDay(t) };
  await db.reminder.update({ where: { id }, data });
  done();
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("Viewers can't delete reminders.");
  await db.reminder.deleteMany({ where: { id } });
  done();
  return { ok: true };
}
