/**
 * Match a folder of product images (e.g. downloaded from Google Drive) to
 * products in Supabase, then upload + link a representative image per product.
 *
 * Usage (run from the `web` folder):
 *   npm run match:images                  # reads ./drive-images
 *   npm run match:images -- ./some-folder # reads a custom folder
 *   npm run match:images -- ./drive-images --dry   # preview, no uploads
 *
 * How matching works:
 *  - Each TOP-LEVEL subfolder name is parsed for SKUs. Folder names may contain
 *    several SKUs, including shorthand where a prefix carries over, e.g.
 *    "MD1458-1459-1461" -> MD1458, MD1459, MD1461.
 *  - Parsed SKUs are cross-checked against the real `sku` values in the
 *    products table, so only genuine products get linked.
 *  - A representative image is chosen from the folder (prefers a main / white
 *    background shot) and uploaded to Supabase Storage, then `image_url` is set.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, basename, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PRODUCT_IMAGE_BUCKET ?? "product-images";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function fail(message: string): never {
  console.error(`\n\u2717 ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "your-service-role-key") {
  fail(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "  Get it from Supabase \u2192 Project Settings \u2192 API \u2192 service_role (secret).",
  );
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const folderArg = args.find((a) => !a.startsWith("--")) ?? "./drive-images";
const sourceDir = resolve(process.cwd(), folderArg);

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  fail(
    `Image folder not found: ${sourceDir}\n` +
      "  Download the Drive folder, unzip it, and point the script at it:\n" +
      "  npm run match:images -- ./path/to/unzipped/folder",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Extract candidate SKUs from a folder name. Handles multiple SKUs and the
 * shorthand where a two-letter prefix carries to following bare numbers, e.g.
 * "MD1458-1459-1461" -> [MD1458, MD1459, MD1461].
 */
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
    if (entry.isDirectory()) {
      out.push(...walkImages(full));
    } else if (CONTENT_TYPES[extname(entry.name).toLowerCase()]) {
      out.push(full);
    }
  }
  return out;
}

/** Prefer a main / white-background shot, otherwise the first image by name. */
function pickRepresentative(files: string[]): string {
  const score = (file: string): number => {
    const name = basename(file);
    if (name.includes("主图")) return 0;
    if (name.includes("白底")) return 1;
    if (/(^|[^0-9])0*1\.[a-z0-9]+$/i.test(name)) return 2;
    return 3;
  };
  return [...files].sort(
    (a, b) => score(a) - score(b) || basename(a).localeCompare(basename(b)),
  )[0];
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) {
    fail(`Could not create bucket "${BUCKET}": ${error.message}`);
  }
  console.log(`\u2022 Bucket "${BUCKET}" is ready (public).`);
}

async function linkImage(sku: string, imagePath: string): Promise<boolean> {
  const ext = extname(imagePath).toLowerCase();
  const objectPath = `${sku}${ext}`;

  if (dryRun) return true;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, readFileSync(imagePath), {
      contentType: CONTENT_TYPES[ext],
      upsert: true,
    });
  if (uploadError) {
    console.warn(`  \u26a0 ${sku}: upload failed \u2014 ${uploadError.message}`);
    return false;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl })
    .eq("sku", sku);
  if (updateError) {
    console.warn(`  \u26a0 ${sku}: DB update failed \u2014 ${updateError.message}`);
    return false;
  }
  return true;
}

async function run(): Promise<void> {
  if (!dryRun) await ensureBucket();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, sku")
    .not("sku", "is", null);

  if (error) fail(`Could not load products: ${error.message}`);

  // Map uppercased SKU -> the actual sku value stored in the DB.
  const knownSkus = new Map<string, string>();
  for (const row of products ?? []) {
    if (row.sku) knownSkus.set(String(row.sku).toUpperCase(), String(row.sku));
  }
  console.log(`\u2022 Loaded ${knownSkus.size} product SKU(s) from Supabase.`);
  if (dryRun) console.log("\u2022 DRY RUN \u2014 no uploads or DB changes.\n");

  const entries = readdirSync(sourceDir, { withFileTypes: true });
  let linked = 0;
  const unmatchedFolders: string[] = [];
  const matchedSkus = new Set<string>();

  for (const entry of entries) {
    const source =
      entry.isDirectory() || CONTENT_TYPES[extname(entry.name).toLowerCase()]
        ? entry.name
        : null;
    if (!source) continue;

    const fullPath = join(sourceDir, entry.name);
    const label = entry.isDirectory() ? entry.name : basename(entry.name, extname(entry.name));
    const parsed = parseSkus(label);
    const matched = parsed.filter((sku) => knownSkus.has(sku));

    const images = entry.isDirectory() ? walkImages(fullPath) : [fullPath];

    if (images.length === 0) {
      console.log(`  \u2022 "${entry.name}" \u2014 no images inside, skipping`);
      continue;
    }
    if (matched.length === 0) {
      unmatchedFolders.push(`${entry.name}${parsed.length ? ` (parsed: ${parsed.join(", ")})` : ""}`);
      continue;
    }

    const representative = pickRepresentative(images);
    for (const sku of matched) {
      const actualSku = knownSkus.get(sku)!;
      const ok = await linkImage(actualSku, representative);
      if (ok) {
        linked++;
        matchedSkus.add(actualSku);
        console.log(`  \u2713 ${actualSku} \u2190 ${basename(representative)}`);
      }
    }
  }

  console.log(`\nDone. Linked ${linked} product(s) to images.`);

  const missing = [...knownSkus.values()].filter((sku) => !matchedSkus.has(sku));
  if (missing.length > 0) {
    console.log(`\nProducts still without a matched image (${missing.length}):`);
    console.log(`  ${missing.join(", ")}`);
  }
  if (unmatchedFolders.length > 0) {
    console.log(`\nFolders with no matching product (${unmatchedFolders.length}):`);
    for (const folder of unmatchedFolders) console.log(`  - ${folder}`);
  }
}

run().catch((e) => fail(e instanceof Error ? e.message : String(e)));
