// Reads a workbook (already opened with SheetJS) into an import payload. Runs in the browser, so the file
// itself never has to be uploaded; only the cleaned-up rows go to the server.
import type { WorkBook, WorkSheet } from "xlsx";
import {
  STATUS_WORDS, mapHeaders, norm, normAccept, normBranch, normDate, normPriority, normProgress, normReq, normStatus,
  normTest, normType, normUserType, splitDevelopers,
} from "./normalize";
import type { ParsedImport } from "./types";

type Utils = { sheet_to_json: <T>(ws: WorkSheet, opts?: Record<string, unknown>) => T[] };
type Row = Record<string, unknown>;

const text = (v: unknown) => String(v ?? "").trim();
/** case/spacing-insensitive getter: get("company", "companyname") */
const getter = (r: Row) => {
  const keys = Object.keys(r);
  return (...names: string[]) => { const k = keys.find(k => names.includes(norm(k))); return k == null ? "" : r[k]; };
};

export function parseWorkbook(wb: WorkBook, utils: Utils, fileName: string): ParsedImport {
  const names = wb.SheetNames;
  const rows = (n: string | undefined, raw = false) => (n ? utils.sheet_to_json<Row>(wb.Sheets[n], { defval: "", raw }) : []);

  // which sheet holds what
  const notTasks = /^developers?$|^team$|help|summary|user|access|licen|compan/i;
  const taskSheet = names.find(n => /status|task|item|work|tracker|report/i.test(n) && !notTasks.test(n)) ?? names.find(n => !notTasks.test(n)) ?? names[0];
  const devSheet = names.find(n => /^developers?$|^team$|^resources?$/i.test(n.trim()));
  // "Application Users" (the Users & access register); never "User Manuals" or "Licence Assignments"
  const accessSheet = names.find(n => /application\s*users?|users?\s*(&|and)?\s*access/i.test(n))
    ?? names.find(n => /user|access/i.test(n) && !/manual|assignment/i.test(n));
  const companySheet = names.find(n => /^compan/i.test(n.trim()));
  const licenceSheet = names.find(n => /^licen[cs]es?$/i.test(n.trim()));

  // ---- tasks
  const taskRows = notTasks.test(taskSheet ?? "") ? [] : rows(taskSheet, true);
  const headers = taskRows.length ? Object.keys(taskRows[0]) : [];
  const map = mapHeaders(headers);
  const g = (r: Row, k: string) => (map[k] != null ? r[map[k]] : "");
  const s = (r: Row, k: string) => text(g(r, k));
  let shifted = 0;
  const tasks = map.title == null ? [] : taskRows.map(r => {
    let br = s(r, "branch"), eu = s(r, "endUsers"), te = s(r, "testStatus"), ac = s(r, "acceptStatus");
    // SAP report rows where Branch is empty and everything after slid one column left
    if (map.branch != null && !br && STATUS_WORDS.has(norm(eu)) && ac && !STATUS_WORDS.has(norm(ac))) { [br, te, ac, eu] = [ac, eu, te, ""]; shifted++; }
    const status = normStatus(g(r, "status"));
    const sn = g(r, "sno");
    const snoNum = sn === "" || sn == null || isNaN(Number(sn)) ? null : Math.round(Number(sn));
    const est = s(r, "est");
    return {
      sno: snoNum && snoNum > 0 ? snoNum : null, ref: s(r, "ref"), title: s(r, "title").replace(/\s+/g, " "), project: s(r, "project"),
      subModule: s(r, "subModule"), type: normType(g(r, "type")), reqStatus: normReq(g(r, "reqStatus")), developers: splitDevelopers(g(r, "developer")),
      status, company: s(r, "company"), branch: normBranch(br), endUsers: eu, testStatus: normTest(te), acceptStatus: normAccept(ac),
      priority: normPriority(g(r, "priority")), progress: normProgress(g(r, "progress"), status),
      start: normDate(g(r, "start")), due: normDate(g(r, "due")), completed: normDate(g(r, "completed")),
      estHours: est && !isNaN(Number(est)) ? Number(est) : null, version: s(r, "version"), description: s(r, "description"), notes: s(r, "notes"),
    };
  }).filter(t => t.title && !/example row/i.test(t.title));

  // ---- developers
  const developers = rows(devSheet).map(r => {
    const gt = getter(r);
    return { name: text(gt("name", "developer")), title: text(gt("role", "title")), email: text(gt("email")), skills: text(gt("skills")) };
  }).filter(d => d.name && d.name !== "(developer name)");

  // ---- companies
  const companies = rows(companySheet).map(r => {
    const gt = getter(r);
    const numbered = Object.keys(r).filter(k => /^branch/i.test(k.trim()) && norm(k) !== "branches").map(k => text(r[k])).filter(Boolean);
    const listed = text(gt("branches")).split(",").map(x => x.trim()).filter(Boolean);
    return { name: text(gt("company", "companyname", "name")), country: text(gt("country")), code: text(gt("code", "shortcode")), branches: [...numbered, ...listed] };
  }).filter(c => c.name && c.name !== "(company name)");

  // ---- licences
  const licences = rows(licenceSheet, true).map(r => {
    const gt = getter(r);
    const cost = gt("annualcost", "cost");
    return {
      software: text(gt("software", "application", "product")), type: text(gt("licencetype", "licensetype", "type")), company: text(gt("company")),
      quantity: Math.max(0, Math.round(Number(gt("purchased", "quantity", "qty", "count", "total")) || 0)), model: text(gt("model", "licencemodel", "licensemodel")),
      renewal: normDate(gt("renewaldate", "renewal", "expiry", "expirydate", "enddate")), vendor: text(gt("vendor", "partner")),
      cost: cost === "" || isNaN(Number(cost)) ? null : Number(cost), currency: text(gt("currency")), contract: text(gt("contractref", "contract", "po", "reference")), notes: text(gt("notes")),
    };
  }).filter(l => l.software && l.type);

  // ---- Users & access register ("Application Users" sheet)
  const FIXED = ["name", "username", "email", "department", "dept", "designation", "status", "fullname", "employee", "mail", "title", "position", "company", "branch", "country", "usertype", "sapcode", "sapusercode"];
  const accessRecords = rows(accessSheet).map(r => {
    const gt = getter(r);
    const licencesBy: Record<string, string> = {};
    const apps: Record<string, string> = {};
    for (const k of Object.keys(r)) {
      const v = text(r[k]);
      if (/licen[cs]e/i.test(k)) { if (v) licencesBy[k.replace(/\s*licen[cs]e\s*(type)?\s*/i, "").trim() || "SAP B1"] = v; continue; }
      if (FIXED.includes(norm(k)) || !v || /^(no|n|0|false|-)$/i.test(v)) continue;
      apps[k.trim()] = /^(yes|y|1|true|x|✓|✔)$/i.test(v) ? "" : v; // a column per system: Yes, or a role name
    }
    return {
      name: text(gt("name", "username", "fullname", "employee")), email: text(gt("email", "mail")), userType: normUserType(gt("usertype")),
      company: text(gt("company")), branch: text(gt("branch")), dept: text(gt("department", "dept")), designation: text(gt("designation", "title", "position")),
      status: (/inactive|disabled/i.test(text(gt("status"))) ? "Inactive" : "Active") as "Active" | "Inactive", apps, licences: licencesBy,
    };
  }).filter(u => u.name && u.name !== "(user name)");

  return {
    file: fileName, sheet: taskSheet ?? "", tasks, developers, companies, licences, accessRecords,
    shifted, unmapped: headers.filter(h => !Object.values(map).includes(h)), accessSheet: accessSheet ?? "",
  };
}
