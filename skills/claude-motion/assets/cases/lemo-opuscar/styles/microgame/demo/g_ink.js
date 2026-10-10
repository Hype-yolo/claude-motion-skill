// 水墨画风（向 ink-wash 学：五色墨、湿/干两层、飞白、积墨、朱砂只用一点）——自写简化版
import { pass, canvas } from './glpass.js';
import { mulberry, vnoise, clamp, seg, eo, ss, lerp } from '/core/lib.js';
const TAU = Math.PI * 2;
export const [inkC, ix] = canvas();
export const TONE = { jiao: .96, nong: .82, zhong: .6, dan: .34, qing: .16 };

export function clearInk() { ix.setTransform(1, 0, 0, 1, 0, 0); ix.globalCompositeOperation = 'source-over'; ix.fillStyle = '#000'; ix.fillRect(0, 0, 1920, 1080); }
function resample(pts, step = 3) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay);
    let t = step - acc;
    while (t <= d) { out.push([ax + (bx - ax) * t / d, ay + (by - ay) * t / d]); t += step; }
    acc = d - (t - step);
  }
  out.push(pts[pts.length - 1]); return out;
}
// Catmull-Rom 细分
function spline(pts, n = 8) {
  if (pts.length < 3) return pts;
  const out = [], P = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < n; k++) {
    const t = k / n, a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2), t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map(j => .5 * ((2 * b[j]) + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3)));
  }
  out.push(pts[pts.length - 1]); return out;
}
const PROF = {
  brush: u => Math.min(1, u * 5) * (1 - .75 * u),
  tip: u => Math.sin(Math.PI * u) ** .7,
  even: u => Math.min(1, u * 12, (1 - u) * 12),
  nail: u => u < .15 ? .7 + u * 2 : 1 - .8 * (u - .15),
};
// 一笔：wet = 进湿层（会洇），否则进干层（飞白）；draw = 0..1 写到哪
export function stroke(pts, o = {}) {
  const g = ix, w = o.w || 10, tone = o.tone ?? TONE.nong, dry = o.dry ?? .2, seed = o.seed ?? 1;
  let P = resample(spline(pts, 10), 2.5);
  if (o.draw !== undefined) P = P.slice(0, Math.max(2, Math.floor(P.length * clamp(o.draw))));
  if (P.length < 2) return;
  const prof = PROF[o.prof || 'brush'], N = P.length, L = [], R = [];
  for (let i = 0; i < N; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, u = i / (N - 1);
    const ww = w * prof(u) * (1 + .18 * (vnoise(i * .07 + seed * 13) - .5)) * .5;
    L.push([P[i][0] + nx * ww, P[i][1] + ny * ww, nx, ny, ww]); R.push([P[i][0] - nx * ww, P[i][1] - ny * ww]);
  }
  g.save(); g.globalCompositeOperation = 'lighter';
  const ch = o.wet ? [255, 0, 0] : [0, 255, 0];
  const body = tone * Math.pow(1 - dry, 1.6);
  if (body > .01) {
    g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = N - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
    g.fillStyle = `rgba(${ch},${body})`; g.fill();
  }
  // 鬃毛轨迹
  const nb = Math.round(clamp(w / 3, 4, 40));
  const r = mulberry(seed * 977 + 3);
  for (let b = 0; b < nb; b++) {
    const off = (b / (nb - 1)) * 2 - 1, load = .6 + r() * .4, bs = r() * 100;
    const side = o.darkSide ? (off * o.darkSide > 0 ? 1.35 : .7) : 1;
    g.lineWidth = Math.max(1, w / nb * 1.25); g.strokeStyle = `rgba(${ch},${clamp(tone * load * side * (.35 + dry * .8))})`;
    g.beginPath(); let pen = false;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), gap = vnoise(i * .045 + bs) < dry * (.4 + u * .9) - (1 - load) * .1;
      const x = P[i][0] + L[i][2] * L[i][4] * off, y = P[i][1] + L[i][3] * L[i][4] * off;
      if (gap) { pen = false; continue; }
      if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}
