import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { dayStr, today } from "@/lib/dates";
import { addDays, averageProgress, progressOf } from "@/lib/work";
import { OPEN_STATUSES } from "@/lib/issues";
import { historyTasks, isNewOn, movedOn, openAtEnd, ACTIVE } from "@/server/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEV_LABEL: Record<string, string> = { pending: "Open", progress: "In-Progress", qa: "Testing", uat: "UAT", done: "Completed", hold: "On Hold" };
type Row = Record<string, string | number>;

function sheet(rows: Row[], header: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  ws["!cols"] = header.map(c => ({ wch: ["Details", "Item", "Notes", "Done", "Plan", "Blockers", "Mitigation"].includes(c) ? 44 : Math.max(10, Math.min(26, c.length + 2)) }));
  return ws;
}
const file = (wb: XLSX.WorkBook, name: string) =>
  new Response(new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
const validDay = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= today() ? v : today());

/** GET /api/reports/day?d=&p=   Eram HCM board day report
 *  GET /api/reports/home?d=     developers' day report
 *  GET /api/reports/week?d=     week ending on d
 *  GET /api/reports/mgmt        management summary for this month */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await getViewer())) return Response.json({ error: "signed_out" }, { status: 401 });
  const { kind } = await params;
  const url = new URL(req.url);
  const D = validDay(url.searchParams.get("d"));
  const wb = XLSX.utils.book_new();
  const projects = await db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  if (kind === "day") {
    const P = url.searchParams.get("p") || "_all";
    const pid = P !== "_all" && projects.some(p => p.id === P) ? P : null;
    const tasks = await historyTasks(pid ? { projectId: pid } : {});
    const isT = D === today();
    const rows = tasks.filter(t => (isT ? t.status !== "done" : openAtEnd(t, D)) || t.doneOn === D || isNewOn(t, D)).map(t => ({
      Date: D, Project: t.project?.name ?? "", Ref: t.ref, Module: t.subModule, Details: t.title, Owner: t.devNames, Status: DEV_LABEL[t.status],
      Today: t.doneOn === D ? "Completed today" : isNewOn(t, D) ? "New today" : movedOn(t, D).length ? "Moved today" : t.dueDate && dayStr(t.dueDate) < D ? "Overdue" : dayStr(t.dueDate) === D ? "Due today" : "Open",
      Priority: t.priority ?? "", "Progress %": progressOf(t), "Due Date": dayStr(t.dueDate), Notes: t.notes,
    }));
    XLSX.utils.book_append_sheet(wb, sheet(rows, ["Date", "Project", "Ref", "Module", "Details", "Owner", "Status", "Today", "Priority", "Progress %", "Due Date", "Notes"]), "Daily Status");
    const note = await db.dailyNote.findFirst({ where: { projectId: pid, date: new Date(D) } });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", D], ["Project", pid ? projects.find(p => p.id === pid)!.name : "All projects"], [], ["Done today", note?.done ?? ""], ["Blockers", note?.blockers ?? ""], ["Next", note?.next ?? ""]]), "Update");
    const pname = pid ? projects.find(p => p.id === pid)!.name.replace(/\s+/g, "_") : "All";
    return file(wb, `${pname}_Status_${D}.xlsx`);
  }

  const [tasks, developers, standups] = await Promise.all([
    historyTasks(),
    db.developer.findMany({ orderBy: { name: "asc" } }),
    db.standup.findMany({ where: { date: { gte: new Date(addDays(D, -6)), lte: new Date(D) } } }),
  ]);
  const su = (dev: string, d: string) => standups.find(s => s.developerId === dev && dayStr(s.date) === d);

  if (kind === "home") {
    XLSX.utils.book_append_sheet(wb, sheet(developers.map(v => {
      const L = tasks.filter(t => t.devIds.includes(v.id)), o = L.filter(t => t.status !== "done"), s = su(v.id, D);
      return {
        Date: D, Developer: v.name, Total: L.length, Active: o.filter(t => ACTIVE.includes(t.status)).length, Open: o.filter(t => t.status === "pending").length,
        "On hold": o.filter(t => t.status === "hold").length, Overdue: o.filter(t => t.dueDate && dayStr(t.dueDate) < D).length, Moved: L.filter(t => movedOn(t, D).length).length,
        Completed: L.filter(t => t.doneOn === D).length, Done: s?.done ?? "", Plan: s?.plan ?? "", Blockers: s?.blockers ?? "", Hours: s?.hours != null ? Number(s.hours) : "",
      };
    }), ["Date", "Developer", "Total", "Active", "Open", "On hold", "Overdue", "Moved", "Completed", "Done", "Plan", "Blockers", "Hours"]), "Developers");
    XLSX.utils.book_append_sheet(wb, sheet(projects.map(p => {
      const L = tasks.filter(t => t.projectId === p.id);
      return { Project: p.name, Items: L.length, Done: L.filter(t => t.status === "done").length, Active: L.filter(t => ACTIVE.includes(t.status)).length, Open: L.filter(t => t.status === "pending").length, Overdue: L.filter(t => t.status !== "done" && t.dueDate && dayStr(t.dueDate) < D).length, "Progress %": averageProgress(L) };
    }), ["Project", "Items", "Done", "Active", "Open", "Overdue", "Progress %"]), "Projects");
    XLSX.utils.book_append_sheet(wb, sheet(tasks.flatMap(t => movedOn(t, D).map(m => ({ Item: t.title, Project: t.project?.name ?? "", Developer: t.devNames, From: m.from ? DEV_LABEL[m.from] ?? m.from : "", To: DEV_LABEL[m.to] ?? m.to }))), ["Item", "Project", "Developer", "From", "To"]), "Activity");
    return file(wb, `Dev360_Daily_${D}.xlsx`);
  }

  if (kind === "week") {
    const W0 = addDays(D, -6);
    const inW = (x: string) => !!x && x >= W0 && x <= D;
    const issues = await db.issue.findMany({ include: { assignees: true } });
    XLSX.utils.book_append_sheet(wb, sheet(developers.map(v => {
      const L = tasks.filter(t => t.devIds.includes(v.id));
      const Iss = issues.filter(x => x.assignees.some(a => a.developerId === v.id));
      const W = Array.from({ length: 7 }, (_, k) => addDays(W0, k));
      return {
        Developer: v.name, "Completed this week": L.filter(t => inW(t.doneOn)).length, "Status changes": L.reduce((a, t) => a + t.moves.filter(m => inW(m.d)).length, 0),
        "Issues resolved": Iss.filter(x => inW(x.resolvedAt?.toISOString().slice(0, 10) ?? "")).length, "Open issues": Iss.filter(x => (OPEN_STATUSES as string[]).includes(x.status)).length,
        "Active now": L.filter(t => ACTIVE.includes(t.status)).length, Open: L.filter(t => t.status === "pending").length, Overdue: L.filter(t => t.status !== "done" && t.dueDate && dayStr(t.dueDate) < D).length,
        "Daily updates": W.filter(x => su(v.id, x)).length + "/7", "Hours logged": W.reduce((a, x) => a + (Number(su(v.id, x)?.hours) || 0), 0),
      };
    }), ["Developer", "Completed this week", "Status changes", "Issues resolved", "Open issues", "Active now", "Open", "Overdue", "Daily updates", "Hours logged"]), "Developers");
    XLSX.utils.book_append_sheet(wb, sheet(projects.map(p => {
      const L = tasks.filter(t => t.projectId === p.id);
      return { Project: p.name, Items: L.length, Done: L.filter(t => t.status === "done").length, "Completed this week": L.filter(t => inW(t.doneOn)).length, Active: L.filter(t => ACTIVE.includes(t.status)).length, Open: L.filter(t => t.status === "pending").length, Overdue: L.filter(t => t.status !== "done" && t.dueDate && dayStr(t.dueDate) < D).length, "Progress %": averageProgress(L) };
    }), ["Project", "Items", "Done", "Completed this week", "Active", "Open", "Overdue", "Progress %"]), "Projects");
    XLSX.utils.book_append_sheet(wb, sheet(tasks.filter(t => inW(t.doneOn)).map(t => ({ Completed: t.doneOn, Project: t.project?.name ?? "", Module: t.subModule, Item: t.title, Developer: t.devNames })), ["Completed", "Project", "Module", "Item", "Developer"]), "Completed");
    return file(wb, `Dev360_Week_${W0}_to_${D}.xlsx`);
  }

  if (kind === "mgmt") {
    const T = today(), M0 = T.slice(0, 7) + "-01";
    const inM = (x: string) => !!x && x >= M0 && x <= T;
    const [milestones, risks, releases, changes, issues] = await Promise.all([
      db.milestone.findMany({ include: { project: true } }),
      db.risk.findMany({ where: { status: { not: "Closed" } }, include: { project: true } }),
      db.release.findMany({ include: { project: true, tasks: { select: { id: true } } } }),
      db.changeRequest.findMany({ include: { project: true } }),
      db.issue.findMany({ select: { status: true, priority: true, createdAt: true, resolvedAt: true } }),
    ]);
    const live = new Set(releases.filter(r => r.status === "Released").flatMap(r => r.tasks.map(t => t.id)));
    const msStatus = (m: (typeof milestones)[number]) => (m.status === "Done" ? "Done" : m.target && dayStr(m.target) < T ? "Missed" : m.status || "Planned");
    XLSX.utils.book_append_sheet(wb, sheet(projects.map(p => {
      const L = tasks.filter(t => t.projectId === p.id), ms = milestones.filter(m => m.projectId === p.id);
      const next = ms.filter(m => msStatus(m) !== "Done").sort((a, b) => (a.target?.getTime() ?? 9e15) - (b.target?.getTime() ?? 9e15))[0];
      return {
        Project: p.name, Items: L.length, Developed: L.filter(t => t.status === "done").length, Tested: L.filter(t => t.testStatus === "Completed" || t.acceptStatus === "Accepted").length,
        Accepted: L.filter(t => t.acceptStatus === "Accepted").length, Live: L.filter(t => t.reqStatus === "Live" || live.has(t.id)).length, "Completed this month": L.filter(t => inM(t.doneOn)).length,
        "In progress": L.filter(t => ACTIVE.includes(t.status)).length, Open: L.filter(t => t.status === "pending").length, Overdue: L.filter(t => t.status !== "done" && t.dueDate && dayStr(t.dueDate) < T).length,
        "Progress %": averageProgress(L), "Next milestone": next?.title ?? "", "Milestones missed": ms.filter(m => msStatus(m) === "Missed").length,
      };
    }), ["Project", "Items", "Developed", "Tested", "Accepted", "Live", "Completed this month", "In progress", "Open", "Overdue", "Progress %", "Next milestone", "Milestones missed"]), "Summary");
    XLSX.utils.book_append_sheet(wb, sheet(milestones.map(m => ({ Project: m.project?.name ?? "", Milestone: m.title, Target: dayStr(m.target), Status: msStatus(m), Done: dayStr(m.doneOn), Owner: m.owner })), ["Project", "Milestone", "Target", "Status", "Done", "Owner"]), "Milestones");
    XLSX.utils.book_append_sheet(wb, sheet(risks.map(r => ({ Type: r.type, Title: r.title, Project: r.project?.name ?? "", Impact: r.impact, Owner: r.owner, Due: dayStr(r.dueDate), Status: r.status, Mitigation: r.mitigation })), ["Type", "Title", "Project", "Impact", "Owner", "Due", "Status", "Mitigation"]), "Open risks");
    XLSX.utils.book_append_sheet(wb, sheet(releases.filter(r => inM(dayStr(r.date))).map(r => ({ Version: r.version, Project: r.project?.name ?? "", Date: dayStr(r.date), Status: r.status, Items: r.tasks.length, Notes: r.notes })), ["Version", "Project", "Date", "Status", "Items", "Notes"]), "Releases this month");
    XLSX.utils.book_append_sheet(wb, sheet(changes.map(c => ({ CR: c.id, Title: c.title, Project: c.project?.name ?? "", "Requested by": c.requestedBy, Status: c.status, Decided: c.decidedAt?.toISOString().slice(0, 10) ?? "" })), ["CR", "Title", "Project", "Requested by", "Status", "Decided"]), "Change requests");
    const open = issues.filter(x => (OPEN_STATUSES as string[]).includes(x.status));
    XLSX.utils.book_append_sheet(wb, sheet([{
      "Raised this month": issues.filter(x => inM(x.createdAt.toISOString().slice(0, 10))).length, "Resolved this month": issues.filter(x => inM(x.resolvedAt?.toISOString().slice(0, 10) ?? "")).length,
      Open: open.length, "Open urgent": open.filter(x => x.priority === "Urgent").length,
    }], ["Raised this month", "Resolved this month", "Open", "Open urgent"]), "Issues");
    return file(wb, `ERAM_HCM_Management_Summary_${T.slice(0, 7)}.xlsx`);
  }

  return Response.json({ error: "unknown_report" }, { status: 404 });
}
