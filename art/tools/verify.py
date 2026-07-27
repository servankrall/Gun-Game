import numpy as np, json, sys
sys.path.insert(0, "tools"); import texgen as T
from PIL import Image
cat=json.load(open("materials.json")); mats={m["id"]:m for m in cat["materials"]}
flag=["concrete_industrial","metal_diamond_plate","wood_oak","brick_red","ground_gravel","carbon_woven","tile_bathroom","metal_painted"]
# 1) full map set for one, saved
import os
for mid in flag:
    T.save(T.build(mats[mid],1024),"out",mid,1024)
print("saved 1024 sets:", ", ".join(flag))
# 2) map-breakdown sheet for brick_red
m=T.build(mats["brick_red"],512)
order=["albedo","normal","orm","roughness","ao","height","curvature"]
th=220; sheet=Image.new("RGB",(len(order)*(th+8)+8,th+28),(16,18,22))
from PIL import ImageDraw; d=ImageDraw.Draw(sheet)
for i,k in enumerate(order):
    a=m[k]
    img=Image.fromarray(a if a.ndim==3 else np.stack([a]*3,-1)).resize((th,th),Image.NEAREST)
    x=8+i*(th+8); sheet.paste(img,(x,8)); d.text((x+2,th+12),k,fill=(210,214,220))
sheet.save("previews/maps_brick_red.png"); print("map breakdown -> previews/maps_brick_red.png")
# 3) seamless check: tile albedo 2x2 and measure edge continuity
def seam(mid):
    a=T.build(mats[mid],256)["albedo"].astype(float)
    v=abs(a[0]-a[-1]).mean()+abs(a[:,0]-a[:,-1]).mean()
    base=abs(np.diff(a,axis=0)).mean()+abs(np.diff(a,axis=1)).mean()
    return v/(base+1e-9)
print("seam ratios (≈1 = seamless):")
for mid in flag: print(f"  {mid:20} {seam(mid):.2f}")
