# Project VANTAGE — Game Design Document

**Shipping title:** Gun Game Arena · **Codename:** VANTAGE · **Genre:** original
competitive tactical FPS (browser-native, Three.js client + Cloudflare Durable
Object servers) · **Status:** playable BETA for its scope, live at
`sweet-cloud-511.higgsfield.gg`.

This is the top-level design bible. It is **grounded in the real build** — every
system carries a status (✅ shipped · 🟡 partial · ⬜ planned) and defers detail
to the companion documents rather than repeating them.

### Documentation map
| Doc | Owns |
|---|---|
| **This GDD** | Vision, pillars, loops, systems, roadmap — the umbrella |
| `PRODUCTION_GUIDELINE.md` | VFX, QA matrix, perf budgets, netcode hardening, release gates |
| `UI_DESIGN_SYSTEM.md` + `ui/vantage-ui.html` | HUD, menus, tokens, icons, components |
| `ART_DIRECTION.md` + `MESH_SPEC.md` | VANTAGE materials, palette, prop/LOD contract |
| `../art/` | Procedural material, skin & decal library |

---

## 1. Vision

A premium, **original** competitive tactical FPS built on precision gunplay,
strategic teamplay, fair competition, and low-latency responsiveness — designed
for long-term live service. VANTAGE establishes its **own** identity (the VANTAGE
visual language, the HAVEN map family, its agents and economy) and depends on the
distinctive mechanics, presentation, or naming of **no existing commercial
shooter**.

Because it runs in the browser, VANTAGE's differentiator is **friction-free
access** — no install, instant play on desktop and mobile, shareable match links
— without conceding competitive integrity.

## 2. Design pillars

Competitive integrity · skill expression · high readability · low input latency ·
predictable mechanics · strategic teamplay · reward precision · fast to learn,
deep to master · high replayability · fair matchmaking · accessibility.

**Operating rule (shared with art & UI):** if a choice hurts readability, target
acquisition, or fairness, it loses — even if it looks or sounds better.

## 3. Player-experience goals → how the systems deliver them

| Goal | Mechanism | Status |
|---|---|---|
| Every death is understandable | server-validated damage, kill feed + killer name, damage-direction cue | ✅ feed/name · 🟡 direction cue |
| Every victory feels earned | no in-round respawn in S&D, economy tradeoffs, first-to-13 | ✅ |
| Every weapon has a clear role | 19 weapons across 7 classes with distinct stat tradeoffs (§8) | ✅ |
| Every map supports multiple strategies | HAVEN: 3 sites (A/B/C) + mid, multi-route | ✅ (one S&D map; more ⬜) |
| Every match rewards adaptation | buy economy, agent abilities, side swap at 12 | ✅ |
| Fairness over randomness | fixed-timestep sim, deterministic spread seeds, server authority on state | ✅ core · 🟡 hit-reg (§9) |

## 4. Core game loop

`Main menu → party/room → matchmaking → map reveal → load → warmup → match →
statistics → progression → rewards → return to lobby.`

**Current build:** `Main menu (callsign) → ONLINE (public shard) or PLAY WITH
FRIENDS (private link) or SOLO → random map reveal → agent select → match →
end screen → menu.` Matchmaking, persistent progression, and rewards are **⬜
planned** (§12). Party/room and map-reveal are ✅.

## 5. Match flow

Lobby init → server validation → auth → asset preload → map stream → **spawn
validation** → warmup countdown → match start → gameplay → mid-match events →
round transition → match end → stats → reward calc → progression update → replay
save → return to lobby.

| Stage | Status |
|---|---|
| Server validation / seat assignment / team balance | ✅ (`GameServer.onJoin`) |
| Asset preload / map stream / **spawn validation** | ✅ (spawns filtered vs solids) |
| Warmup countdown → start | 🟡 (buy phase serves as warmup) |
| Round transitions (buy → live → end, side swap at 12) | ✅ |
| Match end → stats → return | ✅ (end screen) · stats persistence ⬜ |
| Reward calc · progression update · replay save | ⬜ |

## 6. Player state machine

Target states and where the build stands:

| State | Status | State | Status |
|---|---|---|---|
| Idle / Walking / Running | ✅ | Reloading | ✅ |
| Jumping / Falling / Landing | ✅ | Inspecting | ⬜ |
| Crouching | ⬜ | Healing / Using equipment | 🟡 (ability casts) |
| Sliding | ⬜ | Switching weapon | ✅ |
| Vaulting | ⬜ | Melee | ✅ (knife) |
| Interacting (plant/defuse/buy) | ✅ | Dead / Respawning | ✅ (respawn: DM only, S&D none) |
| — | — | Spectating / Disconnected / Reconnecting | ✅ |

