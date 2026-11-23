import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { DeliveredView, type DeliveredTask, type DeliveredProject } from "./_components/DeliveredView";

export const metadata: Metadata = { title: "Delivered software" };

export default async function DeliveredPage() {
  await requireViewer();
  const [projectsRaw, tasksRaw] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.task.findMany({
      where: { status: "done" },
      orderBy: [{ subModule: "asc" }, { sno: "asc" }],
      include: {
        assignees: {
          orderBy: { position: "asc" },
          select: { developer: { select: { name: true } } },
        },
      },
    }),
  ]);

  const groups: DeliveredProject[] = [
    ...projectsRaw.map(p => ({ id: p.id, name: p.name, full: p.fullName })),
    { id: null, name: "No project", full: "" },
  ];

  const tasks: DeliveredTask[] = tasksRaw.map(t => ({
    id: t.id,
    sno: t.sno,
    projectId: t.projectId,
    subModule: t.subModule,
    title: t.title,
    version: t.version,
    type: t.type,
    branch: t.branch,
    endUsers: t.endUsers,
    acceptStatus: t.acceptStatus,
    completedDate: t.completedDate ? t.completedDate.toISOString().slice(0, 10) : null,
    assignees: t.assignees.map(a => ({
      developerName: a.developer?.name || "",
    })),
  }));

  return <DeliveredView groups={groups} tasks={tasks} />;
}
