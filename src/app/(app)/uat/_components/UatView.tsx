"use client";
import Link from "next/link";
import { Send, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { recordSignoff, sendBack } from "@/server/uat";
import { fmtDay, today } from "@/lib/dates";
import { Empty, ValueChip } from "@/components/ui/bits";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntInput, AntTextArea, AntSelect, AntDatePicker, AntCheckbox, AntTable, type ColumnsType } from "@/components/ui/antd";

export type UatRow = {
  id: string; ref: string; title: string; subModule: string; endUsers: string; testStatus: string; acceptStatus: string;
  developers: { id: string; name: string }[]; returned: number;
};
type Signoff = { id: string; title: string; by?: string; team?: string; d?: string; how?: string; note?: string };
type Person = { id: string; name: string; email: string; dept: string };

type Props = { rows: UatRow[]; total: number; signoffs: Signoff[]; teams: string[]; canManage: boolean; people: Person[] };

export function UatView({ rows, total, signoffs, teams, canManage, people }: Props) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"sign" | "reject" | null>(null);
  const compose = useCompose();
  const chosen = rows.filter(r => sel.has(r.id));
  const allSel = rows.length > 0 && rows.every(r => sel.has(r.id));

  const sendForUat = () => {
    const devIds = [...new Set(chosen.flatMap(r => r.developers.map(d => d.id)))];
    // business users whose department appears in the items' "business users" field
    const extra = people.filter(u => chosen.some(r => r.endUsers && r.endUsers.toLowerCase().includes(u.dept.toLowerCase()))).map(u => ({ id: "u:" + u.id, name: u.name, email: u.email, whatsapp: "" }));
    compose({
      tpl: "custom", devIds, extra,
      subject: `Please test and confirm: ${chosen.length} item${chosen.length === 1 ? "" : "s"}`,
      body: `Hi {name},\n\nThe following ${chosen.length === 1 ? "item is" : "items are"} ready for your testing (UAT):\n${chosen.slice(0, 25).map(r => `• ${r.title}${r.subModule ? " [" + r.subModule + "]" : ""}`).join("\n")}\n\nPlease test and reply to confirm acceptance, or tell us what needs to change.\n\n{link}`,
    });
  };

  return (
    <>
      {canManage && (
        <div className="filters">
          <span className="muted" style={{ flex: 1 }}>{sel.size ? `${sel.size} selected` : "Select developed items to send for testing or record sign-off."}</span>
          <button className="btn" type="button" disabled={!sel.size} onClick={sendForUat}>
            <Send size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
            Send for UAT ({sel.size})
          </button>
          <button className="btn" type="button" disabled={!sel.size} onClick={() => setPanel("reject")}>Needs changes</button>
          <button className="btn primary" type="button" disabled={!sel.size} onClick={() => setPanel("sign")}>
            <Check size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 6 }} />
            Record sign-off ({sel.size})
          </button>
        </div>
      )}
      {(() => {
        const allSel = rows.length > 0 && rows.every(r => sel.has(r.id));
        const uatColumns: ColumnsType<UatRow> = [
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
                  render: (_: unknown, r: UatRow) => (
                    <AntCheckbox
                      aria-label={`Select ${r.title}`}
                      checked={sel.has(r.id)}
                      onChange={e =>
                        setSel(s => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(r.id);
                          else n.delete(r.id);
                          return n;
                        })
                      }
                    />
                  ),
                },
              ]
            : []),
          {
            title: "Ref",
            dataIndex: "ref",
            key: "ref",
            className: "mono muted",
            width: 100,
          },
          {
            title: "Module",
            dataIndex: "subModule",
            key: "subModule",
          },
          {
            title: "Item",
            dataIndex: "title",
            key: "title",
            render: (title: string, r: UatRow) => (
              <div>
                <Link href={`/tasks?edit=${r.id}`} style={{ color: "inherit", fontWeight: 500 }}>
                  {title}
                </Link>
                {r.returned > 0 && <> <Chip color="var(--warn)">returned {r.returned}×</Chip></>}
              </div>
            ),
          },
          {
            title: "Developer",
            key: "developer",
            render: (_: unknown, r: UatRow) => r.developers.map(d => d.name).join(", ") || "—",
          },
          {
            title: "Business users",
            dataIndex: "endUsers",
            key: "endUsers",
            className: "muted",
          },
          {
            title: "Testing",
            dataIndex: "testStatus",
            key: "testStatus",
            render: (v: string) => <ValueChip v={v} />,
          },
          {
            title: "Acceptance",
            dataIndex: "acceptStatus",
            key: "acceptStatus",
            render: (v: string) => <ValueChip v={v} />,
          },
        ];

        return (
          <>
            <AntTable<UatRow>
              dataSource={rows}
              columns={uatColumns}
              rowKey="id"
              pagination={{ pageSize: 20, showSizeChanger: true }}
              emptyTitle="Nothing waiting for sign-off"
              emptyDescription="Developed items that business users haven't accepted yet appear here."
            />
            {total > rows.length && <p className="muted" style={{ marginTop: 8 }}>Showing {rows.length} of {total}. Filter by project to see the rest.</p>}
          </>
        );
      })()}

      <h2 className="sec">Recent sign-offs</h2>
      {(() => {
        const signoffColumns: ColumnsType<Signoff> = [
          {
            title: "Date",
            dataIndex: "d",
            key: "d",
            className: "mono",
            render: (d?: string) => fmtDay(d),
          },
          {
            title: "Item",
            dataIndex: "title",
            key: "title",
            render: (title: string, s: Signoff) => (
              <Link href={`/tasks?edit=${s.id}`} style={{ color: "inherit" }}>
                {title}
              </Link>
            ),
          },
          {
            title: "Signed by",
            dataIndex: "by",
            key: "by",
            render: (by?: string) => <b style={{ fontWeight: 600 }}>{by}</b>,
          },
          {
            title: "Team",
            dataIndex: "team",
            key: "team",
            className: "muted",
          },
          {
            title: "How",
            dataIndex: "how",
            key: "how",
            className: "muted",
          },
          {
            title: "Comment",
            dataIndex: "note",
            key: "note",
            className: "muted",
          },
        ];

        return (
          <AntTable<Signoff>
            dataSource={signoffs}
            columns={signoffColumns}
            rowKey="id"
            emptyTitle="No sign-offs recorded yet"
            emptyDescription="Business user sign-offs will appear here once recorded."
          />
        );
      })()}
      {panel && <SignoffPanel ids={[...sel]} titles={chosen.map(r => r.title)} reject={panel === "reject"} teams={teams} onClose={done => { setPanel(null); if (done) setSel(new Set()); }} />}
    </>
  );
}

