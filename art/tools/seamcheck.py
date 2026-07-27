import numpy as np, json, sys
sys.path.insert(0,"tools"); import texgen as T
mats={m["id"]:m for m in json.load(open("materials.json"))["materials"]}
def seam(mid):
    a=T.build(mats[mid],256)["albedo"].astype(float)
    edge=(abs(a[0]-a[-1]).mean()+abs(a[:,0]-a[:,-1]).mean())/2
    step=(abs(np.diff(a,axis=0)).mean()+abs(np.diff(a,axis=1)).mean())/2
    return edge, step
print("material            edgeΔ  stepΔ  (edgeΔ≈stepΔ → seamless)")
for mid in ["concrete_industrial","metal_diamond_plate","metal_corrugated","wood_oak","wood_crate","brick_red","brick_white","ground_gravel","carbon_woven","tile_bathroom","ceramic_white","metal_painted","fabric_canvas","stone_marble"]:
    e,s=seam(mid); flag="OK" if e<=max(2.5,s*2.2) else "SEAM?"
    print(f"  {mid:20} {e:5.2f}  {s:5.2f}  {flag}")
