// 图纸家具：图框、页眉、标题栏、零件表、注释栏；修订云线 ↔ 云；雨与水渍；手影；印章。
import { g, f, S, line, knock, fillV, hatch, circ, rect, xf, text, textW, LW, FONT, TAU, cam, lw, fxShadow, fxWet, fxUnshadow, camMatrix } from './draw.js';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
export const SW = 3200, SH = 2200;
const MASK = document.createElement('canvas'); MASK.width = 1920; MASK.height = 1080;
const MASK2 = document.createElement('canvas'); MASK2.width = 1920; MASK2.height = 1080;
const stag = (P, i, n, span = .4) => clamp((P - (i / Math.max(1, n)) * (1 - span)) / span);

export function border(u = 1) {
  line(rect(46, 46, SW - 46, SH - 46), { w: LW.hair, closed: true, u: stag(u, 0, 3) });
  line(rect(80, 80, SW - 80, SH - 80), { w: LW.out * 1.3, closed: true, u: stag(u, 1, 3) });
  const uz = stag(u, 2, 3);
  for (let i = 1; i < 8; i++) { const x = 80 + (SW - 160) * i / 8; line([[x, 46], [x, 80]], { w: LW.hair, u: uz, nib: false }); line([[x, SH - 80], [x, SH - 46]], { w: LW.hair, u: uz, nib: false }); }
  for (let i = 1; i < 5; i++) { const y = 80 + (SH - 160) * i / 5; line([[46, y], [80, y]], { w: LW.hair, u: uz, nib: false }); line([[SW - 80, y], [SW - 46, y]], { w: LW.hair, u: uz, nib: false }); }
  if (uz > .5) {
    for (let i = 0; i < 8; i++) { const x = 80 + (SW - 160) * (i + .5) / 8; text(String(8 - i), x, 73, { size: 22, align: 'center', font: FONT.tech, v: .8 }); text(String(8 - i), x, SH - 55, { size: 22, align: 'center', font: FONT.tech, v: .8 }); }
    for (let i = 0; i < 5; i++) { const y = 80 + (SH - 160) * (i + .5) / 5 + 8; text('EDCBA'[i], 63, y, { size: 22, align: 'center', font: FONT.tech, v: .8 }); text('EDCBA'[i], SW - 63, y, { size: 22, align: 'center', font: FONT.tech, v: .8 }); }
  }
}
export function header(u = 1, u2 = 1) {
  text('THE CLOUD CATCHER', 170, 250, { size: 132, font: FONT.hand, ls: 14, u });
  const w = textW('THE CLOUD CATCHER', 132, FONT.hand, 14);
  line([[170, 282], [170 + w, 282]], { w: LW.out, u: u2 });
  line([[170, 292], [170 + w, 292]], { w: LW.hair, u: u2 });
  text('PATENT PENDING', 172, 340, { size: 40, font: FONT.tech, weight: 700, ls: 8, u: clamp(u2 * 2) });
  text('APPARATUS FOR THE CAPTURE OF CLOUDS & THE IRRIGATION OF ONE (1) SMALL GARDEN', 172, 382, { size: 25, font: FONT.tech, ls: 2, u: clamp(u2 * 2 - 1), v: .9 });
}
// 标题栏：T = {u, status ('pending'|'works'), sign(0-1), last(0-1)}
export const TB = { x0: 2280, y0: SH - 480, x1: SW - 80, y1: SH - 80 };
export function titleBlock(o = {}) {
  const { x0, y0, x1, y1 } = TB, u = o.u ?? 1;
  const rows = [y0, y0 + 96, y0 + 176, y0 + 236, y0 + 310, y1];
  line(rect(x0, y0, x1, y1), { w: LW.out * 1.2, closed: true, u: stag(u, 0, 4) });
  for (let i = 1; i < rows.length - 1; i++) line([[x0, rows[i]], [x1, rows[i]]], { w: LW.det, u: stag(u, i, 6) });
  const cm = x0 + 470, c3a = x0 + 290, c3b = x0 + 560, c5 = x0 + 340;
  line([[cm, rows[1]], [cm, rows[2]]], { w: LW.det, u: stag(u, 2, 6) });
  line([[c3a, rows[2]], [c3a, rows[3]]], { w: LW.det, u: stag(u, 3, 6) }); line([[c3b, rows[2]], [c3b, rows[3]]], { w: LW.det, u: stag(u, 3, 6) });
  line([[c5, rows[4]], [c5, rows[5]]], { w: LW.det, u: stag(u, 4, 6) });
  const lab = (s, x, y) => text(s, x + 10, y + 20, { size: 14, font: FONT.tech, v: .75, u: clamp(u * 3 - 1.2), ls: 1.5 });
  lab('TITLE', x0, rows[0]); lab('INVENTOR', x0, rows[1]); lab('DATE', cm, rows[1]); lab('DWG. NO.', x0, rows[2]); lab('SCALE', c3a, rows[2]); lab('SHEET', c3b, rows[2]); lab('STATUS', x0, rows[3]);
  lab('STYLE', x0, rows[4]); lab('DRAWN BY', c5, rows[4]);
  const uv = clamp(u * 2 - 1);
  text('THE CLOUD CATCHER', x0 + 20, rows[0] + 76, { size: 54, font: FONT.hand, ls: 4, u: uv });
  text('25 SEPT. 1891', cm + 20, rows[1] + 64, { size: 32, font: FONT.hand, u: uv });
  text('CC-001', x0 + 20, rows[2] + 50, { size: 30, font: FONT.hand, u: uv });
  text('1 : 12', c3a + 20, rows[2] + 50, { size: 30, font: FONT.hand, u: uv });
  text('1 OF 1', c3b + 20, rows[2] + 50, { size: 30, font: FONT.hand, u: uv });
  text('PATENT PENDING', x0 + 22, rows[3] + 58, { size: 42, font: FONT.tech, weight: 700, ls: 6, u: uv });
  // 签名
  if ((o.sign ?? 1) > 0) text('Cornelius Wrenfield', x0 + 34, rows[1] + 66, { size: 50, font: FONT.sign, u: o.sign ?? 1 });
  text('C. WRENFIELD', x0 + 20, rows[1] + 30 + 42, { size: 16, font: FONT.tech, v: .7, u: 0 });
  // 最后一行（片尾卡）
  const ul = o.last ?? 0;
  if (ul > 0) {
    text('BLUEPRINT', x0 + 22, rows[4] + 60, { size: 38, font: FONT.tech, weight: 700, ls: 6, u: clamp(ul * 2) });
    text('LemoLab × Claude Opus 5.5', c5 + 20, rows[4] + 58, { size: 33, font: FONT.hand, u: clamp(ul * 2 - .8) });
  }
  return { rows, x0, x1 };
}
export const PARTS = [
  ['1', 'BASE PLATE', 'CAST IRON', '1'], ['2', 'GEAR HOUSING', 'CAST IRON', '1'], ['3', 'CRANK & GEAR TRAIN', 'BRASS', '4'], ['4', 'CLOUD GAUGE', 'BRASS, GLASS', '1'],
  ['5', 'BELLOWS', 'LEATHER', '1'], ['6', 'MAST', 'STEEL', '1'], ['7', 'DRIVE CHAIN', 'STEEL', '1'], ['8', 'HEAD', 'CAST IRON', '1'], ['9', 'BOOM', 'STEEL', '1'],
  ['10', "COUNTERWEIGHT (GRANDMOTHER'S IRON)", 'IRON', '1'], ['11', 'NET HOOP & NET', 'CANE, SILK', '1'], ['12', 'WEATHER VANE', 'TIN', '1'], ['13', 'GARDEN', 'SOIL', '1'],
];
export function partsList(u = 1) {
  const x0 = TB.x0, x1 = TB.x1, y1 = TB.y0 - 30, rh = 27, y0 = y1 - rh * (PARTS.length + 1);
  line(rect(x0, y0, x1, y1), { w: LW.det, closed: true, u: stag(u, 0, 3) });
  const cols = [x0 + 62, x1 - 250, x1 - 70];
  for (const c of cols) line([[c, y0], [c, y1]], { w: LW.hair, u: stag(u, 1, 3) });
  for (let i = 1; i <= PARTS.length; i++) line([[x0, y0 + rh * i], [x1, y0 + rh * i]], { w: LW.hair, u: stag(u, 1, 3), nib: false });
  const ut = stag(u, 2, 3);
  const hy = y0 + rh - 7;
  text('NO.', x0 + 10, hy, { size: 15, font: FONT.tech, u: ut, v: .8 }); text('DESCRIPTION', cols[0] + 10, hy, { size: 15, font: FONT.tech, u: ut, v: .8 });
  text('MATERIAL', cols[1] + 10, hy, { size: 15, font: FONT.tech, u: ut, v: .8 }); text('QTY', cols[2] + 10, hy, { size: 15, font: FONT.tech, u: ut, v: .8 });
  PARTS.forEach((r, i) => { const y = y0 + rh * (i + 2) - 7, uu = clamp(ut * 1.5 - i * .04);
    text(r[0], x0 + 30, y, { size: 19, font: FONT.hand, align: 'center', u: uu, nib: false }); text(r[1], cols[0] + 10, y, { size: 19, font: FONT.hand, u: uu, nib: false });
    text(r[2], cols[1] + 10, y, { size: 19, font: FONT.hand, u: uu, nib: false }); text(r[3], cols[2] + 30, y, { size: 19, font: FONT.hand, align: 'center', u: uu, nib: false }); });
  text('PARTS LIST', x0, y0 - 14, { size: 22, font: FONT.tech, weight: 700, ls: 3, u: ut });
}
// 注释栏：notes = [[text, u], ...]
export function wrap(str, size, maxW, font = FONT.hand) {
  const words = str.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (textW(t, size, font) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
export function notes(list, u = 1) {
  const x0 = TB.x0, y0 = 150;
  text('GENERAL NOTES', x0, y0, { size: 26, font: FONT.tech, weight: 700, ls: 3, u });
  line([[x0, y0 + 12], [x0 + 300, y0 + 12]], { w: LW.thin, u });
  const fixed = ['ALL DIMENSIONS IN MILLIMETRES.', 'DO NOT SCALE DRAWING.'];
  let y = y0 + 58, n = 1;
  const all = [...fixed.map(s => [s, u]), ...list];
  for (const [s, uu] of all) {
    if (uu <= 0) { n++; continue; }
    const ls = wrap(s.toUpperCase(), 25, 740);
    text(n + '.', x0, y, { size: 25, font: FONT.hand, u: clamp(uu * 4), nib: false });
    ls.forEach((l, i) => { text(l, x0 + 40, y + i * 34, { size: 25, font: FONT.hand, u: clamp(uu * ls.length - i) , nib: false }); });
    y += ls.length * 34 + 14; n++;
  }
}
// ——— 修订云线 → 云 ———
// 基准环：绕 (cx, cy) 的扁椭圆环，N 个扇贝
export function cloudLobes(cx, cy, rx, ry, pf, seed = 1) {
  const N = 15, L = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i / N * TAU + .12;
    const jit = 1 + .06 * Math.sin(i * 2.3 + seed);
    const fx = cx + Math.cos(a) * rx * jit, fy = cy + Math.sin(a) * ry * jit;
    const rs = (TAU * Math.hypot(rx, ry) / 1.414 / N) * .62;          // 扇贝半径
    // 鼓起后的位置：向中心收拢、上半部分更大（积云）
    const up = -Math.sin(a);                                          // 1 = 顶部
    const pfx = cx + Math.cos(a) * rx * .72, pfy = cy + Math.sin(a) * ry * (a > 0 && a < Math.PI ? .45 : .78) - 10;
    const rb = rs * (1.25 + .9 * Math.max(0, up) + .25 * Math.sin(i * 1.7 + seed)) + 8;
    const e = pf;
    L.push({ x: lerp(fx, pfx, e), y: lerp(fy, pfy, e), r: lerp(rs, rb, e), a, fx, fy, rs });
  }
  // 内部团块（鼓起时才出现）
  const inner = [[-.35, -.25, .55], [.1, -.4, .62], [.45, -.15, .5], [-.05, .05, .5]];
  for (const [ix, iy, ir] of inner) L.push({ x: cx + ix * rx, y: cy + iy * ry, r: ir * ry * Math.min(1, pf * 2.2) * (pf > .02 ? 1 : 0), inner: true });
  return L;
}
function lobeOutline(L, ringOnly) {
  // 每个圆上不在其它圆内的弧段
  const segs = [];
  for (let i = 0; i < L.length; i++) {
    const c = L[i]; if (c.r < 1) continue; let cur = [];
    for (let k = 0; k <= 72; k++) {
      const a = k / 72 * TAU, p = [c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r];
      let inside = false; for (let j = 0; j < L.length; j++) { if (j === i || L[j].r < 1) continue; if (Math.hypot(p[0] - L[j].x, p[1] - L[j].y) < L[j].r - .5) { inside = true; break; } }
      if (ringOnly && !inside) { // 平面修订云线：只要外侧的弧
        const dx = p[0] - c.x, dy = p[1] - c.y, ox = c.x - ringOnly[0], oy = c.y - ringOnly[1];
        if (dx * ox / (ringOnly[2] ** 2) + dy * oy / (ringOnly[3] ** 2) < 0) inside = true;
      }
      if (!inside) cur.push(p); else { if (cur.length > 1) { cur.c = c; segs.push(cur); } cur = []; }
    }
    if (cur.length > 1) segs.push(cur);
    for (const sg of segs) if (!sg.c) sg.c = c;
  }
  return segs;
}
// 画修订云线/云：o = {pf 鼓起 0-1, u 画出进度, lift 离纸 0-1, dark 雨云 0-1, t 时间（颤动）, ghost}
export function revCloud(cx, cy, rx, ry, o = {}) {
  const pf = o.pf ?? 0, u = o.u ?? 1, lift = o.lift ?? 0, dark = o.dark ?? 0, t = o.t ?? 0;
  const L = cloudLobes(cx, cy, rx, ry, pf, o.seed ?? 1);
  // 颤动（醒来）
  if (o.tremble) for (let i = 0; i < L.length; i++) { L[i].x += Math.sin(t * 31 + i * 1.3) * o.tremble * 2.2; L[i].y += Math.cos(t * 27 + i * 2.1) * o.tremble * 2.2; }
  if (pf <= 0.001) {
    // 纯修订云线：按扇贝逐个画出
    const N = 15; const segs = [];
    for (let i = 0; i < N; i++) {
      const a = L[i], b = L[(i + 1) % N];
      // 两个扇贝交点之间的外弧：用圆弧近似（从 a 的前一交点到后一交点）
      const pa = L[(i + N - 1) % N];
      const ang = (p, q) => Math.atan2(q.y - p.y, q.x - p.x);
      const a0 = ang(a, pa), a1 = ang(a, b);
      const nm = x => ((x % TAU) + TAU) % TAU;
      const span = nm(a1 - a0), out = nm(a.a - a0);
      let s0, s1; if (out < span) { s0 = a0 - .08; s1 = a0 + span + .08; } else { s0 = a0 + .08; s1 = a0 + span - TAU - .08; }
      const arc = []; for (let k = 0; k <= 16; k++) { const aa = s0 + (s1 - s0) * k / 16; arc.push([a.x + Math.cos(aa) * a.r, a.y + Math.sin(aa) * a.r]); }
      segs.push(arc);
    }
    segs.forEach((s, i) => line(s, { w: LW.det, u: clamp(u * N - i), v: o.v ?? 1 }));
    return { L, segs };
  }
  // 投影（离开纸面）
  const shx = lift * (20 + 45 * lift), shy = lift * (80 + 300 * lift);
  if (lift > 0) { f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'lighter'; f.filter = `blur(${(14 + 26 * lift) * cam.z}px)`; f.fillStyle = `rgba(255,0,0,${.5 * Math.min(1, lift * 2)})`; f.beginPath(); for (const c of L) if (c.r > 1) { const [sx, sy] = S(c.x + shx, c.y + shy); f.moveTo(sx + c.r * cam.z, sy); f.arc(sx, sy, c.r * cam.z * (1 + .05 * lift), 0, TAU); } f.fill(); f.filter = 'none'; }
  // 体积：半透明白色填充（被曝光的纸）+ 消隐背后的线
  for (const c of L) if (c.r > 1) { knock(circ(c.x, c.y, c.r, 40)); fxUnshadow(circ(c.x, c.y, c.r, 40)); }
  { g.setTransform(1, 0, 0, 1, 0, 0); const v = Math.round((.07 + .09 * pf - .04 * dark) * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); for (const c of L) if (c.r > 1) { const [sx, sy] = S(c.x, c.y); g.moveTo(sx + c.r * cam.z, sy); g.arc(sx, sy, c.r * cam.z, 0, TAU); } g.fill('nonzero'); }
  // 柔和体积：整朵云一个渐变（左上亮、右下暗），裁在团块并集里
  if (lift > 0) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath();
    for (const c of L) if (c.r > 1) { const [sx, sy] = S(c.x, c.y); g.moveTo(sx + c.r * cam.z, sy); g.arc(sx, sy, c.r * cam.z, 0, TAU); }
    g.clip(); g.globalCompositeOperation = 'lighter';
    const [hx, hy] = S(cx - rx * .3, cy - ry * .75), R = rx * 1.45 * cam.z, a = (.30 - .16 * dark) * Math.min(1, lift * 1.5);
    const gr = g.createRadialGradient(hx, hy, 0, hx, hy, R); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.55, `rgba(255,255,255,${a * .45})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
    // 每个外圈团块顶上一点柔光（只在上半部）
    for (const c of L) if (!c.inner && c.r > 4 && c.y < cy + ry * .1) { const [sx, sy] = S(c.x - c.r * .2, c.y - c.r * .35), rr = c.r * cam.z * .9; const g2 = g.createRadialGradient(sx, sy, 0, sx, sy, rr); g2.addColorStop(0, `rgba(255,255,255,${a * .35})`); g2.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = g2; g.beginPath(); g.arc(sx, sy, rr, 0, TAU); g.fill(); }
    g.restore(); g.globalCompositeOperation = 'source-over';
  }
  // 阴影（细线阴影法，光从左上来）：阴影区 = 云团并集 − 向左上平移的云团并集；离屏画布做遮罩
  {
    const m = MASK.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, 1920, 1080);
    m.fillStyle = '#fff'; m.beginPath();
    for (const c of L) if (c.r > 1) { const [sx, sy] = S(c.x, c.y); m.moveTo(sx + c.r * cam.z, sy); m.arc(sx, sy, c.r * cam.z, 0, TAU); }
    m.fill();
    m.globalCompositeOperation = 'destination-out'; m.beginPath();
    const k = .30 - .14 * dark;
    for (const c of L) if (c.r > 1) { const [sx, sy] = S(c.x - c.r * k * .75, c.y - c.r * k); m.moveTo(sx + c.r * cam.z * .98, sy); m.arc(sx, sy, c.r * cam.z * .98, 0, TAU); }
    m.fill();
    // 阴影线
    m.globalCompositeOperation = 'source-in';
    const hv = Math.round((.62 + .2 * dark) * 255), sp = lerp(9, 6.5, dark) * cam.z;
    m.strokeStyle = `rgb(${hv},${hv},${hv})`; m.lineWidth = lw(LW.hair); m.beginPath();
    for (let i = -1100; i < 1920; i += sp) { m.moveTo(i, 0); m.lineTo(i + 1080, 1080); }
    m.stroke();
    if (dark > .02) {   // 雨云：下半部交叉线
      m.globalCompositeOperation = 'source-over';
      const M2 = MASK2.getContext('2d'); M2.setTransform(1, 0, 0, 1, 0, 0); M2.globalCompositeOperation = 'source-over'; M2.clearRect(0, 0, 1920, 1080);
      M2.fillStyle = '#fff'; M2.beginPath();
      for (const c of L) if (c.r > 1) { const [sx, sy] = S(c.x, c.y); M2.moveTo(sx + c.r * cam.z, sy); M2.arc(sx, sy, c.r * cam.z, 0, TAU); }
      M2.fill();
      M2.globalCompositeOperation = 'destination-in';
      const [, ty] = S(cx, cy + ry * (.25 - .6 * dark)), [, by] = S(cx, cy + ry * 1.9);
      const gr = M2.createLinearGradient(0, ty, 0, by); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, `rgba(255,255,255,${Math.min(1, dark * 1.4)})`); gr.addColorStop(1, `rgba(255,255,255,${Math.min(1, dark * 1.4)})`);
      M2.fillStyle = gr; M2.fillRect(0, 0, 1920, 1080);
      M2.globalCompositeOperation = 'source-in'; M2.strokeStyle = 'rgb(150,150,150)'; M2.lineWidth = lw(LW.hair); M2.beginPath();
      const sp2 = lerp(12, 7, dark) * cam.z; for (let i = 0; i < 3000; i += sp2) { M2.moveTo(i, 0); M2.lineTo(i - 1080, 1080); }
      M2.stroke();
      m.drawImage(MASK2, 0, 0);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.drawImage(MASK, 0, 0); g.globalCompositeOperation = 'source-over';
  }
  // 轮廓：右下（背光）一侧加粗
  const segs = lobeOutline(L);
  for (const sg of segs) {
    line(sg, { w: LW.det * (1 + .2 * pf), v: 1 });
    const c = sg.c; let run = [];
    for (const p of sg) { const nx = (p[0] - c.x) / c.r, ny = (p[1] - c.y) / c.r; if (nx * .55 + ny * .83 > .25) run.push(p); else { if (run.length > 1) line(run, { w: LW.out * (1.1 + .5 * pf), v: 1 }); run = []; } }
    if (run.length > 1) line(run, { w: LW.out * (1.1 + .5 * pf), v: 1 });
  }
  // 内部团块的上沿弧线（体积）
  for (const c of L) if (c.inner && c.r > 4 && c.y < cy) line(circ(c.x, c.y, c.r, 30, Math.PI * 1.12, Math.PI * 1.7), { w: LW.thin, v: .6 * pf });
  return { L, segs };
}
// ——— 雨 ———
export function makeDrops(seed, n, box, t0, t1) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const D = [];
  for (let i = 0; i < n; i++) D.push({ t: t0 + (t1 - t0) * r(), x: box[0] + (box[2] - box[0]) * r(), y0: box[1], y1: box[3] - 40 + 140 * r(), v: 900 + 300 * r(), sz: .6 + .8 * r() });
  return D;
}
export function rain(D, t, o = {}) {
  for (const d of D) {
    const fall = (d.y1 - d.y0) / d.v, dt = t - d.t;
    if (dt < 0) continue;
    if (dt < fall) { const y = d.y0 + d.v * dt; line([[d.x, y - 30 * d.sz], [d.x, y]], { w: LW.thin, v: .85, nib: false }); }
    else {
      const k = dt - fall;
      if (k < .25) { const r = 6 + 40 * k; line(circ(d.x, d.y1, r, 12, Math.PI * 1.1, Math.PI * 1.9), { w: LW.hair, v: .8 * (1 - k / .25), nib: false }); }
      // 水渍
      if (!o.noWet) fxWet(d.x, d.y1, (14 + 30 * d.sz) * (1 - Math.exp(-k * 3)) + 4, .75);
    }
  }
}
// ——— 手影 + 笔 ———
export function handShadow(nx, ny, a = 1, rot = 0) {
  // 笔尖在 (nx, ny) 接触纸面；越高的部分影子偏移越大（光从左上来 → 影子向右下）
  if (a <= 0) return;
  const off = h => [nx + 34 * h, ny + 46 * h];
  const P = (x, y, h) => { const c = Math.cos(rot), s = Math.sin(rot); const [ox, oy] = off(h); return S(ox + c * x - s * y, oy + s * x + c * y); };
  f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'lighter'; f.lineCap = 'round';
  const cap = (x0, y0, h0, x1, y1, h1, r, al) => { const A = P(x0, y0, h0), B2 = P(x1, y1, h1); f.strokeStyle = `rgba(255,0,0,${al})`; f.lineWidth = r * 2 * cam.z; f.beginPath(); f.moveTo(A[0], A[1]); f.lineTo(B2[0], B2[1]); f.stroke(); };
  f.filter = `blur(${5 * cam.z}px)`;
  cap(0, 0, 0, 200, -330, 1.2, 7, .5 * a);                    // 笔
  f.filter = `blur(${11 * cam.z}px)`;
  const al = .42 * a;
  cap(38, -62, .5, 120, -128, .9, 15, al);                     // 食指
  cap(56, -40, .5, 150, -96, .9, 16, al);                      // 中指
  cap(72, -22, .5, 160, -64, .9, 15, al);                      // 无名指
  cap(24, -80, .6, 70, -160, .9, 14, al);                      // 拇指
  cap(150, -120, .9, 190, -150, 1, 62, al);                    // 手掌
  cap(200, -160, 1, 460, -300, 1.3, 58, al);                   // 手腕 / 前臂
  f.filter = 'none'; f.lineCap = 'butt';
}
// ——— 印章（fx B 通道）———
export function stamp(x, y, s, a, word = 'WORKS') {
  if (a <= 0) return;
  f.globalCompositeOperation = 'lighter';
  camMatrix(f, x, y, -.14);
  f.scale(s, s);
  f.strokeStyle = `rgba(0,0,255,${a})`; f.lineWidth = 9; f.strokeRect(-190, -62, 380, 124);
  f.lineWidth = 3; f.strokeRect(-176, -49, 352, 98);
  f.fillStyle = `rgba(0,0,255,${a})`; f.font = `700 86px ${FONT.tech}`; f.textAlign = 'center'; f.textBaseline = 'middle'; f.letterSpacing = '12px';
  f.fillText(word, 6, 4); f.letterSpacing = '0px';
  f.setTransform(1, 0, 0, 1, 0, 0);
}
// 云离开后纸上留下的"未曝光印子"：浅色斑 + 淡轮廓
export function revImprint(cx, cy, rx, ry, a = 1) {
  if (a <= 0) return;
  const L = cloudLobes(cx, cy, rx, ry, 0);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
  const v = Math.round(.05 * a * 255); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath();
  for (let i = 0; i < 15; i++) { const [sx, sy] = S(L[i].x, L[i].y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); } g.closePath();
  for (let i = 0; i < 15; i++) { const [sx, sy] = S(L[i].x, L[i].y); g.moveTo(sx + L[i].r * cam.z, sy); g.arc(sx, sy, L[i].r * cam.z, 0, TAU); }
  g.fill('nonzero'); g.globalCompositeOperation = 'source-over';
  revCloud(cx, cy, rx, ry, { pf: 0, u: 1, v: .26 * a });
}
