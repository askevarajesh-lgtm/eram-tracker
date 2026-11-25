"use server";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { STATUS_MAP } from "@/lib/constants";
import { ISSUE_STATUS_MAP } from "@/lib/issues";
import { fmtDay } from "@/lib/dates";

export type SearchHit = { href: string; title: string; sub: string; color: string };
export type SearchGroup = { label: string; hits: SearchHit[] };

/** Search across the tracker (tasks, issues, meetings, people, companies, manuals, change requests). */
export async function searchAll(raw: string): Promise<SearchGroup[]> {
  await requireViewer();
  const q = raw.trim();
  if (q.length < 2) return [];
  const has = { contains: q, mode: "insensitive" as const };
  const n = Number(q.replace(/^[A-Za-z]+-0*/, ""));
  const [tasks, issues, meetings, devs, records, companies, manuals, changes] = await Promise.all([
    db.task.findMany({
      where: { OR: [{ title: has }, { subModule: has }, { notes: has }, { description: has }, ...(Number.isInteger(n) && n > 0 ? [{ sno: n }] : [])] }, take: 12,
      include: { project: { select: { name: true, code: true } }, assignees: { orderBy: { position: "asc" }, include: { developer: { select: { name: true } } } } },
    }),
    db.issue.findMany({ where: { OR: [{ id: has }, { title: has }, { description: has }, { raisedBy: has }] }, take: 8, include: { assignees: { include: { developer: { select: { name: true } } } } } }),
    db.meeting.findMany({ where: { OR: [{ title: has }, { agenda: has }, { minutes: has }, { type: has }] }, take: 8, orderBy: { date: "desc" } }),
    db.developer.findMany({ where: { OR: [{ name: has }, { email: has }, { skills: has }] }, take: 6 }),
    db.accessRecord.findMany({ where: { OR: [{ name: has }, { email: has }, { sapCode: has }, { dept: has }] }, take: 8, include: { company: { select: { name: true } } } }),
    db.company.findMany({ where: { OR: [{ name: has }, { code: has }, { country: has }] }, take: 6 }),
    db.manual.findMany({ where: { OR: [{ title: has }, { subModule: has }, { notes: has }] }, take: 6 }),
    db.changeRequest.findMany({ where: { OR: [{ id: has }, { title: has }, { description: has }] }, take: 6 }),
  ]);
  const groups: SearchGroup[] = [
    { label: "Tasks", hits: tasks.map(t => ({ href: `/tasks?view=${t.id}`, title: t.title, sub: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")} · ${t.project?.name ?? ""} · ${STATUS_MAP[t.status].label} · ${t.assignees.map(a => a.developer.name).join(", ") || "Unassigned"}`, color: STATUS_MAP[t.status].color })) },
    { label: "Urgent issues", hits: issues.map(x => ({ href: `/issues?st=all&view=${x.id}`, title: `${x.id} · ${x.title}`, sub: `${x.priority} · ${ISSUE_STATUS_MAP[x.status]?.label ?? x.status} · ${x.assignees.map(a => a.developer.name).join(", ") || "Unassigned"}`, color: "var(--bad)" })) },
    { label: "Meetings", hits: meetings.map(m => ({ href: `/calendar?view=${m.id}&m=${m.date.toISOString().slice(0, 7)}`, title: m.title, sub: `${fmtDay(m.date)} ${m.startTime} · ${m.type}`, color: "var(--accent)" })) },
    { label: "Change requests", hits: changes.map(c => ({ href: `/plan?tab=changes&edit=${c.id}`, title: `${c.id} · ${c.title}`, sub: c.status, color: "var(--lms)" })) },
    { label: "Developers", hits: devs.map(d => ({ href: `/tasks?dev=${d.id}`, title: d.name, sub: [d.title, d.email].filter(Boolean).join(" · "), color: "var(--info)" })) },
    { label: "Users & access", hits: records.map(r => ({ href: `/users?q=${encodeURIComponent(r.name)}&view=${r.id}`, title: r.name, sub: [r.dept, r.company?.name, r.email].filter(Boolean).join(" · "), color: "var(--ok)" })) },
    { label: "Companies", hits: companies.map(c => ({ href: "/admin", title: c.name, sub: [c.code, c.country].filter(Boolean).join(" · "), color: "var(--hold)" })) },
    { label: "User manuals", hits: manuals.map(m => ({ href: `/manuals?edit=${m.id}`, title: m.title, sub: m.status, color: "var(--warn)" })) },
  ];
  return groups.filter(g => g.hits.length);
}
