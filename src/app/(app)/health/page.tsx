import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { getLists } from "@/lib/settings";
import { norm } from "@/lib/excel/normalize";
import { HealthView, type Check } from "./_components/HealthView";

export const metadata: Metadata = { title: "Data health" };

export default async function HealthPage() {
  const viewer = await requireViewer();
  const [tasks, developers, licences, projects, milestones, lists] = await Promise.all([
    db.task.findMany({
      select: { id: true, sno: true, title: true, projectId: true, subModule: true, status: true, dueDate: true, priority: true, progress: true, lead: true, reqStatus: true, estHours: true, size: true, completedDate: true, project: { select: { code: true } }, assignees: { select: { developer: { select: { name: true } } } } },
    }),
    db.developer.findMany({ select: { id: true, name: true, email: true, whatsapp: true } }),
    db.licence.findMany({ select: { id: true, software: true, type: true, renewal: true } }),
    db.project.findMany({ select: { id: true, name: true } }),
    db.milestone.findMany({ select: { projectId: true } }),
    getLists(),
  ]);
  const O = tasks.filter(t => t.status !== "done");
  const dupKey = (t: (typeof tasks)[number]) => `${t.projectId}|${norm(t.subModule)}|${norm(t.title)}`;
  const count = new Map<string, number>();
  tasks.forEach(t => count.set(dupKey(t), (count.get(dupKey(t)) ?? 0) + 1));
  const item = (t: (typeof tasks)[number]) => ({ id: t.id, ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`, subModule: t.subModule, title: t.title, status: t.status, devs: t.assignees.map(a => a.developer.name).join(", ") });
  const tc = (key: string, label: string, list: typeof tasks, field: Check["field"]): Check => ({ key, label, kind: "task", field, items: list.map(item) });

  const checks: Check[] = [
    tc("nodue", "Open items without a due date", O.filter(t => !t.dueDate), "due"),
    tc("noprio", "Open items without a priority", O.filter(t => !t.priority), "priority"),
    tc("noprog", "In progress without a progress %", O.filter(t => ["progress", "qa", "uat"].includes(t.status) && t.progress == null), "progress"),
    tc("nolead", "Shared items without a lead owner", O.filter(t => t.assignees.length > 1 && !t.lead), "lead"),
    tc("noowner", "Open items with no developer", O.filter(t => !t.assignees.length), "assignee"),
    tc("contra", "Requirement completed but development not started", tasks.filter(t => t.reqStatus === "Completed" && t.status === "pending"), "status"),
    tc("nomod", "Items without a module", tasks.filter(t => !t.subModule), "subModule"),
    tc("dup", "Possible duplicates (same project, module and title)", tasks.filter(t => (count.get(dupKey(t)) ?? 0) > 1), null),
    tc("noest", "Open items without an estimate", O.filter(t => t.estHours == null && !t.size), "size"),
    tc("nodate", "Completed items without a completed date", tasks.filter(t => t.status === "done" && !t.completedDate), "completed"),
    { key: "devc", label: "Developers without email or WhatsApp", kind: "other", field: null, items: developers.filter(d => !d.email && !d.whatsapp).map(d => ({ id: d.id, title: d.name, href: "/admin-panel?tab=notify", hint: "add contacts in Admin panel → Notifications" })) },
    { key: "lic", label: "Licences without a renewal date", kind: "other", field: null, items: licences.filter(l => !l.renewal).map(l => ({ id: l.id, title: `${l.software} ${l.type}`, href: `/licences?edit=${l.id}`, hint: "click to edit" })) },
    { key: "proj", label: "Projects without milestones", kind: "other", field: null, items: projects.filter(p => !milestones.some(m => m.projectId === p.id)).map(p => ({ id: p.id, title: p.name, href: "/plan?tab=milestones&new=1", hint: "add in Plan & control → Milestones" })) },
  ];
  return <HealthView checks={checks} developers={developers.map(d => ({ id: d.id, name: d.name }))} modules={lists.funcModules} canManage={canManage(viewer)} />;
}
