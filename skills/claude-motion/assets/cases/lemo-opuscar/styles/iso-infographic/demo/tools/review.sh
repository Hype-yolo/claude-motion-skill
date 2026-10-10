#!/bin/bash
# 审片：bash tools/review.sh <outdir> <cols> t1 t2 ... [-- --q 'k=v']  → <outdir>/sheet.jpg
cd "$(dirname "$0")/../../../.."
D=styles/iso-infographic/demo; OUT=$1; COLS=$2; shift 2
TS=(); EXTRA=(); while [ $# -gt 0 ]; do if [ "$1" = "--" ]; then shift; EXTRA=("$@"); break; fi; TS+=("$1"); shift; done
node core/render/still.mjs $D "${TS[@]}" --out $D/$OUT --prefix k_ "${EXTRA[@]}" >/dev/null || exit 1
FILES=(); for t in "${TS[@]}"; do FILES+=("$D/$OUT/k_$t.jpg"); done
.venv/bin/python core/render/sheet.py $D/$OUT/sheet.jpg "${FILES[@]}" --cols $COLS --w $((1920 / COLS))
