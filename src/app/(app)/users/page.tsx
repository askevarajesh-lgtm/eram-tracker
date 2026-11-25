import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { projectColor } from "@/lib/constants";
import { companiesWithBranches, licencePools } from "@/server/queries";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { AccessView } from "./_components/AccessView";
import type { AccessRow } from "./_components/types";

export const metadata: Metadata = { title: "Users & access" };

type Search = { q?: string; comp?: string; app?: string; dept?: string; new?: string; edit?: string; view?: string };

// The "Users & access" register: people in the companies and the systems/licences allocated to them.
// They are records only; they don't sign in to this app.
export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.AccessRecordWhereInput = {
    companyId: sp.comp === "_none" ? null : sp.comp || undefined,
    dept: sp.dept || undefined,
    appAccess: sp.app === "_none" ? { none: {} } : sp.app ? { some: { projectId: sp.app } } : undefined,
    OR: q
      ? [
          ...["name", "email", "dept", "designation", "branch", "sapCode"].map(f => ({ [f]: { contains: q, mode: "insensitive" as const } })),
          { company: { name: { contains: q, mode: "insensitive" } } },
          { licences: { some: { licence: { type: { contains: q, mode: "insensitive" } } } } },
        ]
      : undefined,
  };
  const [records, total, projects, accessCounts, depts, pools, companies] = await Promise.all([
    db.accessRecord.findMany({
      where,
      orderBy: { name: "asc" },
      include: { company: { select: { name: true } }, appAccess: true, licences: { select: { licenceId: true } } },
    }),
    db.accessRecord.count(),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.appAccess.groupBy({ by: ["projectId"], _count: true }),
    db.accessRecord.findMany({ where: { dept: { not: "" } }, distinct: ["dept"], select: { dept: true }, orderBy: { dept: "asc" } }),
    licencePools(),
    companiesWithBranches(),
  ]);

  const rows: AccessRow[] = records.map(r => ({
    id: r.id, name: r.name, email: r.email, sapCode: r.sapCode, companyId: r.companyId ?? "", companyName: r.company?.name ?? "",
    branch: r.branch, dept: r.dept, designation: r.designation, status: r.status, userType: r.userType,
    apps: r.appAccess.map(a => ({ projectId: a.projectId, role: a.role })), licenceIds: r.licences.map(l => l.licenceId),
  }));
  const projectsWithColor = projects.map(p => ({ ...p, color: projectColor(p.name), count: accessCounts.find(c => c.projectId === p.id)?._count ?? 0 }));
  const manage = canManage(viewer);

  return (
    <>
      <p className="eyebrow">Register of people in the companies · which software they can use, and on which licence. These people don't sign in to this tracker.</p>
      <div className="modgrid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", marginBottom: 16 }}>
        {projectsWithColor.map(p => (
          <Link key={p.id} href={sp.app === p.id ? "/users" : `/users?app=${p.id}`} className="mod" style={{ ["--mc" as string]: p.color, textDecoration: "none", color: "inherit", outline: sp.app === p.id ? "2px solid var(--mc)" : undefined }}>
            <h3>{p.name}<span className="pct">{p.count}</span></h3>
            <div className="meta"><span>{p.count === 1 ? "person" : "people"} with access</span></div>
          </Link>
        ))}
      </div>
      <UrlFilters
        search={{ placeholder: "Search name, email, branch, licence…" }}
        selects={[
          { key: "comp", all: "All companies", options: [["_none", "No company set"], ...companies.map(c => [c.id, c.name + (c.country ? ` (${c.country})` : "")] as [string, string])] },
          { key: "app", all: "All systems", options: [...projects.map(p => [p.id, `Access to ${p.name}`] as [string, string]), ["_none", "No system"]] },
          { key: "dept", all: "All departments", options: depts.map(d => [d.dept, d.dept]) },
        ]}
      />
      <AccessView
        rows={rows}
        total={total}
        projects={projectsWithColor}
        pools={pools}
        companies={companies}
        departments={depts.map(d => d.dept)}
        canManage={manage}
        openNew={sp.new === "1"}
        openId={sp.edit}
        openViewId={sp.view}
        defaultCompanyId={sp.comp && sp.comp !== "_none" ? sp.comp : ""}
      />
    </>
  );
}
