"use client";
import Link from "next/link";
import { Paperclip, ExternalLink } from "lucide-react";
import { useState } from "react";
import { deleteManual, saveManual } from "@/server/manuals";
import { projectColor } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import type { FileRef } from "@/lib/work";
import { Empty } from "@/components/ui/bits";
import { AntTable, type ColumnsType } from "@/components/ui/antd";
import { Chip } from "@/components/ui/Chip";
import { Kpi } from "@/components/ui/Kpi";
import { EntityEditor, type FieldDef } from "@/components/ui/EntityEditor";
import { Files } from "@/components/ui/Files";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { useUrlUpdate } from "@/components/ui/useUrl";

export type ManualDTO = { id: string; title: string; projectId: string; subModule: string; level: string; status: string; version: string; language: string; owner: string; updatedOn: string; link: string; notes: string; files: FileRef[] };
export type CoverageRow = { projectId: string; projectName: string; subModule: string; delivered: number; manuals: { id: string; title: string; status: string }[]; state: string };

const STATUS_COLOR: Record<string, string> = { Draft: "var(--hold)", "In review": "var(--warn)", Published: "var(--ok)", Outdated: "var(--bad)" };
const LEVEL_COLOR: Record<string, string> = { Admin: "var(--accent)", Manager: "var(--info)", Developer: "var(--lms)" };
const LEVELS = ["Admin", "Manager", "Developer"];

// Built-in guides for using the tracker.
const GUIDE: { who: string; steps: [string, React.ReactNode][] } = {
  who: "How to use this tracker",
  steps: [
    ["Start your day", <>Open <Link href="/">Development stats</Link>. Each developer card shows what they are working on, what is open and what is overdue.</>],
    ["Write your daily update", <>On your card press <b>Write daily update</b>: what you completed, your plan for the next working day, blockers and hours. Send it before the daily cut-off time on working days.</>],
    ["Update your items", <>In <Link href="/tasks">Tasks &amp; assignment</Link> filter by your name and open an item. Change <b>Development status</b> (Open → In progress → Testing → UAT → Completed), move the progress slider, log time and attach files.</>],
    ["Urgent issues", <>In <Link href="/issues">Urgent issues</Link> press <b>Take it</b> on unassigned issues, then <b>Resolve</b> and write what was done.</>],
    ["Share or hand over", <>In <Link href="/workload">Work on hand</Link> use <b>⇄</b> on an item to add a collaborator or hand it over, for example before leave.</>],
    ["Approve and plan", <><Link href="/approvals">Approvals</Link> lists urgent issues, tasks waiting for approval and change requests. <Link href="/plan">Plan &amp; control</Link> holds milestones, change requests, releases and risks.</>],
    ["Business-user testing", <>In <Link href="/uat">UAT &amp; sign-off</Link> select developed items, <b>Send for UAT</b>, then <b>Record sign-off</b> or send them back.</>],
    ["Users, licences and companies", <>Keep the register in <Link href="/users">Users &amp; access</Link> and <Link href="/licences">Licences</Link> current; companies and the licence position are on the <Link href="/admin">Admin dashboard</Link>.</>],
    ["Excel", <>Use <b>Upload</b> (top right) to import the SAP status report and <b>Download Excel</b> for the full workbook. <Link href="/reports">Reports</Link> has the week report and management summary.</>],
    ["Accounts and settings", <>Admins add the team under <Link href="/accounts">Sign-in accounts</Link>. Notification rules, message templates, lists and the activity log are in the <Link href="/admin-panel">Admin panel</Link>.</>],
  ],
};

type Props = {
  manuals: ManualDTO[]; counts: { total: number; published: number; draft: number; outdated: number }; coverage: CoverageRow[];
  projects: { id: string; name: string }[]; developers: { id: string; name: string }[]; modules: string[]; level: string;
  editing: ManualDTO | null; openNew: boolean; preset: string; canEdit: boolean; canManage: boolean;
};

