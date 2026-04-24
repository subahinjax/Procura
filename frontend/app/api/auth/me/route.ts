import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map(c => `${c.name}=${c.value}`)
    .join("; ");

  console.log("🍪 /api/auth/me forwarding cookies:", cookieHeader); // ✅ add this

  const response = await fetch(`${process.env.API_URL}/api/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  console.log("📡 Render /api/auth/me status:", response.status); // ✅ add this

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}