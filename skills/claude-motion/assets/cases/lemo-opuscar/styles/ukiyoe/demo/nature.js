// 自然元素：山、松、岩、海浪、雨、雁
import { clamp, lerp, mulberry, hash, vnoise, TAU } from '/core/lib.js';
import { PAL, smooth, poly, carve, wob, line, fillPath, rgba, mix } from './print.js';

// —— 山（原创轮廓：两坡不对称，顶上一个缺口）——
export function mtnPts(cx, by, w, h) {
  const p = [];
  const L = 18;
  for (let i = 0; i <= L; i++) { const s = i / L; p.push([cx - w * .5 + w * .43 * s, by - h * Math.pow(s, 1.55) * .985]); }
  p.push([cx - w * .045, by - h * 1.0]); p.push([cx - w * .012, by - h * .955]); p.push([cx + w * .02, by - h * .968]); p.push([cx + w * .06, by - h * .992]);
  for (let i = 1; i <= L; i++) { const s = 1 - i / L; p.push([cx + w * .5 - w * .44 * s + (i === L ? 0 : 0), by - h * Math.pow(s, 1.8) * .99]); }
  return p;
}
// 雪线：顶部约 frac 高度以上；下缘是一条略起伏的线，沿沟壑垂下长短不一、收尖的雪指
export function snowPts(cx, by, w, h, frac = .32, seed = 3) {
  const all = mtnPts(cx, by, w, h), yl = by - h * (1 - frac);
  const sl = Math.pow((by - yl) / (h * .985), 1 / 1.55), sr = Math.pow((by - yl) / (h * .99), 1 / 1.8);
  const xl = cx - w * .5 + w * .43 * sl, xr = cx + w * .5 - w * .44 * sr;
  const top = [[xl, yl]].concat(all.filter(q => q[1] < yl - 1), [[xr, yl]]);
  const R = mulberry(seed), edge = [[xr, yl]], nf = 12, span = xr - xl;
  for (let f = nf - 1; f >= 0; f--) {
    const u = (f + .5 + (R() - .5) * .5) / nf, X = xl + span * u, mid = 1 - Math.pow(Math.abs(u - .5) * 2, 2.2);
    const r = R(), depth = h * (r < .3 ? .16 + R() * .08 : r < .7 ? .07 + R() * .05 : .03) * (.35 + .65 * mid), fw = span * (.012 + R() * .018);
    const lift = -h * (.004 + R() * .02) * mid;
    edge.push([X + fw * 2.4, yl + lift * .5], [X + fw, yl + depth * .35], [X + fw * .15, yl + depth], [X - fw * .5, yl + depth * .4], [X - fw * 2.2, yl + lift]);
  }
  edge.push([xl, yl]);
  for (let i = 1; i < edge.length; i++) if (edge[i][0] > edge[i - 1][0] - 2) edge[i][0] = edge[i - 1][0] - 2;
  return { top, edge: edge.filter(q => q[0] >= xl - 1) };
}
function snowEdge(cx, by, w, h, frac, seed) {
  const { top, edge: e } = snowPts(cx, by, w, h, frac, seed), out = [e[0]];
  for (let i = 1; i < e.length - 1; i++) {
    const a = i === 1 ? e[0] : [(e[i - 1][0] + e[i][0]) / 2, (e[i - 1][1] + e[i][1]) / 2], c = e[i], b = [(e[i][0] + e[i + 1][0]) / 2, (e[i][1] + e[i + 1][1]) / 2];
    for (let k = 1; k <= 5; k++) { const t = k / 5, m = 1 - t; out.push([m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]]); }
  }
  out.push(e[e.length - 1]);
  return { top, edge: out };
}
export function snowPath(x, cx, by, w, h, frac, seed) {
  const { top, edge } = snowEdge(cx, by, w, h, frac, seed);
  x.moveTo(top[0][0], top[0][1]); top.concat(edge).forEach(q => x.lineTo(q[0], q[1])); x.closePath();
}
export function mountain(x, cx, by, w, h, o = {}) {
  const pts = mtnPts(cx, by, w, h);
  if (o.body || o.grad) {
    x.save(); x.beginPath(); poly(x, pts); x.clip();
    if (o.grad) { const g = x.createLinearGradient(0, by - h, 0, by); o.grad.forEach(([s, c]) => g.addColorStop(s, c)); x.fillStyle = g; }
    else x.fillStyle = o.body;
    x.fillRect(cx - w, by - h - 10, w * 2, h + 20);
    if (o.shade) { // 右坡阴面
      x.fillStyle = o.shade; x.beginPath(); x.moveTo(cx + w * .02, by - h * .97);
      for (let i = 0; i <= 10; i++) { const s = i / 10; x.lineTo(cx + w * (.02 + .16 * s) + Math.sin(s * 9) * w * .01, by - h * (.97 - .97 * s)); }
      x.lineTo(cx + w, by); x.lineTo(cx + w, by - h); x.closePath(); x.fill();
    }
    x.restore();
  }
  if (o.snow) { x.fillStyle = o.snow; x.beginPath(); snowPath(x, cx, by, w, h, o.frac, o.seed); x.fill(); }
  if (o.glow) { // 雪上的淡红晕
    x.save(); x.beginPath(); snowPath(x, cx, by, w, h, o.frac, o.seed); x.clip();
    const g = x.createLinearGradient(cx - w * .1, 0, cx + w * .25, 0); g.addColorStop(0, rgba(o.glow, 0)); g.addColorStop(1, rgba(o.glow, .75));
    x.fillStyle = g; x.fillRect(cx - w, by - h - 10, w * 2, h); x.restore();
  }
  if (o.lines) {
    const lw = o.lw || 2.6;
    x.fillStyle = o.lineCol || PAL.sumi;
    carve(x, wob(pts.slice(0, 20), lw * .5, 2), lw * 1.3, { taper: [.35, .02], seed: 4 });
    carve(x, wob(pts.slice(19), lw * .5, 3), lw * 1.3, { taper: [.02, .4], seed: 5 });
    if (o.snowLine) { const e = snowEdge(cx, by, w, h, o.frac, o.seed).edge; x.strokeStyle = o.snowLine; x.lineWidth = lw * .6; x.lineJoin = 'round'; x.beginPath(); e.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); }
  }
  return pts;
}

