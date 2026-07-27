# VANTAGE — Competitive Tactical FPS Art Direction & Material Foundation

**Original visual identity. Not derived from, and not imitating, any existing
game's characters, maps, logos, symbols, or copyrighted designs.**

VANTAGE is a *stylized-realistic* look built for a modern esports shooter:
clean geometric architecture, believable physically-based materials, and
**gameplay clarity above all**. Every surface is authored so that silhouettes,
sightlines, and interactable objects read instantly — from 2 m to 100 m, in any
lighting.

The material library is **procedural** (see `tools/texgen.py`): math-built,
seamless, low-noise, no photogrammetry — exactly the clean, readable surface
language the direction calls for. Any material renders to a full PBR map set at
**512 / 1024 / 2048 / 4096**.

---

## 1. Style pillars

1. **Readability is the art.** If a choice hurts target acquisition, it loses.
   Large surfaces stay neutral and quiet; accents do the talking.
2. **Clean, believable aging — never destruction.** Materials age with soft
   edge wear, gentle discoloration, light dust, and rust *only where physically
   correct*. No apocalypse, no horror, no muddy grime, no scratch-storms.
3. **Geometric + physical.** Crisp architectural forms wrapped in honest PBR
   materials. Slightly stylized albedo and value separation, real light response.
4. **Modular & consistent.** One palette, one texel-density standard, one
   naming scheme, one packing convention across the whole set.

---

## 2. Color language

Neutrals dominate. Primaries are only *slightly* saturated. Accents are reserved
for navigation and interactables so the eye is trained to trust them.

### Neutral base (large surfaces — ~80% of screen)
| Role | Hex | Use |
|---|---|---|
| Fog white | `#d8dade` | brightest neutral, ceilings, light stone |
| Ash | `#b7bcc2` | walls, concrete |
| Slate | `#7f858c` | mid metals, shadowed walls |
| Graphite | `#3d4148` | dark trim, frames |
| Ink | `#23262b` | deepest neutral, rubber, cavities |

### Material primaries (slightly saturated)
| Role | Hex |
|---|---|
| Warm wood | `#b98c55` |
| Steel | `#9aa0a6` |
| Brick red | `#9e5a44` |
| Copper | `#b5723a` |
| Glass tint | `#cfe6ea` |

### Accent / wayfinding (small, deliberate, high-signal)
| Role | Hex | Meaning |
|---|---|---|
| Signal orange | `#ff7a1a` | primary navigation / attacker side cue |
| Safety yellow | `#ffd23b` | caution, ledges, interact hint |
| Wayfinding teal | `#2ec5c0` | routes / defender side cue |
| Objective red | `#e5484d` | objective, danger, emissive |

> Rule: an accent color never appears on a large non-interactive surface.
> When a player sees orange/teal, it *means* something.

---

## 3. Material philosophy (PBR)

- **Physically based, slightly stylized.** Real energy conservation; albedo
  values kept in the safe PBR range (sRGB ~30–240, no pure black/white bases).
- **Metallic is binary in intent** — a surface is a metal or it isn't. Painted
  metal reads as dielectric paint with occasional worn chips revealing metal.
- **Roughness carries the story**, not the albedo. Recesses/mortar are rougher;
  polished faces are smoother; wear lowers roughness on rubbed edges.
- **No noisy surfaces.** Micro-detail is subtle and purposeful; macro value
  breakup keeps big walls from feeling flat without adding visual clutter.

---

## 4. Texture maps (per material)

| Map | Space / format | Notes |
|---|---|---|
| Albedo / Base Color | sRGB, RGB | no baked lighting or AO |
| Normal | Linear, RGB, **tangent, +Y (OpenGL)** | flip G for DirectX/UE (see §8) |
| Ambient Occlusion | Linear, grayscale | macro + cavity |
| Roughness | Linear, grayscale | |
| Metallic | Linear, grayscale | mostly constant per material |
| Height | Linear, grayscale (8-bit) | parallax / blending |
| Displacement | Linear, **16-bit** grayscale | tessellation / Nanite displacement |
| ORM (packed) | Linear, RGB | **R=AO, G=Roughness, B=Metallic** |
| Curvature | Linear, grayscale | edge masks, wear, detail blends |
| Opacity | Linear, grayscale | glass, mesh fabric (when present) |
| Emission | sRGB, RGB | guide strips, objectives (when present) |

**Object-space / world-space / bent normals:** the tangent normal + height are
authored so DCC/engine tools can derive Object-Space and World-Space normals and
**bent normals** on import (Substance, UE5, Marmoset). Height is the single
source of truth for all normal-derived maps, guaranteeing consistency.

