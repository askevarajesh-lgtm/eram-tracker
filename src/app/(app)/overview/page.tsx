import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { today } from "@/lib/dates";
import { OverviewView, type OverviewTask, type OverviewProject, type OverviewDeveloper } from "./_components/OverviewView";

export const metadata: Metadata = { title: "Development overview" };

export default async function OverviewPage() {
  await requireViewer();
  const D = today();
  const [projectsRaw, tasksRaw, developersRaw] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.task.findMany({
      select: {
        id: true,
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
        project: { select: { name: true } },
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
    fullName: p.fullName,
    phase: p.phase,
    target: p.target,
  }));

  const tasks: OverviewTask[] = tasksRaw.map(t => ({
    id: t.id,
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

  return <OverviewView todayStr={D} projects={projects} tasks={tasks} developers={developers} />;
}
