export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


export async function GET(req: NextRequest) {
  try {
    // 🔐 STEP 1: Validate session using your EXPRESS backend
    const cookie = req.headers.get("cookie") || "";

    if (!cookie) {
       return new NextResponse("Unauthorized", { status: 401 });
    }

  // 🔐 STEP 1: check session
    const authCheck = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        cookie: cookie,
      },
      cache: "no-store",
    });


    // ❌ NOT LOGGED IN
    if (!authCheck.ok) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 🔽 STEP 2: Continue your existing logic
    const filter = req.nextUrl.searchParams.get("filter") || "all";

    let whereClause = "";

    switch (filter) {
      case "advance-required":
        whereClause = `AND h.advance_required = true`;
        break;

      case "pending-advance":
        whereClause = `
          AND h.advance_required = true
          AND h.actual_advance IS NOT NULL
          AND COALESCE(pay.advance_paid, 0) < h.actual_advance
        `;
        break;

      case "pending-full":
        whereClause = `
          AND COALESCE(pay.total_paid, 0) < h.grand_total
        `;
        break;

      case "paid":
        whereClause = `
          AND COALESCE(pay.total_paid, 0) >= h.grand_total
        `;
        break;
    }

    const result = await pool.query(`
      SELECT
        h.id,
        h.po_no,
        h.sup_name,
        h.po_date,
        h.grand_total,
        h.advance_required,
        h.actual_advance,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'file_name', d.file_name,
              'file_path', d.file_path
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS documents,

        COALESCE(pay.advance_paid, 0) AS advance_paid,
        COALESCE(pay.total_paid, 0) AS total_paid,

        (COALESCE(h.actual_advance, 0) - COALESCE(pay.advance_paid, 0)) AS pending_advance,
        (h.grand_total - COALESCE(pay.total_paid, 0)) AS balance_amount

      FROM po_header h

      LEFT JOIN (
        SELECT
          po_id,
          SUM(CASE WHEN payment_type = 'Advance' THEN paid_amount ELSE 0 END) AS advance_paid,
          SUM(paid_amount) AS total_paid
        FROM po_payments
        GROUP BY po_id
      ) pay ON pay.po_id = h.id

      LEFT JOIN po_documents d ON d.po_id = h.id

      WHERE h.status = 'Released'
      ${whereClause}

      GROUP BY
        h.id,
        pay.advance_paid,
        pay.total_paid

      ORDER BY h.id DESC
    `);

    return NextResponse.json(result.rows);

  } catch (err: any) {
    console.error("❌ SQL ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}