"use server";
// Team chat: a few shared channels for the IT team. The page polls for new messages.
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit, isAdmin } from "@/lib/permissions";
import { fail, type ActionResult } from "@/lib/action";

export type ChatMessageDTO = { id: string; channel: string; text: string; at: string; author: string; mine: boolean };

/** Latest messages (all channels), newest last. */
export async function chatMessages(limit = 400): Promise<ChatMessageDTO[]> {
  const viewer = await requireViewer();
  const rows = await db.chatMessage.findMany({
    orderBy: { createdAt: "desc" }, take: Math.min(limit, 1000),
    include: { account: { select: { name: true } }, developer: { select: { name: true } } },
  });
  return rows.reverse().map(m => ({
    id: m.id, channel: m.channel, text: m.text, at: m.createdAt.toISOString(),
    author: m.account?.name ?? m.developer?.name ?? "Team member", mine: m.accountId === viewer.id,
  }));
}

export async function sendChat(channel: string, text: string): Promise<ActionResult<ChatMessageDTO>> {
  const viewer = await requireViewer();
  if (!canEdit(viewer)) return fail("You have read-only access, so you can't post.");
  const t = text.trim();
  if (!t) return fail("Write a message.");
  if (t.length > 4000) return fail("Message is too long.");
  const m = await db.chatMessage.create({ data: { channel: channel.slice(0, 60), text: t, accountId: viewer.id, developerId: viewer.developerId } });
  return { ok: true, data: { id: m.id, channel: m.channel, text: m.text, at: m.createdAt.toISOString(), author: viewer.name, mine: true } };
}

export async function deleteChat(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const m = await db.chatMessage.findUnique({ where: { id } });
  if (!m) return { ok: true };
  if (m.accountId !== viewer.id && !isAdmin(viewer)) return fail("You can only delete your own messages.");
  await db.chatMessage.delete({ where: { id } });
  return { ok: true };
}
