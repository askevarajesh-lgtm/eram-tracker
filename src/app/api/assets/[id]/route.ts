import { db } from "@/lib/db";
import { getViewer } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types the browser may show inline. Everything else downloads; non-PDF files are sandboxed.
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|video\/(mp4|webm|ogg)|audio\/|text\/plain|text\/csv)/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getViewer())) return new Response("Sign in to view this file.", { status: 401 });
  const { id } = await params;
  const a = await db.asset.findUnique({ where: { id } });
  if (!a) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  const inline = INLINE.test(a.contentType) && !download;
  const headers: Record<string, string> = {
    "Content-Type": inline ? a.contentType : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  // PDFs need the browser's viewer; everything else is shown in a locked-down sandbox
  if (!/^application\/pdf/i.test(a.contentType) || !inline) headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
  return new Response(new Uint8Array(a.data), { headers });
}
