import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { getNotifySettings } from "@/lib/settings";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, OPEN_STATUSES } from "@/lib/issues";
import { lookups } from "@/server/queries";
import { filesOf } from "@/lib/work";
import { Kpi } from "@/components/ui/Kpi";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { IssuesView } from "./_components/IssuesView";
import type { IssueDTO } from "./_components/types";

export const metadata: Metadata = { title: "Urgent issues" };

type Search = { q?: string; st?: string; pr?: string; dev?: string; mod?: string; new?: string; edit?: string };

const include = {
  project: { select: { name: true } },
  company: { select: { name: true } },
  task: { select: { sno: true } },
  assignees: { orderBy: { position: "asc" }, include: { developer: { select: { name: true } } } },
  events: { orderBy: { at: "desc" }, take: 40 },
} satisfies Prisma.IssueInclude;

export default async function IssuesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const st = sp.st ?? "";
  const where: Prisma.IssueWhereInput = {
    status: st === "" ? { in: OPEN_STATUSES } : st === "all" ? undefined : st,
    priority: sp.pr || undefined,
    projectId: sp.mod || undefined,
    assignees: sp.dev === "_none" ? { none: {} } : sp.dev ? { some: { developerId: sp.dev } } : undefined,
    OR: sp.q ? ["id", "title", "description", "raisedBy"].map(f => ({ [f]: { contains: sp.q, mode: "insensitive" } })) : undefined,
  };
  const startOfDay = new Date(new Date().toISOString().slice(0, 10));
  const [rows, open, resolvedToday, lk, cfg] = await Promise.all([
    db.issue.findMany({ where, include, orderBy: { createdAt: "asc" } }),
    db.issue.findMany({ where: { status: { in: OPEN_STATUSES } }, select: { priority: true, createdAt: true, _count: { select: { assignees: true } } } }),
    db.issue.count({ where: { resolvedAt: { gte: startOfDay } } }),
    lookups(),
    getNotifySettings(),
  ]);
  // an "open by id" link (?edit=TKN-...) must work even when filters hide that issue
  const extra = sp.edit && !rows.some(r => r.id === sp.edit) ? await db.issue.findUnique({ where: { id: sp.edit }, include }) : null;

  const rank = (p: string) => ISSUE_PRIORITIES.findIndex(x => x.key === p);
  const isOpen = (s: string) => (OPEN_STATUSES as string[]).includes(s);
  const issues: IssueDTO[] = [...rows, ...(extra ? [extra] : [])]
    .sort((a, b) => rank(a.priority) - rank(b.priority) || Number(isOpen(b.status)) - Number(isOpen(a.status)) || a.createdAt.getTime() - b.createdAt.getTime())
    .map(x => ({
      id: x.id, title: x.title, description: x.description, projectId: x.projectId ?? "", projectName: x.project?.name ?? "",
      priority: x.priority, status: x.status, raisedBy: x.raisedBy, contact: x.contact, companyId: x.companyId ?? "", companyName: x.company?.name ?? "",
      assigneeIds: x.assignees.map(a => a.developerId), assigneeNames: x.assignees.map(a => a.developer.name), resolution: x.resolution,
      createdAt: x.createdAt.toISOString(), resolvedAt: x.resolvedAt?.toISOString() ?? "", taskSno: x.task?.sno ?? null,
      approvalState: x.approvalState, approvalBy: x.approvalBy ?? "", approvalAt: x.approvalAt?.toISOString() ?? "", approvalNote: x.approvalNote ?? "",
      events: x.events.map(e => ({ at: e.at.toISOString(), message: e.message })),
      files: filesOf(x.files),
      hidden: x === extra,
    }));

  const now = Date.now();
  const late = open.filter(x => x.createdAt.getTime() + (cfg.sla[x.priority as keyof typeof cfg.sla] ?? 72) * 3600e3 < now).length;
  const urgent = open.filter(x => x.priority === "Urgent").length;
  const unassigned = open.filter(x => !x._count.assignees).length;

  return (
    <>
      <div className="kpis">
        <Kpi n={urgent} label="Urgent open" bad={urgent > 0} href="/issues?pr=Urgent" />
        <Kpi n={open.length} label="All open" href="/issues" />
        <Kpi n={unassigned} label="Unassigned" bad={unassigned > 0} href="/issues?dev=_none" />
        <Kpi n={late} label="Past response time" bad={late > 0} />
        <Kpi n={resolvedToday} label="Resolved today" />
      </div>
      <div style={{ marginTop: 18 }}>
        <UrlFilters
          search={{ placeholder: "Search token, issue, raised by…" }}
          selects={[
            { key: "st", all: "Open issues", options: [["all", "All issues"], ...ISSUE_STATUSES.map(s => [s.key, s.label] as [string, string])] },
            { key: "pr", all: "All priorities", options: ISSUE_PRIORITIES.map(p => [p.key, p.key]) },
            { key: "dev", all: "All developers", options: [["_none", "Unassigned"], ...lk.developers.map(d => [d.id, d.name] as [string, string])] },
            { key: "mod", all: "All systems", options: lk.projects.map(p => [p.id, p.name]) },
          ]}
        />
      </div>
      <IssuesView
        issues={issues}
        lookups={lk}
        sla={cfg.sla}
        viewer={{ developerId: viewer.developerId, canManage: canManage(viewer), role: viewer.role }}
        openNew={sp.new === "1"}
        openId={sp.edit}
        anyIssues={open.length > 0 || rows.length > 0 || (await db.issue.count()) > 0}
      />
    </>
  );
}
