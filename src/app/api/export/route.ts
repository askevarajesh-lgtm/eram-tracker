import { getViewer } from "@/lib/session";
import { buildWorkbook } from "@/server/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/export          full workbook
 *  GET /api/export?template=1  blank upload template */
export async function GET(req: Request) {
  if (!(await getViewer())) return Response.json({ error: "signed_out" }, { status: 401 });
  const template = new URL(req.url).searchParams.get("template") === "1";
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
