"use client";
import Link from "next/link";
import { useState } from "react";
import { projectColor } from "@/lib/constants";
import { Chip } from "@/components/ui/Chip";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { EntityEditor, type FieldDef } from "@/components/ui/EntityEditor";
import { RecordActions } from "@/components/ui/RecordActions";
import { ProjectDetailModal } from "./ProjectDetailModal";
import { toast } from "@/components/ui/Toaster";
import { deleteProject, saveProject } from "@/server/projects";

type Row = { id: string; name: string; code: string; fullName: string; phase: string; target: string; lead: string; total: number; done: number };
type Form = { name: string; code: string; fullName: string; phase: string; target: string; lead: string };

const FIELDS: FieldDef<Form>[] = [
  { key: "name", label: "Name", required: true, placeholder: "SAP B1" },
  { key: "code", label: "Code", placeholder: "SAP (used in task keys)" },
  { key: "fullName", label: "Full name", full: true, placeholder: "SAP Business One customisation" },
  { key: "phase", label: "Phase", placeholder: "Build, UAT, Live…" },
  { key: "target", label: "Target", placeholder: "Go-live date or quarter" },
  { key: "lead", label: "Lead", full: true },
];

export function ProjectsView({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const [open, setOpen] = useState<Row | "new" | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const cur = open && open !== "new" ? open : null;
  return (
    <>
      {canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add project</button>
        </div>
      )}
      {(() => {
        const columns: ColumnsType<Row> = [
          {
            title: "Project",
            dataIndex: "name",
            key: "name",
            render: (name: string, r: Row) => (
              <div>
                <Chip color={projectColor(name)} dot>{name}</Chip>
                {r.fullName && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{r.fullName}</div>}
              </div>
            ),
          },
          {
            title: "Code",
            dataIndex: "code",
            key: "code",
            className: "mono",
          },
          {
            title: "Phase",
            dataIndex: "phase",
            key: "phase",
          },
          {
            title: "Target",
            dataIndex: "target",
            key: "target",
          },
          {
            title: "Lead",
            dataIndex: "lead",
            key: "lead",
          },
          {
            title: "Tasks",
            dataIndex: "total",
            key: "total",
            className: "num",
            align: "right",
            render: (total: number, r: Row) => (
              <Link href={`/tasks?project=${r.id}`} onClick={e => e.stopPropagation()}>{total}</Link>
            ),
          },
          {
            title: "Delivered",
            key: "delivered",
            width: 170,
            render: (_: unknown, r: Row) => {
              const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
              return (
                <div className="progress">
                  <div className="bar"><i style={{ width: pct + "%" }} /></div>
                  <span className="mono">{pct}%</span>
                </div>
              );
            },
          },
          {
            title: "Actions",
            key: "actions",
            align: "right" as const,
            width: 110,
            render: (_: unknown, r: Row) => (
              <RecordActions
                onView={() => setViewing(r)}
                onEdit={canManage ? () => setOpen(r) : undefined}
                onDelete={
                  canManage
                    ? async () => {
                        const res = await deleteProject(r.id);
                        if (!res.ok) {
                          toast(res.error ?? "Failed to delete project");
                        } else {
                          toast(`Project ${r.name} deleted`);
                        }
                      }
                    : undefined
                }
                deleteConfirmTitle={`Delete project ${r.name}?`}
                deleteConfirmMessage={
                  r.total > 0
                    ? `Cannot delete project with ${r.total} existing task(s). Move or delete the tasks first.`
                    : `Are you sure you want to delete project ${r.name}? This action cannot be undone.`
                }
                canEdit={canManage}
                canDelete={canManage}
              />
            ),
          },
        ];

        return (
          <AntTable<Row>
            dataSource={rows}
            columns={columns}
            rowKey="id"
            onRowClick={r => setViewing(r)}
            pagination={false}
            emptyTitle="No projects configured"
            emptyDescription="Add the modules or systems you are building to track tasks and progress."
            emptyAction={canManage ? <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add project</button> : undefined}
          />
        );
      })()}
      {viewing && (
        <ProjectDetailModal
          project={viewing}
          canManage={canManage}
          onEdit={() => {
            const p = viewing;
            setViewing(null);
            setOpen(p);
          }}
          onClose={() => setViewing(null)}
        />
      )}
      {open && (
        <EntityEditor<Form>
          key={cur?.id ?? "new"}
          title={cur ? "Edit project" : "New project"}
          isNew={!cur}
          fields={FIELDS}
          initial={{ name: cur?.name ?? "", code: cur?.code ?? "", fullName: cur?.fullName ?? "", phase: cur?.phase ?? "", target: cur?.target ?? "", lead: cur?.lead ?? "" }}
          onSave={v => saveProject({ ...v, id: cur?.id })}
          onDelete={cur ? () => deleteProject(cur.id) : undefined}
          deleteLabel={cur ? `Delete project ${cur.name}?` : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
