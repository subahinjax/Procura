import { Pool } from "pg";

const pool = new Pool({
  user: "postgres.hoqcgfgnktrzdknnsvxt",
  host: "aws-1-ap-south-1.pooler.supabase.com",
  database: "postgres",
  password: "pvw2iEJszirpCqoR",
  port: 5432,
  ssl: false,
});

export default pool;