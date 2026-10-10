#!/bin/sh
# 从零重现成片：sh styles/shadow-puppet/demo/build.sh（任意目录运行均可）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/shadow-puppet/demo; O=styles/shadow-puppet
$PY core/tts/tts.py $D/lines.json $D/voices                    # 1. Kokoro 配音（am_michael）
$PY core/tts/asr_check.py $D/lines.json $D/voices              # 2. whisper 逐句校对（asr 字段处理 ten/10、suns/sons、Hou/Hu 同音）
node core/render/events.mjs $D                                 # 3. 时间线 → events.json（旁白 / 拟音 / 配乐卡点）
$PY $D/music/score.py                                          # 4. 原创配乐（锣鼓经 + 板胡 + 唢呐，core/audio/sampler）→ music/score.wav
$PY $D/mix.py                                                  # 5. 拟音 + 旁白 + 配乐闪避 → mix.wav
$PY $D/tools/cues.py && $PY core/render/srt.py $D/out/cues.json $O/shadow-puppet.srt   # 6. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4             # 7. 逐帧渲染（~80 s）
sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav $O/shadow-puppet.mp4 24 2              # 8. 合成：两遍 loudnorm −14 LUFS，颗粒 2，CRF 22
# 9. 海报 + 风格帧（14 个 agent 共用 GPU 时截图偶尔超时，重试 3 次）
still() { for i in 1 2 3; do node core/render/still.mjs "$@" && return 0; echo "retry $i"; done; return 1; }
still $D 1 --q 'test=poster' --prefix poster_ --out $D/out/st && cp $D/out/st/poster_1.jpg $O/poster.jpg
still $D 32.6 --q 'nosub=1' --prefix sf_ --out $D/out/st && cp $D/out/st/sf_32.6.jpg $D/stills/styleframe.jpg
