"use client";
import { useState, useTransition, useEffect, useMemo, type DragEvent, type MouseEvent } from "react";
import { Clock, Eye, Edit3, Plus } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { TASK_STATUSES, STATUS_MAP, PRIORITY_COLOR, projectColor } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import { Chip } from "@/components/ui/Chip";
import { toast } from "@/components/ui/Toaster";
import { updateTaskStatus } from "@/server/tasks";
import type { TaskDTO } from "./types";

type Props = {
  tasks: TaskDTO[];
  canEdit: boolean;
  canManage: boolean;
  viewerDeveloperId?: string | null;
  onView: (task: TaskDTO) => void;
  onEdit: (taskId: string) => void;
  onNewInStatus: (status: TaskStatus) => void;
};

export function TaskKanbanView({
  tasks,
  canEdit,
  canManage,
  viewerDeveloperId = null,
  onView,
  onEdit,
  onNewInStatus,
}: Props) {
  // Local state to provide instant optimistic feedback on drag-and-drop or status change
  const [localTasks, setLocalTasks] = useState<TaskDTO[]>(tasks);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync whenever incoming tasks prop changes
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const now = today();

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, TaskDTO[]>();
    for (const st of TASK_STATUSES) {
      map.set(st.key, []);
    }
    for (const t of localTasks) {
      const list = map.get(t.status);
      if (list) {
        list.push(t);
      } else {
        // Fallback for unexpected status
        const pendingList = map.get("pending");
        if (pendingList) pendingList.push(t);
      }
    }
    return map;
  }, [localTasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const currentTask = localTasks.find((t) => t.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    const prevStatus = currentTask.status;
    const targetStatusMeta = STATUS_MAP[newStatus];

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              progress: newStatus === "done" ? 100 : t.progress,
            }
          : t,
      ),
    );

    startTransition(async () => {
      const res = await updateTaskStatus(taskId, newStatus);
      if (!res.ok) {
        // Rollback on error
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t)),
        );
        toast(res.error ?? "Failed to update task status");
      } else {
        toast(`Task #${currentTask.sno} moved to ${targetStatusMeta?.label ?? newStatus}`);
      }
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, task: TaskDTO) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== status) {
      setDragOverCol(status);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    // Only clear if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverCol === status) {
      setDragOverCol(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
    setDraggingTaskId(null);
    if (taskId) {
      handleStatusChange(taskId, status);
    }
  };

  return (
    <div className="kanban-board" role="region" aria-label="Tasks Kanban Board">
      {TASK_STATUSES.map((col) => {
        const colTasks = tasksByStatus.get(col.key) ?? [];
        const isDropTarget = dragOverCol === col.key;

        return (
          <div
            key={col.key}
            className={`kanban-col ${isDropTarget ? "is-drop-target" : ""}`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={(e) => handleDragLeave(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column Header */}
            <div className="kanban-col-head">
              <div className="kanban-col-title">
                <i className="dot" style={{ background: col.color, width: 9, height: 9, borderRadius: "50%", display: "inline-block" }} />
                <span>{col.label}</span>
                <span className="kanban-col-count">{colTasks.length}</span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  className="kanban-col-add-btn"
                  title={`Add task in ${col.label}`}
                  aria-label={`Add task in ${col.label}`}
                  onClick={() => onNewInStatus(col.key)}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {/* Column Body / Cards List */}
            <div className="kanban-col-body">
              {colTasks.length === 0 ? (
                <div className="kanban-empty-drop">
                  <span>No tasks</span>
                  {canEdit && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Drop tasks here or click + above
                    </span>
                  )}
                </div>
              ) : (
                colTasks.map((t) => {
                  const isTaskOwnerOrManager =
                    canManage ||
                    (viewerDeveloperId ? t.assigneeIds.includes(viewerDeveloperId) : false);
                  const isDraggable = canEdit && (canManage || isTaskOwnerOrManager);
                  const isDragging = draggingTaskId === t.id;
                  const isLate = t.dueDate && t.dueDate < now && t.status !== "done";
                  const prog = t.status === "done" ? 100 : t.progress ?? 0;

                  return (
                    <div
                      key={t.id}
                      draggable={isDraggable}
                      onDragStart={(e) => handleDragStart(e, t)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onView(t)}
                      className={`kanban-card ${isDragging ? "is-dragging" : ""}`}
                      style={{
                        borderLeft: `3px solid ${col.color}`,
                        cursor: isDraggable ? "grab" : "pointer",
                      }}
                    >
                      {/* Top Row: S.No + Priority + Badges + Quick Actions */}
                      <div className="kanban-card-head">
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span className="kanban-card-sno">#{t.sno}</span>
                          {t.priority && (
                            <Chip color={PRIORITY_COLOR[t.priority as keyof typeof PRIORITY_COLOR] ?? "var(--info)"}>
                              {t.priority}
                            </Chip>
                          )}
                          {t.approvalPending && (
                            <Chip color="var(--warn)">Awaiting approval</Chip>
                          )}
                        </div>

                        {/* Hover Actions */}
                        <div className="kanban-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="kanban-act-btn"
                            title="View task details"
                            aria-label="View task details"
                            onClick={() => onView(t)}
                          >
                            <Eye size={12} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              className="kanban-act-btn"
                              title="Edit task"
                              aria-label="Edit task"
                              onClick={() => onEdit(t.id)}
                            >
                              <Edit3 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title */}
                      <div className="kanban-card-title">{t.title}</div>

                      {/* Project & Module Info */}
                      <div className="kanban-card-meta">
                        {t.projectName && (
                          <span
                            className="mtag"
                            style={{ ["--mc" as string]: projectColor(t.projectName) }}
                          >
                            {t.projectName}
                          </span>
                        )}
                        {t.subModule && (
                          <span className="muted mono" style={{ fontSize: 11 }}>
                            {t.subModule}
                          </span>
                        )}
                        {t.type && (
                          <span className="muted" style={{ fontSize: 11 }}>
                            · {t.type}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar (if > 0 or done) */}
                      {(prog > 0 || t.status === "done") && (
                        <div className="kanban-card-progress">
                          <div className="kanban-card-progress-bar">
                            <div
                              className="kanban-card-progress-fill"
                              style={{
                                width: `${prog}%`,
                                background: col.color,
                              }}
                            />
                          </div>
                          <span className="mono muted" style={{ fontSize: 11 }}>
                            {prog}%
                          </span>
                        </div>
                      )}

                      {/* Footer Row: Developers & Due Date & Status Mover */}
                      <div className="kanban-card-foot">
                        <div className="kanban-card-assignees">
                          {t.assigneeNames.length > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div
                                className="kanban-avatar"
                                title={t.assigneeNames.join(", ")}
                              >
                                {t.assigneeNames[0]
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <span style={{ fontSize: 11.5 }}>
                                {t.assigneeNames[0].split(" ")[0]}
                                {t.assigneeNames.length > 1 && (
                                  <span className="muted"> +{t.assigneeNames.length - 1}</span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 11 }}>
                              Unassigned
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {t.estHours != null && (
                            <span
                              className="mono muted"
                              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}
                              title={`Estimated effort: ${t.estHours}h`}
                            >
                              <Clock size={11} />
                              {t.estHours}h
                            </span>
                          )}

                          {t.dueDate && (
                            <span
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: isLate ? "var(--bad)" : "var(--muted)",
                                fontWeight: isLate ? 700 : "normal",
                              }}
                              title={isLate ? "Task is past due date!" : `Due: ${fmtDay(t.dueDate)}`}
                            >
                              {isLate ? "Late " : ""}
                              {fmtDay(t.dueDate)}
                            </span>
                          )}

                          {/* Quick Status Dropdown (keyboard / mobile / click friendly) */}
                          {canEdit && (
                            <select
                              className="kanban-quick-move"
                              value={t.status}
                              title="Move to another status"
                              aria-label={`Change status for task #${t.sno}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleStatusChange(t.id, e.target.value as TaskStatus)
                              }
                            >
                              {TASK_STATUSES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
