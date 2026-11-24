"use client";
import { useMemo, useState, useTransition } from "react";
import { USER_TYPES, countsAgainst, isBusinessUser } from "@/lib/licensing";
import type { CompanyOption, LicencePool } from "@/server/queries";
import { deleteAccessRecord, saveAccessRecord } from "@/server/access";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { confirmAction } from "@/components/ui/ConfirmCloseModal";
import { AntInput, AntSelect, AntCheckbox } from "@/components/ui/antd";
import type { AccessRow, ProjectCard } from "./types";

type Props = {
  record: AccessRow | null;
  projects: ProjectCard[];
  pools: LicencePool[];
  companies: CompanyOption[];
  departments: string[];
  defaultCompanyId: string;
  onClose: () => void;
};

type Form = {
  name: string; email: string; sapCode: string; companyId: string; branch: string; dept: string; designation: string;
  status: "Active" | "Inactive"; userType: (typeof USER_TYPES)[number];
  apps: Record<string, { on: boolean; role: string }>;
  /** software -> licence pool id ("" = none) */
  licences: Record<string, string>;
};

const small: React.CSSProperties = { font: "13px var(--body)", padding: "6px 9px", border: "1px solid var(--line)", borderRadius: "var(--r)", background: "var(--bg)", color: "var(--fg)", minWidth: 0 };

