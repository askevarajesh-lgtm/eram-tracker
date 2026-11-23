"use server";
// Data for the message composer: who can be messaged and the text placeholders ({items}, {overdue}...).
// Messages are sent by the person through WhatsApp or their email app; nothing is sent from the server.
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { getNotifySettings } from "@/lib/settings";
import { averageProgress } from "@/lib/work";
import { fmtDay, today } from "@/lib/dates";
import { audit } from "@/lib/audit";

export type ComposeRecipient = { id: string; name: string; email: string; whatsapp: string; items: string; overdue: string; manager?: boolean };
export type ComposeData = {
  recipients: ComposeRecipient[];
  templates: Awaited<ReturnType<typeof getNotifySettings>>["templates"];
  link: string;
  date: string;
  summary: string;
};

export async function composeData(): Promise<ComposeData> {
  await requireViewer();
  const cfg = await getNotifySettings();
  const now = new Date(today());
  const [devs, projects] = await Promise.all([
    db.developer.findMany({
      orderBy: { name: "asc" },
      include: { tasks: { where: { task: { status: { not: "done" } } }, include: { task: { include: { project: { select: { name: true } } } } } } },
    }),
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { tasks: { select: { status: true, progress: true, dueDate: true } } } }),
  ]);
  const line = (t: { title: string; dueDate: Date | null; project: { name: string } | null }) =>
    `• ${t.title}${t.project ? ` [${t.project.name}]` : ""}${t.dueDate ? ` – due ${t.dueDate.toISOString().slice(0, 10)}` : ""}`;
  const recipients: ComposeRecipient[] = devs.map(d => {
    const open = d.tasks.map(a => a.task);
    const over = open.filter(t => t.dueDate && t.dueDate < now);
    return {
      id: d.id, name: d.name, email: d.email, whatsapp: d.whatsapp,
      items: open.length ? open.slice(0, 12).map(line).join("\n") + (open.length > 12 ? `\n…and ${open.length - 12} more` : "") : "• No open items",
      overdue: over.length ? over.map(line).join("\n") : "• None",
    };
  });
  if (cfg.managerName || cfg.managerEmail || cfg.managerWa) {
    recipients.push({ id: "_mgr", name: cfg.managerName || "Manager", email: cfg.managerEmail, whatsapp: cfg.managerWa, items: "", overdue: "", manager: true });
  }
  const summary = projects
    .filter(p => p.tasks.length)
    .map(p => {
      const L = p.tasks;
      const late = L.filter(t => t.status !== "done" && t.dueDate && t.dueDate < now).length;
      return `${p.name}: ${averageProgress(L)}% · ${L.filter(t => t.status === "done").length} done · ${L.filter(t => ["progress", "qa", "uat"].includes(t.status)).length} in progress · ${L.filter(t => t.status === "pending").length} open${late ? ` · ${late} overdue` : ""}`;
    })
    .join("\n");
  return { recipients, templates: cfg.templates, link: cfg.link, date: fmtDay(today()), summary };
}

/** Notes in the activity log that a message was opened in WhatsApp / email. */
export async function noteMessage(channel: string, who: string, what: string) {
  const viewer = await requireViewer();
  await audit(db, viewer, "note", "message", "", `${channel} message opened for ${who}: ${what}`);
}