// 墨团（不规则）：r 为半径，tone 为密度
export function blot(x, y, r, tone = .9, seed = 1, wet = true, rough = .28) {
  const g = ix; g.save(); g.globalCompositeOperation = 'lighter';
  g.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i++) { const a = i / n * TAU, k = 1 + rough * (vnoise(a * 2.2 + seed * 7) - .5) * 2 + .1 * (vnoise(a * 9 + seed) - .5); const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); g.fillStyle = wet ? `rgba(255,0,0,${tone})` : `rgba(0,255,0,${tone})`; g.fill(); g.restore();
}
// 喷溅：从 (x,y) 沿各方向甩出墨点，p = 0..1 进度
export function splatter(x, y, R, p, seed = 5, n = 60, tone = .9) {
  const r = mulberry(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.pow(r(), .6) * R, sz = (4 + r() * 22) * (1 - d / R * .6), dl = r() * .25;
    const q = eo(seg(p, dl, dl + .45));
    if (q <= 0) continue;
    const px = x + Math.cos(a) * d * q, py = y + Math.sin(a) * d * q;
    blot(px, py, sz * (.4 + .6 * q), tone, i + seed, true, .35);
    if (sz > 14 && q > .6) { stroke([[px, py], [px + Math.cos(a) * sz * 1.4, py + Math.sin(a) * sz * 1.4]], { w: sz * .5, tone, dry: .3, wet: true, prof: 'tip', seed: i }); }
  }
}
export function print(g, o = {}) { g.drawImage(pass('ink', inkC, { pageOff: o.off || [0, 0], layer: o.layer ? 1 : 0 }), 0, 0); }

