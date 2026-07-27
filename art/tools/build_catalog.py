#!/usr/bin/env python3
"""Build materials.json — the full VANTAGE material catalog.

Every requested surface is defined here as a procedural material (family +
palette + params). texgen.py turns any of these into a full PBR map set at
512/1024/2048/4096.  Run:  python3 build_catalog.py > ../materials.json
"""
import hashlib, json, sys

def seed(mid):
    return int(hashlib.md5(mid.encode()).hexdigest()[:6], 16)

MATS = []
def add(mid, category, family, base, base2=None, recess=None, rough=0.6, rvar=0.15,
        metallic=0.0, wear=0.12, nstr=2.0, params=None, **extra):
    m = {"id": mid, "category": category, "family": family,
         "palette": {"base": base, "base2": base2 or base, "recess": recess or base2 or base},
         "roughness": rough, "rough_var": rvar, "metallic": metallic, "wear": wear,
         "normal_strength": nstr, "seed": seed(mid), "params": params or {}}
    m.update(extra)
    if "metal_hex" in m:
        m["palette"]["metal"] = m.pop("metal_hex")
    MATS.append(m)

# ---------------- CONCRETE (neutral-dominant) ----------------
CONC = {
 "concrete_clean":("#cfd0cc","#c4c5c0"), "concrete_weathered":("#bfc0ba","#a9aaa3"),
 "concrete_industrial":("#b4b6b0","#9a9c96"), "concrete_painted":("#cdd2cf","#c2c7c4"),
 "concrete_polished":("#c8cac7","#bcbeba"), "concrete_old":("#b0b1aa","#989a90"),
 "concrete_damaged":("#aeafa8","#8f918a"), "concrete_sidewalk":("#c6c7c2","#b3b4ae"),
 "concrete_parking":("#b9bab5","#a3a49e"), "concrete_military":("#b6b8ad","#9ea094"),
 "concrete_airport":("#c9cbc6","#b8bab4"), "concrete_bridge":("#b7b9b3","#a0a29b"),
 "concrete_road":("#a9aaa4","#93948e"), "concrete_wall":("#c2c3be","#aeafa9"),
 "concrete_floor":("#c0c1bc","#adaea8"), "concrete_roof":("#aeb0a9","#96988f"),
 "concrete_stairs":("#c1c2bd","#adaea7"), "concrete_barrier":("#c4c6c0","#b0b2ab"),
 "concrete_bunker":("#a6a89f","#8d8f86"), "concrete_tunnel":("#9fa199","#87897f"),
}
for k,(a,b) in CONC.items():
    pol = "polished" in k
    add(k, "concrete", "concrete", a, b, "#83857d",
        rough=0.42 if pol else 0.72, rvar=0.10 if pol else 0.16, wear=0.06 if "clean" in k or pol else 0.16,
        nstr=1.4 if pol else 2.1)

# ---------------- METAL ----------------
def metal(mid, base, b2, rough, metallic=1.0, family="panel", params=None, **ex):
    wear = ex.pop("wear", 0.10)
    add(mid, "metal", family, base, b2, "#4a4d52", rough=rough, rvar=0.12, metallic=metallic,
        wear=wear, nstr=2.2, params=params or {"nx":3,"ny":4,"seam":0.02,"bolts":True}, **ex)
