/**
 * Interactive image picker for specific SKUs.
 *
 * Generates an HTML page where, for each target product, you click the correct
 * photo. Then click "Copy selections" and paste the result back so the picks
 * can be applied (re-uploaded + relinked).
 *
 * Usage (from the `web` folder):
 *   npx tsx scripts/pick-images.ts "C:\path\to\PART1" MD1458 MD1459 ...
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
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper)) !== null) {
    if (m[1]) prefix = m[1];
    if (!prefix) continue;
    skus.add(`${prefix}${m[2]}`);
  }
  return [...skus];
}

function walkImages(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkImages(full));
    else if (IMAGE_EXT.has(extname(e.name).toLowerCase())) out.push(full);
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

async function run() {
  const args = process.argv.slice(2);
  const folderArg = args[0];
  const skus = args.slice(1).map((s) => s.toUpperCase());
  if (!folderArg || skus.length === 0) {
    console.error('Usage: npx tsx scripts/pick-images.ts "C:\\path\\to\\PART1" MD1458 MD1459 ...');
    process.exit(1);
  }
  const sourceDir = resolve(process.cwd(), folderArg);
  if (!statSync(sourceDir).isDirectory()) {
    console.error(`Not a folder: ${sourceDir}`);
    process.exit(1);
  }

  const { data: products } = await supabase
    .from("products")
    .select("sku, name, image_url")
    .in("sku", skus);
  const meta = new Map<string, { name: string; image_url: string | null }>();
  for (const p of products ?? []) meta.set(String(p.sku).toUpperCase(), { name: p.name ?? "", image_url: p.image_url });

  // For each target SKU, collect candidate files from any top-level folder whose
  // parsed SKUs include it.
  const skuToFiles = new Map<string, string[]>();
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const parsed = parseSkus(entry.name);
    const hits = skus.filter((s) => parsed.includes(s));
    if (hits.length === 0) continue;
    const files = walkImages(join(sourceDir, entry.name));
    for (const s of hits) skuToFiles.set(s, [...(skuToFiles.get(s) ?? []), ...files]);
  }

  const blocks = skus
    .map((sku) => {
      const files = skuToFiles.get(sku) ?? [];
      const m = meta.get(sku);
      const cur = m?.image_url ? `<img class="curimg" src="${esc(m.image_url)}"/>` : `<span class="nocur">none</span>`;
      const thumbs = files
        .map((f, i) => {
          const url = pathToFileURL(f).href;
          return `<figure class="opt" data-sku="${esc(sku)}" data-path="${esc(f)}" onclick="pick(this)">
            <img src="${esc(url)}" loading="lazy"/>
            <figcaption>${i + 1}. ${esc(basename(f))}</figcaption>
          </figure>`;
        })
        .join("");
      return `<section class="card" id="sku-${esc(sku)}">
        <div class="head"><b>${esc(sku)}</b> — ${esc(m?.name ?? "")} <span class="cur">now: ${cur}</span> <span class="chosen" id="chosen-${esc(sku)}"></span></div>
        <div class="grid">${thumbs || "<i>no photos found</i>"}</div>
      </section>`;
    })
    .join("\n");

  const html = `<!doctype html><meta charset="utf-8"><title>Pick images</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial;margin:20px;background:#f8f1e5;color:#2e3a47}
  .bar{position:sticky;top:0;background:#f8f1e5;padding:12px 0;border-bottom:1px solid #ecdfd2;z-index:5}
  button{background:#2e3a47;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer}
  .card{background:#fff9f3;border:1px solid #ecdfd2;border-radius:12px;padding:12px 14px;margin:14px 0}
  .head{font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .cur{font-size:12px;color:#8a8f98;display:inline-flex;align-items:center;gap:6px}
  .curimg{width:40px;height:40px;object-fit:contain;background:#fff;border:1px solid #ccc;border-radius:4px;vertical-align:middle}
  .chosen{font-size:13px;color:#1a7f37;font-weight:600}
  .grid{display:flex;flex-wrap:wrap;gap:10px}
  figure{margin:0;width:130px;cursor:pointer;border:3px solid transparent;border-radius:8px;padding:4px}
  figure.sel{border-color:#1a7f37;background:#eaffef}
  figure img{width:120px;height:120px;object-fit:contain;background:#fff;border:1px solid #ecdfd2;border-radius:6px}
  figcaption{font-size:11px;word-break:break-all;color:#555;margin-top:3px}
  #out{width:100%;height:120px;margin-top:8px;font-family:monospace;font-size:12px}
</style>
<div class="bar">
  <b>Click the correct photo for each product.</b>
  <button onclick="copyOut()">Copy selections</button>
  <span id="msg"></span>
  <textarea id="out" readonly placeholder="Selections will appear here..."></textarea>
</div>
${blocks}
<script>
  const picks = {};
  function pick(el){
    document.querySelectorAll('.opt[data-sku="'+el.dataset.sku+'"]').forEach(o=>o.classList.remove('sel'));
    el.classList.add('sel');
    picks[el.dataset.sku]=el.dataset.path;
    document.getElementById('chosen-'+el.dataset.sku).textContent='✓ selected';
    render();
  }
  function render(){
    document.getElementById('out').value = JSON.stringify(picks,null,2);
  }
  function copyOut(){
    const t=document.getElementById('out'); t.select(); navigator.clipboard.writeText(t.value);
    document.getElementById('msg').textContent='Copied! Paste it back in chat.';
  }
</script>`;

  const outPath = resolve(process.cwd(), join(process.env.USERPROFILE ?? ".", "Desktop", "pick-images.html"));
  writeFileSync(outPath, html, "utf8");
  console.log(`Wrote picker: ${outPath}`);
}

run();
