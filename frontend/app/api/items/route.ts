export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";


// ✅ GET items
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        i.item_code,
        i.item_name,
        i.description,
        i.unit,
        i.rate,
        i.hsn_code,
        i.gst_per,
        i.cat_code,
        c.category_type,
        c.category,
        i.active
      FROM mas_item i
      JOIN mas_cat c ON c.cat_code = i.cat_code
      ORDER BY i.item_name
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Error fetching items:", err);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}


// ✅ POST item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const query = `
      INSERT INTO mas_item
      (item_name, description, unit, rate, hsn_code, gst_per, cat_code, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const values = [
      body.item_name,
      body.description || null,
      body.unit,
      body.rate,
      body.hsn_code,
      body.gst_per,
      body.cat_code,
      body.active ?? true,
    ];

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (err: any) {
    console.error("POST mas_item error 👉", err.message); // 🔥 IMPORTANT
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}



// ✅ PUT item
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.item_code) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const query = `
      UPDATE mas_item
      SET
        item_name = $1,
        description = $2,
        unit = $3,
        rate = $4,
        hsn_code = $5,
        gst_per = $6,
        cat_code = $7,
        active = $8
      WHERE item_code = $9
      RETURNING *;
    `;

    const values = [
      body.item_name,
      body.description || null,
      body.unit,
      body.rate,
      body.hsn_code,
      body.gst_per,
      body.cat_code ? Number(body.cat_code) : null, // 🔥 FIX
      body.active ?? true,
      body.item_code,
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });

  } catch (err: any) {
    console.error("PUT mas_item error 👉", err.message); // 🔥 IMPORTANT
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

