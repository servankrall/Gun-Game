#!/usr/bin/env python3
"""
decalgen — procedural flat-vector decal / signage / marking generator (VANTAGE).

Original iconography only: symbols are drawn from geometric primitives; no
logos, no copyrighted pictograms, no game branding. Every decal exports a
transparent graphic plus the maps an engine needs to project it onto a surface:

  albedo (RGBA), opacity, normal, roughness, ao, orm, height

Material response controls how the mark reads under light:
  paint / vinyl (flat), reflective (low-rough), embossed (raised),
  engraved (cut-in, metal in the grooves), sticker (slight lift + edge).

Deps: numpy, pillow.  Usage:
  python3 decalgen.py --catalog decals.json --res 1024 --out out_decals/
  python3 decalgen.py --catalog decals.json --contact previews/ --res 512
"""
import argparse, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
def font(size):
    for f in FONT_CANDIDATES:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()

# VANTAGE sign palette (original, high-signal, industrial)
PAL = {
    "white": (238, 238, 236), "black": (24, 25, 28), "lgrey": (196, 199, 203),
    "dgrey": (74, 78, 84), "yellow": (255, 206, 45), "orange": (255, 122, 26),
    "red": (223, 62, 62), "blue": (43, 92, 168), "green": (58, 168, 108),
    "olive": (108, 122, 72), "cyan": (46, 197, 192), "beige": (198, 190, 170),
}
def col(name): return PAL.get(name, (238, 238, 236))

# ----------------------------------------------------------------------------
# original symbols — polygons/primitives centered in a box [x0,y0,x1,y1]
# ----------------------------------------------------------------------------
def _box(cx, cy, s): return cx - s, cy - s, cx + s, cy + s

def sym_bolt(d, cx, cy, s, c):
    p = [(cx-0.2*s,cy-s),(cx+0.45*s,cy-s),(cx+0.05*s,cy-0.1*s),(cx+0.5*s,cy-0.1*s),
         (cx-0.3*s,cy+s),(cx-0.02*s,cy+0.15*s),(cx-0.5*s,cy+0.15*s)]
    d.polygon(p, fill=c)

def sym_exclam(d, cx, cy, s, c):
    d.polygon([(cx-0.16*s,cy-0.85*s),(cx+0.16*s,cy-0.85*s),(cx+0.10*s,cy+0.35*s),(cx-0.10*s,cy+0.35*s)], fill=c)
    d.ellipse(_box(cx, cy+0.7*s, 0.17*s), fill=c)

def sym_flame(d, cx, cy, s, c):
    p = [(cx,cy-s),(cx+0.5*s,cy-0.1*s),(cx+0.4*s,cy+0.5*s),(cx,cy+s),
         (cx-0.4*s,cy+0.5*s),(cx-0.5*s,cy-0.1*s),(cx-0.1*s,cy+0.1*s),(cx+0.05*s,cy-0.4*s)]
    d.polygon(p, fill=c)

def sym_gear(d, cx, cy, s, c):
    import math
    n=8; r1=s*0.9; r2=s*0.62
    pts=[]
    for i in range(n*2):
        r=r1 if i%2==0 else r2
        a=math.pi*i/n
        pts.append((cx+r*math.cos(a), cy+r*math.sin(a)))
    d.polygon(pts, fill=c)
    d.ellipse(_box(cx,cy,0.28*s), fill=(0,0,0,0))

def sym_cylinder(d, cx, cy, s, c):
    d.rounded_rectangle([cx-0.4*s,cy-0.6*s,cx+0.4*s,cy+s], radius=0.35*s, fill=c)
    d.rectangle([cx-0.12*s,cy-0.95*s,cx+0.12*s,cy-0.5*s], fill=c)

def sym_drop(d, cx, cy, s, c):
    d.polygon([(cx,cy-s),(cx+0.55*s,cy+0.35*s),(cx-0.55*s,cy+0.35*s)], fill=c)
    d.ellipse(_box(cx,cy+0.35*s,0.55*s), fill=c)

def sym_person(d, cx, cy, s, c):
    d.ellipse(_box(cx,cy-0.55*s,0.28*s), fill=c)
    d.polygon([(cx-0.35*s,cy+0.7*s),(cx-0.2*s,cy-0.1*s),(cx+0.2*s,cy-0.1*s),(cx+0.35*s,cy+0.7*s)], fill=c)

