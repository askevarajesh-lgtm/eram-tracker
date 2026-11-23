import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { getLists } from "@/lib/settings";
import { today } from "@/lib/dates";
import { Kpi } from "@/components/ui/Kpi";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { UatView, type UatRow } from "./_components/UatView";

export const metadata: Metadata = { title: "UAT & sign-off" };

type Signoff = { by?: string; team?: string; d?: string; how?: string; note?: string };

export default async function UatPage({ searchParams }: { searchParams: Promise<{ q?: string; mod?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.TaskWhereInput = {
    status: "done", NOT: { acceptStatus: "Accepted" }, projectId: sp.mod || undefined,
    OR: q ? ["title", "subModule", "endUsers"].map(f => ({ [f]: { contains: q, mode: "insensitive" } })) : undefined,
  };
  const month = today().slice(0, 7);
  const [rows, projects, waiting, testedNotAccepted, signed, returned, lists, people] = await Promise.all([
    db.task.findMany({
      where, orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }], take: 300,
      include: { project: { select: { code: true } }, assignees: { orderBy: { position: "asc" }, include: { developer: { select: { id: true, name: true } } } }, events: { where: { kind: "uat_reject" }, select: { id: true } } },
    }),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.task.count({ where: { status: "done", NOT: [{ testStatus: "Completed" }, { acceptStatus: "Accepted" }] } }),
    db.task.count({ where: { testStatus: "Completed", NOT: { acceptStatus: "Accepted" } } }),
    db.task.findMany({ where: { NOT: { signoff: { equals: Prisma.DbNull } } }, select: { id: true, title: true, signoff: true } }),
    db.task.count({ where: { status: { not: "done" }, events: { some: { kind: "uat_reject" } } } }),
    getLists(),
    // Users & access register: business users who may get a "please test" message
    db.accessRecord.findMany({ where: { email: { not: "" }, dept: { not: "" } }, select: { id: true, name: true, email: true, dept: true } }),
  ]);
  const signoffs = signed
    .filter(t => t.signoff && typeof t.signoff === "object")
    .map(t => ({ id: t.id, title: t.title, ...(t.signoff as Signoff) }))
    .sort((a, b) => (b.d ?? "").localeCompare(a.d ?? ""));
  const total = await db.task.count({ where });

  const data: UatRow[] = rows.map(t => ({
    id: t.id, ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`, title: t.title, subModule: t.subModule, endUsers: t.endUsers,
    testStatus: t.testStatus, acceptStatus: t.acceptStatus, developers: t.assignees.map(a => a.developer), returned: t.events.length,
  }));

  return (
    <>
      <div className="kpis">
        <Kpi n={waiting} label="Waiting for business-user testing" />
        <Kpi n={testedNotAccepted} label="Tested, not yet accepted" />
        <Kpi n={signoffs.filter(s => (s.d ?? "").startsWith(month)).length} label="Signed off this month" />
        <Kpi n={returned} label="Sent back for changes" />
      </div>
      <div style={{ marginTop: 18 }}>
        <UrlFilters search={{ placeholder: "Search item, module, business users…" }} selects={[{ key: "mod", all: "All projects", options: projects.map(p => [p.id, p.name]) }]} />
      </div>
      <UatView rows={data} total={total} signoffs={signoffs.slice(0, 40)} teams={lists.endUsers} canManage={canManage(viewer)} people={people} />
    </>
  );
}
