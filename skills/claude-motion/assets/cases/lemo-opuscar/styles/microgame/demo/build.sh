#!/bin/sh
# 从零重现《Five-Second Astronaut》：sh styles/microgame/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/microgame/demo; O=styles/microgame
node $D/tools/dump_timeline.mjs                                   # 1. 速度网格 → timeline.json（配乐 / 混音 / 自检共用）
$PY core/tts/tts.py $D/lines.json $D/voices                       # 2. Kokoro 配音（am_fenrir / af_bella）
$PY $D/tools/trim_cmd.py $D/lines.json $D/voices                  # 3. 单词命令去掉元音尾巴（"Pump, now!" → "Pump"）
$PY core/tts/asr_check.py $D/lines.json.asr.json $D/voices        # 4. whisper 逐句校对（ah/choo 为拟音，不计）
$PY $D/music/score.py                                             # 5. 原创放克配乐 → music/score.wav + stems + score.json
node core/render/events.mjs $D                                    # 6. 画面事件 → events.json
$PY $D/tools/cuecheck.py                                          # 7. 配乐卡点 ↔ 画面事件对齐自检
$PY $D/mix.py                                                     # 8. 拟音 + 人声 + 闪避 → mix.wav
$PY $D/tools/subs.py && $PY core/render/srt.py $D/out/srt.json $O/microgame.srt   # 9. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4        # 10. 逐帧渲染（~25 s）
CRF=20 sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav $O/microgame.mp4 24 0      # 11. 合成：−14 LUFS，颗粒 0
$PY $D/tools/final_asr.py $O/microgame.mp4 || true                                # 12. 成片 whisper 抽查
node core/render/still.mjs $D 50.2 --q nosub=1 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_50.2.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 6.4 --q nosub=1 --out $D/out/still --prefix po_ && cp $D/out/still/po_6.4.jpg $O/poster.jpg
node core/render/still.mjs $D 0 --q scene=frames.modelSheet --out $D/out/still --prefix ms_ && cp $D/out/still/ms_0.jpg $D/stills/modelsheet_v2.jpg
node core/render/still.mjs $D 0 --q scene=frames.styleSheet --out $D/out/still --prefix ss_ && cp $D/out/still/ss_0.jpg $D/stills/modelsheet_v2_styles.jpg
