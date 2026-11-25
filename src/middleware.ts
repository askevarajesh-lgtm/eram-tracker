import { NextResponse, type NextRequest } from "next/server";

// Fast check at the edge: no session cookie -> sign-in page. The real check (signature, expiry,
// suspended account) happens on the server in getViewer() for every page and action.
export function middleware(req: NextRequest) {
  if (req.cookies.get("d360_session")?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // everything except the sign-in page, Next internals, static files, and public/cron APIs
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|api/health|api/cron).*)"],
};
