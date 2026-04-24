import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_BASE_URL = "https://procura-backend-zf9w.onrender.com";



export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

console.log("🍪 Cookie received:", req.headers.get("cookie"));
console.log("🔗 Pathname:", pathname);


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

    // ✅ 401 = not logged in, redirect to login
    if (response.status === 401) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // ✅ 403/500 = session issue, redirect to session-expired
    if (response.status === 403 || response.status === 500) {
      return NextResponse.redirect(new URL("/session-expired", req.url));
    }

    // ✅ Any other non-ok response
    if (!response.ok) {
      return NextResponse.redirect(new URL("/session-expired", req.url));
    }

  } catch (err) {
    return NextResponse.redirect(new URL("/session-expired", req.url));
  }

  // ✅ Authenticated — proceed
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next|images|favicon.ico|login|forgot|session-expired).*)",
  ],
};