export function AccessForm({ record, projects, pools, companies, departments, defaultCompanyId, onClose }: Props) {
  const software = useMemo(() => [...new Set(pools.map(p => p.software))], [pools]);
  const initial = useMemo<Form>(() => {
    const held = pools.filter(p => record?.licenceIds.includes(p.id));
    return {
      name: record?.name ?? "", email: record?.email ?? "", sapCode: record?.sapCode ?? "", companyId: record?.companyId ?? defaultCompanyId,
      branch: record?.branch ?? "", dept: record?.dept ?? "", designation: record?.designation ?? "",
      status: (record?.status as Form["status"]) ?? "Active", userType: (record?.userType as Form["userType"]) ?? "Business user",
      apps: Object.fromEntries(projects.map(p => { const a = record?.apps.find(x => x.projectId === p.id); return [p.id, { on: !!a, role: a?.role ?? "" }]; })),
      licences: Object.fromEntries(software.map(sw => [sw, held.find(h => h.software === sw)?.id ?? ""])),
    };
  }, [record, projects, pools, software, defaultCompanyId]);
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));
  const branches = companies.find(c => c.id === f.companyId)?.branches ?? [];
  const branchList = [...new Set([...branches, f.branch].filter(Boolean))];
  const deptList = [...new Set([...departments, f.dept].filter(Boolean))];
  const biz = isBusinessUser(f.userType);

  const setLicence = (sw: string, poolId: string) => {
    // picking a licence linked to a system also ticks access to it
    const pool = pools.find(p => p.id === poolId);
    setF(p => ({
      ...p,
      licences: { ...p.licences, [sw]: poolId },
      apps: pool?.projectId && !p.apps[pool.projectId]?.on ? { ...p.apps, [pool.projectId]: { on: true, role: p.apps[pool.projectId]?.role ?? "" } } : p.apps,
    }));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await saveAccessRecord({
        id: record?.id, name: f.name, email: f.email, sapCode: f.sapCode, companyId: f.companyId, branch: f.branch, dept: f.dept,
        designation: f.designation, status: f.status, userType: f.userType,
        apps: Object.entries(f.apps).filter(([, a]) => a.on).map(([projectId, a]) => ({ projectId, role: a.role })),
        licenceIds: Object.values(f.licences).filter(Boolean),
      });
      if (!r.ok) { setError(r.error); return; }
      toast(r.data!.dropped ? "Saved. Business-user licences were released because this person isn't a business user." : "Saved");
      onClose();
    });
  };

  const remove = async () => {
    if (!record) return;
    const ok = await confirmAction({
      title: `Delete ${record.name}?`,
      message: `Are you sure you want to delete ${record.name}? Their licences will be freed up.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteAccessRecord(record.id);
      if (!r.ok) { setError(r.error); return; }
      toast("Deleted. Their licences are free again.");
      onClose();
    });
  };

  const text = (k: "name" | "email" | "sapCode" | "branch" | "dept" | "designation", label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={"u_" + k}>{label}</label>
      <AntInput id={"u_" + k} value={f[k]} onChange={e => set(k, e.target.value)} {...props} />
    </div>
  );

  return (
    <Panel
      title={record ? "Edit person" : "Add person"}
      subtitle="A record in the Users & access register. This person doesn't sign in to the tracker."
      dirty={dirty}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span>{record && <button className="btn danger" type="button" disabled={busy} onClick={remove}>Delete</button>}</span>
          <div>
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            <button className="btn primary" type="submit" form="accessform" disabled={busy}>{busy ? "Saving…" : record ? "Save" : "Add person"}</button>
          </div>
        </>
      )}
    >
      <form className="form" id="accessform" onSubmit={save}>
        {text("name", "Name", { required: true, autoFocus: !record })}
        {text("email", "Email", { type: "email" })}
        <div className="field">
          <label htmlFor="u_comp">Company</label>
          <AntSelect
            id="u_comp"
            value={f.companyId}
            onChange={e => set("companyId", e.target.value)}
            empty="—"
            options={companies.map(c => [c.id, c.name + (c.country ? ` (${c.country})` : "")])}
          />
        </div>
        <div className="field">
          <label htmlFor="u_branch">Branch</label>
          <AntSelect
            id="u_branch"
            value={f.branch}
            onChange={e => set("branch", e.target.value)}
            empty="—"
            options={branchList.map(b => [b, b])}
            allowCreate
          />
        </div>
        <div className="field">
          <label htmlFor="u_dept">Department</label>
          <AntSelect
            id="u_dept"
            value={f.dept}
            onChange={e => set("dept", e.target.value)}
            empty="—"
            options={deptList.map(d => [d, d])}
            allowCreate
          />
        </div>
        {text("designation", "Designation")}
        <div className="field">
          <label htmlFor="u_st">Status</label>
          <AntSelect
            id="u_st"
            value={f.status}
            onChange={e => set("status", e.target.value as Form["status"])}
            options={[["Active", "Active"], ["Inactive", "Inactive"]]}
          />
        </div>
        {text("sapCode", "SAP user code")}
        <div className="field">
          <label htmlFor="u_type">User type</label>
          <AntSelect
            id="u_type"
            value={f.userType}
            onChange={e => set("userType", e.target.value as Form["userType"])}
            options={USER_TYPES.map(t => [t, t])}
          />
        </div>

        <div className="field full">
          <label>System access</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(p => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "auto 110px 1fr", gap: 10, alignItems: "center" }}>
                <AntCheckbox id={"ua_" + p.id} checked={f.apps[p.id]?.on ?? false}
                  onChange={e => set("apps", { ...f.apps, [p.id]: { on: e.target.checked, role: f.apps[p.id]?.role ?? "" } })} />
                <label htmlFor={"ua_" + p.id} style={{ fontWeight: 600, color: "var(--fg)" }}>{p.name}</label>
                <AntInput aria-label={`${p.name} role`} placeholder="Role (optional)" value={f.apps[p.id]?.role ?? ""}
                  onChange={e => set("apps", { ...f.apps, [p.id]: { on: f.apps[p.id]?.on ?? false, role: e.target.value } })} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn" type="button" onClick={() => set("apps", Object.fromEntries(projects.map(p => [p.id, { on: true, role: f.apps[p.id]?.role ?? "" }])))}>Select all</button>
            <button className="btn" type="button" onClick={() => set("apps", Object.fromEntries(projects.map(p => [p.id, { on: false, role: f.apps[p.id]?.role ?? "" }])))}>Deselect all</button>
          </div>
        </div>

        <div className="field full">
          <label>Licences</label>
          {software.length === 0 ? <span className="muted" style={{ fontSize: 13 }}>No licences recorded yet. Add them on the Licences page.</span> : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {software.map(sw => {
                  const cur = f.licences[sw] ?? "";
                  const options = pools.filter(p => p.software === sw && (countsAgainst(p.audience, f.userType) || p.id === cur));
                  return (
                    <div key={sw} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center" }}>
                      <label htmlFor={"ul_" + sw} style={{ fontWeight: 600, fontSize: 13, color: "var(--fg)", textTransform: "none", letterSpacing: 0 }}>{sw}</label>
                      <AntSelect
                        id={"ul_" + sw}
                        value={cur}
                        onChange={e => setLicence(sw, e.target.value)}
                        empty="No licence"
                        options={options.map(p => {
                          const mineNow = initial.licences[sw] === p.id;
                          const free = p.quantity - p.assigned + (mineNow ? 1 : 0);
                          return [p.id, `${p.type}${p.companyName ? ` · ${p.companyName}` : ""} (${free} free)`] as [string, string];
                        })}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Choosing a licence linked to a system also gives access to it.
                {!biz && " Business-user licences aren't offered for this user type."}
              </p>
            </>
          )}
        </div>
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
