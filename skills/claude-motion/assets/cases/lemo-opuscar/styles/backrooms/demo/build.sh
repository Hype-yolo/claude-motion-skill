#!/bin/sh
# 从零重现《Night Shift Orientation》：sh styles/backrooms/demo/build.sh（在仓库根运行）
set -e
D=styles/backrooms/demo; PY=.venv/bin/python
$PY core/tts/tts.py $D/lines.json $D/voices                 # 1. 配音（Kokoro：af_bella 广播 / am_michael 摄像者）
$PY core/tts/asr_check.py $D/lines.json $D/voices            # 2. whisper 校对原声 + 逐词时间戳（字幕拆句用）
$PY $D/music/muzak.py                                        # 3. 原创画内电梯音乐（sampler，CC0 采样）
node core/render/events.mjs $D                               # 4. 页面时间线 → events.json（对白/拟音/字幕同源）
$PY $D/mix.py                                                # 5. 拟音 + 广播喇叭 + 小声说话 + 嗡鸣 + 带速 → mix.wav
$PY core/tts/asr_check.py $D/lines.json $D/voices_fx         # 6. whisper 复检处理后的人声（p2 "Rule two/2" 为数字写法差异，可接受）
node core/render/video.mjs $D --fps 24 --workers 3           # 7. 逐帧渲染（1433 帧，约 80 s）
CRF=24 sh $D/tools/mux.sh $D/out/video.mp4 $D/mix.wav styles/backrooms/backrooms.mp4 24 0   # 8. 合成（−14 LUFS，颗粒 0：VHS 噪点在画面里）
python3 -c "import json;E=json.load(open('$D/events.json'));json.dump([{'t0':e['t'],'t1':e['t1'],'text':e['text']} for e in E['ev'] if e['type']=='cap'],open('$D/out/cues.json','w'))"
$PY core/render/srt.py $D/out/cues.json styles/backrooms/backrooms.srt
node core/render/still.mjs $D 3.6 9.0 --q nosub=1 --prefix pf_ --out $D/out/t   # 9. 海报 / 风格帧
cp $D/out/t/pf_3.6.jpg styles/backrooms/poster.jpg; cp $D/out/t/pf_9.0.jpg $D/stills/styleframe.jpg
