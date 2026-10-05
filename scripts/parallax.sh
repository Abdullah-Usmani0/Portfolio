#!/usr/bin/env bash
# The 2D fallback: slide Blender's K2 plates at different speeds (Firewatch-style), breathe
# the alpenglow, and loop seamlessly. Each layer is shifted at 2x resolution and scaled
# down, so slow layers glide at half-pixel precision instead of stepping a pixel at a time.
#
#   bash scripts/parallax.sh [look]   # needs blender/out/parallax/<look>_{sky,far,clouds,valley}.png
set -euo pipefail
cd "$(dirname "$0")/.."

LOOK="${1:-dusk}"
DIR=blender/out/parallax
SECS=8
FPS=30
W=1600
H=900
for layer in sky far clouds valley; do
  [[ -f "$DIR/${LOOK}_${layer}.png" ]] || { echo "missing $DIR/${LOOK}_${layer}.png (run blender/parallax_m0.py)" >&2; exit 1; }
done

# x offset (px, at 1x) for a layer that sways `amp` px around the centre of the 160 px margin
sway() { echo "2*(80+$1*sin(2*PI*t/$SECS))"; }
layer() { # input index, amplitude, extra filters
  echo "[$1:v]format=rgba,scale=$((2 * (W + 160))):$((2 * H)):flags=lanczos$3,crop=$((2 * W)):$((2 * H)):'$(sway "$2")':0,scale=$W:$H:flags=area"
}
BREATHE="geq=r='r(X,Y)*(1+0.08*sin(2*PI*T/$SECS))':g='g(X,Y)*(1+0.05*sin(2*PI*T/$SECS))':b='b(X,Y)*(1+0.04*sin(2*PI*T/$SECS))':a='alpha(X,Y)'"

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate $FPS -t $SECS -i "$DIR/${LOOK}_sky.png" \
  -loop 1 -framerate $FPS -t $SECS -i "$DIR/${LOOK}_far.png" \
  -loop 1 -framerate $FPS -t $SECS -i "$DIR/${LOOK}_clouds.png" \
  -loop 1 -framerate $FPS -t $SECS -i "$DIR/${LOOK}_valley.png" \
  -filter_complex "
    $(layer 0 4 '')[sky];
    $(layer 1 12 ",$BREATHE")[far];
    $(layer 2 44 '')[clouds];
    $(layer 3 72 '')[valley];
    [sky][far]overlay=format=auto[a];[a][clouds]overlay=format=auto[b];[b][valley]overlay=format=auto,format=yuv420p[out]" \
  -map "[out]" -c:v libx264 -crf 19 -preset slow -movflags +faststart "$DIR/${LOOK}_loop.mp4"

ffmpeg -hide_banner -loglevel error -y -i "$DIR/${LOOK}_loop.mp4" \
  -vf "fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=sierra2_4a" \
  "$DIR/${LOOK}_loop.gif"
ls -la "$DIR/${LOOK}_loop.mp4" "$DIR/${LOOK}_loop.gif"
