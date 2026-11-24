"use client";
import React from "react";
import Link from "next/link";
import { projectColor } from "@/lib/constants";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { deleteProject } from "@/server/projects";
import { toast } from "@/components/ui/Toaster";

export type ProjectRow = {
  id: string;
  name: string;
  code: string;
  fullName: string;
  phase: string;
  target: string;
  lead: string;
  total: number;
  done: number;
};

type Props = {
  project: ProjectRow;
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export function ProjectDetailModal({ project, canManage, onEdit, onClose }: Props) {
  const pct = project.total ? Math.round((project.done / project.total) * 100) : 0;

  const handleDelete = async () => {
    const r = await deleteProject(project.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete project");
      return;
    }
    toast(`Project ${project.name} deleted`);
  };

  return (
    <RecordDetailModal
      title={project.name}
      subtitle={project.fullName || undefined}
      badges={
        <>
          <Chip color={projectColor(project.name)} dot>
            {project.name}
          </Chip>
          {project.code && <span className="mono muted font-semibold">[{project.code}]</span>}
          {project.phase && <Chip color="var(--accent)">{project.phase}</Chip>}
        </>
      }
      onClose={onClose}
      onEdit={canManage ? onEdit : undefined}
      onDelete={canManage ? handleDelete : undefined}
      canEdit={canManage}
      canDelete={canManage}
      deleteConfirmTitle={`Delete project ${project.name}?`}
      deleteConfirmMessage={
        project.total > 0
          ? `Cannot delete project with ${project.total} existing task(s). Move or delete the tasks first.`
          : `Are you sure you want to delete project ${project.name}? This action cannot be undone.`
      }
      extraFooter={
        <Link className="btn" href={`/tasks?project=${project.id}`} onClick={onClose}>
          View tasks ({project.total})
        </Link>
      }
      sections={[
        {
          title: "Project Information",
          items: [
            { label: "Project Name", value: project.name },
            { label: "Project Code", value: <span className="mono">{project.code || "—"}</span> },
            { label: "Full Name", value: project.fullName || "—", full: true },
            { label: "Phase", value: project.phase || "—" },
            { label: "Target Go-Live", value: project.target || "—" },
            { label: "Project Lead", value: project.lead || "—" },
          ],
        },
        {
          title: "Tasks & Delivery Status",
          items: [
            {
              label: "Tasks Count",
              value: (
                <Link href={`/tasks?project=${project.id}`} style={{ fontWeight: 600 }}>
                  {project.total} task{project.total === 1 ? "" : "s"}
                </Link>
              ),
            },
            {
              label: "Delivered",
              value: `${project.done} of ${project.total} completed`,
            },
            {
              label: "Overall Progress",
              value: (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="progress" style={{ width: 140 }}>
                    <div className="bar">
                      <i style={{ width: pct + "%" }} />
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {pct}%
                  </span>
                </div>
              ),
              full: true,
            },
          ],
        },
      ]}
    />
  );
}
