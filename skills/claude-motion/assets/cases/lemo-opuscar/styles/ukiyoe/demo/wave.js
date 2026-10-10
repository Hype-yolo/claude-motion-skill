// 海与立起来的巨浪：普鲁士蓝浪身 + 流线条纹 + 白色浪沫带 + 浪爪
import { clamp, lerp, seg, ss, hash, mulberry, vnoise, TAU } from '/core/lib.js';
import { PAL, smooth, poly, dense, carve, rgba, mix, printTex } from './print.js';
import { claw } from './nature.js';

const HZ = 612;
// —— 远近排列的涌浪 ——
export function sea(x, tq, rise = 0, part = 'all') {
  for (let r = 0; r < 11; r++) {
    const u = r / 10, y = HZ + 12 + 440 * Math.pow(u, 1.55), sc = .22 + u * 1.25, wl = 230 * sc, amp = 20 * sc;
    if (part === 'far' && y >= 742) continue; if (part === 'near' && y < 742) continue;
    const drift = (tq * 22 * sc + r * 71) % wl;
    const pts = [];
    for (let X = -wl * 2 + drift; X < 1980 + wl; X += wl / 8) {
      const ph = ((X - drift) / wl) % 1, p = (ph + 1) % 1;
      // 尖顶的摆线形浪
      const yy = y - amp * Math.pow(Math.abs(Math.sin(p * Math.PI)), 3.2) + (rise * 30 * Math.exp(-Math.pow((X - 800) / 500, 2)) * u);
      pts.push([X, yy]);
    }
    const body = pts.concat([[2000, y + 180 * sc], [-300, y + 180 * sc]]);
    const g = x.createLinearGradient(0, y - amp, 0, y + 120 * sc); g.addColorStop(0, mix(PAL.prusL, PAL.prus, u * .6)); g.addColorStop(1, PAL.prus);
    x.fillStyle = g; x.beginPath(); poly(x, body); x.fill();
    // 浪身里的浅色流线
    x.strokeStyle = rgba(PAL.sky, .55); x.lineWidth = 1.2 + sc * 1.4;
    for (let k = 1; k <= 2; k++) { x.beginPath(); smooth(x, pts.map(([a, b]) => [a + k * 9 * sc, b + k * 11 * sc])); x.stroke(); }
    x.strokeStyle = PAL.prusD; x.lineWidth = 1.4 + sc * 1.3; x.beginPath(); smooth(x, pts); x.stroke();
    // 浪尖的小浪爪
    if (sc > 1.05) {
      for (let X = -wl * 2 + drift; X < 1980 + wl; X += wl) {
        const px = X + wl * .5, py = y - amp;
        if (px < -50 || px > 1970) continue;
        for (let k = 0; k < 2; k++) claw(x, px - 6 * sc + k * 10 * sc, py + 2, -1.7 + k * .5, 18 * sc, 8 * sc, .95, { lw: 1.4 + sc * .5 });
      }
    }
  }
}

