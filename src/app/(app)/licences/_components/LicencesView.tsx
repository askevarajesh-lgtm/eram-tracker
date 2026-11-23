"use client";
import { AUDIENCES, daysUntil, type Audience } from "@/lib/licensing";
import { fmtDay } from "@/lib/dates";
import { projectColor } from "@/lib/constants";
import type { CompanyOption, LicencePool } from "@/server/queries";
import { Chip } from "@/components/ui/Chip";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntSelect, AntTable, type ColumnsType } from "@/components/ui/antd";
import { LicenceForm } from "./LicenceForm";
import { AssignPanel, type AssignRecord } from "./AssignPanel";
import { Summary, Utilisation } from "@/components/shared/licences/LicenceWidgets";
export { Summary, Utilisation } from "@/components/shared/licences/LicenceWidgets";

type Props = {
  pools: LicencePool[];
  companies: CompanyOption[];
  projects: { id: string; name: string }[];
  records: AssignRecord[];
  canManage: boolean;
  software: string;
  openNew: boolean;
  openId?: string;
  assignId?: string;
};



function Renewal({ day }: { day: string }) {
  const n = daysUntil(day);
  if (n == null) return <span className="muted">—</span>;
  const color = n < 0 ? "var(--bad)" : n <= 60 ? "var(--warn)" : "var(--fg)";
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span className="mono" style={{ color, fontWeight: n <= 60 ? 600 : undefined }}>{fmtDay(day)}</span>{" "}
      {n < 0 ? <Chip color="var(--bad)">Expired</Chip> : n <= 60 ? <Chip color="var(--warn)">{n} days</Chip> : null}
    </span>
  );
}



export function LicencesView({ pools, companies, projects, records, canManage, software, openNew, openId, assignId }: Props) {
  const { update } = useUrlUpdate();
  const allSoftware = [...new Set(pools.map(p => p.software))];
  const shown = software ? allSoftware.filter(s => s === software) : allSoftware;

  const editing = openNew ? "new" : openId ? pools.find(p => p.id === openId) ?? null : null;
  const assigning = assignId ? pools.find(p => p.id === assignId) ?? null : null;
  const close = () => update({ new: null, edit: null, assign: null });
  const addBtn = canManage && <button className="btn primary" type="button" onClick={() => update({ new: "1" })}>+ Add licence</button>;

  return (
    <>
      <div className="filters">
        <span className="muted" style={{ flex: 1 }}>Licences bought for SAP B1 and other software, who holds each one, and when they renew.</span>
        {allSoftware.length > 1 && (
          <AntSelect
            aria-label="Software"
            value={software}
            onChange={e => update({ sw: e.target.value })}
            empty="All software"
            options={allSoftware.map(s => [s, s])}
            style={{ width: "auto", minWidth: 160 }}
          />
        )}
        {addBtn}
      </div>

      {allSoftware.length === 0 && (
        <div className="empty">
          <b>No licences recorded</b>
          Record each licence type you have bought (for example SAP B1 Professional × 10), then assign them to people in Users &amp; access.
          <div>{addBtn}</div>
        </div>
      )}

      {shown.map(sw => {
        const list = pools.filter(p => p.software === sw);
        const P = list.reduce((a, p) => a + p.quantity, 0), A = list.reduce((a, p) => a + p.assigned, 0);
        const proj = list.find(p => p.projectId);
        return (
          <section key={sw}>
            <div className="grouph" style={{ marginTop: 26 }}>
              <span className="mtag" style={{ ["--mc" as string]: proj ? projectColor(proj.projectName) : "var(--other)" }}>{sw}</span>
              <h3>{P} licences · {A} assigned · {P - A} available</h3>
            </div>
            {list.some(p => p.audience === "endusers") && (
              <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 13 }}>
                Business-user licences: only business users are counted. Developers, IT and consultants doing development or testing are not counted against these.
              </p>
            )}
            <Summary pools={list} />
            {(() => {
              const poolColumns: ColumnsType<LicencePool> = [
                {
                  title: "Licence type",
                  key: "type",
                  render: (_: unknown, p: LicencePool) => (
                    <div>
                      <b style={{ fontWeight: 600 }}>{p.type}</b>{" "}
                      {p.audience && <Chip color={p.audience === "endusers" ? "var(--accent)" : "var(--lms)"}>{AUDIENCES[p.audience as Audience] ?? p.audience}</Chip>}
                      {p.contract && <div className="muted mono" style={{ fontSize: 11 }}>{p.contract}</div>}
                    </div>
                  ),
                },
                {
                  title: "Company",
                  dataIndex: "companyName",
                  key: "companyName",
                  render: (name?: string) => name || <span className="muted">Group-wide</span>,
                },
                {
                  title: "Purchased",
                  dataIndex: "quantity",
                  key: "quantity",
                  className: "num",
                  align: "right",
                },
                {
                  title: "Assigned",
                  dataIndex: "assigned",
                  key: "assigned",
                  className: "num",
                  align: "right",
                },
                {
                  title: "Available",
                  key: "available",
                  className: "num",
                  align: "right",
                  render: (_: unknown, p: LicencePool) => {
                    const avail = p.quantity - p.assigned;
                    return <span style={avail < 0 ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{avail}</span>;
                  },
                },
                {
                  title: "Utilisation",
                  key: "utilisation",
                  width: 140,
                  render: (_: unknown, p: LicencePool) => <Utilisation assigned={p.assigned} total={p.quantity} />,
                },
                {
                  title: "Model",
                  dataIndex: "model",
                  key: "model",
                  className: "muted",
                },
                {
                  title: "Renewal / expiry",
                  dataIndex: "renewal",
                  key: "renewal",
                  render: (renewal: string) => <Renewal day={renewal} />,
                },
                {
                  title: "Vendor",
                  dataIndex: "vendor",
                  key: "vendor",
                  className: "muted",
                },
                {
                  title: "Annual cost",
                  key: "cost",
                  className: "num mono",
                  align: "right",
                  render: (_: unknown, p: LicencePool) => (p.cost ? `${Number(p.cost).toLocaleString()} ${p.currency}` : "—"),
                },
                ...(canManage
                  ? [
                      {
                        title: "",
                        key: "action",
                        align: "right" as const,
                        render: (_: unknown, p: LicencePool) => (
                          <div style={{ whiteSpace: "nowrap" }}>
                            <button className="btn primary" type="button" onClick={() => update({ assign: p.id })}>
                              Assign
                            </button>{" "}
                            <button className="btn" type="button" onClick={() => update({ edit: p.id })}>
                              Edit
                            </button>
                          </div>
                        ),
                      },
                    ]
                  : []),
              ];

              return (
                <div style={{ marginTop: 10 }}>
                  <AntTable<LicencePool>
                    dataSource={list}
                    columns={poolColumns}
                    rowKey="id"
                    pagination={false}
                    emptyTitle="No licences in this pool"
                    emptyDescription="Add licences to this category using the button above."
                  />
                </div>
              );
            })()}
          </section>
        );
      })}

      {canManage && editing !== null && (
        <LicenceForm key={editing === "new" ? "new" : editing.id} pool={editing === "new" ? null : editing} companies={companies} projects={projects}
          softwareList={allSoftware} defaultSoftware={software || allSoftware[0] || "SAP B1"} onClose={close} />
      )}
      {canManage && assigning && <AssignPanel key={assigning.id} pool={assigning} pools={pools} records={records} companies={companies} onClose={close} />}
    </>
  );
}
