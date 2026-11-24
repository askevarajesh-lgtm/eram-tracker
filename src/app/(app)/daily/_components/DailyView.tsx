"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { useState, useTransition } from "react";
import { saveDailyNote, saveRollout } from "@/server/daily";
import { PRIORITY_COLOR, STATUS_MAP, projectColor } from "@/lib/constants";
import { fmtDay, today } from "@/lib/dates";
import { addDays } from "@/lib/work";
import { AItem, Empty, StatusChip } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Kpi } from "@/components/ui/Kpi";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntDatePicker, AntSelect, AntInput, AntTextArea, AntTable, type ColumnsType } from "@/components/ui/antd";

type Row = { id: string; ref: string; subModule: string; title: string; notes: string; owner: string; status: TaskStatus; priority: string; progress: number; due: string; doneOn: string; created: string };
type Rollout = { companyId: string; projectId: string; status: string; progress: number | null; startDate: string; targetDate: string; actualDate: string; owner: string; branches: string; notes: string; log: { d: string; from: string; to: string }[] };
export type DailyData = {
  D: string; isToday: boolean; P: string; C: string;
  projects: { id: string; name: string }[];
  companies: { id: string; name: string; country: string; code: string; branches: string[] }[];
  holdingName: string;
  rollouts: Rollout[];
  kpis: Record<"live" | "implementing" | "rolloutToday" | "open" | "notStarted" | "inProgress" | "hold" | "newToday" | "doneToday" | "dueToday" | "overdue", number>;
  trend: { d: string; open: number; done: number; created: number }[];
  note: { done: string; blockers: string; next: string; updatedAt: string };
  moved: { id: string; title: string; from: string | null; to: string; owner: string; subModule: string }[];
  rolloutMoves: { companyId: string; projectId: string; from: string; to: string; notes: string }[];
  lists: { due: Row[]; done: Row[]; created: Row[]; open: Row[] };
  total: number;
};

export const ROLLOUT_STATUSES = [
  { key: "none", label: "Not planned", color: "var(--muted)" }, { key: "planned", label: "Planned", color: "var(--hold)" }, { key: "progress", label: "Implementing", color: "var(--info)" },
  { key: "uat", label: "UAT", color: "var(--lms)" }, { key: "live", label: "Live", color: "var(--ok)" }, { key: "hold", label: "On hold", color: "var(--bad)" },
];
const RO = Object.fromEntries(ROLLOUT_STATUSES.map(r => [r.key, r]));