// ───────── 水墨版 Dot：几笔写意（头盔一个淡墨圈，天线一点朱砂）─────────
// cx,cy = 头盔圆心，R = 头盔半径；face: 'calm' | 'ah' | 'ah2' | 'sneeze' | 'inked' | 'idea'
export function cadetInk(cx, cy, R, o = {}) {
  const k = R / 100, face = o.face || 'calm', sd = o.seed || 1;
  // 头盔：一笔淡墨圆环（两段，留口）
  const ring = (a0, a1, w, tone, dry, s) => { const pts = []; for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push([cx + Math.cos(a) * R * (1 + .015 * Math.sin(i)), cy + Math.sin(a) * R]); } stroke(pts, { w, tone, dry, wet: true, prof: 'brush', seed: s }); };
  ring(-2.6, 1.9, 16 * k, TONE.dan, .35, sd); ring(2.05, 3.55, 11 * k, TONE.dan, .5, sd + 1);
  // 高光：留白（不画）+ 一道干笔反光
  // 脸：一团清墨
  blot(cx, cy + 14 * k, 50 * k, TONE.qing * .45, sd + 2, true, .1);
  // 脸颊轮廓：一笔淡墨（左）+ 一笔更淡（右），下巴留口
  stroke([[cx - 56 * k, cy - 6 * k], [cx - 54 * k, cy + 30 * k], [cx - 34 * k, cy + 58 * k], [cx - 8 * k, cy + 66 * k]], { w: 7 * k, tone: TONE.dan, dry: .35, prof: 'brush', seed: sd + 20 });
  stroke([[cx + 56 * k, cy - 4 * k], [cx + 52 * k, cy + 32 * k], [cx + 30 * k, cy + 58 * k]], { w: 6 * k, tone: TONE.qing * 1.6, dry: .45, prof: 'brush', seed: sd + 21 });
  // 腮红：朱砂不用在这里，用极淡的湿墨点
  for (const s of [-1, 1]) blot(cx + s * 36 * k, cy + 36 * k, 11 * k, TONE.qing * .5, sd + 22 + s, true, .2);
  // 头发：浓墨湿团 + 丸子
  stroke([[cx - 58 * k, cy - 4 * k], [cx - 40 * k, cy - 50 * k], [cx + 10 * k, cy - 64 * k], [cx + 56 * k, cy - 36 * k], [cx + 60 * k, cy - 8 * k]], { w: 34 * k, tone: TONE.nong, dry: .15, wet: true, prof: 'tip', seed: sd + 3, darkSide: 1 });
  blot(cx - 4 * k, cy - 78 * k, 22 * k, TONE.nong, sd + 4, true, .2);
  // 眼
  const ey = cy + 6 * k;
  if (face === 'calm' || face === 'idea') { for (const s of [-1, 1]) blot(cx + s * 24 * k, ey, (face === 'idea' ? 9 : 7) * k, TONE.jiao, sd + 5 + s, false, .15); }
  if (face === 'ah' || face === 'ah2') { for (const s of [-1, 1]) stroke([[cx + s * 34 * k, ey - 2 * k], [cx + s * 14 * k, ey + (face === 'ah2' ? 4 : 1) * k]], { w: 6 * k, tone: TONE.jiao, dry: .2, prof: 'tip', seed: sd + 6 + s }); }
  if (face === 'sneeze') { for (const s of [-1, 1]) stroke([[cx + s * 34 * k, ey - 8 * k], [cx + s * 16 * k, ey], [cx + s * 34 * k, ey + 8 * k]], { w: 6 * k, tone: TONE.jiao, dry: .2, prof: 'even', seed: sd + 7 + s }); }
  // 眉
  if (face !== 'inked') for (const s of [-1, 1]) stroke([[cx + s * 36 * k, ey - (face === 'ah2' || face === 'sneeze' ? 26 : 20) * k], [cx + s * 14 * k, ey - (face === 'ah2' ? 18 : 22) * k]], { w: 7 * k, tone: TONE.nong, dry: .45, prof: 'brush', seed: sd + 8 + s });
  // 鼻：一笔；憋喷嚏时鼻翼张开
  if (face !== 'inked') {
    stroke([[cx + 2 * k, ey + 12 * k], [cx - 3 * k, ey + 26 * k], [cx + 5 * k, ey + 28 * k]], { w: 4 * k, tone: TONE.zhong, dry: .3, prof: 'tip', seed: sd + 9 });
    if (face === 'ah' || face === 'ah2' || face === 'sneeze') for (const s of [-1, 1]) blot(cx + s * 7 * k, ey + 28 * k, (face === 'ah2' ? 4.5 : 3.2) * k, TONE.nong, sd + 10 + s, false, .2);
  }
  // 嘴
  if (face === 'calm') stroke([[cx - 9 * k, ey + 44 * k], [cx + 9 * k, ey + 43 * k]], { w: 4 * k, tone: TONE.zhong, dry: .2, prof: 'tip', seed: sd + 11 });
  if (face === 'idea') blot(cx, ey + 44 * k, 5 * k, TONE.nong, sd + 11, false, .1);
  if (face === 'ah' || face === 'ah2') blot(cx, ey + 46 * k, (face === 'ah2' ? 11 : 8) * k, TONE.nong, sd + 12, true, .15);
  if (face === 'sneeze') blot(cx + 3 * k, ey + 48 * k, 16 * k, TONE.jiao, sd + 12, true, .2);
  // 身体：两笔负墨的宇航服肩线 + 领圈
  if (o.body !== false) {
    stroke([[cx - 70 * k, cy + 96 * k], [cx - 110 * k, cy + 130 * k], [cx - 140 * k, cy + 200 * k]], { w: 26 * k, tone: TONE.dan, dry: .4, wet: true, prof: 'brush', seed: sd + 13, darkSide: -1 });
    stroke([[cx + 70 * k, cy + 96 * k], [cx + 110 * k, cy + 130 * k], [cx + 140 * k, cy + 200 * k]], { w: 26 * k, tone: TONE.dan, dry: .4, wet: true, prof: 'brush', seed: sd + 14, darkSide: 1 });
    stroke([[cx - 72 * k, cy + 94 * k], [cx, cy + 108 * k], [cx + 72 * k, cy + 94 * k]], { w: 12 * k, tone: TONE.zhong, dry: .35, prof: 'even', seed: sd + 15 });
  }
  // 天线：一根干笔细线（朱砂球单独画在印章层）
  const top = cy - R;
  const aw = o.ant || 0;
  stroke([[cx, top + 4 * k], [cx + 2 * k + aw * 10 * k, top - 22 * k], [cx - 2 * k + aw * 20 * k, top - 44 * k]], { w: 4 * k, tone: TONE.nong, dry: .5, prof: 'even', seed: sd + 16 });
  return { ball: [cx + aw * 20 * k - 2 * k, top - 52 * k, 10 * k] };
}
// 朱砂（在墨之后用 2D 直接盖上去：唯一的颜色）
export function vermilion(g, x, y, r, seed = 1) {
  g.save(); g.fillStyle = '#b02e22'; g.globalAlpha = .92; g.beginPath();
  for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU, k = 1 + .12 * (vnoise(a * 3 + seed) - .5); i ? g.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k) : g.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k); }
  g.fill(); g.restore();
}
export function seal(g, x, y, s, txt = '05') {
  g.save(); g.translate(x, y); g.rotate(-.04);
  g.fillStyle = '#b02e22'; g.globalAlpha = .9; g.beginPath(); g.roundRect(-s / 2, -s / 2, s, s, s * .08); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.font = `${s * .62}px Titan`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, s * .04);
  g.restore();
}

