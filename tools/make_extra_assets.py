#!/usr/bin/env python3
"""Procedural stand-ins for the manifest rows that could not be generated
(tex_metal_panel, tex_snow_floor, img_thumbnail, img_favicon).

STYLE FORMULA v1 (byte-identical contract lives in the generation prompts;
this code embeds its palette + light rules): flat-shaded low-poly surfaces,
muted environment tones, dark gunmetal + warm amber for weapons, signal
orange + cyan glow for effects, harsh clear daylight.

Usage: python3 make_extra_assets.py <textures_dir> <out_dir>
  textures_dir: contains sand.png / concrete.png / crate.png / asphalt.png (512px tiles)
  out_dir: receives metal.png, snow.png, cover.png (1280x720), favicon.png (512)
"""
import sys, glob, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

GUNMETAL = (46, 50, 56)
GUNMETAL_HI = (66, 72, 82)
AMBER = (255, 176, 58)
ORANGE = (255, 122, 26)
CYAN = (74, 215, 232)
BONE = (232, 228, 218)
CHARCOAL = (26, 31, 41)


def wrap_blur(a, sigma_y, sigma_x=None):
    """FFT gaussian blur that wraps — keeps procedural tiles seamless."""
    if sigma_x is None:
        sigma_x = sigma_y
    fy = np.fft.fftfreq(a.shape[0])[:, None]
    fx = np.fft.fftfreq(a.shape[1])[None, :]
    k = np.exp(-2 * (np.pi ** 2) * ((sigma_y * fy) ** 2 + (sigma_x * fx) ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * k))


def metal_tile(n=512, seed=7):
    rng = np.random.default_rng(seed)
    img = np.zeros((n, n, 3))
    base = np.array([52, 57, 66], float)

    # 2x2 panel grid with per-panel value shift (gap lines on the wrap edges
    # and at the half line so the tile repeats cleanly)
    half = n // 2
    panel = np.zeros((n, n))
    for iy in range(2):
        for ix in range(2):
            panel[iy * half:(iy + 1) * half, ix * half:(ix + 1) * half] = rng.uniform(-6, 6)
    img += base + panel[..., None]

    # brushed horizontal streaks
    streaks = wrap_blur(rng.normal(0, 1, (n, n)), 0.5, 24)
    streaks = streaks / (np.abs(streaks).max() + 1e-9) * 10
    img += streaks[..., None] * np.array([1.0, 1.0, 1.1])

    # broad wear patches
    wear = wrap_blur(rng.normal(0, 1, (n, n)), 40)
    wear = wear / (np.abs(wear).max() + 1e-9) * 9
    img += wear[..., None]

    # panel gap lines (dark) at 0 and half, wrap-symmetric so the tile repeats
    for c in (0, half):
        for off in (-1, 0, 1):
            img[(c + off) % n, :, :] -= 18
            img[:, (c + off) % n, :] -= 18

    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(out)
    # rivets inset at panel corners
    ins = 22
    for iy in range(2):
        for ix in range(2):
            x0, y0 = ix * half, iy * half
            for px, py in ((ins, ins), (half - ins, ins), (ins, half - ins), (half - ins, half - ins)):
                cx, cy = (x0 + px) % n, (y0 + py) % n
                d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(70, 76, 86))
                d.ellipse([cx - 3, cy - 4, cx + 2, cy + 1], fill=(92, 99, 110))
    return out


