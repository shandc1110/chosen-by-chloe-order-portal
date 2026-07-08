import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatOrderNumber } from "../lib/order-number";
import { loadEnv } from "./load-env";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const START = 9001;

async function run() {
  const probe = await supabase.from("orders").select("order_number").limit(1);
  if (probe.error?.code === "42703") {
    console.error(
      "The orders.order_number column is missing. Run this SQL in Supabase -> SQL Editor:\n",
    );
    console.error(readFileSync(resolve("supabase/migrations/0003_orders_order_number.sql"), "utf8"));
    process.exit(1);
  }
  if (probe.error) throw probe.error;

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  let next = START;
  let updated = 0;

  for (const order of orders ?? []) {
    if (order.order_number) {
      const match = /^CBC(\d+)$/i.exec(String(order.order_number));
      if (match) next = Math.max(next, Number(match[1]) + 1);
      continue;
    }

    const orderNumber = formatOrderNumber(next++);
    const { error: upErr } = await supabase
      .from("orders")
      .update({ order_number: orderNumber })
      .eq("id", order.id);
    if (upErr) throw upErr;
    console.log(`assigned ${orderNumber} -> ${order.id}`);
    updated++;
  }

  console.log(`Done. Backfilled ${updated} order(s). Next number will be ${formatOrderNumber(next)}.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
