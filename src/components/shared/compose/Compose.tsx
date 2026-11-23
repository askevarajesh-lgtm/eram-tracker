"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { composeData, noteMessage, type ComposeData, type ComposeRecipient } from "@/server/compose";
import { fillTemplate, type TemplateKey } from "@/lib/settings-defaults";
import { Panel } from "@/components/ui/Panel";
import { Chip } from "@/components/ui/Chip";
import { toast } from "@/components/ui/Toaster";
import { AntInput, AntTextArea, AntSelect, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";

export type ComposeOptions = {
  tpl?: TemplateKey;
  devIds?: string[];
  subject?: string;
  body?: string;
  /** include the manager contact */
  manager?: boolean;
  /** extra recipients (business users, guests) */
  extra?: { id: string; name: string; email: string; whatsapp: string }[];
  /** for the {item} {project} {due} placeholders */
  item?: { title: string; project: string; due: string };
};

const Ctx = createContext<(o?: ComposeOptions) => void>(() => {});
/** Opens the "Send a message" panel from anywhere. */
export const useCompose = () => useContext(Ctx);

export function ComposeProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ComposeOptions | null>(null);
  const open = useCallback((o: ComposeOptions = {}) => setOpts(o), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      {opts && <ComposePanel opts={opts} onClose={() => setOpts(null)} />}
    </Ctx.Provider>
  );
}

const waDigits = (v: string) => String(v || "").replace(/[^0-9]/g, "").replace(/^00/, "");