def snow_tile(n=512, seed=11):
    rng = np.random.default_rng(seed)
    base = np.array([233, 238, 244], float)
    img = np.zeros((n, n, 3)) + base

    # wind-swept drifts: noise blurred much more along x than y
    drifts = wrap_blur(rng.normal(0, 1, (n, n)), 6, 42)
    drifts = drifts / (np.abs(drifts).max() + 1e-9)
    img += (drifts * 10)[..., None] * np.array([0.9, 1.0, 1.1])

    # faint blue ice patches
    ice = wrap_blur(rng.normal(0, 1, (n, n)), 60)
    ice = np.clip(ice / (np.abs(ice).max() + 1e-9), 0, 1)
    img = img * (1 - ice[..., None] * 0.18) + ice[..., None] * 0.18 * np.array([196, 219, 236])

    # fine packed grain
    grain = wrap_blur(rng.normal(0, 1, (n, n)), 0.8)
    img += (grain / (np.abs(grain).max() + 1e-9) * 5)[..., None]

    # sparse sparkle
    ys, xs = rng.integers(0, n, 260), rng.integers(0, n, 260)
    img[ys, xs] = np.minimum(img[ys, xs] + 22, 255)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def find_font(bold=True):
    pats = ["**/Montserrat*ExtraBold*.ttf", "**/Montserrat*Bold*.ttf",
            "**/Metropolis*Bold*.ttf", "**/DejaVuSans-Bold.ttf", "**/DejaVuSans.ttf",
            "**/*Bold*.ttf"]
    roots = ["/usr/share/fonts", "/usr/local/share/fonts", "/root/.fonts", "/home/user/.fonts"]
    for p in pats:
        for r in roots:
            hits = glob.glob(f"{r}/{p}", recursive=True)
            if hits:
                return hits[0]
    return None


def font(sz):
    f = find_font()
    return ImageFont.truetype(f, sz) if f else ImageFont.load_default()


def draw_soldier(d, x, y, s, aim=True):
    """Low-poly boxy soldier silhouette, gunmetal + amber visor, firing right."""
    gm, dk = GUNMETAL, (35, 38, 44)
    # legs
    d.rectangle([x - 0.22 * s, y - 0.84 * s, x - 0.04 * s, y], fill=dk)
    d.rectangle([x + 0.04 * s, y - 0.84 * s, x + 0.22 * s, y], fill=dk)
    # torso
    d.rectangle([x - 0.3 * s, y - 1.5 * s, x + 0.3 * s, y - 0.8 * s], fill=gm)
    d.rectangle([x - 0.3 * s, y - 1.34 * s, x + 0.3 * s, y - 1.26 * s], fill=ORANGE)
    # head + visor
    d.rectangle([x - 0.16 * s, y - 1.86 * s, x + 0.16 * s, y - 1.54 * s], fill=gm)
    d.rectangle([x - 0.16 * s, y - 1.78 * s, x + 0.16 * s, y - 1.7 * s], fill=AMBER)
    if aim:
        # both arms forward holding rifle
        d.rectangle([x + 0.24 * s, y - 1.48 * s, x + 0.78 * s, y - 1.34 * s], fill=gm)
        # rifle
        d.rectangle([x + 0.3 * s, y - 1.45 * s, x + 1.35 * s, y - 1.36 * s], fill=dk)
        d.rectangle([x + 0.52 * s, y - 1.36 * s, x + 0.62 * s, y - 1.18 * s], fill=dk)
        d.rectangle([x + 0.72 * s, y - 1.52 * s, x + 0.85 * s, y - 1.45 * s], fill=AMBER)


