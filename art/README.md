# VANTAGE — Texture Library

Original, AAA-quality, competitive-tactical-FPS material foundation. Everything
here is **procedural**: no photogrammetry, no scanned data, no imitation of any
existing game's identity, characters, maps, logos, or symbols. Read
[`ART_DIRECTION.md`](ART_DIRECTION.md) for the full art bible (style pillars,
color language, PBR spec, engine integration).

## What's in here

```
art/
  ART_DIRECTION.md      the art-direction bible (identity, palette, PBR/map spec)
  materials.json        the catalog — 145 materials across 14 categories (the contract)
  tools/
    build_catalog.py    emits materials.json
    texgen.py           procedural PBR generator (numpy + PIL)
    verify.py           renders a 145-material contact sheet
    tilecheck.py        2×2 seamless-tiling proof for a few families
    seamcheck.py        numeric edge-seam metric
  previews/
    contact_512.png     all 145 materials at a glance
    maps_brick_red.png  one material, every map channel labelled
    tiling_check.png    seamless verification
  out/                  8 flagship material sets rendered at 1024 (samples)
```

The library is generated **on demand** — the repo ships the generator, the
catalog, the bible, and curated samples rather than tens of thousands of 4K PNGs.
Any resolution or variant is produced in seconds.

## Quick start

Requires Python 3 with `numpy` and `pillow`.

```bash
cd art

# 1. (Re)build the catalog
python3 tools/build_catalog.py > materials.json

# 2. Render every material at 2048
python3 tools/texgen.py --catalog materials.json --res 2048 --out out/

# Render one category at 4K
python3 tools/texgen.py --catalog materials.json --res 4096 --out out/ --only concrete

# Render a single material, all its maps
python3 tools/texgen.py --catalog materials.json --res 4096 --out out/ --material brick_red

# Contact sheet of the whole set
python3 tools/verify.py
```

Valid `--res`: `512 1024 2048 4096`. `--only <category>` filters by category
(`concrete, metal, wood, ground, plastic, fabric, glass, rubber, ceramic,
brick, leather, accent, carbon, stone`); `--limit N` caps the count for a fast
smoke test.

## Output layout

```
out/<material_id>/<material_id>_<map>_<res>.png
  brick_red/brick_red_albedo_2048.png
  brick_red/brick_red_normal_2048.png      (+Y / OpenGL tangent)
  brick_red/brick_red_orm_2048.png         (R=AO, G=Roughness, B=Metallic)
  brick_red/brick_red_displacement_2048.png (16-bit)
```

Maps emitted per material: **albedo, normal, ao, roughness, metallic, height,
displacement (16-bit), orm (packed), curvature**, plus **opacity** and
**emission** where the material declares them.

## Adding a material

Add a row in `tools/build_catalog.py` (or hand-edit `materials.json`), pick a
`family` and `palette`, set `roughness / metallic / wear / normal_strength /
seed`, regenerate. The catalog is the single source of truth; the map set exists
at every resolution the moment the row does.

## Engine notes (short version)

- **Normals ship +Y (OpenGL).** Flip Green for DirectX / Unreal.
- **ORM** = R:AO, G:Roughness, B:Metallic — import as **linear** (sRGB off).
  This is Unity HDRP's Mask Map channel-for-channel.
- **Displacement** is the 16-bit height (Nanite / tessellation / parallax).
- Unity URP: `Smoothness = 1 - Roughness`.

See `ART_DIRECTION.md` §8 for per-engine (UE5 / Unity HDRP+URP / Godot 4 /
CryEngine) detail.
