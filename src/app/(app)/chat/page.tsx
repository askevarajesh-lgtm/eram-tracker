import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireViewer } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { projectColor } from "@/lib/constants";
import { chatMessages } from "@/server/chat";
import { ChatView } from "./_components/ChatView";

export const metadata: Metadata = { title: "Team chat" };

export default async function ChatPage() {
  const viewer = await requireViewer();
  const [projects, messages] = await Promise.all([
    db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    chatMessages(),
  ]);
  const channels = [
    { id: "general", name: "General", color: "var(--accent)" },
    { id: "urgent", name: "Urgent issues", color: "var(--bad)" },
    ...projects.map(p => ({ id: "p:" + p.id, name: p.name, color: projectColor(p.name) })),
    { id: "standup", name: "Daily stand-up", color: "var(--ok)" },
  ];
  return <ChatView channels={channels} initial={messages} canPost={canEdit(viewer)} />;
}
