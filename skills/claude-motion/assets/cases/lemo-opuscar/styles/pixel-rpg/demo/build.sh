#!/bin/sh
# 从零重现成片：sh styles/pixel-rpg/demo/build.sh   （任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/pixel-rpg/demo
$PY core/tts/tts.py $D/lines.json $D/voices                 # 1. Kokoro 配音（bm_george 0.9）
$PY core/tts/asr_check.py $D/lines.json $D/voices           # 2. whisper 逐句校对（vo4 的 inn/in 同音，用 asr 字段）
$PY $D/music/score.py                                       # 3. 原创芯片配乐 → music/score.wav（读 timeline.json）
node core/render/events.mjs $D                              # 4. 时间线 → events.json（拟音 / 旁白事件）
$PY $D/mix.py                                               # 5. 芯片拟音 + 旁白 + 配乐闪避 → mix.wav
node $D/tools/subs.mjs                                      # 6. 字幕 → pixel-rpg.srt（与烧录对话框同一份数据）
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4   # 7. 逐帧渲染（1308 帧，约 20–60 s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav styles/pixel-rpg/pixel-rpg.mp4 24 0   # 8. 合成 + −14 LUFS，无颗粒
node core/render/still.mjs $D 0 --q poster=1 --prefix poster_ --out $D/out && cp $D/out/poster_0.jpg styles/pixel-rpg/poster.jpg
node core/render/still.mjs $D 27.5 --q nosub=1 --prefix sf_ --out $D/out && cp $D/out/sf_27.5.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 0 --q sheet=1 --prefix sheet_ --out $D/out      # 设定表（最新版在 out/sheet_0.jpg）
