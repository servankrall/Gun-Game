// Headless smoke test: serve ./game, load the page, click DEPLOY, report console
// errors and basic state. WebGL may be software-rendered or absent headless —
// a blank canvas alone is not a failure; JS errors are.
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join } from "path";
import { chromium } from "playwright";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".json": "application/json" };
const root = new URL("../game", import.meta.url).pathname;

const srv = createServer(async (req, res) => {
  const p = join(root, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  try {
    const data = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(8931, r));

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,   // pinned browser fallback for CI/sandboxes
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [], missing = [];
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
page.on("response", r => { if (r.status() === 404) missing.push(r.url()); });

await page.goto("http://127.0.0.1:8931/", { waitUntil: "networkidle" });
const title = await page.textContent("#mTitle");
console.log("menu title:", JSON.stringify(title));
await page.click("#startBtn");
await page.waitForTimeout(3500);
const hudVisible = await page.evaluate(() => !document.getElementById("hud").classList.contains("hidden"));
const ammo = await page.textContent("#ammoN");
console.log("hud visible:", hudVisible, "| ammo:", JSON.stringify(ammo));
console.log("404s:", missing.length ? missing : "none");
console.log("console errors:", errors.length ? errors : "none");
await page.screenshot({ path: "smoke.png" });
await browser.close();
srv.close();
console.log("SMOKE DONE", hudVisible && errors.length === 0 ? "PASS" : "CHECK");
