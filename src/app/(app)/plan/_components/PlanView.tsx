"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Target, GitPullRequest, Rocket, AlertTriangle } from "lucide-react";
import { deletePlanItem, saveChange, saveMilestone, saveRelease, saveRisk } from "@/server/plan";
import { projectColor } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import { MILESTONE_COLOR, milestoneStatus } from "@/lib/plan";
import { AItem, Empty, SegLinks } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { EntityEditor, type FieldDef } from "@/components/ui/EntityEditor";
import { RecordActions } from "@/components/ui/RecordActions";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntSelect, AntInput, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";
import { PlanDetailModal, type ViewingPlanItem } from "./PlanDetailModal";

type Milestone = { id: string; title: string; projectId: string; target: string; status: string; doneOn: string; owner: string; note: string };
type Change = { id: string; title: string; description: string; projectId: string; subModule: string; requestedBy: string; companyId: string; priority: string; effort: string; status: string; decisionBy: string; decidedAt: string; taskId: string; taskSno: number | null };
type Release = { id: string; version: string; projectId: string; date: string; status: string; notes: string; taskIds: string[] };
type Risk = { id: string; type: string; status: string; title: string; projectId: string; companyId: string; impact: string; likelihood: string; owner: string; dueDate: string; mitigation: string };
export type PlanData = { milestones: Milestone[]; changes: Change[]; releases: Release[]; risks: Risk[]; doneTasks: { id: string; title: string; subModule: string; projectId: string }[] };

type Props = {
  tab: "milestones" | "changes" | "releases" | "risks";
  data: PlanData;
  projects: { id: string; name: string }[];
  companies: { id: string; name: string; country: string }[];
  canManage: boolean;
  canEdit: boolean;
  openId?: string;
  openNew: boolean;
};

const CR_COLOR: Record<string, string> = { Submitted: "var(--warn)", "Under review": "var(--info)", Approved: "var(--ok)", Converted: "var(--ok)", Rejected: "var(--bad)" };
const SIZES: [string, string][] = [["S", "S · about 4 h"], ["M", "M · about 2 days"], ["L", "L · about 1 week"], ["XL", "XL · 2 weeks+"]];
const NEW_LABEL = { milestones: "Milestone", changes: "Change request", releases: "Release", risks: "Risk or dependency" };