def muzzle_flash(img, cx, cy, r):
    fl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(fl)
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        d.line([cx, cy, cx + math.cos(a) * r, cy + math.sin(a) * r],
               fill=ORANGE + (230,), width=max(3, r // 6))
    d.ellipse([cx - r * 0.45, cy - r * 0.45, cx + r * 0.45, cy + r * 0.45], fill=(255, 240, 200, 255))
    fl = fl.filter(ImageFilter.GaussianBlur(2))
    img.alpha_composite(fl)


def cover(tex_dir, w=1280, h=720):
    img = Image.new("RGBA", (w, h))
    # sky gradient (dust palette)
    top, hor = np.array([201, 220, 232]), np.array([216, 205, 180])
    horizon = int(h * 0.46)
    sky = np.zeros((h, w, 3))
    for yy in range(horizon):
        t = yy / horizon
        sky[yy] = top * (1 - t) + hor * t
    # sand ground from the generated tile
    try:
        sand = Image.open(f"{tex_dir}/sand.png").resize((w, w))
        ground = np.asarray(sand.convert("RGB"), float)[: h - horizon + 40]
        gh = ground.shape[0]
        shade = np.linspace(1.0, 0.72, gh)[:, None, None]
        sky[horizon - 40:horizon - 40 + gh] = ground * shade
    except Exception:
        sky[horizon:] = np.array([190, 170, 130])
    img.paste(Image.fromarray(sky.astype(np.uint8)).convert("RGBA"))

    d = ImageDraw.Draw(img)
    # distant wall band
    d.rectangle([0, horizon - 60, w, horizon - 8], fill=(141, 141, 133, 255))
    d.rectangle([0, horizon - 14, w, horizon - 8], fill=(120, 120, 112, 255))
    # crates (pseudo-3D from crate tile)
    try:
        crate = Image.open(f"{tex_dir}/crate.png").convert("RGB")
        for (cx, cy, cs) in ((980, horizon + 150, 190), (1120, horizon + 190, 230), (150, horizon + 120, 150)):
            face = crate.resize((cs, cs))
            img.paste(face, (cx, cy - cs))
            side = np.asarray(face, float) * 0.62
            side_img = Image.fromarray(side.astype(np.uint8)).resize((cs // 4, cs))
            img.paste(side_img, (cx + cs, cy - cs))
    except Exception:
        pass
    # soldier + flash + tracers
    draw_soldier(d, 420, horizon + 260, 190)
    muzzle_flash(img, 420 + int(1.38 * 190), horizon + 260 - int(1.4 * 190), 46)
    d = ImageDraw.Draw(img)
    for (y0, x1) in ((horizon - 90, 1100), (horizon - 40, 1210)):
        d.line([690, horizon + 260 - 265, x1, y0], fill=AMBER + (150,), width=3)
    # title
    t1, t2 = "GUN GAME", "ARENA"
    f1 = font(120)
    f2 = font(150)
    w1 = d.textlength(t1, font=f1)
    w2 = d.textlength(t2, font=f2)
    for (t, f, tw, ty, col) in ((t1, f1, w1, 40, BONE), (t2, f2, w2, 158, ORANGE)):
        x = (w - tw) / 2
        d.text((x + 5, ty + 6), t, font=f, fill=(15, 17, 22, 200))
        d.text((x, ty), t, font=f, fill=col + (255,))
    return img.convert("RGB")


def favicon(sz=512):
    img = Image.new("RGB", (sz, sz), CHARCOAL)
    d = ImageDraw.Draw(img)
    c = sz / 2
    # shield
    m = sz * 0.14
    pts = [(c, m), (sz - m, sz * 0.3), (sz - m, sz * 0.58), (c, sz - m), (m, sz * 0.58), (m, sz * 0.3)]
    d.polygon(pts, fill=GUNMETAL)
    inner = [(c, m + 26), (sz - m - 24, sz * 0.31), (sz - m - 24, sz * 0.56), (c, sz - m - 30),
             (m + 24, sz * 0.56), (m + 24, sz * 0.31)]
    d.polygon(inner, fill=GUNMETAL_HI)
    # crosshair
    r = sz * 0.185
    lwr = int(sz * 0.045)
    d.ellipse([c - r, c - r, c + r, c + r], outline=ORANGE, width=lwr)
    tick = sz * 0.1
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        d.line([c + dx * (r - tick * 0.35), c + dy * (r - tick * 0.35),
                c + dx * (r + tick * 0.65), c + dy * (r + tick * 0.65)], fill=ORANGE, width=lwr)
    d.ellipse([c - lwr * 1.1, c - lwr * 1.1, c + lwr * 1.1, c + lwr * 1.1], fill=AMBER)
    # cyan glint
    d.ellipse([c + r * 0.45, c - r * 0.85, c + r * 0.62, c - r * 0.68], fill=CYAN)
    return img


if __name__ == "__main__":
    tex_dir, out_dir = sys.argv[1], sys.argv[2]
    metal_tile().save(f"{out_dir}/metal.png")
    snow_tile().save(f"{out_dir}/snow.png")
    cover(tex_dir).save(f"{out_dir}/cover.png")
    favicon().save(f"{out_dir}/favicon.png")
    print("extra assets written")
