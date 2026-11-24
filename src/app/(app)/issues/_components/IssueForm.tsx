"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ISSUE_PRIORITY_KEYS, ISSUE_STATUSES, type IssuePriority, type IssueStatus } from "@/lib/issues";
import type { Lookups } from "@/server/queries";
import { decideIssue, deleteIssue, issueToTask, saveIssue } from "@/server/issues";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { confirmAction } from "@/components/ui/ConfirmCloseModal";
import { SlaCell } from "./IssuesView";
import type { IssueDTO, IssueViewer, Sla } from "./types";
import { Files } from "@/components/ui/Files";
import { SharePanel } from "@/components/shared/collaboration/SharePanel";
import { developerLoads, type DevLoadLite } from "@/server/extras";
import { AntInput, AntTextArea, AntSelect, AntCheckbox } from "@/components/ui/antd";

type Props = { issue: IssueDTO | null; lookups: Lookups; sla: Sla; viewer: IssueViewer; now: number; onClose: () => void };

type Form = {
  title: string; description: string; projectId: string; priority: IssuePriority; raisedBy: string; contact: string;
  companyId: string; status: IssueStatus; assigneeIds: string[]; resolution: string;
};

const APPROVAL_LABEL = { pending: "Awaiting approval", approved: "Approved", rejected: "Rejected" } as const;
const APPROVAL_COLOR = { pending: "var(--warn)", approved: "var(--ok)", rejected: "var(--bad)" } as const;

