import { getViewer } from "@/lib/session";
import { buildWorkbook, buildTasksWorkbook } from "@/server/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/export                  full workbook (legacy/global)
 *  GET /api/export?module=tasks     task-specific export with filters
 *  GET /api/export?module=tasks&template=1  blank task upload template */
export async function GET(req: Request) {
  if (!(await getViewer())) return Response.json({ error: "signed_out" }, { status: 401 });
  const url = new URL(req.url);
  const mod = url.searchParams.get("module");
  const template = url.searchParams.get("template") === "1";

  if (mod === "tasks") {
    const filters = {
      q: url.searchParams.get("q") || undefined,
      project: url.searchParams.get("project") || undefined,
      status: url.searchParams.get("status") || undefined,
      dev: url.searchParams.get("dev") || undefined,
      priority: url.searchParams.get("priority") || undefined,
    };
    const { buffer, fileName } = await buildTasksWorkbook(filters, template);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const buf = await buildWorkbook(template);
  const name = template ? "Dev360_Upload_Template.xlsx" : `Dev360_StatusReport_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
