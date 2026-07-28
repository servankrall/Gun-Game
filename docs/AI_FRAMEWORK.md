# VANTAGE — AI Framework

The bot AI for Gun Game Arena: a modular, configurable, debuggable system for
training, offline play, and automated testing. It is **original** and lives in
`game/game.js` (`botThink` and helpers), driven by `CFG.bot`, with live tuning
and visualization through the developer console (`docs/DEV_TOOLKIT.md`).

Status: ✅ shipped · 🟡 partial · ⬜ specified.

---

## 1. Principles

Readable behavior · consistent decisions · human-like reaction timing ·
**difficulty through tactics, not unfair accuracy** · configurable · low CPU ·
network-compatible (bots are client-side, solo only) · debuggable · modular.

The load-bearing principle: **harder bots react faster, track better, and play
smarter — they never get X-ray vision or perfect aim.** Higher difficulty only
*modestly* tightens residual aim error; the real gains are reaction time,
tracking speed, damage discipline, and aggression.

## 2. Architecture — a per-bot pipeline

Each bot, each fixed-timestep tick (60 Hz), runs:

```
perceive → decide (FSM) → aim → act (move + fire)
```

- **`aiPerceive(e, cfg)`** — who can I see?
- **finite-state decision** — engage / retreat / search / roam.
- **`aiAim(e, tgt, cfg, dt)`** — human-like tracking + fire discipline.
- **`botMove(e, mvx, mvz, dt)`** — steering + collision + anti-stuck.

Everything is data-driven from `CFG.bot` (difficulty levels + personas), so
tuning is config, not code.

## 3. States (FSM)  ✅

| State | Trigger | Behavior |
|---|---|---|
| **roam** | no target, no memory | patrol map waypoints; reload when empty |
| **search** | lost target but recent memory (`searchT`) | move to last-seen / heard position, scan, then give up |
| **engage** | visible target, HP ok | strafe + hold range band, track, fire in bursts |
| **retreat** | visible target, HP ≤ persona threshold | back off while still returning fire |

The wider design vocabulary (patrol · investigate · observe · suppress · defend ·
guard · hold · flank · take-cover · fallback · escape · celebrate) maps onto this
core set plus persona/objective modifiers; the four implemented states cover the
deathmatch/warmup loop. Objective states (plant/defuse/secure) are ⬜ for bots
(S&D is human-only today).

## 4. Perception  ✅

`aiPerceive` fuses several detection channels, then requires **line of sight**:

- **Vision cone** — awareness-scaled half-angle (`cfg.fov` × persona), dot-product
  against facing.
- **Movement detection** — a *moving* enemy is caught at range (footsteps/motion),
  even outside the tight cone. This is what keeps a deathmatch lively.
- **Close-quarters** — anyone within ~16 m × awareness is noticed (360°).
- **Hearing** — taking fire sets a 1.4 s alert toward the shooter (`heardT`,
  `heardX/Z`), opening 360° acquisition and driving `search`.
- **Flash** — blinded bots (`flashedT`) drop their target and can't fight.
- **Occlusion / smoke** — handled by `hasLOS` (walls + smoke spheres).

**Target hysteresis:** the current target is kept while visible and only dropped
for a new enemy that is decisively (≥40%) closer — this prevents per-tick target
flicker (which would otherwise freeze aim and reset the reaction timer).

## 5. Memory  🟡

`lastSeen {x,z}` + `searchT` (last enemy position, decays over 3.5 s) drives the
`search` state; `heardX/Z` records the last threat direction. Known-ally
positions, danger zones, cover history, and objective status are ⬜ (needed for
team tactics / PvE).

## 6. Aiming model  ✅ — human, not aimbot

`aiAim` produces believable gunplay:

- **Reaction delay** — on a *fresh* sighting the bot pays `cfg.react` (e.g.
  0.30–0.55 s at normal) before it can fire; a target *switch* costs only a small
  re-settle, so it isn't paralyzed in crossfire.
- **Tracking** — yaw/pitch slew toward the target at `cfg.aimSpeed` rad/s (with a
  small lead on moving targets); pitch eases in.
- **Residual error** — a jitter of `cfg.aimErr` radians that *decays as the shot
  settles* (`aimSettle`), so flick shots are loose and held aim is tight — never
  perfect.
- **Fire discipline** — fires only when reaction has elapsed, aim is within ~9°,
  reloaded, and in range; shots come in **bursts** (`cfg.burst`) with an
  inter-burst pause. Weapon spread and bot damage also scale with difficulty.

## 7. Combat decisions & movement  ✅

