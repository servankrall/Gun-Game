# Gun Game Arena — AAA Production Guideline

Original competitive FPS (Three.js client · Cloudflare Durable Object server ·
VANTAGE art library). This is the working standard for **visual effects,
gameplay polish, optimization, QA, debugging, bug prevention, performance
validation, accessibility, networking stability, and production readiness**.

It is written *against this codebase*, not as a generic checklist. Every
requirement has an **acceptance target** and a **how-to-verify**, and a **status**
for where Gun Game Arena stands today.

---

## 0. How to use this document

**Severity** (triage + release gating):

| Sev | Meaning | Release rule |
|---|---|---|
| **S0** | Crash, hard desync, unplayable, security | Blocks release. Fix now. |
| **S1** | Broken core loop (shoot/plant/score), major perf | Blocks release. |
| **S2** | Visible defect, minor desync, UX friction | Fix before "final"; may ship in beta. |
| **S3** | Polish, cosmetic, nice-to-have | Backlog. |

**Status legend:** ✅ shipped · 🟡 partial / basic · ⬜ planned.

**Sign-off gates** — a build advances only when the gate's checklist is green:
`DEV → QA → BETA → RELEASE` (see §10). Every gate is verifiable from the
`?dev=1` tooling (§9) and the headless Playwright harness in `scratchpad/`.

**Golden rule for this project:** *readability and stable frame pacing beat
spectacle.* An effect that hurts target acquisition or costs frame time is wrong
even if it looks good. This mirrors the VANTAGE art direction.

---

## 1. Visual effects standards

VFX in this game are **procedural sprites + short-lived pooled objects** — no
video textures, no heavy GPU particle sim. Pools live in `game.js`
(`tracers[]`, `puffs[]`, `flashes[]`) and canvas textures (`flashTex`,
`puffTex`, `blobTex`). New effects follow the same **pool-and-reuse** pattern —
never allocate per-shot in the hot path (§4 memory).

### 1.1 Muzzle flash — tiered by weapon class

| Tier | Weapons | Flash scale | Light | Duration | Status |
|---|---|---|---|---|---|
| Small | pistols/SMG | 0.6–0.9 | soft, radius ≤ 3 m | 40–60 ms | 🟡 single flash sprite |
| Medium | rifles | 0.9–1.2 | radius ≤ 4 m | 50–70 ms | 🟡 |
| Large | LMG/sniper | 1.2–1.6 | radius ≤ 6 m | 60–90 ms | 🟡 |
| Suppressed | +suppressor | 0.25, no light | — | 25 ms | ⬜ |

- **Indoor vs outdoor / night:** flash light intensity scales with scene ambient
  (brighter relative pop indoors/at night). ⬜ (currently constant).
- **Acceptance:** flash is anchored to `g.userData.muzzle` world position, never
  detaches on fast turns, and adds **0 draw calls** beyond the pooled sprite.
- **Verify:** `?dev` → fire while strafing; muzzle sprite tracks the barrel;
  `renderer.info.render.calls` unchanged during fire.

### 1.2 Surface impact effects — one family, surface-keyed

Each surface gets its own **puff tint + debris + decal + sound** triple. Drive it
off the material the ray hit (the VANTAGE `category`/`family`), not the map.

| Surface | Puff tint | Debris | Decal | Status |
|---|---|---|---|---|
| Concrete / stone | grey dust | fragments | pockmark | 🟡 generic puff |
| Metal | spark + grey | none | scratch | ⬜ sparks |
| Wood | tan | splinters | hole | ⬜ |
| Glass | clear shards | shards | crack/opacity | ⬜ |
| Plastic / fabric | muted | none | scuff | ⬜ |
| Sand / mud / snow | light plume | none | crater | ⬜ |
| Water | splash + ripple | droplets | — | ⬜ |

- **Ricochet sparks / tracers:** tracer pool exists ✅; ricochet sparks ⬜.
- **Acceptance:** impact spawns from the pool (no `new` in `fire()`), ≤ 12
  live puffs, auto-recycled by TTL.
