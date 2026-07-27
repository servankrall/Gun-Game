#!/usr/bin/env python3
"""
texgen — procedural PBR texture generator for the VANTAGE art direction.

Clean, stylized-realistic, seamless (tileable) materials built entirely from
math — no photogrammetry, no scanned noise. Every material exports a full
engine-ready map set:

  albedo, normal (tangent), ao, roughness, metallic, height,
  displacement (16-bit), orm (packed AO/Rough/Metal), curvature,
  + opacity / emission when the material declares them.

Deps: numpy, pillow.  Usage:
  python3 texgen.py --material concrete_clean --res 2048 --out out/
  python3 texgen.py --catalog materials.json --res 1024 --out out/ --only concrete,metal
  python3 texgen.py --catalog materials.json --contact previews/ --res 512
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

# ----------------------------------------------------------------------------
# seamless noise (periodic lattice → smooth upsample; wraps by construction)
# ----------------------------------------------------------------------------
def _smooth(t):
    return t * t * (3 - 2 * t)

def tile_noise(res, cells, seed):
    rng = np.random.default_rng(seed)
    g = rng.random((cells, cells), dtype=np.float64)
    xs = (np.arange(res) / res) * cells
    x0 = np.floor(xs).astype(int) % cells
    x1 = (x0 + 1) % cells
    fx = _smooth(xs - np.floor(xs))
    gx0 = g[:, x0]; gx1 = g[:, x1]
    gxi = gx0 * (1 - fx)[None, :] + gx1 * fx[None, :]        # interp along x
    y0 = x0; y1 = x1; fy = fx                                 # square texture
    top = gxi[y0, :]; bot = gxi[y1, :]
    return top * (1 - fy)[:, None] + bot * fy[:, None]

def fbm(res, cells, octaves, seed, persist=0.5):
    out = np.zeros((res, res)); amp = 1.0; tot = 0.0
    for o in range(octaves):
        out += amp * tile_noise(res, max(2, cells * (2 ** o)), seed + o * 17)
        tot += amp; amp *= persist
    out /= tot
    return (out - out.min()) / (np.ptp(out) + 1e-9)

def coords(res):
    a = np.arange(res) / res
    return np.meshgrid(a, a)   # x, y in 0..1

# ----------------------------------------------------------------------------
# pattern families → return (height 0..1, tone field 0..1, extra dict)
# ----------------------------------------------------------------------------
def fam_concrete(res, p, seed):
    h = 0.5 + 0.5 * fbm(res, 3, 5, seed)
    pores = fbm(res, 24, 3, seed + 3)
    h -= (pores < 0.12) * 0.25                              # sparse pits
    cracks = fbm(res, 5, 4, seed + 9)
    h -= np.clip((0.5 - np.abs(cracks - 0.5)) * 0.0, 0, 0)  # (subtle, kept faint)
    tone = 0.5 + 0.5 * fbm(res, 4, 3, seed + 2)
    return np.clip(h, 0, 1), tone, {}

def fam_brick(res, p, seed):
    rows = p.get("rows", 12); cols = p.get("cols", 6); m = p.get("mortar", 0.06)
    x, y = coords(res)
    ry = y * rows; row = np.floor(ry); fy = ry - row
    off = (row % 2) * 0.5
    rx = (x * cols + off); col = np.floor(rx); fx = rx - col
    mort = (fx < m) | (fx > 1 - m) | (fy < m * (cols / rows)) | (fy > 1 - m * (cols / rows))
    h = np.where(mort, 0.35, 1.0).astype(float)
    h += fbm(res, 40, 3, seed) * 0.06                       # face grain
    idx = (row.astype(int) * 97 + col.astype(int) * 31) % 997
    tone = (np.sin(idx * 2.3) * 0.5 + 0.5)
    return np.clip(h, 0, 1), tone, {"mortar_mask": mort.astype(float)}

def fam_tile(res, p, seed):
    n = p.get("n", 6); g = p.get("grout", 0.04)
    x, y = coords(res)
    fx = (x * n) % 1; fy = (y * n) % 1
    grout = (fx < g) | (fx > 1 - g) | (fy < g) | (fy > 1 - g)
    h = np.where(grout, 0.3, 1.0).astype(float)
    h += fbm(res, 60, 2, seed) * (0.02 if p.get("polish") else 0.05)
    ix = np.floor(x * n).astype(int); iy = np.floor(y * n).astype(int)
    tone = ((np.sin((ix * 13 + iy * 7)) * 0.5 + 0.5))
    return np.clip(h, 0, 1), tone, {"mortar_mask": grout.astype(float)}

def fam_planks(res, p, seed):
    n = p.get("n", 6); gap = p.get("gap", 0.02); vertical = p.get("vertical", True)
    x, y = coords(res)
    u, v = (x, y) if vertical else (y, x)
    pl = u * n; idx = np.floor(pl); fp = pl - idx
    gapm = (fp < gap) | (fp > 1 - gap)
    grain = fbm(res, 2, 5, seed + int(idx.mean())) if False else 0
    # stretched wood grain along plank length
    long_noise = fbm(res, 3, 5, seed)                       # seamless field → phase wobble
    freq = int(round(p.get("grain", 10)))                   # integer cycles → tiles along plank
    fine = 0.5 + 0.5 * np.sin(v * 2 * np.pi * freq + long_noise * 4 + idx * 1.9)
    h = 1.0 - gapm * 0.5
    h = h - (1 - fine) * 0.06
    h += fbm(res, 50, 2, seed + 5) * 0.02
    tone = 0.5 + 0.4 * np.sin(idx * 2.1) + 0.1 * fine
    return np.clip(h, 0, 1), np.clip(tone, 0, 1), {"grain": fine, "gap_mask": gapm.astype(float)}

def fam_panel(res, p, seed):
    nx = p.get("nx", 3); ny = p.get("ny", 4); seam = p.get("seam", 0.02)
    bolts = p.get("bolts", True)
    x, y = coords(res)
    fx = (x * nx) % 1; fy = (y * ny) % 1
    seamm = (fx < seam) | (fx > 1 - seam) | (fy < seam) | (fy > 1 - seam)
    h = np.where(seamm, 0.55, 1.0).astype(float)
    h += fbm(res, 80, 2, seed) * 0.02
    extra = {}
    if bolts:
        bd = np.minimum(np.abs(fx - 0.5), 999)  # placeholder
        cx = np.abs(((x * nx) % 1) - 0.5); cy = np.abs(((y * ny) % 1) - 0.5)
        near = (np.hypot((fx - seam * 2), (fy - seam * 2)) < 0.035)
        h = np.where(near, 1.12, h)
        extra["bolts"] = near.astype(float)
    ix = np.floor(x * nx).astype(int); iy = np.floor(y * ny).astype(int)
    tone = 0.5 + 0.06 * np.sin(ix * 5 + iy * 3)
    return np.clip(h, 0, 1), np.clip(tone, 0, 1), extra

def fam_corrugated(res, p, seed):
    w = p.get("waves", 16); vertical = p.get("vertical", True)
    x, y = coords(res)
    u = x if vertical else y
    h = 0.5 + 0.5 * np.sin(u * w * 2 * np.pi)
    h = 0.4 + 0.6 * h
    h += fbm(res, 60, 2, seed) * 0.015
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {}

def fam_diamond(res, p, seed):
    n = p.get("n", 10)
    x, y = coords(res)
    a = np.sin((x + y) * n * np.pi) ; b = np.sin((x - y) * n * np.pi)
    tread = np.maximum(0, a) * ( ((np.floor((x+y)*n)+np.floor((x-y)*n)).astype(int)%2==0) )
    h = 0.55 + 0.3 * np.maximum(np.maximum(a, 0) * (np.floor((x - y) * n).astype(int) % 2 == 0),
                                np.maximum(b, 0) * (np.floor((x + y) * n).astype(int) % 2 == 1))
    h += fbm(res, 80, 2, seed) * 0.015
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {}

def fam_woven(res, p, seed):
    n = p.get("n", 24)
    x, y = coords(res)
    warp = np.sin(x * n * np.pi) ; weft = np.sin(y * n * np.pi)
    over = (np.floor(x * n).astype(int) + np.floor(y * n).astype(int)) % 2 == 0
    h = 0.5 + 0.25 * np.where(over, np.abs(warp), np.abs(weft))
    h += fbm(res, 120, 1, seed) * 0.01
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {"aniso": True}

def fam_grain(res, p, seed):
    cells = p.get("cells", 40)
    h = fbm(res, cells, 4, seed, 0.6)
    tone = fbm(res, cells, 3, seed + 4)
    return h, tone, {}

def fam_fabric(res, p, seed):
    n = p.get("n", 90)
    x, y = coords(res)
    weave = 0.5 + 0.5 * (np.sin(x * n * np.pi) * np.sin(y * n * np.pi))
    h = 0.6 + 0.25 * weave + fbm(res, 20, 3, seed) * 0.1
    mesh = None
    if p.get("mesh"):
        holes = (np.sin(x * n * np.pi) ** 2 + np.sin(y * n * np.pi) ** 2) < 0.15
        mesh = (~holes).astype(float)
    return np.clip(h, 0, 1), fbm(res, 12, 2, seed + 1), {"opacity_mask": mesh}

def fam_asphalt(res, p, seed):
    h = 0.45 + 0.3 * fbm(res, 30, 4, seed) + 0.25 * fbm(res, 90, 2, seed + 2)
    tone = fbm(res, 20, 3, seed + 5)
    return np.clip(h, 0, 1), tone, {}

def fam_smooth(res, p, seed):
    h = 0.5 + 0.02 * fbm(res, 6, 3, seed)                    # near-flat (glass/plastic/rubber)
    if p.get("brushed"):
        x, y = coords(res)
        h = 0.5 + 0.02 * np.sin(y * 400) + 0.01 * fbm(res, 200, 1, seed)
    return h, np.full((res, res), 0.5), {}

def fam_machined(res, p, seed):
    # CNC tool marks — linear (mill) or concentric (lathe). Concentric is radial
    # so it's authored for UV-mapped weapon parts, not for tiling.
    x, y = coords(res)
    freq = p.get("freq", 240); mode = p.get("mode", "linear")
    if mode == "concentric":
        r = np.hypot(x - 0.5, y - 0.5)
        h = 0.5 + 0.028 * np.sin(r * freq * np.pi)
    else:
        h = 0.5 + 0.026 * np.sin(y * freq * np.pi) + 0.008 * np.sin(y * freq * 3.1 * np.pi)
    h += (fbm(res, 300, 1, seed + 2) - 0.5) * 0.02           # micro tooth
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {"aniso": True}

def fam_knurl(res, p, seed):
    # fine diamond knurling for grips (seamless when n is even)
    n = p.get("n", 40)
    x, y = coords(res)
    a = np.abs(np.sin((x + y) * n * np.pi)); b = np.abs(np.sin((x - y) * n * np.pi))
    h = 0.38 + 0.5 * np.minimum(a, b)
    h += (fbm(res, 140, 1, seed) - 0.5) * 0.02
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {}

def fam_hex(res, p, seed):
    # hexagonal grip cells (integer freqs → tiles; use even n)
    n = p.get("n", 12)
    x, y = coords(res)
    fx, fy = x * n, y * n
    a1 = np.cos(2 * np.pi * fx)
    a2 = np.cos(2 * np.pi * (fx * 0.5 + fy * 0.5))
    a3 = np.cos(2 * np.pi * (fx * 0.5 - fy * 0.5))
    cell = (a1 + a2 + a3) / 3.0
    h = 0.45 + 0.42 * np.clip(cell * 1.4 + 0.35, 0, 1)
    h += (fbm(res, 120, 1, seed) - 0.5) * 0.015
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {}

def fam_micro(res, p, seed):
    # micro-sandblasted stipple — the matte "cerakote"/bead-blast surface
    stip = fbm(res, p.get("cells", 200), 2, seed, 0.55)
    h = 0.5 + (stip - 0.5) * p.get("amp", 0.10)
    return np.clip(h, 0, 1), np.full((res, res), 0.5), {}

FAMILIES = {
    "concrete": fam_concrete, "brick": fam_brick, "tile": fam_tile, "planks": fam_planks,
    "panel": fam_panel, "corrugated": fam_corrugated, "diamond": fam_diamond, "woven": fam_woven,
    "grain": fam_grain, "fabric": fam_fabric, "asphalt": fam_asphalt, "smooth": fam_smooth,
    "machined": fam_machined, "knurl": fam_knurl, "hex": fam_hex, "micro": fam_micro,
}

# ----------------------------------------------------------------------------
# skin themes — original finishes applied as luminance-preserving recolors so
# one material + one theme = a cohesive weapon/prop finish (no geometry change).
# ----------------------------------------------------------------------------
THEMES = {
    "urban_graphite":     {"tint": "#4c525a", "strength": 0.72, "gain": 1.35, "rough": 0.04},
    "desert_sandstorm":   {"tint": "#c2a878", "strength": 0.70, "gain": 1.25, "rough": 0.05},
    "midnight_alloy":     {"tint": "#2b3340", "strength": 0.80, "gain": 1.30, "rough": -0.02},
    "arctic_frost":       {"tint": "#dfe6ea", "strength": 0.68, "gain": 1.10, "rough": 0.03},
    "volcanic_basalt":    {"tint": "#2a2622", "strength": 0.80, "gain": 1.40, "rough": 0.06},
    "forest_moss":        {"tint": "#5c6a44", "strength": 0.70, "gain": 1.28, "rough": 0.05},
    "digital_mist":       {"tint": "#8794a0", "strength": 0.66, "gain": 1.22, "rough": 0.02},
    "blue_steel":         {"tint": "#5a7488", "strength": 0.70, "gain": 1.25, "rough": -0.03},
    "copper_ember":       {"tint": "#b5723a", "strength": 0.68, "gain": 1.30, "rough": -0.02, "metal": 0.15},
    "industrial_titanium":{"tint": "#9aa0a6", "strength": 0.62, "gain": 1.18, "rough": -0.04, "metal": 0.15},
    "white_ceramic":      {"tint": "#e9e7e1", "strength": 0.72, "gain": 1.08, "rough": 0.02},
    "obsidian_black":     {"tint": "#1c1e22", "strength": 0.82, "gain": 1.45, "rough": 0.0},
    "crimson_alloy":      {"tint": "#8f3b3b", "strength": 0.72, "gain": 1.32, "rough": 0.0},
    "emerald_matrix":     {"tint": "#2f7d63", "strength": 0.70, "gain": 1.30, "rough": -0.02},
    "storm_grey":         {"tint": "#6b7178", "strength": 0.68, "gain": 1.20, "rough": 0.03},
    "golden_bronze":      {"tint": "#a9843e", "strength": 0.68, "gain": 1.28, "rough": -0.02, "metal": 0.15},
    "shadow_carbon":      {"tint": "#33373c", "strength": 0.78, "gain": 1.35, "rough": 0.02},
    "silver_phantom":     {"tint": "#c2c7cc", "strength": 0.60, "gain": 1.12, "rough": -0.05, "metal": 0.20},
    "slate_tactical":     {"tint": "#565d63", "strength": 0.72, "gain": 1.25, "rough": 0.04},
    "titan_core":         {"tint": "#3d4a52", "strength": 0.76, "gain": 1.30, "rough": -0.03, "metal": 0.10},
}

# ----------------------------------------------------------------------------
# derived maps
# ----------------------------------------------------------------------------
def gblur(a, k):
    # separable box-ish blur via repeated rolls (seamless)
    out = a.astype(float).copy()
    for _ in range(2):
        acc = np.zeros_like(out)
        for s in range(-k, k + 1):
            acc += np.roll(out, s, axis=0)
        out = acc / (2 * k + 1)
        acc = np.zeros_like(out)
        for s in range(-k, k + 1):
            acc += np.roll(out, s, axis=1)
        out = acc / (2 * k + 1)
    return out

def normal_from_height(h, strength=2.0):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx = -gx * strength; ny = -gy * strength; nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], -1)

def ao_from_height(h):
    macro = gblur(h, max(2, h.shape[0] // 128))
    cav = h - gblur(h, max(1, h.shape[0] // 512))
    ao = 0.55 + 0.4 * macro + 0.25 * cav
    return np.clip(ao, 0, 1)

def curvature_from_height(h):
    lap = (np.roll(h, 1, 0) + np.roll(h, -1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 1) - 4 * h)
    lap = lap / (np.abs(lap).max() + 1e-9)
    return np.clip(0.5 + lap * 0.5, 0, 1)

# ----------------------------------------------------------------------------
# material assembly
# ----------------------------------------------------------------------------
def hex2rgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255.0

def build(mat, res, theme=None):
    seed = mat.get("seed", 1234)
    fam = FAMILIES[mat["family"]]
    h, tone, extra = fam(res, mat.get("params", {}), seed)
    pal = mat["palette"]
    base = hex2rgb(pal["base"]); base2 = hex2rgb(pal.get("base2", pal["base"]))
    recess = hex2rgb(pal.get("recess", pal.get("base2", pal["base"])))

    # albedo: blend base↔base2 by tone, darken recesses, faint macro grime, edge wear
    t = tone[..., None]
    col = base[None, None, :] * (1 - t) + base2[None, None, :] * t
    rmask = extra.get("mortar_mask")
    if rmask is not None:
        col = col * (1 - rmask[..., None]) + recess[None, None, :] * rmask[..., None]
    grime = fbm(res, 4, 3, seed + 11)[..., None]
    col *= (1 - mat.get("wear", 0.12) * 0.5 * (1 - grime))
    curv = curvature_from_height(h)
    edge = np.clip((curv - 0.62) * 3, 0, 1)[..., None]
    col = col * (1 - edge * 0.25) + np.array([1, 1, 1])[None, None] * edge * 0.10 * mat.get("wear", 0.12)
    col = np.clip(col, 0, 1)

    # roughness / metallic
    rb = mat.get("roughness", 0.6); rv = mat.get("rough_var", 0.15)
    rough = rb + (1 - h) * rv + (fbm(res, 16, 2, seed + 7) - 0.5) * 0.06
    if rmask is not None:
        rough = np.clip(rough + rmask * 0.2, 0, 1)
    rough = np.clip(rough, 0.04, 1.0)
    metal = np.full((res, res), float(mat.get("metallic", 0.0)))
    if mat.get("chips") and mat.get("metallic", 0) < 0.5:   # painted metal: worn chips reveal metal
        chip = (fbm(res, 12, 3, seed + 21) > 0.82).astype(float)
        metal = np.maximum(metal, chip); rough = np.clip(rough - chip * 0.3, 0.04, 1)
        col = col * (1 - chip[..., None]) + hex2rgb(pal.get("metal", "#8a8f96"))[None, None] * chip[..., None]

    # skin theme — luminance-preserving recolor (keeps machining detail + readability)
    if theme:
        th = THEMES.get(theme, theme) if isinstance(theme, str) else theme
        tint = hex2rgb(th["tint"]); s = th.get("strength", 0.7)
        lum = (col * np.array([0.2126, 0.7152, 0.0722])[None, None]).sum(-1, keepdims=True)
        tinted = np.clip(lum * tint[None, None, :] * th.get("gain", 1.25), 0, 1)
        col = np.clip(col * (1 - s) + tinted * s, 0, 1)
        rough = np.clip(rough + th.get("rough", 0.0), 0.04, 1.0)
        if th.get("metal"):
            metal = np.clip(metal + th["metal"], 0, 1)

    nrm = normal_from_height(h, mat.get("normal_strength", 2.0))
    ao = ao_from_height(h)

    maps = {
        "albedo": (col * 255).astype(np.uint8),
        "normal": (((nrm * 0.5 + 0.5)) * 255).astype(np.uint8),
        "ao": (ao * 255).astype(np.uint8),
        "roughness": (rough * 255).astype(np.uint8),
        "metallic": (metal * 255).astype(np.uint8),
        "height": (h * 255).astype(np.uint8),
        "curvature": (curv * 255).astype(np.uint8),
        "orm": (np.stack([ao, rough, metal], -1) * 255).astype(np.uint8),
    }
    maps["_height16"] = (np.clip(h, 0, 1) * 65535).astype(np.uint16)   # displacement
    op = extra.get("opacity_mask")
    if op is not None or mat.get("opacity") is not None:
        if op is None:
            op = np.full((res, res), float(mat["opacity"]))
        maps["opacity"] = (op * 255).astype(np.uint8)
    if mat.get("emission"):
        e = hex2rgb(mat["emission"]["color"]); m = mat["emission"].get("mask", 1.0)
        em = np.ones((res, res)) * m
        maps["emission"] = (np.stack([e[0] * em, e[1] * em, e[2] * em], -1) * 255).astype(np.uint8)
    return maps

def save(maps, outdir, mid, res):
    d = os.path.join(outdir, mid); os.makedirs(d, exist_ok=True)
    for k, v in maps.items():
        if k == "_height16":
            Image.fromarray(v, mode="I;16").save(os.path.join(d, f"{mid}_displacement_{res}.png"))
        else:
            Image.fromarray(v).save(os.path.join(d, f"{mid}_{k}_{res}.png"))
    return d

# ----------------------------------------------------------------------------
# contact sheet (albedo + normal + orm + height thumbnails per material)
# ----------------------------------------------------------------------------
def contact(mats, res, outpath, cols=6, thumb=200, theme=None):
    rows = (len(mats) + cols - 1) // cols
    pad, lab = 10, 16
    cw, ch = thumb + pad, thumb + pad + lab
    sheet = Image.new("RGB", (cols * cw + pad, rows * ch + pad), (16, 18, 22))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(sheet)
    for i, mat in enumerate(mats):
        m = build(mat, res, theme)
        alb = Image.fromarray(m["albedo"]).resize((thumb, thumb), Image.LANCZOS)
        r, c = divmod(i, cols)
        x = pad + c * cw; y = pad + r * ch
        sheet.paste(alb, (x, y))
        dr.text((x + 2, y + thumb + 2), mat["id"][:26], fill=(210, 214, 220))
    sheet.save(outpath)
    return outpath

# ----------------------------------------------------------------------------
def load_catalog(path):
    with open(path) as f:
        cat = json.load(f)
    out = []
    for m in cat["materials"]:
        base = dict(cat.get("defaults", {}))
        base.update(m)
        out.append(base)
    return cat, out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog"); ap.add_argument("--material")
    ap.add_argument("--res", type=int, default=1024)
    ap.add_argument("--out", default="out")
    ap.add_argument("--only", default="")
    ap.add_argument("--contact", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--theme", default="", help="apply a skin theme (see THEMES)")
    a = ap.parse_args()
    theme = a.theme or None
    suffix = f"_{theme}" if theme else ""

    if a.catalog:
        cat, mats = load_catalog(a.catalog)
        if a.only:
            cats = set(a.only.split(","))
            mats = [m for m in mats if m["category"] in cats]
        if a.material:                       # target specific id(s) within the catalog
            ids = set(a.material.split(","))
            mats = [m for m in mats if m["id"] in ids]
        if a.limit:
            mats = mats[:a.limit]
        if a.contact:
            os.makedirs(a.contact, exist_ok=True)
            name = f"contact{suffix}_{a.res}.png"
            p = contact(mats, min(a.res, 512), os.path.join(a.contact, name), theme=theme)
            print("contact sheet:", p, f"({len(mats)} materials)")
            return
        for m in mats:
            d = save(build(m, a.res, theme), a.out, m["id"] + suffix, a.res)
            print("wrote", d)
    elif a.material:
        # standalone quick material by family name for smoke tests
        m = {"id": a.material, "category": "test", "family": a.material,
             "palette": {"base": "#9aa0a6", "base2": "#7f858c", "recess": "#5c6066"},
             "roughness": 0.6, "metallic": 0.0}
        save(build(m, a.res), a.out, m["id"], a.res)
        print("wrote", os.path.join(a.out, m["id"]))
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