metal("metal_brushed_steel","#9aa0a6","#8f959b",0.34,family="smooth",params={"brushed":True})
metal("metal_polished_steel","#b4b9be","#a7acb1",0.14,family="smooth",params={"brushed":False})
metal("metal_military_steel","#7f858b","#70767c",0.5)
metal("metal_industrial_steel","#8a9096","#7b8187",0.46)
metal("metal_galvanized","#b8c0c6","#a7b0b6",0.4,params={"nx":2,"ny":2,"seam":0.015,"bolts":False})
metal("metal_aluminum","#c3c7cb","#b4b8bc",0.3,family="smooth",params={"brushed":True})
metal("metal_titanium","#a9adb2","#9a9ea3",0.28,family="smooth",params={"brushed":True})
metal("metal_copper","#b5723a","#a5652f",0.35,metallic=1.0,family="smooth",params={"brushed":True})
metal("metal_bronze","#8a6a3a","#7a5c30",0.4,family="smooth")
metal("metal_cast_iron","#3f4247","#34373b",0.62,params={"nx":2,"ny":2,"seam":0.02,"bolts":False})
metal("metal_black","#2a2d31","#232629",0.5,family="smooth")
metal("metal_painted","#3f6f8c","#396580",0.55,metallic=0.0,chips=True,metal_hex="#8a8f96")
metal("metal_scratched","#8f9599","#82888c",0.44,wear=0.22,chips=True,metal_hex="#b4b9be")
metal("metal_machined","#9fa4a9","#9297a1" if False else "#9297a0",0.26,family="smooth",params={"brushed":True})
metal("metal_anodized_alu","#4a7c78","#437270",0.3,metallic=0.7,family="smooth")
metal("metal_carbon_steel","#767b80","#696e73",0.5)
metal("metal_corrugated","#9aa0a6","#8b9197",0.42,family="corrugated",params={"waves":18,"vertical":True})
metal("metal_diamond_plate","#8b9096","#7d8288",0.44,family="diamond",params={"n":10})
metal("metal_reinforced","#7a8086","#6c7278",0.5)
metal("metal_modern_alloy","#aeb3b8","#a0a5aa",0.24,family="smooth",params={"brushed":True})

# ---------------- WOOD ----------------
WOOD = {
 "wood_oak":("#b98c55","#a97e4a","#5c4227"), "wood_walnut":("#6b4a30","#5b3d27","#33210f"),
 "wood_pine":("#d8b783","#c9a874","#8a6b42"), "wood_birch":("#e6d3ad","#d8c49c","#a58f66"),
 "wood_painted":("#c9cfcb","#bcc3bf","#7f857f"), "wood_weathered":("#a99a86","#95867231"[:7],"#6b5f4e"),
 "wood_interior":("#c39a63","#b48c57","#7a5c37"), "wood_exterior":("#9c8560","#8c7654","#5e4d34"),
 "wood_dark":("#4b3520","#3d2a19","#20150a"), "wood_light":("#dcc79a","#cfba8d","#9a8560"),
 "wood_factory":("#8f7a5a","#7f6c4e","#544632"), "wood_crate":("#c2a069","#b2915c","#7c6238"),
 "wood_pallet":("#b59a6d","#a68b60","#6f5b39"), "wood_lumber":("#caa972","#bb9a63","#846740"),
 "wood_panel":("#b58f5c","#a78351","#6d5230"), "wood_furniture":("#7a5230","#684627","#3d2814"),
}
for k,(a,b,r) in WOOD.items():
    add(k,"wood","planks",a,b,r,rough=0.55,rvar=0.14,wear=0.14 if "weather" in k or "exterior" in k else 0.09,
        nstr=1.7,params={"n":5 if "crate" in k or "pallet" in k else 6,"gap":0.02,"grain":9,"vertical":True})

# ---------------- RUBBER ----------------
for k,(a,rgh) in {"rubber_soft":("#2a2c2e",0.78),"rubber_industrial":("#26282a",0.72),
  "rubber_military":("#2c2e2a",0.8),"rubber_grip":("#1f2123",0.85),"rubber_vehicle":("#232527",0.7),
  "rubber_flooring":("#303234",0.74),"rubber_seal":("#212325",0.7),"rubber_cable":("#1c1e20",0.65),
  "rubber_mat":("#2b2d2f",0.82)}.items():
    add(k,"rubber","fabric" if "grip" in k or "mat" in k or "flooring" in k else "smooth",
        a,a,"#141517",rough=rgh,rvar=0.05,metallic=0.0,wear=0.05,nstr=1.1,
        params={"n":70} if "grip" in k or "mat" in k or "flooring" in k else {})

# ---------------- PLASTIC ----------------
for k,(a,b,rgh) in {"plastic_abs":("#3a3d42","#34373c",0.45),"plastic_polycarbonate":("#c9ced2","#bdc2c6",0.3),
  "plastic_hdpe":("#c7cbc4","#bcc0b9",0.5),"plastic_pvc":("#d3d6d8","#c7cacc",0.42),
  "plastic_industrial":("#4a4f55","#43484e",0.5),"plastic_military":("#3d4238","#373c33",0.55),
  "plastic_injection":("#2e3136","#292c31",0.4),"plastic_hard":("#40444a","#3a3e44",0.38),
  "plastic_soft":("#54595f","#4d5258",0.6),"plastic_transparent":("#cfe0e2","#c3d4d6",0.2)}.items():
    ex={}
    if k=="plastic_transparent": ex={"opacity":0.35}
    add(k,"plastic","smooth",a,b,"#26282c",rough=rgh,rvar=0.06,metallic=0.0,wear=0.05,nstr=1.0,**ex)

