import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

let pool: Pool | undefined;
export function getDatabase(databaseUrl = process.env.DATABASE_URL) { if (!databaseUrl) throw new Error("DATABASE_URL is required"); pool ??= new Pool({connectionString: databaseUrl}); return drizzle(pool, {schema}); }
export async function closeDatabase() { await pool?.end(); pool = undefined; }
export * from "./schema.js";
