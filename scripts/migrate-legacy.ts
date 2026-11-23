/**
 * Copies data from the old Dev 360 app (JSON documents in d360_docs) into the new relational tables.
 *
 * Source (pick one):
 *   LEGACY_DATABASE_URL=postgres://...   the old Postgres / Neon database (tables d360_docs, d360_users, d360_blobs)
 *   --sqlite path/to/dev360.db            the old app's local SQLite file
 *   --json path/to/backup.json            an "Admin panel -> JSON backup" export (no accounts or files)
 * Target: DATABASE_URL (the new schema, after `prisma migrate deploy`).
 *
 *   npm run migrate:legacy -- --sqlite legacy-data/dev360.db
 *   npm run migrate:legacy -- --dry-run          (reads and transforms, writes nothing)
 *   npm run migrate:legacy -- --force            (empties the new tables first)
 *
 * The old tables are only read, never changed. Old ids are kept, so links between records stay valid.
 * Fields with no column in the new schema are kept in each row's `extra` JSON column.
 */
import fs from "node:fs";
import { Prisma, PrismaClient, type Role, type TaskStatus, type Priority, type ApprovalState } from "@prisma/client";

type Doc = Record<string, any> & { id: string };
type Legacy = {
  docs: Map<string, Doc[]>;
  users: { id: string; email: string; name: string; pass: string; isOwner: boolean; active: boolean; createdAt: Date }[];
  blobs: { id: string; name: string; contentType: string; size: number; data: Buffer; uploadedBy: string | null; createdAt: Date }[];
};

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag("--dry-run");
const FORCE = flag("--force");

// ------------------------------------------------------------------ read the old data

function group(rows: { col: string; id: string; data: any }[]) {
  const docs = new Map<string, Doc[]>();
  for (const r of rows) {
    const data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
    if (!data) continue;
    if (!docs.has(r.col)) docs.set(r.col, []);
    docs.get(r.col)!.push({ ...data, id: String(r.id) });
  }
  return docs;
}

async function readPostgres(url: string): Promise<Legacy> {
  const { Client } = await import("pg");
  const local = /@(localhost|127\.0\.0\.1|db|postgres)[:/]/.test(url) || /sslmode=disable/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    const docs = await c.query("SELECT col,id,data FROM d360_docs WHERE NOT deleted");
    const users = await c.query("SELECT * FROM d360_users");
    const blobs = await c.query("SELECT * FROM d360_blobs").catch(() => ({ rows: [] as any[] }));
    return {
      docs: group(docs.rows),
      users: users.rows.map((r: any) => ({ id: r.id, email: r.email, name: r.name, pass: r.pass, isOwner: r.is_owner, active: r.active, createdAt: new Date(r.created_at) })),
      blobs: blobs.rows.map((r: any) => ({ id: r.id, name: r.name || "file", contentType: r.content_type || "application/octet-stream", size: r.size || 0, data: r.data, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at) })),
    };
  } finally {
    await c.end();
  }
}

async function readSqlite(file: string): Promise<Legacy> {
  const Database = (await import("better-sqlite3")).default;
  const d = new Database(file, { readonly: true });
  const has = (t: string) => !!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
  return {
    docs: group(d.prepare("SELECT col,id,data FROM docs WHERE deleted=0").all() as any[]),
    users: (has("users") ? d.prepare("SELECT * FROM users").all() : []).map((r: any) => ({ id: r.id, email: r.email, name: r.name, pass: r.pass, isOwner: !!r.is_owner, active: r.active == null ? true : !!r.active, createdAt: new Date(r.created_at || Date.now()) })),
    blobs: (has("blobs") ? d.prepare("SELECT * FROM blobs").all() : []).map((r: any) => ({ id: r.id, name: r.name || "file", contentType: r.content_type || "application/octet-stream", size: r.size || 0, data: r.data, uploadedBy: r.uploaded_by, createdAt: new Date(r.created_at || Date.now()) })),
  };
}

