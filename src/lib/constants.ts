import type { Priority, TaskStatus } from "@prisma/client";

export const TASK_STATUSES: { key: TaskStatus; label: string; color: string }[] = [
  { key: "pending", label: "Open / not started", color: "var(--hold)" },
  { key: "progress", label: "In progress", color: "var(--info)" },
  { key: "qa", label: "Testing / QA", color: "var(--warn)" },
  { key: "uat", label: "UAT", color: "var(--lms)" },
  { key: "done", label: "Completed", color: "var(--ok)" },
  { key: "hold", label: "On hold / Blocked", color: "var(--bad)" },
];
export const STATUS_MAP = Object.fromEntries(TASK_STATUSES.map(s => [s.key, s])) as Record<TaskStatus, (typeof TASK_STATUSES)[number]>;
export const ACTIVE_STATUSES: TaskStatus[] = ["progress", "qa", "uat"];

export const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];
export const PRIORITY_COLOR: Record<Priority, string> = { Critical: "var(--bad)", High: "var(--warn)", Medium: "var(--info)", Low: "var(--hold)" };

export const TASK_TYPES = ["Screen", "Report", "Process", "Feature", "Screen / Form", "Integration / API", "Workflow / Approval", "Add-on", "Data migration", "Enhancement", "Bug fix"];
export const REQ_STATUSES = ["Open", "Pending", "Completed", "Live"];
export const TEST_STATUSES = ["Open", "Pending", "Ongoing", "Partially completed", "Completed"];
export const ACCEPT_STATUSES = ["Open", "Pending", "Accepted"];

export const PROJECT_COLORS: Record<string, string> = {
  "SAP B1": "var(--sap)", ATS: "var(--ats)", CRM: "var(--crm)", LMS: "var(--lms)", "ERAM HCM": "var(--hcm)", HCM: "var(--hcm)", "ERAM Workforce": "var(--wfc)",
};
export const projectColor = (name: string) => PROJECT_COLORS[name] ?? "var(--other)";
