#!/bin/sh
# 拼接 render.mjs video 产出的分段 + 混入 music.wav → 成片
# 用法：sh finish.sh [out.mp4]   默认输出 ../game-show.mp4（会覆盖库里的成片，试跑请传别的路径，如 out/test.mp4）
# 参数与 v3 成片一致：x264 slow crf16 / AAC 256k 48 kHz / 两遍 loudnorm → −14 LUFS
# AUDIO_FROM=旧成片.mp4 sh finish.sh …  → 不重混，直接拷贝旧成片的音轨（局部重渲画面、音频保持原样时用）
set -e
cd "$(dirname "$0")"
O="${1:-../game-show.mp4}"
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -c copy out/video_noaudio.mp4
if [ -n "$AUDIO_FROM" ]; then
  ffmpeg -y -loglevel error -i out/video_noaudio.mp4 -i "$AUDIO_FROM" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a copy -movflags +faststart "$O"
  echo "$O (audio copied from $AUDIO_FROM)"; exit 0
fi
J=$(ffmpeg -hide_banner -nostats -i music.wav -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g() { echo "$J" | /usr/bin/grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
LN="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
ffmpeg -y -loglevel error -i out/video_noaudio.mp4 -i music.wav \
  -filter_complex "[1:a]$LN,aresample=48000[a]" -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart -shortest "$O"
echo "$O"
ffmpeg -hide_banner -nostats -i "$O" -af ebur128 -f null - 2>&1 | /usr/bin/grep -E "^\s+(I|Peak):" | head -2
