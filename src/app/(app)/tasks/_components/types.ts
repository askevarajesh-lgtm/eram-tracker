import type { Priority, TaskStatus } from "@prisma/client";
import type { TaskRow } from "@/server/queries";
import { dayStr } from "@/lib/dates";

/** Plain, serialisable task passed from server to client components. */
export type TaskDTO = {
  id: string;
  sno: number;
  title: string;
  projectId: string;
  projectName: string;
  subModule: string;
  type: string;
  reqStatus: string;
  status: TaskStatus;
  priority: Priority | "";
  assigneeIds: string[];
  assigneeNames: string[];
  companyId: string;
  companyLabel: string;
  branch: string;
  endUsers: string;
  testStatus: string;
  acceptStatus: string;
  progress: number | null;
  startDate: string;
  dueDate: string;
  completedDate: string;
  estHours: number | null;
  size: string;
  version: string;
  lead: string;
  description: string;
  notes: string;
  source: string;
  approvalPending: boolean;
  updatedAt: string;
};

export function toTaskDTO(t: TaskRow): TaskDTO {
  return {
    id: t.id, sno: t.sno, title: t.title,
    projectId: t.projectId ?? "", projectName: t.project?.name ?? "",
    subModule: t.subModule, type: t.type, reqStatus: t.reqStatus, status: t.status, priority: t.priority ?? "",
    assigneeIds: t.assignees.map(a => a.developer.id), assigneeNames: t.assignees.map(a => a.developer.name),
    companyId: t.companyId ?? "", companyLabel: t.company ? t.company.code || t.company.name : "",
    branch: t.branch, endUsers: t.endUsers, testStatus: t.testStatus, acceptStatus: t.acceptStatus, progress: t.progress,
    startDate: dayStr(t.startDate), dueDate: dayStr(t.dueDate), completedDate: dayStr(t.completedDate),
    estHours: t.estHours == null ? null : Number(t.estHours),
    size: t.size, version: t.version, lead: t.lead, description: t.description, notes: t.notes, source: t.source,
    approvalPending: t.approvalState === "pending", updatedAt: t.updatedAt.toISOString(),
  };
}
