export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    /* 🔒 Validation */
    if (!fromDate || !toDate) {
      return NextResponse.json(
        { message: "fromDate and toDate are required" },
        { status: 400 }
      );
    }

    if (new Date(fromDate) > new Date(toDate)) {
      return NextResponse.json(
        { message: "fromDate cannot be greater than toDate" },
        { status: 400 }
      );
    }

    /* 📄 PO LIST */
    const poListResult = await pool.query(
      `
      SELECT
        p.po_no,
        p.po_date,
        s.sup_name AS supplier_name,
        d.dept_name AS department,
        p.grand_total
      FROM po_header p
      JOIN mas_sup s ON s.sup_id = p.sup_id
      JOIN mas_dept d ON d.dept_id = p.dept_id
      WHERE p.status = 'Released'
        AND p.po_date BETWEEN $1 AND $2
      ORDER BY p.id ASC
      `,
      [fromDate, toDate]
    );

    /* 📊 SUMMARY */
    const summaryResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(grand_total), 0) AS grand_total
      FROM po_header
      WHERE status = 'Released'
        AND po_date BETWEEN $1 AND $2
      `,
      [fromDate, toDate]
    );

    return NextResponse.json({
      data: poListResult.rows,
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    console.error("PO Report API Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
