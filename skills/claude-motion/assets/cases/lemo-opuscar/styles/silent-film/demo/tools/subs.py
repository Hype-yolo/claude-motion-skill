"""Intertitles → out/srt.json (the cards ARE the subtitles; .srt lists their text for accessibility)."""
import json, os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tl = json.load(open(os.path.join(D, 'timeline.json'))); S = tl['SEC']
TXT = [('TITLE', 'THE RUNAWAY LOAF — a photoplay in one reel'), ('CARD1', 'The loaf had other plans.'), ('CARD2', 'STOP THAT BAKER!'),
       ('CARD3', '“Is it yours, mister?”'), ('END', 'The End')]
cues = [{'t0': round(S[k]['t0'] + .1, 3), 't1': round(S[k]['t1'] - .05, 3), 'text': t} for k, t in TXT]
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
json.dump(cues, open(os.path.join(D, 'out/srt.json'), 'w'), indent=1); print(len(cues), 'cards')
