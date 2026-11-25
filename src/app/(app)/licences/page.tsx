import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { companiesWithBranches, licencePools } from "@/server/queries";
import { LicencesView } from "./_components/LicencesView";

export const metadata: Metadata = { title: "Licences" };

type Search = { sw?: string; new?: string; edit?: string; view?: string; assign?: string; tab?: string };

export default async function LicencesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const [pools, companies, projects, records] = await Promise.all([
    licencePools(),
    companiesWithBranches(),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    // people in the Users & access register (records, not app accounts), for the assign panel
    db.accessRecord.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, companyId: true, branch: true, dept: true, status: true, userType: true, company: { select: { name: true } }, licences: { select: { licenceId: true } } },
    }),
  ]);

  const activeTab = sp.tab || (sp.view || sp.edit || sp.assign || sp.new === "1" || sp.sw ? "list" : "dashboard");

  return (
    <LicencesView
      pools={pools}
      companies={companies}
      projects={projects}
      records={records.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        companyId: r.companyId ?? "",
        companyName: r.company?.name ?? "",
        branch: r.branch,
        dept: r.dept,
        status: r.status,
        userType: r.userType,
        licenceIds: r.licences.map(l => l.licenceId),
      }))}
      canManage={canManage(viewer)}
      tab={activeTab === "list" ? "list" : "dashboard"}
      software={sp.sw ?? ""}
      openNew={sp.new === "1"}
      openId={sp.edit}
      openViewId={sp.view}
      assignId={sp.assign}
    />
  );
}
