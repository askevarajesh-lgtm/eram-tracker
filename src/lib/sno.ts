import type { Prisma } from "@prisma/client";

// Task serial numbers (S.No) are numbered per project by the server.
// Hold this Postgres advisory lock (inside the transaction) while picking or re-sequencing a number.
export const SNO_LOCK = 360361;

export const lockSno = (tx: Prisma.TransactionClient) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(${SNO_LOCK})`;

/**
 * Returns the next available serial number (S.No) for a project.
 * It finds the lowest available integer starting from 1 so that
 * any deleted or missing serial numbers are reused, and the sequence
 * always starts from 1.
 */
export async function nextSno(
  tx: Prisma.TransactionClient,
  projectId: string | null,
  exceptId?: string
): Promise<number> {
  const baseWhere: Prisma.TaskWhereInput = {
    ...(projectId ? { projectId } : { projectId: null }),
    ...(exceptId ? { NOT: { id: exceptId } } : {}),
  };

  const rows = await tx.task.findMany({
    where: baseWhere,
    select: { sno: true },
    orderBy: { sno: "asc" },
  });

  const used = new Set(rows.map((r) => r.sno));
  let candidate = 1;
  while (used.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Re-sequences all tasks for a specific project so they are numbered
 * sequentially 1, 2, 3, ... N with no gaps, preserving existing order.
 * This is called automatically when records are deleted or moved.
 */
export async function resequenceProjectTasks(
  tx: Prisma.TransactionClient,
  projectId: string | null
): Promise<number> {
  await lockSno(tx);
  const rows = await tx.task.findMany({
    where: projectId ? { projectId } : { projectId: null },
    select: { id: true, sno: true },
    orderBy: [
      { sno: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  let changed = 0;
  for (let i = 0; i < rows.length; i++) {
    const expectedSno = i + 1;
    if (rows[i].sno !== expectedSno) {
      await tx.task.update({
        where: { id: rows[i].id },
        data: { sno: expectedSno },
      });
      changed++;
    }
  }
  return changed;
}

/**
 * Re-sequences tasks 1..N across all projects, ensuring that every project
 * has a continuous serial number sequence starting from 1 with no missing numbers.
 */
export async function resequenceAllProjects(
  tx: Prisma.TransactionClient
): Promise<number> {
  await lockSno(tx);
  const rows = await tx.task.findMany({
    select: { id: true, projectId: true, sno: true },
    orderBy: [
      { projectId: "asc" },
      { sno: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  const counters = new Map<string, number>();
  let changed = 0;
  for (const r of rows) {
    const k = r.projectId ?? "";
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    if (r.sno !== n) {
      await tx.task.update({ where: { id: r.id }, data: { sno: n } });
      changed++;
    }
  }
  return changed;
}
