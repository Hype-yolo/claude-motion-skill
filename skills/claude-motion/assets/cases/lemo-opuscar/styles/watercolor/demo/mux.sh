#!/bin/sh
# 合成成片：sh styles/watercolor/demo/mux.sh [out.mp4]   （默认 styles/watercolor/watercolor.mp4；实测 preset slow 约 70 s）
# 输入：out/list.txt + out/seg_*.mp4（node render.mjs video 8 的产物）、mix.wav（python mix.py 的产物）
# 参数是从现有成片里反推的：x264 SEI = preset slow / crf 16 / keyint 120；不加颗粒；
# 音频单遍 loudnorm I=-14 TP=-1 → 实测 -14.2 LUFS / peak -1.0 dBFS，与成片一致。
case "$1" in "") O="";; /*) O="$1";; *) O="$(pwd)/$1";; esac   # 相对路径按调用目录解析
cd "$(dirname "$0")"
O="${O:-../watercolor.mp4}"
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -i mix.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -g 120 \
  -af "loudnorm=I=-14:TP=-1:LRA=11,aresample=48000" -c:a aac -b:a 256k \
  -movflags +faststart -shortest "$O"
echo "$O"
ffmpeg -hide_banner -nostats -i "$O" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | head -3
