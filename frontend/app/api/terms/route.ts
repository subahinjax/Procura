export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";



/* ============================================================
   GET  → Fetch all terms
   ============================================================ */
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, title, content
      FROM terms_cond
      ORDER BY id
    `);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Error fetching terms:", err);
    return NextResponse.json({ error: "Failed to fetch terms" }, { status: 500 });
  }
}

/* ============================================================
   POST  → Add new term
   ============================================================ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const query = `
      INSERT INTO terms_cond (title, content)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const values = [title, content];

    const result = await pool.query(query, values);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("Error creating term:", err);
    return NextResponse.json({ error: "Failed to create term" }, { status: 500 });
  }
}

/* ============================================================
   PUT  → Update existing term
   ============================================================ */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, content } = body;

    if (!id) {
      return NextResponse.json({ error: "Term ID is required" }, { status: 400 });
    }

    const query = `
      UPDATE terms_cond
      SET title = $1, content = $2
      WHERE id = $3
      RETURNING *;
    `;
    const values = [title, content, id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Term not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err) {
    console.error("Error updating term:", err);
    return NextResponse.json({ error: "Failed to update term" }, { status: 500 });
  }
}