export function PlanView({ tab, data, projects, companies, canManage, canEdit, openId, openNew }: Props) {
  const { update } = useUrlUpdate();
  const [viewing, setViewing] = useState<ViewingPlanItem | null>(null);
  const projName = (id: string) => projects.find(p => p.id === id)?.name ?? "";
  const tag = (id: string) => id ? <span className="mtag" style={{ ["--mc" as string]: projectColor(projName(id)) }}>{projName(id)}</span> : <>—</>;
  const close = () => update({ edit: null, new: null });
  const open = (id: string) => update({ edit: id });
  const projOpts = projects.map(p => [p.id, p.name] as [string, string]);
  const compOpts = companies.map(c => [c.id, c.name + (c.country ? ` (${c.country})` : "")] as [string, string]);

  const counts = { milestones: data.milestones.length, changes: data.changes.length, releases: data.releases.length, risks: data.risks.length };
  const canAdd = canManage || (tab === "changes" && canEdit);

  // ------------------------------------------------ editors
  let editor: React.ReactNode = null;
  if (openNew || openId) {
    if (tab === "milestones") {
      const x = data.milestones.find(m => m.id === openId);
      const fields: FieldDef<Record<string, string>>[] = [
        { key: "title", label: "Milestone", required: true, full: true, placeholder: "e.g. Phase 1 go-live" },
        { key: "projectId", label: "Project", type: "select", options: projOpts },
        { key: "target", label: "Target date", type: "date" },
        { key: "status", label: "Status", type: "select", options: ["Planned", "On track", "At risk", "Done"].map(s => [s, s]) },
        { key: "doneOn", label: "Done on", type: "date" },
        { key: "owner", label: "Owner" },
        { key: "note", label: "Note", type: "textarea" },
      ];
      editor = (
        <EntityEditor key={x?.id ?? "new"} title={x ? "Edit milestone" : "New milestone"} isNew={!x} fields={fields} onClose={close}
          initial={{ title: x?.title ?? "", projectId: x?.projectId ?? projects[0]?.id ?? "", target: x?.target ?? "", status: x?.status ?? "Planned", doneOn: x?.doneOn ?? "", owner: x?.owner ?? "", note: x?.note ?? "" }}
          onSave={v => saveMilestone({ ...v, id: x?.id, status: v.status as "Planned" })} onDelete={x && canManage ? () => deletePlanItem("milestone", x.id) : undefined} canSave={canManage} />
      );
    } else if (tab === "changes") {
      const x = data.changes.find(c => c.id === openId);
      const fields: FieldDef<Record<string, string>>[] = [
        { key: "title", label: "Requested change", required: true, full: true },
        { key: "description", label: "Details and reason", type: "textarea" },
        { key: "projectId", label: "Project", type: "select", options: projOpts, empty: "—" },
        { key: "subModule", label: "Module", placeholder: "Finance, HR…" },
        { key: "requestedBy", label: "Requested by" },
        { key: "companyId", label: "Company", type: "select", options: compOpts, empty: "—" },
        { key: "priority", label: "Priority", type: "select", options: ["Critical", "High", "Medium", "Low"].map(s => [s, s]) },
        { key: "effort", label: "Estimated effort", type: "select", options: SIZES, empty: "—" },
        ...(x ? [{ key: "status", label: "Status", type: "select" as const, options: ["Submitted", "Under review", "Approved", "Rejected", "Converted"].map(s => [s, s] as [string, string]) }] : []),
      ];
      editor = (
        <EntityEditor key={x?.id ?? "new"} title={x ? x.id : "New change request"} isNew={!x} fields={fields} onClose={close}
          subtitle={x?.decidedAt ? `Decided by ${x.decisionBy} on ${fmtDay(x.decidedAt.slice(0, 10))}` : undefined}
          initial={{ title: x?.title ?? "", description: x?.description ?? "", projectId: x?.projectId ?? "", subModule: x?.subModule ?? "", requestedBy: x?.requestedBy ?? "", companyId: x?.companyId ?? "", priority: x?.priority || "Medium", effort: x?.effort ?? "", status: x?.status ?? "Submitted" }}
          onSave={async v => { const r = await saveChange({ ...v, id: x?.id, status: x ? (v.status as "Submitted") : undefined }); return r.ok ? { ok: true } : r; }}
          onDelete={x && canManage ? () => deletePlanItem("change", x.id) : undefined} canSave={x ? canManage : canEdit}
          extraButtons={x?.taskId ? <Link className="btn" href={`/tasks?view=${x.taskId}`}>Open task #{x.taskSno}</Link> : undefined} />
      );
    } else if (tab === "risks") {
      const x = data.risks.find(r => r.id === openId);
      const hml = ["High", "Medium", "Low"].map(s => [s, s] as [string, string]);
      const fields: FieldDef<Record<string, string>>[] = [
        { key: "type", label: "Type", type: "select", options: ["Risk", "Dependency", "Assumption", "Decision needed"].map(s => [s, s]) },
        { key: "status", label: "Status", type: "select", options: ["Open", "Mitigating", "Closed"].map(s => [s, s]) },
        { key: "title", label: "Title", required: true, full: true, placeholder: "e.g. Qatar setup waiting on COA sign-off" },
        { key: "projectId", label: "Project", type: "select", options: projOpts, empty: "—" },
        { key: "companyId", label: "Company", type: "select", options: compOpts, empty: "—" },
        { key: "impact", label: "Impact", type: "select", options: hml },
        { key: "likelihood", label: "Likelihood", type: "select", options: hml },
        { key: "owner", label: "Owner" },
        { key: "dueDate", label: "Resolve by", type: "date" },
        { key: "mitigation", label: "Mitigation / next step", type: "textarea" },
      ];
      editor = (
        <EntityEditor key={x?.id ?? "new"} title={x ? "Edit risk / dependency" : "New risk or dependency"} isNew={!x} fields={fields} onClose={close}
          initial={{ type: x?.type ?? "Risk", status: x?.status ?? "Open", title: x?.title ?? "", projectId: x?.projectId ?? "", companyId: x?.companyId ?? "", impact: x?.impact || "Medium", likelihood: x?.likelihood || "Medium", owner: x?.owner ?? "", dueDate: x?.dueDate ?? "", mitigation: x?.mitigation ?? "" }}
          onSave={v => saveRisk({ ...v, id: x?.id } as Parameters<typeof saveRisk>[0])} onDelete={x && canManage ? () => deletePlanItem("risk", x.id) : undefined} canSave={canManage} />
      );
    } else {
      const x = data.releases.find(r => r.id === openId);
      editor = <ReleaseEditor key={x?.id ?? "new"} release={x} data={data} projects={projects} canManage={canManage} onClose={close} />;
    }
  }

  return (
    <>
      <div className="filters">
        <SegLinks
          base="/plan"
          param="tab"
          current={tab}
          items={[
            [
              "milestones",
              <>
                <Target size={15} />
                <span>Milestones</span>
                <span className="seg-badge">{counts.milestones}</span>
              </>,
            ],
            [
              "changes",
              <>
                <GitPullRequest size={15} />
                <span>Change requests</span>
                <span className="seg-badge">{counts.changes}</span>
              </>,
            ],
            [
              "releases",
              <>
                <Rocket size={15} />
                <span>Releases</span>
                <span className="seg-badge">{counts.releases}</span>
              </>,
            ],
            [
              "risks",
              <>
                <AlertTriangle size={15} />
                <span>Risks &amp; dependencies</span>
                <span className="seg-badge">{counts.risks}</span>
              </>,
            ],
          ]}
        />
        <span style={{ flex: 1 }} />
        {canAdd && <button className="btn primary" type="button" onClick={() => update({ new: "1", edit: null })}>+ {NEW_LABEL[tab]}</button>}
      </div>

      {tab === "milestones" && (!data.milestones.length
        ? <Empty title="No milestones yet">Add target dates per project, such as Phase 1 go-live, UAT complete or data migration done, so progress is reported against a plan.</Empty>
        : projects.filter(p => data.milestones.some(m => m.projectId === p.id)).concat(data.milestones.some(m => !m.projectId) ? [{ id: "", name: "No project" }] : []).map(p => {
          const L = data.milestones.filter(m => m.projectId === p.id);
          const milestoneColumns: ColumnsType<Milestone> = [
            {
              title: "Milestone",
              dataIndex: "title",
              key: "title",
              render: (title: string) => <b style={{ fontWeight: 600 }}>{title}</b>,
            },
            {
              title: "Target",
              dataIndex: "target",
              key: "target",
              className: "mono",
              render: (target: string) => fmtDay(target),
            },
            {
              title: "Status",
              key: "status",
              render: (_: unknown, m: Milestone) => <Chip color={MILESTONE_COLOR[milestoneStatus(m)]}>{milestoneStatus(m)}</Chip>,
            },
            {
              title: "Done",
              dataIndex: "doneOn",
              key: "doneOn",
              className: "mono",
              render: (doneOn: string) => fmtDay(doneOn),
            },
            {
              title: "Owner",
              dataIndex: "owner",
              key: "owner",
            },
            {
              title: "Note",
              dataIndex: "note",
              key: "note",
              className: "muted",
            },
            {
              title: "Actions",
              key: "actions",
              align: "right" as const,
              width: 110,
              render: (_: unknown, m: Milestone) => (
                <RecordActions
                  onView={() => setViewing({ kind: "milestone", item: m })}
                  onEdit={canManage ? () => open(m.id) : undefined}
                  onDelete={
                    canManage
                      ? async () => {
                          const r = await deletePlanItem("milestone", m.id);
                          if (!r.ok) toast(r.error ?? "Failed to delete milestone");
                          else toast("Milestone deleted");
                        }
                      : undefined
                  }
                  deleteConfirmTitle={`Delete milestone "${m.title}"?`}
                  deleteConfirmMessage="Are you sure you want to delete this milestone? This action cannot be undone."
                  canEdit={canManage}
                  canDelete={canManage}
                />
              ),
            },
          ];

          return (
            <section key={p.id || "none"}>
              <div className="grouph"><span className="mtag" style={{ ["--mc" as string]: projectColor(p.name) }}>{p.name}</span><h3>{L.filter(m => milestoneStatus(m) === "Done").length}/{L.length} done</h3></div>
              <AntTable<Milestone>
                dataSource={L}
                columns={milestoneColumns}
                rowKey="id"
                onRowClick={m => setViewing({ kind: "milestone", item: m })}
                pagination={false}
              />
            </section>
          );
        }))}

      {tab === "changes" && (!data.changes.length
        ? <Empty title="No change requests">New requirements from users go here first. Once approved they become development tasks, which keeps scope under control.</Empty>
        : (() => {
          const changeColumns: ColumnsType<Change> = [
            {
              title: "CR",
              dataIndex: "id",
              key: "id",
              className: "mono",
              width: 130,
              render: (id: string) => <span style={{ fontWeight: 600 }}>{id}</span>,
            },
            {
              title: "Request",
              dataIndex: "title",
              key: "title",
              render: (title: string, c: Change) => (
                <div>
                  <b style={{ fontWeight: 600 }}>{title}</b>
                  {c.description && <div className="muted" style={{ fontSize: 12 }}>{c.description.slice(0, 110)}</div>}
                </div>
              ),
            },
            {
              title: "Project",
              key: "project",
              render: (_: unknown, c: Change) => tag(c.projectId),
            },
            {
              title: "Requested by",
              dataIndex: "requestedBy",
              key: "requestedBy",
            },
            {
              title: "Effort",
              dataIndex: "effort",
              key: "effort",
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              render: (status: string) => <Chip color={CR_COLOR[status] ?? "var(--muted)"}>{status}</Chip>,
            },
            {
              title: "Decision",
              key: "decision",
              className: "muted",
              render: (_: unknown, c: Change) => (
                <div style={{ fontSize: 12 }}>
                  {c.decidedAt && `${c.decisionBy} · ${fmtDay(c.decidedAt.slice(0, 10))}`}
                  {c.taskId && <> · <Link href={`/tasks?view=${c.taskId}`} onClick={e => e.stopPropagation()}>task #{c.taskSno}</Link></>}
                </div>
              ),
            },
            {
              title: "Actions",
              key: "actions",
              align: "right" as const,
              width: 110,
              render: (_: unknown, c: Change) => (
                <RecordActions
                  onView={() => setViewing({ kind: "change", item: c })}
                  onEdit={canManage ? () => open(c.id) : undefined}
                  onDelete={
                    canManage
                      ? async () => {
                          const r = await deletePlanItem("change", c.id);
                          if (!r.ok) toast(r.error ?? "Failed to delete change request");
                          else toast(`Change request ${c.id} deleted`);
                        }
                      : undefined
                  }
                  deleteConfirmTitle={`Delete ${c.id}?`}
                  deleteConfirmMessage={`Are you sure you want to delete change request ${c.id} "${c.title}"? This action cannot be undone.`}
                  canEdit={canManage}
                  canDelete={canManage}
                />
              ),
            },
          ];

          return (
            <AntTable<Change>
              dataSource={data.changes}
              columns={changeColumns}
              rowKey="id"
              onRowClick={c => setViewing({ kind: "change", item: c })}
              pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] }}
              emptyTitle="No change requests"
              emptyDescription="Submit change requests to track feature scope and approvals."
            />
          );
        })())}

      {tab === "releases" && (!data.releases.length
        ? <Empty title="No releases yet">Record each version that goes live and the items in it. Released items count as Live in reports.</Empty>
        : (
          <div className="alist">
            {data.releases.map(r => {
              const c = r.status === "Released" ? "var(--ok)" : "var(--info)";
              return (
                <AItem key={r.id} color={c} onClick={() => setViewing({ kind: "release", item: r })}
                  title={<><span className="mono">{r.version}</span> · {projName(r.projectId)} · {r.taskIds.length} items</>}
                  sub={<>{r.status} · {fmtDay(r.date)}{r.notes && " · " + r.notes.slice(0, 100)}</>}
                  right={
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                      <Chip color={c}>{r.status}</Chip>
                      <RecordActions
                        onView={() => setViewing({ kind: "release", item: r })}
                        onEdit={canManage ? () => open(r.id) : undefined}
                        onDelete={
                          canManage
                            ? async () => {
                                const res = await deletePlanItem("release", r.id);
                                if (!res.ok) toast(res.error ?? "Failed to delete release");
                                else toast(`Release ${r.version} deleted`);
                              }
                            : undefined
                        }
                        deleteConfirmTitle={`Delete release ${r.version}?`}
                        deleteConfirmMessage={`Are you sure you want to delete release ${r.version}? This action cannot be undone.`}
                        canEdit={canManage}
                        canDelete={canManage}
                      />
                    </div>
                  } />
              );
            })}
          </div>
        ))}

      {tab === "risks" && (!data.risks.length
        ? <Empty title="No risks or dependencies">Record what could delay delivery, such as “Qatar setup waiting on COA sign-off”, with an owner and date.</Empty>
        : (() => {
          const riskColumns: ColumnsType<Risk> = [
            {
              title: "Type",
              dataIndex: "type",
              key: "type",
            },
            {
              title: "Title",
              dataIndex: "title",
              key: "title",
              render: (title: string) => <b style={{ fontWeight: 600 }}>{title}</b>,
            },
            {
              title: "Project",
              key: "project",
              render: (_: unknown, r: Risk) => tag(r.projectId),
            },
            {
              title: "Impact",
              dataIndex: "impact",
              key: "impact",
              render: (impact: string) => <Chip color={{ High: "var(--bad)", Medium: "var(--warn)", Low: "var(--info)" }[impact] ?? "var(--muted)"}>{impact}</Chip>,
            },
            {
              title: "Owner",
              dataIndex: "owner",
              key: "owner",
            },
            {
              title: "Due",
              dataIndex: "dueDate",
              key: "dueDate",
              className: "mono",
              render: (dueDate: string, r: Risk) => (
                <span style={dueDate && dueDate < today() && r.status !== "Closed" ? { color: "var(--bad)" } : undefined}>
                  {fmtDay(dueDate)}
                </span>
              ),
            },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
            },
            {
              title: "Mitigation / next step",
              dataIndex: "mitigation",
              key: "mitigation",
              className: "muted",
            },
            {
              title: "Actions",
              key: "actions",
              align: "right" as const,
              width: 110,
              render: (_: unknown, r: Risk) => (
                <RecordActions
                  onView={() => setViewing({ kind: "risk", item: r })}
                  onEdit={canManage ? () => open(r.id) : undefined}
                  onDelete={
                    canManage
                      ? async () => {
                          const res = await deletePlanItem("risk", r.id);
                          if (!res.ok) toast(res.error ?? "Failed to delete item");
                          else toast(`${r.type} deleted`);
                        }
                      : undefined
                  }
                  deleteConfirmTitle={`Delete ${r.type.toLowerCase()} "${r.title}"?`}
                  deleteConfirmMessage="Are you sure you want to delete this item? This action cannot be undone."
                  canEdit={canManage}
                  canDelete={canManage}
                />
              ),
            },
          ];

          return (
            <AntTable<Risk>
              dataSource={data.risks}
              columns={riskColumns}
              rowKey="id"
              onRowClick={r => setViewing({ kind: "risk", item: r })}
              pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] }}
              emptyTitle="No risks or dependencies"
              emptyDescription="Record delivery risks, assumptions or dependency items."
            />
          );
        })())}
      {viewing && (
        <PlanDetailModal
          viewing={viewing}
          projects={projects}
          companies={companies}
          canManage={canManage}
          onEdit={() => {
            const id = viewing.item.id;
            setViewing(null);
            open(id);
          }}
          onClose={() => setViewing(null)}
        />
      )}
      {editor}
    </>
  );
}

