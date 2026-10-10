// "水"字：以 OFL 楷书字体 Ma Shan Zheng 的字形做骨架。
// 四笔中线（竖钩、横撇、撇、捺）按字形描出，笔压对应字形粗细；笔触引擎按笔顺逐笔写，最后用字形轮廓（略外扩）裁边，
// 于是笔顺、提按、飞白来自引擎，字的结构与重心来自书法字形。坐标在 100×100 字格内，第三个数是笔压。
import { mk, draw, TONE } from './ink.js';
import { lerp, clamp } from '/core/lib.js';

export const SHUI = [
  // 竖钩：藏锋起笔，中段略提，底部蓄力后向左上出钩
  [[42.5, 7.5, .7], [44.5, 9.5, 1.1], [44.8, 18, .95], [45, 38, .9], [45.3, 58, .92], [45.4, 76, 1.0], [44, 87, 1.12], [40.5, 90.5, 1.0], [35, 84, .7], [29, 76.5, .25]],
  // 横撇：切笔入，短横右上行，转折处顿笔，撇向左下出锋
  [[12, 53, .6], [16, 49, .9], [24, 45.5, .85], [32, 42.5, .95], [37.5, 42.5, 1.15], [37.5, 49, 1.05], [33, 60, .95], [26, 70, .8], [17, 80, .55], [8, 87.5, .18]],
  // 撇：右上起笔，向左下
  [[74.5, 26.5, .8], [74, 31, 1.05], [68, 38, .9], [60, 44.5, .72], [53.5, 48.5, .5]],
  // 捺：轻起，渐重，捺脚平出
  [[53, 48, .45], [58, 55, .62], [66, 63, .82], [74.5, 69.5, 1.0], [83, 74.5, 1.22], [90, 77, 1.05], [95.5, 77.5, .3]],
];
const WID = [8.2, 8.4, 8.5, 11];       // 各笔基准宽（字格单位）

// 字形蒙版（与 box 对齐）
const maskCache = {};
export function glyphMask(box, W = 1920, H = 1080) {
  const key = box.join(',');
  if (maskCache[key]) return maskCache[key];
  const [x0, y0, S] = box, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.font = `${S}px MaShanZheng`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const m = c.measureText('水'), y = y0 + S / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  c.fillStyle = '#000'; c.fillText('水', x0 + S / 2, y);
  c.strokeStyle = '#000'; c.lineWidth = S * .014; c.lineJoin = 'round'; c.strokeText('水', x0 + S / 2, y);   // 略外扩，给飞白的毛边留一点
  return (maskCache[key] = cv);
}

export function shuiStrokes(box, o = {}) {
  const [x0, y0, sz] = box, k = sz / 100;
  return SHUI.map((st, i) => mk(st.map(p => [x0 + p[0] * k, y0 + p[1] * k, p[2]]), {
    w: WID[i] * k * (o.wk ?? 1.12), tone: TONE.jiao, dry: o.dry ?? .17, wet: o.wet ?? .35, prof: 'even', rough: .06, nb: 48, solid: true, seed: (o.seed ?? 51) * 10 + i,
  }));
}

// 断流：沿捺势出字，压平向右横扫出画（飞白）
export function cutStroke(box, x1, y1, o = {}) {
  const [x0, y0, sz] = box, k = sz / 100;
  const P = [[62, 59, .45], [70, 66.5, .7], [79, 72.5, .92], [88, 76.5, 1.02]].map(p => [x0 + p[0] * k, y0 + p[1] * k, p[2]]);
  const last = P[P.length - 1];
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    P.push([lerp(last[0], x1, u), lerp(last[1], y1, Math.pow(u, .55)) + Math.sin(u * 3.1) * 5 * k, 1.05 + .15 * Math.sin(u * 2.2) - .4 * Math.pow(u, 3)]);
  }
  return mk(P, { w: (o.w ?? 13) * k, tone: TONE.jiao, dry: o.dry ?? .62, wet: .15, prof: 'even', rough: .16, nb: 64, solid: true, seed: o.seed ?? 777 });
}

// 按进度写字：prog[i] ∈ [0,1] 为第 i 笔写到哪；T 为临时层 {wet,dry,col 上下文 + 画布}；写完用字形裁边再贴到目标层
export function writeShui(dst, T, box, prog, o = {}) {
  const S = o.strokes || shuiStrokes(box, o);
  for (const c of [T.ink.wet, T.ink.dry]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, T.wet.width, T.wet.height); }
  let any = false;
  S.forEach((s, i) => { if ((prog[i] ?? 0) > 0) { draw(T.ink, s, prog[i], o.am ?? 1); any = true; } });
  if (!any) return S;
  const mask = glyphMask(box, T.wet.width, T.wet.height);
  for (const key of ['wet', 'dry']) {
    const c = T.ink[key]; c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-over';
    const d = dst[key]; d.save(); d.setTransform(1, 0, 0, 1, 0, 0); if (o.dx || o.dy || o.alpha != null) { d.globalAlpha = o.alpha ?? 1; } d.drawImage(T[key], o.dx || 0, o.dy || 0); d.restore();
  }
  return S;
}

// 剑尖位置：第 i 笔写到 p 时笔尖所在（给侠客的手臂瞄准）
export function tipAt(S, i, p) {
  const s = S[i], m = (s.n - 1) * clamp(p), k = Math.floor(m), f = m - k, a = s.P[k], b = s.P[Math.min(s.n - 1, k + 1)];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
}
