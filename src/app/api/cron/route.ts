import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { canManage } from "@/lib/permissions";
import { runCron } from "@/server/cron/engine";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request, viewer: any): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (secret && authHeader === `Bearer ${secret}`) return true;
  if (viewer && canManage(viewer)) return true;
  if (!secret) return true; // Allowed when CRON_SECRET is not set
  return false;
}

export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!isAuthorized(req, viewer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const job = (searchParams.get("job") || "all") as any;
  const validJobs = ["minute", "morning", "evening", "monthly", "all"];
  const targetJob = validJobs.includes(job) ? job : "all";

  const result = await runCron(targetJob);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