// 灰尘：焦墨核 + 一圈干笔绒毛（会转）；后面拖一道飞白
export function dust(x, y, sc = 1, T = 0) {
  blot(x, y, 9 * sc, TONE.jiao, 91, false, .3);
  for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + T * 1.5, l = (14 + (i % 3) * 7) * sc; stroke([[x + Math.cos(a) * 5 * sc, y + Math.sin(a) * 5 * sc], [x + Math.cos(a + .3) * l, y + Math.sin(a + .3) * l]], { w: 3 * sc, tone: TONE.nong, dry: .3, prof: 'tip', seed: 93 + i }); }
  stroke([[x + 16 * sc, y - 6 * sc], [x + 60 * sc, y - 24 * sc], [x + 120 * sc, y - 16 * sc]], { w: 7 * sc, tone: TONE.dan, dry: .8, prof: 'tip', seed: 92 });
}
// 干笔写字（拟声字）：字形填进干层，由着色器的纸牙打散
export function brushText(txt, x, y, size, rot = 0, tone = .95, font = 'Titan') {
  ix.save(); ix.globalCompositeOperation = 'lighter'; ix.translate(x, y); ix.rotate(rot);
  ix.font = `${size}px ${font}`; ix.textAlign = 'center'; ix.textBaseline = 'middle';
  ix.fillStyle = `rgba(0,255,0,${tone})`; ix.fillText(txt, 0, 0);
  ix.restore();
}
// ───────── G2 DON'T SNEEZE!（本地时间 lt，0..4s，1 拍 = .5s；8fps 步进）─────────
export function sceneSneeze(g, lt, o = {}) {
  const T = o.step === false ? lt : Math.floor(lt * 8) / 8, B = .5;
  clearInk();
  const cx = 960, cy = 540, R = 300;
  // 表情时间线
  let face = 'calm';
  if (T >= 1.5) face = 'ah'; if (T >= 2.0) face = 'ah2'; if (T >= 2.5) face = 'sneeze';
  const inked = T >= 2.5;
  const ant = T >= 2.5 ? Math.sin((T - 2.5) * 22) * Math.exp(-(T - 2.5) * 2) * 1.2 : 0;
  const d = cadetInk(cx, cy, R, { face: inked ? 'sneeze' : face, seed: 3, ant });
  // 灰尘：焦墨点 + 飞白尾巴，从右上飘入，停在鼻尖前
  if (T >= .5 && T < 2.5) {
    const u = ss(seg(T, .5, 1.5)), wob = Math.sin(T * 5) * 12;
    const x = lerp(1500, cx + 60, u) + wob, y = lerp(160, cy + 70, u) + Math.cos(T * 4) * 10;
    dust(x, y, 1, T);
  }
  // 喷嚏：墨从嘴里喷出，糊满面罩内侧（裁在头盔圆里），再甩出画外
  if (inked) {
    const p = seg(T, 2.5, 3.0);
    ix.save(); ix.beginPath(); ix.arc(cx, cy, R - 6, 0, TAU); ix.clip();
    const q = eo(p);
    blot(cx + 10, cy + 150, 60 + 330 * q, .95, 21, true, .3);
    blot(cx - 150, cy - 60, 40 + 200 * eo(seg(p, .1, .9)), .9, 22, true, .35);
    blot(cx + 170, cy - 110, 30 + 190 * eo(seg(p, .15, 1)), .9, 23, true, .35);
    ix.restore();
    splatter(cx + 10, cy + 160, 900, p, 31, 70, .92);
    // 拟声字 ACHOO!：干笔大字斜着甩出来
    const pa = eo(seg(T, 2.5, 2.75));
    brushText('ACHOO!', cx + 520 - 80 * (1 - pa), cy - 330, 150 * (.6 + .4 * pa), -.12, .95 * pa);
    // 墨往下流
    if (T >= 3.0) for (let i = 0; i < 7; i++) { const x = cx - 260 + i * 85, len = 60 + 140 * seg(T, 3.0 + i * .04, 3.9); stroke([[x, cy + 180 + (i % 3) * 30], [x + 3, cy + 180 + (i % 3) * 30 + len]], { w: 14 - i % 3 * 3, tone: .9, dry: .05, wet: true, prof: 'nail', seed: 40 + i }); }
  }
  print(g);
  // 朱砂天线球 + 印章
  vermilion(g, d.ball[0], d.ball[1], d.ball[2] * 1.3, 4);
  seal(g, 1700, 760, 110, '05');
  // 墨里眨眼（喷嚏后）：两只白眼睛
  if (T >= 3.0) {
    const blink = (T >= 3.5 && T < 3.625);
    for (const s of [-1, 1]) {
      g.save(); g.fillStyle = '#f3ecdc'; g.beginPath();
      if (blink) g.ellipse(cx + s * 80, cy + 20, 34, 5, 0, 0, TAU); else g.ellipse(cx + s * 80, cy + 20, 34, 40, 0, 0, TAU);
      g.fill(); if (!blink) { g.fillStyle = '#141210'; g.beginPath(); g.arc(cx + s * 80 + 6, cy + 26, 14, 0, TAU); g.fill(); }
      g.restore();
    }
  }
}
