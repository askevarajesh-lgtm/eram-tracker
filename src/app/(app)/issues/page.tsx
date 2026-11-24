import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { getNotifySettings } from "@/lib/settings";
import { ISSUE_PRIORITIES, OPEN_STATUSES } from "@/lib/issues";
import { lookups } from "@/server/queries";
import { filesOf } from "@/lib/work";
import { IssueKpiCards } from "./_components/IssueKpiCards";
import { IssuesView } from "./_components/IssuesView";
import type { IssueDTO } from "./_components/types";

export const metadata: Metadata = { title: "Urgent issues" };

type Search = { q?: string; st?: string; pr?: string; dev?: string; mod?: string; new?: string; edit?: string; sla?: string };

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

    const now = Date.now();
    const isLate = (createdAt: Date, priority: string) => createdAt.getTime() + (cfg.sla[priority as keyof typeof cfg.sla] ?? 72) * 3600e3 < now;
    const late = open.filter(x => isLate(x.createdAt, x.priority)).length;
    const urgent = open.filter(x => x.priority === "Urgent").length;
    const unassigned = open.filter(x => !x._count.assignees).length;

    // an "open by id" link (?edit=TKN-...) must work even when filters hide that issue
    const extra = sp.edit && !rows.some(r => r.id === sp.edit) ? await db.issue.findUnique({ where: { id: sp.edit }, include }) : null;

    const rank = (p: string) => ISSUE_PRIORITIES.findIndex(x => x.key === p);
    const isOpen = (s: string) => (OPEN_STATUSES as string[]).includes(s);

    const baseRows = sp.sla === "late"
        ? rows.filter(r => isLate(r.createdAt, r.priority) && isOpen(r.status))
        : rows;

    const issues: IssueDTO[] = [...baseRows, ...(extra ? [extra] : [])]
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

    const filtered = !!(sp.q || sp.st || sp.pr || sp.dev || sp.mod || sp.sla);

    return (
        <>
            <IssueKpiCards
                urgent={urgent}
                open={open.length}
                unassigned={unassigned}
                late={late}
                resolvedToday={resolvedToday}
                currentPr={sp.pr}
                currentDev={sp.dev}
                currentSt={sp.st}
                currentSla={sp.sla}
            />
            <div style={{ marginTop: 20 }}>
                <IssuesView
                    issues={issues}
                    lookups={lk}
                    sla={cfg.sla}
                    viewer={{ developerId: viewer.developerId, canManage: canManage(viewer), role: viewer.role }}
                    openNew={sp.new === "1"}
                    openId={sp.edit}
                    anyIssues={open.length > 0 || rows.length > 0 || (await db.issue.count()) > 0}
                    filtered={filtered}
                    totalOpen={open.length}
                />
            </div>
        </>
    );
}
