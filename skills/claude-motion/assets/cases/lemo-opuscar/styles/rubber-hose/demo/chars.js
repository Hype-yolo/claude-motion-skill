// chars.js — 橡皮管角色：马克杯（主角）、方糖，以及共用部件（派饼眼、嘴、白手套、大圆头鞋、橡皮管四肢、蒸汽）
// 所有坐标是角色局部坐标：原点 = 两脚之间的地面，y 向下为正（杯子高约 280）
import * as T from './toon.js';
import { clamp, lerp, TAU, hash } from '/core/lib.js';
const { shape, stroke, ell, arc, spline, noodle, quad, push, pop, translate, rotate, scale, transform, dot, tx, S } = T;

// 6 级灰 + 角色白
export const P = { white: '#FCFBF7', paper: '#F1EEE6', pale: '#E2DFD6', light: '#C8C5BC', mid: '#9A978F', dmid: '#6B6963', dark: '#3B3A37', ink: '#0E0D0C' };
const D2R = Math.PI / 180;

// ———————————————————— 工具 ————————————————————
// 沿中心线生成带宽度的闭合轮廓（渐细飘带：蒸汽、手指、毛巾边）
export function ribbon(c, w0, w1 = w0, caps = true) {
  const n = c.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push([c[i][0] - dy * w, c[i][1] + dx * w]); R.push([c[i][0] + dy * w, c[i][1] - dx * w]);
  }
  if (!caps) return [...L, ...R.reverse()];
  const e = c[n - 1], e2 = c[n - 2], s0 = c[0], s1 = c[1];
  const aE = Math.atan2(e[1] - e2[1], e[0] - e2[0]), aS = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]);
  return [...L, ...arc(e[0], e[1], w1 / 2, w1 / 2, aE + Math.PI / 2, aE - Math.PI / 2, 6), ...R.reverse(), ...arc(s0[0], s0[1], w0 / 2, w0 / 2, aS - Math.PI / 2, aS - Math.PI * 1.5, 6)];
}
// 多个形状的"并集描边"：先全部粗描，再全部填色 → 只剩外轮廓
export function union(list, fill, lw = S.lw) {
  const ps = list.map(pts => shape(pts, { stroke: false }));
  ps.forEach(p => T.outline(p, lw * 2));
  T.g.setTransform(1, 0, 0, 1, 0, 0); T.g.fillStyle = fill; ps.forEach(p => T.g.fill(p));
  return ps;
}
// 屏幕空间下在裁剪里画局部多边形
function fillLocal(pts, col) { const s = pts.map(p => tx(p[0], p[1])); const g = T.g; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col; g.beginPath(); g.moveTo(s[0][0], s[0][1]); for (const q of s) g.lineTo(q[0], q[1]); g.closePath(); g.fill(); }
// 圆角多边形（凸）
function roundPoly(pts, r) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ra = Math.min(r, la * .45), rc = Math.min(r, lc * .45);
    const p0 = [b[0] + (a[0] - b[0]) / la * ra, b[1] + (a[1] - b[1]) / la * ra], p1 = [b[0] + (c[0] - b[0]) / lc * rc, b[1] + (c[1] - b[1]) / lc * rc];
    out.push(...quad(p0, b, p1, 5));
  }
  return out;
}
function hull(ps) {
  const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ———————————————————— 部件 ————————————————————
// 派饼眼：白眼眶 + 大黑瞳孔（切掉一块三角"派"作高光）
// o = { lx, ly 视线 -1..1, lid 0..1 上眼皮, lidCol, type: open|wide|happy|squeeze|shut|sad, side: ±1 挤眼方向 }
export function pieEye(cx, cy, rx, ry, o = {}) {
  const type = o.type || 'open', lw = S.lw * (o.lwk ?? .85);
  if (type === 'happy') { stroke(arc(cx, cy + ry * .35, rx * .95, ry * .55, Math.PI * 1.08, Math.PI * 1.92, 14), lw * 1.25); return; }
  if (type === 'shut') { stroke(arc(cx, cy - ry * .15, rx * .95, ry * .4, Math.PI * .1, Math.PI * .9, 12), lw * 1.2); return; }
  if (type === 'squeeze') { const s = o.side ?? 1; stroke([[cx - rx * s, cy - ry * .6], [cx + rx * .8 * s, cy], [cx - rx * s, cy + ry * .6]], lw * 1.35); return; }
  const big = type === 'wide' ? 1.18 : 1;
  const eR = rx * big, eY = ry * big;
  const lx = clamp(o.lx ?? 0, -1, 1), ly = clamp(o.ly ?? 0, -1, 1);
  const pr = type === 'wide' ? .42 : .64, pry = type === 'wide' ? .48 : .74;
  const pcx = cx + lx * eR * (1 - pr) * .95, pcy = cy + ly * eY * (1 - pry) * .9 + eY * .05;
  shape(ell(cx, cy, eR, eY), {
    fill: P.white, lw, shade: () => {
      // 瞳孔：派饼形（缺一块朝右上的三角）
      const w0 = -100 * D2R, w1 = -40 * D2R, prx = eR * pr, pry2 = eY * pry, pts = [];
      const apx = pcx + Math.cos((w0 + w1) / 2) * prx * .16, apy = pcy + Math.sin((w0 + w1) / 2) * pry2 * .16;
      for (let i = 0; i <= 28; i++) { const a = w1 + i / 28 * (TAU - (w1 - w0)); pts.push([pcx + Math.cos(a) * prx, pcy + Math.sin(a) * pry2]); }
      pts.push([apx, apy]);
      fillLocal(pts, P.ink);
      if (o.lid) { const yl = cy - eY + o.lid * 2 * eY; fillLocal([[cx - eR * 1.2, cy - eY * 1.3], [cx + eR * 1.2, cy - eY * 1.3], [cx + eR * 1.2, yl + (o.lidTilt || 0) * eR], [cx - eR * 1.2, yl - (o.lidTilt || 0) * eR]], o.lidCol || P.white); }
    }
  });
  if (o.lid) { const yl = cy - eY + o.lid * 2 * eY, hw = Math.sqrt(Math.max(0, 1 - Math.pow((yl - cy) / eY, 2))) * eR; if (hw > 2) stroke([[cx - hw, yl - (o.lidTilt || 0) * hw], [cx + hw, yl + (o.lidTilt || 0) * hw]], lw * 1.05); }
}
// 眉毛：短粗弧线，type: up(惊) sad(八字) angry determined
export function brow(cx, cy, w, type, side = 1) {
  // side = -1 左眼 / +1 右眼；inner = 靠近鼻梁的一端
  const s = side, lw = S.lw * 1.15, ix = cx - s * w * .5, ox = cx + s * w * .5;
  if (type === 'up') stroke(arc(cx, cy + w * .5, w * .55, w * .4, Math.PI * 1.15, Math.PI * 1.85, 10), lw);
  else if (type === 'sad') stroke(quad([ix, cy - w * .36], [cx, cy - w * .14], [ox, cy + w * .06]), lw);
  else if (type === 'angry') stroke(quad([ix, cy + w * .14], [cx, cy - w * .06], [ox, cy - w * .3]), lw);
  else if (type === 'flat') stroke([[cx - w * .45, cy], [cx + w * .45, cy]], lw);
}
// 嘴：smile / grin / open / o / frown / wavy / pucker / beam / yawn / flat
export function mouth(cx, cy, w, type = 'smile', o = {}) {
  const lw = S.lw * .95, h = w * (o.open ?? .6);
  const tongue = (pts) => () => { fillLocal(pts, P.dmid); };
  if (type === 'smile') { stroke(quad([cx - w / 2, cy - w * .08], [cx, cy + w * .32], [cx + w / 2, cy - w * .08]), lw * 1.1); stroke(arc(cx - w / 2 - 2, cy - w * .08, w * .09, w * .09, Math.PI * .6, Math.PI * 1.4, 6), lw * .8); stroke(arc(cx + w / 2 + 2, cy - w * .08, w * .09, w * .09, -Math.PI * .4, Math.PI * .4, 6), lw * .8); return; }
  if (type === 'frown') { stroke(quad([cx - w / 2, cy + w * .12], [cx, cy - w * .22], [cx + w / 2, cy + w * .12]), lw * 1.1); return; }
  if (type === 'flat') { stroke([[cx - w * .4, cy], [cx + w * .4, cy + 2]], lw * 1.1); return; }
  if (type === 'pucker') { // 苦：皱成一团的小嘴 + 两道皱纹
    stroke(spline([[cx - w * .28, cy], [cx - w * .14, cy - w * .1], [cx, cy + w * .06], [cx + w * .14, cy - w * .1], [cx + w * .28, cy]], false, 6), lw * 1.1);
    stroke(arc(cx - w * .42, cy - w * .02, w * .1, w * .16, Math.PI * .55, Math.PI * 1.45, 6), lw * .7); stroke(arc(cx + w * .42, cy - w * .02, w * .1, w * .16, -Math.PI * .45, Math.PI * .45, 6), lw * .7); return;
  }
  if (type === 'wavy') { // 害怕：波浪形张嘴
    const top = [], bot = []; for (let i = 0; i <= 12; i++) { const u = i / 12, x = cx - w / 2 + u * w; top.push([x, cy - h * .25 + Math.sin(u * TAU * 2) * w * .05]); bot.push([x, cy + h * .35 + Math.sin(u * TAU * 2 + 1) * w * .05]); }
    shape([...top, ...bot.reverse()], { fill: P.ink, lw }); return;
  }
  if (type === 'o') { const r = w * .22; shape(ell(cx, cy + r * .2, r, r * 1.25 * (o.open ?? 1)), { fill: P.ink, lw, shade: tongue(ell(cx, cy + r * 1.25, r * .75, r * .55)) }); return; }
  if (type === 'bleh') { // 呸：张嘴 + 舌头耷拉出来
    mouth(cx, cy, w, 'open', { open: .45 });
    shape(spline([[cx - w * .16, cy + w * .14], [cx - w * .2, cy + w * .42], [cx, cy + w * .58], [cx + w * .2, cy + w * .42], [cx + w * .16, cy + w * .14]], true, 6), { fill: P.dmid, lw: lw * .9 });
    stroke([[cx, cy + w * .2], [cx, cy + w * .42]], lw * .6); return;
  }
  if (type === 'yawn') { const r = w * .3; shape(ell(cx, cy + r * .5, r, r * 1.5), { fill: P.ink, lw, shade: tongue(ell(cx, cy + r * 1.6, r * .8, r * .6)) }); return; }
  // grin / open / beam：上沿微弯、下沿大 U
  const up = type === 'beam' ? .1 : (type === 'grin' ? .04 : -.02);
  const pts = [...quad([cx - w / 2, cy - w * up], [cx, cy + w * (up * .6)], [cx + w / 2, cy - w * up], 10), ...quad([cx + w / 2, cy - w * up], [cx, cy + h * 1.55], [cx - w / 2, cy - w * up], 14).slice(1)];
  shape(pts, {
    fill: P.ink, lw, shade: () => {
      fillLocal(ell(cx, cy + h * .95, w * .26, h * .42), P.dmid);
      if (type === 'grin' || type === 'beam') fillLocal([[cx - w / 2, cy - w * up - 20], [cx + w / 2, cy - w * up - 20], [cx + w / 2, cy + h * .18], [cx - w / 2, cy + h * .18]], P.white);
    }
  });
  if (type === 'grin' || type === 'beam') { stroke(arc(cx - w / 2 - 3, cy - w * up, w * .08, w * .1, Math.PI * .5, Math.PI * 1.5, 6), lw * .8); stroke(arc(cx + w / 2 + 3, cy - w * up, w * .08, w * .1, -Math.PI * .5, Math.PI * .5, 6), lw * .8); }
}

// 白手套：局部坐标中手腕在原点、手指朝 +x；type: open fist point grab wave thumb
export function glove(x, y, ang, type = 'open', k = 1, o = {}) {
  push(); translate(x, y); rotate(ang); scale(k, k * (o.flip ? -1 : 1));
  const fw = 13.5, parts = [];
  const finger = (a, len, w = fw, curl = 0) => { const b = [22 + Math.cos(a * D2R) * len, Math.sin(a * D2R) * len]; const c = [22 + Math.cos(a * D2R) * len * .55 + Math.cos((a + 90) * D2R) * curl, Math.sin(a * D2R) * len * .55 + Math.sin((a + 90) * D2R) * curl]; parts.push(ribbon(quad([22, 0], c, b, 8), w, w * .96)); };
  if (type === 'open' || type === 'wave') { finger(-34, 30); finger(-4, 33); finger(27, 29); finger(-88, 22, fw * 1.05); }
  else if (type === 'point') { finger(-6, 44, fw * .95); finger(-95, 18, fw * 1.05); }
  else if (type === 'grab') { finger(-26, 24, fw, 9); finger(2, 26, fw, 9); finger(28, 22, fw, 9); finger(-88, 19, fw * 1.05); }
  else if (type === 'thumb') { finger(-90, 26, fw * 1.1); }
  else if (type === 'fist') { finger(-90, 14, fw * 1.1); }
  const palmR = type === 'fist' || type === 'point' || type === 'thumb' ? 19 : 17;
  parts.push(ell(22, 0, palmR, palmR * .95, 26));
  const cuff = spline([[-6, -12], [4, -20], [11, -15], [11, 15], [4, 20], [-6, 12], [-8, 0]], true, 5);
  union([...parts, cuff], P.white);
  // 手背缝线 + 袖口褶
  const lw = S.lw * .6;
  if (type !== 'fist' && type !== 'point' && type !== 'thumb') { for (const dy of [-6, 0, 6]) stroke([[14, dy * 1.1], [25, dy * 1.4]], lw, { boil: .5 }); }
  else { stroke(arc(30, 0, 9, 13, -1.2, 1.2, 8), lw); stroke([[31, -6], [38, -7]], lw); stroke([[31, 6], [38, 7]], lw); }
  stroke(quad([2, -16], [6, 0], [2, 16]), lw);
  pop();
}
// 大圆头鞋（黑）：局部坐标脚跟在原点，鞋尖朝 +x（dir = ±1）
export function shoe(x, y, dir = 1, k = 1, ang = 0) {
  push(); translate(x, y); rotate(ang); scale(dir * k, k);
  shape(spline([[-15, 0], [-17, -12], [-6, -19], [10, -21], [27, -18], [37, -8], [34, 3], [12, 5], [-8, 4]], true, 6), { fill: P.ink, lw: S.lw * .9 });
  shape(ell(22, -12, 7, 3.6, 12, 0), { fill: P.white, stroke: false, boil: .3 });
  pop();
}
// 橡皮管四肢：等粗软管（a→b，bend 为弯曲量）
export const hose = (a, b, bend, w, col = P.ink) => shape(noodle(a, b, bend, w, w), { fill: col, lw: S.lw * .8 });

// 蒸汽：从 (x,y) 往上的几缕；type: lazy bitter up heart sad none；t 驱动飘动
export function steam(x, y, type = 'lazy', t = 0, k = 1) {
  if (type === 'none') return;
  const lw = S.lw * .8, col = type === 'bitter' ? P.mid : P.white;
  if (type === 'sad') { // 一缕蒸汽像蔫了的花一样耷拉下来
    const c = spline([[x - 8 * k, y], [x - 14 * k, y - 42 * k], [x + 4 * k, y - 76 * k], [x + 36 * k, y - 70 * k], [x + 46 * k, y - 44 * k + Math.sin(t * 4) * 3 * k]], false, 6);
    shape(ribbon(c, 14 * k, 4 * k), { fill: col, lw }); return;
  }
  const wisps = type === 'heart' ? [] : [[-26, 0, .9], [2, .4, 1.1], [28, .8, .85]];
  for (const [dx, ph, sc] of wisps) {
    const c = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, hgt = 110 * sc * k;
      let px = x + dx * k, py = y - u * hgt;
      if (type === 'lazy') { px += Math.sin(u * 5 + t * 5 + ph * 7) * 10 * u * k; py += u * u * 30 * k; px += u * u * 22 * k * Math.sign(dx || 1); }
      if (type === 'bitter') { px += ((i % 4 < 2) ? 1 : -1) * 13 * k * (.5 + u); }
      if (type === 'blown') { px = x + dx * .4 * k - u * hgt * 1.1; py = y - u * 36 * k + Math.sin(u * 7 + t * 16 + ph * 5) * 7 * k * u + dx * .3 * k; }
      if (type === 'up') { px += Math.sin(i * 2.7 + t * 30) * 2 * k; py -= u * 20 * k; }
      if (type === 'sad') { const sd = dx > 5 ? 1 : dx < -5 ? -1 : 0; px = x + dx * .6 * k + sd * Math.sin(u * 2.2) * 46 * k * sc + (sd ? 0 : Math.sin(u * 4) * 6 * k); py = y - (sd ? Math.sin(u * 2.6) * 44 : u * 50) * k * sc; }
      c.push([px, py]);
    }
    const pts = type === 'bitter' ? c.filter((_, i) => i % 2 === 0) : spline(c.filter((_, i) => i % 2 === 0), false, 5);
    shape(ribbon(pts, (type === 'bitter' ? 16 : 13) * k, (type === 'bitter' ? 5 : 3) * k), { fill: col, lw });
  }
  if (type === 'heart') {
    // 两缕蒸汽从杯口升起，在顶上卷成一颗心
    const hy = y - 95 * k, r = 26 * k;
    const L = [[x, y - 4 * k], [x - 8 * k, y - 30 * k], [x - 34 * k, hy + 34 * k], [x - 2 * r, hy], [x - r * 1.4, hy - r * 1.05], [x - r * .4, hy - r * .95], [x, hy - r * .35]];
    const R = L.map(p => [2 * x - p[0], p[1]]);
    shape(ribbon(spline(L, false, 6), 12 * k, 8 * k), { fill: P.white, lw });
    shape(ribbon(spline(R, false, 6), 12 * k, 8 * k), { fill: P.white, lw });
  }
}

