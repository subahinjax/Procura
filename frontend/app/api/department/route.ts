export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

import pool from "@/lib/db";




/* =====================
   GET → all departments
===================== */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await pool.query(
      `SELECT dept_id, dept_name FROM mas_dept ORDER BY dept_name ASC`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("GET /api/department failed:", err);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}