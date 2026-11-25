import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { daysUntil, isBusinessUser } from "@/lib/licensing";
import { fmtDay, today } from "@/lib/dates";
import { licencePools } from "@/server/queries";
import { AdminView, type AdminData } from "./_components/AdminView";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  const viewer = await requireViewer();
  const [companies, projects, records, pools, openTasks] = await Promise.all([
    db.company.findMany({ orderBy: [{ country: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.accessRecord.findMany({ include: { appAccess: true, licences: { include: { licence: { select: { projectId: true } } } } } }),
    licencePools(),
    db.task.groupBy({ by: ["companyId"], where: { status: { not: "done" } }, _count: true }),
  ]);
  const holding = companies.find(c => c.holding) ?? null;
  const subs = companies.filter(c => !c.holding);
  const purchased = pools.reduce((a, p) => a + p.quantity, 0), assigned = pools.reduce((a, p) => a + p.assigned, 0);
  const due = pools.filter(p => { const n = daysUntil(p.renewal); return n != null && n <= 60; });

  // Needs attention
  const att: AdminData["attention"] = [];
  pools.filter(p => p.assigned > p.quantity).forEach(p => att.push({ color: "var(--bad)", title: `${p.software} ${p.type}: ${p.assigned} assigned, only ${p.quantity} purchased`, sub: "Over-allocated", href: `/licences?sw=${encodeURIComponent(p.software)}` }));
  due.forEach(p => { const n = daysUntil(p.renewal)!; att.push({ color: n < 0 ? "var(--bad)" : "var(--warn)", title: `${p.software} ${p.type}${p.companyName ? ` · ${p.companyName}` : ""}`, sub: n < 0 ? `Expired ${fmtDay(p.renewal)}` : `Renews in ${n} days (${fmtDay(p.renewal)})`, href: `/licences?view=${p.id}` }); });
  const inactiveLic = records.filter(r => r.status === "Inactive" && r.licences.length);
  if (inactiveLic.length) att.push({ color: "var(--warn)", title: `${inactiveLic.length} inactive ${inactiveLic.length === 1 ? "person" : "people"} still holding licences`, sub: inactiveLic.slice(0, 4).map(r => r.name).join(", ") + (inactiveLic.length > 4 ? "…" : ""), href: "/users" });
  const noComp = records.filter(r => !r.companyId);
  if (noComp.length && subs.length) att.push({ color: "var(--info)", title: `${noComp.length} ${noComp.length === 1 ? "person" : "people"} in Users & access without a company`, sub: "Set the company so licences and access roll up correctly", href: "/users?comp=_none" });
  const licensed = new Set(pools.map(p => p.projectId).filter(Boolean));
  const noLic = records.filter(r => isBusinessUser(r.userType) && r.appAccess.some(a => licensed.has(a.projectId) && !r.licences.some(l => l.licence.projectId === a.projectId)));
  if (noLic.length) att.push({ color: "var(--warn)", title: `${noLic.length} ${noLic.length === 1 ? "person has" : "people have"} access but no licence`, sub: "They can use a licensed system without a licence assigned", href: "/users" });

  const data: AdminData = {
    asOf: today(),
    kpis: {
      companies: subs.length, countries: new Set(subs.map(c => c.country).filter(Boolean)).size, activeUsers: records.filter(r => r.status !== "Inactive").length,
      purchased, assigned, available: purchased - assigned, renewals: due.length, openDev: openTasks.reduce((a, g) => a + g._count, 0),
    },
    pools,
    holding: holding ? { id: holding.id, name: holding.name } : null,
    companies: companies.map(c => ({
      id: c.id, name: c.name, country: c.country, code: c.code, sapDb: c.sapDb, branches: c.branches, notes: c.notes, holding: c.holding, parentId: c.parentId ?? "",
      users: records.filter(r => r.companyId === c.id).length, licencesHeld: records.filter(r => r.companyId === c.id).reduce((a, r) => a + r.licences.length, 0),
      access: Object.fromEntries(projects.map(p => [p.id, records.filter(r => r.companyId === c.id && r.appAccess.some(a => a.projectId === p.id)).length])),
      devItems: openTasks.find(g => g.companyId === c.id)?._count ?? 0,
    })),
    projects,
    attention: att,
  };
  return <AdminView data={data} canManage={canManage(viewer)} />;
}