// —— 松：弯曲树干 + 平顶的针叶"云团"（上缘扇形针束，下缘平）——
function pinePad(x, cx, cy, r, o, R, lw) {
  const n = Math.max(3, Math.round(r / 16)), top = [], wdt = r * 1.35, ht = r * .42;
  for (let i = 0; i <= n; i++) { const u = i / n, X = cx - wdt + u * 2 * wdt; top.push([X, cy - ht * Math.pow(Math.sin(u * Math.PI), .7) * (.8 + R() * .3)]); }
  const bot = [[cx + wdt, cy + ht * .12], [cx + wdt * .3, cy + ht * .22], [cx - wdt * .4, cy + ht * .18], [cx - wdt, cy + ht * .1]];
  if (o.fills !== false) {
    x.fillStyle = o.needle || PAL.pine; x.beginPath(); x.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i <= n; i++) { const p0 = top[i - 1], p1 = top[i]; x.quadraticCurveTo((p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - r * .16, p1[0], p1[1]); }
    bot.forEach(q => x.lineTo(q[0], q[1])); x.closePath(); x.fill();
  }
  if (o.lines !== false) {
    x.strokeStyle = PAL.sumi; x.lineCap = 'round';
    for (let i = 1; i <= n; i++) {
      const p0 = top[i - 1], p1 = top[i], mx = (p0[0] + p1[0]) / 2, my = Math.min(p0[1], p1[1]) - r * .16, base = [mx, my + r * .34];
      x.lineWidth = lw * .5;
      for (let k = 0; k <= 8; k++) { const u = k / 8, ex = lerp(p0[0], p1[0], u), ey = lerp(p0[1], p1[1], u) - Math.sin(u * Math.PI) * r * .16; x.beginPath(); x.moveTo(base[0], base[1]); x.lineTo(lerp(base[0], ex, .92), lerp(base[1], ey, .92)); x.stroke(); }
    }
    x.lineWidth = lw * .9; x.beginPath(); x.moveTo(bot[3][0], bot[3][1]); bot.slice().reverse().forEach(q => x.lineTo(q[0], q[1])); x.stroke();
  }
}
export function pine(x, bx, by, sc, o = {}) {
  const R = mulberry(o.seed || 7), lean = o.lean ?? -.3, lw = o.lw || 2.4;
  const trunk = [];
  for (let i = 0; i <= 7; i++) { const s = i / 7; trunk.push([bx + Math.sin(s * 3.1 + (o.seed || 0)) * 26 * sc + lean * s * 170 * sc, by - s * 270 * sc]); }
  const th = i => (15 - i * 1.5) * sc;
  const tl = trunk.map(([a, b], i) => [a - th(i), b]), tr = trunk.map(([a, b], i) => [a + th(i), b]);
  if (o.fills !== false) { x.fillStyle = o.bark || PAL.woodD; x.beginPath(); poly(x, tl.concat(tr.slice().reverse())); x.fill(); }
  // 枝
  const pads = [];
  trunk.forEach(([a, b], i) => {
    if (i < (o.minI || 2)) return; const side = (i + (o.seed || 0)) % 2 ? 1 : -1, len = (60 + R() * 70) * sc, ex = a + side * len, ey = b - (10 + R() * 25) * sc;
    if (o.fills !== false) { x.strokeStyle = o.bark || PAL.woodD; x.lineWidth = 7 * sc; x.lineCap = 'round'; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + side * len * .5, b + 8 * sc, ex, ey); x.stroke(); }
    if (o.lines !== false) { x.strokeStyle = PAL.sumi; x.lineWidth = lw * .7; x.beginPath(); x.moveTo(a, b - 3 * sc); x.quadraticCurveTo(a + side * len * .5, b + 5 * sc, ex, ey - 3 * sc); x.stroke(); }
    pads.push([ex, ey, (34 + R() * 18) * sc]);
  });
  pads.push([trunk[7][0], trunk[7][1] - 6 * sc, 48 * sc]);
  if (o.extra) o.extra.forEach(c => pads.push([bx + c[0] * sc, by + c[1] * sc, c[2] * sc]));
  pads.sort((p, q) => p[1] - q[1]).forEach(([cx, cy, r]) => pinePad(x, cx, cy, r, o, R, lw));
  if (o.lines !== false) {
    x.fillStyle = PAL.sumi;
    carve(x, tl, lw * 1.2, { taper: [0, .3], seed: 8 }); carve(x, tr, lw * 1.2, { taper: [0, .3], seed: 9 });
    // 树皮鳞纹
    x.strokeStyle = PAL.sumi; x.lineWidth = lw * .45;
    for (let i = 0; i < 7; i++) for (let k = 0; k < 3; k++) { const a = trunk[i], b = trunk[i + 1], u = (k + .5) / 3, px = lerp(a[0], b[0], u) + (R() - .5) * th(i), py = lerp(a[1], b[1], u); x.beginPath(); x.arc(px, py, 4 * sc, Math.PI * .1, Math.PI * .9); x.stroke(); }
  }
}

