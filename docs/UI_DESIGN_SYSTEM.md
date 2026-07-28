# VANTAGE UI — Design System

Original, esports-ready interface language for a competitive tactical FPS.
Cohesive with the VANTAGE material/art direction. **Nothing here imitates the
interface, iconography, typography, color language, or layout of any existing
commercial FPS.**

**Interactive reference:** `docs/ui/vantage-ui.html` — a live, self-contained
design-system page (composed HUD, tokens, original icon library, components,
scoreboard, animation demos, and a working crosshair editor). Open it in a
browser or view the published Artifact. This markdown is the written contract.

---

## 1. Principles

Minimal · premium · fast · readable under pressure · low-distraction. Every
screen serves gameplay first. **Every color has one meaning; every animation
communicates; every number is tabular.** If a choice hurts target acquisition,
it loses — same rule as the art direction.

## 2. Design language

- **Grid:** 8-point spacing rhythm everywhere → `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.
- **Radii:** `4px` chips/keys · `6px` buttons/inputs · `8px` panels/cards · `pill` status/toggles.
- **Responsive:** token-driven, adaptive scale, safe-area aware. Holds 16:9 · 16:10
  · 21:9 · 32:9 from Steam Deck (1280×800) through 8K. HUD anchors to safe-area
  corners (never the extreme ultrawide edges); menus center in a max-width column.
- **Theme-aware:** palette defined as CSS custom properties; `prefers-color-scheme`
  + `data-theme` overrides in both directions. Dark is the native world; light is
  fully supported. Motion respects `prefers-reduced-motion`.

## 3. Color system

Cool-biased neutrals do the quiet work; one warm accent owns "your action";
semantic hues stay **separate from the accent** so state never fights the brand.

| Token | Hex | Role |
|---|---|---|
| Ink | `#14161a` | page ground |
| Graphite | `#1a1d22` | recessed |
| Panel | `#212429` | surface |
| Panel-2 | `#282c32` | raised |
| Line | `#343941` | borders |
| Slate | `#5a616b` | disabled |
| Ash | `#9aa1ab` | muted text |
| Fog | `#e7e9ee` | primary text |
| **Accent · Orange** | `#ff7a1a` | your action / attacker side / ult |
| **Defender · Teal** | `#2ec5c0` | your team |
| Success | `#49e07a` | confirm / ready / good connection |
| Warning | `#ffd23b` | caution / low health / high ping |
| Danger | `#e5484d` | enemy / objective / packet loss |
| Info | `#59a6ff` | neutral notice / armor |

**Rule:** state is never encoded by color alone — pair with shape, icon, or label
(see Accessibility). Team identity also differs in position and label, not just hue.

## 4. Typography

| Role | Treatment |
|---|---|
| Display | grotesque, 800, −2% tracking, `text-wrap:balance` |
| Header | grotesque, 800 |
| Body | 400, 1rem / 1.55, ~65ch measure |
| Small | .8125rem, muted |
| Eyebrow / label | .68rem, **uppercase, .22em tracking**, 700 |
| Tiny meta | .66rem mono |
| **Telemetry** | **monospace, `tabular-nums`, 600–800** — timer, ammo, health, ping, FPS, loss, score |

Intended production faces: a custom geometric grotesque (primary), a neutral
humanist (secondary/body), and a monospace (telemetry/numeric). The system ships
CSP-safe font *stacks* so there is no webfont-load roulette; the **tabular
monospace telemetry** is the personality carrier and must stay tabular so HUD
columns never jitter as values change.

## 5. Icon library

36+ original single-weight geometric glyphs on a **24px grid** — one 1.6px
stroke, rounded joins, no fill; built to read at **18px in the HUD** and **26px
in menus**. Coverage: weapon, ammo, armor, health, shield, helmet, grenade,
smoke, flash, trap, drone, camera, healing, radio, objective, flag, spike, key,
door, computer, power, generator, electric, medical, warning, fire, explosion,
water, snow, wind, metal, wood, concrete, glass, plastic, ping. See the
interactive page for the rendered set (all inline SVG, no external assets).

## 6. Components & states

Buttons (primary / ghost / quiet / disabled, with ripple + 1px press) · status
pills (good/warn/crit/info, dot + label) · tabs · toggle · slider · capture/plant
progress bar · tooltip · toast/notification · player card. **Everything
interactive looks interactive; every state is distinct; focus is always visible
(`:focus-visible` ring in accent).**

## 7. HUD

Peripheral cues, clear center. Elements: crosshair · health + armor · ammo
(mag/reserve) · weapon name · ability slots + ult charge · interaction prompt
(hold-to-fill) · compass · round timer · team/enemy score · round tag · kill
feed · damage-direction arc · mini-notification · telemetry chips (FPS/ping/loss).
Own team = teal, enemy/objective = red, your action/ult = orange, all numbers in
tabular mono.

## 8. Scoreboard

Dense but scannable: player card (avatar / agent / name / rank), K/D/A, damage,
objective score, economy, ping, and **connection quality as a color _and_ a
number**. Own row anchored; MVP tinted warning-yellow. Tabular mono for all stats.

## 9. Animation language

Fast (≤200ms), purposeful, never decorative; fully disabled under
`prefers-reduced-motion`.

| Interaction | Spec |
|---|---|
| Hover | 80ms ease-out, brightness + opacity |
| Click | ripple 500ms + 60ms 1px depress |
| Open / close | 160ms, scale .98→1 + fade |
| Notification | single 220ms pulse, no loop |
| Round win / lose | 300ms in / 200ms out banner sweep |
| Health change | 150ms bar tween + number roll |
| Reload / cooldown | radial sweep matching real timing |
| Interaction | linear hold-to-fill to action threshold |

## 10. Accessibility framework

Foundational, not a bolted-on tab:

- **Colorblind:** Protan / Deutan / Tritan presets + custom team colors; state
  always has a shape/label backup so it never depends on hue.
- **Scaling:** text and HUD scale 75–150% independently, safe-area aware.
- **Motion & flashing:** global reduce-motion honored; screen-shake and flash
  toggles (defaults are motion-safe — no shake, no blur).
- **Full remapping:** keyboard, mouse, controller, plus hold/tap per action.
- **Crosshair editor:** gap / length / thickness / center-dot / color — fully
  player-authored (live in the reference page).
- **Audio visualization:** on-screen footstep & shot direction for deaf/HoH.
- **Subtitles:** size, background opacity, speaker labels.

## 11. Performance

UI is DOM/CSS-light and instant: no blocking webfont fetch, no heavy images
(icons are inline SVG), token-driven theming, GPU-friendly transforms only.
Targets: instant UI load, minimal draw cost, 120 → 360 FPS-friendly (UI never
the bottleneck), low memory. This mirrors the game's own perf budget in
`docs/PRODUCTION_GUIDELINE.md`.

## 12. Screen architecture

`Main menu → Play (Competitive / Casual / Training / Range / Custom) → Lobby
(party / ready / region / queue / train-while-queue) → Buy → HUD → Scoreboard
(hold) → Post-match (XP / rank / timeline / commends / rewards)`; plus Career,
Store (preview / rotate / zoom / bundles / confirm), Social, and Settings
(Graphics / Display / Audio / Gameplay / Controls / Accessibility / Network /
Interface / Crosshair). All surfaces share the same tokens and 8-pt rhythm.
