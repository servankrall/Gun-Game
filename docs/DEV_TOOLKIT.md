# VANTAGE — Developer Toolkit & Diagnostics Framework

Internal tooling for building, profiling, debugging, validating, balancing, and
operating Gun Game Arena. Philosophy: **fast iteration · stable builds ·
reproducible bugs · automated validation · data-driven balance · clear
diagnostics · reliable deployment.** Engine-agnostic in concept; the shipped
pieces are browser/Three.js-native and dependency-free.

Status: ✅ shipped · 🟡 partial · ⬜ specified (backend needed).

---

## 1. What ships in the repo today

| Tool | Where | Status |
|---|---|---|
| **In-game dev console** (`~`) — commands, cvars, history, autocomplete, categories | `game/devtools.js` | ✅ |
| **Debug overlay** (`F1`) — fps/frame/heap/draws/tris/verts/geoms/textures/entities/net | `game/devtools.js` | ✅ |
| **Logging system** — levels + categories + ring buffer, console + error capture | `game/devtools.js` | ✅ |
| **Telemetry buffer** — session/match/perf/accuracy/deaths/heatmap points | `game/devtools.js` | ✅ |
| **Crash capture + diagnostic export** — `window.onerror` → downloadable JSON | `game/devtools.js` | ✅ |
| **Visual debug** — hitbox wireframes, spawn markers | `game/devtools.js` | 🟡 |
| **Build validator** — refs, catalogs, localization, asset size/dupes, deploy | `tools/validate_build.mjs` | ✅ |
| **QA automation** — Playwright suites driving real gameplay | `scratchpad/*.mjs` | ✅ |

Everything in `devtools.js` is loaded **only under `?dev`** (dynamic import in
`game.js`), so production ships without it and pays zero cost — verified: no
`?dev` → module never fetched, `window.__devtools` undefined, zero console DOM.

---

## 2. Developer console  (`~` / backquote)

Command registry with **categories, history (↑/↓), autocomplete (Tab), search**,
per-command help, execution logging, and a **cvar** system for live variable
editing. Safe execution (each command is try/caught; errors print, never crash).

```
help [category]      list commands, grouped
find <text>          search commands + cvars
clear                clear output
loglevel <lvl>       min level shown (debug|info|warn|error|critical)
log <n> [cat]        dump last N log entries (optionally by category)
overlay              toggle the perf overlay
hitbox on|off        entity hitbox wireframes
spawns on|off        spawn markers
state | net          dump game / network state
tp <x> <z>           teleport the player
heal [hp]            set player HP (default 100)
timeleft <s>         set match time remaining
telemetry | report   print telemetry / a full diagnostic report
export report|logs|telemetry|crash    download JSON
crashtest            throw an async error (verifies global capture)
```

**cvars** (live-editable, read-only ones marked): `fov`, `dprCap`, `timescale`,
`fps*`, `draws*`, `heap*`, `session*`. Read/print with `fov`; set with `fov 100`.
Adding a command or cvar is one line — `this.cmd(name, cat, desc, fn)` /
`this.addCvar(name, get, set, desc, cat)`.

*Remote/permission-tiered console:* the same registry is transport-agnostic — a
production build gates destructive commands behind a permission level and can
accept commands over an authenticated channel. ⬜ (single local tier today).

---

## 3. Debug overlay  (`F1`)

Live per-frame panel: **FPS · frame ms (EMA) · JS heap · draw calls · triangles ·
verts · programs · geometries · textures · entity count · player pos · HP · net
state · server tick**, color-coded against budget. Sourced from
`renderer.info`, `performance.memory`, and the game context — the same numbers
the [production guideline](PRODUCTION_GUIDELINE.md) §6 budgets against.

The wider debug-overlay/visual-debug wishlist (CPU/GPU split timing, LOD/occlusion
viz, nav mesh, AI paths, animation state, audio sources, physics bodies,
replication/interpolation delay, input latency) maps onto this same panel + the
`window.__gg`/context hooks as those systems land; hitboxes and spawn zones are
implemented now.

---

## 4. Logging system

Ring buffer (500 entries) with **levels** (debug/info/warn/error/critical) and
**categories** (gameplay/network/animation/audio/physics/rendering/ai/input/ui/
save/developer), each entry timestamped. `console.warn`/`error`, uncaught errors,
and unhandled rejections are captured automatically. Filter by level (`loglevel`)
or category (`log 50 network`). Feeds the diagnostic report.

---

## 5. Telemetry

Accumulated locally per session, zero backend required, exportable as JSON:

- Session length, match count, avg/min FPS (1 Hz samples), error count.
- Shots / hits / **accuracy**, jumps, interactions, deaths, **death locations**
  (heatmap points).
- Snapshot on demand (`telemetry`) or inside every diagnostic report.

The game calls optional hooks — `__devtools.onShot/onHit/onJump/onInteract/
onDeath(x,z)/onMatch()` — to feed gameplay counters; wire them at the relevant
call sites to enrich balance data. **Sink:** today it exports/downloads; point
`export` at an HTTPS collector (or POST on match-end) to centralize. ⬜ backend.