# ---------------- GLASS ----------------
for k,(a,op,rgh) in {"glass_clear":("#cfe6ea",0.16,0.06),"glass_tinted":("#3f5a63",0.45,0.08),
  "glass_bulletproof":("#a9c3c8",0.5,0.12),"glass_frosted":("#dfe8ea",0.7,0.35),
  "glass_office":("#bcd3d8",0.28,0.06),"glass_laboratory":("#d6e6e8",0.2,0.05),
  "glass_broken":("#c6dadd",0.4,0.3),"glass_reflective":("#9fb9c0",0.3,0.04),
  "glass_architectural":("#8fb0b8",0.35,0.06)}.items():
    add(k,"glass","smooth",a,a,"#7fa0a8",rough=rgh,rvar=0.04,metallic=0.0,wear=0.02,nstr=0.6,opacity=op,
        params={"brushed":False})

# ---------------- FABRIC ----------------
for k,(a,b,mesh) in {"fabric_canvas":("#b2a888","#a69c7d",0),"fabric_military":("#5c6146","#53583f",0),
  "fabric_tactical_nylon":("#33362f","#2d302a",0),"fabric_ballistic_weave":("#3a3d34","#34372e",0),
  "fabric_polyester":("#4a4f55","#43484e",0),"fabric_cotton":("#cfcabb","#c3beb0",0),
  "fabric_industrial":("#6a6f63","#61665b",0),"fabric_mesh":("#2c2f2a","#282b26",1),
  "fabric_seat":("#3f434a","#393d43",0),"fabric_curtain":("#6d5f56","#63564e",0)}.items():
    add(k,"fabric","fabric",a,b,"#20221e",rough=0.85,rvar=0.05,metallic=0.0,wear=0.06,nstr=1.0,
        params={"n":100,"mesh":bool(mesh)})

# ---------------- LEATHER ----------------
for k,(a,b) in {"leather_black":("#26272a","#202124"),"leather_brown":("#5a3d28","#4d3421"),
  "leather_synthetic":("#33353a","#2d2f34"),"leather_premium":("#3a2a20","#31231a"),
  "leather_industrial":("#43352b","#3a2d24"),"leather_vehicle":("#2b2c30","#25262a")}.items():
    add(k,"leather","grain",a,b,"#161615",rough=0.55,rvar=0.12,metallic=0.0,wear=0.08,nstr=1.4,
        params={"cells":56})

# ---------------- CARBON FIBER ----------------
for k,rgh in {"carbon_matte":0.5,"carbon_gloss":0.16,"carbon_forged":0.3,"carbon_woven":0.35,"carbon_raw":0.45}.items():
    add(k,"carbon","woven","#26282c","#1c1e21","#121316",rough=rgh,rvar=0.06,metallic=0.2,wear=0.03,
        nstr=1.3,params={"n":26 if k!="carbon_forged" else 40})

# ---------------- STONE ----------------
for k,(a,b,r,fam,pr) in {
  "stone_granite":("#8f8d8a","#7e7c79","#5c5a57","grain",{"cells":50}),
  "stone_marble":("#dcdcd8","#cfd0cf","#b7b8b8","grain",{"cells":6}),
  "stone_slate":("#4b5157","#41474d","#2e3237","grain",{"cells":30}),
  "stone_sandstone":("#c8ac82","#ba9e75","#8a744f","grain",{"cells":40}),
  "stone_limestone":("#cbc6b4","#bdb8a6","#938e7c","grain",{"cells":36})}.items():
    add(k,"stone",fam,a,b,r,rough=0.45 if k=="stone_marble" else 0.62,rvar=0.14,wear=0.07,nstr=1.6,params=pr)

# ---------------- BRICK ----------------
for k,(a,b,mo) in {"brick_red":("#9e5a44","#8c4d3a","#b8b3a6"),"brick_white":("#d7d3c8","#c9c4b8","#b6b0a2"),
  "brick_old":("#8f5a48","#7d4c3c","#a49c8c"),"brick_industrial":("#7a6f66","#6c625a","#9a9084"),
  "brick_modern":("#a86a52","#976049","#c4beb0"),"brick_painted":("#c9cbc4","#bdbfb8","#a7a99f")}.items():
    add(k,"brick","brick",a,b,mo,rough=0.75,rvar=0.14,wear=0.12,nstr=2.3,
        params={"rows":12,"cols":6,"mortar":0.05})

