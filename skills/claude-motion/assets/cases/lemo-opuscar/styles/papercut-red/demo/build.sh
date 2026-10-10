#!/bin/sh
# 从零重现成片：sh styles/papercut-red/demo/build.sh（任意目录运行均可）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/papercut-red/demo; O=styles/papercut-red
$PY core/tts/tts.py $D/lines.json $D/voices                     # 1. Kokoro 配音（af_sarah 0.9）
$PY core/tts/asr_check.py $D/lines.json $D/voices               # 2. whisper 逐句校对（asr 字段登记 Nian→Nyan/Nion 同音）
node core/render/events.mjs $D                                  # 3. 时间线 → events.json（旁白 / 拟音卡点）
$PY $D/music/score.py                                           # 4. 原创配乐（琵琶 pluck + 筝 + 二胡 + 笛 + 木鱼 + 锣 + 手鼓）→ music/score.wav
$PY $D/mix.py                                                   # 5. 纸 / 剪刀 / 烛火 / 爆竹拟音 + 旁白 + 配乐闪避 → mix.wav
$PY $D/subs.py                                                  # 6. 字幕 cues → papercut-red.srt
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4   # 7. 逐帧渲染（1176 帧，约 30 s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $O/papercut-red.mp4 24 0   # 8. 合成：两遍 loudnorm −14 LUFS，不加颗粒（纸纤维在画面里）
$PY $D/check_final.py                                           # 9. 成片复核：分句 whisper + blackdetect
still() { for i in 1 2 3; do node core/render/still.mjs "$@" && return 0; echo "retry $i"; done; return 1; }
still $D 32.7 --q 'nosub=1&poster=1' --prefix P_ --out $D/out/t && cp $D/out/t/P_32.7.jpg $O/poster.jpg
still $D 32.7 --q 'nosub=1' --prefix S_ --out $D/out/t && cp $D/out/t/S_32.7.jpg $D/stills/styleframe.jpg
