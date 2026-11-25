import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";
import { getLists, getNotifySettings } from "@/lib/settings";
import { AdminPanelView } from "./_components/AdminPanelView";

export const metadata: Metadata = { title: "Admin panel" };

const TABS = ["notify", "cron", "lists", "log", "data"] as const;

export default async function AdminPanelPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; area?: string }> }) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) redirect("/");
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "notify";

  const [notify, lists, developers] = await Promise.all([getNotifySettings(), getLists(), db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, whatsapp: true } })]);

  let cronLogs: any[] = [];
  if (tab === "cron") {
    const rows = await db.cronJobLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    cronLogs = rows.map(r => ({
      id: r.id,
      jobName: r.jobName,
      status: r.status,
      processed: r.processed,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? "",
      details: r.details,
      error: r.error,
    }));
  }

  let log: { at: string; who: string; action: string; entity: string; label: string }[] = [];
  let areas: string[] = [];
  if (tab === "log") {
    const where: Prisma.AuditEntryWhereInput = { entity: sp.area || undefined, label: sp.q ? { contains: sp.q, mode: "insensitive" } : undefined };
    const [rows, ents] = await Promise.all([
      db.auditEntry.findMany({ where, orderBy: { at: "desc" }, take: 400, include: { account: { select: { name: true } } } }),
      db.auditEntry.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    ]);
    log = rows.map(r => ({ at: r.at.toISOString(), who: r.account?.name ?? "—", action: r.action, entity: r.entity, label: r.label }));
    areas = ents.map(e => e.entity).filter(Boolean);
  }

  let data: { counts: [string, number][]; sources: [string, number][]; projects: { id: string; name: string; n: number }[] } | null = null;
  if (tab === "data") {
    const [tasks, devs, recs, lic, comps, roll, projs, notes, man, accts, sources, byProject] = await Promise.all([
      db.task.count(), db.developer.count(), db.accessRecord.count(), db.licence.count(), db.company.count(), db.rollout.count(), db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
      db.dailyNote.count(), db.manual.count(), db.account.count(),
      db.task.groupBy({ by: ["source"], where: { source: { not: "" } }, _count: true }),
      db.task.groupBy({ by: ["projectId"], _count: true }),
    ]);
    data = {
      counts: [["Development items", tasks], ["Developers", devs], ["Users & access records", recs], ["Licence lines", lic], ["Companies", comps], ["Rollout cells", roll], ["Projects", projs.length], ["Day notes", notes], ["User manuals", man], ["Sign-in accounts", accts]],
      sources: sources.map(s => [s.source, s._count]),
      projects: projs.map(p => ({ ...p, n: byProject.find(b => b.projectId === p.id)?._count ?? 0 })),
    };
  }

  return <AdminPanelView tab={tab} notify={notify} lists={lists} developers={developers} log={log} areas={areas} data={data} cronLogs={cronLogs} />;
}
