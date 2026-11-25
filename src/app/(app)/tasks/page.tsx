import type { Metadata } from "next";
import { listTasks, lookups } from "@/server/queries";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { toTaskDTO } from "./_components/types";
import { TaskFilters } from "./_components/TaskFilters";
import { TasksView } from "./_components/TasksView";

export const metadata: Metadata = { title: "Tasks & assignment" };

type Search = { q?: string; project?: string; status?: string; dev?: string; priority?: string; new?: string; edit?: string; view?: string; taskId?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const [rows, lk] = await Promise.all([listTasks(sp), lookups()]);
  const tasks = rows.map(toTaskDTO);
  const openViewId = sp.taskId || (sp.view && sp.view !== "kanban" && sp.view !== "list" ? sp.view : undefined);
  const filtered = !!(sp.q || sp.project || sp.status || sp.dev || sp.priority);
  return (
    <>
      <TaskFilters lookups={lk} />
      <TasksView
        tasks={tasks}
        lookups={lk}
        filtered={filtered}
        canEdit={canEdit(viewer)}
        canManage={canManage(viewer)}
        openNew={sp.new === "1"}
        openId={sp.edit}
        openViewId={openViewId}
        viewerDeveloperId={viewer.developerId}
        defaultProjectId={sp.project && sp.project !== "_none" ? sp.project : lk.projects[0]?.id ?? ""}
        initialView={sp.view === "kanban" ? "kanban" : "list"}
      />
    </>
  );
}