---

## 5. Surface taxonomy (145 materials in `materials.json`)

Concrete (20) · Metal (20) · Wood (16) · Ground (16) · Plastic (10) ·
Fabric (10) · Glass (9) · Rubber (9) · Ceramic/Tile (7) · Brick (6) ·
Leather (6) · Accent/Emissive (6) · Carbon fiber (5) · Stone (5).

Each entry declares: `family` (procedural pattern), `palette`, `roughness`,
`metallic`, `wear`, `normal_strength`, and pattern `params`. The catalog is the
contract — add a row, regenerate, and the map set exists at every resolution.

Procedural **families**: `concrete, brick, tile, planks, panel, corrugated,
diamond, woven, grain, fabric, asphalt, smooth`.

---

## 6. Competitive visibility standard

- **Silhouette first.** Interactable/gameplay surfaces get a distinct value and
  usually an accent so they never blend into architecture.
- **Value separation across distance.** Neighboring gameplay surfaces keep ≥15%
  luminance separation so they stay distinct at 25–100 m.
- **No busy tiling.** Pattern scale is chosen so repetition isn't visible at
  10 m and detail doesn't shimmer at 50 m (mip-safe, no high-contrast speckle).
- **Texel density target: 512 px/m** for hero playable surfaces (walls, floors,
  cover), 256 px/m for background. Pick the resolution per real-world size to
  hold that density; the same material serves all LODs.

---

## 7. Lighting compatibility

Albedo stays in-range and AO is *soft* so materials hold up under morning / noon
/ evening / night / cloudy / rain / indoor / outdoor, and across HDR, dynamic
GI, baked lighting, Lumen, ray tracing, shadow maps and virtual shadow maps.
No lighting or directional shadow is baked into albedo; all shading is left to
the engine.

---

## 8. Engine integration

**Packing:** use the **ORM** map (R=AO, G=Roughness, B=Metallic) — one sampler,
streaming- and compression-friendly. Displacement is the 16-bit height.

- **Unreal Engine 5** — Normal is tangent; **flip Green** on import (UE uses
  DirectX/-Y). ORM: sRGB **off**. Height16 → World Displacement / Nanite
  tessellation. Enable Virtual Textures + Nanite; materials are VT- and
  Nanite-friendly (seamless, mip-consistent, no per-instance decals baked in).
- **Unity HDRP** — Mask Map is exactly **ORM** channel-for-channel plus detail
  in A if desired; assign Height for parallax; Normal +Y (OpenGL) — leave as-is.
- **Unity URP** — Albedo + Metallic(Smoothness) + Normal + Occlusion; derive
  Smoothness = `1 - Roughness` (G of ORM inverted) or use the roughness map via
  a Smoothness=Off pipeline.
- **Godot 4** — StandardMaterial3D: Albedo (sRGB), Normal (+Y), Roughness,
  Metallic, AO (or ORM split), Height for heightmap/parallax. All linear maps
  imported with sRGB disabled.
- **CryEngine / custom** — provide Albedo, Normal (+Y), and the linear
  Roughness/Metallic/AO/Height; ORM available if the shader samples packed.

> The library ships **+Y (OpenGL) tangent normals**. Flip G for DirectX/UE.

---

## 9. Optimization

Tileable · seamless · UV-friendly · consistent texel density · mipmap-friendly ·
streaming- and memory-optimized · compression-friendly (BC7 albedo, BC5 normal,
BC4 single-channel, BC1/BC7 ORM) · LOD-compatible · virtual-texturing- and
Nanite-friendly. Because generation is procedural, any missing size or a
brand-new variant is produced on demand instead of shipped as dead weight.

---

## 10. Naming & folders

```
<material_id>/<material_id>_<map>_<res>.png
  e.g.  brick_red/brick_red_albedo_2048.png
        brick_red/brick_red_orm_2048.png
        brick_red/brick_red_displacement_2048.png   (16-bit)
material_id = <category>_<name>   (snake_case, stable, engine-safe)
```

---

## 11. Do / Don't

**Do:** clean believable materials, soft edge wear, subtle dust, natural
discoloration, water stains where water sits, rust only on ferrous metal at
contact points, accent colors for navigation, strong silhouettes.

**Don't:** photogrammetry, noisy surfaces, over-detailing, scratch-storms,
extreme dirt, muddy colors, exaggerated destruction, post-apocalyptic or horror
atmosphere, baked lighting in albedo, accent colors on dead surfaces.

---

## 12. Weapon material library (`weapon` category, 44 materials)

