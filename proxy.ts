import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional access gate for hosted demos. When NEXUS_ACCESS_TOKEN is set, every page and API route
 * (except /api/health) requires HTTP Basic auth with that token as the password (any username).
 * Unset = open, which is fine for local development.
 */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function proxy(req: NextRequest) {
  const token = process.env.NEXUS_ACCESS_TOKEN;
  if (!token || req.nextUrl.pathname === "/api/health") return NextResponse.next();
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (safeEqual(decoded.slice(decoded.indexOf(":") + 1), token)) return NextResponse.next();
    } catch { /* fall through to 401 */ }
  }
  return new NextResponse(JSON.stringify({ error: "Authentication required.", code: "UNAUTHORIZED" }), {
    status: 401,
    headers: { "content-type": "application/json", "www-authenticate": 'Basic realm="NexusBrain", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
