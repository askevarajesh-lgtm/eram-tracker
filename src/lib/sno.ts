import type { Prisma } from "@prisma/client";

// Task serial numbers (S.No) are numbered per project by the server.
// Hold this Postgres advisory lock (inside the transaction) while picking a number.
export const SNO_LOCK = 360361;

export const lockSno = (tx: Prisma.TransactionClient) => tx.$executeRaw`SELECT pg_advisory_xact_lock(${SNO_LOCK})`;

export async function nextSno(tx: Prisma.TransactionClient, projectId: string | null, exceptId?: string) {
  const r = await tx.task.aggregate({ _max: { sno: true }, where: { projectId, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
  return (r._max.sno ?? 0) + 1;
}
