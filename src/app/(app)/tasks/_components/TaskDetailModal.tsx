"use client";
import React from "react";
import { STATUS_MAP, PRIORITY_COLOR, projectColor } from "@/lib/constants";
import { fmtDay } from "@/lib/dates";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { deleteTask } from "@/server/tasks";
import { toast } from "@/components/ui/Toaster";
import type { TaskDTO } from "./types";

type Props = {
  task: TaskDTO;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export function TaskDetailModal({ task, canEdit, canDelete, onEdit, onClose }: Props) {
  const st = STATUS_MAP[task.status];
  const prog = task.status === "done" ? 100 : task.progress ?? 0;

  const handleDelete = async () => {
    const r = await deleteTask(task.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete task");
      return;
    }
    toast(`Task #${task.sno} deleted`);
  };

  return (
    <RecordDetailModal
      title={`Task #${task.sno}: ${task.title}`}
      subtitle={`Last updated: ${task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "—"}`}
      badges={
        <>
          <Chip color={st?.color ?? "var(--hold)"} dot>
            {st?.label ?? task.status}
          </Chip>
          {task.priority && (
            <Chip color={PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR] ?? "var(--info)"}>
              {task.priority}
            </Chip>
          )}
          {task.projectName && (
            <Chip color={projectColor(task.projectName)}>
              {task.projectName}
            </Chip>
          )}
          {task.subModule && <span className="muted mono">{task.subModule}</span>}
          {task.approvalPending && <Chip color="var(--warn)">Awaiting approval</Chip>}
        </>
      }
      onClose={onClose}
      onEdit={canEdit ? onEdit : undefined}
      onDelete={canDelete ? handleDelete : undefined}
      canEdit={canEdit}
      canDelete={canDelete}
      deleteConfirmTitle={`Delete Task #${task.sno}?`}
      deleteConfirmMessage={`Are you sure you want to delete task #${task.sno} "${task.title}"? All logged time entries, assignees, and history events will be deleted.`}
      sections={[
        {
          title: "Development & Assignment",
          items: [
            { label: "Project", value: task.projectName || "—" },
            { label: "Module / Area", value: task.subModule || "—" },
            { label: "Type", value: task.type || "—" },
            { label: "Requirement Status", value: task.reqStatus || "—" },
            {
              label: "Assigned Developers",
              value: task.assigneeNames.length ? task.assigneeNames.join(", ") : "Unassigned",
            },
            { label: "Tech Lead", value: task.lead || "—" },
            { label: "Version / Release", value: task.version || "—" },
            { label: "Size Estimate", value: task.size || "—" },
          ],
        },
        {
          title: "Schedule & Progress",
          items: [
            {
              label: "Progress",
              value: (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="progress" style={{ width: 120 }}>
                    <div className="bar"><i style={{ width: prog + "%" }} /></div>
                  </div>
                  <span className="mono" style={{ fontSize: 12 }}>{prog}%</span>
                </div>
              ),
            },
            { label: "Estimated Hours", value: task.estHours != null ? `${task.estHours} h` : "—" },
            { label: "Start Date", value: fmtDay(task.startDate) || "—" },
            { label: "Due Date", value: fmtDay(task.dueDate) || "—" },
            { label: "Completed Date", value: fmtDay(task.completedDate) || "—" },
          ],
        },
        {
          title: "Organization & Testing",
          items: [
            { label: "Company", value: task.companyLabel || "—" },
            { label: "Branch", value: task.branch || "—" },
            { label: "Business End Users", value: task.endUsers || "—" },
            { label: "Testing Status", value: task.testStatus || "—" },
            { label: "Acceptance Status", value: task.acceptStatus || "—" },
          ],
        },
        {
          title: "Details & Notes",
          items: [
            { label: "Description", value: task.description || "No description entered.", full: true },
            { label: "Notes", value: task.notes || "No notes entered.", full: true },
          ],
        },
      ]}
    />
  );
}