**Balance analytics** (weapon pick/win/accuracy, damage per match, kill
distribution, ability/economy usage, map win-rate, spawn heatmaps, round length,
skill distribution) are the aggregate view over this same event stream once a
collector exists — the client-side capture points are the foundation.

---

## 6. Crash reporting & diagnostics

`window.onerror` + `unhandledrejection` build a **diagnostic report** and persist
the latest to `localStorage`; `export crash` downloads it. A report contains:

- **Crash signature** + stack (top 20 frames), **session id**, timestamp.
- **Game state** (map, mode, timeLeft, entity/alive counts, player hp/pos/weapon/
  agent/credits/team, net id/room/connected).
- **Settings** (fov, dprCap, step), **perf** (fps, frame ms, heap, draws, tris).
- **Hardware** (GPU/vendor via `WEBGL_debug_renderer_info`, max texture size),
  **OS/env** (UA, platform, cores, deviceMemory, DPR, resolution, touch).
- **Recent commands** (15) and **recent logs** (60).

Signature-based grouping is built in (`sig()`), ready for server-side dedupe. ✅
local capture/export · ⬜ upload endpoint.

---

## 7. Build validation  — `tools/validate_build.mjs`

Static preflight over the repo; **exit code 1 on any FAIL** (CI-ready), `--json`
for machines. Checks:

- **Map → texture references** resolve (albedo + normal for every `floor/wall/
  crate` name in `game.js`).
- **Catalogs** (`materials.json`, `decals.json`) valid JSON, required fields,
  unique ids.
- **Localization** — `STR` has the expected top-level keys; flags `STR.*`
  referenced in `game.js` but absent.
- **Assets** — oversized textures (>2048px), duplicate content (md5), >2 MB flags.
- **Deploy record** integrity (`game_id`, `url`, `source_game`).
- **Core files** present and non-trivial.

Current repo: **PASS — 0 fail, 0 warn, 7 ok.** The missing-material/texture/
reference and duplicate/oversized-asset items from the brief's build-validation
list are covered here; shader/blueprint/prefab items are engine-specific and
N/A for this Three.js title.

---

## 8. QA automation

Headless Playwright suites in `scratchpad/` drive **real gameplay**, not mocks,
via the deterministic `window.__gg` hooks:

| Suite | Covers |
|---|---|
| `solotest.mjs` | solo DM flow, movement, weapons, buy |
| `sdtest.mjs` | two-tab S&D E2E — teams, plant/defuse, score sync |
| `sdservertest.mjs` | 21 server-protocol checks |
| `mobiletest.mjs` | touch controls + movement + rotate hint |
| `staleflow.mjs` | edge-cached-shell resilience |

Maps to the QA test matrix (movement/weapon/interaction/UI/network/perf/
regression/accessibility) in [production guideline](PRODUCTION_GUIDELINE.md) §5.
Add a `--soak` perf run (10 min, assert fps floor + flat heap + bounded draws)
as the standing memory-leak/stress gate. Every S0/S1 bug gets a failing script
before its fix.

---

## 9. LiveOps, content pipeline, security  (architecture — backend-gated)

These need a backend (identity + storage + a control plane) the browser build
doesn't yet have; the design is set so the client is ready:

- **LiveOps** — feature flags, content scheduling, event activation, daily/weekly
  challenges, season rotation, broadcast, maintenance/emergency mode, hotfix &
  content rollback, server status. The **deploy pipeline already supports
  rollback**: `design/deploy.json` pins the exact `game_id` + `source_game` zip,
  and redeploying a prior zip is a one-command revert. ⬜ (flags/scheduling backend).
- **Content pipeline** — import → naming/folder validation → metadata/thumbnail →
  dependency analysis → version → review/approval → package → deploy → rollback.
  Surfaces/skins/decals are **procedural & on-demand** (`art/tools/*`), collapsing
  most of this to a catalog row; geometry follows `MESH_SPEC.md`; packaging is the
  media_upload → deploy flow in `design/deploy.json`. 🟡
- **Security monitoring** — auth, session validation, rate limiting, integrity
  checks, suspicious-session/replay validation, server health, audit logging,
  permissions. The authoritative `GameServer` already enforces damage caps,
  friendly-fire, and team balance; the netcode hardening (rate limiting,
  server-side hit validation) is the [GDD](GAME_DESIGN_DOCUMENT.md) §9/§10
  roadmap. ⬜/🟡.

---

## 10. Conventions

- **Branch:** feature work on `claude/*`; deploy record updated on every ship.
- **Naming:** `snake_case` assets & material ids; `camelCase` JS; `STR.*` for all
  player-facing text (validated by §7).
- **Release checklist / bug & feature templates / review & testing guidelines:**
  the gates in [production guideline](PRODUCTION_GUIDELINE.md) §10 are the release
  checklist; a bug report = a failing `scratchpad/` repro + a diagnostic export
  (§6); reviews follow the same doc's severity model.
- **`?dev` is the master switch** — all diagnostics are gated by it; production is
  never affected.
