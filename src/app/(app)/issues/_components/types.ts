export type IssueDTO = {
  id: string;
  title: string;
  description: string;
  projectId: string;
  projectName: string;
  priority: string;
  status: string;
  raisedBy: string;
  contact: string;
  companyId: string;
  companyName: string;
  assigneeIds: string[];
  assigneeNames: string[];
  resolution: string;
  createdAt: string;
  resolvedAt: string;
  taskSno: number | null;
  approvalState: "pending" | "approved" | "rejected" | null;
  approvalBy: string;
  approvalAt: string;
  approvalNote: string;
  events: { at: string; message: string }[];
  files: { id: string; name: string; type: string; size: number }[];
  /** opened by link but outside the current filters */
  hidden: boolean;
};

export type IssueViewer = { developerId: string | null; canManage: boolean; role: string };
export type Sla = { Urgent: number; High: number; Normal: number };
