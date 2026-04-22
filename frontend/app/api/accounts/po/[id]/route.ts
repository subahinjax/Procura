export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const poRes = await pool.query(
      `SELECT id, po_no, sup_name, grand_total,
              advance_required, actual_advance
       FROM po_header
       WHERE id = $1`,
      [id]
    );

    const paymentRes = await pool.query(
      `SELECT payment_id, po_id, payment_type, paid_amount,
              payment_mode, reference_no, reference_date,
              payment_date, bank_name, notes
       FROM po_payments
       WHERE po_id = $1
       ORDER BY payment_id ASC`,
      [id]
    );

    return NextResponse.json(
      {
        po: poRes.rows[0] ?? null,
        payments: paymentRes.rows,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}