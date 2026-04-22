import type { Pool } from "pg";

declare global {
  var pgPool: Pool | undefined;
}

export {};
