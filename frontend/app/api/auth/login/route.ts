// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const response = await fetch(`${process.env.API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const res = NextResponse.json(data, { status: response.status });

  // ✅ Rewrite cookie for Vercel domain
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    // Extract just the connect.sid value
    const sidMatch = setCookie.match(/connect\.sid=([^;]+)/);
    if (sidMatch) {
      res.cookies.set("connect.sid", sidMatch[1], {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 60 * 30, // 30 minutes
      });
    }
  }

  return res;
}