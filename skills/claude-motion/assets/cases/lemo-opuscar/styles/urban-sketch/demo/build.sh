#!/bin/sh
# 从零重建《Where the Wind Went》：声音线索 → 配乐 → 拟音 → 混音 → 逐帧渲染 → 合成
set -e
cd "$(dirname "$0")/../../.."
D=styles/urban-sketch/demo
node core/render/events.mjs $D
node $D/tools/export_cues.mjs
.venv/bin/python $D/audio/score.py
.venv/bin/python $D/audio/foley.py
.venv/bin/python $D/audio/mix.py
node core/render/video.mjs $D --fps 24 --workers 4 --out $D/out/video24.mp4
sh core/render/mux.sh $D/out/video24.mp4 $D/audio/mix.wav styles/urban-sketch/urban-sketch.mp4 24 2
.venv/bin/python core/render/srt.py $D/subs.json styles/urban-sketch/urban-sketch.srt
