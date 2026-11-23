import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { ProjectsView } from "./_components/ProjectsView";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const viewer = await requireViewer();
  const [projects, counts] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.task.groupBy({ by: ["projectId", "status"], _count: true }),
  ]);
  const rows = projects.map(p => {
    const c = counts.filter(x => x.projectId === p.id);
    const total = c.reduce((a, x) => a + x._count, 0);
    const done = c.find(x => x.status === "done")?._count ?? 0;
    return { id: p.id, name: p.name, code: p.code, fullName: p.fullName, phase: p.phase, target: p.target, lead: p.lead, total, done };
  });
  return <ProjectsView rows={rows} canManage={canManage(viewer)} />;
}
