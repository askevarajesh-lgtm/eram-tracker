import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { dayStr } from "@/lib/dates";
import { PlanView, type PlanData } from "./_components/PlanView";

export const metadata: Metadata = { title: "Plan & control" };

const TABS = ["milestones", "changes", "releases", "risks"] as const;
type Tab = (typeof TABS)[number];

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string; new?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "milestones";
  const [projects, companies, milestones, changes, releases, risks, doneTasks] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.company.findMany({ where: { holding: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, country: true } }),
    db.milestone.findMany({ orderBy: { target: "asc" } }),
    db.changeRequest.findMany({ orderBy: { createdAt: "desc" }, include: { task: { select: { id: true, sno: true } } } }),
    db.release.findMany({ orderBy: { date: "desc" }, include: { tasks: { select: { id: true } } } }),
    db.risk.findMany(),
    tab === "releases" ? db.task.findMany({ where: { status: "done" }, select: { id: true, title: true, subModule: true, projectId: true }, orderBy: { sno: "asc" } }) : [],
  ]);
  const data: PlanData = {
    milestones: milestones.map(m => ({ id: m.id, title: m.title, projectId: m.projectId ?? "", target: dayStr(m.target), status: m.status, doneOn: dayStr(m.doneOn), owner: m.owner, note: m.note })),
    changes: changes.map(c => ({
      id: c.id, title: c.title, description: c.description, projectId: c.projectId ?? "", subModule: c.subModule, requestedBy: c.requestedBy, companyId: c.companyId ?? "",
      priority: c.priority, effort: c.effort, status: c.status, decisionBy: c.decisionBy ?? "", decidedAt: c.decidedAt?.toISOString() ?? "", taskId: c.task?.id ?? "", taskSno: c.task?.sno ?? null,
    })),
    releases: releases.map(r => ({ id: r.id, version: r.version, projectId: r.projectId ?? "", date: dayStr(r.date), status: r.status, notes: r.notes, taskIds: r.tasks.map(t => t.id) })),
    risks: risks
      .map(r => ({ id: r.id, type: r.type, status: r.status, title: r.title, projectId: r.projectId ?? "", companyId: r.companyId ?? "", impact: r.impact, likelihood: r.likelihood, owner: r.owner, dueDate: dayStr(r.dueDate), mitigation: r.mitigation }))
      .sort((a, b) => Number(a.status === "Closed") - Number(b.status === "Closed") || ["High", "Medium", "Low"].indexOf(a.impact) - ["High", "Medium", "Low"].indexOf(b.impact)),
    doneTasks: doneTasks.map(t => ({ id: t.id, title: t.title, subModule: t.subModule, projectId: t.projectId ?? "" })),
  };
  return <PlanView tab={tab} data={data} projects={projects} companies={companies} canManage={canManage(viewer)} canEdit={canEdit(viewer)} openId={sp.edit} openNew={sp.new === "1"} />;
}
