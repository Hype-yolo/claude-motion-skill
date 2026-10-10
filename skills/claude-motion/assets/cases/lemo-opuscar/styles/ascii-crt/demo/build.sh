#!/bin/sh
# 从零重现《TRANQUILITY.LOG》：sh styles/ascii-crt/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/ascii-crt/demo; S=styles/ascii-crt
$PY core/tts/tts.py $D/lines.json $D/voices_raw                  # 1. Kokoro 配音（am_echo, speed 0.8）
$PY $D/voice_fx.py                                               # 2. AI 声线：轻度环调制 + 梳状共振 + 带通 → voices/
$PY core/tts/asr_check.py $D/lines.json $D/voices                # 3. whisper 逐句校对（mismatches: 0）+ 逐词时间 words.json（日志栏逐词打字用）
$PY $D/music/score.py                                            # 4. 原创模拟合成器配乐 → music/score.wav + stems（~6s）
node core/render/events.mjs $D                                   # 5. 时间线 → events.json（键盘/握手/落地/旁白事件）
$PY $D/mix.py                                                    # 6. 合成拟音 + 旁白闪避 + 配乐 → mix.wav
node $D/tools/subs.mjs $D && $PY core/render/srt.py $D/out/subs.json $S/ascii-crt.srt   # 7. 字幕
node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4             # 8. 逐帧渲染（1435 帧，~35s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $S/ascii-crt.mp4 24 0               # 9. 合成：−14 LUFS，不加颗粒（噪声在画面里）
node core/render/still.mjs $D 39.4 --q 'nosub=1' --out $D/out/still --prefix sf_ && cp $D/out/still/sf_39.4.jpg $D/stills/styleframe.jpg
node core/render/still.mjs $D 0 --q 'frame=poster' --out $D/out/still --prefix po_ && cp $D/out/still/po_0.jpg $S/poster.jpg
