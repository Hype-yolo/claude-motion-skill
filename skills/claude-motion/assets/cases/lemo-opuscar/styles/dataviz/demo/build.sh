#!/bin/sh
# 从零重现《A Hundred Summers》：sh styles/dataviz/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/dataviz/demo; S=styles/dataviz
$PY $D/tools/extract_data.py                                          # 0. GISTEMP CSV → data/jja.json（JJA 列）+ 叙事事实
$PY core/tts/tts.py $D/lines.json $D/voices                           # 1. Kokoro 配音（af_alloy, speed 0.92）
$PY core/tts/asr_check.py $D/lines.json $D/voices                     # 2. whisper 逐句校对（应 mismatches: 0）
$PY $D/tools/words.py                                                 # 3. 逐词时间 → 图注字幕逐词出现
node core/render/events.mjs $D                                        # 4. 画面时间线 → events.json（数据点 / 拟音 / 变形事件）
$PY $D/music/score.py                                                 # 5. 原创配乐：数据声音化 + 模块合成器（读 events.json）
$PY $D/tools/cuecheck.py | tail -1                                    # 6. 配乐 ↔ 画面卡点核对
$PY $D/mix.py                                                         # 7. 环境底 + 拟音 + 旁白闪避 + 配乐 → mix.wav
$PY $D/tools/subs.py > /dev/null && $PY core/render/srt.py $D/out/subs.json $S/dataviz.srt   # 8. 字幕（断言停留）
node core/render/video.mjs $D --fps 24 --workers 2 --out $D/out/video24.mp4         # 9. 逐帧渲染（1200 帧，约 30 s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/dataviz.mp4 24 0              # 10. 合成：−14 LUFS，grain 0
node core/render/still.mjs $D 37.62 --q nosub=1 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_37.62.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 37.1 --q nosub=1 --out $D/out/still --prefix po_ && cp $D/out/still/po_37.1.jpg $S/poster.jpg
