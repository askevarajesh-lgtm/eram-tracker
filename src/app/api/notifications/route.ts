import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import {
  getRecentNotifications,
  markAllNotificationsRead,
  clearReadNotifications,
} from "@/server/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { items, unreadCount } = await getRecentNotifications(viewer.id, 40);
  return NextResponse.json({
    items,
    unreadCount,
  });
}

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "read-all") {
      await markAllNotificationsRead(viewer.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "clear-read") {
      await clearReadNotifications(viewer.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
