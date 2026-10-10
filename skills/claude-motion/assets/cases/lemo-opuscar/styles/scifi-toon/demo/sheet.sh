#!/bin/sh
# 缩略图总览：sh sheet.sh <name> <t0> <t1> <step> [cols]  → out/<name>.jpg
cd "$(dirname "$0")/../../.."
N="$1"; A="$2"; B="$3"; S="$4"; C="${5:-6}"
D=styles/scifi-toon/demo/out/sheet_$N; rm -rf "$D"; mkdir -p "$D"
TS=$(.venv/bin/python -c "import numpy as np;print(' '.join('%.2f'%x for x in np.arange($A,$B+1e-6,$S)))")
node core/render/still.mjs styles/scifi-toon/demo $TS --out "$D" > /dev/null
i=0; for t in $TS; do cp "$D/t_$t.jpg" "$D/f_$(printf %03d $i).jpg"; i=$((i+1)); done
R=$(( (i + C - 1) / C ))
ffmpeg -y -loglevel error -i "$D/f_%03d.jpg" -vf "scale=320:180,tile=${C}x${R}" -frames:v 1 styles/scifi-toon/demo/out/$N.jpg
echo styles/scifi-toon/demo/out/$N.jpg
