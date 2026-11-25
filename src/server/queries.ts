import "server-only";
import { unstable_cache } from "next/cache";
import type { Prisma, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getLists } from "@/lib/settings";
import { resequenceAllProjects } from "@/lib/sno";

// Read helpers used by server components. Writes live in the "use server" action files.

export type TaskFilters = { q?: string; project?: string; status?: string; dev?: string; priority?: string };

export async function listTasks(f: TaskFilters) {
  const where: Prisma.TaskWhereInput = {};
  if (f.project) where.projectId = f.project === "_none" ? null : f.project;
  if (f.status) where.status = f.status as TaskStatus;
  if (f.priority) where.priority = f.priority === "_none" ? null : (f.priority as Prisma.TaskWhereInput["priority"]);
  if (f.dev) where.assignees = f.dev === "_none" ? { none: {} } : { some: { developerId: f.dev } };
  if (f.q) {
    const q = f.q.trim();
    const n = Number(q);
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { subModule: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { endUsers: { contains: q, mode: "insensitive" } },
      ...(Number.isInteger(n) && n > 0 ? [{ sno: n }] : []),
    ];
  }
  const tasks = await db.task.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, code: true } },
      company: { select: { id: true, name: true, code: true } },
      assignees: { orderBy: { position: "asc" }, select: { developer: { select: { id: true, name: true } } } },
    },
    orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }],
  });

  // Auto-heal: if any project's tasks have sequence gaps, re-sequence them 1..N and return fresh
  if (!f.q && !f.status && !f.dev && !f.priority && tasks.length > 0) {
    const projCounters = new Map<string, number>();
    let hasGap = false;
    for (const t of tasks) {
      const k = t.projectId ?? "";
      const expected = (projCounters.get(k) ?? 0) + 1;
      projCounters.set(k, expected);
      if (t.sno !== expected) {
        hasGap = true;
        break;
      }
    }
    if (hasGap) {
      await db.$transaction(async (tx) => {
        await resequenceAllProjects(tx);
      });
      return db.task.findMany({
        where,
        include: {
          project: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, name: true, code: true } },
          assignees: { orderBy: { position: "asc" }, select: { developer: { select: { id: true, name: true } } } },
        },
        orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }],
      });
    }
  }

  return tasks;
}
export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number];

export const getTask = (id: string) =>
  db.task.findUnique({
    where: { id },
    include: { assignees: { orderBy: { position: "asc" } }, events: { orderBy: { at: "desc" }, take: 30 } },
  });

/** Small lookup lists used by filters and forms. Cached for rapid module-to-module transitions. */
export const lookups = unstable_cache(
  async () => {
    const [projects, developers, companies, lists] = await Promise.all([
      db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true } }),
      db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.company.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true } }),
      getLists(),
    ]);
    return { projects, developers, companies, lists };
  },
  ["app-lookups"],
  { revalidate: 30, tags: ["lookups"] }
);
export type Lookups = Awaited<ReturnType<typeof lookups>>;

/** Licence pools with how many are in use. Business-user pools only count business users. */
export async function licencePools() {
  const pools = await db.licence.findMany({
    orderBy: [{ software: "asc" }, { sortOrder: "asc" }, { type: "asc" }],
    include: {
      company: { select: { name: true } },
      project: { select: { id: true, name: true } },
      assignments: { select: { recordId: true, record: { select: { userType: true } } } },
    },
  });
  return pools.map(p => {
    const counted = p.assignments.filter(a => p.audience !== "endusers" || !a.record.userType || a.record.userType === "Business user");
    return {
      id: p.id, software: p.software, type: p.type, quantity: p.quantity, audience: p.audience,
      companyId: p.companyId ?? "", companyName: p.company?.name ?? "", projectId: p.projectId ?? "", projectName: p.project?.name ?? "",
      model: p.model, renewal: p.renewal ? p.renewal.toISOString().slice(0, 10) : "", vendor: p.vendor,
      cost: p.cost == null ? "" : String(p.cost), currency: p.currency, contract: p.contract, notes: p.notes,
      assigned: counted.length, holderIds: p.assignments.map(a => a.recordId),
    };
  });
}
export type LicencePool = Awaited<ReturnType<typeof licencePools>>[number];

/** Companies with their branches, for company pickers. */
export const companiesWithBranches = () =>
  db.company.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, country: true, branches: true } });
export type CompanyOption = Awaited<ReturnType<typeof companiesWithBranches>>[number];
