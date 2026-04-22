import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);

    if (!auth) {
       return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();

    const { po_id, payment_type, paid_amount } = body;

    if (!po_id || !payment_type || !paid_amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    /* =========================
       LOAD PO
    ========================= */

    const poRes = await pool.query(
      `SELECT grand_total, advance_required, actual_advance
       FROM po_header
       WHERE id = $1`,
      [po_id]
    );

    if (poRes.rows.length === 0) {
      return NextResponse.json(
        { error: "PO not found" },
        { status: 404 }
      );
    }

    const po = poRes.rows[0];

    /* =========================
       TOTAL PAID SO FAR
    ========================= */

    const totalPaidRes = await pool.query(
      `SELECT COALESCE(SUM(paid_amount),0) AS total
       FROM po_payments
       WHERE po_id = $1`,
      [po_id]
    );

    const totalPaid = Number(totalPaidRes.rows[0].total);
    const newPaid = Number(paid_amount);

    /* =========================
       RULE 1
       TOTAL PAYMENT LIMIT
    ========================= */

    if (totalPaid + newPaid > Number(po.grand_total)) {
      return NextResponse.json(
        { error: "Payment exceeds PO grand total" },
        { status: 400 }
      );
    }

    /* =========================
       RULE 2
       ADVANCE NOT ALLOWED
    ========================= */

    if (!po.advance_required && payment_type === "Advance") {
      return NextResponse.json(
        { error: "Advance payment disabled for this PO" },
        { status: 400 }
      );
    }

    /* =========================
       RULE 3
       ADVANCE LIMIT
    ========================= */

    if (payment_type === "Advance") {
      const advRes = await pool.query(
        `SELECT COALESCE(SUM(paid_amount),0) AS total
         FROM po_payments
         WHERE po_id = $1
         AND payment_type = 'Advance'`,
        [po_id]
      );

      const advPaid = Number(advRes.rows[0].total);

      if (advPaid + newPaid > Number(po.actual_advance)) {
        return NextResponse.json(
          { error: "Advance exceeds actual advance amount" },
          { status: 400 }
        );
      }
    }

    /* =========================
       INSERT PAYMENT
    ========================= */

    await pool.query(
      `INSERT INTO po_payments
       (po_id, payment_type, paid_amount, payment_mode,
        payment_date, reference_no, reference_date,
        bank_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        po_id,
        payment_type,
        newPaid,
        body.payment_mode || null,
        body.payment_date || null,
        body.reference_no || null,
        body.reference_date || null,
        body.bank_name || null,
        body.notes || null,
      ]
    );

    /* =========================
       SAVE ACTUAL ADVANCE
    ========================= */

    if (po.actual_advance === null && body.actual_advance !== undefined) {
      await pool.query(
        `UPDATE po_header
         SET actual_advance = $1
         WHERE id = $2`,
        [Number(body.actual_advance), po_id]
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (err) {
    console.error("Payment save error:", err);

    return NextResponse.json(
      { error: "Failed to save payment" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}