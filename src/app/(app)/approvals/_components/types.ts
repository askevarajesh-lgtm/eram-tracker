export type ApprovalKind = "issue" | "task" | "change";

export type QueueItem = {
  kind: ApprovalKind;
  id: string;
  ref: string;
  title: string;
  description: string;
  priority: string;
  projectName: string | null;
  projectCode: string | null;
  companyName: string | null;
  raisedBy: string | null;
  subModule: string | null;
  effort: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  color: string;
  at: string;
  href: string;
  sub: string;
};

export type Decision = {
  id?: string;
  ref: string;
  kind?: ApprovalKind;
  title: string;
  state: string;
  by: string;
  at: string;
  note: string;
  href: string;
  projectName?: string | null;
};

export type DeveloperOption = {
  id: string;
  name: string;
};

export type ApprovalTab = "all" | "issues" | "tasks" | "changes" | "history";
