import { db } from "@/lib/db";
import type { NotificationType, Role } from "@prisma/client";

export type NotificationItem = {
  id: string;
  accountId: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string;
  read: boolean;
  readAt: Date | null;
  entityType: string | null;
  entityId: string | null;
  priority: string;
  createdAt: Date;
};

/** Get unread notifications and total count for an account */
export async function getUnreadNotifications(accountId: string) {
  const [items, count] = await Promise.all([
    db.notification.findMany({
      where: { accountId, read: false },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.notification.count({
      where: { accountId, read: false },
    }),
  ]);
  return { items, count };
}

/** Get recent notifications (both read and unread) */
export async function getRecentNotifications(accountId: string, limit = 30) {
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.notification.count({
      where: { accountId, read: false },
    }),
  ]);
  return { items, unreadCount };
}

/** Mark a specific notification as read */
export async function markNotificationRead(id: string, accountId: string) {
  await db.notification.updateMany({
    where: { id, accountId },
    data: { read: true, readAt: new Date() },
  });
  return { ok: true };
}

/** Mark all notifications as read for an account */
export async function markAllNotificationsRead(accountId: string) {
  await db.notification.updateMany({
    where: { accountId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return { ok: true };
}

/** Delete a specific notification */
export async function deleteNotification(id: string, accountId: string) {
  await db.notification.deleteMany({
    where: { id, accountId },
  });
  return { ok: true };
}

/** Delete all read notifications for an account */
export async function clearReadNotifications(accountId: string) {
  await db.notification.deleteMany({
    where: { accountId, read: true },
  });
  return { ok: true };
}

/**
 * Create a notification with robust deduplication:
 * - If an unread notification already exists for (accountId, entityType, entityId),
 *   it updates the existing notification (bumping message and timestamp) rather than creating a duplicate!
 * - If a read notification exists within the last 12 hours for the entity, it skips re-creation.
 */
export async function createNotification(params: {
  accountId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  priority?: "urgent" | "high" | "normal";
  entityType?: string;
  entityId?: string;
}) {
  const {
    accountId,
    title,
    message,
    type = "reminder",
    link = "",
    priority = "normal",
    entityType,
    entityId,
  } = params;

  if (entityType && entityId) {
    // 1. If an unread notification already exists for this entity, update it (no duplicates!)
    const existingUnread = await db.notification.findFirst({
      where: {
        accountId,
        entityType,
        entityId,
        read: false,
      },
    });

    if (existingUnread) {
      return db.notification.update({
        where: { id: existingUnread.id },
        data: {
          title,
          message,
          priority,
          link,
          createdAt: new Date(),
        },
      });
    }

    // 2. If a notification for this entity was read in the last 12 hours, don't spam
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000);
    const existingRecent = await db.notification.findFirst({
      where: {
        accountId,
        entityType,
        entityId,
        createdAt: { gte: twelveHoursAgo },
      },
    });
    if (existingRecent) {
      return existingRecent;
    }
  }

  return db.notification.create({
    data: {
      accountId,
      title,
      message,
      type,
      link,
      priority,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    },
  });
}

/** Create notification for all accounts with matching role(s) */
export async function createNotificationForRoles(
  roles: Role[],
  params: Omit<Parameters<typeof createNotification>[0], "accountId">
) {
  const accounts = await db.account.findMany({
    where: { role: { in: roles }, active: true },
    select: { id: true },
  });

  const created = await Promise.all(
    accounts.map((acc) =>
      createNotification({
        ...params,
        accountId: acc.id,
      })
    )
  );
  return created;
}

/** Notify developer's account, or all admins/managers if developer has no direct sign-in account */
export async function createNotificationForDeveloper(
  developerId: string,
  params: Omit<Parameters<typeof createNotification>[0], "accountId">
) {
  const devAccount = await db.account.findFirst({
    where: { developerId, active: true },
    select: { id: true },
  });

  if (devAccount) {
    return createNotification({ ...params, accountId: devAccount.id });
  }

  // Fallback: Notify Admins and Managers so the item doesn't get missed
  return createNotificationForRoles(["Admin", "Manager"], params);
}
