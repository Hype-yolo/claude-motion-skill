#!/bin/sh
# 从零重现《Room to Think》：sh styles/dark-keynote/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/dark-keynote/demo; O=styles/dark-keynote
node $D/tools/dump_timeline.mjs                                   # 1. 速度网格 + 三条声部音符表 → timeline.json
$PY core/tts/tts.py $D/lines.json $D/voices                       # 2. Kokoro 配音（af_kore）
$PY core/tts/asr_check.py $D/lines.json $D/voices                 # 3. whisper 逐句校对
$PY $D/music/score.py                                             # 4. 原创极简主义配乐（错相马林巴）→ music/score.wav + score.json
node $D/tools/export.mjs                                          # 5. 画面事件 → events.json，字幕 → out/srt.json
$PY $D/tools/cuecheck.py                                          # 6. 配乐 ↔ 画面卡点自检 + 每个元素一个音
$PY $D/mix.py                                                     # 7. 拟音 + 人声 + 闪避 → mix.wav
$PY core/render/srt.py $D/out/srt.json $O/dark-keynote.srt       # 8. 字幕
node core/render/video.mjs $D --fps 24 --workers 2 --out $D/out/video24.mp4   # 9. 逐帧渲染
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $O/dark-keynote.mp4 24 0 # 10. 合成：−14 LUFS，颗粒 0
$PY $D/tools/final_asr.py $O/dark-keynote.mp4 || true                     # 11. 成片 whisper 抽查 + 人声频段 SNR
node core/render/still.mjs $D 16.45 --q nosub=1 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_16.45.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 0 --q scene=poster --out $D/out/still --prefix po_ && cp $D/out/still/po_0.jpg $O/poster.jpg
