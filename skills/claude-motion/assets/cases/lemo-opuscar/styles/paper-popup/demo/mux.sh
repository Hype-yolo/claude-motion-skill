#!/bin/zsh
# 拼接视频段 + 混音 → 成片（响度 -14 LUFS，真峰 -1.2）
# 用法：zsh mux.sh            → ../paper-popup.mp4（= styles/paper-popup/paper-popup.mp4）
#       OUT=out/test.mp4 zsh mux.sh   → 输出到别处（不覆盖成片）
set -e
cd "${0:A:h}"
OUT="${OUT:-../paper-popup.mp4}"
ffmpeg -y -v error -f concat -safe 0 -i out/list.txt -i mix.wav \
  -vf "noise=c0s=2:c0f=t+u" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 60 \
  -af "loudnorm=I=-14:TP=-1.2:LRA=11" -ar 48000 -c:a aac -b:a 256k -movflags +faststart -shortest "$OUT"
ls -la "$OUT"
