"use client";
import React from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { deleteCompany } from "@/server/companies";
import { toast } from "@/components/ui/Toaster";
import { projectColor } from "@/lib/constants";

export type CompanyRow = {
  id: string;
  name: string;
  country: string;
  code: string;
  sapDb: string;
  branches: string[];
  notes: string;
  holding: boolean;
  parentId: string;
  users: number;
  licencesHeld: number;
  access: Record<string, number>;
  devItems: number;
};

type Props = {
  company: CompanyRow;
  parentName?: string;
  projects: { id: string; name: string }[];
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export function CompanyDetailModal({ company, parentName, projects, canManage, onEdit, onClose }: Props) {
  const handleDelete = async () => {
    const r = await deleteCompany(company.id);
    if (!r.ok) {
      toast(r.error ?? "Failed to delete company");
      return;
    }
    toast(`Company ${company.name} deleted`);
  };

  return (
    <RecordDetailModal
      title={company.name}
      subtitle={company.country ? `${company.country}${company.code ? ` · ${company.code}` : ""}` : company.code || undefined}
      badges={
        <>
          {company.code && <span className="mono muted font-semibold">[{company.code}]</span>}
          {company.country && <Chip color="var(--info)">{company.country}</Chip>}
          <Chip color={company.holding ? "var(--accent)" : "var(--muted)"}>
            {company.holding ? "Holding company" : "Subsidiary"}
          </Chip>
        </>
      }
      onClose={onClose}
      onEdit={canManage ? onEdit : undefined}
      onDelete={canManage ? handleDelete : undefined}
      canEdit={canManage}
      canDelete={canManage}
      deleteConfirmTitle={`Delete company ${company.name}?`}
      deleteConfirmMessage={`Are you sure you want to delete ${company.name}? Tasks, people, and licences linked to it will remain, without a company.`}
      extraFooter={
        <Link className="btn" href={`/users?comp=${company.id}`} onClick={onClose}>
          View people ({company.users})
        </Link>
      }
      sections={[
        {
          title: "Company Details",
          items: [
            { label: "Company Name", value: company.name },
            { label: "Short Code", value: company.code ? <span className="mono">{company.code}</span> : "—" },
            { label: "Country", value: company.country || "—" },
            { label: "SAP B1 Database", value: company.sapDb ? <span className="mono">{company.sapDb}</span> : "—" },
            { label: "Holding Company", value: company.holding ? "Yes" : "No" },
            { label: "Part Of (Parent)", value: parentName || "—" },
            {
              label: "Branches / Divisions",
              value: company.branches.length > 0 ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {company.branches.map((b, idx) => (
                    <Chip key={idx} color="var(--muted)">{b}</Chip>
                  ))}
                </div>
              ) : (
                "—"
              ),
              full: true,
            },
          ],
        },
        {
          title: "Footprint & Usage",
          items: [
            {
              label: "People in Register",
              value: (
                <Link href={`/users?comp=${company.id}`} style={{ fontWeight: 600 }}>
                  {company.users} {company.users === 1 ? "person" : "people"}
                </Link>
              ),
            },
            { label: "Licences Held", value: String(company.licencesHeld) },
            { label: "Open Dev Items", value: String(company.devItems) },
            {
              label: "System Access Breakdown",
              value: projects.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {projects.map(p => (
                    <span key={p.id} className="mtag" style={{ ["--mc" as string]: projectColor(p.name) }}>
                      {p.name}: {company.access[p.id] ?? 0}
                    </span>
                  ))}
                </div>
              ) : (
                "—"
              ),
              full: true,
            },
          ],
        },
        ...(company.notes
          ? [
              {
                title: "Notes",
                items: [{ label: "Notes", value: company.notes, full: true }],
              },
            ]
          : []),
      ]}
    />
  );
}
