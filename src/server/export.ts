import "server-only";
// Builds the Excel workbook (same sheets and column order as the old app, which follow the SAP
// "Over All Status Report"), or the blank upload template.
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { dayStr } from "@/lib/dates";
import { ACCEPT_STATUSES, REQ_STATUSES, TASK_TYPES, TEST_STATUSES } from "@/lib/constants";
import { AUDIENCES, type Audience } from "@/lib/licensing";
import { licencePools } from "./queries";

const DEV_LABEL: Record<string, string> = { pending: "Open", progress: "In-Progress", qa: "Testing", uat: "UAT", done: "Completed", hold: "On Hold" };
const WEIGHT: Record<string, number> = { pending: 0, progress: 50, qa: 75, uat: 90, hold: 25, done: 100 };
const REPORT = ["S.No", "Module", "Details", "Req.Type", "Requirement Status", "Developer Name", "Development Status", "Company", "Branch", "EndUsers", "EndUser Testing Status", "EndUser Acceptance Status"];
const EXTRA = ["Project", "Ref", "Priority", "Progress %", "Start Date", "Due Date", "Completed Date", "Est Hours", "Version", "Description", "Notes"];
const TASK_HEADER = [...REPORT, ...EXTRA];

type Row = Record<string, string | number>;

function sheet(rows: Row[], header: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  ws["!cols"] = header.map(c => ({ wch: ["Details", "Description", "Notes"].includes(c) ? 48 : c === "S.No" ? 6 : Math.max(10, Math.min(26, c.length + 2)) }));
  if (rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  return ws;
}

const progressOf = (t: { status: string; progress: number | null }) => (t.status === "done" ? 100 : t.progress ?? WEIGHT[t.status] ?? 0);

export async function buildWorkbook(template: boolean): Promise<Buffer> {
  const [projects, tasks, developers, companies, records, pools, manuals] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    template ? [] : db.task.findMany({
      orderBy: [{ project: { sortOrder: "asc" } }, { sno: "asc" }],
      include: { project: true, company: true, assignees: { orderBy: { position: "asc" }, include: { developer: true } } },
    }),
    db.developer.findMany({ orderBy: { name: "asc" }, include: { tasks: { include: { task: { select: { status: true, dueDate: true } } } } } }),
    db.company.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    template ? [] : db.accessRecord.findMany({ orderBy: { name: "asc" }, include: { company: true, appAccess: true, licences: { include: { licence: true } } } }),
    licencePools(),
    template ? [] : db.manual.findMany({ orderBy: { title: "asc" }, include: { project: true } }),
  ]);
  const wb = XLSX.utils.book_new();
  const today = new Date(new Date().toISOString().slice(0, 10));

  // ---- status report and views of it
  const taskRow = (t: (typeof tasks)[number]): Row => ({
    "S.No": t.sno, Module: t.subModule, Details: t.title, "Req.Type": t.type, "Requirement Status": t.reqStatus,
    "Developer Name": t.assignees.map(a => a.developer.name).join(" & "), "Development Status": DEV_LABEL[t.status] ?? "",
    Company: t.company ? t.company.code || t.company.name : "", Branch: t.branch, EndUsers: t.endUsers, "EndUser Testing Status": t.testStatus,
    "EndUser Acceptance Status": t.acceptStatus, Project: t.project?.name ?? "", Ref: `${t.project?.code ?? "GEN"}-${String(t.sno).padStart(3, "0")}`,
    Priority: t.priority ?? "", "Progress %": progressOf(t), "Start Date": dayStr(t.startDate), "Due Date": dayStr(t.dueDate),
    "Completed Date": dayStr(t.completedDate), "Est Hours": t.estHours != null ? Number(t.estHours) : "", Version: t.version, Description: t.description, Notes: t.notes,
  });
  const example: Row[] = [{
    "S.No": 1, Module: "Finance", Details: "PettyCash Payment Report (example row: replace or delete)", "Req.Type": "Report", "Requirement Status": "Completed",
    "Developer Name": "(developer name)", "Development Status": "In-Progress", Company: companies[0]?.code || "ECL", Branch: "MPD, SMP", EndUsers: "Finance Team",
    "EndUser Testing Status": "Open", "EndUser Acceptance Status": "Open", Project: projects[0]?.name ?? "SAP B1",
  }];
  XLSX.utils.book_append_sheet(wb, sheet(template ? example : tasks.map(taskRow), TASK_HEADER), "Status Report");

  if (!template) {
    const summary: Row[] = [];
    const sumRow = (p: string, m: string, G: typeof tasks): Row => ({
      Project: p, Module: m, Total: G.length, Screens: G.filter(i => i.type === "Screen").length, Reports: G.filter(i => i.type === "Report").length,
      Process: G.filter(i => i.type === "Process").length, "Dev Completed": G.filter(i => i.status === "done").length,
      "Dev In-Progress": G.filter(i => ["progress", "qa", "uat"].includes(i.status)).length, "Dev Open": G.filter(i => i.status === "pending" || i.status === "hold").length,
      "EU Testing Completed": G.filter(i => i.testStatus === "Completed").length, "EU Accepted": G.filter(i => i.acceptStatus === "Accepted").length,
      "Progress %": G.length ? Math.round(G.reduce((a, i) => a + progressOf(i), 0) / G.length) : 0,
    });
    for (const p of projects) {
      const L = tasks.filter(t => t.projectId === p.id);
      if (!L.length) continue;
      for (const m of [...new Set(L.map(t => t.subModule))].sort()) summary.push(sumRow(p.name, m || "(no module)", L.filter(t => t.subModule === m)));
      summary.push(sumRow(p.name, "TOTAL", L));
    }
    XLSX.utils.book_append_sheet(wb, sheet(summary, ["Project", "Module", "Total", "Screens", "Reports", "Process", "Dev Completed", "Dev In-Progress", "Dev Open", "EU Testing Completed", "EU Accepted", "Progress %"]), "Module Summary");
    XLSX.utils.book_append_sheet(wb, sheet(tasks.filter(t => t.status !== "done" || t.acceptStatus !== "Accepted").map(taskRow), TASK_HEADER), "Open & Pending");
    XLSX.utils.book_append_sheet(wb, sheet(tasks.filter(t => t.status === "done").map(taskRow), TASK_HEADER), "Delivered Software");
    XLSX.utils.book_append_sheet(wb, sheet(manuals.map(m => ({
      Manual: m.title, Project: m.project?.name ?? "", Module: m.subModule, Level: m.level, Version: m.version, Status: m.status, Language: m.language,
      Owner: m.owner, Updated: dayStr(m.updatedOn), Link: m.link, Files: (Array.isArray(m.files) ? m.files : []).map(f => (f as { name?: string })?.name ?? "").join(", "), Notes: m.notes,
    })), ["Manual", "Project", "Module", "Level", "Version", "Status", "Language", "Owner", "Updated", "Link", "Files", "Notes"]), "User Manuals");
  }

  // ---- developers
  const devRows: Row[] = template
    ? [{ Name: "(developer name)", Role: "SAP B1 Developer", Email: "", Skills: "" }]
    : developers.map(d => {
        const L = d.tasks.map(t => t.task);
        return {
          Name: d.name, Role: d.title, Email: d.email, Skills: d.skills, Total: L.length,
          Ongoing: L.filter(t => ["progress", "qa", "uat", "hold"].includes(t.status)).length, Open: L.filter(t => t.status === "pending").length,
          Completed: L.filter(t => t.status === "done").length, Overdue: L.filter(t => t.status !== "done" && t.dueDate && t.dueDate < today).length,
        };
      });
  XLSX.utils.book_append_sheet(wb, sheet(devRows, ["Name", "Role", "Email", "Skills", ...(template ? [] : ["Total", "Ongoing", "Open", "Completed", "Overdue"])]), "Developers");

  // ---- Users & access register
  const software = [...new Set(pools.map(p => p.software))];
  const poolById = new Map(pools.map(p => [p.id, p]));
  const uHeader = ["Name", "Email", "User Type", "Company", "Branch", "Department", "Designation", "Status", ...projects.map(p => p.name), ...software.map(sw => sw + " Licence")];
  const uRows: Row[] = template
    ? [{
        Name: "(user name)", Email: "", "User Type": "Business user", Company: companies[0]?.name ?? "", Branch: "", Department: "Finance", Designation: "", Status: "Active",
        ...Object.fromEntries(projects.map((p, i) => [p.name, i === 0 ? "Yes" : ""])),
        ...Object.fromEntries(software.map(sw => [sw + " Licence", pools.find(p => p.software === sw)?.type ?? ""])),
      }]
    : records.map(r => ({
        Name: r.name, Email: r.email, "User Type": r.userType, Company: r.company?.name ?? "", Branch: r.branch, Department: r.dept, Designation: r.designation, Status: r.status,
        ...Object.fromEntries(projects.map(p => { const a = r.appAccess.find(x => x.projectId === p.id); return [p.name, a ? a.role || "Yes" : ""]; })),
        ...Object.fromEntries(software.map(sw => [sw + " Licence", r.licences.find(l => l.licence.software === sw)?.licence.type ?? ""])),
      }));
  XLSX.utils.book_append_sheet(wb, sheet(uRows, uHeader), "Application Users");

  // ---- companies
  const maxB = Math.max(4, ...companies.map(c => c.branches.length));
  const cHeader = ["Country", "Company", "Code", ...Array.from({ length: maxB }, (_, i) => "Branch-" + (i + 1))];
  const cRows: Row[] = template
    ? [{ Country: "KSA", Company: "(company name)", Code: "", "Branch-1": "MPD" }]
    : companies.map(c => ({ Country: c.country, Company: c.name, Code: c.code, ...Object.fromEntries(c.branches.map((b, i) => ["Branch-" + (i + 1), b])) }));
  XLSX.utils.book_append_sheet(wb, sheet(cRows, cHeader), "Companies");

  // ---- licences
  const lHeader = ["Software", "Licence Type", "For", "Company", "Purchased", "Assigned", "Available", "Model", "Renewal Date", "Vendor", "Annual Cost", "Currency", "Contract Ref", "Notes"];
  const lRows: Row[] = template
    ? [{ Software: "SAP B1", "Licence Type": "Professional", Company: "", Purchased: 10, Model: "Perpetual", Currency: "SAR" }]
    : pools.map(p => ({
        Software: p.software, "Licence Type": p.type, For: AUDIENCES[p.audience as Audience] ?? "", Company: p.companyName, Purchased: p.quantity, Assigned: p.assigned,
        Available: p.quantity - p.assigned, Model: p.model, "Renewal Date": p.renewal, Vendor: p.vendor, "Annual Cost": p.cost === "" ? "" : Number(p.cost),
        Currency: p.currency, "Contract Ref": p.contract, Notes: p.notes,
      }));
  XLSX.utils.book_append_sheet(wb, sheet(lRows, lHeader), "Licences");

  if (!template) {
    const asg: Row[] = records.flatMap(r => r.licences.map(l => ({
      User: r.name, Email: r.email, Company: r.company?.name ?? "", Branch: r.branch, Status: r.status, Software: l.licence.software,
      "Licence Type": poolById.get(l.licenceId)?.type ?? l.licence.type, "Assigned On": dayStr(l.assignedOn),
    })));
    XLSX.utils.book_append_sheet(wb, sheet(asg, ["User", "Email", "Company", "Branch", "Status", "Software", "Licence Type", "Assigned On"]), "Licence Assignments");
  } else {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Allowed values"],
      ["Development Status", "Open", "In-Progress", "Testing", "UAT", "Completed", "On Hold"],
      ["Requirement Status", ...REQ_STATUSES],
      ["EndUser Testing Status", ...TEST_STATUSES],
      ["EndUser Acceptance Status", ...ACCEPT_STATUSES],
      ["Req.Type", ...TASK_TYPES],
      ["Project", ...projects.map(p => p.name)],
      [],
      ["Several developers: write them as 'Riyaz & Arun'. Dates as YYYY-MM-DD or Excel dates."],
      ["Re-uploading the same report updates rows by Project + S.No instead of adding copies."],
      ["Application Users sheet (a register of business users, not tracker logins): Yes or a role name under each system gives access; blank removes it. '<Software> Licence' columns take a licence type such as Professional."],
      ["Companies sheet: Country, Company, Code, Branch-1, Branch-2…  Licences sheet: Software, Licence Type, Company (blank = group-wide), Purchased, Renewal Date…"],
    ]), "Help");
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}
