#!/usr/bin/env bash
# Rebuild the data the site draws from. Outputs are committed, so a normal build (and
# Vercel) never needs Blender or the network.
set -euo pipefail
cd "$(dirname "$0")/.."

# The firefly bust: a CC0 MakeHuman cut that the browser samples into points.
python3 blender/bust_mesh.py
