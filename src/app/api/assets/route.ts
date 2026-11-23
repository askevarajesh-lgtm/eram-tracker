import { db } from "@/lib/db";
import { getViewer } from "@/lib/session";
import { canEdit } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = (Number(process.env.MAX_UPLOAD_MB) || 20) * 1024 * 1024;

/** Upload one file. Body = the raw file; headers: Content-Type, X-Filename (URI-encoded). */
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "signed_out" }, { status: 401 });
  if (!canEdit(viewer))
    return Response.json(
      { error: "not_granted", message: "Viewers can't attach files." },
      { status: 403 },
    );
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX)
    return Response.json(
      {
        error: "too_large",
        message: `Files can be up to ${MAX / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return Response.json({ error: "empty" }, { status: 400 });
  if (buf.length > MAX)
    return Response.json(
      {
        error: "too_large",
        message: `Files can be up to ${MAX / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  let name = "file";
  try {
    name = decodeURIComponent(req.headers.get("x-filename") || "file").slice(
      0,
      200,
    );
  } catch {}
  const contentType = (
    req.headers.get("content-type") || "application/octet-stream"
  ).slice(0, 120);
  const a = await db.asset.create({
    data: {
      name,
      contentType,
      size: buf.length,
      data: buf,
      uploadedById: viewer.id,
    },
  });
  return Response.json({ id: a.id, name, contentType, size: buf.length });
}
