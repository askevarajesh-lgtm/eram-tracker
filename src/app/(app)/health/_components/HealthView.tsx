"use client";
import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { Fragment, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { bulkFix, type BulkFixField } from "@/server/work";
import { PRIORITIES } from "@/lib/constants";
import { AItem, StatusChip } from "@/components/ui/bits";
import { Kpi } from "@/components/ui/Kpi";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntSelect, AntDatePicker, AntInput, AntTable, type ColumnsType } from "@/components/ui/antd";

type TaskItem = { id: string; ref: string; subModule: string; title: string; status: TaskStatus; devs: string };
type OtherItem = { id: string; title: string; href: string; hint: string };
export type Check = { key: string; label: string; kind: "task" | "other"; field: BulkFixField | null; items: (TaskItem | OtherItem)[] };

const taskColumns: ColumnsType<TaskItem> = [
  {
    title: "Ref",
    dataIndex: "ref",
    key: "ref",
    width: 90,
    render: (ref: string) => <span className="mono muted">{ref}</span>,
  },
  {
    title: "Module",
    dataIndex: "subModule",
    key: "subModule",
    render: (subModule: string) => subModule || "—",
  },
  {
    title: "Title",
    dataIndex: "title",
    key: "title",
    render: (title: string, t: TaskItem) => (
      <Link href={`/tasks?view=${t.id}`} style={{ color: "inherit", fontWeight: 500 }}>
        {title}
      </Link>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 120,
    render: (status: TaskStatus) => <StatusChip status={status} />,
  },
  {
    title: "Developers",
    dataIndex: "devs",
    key: "devs",
    render: (devs: string) => devs || "—",
  },
];

export function HealthView({ checks, developers, modules, canManage }: { checks: Check[]; developers: { id: string; name: string }[]; modules: string[]; canManage: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [fixing, setFixing] = useState<Check | null>(null);
  const total = checks.reduce((a, c) => a + c.items.length, 0);
  return (
    <>
      <p className="muted" style={{ margin: "0 0 14px" }}>Gaps that make the status report less reliable. Fix them in bulk where a button is offered, or open each item.</p>
      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <Kpi n={total} label="Things to fix" bad={total > 0} />
        <Kpi n={`${checks.filter(c => !c.items.length).length}/${checks.length}`} label="Checks passing" />
      </div>
      <div className="alist" style={{ marginTop: 16 }}>
        {checks.map(c => (
          <Fragment key={c.key}>
            <AItem
              color={c.items.length ? "var(--warn)" : "var(--ok)"}
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {!c.items.length && <Check size={15} style={{ color: "var(--ok)", flexShrink: 0 }} />}
                  {c.label}
                </span>
              }
              sub={c.items.length ? `${c.items.length} to fix` : "All good"}
              right={c.items.length ? (
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn" type="button" onClick={() => setOpen(open === c.key ? null : c.key)}>{open === c.key ? "Hide" : "Show"}</button>
                  {c.field && canManage && <button className="btn primary" type="button" onClick={() => setFixing(c)}>Fix in bulk</button>}
                </span>
              ) : undefined} />
            {open === c.key && c.items.length > 0 && (
              <div style={{ padding: "10px 14px", background: "var(--sunk)" }}>
                {c.kind === "other" ? (c.items as OtherItem[]).map(o => <div key={o.id}><Link href={o.href}>{o.title}</Link> <span className="muted">· {o.hint}</span></div>) : (
                  <div className="tablewrap">
                    <AntTable
                      dataSource={c.items as TaskItem[]}
                      columns={taskColumns}
                      rowKey="id"
                      pagination={(c.items as TaskItem[]).length > 10 ? { defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] } : false}
                      emptyText="No items to fix"
                    />
                  </div>
                )}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {fixing && <FixPanel check={fixing} developers={developers} modules={modules} onClose={() => setFixing(null)} />}
    </>
  );
}

function FixPanel({ check, developers, modules, onClose }: { check: Check; developers: { id: string; name: string }[]; modules: string[]; onClose: () => void }) {
  const field = check.field!;
  const defaults: Record<BulkFixField, string> = { due: "", priority: "Medium", progress: "", lead: "_first", assignee: developers[0]?.id ?? "", status: "pending", subModule: "", size: "M", completed: "_today" };
  const [v, setV] = useState(defaults[field]);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const sel = (opts: [string, string][]) => <AntSelect id="bf_v" value={v} onChange={e => setV(e.target.value)} options={opts} />;
  const control = {
    due: <AntDatePicker id="bf_v" value={v} onChange={e => setV(e.target.value)} />,
    priority: sel(PRIORITIES.map(p => [p, p])),
    progress: <AntInput id="bf_v" type="number" min={0} max={100} placeholder="0-100" value={v} onChange={e => setV(e.target.value)} />,
    lead: sel([["_first", "First assigned developer"], ...developers.map(d => [d.id, `${d.name} (where assigned)`] as [string, string])]),
    assignee: sel(developers.map(d => [d.id, d.name])),
    status: sel([["progress", "In progress"], ["pending", "Keep open (mark requirement Pending)"]]),
    subModule: <AntSelect id="bf_v" value={v} onChange={e => setV(e.target.value)} empty="—" allowCreate options={modules.map(m => [m, m])} />,
    size: sel([["S", "S · about 4 h"], ["M", "M · about 2 days"], ["L", "L · about 1 week"], ["XL", "XL · 2 weeks+"]]),
    completed: sel([["_today", "Today's date"], ["_import", "Date the item was created / loaded"]]),
  }[field];
  return (
    <Panel title={`Fix: ${check.label}`} subtitle={`${check.items.length} items. Applies to all of them; you can still change single items afterwards.`} dirty={!!v} onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span />
          <div>
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            <button className="btn primary" type="button" disabled={busy} onClick={() => start(async () => { setError(""); const r = await bulkFix(field, check.items.map(i => i.id), v); if (!r.ok) { setError(r.error); return; } toast(`Updated ${r.data!.count} items`); onClose(); })}>Apply to {check.items.length}</button>
          </div>
        </>
      )}>
      <div className="field"><label htmlFor="bf_v">Set to</label>{control}</div>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}