export function ManualsView(p: Props) {
  const { update } = useUrlUpdate();
  const [guideOpen, setGuideOpen] = useState(false);
  const projName = (id: string) => p.projects.find(x => x.id === id)?.name ?? "";
  const devName = (id: string) => p.developers.find(x => x.id === id)?.name ?? id;
  const covered = p.coverage.length ? Math.round((p.coverage.filter(r => r.state === "Covered").length / p.coverage.length) * 100) + "%" : "—";
  const gaps = p.coverage.filter(r => r.state === "No manual" && r.delivered).length;
  const close = () => update({ edit: null, new: null, for: null });
  const [presetProject, presetModule] = p.preset.split("|");

  return (
    <>
      <details className="mod" open={guideOpen} onToggle={e => setGuideOpen((e.target as HTMLDetailsElement).open)} style={{ ["--mc" as string]: "var(--accent)", marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <Chip color="var(--accent)">Guide</Chip><b style={{ font: "700 15px var(--display)", flex: 1 }}>{GUIDE.who}</b><span className="muted" style={{ fontSize: 12 }}>Built-in guide · {GUIDE.steps.length} steps</span>
        </summary>
        <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
          {GUIDE.steps.map(([t, b]) => <li key={t}><b>{t}.</b> {b}</li>)}
        </ol>
      </details>

      <div className="kpis" style={{ marginTop: 6 }}>
        <Kpi n={p.counts.total} label="Manuals" /><Kpi n={p.counts.published} label="Published" /><Kpi n={p.counts.draft} label="Draft / in review" />
        <Kpi n={p.counts.outdated} label="Outdated" bad={p.counts.outdated > 0} /><Kpi n={covered} label="Delivered modules covered" /><Kpi n={gaps} label="Delivered modules with no manual" bad={gaps > 0} />
      </div>

      <div style={{ marginTop: 18 }}>
        <UrlFilters search={{ placeholder: "Search manuals…" }} selects={[
          { key: "mod", all: "All projects", options: p.projects.map(x => [x.id, x.name]) },
          { key: "st", all: "All statuses", options: Object.keys(STATUS_COLOR).map(s => [s, s]) },
          { key: "lv", all: "All levels", options: LEVELS.map(l => [l, l]) },
        ]}>
          {p.canEdit && <button className="btn primary" type="button" onClick={() => update({ new: "1", edit: null })}>+ Add manual</button>}
        </UrlFilters>
      </div>

      {!p.counts.total ? (
        <Empty title="No team manuals yet" action={p.canEdit ? <button className="btn primary" type="button" onClick={() => update({ new: "1" })}>+ Add manual</button> : undefined}>
          Add your own manuals for each project or module: link to where it lives (SharePoint, OneDrive, Google Drive) or attach the PDF, and track whether it is a draft, in review or published.
        </Empty>
      ) : (() => {
        const manualColumns: ColumnsType<ManualDTO> = [
          {
            title: "Manual",
            dataIndex: "title",
            key: "title",
            render: (title: string, m: ManualDTO) => (
              <div style={{ minWidth: 200 }}>
                <b style={{ fontWeight: 600 }}>{title}</b>
                {m.notes && <div className="muted" style={{ fontSize: 12 }}>{m.notes.slice(0, 110)}</div>}
              </div>
            ),
          },
          {
            title: "Project",
            key: "project",
            render: (_: unknown, m: ManualDTO) =>
              m.projectId ? <span className="mtag" style={{ ["--mc" as string]: projectColor(projName(m.projectId)) }}>{projName(m.projectId)}</span> : "—",
          },
          {
            title: "Module",
            dataIndex: "subModule",
            key: "subModule",
            render: (subModule?: string) => subModule || "All modules",
          },
          {
            title: "Level",
            dataIndex: "level",
            key: "level",
            render: (level: string) => <Chip color={LEVEL_COLOR[level] ?? "var(--lms)"}>{level}</Chip>,
          },
          {
            title: "Version",
            dataIndex: "version",
            key: "version",
            className: "mono",
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status: string) => <Chip color={STATUS_COLOR[status] ?? "var(--hold)"} dot>{status}</Chip>,
          },
          {
            title: "Owner",
            key: "owner",
            render: (_: unknown, m: ManualDTO) => (m.owner ? devName(m.owner) : "—"),
          },
          {
            title: "Updated",
            dataIndex: "updatedOn",
            key: "updatedOn",
            className: "mono",
            render: (d: string) => fmtDay(d),
          },
          {
            title: "Open",
            key: "open",
            align: "right",
            render: (_: unknown, m: ManualDTO) => (
              <div style={{ whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                {m.link && (
                  <a className="btn" style={{ padding: "5px 10px" }} href={m.link} target="_blank" rel="noopener noreferrer">
                    Open
                    <ExternalLink size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginLeft: 4 }} />
                  </a>
                )}{" "}
                {m.files.length > 0 && (
                  <a className="btn" style={{ padding: "5px 10px" }} href={`/api/assets/${m.files[0].id}`} target="_blank" rel="noopener" title={m.files[0].name}>
                    <Paperclip size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 4 }} />
                    {m.files.length > 1 ? m.files.length + " files" : (m.files[0].name.split(".").pop() || "file").toUpperCase().slice(0, 4)}
                  </a>
                )}
                {!m.link && !m.files.length && <span className="muted" style={{ fontSize: 12 }}>No link or file</span>}
              </div>
            ),
          },
        ];

        return (
          <AntTable<ManualDTO>
            dataSource={p.manuals}
            columns={manualColumns}
            rowKey="id"
            onRowClick={m => update({ edit: m.id })}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            emptyTitle="No manuals match these filters"
            emptyDescription="Try clearing search or filter parameters to find manuals."
          />
        );
      })()}

      <h2 className="sec">Coverage of delivered software</h2>
      <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 13 }}>Each module with completed items, and whether a published manual covers it. A manual with no module set covers the whole project.</p>
      {(() => {
        const coverageColumns: ColumnsType<CoverageRow> = [
          {
            title: "Project",
            key: "project",
            render: (_: unknown, r: CoverageRow, ix: number) =>
              (ix === 0 || p.coverage[ix - 1]?.projectId !== r.projectId) && (
                <span className="mtag" style={{ ["--mc" as string]: projectColor(r.projectName) }}>{r.projectName}</span>
              ),
          },
          {
            title: "Module",
            dataIndex: "subModule",
            key: "subModule",
            render: (sub?: string) => sub || "(no module)",
          },
          {
            title: "Delivered items",
            dataIndex: "delivered",
            key: "delivered",
            className: "num",
            align: "right",
          },
          {
            title: "Manuals",
            key: "manuals",
            render: (_: unknown, r: CoverageRow) =>
              r.manuals.length ? (
                <div>
                  {r.manuals.map(m => (
                    <div key={m.id}>
                      <Link href={`/manuals?edit=${m.id}`}>{m.title}</Link> <span className="muted">({m.status})</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="muted">—</span>
              ),
          },
          {
            title: "Coverage",
            dataIndex: "state",
            key: "state",
            render: (state: string) => <Chip color={state === "Covered" ? "var(--ok)" : state === "In progress" ? "var(--warn)" : "var(--bad)"}>{state}</Chip>,
          },
          {
            title: "",
            key: "action",
            align: "right",
            render: (_: unknown, r: CoverageRow) =>
              p.canEdit && r.state === "No manual" ? (
                <button className="btn" type="button" style={{ padding: "5px 10px" }} onClick={() => update({ new: "1", for: `${r.projectId}|${r.subModule}` })}>
                  + Manual
                </button>
              ) : null,
          },
        ];

        return (
          <AntTable<CoverageRow>
            dataSource={p.coverage}
            columns={coverageColumns}
            rowKey={r => r.projectId + r.subModule}
            pagination={false}
            emptyTitle="Nothing delivered yet"
            emptyDescription="Modules appear here once their items are completed."
          />
        );
      })()}

      {(p.editing || p.openNew) && (
        <ManualEditor key={p.editing?.id ?? "new" + p.preset} manual={p.editing} {...p} presetProject={presetProject} presetModule={presetModule} onClose={close} />
      )}
    </>
  );
}

function ManualEditor({ manual, projects, developers, modules, canEdit, canManage, presetProject, presetModule, onClose }: Props & { manual: ManualDTO | null; presetProject?: string; presetModule?: string; onClose: () => void }) {
  const projName = (id: string) => projects.find(x => x.id === id)?.name ?? "";
  const fields: FieldDef<Record<string, string>>[] = [
    { key: "title", label: "Title", required: true, full: true, placeholder: "e.g. SAP B1 Finance – user guide" },
    { key: "projectId", label: "Project", type: "select", options: projects.map(x => [x.id, x.name]) },
    { key: "subModule", label: "Module", list: modules, placeholder: "Blank = whole project" },
    { key: "level", label: "Level (who it's for)", type: "select", options: [["Admin", "Admin"], ["Manager", "Manager"], ["Developer", "Developer"]] },
    { key: "status", label: "Status", type: "select", options: Object.keys(STATUS_COLOR).map(s => [s, s]) },
    { key: "version", label: "Version", placeholder: "v1.0" },
    { key: "language", label: "Language", type: "select", options: ["English", "Arabic", "English & Arabic"].map(s => [s, s]) },
    { key: "owner", label: "Owner", type: "select", options: developers.map(d => [d.id, d.name]), empty: "—" },
    { key: "updatedOn", label: "Last updated", type: "date" },
    { key: "link", label: "Link to the manual", type: "url", full: true, placeholder: "https://… (SharePoint, OneDrive, Google Drive)" },
    { key: "notes", label: "Notes / what it covers", type: "textarea" },
  ];
  const pp = presetProject || projects[0]?.id || "";
  return (
    <EntityEditor title={manual ? "Edit user manual" : "Add user manual"} isNew={!manual} fields={fields} onClose={onClose} canSave={canEdit}
      initial={{
        title: manual?.title ?? (presetProject ? `${projName(presetProject)}${presetModule ? " " + presetModule : ""} – user guide` : ""), projectId: manual?.projectId ?? pp,
        subModule: manual?.subModule ?? presetModule ?? "", level: manual?.level ?? "Developer", status: manual?.status ?? "Draft", version: manual?.version ?? "",
        language: manual?.language || "English", owner: manual?.owner ?? "", updatedOn: manual?.updatedOn || today(), link: manual?.link ?? "", notes: manual?.notes ?? "",
      }}
      onSave={async v => { const r = await saveManual({ ...v, id: manual?.id, level: v.level as "Developer", status: v.status as "Draft" }); return r.ok ? { ok: true } : r; }}
      onDelete={manual && canManage ? () => deleteManual(manual.id) : undefined}>
      <div className="field">
        <label>Files (PDF, images, video)</label>
        {manual ? <Files kind="manual" id={manual.id} files={manual.files} canEdit={canEdit} canRemove={canManage} /> : <span className="muted" style={{ fontSize: 12 }}>Save the manual first, then open it again to attach the PDF or screenshots.</span>}
      </div>
    </EntityEditor>
  );
}
