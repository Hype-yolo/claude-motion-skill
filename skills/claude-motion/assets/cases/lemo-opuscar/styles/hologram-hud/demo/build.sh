#!/bin/sh
# 从零重现《Volt · Spec Scan》：sh styles/hologram-hud/demo/build.sh（任意目录运行）
# 换内容（一条命令）：CONTENT=content_alt.json NAME=kite sh styles/hologram-hud/demo/build.sh
#   → 配音、配乐、混音、字幕、成片全部重做，产物在 demo/out/kite/（kite.mp4 / kite.srt / poster.jpg）
#   模型：content.json 的 "model" 指向的 JSON；自己的产品先写 models/gen_<名字>.mjs 生成它（格式见 STYLE.md §11）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/hologram-hud/demo; O=styles/hologram-hud
CONTENT=${CONTENT:-content.json}; NAME=${NAME:-hologram-hud}
if [ "$CONTENT" = "content.json" ]; then W=$D; OUT=$O; else W=$D/out/$NAME; OUT=$W; fi
mkdir -p $W/out
export HH_WORK=$W
VREL=$(node -e "console.log(require('path').relative('$D','$W/voices')||'voices')")
RS=""   # 整机渲染限流已在 core/render/video.mjs 里
node $D/models/gen_volt.mjs > $D/models/volt.json                 # 1. 线框模型（顶点 / 边 / 面 → JSON）
node $D/models/gen_kite.mjs > $D/models/kite.json                 #    换内容测试用的无人机
node $D/tools/make_lines.mjs $CONTENT $W/lines.json               # 2. content → lines.json
$PY core/tts/tts.py $W/lines.json $W/voices                       # 3. Kokoro 配音（af_heart）
$PY core/tts/asr_check.py $W/lines.json $W/voices                 # 4. whisper 逐句校对
node $D/tools/export.mjs $CONTENT $W                              # 5. 画面事件 → events.json，时间网格 → timeline.json，字幕 → out/srt.json
$PY $D/music/score.py                                             # 6. 原创配乐（120 BPM，numpy 合成）→ music/score.wav + score.json
$PY $D/tools/cuecheck.py                                          # 7. 配乐 ↔ 画面卡点自检
$PY $D/mix.py                                                     # 8. 界面音 + 机械拟音 + 环境底 + 人声 + 闪避 → mix.wav
$PY core/render/srt.py $W/out/srt.json $OUT/$NAME.srt             # 9. 字幕
Q="content=$CONTENT&voices=$VREL"
$RS node core/render/video.mjs $D --fps 24 --workers 2 --q "$Q" --out $W/out/video24.mp4   # 10. 逐帧渲染（甩镜段 5 子帧运动模糊）
sh core/render/mux.sh $W/out/video24.mp4 $W/mix.wav $OUT/$NAME.mp4 24 0          # 11. 合成：−14 LUFS，无颗粒
$PY $D/tools/final_asr.py $OUT/$NAME.mp4 || true                  # 12. 成片 whisper 抽查 + 人声频段 SNR
if [ "$CONTENT" = "content.json" ]; then
  node core/render/still.mjs $D 25.5 --q nosub=1 --out $D/out/still --prefix sf_ && cp $D/out/still/sf_25.5.jpg $D/stills/styleframe.jpg
  node core/render/still.mjs $D 33 --q nosub=1 --out $D/out/still --prefix po_ && cp $D/out/still/po_33.jpg $O/poster.jpg
  # 换内容静帧（证明 content_alt.json 可用；不重做它的声音）
  node core/render/still.mjs $D 5 12 37 --q content=content_alt.json --out $D/out/alt --prefix alt_
  cp $D/out/alt/alt_5.jpg $D/stills/alt_title.jpg; cp $D/out/alt/alt_12.jpg $D/stills/alt_signature.jpg; cp $D/out/alt/alt_37.jpg $D/stills/alt_lockup.jpg
else
  T=$(node -e "const t=require('./$W/timeline.json');console.log(t.lock[1]-1)")
  node core/render/still.mjs $D $T --q "$Q&nosub=1" --out $W/out --prefix po_ && cp $W/out/po_$T.jpg $OUT/poster.jpg
fi
