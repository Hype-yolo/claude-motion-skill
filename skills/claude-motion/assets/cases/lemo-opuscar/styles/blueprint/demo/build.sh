#!/bin/sh
# 从零重现 Blueprint《Patent Pending: The Cloud Catcher》：在仓库根运行  sh styles/blueprint/demo/build.sh
set -e
cd "$(dirname "$0")/../../.."
D=styles/blueprint/demo; S=styles/blueprint; PY=.venv/bin/python
$PY core/tts/tts.py $D/lines.json $D/voices                 # 1 配音（bm_daniel, en-gb）
$PY core/tts/asr_check.py $D/lines.json $D/voices           # 2 whisper 逐句校对
node $D/tools/subs.mjs                                      # 3 字幕时间（页面 window.SUBS → subs.json）
node core/render/events.mjs $D                              # 4 音效/旁白事件
$PY $D/music/score.py                                       # 5 配乐（采样羽管键琴/巴松/跳弓弦乐/竖琴）
$PY $D/mix.py                                               # 6 拟音 + 旁白 + 配乐闪避
$PY $D/tools/check_mix.py                                   # 7 成片旁白可懂度自检
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4   # 8 逐帧渲染
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/blueprint.mp4 24 4      # 9 合成 −14 LUFS，轻颗粒
$PY core/render/srt.py $D/subs.json $S/blueprint.srt
node core/render/still.mjs $D 31.0 --q nosub --prefix sf_ --out $D/out/sf && cp $D/out/sf/sf_31.0.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 31.0 --q poster=1 --prefix po_ --out $D/out/sf && cp $D/out/sf/po_31.0.jpg $S/poster.jpg
