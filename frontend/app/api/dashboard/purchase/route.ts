export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


export async function GET(req: NextRequest) {
  try {
    // 🔐 Session check using shared requireAuth
    const auth = await requireAuth(req);
    if (!auth) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // =========================
    // 📊 PO SUMMARY
    // =========================
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'Released'  THEN 1 ELSE 0 END)::int AS released,
        SUM(CASE WHEN status = 'Approved'  THEN 1 ELSE 0 END)::int AS approved,
        SUM(CASE WHEN status = 'Draft'     THEN 1 ELSE 0 END)::int AS draft,
        SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END)::int AS cancel
      FROM po_header
    `);

    // =========================
    // 📦 ITEM METRICS
    // =========================
    const [highestRateItem, highestValueItem] = await Promise.all([
      pool.query(`
        SELECT i.item_name, d.rate AS highest_rate
        FROM po_details d
        JOIN po_header h ON h.id = d.po_id
        JOIN mas_item i ON i.item_code = d.item_code
        WHERE h.status = 'Released'
        ORDER BY d.rate DESC
        LIMIT 1
      `),
      pool.query(`
        SELECT i.item_name, SUM(d.qty * d.rate)::numeric AS total_value
        FROM po_details d
        JOIN po_header h ON h.id = d.po_id
        JOIN mas_item i ON i.item_code = d.item_code
        WHERE h.status = 'Released'
        GROUP BY i.item_code, i.item_name
        ORDER BY total_value DESC
        LIMIT 1
      `),
    ]);

    // =========================
    // 🏢 TOP SUPPLIER
    // =========================
    const topSupplierResult = await pool.query(`
      SELECT
        s.sup_name AS supplier_name,
        SUM(h.grand_total)::numeric AS total_value
      FROM po_header h
      JOIN mas_sup s ON s.sup_id = h.sup_id
      WHERE h.status = 'Released'
      GROUP BY s.sup_name
      ORDER BY total_value DESC
      LIMIT 1
    `);

    return NextResponse.json({
      summary:          summaryResult.rows[0]    ?? {},
      highestRateItem:  highestRateItem.rows[0]  ?? null,
      highestValueItem: highestValueItem.rows[0] ?? null,
      topSupplier:      topSupplierResult.rows[0] ?? null,
    });

  } catch (error: any) {
    console.error("Purchase dashboard error:", error.message);
    return NextResponse.json(
      { message: "Failed to load purchase dashboard", error: error.message },
      { status: 500 }
    );
  }
}
