import type { Viewer } from "./session";

// Role rules carried over from the old app. The server checks these on every write.
export const canManage = (v: Viewer) => v.role === "Admin" || v.role === "Manager";
export const isAdmin = (v: Viewer) => v.role === "Admin";
export const canEdit = (v: Viewer) => v.role !== "Viewer";

/** Developers may edit tasks they're assigned to (or create tasks assigned to themselves). */
export function canWriteTask(v: Viewer, assigneeIds: string[], existingAssigneeIds?: string[]) {
  if (canManage(v)) return true;
  if (v.role !== "Developer" || !v.developerId) return false;
  const ids = existingAssigneeIds ?? assigneeIds;
  return ids.includes(v.developerId);
}

export class PermissionError extends Error {
  constructor(message = "You don't have permission to make this change.") {
    super(message);
    this.name = "PermissionError";
  }
}
