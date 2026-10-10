#!/bin/sh
# core/render/mux.sh 的本地副本：① 很轻的信号噪声（亮度 2，逐帧变化；CRT 本身已有纹理）② 两遍 loudnorm（单遍会偏差 0.5 LU 左右）
# 用法：tools/mux.sh out/video24.mp4 mix.wav ../cel-anime-80s.mp4 24
V="$1"; A="$2"; O="$3"; FPS="${4:-24}"
J=$(ffmpeg -hide_banner -nostats -i "$A" -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
LN="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
ffmpeg -y -loglevel error -i "$V" -i "$A" \
  -filter_complex "[0:v]fps=$FPS,noise=c0s=2:allf=t,format=yuv420p[v];[1:a]$LN,aresample=48000[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 23 -r "$FPS" -c:a aac -b:a 256k -movflags +faststart -shortest "$O"
echo "$O"
