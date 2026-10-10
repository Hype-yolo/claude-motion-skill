#!/bin/sh
# 连续帧条：sh strip.sh <name> <t0> <n> [fps] → out/<name>.jpg（n 帧，4 列）
cd "$(dirname "$0")/../../.."
N="$1"; A="$2"; K="$3"; F="${4:-24}"
D=styles/scifi-toon/demo/out/strip_$N; rm -rf "$D"; mkdir -p "$D"
TS=$(.venv/bin/python -c "print(' '.join('%.4f'%($A+i/$F) for i in range($K)))")
node core/render/still.mjs styles/scifi-toon/demo $TS --out "$D" > /dev/null
i=0; for t in $TS; do cp "$D/t_$t.jpg" "$D/f_$(printf %03d $i).jpg"; i=$((i+1)); done
R=$(( (i + 3) / 4 ))
ffmpeg -y -loglevel error -i "$D/f_%03d.jpg" -vf "scale=480:270,tile=4x${R}" -frames:v 1 styles/scifi-toon/demo/out/$N.jpg
echo styles/scifi-toon/demo/out/$N.jpg
