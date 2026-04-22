export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


export async function GET() {
  try {
    const result = await pool.query(
      "SELECT id, unit_code FROM mas_unit WHERE active = true ORDER BY unit_code"
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching units:", err);
    return NextResponse.json(
      { error: "Failed to fetch units" },
      { status: 500 }
    );
  }
}
