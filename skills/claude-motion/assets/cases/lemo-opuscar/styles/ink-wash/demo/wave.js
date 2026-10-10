// 巨浪：泼墨浪身 + 顺势的水纹线（学宋人水图的线描）+ 含墨卷起的浪头（飞白即浪花）+ 墨点水沫
// 局部坐标：原点在浪脚水面，y 向上为负。o: {x, y, s, rise(0..1), curl(0..1), t, seed, am}
import { mk, draw, mass, blot, TONE } from './ink.js';
import { mulberry, lerp, clamp, vnoise } from '/core/lib.js';

function cr(pts, n = 8) {   // Catmull-Rom 加密，给水纹线用
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; const f = j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3); out.push([f(0), f(1)]); }
  }
  out.push(pts[pts.length - 1]); return out;
}

export function waveShape(o) {
  const r = o.rise ?? 1, c = o.curl ?? 1, t = o.t ?? 0;
  const sway = Math.sin(t * 1.7) * 6;
  const face = [[-460, 0], [-310, -55 * r], [-165, -210 * r], [-70, -440 * r], [-10 + sway * .3, -610 * r]];
  const crest = [-10 + sway * .5, -650 * r];
  const lip = [[40, -600 * r], crest, [lerp(-10, -90, c), lerp(-690, -725, c) * r], [lerp(0, -200, c), lerp(-700, -728, c) * r], [lerp(10, -272, c), lerp(-680, -684, c) * r], [lerp(20, -290, c) + sway, lerp(-650, -618, c) * r]];
  const back = [crest, [130, -590 * r], [310, -420 * r], [540, -260 * r], [820, -150 * r], [1150, -70 * r], [1500, -20 * r]];
  return { face, crest, lip, back, r, c };
}

export function wave(L, o) {
  const x0 = o.x ?? 0, y0 = o.y ?? 0, s = o.s ?? 1, am = o.am ?? 1, R = mulberry(o.seed ?? 21), t = o.t ?? 0;
  const W = waveShape(o);
  const T = p => [x0 + p[0] * s, y0 + p[1] * s];
  const r = W.r; if (r <= .02) return W;
  // 浪身：淡墨湿块（浪面上半最浓，往下被水雾吃掉）
  const body = [...W.face, W.crest, ...W.back.slice(1), [1500, 30], [-460, 30]].map(T);
  mass(L.wet, body, .32 * am, 8 * s, 3, [0, y0 - 650 * r * s, 0, y0 + 20 * s, 1, .15]);
  // 浪：几笔巨大的含墨笔，从浪脚顺势扫上去、在浪顶卷过来（笔势就是浪势）
  const guide = [...W.face, ...W.lip.slice(1)];
  const strokes = [
    { off: [0, 0], w: 130, tone: .85, dry: .42, k: 1 },
    { off: [90, 30], w: 110, tone: .7, dry: .5, k: .93 },
    { off: [190, 70], w: 95, tone: .55, dry: .55, k: .85 },
    { off: [300, 110], w: 80, tone: .45, dry: .6, k: .74 },
    { off: [-40, -10], w: 36, tone: .95, dry: .35, k: 1.03 },
  ];
  strokes.forEach((st, i) => {
    const pts = guide.map((p, j) => {
      const u = j / (guide.length - 1);
      return [p[0] * st.k + st.off[0] * (1 - u * .9), p[1] * st.k * (1 - (1 - st.k) * .2) + st.off[1] * (1 - u)];
    });
    draw(L, mk(cr(pts, 4).map(T), { w: st.w * s, tone: st.tone, darkDir: [-1, -1], side: .9, brWet: true, body: .32, dry: st.dry, wet: .85, prof: 'rise', rough: .2, nb: 56, seed: 300 + i }), 1, am);
  });
  // 背坡：两笔淡墨
  for (let k = 0; k < 2; k++) {
    const pts = W.back.map(p => [p[0] + 20 + k * 60, p[1] + 30 + k * 70 * r]);
    draw(L, mk(cr(pts, 3).map(T), { w: (70 - k * 20) * s, tone: .4 - k * .12, darkDir: [0, -1], side: .8, brWet: true, body: .3, dry: .55, wet: .9, prof: 'lens', seed: 350 + k }), 1, am);
  }
  // 几道水纹线（宋人水图的线描），顺浪势
  for (let k = 0; k < 6; k++) {
    const f = k / 5, off = 60 + f * 380;
    const g = [[-420 + off * .5, -6], [-280 + off * .8, -70 * r * (1 - f * .5)], [-140 + off, -230 * r * (1 - f * .45)], [-50 + off * .9, -440 * r * (1 - f * .4)], [off * .75, -580 * r * (1 - f * .35)]];
    draw(L, mk(cr(g, 3).map(T), { w: 2.6 * s, tone: .8, dry: .6, wet: .2, prof: 'tip', seed: 400 + k }), 1, am * .8);
  }
  // 水沫：浪头上方的墨点
  const n = Math.round(46 * W.c);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI, d = 30 + R() * 160;
    const px = W.crest[0] - 120 + Math.cos(a) * d * 1.4 + Math.sin(t * 2 + i) * 6, py = W.crest[1] - Math.sin(a) * d * .8 - 20 + Math.cos(t * 1.7 + i) * 5;
    const p = T([px, py]); blot(L.wet, p[0], p[1], (2 + R() * 7) * s, .75 * am, R() * 3, .7 + R() * .3, i);
  }
  return W;
}
