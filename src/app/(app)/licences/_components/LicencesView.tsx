"use client";
import { useState } from "react";
import { LayoutDashboard, Key } from "lucide-react";
import { AUDIENCES, daysUntil, type Audience } from "@/lib/licensing";
import { fmtDay } from "@/lib/dates";
import { projectColor } from "@/lib/constants";
import type { CompanyOption, LicencePool } from "@/server/queries";
import { Chip } from "@/components/ui/Chip";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntSelect, AntTable, type ColumnsType } from "@/components/ui/antd";
import { RecordActions } from "@/components/ui/RecordActions";
import { deleteLicence } from "@/server/licences";
import { toast } from "@/components/ui/Toaster";
import { LicenceDetailModal } from "./LicenceDetailModal";
import { LicenceForm } from "./LicenceForm";
import { AssignPanel, type AssignRecord } from "./AssignPanel";
import { LicenceDashboard } from "./LicenceDashboard";
import { Summary, Utilisation } from "@/components/shared/licences/LicenceWidgets";
export { Summary, Utilisation } from "@/components/shared/licences/LicenceWidgets";

type Props = {
  pools: LicencePool[];
  companies: CompanyOption[];
  projects: { id: string; name: string }[];
  records: AssignRecord[];
  canManage: boolean;
  tab?: "dashboard" | "list";
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

export function LicencesView({ pools, companies, projects, records, canManage, tab, software, openNew, openId, assignId }: Props) {
  const { update } = useUrlUpdate();
  const [viewing, setViewing] = useState<LicencePool | null>(null);
  const activeTab = tab === "list" ? "list" : "dashboard";

  const allSoftware = [...new Set(pools.map(p => p.software))];
  const shown = software ? allSoftware.filter(s => s === software) : allSoftware;

  const editing = openNew ? "new" : openId ? pools.find(p => p.id === openId) ?? null : null;
  const assigning = assignId ? pools.find(p => p.id === assignId) ?? null : null;
  const close = () => update({ new: null, edit: null, assign: null });
  const addBtn = canManage && <button className="btn primary" type="button" onClick={() => update({ new: "1" })}>+ Add licence</button>;

  return (
    <>
      <div className="filters" style={{ alignItems: "center" }}>
        <span className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-pressed={activeTab === "dashboard"}
            onClick={() => update({ tab: "dashboard" })}
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-pressed={activeTab === "list"}
            onClick={() => update({ tab: "list" })}
          >
            <Key size={15} />
            <span>Licence list</span>
            <span className="seg-badge">{pools.length}</span>
          </button>
        </span>

        <span style={{ flex: 1 }} />

        {activeTab === "list" && allSoftware.length > 1 && (
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

      {activeTab === "dashboard" ? (
        <LicenceDashboard
          pools={pools}
          companies={companies}
          projects={projects}
          records={records}
          canManage={canManage}
          onGoToList={sw => update({ tab: "list", sw: sw ?? null })}
          onView={p => setViewing(p)}
          onEdit={id => update({ edit: id })}
          onAssign={id => update({ assign: id })}
          onAdd={() => update({ new: "1" })}
        />
      ) : (
        <>
          {allSoftware.length === 0 ? (
            <div className="empty">
              <b>No licences recorded</b>
              Record each licence type you have bought (for example SAP B1 Professional × 10), then assign them to people in Users &amp; access.
              <div>{addBtn}</div>
            </div>
          ) : (
            shown.map(sw => {
              const list = pools.filter(p => p.software === sw);
              const P = list.reduce((a, p) => a + p.quantity, 0), A = list.reduce((a, p) => a + p.assigned, 0);
              const proj = list.find(p => p.projectId);
              return (
                <section key={sw}>
                  <div className="grouph" style={{ marginTop: 26, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="mtag" style={{ ["--mc" as string]: proj ? projectColor(proj.projectName) : "var(--other)" }}>{sw}</span>
                      <h3 style={{ margin: 0 }}>{sw} Licence Pool</h3>
                    </div>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: P - A < 0 ? "var(--bad)" : "var(--muted)" }}>
                      {P} purchased · {A} assigned · {P - A} available
                    </span>
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
                      {
                        title: "Actions",
                        key: "actions",
                        align: "right" as const,
                        width: 170,
                        render: (_: unknown, p: LicencePool) => (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                            {canManage && (
                              <button className="btn primary" type="button" onClick={() => update({ assign: p.id })}>
                                Assign
                              </button>
                            )}
                            <RecordActions
                              onView={() => setViewing(p)}
                              onEdit={canManage ? () => update({ edit: p.id }) : undefined}
                              onDelete={
                                canManage
                                  ? async () => {
                                      const r = await deleteLicence(p.id);
                                      if (!r.ok) {
                                        toast(r.error ?? "Failed to delete licence");
                                      } else {
                                        toast(`Licence deleted${r.data?.released ? ` and released from ${r.data.released} people` : ""}`);
                                      }
                                    }
                                  : undefined
                              }
                              deleteConfirmTitle={`Delete ${p.software} (${p.type}) licence?`}
                              deleteConfirmMessage={
                                p.assigned > 0
                                  ? `Are you sure you want to delete this ${p.software} (${p.type}) licence? It is currently assigned to ${p.assigned} ${p.assigned === 1 ? "person" : "people"}. Deleting it will release their licence assignments.`
                                  : `Are you sure you want to delete this ${p.software} (${p.type}) licence? This action cannot be undone.`
                              }
                              canEdit={canManage}
                              canDelete={canManage}
                            />
                          </div>
                        ),
                      },
                    ];

                    return (
                      <div style={{ marginTop: 10 }}>
                        <AntTable<LicencePool>
                          dataSource={list}
                          columns={poolColumns}
                          rowKey="id"
                          onRowClick={p => setViewing(p)}
                          pagination={false}
                          emptyTitle="No licences in this pool"
                          emptyDescription="Add licences to this category using the button above."
                        />
                      </div>
                    );
                  })()}
                </section>
              );
            })
          )}
        </>
      )}

      {viewing && (
        <LicenceDetailModal
          pool={viewing}
          records={records}
          canManage={canManage}
          onEdit={() => {
            const id = viewing.id;
            setViewing(null);
            update({ edit: id });
          }}
          onAssign={() => {
            const id = viewing.id;
            setViewing(null);
            update({ assign: id });
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {canManage && editing !== null && (
        <LicenceForm key={editing === "new" ? "new" : editing.id} pool={editing === "new" ? null : editing} companies={companies} projects={projects}
          softwareList={allSoftware} defaultSoftware={software || allSoftware[0] || "SAP B1"} onClose={close} />
      )}
      {canManage && assigning && <AssignPanel key={assigning.id} pool={assigning} pools={pools} records={records} companies={companies} onClose={close} />}
    </>
  );
}