- **Verify:** `?dev` counter for `puffs.filter(p=>p.ttl>0).length` stays bounded.

### 1.3 Particles & world FX

Shell casing ejection ⬜ · magazine-drop dust ⬜ · footstep/landing/slide dust ⬜ ·
climbing particles ⬜ · rain/snow/leaf ambient ⬜ · explosion debris (ability boom)
🟡 · smoke (ability) ✅ · water ripple ⬜.
**Budget:** total live particle sprites ≤ 64 on desktop, ≤ 24 on mobile
(`isTouch`), enforced by pool caps.

### 1.4 Objective, round & feedback FX (blood-free — this game is non-gore)

Hit confirmation (crosshair + hitmarker) ✅ · headshot confirm 🟡 (kill only) ·
kill confirmation ✅ · assist indicator ⬜ · spike/objective activation pulse ✅
(`sdBar`, planted banner) · spawn-protection cue ⬜ · healing-station glow ⬜
(Sage self-heal glow 🟡) · round start/end animation 🟡 (banners) · victory/defeat
🟡 (end overlay) · score/kill popup ✅ (killfeed + banner).
**Rule:** confirmation FX are **non-diegetic and instant** (< 120 ms) so they
never mask the enemy.

### 1.5 Screen effects — deliberately restrained

Screen shake **off by default** (motion-safe) ⬜/by-design · camera impulse ⬜ ·
motion blur **off** ✅ · damage vignette ✅ (`#vign`) · flash blind (ability) ✅.
Any shake added later must be **≤ 2° amplitude, ≤ 150 ms**, and gated behind the
accessibility toggle (§8).

---

## 2. UI / UX feedback effects

| Element | Standard | Status |
|---|---|---|
| Button hover/press/release | CSS transition ≤ 120 ms, clear state | ✅ |
| Menu / loadout / settings transitions | ≤ 200 ms, no layout jump | 🟡 |
| Crosshair | static + kill-state color flip | ✅ (`#xhair.kill`) |
| Hit marker | ≤ 120 ms pop | ✅ |
| Damage indicator (directional) | shows hit direction | ⬜ |
| Kill feed | fade in/out, own kills highlighted | ✅ |
| Health / armor / ammo | animated value, no flicker | ✅ HP/ammo; armor ⬜ |
| Reload / cooldown | radial or bar, matches real timing | ✅ (`abHud`, reload) |
| Capture / plant progress | bar bound to server timer | ✅ (`sdBar`) |
| Objective pulse / compass / waypoint / ping | map cues | 🟡 site labels; ping ⬜ |
| Notification / achievement / tutorial highlight | non-blocking | ⬜ |

**Acceptance:** all HUD is built idempotently in JS (`ensureBattleDom` /
`ensureTouchDom`) so it survives edge-cached HTML shells, and every element has a
string in `strings.js` (no hard-coded copy). **Verify:** load a stale shell in
`?dev`; HUD still assembles; `Object.values(STR)` covers all visible text.

---

## 3. Sound reference rules

WebAudio via `AudioMan`. Missing assets must **degrade silently** (already does).

| Bank | Requirement | Status |
|---|---|---|
| Weapon fire | per-class sample, pitched variance ±5% | ✅ pistol/rifle/shotgun |
| Reload / magazine / bolt | distinct, matches animation length | 🟡 reload only |
| Footsteps × surface | metal/wood/concrete/carpet/grass/water/glass/mud/sand/snow | ⬜ |
| Movement | jump / land / slide / vault / ladder | ⬜ |
| Doors | open / close | ⬜ (no doors yet) |
| Ambience | interior / exterior / wind / rain | ⬜ |
| Machine loops | generator hum / electrical buzz / fan | ⬜ |

- **Surface footstep matrix** keys off the same surface id as §1.2 impacts — one
  lookup table serves both.
- **Mix rules:** enemy footsteps and shots are **never** quieter than own; a
  hard priority bus keeps combat cues audible over music/ambience.
- **Verify:** `AudioMan` never throws on a 404 (confirmed — local runs 404 the
  audio and still play); positional falloff monotonic with distance.