// —— 巨浪的四拍状态（起浪 / 高悬 / 倒下 / 泡沫）——
export function wstate(t, T) {
  const rise = ss(seg(t, T.waveRise[0], T.waveRise[1])), hang = seg(t, T.hang[0], T.hang[1]);
  const fall = Math.pow(seg(t, T.fall[0], T.crash[1]), 1.5), hold = t >= T.hang[0] && t < T.fall[0] ? 1 : 0;
  return { rise, hang, fall, hold, open: .85 + .3 * ss(hang) };
}
// —— 巨浪几何（归一化：u 横向、v 高度，单位 = 浪高）——
export const B = 742, XC = 860;
const BACK = [[-1.05, 0], [-.66, .05], [-.4, .18], [-.21, .4], [-.1, .64], [-.02, .85], [.1, 1.0]];
const LIP = [[.26, 1.06], [.41, 1.03], [.53, .93], [.6, .8]];           // 浪头（前翻）
const CURL = [[.565, .72], [.48, .705], [.415, .76]];                    // 卷回的内缘
const FRONT = [[.37, .7], [.31, .55], [.305, .38], [.36, .2], [.48, .07], [.66, 0]];
const FRONT0 = [[.22, .88], [.29, .62], [.36, .38], [.45, .19], [.55, .07], [.66, 0]];
export function waveGeo(rise, crash = 0) {
  const h = 820 * Math.pow(rise, .9), sx = 820 * (.45 + .55 * rise), curl = ss(seg(rise, .38, 1));
  const P = ([u, v]) => [XC + u * sx, B - v * h];
  const crest = BACK[BACK.length - 1];
  // 碎浪：浪头绕浪顶向前下方旋转
  const rot = crash * 1.05, cr = Math.cos(rot), sr = Math.sin(rot);
  const ext = 1 + crash * .45;
  const R = ([u, v]) => { const du = (u - crest[0]) * curl * ext, dv = (v - crest[1]) * curl * ext; return [crest[0] + du * cr + dv * sr * .9, crest[1] - (du * sr - dv * cr) - crash * .12]; };
  const back = BACK.map(P), lip = LIP.map(q => P(R(q))), cu = CURL.map(q => P(R(q)));
  const front = FRONT.map((q, i) => { const a = FRONT0[i]; return P([lerp(a[0], q[0], curl), lerp(a[1], q[1], curl) - (i < 2 ? crash * .1 : 0)]); });
  return { h, sx, curl, back, lip, cu, front, top: back[back.length - 1], tip: lip[lip.length - 1] };
}
function offsetCurve(pts, d) {
  return pts.map((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)]; let dx = q[0] - o[0], dy = q[1] - o[1]; const L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * d, p[1] + dx / L * d]; });
}
// 浪身：沿背坡轮廓的 3 阶蓝带（浅蓝近浪顶 → 普鲁士蓝 → 深槽），带间 ぼかし；成组白色流线
const BL = '#6f95bb', BM = PAL.prus, BD = '#0f2344';
export function wave(x, t12, rise, crash = 0) {
  if (rise <= 0.001) return null;
  const G = waveGeo(rise, crash), { h, curl, back, lip, cu, front } = G;
  const outline = back.concat(curl > .03 ? lip.concat(cu) : [], front);
  x.save(); x.beginPath(); smooth(x, outline, false); x.closePath(); x.clip();
  x.fillStyle = BD; x.fillRect(-500, B - h - 600, 3000, h + 800);
  const ridge = dense(back.concat(curl > .03 ? lip.slice(0, 2) : []), 7), sc = .4 + .6 * rise;
  // 三阶蓝带：浅蓝（近浪顶）→ 普鲁士蓝 → 深槽；带间用 3 条过渡色做 ぼかし
  const bands = [[0, BL], [70, BL], [100, mix(BL, BM, .5)], [125, BM], [230, BM], [262, mix(BM, BD, .5)], [290, BD]];
  for (let k = bands.length - 1; k >= 0; k--) {
    const [d, col] = bands[k], d2 = k ? bands[k - 1][0] : 0;
    x.strokeStyle = col; x.lineWidth = Math.max(8, (d - d2 + 14) * sc) * 2; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); smooth(x, offsetCurve(ridge, (d + d2) / 2 * sc)); x.stroke();
  }
  for (let k = bands.length - 1; k >= 0; k--) { const [d, col] = bands[k]; x.strokeStyle = col; x.lineWidth = 60 * sc; x.beginPath(); smooth(x, offsetCurve(ridge, d * sc)); x.stroke(); }
  x.fillStyle = BL; x.beginPath(); smooth(x, ridge.concat(offsetCurve(ridge, 40 * sc).reverse()), true); x.fill();
  // 成组流线：5 组 × 3 根，沿水流方向的长弧，偶有断口
  const R = mulberry(5), ridgeB = dense(back, 7);
  for (let gI = 0; gI < 5; gI++) {
    const base = [34, 88, 150, 205, 300][gI] * sc;
    for (let j = 0; j < 3; j++) {
      const c = offsetCurve(gI >= 2 ? ridgeB : ridge, base + j * 8 * sc), L = c.length;
      x.strokeStyle = rgba(PAL.white, gI < 2 ? .9 : gI < 4 ? .7 : .45); x.lineWidth = (j === 1 ? 3 : 2) * (.6 + .4 * sc);
      let i = Math.floor(R() * 6) + j * 2;
      while (i < L - 3) { const len = 16 + Math.floor(R() * 24); x.beginPath(); smooth(x, c.slice(i, Math.min(L, i + len))); x.stroke(); i += len + 2 + Math.floor(R() * 4); }
    }
  }
  // 浪腹空腔（浪头下）更深
  if (curl > .05) {
    const cav = [G.top].concat(lip.slice(1), cu, front.slice(0, 3));
    x.fillStyle = rgba('#081a36', .7 * curl); x.beginPath(); smooth(x, offsetCurve(cav, -6), true); x.fill();
    x.strokeStyle = rgba(BL, .5); x.lineWidth = 2; for (let k = 1; k < 4; k++) { x.beginPath(); smooth(x, offsetCurve(cu.concat(front.slice(0, 4)), -k * 20)); x.stroke(); }
  }
  printTex(x, .14, .2, 0, 0);
  x.restore();
  x.fillStyle = BD; carve(x, back, 4.2, { taper: [.08, .02], seed: 2 }); carve(x, front, 3.6, { taper: [.02, .2], seed: 3 });
  return G;
}
// 分形浪爪：大爪在中段分出 2–3 个小爪，小爪再分叉；爪尖向内勾
export function fclaw(x, bx, by, ang, len, wid, curl, depth, st, R) {
  const n = 12, split = depth > 0 ? .55 + R() * .15 : 1, sp = [[bx, by]]; let a = ang, px = bx, py = by;
  const cv = depth === 2 ? curl * .3 : depth === 1 ? curl * .75 : curl * 1.25;
  const angAt = s => ang + cv * Math.pow(s, 2.2) * 3.2;
  for (let i = 1; i <= n; i++) { const s = i / n * split; a = angAt(s); px += Math.cos(a) * len * split / n; py += Math.sin(a) * len * split / n; sp.push([px, py]); }
  const Lp = [], Rp = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n * split, q = sp[i], q2 = sp[Math.min(n, i + 1)], q1 = sp[Math.max(0, i - 1)];
    let dx = q2[0] - q1[0], dy = q2[1] - q1[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wid * .5 * (depth === 2 ? (s < .16 ? .4 + s / .16 * .6 : 1 - (s - .16) * .6) : depth > 0 ? (1 - s * .55) : (s < .2 ? .8 + s : Math.pow((1 - s) / .8, .9)));
    Lp.push([q[0] - dy * w, q[1] + dx * w]); Rp.push([q[0] + dy * w, q[1] - dx * w]);
  }
  const ol = Lp.concat(Rp.reverse());
  x.fillStyle = st.fill; x.beginPath(); poly(x, ol); x.fill();
  x.strokeStyle = st.ink; x.lineWidth = st.lw * (depth > 0 ? 1 : .85); x.lineJoin = 'round'; x.beginPath(); poly(x, ol); x.stroke();
  if (depth > 0) {
    const kids = depth === 2 ? 3 : 2 + (R() < .5 ? 1 : 0), aS = angAt(split);
    for (let k = 0; k < kids; k++) {
      const off = (k - (kids - 1) / 2) * .5 + .2 + (R() - .5) * .15;
      fclaw(x, px, py, aS + off, len * (.62 + R() * .14), wid * .66, curl * (1.1 + R() * .3), depth - 1, st, R);
    }
    x.fillStyle = st.fill; x.beginPath(); x.arc(px, py, wid * .5 * .48, 0, TAU); x.fill();
  }
}
// 浪沫带 + 两层分形浪爪 + 成簇飞沫（可越过画框）
export function foam(x, G, t12, rise, crash = 0, st0 = {}) {
  if (!G || G.curl <= .03) return;
  const { h, curl, back, lip, cu } = G;
  const crest = [back[4], back[5], back[6]].concat(lip, cu);
  const cd = dense(crest, 7), N = cd.length;
  const wBand = i => (12 + 24 * Math.sin(clamp(i / (N - 1)) * Math.PI * .95) * curl) * (i < N * .15 ? i / (N * .15) : 1);
  const inner = cd.map((p, i) => { const q = cd[Math.min(N - 1, i + 1)], o = cd[Math.max(0, i - 1)]; let dx = q[0] - o[0], dy = q[1] - o[1]; const L = Math.hypot(dx, dy) || 1, w = wBand(i); return [p[0] - dy / L * w, p[1] + dx / L * w]; });
  const grow = ss(seg(rise, .45, 1)) * (st0.open || 1) * (1 + crash * 1.5), hs = h / 820, still = st0.hold ? .25 : 1, roots = [];
  const layer = (back, seedN) => {
    const R = mulberry(seedN), n = back ? 12 : 15;
    const st = back ? { fill: '#c9d9e4', ink: PAL.prusD, lw: 1.8 } : { fill: PAL.white, ink: PAL.prusD, lw: 2.2 };
    for (let i = 0; i < n; i++) {
      const s = (back ? .33 : .28) + (i + (back ? .5 : 0)) / (n - 1) * (back ? .62 : .7); if (s > .99) continue;
      const k = Math.round(s * (N - 1)), p = cd[k], q = cd[Math.min(N - 1, k + 1)], o = cd[Math.max(0, k - 1)];
      const tang = Math.atan2(q[1] - o[1], q[0] - o[0]), outN = tang - Math.PI / 2;
      const jig = Math.sin(t12 * 6.5 + i * 1.7 + (back ? 2 : 0)) * .09 * still;
      const len = (back ? 100 : 82 + R() * 50) * grow * (.5 + .6 * Math.sin(Math.min(1, s * 1.1) * Math.PI)) * hs;
      const ang = outN + (back ? .15 : .42) + jig;
      if (!back) roots.push([p[0], p[1], outN, (15 + len * .12) * (.6 + .4 * hs)]);
      if (len > 8) fclaw(x, p[0] + (back ? -6 : 0), p[1] + (back ? -8 : 0), ang, len, (back ? 18 : 15 + R() * 5) * (.6 + .4 * hs), 1.1 + R() * .3, len > 45 ? 2 : 1, st, R);
    }
  };
  layer(true, 71);
  // 白色浪沫带
  x.fillStyle = PAL.white; x.beginPath(); poly(x, cd.concat(inner.slice().reverse())); x.fill();
  x.strokeStyle = PAL.prusD; x.lineWidth = 2.6; x.lineJoin = 'round'; x.beginPath(); smooth(x, inner); x.stroke();
  x.lineWidth = 3; x.beginPath(); smooth(x, cd); x.stroke();
  layer(false, 77);
  // 爪根埋进不规则的泡沫白块里：先画所有描边，再画所有白填（得到并集轮廓）
  const Rb = mulberry(123), blobs = [];
  for (const [px, py, n, r] of roots) for (let k = 0; k < 6; k++) {
    const a = n + (Rb() - .5) * 2.6, d = r * (.1 + Rb() * .6);
    blobs.push([px + Math.cos(a) * d, py + Math.sin(a) * d, r * (.22 + Rb() * .4)]);
  }
  x.strokeStyle = PAL.prusD; x.lineWidth = 4; blobs.forEach(([bx, by, r]) => { x.beginPath(); x.arc(bx, by, r, 0, TAU); x.stroke(); });
  x.fillStyle = PAL.white; blobs.forEach(([bx, by, r]) => { x.beginPath(); x.arc(bx, by, r, 0, TAU); x.fill(); });
  // 成簇飞沫：每簇 1 大 + 若干中 + 若干小
  const R2 = mulberry(90 + Math.floor(t12 * 12) % 3), nc = Math.round(7 * curl);
  for (let c = 0; c < nc; c++) {
    const k = Math.round((.25 + c / Math.max(1, nc - 1) * .55) * (N - 1)), p = cd[k];
    const d = (90 + R2() * 110) * grow * hs, a = -Math.PI / 2 + (R2() - .15) * 1.3, cx = p[0] + Math.cos(a) * d, cy = p[1] + Math.sin(a) * d;
    const dots = [[0, 0, 7 + R2() * 4]]; for (let i = 0; i < 4; i++) dots.push([(R2() - .5) * 40, (R2() - .5) * 34, 3.5 + R2() * 2.5]); for (let i = 0; i < 8; i++) dots.push([(R2() - .5) * 70, (R2() - .5) * 60, 1.4 + R2() * 1.6]);
    for (const [dx, dy, r] of dots) { x.fillStyle = PAL.white; x.beginPath(); x.arc(cx + dx, cy + dy, r * (.6 + .4 * hs), 0, TAU); x.fill(); x.strokeStyle = PAL.prusD; x.lineWidth = r > 3 ? 1.6 : 1; x.stroke(); }
  }
}