// ———————————————————— 马克杯 ————————————————————
export const MUG = { R: 104, y0: -70, y1: -250, leg: 70 };
// p: { x, y, k 缩放, turn(°, +右), mirror, sx, sy 压扁拉伸, lean(rad), shake,
//      armL/armR: { x,y, hand, rot, bend, front }, legL/legR: { x,y, bend, ang }, eyes:{type,lx,ly,lid,side}, mouth:{type,open,w}, brows, steam, t, sooty, inCup(fn) }
export function mug(p) {
  const { R, y0, y1 } = MUG, th = (p.turn || 0) * D2R;
  push(); translate(p.x, p.y); if (p.mirror) scale(-1, 1); scale(p.k || 1);
  translate(0, 0); scale(p.sx || 1, p.sy || 1); if (p.lean) rotate(p.lean);
  const hipY = y0 + 6;
  // 腿与鞋
  const legs = [['legL', -1], ['legR', 1]];
  for (const [key, s] of legs) {
    const L = p[key] || { x: s * 36, y: 0 };
    hose([s * 30, hipY], [L.x, L.y - 8], L.bend ?? s * 4, 14);
  }
  for (const [key, s] of legs) { const L = p[key] || { x: s * 36, y: 0 }; shoe(L.x - (L.dir ?? (p.turn ? 1 : s)) * 6, L.y, L.dir ?? (Math.abs(p.turn || 0) > 20 ? 1 : s), 1, L.ang || 0); }
  // 胳膊（身后）
  const shoulderY = -150, arm = (key, s) => {
    const A = p[key]; if (!A) return;
    const sh = [s * (R - 8), shoulderY];
    let ang;
    if (A.via) { const c = spline([sh, ...A.via, [A.x, A.y]], false, 10); shape(ribbon(c, 13, 13), { fill: P.ink, lw: S.lw * .8 }); const q = c[c.length - 3]; ang = A.rot ?? Math.atan2(A.y - q[1], A.x - q[0]); }
    else { hose(sh, [A.x, A.y], A.bend ?? s * -14, 13); ang = A.rot ?? Math.atan2(A.y - sh[1], A.x - sh[0]); }
    glove(A.x, A.y, ang, A.hand || 'open', A.hk || 1, { flip: A.flip ?? s < 0 });
  };
  for (const [key, s] of [['armL', -1], ['armR', 1]]) if (p[key] && !p[key].front) arm(key, s);
  // 杯把（背后，方位 −120°）
  const ha = th - 120 * D2R, hs = Math.sin(ha), hz = Math.cos(ha);
  const handle = () => {
    const pts = [], n = 18;
    for (let i = 0; i <= n; i++) { const u = i / n, a = u * Math.PI; const r = R + 2 + Math.sin(a) * 60, yy = lerp(-214, -118, (1 - Math.cos(a)) / 2) + Math.sin(a) * 6; pts.push([r * hs, yy]); }
    const P2 = shape(pts, { closed: false, stroke: false });
    const g = T.g; g.setTransform(1, 0, 0, 1, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
    const zk = T.zoom();
    g.strokeStyle = P.ink; g.lineWidth = 24 * zk + S.lw * 2; g.stroke(P2);
    g.strokeStyle = p.sooty ? P.dark : P.white; g.lineWidth = 24 * zk; g.stroke(P2);
    g.strokeStyle = P.light; g.lineWidth = 7 * zk; g.globalAlpha = .9; g.stroke(P2); g.globalAlpha = 1;
  };
  if (hz <= 0) handle();
  // 杯身
  const ry = 24, rb = R * .9;
  // 杯身 = 杯口椭圆后半（在上）+ 两侧直线 + 杯底前半
  const side = s => quad([s * R, y1], [s * R * 1.1, (y1 + y0) / 2], [s * rb, y0 - 6], 12);
  const outline = [...arc(0, y1, R, ry, Math.PI, TAU, 24), ...side(1).slice(1), ...arc(0, y0 - 6, rb, ry * .95, 0, Math.PI, 24).slice(1), ...side(-1).reverse().slice(1)];
  const bodyCol = p.sooty ? P.dark : P.white;
  shape(outline, {
    fill: bodyCol, shade: () => {
      // 右侧硬边暗面（光从左上来）
      const sh = []; for (let i = 0; i <= 20; i++) { const u = i / 20, yy = lerp(y1, y0 + 20, u); sh.push([R * .6 + Math.sin(u * Math.PI) * 4, yy]); }
      fillLocal([...sh, [R + 20, y0 + 30], [R + 20, y1 - 30]], p.sooty ? P.ink : P.light);
      // 杯口两道环纹
      const band = (yy, w) => { const pts = arc(0, yy, R + 2, ry, 0, Math.PI, 24); stroke(pts, w, { boil: .6 }); };
      band(y1 + 17, S.lw * 1.9); band(y1 + 33, S.lw * .7);
      // 左侧一道高光竖条
    }
  });
  // 杯口 + 咖啡
  shape(ell(0, y1, R, ry, 40), { fill: bodyCol, lw: S.lw * .9 });
  shape(ell(0, y1 + 1.5, R - 11, ry - 6, 40), { fill: P.ink, lw: S.lw * .6 });
  shape(ribbon(arc(-8, y1 + 1, R - 26, ry - 11, Math.PI * 1.12, Math.PI * 1.55, 10), 3, 6), { fill: P.white, stroke: false, boil: .3 });
  if (p.inCup) { // 泡在咖啡里的东西：只露出水线以上，水线处一圈涟漪
    const g = T.g, wl = y1 + (p.waterline ?? 7); g.save(); const top = shape([[-R * 3, y1 - 600], [R * 3, y1 - 600], [R * 3, wl], [-R * 3, wl]], { stroke: false, boil: 0 }); g.setTransform(1, 0, 0, 1, 0, 0); g.clip(top); p.inCup(); g.restore();
    stroke(arc(0, wl - 2, 52, 9, Math.PI * .05, Math.PI * .95, 14), S.lw * .6, { line: P.mid }); }
  if (hz > 0) handle();
  // 脸（背面不画）
  const showFace = Math.cos(th) > -.25;
  const fx = R * .70 * Math.sin(th), fk = .56 + .44 * Math.cos(th), fy = -172;
  const sj = p.shake ? [Math.sin(p.t * 97) * p.shake, Math.cos(p.t * 83) * p.shake * .5] : [0, 0];
  push(); translate(sj[0], sj[1]);
  if (showFace) {
  const E = p.eyes || {}, eyeDX = 24 * fk, erx = 23 * (.7 + .3 * fk), ery = 33;
  const eyeFar = Math.abs(p.turn || 0) < 58;
  const sgn = Math.sin(th) >= 0 ? 1 : -1;
  const eyeL = [fx - eyeDX, fy], eyeR = [fx + eyeDX, fy];
  const lidCol = bodyCol;
  const drawEye = (c, side) => pieEye(c[0], c[1], erx, ery, { ...E, lx: (E.lx ?? 0), lidCol, side });
  if (eyeFar || sgn > 0) drawEye(eyeL, 1); else drawEye(eyeL, 1);
  if (eyeFar || sgn < 0) drawEye(eyeR, -1);
  if (p.brows) { brow(eyeL[0], fy - ery - 10, 32, p.brows, -1); if (eyeFar) brow(eyeR[0], fy - ery - 10, 32, p.brows, 1); }
  // 鼻子：黑色小圆
  const nx = fx + 14 * Math.sin(th) * 1.9, ny = fy + 36;
  shape(ell(nx, ny, 13 * (.8 + .2 * fk), 10, 18), { fill: P.ink, lw: S.lw * .6 });
  shape(ell(nx - 3, ny - 3, 3.2, 2.2, 10), { fill: P.white, stroke: false, boil: 0 });
  const M = p.mouth || { type: 'smile' };
  mouth(fx + 8 * Math.sin(th), fy + 62, (M.w || 66) * (.7 + .3 * fk), M.type, M);
  if (p.blush) { shape(ell(fx - eyeDX - 22, fy + 46, 12, 7), { fill: P.light, stroke: false, boil: .3 }); if (eyeFar) shape(ell(fx + eyeDX + 22, fy + 46, 12, 7), { fill: P.light, stroke: false, boil: .3 }); }
  }
  pop();
  // 胳膊（身前）
  for (const [key, s] of [['armL', -1], ['armR', 1]]) if (p[key] && p[key].front) arm(key, s);
  // 蒸汽
  if (p.steam !== 'none') steam(p.steamX || 0, y1 - 8, p.steam || 'lazy', p.t || 0);
  pop();
}

// ———————————————————— 方糖 ————————————————————
export const CUBE = { a: 66, leg: 28, e: .26 };
// p: { x,y,k, turn(°), sx, sy, lean, armL/armR, legL/legR, eyes, mouth, brows, sweat, towel, blush, hideBelow(y) }
export function cube(p) {
  const { a, e } = CUBE, legLen = p.legLen ?? CUBE.leg, th = (p.turn || 0) * D2R;
  push(); translate(p.x, p.y); if (p.mirror) scale(-1, 1); scale(p.k || 1); scale(p.sx || 1, p.sy || 1); if (p.lean) rotate(p.lean);
  const h = a / 2, ce = Math.cos(e), se = Math.sin(e), ct = Math.cos(th), st = Math.sin(th);
  const pr = (X, Y, Z) => { const x2 = X * ct + Z * st, z2 = -X * st + Z * ct; return [x2, -Y * ce + z2 * se - legLen]; };
  const V = [];
  for (const X of [-h, h]) for (const Y of [0, a]) for (const Z of [-h, h]) V.push({ X, Y, Z, p: pr(X, Y, Z) });
  const vi = (X, Y, Z) => V.find(v => v.X === X && v.Y === Y && v.Z === Z).p;
  // 面：法线（旋转后） → 可见性、明暗
  const F = [
    { n: 'front', N: [st, 0, ct], q: [[-h, a, h], [h, a, h], [h, 0, h], [-h, 0, h]] },
    { n: 'right', N: [ct, 0, -st], q: [[h, a, h], [h, a, -h], [h, 0, -h], [h, 0, h]] },
    { n: 'back', N: [-st, 0, -ct], q: [[h, a, -h], [-h, a, -h], [-h, 0, -h], [h, 0, -h]] },
    { n: 'left', N: [-ct, 0, st], q: [[-h, a, -h], [-h, a, h], [-h, 0, h], [-h, 0, -h]] },
    { n: 'top', N: [0, 1, 0], q: [[-h, a, -h], [h, a, -h], [h, a, h], [-h, a, h]] },
  ];
  const vis = F.filter(f => f.n === 'top' || f.N[2] > .02);
  const light = [-.55, .75, .45], tone = f => { const d = f.N[0] * light[0] + f.N[1] * light[1] + f.N[2] * light[2]; return d > .5 ? P.white : d > .05 ? P.pale : P.light; };
  // 腿、鞋
  for (const [key, s] of [['legL', -1], ['legR', 1]]) { const L = p[key] || { x: s * 15, y: 0 }; hose([s * 13, -legLen + 6], [L.x, L.y - 5], L.bend ?? s * 3, 8); }
  for (const [key, s] of [['legL', -1], ['legR', 1]]) { const L = p[key] || { x: s * 15, y: 0 }; shoe(L.x - 4 * (L.dir ?? s), L.y, L.dir ?? (Math.abs(p.turn || 0) > 20 ? 1 : s), .56, L.ang || 0); }
  // 胳膊（身后）
  const hl = hull(V.map(v => v.p)), xs = hl.map(q => q[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), midY = -legLen - a * .45 * ce;
  const arm = (key, s) => { const A = p[key]; if (!A) return; const sh = [s > 0 ? maxX - 5 : minX + 5, midY]; hose(sh, [A.x, A.y], A.bend ?? s * -8, 7.5); glove(A.x, A.y, A.rot ?? Math.atan2(A.y - sh[1], A.x - sh[0]), A.hand || 'open', A.hk ?? .52, { flip: A.flip ?? s < 0 }); };
  for (const [key, s] of [['armL', -1], ['armR', 1]]) if (p[key] && !p[key].front) arm(key, s);
  // 身体：圆角外轮廓 + 各面色块 + 糖晶点
  const sil = roundPoly(hl, 9);
  const faceAffine = (f) => { // 面局部 (u,v)∈[-1,1]² → 角色局部
    const c = f.q.map(q => pr(q[0], q[1], q[2]));
    const o = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2];
    const u = [(c[1][0] - c[0][0]) / 2, (c[1][1] - c[0][1]) / 2], v = [(c[3][0] - c[0][0]) / 2, (c[3][1] - c[0][1]) / 2];
    return [u[0], u[1], v[0], v[1], o[0], o[1]];
  };
  shape(sil, {
    fill: P.white, shade: () => {
      for (const f of vis) {
        fillLocal(f.q.map(q => pr(q[0], q[1], q[2])), tone(f));
        // 糖晶：细小的点
        const A = faceAffine(f); push(); transform(...A);
        for (let i = 0; i < 16; i++) { const u = hash(i * 3.1 + f.n.length * 7) * 1.7 - .85, v = hash(i * 5.7 + f.n.length * 3) * 1.7 - .85; const pt = tx(u, v); const g = T.g; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = f.n === 'top' ? P.light : P.mid; g.globalAlpha = .55; g.fillRect(pt[0] - 1.2, pt[1] - 1.2, 2.6, 2.4); g.globalAlpha = 1; }
        pop();
      }
    }
  });
  // 内棱线
  const edges = [];
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const A = vis[i].q, B = vis[j].q, sh = A.filter(q => B.some(r => r[0] === q[0] && r[1] === q[1] && r[2] === q[2]));
    if (sh.length === 2) edges.push(sh.map(q => pr(q[0], q[1], q[2])));
  }
  for (const [e0, e1] of edges) { const k0 = .12, a0 = [lerp(e0[0], e1[0], k0), lerp(e0[1], e1[1], k0)], a1 = [lerp(e0[0], e1[0], 1 - k0), lerp(e0[1], e1[1], 1 - k0)]; stroke([a0, a1], S.lw * .6, { boil: .6 }); }
  // 脸：画在"前面"那一面（front 不可见时不画）
  const front = vis.find(f => f.n === 'front');
  if (front && front.N[2] > .3) {
    push(); transform(...faceAffine(front));
    // 面局部单位 = 半边长；用 1/33 缩放得到"像素"坐标
    scale(1 / 33, 1 / 33);
    const E = p.eyes || {}, ex = 11.5, ey = -7;
    pieEye(-ex, ey, 10.5, 15, { ...E, lidCol: P.white, lwk: .7, side: 1 });
    pieEye(ex, ey, 10.5, 15, { ...E, lidCol: P.white, lwk: .7, side: -1 });
    if (p.brows) { brow(-ex, ey - 20, 15, p.brows, -1); brow(ex, ey - 20, 15, p.brows, 1); }
    const M = p.mouth || { type: 'smile' };
    mouth(0, 16, M.w || 25, M.type, M);
    if (p.blush !== false) { shape(ell(-21, 11, 5, 3), { fill: P.light, stroke: false, boil: .3 }); shape(ell(21, 11, 5, 3), { fill: P.light, stroke: false, boil: .3 }); }
    pop();
  }
  // 胳膊（身前）
  for (const [key, s] of [['armL', -1], ['armR', 1]]) if (p[key] && p[key].front) arm(key, s);
  // 汗滴
  if (p.sweat) for (const [sx, sy, r] of p.sweat) shape(spline([[sx, sy - r * 1.6], [sx + r, sy], [sx, sy + r], [sx - r, sy]], true, 5), { fill: P.white, lw: S.lw * .6 });
  // 小毛巾（泡澡）
  if (p.towel) {
    const ty = -legLen - a * ce - h * se + 2;
    shape(spline([[-30, ty + 4], [-20, ty - 9], [0, ty - 13], [20, ty - 9], [31, ty + 3], [24, ty + 11], [0, ty + 5], [-22, ty + 12]], true, 6), { fill: P.white, shade: () => { for (const dx of [-15, -6]) stroke([[dx, ty - 11], [dx + 3, ty + 9]], S.lw * 1.0, { line: P.mid }); } });
  }
  pop();
}
