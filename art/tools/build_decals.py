#!/usr/bin/env python3
"""Build decals.json — the VANTAGE decal / signage / marking catalog.

Original iconography only (geometric primitives, generic wording). Covers
warning signs, directional signs, numbering, floor markings, industrial labels,
small-detail decals, security graphics, electronics labels, vehicle markings.
Run:  python3 build_decals.py > ../decals.json
"""
import json, sys
D=[]
def add(did, category, kind, **kw):
    d={"id":did,"category":category,"kind":kind}; d.update(kw); D.append(d)

# ---------- WARNING SIGNS (yellow triangle, original symbols) ----------
WARN=[("electrical_hazard","bolt"),("high_voltage","bolt"),("machine_warning","gear"),
 ("rotating_equipment","gear"),("hot_surface","flame"),("fire_equipment","flame"),
 ("compressed_gas","cylinder"),("chemical_storage","drop"),("laser_hazard","laser"),
 ("overhead_crane","crane"),("heavy_load","crane"),("forklift_traffic","forklift"),
 ("moving_machinery","gear"),("slippery_surface","wave"),("general_warning","exclam"),
 ("restricted_access","exclam"),("maintenance_area","hexnut"),("loading_zone","forklift")]
for n,s in WARN: add("warn_"+n,"warning","warning",symbol=s,response="vinyl")

# ---------- MANDATORY (blue circle) / PROHIBITION (red ring) ----------
for n,s in [("ppe_required","person"),("eye_protection","dot"),("authorized_only","person")]:
    add("must_"+n,"mandatory","mandatory",symbol=s,response="vinyl")
for n,s in [("no_entry","person"),("do_not_enter","person"),("staff_only","person"),("no_forklift","forklift")]:
    add("no_"+n,"prohibition","prohibition",symbol=s,response="vinyl")

# ---------- DIRECTIONAL SIGNS (plate + word) ----------
DIRW=["RECEPTION","SECURITY","ELEVATOR","STAIRS","ROOF ACCESS","MECHANICAL","ELECTRICAL",
 "GENERATOR","CONTROL ROOM","SERVER ROOM","RESEARCH","WAREHOUSE","MEDICAL","ASSEMBLY",
 "PARKING","LOADING DOCK","RESTROOM","ENTRANCE","EMERGENCY ROUTE"]
for w in DIRW:
    add("dir_"+w.lower().replace(" ","_"),"directional","plate",text=w,bg="dgrey",fg="white",response="vinyl")
add("dir_exit","directional","safe",text="EXIT",symbol="arrow",response="reflective")
add("dir_emergency_exit","directional","safe",text="EXIT",response="reflective")

# arrows (4 directions × 3 colors)
for dcol in ("orange","white","cyan"):
    for dr in ("right","left","up","down"):
        add(f"arrow_{dcol}_{dr}","directional","arrow",dir=dr,color=dcol,response="reflective")

# ---------- NUMBERING SYSTEM (plates / ids) ----------
for f in range(1,6):
    for r in (1,2,3):
        add(f"room_{f}{r:02d}","numbering","plate",text=f"ROOM {f}{r:02d}",bg="lgrey",fg="black",response="vinyl")
for b in ("A","B","C","D"):
    add(f"floor_level_{b}","numbering","plate",text=f"LEVEL {b}",bg="blue",fg="white",response="vinyl")
for t,n in [("RACK","R-14"),("MACHINE","M-07"),("PANEL","P-22"),("CONT","C-118"),("STORE","S-03"),("DOOR","D-09")]:
    add(f"id_{n.lower().replace('-','_')}","numbering","id",text=n,bg="yellow",fg="black",response="engraved")

