import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Uptime check: confirms the app can reach the database. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, storage: "postgres" });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
