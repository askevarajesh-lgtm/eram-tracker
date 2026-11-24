"use client";
import Link from "next/link";
import { Download, Bell, ListFilter, ScrollText, Database } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteTasksWhere, saveDeveloperContact, saveLists, saveNotifySettings } from "@/server/work";
import { LIST_DEFAULTS, LIST_LABELS, TEMPLATE_DEFAULTS, WEEKDAYS, type Lists, type NotifySettings, type TemplateKey } from "@/lib/settings-defaults";
import { Empty, SegLinks } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Kpi } from "@/components/ui/Kpi";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntInput, AntTextArea, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";

type Props = {
  tab: "notify" | "lists" | "log" | "data";
  notify: NotifySettings; lists: Lists; developers: { id: string; name: string; email: string; whatsapp: string }[];
  log: { at: string; who: string; action: string; entity: string; label: string }[]; areas: string[];
  data: { counts: [string, number][]; sources: [string, number][]; projects: { id: string; name: string; n: number }[] } | null;
};

const input: React.CSSProperties = { width: "100%", font: "13px var(--body)", padding: "7px 9px", border: "1px solid var(--line2)", borderRadius: 8, background: "var(--surface)", color: "var(--fg)" };
const pill: React.CSSProperties = { display: "inline-flex", gap: 5, alignItems: "center", padding: "6px 10px", border: "1px solid var(--line2)", borderRadius: 8, cursor: "pointer", color: "var(--fg)", fontSize: 13 };

export function AdminPanelView(p: Props) {
  return (
    <>
      <div className="filters">
        <SegLinks
          base="/admin-panel"
          param="tab"
          current={p.tab}
          items={[
            [
              "notify",
              <>
                <Bell size={15} />
                <span>Notifications</span>
              </>,
            ],
            [
              "lists",
              <>
                <ListFilter size={15} />
                <span>Lists</span>
              </>,
            ],
            [
              "log",
              <>
                <ScrollText size={15} />
                <span>Activity log</span>
              </>,
            ],
            [
              "data",
              <>
                <Database size={15} />
                <span>Data</span>
              </>,
            ],
          ]}
        />
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 13 }}>Sign-in accounts are managed under <Link href="/accounts">Setup → Sign-in accounts</Link>.</span>
      </div>
      {p.tab === "notify" && <NotifyTab {...p} />}
      {p.tab === "lists" && <ListsTab lists={p.lists} />}
      {p.tab === "log" && <LogTab log={p.log} areas={p.areas} />}
      {p.tab === "data" && p.data && <DataTab data={p.data} />}
    </>
  );
}

