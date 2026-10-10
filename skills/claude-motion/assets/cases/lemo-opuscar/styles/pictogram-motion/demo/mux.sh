#!/bin/zsh
# 拼接分段 → 轻颗粒 → 混入配乐 → 成片
# 用法：./mux.sh [输出路径]
#   OUTDIR=out_ej（默认，英日版）→ 默认输出 ../pictogram-motion.mp4（= styles/pictogram-motion/pictogram-motion.mp4）
#   OUTDIR=out   （中文版）      → 默认输出 out/pictogram-motion_zh.mp4
set -e
cd "${0:A:h}"
SEG="${OUTDIR:-out_ej}"
if [[ "$SEG" == "out_ej" ]]; then DEF="../pictogram-motion.mp4"; else DEF="$SEG/pictogram-motion_zh.mp4"; fi
OUT="${1:-$DEF}"
ffmpeg -y -loglevel error -f concat -safe 0 -i $SEG/list.txt -i music/music.wav \
  -vf "tpad=stop_duration=2:stop_mode=clone,noise=c0s=4:c0f=t+u,format=yuv420p" \
  -c:v libx264 -preset slow -crf 14 -profile:v high -r 60 -g 120 \
  -c:a aac -b:a 320k -ar 48000 -map 0:v -map 1:a -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
