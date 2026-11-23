import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { DevelopersView } from "./_components/DevelopersView";

export const metadata: Metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const viewer = await requireViewer();
  const devs = await db.developer.findMany({
    orderBy: { name: "asc" },
    include: {
      account: { select: { email: true } },
      tasks: { select: { task: { select: { status: true } } } },
    },
  });
  const rows = devs.map(d => ({
    id: d.id, name: d.name, title: d.title, email: d.email, whatsapp: d.whatsapp, skills: d.skills,
    account: d.account?.email ?? "",
    open: d.tasks.filter(t => t.task.status !== "done").length,
    done: d.tasks.filter(t => t.task.status === "done").length,
  }));
  return <DevelopersView rows={rows} canManage={canManage(viewer)} />;
}
