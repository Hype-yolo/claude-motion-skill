#!/bin/sh
# 从零重现成片：sh styles/ukiyoe/demo/build.sh   （任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/ukiyoe/demo
$PY core/tts/tts.py $D/lines.json $D/voices                 # 1. Kokoro 旁白（am_adam）
$PY core/tts/asr_check.py $D/lines.json $D/voices           # 2. whisper 逐句校对
node core/render/events.mjs $D                              # 3. 时间线 → events.json（旁白 / 拟音 / 环境）
$PY $D/music/score.py                                       # 4. 原创配乐（三味线 / 尺八 / 太鼓 / 拍子木）→ music/score.wav
$PY $D/mix.py                                               # 5. 拟音 + 旁白 + 配乐闪避 + 間 的全静音 → mix.wav
$PY $D/subs.py && $PY core/render/srt.py $D/out/subs.json styles/ukiyoe/ukiyoe.srt   # 6. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4          # 7. 逐帧渲染（1056 帧）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav styles/ukiyoe/ukiyoe.mp4 24 0    # 8. 合成 −14 LUFS，颗粒 0（纸纹画面自带）
$PY $D/check_asr.py styles/ukiyoe/ukiyoe.mp4                # 9. 成片 whisper 自检