def sym_forklift(d, cx, cy, s, c):
    d.rectangle([cx-0.6*s,cy-0.2*s,cx+0.1*s,cy+0.45*s], fill=c)      # body
    d.rectangle([cx+0.1*s,cy-0.6*s,cx+0.22*s,cy+0.45*s], fill=c)     # mast
    d.rectangle([cx+0.22*s,cy+0.35*s,cx+0.75*s,cy+0.45*s], fill=c)   # fork
    d.ellipse(_box(cx-0.4*s,cy+0.6*s,0.2*s), fill=c)
    d.ellipse(_box(cx-0.02*s,cy+0.6*s,0.2*s), fill=c)

def sym_crane(d, cx, cy, s, c):
    d.rectangle([cx-0.7*s,cy-0.7*s,cx+0.7*s,cy-0.55*s], fill=c)      # beam
    d.rectangle([cx-0.05*s,cy-0.55*s,cx+0.05*s,cy+0.2*s], fill=c)    # cable
    d.polygon([(cx-0.2*s,cy+0.2*s),(cx+0.2*s,cy+0.2*s),(cx,cy+0.7*s)], fill=c)  # hook mass
    d.arc(_box(cx,cy+0.45*s,0.22*s), 20, 320, fill=c, width=max(2,int(0.08*s)))

def sym_stairs(d, cx, cy, s, c):
    n=4; step=1.4*s/n
    for i in range(n):
        x=cx-0.7*s+i*step; y=cy+0.7*s-i*step
        d.rectangle([x,y-step,x+step,y], fill=c)

def sym_arrow(d, cx, cy, s, c, ang=0):
    import math
    base=[(-0.9,-0.22),(0.1,-0.22),(0.1,-0.5),(0.9,0.0),(0.1,0.5),(0.1,0.22),(-0.9,0.22)]
    ca,sa=math.cos(ang),math.sin(ang)
    d.polygon([(cx+(x*ca-y*sa)*s,cy+(x*sa+y*ca)*s) for x,y in base], fill=c)

def sym_laser(d, cx, cy, s, c):
    import math
    for i in range(12):
        a=math.pi*i/6
        d.line([cx,cy,cx+s*math.cos(a),cy+s*math.sin(a)], fill=c, width=max(2,int(0.06*s)))
    d.ellipse(_box(cx,cy,0.2*s), fill=c)

def sym_camera(d, cx, cy, s, c):
    d.rounded_rectangle([cx-0.7*s,cy-0.3*s,cx+0.35*s,cy+0.3*s], radius=0.1*s, fill=c)
    d.polygon([(cx+0.35*s,cy-0.15*s),(cx+0.7*s,cy-0.35*s),(cx+0.7*s,cy+0.35*s),(cx+0.35*s,cy+0.15*s)], fill=c)
    d.ellipse(_box(cx-0.35*s,cy,0.12*s), fill=(0,0,0,0))

def sym_wave(d, cx, cy, s, c):
    import math
    for k in (-0.35,0.15):
        pts=[(cx-0.8*s+ i*0.16*s, cy+k*s+0.18*s*math.sin(i*0.9)) for i in range(11)]
        d.line(pts, fill=c, width=max(3,int(0.09*s)))

def sym_hexnut(d, cx, cy, s, c):
    import math
    pts=[(cx+s*math.cos(math.pi/6+math.pi*i/3),cy+s*math.sin(math.pi/6+math.pi*i/3)) for i in range(6)]
    d.polygon(pts, fill=c); d.ellipse(_box(cx,cy,0.4*s), fill=(0,0,0,0))

def sym_dot(d, cx, cy, s, c): d.ellipse(_box(cx,cy,0.5*s), fill=c)

SYMBOLS = {
    "bolt":sym_bolt,"exclam":sym_exclam,"flame":sym_flame,"gear":sym_gear,"cylinder":sym_cylinder,
    "drop":sym_drop,"person":sym_person,"forklift":sym_forklift,"crane":sym_crane,"stairs":sym_stairs,
    "laser":sym_laser,"camera":sym_camera,"wave":sym_wave,"hexnut":sym_hexnut,"dot":sym_dot,
    "arrow":sym_arrow,
}

# ----------------------------------------------------------------------------
# decal kinds → draw onto an RGBA canvas, return (rgba Image, height float 0..1)
# ----------------------------------------------------------------------------
def _blank(res): return Image.new("RGBA",(res,res),(0,0,0,0))

