#!/bin/sh
# 从零重现《The Velvet Cipher》：sh styles/spy-titles/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/spy-titles/demo; O=styles/spy-titles
$PY core/tts/tts.py $D/lines.json $D/voices                     # 1. Kokoro 配音（bm_george）
$PY core/tts/asr_check.py $D/lines.json $D/voices               # 2. whisper 逐句校对（mismatches: 0）
$PY $D/music/score.py                                           # 3. 原创 60s 间谍大乐队配乐 → music/score.wav + stems
node core/render/events.mjs $D                                  # 4. 时间线 → events.json
$PY $D/mix.py                                                   # 5. 拟音 + 磁带旁白 + 闪避 → mix.wav
$PY $D/tools/subs.py && $PY core/render/srt.py $D/out/subs.json $O/spy-titles.srt   # 6. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4        # 7. 逐帧渲染（~20 s）
CRF=24 sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav $O/spy-titles.mp4 24 6   # 8. 合成：−14 LUFS，颗粒 6，crf24（core mux.sh + CRF 参数）
node core/render/still.mjs $D 20.8 --q 'nosub=1' --out $D/out/still --prefix sf_ && cp $D/out/still/sf_20.8.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 20.8 --q 'nosub=1&poster=1' --out $D/out/still --prefix po_ && cp $D/out/still/po_20.8.jpg $O/poster.jpg
node core/render/still.mjs $D 0 --q 'sheet=1&v=1' --out $D/out/still --prefix ms_ && cp $D/out/still/ms_0.jpg $D/stills/modelsheet_v1.jpg
