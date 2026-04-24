import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE_URL = process.env.API_URL!;
console.log("🔍 API_BASE_URL in middleware:", API_BASE_URL);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — skip auth check
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot") ||
    pathname.startsWith("/session-expired") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.redirect(new URL("/session-expired", req.url));
    }
  } catch (err) {
    return NextResponse.redirect(new URL("/session-expired", req.url));
  }

  const res = NextResponse.next();

  // ✅ Disable bfcache — forces fresh request on browser Back
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  // ✅ removed Clear-Site-Data — only works on HTTPS

  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next|images|favicon.ico|login|forgot|session-expired).*)",
  ],
};
