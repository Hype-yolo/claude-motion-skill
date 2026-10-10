#!/bin/sh
# 从零重现《Midnight at the Starlight Hotel》：sh styles/art-deco/demo/build.sh（任意目录运行）
set -e
cd "$(dirname "$0")/../../.."
PY=.venv/bin/python; D=styles/art-deco/demo; O=styles/art-deco
node $D/tools/dump_timeline.mjs                                   # 1. 速度网格（116 → 138 → 116）→ timeline.json（配乐 / 混音 / 自检共用）
$PY core/tts/tts.py $D/lines.json $D/voices                       # 2. Kokoro 配音（bm_fable 播音员 / am_puck 门童）
$PY $D/tools/pitch.py $D/lines.json $D/voices                     # 3. 门童两句升调（更年轻）
$PY core/tts/asr_check.py $D/lines.json $D/voices                 # 4. whisper 逐句校对
$PY $D/music/score.py                                             # 5. 原创交响爵士 → music/score.wav + stems + score.json
$PY $D/tools/cuecheck.py                                          # 6. 配乐卡点 ↔ 画面时间网格自检
$PY $D/mix.py                                                     # 7. 播音员五级空间 + 拟音 + 环境底 + 闪避 → mix.wav
$PY $D/tools/subs.py && $PY core/render/srt.py $D/out/srt.json $O/art-deco.srt     # 8. 字幕
node core/render/video.mjs $D --fps 24 --workers 2 --out $D/out/video24.mp4        # 9. 逐帧渲染（4 workers 约 15 s）
sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav $O/art-deco.mp4 24 3           # 10. 合成：−14 LUFS，颗粒 3
# 11. 静帧：风格帧 / 海报 / 关卡图
node core/render/still.mjs $D 41.9 3.6 --q nosub=1 --out $D/out/still --prefix p_
cp $D/out/still/p_41.9.jpg $D/stills/styleframe.jpg && cp $D/out/still/p_3.6.jpg $O/poster.jpg
for s in frameLobby frameRoof modelSheet kit; do node core/render/still.mjs $D 0 --q scene=frames.$s --out $D/out/still --prefix ${s}_; done
cp $D/out/still/frameLobby_0.jpg $D/stills/frame_v2_lobby.jpg; cp $D/out/still/frameRoof_0.jpg $D/stills/frame_v2_roof.jpg
cp $D/out/still/modelSheet_0.jpg $D/stills/modelsheet_v2.jpg; cp $D/out/still/kit_0.jpg $D/stills/kit_v2.jpg
