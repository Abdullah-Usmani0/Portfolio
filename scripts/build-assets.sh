#!/usr/bin/env bash
# Rebuild every 3D asset from the Blender scripts, then compress for the web.
# Blender never runs on Vercel: the outputs in public/models are committed.
set -euo pipefail
cd "$(dirname "$0")/.."

PY="${BLENDER_PY:-/home/user/.venvs/blender/bin/python}"
RAW=blender/out/raw
mkdir -p "$RAW"

"$PY" blender/export_web_m0.py
# export_web_m0 rewrites valley_m0.json, so the heightfield (which merges into it) runs after.
"$PY" blender/export_heightfield.py
# The firefly bust: a CC0 MakeHuman cut that the browser samples into points.
python3 blender/bust_mesh.py

for f in valley_m0 k2_m0 trees_m0 villagers_m0; do
  mv "public/models/$f.glb" "$RAW/$f.glb"
  npx gltf-transform optimize "$RAW/$f.glb" "public/models/$f.glb" \
    --compress meshopt --simplify false --join false --flatten false --instance false \
    --palette false --texture-compress false
done
ls -la public/models
