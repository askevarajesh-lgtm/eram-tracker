"use client";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PRIORITY_COLOR, STATUS_MAP } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import type { Lookups } from "@/server/queries";
import { renumberTasks } from "@/server/tasks";
import { toast } from "@/components/ui/Toaster";
import { Chip } from "@/components/ui/Chip";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { TaskForm } from "./TaskForm";
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
};

const PAGE = 100;

export function TasksView({ tasks, lookups, filtered, canEdit, canManage, openNew, openId, defaultProjectId, viewerDeveloperId = null }: Props) {
  const sp = useSearchParams();
  const { update } = useUrlUpdate();
  const [limit, setLimit] = useState(PAGE);
  const [busy, start] = useTransition();

  // which task is open in the side panel is kept in the URL (?edit=<id> or ?new=1)
  const editing = openNew ? "new" : openId ? tasks.find(t => t.id === openId) ?? null : null;
  const setOpen = (v: string | null) => update({ new: v === "new" ? "1" : null, edit: v && v !== "new" ? v : null });

  const now = today();
  const shown = useMemo(() => tasks.slice(0, limit), [tasks, limit]);

  const renumber = () => {
    if (!confirm("Renumber S.No 1, 2, 3… in every project, keeping the current order?")) return;
    start(async () => {
      const r = await renumberTasks(sp.get("project") && sp.get("project") !== "_none" ? sp.get("project") : undefined);
      toast(r.ok ? (r.data!.changed ? `Renumbered: ${r.data!.changed} of ${r.data!.total} tasks got a new S.No` : "Already in order, nothing changed") : r.error);
    });
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span className="muted">{tasks.length} task{tasks.length === 1 ? "" : "s"}{filtered ? " match the filters" : ""}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {canManage && <button className="btn" type="button" onClick={renumber} disabled={busy}>Renumber S.No</button>}
          {canEdit && <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ New task</button>}
        </div>
      </div>

      {(() => {
        const columns: ColumnsType<TaskDTO> = [
          {
            title: "S.No",
            dataIndex: "sno",
            key: "sno",
            className: "num mono",
            width: 75,
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
        ];

        return (
          <AntTable<TaskDTO>
            dataSource={tasks}
            columns={columns}
            rowKey="id"
            onRowClick={t => setOpen(t.id)}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            emptyTitle={filtered ? "No tasks match these filters" : "No tasks yet"}
            emptyDescription={filtered ? "Try clearing a filter or searching for another term." : "Add the first development task to start tracking."}
            emptyAction={canEdit ? <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ New task</button> : undefined}
          />
        );
      })()}

      {editing !== null && (
        <TaskForm
          key={editing === "new" ? "new" : editing.id}
          task={editing === "new" ? null : editing}
          lookups={lookups}
          defaultProjectId={defaultProjectId}
          canEdit={canEdit}
          canDelete={canManage}
          viewerDeveloperId={viewerDeveloperId}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
