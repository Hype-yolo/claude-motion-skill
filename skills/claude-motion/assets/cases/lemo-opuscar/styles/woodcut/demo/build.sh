#!/bin/sh
# 从零重现《The Bell Founder》：sh styles/woodcut/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/woodcut/demo; O=styles/woodcut
$PY core/tts/tts.py $D/lines.json $D/voices                       # 1. Kokoro 配音（am_onyx 0.88，4 句）
$PY core/tts/asr_check.py $D/lines.json $D/voices                 # 2. whisper 逐句校对 → words.json
$PY $D/music/score.py                                             # 3. 原创配乐（读 timeline.json）→ music/score.wav + stems + score.json
node core/render/events.mjs $D                                    # 4. 画面事件 → events.json
$PY $D/tools/cuecheck.py                                          # 5. 配乐卡点 ↔ 画面事件 ↔ 时间线对齐自检（含两段静音）
$PY $D/mix.py                                                     # 6. 按材质合成的拟音 + 环境 + 旁白 + 配乐闪避 + 两段静音 + 钟 → mix.wav
$PY $D/tools/subs.py                                              # 7. 字幕 → woodcut.srt
node core/render/video.mjs $D --fps 24 --workers 4 --out $D/out/video24.mp4        # 8. 逐帧渲染（4 workers 约 45 s）
sh $D/tools/mux.sh $D/out/video24.mp4 $D/mix.wav $O/woodcut.mp4 24 6              # 9. 合成：−14 LUFS，颗粒 6，CRF 28
$PY $D/tools/final_asr.py $O/woodcut.mp4 || true                                  # 10. 成片 whisper 抽查
node core/render/still.mjs $D 40.3 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_40.3.jpg $D/stills/styleframe.jpg   # 11. 风格图鉴帧
node core/render/still.mjs $D 10.0 --out $D/out/still --prefix po_ && cp $D/out/still/po_10.0.jpg $O/poster.jpg              # 12. 海报（带片名的第一张印品）
node core/render/still.mjs $D 1.3 --q test=spark --out $D/out/still --prefix ex_ && cp $D/out/still/ex_1.3.jpg $D/stills/engine_example.jpg   # 13. STYLE.md §10 引擎最小示例
