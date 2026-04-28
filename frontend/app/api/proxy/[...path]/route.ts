import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL!;

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map(c => `${c.name}=${c.value}`)
    .join("; ");

  const { path } = await params;
  const search = req.nextUrl.search || "";
  const url = `${API_URL}/api/${path.join("/")}${search}`;
  const isGet = req.method === "GET";

  const response = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
    },
    body: isGet ? undefined : await req.text(),
    cache: "no-store",
  });

  const text = await response.text();
  const res = new NextResponse(text, { status: response.status });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) res.headers.set("set-cookie", setCookie);
  res.headers.set("Content-Type", "application/json");

  return res;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;