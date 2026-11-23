import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { Viewer } from "./session";

type Tx = Prisma.TransactionClient | typeof db;

/** Records who changed what. Call inside the same transaction as the change. */
export function audit(tx: Tx, viewer: Viewer, action: "create" | "update" | "delete" | "note", entity: string, entityId: string, label: string) {
  return tx.auditEntry.create({ data: { accountId: viewer.id, action, entity, entityId, label: label.slice(0, 120) } });
}
