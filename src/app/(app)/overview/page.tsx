import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { today } from "@/lib/dates";
import { OverviewView, type OverviewTask, type OverviewProject, type OverviewDeveloper } from "./_components/OverviewView";

export const metadata: Metadata = { title: "Development overview" };

export default async function OverviewPage() {
  const viewer = await requireViewer();
  const D = today();
  const [projectsRaw, tasksRaw, developersRaw] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.task.findMany({
      orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }],
      select: {
        id: true,
        sno: true,
        title: true,
        projectId: true,
        subModule: true,
        type: true,
        status: true,
        progress: true,
        dueDate: true,
        priority: true,
        testStatus: true,
        acceptStatus: true,
        project: { select: { name: true, code: true } },
        assignees: {
          orderBy: { position: "asc" },
          select: { developerId: true, developer: { select: { name: true } } },
        },
      },
    }),
    db.developer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const projects: OverviewProject[] = projectsRaw.map(p => ({
    id: p.id,
    name: p.name,
    code: p.code,
    fullName: p.fullName,
    phase: p.phase,
    target: p.target,
    lead: p.lead,
  }));

  const tasks: OverviewTask[] = tasksRaw.map(t => ({
    id: t.id,
    sno: t.sno,
    title: t.title,
    projectId: t.projectId,
    subModule: t.subModule,
    type: t.type,
    status: t.status,
    progress: t.progress,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    priority: t.priority,
    testStatus: t.testStatus,
    acceptStatus: t.acceptStatus,
    projectName: t.project?.name,
    projectCode: t.project?.code,
    assignees: t.assignees.map(a => ({
      developerId: a.developerId,
      developerName: a.developer?.name || "",
    })),
  }));

  const developers: OverviewDeveloper[] = developersRaw.map(d => ({
    id: d.id,
    name: d.name,
    title: d.title,
  }));

  return (
    <OverviewView
      todayStr={D}
      projects={projects}
      tasks={tasks}
      developers={developers}
      canEdit={canEdit(viewer)}
      canManage={canManage(viewer)}
    />
  );
}