# ---------------- CERAMIC / TILE ----------------
for k,(a,b,pol) in {"ceramic_industrial":("#c9cbc7","#bcbeba",0),"tile_bathroom":("#dfe3e2","#d3d7d6",1),
  "tile_kitchen":("#e4e2da","#d8d6cf",1),"ceramic_white":("#eceae4","#e0ded8",1),
  "ceramic_black":("#26282b","#212326",1),"ceramic_matte":("#c4c6c2","#b8bab6",0),
  "ceramic_gloss":("#d6dad9","#cacecd",1)}.items():
    add(k,"ceramic","tile",a,b,"#a9aca6",rough=0.16 if pol else 0.55,rvar=0.08,wear=0.04,nstr=1.5,
        params={"n":6,"grout":0.035,"polish":bool(pol)})

# ---------------- GROUND ----------------
GROUND = {
 "ground_asphalt":("#3b3d40","#333538","asphalt",{},0.8),"ground_road":("#3f4144","#37393c","asphalt",{},0.82),
 "ground_sand":("#cdb587","#c0a878","grain",{"cells":60},0.9),"ground_mud":("#5a4a38","#4d3f30","grain",{"cells":34},0.7),
 "ground_gravel":("#8f8c86","#7d7a74","grain",{"cells":70},0.85),"ground_grass":("#5c7042","#52643a","grain",{"cells":48},0.9),
 "ground_dry_grass":("#a79a63","#998d59","grain",{"cells":48},0.9),"ground_wet_grass":("#465e34","#3d532d","grain",{"cells":48},0.6),
 "ground_snow":("#e9edf0","#dde2e6","grain",{"cells":30},0.5),"ground_ice":("#c4d6dc","#b6cbd2","smooth",{},0.12),
 "ground_rock":("#7c7a76","#6c6a66","grain",{"cells":26},0.7),"ground_pebbles":("#9a968e","#88847c","grain",{"cells":80},0.8),
 "ground_forest_soil":("#4a3d2c","#3f3426","grain",{"cells":40},0.8),"ground_construction_dirt":("#8a7a60","#7c6d54","grain",{"cells":44},0.85),
 "ground_urban_dirt":("#7f7668","#726a5d","grain",{"cells":40},0.85),"ground_dust":("#bcb2a0","#b0a694","grain",{"cells":50},0.9),
}
for k,(a,b,fam,pr,rgh) in GROUND.items():
    add(k,"ground",fam,a,b,"#4a4136",rough=rgh,rvar=0.12,wear=0.05,nstr=1.8 if fam=="grain" else 1.0,params=pr)

# ---------------- ACCENT / WAYFINDING (navigation + interactables) ----------------
add("accent_signal_orange","accent","panel","#ff7a1a","#f06e12","#b34f0c",rough=0.5,metallic=0.0,wear=0.06,
    params={"nx":2,"ny":2,"seam":0.02,"bolts":False})
add("accent_safety_yellow","accent","panel","#ffd23b","#f5c62f","#b8901f",rough=0.5,metallic=0.0,wear=0.06,
    params={"nx":2,"ny":2,"seam":0.02,"bolts":False})
add("accent_wayfinding_teal","accent","smooth","#2ec5c0","#2ab4b0","#1c7d7a",rough=0.4,metallic=0.0,wear=0.03)
add("accent_hazard_stripe","accent","panel","#ffd23b","#1c1e20","#111213",rough=0.55,metallic=0.0,wear=0.08,
    params={"nx":8,"ny":1,"seam":0.001,"bolts":False})
add("emissive_guide_strip","accent","smooth","#0c0d0f","#0c0d0f","#0c0d0f",rough=0.3,metallic=0.0,wear=0.0,
    emission={"color":"#2ec5c0","mask":0.9})
add("emissive_objective_red","accent","smooth","#0c0d0f","#0c0d0f","#0c0d0f",rough=0.3,metallic=0.0,wear=0.0,
    emission={"color":"#e5484d","mask":0.9})