export function IssueForm({ issue, lookups, sla, viewer, now, onClose }: Props) {
  const router = useRouter();
  const initial = useMemo<Form>(() => ({
    title: issue?.title ?? "", description: issue?.description ?? "", projectId: issue?.projectId ?? "",
    priority: (issue?.priority as IssuePriority) ?? "Urgent", raisedBy: issue?.raisedBy ?? "", contact: issue?.contact ?? "",
    companyId: issue?.companyId ?? "", status: (issue?.status as IssueStatus) ?? "new", assigneeIds: issue?.assigneeIds ?? [], resolution: issue?.resolution ?? "",
  }), [issue]);
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [loads, setLoads] = useState<DevLoadLite[] | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) => start(async () => {
    setError("");
    const r = await fn();
    if (!r.ok) { setError(r.error ?? "Something went wrong"); return; }
    after();
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const r = await saveIssue({ ...f, id: issue?.id });
      if (!r.ok) { setError(r.error); return; }
      toast(issue ? "Saved" : r.data!.pendingApproval ? `Issue ${r.data!.id} raised and sent for approval` : `Issue ${r.data!.id} raised`);
      onClose();
    });
  };

  const decide = (d: "approved" | "rejected") => {
    const note = d === "rejected" ? prompt("Reason for rejecting:") ?? "" : "";
    if (d === "rejected" && !note.trim()) return;
    run(() => decideIssue(issue!.id, d, note), () => toast(d === "approved" ? "Approved" : "Rejected"));
  };

  const input = (k: "title" | "raisedBy" | "contact", label: string, placeholder = "", full = false) => (
    <div className={"field" + (full ? " full" : "")}>
      <label htmlFor={"iz_" + k}>{label}</label>
      <AntInput id={"iz_" + k} value={f[k]} placeholder={placeholder} onChange={e => set(k, e.target.value)} required={k === "title"} autoFocus={k === "title" && !issue} />
    </div>
  );

  return (
    <Panel
      title={issue ? issue.id : "Raise urgent issue"}
      subtitle={issue
        ? <>Raised {new Date(issue.createdAt).toLocaleString()} · response target {sla[issue.priority as keyof Sla] ?? 72}h · <SlaCell x={issue} sla={sla} now={now} /></>
        : "A token number is created when you save."}
      dirty={dirty}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span>{issue && viewer.canManage && <button className="btn danger" type="button" disabled={busy} onClick={async () => {
            const ok = await confirmAction({
              title: `Delete ${issue.id}?`,
              message: `Are you sure you want to delete ${issue.id}? This can't be undone.`,
              confirmLabel: "Delete",
              cancelLabel: "Cancel",
              danger: true,
            });
            if (ok) run(() => deleteIssue(issue.id), () => { toast("Issue deleted"); onClose(); });
          }}>Delete</button>}</span>
          <div>
            {issue && viewer.canManage && issue.taskSno == null && (
              <button className="btn" type="button" disabled={busy} onClick={() => run(() => issueToTask(issue.id), () => toast("Development task created"))}>→ Dev task</button>
            )}
            {issue && viewer.role !== "Viewer" && <button className="btn" type="button" title="Share or hand over" onClick={() => developerLoads().then(setLoads)}>⇄ Share</button>}
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            <button className="btn primary" type="submit" form="issueform" disabled={busy}>{busy ? "Saving…" : issue ? "Save" : "Raise issue"}</button>
          </div>
        </>
      )}
    >
      <form className="form" id="issueform" onSubmit={save}>
        {input("title", "Issue", "e.g. Payroll posting fails for SMP", true)}
        <div className="field full">
          <label htmlFor="iz_d">Details</label>
          <AntTextArea id="iz_d" rows={3} value={f.description} placeholder="What happened, where, error message, steps" onChange={e => set("description", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="iz_m">System</label>
          <AntSelect
            id="iz_m"
            value={f.projectId}
            onChange={e => set("projectId", e.target.value)}
            empty="—"
            options={lookups.projects.map(p => [p.id, p.name])}
          />
        </div>
        <div className="field">
          <label htmlFor="iz_p">Priority</label>
          <AntSelect
            id="iz_p"
            value={f.priority}
            onChange={e => set("priority", e.target.value as IssuePriority)}
            options={ISSUE_PRIORITY_KEYS.map(p => [p, p])}
          />
        </div>
        {input("raisedBy", "Raised by", "Name / team")}
        {input("contact", "Contact (phone / email)")}
        <div className="field">
          <label htmlFor="iz_c">Company</label>
          <AntSelect
            id="iz_c"
            value={f.companyId}
            onChange={e => set("companyId", e.target.value)}
            empty="—"
            options={lookups.companies.map(c => [c.id, c.name])}
          />
        </div>
        <div className="field">
          <label htmlFor="iz_s">Status</label>
          <AntSelect
            id="iz_s"
            value={f.status}
            onChange={e => set("status", e.target.value as IssueStatus)}
            options={ISSUE_STATUSES.map(s => [s.key, s.label])}
          />
        </div>
        <div className="field full">
          <label>Assigned developers</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {lookups.developers.map(d => (
              <label key={d.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", font: "inherit", color: "var(--fg)" }}>
                <AntCheckbox checked={f.assigneeIds.includes(d.id)}
                  onChange={e => set("assigneeIds", e.target.checked ? [...f.assigneeIds, d.id] : f.assigneeIds.filter(x => x !== d.id))}>
                  {d.name}
                </AntCheckbox>
              </label>
            ))}
          </div>
        </div>

        {issue?.approvalState && (
          <div className="field full">
            <label>Approval</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Chip color={APPROVAL_COLOR[issue.approvalState]}>{APPROVAL_LABEL[issue.approvalState]}</Chip>
              <span className="muted" style={{ fontSize: 12 }}>{issue.approvalBy} {issue.approvalAt && new Date(issue.approvalAt).toLocaleString()} {issue.approvalNote}</span>
              {issue.approvalState === "pending" && viewer.canManage && (<>
                <button className="btn primary" type="button" disabled={busy} onClick={() => decide("approved")}>Approve</button>
                <button className="btn danger" type="button" disabled={busy} onClick={() => decide("rejected")}>Reject</button>
              </>)}
            </div>
          </div>
        )}
        {issue && issue.taskSno != null && (
          <div className="field full">
            <label>Development task</label>
            <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => router.push(`/tasks?q=${encodeURIComponent(issue.id)}`)}>Open task #{issue.taskSno}</button>
          </div>
        )}
        <div className="field full">
          <label htmlFor="iz_res">Resolution / notes</label>
          <AntTextArea id="iz_res" rows={3} value={f.resolution} onChange={e => set("resolution", e.target.value)} />
        </div>
        {issue && (
          <div className="field full">
            <label>Screenshots &amp; files</label>
            <Files kind="issue" id={issue.id} files={issue.files} canEdit={viewer.role !== "Viewer"} canRemove={viewer.canManage} />
          </div>
        )}
        {issue && issue.events.length > 0 && (
          <div className="field full">
            <label>History</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              {issue.events.map((ev, i) => (
                <div key={i}><span className="mono muted">{new Date(ev.at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span> · {ev.message}</div>
              ))}
            </div>
          </div>
        )}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
      {loads && issue && <SharePanel kind="issue" id={issue.id} title={issue.title} current={issue.assigneeIds} loads={loads} onClose={() => { setLoads(null); onClose(); }} />}
    </Panel>
  );
}
