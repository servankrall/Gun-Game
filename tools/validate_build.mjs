#!/usr/bin/env node
/* ============================================================================
 * validate_build.mjs — VANTAGE / Gun Game Arena build validator.
 *
 * Static, dependency-free preflight run over the repo before packaging/deploy.
 * Catches the "missing reference" class of bugs the design docs call out:
 * missing textures, unresolved map/weapon refs, invalid catalogs, oversized or
 * duplicate assets, localization gaps, and deploy-record integrity.
 *
 *   node tools/validate_build.mjs            # human report, non-zero exit on FAIL
 *   node tools/validate_build.mjs --json     # machine-readable
 * ==========================================================================*/
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = p => join(ROOT, p);
const results = []; // {level:'ok'|'warn'|'fail', check, msg}
const add = (level, check, msg) => results.push({ level, check, msg });

/* ---- 1. map → texture references resolve ---- */
function checkMapTextures() {
  const src = readFileSync(R("game/game.js"), "utf8");
  const names = new Set();
  for (const m of src.matchAll(/(?:floor|wall|crate):\s*"([a-z0-9_]+)"/g)) names.add(m[1]);
  if (!names.size) return add("warn", "map-textures", "no floor/wall/crate names found in game.js");
  let missing = 0, normals = 0;
  for (const n of names) {
    const alb = R(`game/assets/textures/${n}.png`), nrm = R(`game/assets/textures/${n}_n.png`);
    if (!existsSync(alb)) { add("fail", "map-textures", `missing albedo: assets/textures/${n}.png`); missing++; }
    if (!existsSync(nrm)) { add("warn", "map-textures", `no normal map: assets/textures/${n}_n.png`); normals++; }
  }
  if (!missing) add("ok", "map-textures", `${names.size} map textures resolve` + (normals ? ` (${normals} without normals)` : " (albedo+normal)"));
}

/* ---- 2. catalogs valid ---- */
function checkCatalogs() {
  for (const [file, key, req] of [
    ["art/materials.json", "materials", ["id", "category", "family", "palette"]],
    ["art/decals.json", "decals", ["id", "category", "kind"]],
  ]) {
    if (!existsSync(R(file))) { add("warn", "catalogs", `${file} not present (generate with build_*.py)`); continue; }
    let data; try { data = JSON.parse(readFileSync(R(file), "utf8")); }
    catch (e) { add("fail", "catalogs", `${file} invalid JSON: ${e.message}`); continue; }
    const items = data[key]; if (!Array.isArray(items)) { add("fail", "catalogs", `${file} missing '${key}' array`); continue; }
    const ids = new Set(); let bad = 0;
    for (const it of items) {
      for (const f of req) if (!(f in it)) { add("fail", "catalogs", `${file}: ${it.id || "?"} missing '${f}'`); bad++; }
      if (ids.has(it.id)) { add("fail", "catalogs", `${file}: duplicate id '${it.id}'`); bad++; } ids.add(it.id);
    }
    if (!bad) add("ok", "catalogs", `${file}: ${items.length} ${key}, all fields + unique ids`);
  }
}

/* ---- 3. localization coverage ---- */
async function checkLocalization() {
  try {
    const mod = await import("file://" + R("game/strings.js"));
    const STR = mod.STR;
    const need = ["title", "start", "maps", "weapons", "agents", "hud", "sd", "online", "touch", "help"];
    const missing = need.filter(k => !(k in STR));
    if (missing.length) add("fail", "localization", `STR missing keys: ${missing.join(", ")}`);
    else add("ok", "localization", `STR present with ${Object.keys(STR).length} top-level keys`);
    // referenced STR.* in game.js that don't exist (shallow one-level check)
    const src = readFileSync(R("game/game.js"), "utf8");
    const refs = new Set([...src.matchAll(/STR\.([a-zA-Z0-9_]+)/g)].map(m => m[1]));
    const dangling = [...refs].filter(k => !(k in STR));
    if (dangling.length) add("warn", "localization", `game.js references STR.${dangling.join(", STR.")} not in strings.js`);
  } catch (e) { add("fail", "localization", `cannot load strings.js: ${e.message}`); }
}

/* ---- 4. texture size + duplicates ---- */
function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function checkAssets() {
  const dir = R("game/assets/textures");
  if (!existsSync(dir)) return add("warn", "assets", "game/assets/textures absent");
  const files = readdirSync(dir).filter(f => f.endsWith(".png"));
  const hashes = new Map(); let over = 0, dup = 0, big = 0;
  for (const f of files) {
    const full = join(dir, f);
    const sz = pngSize(full);
    if (sz && Math.max(sz.w, sz.h) > 2048) { add("warn", "assets", `oversized ${f} (${sz.w}x${sz.h} > 2048)`); over++; }
    const bytes = statSync(full).size; if (bytes > 2 * 1024 * 1024) big++;
    const h = createHash("md5").update(readFileSync(full)).digest("hex");
    if (hashes.has(h)) { add("warn", "assets", `duplicate content: ${f} == ${hashes.get(h)}`); dup++; } else hashes.set(h, f);
  }
  if (!over && !dup) add("ok", "assets", `${files.length} textures ok (none >2048px, no dupes${big ? `, ${big} >2MB` : ""})`);
}

/* ---- 5. deploy record integrity ---- */
function checkDeploy() {
  const f = R("design/deploy.json");
  if (!existsSync(f)) return add("warn", "deploy", "design/deploy.json absent");
  let d; try { d = JSON.parse(readFileSync(f, "utf8")); } catch (e) { return add("fail", "deploy", `deploy.json invalid: ${e.message}`); }
  for (const k of ["game_id", "url", "source_game"]) if (!d[k]) add("fail", "deploy", `deploy.json missing '${k}'`);
  if (d.game_id && d.url) add("ok", "deploy", `deploy record ok (${d.slug || d.game_id})`);
}

/* ---- 6. JS parses (syntax) ---- */
function checkSyntax() {
  // lightweight: ensure no obvious unbalanced by requiring node --check externally;
  // here we just confirm the core files exist and are non-empty.
  for (const f of ["game/game.js", "game/server.js", "game/strings.js", "game/devtools.js"]) {
    if (!existsSync(R(f))) add("fail", "files", `missing ${f}`);
    else if (statSync(R(f)).size < 50) add("fail", "files", `${f} suspiciously small`);
  }
  if (!results.some(r => r.check === "files")) add("ok", "files", "core source files present");
}

/* ---- run ---- */
checkSyntax();
checkMapTextures();
checkCatalogs();
await checkLocalization();
checkAssets();
checkDeploy();

const fails = results.filter(r => r.level === "fail").length;
const warns = results.filter(r => r.level === "warn").length;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ pass: fails === 0, fails, warns, results }, null, 2));
} else {
  const icon = { ok: "\x1b[32m✓\x1b[0m", warn: "\x1b[33m▲\x1b[0m", fail: "\x1b[31m✗\x1b[0m" };
  console.log("\n  VANTAGE build validation\n  " + "─".repeat(40));
  for (const r of results) console.log(`  ${icon[r.level]} [${r.check}] ${r.msg}`);
  console.log("  " + "─".repeat(40));
  console.log(`  ${fails ? "\x1b[31mFAIL\x1b[0m" : "\x1b[32mPASS\x1b[0m"} — ${fails} fail, ${warns} warn, ` +
    `${results.filter(r => r.level === "ok").length} ok\n`);
}
process.exit(fails ? 1 : 0);
