import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { OPEN_STATUSES } from "@/lib/issues";
import { ApprovalsView, type QueueItem, type Decision } from "./_components/ApprovalsView";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const viewer = await requireViewer();
  const [issues, tasks, changes, developers, decidedIssues, decidedTasks, decidedChanges] = await Promise.all([
    db.issue.findMany({
      where: { approvalState: "pending", status: { in: OPEN_STATUSES } },
      include: {
        project: { select: { name: true, code: true } },
        company: { select: { name: true } },
        assignees: { orderBy: { position: "asc" }, include: { developer: { select: { id: true, name: true } } } },
      },
    }),
    db.task.findMany({
      where: { approvalState: "pending" },
      include: {
        project: { select: { name: true, code: true } },
        company: { select: { name: true } },
        assignees: { orderBy: { position: "asc" }, include: { developer: { select: { id: true, name: true } } } },
      },
    }),
    db.changeRequest.findMany({
      where: { status: { in: ["Submitted", "Under review"] } },
      include: {
        project: { select: { name: true, code: true } },
        company: { select: { name: true } },
      },
    }),
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.issue.findMany({
      where: { approvalState: { in: ["approved", "rejected"] } },
      orderBy: { approvalAt: "desc" },
      take: 50,
      include: { project: { select: { name: true, code: true } } },
    }),
    db.task.findMany({
      where: { approvalState: { in: ["approved", "rejected"] } },
      orderBy: { approvalAt: "desc" },
      take: 50,
      include: { project: { select: { name: true, code: true } } },
    }),
    db.changeRequest.findMany({
      where: { approvalState: { in: ["approved", "rejected"] } },
      orderBy: { decidedAt: "desc" },
      take: 50,
      include: { project: { select: { name: true, code: true } } },
    }),
  ]);

  const queue: QueueItem[] = [
    ...issues.map((x) => ({
      kind: "issue" as const,
      id: x.id,
      ref: x.id,
      title: x.title,
      description: x.description || "",
      priority: x.priority || "Normal",
      projectName: x.project?.name ?? null,
      projectCode: x.project?.code ?? null,
      companyName: x.company?.name ?? null,
      raisedBy: x.raisedBy || null,
      subModule: null,
      effort: null,
      color: "var(--bad)",
      at: x.createdAt.toISOString(),
      href: `/issues?view=${x.id}`,
      sub: `${x.priority} issue · raised by ${x.raisedBy || "—"}${x.assignees.length ? " · for " + x.assignees.map((a) => a.developer.name).join(", ") : ""}`,
      assigneeIds: x.assignees.map((a) => a.developerId),
      assigneeNames: x.assignees.map((a) => a.developer.name),
    })),
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`,
      title: t.title,
      description: t.description || "",
      priority: t.priority ?? "Normal",
      projectName: t.project?.name ?? null,
      projectCode: t.project?.code ?? null,
      companyName: t.company?.name ?? null,
      raisedBy: null,
      subModule: t.subModule || null,
      effort: null,
      color: "var(--warn)",
      at: t.createdAt.toISOString(),
      href: `/tasks?view=${t.id}`,
      sub: `${t.priority ?? "Task"} task · ${t.project?.name ?? "General"} · ${t.assignees.map((a) => a.developer.name).join(", ") || "Unassigned"}`,
      assigneeIds: t.assignees.map((a) => a.developerId),
      assigneeNames: t.assignees.map((a) => a.developer.name),
    })),
    ...changes.map((c) => ({
      kind: "change" as const,
      id: c.id,
      ref: c.id,
      title: c.title,
      description: c.description || "",
      priority: c.priority || "Normal",
      projectName: c.project?.name ?? null,
      projectCode: c.project?.code ?? null,
      companyName: c.company?.name ?? null,
      raisedBy: c.requestedBy || null,
      subModule: c.subModule || null,
      effort: c.effort || null,
      color: "var(--lms)",
      at: c.createdAt.toISOString(),
      href: `/plan?tab=changes&edit=${c.id}`,
      sub: `Change request · ${c.project?.name ?? "General"} · by ${c.requestedBy || "—"}${c.effort ? " · effort " + c.effort : ""}`,
      assigneeIds: [],
      assigneeNames: [],
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const history: Decision[] = [
    ...decidedIssues.map((x) => ({
      id: x.id,
      ref: x.id,
      kind: "issue" as const,
      title: x.title,
      state: x.approvalState!,
      by: x.approvalBy ?? "",
      at: x.approvalAt?.toISOString() ?? x.updatedAt.toISOString(),
      note: x.approvalNote ?? "",
      href: `/issues?st=all&view=${x.id}`,
      projectName: x.project?.name ?? null,
    })),
    ...decidedTasks.map((t) => ({
      id: t.id,
      ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`,
      kind: "task" as const,
      title: t.title,
      state: t.approvalState!,
      by: t.approvalBy ?? "",
      at: t.approvalAt?.toISOString() ?? t.updatedAt.toISOString(),
      note: t.approvalNote ?? "",
      href: `/tasks?view=${t.id}`,
      projectName: t.project?.name ?? null,
    })),
    ...decidedChanges.map((c) => ({
      id: c.id,
      ref: c.id,
      kind: "change" as const,
      title: c.title,
      state: c.approvalState!,
      by: c.decisionBy ?? "",
      at: c.decidedAt?.toISOString() ?? c.updatedAt.toISOString(),
      note: c.decisionNote ?? "",
      href: `/plan?tab=changes&edit=${c.id}`,
      projectName: c.project?.name ?? null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 50);

  return <ApprovalsView queue={queue} history={history} developers={developers} canManage={canManage(viewer)} />;
}
