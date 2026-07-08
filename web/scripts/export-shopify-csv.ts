/**
 * Export Supabase products to a Shopify-compatible product import CSV.
 *
 * Usage (from the `web` folder):
 *   npx tsx scripts/export-shopify-csv.ts            # writes ./shopify-products-import.csv
 *   npx tsx scripts/export-shopify-csv.ts C:\path\out.csv
 *
 * Import the resulting file in Shopify admin: Products → Import.
 * Image Src uses the public Supabase Storage URLs already linked to each product.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Image Src",
  "Status",
];

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function handleFrom(sku: string, name: string): string {
  const base = (sku || name || "product").toString();
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function run() {
  const outArg = process.argv[2] ?? "./shopify-products-import.csv";
  const outPath = resolve(process.cwd(), outArg);

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at");
  if (error) {
    console.error("ERROR loading products:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as any[];
  const lines: string[] = [HEADERS.map(csvCell).join(",")];

  for (const r of rows) {
    const handle = handleFrom(r.sku, r.name);
    const record: Record<string, unknown> = {
      Handle: handle,
      Title: r.name ?? r.sku ?? "Untitled",
      "Body (HTML)": r.description ?? "",
      Vendor: r.brand ?? "Mideer",
      Type: r.category ?? "",
      Tags: r.category ?? "",
      Published: r.active ? "TRUE" : "FALSE",
      "Option1 Name": "Title",
      "Option1 Value": "Default Title",
      "Variant SKU": r.sku ?? "",
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Qty": r.stock ?? 0,
      "Variant Inventory Policy": "deny",
      "Variant Fulfillment Service": "manual",
      "Variant Price": r.price ?? "",
      "Variant Requires Shipping": "TRUE",
      "Variant Taxable": "TRUE",
      "Image Src": r.image_url ?? "",
      Status: r.active ? "active" : "draft",
    };
    lines.push(HEADERS.map((h) => csvCell(record[h])).join(","));
  }

  writeFileSync(outPath, "\uFEFF" + lines.join("\r\n"), "utf8");

  const withImage = rows.filter((r) => r.image_url).length;
  console.log(`Wrote ${rows.length} products to ${outPath}`);
  console.log(`  ${withImage} include an image, ${rows.length - withImage} without.`);
}

run();
