#!/bin/sh
# 从零重现《From Bean to Cup》：sh styles/iso-infographic/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/iso-infographic/demo; O=styles/iso-infographic
$PY core/tts/tts.py $D/lines.json $D/voices                               # 1. Kokoro 配音（bf_alice）
$PY core/tts/asr_check.py $D/lines.json $D/voices                         # 2. whisper 逐句校对
$PY $D/music/score.py                                                     # 3. 原创配乐 → music/score.wav + stems + score.json
node core/render/events.mjs $D                                            # 4. 画面事件 → events.json（拟音 / 自检共用）
$PY $D/tools/cuecheck.py                                                  # 5. 配乐卡点 ↔ 画面事件
$PY $D/mix.py                                                             # 6. 环境底 + 拟音 + 人声 + 闪避 → mix.wav
$PY $D/tools/subs.py && $PY core/render/srt.py $D/out/srt.json $O/iso-infographic.srt   # 7. 字幕
node core/render/video.mjs $D --fps 24 --workers 2 --out $D/out/video24.mp4             # 8. 逐帧渲染
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $O/iso-infographic.mp4 24 0           # 9. 合成：−14 LUFS，颗粒 0
$PY $D/tools/final_asr.py $O/iso-infographic.mp4 || true                                # 10. 成片 whisper 抽查
node core/render/still.mjs $D 56.0 --q 'nosub=1&nocard=1' --out $D/out/still --prefix sf_ >/dev/null && cp $D/out/still/sf_56.0.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 57.0 --q nosub=1 --out $D/out/still --prefix po_ >/dev/null && cp $D/out/still/po_57.0.jpg $O/poster.jpg
node core/render/still.mjs $D 3.4 50.9 --q nosub=1 --out $D/out/still --prefix hand_ >/dev/null && $PY core/render/sheet.py $D/stills/frame_v2_hands.jpg $D/out/still/hand_3.4.jpg $D/out/still/hand_50.9.jpg --cols 2 --w 960
node core/render/still.mjs $D 0 --q test=spark --out $D/out/still --prefix eng_ >/dev/null && cp $D/out/still/eng_0.jpg $D/stills/engine_shape.jpg
