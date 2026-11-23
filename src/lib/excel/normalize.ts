// Turning free-form spreadsheet values into tracker values. Carried over from the old app so the
// SAP "Over All Status Report" layout and older exports keep working unchanged.

export const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Column names recognised for each task field (compared after norm()). */
export const ALIAS: Record<string, string[]> = {
  sno: ["sno", "slno", "srno", "serialno", "no", "sr", "s", "serial"],
  title: ["details", "title", "task", "taskname", "feature", "item", "subject", "workitem", "requirement", "description1"],
  project: ["project", "system", "application", "software", "product"],
  subModule: ["module", "submodule", "functionalmodule", "sapmodule"],
  type: ["reqtype", "requirementtype", "type", "category", "itemtype"],
  reqStatus: ["requirementstatus", "reqstatus"],
  developer: ["developername", "developer", "developers", "assignee", "assignedto", "owner", "dev", "resource", "responsible"],
  status: ["developmentstatus", "devstatus", "status", "state", "stage"],
  company: ["company", "entity"],
  branch: ["branch", "division", "branches", "location"],
  endUsers: ["endusers", "enduser", "users", "userteam", "department"],
  testStatus: ["endusertestingstatus", "testingstatus", "eutesting", "uatstatus", "testing", "businessusertestinguat", "businessusertesting"],
  acceptStatus: ["enduseracceptancestatus", "acceptancestatus", "euacceptance", "acceptance", "businessuseracceptance"],
  priority: ["priority", "prio", "severity"],
  progress: ["progress", "progresspercent", "complete", "percentcomplete", "completion"],
  start: ["startdate", "start", "plannedstart"],
  due: ["duedate", "due", "enddate", "targetdate", "deadline"],
  completed: ["completeddate", "completedon", "finishdate", "actualend", "deliverydate"],
  est: ["esthours", "estimatedhours", "hours", "estimate", "effort"],
  version: ["version", "release", "build"],
  description: ["description", "scope"],
  notes: ["notes", "remarks", "comments", "blockers"],
  ref: ["ref", "reference", "key"],
};

export function mapHeaders(headers: string[]) {
  const m: Record<string, string> = {};
  for (const h of headers) {
    const n = norm(h);
    for (const [k, al] of Object.entries(ALIAS)) if (m[k] == null && al.includes(n)) { m[k] = h; break; }
  }
  if (m.title == null) { const c = headers.find(h => /detail|task|feature|title|item/i.test(h)); if (c) m.title = c; }
  return m;
}

/** values that belong in the testing/acceptance columns (used to spot shifted rows) */
export const STATUS_WORDS = new Set(["completed", "pending", "open", "partiallycompleted", "testing", "ongoing", "accepted", "inprogress"]);

export function normStatus(v: unknown): "pending" | "progress" | "qa" | "uat" | "done" | "hold" {
  const s = norm(v);
  if (!s) return "pending";
  if (/(done|complete|closed|deliver|live|deployed|finish|resolved)/.test(s)) return "done";
  if (/(uat|useraccept)/.test(s)) return "uat";
  if (/(qa|test|review)/.test(s)) return "qa";
  if (/(hold|block|stuck|wait|paused|cancel)/.test(s)) return "hold";
  if (/(progress|ongoing|wip|develop|started|active|working)/.test(s)) return "progress";
  return "pending";
}

const pick = (map: Record<string, string>) => (v: unknown) => map[norm(v)] ?? String(v ?? "").trim();
export const normTest = pick({ completed: "Completed", ongoing: "Ongoing", testing: "Ongoing", partiallycompleted: "Partially completed", pending: "Pending", open: "Open", inprogress: "Ongoing" });
export const normAccept = pick({ accepted: "Accepted", open: "Open", pending: "Pending", rejected: "Open" });
export const normReq = pick({ completed: "Completed", pending: "Pending", open: "Open", live: "Live" });
export const normType = (v: unknown) => { const s = String(v ?? "").trim(); return ({ screen: "Screen", report: "Report", process: "Process" } as Record<string, string>)[norm(s)] || s; };

export function normBranch(v: unknown) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^overall$/i.test(s)) return "All Division";
  const fx: Record<string, string> = { mpd: "MPD", smp: "SMP", tss: "TSS", trading: "Trading", floor: "Floor", qatar: "Qatar", alldivision: "All Division" };
  return s.split(/[,&]/).map(p => p.trim()).filter(Boolean).map(p => fx[norm(p)] || p).join(", ");
}

export function normPriority(v: unknown): "Critical" | "High" | "Medium" | "Low" | "" {
  const s = norm(v);
  if (!s) return "";
  if (/crit|urgent|p0|blocker/.test(s)) return "Critical";
  if (/high|p1/.test(s)) return "High";
  if (/low|p3|minor/.test(s)) return "Low";
  return "Medium";
}

const pad = (n: number | string) => String(n).padStart(2, "0");

/** Excel dates (Date objects or serial numbers), ISO and dd/mm/yyyy strings -> YYYY-MM-DD. */
export function normDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    // SheetJS gives local-midnight dates; read the calendar day back in local time
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "number") {
    if (v < 1 || v > 2958465) return "";
    const d = new Date(Math.round((v - 25569) * 864e5)); // Excel serial -> UTC
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function normProgress(v: unknown, status: string): number | null {
  if (status === "done") return 100;
  if (v == null || v === "") return null;
  let n = typeof v === "number" ? v : parseFloat(String(v).replace("%", ""));
  if (isNaN(n)) return null;
  if (n > 0 && n <= 1 && !String(v).includes("%")) n *= 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** "Riyaz & Arun", "Riyaz/Arun", "RIYAZ and ARUN" -> ["Riyaz", "Arun"] */
export const splitDevelopers = (v: unknown) =>
  String(v ?? "")
    .split(/\s*(?:&|\/|,|\band\b|\+)\s*/i)
    .map(s => s.trim())
    .filter(s => s && s !== "(developer name)")
    .map(s => (s === s.toUpperCase() && s.length > 3 ? s[0] + s.slice(1).toLowerCase() : s));

export const USER_TYPES = ["Business user", "Developer", "IT / Admin", "Consultant"];
export function normUserType(v: unknown) {
  const s = String(v ?? "").trim();
  return USER_TYPES.find(t => norm(t) === norm(s)) || (/dev/i.test(s) ? "Developer" : /\bit\b|admin/i.test(s) ? "IT / Admin" : /consult/i.test(s) ? "Consultant" : s ? "Business user" : "");
}
