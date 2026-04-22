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
    const { po_id, actual_advance, narration } = body;

    /* =========================
       INPUT VALIDATION
    ========================= */

    if (!po_id) {
      return NextResponse.json(
        { error: "PO ID is missing." },
        { status: 400 }
      );
    }

    if (actual_advance === undefined || actual_advance === null) {
      return NextResponse.json(
        { error: "Please enter the Actual Advance amount." },
        { status: 400 }
      );
    }

    if (isNaN(Number(actual_advance)) || Number(actual_advance) < 0) {
      return NextResponse.json(
        { error: "Actual Advance must be a valid positive number." },
        { status: 400 }
      );
    }

    if (!narration || narration.trim() === "") {
      return NextResponse.json(
        { error: "Narration is required. Please explain the advance." },
        { status: 400 }
      );
    }

    /* =========================
       LOAD PO
    ========================= */

    const poRes = await pool.query(
      `SELECT grand_total, actual_advance, advance_required
       FROM po_header
       WHERE id = $1`,
      [po_id]
    );

    if (poRes.rows.length === 0) {
      return NextResponse.json(
        { error: "PO not found." },
        { status: 404 }
      );
    }

    const po = poRes.rows[0];

    /* =========================
       BUSINESS RULES
    ========================= */

    // Advance not required
    if (!po.advance_required) {
      return NextResponse.json(
        { error: "Advance is not required for this PO." },
        { status: 400 }
      );
    }

    // Already locked
    if (po.actual_advance !== null) {
      return NextResponse.json(
        { error: "Actual Advance is already saved and locked." },
        { status: 400 }
      );
    }

    // Cannot exceed grand total
    if (Number(actual_advance) > Number(po.grand_total)) {
      return NextResponse.json(
        {
          error: `Actual Advance cannot exceed PO Grand Total (₹${po.grand_total}).`,
        },
        { status: 400 }
      );
    }

    /* =========================
       SAVE ADVANCE
    ========================= */

    await pool.query(
      `UPDATE po_header
       SET actual_advance = $1,
           advance_narration = $2
       WHERE id = $3`,
      [Number(actual_advance), narration.trim(), po_id]
    );

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (err) {
    console.error("Advance save error:", err);

    return NextResponse.json(
      { error: "Failed to save advance." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}