# ================= WEAPON MATERIALS (modular FPS armament) =================
# families: machined (CNC/lathe), knurl/hex (grips), micro (cerakote/bead-blast),
# smooth+brushed (finished metal), woven (carbon/kevlar), grain (leather).
def wpn(mid, base, b2, rough, metallic=1.0, family="micro", wear=0.06, nstr=1.6,
        params=None, recess="#3a3d42", **ex):
    add(mid, "weapon", family, base, b2, recess, rough=rough, rvar=0.10,
        metallic=metallic, wear=wear, nstr=nstr, params=params or {}, **ex)

# --- steels ---
wpn("wpn_military_steel","#5a5f64","#4f5459",0.46,params={"cells":180,"amp":0.08})
wpn("wpn_machined_steel","#8a9096","#7e848a",0.28,family="machined",params={"mode":"concentric","freq":260})
wpn("wpn_heat_treated_steel","#4a4d54","#3f424a",0.4,family="micro",params={"cells":160,"amp":0.07})
wpn("wpn_cold_rolled_steel","#9298a0","#878d95",0.3,family="smooth",params={"brushed":True})
wpn("wpn_carbon_steel","#6e7378","#63686d",0.44,family="micro",params={"cells":170,"amp":0.08})
wpn("wpn_stainless_steel","#b0b5ba","#a4a9ae",0.2,family="smooth",params={"brushed":True})
wpn("wpn_bluing_steel","#2f3540","#282e38",0.24,family="smooth")
# --- titanium & light alloys ---
wpn("wpn_titanium","#a6abb0","#989da2",0.26,family="micro",params={"cells":200,"amp":0.05})
wpn("wpn_titanium_alloy","#8f959c","#848a91",0.3,family="machined",params={"mode":"linear","freq":220})
wpn("wpn_aircraft_aluminum","#bcc0c4","#b0b4b8",0.28,family="smooth",params={"brushed":True})
wpn("wpn_anodized_aluminum","#40484f","#39414a" ,0.3,metallic=0.7,family="micro",params={"cells":200,"amp":0.04})
wpn("wpn_anodized_fde","#a68a5f","#997d54",0.34,metallic=0.5,family="micro",params={"cells":200,"amp":0.05})
wpn("wpn_forged_aluminum","#a3a8ad","#979ca1",0.36,family="micro",params={"cells":150,"amp":0.07})
wpn("wpn_brushed_aluminum","#c0c4c8","#b3b7bb",0.26,family="smooth",params={"brushed":True})
wpn("wpn_cast_aluminum","#92979c","#878c94",0.42,family="micro",params={"cells":130,"amp":0.09})
wpn("wpn_industrial_alloy","#7f858b","#747a80",0.4,family="machined",params={"mode":"linear","freq":200})
wpn("wpn_magnesium_alloy","#8b8f92","#7f8386",0.44,family="micro",params={"cells":140,"amp":0.08})
# --- polymers (receivers/furniture) ---
wpn("wpn_polymer_receiver","#33373b","#2d3135",0.5,metallic=0.0,family="micro",params={"cells":170,"amp":0.06},nstr=1.2)
wpn("wpn_polymer_fde","#9c8056","#8f7550",0.52,metallic=0.0,family="micro",params={"cells":170,"amp":0.06},nstr=1.2)
wpn("wpn_polymer_military","#3a3f36","#343a30",0.55,metallic=0.0,family="micro",params={"cells":160,"amp":0.07},nstr=1.2)
wpn("wpn_polymer_grp","#3d4147","#373b41",0.48,metallic=0.0,family="micro",params={"cells":150,"amp":0.06},nstr=1.2)
wpn("wpn_polymer_injection","#2e3236","#282c30",0.42,metallic=0.0,family="smooth",nstr=1.0)
wpn("wpn_polymer_textured","#34383d","#2e3237",0.56,metallic=0.0,family="hex",params={"n":18},nstr=1.5)
wpn("wpn_polymer_hard","#3c4045","#363a3f",0.4,metallic=0.0,family="smooth",nstr=1.0)
wpn("wpn_polymer_soft","#44494f","#3e434a",0.62,metallic=0.0,family="micro",params={"cells":120,"amp":0.06},nstr=1.1)
# --- grips ---
wpn("wpn_grip_rubber","#24262a","#1e2024",0.82,metallic=0.0,family="knurl",params={"n":34},nstr=1.8,wear=0.05)
wpn("wpn_grip_diamond","#2a2d31","#242629",0.7,metallic=0.0,family="knurl",params={"n":44},nstr=2.0,wear=0.05)
wpn("wpn_grip_hex","#2c2f34","#26292e",0.66,metallic=0.0,family="hex",params={"n":16},nstr=1.9,wear=0.05)
wpn("wpn_grip_micro","#303338","#2a2d32",0.6,metallic=0.0,family="micro",params={"cells":220,"amp":0.06},nstr=1.4)
wpn("wpn_grip_fine","#2e3136","#282b30",0.58,metallic=0.0,family="knurl",params={"n":56},nstr=1.5)
wpn("wpn_grip_coarse","#26282c","#202226",0.74,metallic=0.0,family="knurl",params={"n":26},nstr=2.2)
wpn("wpn_grip_competition","#33373c","#2d3136",0.5,metallic=0.0,family="hex",params={"n":20},nstr=1.6)
wpn("wpn_grip_tactical","#2b2e32","#25282c",0.72,metallic=0.0,family="knurl",params={"n":38},nstr=2.0)
wpn("wpn_grip_weather","#292c30","#232629",0.78,metallic=0.0,family="knurl",params={"n":32},nstr=2.0)
# --- carbon & composites ---
wpn("wpn_carbon_matte","#26282c","#1c1e21",0.5,metallic=0.2,family="woven",params={"n":26},recess="#121316",wear=0.03)
wpn("wpn_carbon_gloss","#26282c","#1c1e21",0.16,metallic=0.2,family="woven",params={"n":26},recess="#121316",wear=0.02)
wpn("wpn_carbon_forged","#2a2c30","#202226",0.3,metallic=0.2,family="woven",params={"n":40},recess="#141518",wear=0.03)
wpn("wpn_kevlar_composite","#4a4636","#403c2e",0.6,metallic=0.05,family="woven",params={"n":30},recess="#26241a",wear=0.04)
# --- coatings / finishes ---
wpn("wpn_cerakote_black","#2c2e31","#26282b",0.55,metallic=0.1,family="micro",params={"cells":240,"amp":0.04},nstr=1.1)
wpn("wpn_cerakote_grey","#5a5f64","#525760",0.55,metallic=0.1,family="micro",params={"cells":240,"amp":0.04},nstr=1.1)
wpn("wpn_ceramic_coating","#3a3d42","#34373c",0.42,metallic=0.1,family="micro",params={"cells":220,"amp":0.03},nstr=1.0)
wpn("wpn_anti_corrosion","#4e5358","#464b50",0.5,metallic=0.3,family="micro",params={"cells":200,"amp":0.05})
wpn("wpn_heat_resistant","#3f4247","#37393e",0.6,metallic=0.4,family="micro",params={"cells":160,"amp":0.07})
wpn("wpn_ceramic_armor","#6a6f72","#5f6467",0.48,metallic=0.05,family="micro",params={"cells":180,"amp":0.06},nstr=1.2)

