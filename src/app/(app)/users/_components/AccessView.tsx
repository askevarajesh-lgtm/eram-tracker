"use client";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { isBusinessUser } from "@/lib/licensing";
import type { CompanyOption, LicencePool } from "@/server/queries";
import { setAppAccess } from "@/server/access";
import { Chip } from "@/components/ui/Chip";
import { toast } from "@/components/ui/Toaster";
import { useUrlUpdate } from "@/components/ui/useUrl";
import { AntSelect, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";
import { RecordActions } from "@/components/ui/RecordActions";
import { deleteAccessRecord } from "@/server/access";
import { AccessDetailModal } from "./AccessDetailModal";
import { AccessForm } from "./AccessForm";
import type { AccessRow, ProjectCard } from "./types";

type Props = {
  rows: AccessRow[];
  total: number;
  projects: ProjectCard[];
  pools: LicencePool[];
  companies: CompanyOption[];
  departments: string[];
  canManage: boolean;
  openNew: boolean;
  openId?: string;
  openViewId?: string;
  defaultCompanyId: string;
};

export function AccessView({ rows, total, projects, pools, companies, departments, canManage, openNew, openId, openViewId, defaultCompanyId }: Props) {
  const { update } = useUrlUpdate();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkProject, setBulkProject] = useState(projects[0]?.id ?? "");
  const [busy, start] = useTransition();
  const [viewing, setViewing] = useState<AccessRow | null>(() => {
    return openViewId ? rows.find(r => r.id === openViewId) ?? null : null;
  });

  useEffect(() => {
    if (openViewId) {
      setViewing(rows.find(r => r.id === openViewId) ?? null);
    } else {
      setViewing(null);
    }
  }, [openViewId, rows]);

  // ticks show straight away; they fall back to the saved state if the server refuses
  const [pendingTicks, setPendingTick] = useOptimistic(new Map<string, boolean>(), (m, [k, v]: [string, boolean]) => new Map(m).set(k, v));

  const poolById = useMemo(() => new Map(pools.map(p => [p.id, p])), [pools]);
  const linkedProjects = useMemo(() => new Set(pools.map(p => p.projectId).filter(Boolean)), [pools]);
  // software whose licences aren't tied to a system get their own column
  const otherSoftware = useMemo(() => [...new Set(pools.map(p => p.software))].filter(sw => pools.filter(p => p.software === sw).every(p => !p.projectId)), [pools]);

  const editing = openNew ? "new" : openId ? rows.find(r => r.id === openId) ?? null : null;
  const setOpen = (v: string | null) => update({ new: v === "new" ? "1" : null, edit: v && v !== "new" ? v : null, view: null });

  const toggle = (r: AccessRow, projectId: string, on: boolean) => start(async () => {
    setPendingTick([`${r.id}|${projectId}`, on]);
    const res = await setAppAccess([r.id], projectId, on);
    const name = projects.find(p => p.id === projectId)?.name ?? "";
    toast(!res.ok ? res.error : `${on ? "Gave" : "Removed"} ${name} access ${on ? "to" : "from"} ${r.name}${res.data!.released ? " and released the licence" : ""}`);
  });

  const bulk = (on: boolean) => start(async () => {
    const res = await setAppAccess([...sel], bulkProject, on);
    const name = projects.find(p => p.id === bulkProject)?.name ?? "";
    toast(!res.ok ? res.error : `${on ? "Gave" : "Removed"} ${name} access ${on ? "to" : "from"} ${res.data!.changed} ${res.data!.changed === 1 ? "person" : "people"}`);
  });

  const allSel = rows.length > 0 && rows.every(r => sel.has(r.id));
  const addBtn = canManage && <button className="btn primary" type="button" onClick={() => setOpen("new")}>+ Add person</button>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <span className="muted">{rows.length === total ? `${total} ${total === 1 ? "person" : "people"}` : `${rows.length} of ${total} match the filters`}</span>
        {addBtn}
      </div>

      {canManage && sel.size > 0 && (
        <div className="banner" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <b>{sel.size} selected</b>
          <AntSelect
            value={bulkProject}
            onChange={e => setBulkProject(e.target.value)}
            aria-label="System"
            style={{ width: "auto", minWidth: 140 }}
            options={projects.map(p => [p.id, p.name])}
          />
          <button className="btn primary" type="button" disabled={busy} onClick={() => bulk(true)}>Give access</button>
          <button className="btn" type="button" disabled={busy} onClick={() => bulk(false)}>Remove access</button>
          <button className="btn" type="button" onClick={() => setSel(new Set())}>Deselect all</button>
        </div>
      )}

      {(() => {
        const columns: ColumnsType<AccessRow> = [
          ...(canManage
            ? [
                {
                  title: (
                    <AntCheckbox
                      aria-label="Select all shown"
                      checked={allSel}
                      onChange={e => setSel(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())}
                    />
                  ),
                  key: "select",
                  width: 44,
                  render: (_: unknown, r: AccessRow) => (
                    <AntCheckbox
                      aria-label={`Select ${r.name}`}
                      checked={sel.has(r.id)}
                      onChange={e => {
                        const n = new Set(sel);
                        if (e.target.checked) n.add(r.id);
                        else n.delete(r.id);
                        setSel(n);
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            title: "Person",
            dataIndex: "name",
            key: "name",
            render: (name: string, r: AccessRow) => (
              <div>
                <b style={{ fontWeight: 500 }}>{name}</b>
                {!isBusinessUser(r.userType) && <> <Chip color="var(--lms)">{r.userType}</Chip></>}
                <div className="muted" style={{ fontSize: 12 }}>{[r.email, r.dept].filter(Boolean).join(" · ")}</div>
              </div>
            ),
          },
          {
            title: "Company / branch",
            key: "company",
            render: (_: unknown, r: AccessRow) => (
              <div>
                {r.companyName || <span className="muted">—</span>}
                {r.branch && <div className="muted" style={{ fontSize: 12 }}>{r.branch}</div>}
              </div>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status: string) => status === "Inactive" ? <Chip color="var(--hold)">Inactive</Chip> : <Chip color="var(--ok)">Active</Chip>,
          },
          ...projects.map(p => ({
            title: <span className="mtag" style={{ ["--mc" as string]: p.color }}>{p.name}</span>,
            key: p.id,
            align: "center" as const,
            render: (_: unknown, r: AccessRow) => {
              const access = r.apps.find(a => a.projectId === p.id);
              const held = r.licenceIds.map(id => poolById.get(id)).filter((x): x is LicencePool => !!x);
              const lic = held.find(h => h.projectId === p.id);
              const noLicence = access && linkedProjects.has(p.id) && !lic && isBusinessUser(r.userType);
              return (
                <label style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: canManage ? "pointer" : "default" }}>
                  <AntCheckbox
                    checked={pendingTicks.get(`${r.id}|${p.id}`) ?? !!access}
                    disabled={!canManage}
                    aria-label={`${r.name} – ${p.name}`}
                    onChange={e => toggle(r, p.id, e.target.checked)}
                  />
                  {lic ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: p.color }}>{lic.type}</span>
                  ) : noLicence ? (
                    <span style={{ fontSize: 11, color: "var(--warn)" }}>no licence</span>
                  ) : access?.role ? (
                    <span className="muted" style={{ fontSize: 11 }}>{access.role}</span>
                  ) : null}
                </label>
              );
            },
          })),
          ...(otherSoftware.length > 0
            ? [
                {
                  title: "Other licences",
                  key: "otherSoftware",
                  render: (_: unknown, r: AccessRow) => {
                    const held = r.licenceIds.map(id => poolById.get(id)).filter((x): x is LicencePool => !!x);
                    const list = held.filter(h => !h.projectId);
                    return list.length ? (
                      <div style={{ fontSize: 12 }}>
                        {list.map(h => <div key={h.id}>{h.software}: {h.type}</div>)}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    );
                  },
                },
              ]
            : []),
                {
                  title: "Actions",
                  key: "actions",
                  align: "right" as const,
                  width: 110,
                  render: (_: unknown, r: AccessRow) => (
                    <RecordActions
                      onView={() => {
                        setViewing(r);
                        update({ view: r.id, edit: null });
                      }}
                      onEdit={canManage ? () => setOpen(r.id) : undefined}
                      onDelete={
                        canManage
                          ? async () => {
                              const res = await deleteAccessRecord(r.id);
                              if (!res.ok) {
                                toast(res.error ?? "Failed to delete person");
                              } else {
                                toast(`${r.name} deleted`);
                              }
                            }
                          : undefined
                      }
                      deleteConfirmTitle={`Delete ${r.name}?`}
                      deleteConfirmMessage={`Are you sure you want to delete ${r.name} from Users & access? Any allocated licences will be freed up.`}
                      canEdit={canManage}
                      canDelete={canManage}
                    />
                  ),
                },
              ];

        return (
          <AntTable<AccessRow>
            dataSource={rows}
            columns={columns}
            rowKey="id"
            onRowClick={r => {
              setViewing(r);
              update({ view: r.id, edit: null });
            }}
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"] }}
            emptyTitle={total === 0 ? "No one in the register yet" : "No one matches these filters"}
            emptyDescription={
              total === 0
                ? "Add people who use SAP B1, ATS, CRM and LMS, then set which systems they can use."
                : "Try adjusting the company or system filters."
            }
            emptyAction={canManage && total === 0 ? addBtn : undefined}
          />
        );
      })()}

      {viewing && (
        <AccessDetailModal
          record={viewing}
          projects={projects}
          pools={pools}
          canManage={canManage}
          onEdit={() => {
            const id = viewing.id;
            setViewing(null);
            setOpen(id);
          }}
          onClose={() => {
            setViewing(null);
            update({ view: null });
          }}
        />
      )}

      {canManage && editing !== null && (
        <AccessForm
          key={editing === "new" ? "new" : editing.id}
          record={editing === "new" ? null : editing}
          projects={projects}
          pools={pools}
          companies={companies}
          departments={departments}
          defaultCompanyId={defaultCompanyId}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
