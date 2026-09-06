#!/usr/bin/env node
// Run the SQL schema against your Supabase Postgres database.
// Usage: SUPABASE_DB_URL=postgres://... node scripts/db-setup.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL to your Supabase connection string (Direct connection, port 5432).");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(join(here, "..", "supabase", "schema.sql"), "utf8");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Schema applied.");
} finally {
  await client.end();
}