"""导出字幕：python core/render/srt.py cues.json out.srt
cues.json = [{"t0": 1.2, "t1": 3.4, "text": "..."}, ...]（由影片自己写出：比如把页面里驱动字幕的时间线原样存成 JSON，这样 .srt 和画面上的字幕区间一致；
  events.mjs 导出的是 {dur, ev}（音效事件），不是字幕）
重叠的相邻字幕自动截断到下一条开始"""
import sys, json
if len(sys.argv) < 3: print('usage: python core/render/srt.py cues.json out.srt', file=sys.stderr); sys.exit(2)
cues = sorted(json.load(open(sys.argv[1], encoding='utf-8')), key=lambda c: c['t0'])
for k in range(len(cues) - 1): cues[k]['t1'] = min(cues[k]['t1'], cues[k + 1]['t0'])
def fmt(s):
    ms = int(round(max(0, s) * 1000))   # 先整体取整到毫秒再拆，进位才不会丢（1.9996 → 00:00:02,000）
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
out = '\n'.join(f"{k + 1}\n{fmt(c['t0'])} --> {fmt(c['t1'])}\n{c['text']}\n" for k, c in enumerate(cues))
open(sys.argv[2], 'w', encoding='utf-8').write(out); print(sys.argv[2], len(cues), 'cues')