// —— 岩（块面 + 皴线）——
export function rock(x, pts, o = {}) {
  const lw = o.lw || 2.6;
  if (o.fill) { x.fillStyle = o.fill; x.beginPath(); poly(x, pts); x.fill(); }
  if (o.face) { x.save(); x.beginPath(); poly(x, pts); x.clip(); x.fillStyle = o.face; o.facets.forEach(f => { x.beginPath(); poly(x, f); x.fill(); }); x.restore(); }
  if (o.lines) {
    x.fillStyle = PAL.sumi; carve(x, wob(pts, 2, o.seed || 1), lw * 1.2, { closed: true, jit: .35, seed: o.seed || 1 });
    if (o.facets) o.facets.forEach((f, i) => carve(x, f.slice(0, 3), lw * .8, { taper: [.2, .6], seed: i + 3 }));
  }
}

// —— 雨线（两组角度，12fps 换位）——
export function rain(x, t, rect, o = {}) {
  const k = Math.floor(t * 12), R = mulberry(1000 + k), [x0, y0, x1, y1] = rect;
  const sets = o.sets || [[-1.34, 260, 2.1, PAL.sumi, .55], [-1.22, 140, 1.4, PAL.greyD, .45]];
  x.save(); x.lineCap = 'butt';
  for (const [ang, n, lw, col, a] of sets) {
    x.strokeStyle = rgba(col, a); x.lineWidth = lw; x.beginPath();
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      const L = 70 + R() * 190, px = x0 + R() * (x1 - x0 + 200), py = y0 + R() * (y1 - y0 + L);
      x.moveTo(px, py); x.lineTo(px - dx * L, py - dy * L);
    }
    x.stroke();
  }
  x.restore();
}

