"use client";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { STATUS_MAP } from "@/lib/constants";
import type { ImportPreview, ParsedImport } from "@/lib/excel/types";
import { previewImport, runImport } from "@/server/import";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntSelect, AntTable, type ColumnsType } from "@/components/ui/antd";

type Props = { projects: { id: string; name: string }[]; onClose: () => void };

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function ImportPanel({ projects, onClose }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(() => (projects.find(p => /sap/i.test(p.name)) ?? projects[0])?.id ?? "");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [busy, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const payload = (p: ParsedImport) => ({ file: p.file, sheet: p.sheet, tasks: p.tasks, developers: p.developers, companies: p.companies, licences: p.licences, accessRecords: p.accessRecords });

  // ask the server what the import would do whenever the file or default project changes
  useEffect(() => {
    if (!parsed) return;
    setPreview(null);
    start(async () => {
      const r = await previewImport(payload(parsed), projectId);
      if (!r.ok) { setError(r.error); return; }
      setError("");
      setPreview(r.data!);
    });
  }, [parsed, projectId]);

  const read = async (file: File) => {
    setError(""); setParsed(null); setPreview(null);
    try {
      // the Excel reader is only downloaded when someone uploads
      const [XLSX, { parseWorkbook }] = await Promise.all([import("xlsx"), import("@/lib/excel/parse")]);
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const p = parseWorkbook(wb, XLSX.utils, file.name);
      if (!p.tasks.length && !p.developers.length && !p.companies.length && !p.licences.length && !p.accessRecords.length) {
        setError(`Couldn't find any rows to import in “${p.sheet}”. Rename the column holding the item names to Details and upload again.`);
        return;
      }
      setParsed(p);
    } catch (e) {
      setError(`Couldn't read this file: ${e instanceof Error ? e.message : String(e)}. Save it as .xlsx or .csv and try again.`);
    }
  };

  const doImport = () => start(async () => {
    if (!parsed) return;
    const r = await runImport(payload(parsed), projectId);
    if (!r.ok) { setError(r.error); return; }
    const d = r.data!;
    toast("Imported: " + [
      d.tasks.total && `${d.tasks.create} new and ${d.tasks.update} updated tasks`,
      d.accessRecords.total && plural(d.accessRecords.total, "users & access row"),
      d.companies && plural(d.companies, "company", "companies"),
      d.licences && plural(d.licences, "licence line"),
    ].filter(Boolean).join(", "));
    onClose();
    router.push(parsed.tasks.length ? "/tasks" : parsed.accessRecords.length ? "/users" : "/licences");
  });

  const unchanged = preview ? preview.tasks.total - preview.tasks.create - preview.tasks.update : 0;
  const nothing = preview && !preview.tasks.create && !preview.tasks.update && !preview.accessRecords.create && !preview.accessRecords.update
    && !preview.companies && !preview.licences && !preview.developers && !preview.newDevelopers.length && !preview.newProjects.length && !preview.newCompanies.length;
  const changedRows = preview && parsed ? preview.taskChanges.map(c => ({ ...c, t: parsed.tasks[c.index] })).filter(c => c.t) : [];
  const byStatus = parsed ? Object.entries(parsed.tasks.reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + 1 }), {})) : [];

  return (
    <Panel
      wide
      title="Upload data"
      dirty={!!parsed}
      onClose={onClose}
      footer={<><span /><div>
        <button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={!preview || busy || !!nothing} onClick={doImport}>
          {busy && preview ? "Importing…" : "Import"}
        </button>
      </div></>}
    >
      <p className="muted" style={{ margin: 0 }}>
        Bring in a status report or task list from Excel (.xlsx, .xls) or CSV. Columns are matched by name, so the SAP Over All Status Report layout works as it is.
        Nothing is saved until you press Import, and an import is saved all at once: if anything fails, nothing changes.
      </p>
      <ol className="steps">
        <li>Recognised columns: <code>S.No</code>, <code>Module</code>, <code>Details</code>, <code>Req.Type</code>, <code>Requirement Status</code>, <code>Developer Name</code> (e.g. “Riyaz &amp; Arun”), <code>Development Status</code>, <code>Company</code>, <code>Branch</code>, <code>EndUsers</code>, testing and acceptance status, plus optional <code>Project</code>, <code>Priority</code>, <code>Due Date</code>, <code>Notes</code> and others.</li>
        <li>Uploading a newer report updates tasks with the same Project + S.No instead of adding copies; unchanged rows are left alone. New developers, projects and companies are created automatically.</li>
        <li>Optional sheets: <code>Developers</code>, <code>Application Users</code> (the Users &amp; access register: a column per system, and e.g. <code>SAP B1 Licence</code> = Professional), <code>Companies</code>, <code>Licences</code>.</li>
      </ol>
      <div className="form">
        <div className="field">
          <label htmlFor="i_proj">Project for rows without a Project column</label>
          <AntSelect
            id="i_proj"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            options={projects.map(p => [p.id, p.name])}
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <a className="btn" href="/api/export?template=1" download>
            <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
            Download blank template
          </a>
        </div>
      </div>

      <label
        className={"drop" + (over ? " over" : "")}
        htmlFor="i_file"
        onDragEnter={e => { e.preventDefault(); setOver(true); }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={e => { e.preventDefault(); setOver(false); }}
        onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}
      >
        <b>{parsed ? parsed.file : "Choose a file"}</b>{parsed ? " · choose another" : " or drop it here"}<br />
        <span style={{ fontSize: 12 }}>.xlsx · .xls · .csv</span>
      </label>
      <input id="i_file" ref={fileInput} type="file" hidden accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />

      {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
      {parsed && !preview && !error && <p className="muted" style={{ margin: 0 }}>Checking what this file would change…</p>}

      {parsed && preview && (
        <>
          <div className="banner" style={{ display: "block" }}>
            <b>{parsed.file}</b>{parsed.sheet && <> · sheet “{parsed.sheet}”</>}:{" "}
            {preview.tasks.total > 0 && <><b>{plural(preview.tasks.total, "task")}</b> ({preview.tasks.create} new, {preview.tasks.update} updated{unchanged ? `, ${unchanged} unchanged` : ""})</>}
            {parsed.shifted > 0 && <> · <b>{parsed.shifted}</b> rows with shifted columns realigned</>}
            {preview.newDevelopers.length > 0 && <> · new developer{preview.newDevelopers.length === 1 ? "" : "s"}: {preview.newDevelopers.join(", ")}</>}
            {preview.newProjects.length > 0 && <> · new project{preview.newProjects.length === 1 ? "" : "s"}: {preview.newProjects.join(", ")}</>}
            {preview.newCompanies.length > 0 && <> · new compan{preview.newCompanies.length === 1 ? "y" : "ies"}: {preview.newCompanies.join(", ")}</>}
            {preview.accessRecords.total > 0 && <> · users &amp; access{parsed.accessSheet && ` (“${parsed.accessSheet}”)`}: {preview.accessRecords.create} new, {preview.accessRecords.update} updated{preview.accessRecords.total - preview.accessRecords.create - preview.accessRecords.update ? `, ${preview.accessRecords.total - preview.accessRecords.create - preview.accessRecords.update} unchanged` : ""}</>}
            {preview.companies > 0 && <> · {plural(preview.companies, "company", "companies")} added or changed</>}
            {preview.licences > 0 && <> · {plural(preview.licences, "licence line")} added or changed</>}
            {nothing && <> · <b>nothing to change</b>: everything already matches.</>}
          </div>
          {byStatus.length > 0 && (
            <div className="legend">
              {byStatus.map(([k, n]) => <span key={k}><Chip color={STATUS_MAP[k as keyof typeof STATUS_MAP]?.color ?? "var(--muted)"} dot>{STATUS_MAP[k as keyof typeof STATUS_MAP]?.label ?? k}</Chip> {n}</span>)}
            </div>
          )}
          {parsed.unmapped.length > 0 && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Columns not imported: {parsed.unmapped.join(", ")}</p>}
          {changedRows.length > 0 && (() => {
            type ChangedRow = (typeof changedRows)[number];
            const importColumns: ColumnsType<ChangedRow> = [
              {
                title: "Change",
                key: "change",
                width: 90,
                render: (_, r) => r.kind === "create" ? <Chip color="var(--ok)">New</Chip> : <Chip color="var(--info)">Updated</Chip>,
              },
              {
                title: "S.No",
                key: "sno",
                align: "right",
                render: (_, r) => <span className="mono">{r.t.sno ?? <span className="muted">auto</span>}</span>,
              },
              {
                title: "Project",
                key: "project",
                render: (_, r) => r.t.project || <span className="muted">(default)</span>,
              },
              {
                title: "Module",
                key: "subModule",
                render: (_, r) => r.t.subModule || "—",
              },
              {
                title: "Details",
                key: "title",
                render: (_, r) => r.t.title,
              },
              {
                title: "Developer",
                key: "devs",
                render: (_, r) => r.t.developers.join(" & ") || "—",
              },
              {
                title: "Development",
                key: "status",
                render: (_, r) => (
                  <Chip color={STATUS_MAP[r.t.status].color} dot>
                    {STATUS_MAP[r.t.status].label}
                  </Chip>
                ),
              },
              {
                title: "Branch",
                key: "branch",
                render: (_, r) => r.t.branch || "—",
              },
              {
                title: "Testing",
                key: "testStatus",
                render: (_, r) => r.t.testStatus || "—",
              },
              {
                title: "Acceptance",
                key: "acceptStatus",
                render: (_, r) => r.t.acceptStatus || "—",
              },
            ];

            return (
              <>
                <h3 className="sec" style={{ margin: "4px 0 0", fontSize: 14 }}>Tasks that will change</h3>
                <div className="tablewrap">
                  <AntTable
                    dataSource={changedRows}
                    columns={importColumns}
                    rowKey="index"
                    pagination={{ pageSize: 15 }}
                    scroll={{ y: 320 }}
                    emptyText="No tasks to change"
                  />
                </div>
              </>
            );
          })()}
        </>
      )}
    </Panel>
  );
}
