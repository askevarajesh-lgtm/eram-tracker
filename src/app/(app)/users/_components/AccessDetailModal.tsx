"use client";
import React from "react";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { deleteAccessRecord } from "@/server/access";
import { toast } from "@/components/ui/Toaster";
import type { LicencePool } from "@/server/queries";
import type { AccessRow, ProjectCard } from "./types";

type Props = {
  record: AccessRow;
  projects: ProjectCard[];
  pools: LicencePool[];
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export function AccessDetailModal({ record, projects, pools, canManage, onEdit, onClose }: Props) {
  const heldLicences = pools.filter(p => record.licenceIds.includes(p.id));
  const grantedProjects = projects.filter(p => record.apps.some(a => a.projectId === p.id));

  const handleDelete = async () => {
    const r = await deleteAccessRecord(record.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete person");
      return;
    }
    toast(`${record.name} deleted. Any allocated licences are freed.`);
  };

  return (
    <RecordDetailModal
      title={record.name}
      subtitle={record.designation ? `${record.designation}${record.dept ? " · " + record.dept : ""}` : record.dept || undefined}
      badges={
        <>
          <Chip color={record.status === "Inactive" ? "var(--hold)" : "var(--ok)"}>
            {record.status}
          </Chip>
          <Chip color="var(--lms)">{record.userType}</Chip>
          {record.companyName && <Chip color="var(--muted)">{record.companyName}</Chip>}
        </>
      }
      onClose={onClose}
      onEdit={canManage ? onEdit : undefined}
      onDelete={canManage ? handleDelete : undefined}
      canEdit={canManage}
      canDelete={canManage}
      deleteConfirmTitle={`Delete ${record.name}?`}
      deleteConfirmMessage={`Are you sure you want to delete ${record.name} from Users & access? Any allocated licences will be freed up.`}
      sections={[
        {
          title: "Personal & Organization Details",
          items: [
            { label: "Full Name", value: record.name },
            { label: "Email Address", value: record.email || "—" },
            { label: "SAP User Code", value: record.sapCode ? <span className="mono">{record.sapCode}</span> : "—" },
            { label: "Designation", value: record.designation || "—" },
            { label: "Department", value: record.dept || "—" },
            { label: "Company", value: record.companyName || "—" },
            { label: "Branch", value: record.branch || "—" },
            { label: "User Classification", value: record.userType },
            { label: "Status", value: record.status },
          ],
        },
        {
          title: "Systems Access",
          items: [
            {
              label: "Granted Systems",
              value: grantedProjects.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {grantedProjects.map(p => {
                    const app = record.apps.find(a => a.projectId === p.id);
                    return (
                      <span key={p.id} className="mtag" style={{ ["--mc" as string]: p.color }}>
                        {p.name} {app?.role ? `(${app.role})` : ""}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="muted">No system access granted</span>
              ),
              full: true,
            },
          ],
        },
        {
          title: "Allocated Licences",
          items: [
            {
              label: "Licences Held",
              value: heldLicences.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {heldLicences.map(lic => (
                    <div key={lic.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{lic.software}</span>
                      <span>—</span>
                      <span>{lic.type}</span>
                      <Chip color="var(--muted)">{lic.model || "Perpetual"}</Chip>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="muted">No licences currently allocated</span>
              ),
              full: true,
            },
          ],
        },
      ]}
    />
  );
}