function readJson(file: string): Legacy {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows: { col: string; id: string; data: any }[] = [];
  for (const [col, list] of Object.entries(j)) if (Array.isArray(list)) for (const r of list as any[]) if (r && r.id != null) { const { id, ...data } = r; rows.push({ col, id: String(id), data }); }
  return { docs: group(rows), users: [], blobs: [] };
}

// ------------------------------------------------------------------ value helpers

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const strOrNull = (v: unknown) => str(v) || null;
const int = (v: unknown): number | null => { if (v === "" || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };
const dec = (v: unknown): number | null => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
/** "2026-10-31" (or any parseable date) -> Date at UTC midnight; anything else -> null */
function day(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function ts(v: unknown): Date | null { const s = str(v); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
/** fields of `doc` that aren't in `known` (kept in the `extra` column) */
function extraOf(doc: Doc, known: string[]): Prisma.InputJsonValue {
  const skip = new Set([...known, "id", "updatedAt"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) if (!skip.has(k) && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) out[k] = v;
  return out as Prisma.InputJsonValue;
}
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? str(v).split(",").map(s => s.trim()).filter(Boolean) : []);
const devsOf = (x: Doc): string[] => [...new Set(Array.isArray(x.assignees) && x.assignees.length ? x.assignees.map(str) : x.assignee ? [str(x.assignee)] : [])].filter(Boolean);

const STATUSES: TaskStatus[] = ["pending", "progress", "qa", "uat", "done", "hold"];
const PRIOS: Priority[] = ["Critical", "High", "Medium", "Low"];
const APPROVALS: ApprovalState[] = ["pending", "approved", "rejected"];

// ------------------------------------------------------------------ main

async function main() {
  const sqlite = opt("--sqlite"), json = opt("--json"), url = process.env.LEGACY_DATABASE_URL;
  const source = sqlite ? `SQLite ${sqlite}` : json ? `JSON ${json}` : url ? "LEGACY_DATABASE_URL" : null;
  if (!source) throw new Error("Give a source: LEGACY_DATABASE_URL=..., --sqlite <file> or --json <file>");
  console.log(`Reading old data from ${source}...`);
  const L = sqlite ? await readSqlite(sqlite) : json ? readJson(json) : await readPostgres(url!);
  const col = (name: string) => L.docs.get(name) ?? [];
  console.log("  found:", [...L.docs.entries()].map(([k, v]) => `${k} ${v.length}`).join(", "), `| accounts ${L.users.length} | files ${L.blobs.length}`);

  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);

  // ---------- reference tables first, with lookups used by everything after
  const projects = col("modules").map((m, i) => ({
    id: m.id, name: str(m.name) || "Untitled project", code: str(m.code) || str(m.name).slice(0, 3).toUpperCase(),
    fullName: str(m.full), phase: str(m.phase), target: str(m.target), lead: str(m.lead), sortOrder: int(m.order) ?? i,
  }));
  const projectIds = new Set(projects.map(p => p.id));
  const projectOf = (v: unknown, where: string): string | null => {
    const s = str(v);
    if (!s) return null;
    if (projectIds.has(s)) return s;
    const hit = projects.find(p => p.name.toLowerCase() === s.toLowerCase() || p.code.toLowerCase() === s.toLowerCase());
    if (hit) return hit.id;
    warn(`${where}: project "${s}" not found, left empty`);
    return null;
  };

  const developers = col("developers").map(d => ({
    id: d.id, name: str(d.name) || "Unnamed", title: str(d.role), email: str(d.email), whatsapp: str(d.whatsapp),
    skills: str(d.skills), availability: str(d.avail), extra: extraOf(d, ["name", "role", "email", "whatsapp", "skills", "avail"]),
  }));
  const devIds = new Set(developers.map(d => d.id));
  const validDevs = (ids: string[], where: string) => ids.filter(id => devIds.has(id) || (warn(`${where}: developer ${id} not found, dropped`), false));

  const companies = col("companies").map((c, i) => ({
    id: c.id, name: str(c.name) || "Unnamed company", code: str(c.code), country: str(c.country), sapDb: str(c.sapDb),
    branches: asList(c.branches), notes: str(c.notes), holding: !!c.holding, parentId: strOrNull(c.parent), sortOrder: int(c.order) ?? i,
    extra: extraOf(c, ["name", "code", "country", "sapDb", "branches", "notes", "holding", "parent", "order"]),
  }));
  // tasks and issues refer to companies by id, code or name; unknown names become new companies
  const companyOf = (v: unknown): string | null => {
    const s = str(v);
    if (!s) return null;
    const lc = s.toLowerCase();
    const hit = companies.find(c => c.id === s) ?? companies.find(c => c.code && c.code.toLowerCase() === lc) ?? companies.find(c => c.name.toLowerCase() === lc);
    if (hit) return hit.id;
    const id = "co-" + lc.replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    companies.push({ id, name: s, code: /^[A-Z0-9]{2,6}$/.test(s) ? s : "", country: "", sapDb: "", branches: [], notes: "Created during migration from a task/issue company value", holding: false, parentId: null, sortOrder: companies.length, extra: {} });
    warn(`company "${s}" was not in the companies list, created it`);
    return id;
  };

  // ---------- accounts (members hold their role and developer link)
  const members = new Map(col("members").map(m => [m.id, m]));
  const accounts = L.users.map(u => {
    const m = members.get(u.id);
    const devId = m && devIds.has(str(m.devId)) ? str(m.devId) : null;
    return {
      id: u.id, email: u.email.toLowerCase(), name: u.name, passwordHash: u.pass, isOwner: u.isOwner, active: u.active,
      // the old app ran in POC mode (every account acted as Admin), so accounts arrive as Admin
      role: "Admin" as Role, developerId: devId, createdAt: u.createdAt,
    };
  });
  // a developer can belong to one account only
  const seenDev = new Set<string>();
  for (const a of accounts) if (a.developerId) { if (seenDev.has(a.developerId)) { warn(`account ${a.email}: developer already linked to another account, link dropped`); a.developerId = null; } else seenDev.add(a.developerId); }
  const accountIds = new Set(accounts.map(a => a.id));
  const accountOrNull = (v: unknown) => (accountIds.has(str(v)) ? str(v) : null);

  // ---------- tasks
  const TASK_KNOWN = ["sno", "title", "module", "subModule", "type", "reqStatus", "status", "assignee", "assignees", "company", "branch", "endUsers", "priority", "testStatus", "acceptStatus", "progress", "start", "due", "completed", "estHours", "size", "version", "lead", "description", "notes", "source", "createdAt", "approval", "signoff", "log", "share", "uatReject", "autoSno", "files", "time"];
  const taskAssignees: { taskId: string; developerId: string; position: number }[] = [];
  const taskEvents: Prisma.TaskEventCreateManyInput[] = [];
  const timeEntries: Prisma.TimeEntryCreateManyInput[] = [];
  const maxSno = new Map<string, number>();
  const items = col("items");
  const tasks = items.map(i => {
    const projectId = projectOf(i.module, `task ${i.id}`);
    const status = STATUSES.includes(i.status) ? (i.status as TaskStatus) : "pending";
    if (i.status && !STATUSES.includes(i.status)) warn(`task ${i.id}: unknown status "${i.status}", set to pending`);
    const priority = PRIOS.includes(i.priority) ? (i.priority as Priority) : null;
    const ap = i.approval && typeof i.approval === "object" ? i.approval : null;
    validDevs(devsOf(i), `task ${i.id}`).forEach((d, k) => taskAssignees.push({ taskId: i.id, developerId: d, position: k }));
    for (const e of Array.isArray(i.log) ? i.log : []) taskEvents.push({ taskId: i.id, at: ts(e.t) ?? day(e.d) ?? new Date(), kind: "status", fromStatus: strOrNull(e.from), toStatus: strOrNull(e.to), message: str(e.m) });
    for (const e of Array.isArray(i.share) ? i.share : []) taskEvents.push({ taskId: i.id, at: ts(e.t) ?? day(e.d) ?? new Date(), kind: "share", message: str(e.note), data: e });
    for (const e of Array.isArray(i.time) ? i.time : []) {
      const d = day(e?.d), h = dec(e?.h);
      if (d && h != null) timeEntries.push({ taskId: i.id, developerId: devIds.has(str(e.dev)) ? str(e.dev) : null, date: d, hours: h, note: str(e.n) });
    }
    for (const e of Array.isArray(i.uatReject) ? i.uatReject : []) taskEvents.push({ taskId: i.id, at: day(e.d) ?? new Date(), kind: "uat_reject", message: str(e.note), data: e });
    const sno = int(i.sno);
    const key = projectId ?? "";
    if (sno && sno > 0) maxSno.set(key, Math.max(maxSno.get(key) ?? 0, sno));
    return {
      id: i.id, projectId, sno: sno && sno > 0 ? sno : 0, title: str(i.title) || "Untitled task",
      subModule: str(i.subModule), type: str(i.type), reqStatus: str(i.reqStatus) || "Open", status, priority,
      companyId: companyOf(i.company), branch: str(i.branch), endUsers: str(i.endUsers), testStatus: str(i.testStatus), acceptStatus: str(i.acceptStatus),
      progress: int(i.progress), startDate: day(i.start), dueDate: day(i.due), completedDate: day(i.completed), estHours: dec(i.estHours),
      size: str(i.size), version: str(i.version), lead: str(i.lead), description: str(i.description), notes: str(i.notes), source: str(i.source),
      approvalState: ap && APPROVALS.includes(ap.state) ? (ap.state as ApprovalState) : null,
      approvalBy: ap ? strOrNull(ap.byName ?? ap.by) : null, approvalAt: ap ? ts(ap.at) : null, approvalNote: ap ? strOrNull(ap.note) : null,
      signoff: i.signoff && typeof i.signoff === "object" ? i.signoff : Prisma.DbNull,
      files: Array.isArray(i.files) ? i.files : [],
      extra: extraOf(i, TASK_KNOWN), createdAt: ts(i.createdAt) ?? new Date(),
    };
  });
  // tasks without a serial number get the next one in their project
  for (const t of tasks) if (!t.sno) { const k = t.projectId ?? ""; const n = (maxSno.get(k) ?? 0) + 1; maxSno.set(k, n); t.sno = n; }
  const taskIds = new Set(tasks.map(t => t.id));
  const taskOrNull = (v: unknown) => (taskIds.has(str(v)) ? str(v) : null);

  // ---------- issues
  const issueAssignees: { issueId: string; developerId: string; position: number }[] = [];
  const issueEvents: Prisma.IssueEventCreateManyInput[] = [];
  const linkedTasks = new Set<string>();
  const issues = col("issues").map(x => {
    validDevs(devsOf(x), `issue ${x.id}`).forEach((d, k) => issueAssignees.push({ issueId: x.id, developerId: d, position: k }));
    for (const e of Array.isArray(x.log) ? x.log : []) issueEvents.push({ issueId: x.id, at: ts(e.t) ?? new Date(), message: str(e.m) });
    const ap = x.approval && typeof x.approval === "object" ? x.approval : null;
    let taskId = taskOrNull(x.taskId);
    if (taskId && linkedTasks.has(taskId)) taskId = null; else if (taskId) linkedTasks.add(taskId);
    return {
      id: x.id, title: str(x.title) || "Untitled issue", description: str(x.desc), projectId: projectOf(x.module, `issue ${x.id}`), companyId: companyOf(x.company),
      priority: str(x.priority) || "Normal", status: str(x.status) || "new", raisedBy: str(x.raisedBy), contact: str(x.contact), raisedById: accountOrNull(x.raisedById),
      resolution: str(x.resolution), resolvedAt: ts(x.resolvedAt), taskId, files: Array.isArray(x.files) ? x.files : [],
      approvalState: ap && APPROVALS.includes(ap.state) ? (ap.state as ApprovalState) : null, approvalBy: ap ? strOrNull(ap.byName ?? ap.by) : null, approvalAt: ap ? ts(ap.at) : null, approvalNote: ap ? strOrNull(ap.note) : null,
      extra: extraOf(x, ["title", "desc", "module", "company", "priority", "status", "raisedBy", "contact", "raisedById", "resolution", "resolvedAt", "taskId", "approval", "assignee", "assignees", "log", "createdAt", "files"]),
      createdAt: ts(x.createdAt) ?? new Date(),
    };
  });

  // ---------- licences & "Users & access" records (licence/access register, not app users)
  const licences = col("licenses").map((l, i) => ({
    id: l.id, software: str(l.software) || "Software", type: str(l.type), quantity: int(l.qty) ?? 0, companyId: companyOf(l.company), projectId: projectOf(l.module, `licence ${l.id}`),
    audience: ["endusers", "dev", "all"].includes(str(l.audience)) ? str(l.audience) : "all" /* blank counted everyone in the old app */, model: str(l.model), renewal: day(l.renewal), vendor: str(l.vendor), cost: dec(l.cost), currency: str(l.currency), contract: str(l.contract), notes: str(l.notes), sortOrder: int(l.order) ?? i,
  }));
  const licenceIds = new Set(licences.map(l => l.id));
  const licenceAssignments: { licenceId: string; recordId: string; assignedOn: Date | null }[] = [];
  const appAccess: { recordId: string; projectId: string; role: string; grantedOn: Date | null }[] = [];
  const accessRecords = col("users").map(u => {
    // old shape: apps = { [projectId]: { role, on } } (older exports: an array of project ids)
    const apps: [string, any][] = Array.isArray(u.apps) ? u.apps.map((id: any) => [str(id), {}]) : Object.entries(u.apps && typeof u.apps === "object" ? u.apps : {});
    for (const [pid, a] of apps) {
      if (projectIds.has(pid)) appAccess.push({ recordId: u.id, projectId: pid, role: str(a?.role), grantedOn: day(a?.on) });
      else warn(`access record ${u.id}: system ${pid} not found, access dropped`);
    }
    for (const [lid, v] of Object.entries(u.lic && typeof u.lic === "object" ? u.lic : {})) {
      if (licenceIds.has(lid)) licenceAssignments.push({ licenceId: lid, recordId: u.id, assignedOn: day((v as any)?.on) });
      else warn(`access record ${u.id}: licence pool ${lid} not found, assignment dropped`);
    }
    return {
      id: u.id, name: str(u.name) || "Unnamed", email: str(u.email), sapCode: str(u.sapCode), companyId: companyOf(u.company), branch: str(u.branch), dept: str(u.dept),
      designation: str(u.designation), status: str(u.status) || "Active", userType: str(u.utype) || "Business user",
      extra: extraOf(u, ["name", "email", "sapCode", "company", "branch", "dept", "designation", "status", "utype", "apps", "lic"]),
    };
  });

  // ---------- rollout, daily notes, standups
  const rollouts = col("rollout").flatMap(r => {
    const companyId = companyOf(r.company), projectId = projectOf(r.module, `rollout ${r.id}`);
    if (!companyId || !projectId) { warn(`rollout ${r.id}: missing company or project, skipped`); return []; }
    return [{ id: r.id, companyId, projectId, status: str(r.status), progress: int(r.progress), startDate: day(r.start), targetDate: day(r.target), actualDate: day(r.actual), owner: str(r.owner), branches: str(r.branches), notes: str(r.notes), log: Array.isArray(r.log) ? r.log : [] }];
  });
  const dailyNotes = col("daily").flatMap(d => {
    const date = day(d.date);
    if (!date) { warn(`daily note ${d.id}: no date, skipped`); return []; }
    return [{ id: d.id, projectId: projectOf(d.proj, `daily note ${d.id}`), date, done: str(d.done), blockers: str(d.blockers), next: str(d.next) }];
  });
  const standupKeys = new Set<string>();
  const standups = col("standup").flatMap(s => {
    const date = day(s.date), developerId = str(s.dev);
    if (!date || !devIds.has(developerId)) { warn(`standup ${s.id}: missing date or developer, skipped`); return []; }
    const k = developerId + date.toISOString();
    if (standupKeys.has(k)) return [];
    standupKeys.add(k);
    return [{ id: s.id, developerId, date, done: str(s.done), plan: str(s.plan), blockers: str(s.blockers), hours: dec(s.hours) }];
  });

  // ---------- calendar & reminders
  const meetingDevs: { meetingId: string; developerId: string }[] = [];
  const meetings = col("meetings").flatMap(m => {
    const date = day(m.date);
    if (!date) { warn(`meeting ${m.id}: no date, skipped`); return []; }
    validDevs(asList(m.devIds), `meeting ${m.id}`).forEach(d => meetingDevs.push({ meetingId: m.id, developerId: d }));
    return [{
      id: m.id, title: str(m.title) || "Meeting", type: str(m.type), status: str(m.status) || "Planned", date, startTime: str(m.start), endTime: str(m.end), mode: str(m.mode), location: str(m.location),
      projectId: projectOf(m.module, `meeting ${m.id}`), companyId: companyOf(m.company), organizer: str(m.organizer), remindMinutes: int(m.remind), guests: str(m.guests), agenda: str(m.agenda), minutes: str(m.minutes),
      inviteeRecordIds: asList(m.userIds), createdById: accountOrNull(m.createdBy),
      extra: extraOf(m, ["title", "type", "status", "date", "start", "end", "mode", "location", "module", "company", "organizer", "remind", "guests", "agenda", "minutes", "devIds", "userIds", "createdBy"]),
    }];
  });
  const reminderDevs: { reminderId: string; developerId: string }[] = [];
  const reminders = col("reminders").flatMap(r => {
    const date = day(r.date);
    if (!date) { warn(`reminder ${r.id}: no date, skipped`); return []; }
    validDevs(asList(r.devIds), `reminder ${r.id}`).forEach(d => reminderDevs.push({ reminderId: r.id, developerId: d }));
    return [{ id: r.id, title: str(r.title) || "Reminder", date, time: str(r.time), repeat: str(r.repeat), template: str(r.tpl), note: str(r.note), done: !!r.done, doneOn: day(r.doneOn), taskId: taskOrNull(r.itemId), createdById: accountOrNull(r.createdBy) }];
  });

  // ---------- plan & control
  const milestones = col("milestones").map(m => ({ id: m.id, title: str(m.title) || "Milestone", projectId: projectOf(m.module, `milestone ${m.id}`), target: day(m.target), status: str(m.status) || "Planned", doneOn: day(m.done), owner: str(m.owner), note: str(m.note) }));
  const changes = col("changes").map(c => {
    let taskId = taskOrNull(c.taskId);
    if (taskId && linkedTasks.has(taskId)) taskId = null; else if (taskId) linkedTasks.add(taskId);
    return {
      id: c.id, title: str(c.title) || "Change request", description: str(c.desc), projectId: projectOf(c.module, `change ${c.id}`), subModule: str(c.subModule), requestedBy: str(c.requestedBy),
      companyId: companyOf(c.company), priority: str(c.priority), effort: str(c.effort), status: str(c.status) || "Submitted", decisionBy: strOrNull(c.decisionBy), decisionNote: strOrNull(c.decisionNote),
      decidedAt: ts(c.decidedAt), taskId, approvalState: c.approval && APPROVALS.includes(c.approval.state) ? (c.approval.state as ApprovalState) : null,
      extra: extraOf(c, ["title", "desc", "module", "subModule", "requestedBy", "company", "priority", "effort", "status", "decisionBy", "decisionNote", "decidedAt", "taskId", "approval", "createdAt"]),
      createdAt: ts(c.createdAt) ?? new Date(),
    };
  });
  const releases = col("releases").map(r => ({ id: r.id, version: str(r.version) || "untitled", projectId: projectOf(r.module, `release ${r.id}`), date: day(r.date), status: str(r.status), notes: str(r.notes), taskIds: asList(r.itemIds).filter(id => taskIds.has(id)) }));
  const risks = col("risks").map(r => ({ id: r.id, type: str(r.type) || "Risk", status: str(r.status) || "Open", title: str(r.title) || "Risk", projectId: projectOf(r.module, `risk ${r.id}`), companyId: companyOf(r.company), impact: str(r.impact), likelihood: str(r.likelihood), owner: str(r.owner), dueDate: day(r.due), mitigation: str(r.mitigation) }));
  const manuals = col("manuals").map(m => ({
    id: m.id, title: str(m.title) || "Manual", projectId: projectOf(m.module, `manual ${m.id}`), subModule: str(m.subModule), level: str(m.level), status: str(m.status) || "Draft", version: str(m.version),
    language: str(m.language), owner: str(m.owner), updatedOn: day(m.updated), link: str(m.link), notes: str(m.notes), files: Array.isArray(m.files) ? m.files : [],
    extra: extraOf(m, ["title", "module", "subModule", "level", "status", "version", "language", "owner", "updated", "link", "notes", "files", "createdAt"]), createdAt: ts(m.createdAt) ?? new Date(),
  }));

  // ---------- chat, settings, audit, files
  const chat = col("chat").map(c => ({ id: c.id, channel: str(c.ch) || "general", text: str(c.text), accountId: accountOrNull(c.uid), developerId: devIds.has(str(c.dev)) ? str(c.dev) : null, createdAt: ts(c.t) ?? new Date() }));
  const settings = col("settings").map(s => { const { id, updatedAt, ...value } = s; return { key: id, value: value as Prisma.InputJsonValue }; });
  const audit = col("audit").flatMap(a => (Array.isArray(a.e) ? a.e : []).map((e: any) => ({ at: ts(e.t) ?? day(a.date) ?? new Date(), accountId: accountOrNull(a.user), action: str(e.a) || "update", entity: str(e.c), entityId: str(e.id), label: str(e.l) })));
  const assets = L.blobs.map(b => ({ id: b.id, name: b.name, contentType: b.contentType, size: b.size || b.data?.length || 0, data: Buffer.from(b.data ?? []), uploadedById: accountOrNull(b.uploadedBy), createdAt: b.createdAt }));
  // company parents must exist
  const companyIds = new Set(companies.map(c => c.id));
  for (const c of companies) if (c.parentId && !companyIds.has(c.parentId)) { warn(`company ${c.name}: parent ${c.parentId} not found, cleared`); c.parentId = null; }

  const plan: [string, number][] = [
    ["projects", projects.length], ["companies", companies.length], ["developers", developers.length], ["accounts", accounts.length],
    ["tasks", tasks.length], ["task assignees", taskAssignees.length], ["task events", taskEvents.length], ["time entries", timeEntries.length], ["issues", issues.length],
    ["licences", licences.length], ["access records", accessRecords.length], ["licence assignments", licenceAssignments.length], ["app access", appAccess.length],
    ["rollouts", rollouts.length], ["daily notes", dailyNotes.length], ["standups", standups.length], ["meetings", meetings.length],
    ["reminders", reminders.length], ["milestones", milestones.length], ["change requests", changes.length], ["releases", releases.length],
    ["risks", risks.length], ["manuals", manuals.length], ["chat messages", chat.length], ["settings", settings.length], ["audit entries", audit.length], ["files", assets.length],
  ];
  console.log("\nWill write:");
  for (const [k, n] of plan) if (n) console.log(`  ${k.padEnd(20)} ${n}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    const counts = new Map<string, number>();
    for (const w of warnings) counts.set(w, (counts.get(w) ?? 0) + 1);
    [...counts].slice(0, 40).forEach(([w, n]) => console.log(`  - ${w}${n > 1 ? `  (x${n})` : ""}`));
    if (counts.size > 40) console.log(`  ... and ${counts.size - 40} more`);
  }
  if (DRY) { console.log("\n--dry-run: nothing written."); return; }

  // ------------------------------------------------------------------ write
  const db = new PrismaClient();
  try {
    const existing = (await db.project.count()) + (await db.task.count()) + (await db.account.count());
    if (existing && !FORCE) throw new Error("The new database already has data. Re-run with --force to empty it and migrate again.");
    const chunk = async <T,>(rows: T[], fn: (part: T[]) => Promise<unknown>) => { for (let i = 0; i < rows.length; i += 500) await fn(rows.slice(i, i + 500)); };
    await db.$transaction(async tx => {
      if (FORCE) {
        // children first
        for (const t of ["auditEntry", "chatMessage", "asset", "setting", "manual", "risk", "release", "changeRequest", "milestone", "reminderDeveloper", "reminder", "meetingDeveloper", "meeting", "standup", "dailyNote", "rollout", "licenceAssignment", "appAccess", "accessRecord", "licence", "issueEvent", "issueAssignee", "issue", "timeEntry", "taskEvent", "taskAssignee", "task", "account", "developer", "company", "project"] as const)
          await (tx as any)[t].deleteMany();
      }
      await tx.project.createMany({ data: projects });
      await tx.company.createMany({ data: companies.map(c => ({ ...c, parentId: null })) });
      for (const c of companies.filter(c => c.parentId)) await tx.company.update({ where: { id: c.id }, data: { parentId: c.parentId } });
      await tx.developer.createMany({ data: developers });
      await tx.account.createMany({ data: accounts });
      await chunk(tasks, d => tx.task.createMany({ data: d }));
      await chunk(taskAssignees, d => tx.taskAssignee.createMany({ data: d, skipDuplicates: true }));
      await chunk(taskEvents, d => tx.taskEvent.createMany({ data: d }));
      await chunk(timeEntries, d => tx.timeEntry.createMany({ data: d }));
      await chunk(issues, d => tx.issue.createMany({ data: d }));
      await chunk(issueAssignees, d => tx.issueAssignee.createMany({ data: d, skipDuplicates: true }));
      await chunk(issueEvents, d => tx.issueEvent.createMany({ data: d }));
      await tx.licence.createMany({ data: licences });
      await chunk(accessRecords, d => tx.accessRecord.createMany({ data: d }));
      await chunk(appAccess, d => tx.appAccess.createMany({ data: d, skipDuplicates: true }));
      await chunk(licenceAssignments, d => tx.licenceAssignment.createMany({ data: d, skipDuplicates: true }));
      await tx.rollout.createMany({ data: rollouts, skipDuplicates: true });
      await tx.dailyNote.createMany({ data: dailyNotes });
      await tx.standup.createMany({ data: standups });
      await tx.meeting.createMany({ data: meetings });
      await tx.meetingDeveloper.createMany({ data: meetingDevs, skipDuplicates: true });
      await tx.reminder.createMany({ data: reminders });
      await tx.reminderDeveloper.createMany({ data: reminderDevs, skipDuplicates: true });
      await tx.milestone.createMany({ data: milestones });
      await tx.changeRequest.createMany({ data: changes });
      for (const { taskIds: ids, ...r } of releases) await tx.release.create({ data: { ...r, tasks: { connect: ids.map(id => ({ id })) } } });
      await tx.risk.createMany({ data: risks });
      await tx.manual.createMany({ data: manuals });
      await chunk(chat, d => tx.chatMessage.createMany({ data: d }));
      await tx.setting.createMany({ data: settings });
      await chunk(audit, d => tx.auditEntry.createMany({ data: d }));
      for (const a of assets) await tx.asset.create({ data: a });
    }, { timeout: 600_000, maxWait: 60_000 });
    console.log("\nDone. Old data was only read; nothing in the old tables changed.");
  } finally {
    await db.$disconnect();
  }
}

main().catch(e => { console.error("\nMigration failed:", e.message ?? e); process.exit(1); });