function NotifyTab({ notify, developers }: Props) {
  const compose = useCompose();
  const [f, setF] = useState(notify);
  const [busy, start] = useTransition();
  const set = <K extends keyof NotifySettings>(k: K, v: NotifySettings[K]) => setF(x => ({ ...x, [k]: v }));
  const tpl = (k: TemplateKey, part: "subject" | "body", v: string) => setF(x => ({ ...x, templates: { ...x.templates, [k]: { ...x.templates[k], [part]: v } } }));
  const contact = (id: string, field: "email" | "whatsapp", value: string) => start(async () => { const r = await saveDeveloperContact(id, field, value); toast(r.ok ? "Contact saved" : r.error); });
  const save = () => start(async () => {
    const r = await saveNotifySettings({ ...f, approvalPriorities: f.approvalPriorities as ("Urgent" | "High" | "Normal")[], templates: Object.fromEntries(Object.entries(f.templates).map(([k, t]) => [k, { subject: t.subject, body: t.body }])) });
    toast(r.ok ? "Notification settings saved" : r.error);
  });

  const devColumns: ColumnsType<{ id: string; name: string; email: string; whatsapp: string }> = [
    {
      title: "Developer",
      dataIndex: "name",
      key: "name",
      width: 140,
      render: (name: string) => <b style={{ fontWeight: 600 }}>{name}</b>,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string, d) => (
        <AntInput
          aria-label={`${d.name} email`}
          type="email"
          defaultValue={email}
          placeholder="name@eramengineering.com"
          style={input}
          onBlur={e => e.target.value !== d.email && contact(d.id, "email", e.target.value)}
        />
      ),
    },
    {
      title: "WhatsApp (with country code)",
      dataIndex: "whatsapp",
      key: "whatsapp",
      render: (wa: string, d) => (
        <AntInput
          aria-label={`${d.name} WhatsApp`}
          defaultValue={wa}
          placeholder="+966 5x xxx xxxx"
          style={{ ...input, fontFamily: "var(--mono)" }}
          onBlur={e => e.target.value !== d.whatsapp && contact(d.id, "whatsapp", e.target.value)}
        />
      ),
    },
  ];

  return (
    <>
      <div className="two">
        <div>
          <h2 className="sec" style={{ marginTop: 0 }}>Developer contacts</h2>
          <div className="tablewrap">
            <AntTable
              dataSource={developers}
              columns={devColumns}
              rowKey="id"
              pagination={false}
              emptyText="No developers yet"
            />
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Changes save when you leave a box.</p>

          <h2 className="sec">Manager / sender</h2>
          <div className="form">
            <div className="field"><label htmlFor="nc_mn">Name</label><AntInput id="nc_mn" value={f.managerName} onChange={e => set("managerName", e.target.value)} /></div>
            <div className="field"><label htmlFor="nc_me">Email</label><AntInput id="nc_me" type="email" value={f.managerEmail} onChange={e => set("managerEmail", e.target.value)} /></div>
            <div className="field"><label htmlFor="nc_mw">WhatsApp</label><AntInput id="nc_mw" value={f.managerWa} placeholder="+966…" onChange={e => set("managerWa", e.target.value)} /></div>
            <div className="field"><label htmlFor="nc_link">Tracker link in messages</label><AntInput id="nc_link" value={f.link} placeholder="https://…" onChange={e => set("link", e.target.value)} /></div>
          </div>

          <h2 className="sec">Automatic reminders</h2>
          <div className="form">
            <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center", color: "var(--fg)", fontSize: 14 }}>
              <AntCheckbox checked={f.dailyOn} onChange={e => set("dailyOn", e.target.checked)}>
                Remind about missing daily updates
              </AntCheckbox>
            </label>
            <div className="field"><label htmlFor="nc_dt">Daily update due by</label><AntInput id="nc_dt" type="time" value={f.dailyTime} onChange={e => set("dailyTime", e.target.value)} /></div>
            <div className="field full"><label>Working days</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WEEKDAYS.map((w, i) => (
                  <label key={w} style={pill}>
                    <AntCheckbox checked={f.days.includes(i)} onChange={e => set("days", e.target.checked ? [...f.days, i].sort() : f.days.filter(x => x !== i))}>
                      {w}
                    </AntCheckbox>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full"><label>Approval needed before work starts</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Urgent", "High", "Normal"].map(pr => (
                  <label key={pr} style={pill}>
                    <AntCheckbox checked={f.approvalPriorities.includes(pr)} onChange={e => set("approvalPriorities", e.target.checked ? [...f.approvalPriorities, pr] : f.approvalPriorities.filter(x => x !== pr))}>
                      {pr} issues
                    </AntCheckbox>
                  </label>
                ))}
                <label style={pill}>
                  <AntCheckbox checked={f.approveDevTasks} onChange={e => set("approveDevTasks", e.target.checked)}>
                    Tasks created by developers
                  </AntCheckbox>
                </label>
              </div>
            </div>
            <div className="field full"><label>Issue response targets (hours)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {(["Urgent", "High", "Normal"] as const).map(k => (
                  <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                    {k}
                    <AntInput type="number" min={1} value={f.sla[k]} onChange={e => set("sla", { ...f.sla, [k]: Number(e.target.value) || 1 })} />
                  </label>
                ))}
              </div>
            </div>
            <label className="field full" style={{ flexDirection: "row", gap: 8, alignItems: "center", color: "var(--fg)", fontSize: 14 }}>
              <AntCheckbox checked={f.overdueOn} onChange={e => set("overdueOn", e.target.checked)}>
                Remind developers about overdue items
              </AntCheckbox>
            </label>
          </div>
        </div>
        <div>
          <h2 className="sec" style={{ marginTop: 0 }}>Message templates</h2>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>Placeholders: {"{name} {date} {items} {overdue} {item} {project} {due} {summary} {link}"}</p>
          {(Object.keys(f.templates) as TemplateKey[]).map(k => (
            <div key={k} className="mod" style={{ ["--mc" as string]: "var(--accent)", marginBottom: 12 }}>
              <b style={{ font: "700 14px var(--display)" }}>{f.templates[k].label}</b>
              <div className="field"><label htmlFor={`nt_s_${k}`}>Email subject</label><AntInput id={`nt_s_${k}`} value={f.templates[k].subject} onChange={e => tpl(k, "subject", e.target.value)} /></div>
              <div className="field"><label htmlFor={`nt_b_${k}`}>Message</label><AntTextArea id={`nt_b_${k}`} rows={4} style={{ font: "13px var(--body)" }} value={f.templates[k].body} onChange={e => tpl(k, "body", e.target.value)} /></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <button className="btn primary" type="button" disabled={busy} onClick={save}>Save notification settings</button>
        <button className="btn" type="button" onClick={() => setF(x => ({ ...x, templates: Object.fromEntries((Object.keys(TEMPLATE_DEFAULTS) as TemplateKey[]).map(k => [k, { ...TEMPLATE_DEFAULTS[k] }])) as NotifySettings["templates"] }))}>Restore default templates</button>
        <button className="btn" type="button" onClick={() => compose({ tpl: "custom" })}>Test: open composer</button>
      </div>
    </>
  );
}

function ListsTab({ lists }: { lists: Lists }) {
  const [v, setV] = useState(() => Object.fromEntries(Object.entries(lists).map(([k, l]) => [k, l.join("\n")])) as Record<keyof Lists, string>);
  const [busy, start] = useTransition();
  return (
    <>
      <p className="muted" style={{ margin: "0 0 14px" }}>These lists fill the dropdowns and suggestions across the tracker. One value per line.</p>
      <div className="modgrid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
        {(Object.keys(LIST_DEFAULTS) as (keyof Lists)[]).map(k => (
          <div key={k} className="mod" style={{ ["--mc" as string]: "var(--accent)" }}>
            <div className="field"><label htmlFor={`ls_${k}`} style={{ font: "700 14px var(--display)", color: "var(--fg)" }}>{LIST_LABELS[k]}</label>
              <AntTextArea id={`ls_${k}`} rows={8} style={{ font: "13px var(--mono)" }} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="btn primary" type="button" disabled={busy} onClick={() => start(async () => { const r = await saveLists(Object.fromEntries(Object.entries(v).map(([k, s]) => [k, s.split("\n")]))); toast(r.ok ? "Lists saved" : r.error); })}>Save lists</button>
        <button className="btn" type="button" onClick={() => setV(Object.fromEntries(Object.entries(LIST_DEFAULTS).map(([k, l]) => [k, l.join("\n")])) as Record<keyof Lists, string>)}>Restore defaults</button>
      </div>
    </>
  );
}

const ACTION: Record<string, [string, string]> = { create: ["Created", "var(--ok)"], update: ["Updated", "var(--info)"], delete: ["Deleted", "var(--bad)"], note: ["Note", "var(--accent)"] };

function LogTab({ log, areas }: { log: Props["log"]; areas: string[] }) {
  const download = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(log.map(r => ({ When: r.at, Who: r.who, Action: r.action, Area: r.entity, What: r.label }))), "Activity");
    XLSX.writeFile(wb, `Dev360_Activity_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  return (
    <>
      <UrlFilters search={{ placeholder: "Search activity…" }} selects={[{ key: "area", all: "All areas", options: areas.map(a => [a, a]) }]}>
        <button className="btn" type="button" onClick={download} disabled={!log.length}>
          <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
          Download log
        </button>
      </UrlFilters>
      {(() => {
        const logColumns: ColumnsType<Props["log"][0]> = [
          {
            title: "When",
            dataIndex: "at",
            key: "at",
            className: "mono",
            render: (at: string) =>
              new Date(at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          },
          {
            title: "Who",
            dataIndex: "who",
            key: "who",
          },
          {
            title: "Action",
            dataIndex: "action",
            key: "action",
            render: (action: string) => (
              <Chip color={ACTION[action]?.[1] ?? "var(--info)"}>{ACTION[action]?.[0] ?? action}</Chip>
            ),
          },
          {
            title: "Area",
            dataIndex: "entity",
            key: "entity",
            className: "muted",
          },
          {
            title: "What",
            dataIndex: "label",
            key: "label",
          },
        ];

        return (
          <AntTable<Props["log"][0]>
            dataSource={log}
            columns={logColumns}
            rowKey={(r, i) => r.at + r.who + i}
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] }}
            emptyTitle="No activity yet"
            emptyDescription="Every create, change and delete made in the tracker is recorded here."
          />
        );
      })()}
    </>
  );
}

function DataTab({ data }: { data: NonNullable<Props["data"]> }) {
  const [confirm, setConfirm] = useState<{ by: "source" | "project"; value: string; label: string; n: number } | null>(null);
  return (
    <>
      <div className="kpis">{data.counts.map(([l, n]) => <Kpi key={l} n={n} label={l} />)}</div>
      <h2 className="sec">Backup</h2>
      <div className="banner" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <span>Download everything in the tracker as one Excel workbook. The database itself is backed up by your database host (Neon keeps point-in-time history).</span>
        <a className="btn primary" href="/api/export" download>
          <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
          Excel workbook
        </a>
      </div>
      <h2 className="sec">Imported files</h2>
      {(() => {
        const sourceColumns: ColumnsType<[string, number]> = [
          {
            title: "File",
            dataIndex: 0,
            key: "file",
          },
          {
            title: "Items",
            dataIndex: 1,
            key: "items",
            className: "num",
            align: "right",
          },
          {
            title: "",
            key: "action",
            align: "right",
            render: (_, [f, n]) => (
              <button
                className="btn danger"
                type="button"
                onClick={() => setConfirm({ by: "source", value: f, label: `items imported from ${f}`, n })}
              >
                Delete these items…
              </button>
            ),
          },
        ];

        return (
          <AntTable<[string, number]>
            dataSource={data.sources}
            columns={sourceColumns}
            rowKey={([f]) => f}
            pagination={false}
            emptyTitle="No imported items"
            emptyDescription="Files uploaded from Excel or CSV will appear here."
          />
        );
      })()}
      <h2 className="sec">Clear a project&apos;s items</h2>
      {(() => {
        const projectColumns: ColumnsType<NonNullable<Props["data"]>["projects"][0]> = [
          {
            title: "Project",
            dataIndex: "name",
            key: "name",
          },
          {
            title: "Items",
            dataIndex: "n",
            key: "items",
            className: "num",
            align: "right",
          },
          {
            title: "",
            key: "action",
            align: "right",
            render: (_, p) =>
              p.n > 0 ? (
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => setConfirm({ by: "project", value: p.id, label: `all ${p.name} items`, n: p.n })}
                >
                  Delete all items…
                </button>
              ) : null,
          },
        ];

        return (
          <AntTable<NonNullable<Props["data"]>["projects"][0]>
            dataSource={data.projects}
            columns={projectColumns}
            rowKey="id"
            pagination={false}
            emptyTitle="No projects"
            emptyDescription="No project item counts recorded."
          />
        );
      })()}
      {confirm && <ConfirmDelete {...confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}

function ConfirmDelete({ by, value, label, n, onClose }: { by: "source" | "project"; value: string; label: string; n: number; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <Panel title={`Delete ${label}`} onClose={onClose}
      footer={<><span /><div><button className="btn" type="button" onClick={onClose}>Cancel</button>
        <button className="btn danger" type="button" disabled={busy || typed.trim() !== "DELETE"} onClick={() => start(async () => { const r = await deleteTasksWhere(by, value, typed.trim()); if (!r.ok) { setError(r.error); return; } toast(`Deleted ${r.data!.count} items`); onClose(); })}>Delete {n}</button></div></>}>
      <p>This permanently deletes <b>{n}</b> item{n === 1 ? "" : "s"}. Download the Excel workbook first if you may need them.</p>
      <div className="field"><label htmlFor="cb_in">Type DELETE to confirm</label><AntInput id="cb_in" autoComplete="off" value={typed} onChange={e => setTyped(e.target.value)} /></div>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}
