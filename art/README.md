# VANTAGE — Material, Skin & Decal Library

Original, AAA-quality, competitive-tactical-FPS art foundation spanning
**environment surfaces, weapon materials, skin themes, and signage/decals**.
Everything here is **procedural**: no photogrammetry, no scanned data, no
imitation of any existing game's identity, characters, maps, logos, or symbols.
Read [`ART_DIRECTION.md`](ART_DIRECTION.md) for the full art bible and
[`MESH_SPEC.md`](MESH_SPEC.md) for the prop/3D-asset authoring contract.

## What's in here

```
art/
  ART_DIRECTION.md      the art bible (identity, palette, PBR spec, engines,
                        weapons §12, skins §13, environment §14, decals §15)
  MESH_SPEC.md          prop / LOD / collision / UV contract (geometry is specced,
                        not generated — a texture pipeline makes surfaces, not meshes)
  materials.json        216 materials across 16 categories (env / weapon / metal / …)
  decals.json           142 original signage, marking & micro-detail decals
  tools/
    build_catalog.py    emits materials.json (incl. weapon + environment sets)
    build_decals.py     emits decals.json
    texgen.py           procedural PBR material generator (+ 20 skin themes)
    decalgen.py         procedural flat-vector decal / sign generator
    verify.py tilecheck.py seamcheck.py   contact sheet + tiling/seam checks
  previews/
    contact_512.png       all base materials at a glance
    weapons_512.png       44 weapon materials
    environment_512.png   27 environment materials
    skins_machined_512.png one material across all 20 skin themes
    decals_512.png        142 signage / marking / detail decals
    maps_brick_red.png    one material, every map channel labelled
    tiling_check.png      seamless verification
  out/                    flagship material sets rendered at 1024 (samples)
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

# Apply a skin theme to a category (luminance-preserving recolor)
python3 tools/texgen.py --catalog materials.json --only weapon --res 2048 --out out/ --theme copper_ember

# Contact sheet of the whole set
python3 tools/verify.py

# Decals / signage (transparent PNG + opacity/normal/roughness/ORM)
python3 tools/build_decals.py > decals.json
python3 tools/decalgen.py --catalog decals.json --res 2048 --out out_decals/
python3 tools/decalgen.py --catalog decals.json --contact previews/ --res 512
```

Skin themes (`--theme`): `urban_graphite desert_sandstorm midnight_alloy
arctic_frost volcanic_basalt forest_moss digital_mist blue_steel copper_ember
industrial_titanium white_ceramic obsidian_black crimson_alloy emerald_matrix
storm_grey golden_bronze shadow_carbon silver_phantom slate_tactical titan_core`.

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
