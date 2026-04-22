export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";





/* =========================
   GET — LIST SUPPLIERS
========================= */
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT sup_id, sup_name, sup_gst, sup_add, sup_person,
             sup_phone, sup_email, acct_name, acct_no,
             bank_name, ifsc_code, bank_branch
      FROM mas_sup
      ORDER BY sup_name
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Error fetching suppliers:", err);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

/* =========================
   POST — CREATE SUPPLIER
========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const query = `
      INSERT INTO mas_sup
        (sup_name, sup_gst, sup_add, sup_person, sup_phone, sup_email,
         acct_name, acct_no, bank_name, ifsc_code, bank_branch)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const values = [
      body.sup_name,
      body.sup_gst,
      body.sup_add,
      body.sup_person,
      body.sup_phone,
      body.sup_email,
      body.acct_name,
      body.acct_no,
      body.bank_name,
      body.ifsc_code,
      body.bank_branch,
    ];

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: any) {
    console.error("Error creating supplier:", err);

    if (err.code === "23505") {
      if (err.constraint === "uq_sup_name_gst") {
        return NextResponse.json(
          { error: "Supplier with this Name and GST already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Duplicate value not allowed" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* =========================
   PUT — UPDATE SUPPLIER
========================= */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.sup_id) {
      return NextResponse.json(
        { error: "Supplier ID is required" },
        { status: 400 }
      );
    }

    const query = `
      UPDATE mas_sup
      SET sup_name=$1,
          sup_gst=$2,
          sup_add=$3,
          sup_person=$4,
          sup_phone=$5,
          sup_email=$6,
          acct_name=$7,
          acct_no=$8,
          bank_name=$9,
          ifsc_code=$10,
          bank_branch=$11
      WHERE sup_id=$12
      RETURNING *;
    `;

    const values = [
      body.sup_name,
      body.sup_gst,
      body.sup_add,
      body.sup_person,
      body.sup_phone,
      body.sup_email,
      body.acct_name,
      body.acct_no,
      body.bank_name,
      body.ifsc_code,
      body.bank_branch,
      body.sup_id,
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err: any) {
    console.error("Error updating supplier:", err);

    if (err.code === "23505") {
      if (err.constraint === "uq_sup_name_gst") {
        return NextResponse.json(
          { error: "Supplier with this Name and GST already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Duplicate value not allowed" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500 }
    );
  }
}