Movement is a small, explicit state set today; crouch/slide/vault are the next
locomotion additions and must preserve the movement guarantees in §7.

## 7. Movement design

Responsive acceleration · predictable momentum · consistent friction · reliable
collision · smooth stairs · **no unexpected boosts, no random variance,
deterministic jump arcs, stable camera, no motion sickness.**

- **How it's guaranteed:** a **fixed-timestep accumulator** (`CFG.step =
  1000/60`) runs the simulation deterministically regardless of render rate;
  acceleration/friction are constants; jump is a fixed impulse + gravity →
  identical arc every time; camera has no procedural shake (motion-safe by
  default). ✅
- **Collision:** AABB solids for walls/crates + fully bounded arena + a
  `y < floor` catch that returns the player to a valid spawn (no fall-through /
  infinite fall). ✅
- **Sensitivity/FOV:** currently constants (`sens 0.0023`, `fov 75`) — promote
  to player settings (see UI §10 accessibility). 🟡

## 8. Weapon design

Every class serves a distinct tactical purpose; **balance emerges from
tradeoffs**, never from randomness. Axes: effective range · rate of fire ·
magazine · reload · recoil profile · movement penalty · handling speed ·
accuracy · damage falloff · armor pen · muzzle visibility · sound signature.

- **Current arsenal:** 19 weapons across **sidearms · SMGs · shotguns · rifles ·
  snipers · LMGs · melee**, each with its own damage/fire-rate/spread/reload and
  a buy cost. ✅ The economy (credits, 200 per kill, weapon carries across
  respawns in DM) makes buy decisions meaningful. ✅
- **Gaps to full AAA parity:** per-weapon recoil *patterns* (learnable, not
  random), damage falloff curves, and armor-penetration tiers are the next
  depth pass. 🟡/⬜

## 9. Hit registration

Server-authoritative validation · lag compensation · reliable collision volumes ·
consistent hitboxes · deterministic bullet sim · client prediction · server
reconciliation · anti-desync.

- **Today:** clients simulate their own shots for responsiveness and report hits;
  the server **validates and caps** damage (`MAX_SHOT_DMG`), rejects same-team
  hits, and owns elimination/round state. This is a pragmatic
  client-authoritative-with-server-validation model appropriate for a browser
  title. ✅ prediction + authority · ✅ damage cap/validation.
- **Roadmap to competitive-grade:** move the shot ray to server-side validation
  against replicated positions, add **lag compensation** (rewind to the
  shooter's tick) and reconciliation. This is the single biggest step from BETA
  toward ranked integrity. ⬜ — tracked as S1 in `PRODUCTION_GUIDELINE.md` §7.

## 10. Networking

Authoritative servers · reliable state sync · efficient bandwidth · snapshot
interpolation · client prediction · server correction · packet-loss recovery ·
reconnect · rate limiting · connection-quality monitoring.

| Capability | Status |
|---|---|
| Authoritative server (Durable Object `GameServer`, one per room) | ✅ |
| Reliable round/team/score/spike replication (server is sole writer) | ✅ |
| Client prediction (movement/aim) + server correction on death/round | 🟡 |
| Snapshot interpolation of remote players | 🟡 (position snapshots; interpolation basic) |
| Reconnect with exponential backoff; seat cleanup on leave | ✅ |
| Rate limiting / packet flood protection | ⬜ (add token bucket) |
| Connection-quality monitoring (ping/loss surfaced in HUD) | 🟡 (HUD chips designed; live metrics ⬜) |

Full protocol + desync-risk table live in `PRODUCTION_GUIDELINE.md` §7; two-tab
E2E + 21-check protocol tests gate every netcode change.

## 11. Matchmaking

Skill-based · connection-quality-prioritized · region-aware · party balancing ·
queue-health monitoring · new-player protection · smurf signals · AFK detection ·
disconnect handling · backfill.

**Status: ⬜ planned.** Today matchmaking is **shard-based** — `ONLINE` drops
players into public rooms (`pub-1..4`), `PLAY WITH FRIENDS` uses a private
`?room` link. The first SBMM step is an MMR per account (needs the progression
backend, §12) plus region selection and party balancing; connection quality is
already a first-class signal in the HUD design.

## 12. Progression & 13. Live service

Account level · weapon mastery · profile stats · challenges · achievements ·
season progress · titles · cosmetics · profile customization · long-term
milestones — refreshed by season rotation, limited-time events, daily/weekly
missions, balance & bugfix releases, community challenges, content drops, and
analytics/perf review.

**Status: ⬜ planned** (no persistence yet — credits are per-match only). This is
the largest greenfield area and needs a backend (identity + storage). The UI for
all of it — career, battle pass, missions, store, post-match XP/rank — is already
specified and mocked in `UI_DESIGN_SYSTEM.md` §12, and cosmetics have a ready
content source in the **VANTAGE skin themes** (20 finishes) and material library.

## 14. Quality standards & QA

Stable frame time · fast streaming · reliable networking · consistent UI ·
deterministic gameplay · minimal bugs · professional audio mix · optimized
GPU/CPU · accessible controls.

- **Bug-prevention checklist** (spawns, collision, nav, occlusion, texture/
  material/shader/particle/anim/audio/localization refs, save integrity, network
  replication, replay, spectator, reconnect, graphics presets, accessibility,
  controller, remap): specified with prevention practice + detection in
  `PRODUCTION_GUIDELINE.md` §4. Spawn/collision/asset-ref/network checks are ✅
  automated in the headless harness; replay/save/spectator ⬜ (feature-gated).
- **QA test matrix** (movement · weapon · interaction · UI · audio · animation ·
  physics · network · performance · memory · loading · save/load · stress ·
  regression · compatibility · accessibility · localization · controller ·
  cross-platform): mapped to the Playwright scripts in `scratchpad/`
  (`solotest`, `sdtest`, `sdservertest`, `mobiletest`, `staleflow`) in
  `PRODUCTION_GUIDELINE.md` §5. Every S0/S1 bug gets a failing repro before its fix.

## 15. Performance targets

Stable frame pacing · low input latency · fast loading · low memory
fragmentation · minimal shader stutter · efficient streaming · predictable
CPU/GPU frame time · minimal draw calls · scalable settings.

Concrete budgets and the current numbers (the arena runs at **~5–9 draw calls /
~50–60 tris**, orders of magnitude under budget — the headroom mobile 60 fps
relies on) are in `PRODUCTION_GUIDELINE.md` §6, enforced by the fixed-timestep
loop, pooled VFX, Lambert materials, `dprCap`, and tiling/atlasing.

## 16. Content pipeline

`Concept → review → blockout → modeling → UV → baking → texturing → rigging →
animation → integration → testing → optimization → QA → release candidate →
ship.`

- **Surfaces/skins/decals** are **procedural and on-demand** via the VANTAGE
  generator (`art/tools/*`) — concept-to-shippable-material collapses to a
  catalog row (`ART_DIRECTION.md`). ✅
- **Geometry** (blockout → model → UV → bake → rig → anim) follows the grid,
  pivot, LOD, and collision contract in `MESH_SPEC.md`. Meshes are authored in a
  DCC, then dressed with VANTAGE materials + decals. 🟡 (contract defined;
  content authored as needed)
- **Integration/QA/RC** run through the headless harness + release gates (§14).

## 17. Roadmap (BETA → 1.0 → live)

1. **Competitive integrity pass** — server-side shot validation + lag
   compensation + reconciliation (§9); net rate-limiting (§10). *Highest priority.*
2. **Settings & accessibility** — sensitivity/FOV/crosshair/keybind panel
   (UI §10) — cheapest high-impact win.
3. **Progression backend** — accounts, MMR, mastery, stats persistence →
   unlocks SBMM (§11) and live service (§12).
4. **Content depth** — more S&D maps in the HAVEN family, recoil patterns +
   falloff/armor tiers (§8), surface-keyed impacts + footstep audio.
5. **Live-service cadence** — seasons, missions, store fed by VANTAGE cosmetics.

### Where VANTAGE stands
A cohesive, original, **shippable** competitive FPS core: deterministic
fixed-step gameplay, 19 weapons + 6 agents + economy, authoritative 5v5 Search &
Destroy with plant/defuse and side-swap, solo warmup deathmatch, desktop +
mobile, an original art/UI identity, and a real automated regression harness.
The path to ranked-grade 1.0 is well-defined and led by the hit-registration
integrity pass.
