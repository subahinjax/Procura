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
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) res.headers.set("set-cookie", setCookie);
  return res;
}