import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { getNotifySettings } from "@/lib/settings";
import { dayStr, today } from "@/lib/dates";
import { progressOf } from "@/lib/work";
import { OPEN_STATUSES } from "@/lib/issues";
import { WorkloadView, type DevLoad } from "./_components/WorkloadView";

export const metadata: Metadata = { title: "Work on hand" };

export default async function WorkloadPage() {
  const viewer = await requireViewer();
  const now = new Date(today());
  const [developers, tasks, issues, cfg] = await Promise.all([
    db.developer.findMany({ orderBy: { name: "asc" } }),
    db.task.findMany({
      where: { status: { not: "done" } },
      select: {
        id: true,
        sno: true,
        title: true,
        subModule: true,
        priority: true,
        status: true,
        progress: true,
        dueDate: true,
        estHours: true,
        project: { select: { name: true, code: true } },
        assignees: { orderBy: { position: "asc" }, select: { developerId: true } },
      },
    }),
    db.issue.findMany({
      where: { status: { in: OPEN_STATUSES } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        project: { select: { name: true } },
        assignees: { orderBy: { position: "asc" }, select: { developerId: true } },
      },
    }),
    getNotifySettings(),
  ]);
  const loads: DevLoad[] = developers.map(d => {
    const L = tasks.filter(t => t.assignees.some(a => a.developerId === d.id));
    const Iss = issues.filter(x => x.assignees.some(a => a.developerId === d.id));
    const active = L.filter(t => ["progress", "qa", "uat"].includes(t.status)).length;
    const open = L.filter(t => t.status === "pending").length;
    const urgent = Iss.filter(x => x.priority === "Urgent").length;
    return {
      id: d.id,
      name: d.name,
      title: d.title,
      availability: d.availability || "Available",
      urgent,
      issues: Iss.length,
      active,
      open,
      hold: L.filter(t => t.status === "hold").length,
      overdue: L.filter(t => t.dueDate && t.dueDate < now).length,
      hoursLeft: L.reduce((a, t) => a + (Number(t.estHours) || 0) * (1 - progressOf(t) / 100), 0),
      // active work counts fully, open items lightly, urgent issues double
      score: active + open * 0.3 + Iss.length + urgent * 2,
      tasks: L.map(t => ({
        id: t.id,
        sno: t.sno,
        title: t.title,
        subModule: t.subModule,
        priority: t.priority,
        status: t.status,
        progress: progressOf(t),
        estHoursLeft: (Number(t.estHours) || 0) * (1 - progressOf(t) / 100),
        due: dayStr(t.dueDate),
        project: t.project?.name ?? "",
        projectCode: t.project?.code ?? "",
        others: t.assignees.filter(a => a.developerId !== d.id).map(a => a.developerId),
      })),
      issueList: Iss.map(x => ({
        id: x.id,
        title: x.title,
        status: x.status,
        priority: x.priority,
        project: x.project?.name ?? "",
        createdAt: x.createdAt.toISOString(),
        others: x.assignees.filter(a => a.developerId !== d.id).map(a => a.developerId),
      })),
    };
  });
  return <WorkloadView loads={loads} sla={cfg.sla} canManage={canManage(viewer)} canEdit={canEdit(viewer)} />;
}
