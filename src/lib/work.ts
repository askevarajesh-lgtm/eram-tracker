// Small helpers about task progress and status, shared by server and client code.
import type { TaskStatus } from "@prisma/client";

/** Progress assumed when none is entered, by status (same as the old app). */
export const STATUS_WEIGHT: Record<TaskStatus, number> = { pending: 0, progress: 50, qa: 75, uat: 90, hold: 25, done: 100 };
export const progressOf = (t: { status: TaskStatus; progress: number | null }) => (t.status === "done" ? 100 : t.progress ?? STATUS_WEIGHT[t.status] ?? 0);
export const averageProgress = (list: { status: TaskStatus; progress: number | null }[]) =>
  list.length ? Math.round(list.reduce((a, t) => a + progressOf(t), 0) / list.length) : 0;

export const SIZE_HOURS: Record<string, number> = { S: 4, M: 16, L: 40, XL: 80 };

/** YYYY-MM-DD n days from a YYYY-MM-DD date */
export function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Sunday-based week start (the team's week starts on Sunday). */
export function weekStart(day: string) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";

export type FileRef = { id: string; name: string; type: string; size: number; t?: string; by?: string };
export const filesOf = (v: unknown): FileRef[] => (Array.isArray(v) ? (v as FileRef[]).filter(f => f && typeof f.id === "string") : []);
