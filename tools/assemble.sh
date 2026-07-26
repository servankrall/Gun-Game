#!/bin/bash
# Runs inside the Higgsfield sandbox from the repo root.
# Env: GAME_PUT / COVER_PUT / FAV_PUT = presigned PUT URLs (optional: skip upload if unset)
set -e
cd "$(dirname "$0")/.."

B=https://d8j0ntlcm91z4.cloudfront.net/user_3H2TbHs4NAolF83PLXpaJkfJOyw
mkdir -p game/assets/audio game/assets/textures tmp_tex tmp_out

echo "== download audio =="
curl -sS -o game/assets/audio/shot_pistol.mp3  $B/hf_20260726_114810_d6c7590d-9c55-4a02-83b4-22358ff4e85d.mp3
curl -sS -o game/assets/audio/shot_rifle.mp3   $B/hf_20260726_115251_3c3dd641-ff62-46ce-aa60-c2472049ba99.mp3
curl -sS -o game/assets/audio/shot_shotgun.mp3 $B/hf_20260726_120306_f59f1830-8e5c-478c-b339-5f7a4a309f5d.mp3
curl -sS -o game/assets/audio/hit.mp3          $B/hf_20260726_120313_24401e97-0cd1-4019-a945-12fddd5f8b16.mp3
curl -sS -o game/assets/audio/reload.mp3       $B/hf_20260726_121054_df1c12da-0000-4b47-a345-40b06dcbb86f.mp3
curl -sS -o game/assets/audio/music_combat.m4a $B/hf_20260726_120317_25c8e9b9-508f-49c3-9e8d-d7e9652ffcd7.m4a

echo "== download textures =="
curl -sS -o tmp_tex/sand_raw.png     $B/hf_20260726_121057_a0c020d6-dd0d-495f-a16c-66cc363a52a2.png
curl -sS -o tmp_tex/concrete_raw.png $B/hf_20260726_121059_7b1d7f46-dac5-4b32-83c9-afd2e1a76e43.png
curl -sS -o tmp_tex/crate_raw.png    $B/hf_20260726_121101_8dd7ae88-9c8d-4b63-80e4-bd68ea1852a9.png
curl -sS -o tmp_tex/asphalt_raw.png  $B/hf_20260726_121103_67ce33cb-34bf-40d2-9837-d81e6e7c70f4.png

echo "== seam fix =="
for id in sand concrete crate asphalt; do
  python3 tools/pipeline.py tmp_tex/${id}_raw.png -o tmp_tex/${id} --trim 0
done

echo "== resize to 512 + seam check =="
python3 - <<'PY'
import numpy as np
from PIL import Image
for i in ["sand", "concrete", "crate", "asphalt"]:
    img = Image.open(f"tmp_tex/{i}_seamless.png").resize((512, 512), Image.LANCZOS)
    img.save(f"game/assets/textures/{i}.png")
    a = np.asarray(img.convert("RGB")).astype(float)
    seam = abs(a[0]-a[-1]).mean() + abs(a[:,0]-a[:,-1]).mean()
    base = abs(np.diff(a,axis=0)).mean() + abs(np.diff(a,axis=1)).mean()
    print(i, "seam ratio", round(seam/base, 2))
PY

echo "== procedural extras (metal, snow, cover, favicon) =="
python3 tools/make_extra_assets.py game/assets/textures tmp_out
cp tmp_out/metal.png tmp_out/snow.png game/assets/textures/
python3 - <<'PY'
import numpy as np
from PIL import Image
for i in ["metal", "snow"]:
    a = np.asarray(Image.open(f"game/assets/textures/{i}.png").convert("RGB")).astype(float)
    seam = abs(a[0]-a[-1]).mean() + abs(a[:,0]-a[:,-1]).mean()
    base = abs(np.diff(a,axis=0)).mean() + abs(np.diff(a,axis=1)).mean()
    print(i, "seam ratio", round(seam/base, 2))
PY

echo "== package =="
(cd game && zip -qr ../game.zip .)
ls -la game.zip tmp_out/cover.png tmp_out/favicon.png
unzip -l game.zip | head -30

if [ -n "$GAME_PUT" ]; then
  echo "== upload =="
  curl -sS -X PUT -H "Content-Type: application/octet-stream" --data-binary @game.zip "$GAME_PUT" -w "zip HTTP %{http_code}\n"
  curl -sS -X PUT -H "Content-Type: image/png" --data-binary @tmp_out/cover.png "$COVER_PUT" -w "cover HTTP %{http_code}\n"
  curl -sS -X PUT -H "Content-Type: image/png" --data-binary @tmp_out/favicon.png "$FAV_PUT" -w "favicon HTTP %{http_code}\n"
fi
echo "ASSEMBLE DONE"