export function DailyView({ data, canEdit, canManage }: { data: DailyData; canEdit: boolean; canManage: boolean }) {
  const { update } = useUrlUpdate();
  const [cell, setCell] = useState<{ companyId: string; projectId: string } | null>(null);
  const { D, isToday, kpis } = data;
  const pname = (data.P === "_all" ? "All projects" : data.projects.find(p => p.id === data.P)?.name ?? "") + (data.C ? ` · ${data.companies.find(c => c.id === data.C)?.name}` : "");
  const projName = (id: string) => data.projects.find(p => p.id === id)?.name ?? "";
  const compName = (id: string) => data.companies.find(c => c.id === id)?.name ?? "";
  const go = (d: string) => update({ d: d >= today() ? null : d });

  return (
    <>
      <div className="filters">
        <label className="muted" htmlFor="dd_proj" style={{ fontSize: 12 }}>Project</label>
        <AntSelect
          id="dd_proj"
          value={data.P}
          onChange={e => update({ p: e.target.value === "_all" ? null : e.target.value })}
          options={[["_all", "All projects"], ...data.projects.map(p => [p.id, p.name] as [string, string])]}
          style={{ width: "auto", minWidth: 160 }}
        />
        <label className="muted" htmlFor="dd_comp" style={{ fontSize: 12 }}>Company</label>
        <AntSelect
          id="dd_comp"
          value={data.C}
          onChange={e => update({ c: e.target.value })}
          options={[["", `${data.holdingName || "All"} group`], ...data.companies.map(c => [c.id, `${c.name}${c.country ? ` · ${c.country}` : ""}`] as [string, string])]}
          style={{ width: "auto", minWidth: 180 }}
        />
        <button className="btn" type="button" aria-label="Previous day" onClick={() => go(addDays(D, -1))}>‹</button>
        <AntDatePicker aria-label="Day" value={D} max={today()} onChange={e => e.target.value && go(e.target.value)} style={{ width: 140 }} />
        <button className="btn" type="button" aria-label="Next day" disabled={isToday} onClick={() => go(addDays(D, 1))}>›</button>
        {!isToday && <button className="btn" type="button" onClick={() => go(today())}>Today</button>}
        <span style={{ flex: 1 }} />
        <a className="btn" href={`/api/reports/day?d=${D}&p=${data.P}`} download>
          <Download size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
          Download day report
        </a>
        {canEdit && <Link className="btn primary" href={`/tasks?new=1${data.P !== "_all" ? "&project=" + data.P : ""}`}>+ New item</Link>}
      </div>

      <p className="eyebrow">{data.holdingName || "Group"} · software implementation by company</p>
      {!data.companies.length ? <Empty title="No group companies">Add the companies under the holding in the Admin dashboard first.</Empty> : (() => {
        const rolloutColumns: ColumnsType<DailyData["companies"][number]> = [
          {
            title: "Country",
            dataIndex: "country",
            key: "country",
            width: 130,
            render: (country: string, c, ix) => (ix === 0 || data.companies[ix - 1].country !== c.country) ? <b>{country || "—"}</b> : null,
          },
          {
            title: "Company",
            dataIndex: "name",
            key: "name",
            render: (name: string, c) => (
              <>
                {name}
                {c.code && <> <span className="mono muted" style={{ fontSize: 11 }}>{c.code}</span></>}
              </>
            ),
          },
          ...data.projects.map(p => ({
            title: <span className="mtag" style={{ ["--mc" as string]: projectColor(p.name) }}>{p.name}</span>,
            key: p.id,
            align: "center" as const,
            render: (_: any, c: DailyData["companies"][number]) => {
              const r = data.rollouts.find(x => x.companyId === c.id && x.projectId === p.id);
              const s = RO[r?.status ?? "none"] ?? RO.none;
              const dt = r?.status === "live" ? r.actualDate || r.targetDate : r?.targetDate;
              return (
                <div
                  style={{ cursor: canManage ? "pointer" : undefined }}
                  title={canManage ? `Update ${p.name} for ${c.name}` : undefined}
                  onClick={canManage ? () => setCell({ companyId: c.id, projectId: p.id }) : undefined}
                >
                  <Chip color={s.color} dot>{s.label}</Chip>
                  {dt && <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>{r?.status === "live" ? "since " : "target "}{fmtDay(dt)}</div>}
                  {r && r.status !== "live" && r.status !== "none" && r.progress != null && (
                    <div className="prog" style={{ margin: "4px auto 0", width: 70, ["--mc" as string]: projectColor(p.name) }}>
                      <i style={{ width: r.progress + "%" }} />
                    </div>
                  )}
                </div>
              );
            },
          })),
        ];

        return (
          <>
            <div className="tablewrap">
              <AntTable
                dataSource={data.companies}
                columns={rolloutColumns}
                rowKey="id"
                pagination={false}
                summary={() => data.holdingName ? (
                  <AntTable.Summary.Row style={{ background: "var(--sunk)" }}>
                    <AntTable.Summary.Cell index={0} colSpan={2}>
                      <b>{data.holdingName}</b> <span className="muted" style={{ fontSize: 12, fontWeight: "normal" }}>holding · {data.companies.length} companies · {new Set(data.companies.map(c => c.country).filter(Boolean)).size} countries</span>
                    </AntTable.Summary.Cell>
                    {data.projects.map((p, idx) => (
                      <AntTable.Summary.Cell key={p.id} index={2 + idx} align="center">
                        <span className="mono"><b>{data.companies.filter(c => data.rollouts.some(r => r.companyId === c.id && r.projectId === p.id && r.status === "live")).length}</b><span className="muted" style={{ fontWeight: "normal" }}>/{data.companies.length} live</span></span>
                      </AntTable.Summary.Cell>
                    ))}
                  </AntTable.Summary.Row>
                ) : null}
                emptyText="No group companies"
              />
            </div>
            <div className="legend" style={{ marginTop: 6 }}>{ROLLOUT_STATUSES.map(s => <span key={s.key}><i className="dot" style={{ background: s.color }} />{s.label}</span>)}{canManage && <span>Click a cell to update it.</span>}</div>
          </>
        );
      })()}

      <p className="eyebrow" style={{ marginTop: 28 }}>{pname} · development &amp; implementation items · {new Date(D + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}{isToday ? " · today" : ""}</p>
      <div className="kpis">
        <Kpi n={kpis.live} label="Company systems live" /><Kpi n={kpis.implementing} label="Implementing / UAT" /><Kpi n={kpis.rolloutToday} label="Rollout changes today" />
        <Kpi n={kpis.open} label={isToday ? "Open items now" : "Open at day end"} /><Kpi n={kpis.notStarted} label="Not started" /><Kpi n={kpis.inProgress} label="In progress / testing" />
        <Kpi n={kpis.hold} label="On hold / blocked" bad={kpis.hold > 0} /><Kpi n={kpis.newToday} label="New today" /><Kpi n={kpis.doneToday} label="Completed today" />
        <Kpi n={kpis.dueToday} label="Due today" bad={kpis.dueToday > 0} /><Kpi n={kpis.overdue} label="Overdue" bad={kpis.overdue > 0} />
      </div>

      {data.total > 0 && <Trend trend={data.trend} />}

      <div className="two">
        <div>
          <h2 className="sec">Status update for the day</h2>
          <DayNote key={data.P + D} projectId={data.P} date={D} note={data.note} canEdit={canEdit} />
        </div>
        <div>
          <h2 className="sec">Moved today</h2>
          {!data.moved.length && !data.rolloutMoves.length ? <Empty title="No status changes recorded">{isToday ? "Changes made today in this tracker appear here as they happen." : "Nothing was changed on this day."}</Empty> : (
            <div className="alist">
              {data.rolloutMoves.map((r, i) => (
                <AItem key={"r" + i} color={RO[r.to]?.color ?? "var(--muted)"} title={`${projName(r.projectId)} at ${compName(r.companyId)}`} sub={<>{RO[r.from]?.label ?? "—"} → {RO[r.to]?.label ?? r.to}{r.notes && ` · ${r.notes.slice(0, 80)}`}</>} />
              ))}
              {data.moved.map((m, i) => (
                <AItem key={"m" + i} color={STATUS_MAP[m.to as TaskStatus]?.color ?? "var(--muted)"} href={`/tasks?edit=${m.id}`} title={m.title}
                  sub={<>{m.from ? `${STATUS_MAP[m.from as TaskStatus]?.label ?? m.from} → ` : "Created as "}{STATUS_MAP[m.to as TaskStatus]?.label ?? m.to} · {m.owner || "Unassigned"}</>}
                  right={m.subModule ? <span className="muted" style={{ fontSize: 12 }}>{m.subModule}</span> : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>

      {data.total === 0 ? (
        <div style={{ marginTop: 18 }}><Empty title={`No items for ${pname} yet`}>Development and implementation items appear here once added or uploaded. Every status change is recorded by day, so this board can show what moved today.</Empty></div>
      ) : (
        <>
          <ItemTable title="Due today & overdue" rows={data.lists.due} D={D} />
          <ItemTable title="Completed today" rows={data.lists.done} D={D} extra="Completed" />
          <ItemTable title="New today" rows={data.lists.created} D={D} extra="Created" />
          <ItemTable title={isToday ? "All open items" : "Open at day end"} rows={data.lists.open} D={D} />
        </>
      )}
      {cell && <RolloutPanel {...cell} data={data} onClose={() => setCell(null)} />}
    </>
  );
}

function Trend({ trend }: { trend: DailyData["trend"] }) {
  const mx = Math.max(1, ...trend.map(r => r.open)), mc = Math.max(1, ...trend.map(r => Math.max(r.done, r.created)));
  const W = 700, H = 150, bw = W / 14;
  const last = trend[13];
  return (
    <>
      <h2 className="sec">Last 14 days</h2>
      <div className="tablewrap" style={{ padding: 12 }}>
        <svg viewBox={`0 0 ${W} ${H + 34}`} style={{ width: "100%", minWidth: 520, display: "block" }} role="img" aria-label="Open items, new and completed per day for the last 14 days">
          {[0, 0.5, 1].map(t => <line key={t} x1={0} x2={W} y1={H - t * H} y2={H - t * H} stroke="var(--line)" />)}
          {trend.map((r, x) => {
            const cx = x * bw, ch = (r.done / mc) * H * 0.55, nh = (r.created / mc) * H * 0.55;
            return (
              <g key={r.d}>
                <rect x={cx + bw * 0.18} y={H - nh} width={bw * 0.3} height={nh} fill="var(--info)" opacity={0.75}><title>{`${r.d}: ${r.created} new`}</title></rect>
                <rect x={cx + bw * 0.52} y={H - ch} width={bw * 0.3} height={ch} fill="var(--ok)"><title>{`${r.d}: ${r.done} completed`}</title></rect>
                <text x={cx + bw / 2} y={H + 16} textAnchor="middle" fontSize={10} fill="var(--muted)" fontFamily="var(--mono)">{r.d.slice(8)}</text>
              </g>
            );
          })}
          <polyline fill="none" stroke="var(--accent)" strokeWidth={2} points={trend.map((r, x) => `${x * bw + bw / 2},${H - (r.open / mx) * H * 0.95}`).join(" ")} />
          {trend.map((r, x) => <circle key={r.d} cx={x * bw + bw / 2} cy={H - (r.open / mx) * H * 0.95} r={x === 13 ? 4 : 2.5} fill="var(--accent)"><title>{`${r.d}: ${r.open} open`}</title></circle>)}
          <text x={13 * bw + bw / 2} y={H - (last.open / mx) * H * 0.95 - 9} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--accent)" fontFamily="var(--mono)">{last.open} open</text>
        </svg>
        <div className="legend" style={{ marginTop: 6 }}><span><i className="dot" style={{ background: "var(--accent)" }} />Open at day end</span><span><i className="dot" style={{ background: "var(--info)" }} />New</span><span><i className="dot" style={{ background: "var(--ok)" }} />Completed</span></div>
      </div>
    </>
  );
}

function DayNote({ projectId, date, note, canEdit }: { projectId: string; date: string; note: DailyData["note"]; canEdit: boolean }) {
  const [f, setF] = useState({ done: note.done, blockers: note.blockers, next: note.next });
  const [busy, start] = useTransition();
  const dirty = f.done !== note.done || f.blockers !== note.blockers || f.next !== note.next;
  return (
    <div className="tablewrap" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div className="field"><label htmlFor="dn_done">Done today / summary</label><AntTextArea id="dn_done" rows={2} placeholder="What moved forward today" value={f.done} disabled={!canEdit} onChange={e => setF({ ...f, done: e.target.value })} /></div>
      <div className="field"><label htmlFor="dn_block">Blockers and decisions needed</label><AntTextArea id="dn_block" rows={2} placeholder="Waiting on…" value={f.blockers} disabled={!canEdit} onChange={e => setF({ ...f, blockers: e.target.value })} /></div>
      <div className="field"><label htmlFor="dn_next">Plan for next working day</label><AntTextArea id="dn_next" rows={2} value={f.next} disabled={!canEdit} onChange={e => setF({ ...f, next: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>{note.updatedAt ? `Saved ${new Date(note.updatedAt).toLocaleString()}` : "Not saved yet for this day"}{dirty && " · unsaved changes"}</span>
        {canEdit && <button className="btn primary" type="button" disabled={busy || !dirty} onClick={() => start(async () => { const r = await saveDailyNote(projectId, date, f); toast(r.ok ? "Status update saved" : r.error); })}>Save update</button>}
      </div>
    </div>
  );
}

function ItemTable({ title, rows, D, extra }: { title: string; rows: Row[]; D: string; extra?: "Completed" | "Created" }) {
  const columns: ColumnsType<Row> = [
    {
      title: "Ref",
      dataIndex: "ref",
      key: "ref",
      width: 80,
      render: (ref: string) => <span className="mono muted">{ref}</span>,
    },
    {
      title: "Module",
      dataIndex: "subModule",
      key: "subModule",
      render: (sub: string) => sub || "—",
    },
    {
      title: "Details",
      dataIndex: "title",
      key: "title",
      render: (t: string, r: Row) => (
        <>
          <Link href={`/tasks?edit=${r.id}`} style={{ color: "inherit", fontWeight: 500 }}>{t}</Link>
          {r.notes && <div className="muted" style={{ fontSize: 12 }}>{r.notes.slice(0, 140)}</div>}
        </>
      ),
    },
    {
      title: "Owner",
      dataIndex: "owner",
      key: "owner",
      render: (owner: string) => owner || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: TaskStatus) => <StatusChip status={status} />,
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      render: (priority: string) => priority ? (
        <Chip color={PRIORITY_COLOR[priority as keyof typeof PRIORITY_COLOR] ?? "var(--muted)"}>{priority}</Chip>
      ) : "—",
    },
    {
      title: "Progress",
      dataIndex: "progress",
      key: "progress",
      align: "right",
      render: (prog: number) => <span className="mono">{prog}%</span>,
    },
    {
      title: "Due",
      dataIndex: "due",
      key: "due",
      render: (due: string, r: Row) => (
        <span className="mono" style={due && due < D && r.status !== "done" ? { color: "var(--bad)" } : undefined}>
          {fmtDay(due)}
        </span>
      ),
    },
    ...(extra ? [{
      title: extra,
      key: "extra",
      render: (_: any, r: Row) => (
        <span className="mono">{fmtDay(extra === "Completed" ? r.doneOn : r.created)}</span>
      ),
    }] : []),
  ];

  return (
    <>
      <h2 className="sec">{title} <span className="mono muted" style={{ fontSize: 14 }}>{rows.length}</span></h2>
      <div className="tablewrap">
        <AntTable
          dataSource={rows}
          columns={columns}
          rowKey="id"
          pagination={rows.length > 10 ? { defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] } : false}
          emptyText={`No ${title.toLowerCase()} items`}
        />
      </div>
    </>
  );
}

function RolloutPanel({ companyId, projectId, data, onClose }: { companyId: string; projectId: string; data: DailyData; onClose: () => void }) {
  const r = data.rollouts.find(x => x.companyId === companyId && x.projectId === projectId);
  const c = data.companies.find(x => x.id === companyId)!, p = data.projects.find(x => x.id === projectId)!;
  const initial = { status: r?.status ?? "none", progress: r?.progress != null ? String(r.progress) : "", startDate: r?.startDate ?? "", targetDate: r?.targetDate ?? "", actualDate: r?.actualDate ?? "", owner: r?.owner ?? "", branches: r?.branches || c.branches.join(", "), notes: r?.notes ?? "" };
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));
  const field = (k: keyof typeof f, label: string, type = "text", full = false) => (
    <div className={"field" + (full ? " full" : "")}>
      <label htmlFor={"ro_" + k}>{label}</label>
      {type === "date" ? (
        <AntDatePicker id={"ro_" + k} value={f[k]} onChange={e => set(k, e.target.value)} />
      ) : (
        <AntInput id={"ro_" + k} type={type} value={f[k]} onChange={e => set(k, e.target.value)} />
      )}
    </div>
  );
  return (
    <Panel title={`${p.name} · ${c.name}`} subtitle={[c.country, data.holdingName && `${data.holdingName} group`].filter(Boolean).join(" · ")} dirty={dirty} onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span />
          <div>
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            <button className="btn primary" type="button" disabled={busy} onClick={() => start(async () => { setError(""); const res = await saveRollout({ ...f, companyId, projectId, status: f.status as "none" }); if (!res.ok) { setError(res.error); return; } toast("Saved"); onClose(); })}>Save</button>
          </div>
        </>
      )}>
      <form className="form" onSubmit={e => e.preventDefault()}>
        <div className="field">
          <label htmlFor="ro_st">Implementation status</label>
          <AntSelect
            id="ro_st"
            value={f.status}
            onChange={e => { const v = e.target.value; setF(x => ({ ...x, status: v, ...(v === "live" ? { progress: "100", actualDate: x.actualDate || today() } : {}) })); }}
            options={ROLLOUT_STATUSES.map(s => [s.key, s.label])}
          />
        </div>
        {field("progress", "Progress %", "number")}
        {field("startDate", "Start date", "date")}{field("targetDate", "Target go-live", "date")}{field("actualDate", "Actual go-live", "date")}
        {field("owner", "Owner")}{field("branches", "Branches covered", "text", true)}
        <div className="field full"><label htmlFor="ro_nt">Current status / blockers</label><AntTextArea id="ro_nt" value={f.notes} onChange={e => set("notes", e.target.value)} /></div>
        {r && r.log.length > 0 && (
          <div className="field full"><label>History</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              {[...r.log].reverse().map((l, i) => <div key={i}><span className="mono muted">{fmtDay(l.d)}</span> · {RO[l.from]?.label ?? "—"} → <b style={{ fontWeight: 600 }}>{RO[l.to]?.label ?? l.to}</b></div>)}
            </div>
          </div>
        )}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
