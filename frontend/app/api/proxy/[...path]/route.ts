// app/api/proxy/[...path]/route.ts
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

  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");
  const isGet = req.method === "GET";

  // ✅ Build headers — don't override Content-Type for multipart
// ✅ Build headers
const headers: Record<string, string> = {
  cookie: cookieHeader,
};

// ✅ Forward body correctly
let body: BodyInit | undefined = undefined;
if (!isGet) {
  if (isMultipart) {
    body = await req.arrayBuffer(); // ✅ changed from blob()
    headers["Content-Type"] = contentType; // ✅ includes boundary
  } else {
    headers["Content-Type"] = "application/json";
    body = await req.text();
  }
}

  const response = await fetch(url, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  const resContentType = response.headers.get("content-type") || "";
  const isJsonResponse = resContentType.includes("application/json");

  const resBody = isJsonResponse
    ? await response.json()
    : await response.text();

  const res = isJsonResponse
    ? NextResponse.json(resBody, { status: response.status })
    : new NextResponse(resBody, { 
        status: response.status,
        headers: { "Content-Type": resContentType }
      });

  // ✅ Forward set-cookie
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) res.headers.set("set-cookie", setCookie);

  return res;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;