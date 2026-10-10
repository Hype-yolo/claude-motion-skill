#!/bin/sh
# 从零重现《Five Rules for a Poster》：sh styles/swiss-motion/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/swiss-motion/demo; S=styles/swiss-motion
$PY core/tts/tts.py $D/lines.json $D/voices                          # 1. Kokoro 配音（af_sarah, speed 1.0）
$PY core/tts/asr_check.py $D/lines.json $D/voices                    # 2. whisper 逐句校对（应 mismatches: 0）
$PY $D/tools/words.py                                                # 3. 逐词时间 → 字幕逐词吸附
$PY $D/music/score.py                                                # 4. 原创 motorik 配乐（读 score.json，~4 s）
node core/render/events.mjs $D                                       # 5. 时间线 → events.json（拟音事件）
$PY $D/mix.py                                                        # 6. 拟音 + 旁白闪避 + 配乐 → mix.wav
$PY $D/tools/subs.py && $PY core/render/srt.py $D/out/subs.json $S/swiss-motion.srt   # 7. 字幕（断言停留时长）
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4          # 8. 逐帧渲染（~12 s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/swiss-motion.mp4 24 0          # 9. 合成：−14 LUFS，grain 0
node core/render/still.mjs $D 33.4 --q nosub=1 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_33.4.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 43.5 --q 'nosub=1&poster=1' --out $D/out/still --prefix po_ && cp $D/out/still/po_43.5.jpg $S/poster.jpg
