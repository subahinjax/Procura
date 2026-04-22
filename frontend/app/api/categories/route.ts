export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


// ✅ GET categories (category_type + sub category)
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        cat_code,
        category,
        category_type,
        active
      FROM mas_cat
      WHERE active = true
      ORDER BY category_type, category
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
