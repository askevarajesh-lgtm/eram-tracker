"use server";
// Excel / CSV import. The browser parses the file (src/lib/excel/parse.ts) and sends the rows here.
// Preview and import run the SAME code inside one transaction; a preview just rolls it back,
// so what the preview shows is exactly what the import will do, and an import is all-or-nothing.
import { revalidatePath } from "next/cache";
import type { Prisma, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer, type Viewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { fail, type ActionResult } from "@/lib/action";
import { lockSno, resequenceProjectTasks } from "@/lib/sno";
import { toDay, today } from "@/lib/dates";
import { isBusinessUser } from "@/lib/licensing";
import { norm } from "@/lib/excel/normalize";
import { importPayload, type ImportPayload, type ImportPreview } from "@/lib/excel/types";

type Tx = Prisma.TransactionClient;
class Rollback extends Error { constructor(public result: ImportPreview) { super("rollback"); } }

const codeFrom = (name: string) => name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "GEN";
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function apply(tx: Tx, viewer: Viewer, p: ReturnType<typeof importPayload.parse>, defaultProjectId: string | null): Promise<ImportPreview> {
  const result: ImportPreview = {
    tasks: { total: p.tasks.length, create: 0, update: 0 }, newDevelopers: [], newProjects: [], newCompanies: [],
    accessRecords: { total: p.accessRecords.length, create: 0, update: 0 }, licences: 0, companies: 0, developers: 0, taskChanges: [],
  };
  const day = toDay(today());

  // ---------------- developers (by name)
  const devIdx = new Map((await tx.developer.findMany()).map(d => [norm(d.name), d]));
  for (const d of p.developers) {
    const ex = devIdx.get(norm(d.name));
    if (ex) {
      const data = Object.fromEntries(Object.entries({ title: d.title, email: d.email, skills: d.skills }).filter(([k, v]) => v && v !== ex[k as keyof typeof ex]));
      if (Object.keys(data).length) { devIdx.set(norm(d.name), await tx.developer.update({ where: { id: ex.id }, data })); result.developers++; }
    } else {
      devIdx.set(norm(d.name), await tx.developer.create({ data: d }));
      result.newDevelopers.push(d.name);
      result.developers++;
    }
  }
  const devId = async (name: string) => {
    const k = norm(name);
    let d = devIdx.get(k);
    if (!d) { d = await tx.developer.create({ data: { name } }); devIdx.set(k, d); result.newDevelopers.push(name); }
    return d.id;
  };

  // ---------------- projects (by name, code or full name)
  const projects = await tx.project.findMany();
  const projIdx = new Map<string, string>();
  for (const pr of projects) for (const k of [pr.name, pr.code, pr.fullName]) if (k && !projIdx.has(norm(k))) projIdx.set(norm(k), pr.id);
  const projectCode = new Map(projects.map(pr => [pr.id, pr.code]));
  let order = projects.length;
  const projectId = async (name: string) => {
    const k = norm(name);
    let id = projIdx.get(k);
    if (!id) {
      const pr = await tx.project.create({ data: { name, code: codeFrom(name), sortOrder: order++ } });
      id = pr.id; projIdx.set(k, id); projectCode.set(id, pr.code); result.newProjects.push(name);
    }
    return id;
  };

  // ---------------- companies (sheet first, then by name/code wherever they're mentioned)
  const companies = await tx.company.findMany();
  const compIdx = new Map<string, string>();
  const indexCompany = (c: { id: string; name: string; code: string; country: string }) => {
    compIdx.set(norm(c.name) + "|" + norm(c.country), c.id);
    if (!compIdx.has(norm(c.name))) compIdx.set(norm(c.name), c.id);
    if (c.code && !compIdx.has(norm(c.code))) compIdx.set(norm(c.code), c.id);
  };
  companies.forEach(indexCompany);
  let compOrder = companies.length;
  for (const c of p.companies) {
    const id = compIdx.get(norm(c.name) + "|" + norm(c.country)) ?? (!c.country ? compIdx.get(norm(c.name)) : undefined);
    const ex = id ? companies.find(z => z.id === id) : undefined;
    const data = { name: c.name, country: c.country || ex?.country || "", code: c.code || ex?.code || "", branches: c.branches.length ? c.branches : ex?.branches ?? [] };
    if (ex && same({ name: ex.name, country: ex.country, code: ex.code, branches: ex.branches }, data)) continue; // unchanged
    const saved = ex ? await tx.company.update({ where: { id: ex.id }, data }) : await tx.company.create({ data: { ...data, sortOrder: compOrder++ } });
    if (!ex) result.newCompanies.push(c.name);
    result.companies++;
    indexCompany(saved);
  }
  const companyId = async (name: string) => {
    if (!name) return null;
    let id = compIdx.get(norm(name));
    if (!id) {
      const c = await tx.company.create({ data: { name, code: /^[A-Z0-9]{2,6}$/.test(name) ? name : "", sortOrder: compOrder++ } });
      id = c.id; indexCompany(c); result.newCompanies.push(name);
    }
    return id;
  };

  // ---------------- licence pools (software + type + company)
  const pools = await tx.licence.findMany();
  const poolKey = (sw: string, type: string, cid: string | null) => `${norm(sw)}|${norm(type)}|${cid ?? ""}`;
  const poolIdx = new Map(pools.map(l => [poolKey(l.software, l.type, l.companyId), l]));
  let licOrder = pools.length;
  for (const l of p.licences) {
    const cid = await companyId(l.company);
    const ex = poolIdx.get(poolKey(l.software, l.type, cid));
    const data = {
      software: l.software, type: l.type, companyId: cid, quantity: l.quantity, projectId: ex?.projectId ?? projIdx.get(norm(l.software)) ?? null,
      model: l.model || ex?.model || "", renewal: toDay(l.renewal) ?? ex?.renewal ?? null, vendor: l.vendor || ex?.vendor || "",
      cost: l.cost ?? ex?.cost ?? null, currency: l.currency || ex?.currency || "", contract: l.contract || ex?.contract || "", notes: l.notes || ex?.notes || "",
    };
    if (ex) {
      const before = { software: ex.software, type: ex.type, companyId: ex.companyId, quantity: ex.quantity, projectId: ex.projectId, model: ex.model, renewal: ex.renewal,
        vendor: ex.vendor, cost: ex.cost != null ? Number(ex.cost) : null, currency: ex.currency, contract: ex.contract, notes: ex.notes };
      if (same(before, { ...data, cost: data.cost != null ? Number(data.cost) : null })) continue; // unchanged
    }
    const saved = ex ? await tx.licence.update({ where: { id: ex.id }, data }) : await tx.licence.create({ data: { ...data, sortOrder: licOrder++ } });
    result.licences++;
    poolIdx.set(poolKey(saved.software, saved.type, saved.companyId), saved);
  }

  // ---------------- tasks
  if (p.tasks.length) {
    await lockSno(tx);
    const existing = await tx.task.findMany({ include: { assignees: { orderBy: { position: "asc" } } } });
    const bySno = new Map(existing.map(t => [`${t.projectId ?? ""}|${t.sno}`, t]));
    const byTitle = new Map(existing.map(t => [`${t.projectId ?? ""}|${norm(t.title)}|${norm(t.subModule)}`, t]));
    const maxSno = new Map<string, number>();
    const fallbackProjId = defaultProjectId || projects[0]?.id || "";
    for (const t of existing) maxSno.set(t.projectId ?? fallbackProjId, Math.max(maxSno.get(t.projectId ?? fallbackProjId) ?? 0, t.sno));
    for (const r of p.tasks) if (r.sno) { const k = r.project ? projIdx.get(norm(r.project)) ?? "" : fallbackProjId; maxSno.set(k, Math.max(maxSno.get(k) ?? 0, r.sno)); }

    for (const [index, r] of p.tasks.entries()) {
      const pj = r.project ? await projectId(r.project) : (defaultProjectId || projects[0]?.id || null);
      const k = pj ?? "";
      // match: Ref (e.g. SAP-012), then project + S.No, then project + details + module
      let ex = undefined as (typeof existing)[number] | undefined;
      const ref = /^([A-Za-z]+)-0*(\d+)$/.exec(r.ref);
      if (ref) { const refProj = projects.find(x => norm(x.code) === norm(ref[1])); if (refProj) ex = bySno.get(`${refProj.id}|${Number(ref[2])}`); }
      ex ??= r.sno ? bySno.get(`${k}|${r.sno}`) : byTitle.get(`${k}|${norm(r.title)}|${norm(r.subModule)}`);

      const assignees = [];
      for (const n of r.developers) assignees.push(await devId(n));
      const uniq = [...new Set(assignees)];
      const keep = <T,>(v: T | "" | null, old: T | null | undefined) => (v === "" || v == null ? old ?? null : v);
      const data = {
        title: r.title, projectId: pj, subModule: r.subModule, type: r.type, reqStatus: r.reqStatus || "Open", status: r.status as TaskStatus,
        companyId: await companyId(r.company), branch: r.branch, endUsers: r.endUsers || ex?.endUsers || "", testStatus: r.testStatus, acceptStatus: r.acceptStatus,
        priority: keep(r.priority || null, ex?.priority), progress: r.status === "done" ? 100 : keep(r.progress, ex?.progress),
        startDate: keep(toDay(r.start), ex?.startDate), dueDate: keep(toDay(r.due), ex?.dueDate),
        completedDate: toDay(r.completed) ?? (r.status === "done" ? ex?.completedDate ?? null : null),
        estHours: r.estHours ?? (ex?.estHours != null ? Number(ex.estHours) : null),
        version: r.version || ex?.version || "", description: r.description || ex?.description || "", notes: r.notes || ex?.notes || "",
      };

      if (ex) {
        const sno = r.sno ?? (ex.projectId === pj ? ex.sno : (maxSno.get(k) ?? 0) + 1);
        if (sno !== ex.sno) maxSno.set(k, Math.max(maxSno.get(k) ?? 0, sno));
        const before = {
          title: ex.title, projectId: ex.projectId, subModule: ex.subModule, type: ex.type, reqStatus: ex.reqStatus, status: ex.status, companyId: ex.companyId, branch: ex.branch,
          endUsers: ex.endUsers, testStatus: ex.testStatus, acceptStatus: ex.acceptStatus, priority: ex.priority, progress: ex.progress, startDate: ex.startDate, dueDate: ex.dueDate,
          completedDate: ex.completedDate, estHours: ex.estHours != null ? Number(ex.estHours) : null, version: ex.version, description: ex.description, notes: ex.notes,
        };
        const devsChanged = !same(ex.assignees.map(a => a.developerId), uniq);
        if (same(before, data) && sno === ex.sno && !devsChanged) continue; // nothing new in this row
        await tx.task.update({
          where: { id: ex.id },
          data: { ...data, sno, ...(devsChanged ? { assignees: { deleteMany: {}, create: uniq.map((developerId, position) => ({ developerId, position })) } } : {}) },
        });
        if (ex.status !== data.status) await tx.taskEvent.create({ data: { taskId: ex.id, kind: "status", fromStatus: ex.status, toStatus: data.status, message: `From ${p.file}` } });
        result.tasks.update++;
        if (result.taskChanges.length < 500) result.taskChanges.push({ index, kind: "update" });
      } else {
        const sno = r.sno ?? (maxSno.get(k) ?? 0) + 1;
        maxSno.set(k, Math.max(maxSno.get(k) ?? 0, sno));
        const t = await tx.task.create({
          data: { ...data, sno, source: p.file, assignees: { create: uniq.map((developerId, position) => ({ developerId, position })) }, events: { create: { kind: "status", toStatus: data.status, message: `From ${p.file}` } } },
        });
        bySno.set(`${k}|${sno}`, { ...t, assignees: [] } as never);
        result.tasks.create++;
        if (result.taskChanges.length < 500) result.taskChanges.push({ index, kind: "create" });
      }
    }
    const touchedProjects = [...new Set(p.tasks.map(r => r.project ? projIdx.get(norm(r.project)) ?? "" : fallbackProjId))];
    for (const projId of touchedProjects) {
      if (projId) await resequenceProjectTasks(tx, projId);
    }
  }

  // ---------------- Users & access register (records, not app accounts)
  if (p.accessRecords.length) {
    const recs = await tx.accessRecord.findMany({ include: { appAccess: true, licences: { include: { licence: true } } } });
    const recIdx = new Map(recs.map(x => [norm(x.email || x.name), x]));
    for (const u of p.accessRecords) {
      const ex = recIdx.get(norm(u.email || u.name));
      const cid = u.company ? await companyId(u.company) : ex?.companyId ?? null;
      const userType = u.userType || ex?.userType || "Business user";
      const data = { name: u.name, email: u.email, userType, companyId: cid, branch: u.branch || ex?.branch || "", dept: u.dept, designation: u.designation, status: u.status };

      // system access: the sheet is the full list
      const apps = new Map<string, string>();
      for (const [name, role] of Object.entries(u.apps)) apps.set(await projectId(name), role);
      // licences: one per software; the sheet replaces that software's licence, others are kept
      const held = new Map((ex?.licences ?? []).map(l => [norm(l.licence.software), l.licenceId]));
      for (const [sw, type] of Object.entries(u.licences)) {
        let pool = poolIdx.get(poolKey(sw, type, cid)) ?? poolIdx.get(poolKey(sw, type, null)) ?? [...poolIdx.values()].find(x => norm(x.software) === norm(sw) && norm(x.type) === norm(type));
        if (!pool) {
          pool = await tx.licence.create({ data: { software: sw, type, quantity: 0, projectId: projIdx.get(norm(sw)) ?? null, sortOrder: licOrder++ } });
          poolIdx.set(poolKey(sw, type, null), pool);
        }
        if (pool.audience === "endusers" && !isBusinessUser(userType)) { held.delete(norm(sw)); continue; } // business-user licences only for business users
        held.set(norm(sw), pool.id);
        if (pool.projectId && !apps.has(pool.projectId)) apps.set(pool.projectId, "");
      }

      if (ex) {
        const sameFields = same({ name: ex.name, email: ex.email, userType: ex.userType, companyId: ex.companyId, branch: ex.branch, dept: ex.dept, designation: ex.designation, status: ex.status }, data);
        const sameApps = same(ex.appAccess.map(a => `${a.projectId}=${a.role}`).sort(), [...apps].map(([k, v]) => `${k}=${v}`).sort());
        const sameLic = same(ex.licences.map(l => l.licenceId).sort(), [...held.values()].sort());
        if (sameFields && sameApps && sameLic) continue; // nothing new for this person
      }
      const rec = ex ? await tx.accessRecord.update({ where: { id: ex.id }, data }) : await tx.accessRecord.create({ data });
      if (ex) result.accessRecords.update++; else result.accessRecords.create++;
      const oldApps = new Map((ex?.appAccess ?? []).map(a => [a.projectId, a.grantedOn]));
      await tx.appAccess.deleteMany({ where: { recordId: rec.id } });
      await tx.appAccess.createMany({ data: [...apps].map(([projectId, role]) => ({ recordId: rec.id, projectId, role, grantedOn: oldApps.get(projectId) ?? day })) });
      const oldLic = new Map((ex?.licences ?? []).map(l => [l.licenceId, l.assignedOn]));
      await tx.licenceAssignment.deleteMany({ where: { recordId: rec.id } });
      await tx.licenceAssignment.createMany({ data: [...held.values()].map(licenceId => ({ licenceId, recordId: rec.id, assignedOn: oldLic.get(licenceId) ?? day })) });
    }
  }

  await tx.auditEntry.create({
    data: {
      accountId: viewer.id, action: "note", entity: "import", entityId: "",
      label: `Imported ${p.file}: tasks +${result.tasks.create}/~${result.tasks.update}, users & access +${result.accessRecords.create}/~${result.accessRecords.update}, companies ${result.companies}, licences ${result.licences}`.slice(0, 120),
    },
  });
  return result;
}

async function run(raw: ImportPayload, defaultProjectId: string, dryRun: boolean): Promise<ActionResult<ImportPreview>> {
  const viewer = await requireViewer();
  if (!canManage(viewer)) return fail("Only admins can import data.");
  const parsed = importPayload.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(`Row data isn't valid (${i.path.join(" › ")}: ${i.message}).`);
  }
  if (defaultProjectId && !(await db.project.findUnique({ where: { id: defaultProjectId } }))) return fail("Pick a project for rows without a Project column.");
  try {
    const res = await db.$transaction(async tx => {
      const r = await apply(tx, viewer, parsed.data, defaultProjectId || null);
      if (dryRun) throw new Rollback(r);
      return r;
    }, { timeout: 180_000, maxWait: 20_000 });
    revalidatePath("/", "layout");
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof Rollback) return { ok: true, data: e.result };
    throw e;
  }
}

/** What an import would do, without saving anything. */
export async function previewImport(payload: ImportPayload, defaultProjectId: string) {
  return run(payload, defaultProjectId, true);
}

/** Saves everything in one transaction: all rows or none. */
export async function runImport(payload: ImportPayload, defaultProjectId: string) {
  return run(payload, defaultProjectId, false);
}