# ---------- FLOOR MARKINGS (tileable stripes / lanes) ----------
add("floor_hazard_stripe","floor","stripe",style="hazard",a="yellow",b="black",response="paint")
add("floor_hazard_orange","floor","stripe",style="hazard",a="orange",b="black",response="paint")
add("floor_walk_lane","floor","stripe",style="lane",a="green",response="paint")
add("floor_forklift_lane","floor","stripe",style="lane",a="yellow",response="paint")
add("floor_emergency_lane","floor","stripe",style="lane",a="red",response="paint")
add("floor_lane_dashed","floor","stripe",style="dashed",a="white",response="paint")
add("floor_keep_clear","floor","plate",text="KEEP CLEAR",bg="red",fg="white",response="paint")
add("floor_stop","floor","plate",text="STOP",bg="red",fg="white",response="paint")
add("floor_assembly_point","floor","plate",text="ASSEMBLY",bg="green",fg="white",response="paint")
add("floor_danger_zone","floor","stripe",style="hazard",a="red",b="black",response="paint")
add("floor_no_park","floor","plate",text="NO PARKING",bg="dgrey",fg="yellow",response="paint")

# ---------- INDUSTRIAL LABELS (pipe / system id bands) ----------
for t,c in [("AIR SUPPLY","cyan"),("WATER LINE","blue"),("POWER FEED","yellow"),("FIBER NET","green"),
 ("COMPRESSED AIR","cyan"),("COOLING LINE","blue"),("DRAIN","olive"),("WASTE LINE","olive"),
 ("FUEL LINE","orange"),("EMERGENCY STOP","red")]:
    add("pipe_"+t.lower().replace(" ","_"),"industrial","id",text=t,bg=c,fg="black" if c in("yellow","cyan") else "white",response="vinyl")
for t in ["INSPECTION PASSED","INSPECTION DUE","MAINTENANCE OK","CALIBRATION REQ"]:
    add("label_"+t.lower().replace(" ","_"),"industrial","plate",text=t,bg="lgrey",fg="black",response="sticker")

# ---------- SECURITY GRAPHICS ----------
add("sec_camera_monitoring","security","warning",symbol="camera",response="vinyl")
for t in ["SECURITY ZONE","BADGE REQUIRED","VISITOR CHECK-IN","STAFF ONLY","SECURITY CHECK","ACCESS CONTROL"]:
    add("sec_"+t.lower().replace(" ","_").replace("-","_"),"security","plate",text=t,bg="blue",fg="white",response="vinyl")

# ---------- ELECTRONICS LABELS (small engraved) ----------
for t in ["POWER","RESET","NETWORK","USB","FIBER","COOLING","BATTERY","UPS","EMG STOP","FAN","DATA","SERVICE"]:
    add("elec_"+t.lower().replace(" ","_"),"electronics","id",text=t,bg="dgrey",fg="white",response="engraved")

# ---------- VEHICLE MARKINGS ----------
for t,c in [("SERVICE","orange"),("MAINTENANCE","yellow"),("INSPECTION","green"),("MAX LOAD 2T","black"),
 ("SPEED 10","red"),("FLEET 07","blue")]:
    add("veh_"+t.lower().replace(" ","_"),"vehicle","plate",text=t,bg=c,fg="black" if c in("yellow","orange") else "white",response="reflective")

# ---------- SMALL-DETAIL DECALS (soft alpha marks) ----------
MARKS=[("scuff","scuff",5),("wheel_marks","wheel",8),("foot_traffic","foot",10),
 ("oil_spot","oil",1),("water_drip","water",1),("rust_stain","rust",1),
 ("concrete_stain","stain",1),("finger_smudge","smudge",1),("dust_buildup","smudge",1)]
for i,(n,st,cnt) in enumerate(MARKS):
    add("mark_"+n,"detail","mark",style=st,count=cnt,seed=100+i,response="paint")

cat={"name":"VANTAGE Decals","version":"1.0",
     "description":"Original flat-vector signage, markings, labels and micro-detail decals (transparent PNG + opacity/normal/roughness/ORM).",
     "resolutions":[512,1024,2048,4096],
     "maps":["albedo(rgba)","opacity","normal","ao","roughness","orm","height"],
     "decals":D}
json.dump(cat,sys.stdout,indent=1); sys.stdout.write("\n")
sys.stderr.write(f"{len(D)} decals across {len(set(d['category'] for d in D))} categories\n")
