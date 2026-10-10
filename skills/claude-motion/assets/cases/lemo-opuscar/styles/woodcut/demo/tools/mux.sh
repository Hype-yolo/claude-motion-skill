#!/bin/sh
# 成片合成（本片版）：先走 core/render/mux.sh（两遍 loudnorm −14 LUFS + 颗粒），再按 CRF 28 + tune grain 重编码。
# 木刻的细排线 + 每帧墨色与颗粒让 CRF 19 的片子到 326 MB；CRF 28 在 1:1 裁切对比里看不出差别，93 MB。
# 用法：sh tools/mux.sh video.mp4 mix.wav out.mp4 [fps] [grain]
set -e
V="$1"; A="$2"; O="$3"; FPS="${4:-24}"; GR="${5:-6}"
R="$(cd "$(dirname "$0")/../../../.." && pwd)"; TMP="$(dirname "$V")/master_crf19.mp4"
sh "$R/core/render/mux.sh" "$V" "$A" "$TMP" "$FPS" "$GR"
ffmpeg -y -loglevel error -i "$TMP" -c:v libx264 -preset slow -crf "${CRF:-28}" -tune grain -c:a copy -movflags +faststart "$O"
rm -f "$TMP"; ls -la "$O" | awk '{printf "%s  %.1f MB\n", $9, $5/1e6}'
