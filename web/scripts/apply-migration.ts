/**
 * Apply pending SQL migrations to the linked Supabase project.
 *
 * Requires a Supabase personal access token (not the service role key):
 *   1. https://supabase.com/dashboard/account/tokens -> create token
 *   2. set SUPABASE_ACCESS_TOKEN=sbp_... in .env.local
 *   3. npx tsx scripts/apply-migration.ts
 *
 * Or run the SQL manually in Supabase -> SQL Editor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "./load-env";

loadEnv();

const projectRef = "yrpjtaqdwieavlhathvo";
const migrationFile = process.argv[2] ?? "supabase/migrations/0003_orders_order_number.sql";

async function run() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "SUPABASE_ACCESS_TOKEN is not set.\n\n" +
        "Either add it to .env.local (from https://supabase.com/dashboard/account/tokens)\n" +
        "or paste this SQL in Supabase -> SQL Editor:\n",
    );
    console.error(readFileSync(resolve(migrationFile), "utf8"));
    process.exit(1);
  }

  const sql = readFileSync(resolve(migrationFile), "utf8");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const body = await res.text();
  if (!res.ok) {
    console.error(`Migration failed (${res.status}):`, body);
    process.exit(1);
  }

  console.log("Migration applied successfully.");
  console.log(body.slice(0, 300));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
