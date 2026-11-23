"use client";
import { useMemo, useState, useTransition } from "react";
import { AUDIENCES, LICENCE_MODELS, type Audience } from "@/lib/licensing";
import type { CompanyOption, LicencePool } from "@/server/queries";
import { deleteLicence, saveLicence } from "@/server/licences";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { AntInput, AntTextArea, AntSelect, AntDatePicker } from "@/components/ui/antd";

type Props = {
  pool: LicencePool | null;
  companies: CompanyOption[];
  projects: { id: string; name: string }[];
  softwareList: string[];
  defaultSoftware: string;
  onClose: () => void;
};

type Form = {
  software: string; type: string; quantity: string; companyId: string; projectId: string; audience: Audience; model: string;
  renewal: string; vendor: string; cost: string; currency: string; contract: string; notes: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const LIC_TYPES = ["Professional", "Limited Financial", "Limited Logistics", "Limited CRM", "Starter", "Indirect access"];

export function LicenceForm({ pool, companies, projects, softwareList, defaultSoftware, onClose }: Props) {
  const initial = useMemo<Form>(() => ({
    software: pool?.software ?? defaultSoftware, type: pool?.type ?? "", quantity: pool ? String(pool.quantity) : "",
    companyId: pool?.companyId ?? "",
    projectId: pool ? pool.projectId : projects.find(p => norm(p.name) === norm(defaultSoftware))?.id ?? "",
    audience: (pool?.audience as Audience) || "endusers", model: pool?.model ?? "Perpetual", renewal: pool?.renewal ?? "",
    vendor: pool?.vendor ?? "", cost: pool?.cost ?? "", currency: pool?.currency ?? "SAR", contract: pool?.contract ?? "", notes: pool?.notes ?? "",
  }), [pool, defaultSoftware, projects]);
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));
  const swOptions = [...new Set([...projects.map(p => p.name), ...softwareList, "Microsoft 365", "Crystal Reports", "SQL Server", f.software].filter(Boolean))];
  const typeOptions = [...new Set([...LIC_TYPES, f.type].filter(Boolean))];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await saveLicence({ ...f, id: pool?.id, quantity: Number(f.quantity) || 0, cost: f.cost === "" ? "" : Number(f.cost) });
      if (!r.ok) { setError(r.error); return; }
      toast("Saved");
      onClose();
    });
  };

  const remove = () => {
    if (!pool) return;
    const msg = pool.holderIds.length ? `Delete this licence? It is released from ${pool.holderIds.length} ${pool.holderIds.length === 1 ? "person" : "people"}.` : "Delete this licence?";
    if (!confirm(msg)) return;
    start(async () => {
      const r = await deleteLicence(pool.id);
      if (!r.ok) { setError(r.error); return; }
      toast(`Licence deleted${r.data!.released ? ` and released from ${r.data!.released} people` : ""}`);
      onClose();
    });
  };

  const input = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => {
    if (props.type === "date") {
      return (
        <div className={"field" + (full ? " full" : "")}>
          <label htmlFor={"l_" + k}>{label}</label>
          <AntDatePicker id={"l_" + k} value={f[k]} onChange={e => set(k, e.target.value as never)} />
        </div>
      );
    }
    return (
      <div className={"field" + (full ? " full" : "")}>
        <label htmlFor={"l_" + k}>{label}</label>
        <AntInput id={"l_" + k} value={f[k]} onChange={e => set(k, e.target.value as never)} {...props} />
      </div>
    );
  };

  return (
    <Panel
      title={pool ? "Edit licence" : "Add licence"}
      dirty={dirty}
      onClose={onClose}
      footer={<>
        <span>{pool && <button className="btn danger" type="button" disabled={busy} onClick={remove}>Delete</button>}</span>
        <div>
          <button className="btn" type="button" onClick={() => { if (!dirty || confirm("You have unsaved changes. Close without saving?")) onClose(); }}>Cancel</button>
          <button className="btn primary" type="submit" form="licform" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </>}
    >
      <form className="form" id="licform" onSubmit={save}>
        <div className="field">
          <label htmlFor="l_software">Software</label>
          <AntSelect
            id="l_software"
            value={f.software}
            placeholder="SAP B1, Microsoft 365…"
            options={swOptions.map(v => [v, v])}
            allowCreate
            onChange={e => {
              const v = e.target.value;
              const m = projects.find(p => norm(p.name) === norm(v));
              setF(p => ({ ...p, software: v, projectId: p.projectId || m?.id || "" }));
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="l_type">Licence type</label>
          <AntSelect
            id="l_type"
            value={f.type}
            placeholder="Professional, Financial…"
            options={typeOptions.map(v => [v, v])}
            allowCreate
            onChange={e => set("type", e.target.value)}
          />
        </div>
        {input("quantity", "Quantity purchased", { type: "number", min: 0 })}
        <div className="field">
          <label htmlFor="l_comp">Company</label>
          <AntSelect
            id="l_comp"
            value={f.companyId}
            onChange={e => set("companyId", e.target.value)}
            empty="Group-wide (shared)"
            options={companies.map(c => [c.id, c.name + (c.country ? ` (${c.country})` : "")])}
          />
        </div>
        <div className="field">
          <label htmlFor="l_proj">Linked system</label>
          <AntSelect
            id="l_proj"
            value={f.projectId}
            onChange={e => set("projectId", e.target.value)}
            empty="None"
            options={projects.map(p => [p.id, p.name])}
          />
        </div>
        <div className="field">
          <label htmlFor="l_aud">Licence is for</label>
          <AntSelect
            id="l_aud"
            value={f.audience}
            onChange={e => set("audience", e.target.value as Audience)}
            options={Object.entries(AUDIENCES).map(([k, l]) => [k, l])}
          />
        </div>
        <div className="field">
          <label htmlFor="l_model">Licence model</label>
          <AntSelect
            id="l_model"
            value={f.model}
            onChange={e => set("model", e.target.value)}
            empty="—"
            options={LICENCE_MODELS.map(m => [m, m])}
          />
        </div>
        {input("renewal", "Renewal / expiry date", { type: "date" })}
        {input("vendor", "Vendor / partner")}
        {input("cost", "Annual cost", { type: "number", min: 0, step: 0.01 })}
        {input("currency", "Currency", { maxLength: 4 })}
        {input("contract", "Contract / PO / licence key reference", { placeholder: "Reference number only, not the key itself" }, true)}
        <div className="field full">
          <label htmlFor="l_notes">Notes</label>
          <AntTextArea id="l_notes" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} />
        </div>
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
