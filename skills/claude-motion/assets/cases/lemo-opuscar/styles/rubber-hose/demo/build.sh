#!/bin/sh
# 从零重现成片：sh styles/rubber-hose/demo/build.sh   （任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/rubber-hose/demo; S=styles/rubber-hose
$PY core/tts/tts.py $D/lines.json $D/voices                     # 1. Kokoro 配音（bm_lewis 电台播音腔）
$PY core/tts/asr_check.py $D/lines.json $D/voices               # 2. whisper 逐句校对
node core/render/events.mjs $D                                  # 3. 时间线 → events.json（旁白 / 拟音事件）
$PY $D/music/score.py                                           # 4. 原创大乐队配乐（采样 + 拨弦建模）→ music/score.wav
$PY $D/mix.py                                                   # 5. 拟音 + 电台腔旁白 + 闪避 + 光学声轨老化 → mix.wav
node $D/tools/subs.mjs && $PY core/render/srt.py $D/out/cues.json $S/rubber-hose.srt   # 6. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4          # 7. 逐帧渲染（1200 帧 ~50–80 s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/rubber-hose.mp4 24 3           # 8. 合成 + 颗粒 3 + −14 LUFS
$PY $D/tools/final_asr.py $S/rubber-hose.mp4                                         # 9. 成片 whisper 自检
# 10. 海报 / 风格帧；设定表只渲到 out/（stills/ 里是关卡 1 批准的版本）
node core/render/still.mjs $D 43.1 --q 'poster=1&nosub=1' --out $D/out --prefix poster_ && cp $D/out/poster_43.1.jpg $S/poster.jpg
node core/render/still.mjs $D 37.95 --q 'nosub=1' --out $D/out --prefix sf_ && cp $D/out/sf_37.95.jpg $D/stills/styleframe.jpg
node $D/tools/still.mjs $D 0 --q 'mode=sheet&w=2880&h=1620' --w 2880 --h 1620 --out $D/out --prefix sheet_
node $D/tools/still.mjs $D 0 --q 'mode=kitchen&w=2880&h=1620' --w 2880 --h 1620 --out $D/out --prefix kitchen_
