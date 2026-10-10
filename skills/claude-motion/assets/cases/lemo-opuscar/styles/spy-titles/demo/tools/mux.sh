#!/bin/sh
# 合成成片：mux.sh video.mp4 mix.wav out.mp4 [fps] [grain]
# 视频按目标帧率输出（定格片段自动复制帧）；grain = 颗粒强度（默认 2，0 = 不加；像素/矢量风格用 0）
# 音频两遍 loudnorm → −14 LUFS / TP −1.2（单遍会偏 0.5 LU 左右）
V="$1"; A="$2"; O="$3"; FPS="${4:-24}"; GR="${5:-2}"
J=$(ffmpeg -hide_banner -nostats -i "$A" -af loudnorm=I=-14:TP=-1.2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
LN="loudnorm=I=-14:TP=-1.2:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
if [ "$GR" = "0" ]; then VF="fps=$FPS,format=yuv420p"; else VF="fps=$FPS,noise=c0s=$GR:allf=t,format=yuv420p"; fi
ffmpeg -y -loglevel error -i "$V" -i "$A" \
  -filter_complex "[0:v]$VF[v];[1:a]$LN,aresample=48000[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf ${CRF:-19} -r "$FPS" -c:a aac -b:a 256k -movflags +faststart -shortest "$O"
echo "$O"
ffmpeg -hide_banner -nostats -i "$O" -af ebur128 -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | head -3
