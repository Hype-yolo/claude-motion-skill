#!/bin/sh
# 从零重现《Sunday Ride》：sh styles/risograph/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/risograph/demo
$PY core/tts/tts.py $D/lines.json $D/voices                     # 1. Kokoro 配音（am_adam）
$PY core/tts/asr_check.py $D/lines.json $D/voices               # 2. whisper 逐句校对（应 mismatches: 0）
$PY $D/music/score.py                                           # 3. 原创 bossa nova 配乐 → music/score.wav + stems（~25s）
node core/render/events.mjs $D                                  # 4. 时间线 → events.json（拟音/环境/旁白事件）
$PY $D/mix.py                                                   # 5. 拟音 + 旁白闪避 + 配乐 → mix.wav
$PY $D/tools/subs.py && $PY core/render/srt.py $D/out/subs.json styles/risograph/risograph.srt   # 6. 字幕
node $D/tools/video_png.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4   # 7. 逐帧渲染（PNG 截图 → 无损中间片，~2–4 分钟）
sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav styles/risograph/risograph.mp4 24 0   # 8. 合成：crf16 -tune grain，−14 LUFS
node core/render/still.mjs $D 28.8 --q 'nosub=1' --out $D/out/still --prefix sf_ && cp $D/out/still/sf_28.8.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 28.8 --q 'nosub=1&poster=1' --out $D/out/still --prefix po_ && cp $D/out/still/po_28.8.jpg styles/risograph/poster.jpg
node core/render/still.mjs $D 0 --q 'sheet=1&v=2' --out $D/out/still --prefix ms_ && cp $D/out/still/ms_0.jpg $D/stills/modelsheet_v2.jpg
