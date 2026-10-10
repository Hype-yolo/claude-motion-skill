#!/bin/sh
# 从零重现成片：sh styles/crayon-book/demo/build.sh   （任意目录运行均可）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/crayon-book/demo
$PY core/tts/tts.py $D/lines.json $D/voices                 # 1. Kokoro 配音 af_heart（v3 换声，睡前轻声）
$PY core/tts/asr_check.py $D/lines.json $D/voices           # 2. whisper 逐句校对
node core/render/events.mjs $D                              # 3. 时间线 → events.json（旁白/拟音/配乐 cue/星星显现）
$PY $D/music/score.py                                       # 4. 原创配乐（音乐盒/玩具钢琴/长笛/单簧管/钟琴）→ music/score.wav
$PY $D/mix.py                                               # 5. 拟音 + 旁白 + 配乐闪避 + 底噪 → mix.wav
node $D/subs.mjs && $PY core/render/srt.py $D/subs.json styles/crayon-book/crayon-book.srt   # 6. 字幕
node core/render/video.mjs $D --fps 24 --workers 2 --out $D/out/video24.mp4                # 7. 逐帧渲染
CRF=26 sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav styles/crayon-book/crayon-book.mp4 24 0   # 8. 合成 + −14 LUFS（纸纹已是颗粒，不再加；CRF 26）