---

## 4. Bug prevention (engineering practices, by subsystem)

Each risk lists the **practice** that prevents it and the **detection** that
catches regressions.

### 4.1 Geometry, collision & placement
Floating props · z-fighting · texture stretch · UV seams · flipped normals · bad
pivots · overlapping/missing collision · invisible/one-way walls · stuck spots ·
bad spawns · geometry/camera/weapon/animation clipping · ragdoll blow-ups ·
infinite fall / fall-through / spawn-inside-object.

- **Practice:** authored to the VANTAGE grid + `MESH_SPEC.md` pivots; every
  playable volume has a wall/floor with collision; spawns are validated against
  solids at build time (this game already filters spawn candidates with
  `pointInSolid`); the arena is fully bounded by four collision walls; a `y < -3`
  floor-catch teleports the player back to a valid spawn.
- **Detection:** automated "spawn-and-settle" pass — drop the player at every
  spawn, step physics 2 s, assert on ground and inside bounds (extend
  `scratchpad/solotest.mjs`). Z-fighting: polygon offset on decals/coplanar faces.

### 4.2 Assets, materials & references
Duplicated assets · missing material/texture · broken/prefab refs · bad lightmap
UVs · broken navmesh / AI paths · missing LOD transitions.

- **Practice:** textures are content-addressed by name and generated from the
  catalog (`materials.json`) so a name always resolves; the game loads by
  semantic name (`M.floor`, `M.wall`, `M.crate`) with a guaranteed asset.
- **Detection:** a preflight that walks every `MAPS[*]` texture name + every
  `WEAPONS`/`AGENTS` reference and asserts the file/ID exists before packaging.

### 4.3 Rendering
Incorrect occlusion · overdraw · shadow flicker · light leak · reflection
artifacts · broken particles · invalid/slow shaders · compression/mipmap artifacts.

- **Practice:** Lambert materials + baked-free VANTAGE albedo/normal keep shader
  permutations near-zero; `RepeatWrapping` + `anisotropy = 4` + mipmaps kill
  shimmer; transparent sprites use `depthWrite:false` to avoid sort artifacts.
- **Detection:** `?dev` HUD shows `calls` and `tris`; watch for overdraw spikes
  when many sprites overlap; cap the sprite pool (§1.3).

### 4.4 Memory & performance
Streaming hitches · memory leaks · CPU/GPU spikes · GC churn · per-frame
allocations · frame-pacing instability.

- **Practice:** **fixed-timestep accumulator** (`CFG.step = 1000/60`) decouples
  sim from render; object pools for tracers/puffs/flashes; reuse `THREE.Vector3`
  scratch; no `new` in `update()`/`fire()`; `dprCap = 1.5` caps fragment cost.
- **Detection:** `?dev` FPS + `renderer.info`; a 60-second soak asserting heap
  and draw calls are flat (no monotonic growth); frame-time p99 within budget (§6).

### 4.5 Networking
Desync · duplicate events · packet flooding · invalid replication · animation /
weapon / scoreboard / health / ammo desync. → see §7.

---

## 5. Quality-assurance checklist

Run per build; each row is **pass/fail** with the listed method. "Auto" = covered
by a Playwright script in `scratchpad/` (`solotest`, `sdtest`, `sdservertest`,
`mobiletest`).

| Area | Pass criterion | Method |
|---|---|---|
| Collision | no stuck/fall-through at any spawn or cover | Auto (spawn-settle) |
| Textures / materials | every `MAPS`/weapon/agent ref resolves; no 404 except optional audio | Preflight |
| Animations | view-model switch on equip; no T-pose/clip | Auto + visual |
| Sound | fire/reload/hit play; no throw on missing | Auto (console clean) |
| Particles / decals | pools bounded, recycle by TTL | `?dev` counters |
| Lights | no flicker/leak across maps | Visual per map |
| Props / weapons | all 19 weapons buyable & fire; all 6 agents selectable | Auto (buy loop) |
| Spawns / objectives | teams balanced; A/B/C plant + defuse score | Auto (`sdtest`) |
| Interactions / pickups | plant/defuse (F/USE), buy (B/🛒), ability (Q/SKILL) | Auto |
| Menu / UI / buttons / tooltips | all build on cached shell; all wired | Auto (`staleflow`) |
| Localization | every visible string from `strings.js` | grep audit |
| Key bindings / controller / touch | KB+mouse, gamepad, touch all drive `commands()` | Auto (`mobiletest`) |
| Graphics/audio/network presets | each preset applies without error | Manual matrix |

