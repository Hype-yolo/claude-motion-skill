# 从 events.json 的 v:* 打点 + voices/lines*.txt 台词生成 ../game-show.srt
# 片中只有英文喊词（画面字卡是中文、已烧进画面），srt 只收录喊词；同一句连续重复（间隔 < 0.15 s）合并成一条。
# 用法：python make_srt.py [out.srt]
import json, os, sys, wave
os.chdir(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '../game-show.srt'
TXT = {}
for f in ('lines.txt', 'lines2.txt', 'lines3.txt'):
    for l in open(f'voices/{f}', encoding='utf-8'):
        p = l.rstrip('\n').split('|')
        if len(p) == 5: TXT[p[0]] = p[4]
def dur(n):
    w = wave.open(f'voices/{n}.wav'); return w.getnframes() / w.getframerate()
ALIAS = {'hey': 'hey_a', 'crowd': 'hey_a', 'heyAll': 'hey_a', 'heyBig': 'hey_a', 'heyVar': 'hey_a'}
cues = []
for e in json.load(open('events.json'))['ev']:
    if not e['s'].startswith('v:'): continue
    v = ALIAS.get(e['s'][2:], e['s'][2:])
    text = TXT[v].replace('A. I.', 'AI').replace('G P T', 'GPT')
    t0 = e['t'] - 0.03; t1 = t0 + max(0.6, dur(v) + 0.1)
    if cues and cues[-1][2] == text and t0 - cues[-1][1] < 0.15: cues[-1][1] = t1; continue
    if cues and cues[-1][1] > t0: cues[-1][1] = t0 - 0.01
    cues.append([t0, t1, text])
fmt = lambda t: f'{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round(t % 1 * 1000)) % 1000:03d}'
with open(OUT, 'w', encoding='utf-8') as f:
    for i, (a, b, s) in enumerate(cues, 1): f.write(f'{i}\n{fmt(max(0, a))} --> {fmt(b)}\n{s}\n\n')
print(OUT, len(cues), 'cues')
