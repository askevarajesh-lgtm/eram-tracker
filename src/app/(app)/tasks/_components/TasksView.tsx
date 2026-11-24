"use client";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { LayoutList, Kanban, Upload, Download } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { PRIORITY_COLOR, STATUS_MAP } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import type { Lookups } from "@/server/queries";
import { renumberTasks } from "@/server/tasks";
import { toast } from "@/components/ui/Toaster";
import { confirmAction } from "@/components/ui/ConfirmCloseModal";
import { Chip } from "@/components/ui/Chip";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { RecordActions } from "@/components/ui/RecordActions";
import { deleteTask } from "@/server/tasks";
import { TaskDetailModal } from "./TaskDetailModal";
import { TaskForm } from "./TaskForm";
import { TaskKanbanView } from "./TaskKanbanView";
import { TaskImportModal } from "./TaskImportModal";
import type { TaskDTO } from "./types";

type Props = {
  tasks: TaskDTO[];
  lookups: Lookups;
  filtered: boolean;
  canEdit: boolean;
  canManage: boolean;
  openNew: boolean;
  openId?: string;
  defaultProjectId: string;
  viewerDeveloperId?: string | null;
  initialView?: "list" | "kanban";
};

const PAGE = 100;

export function TasksView({
  tasks,
  lookups,
  filtered,
  canEdit,
  canManage,
  openNew,
  openId,
  defaultProjectId,
  viewerDeveloperId = null,
  initialView = "list",
}: Props) {
  const sp = useSearchParams();
  const { update } = useUrlUpdate();
  const [limit, setLimit] = useState(PAGE);
  const [busy, start] = useTransition();
  const [viewing, setViewing] = useState<TaskDTO | null>(null);
  const [newStatusPreset, setNewStatusPreset] = useState<TaskStatus | undefined>(undefined);
  const [importing, setImporting] = useState(false);

  // Constructs query parameters for module-specific task download based on active filters
  const exportFilterQuery = useMemo(() => {
    const params = new URLSearchParams();
    for (const key of ["project", "status", "dev", "priority", "q"]) {
      const v = sp.get(key);
      if (v) params.set(key, v);
    }
    const str = params.toString();
    return str ? `&${str}` : "";
  }, [sp]);

  // View mode switcher: remembers URL param (?view=kanban) and localStorage preference
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    const urlView = sp.get("view");
    if (urlView === "kanban" || urlView === "list") return urlView;
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dev360_tasks_view");
        if (saved === "kanban" || saved === "list") return saved;
      } catch {}
    }
    return initialView;
  });

  const handleViewChange = (mode: "list" | "kanban") => {
    setViewMode(mode);
    try {
      localStorage.setItem("dev360_tasks_view", mode);
    } catch {}
    update({ view: mode === "list" ? null : mode });
  };

  const handleNewInStatus = (status: TaskStatus) => {
    setNewStatusPreset(status);
    setOpen("new");
  };

  // which task is open in the side panel is kept in the URL (?edit=<id> or ?new=1)
  const editing = openNew ? "new" : openId ? tasks.find(t => t.id === openId) ?? null : null;
  const setOpen = (v: string | null) => update({ new: v === "new" ? "1" : null, edit: v && v !== "new" ? v : null });

  const now = today();
  const shown = useMemo(() => tasks.slice(0, limit), [tasks, limit]);

  const renumber = async () => {
    const ok = await confirmAction({
      title: "Renumber items?",
      message: "Renumber S.No 1, 2, 3… in every project, keeping the current order?",
      confirmLabel: "Renumber",
      cancelLabel: "Cancel",
      danger: false,
    });
    if (!ok) return;
    start(async () => {
      const r = await renumberTasks(sp.get("project") && sp.get("project") !== "_none" ? sp.get("project") : undefined);
      toast(r.ok ? (r.data!.changed ? `Renumbered: ${r.data!.changed} of ${r.data!.total} tasks got a new S.No` : "Already in order, nothing changed") : r.error);
    });
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="muted">{tasks.length} task{tasks.length === 1 ? "" : "s"}{filtered ? " match the filters" : ""}</span>
          <span className="seg" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              aria-pressed={viewMode === "list"}
              onClick={() => handleViewChange("list")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <LayoutList size={14} />
              <span>List</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "kanban"}
              aria-pressed={viewMode === "kanban"}
              onClick={() => handleViewChange("kanban")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Kanban size={14} />
              <span>Kanban</span>
            </button>
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {canManage && (
            <button
              className="btn"
              type="button"
              title="Upload tasks from Excel or CSV"
              onClick={() => setImporting(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Upload size={14} />
              <span>Upload</span>
            </button>
          )}
          <a
            className="btn"
            href={`/api/export?module=tasks${exportFilterQuery}`}
            download
            title="Download tasks as Excel"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
          >
            <Download size={14} />
            <span>Download Excel</span>
          </a>
          {canManage && <button className="btn" type="button" onClick={renumber} disabled={busy}>Renumber S.No</button>}
          {canEdit && (
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setNewStatusPreset(undefined);
                setOpen("new");
              }}
            >
              + New task
            </button>
          )}
        </div>
      </div>

      {viewMode === "kanban" ? (
        <TaskKanbanView
          tasks={tasks}
          canEdit={canEdit}
          canManage={canManage}
          viewerDeveloperId={viewerDeveloperId}
          onView={(t) => setViewing(t)}
          onEdit={(id) => setOpen(id)}
          onNewInStatus={handleNewInStatus}
        />
      ) : (
        (() => {
          const columns: ColumnsType<TaskDTO> = [
            {
              title: "S.No",
              dataIndex: "sno",
              key: "sno",
              align: "left",
              className: "mono",
              width: 75,
              render: (sno: number) => <span className="mono" style={{ fontWeight: 500 }}>{sno}</span>,
            },
            {
              title: "Details",
              dataIndex: "title",
              key: "title",
              render: (title: string, t: TaskDTO) => (
                <div style={{ minWidth: 220 }}>
                  <span style={{ fontWeight: 500 }}>{title}</span>
                  {t.approvalPending && <> <Chip color="var(--warn)">Awaiting approval</Chip></>}
                </div>
              ),
            },
            {
              title: "Project",
              dataIndex: "projectName",
              key: "projectName",
            },
            {
              title: "Module",
              dataIndex: "subModule",
              key: "subModule",
              className: "muted",
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              render: (status: TaskDTO["status"]) => {
                const st = STATUS_MAP[status];
                return <Chip color={st?.color ?? "var(--hold)"} dot>{st?.label ?? status}</Chip>;
              },
            },
            {
              title: "Developers",
              dataIndex: "assigneeNames",
              key: "assigneeNames",
              render: (names: string[]) => names?.join(", ") || <span className="muted">Unassigned</span>,
            },
            {
              title: "Priority",
              dataIndex: "priority",
              key: "priority",
              render: (p: string) => p ? <Chip color={PRIORITY_COLOR[p as keyof typeof PRIORITY_COLOR] ?? "var(--info)"}>{p}</Chip> : null,
            },
            {
              title: "Due",
              dataIndex: "dueDate",
              key: "dueDate",
              className: "mono",
              render: (dueDate: string, t: TaskDTO) => {
                const late = dueDate && dueDate < now && t.status !== "done";
                return <span style={{ color: late ? "var(--bad)" : undefined, whiteSpace: "nowrap" }}>{fmtDay(dueDate)}</span>;
              },
            },
            {
              title: "Progress",
              key: "progress",
              className: "num",
              width: 130,
              render: (_: unknown, t: TaskDTO) => {
                const prog = t.status === "done" ? 100 : t.progress ?? 0;
                return (
                  <div className="progress">
                    <div className="bar"><i style={{ width: prog + "%" }} /></div>
                    <span className="mono">{prog}%</span>
                  </div>
                );
              },
            },
            {
              title: "Actions",
              key: "actions",
              align: "right",
              width: 110,
              render: (_: unknown, t: TaskDTO) => (
                <RecordActions
                  onView={() => setViewing(t)}
                  onEdit={canEdit ? () => setOpen(t.id) : undefined}
                  onDelete={
                    canManage
                      ? async () => {
                          const r = await deleteTask(t.id);
                          if (!r.ok) {
                            toast(r.error ?? "Failed to delete task");
                          } else {
                            toast(`Task #${t.sno} deleted`);
                          }
                        }
                      : undefined
                  }
                  deleteConfirmTitle={`Delete Task #${t.sno}?`}
                  deleteConfirmMessage={`Are you sure you want to delete task #${t.sno} "${t.title}"? All logged time entries, assignees, and history events will be deleted.`}
                  canEdit={canEdit}
                  canDelete={canManage}
                />
              ),
            },
          ];

          return (
            <AntTable<TaskDTO>
              dataSource={tasks}
              columns={columns}
              rowKey="id"
              onRowClick={t => setViewing(t)}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
              }}
              emptyTitle={filtered ? "No tasks match these filters" : "No tasks yet"}
              emptyDescription={filtered ? "Try clearing a filter or searching for another term." : "Add the first development task to start tracking."}
              emptyAction={canEdit ? <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ New task</button> : undefined}
            />
          );
        })()
      )}

      {viewing && (
        <TaskDetailModal
          task={viewing}
          canEdit={canEdit}
          canDelete={canManage}
          onEdit={() => {
            const id = viewing.id;
            setViewing(null);
            setOpen(id);
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {editing !== null && (
        <TaskForm
          key={editing === "new" ? `new-${newStatusPreset ?? "default"}` : editing.id}
          task={editing === "new" ? null : editing}
          lookups={lookups}
          defaultProjectId={defaultProjectId}
          defaultStatus={newStatusPreset}
          canEdit={canEdit}
          canDelete={canManage}
          viewerDeveloperId={viewerDeveloperId}
          onClose={() => {
            setNewStatusPreset(undefined);
            setOpen(null);
          }}
        />
      )}

      {importing && (
        <TaskImportModal
          projects={lookups.projects}
          defaultProjectId={defaultProjectId}
          onClose={() => setImporting(false)}
        />
      )}
    </>
  );
}
