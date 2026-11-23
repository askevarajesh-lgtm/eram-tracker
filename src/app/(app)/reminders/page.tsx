import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, canManage } from "@/lib/permissions";
import { remindersData } from "@/server/reminders-data";
import { RemindersView } from "./_components/RemindersView";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const [{ reminders, auto, developers }, tasks] = await Promise.all([
    remindersData(),
    db.task.findMany({ where: { status: { not: "done" } }, orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }], take: 800, select: { id: true, title: true, project: { select: { name: true } } } }),
  ]);
  return (
    <RemindersView reminders={reminders} auto={auto} developers={developers}
      tasks={tasks.map(t => ({ id: t.id, label: `${t.project?.name ?? ""} · ${t.title}` }))}
      canEdit={canEdit(viewer)} canManage={canManage(viewer)} openId={sp.edit} openNew={sp.new === "1"} />
  );
}
