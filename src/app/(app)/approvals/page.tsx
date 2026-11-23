import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { OPEN_STATUSES } from "@/lib/issues";
import { ApprovalsView, type QueueItem, type Decision } from "./_components/ApprovalsView";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const viewer = await requireViewer();
  const [issues, tasks, changes, developers, decidedIssues, decidedTasks] = await Promise.all([
    db.issue.findMany({ where: { approvalState: "pending", status: { in: OPEN_STATUSES } }, include: { assignees: { orderBy: { position: "asc" }, include: { developer: { select: { name: true } } } } } }),
    db.task.findMany({ where: { approvalState: "pending" }, include: { project: { select: { name: true, code: true } }, assignees: { orderBy: { position: "asc" }, include: { developer: { select: { name: true } } } } } }),
    db.changeRequest.findMany({ where: { status: { in: ["Submitted", "Under review"] } }, include: { project: { select: { name: true } } } }),
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.issue.findMany({ where: { approvalState: { in: ["approved", "rejected"] } }, orderBy: { approvalAt: "desc" }, take: 25 }),
    db.task.findMany({ where: { approvalState: { in: ["approved", "rejected"] } }, orderBy: { approvalAt: "desc" }, take: 25, include: { project: { select: { code: true } } } }),
  ]);

  const queue: QueueItem[] = [
    ...issues.map(x => ({
      kind: "issue" as const, id: x.id, ref: x.id, title: x.title, color: "var(--bad)", at: x.createdAt.toISOString(), href: `/issues?edit=${x.id}`,
      sub: `${x.priority} issue · raised by ${x.raisedBy || "—"}${x.assignees.length ? " · for " + x.assignees.map(a => a.developer.name).join(", ") : ""}`,
      assigneeIds: x.assignees.map(a => a.developerId),
    })),
    ...tasks.map(t => ({
      kind: "task" as const, id: t.id, ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`, title: t.title, color: "var(--warn)", at: t.createdAt.toISOString(), href: `/tasks?edit=${t.id}`,
      sub: `${t.priority ?? "Task"} task · ${t.project?.name ?? ""} · ${t.assignees.map(a => a.developer.name).join(", ") || "Unassigned"}`,
      assigneeIds: t.assignees.map(a => a.developerId),
    })),
    ...changes.map(c => ({
      kind: "change" as const, id: c.id, ref: c.id, title: c.title, color: "var(--lms)", at: c.createdAt.toISOString(), href: `/plan?tab=changes&edit=${c.id}`,
      sub: `Change request · ${c.project?.name ?? ""} · by ${c.requestedBy || "—"} · effort ${c.effort || "?"}`, assigneeIds: [],
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const history: Decision[] = [
    ...decidedIssues.map(x => ({ ref: x.id, title: x.title, state: x.approvalState!, by: x.approvalBy ?? "", at: x.approvalAt?.toISOString() ?? "", note: x.approvalNote ?? "", href: `/issues?st=all&edit=${x.id}` })),
    ...decidedTasks.map(t => ({ ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`, title: t.title, state: t.approvalState!, by: t.approvalBy ?? "", at: t.approvalAt?.toISOString() ?? "", note: t.approvalNote ?? "", href: `/tasks?edit=${t.id}` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);

  return <ApprovalsView queue={queue} history={history} developers={developers} canManage={canManage(viewer)} />;
}
