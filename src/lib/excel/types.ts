import { z } from "zod";

// What the browser sends to the server after reading an Excel/CSV file. Every value is already
// cleaned up (statuses normalised, dates as YYYY-MM-DD). The server validates it again with these schemas.

const str = z.string().max(4000).default("");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default("");

export const importTask = z.object({
  sno: z.number().int().positive().nullable().default(null),
  ref: str,
  title: z.string().min(1).max(1000),
  project: str,
  subModule: str,
  type: str,
  reqStatus: str,
  developers: z.array(z.string().max(100)).max(20).default([]),
  status: z.enum(["pending", "progress", "qa", "uat", "done", "hold"]),
  company: str,
  branch: str,
  endUsers: str,
  testStatus: str,
  acceptStatus: str,
  priority: z.enum(["Critical", "High", "Medium", "Low", ""]).default(""),
  progress: z.number().int().min(0).max(100).nullable().default(null),
  start: day,
  due: day,
  completed: day,
  estHours: z.number().min(0).nullable().default(null),
  version: str,
  description: str,
  notes: str,
});

export const importDeveloper = z.object({ name: z.string().min(1).max(100), title: str, email: str, skills: str });

export const importCompany = z.object({ name: z.string().min(1).max(200), country: str, code: str, branches: z.array(z.string().max(100)).max(50).default([]) });

export const importLicence = z.object({
  software: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  company: str,
  quantity: z.number().int().min(0).default(0),
  model: str,
  renewal: day,
  vendor: str,
  cost: z.number().min(0).nullable().default(null),
  currency: str,
  contract: str,
  notes: str,
});

/** A row of the "Application Users" sheet: a person in the Users & access register (not an app account). */
export const importAccessRecord = z.object({
  name: z.string().min(1).max(200),
  email: str,
  userType: str,
  company: str,
  branch: str,
  dept: str,
  designation: str,
  status: z.enum(["Active", "Inactive"]).default("Active"),
  /** system (project) name -> role ("" = access without a role) */
  apps: z.record(z.string().max(100), z.string().max(100)).default({}),
  /** software -> licence type */
  licences: z.record(z.string().max(100), z.string().max(100)).default({}),
});

export const importPayload = z.object({
  file: z.string().max(300),
  sheet: z.string().max(300).default(""),
  tasks: z.array(importTask).max(20000).default([]),
  developers: z.array(importDeveloper).max(2000).default([]),
  companies: z.array(importCompany).max(2000).default([]),
  licences: z.array(importLicence).max(2000).default([]),
  accessRecords: z.array(importAccessRecord).max(20000).default([]),
});

export type ImportTask = z.infer<typeof importTask>;
export type ImportPayload = z.input<typeof importPayload>;
export type ParsedImport = z.infer<typeof importPayload> & {
  /** rows whose last four columns had slipped one place left, put back */
  shifted: number;
  /** columns of the task sheet that weren't recognised */
  unmapped: string[];
  accessSheet: string;
};

export type ImportPreview = {
  tasks: { total: number; create: number; update: number };
  newDevelopers: string[];
  newProjects: string[];
  newCompanies: string[];
  accessRecords: { total: number; create: number; update: number };
  /** licence lines / companies / developers from their sheets that are new or changed */
  licences: number;
  companies: number;
  developers: number;
  /** which task rows (index into the payload) are new or updated, for the preview table */
  taskChanges: { index: number; kind: "create" | "update" }[];
};
