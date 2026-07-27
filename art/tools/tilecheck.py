import numpy as np, json, sys
sys.path.insert(0,"tools"); import texgen as T
from PIL import Image
mats={m["id"]:m for m in json.load(open("materials.json"))["materials"]}
ids=["wood_oak","brick_red","tile_bathroom","carbon_woven","metal_diamond_plate","metal_corrugated"]
th=256; sheet=Image.new("RGB",(len(ids)*(th+8)+8,th+24),(16,18,22))
from PIL import ImageDraw; d=ImageDraw.Draw(sheet)
for i,mid in enumerate(ids):
    a=Image.fromarray(T.build(mats[mid],256)["albedo"])
    tile=Image.new("RGB",(512,512))
    for ox in (0,256):
        for oy in (0,256): tile.paste(a,(ox,oy))
    tile=tile.resize((th,th),Image.LANCZOS)
    x=8+i*(th+8); sheet.paste(tile,(x,8)); d.text((x+2,th+10),mid,fill=(210,214,220))
sheet.save("previews/tiling_check.png"); print("saved previews/tiling_check.png")