function ReleaseEditor({ release, data, projects, canManage, onClose }: { release?: Release; data: PlanData; projects: { id: string; name: string }[]; canManage: boolean; onClose: () => void }) {
  const [projectId, setProjectId] = useState(release?.projectId || projects[0]?.id || "");
  const [ids, setIds] = useState<Set<string>>(new Set(release?.taskIds ?? []));
  const [q, setQ] = useState("");
  // an item can be in one release only
  const used = useMemo(() => new Set(data.releases.filter(r => r.id !== release?.id).flatMap(r => r.taskIds)), [data.releases, release]);
  const list = data.doneTasks.filter(t => t.projectId === projectId && !used.has(t.id) && (!q || t.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 300);
  const fields: FieldDef<Record<string, string>>[] = [
    { key: "version", label: "Version", required: true, placeholder: "e.g. v2.3 or 2026.10" },
    { key: "date", label: "Release date", type: "date" },
    { key: "status", label: "Status", type: "select", options: [["Planned", "Planned"], ["Released", "Released"]] },
    { key: "notes", label: "Release notes", type: "textarea" },
  ];
  return (
    <EntityEditor title={release ? "Release " + release.version : "New release"} isNew={!release} fields={fields} onClose={onClose} canSave={canManage}
      initial={{ version: release?.version ?? "", date: release?.date || today(), status: release?.status || "Planned", notes: release?.notes ?? "" }}
      onSave={v => saveRelease({ ...v, id: release?.id, projectId, taskIds: [...ids], status: v.status as "Planned" })}
      onDelete={release && canManage ? () => deletePlanItem("release", release.id) : undefined}>
      <div className="field">
        <label htmlFor="rl_m">Project</label>
        <AntSelect
          id="rl_m"
          value={projectId}
          onChange={e => { setProjectId(e.target.value); setIds(new Set()); }}
          options={projects.map(p => [p.id, p.name])}
        />
      </div>
      <div className="field">
        <label>Items in this release <span className="muted">· {ids.size} selected (releasing marks them Live)</span></label>
        <AntInput placeholder="Filter developed items…" value={q} onChange={e => setQ(e.target.value)} allowClear />
        <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {list.length === 0 && <span className="muted">No developed items in this project.</span>}
          {list.map(t => (
            <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--fg)", cursor: "pointer" }}>
              <AntCheckbox checked={ids.has(t.id)} onChange={e => setIds(s => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })}>
                {t.title} <span className="muted">{t.subModule}</span>
              </AntCheckbox>
            </label>
          ))}
        </div>
      </div>
    </EntityEditor>
  );
}
