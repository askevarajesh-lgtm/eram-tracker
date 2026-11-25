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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ job: string }> }
) {
  const viewer = await getViewer();
  if (!isAuthorized(req, viewer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  const validJobs = ["minute", "morning", "evening", "monthly", "all"] as const;
  const targetJob = validJobs.includes(job as any) ? (job as (typeof validJobs)[number]) : "all";

  const result = await runCron(targetJob);
  return NextResponse.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ job: string }> }
) {
  return GET(req, { params });
}