def kind_warning(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res
    m=0.08*R; pts=[(R*0.5,m),(R-m,R-m*1.1),(m,R-m*1.1)]
    d.polygon(pts, fill=col("yellow"))
    # inner border
    b=0.045*R; ip=[(R*0.5,m+b*1.7),(R-m-b,R-m*1.1-b),(m+b,R-m*1.1-b)]
    d.polygon(pts, outline=col("black"));
    for w in range(int(0.03*R)):
        d.polygon([(R*0.5,m+w),(R-m-w*0.6,R-m*1.1),(m+w*0.6,R-m*1.1)], outline=col("black"))
    sym=SYMBOLS.get(dec.get("symbol","exclam"))
    if sym: sym(d, R*0.5, R*0.60, 0.20*R, col("black"))
    return im

def kind_prohibition(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res; c=R*0.5; rad=R*0.42
    d.ellipse(_box(c,c,rad), fill=col("white"))
    ring=int(0.09*R)
    d.ellipse(_box(c,c,rad), outline=col("red"), width=ring)
    sym=SYMBOLS.get(dec.get("symbol","person"))
    if sym: sym(d, c, c, 0.22*R, col("black"))
    # diagonal bar
    import math
    dx=rad*math.cos(math.radians(45)); dy=rad*math.sin(math.radians(45))
    d.line([c-dx,c-dy,c+dx,c+dy], fill=col("red"), width=ring)
    return im

def kind_mandatory(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res; c=R*0.5
    d.ellipse(_box(c,c,R*0.42), fill=col("blue"))
    sym=SYMBOLS.get(dec.get("symbol","person"))
    if sym: sym(d, c, c, 0.22*R, col("white"))
    return im

def kind_safe(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res
    d.rounded_rectangle([R*0.06,R*0.24,R*0.94,R*0.76], radius=R*0.05, fill=col("green"))
    t=dec.get("text","EXIT"); f=font(int(R*0.26))
    tb=d.textbbox((0,0),t,font=f); tw=tb[2]-tb[0]; th=tb[3]-tb[1]
    d.text((R*0.5-tw/2, R*0.5-th/2-tb[1]), t, font=f, fill=col("white"))
    if dec.get("symbol"):
        SYMBOLS[dec["symbol"]](d, R*0.16, R*0.5, 0.10*R, col("white"))
    return im

def kind_arrow(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res
    ang={"right":0,"left":np.pi,"up":-np.pi/2,"down":np.pi/2}.get(dec.get("dir","right"),0)
    sym_arrow(d, R*0.5, R*0.5, R*0.42, col(dec.get("color","orange")), ang)
    return im

def kind_plate(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res
    bg=col(dec.get("bg","dgrey")); fg=col(dec.get("fg","white"))
    d.rounded_rectangle([R*0.05,R*0.30,R*0.95,R*0.70], radius=R*0.04, fill=bg)
    d.rounded_rectangle([R*0.05,R*0.30,R*0.95,R*0.70], radius=R*0.04, outline=fg, width=max(1,int(0.01*R)))
    t=dec.get("text","ROOM 000");
    fs=int(R*0.24)
    f=font(fs)
    tb=d.textbbox((0,0),t,font=f); tw=tb[2]-tb[0]
    while tw> R*0.86 and fs>8:
        fs=int(fs*0.9); f=font(fs); tb=d.textbbox((0,0),t,font=f); tw=tb[2]-tb[0]
    th=tb[3]-tb[1]
    d.text((R*0.5-tw/2, R*0.5-th/2-tb[1]), t, font=f, fill=fg)
    return im

def kind_id(res, dec):
    im=_blank(res); d=ImageDraw.Draw(im); R=res
    band=col(dec.get("bg","yellow")); fg=col(dec.get("fg","black"))
    d.rectangle([R*0.05,R*0.40,R*0.95,R*0.60], fill=band)
    t=dec.get("text","A-01"); fs=int(R*0.15); f=font(fs)
    tb=d.textbbox((0,0),t,font=f); tw=tb[2]-tb[0]; th=tb[3]-tb[1]
    d.text((R*0.5-tw/2, R*0.5-th/2-tb[1]), t, font=f, fill=fg)
    return im

def kind_stripe(res, dec):
    # tileable floor marking band: hazard stripes / lane / keep-clear
    im=_blank(res); d=ImageDraw.Draw(im); R=res
    style=dec.get("style","hazard")
    a=col(dec.get("a","yellow")); b=col(dec.get("b","black"))
    if style=="hazard":
        d.rectangle([0,0,R,R], fill=a)
        w=int(R/6)
        for i in range(-R, R*2, w*2):
            d.polygon([(i,0),(i+w,0),(i+w-R,R),(i-R,R)], fill=b)
    elif style=="lane":
        d.rectangle([0,int(R*0.42),R,int(R*0.58)], fill=a)
    elif style=="dashed":
        for i in range(0,R,int(R/4)):
            d.rectangle([i+int(R*0.06),int(R*0.44),i+int(R/4)-int(R*0.06),int(R*0.56)], fill=a)
    elif style=="solid":
        d.rectangle([0,0,R,R], fill=a)
    return im

def kind_mark(res, dec):
    # small-detail decal: scuff / stain / smudge / drip — soft alpha, no hard shape
    im=_blank(res); R=res
    rng=np.random.default_rng(dec.get("seed",7))
    style=dec.get("style","scuff")
    a=np.zeros((R,R))
    if style in ("scuff","wheel","foot"):
        for _ in range(dec.get("count",6)):
            x0=rng.integers(0,R); y0=rng.integers(int(R*0.3),int(R*0.7))
            ln=rng.integers(int(R*0.2),int(R*0.7)); th=rng.integers(int(R*0.01),int(R*0.05))
            xs=np.clip(np.arange(x0,x0+ln),0,R-1);
            for k in range(-th,th):
                a[np.clip(y0+k,0,R-1),xs]=rng.uniform(0.3,0.8)
    elif style in ("stain","oil","water","rust"):
        cx,cy=rng.uniform(0.3,0.7,2)*R
        yy,xx=np.mgrid[0:R,0:R]
        blob=np.exp(-(((xx-cx)**2+(yy-cy)**2)/(2*(R*0.22)**2)))
        blob*= (0.5+0.5*_fbm(R,6,rng.integers(0,9999)))
        a=np.clip(blob*1.2,0,1)
    elif style=="smudge":
        yy,xx=np.mgrid[0:R,0:R]
        a=np.clip(_fbm(R,4,dec.get("seed",3))*0.6,0,1)
    tint={"oil":(20,20,24),"water":(60,66,72),"rust":(120,70,45),"stain":(70,66,58)}.get(style,(40,42,46))
    rgba=np.zeros((R,R,4),np.uint8)
    rgba[...,0]=tint[0]; rgba[...,1]=tint[1]; rgba[...,2]=tint[2]
    rgba[...,3]=(a*255).astype(np.uint8)
    return Image.fromarray(rgba,"RGBA")

def _fbm(res, cells, seed):
    rng=np.random.default_rng(seed); out=np.zeros((res,res)); amp=1; tot=0
    for o in range(4):
        c=max(2,cells*2**o); g=rng.random((c,c))
        img=np.array(Image.fromarray((g*255).astype(np.uint8)).resize((res,res),Image.BILINEAR))/255.0
        out+=amp*img; tot+=amp; amp*=0.5
    out/=tot; return (out-out.min())/(np.ptp(out)+1e-9)

KINDS={"warning":kind_warning,"prohibition":kind_prohibition,"mandatory":kind_mandatory,
       "safe":kind_safe,"arrow":kind_arrow,"plate":kind_plate,"id":kind_id,
       "stripe":kind_stripe,"mark":kind_mark}

# ----------------------------------------------------------------------------
# maps from the rendered RGBA graphic
# ----------------------------------------------------------------------------
def normal_from_h(h, strength):
    gx=(np.roll(h,-1,1)-np.roll(h,1,1))*0.5; gy=(np.roll(h,-1,0)-np.roll(h,1,0))*0.5
    nx=-gx*strength; ny=-gy*strength; nz=np.ones_like(h)
    l=np.sqrt(nx*nx+ny*ny+nz*nz); return np.stack([nx/l,ny/l,nz/l],-1)

def build_decal(dec, res):
    rgba=np.array(KINDS[dec["kind"]](res, dec).convert("RGBA"))
    alpha=rgba[...,3].astype(float)/255.0
    rgb=rgba[...,:3].astype(float)/255.0
    resp=dec.get("response","vinyl")
    # height: relief from the graphic footprint per material response
    lum=(rgb*np.array([0.2126,0.7152,0.0722])).sum(-1)
    if resp=="engraved":
        h=0.5-alpha*0.5*(1-lum*0.3)          # cut into the surface
        strength=3.0
    elif resp in ("embossed","sticker"):
        h=0.5+alpha*(0.5 if resp=="embossed" else 0.2)
        strength=3.0 if resp=="embossed" else 1.4
    else:  # paint / vinyl / reflective — flat
        h=0.5+alpha*0.02
        strength=0.5
    h=np.clip(h,0,1)
    nrm=normal_from_h(h, strength)
    # roughness by response
    rbase={"paint":0.6,"vinyl":0.45,"reflective":0.18,"embossed":0.5,"engraved":0.4,"sticker":0.5}.get(resp,0.5)
    rough=np.full((res,res),rbase)
    rough=rough*(1-alpha)+ (rbase*np.ones_like(rough))*alpha   # (mark sits on substrate rough elsewhere)
    metal=np.zeros((res,res))
    if resp=="engraved":
        metal=alpha*0.9                        # bare metal in the cut
        rough=rough*(1-alpha)+0.3*alpha
    ao=np.clip(0.6+0.4*_edge_ao(h),0,1)
    orm=np.stack([ao,np.clip(rough,0.04,1),np.clip(metal,0,1)],-1)
    maps={
        "albedo":rgba[...,:3],
        "opacity":(alpha*255).astype(np.uint8),
        "normal":(((nrm*0.5+0.5))*255).astype(np.uint8),
        "roughness":(np.clip(rough,0.04,1)*255).astype(np.uint8),
        "ao":(ao*255).astype(np.uint8),
        "orm":(orm*255).astype(np.uint8),
        "height":(h*255).astype(np.uint8),
        "_rgba":rgba,   # keep alpha for transparent PNG
    }
    return maps

def _edge_ao(h):
    lap=(np.roll(h,1,0)+np.roll(h,-1,0)+np.roll(h,1,1)+np.roll(h,-1,1)-4*h)
    return np.clip(0.5+lap/(np.abs(lap).max()+1e-9)*0.5,0,1)

def save_decal(maps, outdir, did, res):
    d=os.path.join(outdir,did); os.makedirs(d,exist_ok=True)
    Image.fromarray(maps["_rgba"],"RGBA").save(os.path.join(d,f"{did}_albedo_{res}.png"))  # transparent
    for k in ("opacity","normal","roughness","ao","orm","height"):
        Image.fromarray(maps[k]).save(os.path.join(d,f"{did}_{k}_{res}.png"))
    return d

def contact(decs, res, outpath, cols=8, thumb=150):
    rows=(len(decs)+cols-1)//cols; pad,lab=10,14
    cw,ch=thumb+pad,thumb+pad+lab
    sheet=Image.new("RGB",(cols*cw+pad,rows*ch+pad),(20,22,26))
    dr=ImageDraw.Draw(sheet); f=font(11)
    # checker so transparent decals read
    for i,dec in enumerate(decs):
        m=build_decal(dec,res)
        tile=Image.new("RGB",(thumb,thumb),(210,212,214))
        for yy in range(0,thumb,20):
            for xx in range(0,thumb,20):
                if (xx//20+yy//20)%2:
                    ImageDraw.Draw(tile).rectangle([xx,yy,xx+20,yy+20],fill=(188,190,193))
        g=Image.fromarray(m["_rgba"],"RGBA").resize((thumb,thumb),Image.LANCZOS)
        tile.paste(g,(0,0),g)
        r,c=divmod(i,cols); x=pad+c*cw; y=pad+r*ch
        sheet.paste(tile,(x,y)); dr.text((x+2,y+thumb+1),dec["id"][:22],fill=(210,214,220),font=f)
    sheet.save(outpath); return outpath

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--catalog"); ap.add_argument("--res",type=int,default=1024)
    ap.add_argument("--out",default="out_decals"); ap.add_argument("--contact",default="")
    ap.add_argument("--only",default=""); ap.add_argument("--limit",type=int,default=0)
    a=ap.parse_args()
    cat=json.load(open(a.catalog)); decs=cat["decals"]
    if a.only:
        cats=set(a.only.split(",")); decs=[d for d in decs if d.get("category") in cats]
    if a.limit: decs=decs[:a.limit]
    if a.contact:
        os.makedirs(a.contact,exist_ok=True)
        p=contact(decs,min(a.res,512),os.path.join(a.contact,f"decals_{a.res}.png"))
        print("contact:",p,f"({len(decs)} decals)"); return
    for d in decs:
        print("wrote", save_decal(build_decal(d,a.res),a.out,d["id"],a.res))

if __name__=="__main__":
    main()