---

## 6. Performance targets & budgets

| Metric | Desktop target | Mobile target | Source of truth |
|---|---|---|---|
| Frame rate | 120+ fps (144 cap) | 60 fps | `?dev` FPS |
| Frame-time p99 | ≤ 8.3 ms | ≤ 16.6 ms | soak profiler |
| Draw calls / frame | ≤ 150 | ≤ 80 | `renderer.info.render.calls` |
| Triangles / frame | ≤ 300k | ≤ 120k | `renderer.info.render.triangles` |
| Input latency | ≤ 2 frames click→shot | same | fixed-step sim |
| Load to menu | ≤ 2 s | ≤ 3.5 s | nav-timing |
| Match start (build world) | ≤ 400 ms | ≤ 700 ms | `startMatch` timer |
| JS heap after 10-min soak | flat (no leak) | flat | perf.memory |
| Shader permutations | ≤ ~10 | ≤ ~10 | Lambert-only |

Today the arena runs at **~5–9 draw calls / ~50–60 tris** (dev HUD) — orders of
magnitude under budget, which is the headroom that lets mobile hold 60. Enforcement:
`dprCap`, pooled VFX, `MeshLambertMaterial`, instanced/batched crates, RepeatWrapping
tiling, frustum culling (Three default), and the fixed-timestep loop.
**Validation:** ship a `--soak` Playwright run that drives 10 minutes of combat
and asserts fps floor, flat heap, and bounded draw calls before any RELEASE tag.

---

## 7. Networking stability

**Authority model:** the Durable Object `GameServer` is authoritative for
**round/team/score/spike** state; clients are authoritative for their own
**position/aim** with server **validation** on damage. This split is intentional
for a browser game — it keeps latency low while making the competitive state
(who won the round) unforgeable.

| Risk | Mitigation | Status |
|---|---|---|
| Damage forgery | server caps per-hit damage (`MAX_SHOT_DMG`), validates weapon id | ✅ |
| Friendly fire / team grief | server drops same-team hits | ✅ |
| Team stacking | server balances teams on join | ✅ |
| Duplicate / flooded events | per-connection rate limit + idempotent event ids | 🟡 (add token bucket) |
| Invalid state replication | server is sole writer of round state; clients render snapshots | ✅ |
| Score / spike desync | authoritative `roundend`/`planted`/`defused` broadcasts | ✅ |
| Health / ammo desync | server tracks elimination; client predicts, reconciles on `died`/`round` | 🟡 |
| Animation / weapon desync | weapon id in snapshot (`onSnap`), remotes equip on change | ✅ |
| Disconnect / reconnect | client reconnect with exponential backoff; server seat cleanup on `leave` | ✅ |
| Lag compensation / rollback | not present — acceptable for this scope; document as known | ⬜ |

**Acceptance:** two clients see identical round number, score, and spike state
within one tick; a mid-round refresh rejoins the correct team and phase.
**Verify:** `scratchpad/sdtest.mjs` (two-tab E2E) + `sdservertest.mjs` (21
protocol checks) — both must pass before shipping any netcode change.

---

## 8. Accessibility

