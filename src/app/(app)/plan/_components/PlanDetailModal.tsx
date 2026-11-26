"use client";
import React from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";
import { deletePlanItem } from "@/server/plan";
import { toast } from "@/components/ui/Toaster";
import { projectColor } from "@/lib/constants";
import { fmtDay } from "@/lib/dates";
import { MILESTONE_COLOR, milestoneStatus } from "@/lib/plan";

export type Milestone = { id: string; title: string; projectId: string; target: string; status: string; doneOn: string; owner: string; note: string };
export type Change = { id: string; title: string; description: string; projectId: string; subModule: string; requestedBy: string; companyId: string; priority: string; effort: string; status: string; decisionBy: string; decidedAt: string; taskId: string; taskSno: number | null };
export type Release = { id: string; version: string; projectId: string; date: string; status: string; notes: string; taskIds: string[] };
export type Risk = { id: string; type: string; status: string; title: string; projectId: string; companyId: string; impact: string; likelihood: string; owner: string; dueDate: string; mitigation: string };

export type ViewingPlanItem =
  | { kind: "milestone"; item: Milestone }
  | { kind: "change"; item: Change }
  | { kind: "release"; item: Release }
  | { kind: "risk"; item: Risk };

const CR_COLOR: Record<string, string> = { Submitted: "var(--warn)", "Under review": "var(--info)", Approved: "var(--ok)", Converted: "var(--ok)", Rejected: "var(--bad)" };

type Props = {
  viewing: ViewingPlanItem;
  projects: { id: string; name: string }[];
  companies: { id: string; name: string; country: string }[];
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
};

