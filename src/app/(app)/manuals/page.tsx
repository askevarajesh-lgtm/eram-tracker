import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { getLists } from "@/lib/settings";
import { dayStr } from "@/lib/dates";
import { filesOf } from "@/lib/work";
import { norm } from "@/lib/excel/normalize";
import { ManualsView, type ManualDTO, type CoverageRow } from "./_components/ManualsView";

export const metadata: Metadata = { title: "User manuals" };

type Search = { q?: string; mod?: string; st?: string; lv?: string; edit?: string; new?: string; for?: string };

export default async function ManualsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.ManualWhereInput = {
    projectId: sp.mod || undefined, status: sp.st || undefined, level: sp.lv || undefined,
    OR: q ? ["title", "subModule", "notes", "version"].map(f => ({ [f]: { contains: q, mode: "insensitive" } })) : undefined,
  };
  const [manuals, all, projects, developers, delivered, lists] = await Promise.all([
    db.manual.findMany({ where, orderBy: { title: "asc" } }),
    db.manual.findMany({ select: { id: true, title: true, status: true, projectId: true, subModule: true, level: true } }),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.developer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.task.groupBy({ by: ["projectId", "subModule"], where: { status: "done" }, _count: true }),
    getLists(),
  ]);
  const dto = (m: (typeof manuals)[number]): ManualDTO => ({
    id: m.id, title: m.title, projectId: m.projectId ?? "", subModule: m.subModule, level: m.level || "Developer", status: m.status || "Draft", version: m.version,
    language: m.language, owner: m.owner, updatedOn: dayStr(m.updatedOn), link: m.link, notes: m.notes, files: filesOf(m.files),
  });
  // which delivered modules have a published manual (a manual with no module covers the whole project)
  const coverage: CoverageRow[] = projects.flatMap(p => {
    const rows = delivered.filter(d => d.projectId === p.id);
    if (!rows.length && !all.some(m => m.projectId === p.id)) return [];
    return rows.sort((a, b) => a.subModule.localeCompare(b.subModule)).map(r => {
      const M = all.filter(m => m.projectId === p.id && (!m.subModule || !r.subModule || norm(m.subModule) === norm(r.subModule)));
      const state = M.some(m => m.status === "Published") ? "Covered" : M.length ? "In progress" : "No manual";
      return { projectId: p.id, projectName: p.name, subModule: r.subModule, delivered: r._count, manuals: M.map(m => ({ id: m.id, title: m.title, status: m.status })), state };
    });
  });
  let editing = sp.edit ? manuals.find(m => m.id === sp.edit) : undefined;
  if (sp.edit && !editing) editing = (await db.manual.findUnique({ where: { id: sp.edit } })) ?? undefined;
  return (
    <ManualsView
      manuals={manuals.map(dto)} counts={{ total: all.length, published: all.filter(m => m.status === "Published").length, draft: all.filter(m => m.status === "Draft" || m.status === "In review").length, outdated: all.filter(m => m.status === "Outdated").length }}
      coverage={coverage} projects={projects} developers={developers} modules={lists.funcModules} level={sp.lv ?? ""}
      editing={editing ? dto(editing) : null} openNew={sp.new === "1"} preset={sp.for ?? ""}
      canEdit={canEdit(viewer)} canManage={canManage(viewer)}
    />
  );
}
