"use client";
import { useMemo, useState, useTransition } from "react";
import { countsAgainst } from "@/lib/licensing";
import type { CompanyOption, LicencePool } from "@/server/queries";
import { setLicenceHolders } from "@/server/licences";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntInput, AntSelect, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";

/** A person in the Users & access register (not an app account). */
export type AssignRecord = {
  id: string; name: string; email: string; companyId: string; companyName: string; branch: string; dept: string;
  status: string; userType: string; licenceIds: string[];
};

type Props = { pool: LicencePool; pools: LicencePool[]; records: AssignRecord[]; companies: CompanyOption[]; onClose: () => void };

export function AssignPanel({ pool, pools, records, companies, onClose }: Props) {
  const before = useMemo(() => new Set(pool.holderIds), [pool]);
  const [want, setWant] = useState<Set<string>>(() => new Set(pool.holderIds));
  const [q, setQ] = useState("");
  const [comp, setComp] = useState(pool.companyId);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = want.size !== before.size || [...want].some(id => !before.has(id));

  const poolById = useMemo(() => new Map(pools.map(p => [p.id, p])), [pools]);
  const ql = q.trim().toLowerCase();
  const shown = records.filter(r =>
    (countsAgainst(pool.audience, r.userType) || want.has(r.id)) &&
    (!comp || r.companyId === comp) &&
    (!ql || [r.name, r.email, r.dept, r.branch].join(" ").toLowerCase().includes(ql)));
  const counted = records.filter(r => want.has(r.id) && countsAgainst(pool.audience, r.userType)).length;
  const over = counted > pool.quantity;

  const toggle = (id: string, on: boolean) => setWant(w => { const n = new Set(w); if (on) n.add(id); else n.delete(id); return n; });

  const save = () => start(async () => {
    setError("");
    const r = await setLicenceHolders(pool.id, [...want]);
    if (!r.ok) { setError(r.error); return; }
    const { added, removed } = r.data!;
    toast(added || removed ? `Updated: ${added} added, ${removed} removed` : "No changes");
    onClose();
  });

  return (
    <Panel
      wide
      title={`Assign ${pool.software} · ${pool.type}`}
      dirty={dirty}
      onClose={onClose}
      footer={<><span /><div>
        <button className="btn" type="button" onClick={() => { if (!dirty || confirm("You have unsaved changes. Close without saving?")) onClose(); }}>Cancel</button>
        <button className="btn primary" type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save assignments"}</button>
      </div></>}
    >
      <div className="muted">
        <b style={{ color: over ? "var(--bad)" : "var(--fg)" }}>{counted} of {pool.quantity}</b> licences assigned
        {over && ` · ${counted - pool.quantity} over the purchased quantity`}
        {pool.audience === "endusers" && " · business users only; developers, IT and consultants are not listed or counted"}
      </div>
      <div className="filters" style={{ margin: 0 }}>
        <AntInput placeholder="Search people…" value={q} onChange={e => setQ(e.target.value)} allowClear aria-label="Search people"
          style={{ width: 220 }} />
        <AntSelect aria-label="Company" value={comp} onChange={e => setComp(e.target.value)}
          empty="All companies"
          options={companies.map(c => [c.id, c.name + (c.country ? ` (${c.country})` : "")])}
          style={{ width: "auto", minWidth: 160 }}
        />
        <button className="btn" type="button" onClick={() => setWant(w => new Set([...w, ...shown.map(r => r.id)]))}>Select all shown</button>
        <button className="btn" type="button" onClick={() => setWant(new Set())}>Deselect all</button>
      </div>
      {(() => {
        const columns: ColumnsType<AssignRecord> = [
          {
            title: "",
            key: "select",
            width: 44,
            render: (_: any, r: AssignRecord) => (
              <AntCheckbox aria-label={r.name} checked={want.has(r.id)} onChange={e => toggle(r.id, e.target.checked)} />
            ),
          },
          {
            title: "Person",
            dataIndex: "name",
            key: "name",
            render: (name: string, r: AssignRecord) => (
              <>
                <b style={{ fontWeight: 500 }}>{name}</b>{r.status === "Inactive" && <> <Chip color="var(--hold)">Inactive</Chip></>}
                <div className="muted" style={{ fontSize: 12 }}>{r.email}</div>
              </>
            ),
          },
          {
            title: "Company / branch",
            key: "company",
            render: (_: any, r: AssignRecord) => `${r.companyName}${r.branch ? ` · ${r.branch}` : ""}`,
          },
          {
            title: `Current ${pool.software} licence`,
            key: "licence",
            render: (_: any, r: AssignRecord) => {
              const other = r.licenceIds.map(id => poolById.get(id)).find(p => p && p.software === pool.software && p.id !== pool.id);
              return other ? (
                <>{other.type}{want.has(r.id) && <span className="muted" style={{ fontSize: 12 }}> → moves to {pool.type}</span>}</>
              ) : (
                <span className="muted">—</span>
              );
            },
          },
        ];

        return (
          <div className="tablewrap">
            <AntTable
              dataSource={shown}
              columns={columns}
              rowKey="id"
              pagination={shown.length > 20 ? { pageSize: 20 } : false}
              scroll={{ y: "45vh" }}
              emptyTitle="No one here"
              emptyDescription="Add people in Users & access first, or change the company filter."
            />
          </div>
        );
      })()}
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}
