#!/bin/sh
# 准备配乐源文件（music/*.mp3 / *.wav 被根 .gitignore 忽略，新 clone 先跑这个）
# Scott Buckley《Wildflowers》CC BY 4.0 — https://www.scottbuckley.com.au/library/
# 两个 wav 都是从 mp3 直接解码的（已核对与原项目逐字节一致）：
#   Wildflowers.wav = 22.05 kHz 单声道，给 analyze.py / jump.py / lag.py 做节拍与自相似分析
#   wf48.wav        = 48 kHz 立体声，给 edit.py 做跳剪 → score.wav
cd "$(dirname "$0")"
[ -f Wildflowers.mp3 ] || curl -L -o Wildflowers.mp3 https://www.scottbuckley.com.au/library/wp-content/uploads/2025/12/Wildflowers.mp3
[ -f Wildflowers.wav ] || ffmpeg -y -loglevel error -i Wildflowers.mp3 -ac 1 -ar 22050 Wildflowers.wav
[ -f wf48.wav ] || ffmpeg -y -loglevel error -i Wildflowers.mp3 -ar 48000 wf48.wav
ls -la Wildflowers.mp3 Wildflowers.wav wf48.wav