| Feature | Standard | Status | Note |
|---|---|---|---|
| Colorblind modes | 3 palettes; never encode state by color alone | ⬜ | team colors also differ in shape/label |
| Subtitles / captions | all VO + key SFX cues | n/a→⬜ | no VO yet; add SFX captions with audio |
| Scalable UI | HUD scale 75–150% | 🟡 | uses `clamp()`/rem; add a scale slider |
| High-contrast mode | boost HUD/outline contrast | ⬜ | |
| Adjustable crosshair | color/size/gap/dot | 🟡 | static crosshair; expose vars |
| Custom HUD | toggle elements | ⬜ | |
| Audio visualization | on-screen footstep/shot direction | ⬜ | pairs with §2 damage indicator |
| Motion reduction | reduce/disable camera motion | ✅ | shake off by default; blur off |
| Screen-shake toggle | on/off | ✅(n/a) | no shake to toggle yet |
| Camera sensitivity | slider + per-axis + ADS multiplier | 🟡 | `sens` is a constant (0.0023) — promote to setting |
| FOV slider | 70–110 | 🟡 | `CFG.fov = 75` constant — promote to setting |
| Key rebinding | full remap | ⬜ | `BIND` map is static; add a remap UI |
| Controller remapping | full remap | ⬜ | gamepad mapping is fixed in `padState` |

**Next accessibility wins (cheap, high-impact):** promote `sens` and `CFG.fov`
to a settings panel; add a crosshair customizer (the vars already exist in CSS);
add key rebinding over the existing `BIND` table.

---

## 9. Debugging & tooling

- **`?dev=1`** exposes `window.__gg` (`ents`, `player`, `match`, ability/hud
  hooks) and shows the on-screen **FPS / draw-calls / tris** HUD — the primary
  live profiler.
- **Headless harness** (`scratchpad/*.mjs`, Playwright + local static server):
  `solotest` (solo DM flow), `sdtest` (two-tab S&D E2E), `sdservertest`
  (protocol), `mobiletest` (touch controls + movement), `staleflow`
  (edge-cached-shell resilience). These are the regression net — run them before
  every deploy.
- **Deterministic drives:** `window.__gg` lets tests drive movement/fire/ability
  without real input, so results are stable under headless rAF throttling.
- **Repro discipline:** every S1/S0 bug gets a failing script in `scratchpad/`
  *before* the fix, so the fix is proven and the regression is guarded.

---

## 10. Production-readiness release gates

A build advances only when the gate is fully green.

**DEV → QA**
- [ ] `node --check` clean on all JS; catalogs valid JSON
- [ ] `solotest` + `mobiletest` pass; zero page errors in console
- [ ] No per-frame allocation added to hot paths (code review)

**QA → BETA**
- [ ] Full §5 QA checklist green (all Auto scripts pass)
- [ ] `sdtest` + `sdservertest` pass (netcode)
- [ ] Perf budgets (§6) met on a mid-tier phone + desktop
- [ ] 10-minute soak: flat heap, fps floor held, bounded draw calls
- [ ] All visible text sourced from `strings.js`

**BETA → RELEASE**
- [ ] Zero open S0/S1
- [ ] Accessibility: sensitivity + FOV + key-rebind shipped (min bar), motion-safe defaults
- [ ] Cross-device pass: desktop (KB/mouse + gamepad) and mobile (touch, portrait hint)
- [ ] Edge-cache resilience verified on the live URL (`staleflow` against prod)
- [ ] Deploy record updated (`design/deploy.json`), commit tagged, previews attached

**Live-service hygiene (post-release):** keep the headless harness green in CI on
every change; treat any new desync or frame-pacing regression as S1; add each new
map/weapon/agent to the QA scripts the same day it lands.

---

### Current snapshot (Gun Game Arena, this branch)

**Solid:** fixed-timestep loop, pooled VFX, authoritative S&D netcode with damage
caps + team balance + reconnect, mobile touch controls, edge-cache-resilient HUD,
VANTAGE PBR surfaces, and a real headless regression harness — the game is at a
**shippable BETA** bar for its scope.

**Top backlog (ordered):** (1) settings panel — sensitivity/FOV/crosshair/rebind
(§8); (2) surface-keyed impacts + footstep audio (§1.2/§3); (3) directional damage
indicator (§2); (4) net rate-limiting + health/ammo reconciliation hardening
(§7); (5) `--soak` perf-validation script in CI (§6).