// —— 雁（小 V 形）——
export function goose(x, px, py, s, flap) {
  x.fillStyle = PAL.sumi; x.beginPath();
  const f = flap * 5 * s;
  x.moveTo(px - 9 * s, py - 2 * s - f); x.quadraticCurveTo(px - 3 * s, py - 1 * s, px, py + 1.2 * s); x.quadraticCurveTo(px + 3 * s, py - 1 * s, px + 9 * s, py - 2 * s - f);
  x.quadraticCurveTo(px + 3 * s, py + .6 * s, px, py + 2.6 * s); x.quadraticCurveTo(px - 3 * s, py + .6 * s, px - 9 * s, py - 2 * s - f); x.fill();
  x.beginPath(); x.moveTo(px, py + 1); x.lineTo(px - 4.5 * s, py + 1.6 * s); x.lineWidth = 1.4 * s; x.strokeStyle = PAL.sumi; x.stroke();
}

// —— 浪爪：一根弯钩状的"手指"（白填 + 普鲁士蓝描边），可带小分爪 ——
export function claw(x, bx, by, ang, len, wid, curl, o = {}) {
  const n = 16, sp = [[bx, by]]; let a = ang, px = bx, py = by;
  for (let i = 1; i <= n; i++) { const s = i / n; a = ang + curl * Math.pow(s, 2.6) * 3.4; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; sp.push([px, py]); }
  const Lp = [], Rp = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, q = sp[i], q2 = sp[Math.min(n, i + 1)], q1 = sp[Math.max(0, i - 1)];
    let dx = q2[0] - q1[0], dy = q2[1] - q1[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wid * .5 * (s < .22 ? .75 + s * 1.1 : Math.pow((1 - s) / .78, .85));
    Lp.push([q[0] - dy * w, q[1] + dx * w]); Rp.push([q[0] + dy * w, q[1] - dx * w]);
  }
  const outline = Lp.concat(Rp.reverse());
  x.fillStyle = o.fill || PAL.white; x.beginPath(); poly(x, outline); x.fill();
  x.strokeStyle = o.ink || PAL.prusD; x.lineWidth = o.lw || 2.2; x.lineJoin = 'round'; x.beginPath(); poly(x, outline); x.stroke();
  // 爪尖分叉：末端再长出 2 个小钩
  if (o.sub && len > 40) {
    const tipI = Math.round(n * .62), q = sp[tipI], aT = ang + curl * Math.pow(.62, 2.6) * 3.4;
    claw(x, q[0], q[1], aT - (curl > 0 ? .7 : -.7), len * .3, wid * .42, curl * 1.5, { ...o, sub: 0 });
  }
  // 小分爪（从外侧长出）
  if (o.sub) {
    for (let k = 0; k < o.sub; k++) {
      const s = .35 + k * .22, i = Math.round(s * n), q = Rp[Rp.length - 1 - i] || Rp[0];
      const aa = ang + curl * Math.pow(s, 2.6) * 3.4 - (curl > 0 ? 1 : -1) * .95;
      claw(x, q[0], q[1], aa, len * .32 * (1 - s * .4), wid * .38, curl * 1.3, { ...o, sub: 0 });
    }
  }
  return sp[n];
}
