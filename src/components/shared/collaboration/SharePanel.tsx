"use client";
import { useState, useTransition } from "react";
import { UserPlus, ArrowRightLeft } from "lucide-react";
import { shareWork } from "@/server/work";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { Chip } from "@/components/ui/Chip";
import { useCompose } from "@/components/shared/compose/Compose";
import { AntCheckbox, AntTextArea, AntTable, type ColumnsType } from "@/components/ui/antd";

export function LoadChip({ d }: { d: { availability: string; score: number } }) {
  if (d.availability === "On leave") return <Chip color="var(--hold)">On leave</Chip>;
  return d.score >= 8 ? <Chip color="var(--bad)">Overloaded</Chip> : d.score >= 4 ? <Chip color="var(--warn)">Busy</Chip> : <Chip color="var(--ok)">Has capacity</Chip>;
}

/** Add collaborators to a task/issue or hand it over. Also used from the task and issue panels. */
export function SharePanel({
  kind,
  id,
  title,
  current,
  loads,
  onClose,
}: {
  kind: "task" | "issue";
  id: string;
  title: string;
  current: string[];
  loads: { id: string; name: string; availability: string; score: number }[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"add" | "handover">("add");
  const [to, setTo] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(true);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const compose = useCompose();
  const names = (ids: string[]) => ids.map(i => loads.find(d => d.id === i)?.name).filter(Boolean).join(", ");
  const go = () => start(async () => {
    setError("");
    const r = await shareWork(kind, id, mode, to, note);
    if (!r.ok) { setError(r.error); return; }
    toast(mode === "add" ? "Shared" : "Handed over");
    onClose();
    if (msg) compose({ tpl: "custom", devIds: to, subject: `${mode === "add" ? "Shared with you" : "Handed over to you"}: ${title}`, body: `Hi {name},\n\n${names(current.slice(0, 1)) || "A colleague"} has ${mode === "add" ? "shared" : "handed over"} ${kind === "issue" ? "issue " + id : "this item"} with you:\n${title}${note ? "\n\nNote: " + note : ""}\n\n{link}` });
  });
  return (
    <Panel title="Share work" onClose={onClose} dirty={!!to.length || !!note}
      footer={({ requestClose }) => (
        <>
          <span />
          <div>
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            <button className="btn primary" type="button" disabled={busy || !to.length} onClick={go}>{mode === "add" ? "Share" : "Hand over"}</button>
          </div>
        </>
      )}>
      <p style={{ margin: 0 }}><b>{kind === "issue" ? id + " · " : ""}{title}</b><br /><span className="muted">Now with: {names(current) || "nobody"}</span></p>
      <div className="seg" role="radiogroup">
        <button type="button" aria-pressed={mode === "add"} onClick={() => setMode("add")}>
          <UserPlus size={14} />
          <span>Add a collaborator</span>
        </button>
        <button type="button" aria-pressed={mode === "handover"} onClick={() => setMode("handover")}>
          <ArrowRightLeft size={14} />
          <span>Hand over</span>
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>{mode === "add" ? "The selected developers work on it together with the current owner." : "Ownership moves to the selected developers. The current owner is removed."}</p>
      {(() => {
        type LoadItem = { id: string; name: string; availability: string; score: number };
        const shareColumns: ColumnsType<LoadItem> = [
          {
            title: "",
            key: "select",
            width: 44,
            render: (_: any, d: LoadItem) => (
              <AntCheckbox aria-label={d.name} checked={to.includes(d.id)} onChange={e => setTo(e.target.checked ? [...to, d.id] : to.filter(x => x !== d.id))} />
            ),
          },
          {
            title: "Developer",
            dataIndex: "name",
            key: "name",
            render: (name: string) => <b style={{ fontWeight: 600 }}>{name}</b>,
          },
          {
            title: "Status",
            key: "status",
            render: (_: any, d: LoadItem) => <LoadChip d={d} />,
          },
          {
            title: "Load",
            dataIndex: "score",
            key: "score",
            align: "right",
            render: (score: number) => <span className="mono">{score.toFixed(1)}</span>,
          },
        ];

        return (
          <div className="tablewrap">
            <AntTable
              dataSource={loads.filter(d => !current.includes(d.id))}
              columns={shareColumns}
              rowKey="id"
              pagination={false}
              emptyText="No other developers available"
            />
          </div>
        );
      })()}
      <div className="field"><label htmlFor="sh_n">Note for them</label><AntTextArea id="sh_n" rows={3} placeholder="Context, what's done, what's left" value={note} onChange={e => setNote(e.target.value)} /></div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
        <AntCheckbox checked={msg} onChange={e => setMsg(e.target.checked)}>
          Message them by WhatsApp or email after saving
        </AntCheckbox>
      </label>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </Panel>
  );
}
