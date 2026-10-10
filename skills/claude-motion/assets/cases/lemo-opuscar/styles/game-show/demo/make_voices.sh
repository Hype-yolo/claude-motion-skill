#!/bin/sh
# 人声喊词：macOS `say` 英文系统声线 → ffmpeg 变调不变速 → 44.1 kHz 单声道 wav
# 原项目没有留下生成脚本；这是收录时按 voices/lines*.txt 反推的流程（实测 title.wav 音高 204 Hz 与原文件一致；40 条里 36 条时长误差 ≤ 30 ms、其余 ≤ 40 ms）。
# lines*.txt 每行：名字|声线|语速(say -r)|变调倍数|台词
# 用法：sh make_voices.sh [输出目录]   默认 out/voices_regen/（不覆盖 voices/；确认后再手动拷过去）
set -e
cd "$(dirname "$0")"
OD="${1:-out/voices_regen}"; mkdir -p "$OD"
cat voices/lines.txt voices/lines2.txt voices/lines3.txt | while IFS='|' read -r NAME VOICE RATE PITCH TEXT; do
  [ -z "$NAME" ] && continue
  say -v "$VOICE" -r "$RATE" -o "$OD/$NAME.aiff" "$TEXT"
  # say 输出 22050 Hz；asetrate 抬音高、atempo 拉回时长（不裁静音：原文件也没裁）
  ffmpeg -y -loglevel error -i "$OD/$NAME.aiff" -af "asetrate=22050*$PITCH,aresample=44100,atempo=1/$PITCH" -ac 1 -ar 44100 "$OD/$NAME.wav"
  rm "$OD/$NAME.aiff"; echo "$NAME ($VOICE)"
done
