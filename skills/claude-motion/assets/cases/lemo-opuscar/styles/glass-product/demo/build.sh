#!/bin/sh
# 从零一键重现《Aura — Hear the Light》：sh styles/glass-product/demo/build.sh（任意目录运行皆可）
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; cd "$ROOT"
D=styles/glass-product/demo; PY=.venv/bin/python
echo "== 1. 配音 + whisper 校对"
$PY core/tts/tts.py $D/lines.json $D/voices
$PY core/tts/asr_check.py $D/lines.json $D/voices
echo "== 2. 原创配乐（numpy 合成）"
$PY $D/music/score.py
echo "== 3. 时间线事件 → 拟音 + 混音"
node core/render/events.mjs $D
$PY $D/mix.py
echo "== 4. 逐帧渲染（three.js，2× 超采样）"
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4
echo "== 5. 合成成片（−14 LUFS，颗粒 0）+ 字幕"
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav styles/glass-product/glass-product.mp4 24 0
$PY $D/subs.py && $PY core/render/srt.py $D/cues.json styles/glass-product/glass-product.srt
echo "== 6. 成片自检（逐句 whisper）"
$PY $D/check_mix.py styles/glass-product/glass-product.mp4
