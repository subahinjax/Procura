export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import pool from "@/lib/db";



/* =====================
   GET → profile OR all users
===================== */
export async function GET(req: NextRequest) {
  try {

    const test = await pool.query("SELECT NOW()");
    console.log("DB Connected:", test.rows[0]);
   console.log("DB URL:", process.env.DATABASE_URL);

   const auth = await requireAuth();
   if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all");




    // ✅ ?all=true → return all users (ADMIN only)
    if (all === "true") {
      if (auth.user.user_type?.toUpperCase() !== "ADMIN")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const result = await pool.query(
        `SELECT id, username, email, user_type, active, dept_id, created_at
         FROM users
         ORDER BY username ASC`  // ✅ dept_id added
      );


const dbInfo = await pool.query(`
  SELECT current_database(), current_schema(), inet_server_addr(), inet_server_port()
`);
console.log(dbInfo.rows);

      console.log("Users from DB:", result.rows);
      return NextResponse.json(result.rows);
    }

    // ✅ default → return logged-in user's profile
    const result = await pool.query(
      `SELECT id, username, email, user_type, active, dept_id, created_at
       FROM users WHERE id = $1`,  // ✅ dept_id added
      [auth.user.id]
    );
    if (result.rows.length === 0)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("GET /api/users failed:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/* =====================
   POST → create user (ADMIN only)
===================== */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.user.user_type?.toUpperCase() !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { username, email, user_type, active, dept_id } = await req.json(); // ✅ dept_id extracted

    if (!username || !email || !user_type || !dept_id) { // ✅ dept_id validated
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const password = username; // temp password = username

    const result = await pool.query(
      `INSERT INTO users (username, password, email, user_type, active, dept_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, user_type, active, dept_id, created_at`, // ✅ dept_id added
      [username, password, email, user_type, active, dept_id]
    );
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

/* =====================
   PUT → update user (ADMIN only)
===================== */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (auth.user.user_type?.toUpperCase() !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id, username, email, user_type, active, dept_id } = await req.json(); // ✅ dept_id extracted

    if (!id)
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    if (!dept_id) // ✅ dept_id validated
      return NextResponse.json({ error: "Department required" }, { status: 400 });

    await pool.query(
      `UPDATE users
       SET username = $1, email = $2, user_type = $3, active = $4, dept_id = $5
       WHERE id = $6`, // ✅ dept_id added
      [username, email, user_type, active, dept_id, id]
    );
    return NextResponse.json({ message: "User updated" });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}