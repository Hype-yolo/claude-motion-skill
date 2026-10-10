#!/bin/sh
# 从零重现成片：sh styles/lowpoly-island/demo/build.sh（任意目录运行均可）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/lowpoly-island/demo; S=styles/lowpoly-island
$PY core/tts/tts.py $D/lines.json $D/voices                 # 1. Kokoro 配音（af_sky）
$PY core/tts/asr_check.py $D/lines.json $D/voices           # 2. whisper 逐句校对
node core/render/events.mjs $D                              # 3. 时间线 → events.json（生长事件带音高 = 旋律声部）
$PY $D/music/score.py                                       # 4. 原创配乐：旋律由生长事件逐个合成
$PY $D/music/check.py                                       #    librosa 核对：关键音起音 / 音高 vs 画面事件、真静音、频段能量
$PY $D/mix.py                                               # 5. 材质拟音 + 环境床 + 旁白 + 配乐闪避 → mix.wav
$PY $D/subs.py && $PY core/render/srt.py $D/out/cues.json $S/lowpoly-island.srt   # 6. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4        # 7. 逐帧渲染（2× 超采样 + GTAO）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/lowpoly-island.mp4 24 0     # 8. 合成 + −14 LUFS，无颗粒