# ================= ENVIRONMENT EXPANSION (walls/floors/ceilings/panels) =====
def env(mid, family, base, b2, recess, rough, rvar=0.12, metallic=0.0, wear=0.08,
        nstr=1.6, params=None, **ex):
    add(mid, "environment", family, base, b2, recess, rough=rough, rvar=rvar,
        metallic=metallic, wear=wear, nstr=nstr, params=params or {}, **ex)
# walls
env("env_drywall_painted","smooth","#d5d6d2","#cbccc8","#b6b7b3",0.82,nstr=0.8)
env("env_office_wall","smooth","#d9dad6","#cfd0cc","#bfc0bc",0.8,nstr=0.8)
env("env_lab_wall","smooth","#e6e8e6","#dcdedc","#c9cbc9",0.5,nstr=0.7)
env("env_acoustic_panel","fabric","#6a6f66","#61665d","#3f4239",0.9,nstr=1.2,params={"n":110})
env("env_metal_panel_wall","panel","#9aa0a6","#8b9197","#4a4d52",0.4,metallic=1.0,nstr=2.0,params={"nx":3,"ny":5,"seam":0.015,"bolts":True})
env("env_steel_wall","panel","#7f858b","#71777d","#41444a",0.46,metallic=1.0,nstr=2.0,params={"nx":2,"ny":3,"seam":0.02,"bolts":True})
env("env_concrete_block_wall","brick","#b6b8b2","#a4a69f","#8a8c85",0.74,nstr=2.2,params={"rows":8,"cols":4,"mortar":0.05})
env("env_modular_wall","panel","#c2c4c0","#b4b6b2","#8f918d",0.6,nstr=1.6,params={"nx":4,"ny":6,"seam":0.012,"bolts":False})
env("env_reinforced_wall","panel","#8a8f88","#7c817b","#565a54",0.55,nstr=2.0,params={"nx":2,"ny":2,"seam":0.02,"bolts":True})
# floors
env("env_vinyl_floor","smooth","#b9bcbf","#adb0b3","#93969a",0.55,nstr=0.7)
env("env_epoxy_floor","smooth","#8a9aa2","#7f9099","#5f6d75",0.35,nstr=0.6)
env("env_rubber_floor","hex","#303234","#2a2c2e","#161719",0.72,nstr=1.5,params={"n":14})
env("env_office_carpet","fabric","#5a6068","#51575f","#33373d",0.95,nstr=1.1,params={"n":130})
env("env_warehouse_floor","concrete","#a7a9a3","#93958f","#77796f",0.7,wear=0.16,nstr=1.9)
env("env_steel_grate","panel","#7a7f84","#6c7176","#3f4247",0.5,metallic=1.0,nstr=2.4,params={"nx":10,"ny":10,"seam":0.16,"bolts":False})
env("env_raised_access_floor","tile","#9a9d9f","#8e9193","#6f7274",0.5,nstr=1.4,params={"n":4,"grout":0.02})
env("env_laminate_floor","planks","#b89a6c","#a98d60","#7a6238",0.4,nstr=1.2,params={"n":5,"gap":0.012,"grain":8,"vertical":True})
# ceilings
env("env_acoustic_ceiling","tile","#dcdedb","#d1d3d0","#b8bab7",0.85,nstr=1.0,params={"n":4,"grout":0.03})
env("env_metal_ceiling","panel","#aeb2b6","#a1a5a9","#7a7d81",0.45,metallic=1.0,nstr=1.6,params={"nx":6,"ny":6,"seam":0.02,"bolts":False})
env("env_suspended_ceiling","tile","#e2e3e0","#d7d8d5","#c2c3c0",0.8,nstr=0.9,params={"n":3,"grout":0.02})
# panels / structural
env("env_brushed_alu_panel","smooth","#c0c4c8","#b3b7bb","#8f9296",0.28,metallic=1.0,nstr=0.9,params={"brushed":True})
env("env_powder_coated_steel","micro","#3f6f8c","#396580","#274355",0.55,metallic=0.0,nstr=1.2,chips=True,metal_hex="#8a8f96",params={"cells":200,"amp":0.04})
env("env_perforated_metal","panel","#8f9599","#82888c","#4a4d52",0.42,metallic=1.0,nstr=2.2,params={"nx":14,"ny":14,"seam":0.22,"bolts":False})
env("env_corrugated_panel","corrugated","#9aa0a6","#8b9197","#5a5f64",0.44,metallic=1.0,nstr=2.2,params={"waves":20,"vertical":True})
env("env_column_concrete","concrete","#bcbeb8","#a8aaa4","#86887f",0.68,nstr=1.8)
env("env_column_steel","smooth","#7f858b","#71777d","#4a4d52",0.4,metallic=1.0,nstr=1.0,params={"brushed":True})
env("env_beam_steel","panel","#767b80","#696e73","#3f4247",0.46,metallic=1.0,nstr=1.8,params={"nx":1,"ny":6,"seam":0.02,"bolts":True})

cat = {
  "name": "VANTAGE",
  "version": "2.0",
  "description": "Original competitive-tactical FPS material foundation (procedural, stylized-PBR, seamless). Environment + weapon + prop surfaces; pairs with decals.json and 20 skin themes.",
  "resolutions": [512, 1024, 2048, 4096],
  "maps": ["albedo","normal","ao","roughness","metallic","height","displacement","orm","curvature","opacity","emission"],
  "defaults": {},
  "materials": MATS,
}
json.dump(cat, sys.stdout, indent=1)
sys.stdout.write("\n")
sys.stderr.write(f"{len(MATS)} materials across "
                 f"{len(set(m['category'] for m in MATS))} categories\n")
