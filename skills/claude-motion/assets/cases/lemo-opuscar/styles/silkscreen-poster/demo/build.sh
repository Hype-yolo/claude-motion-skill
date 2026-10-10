#!/bin/sh
# 从零重现《Three Trails》：sh styles/silkscreen-poster/demo/build.sh（任意目录运行）
# 换内容：改 demo/content.json（或 CONTENT=content_alt.json）后重跑本脚本。无旁白，不需要 TTS。
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/silkscreen-poster/demo; O=styles/silkscreen-poster
Q=""; [ -n "$CONTENT" ] && Q="content=$CONTENT"
node $D/tools/timeline.mjs $CONTENT                                   # 1. 打印时间线（由 content.json 推出）
node core/render/events.mjs $D                                        # 2. 画面事件 → events.json（默认 content.json）
$PY $D/music/compose.py                                               # 3. 配乐 → music/score.wav + stems
$PY $D/mix.py                                                         # 4. 环境 + 拟音 + 配乐让路 → mix.wav
$PY $D/tools/cuecheck.py                                              # 5. 卡点自检
G=""   # 整机渲染限流已在 core/render/video.mjs 里
$G node core/render/video.mjs $D --fps 24 --workers 2 ${Q:+--q $Q} --out $D/out/video24.mp4   # 6. 逐帧渲染（限流器）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $O/silkscreen-poster.mp4 24 3                                   # 7. −14 LUFS，颗粒 3
node core/render/still.mjs $D 33 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_33.jpg $D/stills/styleframe.jpg && cp $D/out/still/sf_33.jpg $O/poster.jpg
node core/render/still.mjs $D 2.5 19.2 30.5 39.5 --q content=content_alt.json --prefix alt_ --out $D/out/alt       # 8. 换内容静帧
