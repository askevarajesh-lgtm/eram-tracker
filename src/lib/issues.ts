// Issue (token) definitions shared by server and client.

export const ISSUE_STATUSES = [
  { key: "new", label: "New", color: "var(--bad)" },
  { key: "assigned", label: "Assigned", color: "var(--warn)" },
  { key: "progress", label: "In progress", color: "var(--info)" },
  { key: "waiting", label: "Waiting on user", color: "var(--lms)" },
  { key: "resolved", label: "Resolved", color: "var(--ok)" },
  { key: "closed", label: "Closed", color: "var(--hold)" },
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number]["key"];
export const ISSUE_STATUS_KEYS = ISSUE_STATUSES.map(s => s.key) as [IssueStatus, ...IssueStatus[]];
export const ISSUE_STATUS_MAP = Object.fromEntries(ISSUE_STATUSES.map(s => [s.key, s])) as Record<string, (typeof ISSUE_STATUSES)[number]>;

export const ISSUE_PRIORITIES = [
  { key: "Urgent", color: "var(--bad)" },
  { key: "High", color: "var(--warn)" },
  { key: "Normal", color: "var(--info)" },
] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number]["key"];
export const ISSUE_PRIORITY_KEYS = ISSUE_PRIORITIES.map(p => p.key) as [IssuePriority, ...IssuePriority[]];
export const issuePriorityColor = (p: string) => ISSUE_PRIORITIES.find(x => x.key === p)?.color ?? "var(--info)";

export const OPEN_STATUSES: IssueStatus[] = ["new", "assigned", "progress", "waiting"];
export const isOpenIssue = (status: string) => !["resolved", "closed"].includes(status);

/** "3h 20m", "2d"... */
export function duration(ms: number) {
  const m = Math.round(Math.abs(ms) / 6e4);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "h" + (m % 60 && h < 10 ? " " + (m % 60) + "m" : "");
  return Math.floor(h / 24) + "d";
}
