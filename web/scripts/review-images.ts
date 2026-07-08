/**
 * Build a visual review sheet of product images.
 *
 * For every product in Supabase it shows:
 *   - the image currently linked (image_url), and
 *   - every candidate photo found in that product's PART1 folder, with filenames.
 *
 * You open the generated HTML, spot the wrong ones, and note
 *   SKU -> desired filename
 * so the pick can be overridden.
 *
 * Usage (from the `web` folder):
 *   npx tsx scripts/review-images.ts "C:\path\to\PART1"
 *   npx tsx scripts/review-images.ts "C:\path\to\PART1" "C:\Users\me\Desktop\review.html"
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function parseSkus(name: string): string[] {
  const upper = name.toUpperCase();
  const re = /([A-Z]{2})?(\d{3,4})/g;
  const skus = new Set<string>();
  let prefix = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(upper)) !== null) {
    if (match[1]) prefix = match[1];
    if (!prefix) continue;
    skus.add(`${prefix}${match[2]}`);
  }
  return [...skus];
}

function walkImages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkImages(full));
    else if (IMAGE_EXT.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function run() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error("Pass the PART1 folder path, e.g.\n  npx tsx scripts/review-images.ts \"C:\\path\\to\\PART1\"");
    process.exit(1);
  }
  const sourceDir = resolve(process.cwd(), folderArg);
  if (!statSync(sourceDir).isDirectory()) {
    console.error(`Not a folder: ${sourceDir}`);
    process.exit(1);
  }
  const outPath = resolve(
    process.cwd(),
    process.argv[3] ?? join(process.env.USERPROFILE ?? ".", "Desktop", "image-review.html"),
  );

  const { data: products, error } = await supabase
    .from("products")
    .select("sku, name, image_url")
    .not("sku", "is", null)
    .order("sku");
  if (error) {
    console.error("Could not load products:", error.message);
    process.exit(1);
  }

  // Map each real SKU -> candidate image file paths from its folder.
  const skuToFiles = new Map<string, string[]>();
  const known = new Set((products ?? []).map((p) => String(p.sku).toUpperCase()));
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(sourceDir, entry.name);
    const skus = parseSkus(entry.name).filter((s) => known.has(s));
    if (skus.length === 0) continue;
    const files = walkImages(full);
    for (const sku of skus) {
      skuToFiles.set(sku, [...(skuToFiles.get(sku) ?? []), ...files]);
    }
  }

  const cards = (products ?? [])
    .map((p) => {
      const sku = String(p.sku);
      const files = skuToFiles.get(sku.toUpperCase()) ?? [];
      const current = p.image_url
        ? `<img class="cur" src="${esc(p.image_url)}" loading="lazy" />`
        : `<div class="none">no image linked</div>`;
      const thumbs = files
        .map((f) => {
          const url = pathToFileURL(f).href;
          return `<figure><img src="${esc(url)}" loading="lazy" /><figcaption>${esc(basename(f))}</figcaption></figure>`;
        })
        .join("");
      return `<section class="card">
        <div class="head"><b>${esc(sku)}</b> — ${esc(p.name ?? "")}</div>
        <div class="row">
          <div class="cur-wrap"><div class="lbl">Currently showing</div>${current}</div>
          <div class="alts"><div class="lbl">All photos in this folder (${files.length})</div><div class="grid">${thumbs || "<i>no folder matched</i>"}</div></div>
        </div>
      </section>`;
    })
    .join("\n");

  const html = `<!doctype html><meta charset="utf-8"><title>Image review</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial;margin:24px;background:#f8f1e5;color:#2e3a47}
  h1{font-weight:700}
  .card{background:#fff9f3;border:1px solid #ecdfd2;border-radius:12px;padding:14px 16px;margin:14px 0}
  .head{font-size:15px;margin-bottom:10px}
  .row{display:flex;gap:20px;align-items:flex-start}
  .cur-wrap{flex:0 0 220px}
  .cur{width:200px;height:200px;object-fit:contain;background:#fff;border:2px solid #2e3a47;border-radius:8px}
  .none{width:200px;height:200px;display:flex;align-items:center;justify-content:center;background:#fff;border:2px dashed #b98c7d;border-radius:8px;color:#b98c7d}
  .lbl{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8a8f98;margin-bottom:6px}
  .grid{display:flex;flex-wrap:wrap;gap:10px}
  figure{margin:0;width:120px}
  figure img{width:120px;height:120px;object-fit:contain;background:#fff;border:1px solid #ecdfd2;border-radius:6px}
  figcaption{font-size:11px;word-break:break-all;color:#555;margin-top:3px}
</style>
<h1>Product image review — ${(products ?? []).length} products</h1>
<p>The framed image on the left is what shows now. To change one, note the SKU and the exact filename you want from the right.</p>
${cards}`;

  writeFileSync(outPath, html, "utf8");
  console.log(`Wrote review sheet: ${outPath}`);
  console.log(`Open it in your browser, then tell me the overrides as "SKU -> filename".`);
}

run();