function ComposePanel({ opts, onClose }: { opts: ComposeOptions; onClose: () => void }) {
  const [data, setData] = useState<ComposeData | null>(null);
  const [tpl, setTpl] = useState<TemplateKey>(opts.tpl ?? "custom");
  const [subject, setSubject] = useState(opts.subject ?? "");
  const [body, setBody] = useState(opts.body ?? "");
  const [sel, setSel] = useState<Set<string>>(() => new Set([...(opts.devIds ?? []), ...(opts.manager ? ["_mgr"] : []), ...(opts.extra ?? []).map(e => e.id)]));

  useEffect(() => {
    composeData().then(d => {
      setData(d);
      if (!opts.subject) setSubject(d.templates[tpl].subject);
      if (!opts.body) setBody(d.templates[tpl].body);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recipients: ComposeRecipient[] = useMemo(
    () => [...(data?.recipients.filter(r => !r.manager) ?? []), ...(opts.extra ?? []).map(e => ({ ...e, items: "", overdue: "" })), ...(data?.recipients.filter(r => r.manager) ?? [])],
    [data, opts.extra],
  );
  const vars = (r: ComposeRecipient) => ({
    name: r.name.split(" ")[0] || r.name, fullname: r.name, date: data?.date ?? "", items: r.items, overdue: r.overdue, link: data?.link || window.location.origin,
    summary: data?.summary ?? "", item: opts.item?.title ?? "", project: opts.item?.project ?? "", due: opts.item?.due ?? "",
  });
  const chosen = recipients.filter(r => sel.has(r.id) && r.email);
  const toggle = (id: string, on: boolean) => setSel(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const copy = async (r: ComposeRecipient) => {
    try { await navigator.clipboard.writeText(fillTemplate(body, vars(r))); toast("Message copied"); } catch { toast("Couldn't copy. Select the text and copy it yourself."); }
  };
  const label = data?.templates[tpl].label ?? "";

  return (
    <Panel
      wide
      title="Send a message"
      subtitle="Choose who gets it, check the text, then open WhatsApp or email for each person. You press Send in WhatsApp or your email app."
      onClose={onClose}
      footer={<><span className="muted" style={{ fontSize: 12 }}>If a button doesn't open anything, use Copy and paste the text.</span><div><button className="btn" type="button" onClick={onClose}>Close</button></div></>}
    >
      {!data ? <p className="muted">Loading…</p> : (
        <>
          <form className="form" onSubmit={e => e.preventDefault()}>
            <div className="field">
              <label htmlFor="mc_tpl">Message type</label>
              <AntSelect
                id="mc_tpl"
                value={tpl}
                onChange={e => { const k = e.target.value as TemplateKey; setTpl(k); setSubject(data.templates[k].subject); setBody(data.templates[k].body); }}
                options={(Object.keys(data.templates) as TemplateKey[]).map(k => [k, data.templates[k].label])}
              />
            </div>
            <div className="field"><label htmlFor="mc_subj">Email subject</label><AntInput id="mc_subj" value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div className="field full">
              <label htmlFor="mc_body">Message <span className="muted" style={{ fontWeight: 500 }}>· {"{name} {items} {overdue} {date} {link}"} are filled in per person</span></label>
              <AntTextArea id="mc_body" rows={6} value={body} onChange={e => setBody(e.target.value)} />
            </div>
          </form>
          <div className="grouph" style={{ margin: "4px 0 0" }}>
            <h3 style={{ flex: 1 }}>Recipients</h3>
            <button className="btn" type="button" onClick={() => setSel(new Set(recipients.map(r => r.id)))}>Select all</button>
            <button className="btn" type="button" onClick={() => setSel(new Set())}>Deselect all</button>
          </div>
          {(() => {
            const recipientColumns: ColumnsType<ComposeRecipient> = [
              {
                title: "",
                key: "select",
                width: 44,
                render: (_: any, r: ComposeRecipient) => (
                  <AntCheckbox checked={sel.has(r.id)} aria-label={r.name} onChange={e => toggle(r.id, e.target.checked)} />
                ),
              },
              {
                title: "Name",
                dataIndex: "name",
                key: "name",
                render: (name: string, r: ComposeRecipient) => (
                  <>
                    <b style={{ fontWeight: 600 }}>{name}</b>
                    {r.manager && <> <Chip color="var(--info)">Manager</Chip></>}
                  </>
                ),
              },
              {
                title: "Email",
                dataIndex: "email",
                key: "email",
                render: (email: string) => <span className="muted">{email || "—"}</span>,
              },
              {
                title: "WhatsApp",
                dataIndex: "whatsapp",
                key: "whatsapp",
                render: (whatsapp: string) => {
                  const wa = waDigits(whatsapp);
                  return <span className="muted mono">{wa ? "+" + wa : "—"}</span>;
                },
              },
              {
                title: "Send",
                key: "send",
                align: "right",
                render: (_: any, r: ComposeRecipient) => {
                  const on = sel.has(r.id);
                  const msg = fillTemplate(body, vars(r)), sub = fillTemplate(subject, vars(r));
                  const wa = waDigits(r.whatsapp);
                  return on ? (
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      {wa && (
                        <a
                          className="btn"
                          style={{ background: "#25D366", borderColor: "#25D366", color: "#fff" }}
                          target="_blank"
                          rel="noopener noreferrer"
                          href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
                          onClick={() => noteMessage("WhatsApp", r.name, label)}
                        >
                          WhatsApp
                        </a>
                      )}
                      {r.email && (
                        <a
                          className="btn"
                          href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(msg)}`}
                          onClick={() => noteMessage("Email", r.name, label)}
                        >
                          Email
                        </a>
                      )}
                      <button className="btn" type="button" onClick={() => copy(r)}>Copy</button>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>Not selected</span>
                  );
                },
              },
            ];

            return (
              <div className="tablewrap">
                <AntTable
                  dataSource={recipients}
                  columns={recipientColumns}
                  rowKey="id"
                  pagination={false}
                  emptyText="Add developers (with email and WhatsApp number) first."
                />
              </div>
            );
          })()}
          {chosen.length > 1 && (
            <div className="banner" style={{ margin: 0, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <span>Email all {chosen.length} selected in one message. {"{name}"} becomes “team”.</span>
              <a className="btn primary" href={`mailto:${chosen.map(r => encodeURIComponent(r.email)).join(",")}?subject=${encodeURIComponent(fillTemplate(subject, { ...vars(chosen[0]), name: "team" }))}&body=${encodeURIComponent(fillTemplate(body, { ...vars(chosen[0]), name: "team", items: "", overdue: "" }))}`}
                onClick={() => noteMessage("Email", `${chosen.length} people`, label)}>Email all</a>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
