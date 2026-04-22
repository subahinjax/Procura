import { Pool } from "pg";

/* =========================
   PG POOL (SINGLE INSTANCE)
========================= */
const pool = globalThis.pgPool ?? new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
});

// Assign to globalThis once
if (!globalThis.pgPool) {
  globalThis.pgPool = pool;
}

export default pool;