function SignoffPanel({ ids, titles, reject, teams, onClose }: { ids: string[]; titles: string[]; reject: boolean; teams: string[]; onClose: (done: boolean) => void }) {
  const [f, setF] = useState({ by: "", team: "", date: today(), how: "Email confirmation", note: "" });
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const go = () => start(async () => {
    setError("");
    const r = reject ? await sendBack(ids, f.by, f.note) : await recordSignoff(ids, f);
    if (!r.ok) { setError(r.error); return; }
    toast(reject ? "Sent back to developers" : "Sign-off recorded");
    onClose(true);
  });
  return (
    <Panel title={reject ? "Send back for changes" : "Record business-user sign-off"} onClose={() => onClose(false)} dirty={!!(f.by || f.note)}
      subtitle={`${ids.length} item${ids.length === 1 ? "" : "s"}: ${titles.slice(0, 4).join("; ")}${titles.length > 4 ? "…" : ""}`}
      footer={<><span /><div>
        <button className="btn" type="button" onClick={() => onClose(false)}>Cancel</button>
        <button className="btn primary" type="button" disabled={busy} onClick={go}>{reject ? "Send back" : "Record sign-off"}</button>
      </div></>}>
      <form className="form" onSubmit={e => e.preventDefault()}>
        {reject ? (
          <>
            <div className="field full"><label htmlFor="so_n">What needs to change</label><AntTextArea id="so_n" rows={3} value={f.note} onChange={e => set("note", e.target.value)} autoFocus /></div>
            <div className="field"><label htmlFor="so_by">Raised by</label><AntInput id="so_by" value={f.by} onChange={e => set("by", e.target.value)} /></div>
          </>
        ) : (
          <>
            <div className="field"><label htmlFor="so_by">Signed off by</label><AntInput id="so_by" value={f.by} placeholder="Business user's name" onChange={e => set("by", e.target.value)} autoFocus /></div>
            <div className="field">
              <label htmlFor="so_tm">Team / department</label>
              <AntSelect
                id="so_tm"
                value={f.team}
                onChange={e => set("team", e.target.value)}
                empty="—"
                allowCreate
                options={[...new Set([...teams, f.team].filter(Boolean))].map(t => [t, t])}
              />
            </div>
            <div className="field"><label htmlFor="so_d">Date</label><AntDatePicker id="so_d" value={f.date} onChange={e => set("date", e.target.value)} /></div>
            <div className="field"><label htmlFor="so_how">How</label>
              <AntSelect id="so_how" value={f.how} onChange={e => set("how", e.target.value)} options={["Email confirmation", "In UAT meeting", "Signed form", "WhatsApp", "In system"].map(h => [h, h])} /></div>
            <div className="field full"><label htmlFor="so_n">Comment</label><AntTextArea id="so_n" rows={3} value={f.note} onChange={e => set("note", e.target.value)} /></div>
          </>
        )}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </Panel>
  );
}
