// Defaults for the app settings (safe to import in client components).

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Template = { label: string; subject: string; body: string };
export const TEMPLATE_DEFAULTS: Record<"daily" | "overdue" | "assign" | "summary" | "custom", Template> = {
  daily: { label: "Daily update reminder", subject: "Daily status update – {date}", body: "Hi {name},\n\nPlease update your daily status in ERAM HCM Business Tools for {date}: what you completed, your plan for tomorrow and any blockers.\n\nYour open items:\n{items}\n\n{link}" },
  overdue: { label: "Overdue items", subject: "Overdue items – {date}", body: "Hi {name},\n\nThese items are past their due date:\n{overdue}\n\nPlease update their status or share the new expected date.\n\n{link}" },
  assign: { label: "Task assignment", subject: "New assignment: {item}", body: "Hi {name},\n\nYou have been assigned: {item} ({project}).\nDue: {due}\n\nPlease review it and keep the status updated.\n\n{link}" },
  summary: { label: "Status summary", subject: "Development status – {date}", body: "Development status for {date}\n\n{summary}\n\n{link}" },
  custom: { label: "Custom message", subject: "ERAM HCM Business Tools", body: "Hi {name},\n\n\n\n{link}" },
};
export type TemplateKey = keyof typeof TEMPLATE_DEFAULTS;

export type NotifySettings = {
  managerName: string;
  managerEmail: string;
  managerWa: string;
  /** link to the tracker put into messages */
  link: string;
  /** daily update due by HH:MM on working days */
  dailyTime: string;
  /** working days, 0 = Sunday */
  days: number[];
  dailyOn: boolean;
  overdueOn: boolean;
  /** response-time targets, in hours */
  sla: { Urgent: number; High: number; Normal: number };
  /** issue priorities that need Admin / Manager approval before work starts */
  approvalPriorities: string[];
  /** new tasks created by developers wait for approval */
  approveDevTasks: boolean;
  templates: Record<TemplateKey, Template>;
};

export const LIST_DEFAULTS = {
  reqTypes: ["Screen", "Report", "Process", "Feature", "Screen / Form", "Integration / API", "Workflow / Approval", "Add-on", "Data migration", "Enhancement", "Bug fix"],
  funcModules: ["Finance", "HR", "Sales", "Operation", "Purchase", "Invoice", "General"],
  branches: ["All Division", "MPD", "SMP", "TSS", "Trading", "Floor", "Qatar"],
  endUsers: ["Finance Team", "HR Team", "Sales Team", "Purchase Team", "Operation Team", "Admin", "Payroll Team"],
  licTypes: ["Professional", "Limited Financial", "Limited Logistics", "Limited CRM", "Starter", "Indirect access"],
};
export type Lists = typeof LIST_DEFAULTS;
export const LIST_LABELS: Record<keyof Lists, string> = {
  reqTypes: "Req. types", funcModules: "Functional modules", branches: "Branches / divisions", endUsers: "Business-user teams", licTypes: "Licence types",
};

/** {name}, {date}… replaced from vars; unknown placeholders are left as they are. */
export const fillTemplate = (t: string, vars: Record<string, string>) => String(t || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
