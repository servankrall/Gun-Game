# VANTAGE — Prop & World-Asset Specification

**Scope note (honest):** this library is a *procedural texture/material* pipeline.
It produces **surfaces** — the PBR materials, skin themes, and decals that dress a
level — not 3D geometry. Meshes, LODs, and collision are **specified here** as the
authoring contract; the polygons themselves are built in a DCC (Blender / Maya /
Modo) or a modular kit, then assigned the VANTAGE materials + decals that this
repo generates. That division is deliberate and matches how AAA teams work:
one material/trim/decal set dresses hundreds of props.

## Modular design language

Modern industrial: manufactured, clean, believable, minimal unnecessary detail,
consistent scale, strong readable silhouettes. No fantasy / steampunk / medieval
/ exaggerated sci-fi / cartoon proportions. Everything snaps to a grid so props,
walls, and floors kit-bash into dozens of maps.

- **Grid:** 10 cm minor / 50 cm major. Doors 1.0 × 2.1 m, corridors ≥ 2.0 m,
  cover props 0.9–1.1 m tall (chest-high gameplay cover).
- **Pivot:** base-center, resting on Z=0 (floor props) or the mount face.
- **Scale:** 1 unit = 1 m, real-world dimensions, applied transforms.

## Per-asset deliverable contract

| Item | Convention |
|---|---|
| High poly | bevels + chamfers for baking; no booleans left un-cleaned |
| Game mesh | quads/tris, no n-gons; budget by class (below) |
| LOD0–LOD3 | ~100% / 60% / 30% / 12% tris; screen-size driven |
| Collision | convex hull or boxes (`UCX_`); ≤ 32 tris typical |
| UV0 | 0–1, no overlap, ≥ 512 px/m texel density |
| UV1 | lightmap / unique, non-overlapping |
| Vertex color | R=wear mask, G=dirt/AO bias, B=color-variation, A=detail-blend |
| Materials | shared VANTAGE material instances; trim sheets where possible |
| Nanite / VT | high-poly retained for Nanite; textures virtual-texture ready |

**Tri budgets (game mesh):** small deco 200–1.5k · props 1.5k–8k · hero/machinery
8k–25k · structural modules 300–4k. Draw-call discipline: atlas + trim + shared
material instances; a filled room should stay in the low hundreds of draw calls.

## Prop taxonomy (materials + decals already provided for all of these)

- **Storage** — crates, military boxes, containers, cabinets, lockers, shelving,
  racks, pallets, cargo, carts, trolleys.
- **Office** — chairs, desks, workstations, cabinets, shelves, boards, monitors,
  PCs, peripherals, lamps, bins, printers, dispensers, plants, clocks, boards.
- **Industrial** — forklifts, pallet jacks, tool chests, benches, presses, fans,
  compressors, tanks, cylinders, generators, consoles, pumps, filters, frames,
  platforms, railings, ladders, lifts.
- **Electrical** — breaker/switch/fuse panels, transformers, converters, UPS,
  battery cabinets, cable trays, junction boxes, control modules, boards.
- **Laboratory** — research desks, testing stations, cabinets, glass storage,
  sample containers, sinks, trolleys, consoles, microscope stations, racks.
- **Server room** — racks, blades, arrays, switches, patch/fiber panels, cooling,
  raised-floor panels, power cabinets, cable management.
- **Urban** — benches, bins, bike racks, poles, bollards, barriers, bus stops,
  lamps, cameras, signs, mailboxes, boxes, meters, planters, fences.
- **Transportation** — luggage carts, terminal seating/counters, scanners,
  kiosks, platform benches/barriers, gates, escalator/elevator housings, ramps.
- **Rooftop** — HVAC, cooling towers, vent fans, ducts, hatches, dishes,
  antennae, solar panels, cable trays, rails, ladders, rods.
- **Mechanical detail** — steel/copper/PVC pipes, supports, valves, gauges,
  flow meters, flanges, pumps, vents, drains, inspection covers.
- **Small deco** — tools, helmets, glasses, clipboards, manuals, kits, lights,
  batteries, first-aid, extinguishers, cleaning gear, warning tape.

### Which materials dress them

`materials.json`: `env_powder_coated_steel`, `env_brushed_alu_panel`,
`metal_*`, `plastic_*`, `rubber_*`, `wpn_polymer_*`, `carbon_*`, `glass_*`,
`wood_*`, `env_perforated_metal`, `env_corrugated_panel`, and the
`accent_*` / `emissive_*` navigation surfaces. Signage and labels come from
`decals.json` (room/rack/pipe/panel IDs, warning & directional signs, floor
markings). Any prop is: **geometry (DCC) + VANTAGE material instance(s) + VANTAGE
decals**.

## Wear levels

Factory-new → clean → light dust → light use → professional use → moderate wear,
expressed through the material's `wear` value and the vertex-color R/G masks —
edge polish, minor paint chips, small scratches, subtle dirt, very light oil.
Never heavy corrosion or destruction.
