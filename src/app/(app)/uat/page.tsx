import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { getLists } from "@/lib/settings";
import { today } from "@/lib/dates";
import { Clock, FlaskConical, BadgeCheck, RotateCcw } from "lucide-react";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { UatView, type UatRow } from "./_components/UatView";
import "./_components/uat-dashboard.css";

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

  const signedThisMonth = signoffs.filter(s => (s.d ?? "").startsWith(month)).length;

  return (
    <>
      <div className="uat-kpi-grid">
        <div className="uat-kpi-card" style={{ ["--kpi-c" as string]: "var(--accent)", ["--kpi-bg" as string]: "var(--accent-soft)" }}>
          <span className="uat-kpi-icon"><Clock size={22} /></span>
          <div className="uat-kpi-body">
            <div className="uat-kpi-val">{waiting}</div>
            <div className="uat-kpi-label">Waiting for testing</div>
            <div className="uat-kpi-sub">Ready for business-user UAT</div>
          </div>
        </div>
        <div className="uat-kpi-card" style={{ ["--kpi-c" as string]: "var(--info)", ["--kpi-bg" as string]: "rgba(37,99,235,0.14)" }}>
          <span className="uat-kpi-icon"><FlaskConical size={22} /></span>
          <div className="uat-kpi-body">
            <div className="uat-kpi-val">{testedNotAccepted}</div>
            <div className="uat-kpi-label">Tested, not accepted</div>
            <div className="uat-kpi-sub">Awaiting final sign-off</div>
          </div>
        </div>
        <div className="uat-kpi-card" style={{ ["--kpi-c" as string]: "var(--ok)", ["--kpi-bg" as string]: "rgba(21,146,74,0.14)" }}>
          <span className="uat-kpi-icon"><BadgeCheck size={22} /></span>
          <div className="uat-kpi-body">
            <div className="uat-kpi-val">{signedThisMonth}</div>
            <div className="uat-kpi-label">Signed off this month</div>
            <div className="uat-kpi-sub">Accepted by business users</div>
          </div>
        </div>
        <div className="uat-kpi-card" style={{ ["--kpi-c" as string]: returned > 0 ? "var(--warn)" : "var(--hold)", ["--kpi-bg" as string]: returned > 0 ? "rgba(199,116,8,0.14)" : "var(--sunk)" }}>
          <span className="uat-kpi-icon"><RotateCcw size={22} /></span>
          <div className="uat-kpi-body">
            <div className="uat-kpi-val">{returned}</div>
            <div className="uat-kpi-label">Sent back for changes</div>
            <div className="uat-kpi-sub">{returned > 0 ? "Returned to development" : "No rejections"}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <UrlFilters search={{ placeholder: "Search item, module, business users…" }} selects={[{ key: "mod", all: "All projects", options: projects.map(p => [p.id, p.name]) }]} />
      </div>
      <UatView rows={data} total={total} signoffs={signoffs.slice(0, 40)} teams={lists.endUsers} canManage={canManage(viewer)} people={people} />
    </>
  );
}
