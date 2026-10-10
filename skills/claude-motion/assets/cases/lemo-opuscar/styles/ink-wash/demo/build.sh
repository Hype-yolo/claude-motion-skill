#!/bin/sh
# 从零一键重现《The Swordsman and the River》：在仓库根目录运行 sh styles/ink-wash/demo/build.sh
set -e
cd "$(dirname "$0")/../../.."
D=styles/ink-wash/demo
PY=.venv/bin/python
echo "1/7 配音"; $PY core/tts/tts.py $D/lines.json $D/voices
echo "2/7 whisper 校对"; $PY core/tts/asr_check.py $D/lines.json $D/voices
echo "3/7 配乐"; $PY $D/music/score.py
echo "4/7 事件 + 混音"; node core/render/events.mjs $D && $PY $D/mix.py
echo "5/7 渲染 1152 帧"; node core/render/video.mjs $D --fps 24 --workers 3 --out $D/out/video24.mp4
echo "6/7 合成（−14 LUFS，无颗粒：宣纸纹理在着色器里）"; sh core/render/mux.sh $D/out/video24.mp4 $D/mix.wav styles/ink-wash/ink-wash.mp4 24 0
echo "7/7 字幕 / 海报 / 风格帧"
node $D/cues.mjs > $D/cues.json && $PY core/render/srt.py $D/cues.json styles/ink-wash/ink-wash.srt
node core/render/still.mjs $D 12.4 --q poster=1 --out $D/out --prefix poster_ && cp $D/out/poster_12.4.jpg styles/ink-wash/poster.jpg
node core/render/still.mjs $D 32.9 --q nosub=1 --out $D/out --prefix sf_ && cp $D/out/sf_32.9.jpg $D/stills/styleframe.jpg
echo done
