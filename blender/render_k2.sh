#!/usr/bin/env bash
# Renders K2's five layers, each in a fresh process (Blender keeps most of a render's memory
# afterwards, and the far layer needs a good share of 14 GB), then writes the site's textures
# from all of them.
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PY:-/home/user/.venvs/blender/bin/python}
for i in 0 1 2 3 4; do
  "$PY" blender/k2_render.py --only="$i"
done
"$PY" blender/k2_render.py --export