export function PlanDetailModal({ viewing, projects, companies, canManage, onEdit, onClose }: Props) {
  const projName = (id: string) => projects.find(p => p.id === id)?.name || "—";
  const compName = (id: string) => companies.find(c => c.id === id)?.name || "—";

  if (viewing.kind === "milestone") {
    const m = viewing.item;
    const st = milestoneStatus(m);
    return (
      <RecordDetailModal
        title={m.title}
        subtitle={m.projectId ? projName(m.projectId) : "No project"}
        badges={
          <>
            <Chip color={MILESTONE_COLOR[st]}>{st}</Chip>
            {m.projectId && <Chip color={projectColor(projName(m.projectId))}>{projName(m.projectId)}</Chip>}
          </>
        }
        onClose={onClose}
        onEdit={canManage ? onEdit : undefined}
        onDelete={
          canManage
            ? async () => {
                const r = await deletePlanItem("milestone", m.id);
                if (!r.ok) toast(r.error ?? "Failed to delete milestone");
                else toast("Milestone deleted");
              }
            : undefined
        }
        canEdit={canManage}
        canDelete={canManage}
        deleteConfirmTitle={`Delete milestone "${m.title}"?`}
        deleteConfirmMessage="Are you sure you want to delete this milestone? This action cannot be undone."
        sections={[
          {
            title: "Milestone Details",
            items: [
              { label: "Milestone", value: m.title, full: true },
              { label: "Project", value: projName(m.projectId) },
              { label: "Status", value: <Chip color={MILESTONE_COLOR[st]}>{st}</Chip> },
              { label: "Target Date", value: fmtDay(m.target) || "—" },
              { label: "Done On", value: fmtDay(m.doneOn) || "—" },
              { label: "Owner", value: m.owner || "—" },
              { label: "Note", value: m.note || "—", full: true },
            ],
          },
        ]}
      />
    );
  }

  if (viewing.kind === "change") {
    const c = viewing.item;
    return (
      <RecordDetailModal
        title={`${c.id}: ${c.title}`}
        subtitle={c.decidedAt ? `Decided by ${c.decisionBy} on ${fmtDay(c.decidedAt.slice(0, 10))}` : undefined}
        badges={
          <>
            <Chip color={CR_COLOR[c.status] ?? "var(--muted)"}>{c.status}</Chip>
            <Chip color="var(--info)">{c.priority || "Medium"}</Chip>
            {c.projectId && <Chip color={projectColor(projName(c.projectId))}>{projName(c.projectId)}</Chip>}
          </>
        }
        onClose={onClose}
        onEdit={canManage ? onEdit : undefined}
        onDelete={
          canManage
            ? async () => {
                const r = await deletePlanItem("change", c.id);
                if (!r.ok) toast(r.error ?? "Failed to delete change request");
                else toast(`Change request ${c.id} deleted`);
              }
            : undefined
        }
        canEdit={canManage}
        canDelete={canManage}
        deleteConfirmTitle={`Delete ${c.id}?`}
        deleteConfirmMessage={`Are you sure you want to delete change request ${c.id} "${c.title}"? This action cannot be undone.`}
        extraFooter={
          c.taskId ? (
            <Link className="btn" href={`/tasks?view=${c.taskId}`} onClick={onClose}>
              Open task #{c.taskSno}
            </Link>
          ) : undefined
        }
        sections={[
          {
            title: "Change Request Details",
            items: [
              { label: "CR ID", value: <span className="mono font-semibold">{c.id}</span> },
              { label: "Status", value: <Chip color={CR_COLOR[c.status] ?? "var(--muted)"}>{c.status}</Chip> },
              { label: "Project", value: projName(c.projectId) },
              { label: "Module / Area", value: c.subModule || "—" },
              { label: "Company", value: compName(c.companyId) },
              { label: "Requested By", value: c.requestedBy || "—" },
              { label: "Priority", value: c.priority || "Medium" },
              { label: "Estimated Effort", value: c.effort || "—" },
              { label: "Description & Reason", value: c.description || "No details entered.", full: true },
            ],
          },
        ]}
      />
    );
  }

  if (viewing.kind === "release") {
    const r = viewing.item;
    const color = r.status === "Released" ? "var(--ok)" : "var(--info)";
    return (
      <RecordDetailModal
        title={`Release ${r.version}`}
        subtitle={r.projectId ? projName(r.projectId) : "No project"}
        badges={
          <>
            <Chip color={color}>{r.status}</Chip>
            {r.projectId && <Chip color={projectColor(projName(r.projectId))}>{projName(r.projectId)}</Chip>}
          </>
        }
        onClose={onClose}
        onEdit={canManage ? onEdit : undefined}
        onDelete={
          canManage
            ? async () => {
                const res = await deletePlanItem("release", r.id);
                if (!res.ok) toast(res.error ?? "Failed to delete release");
                else toast(`Release ${r.version} deleted`);
              }
            : undefined
        }
        canEdit={canManage}
        canDelete={canManage}
        deleteConfirmTitle={`Delete release ${r.version}?`}
        deleteConfirmMessage={`Are you sure you want to delete release ${r.version}? This action cannot be undone.`}
        sections={[
          {
            title: "Release Details",
            items: [
              { label: "Version", value: <span className="mono font-semibold">{r.version}</span> },
              { label: "Status", value: <Chip color={color}>{r.status}</Chip> },
              { label: "Project", value: projName(r.projectId) },
              { label: "Release Date", value: fmtDay(r.date) || "—" },
              { label: "Items Included", value: `${r.taskIds.length} item${r.taskIds.length === 1 ? "" : "s"}` },
              { label: "Release Notes", value: r.notes || "No release notes entered.", full: true },
            ],
          },
        ]}
      />
    );
  }

  const r = viewing.item;
  const impColor = { High: "var(--bad)", Medium: "var(--warn)", Low: "var(--info)" }[r.impact] ?? "var(--muted)";
  return (
    <RecordDetailModal
      title={r.title}
      subtitle={r.type}
      badges={
        <>
          <Chip color={impColor}>{r.impact} impact</Chip>
          <Chip color="var(--muted)">{r.status}</Chip>
          {r.projectId && <Chip color={projectColor(projName(r.projectId))}>{projName(r.projectId)}</Chip>}
        </>
      }
      onClose={onClose}
      onEdit={canManage ? onEdit : undefined}
      onDelete={
        canManage
          ? async () => {
              const res = await deletePlanItem("risk", r.id);
              if (!res.ok) toast(res.error ?? "Failed to delete item");
              else toast(`${r.type} deleted`);
            }
          : undefined
      }
      canEdit={canManage}
      canDelete={canManage}
      deleteConfirmTitle={`Delete ${r.type.toLowerCase()} "${r.title}"?`}
      deleteConfirmMessage="Are you sure you want to delete this item? This action cannot be undone."
      sections={[
        {
          title: `${r.type} Details`,
          items: [
            { label: "Type", value: r.type },
            { label: "Status", value: r.status },
            { label: "Project", value: projName(r.projectId) },
            { label: "Company", value: compName(r.companyId) },
            { label: "Impact", value: <Chip color={impColor}>{r.impact}</Chip> },
            { label: "Likelihood", value: r.likelihood },
            { label: "Owner", value: r.owner || "—" },
            { label: "Resolve By", value: fmtDay(r.dueDate) || "—" },
            { label: "Mitigation / Next Step", value: r.mitigation || "No mitigation entered.", full: true },
          ],
        },
      ]}
    />
  );
}
