"use client";
import { useState, useTransition } from "react";
import { Panel } from "./Panel";
import { toast } from "./Toaster";
import { confirmAction } from "./ConfirmCloseModal";
import { AntInput, AntTextArea, AntSelect, AntDatePicker, AntTimePicker } from "@/components/ui/antd";

export type FieldDef<F> = {
  key: keyof F & string;
  label: string;
  type?: "text" | "email" | "textarea" | "date" | "number" | "select" | "url" | "time";
  /** for type "select": [value, label] pairs */
  options?: [string, string][];
  /** for type "select": label of an empty first choice */
  empty?: string;
  /** suggestions for a text field */
  list?: string[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

type Props<F extends Record<string, string>> = {
  title: string;
  initial: F;
  fields: FieldDef<F>[];
  isNew: boolean;
  onSave: (values: F) => Promise<Result>;
  onDelete?: () => Promise<Result>;
  deleteLabel?: string;
  onClose: () => void;
  /** shown under the title */
  subtitle?: React.ReactNode;
  /** extra content after the fields (history, files…) */
  children?: React.ReactNode;
  /** extra buttons before Cancel */
  extraButtons?: React.ReactNode;
  canSave?: boolean;
};

/** A side-panel form for simple records (developers, projects...). */
export function EntityEditor<F extends Record<string, string>>({ title, initial, fields, isNew, onSave, onDelete, deleteLabel, onClose, subtitle, children, extraButtons, canSave = true }: Props<F>) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const run = (fn: () => Promise<Result>, done: string) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      toast(done);
      onClose();
    });

  return (
    <Panel
      title={title}
      subtitle={subtitle}
      dirty={dirty}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span>{!isNew && onDelete && <button className="btn danger" type="button" disabled={busy} onClick={async () => {
            const ok = await confirmAction({
              title: deleteLabel ?? "Delete this record?",
              message: "Are you sure you want to delete this record? This action cannot be undone.",
              confirmLabel: "Delete",
              cancelLabel: "Cancel",
              danger: true,
            });
            if (ok) run(onDelete, "Deleted");
          }}>Delete</button>}</span>
          <div>
            {extraButtons}
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            {canSave && <button className="btn primary" type="submit" form="entityform" disabled={busy}>{busy ? "Saving…" : isNew ? "Create" : "Save"}</button>}
          </div>
        </>
      )}
    >
      <form className="form" id="entityform" onSubmit={e => { e.preventDefault(); run(() => onSave(f), "Saved"); }}>
        {fields.map((d, i) => (
          <div key={d.key} className={"field" + (d.full || d.type === "textarea" ? " full" : "")}>
            <label htmlFor={"e_" + d.key}>{d.label}</label>
            {d.type === "textarea" ? (
              <AntTextArea id={"e_" + d.key} rows={3} value={f[d.key]} placeholder={d.placeholder} onChange={e => setF({ ...f, [d.key]: e.target.value })} />
            ) : d.type === "select" ? (
              <AntSelect
                id={"e_" + d.key}
                value={f[d.key]}
                onChange={e => setF({ ...f, [d.key]: e.target.value })}
                empty={d.empty}
                options={d.options}
              />
            ) : d.type === "date" ? (
              <AntDatePicker
                id={"e_" + d.key}
                value={f[d.key]}
                placeholder={d.placeholder}
                onChange={e => setF({ ...f, [d.key]: e.target.value })}
              />
            ) : d.type === "time" ? (
              <AntTimePicker
                id={"e_" + d.key}
                value={f[d.key]}
                placeholder={d.placeholder}
                onChange={e => setF({ ...f, [d.key]: e.target.value })}
              />
            ) : d.list ? (
              <AntSelect
                id={"e_" + d.key}
                value={f[d.key]}
                placeholder={d.placeholder}
                empty={d.empty ?? "—"}
                allowCreate
                options={[...new Set([...d.list, f[d.key]].filter(Boolean))].map(v => [v, v])}
                onChange={e => setF({ ...f, [d.key]: e.target.value })}
              />
            ) : (
              <AntInput id={"e_" + d.key} type={d.type ?? "text"} value={f[d.key]} placeholder={d.placeholder} required={d.required} autoFocus={isNew && i === 0}
                onChange={e => setF({ ...f, [d.key]: e.target.value })} />
            )}
          </div>
        ))}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
      {children}
    </Panel>
  );
}
