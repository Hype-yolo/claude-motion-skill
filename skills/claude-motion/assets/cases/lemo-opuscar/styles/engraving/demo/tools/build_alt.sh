#!/bin/sh
# Full film from another content file, without touching the main film's files:
#   sh styles/engraving/demo/tools/build_alt.sh content_alt.json      → demo/out/alt/engraving_alt.mp4
set -e
cd "$(dirname "$0")/../../../.."
PY=.venv/bin/python; D=styles/engraving/demo; C=${1:-content_alt.json}; W=$D/out/alt; export ENG_WORK=$W
mkdir -p $W
$PY -c "import json; c=json.load(open('$D/$C')); v=c['voice']; json.dump([dict(id=l['id'],text=l['text'],voice=v['voice'],speed=v.get('speed',.92),lang='en-gb',**({'asr':l['asr']} if 'asr' in l else {})) for l in v['lines']], open('$W/lines.json','w'), indent=1)"
$PY core/tts/tts.py $W/lines.json $W/voices
$PY core/tts/asr_check.py $W/lines.json $W/voices
node $D/tools/events.mjs $D "$C&voices=out/alt/voices/dur.json" $W
$PY $D/music/score.py | tail -3
$PY $D/mix.py
$PY $D/tools/cuecheck.py
$PY $D/tools/subs.py $C && $PY core/render/srt.py $W/subs.json $W/engraving_alt.srt
G=""   # 整机渲染限流已在 core/render/video.mjs 里
$G node core/render/video.mjs $D --fps 24 --workers 2 --q "content=$C&voices=out/alt/voices/dur.json" --out $W/video.mp4
sh core/render/mux.sh $W/video.mp4 $W/mix.wav $W/engraving_alt.mp4 24 4
