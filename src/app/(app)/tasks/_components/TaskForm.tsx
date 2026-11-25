"use client";
import { useMemo, useState, useTransition } from "react";
import { Clock } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { ACCEPT_STATUSES, PRIORITIES, REQ_STATUSES, TASK_STATUSES, TASK_TYPES, TEST_STATUSES } from "@/lib/constants";
import type { Lookups } from "@/server/queries";
import { deleteTask, saveTask, type TaskInput } from "@/server/tasks";
import { Panel } from "@/components/ui/Panel";
import { toast } from "@/components/ui/Toaster";
import { confirmAction } from "@/components/ui/ConfirmCloseModal";
import { Chip } from "@/components/ui/Chip";
import type { TaskDTO } from "./types";
import type { DevLoadLite } from "@/server/extras";
import { TaskExtrasView } from "./TaskExtrasView";
import { SharePanel } from "@/components/shared/collaboration/SharePanel";
import { AntInput, AntTextArea, AntSelect, AntDatePicker, AntTimePicker, AntSlider, AntCheckbox } from "@/components/ui/antd";

const SIZES: [string, string][] = [["", "—"], ["S", "S · about 4 h"], ["M", "M · about 2 days"], ["L", "L · about 1 week"], ["XL", "XL · 2 weeks+"]];

type Form = {
  sno: string; title: string; projectId: string; subModule: string; type: string; reqStatus: string; status: TaskDTO["status"];
  priority: string; assigneeIds: string[]; companyId: string; branch: string; endUsers: string; testStatus: string; acceptStatus: string;
  progress: number; startDate: string; dueDate: string; completedDate: string; estHours: string; size: string; version: string;
  lead: string; description: string; notes: string;
};

const fromTask = (t: TaskDTO | null, defaultProjectId: string, defaultStatus?: TaskStatus): Form => ({
  sno: t ? String(t.sno) : "",
  title: t?.title ?? "", projectId: t ? t.projectId : defaultProjectId, subModule: t?.subModule ?? "", type: t?.type ?? "",
  reqStatus: t?.reqStatus ?? "Open", status: t?.status ?? defaultStatus ?? "pending", priority: t?.priority ?? "", assigneeIds: t?.assigneeIds ?? [],
  companyId: t?.companyId ?? "", branch: t?.branch ?? "", endUsers: t?.endUsers ?? "", testStatus: t?.testStatus ?? "Open",
  acceptStatus: t?.acceptStatus ?? "Open", progress: t ? (t.status === "done" ? 100 : t.progress ?? 0) : 0,
  startDate: t?.startDate ?? "", dueDate: t?.dueDate ?? "", completedDate: t?.completedDate ?? "",
  estHours: t?.estHours != null ? String(t.estHours) : "", size: t?.size ?? "", version: t?.version ?? "", lead: t?.lead ?? "",
  description: t?.description ?? "", notes: t?.notes ?? "",
});

type Props = { task: TaskDTO | null; lookups: Lookups; defaultProjectId: string; defaultStatus?: TaskStatus; canEdit: boolean; canDelete: boolean; viewerDeveloperId?: string | null; onClose: () => void };

