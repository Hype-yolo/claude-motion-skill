// 字幕：模仿录像带时代的隐藏式字幕（Line 21 / CEA-608）——等宽白字、每行一条黑底块、一行最多 32 字符
// 广播 = "[PA]" 前缀；摄像者的气声 = 斜体；环境声用方括号描述（SDH 习惯），包括全片最安静的那一秒 "[SILENCE]"
import { T, LINES } from './story.js';

const COLS = 32;
function wrap(s) {
  const out = []; let cur = '';
  for (const w of s.split(' ')) { const t = cur ? cur + ' ' + w : w; if (t.length > COLS && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
// dur = voices/dur.json；words = voices/words.json（切分长句用）
export function buildCaps(dur, words) {
  const L = Object.fromEntries(LINES.map(l => [l.id, l.t]));
  const end = (id, pad = .65, min = 1.9) => L[id] + Math.max(min, (dur[id] || 2) + pad);
  // 按词时间戳找到 splitWord 开始的时刻
  const at = (id, word, fallback) => {
    const w = (words && words[id]) || []; const k = w.findIndex(x => x[0].toLowerCase().replace(/[^a-z]/g, '') === word);
    return k >= 0 ? L[id] + w[k][1] - .05 : L[id] + fallback;
  };
  const C = [
    { t0: .75, t1: 2.65, text: '[FLUORESCENT LIGHTS HUMMING]' },
    { t0: L.p0, t1: end('p0'), text: '[PA] Good evening, and welcome to the night shift.' },
    { t0: L.w1, t1: end('w1', .7), text: '(whispering) Okay. First night.', it: true },
    { t0: L.p1, t1: end('p1'), text: '[PA] Rule one. The humming of the lights is normal.' },
    { t0: L.p2, t1: end('p2'), text: '[PA] Rule two. You are the only employee on this floor.' },
    { t0: L.p3, t1: end('p3'), text: '[PA] Rule three. If the lights flicker three times, do not look at the ceiling.' },
    { t0: T.flick[0] - .05, t1: T.flick[0] + 1.95, text: '[LIGHTS FLICKER]' },
    { t0: L.w2 - .05, t1: end('w2', .9, 1.9), text: 'Hello?', it: true },
    { t0: T.tear[0], t1: T.tear[0] + 1.3, text: '[TAPE NOISE]' },
    { t0: L.w3, t1: end('w3', .5), text: 'It was midnight a second ago.', it: true },
  ];
  const s4 = at('p4', 'if', 2.6);
  C.push({ t0: L.p4, t1: s4, text: '[PA] Rule four. There are no exits on this floor.' });
  C.push({ t0: s4, t1: T.hush[0], text: 'If you see an exit sign, do not follow it.' });
  C.push({ t0: T.hush[0], t1: T.hush[1] + .1, text: '[SILENCE]' });
  C.push({ t0: L.w4, t1: end('w4', .7), text: "That's an exit.", it: true });
  C.push({ t0: L.p6, t1: end('p6', .8), text: '[PA] Rule six.' });
  C.sort((a, b) => a.t0 - b.t0);
  for (let k = 0; k < C.length - 1; k++) C[k].t1 = Math.min(C[k].t1, C[k + 1].t0);
  C.forEach(c => c.rows = wrap(c.text));
  return C;
}

// 画在 1920×1080 叠加层上，限定在 4:3 画幅内（x ∈ [240, 1680]）
export function drawCaps(x, caps, t) {
  const c = caps.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const fs = 42, cw = fs * .6, rh = 54, cx = 960;
  x.font = `600 ${fs}px 'IBM Plex Mono'`; x.textBaseline = 'middle';
  const n = c.rows.length, yb = 1080 - 222;
  c.rows.forEach((r, i) => {
    const y = yb - (n - 1 - i) * rh, w = (r.length + 2) * cw, x0 = Math.round(cx - w / 2);
    x.fillStyle = '#000'; x.fillRect(x0, y - rh / 2, w, rh);
    x.fillStyle = '#f2f2f2';
    x.save();
    if (c.it && !r.startsWith('[')) { x.translate(x0 + cw, y); x.transform(1, 0, -.2, 1, 0, 0); x.fillText(r, 0, 2); }
    else x.fillText(r, x0 + cw, y + 2);
    x.restore();
  });
}
