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

type Props = {
  projects: { id: string; name: string }[];
  defaultProjectId: string;
  onClose: () => void;
};

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function TaskImportModal({ projects, defaultProjectId, onClose }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(() => defaultProjectId || projects[0]?.id || "");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [busy, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const payload = (p: ParsedImport) => ({
    file: p.file,
    sheet: p.sheet,
    tasks: p.tasks,
    developers: p.developers,
    companies: p.companies,
    licences: p.licences,
    accessRecords: p.accessRecords,
  });

  // Ask the server what the task import would change whenever the file or default project changes
  useEffect(() => {
    if (!parsed) return;
    setPreview(null);
    start(async () => {
      const r = await previewImport(payload(parsed), projectId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError("");
      setPreview(r.data!);
    });
  }, [parsed, projectId]);

  const read = async (file: File) => {
    setError("");
    setParsed(null);
    setPreview(null);
    try {
      const [XLSX, { parseWorkbook }] = await Promise.all([
        import("xlsx"),
        import("@/lib/excel/parse"),
      ]);
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const p = parseWorkbook(wb, XLSX.utils, file.name);

      if (!p.tasks.length) {
        setError(
          `Couldn't find any task rows in “${p.sheet || file.name}”. Please ensure the column holding the task details/title is named “Details” and upload again.`,
        );
        return;
      }
      setParsed(p);
    } catch (e) {
      setError(
        `Couldn't read this file: ${e instanceof Error ? e.message : String(e)}. Save it as .xlsx, .xls, or .csv and try again.`,
      );
    }
  };

  const doImport = () =>
    start(async () => {
      if (!parsed) return;
      const r = await runImport(payload(parsed), projectId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const d = r.data!;
      toast(
        `Imported: ${d.tasks.create} new and ${d.tasks.update} updated tasks${
          d.newDevelopers.length ? ` (linked ${d.newDevelopers.length} developers)` : ""
        }`,
      );
      onClose();
      router.refresh();
    });

  const unchanged = preview ? preview.tasks.total - preview.tasks.create - preview.tasks.update : 0;
  const nothing = preview && !preview.tasks.create && !preview.tasks.update;
  const changedRows = preview && parsed ? preview.taskChanges.map(c => ({ ...c, t: parsed.tasks[c.index] })).filter(c => c.t) : [];
  const byStatus = parsed ? Object.entries(parsed.tasks.reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + 1 }), {})) : [];

  return (
    <Panel
      wide
      title="Upload tasks"
      dirty={!!parsed}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span />
          <div>
            <button className="btn" type="button" onClick={requestClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={!preview || busy || !!nothing}
              onClick={doImport}
            >
              {busy && preview ? "Importing…" : "Import tasks"}
            </button>
          </div>
        </>
      )}
    >
      <p className="muted" style={{ margin: 0 }}>
        Bring in development tasks or a status report from Excel (.xlsx, .xls) or CSV. Columns are matched by name.
        Nothing is saved until you review the preview and press <b>Import tasks</b>.
      </p>

      <ol className="steps">
        <li>
          <b>Recognised columns</b>: <code>Details</code> (Task title, required), <code>S.No</code>, <code>Module</code>, <code>Req.Type</code>, <code>Requirement Status</code>, <code>Developer Name</code> (e.g. “Riyaz &amp; Arun”), <code>Development Status</code>, <code>Priority</code>, <code>Due Date</code>, <code>Start Date</code>, <code>Progress %</code>, <code>Company</code>, <code>Branch</code>, <code>EndUsers</code>, <code>Notes</code>.
        </li>
        <li>
          <b>Matching &amp; update logic</b>: Re-uploading updates tasks that have the same <code>Project + S.No</code> instead of adding duplicates. Unchanged rows are left intact. New developers or companies mentioned in rows are linked automatically.
        </li>
      </ol>

      <div className="form">
        <div className="field">
          <label htmlFor="t_import_proj">Project for rows without a Project column</label>
          <AntSelect
            id="t_import_proj"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            options={projects.map(p => [p.id, p.name])}
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <a className="btn" href="/api/export?module=tasks&template=1" download>
            <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
            Download blank template
          </a>
        </div>
      </div>

      <label
        className={"drop" + (over ? " over" : "")}
        htmlFor="task_file_input"
        onDragEnter={e => { e.preventDefault(); setOver(true); }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={e => { e.preventDefault(); setOver(false); }}
        onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}
      >
        <b>{parsed ? parsed.file : "Choose an Excel or CSV file"}</b>
        {parsed ? " · click to choose another" : " or drag & drop it here"}
        <br />
        <span style={{ fontSize: 12 }}>.xlsx · .xls · .csv</span>
      </label>
      <input
        id="task_file_input"
        ref={fileInput}
        type="file"
        hidden
        accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }}
      />

      {error && <p className="err" role="alert" style={{ margin: 0 }}>{error}</p>}
      {parsed && !preview && !error && <p className="muted" style={{ margin: 0 }}>Analyzing task changes…</p>}

      {parsed && preview && (
        <>
          <div className="banner" style={{ display: "block" }}>
            <b>{parsed.file}</b>{parsed.sheet && <> · sheet “{parsed.sheet}”</>}:{" "}
            {preview.tasks.total > 0 && (
              <>
                <b>{plural(preview.tasks.total, "task")} found</b> (
                <span style={{ color: "var(--ok)", fontWeight: 600 }}>{preview.tasks.create} new</span>,{" "}
                <span style={{ color: "var(--info)", fontWeight: 600 }}>{preview.tasks.update} updated</span>
                {unchanged ? `, ${unchanged} unchanged` : ""})
              </>
            )}
            {parsed.shifted > 0 && <> · <b>{parsed.shifted}</b> rows with shifted columns realigned</>}
            {preview.newDevelopers.length > 0 && <> · new developers: {preview.newDevelopers.join(", ")}</>}
            {nothing && <> · <b>all tasks already up-to-date</b>, nothing to change.</>}
          </div>

          {byStatus.length > 0 && (
            <div className="legend">
              {byStatus.map(([k, n]) => (
                <span key={k}>
                  <Chip color={STATUS_MAP[k as keyof typeof STATUS_MAP]?.color ?? "var(--muted)"} dot>
                    {STATUS_MAP[k as keyof typeof STATUS_MAP]?.label ?? k}
                  </Chip>{" "}
                  {n}
                </span>
              ))}
            </div>
          )}

          {parsed.unmapped.length > 0 && (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Columns not mapped to tasks: {parsed.unmapped.join(", ")}
            </p>
          )}

          {changedRows.length > 0 && (() => {
            const previewColumns: ColumnsType<(typeof changedRows)[number]> = [
              {
                title: "Action",
                dataIndex: "kind",
                key: "kind",
                width: 90,
                render: (kind: "create" | "update") => (
                  <Chip color={kind === "create" ? "var(--ok)" : "var(--info)"}>
                    {kind === "create" ? "+ New" : "Update"}
                  </Chip>
                ),
              },
              {
                title: "S.No",
                key: "sno",
                className: "mono",
                width: 70,
                render: (_: unknown, c) => c.t.sno ?? "Auto",
              },
              {
                title: "Task Details",
                key: "title",
                render: (_: unknown, c) => (
                  <div>
                    <b>{c.t.title}</b>
                    {c.t.subModule && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {" "}· {c.t.subModule}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                title: "Status",
                key: "status",
                render: (_: unknown, c) => {
                  const st = STATUS_MAP[c.t.status];
                  return <Chip color={st?.color ?? "var(--hold)"} dot>{st?.label ?? c.t.status}</Chip>;
                },
              },
              {
                title: "Developers",
                key: "dev",
                render: (_: unknown, c) => c.t.developers.join(", ") || <span className="muted">Unassigned</span>,
              },
            ];

            return (
              <div style={{ marginTop: 8 }}>
                <p className="eyebrow" style={{ margin: "0 0 6px" }}>Preview of changes ({changedRows.length} tasks)</p>
                <AntTable
                  dataSource={changedRows}
                  columns={previewColumns}
                  rowKey={c => `${c.index}-${c.t.title}`}
                  pagination={{ pageSize: 8, size: "small" }}
                  size="small"
                />
              </div>
            );
          })()}
        </>
      )}
    </Panel>
  );
}