export function TaskForm({ task, lookups, defaultProjectId, defaultStatus, canEdit, canDelete, viewerDeveloperId = null, onClose }: Props) {
  const [loads, setLoads] = useState<DevLoadLite[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const initial = useMemo(() => fromTask(task, defaultProjectId, defaultStatus), [task, defaultProjectId, defaultStatus]);
  const [f, setF] = useState<Form>(initial);
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(prev => ({ ...prev, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const input: TaskInput = {
      ...f,
      id: task?.id,
      sno: task ? f.sno : "",
      priority: f.priority as TaskInput["priority"],
      progress: f.progress,
      estHours: f.estHours === "" ? null : Number(f.estHours),
    };
    start(async () => {
      const r = await saveTask(input);
      if (!r.ok) { setError(r.error); return; }
      toast(task ? "Saved" : `Task created · S.No ${r.data!.sno}`);
      onClose();
    });
  };

  const remove = async () => {
    if (!task) return;
    const ok = await confirmAction({
      title: `Delete task #${task.sno}?`,
      message: `Delete task ${task.sno} “${task.title}”? This can't be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const r = await deleteTask(task.id);
      if (!r.ok) { setError(r.error); return; }
      toast("Task deleted");
      onClose();
    });
  };

  const text = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => {
    if (props.type === "date") {
      return (
        <div className={"field" + (full ? " full" : "")}>
          <label htmlFor={"t_" + k}>{label}</label>
          <AntDatePicker id={"t_" + k} value={f[k] as string} onChange={e => set(k, e.target.value as never)} disabled={!canEdit} />
        </div>
      );
    }
    if (props.type === "time") {
      return (
        <div className={"field" + (full ? " full" : "")}>
          <label htmlFor={"t_" + k}>{label}</label>
          <AntTimePicker id={"t_" + k} value={f[k] as string} onChange={e => set(k, e.target.value as never)} disabled={!canEdit} />
        </div>
      );
    }
    return (
      <div className={"field" + (full ? " full" : "")}>
        <label htmlFor={"t_" + k}>{label}</label>
        <AntInput id={"t_" + k} value={f[k] as string} onChange={e => set(k, e.target.value as never)} disabled={!canEdit} {...props} />
      </div>
    );
  };
  const select = (k: keyof Form, label: string, options: [string, string][], empty?: string, allowCreate?: boolean) => (
    <div className="field">
      <label htmlFor={"t_" + k}>{label}</label>
      <AntSelect
        id={"t_" + k}
        value={f[k] as string}
        onChange={e => set(k, e.target.value as never)}
        disabled={!canEdit}
        empty={empty}
        options={options}
        allowCreate={allowCreate}
      />
    </div>
  );
  const pairs = (xs: readonly string[]) => xs.map(x => [x, x] as [string, string]);
  const types = [...new Set([...(lookups.lists?.reqTypes ?? TASK_TYPES), f.type].filter(Boolean))];
  const modules = [...new Set([...(lookups.lists?.funcModules ?? []), f.subModule].filter(Boolean))];
  const branches = [...new Set([...(lookups.lists?.branches ?? []), f.branch].filter(Boolean))];
  const endUsersList = [...new Set([...(lookups.lists?.endUsers ?? []), f.endUsers].filter(Boolean))];

  return (
    <Panel
      title={task ? "Edit item" : "New item"}
      subtitle={task ? <>#{task.sno} · updated {new Date(task.updatedAt).toLocaleString()}{task.source ? ` · from ${task.source}` : ""}</> : undefined}
      dirty={dirty}
      onClose={onClose}
      footer={({ requestClose }) => (
        <>
          <span>{task && canDelete && <button className="btn danger" type="button" onClick={remove} disabled={saving}>Delete</button>}</span>
          <div>
            {task && canEdit && loads && <button className="btn" type="button" title="Share or hand over" onClick={() => setSharing(true)}>⇄ Share</button>}
            <button className="btn" type="button" onClick={requestClose}>Cancel</button>
            {canEdit && <button className="btn primary" type="submit" form="taskform" disabled={saving}>{saving ? "Saving…" : task ? "Save" : "Create task"}</button>}
          </div>
        </>
      )}
    >
      <form className="form" id="taskform" onSubmit={submit}>
        {task
          ? text("sno", "S.No", { type: "number", min: 1 })
          : <div className="field"><label htmlFor="t_sno">S.No</label><AntInput id="t_sno" readOnly placeholder="Auto · next free number in the project" /></div>}
        {select("projectId", "Project", lookups.projects.map(p => [p.id, p.name]), "—")}
        {select("subModule", "Module", pairs(modules), "—", true)}
        {select("type", "Req. type", pairs(types), "—")}
        {text("title", "Details", { required: true, placeholder: "e.g. PettyCash Payment Report", autoFocus: !task }, true)}
        {select("reqStatus", "Requirement status", pairs(REQ_STATUSES), "—")}
        <div className="field">
          <label htmlFor="t_status">Development status</label>
          <AntSelect
            id="t_status"
            value={f.status}
            disabled={!canEdit}
            onChange={e => { const s = e.target.value as Form["status"]; setF(p => ({ ...p, status: s, progress: s === "done" ? 100 : p.progress })); }}
            options={TASK_STATUSES.map(s => [s.key, s.label])}
          />
        </div>

        <div className="field full">
          <label>
            Developers
            {canEdit && f.assigneeIds.length > 0 && (
              <button type="button" onClick={() => set("assigneeIds", [])} style={{ border: 0, background: "none", color: "var(--accent)", font: "500 11px var(--body)", cursor: "pointer", paddingLeft: 6 }}>Unassign all</button>
            )}
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {lookups.developers.length === 0 && <span className="muted">Add developers in the Developers page first.</span>}
            {lookups.developers.map(d => (
              <label key={d.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer", font: "inherit", color: "var(--fg)" }}>
                <AntCheckbox disabled={!canEdit}
                  checked={f.assigneeIds.includes(d.id)}
                  onChange={e => set("assigneeIds", e.target.checked ? [...f.assigneeIds, d.id] : f.assigneeIds.filter(x => x !== d.id))}>
                  {d.name}
                </AntCheckbox>
              </label>
            ))}
          </div>
        </div>

        {select("companyId", "Company", lookups.companies.map(c => [c.id, c.code ? `${c.code} · ${c.name}` : c.name]), "—")}
        {select("branch", "Branch / division", pairs(branches), "—", true)}
        {select("endUsers", "Business users", pairs(endUsersList), "—", true)}
        {select("priority", "Priority", pairs(PRIORITIES), "—")}
        {select("testStatus", "Business-user testing (UAT)", pairs(TEST_STATUSES), "—")}
        {select("acceptStatus", "Business-user acceptance", pairs(ACCEPT_STATUSES), "—")}

        <div className="field full">
          <label htmlFor="t_progress">Progress</label>
          <div className="prow">
            <AntSlider id="t_progress" min={0} max={100} step={5} value={f.progress} disabled={!canEdit} onChange={e => set("progress", Number(e.target.value))} style={{ flex: 1 }} />
            <output>{f.progress}%</output>
          </div>
        </div>
        {text("startDate", "Start date", { type: "date" })}
        {text("dueDate", "Due date", { type: "date" })}
        {text("completedDate", "Completed on", { type: "date" })}
        {select("size", "Size", SIZES)}
        {text("estHours", "Estimated hours", { type: "number", min: 0, step: 0.5 })}
        {select("lead", "Lead owner", lookups.developers.map(d => [d.id, d.name]), "First assigned")}
        {text("version", "Version / release", { placeholder: "v1.0" })}
        <div className="field full">
          <label htmlFor="t_description">Description / scope</label>
          <AntTextArea id="t_description" rows={3} value={f.description} onChange={e => set("description", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="field full">
          <label htmlFor="t_notes">Notes, blockers, remarks</label>
          <AntTextArea id="t_notes" rows={3} value={f.notes} onChange={e => set("notes", e.target.value)} disabled={!canEdit} />
        </div>
        {task?.approvalPending && (
          <div className="field full">
            <Chip color="var(--warn)">
              <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }} />
              Waiting for Admin / Project Manager approval
            </Chip>
          </div>
        )}
        {error && <p className="field full" role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
        {task && (
          <TaskExtrasView taskId={task.id} estHours={task.estHours} assigneeIds={task.assigneeIds} developers={lookups.developers}
            canEdit={canEdit} canManage={canDelete} viewerDeveloperId={viewerDeveloperId} onLoaded={x => setLoads(x.loads)} />
        )}
      </form>
      {sharing && task && loads && <SharePanel kind="task" id={task.id} title={task.title} current={task.assigneeIds} loads={loads} onClose={() => { setSharing(false); onClose(); }} />}
    </Panel>
  );
}