Range management (hold band scaled by persona), **strafing**, **push** when
aggressive and healthy, **back off** at close range or low HP, reload when safe.
`botMove` integrates velocity, resolves collision, and runs **anti-stuck**:
if the bot intends to move but is displaced < 5 cm for > 0.6 s, it repaths,
flips strafe, and nudges its heading off the wall.

## 8. Personalities  ✅

Assigned at spawn; bias tactics without touching raw skill:

| Persona | push | hold-range | retreat HP | strafe |
|---|---|---|---|---|
| aggressive | 0.85 | 0.35 | 20 | 0.5 |
| defensive | 0.25 | 0.78 | 46 | 0.95 |
| balanced | 0.55 | 0.55 | 32 | 0.72 |
| recon | 0.45 | 0.70 | 36 | 1.0 |
| support | 0.40 | 0.62 | 40 | 0.82 |

## 9. Difficulty  ✅ — `CFG.bot.levels`, live via `aidiff`

| Level | react (s) | aimErr (rad) | aimSpeed | spread× | dmg× | aggression | FOV | burst |
|---|---|---|---|---|---|---|---|---|
| beginner | 0.60–1.00 | 0.115 | 2.6 | 3.4 | 0.50 | 0.30 | 1.30 | 3–5 |
| easy | 0.45–0.80 | 0.075 | 3.3 | 3.0 | 0.60 | 0.45 | 1.45 | 4–7 |
| normal | 0.30–0.55 | 0.045 | 4.2 | 2.4 | 0.70 | 0.60 | 1.55 | 5–9 |
| hard | 0.20–0.38 | 0.026 | 5.4 | 2.0 | 0.85 | 0.75 | 1.70 | 7–12 |
| expert | 0.13–0.26 | 0.015 | 6.8 | 1.7 | 1.00 | 0.90 | 1.85 | 9–16 |

Every axis is a per-difficulty number in `CFG.bot.levels[<level>]` — add a preset
or a "custom" row and it takes effect immediately. `aidiff <level>` swaps it live.

## 10. Navigation  🟡

Waypoint roaming over `world.waypoints` (a clear lattice of the arena) with
collision avoidance and anti-stuck recovery. A full navmesh with jump-links,
doors, and dynamic recalculation is ⬜; the waypoint graph is sufficient for the
current open arenas.

## 11. Training / PvE  🟡 / ⬜

The difficulty + persona + state system is the substrate for training modes:
stationary/moving/strafing targets, reaction and tracking drills, and aim duels
are `beginner`-persona bots with movement scripts (⬜ dedicated mode UI). PvE
behaviors (guard, patrol route, wave defense, VIP escort, reinforcement calls)
build on the FSM + objective states (⬜, needs a PvE game mode).

## 12. Debugging  ✅ — developer console (`?dev`)

| Command | Effect |
|---|---|
| `ai` | list every bot: state · persona · HP · current target · difficulty |
| `aidiff <level>` | set difficulty live (beginner…expert) |
| `aidebug on` | 3D overlay: state-colored marker + facing/vision ray, red line to target, yellow last-seen memory marker |

`aidebug` colors: engage = red, retreat = orange, search = yellow, roam = teal —
so behavior reads at a glance. Combined with `overlay` (F1) for per-tick cost.

## 13. QA automation  ✅ (harness) / 🟡

The headless Playwright harness drives real matches via `window.__gg` and can
assert AI outcomes deterministically — the validation used to build this system
checks: all FSM states are reached, aim converges (yaw error → 0), bots deal
damage and secure kills, and no page errors. A "spawn N bots + measure
thinks/frame" benchmark and long-run navigation/soak tests extend the same
harness (🟡). **Note:** bot combat only runs while the game is unpaused — drive
tests from a touch context (or keep focus) since solo pauses on pointer-lock loss.

## 14. Performance  ✅ / 🟡

Per-bot cost is a handful of vector ops + one LOS check per visible enemy per
tick, inside the shared 60 Hz fixed-timestep loop — negligible at the current
bot counts (the arena runs at ~5–9 draw calls). Distance-based think-rate LOD
(tick distant bots less often), perception budgeting, and animation budgeting are
specified (⬜) for scaling to large PvE bot counts; not needed at 5v5 scale.

---

### Summary
A complete, original bot AI: a perceive→decide→aim→act pipeline with a 4-state
FSM, multi-channel perception (cone + movement + hearing + LOS), a human-like
aiming model with reaction/tracking/settle/burst discipline, five personalities,
five live-swappable difficulty presets that scale *tactics over accuracy*,
anti-stuck navigation, and full in-game debug visualization — all verified in the
headless harness to reach every state, converge its aim, and fight fairly.