Premium, modern, lightweight, engineered — clean machining and honest PBR, no
fantasy, no exaggerated sci-fi, no cartoon decoration. Built from four weapon
families in `texgen.py`:

- **`machined`** — CNC tool marks: `mode:"linear"` (mill) or `"concentric"`
  (lathe). Concentric is radial, authored for UV-mapped parts (barrels, muzzle
  devices), not for tiling — tiling applies *where appropriate*.
- **`knurl`** — fine diamond knurling for grips (seamless at even `n`).
- **`hex`** — hexagonal grip cells (tileable).
- **`micro`** — bead-blast / cerakote micro-stipple (the matte tactical finish).
- plus `smooth`(+brushed) and `woven` (carbon / kevlar) from the base set.

Coverage: military / machined / heat-treated / cold-rolled / carbon / stainless
/ bluing steel · titanium + alloy · aircraft / anodized / FDE / forged / brushed
/ cast aluminum · industrial + magnesium alloy · polymers (receiver / FDE /
military / GRP / injection / textured / hard / soft) · grips (rubber / diamond /
hex / micro / fine / coarse / competition / tactical / weather) · carbon (matte /
gloss / forged) + kevlar · coatings (cerakote black/grey, ceramic, anti-corrosion,
heat-resistant, ceramic armor). Wear stays *tasteful* — edge polish, contact
sheen, faint carbon — never deep rust, cracks, or missing parts.

**Modular components** (upper/lower, handguard, rail, charging handle, magazine,
trigger group, bolt/carrier, barrel, muzzle devices, suppressor, stock, grips,
optic, mounts, small hardware) are authored as **material + trim-sheet
assignments**, not as unique textures per part — one steel, one polymer, one grip
serves the whole weapon, which is how AAA weapon art keeps memory low and looks
consistent. The 3D geometry itself is specified in `MESH_SPEC.md` (a texture
generator produces surfaces, not meshes).

## 13. Skin themes (20 original finishes)

`texgen.py --theme <name>` applies a **luminance-preserving recolor**: the base
material's machining detail, wear, and value structure are kept, only chroma
shifts toward the theme tint (with a roughness/metallic bias). One material ×
one theme = a cohesive, readable finish — no geometry or detail change, so
competitive clarity is never traded for a skin.

Themes: Urban Graphite · Desert Sandstorm · Midnight Alloy · Arctic Frost ·
Volcanic Basalt · Forest Moss · Digital Mist · Blue Steel · Copper Ember ·
Industrial Titanium · White Ceramic · Obsidian Black · Crimson Alloy · Emerald
Matrix · Storm Grey · Golden Bronze · Shadow Carbon · Silver Phantom · Slate
Tactical · Titan Core. All original — no recognizable commercial skin patterns.

## 14. Environment expansion (`environment` category, 27 materials)

Walls (drywall / office / lab / acoustic / metal-panel / steel / block / modular
/ reinforced), floors (vinyl / epoxy / rubber / carpet / warehouse / steel-grate
/ raised-access / laminate), ceilings (acoustic / metal / suspended), panels &
structural (brushed-alu / powder-coated / perforated / corrugated / concrete &
steel columns / steel beam). These extend the base concrete(20) / brick / tile /
ground / glass / metal / wood set. Many spec names (e.g. "airport concrete" vs
"office concrete") are **instances of one material** with a palette/roughness
tweak — trim-sheet philosophy, not a unique 4K set per synonym.

## 15. Decal, signage & marking library (`decals.json`, 142 decals)

A separate flat-vector engine (`decalgen.py`) — **original iconography only**,
drawn from geometric primitives (no copyrighted pictograms, no branding). Kinds:
warning (yellow triangle), prohibition (red ring), mandatory (blue circle), safe
/ exit (green), directional plates & arrows, room/level numbering, ID bands,
floor markings (hazard stripes / lanes / keep-clear), pipe & system labels,
security, engraved electronics labels, vehicle markings, and soft small-detail
marks (scuff / wheel / oil / water / rust / stain / smudge / dust).

Each decal exports a **transparent** albedo (RGBA) + `opacity`, plus `normal`,
`roughness`, `ao`, packed `orm`, `height`. **Material response** drives the
relief and gloss: `paint` / `vinyl` (flat), `reflective` (low-rough),
`embossed` (raised), `engraved` (cut-in, bare metal in the grooves), `sticker`
(slight lift). Flat graphic design, minimal noise, high readability, scalable —
the same sign reads at 2 m and 50 m.

Sign palette: white, black, light/dark grey, industrial yellow, safety orange,
emergency red, deep blue, olive, cyan, muted green, neutral beige.
