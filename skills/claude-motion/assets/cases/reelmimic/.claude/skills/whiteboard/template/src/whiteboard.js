// whiteboard.js: the drawing library of the ReelMimic "whiteboard" engine (hand-drawn whiteboard / doodle explainer).
//
// Everything on the board is a list of STROKES. A stroke is a hand-wobbled polyline (marker or highlighter) or a
// coloured-in shape (fill). Builders in `S` / `ICON` / `hatch()` make strokes; `drawOn(strokes, a, b)` reveals them by
// arc length between times a→b (the marker hand follows the pen tip); `ink(strokes)` draws them fully;
// `writeOn(text, x, y, a, b)` writes handwriting left to right. Every frame is a pure function of time.
//
// Shot skeleton:
//   function shot(t, lt, dur) {
//     wbBegin(lt, { cam: [[0, [960, 540, .9]], [3, [1300, 560, 1.1]]] });   // clock + camera + board
//     drawOn([S.circle(900, 500, 120), ...ICON.bulb(900, 500, 160)], .5, 1.8);
//     writeOn('Big idea!', 700, 260, 2, 3, { size: 96, col: INK.blue });
//     camEnd(); eraseWipe(seg(lt, dur - .8, dur));                          // screen-space transition out
//   }

// ---------- palette & settings ----------
const INK = {
  black: '#23262B', blue: '#1F5CC4', red: '#D9392B', orange: '#F28A16', green: '#2A9A4B', purple: '#7A4FC4',
  grey: '#8B9098', yellow: '#FFD62E', pink: '#FF9DB0', skin: '#F7D5B8', white: '#FFFFFF',
  board: '#F7F6F1', paper: '#FBF6E8', wall: '#E3DDD2',
};
const HL = { yellow: '#FFE45C', pink: '#FF9EC4', green: '#9BEA8A', blue: '#8FD3FF', orange: '#FFC06B' };   // highlighters
const FONT_HAND = '"Kalam", "LXGW WenKai TC", "Klee One", cursive';
const WB = {
  w: 9,                 // default marker width in world px (at zoom 1 on a 1920×1080 frame)
  clock: 0,             // the time drawOn/writeOn read (wbBegin sets it to the shot's local time)
  hand: true,           // draw the marker hand at the pen tip (false hides it everywhere)
  handScale: .85,
  sleeve: '#3E6FCB',    // the drawing hand's shirt sleeve
  bg: { kind: 'white' },
  gap: 30,              // pen-lift cost between strokes, in px of travel
  ghost: true,          // faint ghosting of old erased writing on the white board
};
const PEN = [];         // this frame's drawOn/writeOn intervals (for the hand); reset every frame

// ---------- geometry ----------
const _d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function cumOf(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + _d(pts[i - 1], pts[i])); return c; }
function resample(pts, step = 6) {           // polyline → evenly spaced points
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = _d(a, b), n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}
function catmull(ctrl, closed = false, step = 6) {   // smooth curve through control points
  const P = closed ? [ctrl[ctrl.length - 1], ...ctrl, ctrl[0], ctrl[1]] : [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], n = Math.max(2, Math.ceil(_d(p1, p2) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  return out;
}
// smooth path with sharp corners at the indices in `sharp` (e.g. ear tips); closed paths start at a sharp point
function spline(ctrl, sharp = [], closed = false, step = 6) {
  if (!sharp.length) return catmull(ctrl, closed, step);
  const n = ctrl.length, idx = [...sharp].sort((a, b) => a - b), out = [];
  const cuts = closed ? [...idx, idx[0] + n] : [0, ...idx.filter(i => i > 0 && i < n - 1), n - 1];
  for (let k = 0; k < cuts.length - 1; k++) {
    const piece = []; for (let i = cuts[k]; i <= cuts[k + 1]; i++) piece.push(ctrl[i % n]);
    const c = piece.length > 2 ? catmull(piece, false, step) : resample(piece, step);
    out.push(...(k ? c.slice(1) : c));
  }
  return out;
}
function keyOf(...v) { return v.map(x => typeof x === 'number' ? Math.round(x) : x).join(':'); }
// hand wobble: low-frequency sideways drift + a gentle bow, seeded by `key` so it's the same every frame
function wobble(pts, amp, key, bow = .012) {
  if (pts.length < 3 || !amp && !bow) return pts;
  const r = rnd('wob' + key), f1 = TAU / (150 + 140 * r()), f2 = TAU / (45 + 40 * r()), p1 = r() * TAU, p2 = r() * TAU, b = (r() - .5) * 2 * bow;
  const cum = cumOf(pts), L = cum[cum.length - 1] || 1;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], dx = c[0] - a[0], dy = c[1] - a[1], m = Math.hypot(dx, dy) || 1;
    const s = cum[i], off = amp * (.72 * Math.sin(s * f1 + p1) + .28 * Math.sin(s * f2 + p2)) * Math.min(1, s / 30, (L - s) / 30 + .35) + b * L * Math.sin(Math.PI * s / L);
    return [p[0] - dy / m * off, p[1] + dx / m * off];
  });
}
const autoAmp = len => Math.min(2.8, .7 + len * .004);

// ---------- strokes ----------
// mk(points, { col, w, z, alpha, kind: 'line'|'hl' }) → stroke. z orders drawing (low first); array order is reveal order.
function mk(pts, o = {}) {
  const cum = cumOf(pts);
  return { kind: o.kind || (o.hl ? 'hl' : 'line'), p: pts, cum, len: cum[cum.length - 1], col: o.col || INK.black, w: o.w || WB.w, z: o.z || 0, a: o.alpha ?? (o.hl ? .55 : 1), seed: hash(pts.length + (pts[0][0] | 0) * .37) * 9 };
}
function _line(pts, o, key) { const L = cumOf(pts).pop(); return mk(o.wob === 0 ? pts : wobble(pts, o.wob ?? autoAmp(L), o.key || key, o.bow ?? .012), o); }
// flatten nested arrays of strokes (null/false entries are skipped, so `cond && S.line(...)` works)
function flatStrokes(d, out = []) { if (!d) return out; if (Array.isArray(d)) { for (const x of d) flatStrokes(x, out); } else out.push(d); return out; }
// move/rotate/scale strokes built at the origin (line widths are NOT scaled: one marker, one width)
function place(d, x, y, ang = 0, sc = 1) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return flatStrokes(d).map(st => {
    const q = { ...st, p: st.p.map(([px, py]) => [x + (px * c - py * s) * sc, y + (px * s + py * c) * sc]), cum: st.cum.map(v => v * sc), len: st.len * sc };
    if (st.kind === 'fill') { q.cost = st.cost * sc; q.bb = _bbox(q.p); q.shift = [(st.shift[0] * c - st.shift[1] * s) * sc, (st.shift[0] * s + st.shift[1] * c) * sc]; }
    return q;
  });
}
function _bbox(poly) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1 - x0, y1 - y0]; }
function tint(d, col) { return flatStrokes(d).map(s => ({ ...s, col })); }
function layer(d, z) { return flatStrokes(d).map(s => ({ ...s, z })); }
function polyCircle(cx, cy, rx, ry = rx, n = 48, a0 = 0) { const p = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return p; }
function polyRect(x, y, w, h, r = 0) {
  if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const p = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + i / 6 * Math.PI / 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI); return p;
}

// ---------- stroke builders ----------
const S = {
  line(x1, y1, x2, y2, o = {}) { return _line(resample([[x1, y1], [x2, y2]], 6), o, keyOf('l', x1, y1, x2, y2)); },
  // through points; o.closed, o.sharp = [indices of corners]; o.straight = polyline with corners everywhere
  path(pts, o = {}) {
    const q = o.straight ? resample(o.closed ? [...pts, pts[0]] : pts, 6) : spline(pts, o.sharp || [], !!o.closed);
    if (o.closed && !o.straight && q.length) q.push(q[0]);
    return _line(q, o, keyOf('p', pts[0][0], pts[0][1], pts.length));
  },
  // hand-drawn circle/ellipse: starts upper-left, overshoots past the start (turns 1.06), radius breathes a little
  circle(cx, cy, rx, ry = rx, o = {}) {
    const r = rnd(o.key || keyOf('c', cx, cy, rx)), a0 = o.a0 ?? (-2.3 + r() * .5), turns = o.turns ?? 1.06, dir = o.cw ? 1 : -1;
    const n = Math.max(20, Math.ceil(TAU * Math.max(rx, ry) * turns / 6)), ph = r() * TAU, gr = o.spiral ?? .035, pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, a = a0 + dir * k * TAU * turns, f = 1 + (o.round ? 0 : .03 * Math.sin(2 * a + ph)) + gr * (k - .5);
      pts.push([cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a)]);
    }
    return _line(pts, { ...o, bow: 0 }, o.key || keyOf('c', cx, cy, rx));
  },
  ring(cx, cy, rx, ry = rx, o = {}) { return S.circle(cx, cy, rx, ry, { turns: 1.14, spiral: .08, ...o }); },   // circle around a word
  arc(cx, cy, r, a0, a1, o = {}) {
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 6)), pts = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + r * Math.cos(a), cy + (o.ry || r) * Math.sin(a)]); }
    return _line(pts, o, keyOf('a', cx, cy, r, a0));
  },
  dot(x, y, r = 6, o = {}) { return mk([[x, y], [x + .3, y + .2]], { ...o, w: 2 * r }); },
  // hand-drawn box: one continuous stroke, the last side overshoots the start; o.r rounds corners
  rect(x, y, w, h, o = {}) {
    const q = o.r ? [...polyRect(x, y, w, h, o.r), [x + w - o.r + 4, y - 1]] : [[x - 4, y + 2], [x + w, y], [x + w + 1, y + h], [x, y + h + 1], [x + 1, y - Math.min(10, h * .12)]];
    return _line(resample(q, 6), { ...o, bow: .004 }, o.key || keyOf('r', x, y, w, h));
  },
  // arrow: curved shaft (o.bend, fraction of length, + bends left of travel) + a separate head stroke
  arrow(x1, y1, x2, y2, o = {}) {
    const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L, ny = (x2 - x1) / L, b = (o.bend ?? .12) * L;
    const cx = (x1 + x2) / 2 + nx * b, cy = (y1 + y2) / 2 + ny * b, pts = [];
    const n = Math.max(8, Math.ceil(L / 6));
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2]); }
    const shaft = _line(pts, { ...o, bow: 0 }, o.key || keyOf('ar', x1, y1, x2, y2));
    const e = shaft.p[shaft.p.length - 1], q = shaft.p[Math.max(0, shaft.p.length - 5)], ang = Math.atan2(e[1] - q[1], e[0] - q[0]);
    const hs = o.head ?? Math.min(46, 20 + L * .08), sp = .5;
    const head = mk([[e[0] - hs * Math.cos(ang - sp), e[1] - hs * Math.sin(ang - sp)], e, [e[0] - hs * Math.cos(ang + sp), e[1] - hs * Math.sin(ang + sp)]].map(p => p), o);
    return [shaft, mk(resample(head.p, 5), o)];
  },
  underline(x, y, w, o = {}) {
    const a = _line(resample([[x - 6, y + 2], [x + w + 8, y - 3]], 6), { bow: .01, ...o }, o.key || keyOf('u', x, y, w));
    return o.double ? [a, _line(resample([[x + w * .12, y + 16], [x + w * .92, y + 13]], 6), o, keyOf('u2', x, y, w))] : a;
  },
  // wavy / zigzag lines
  wave(x1, y1, x2, y2, amp = 10, waves = 4, o = {}) {
    const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L, ny = (x2 - x1) / L, n = Math.ceil(L / 5), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, s = amp * Math.sin(t * waves * TAU); pts.push([lerp(x1, x2, t) + nx * s, lerp(y1, y2, t) + ny * s]); }
    return _line(pts, { wob: 0, ...o }, keyOf('w', x1, y1));
  },
  zigzag(x1, y1, x2, y2, amp = 12, n = 6, o = {}) {
    const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L, ny = (x2 - x1) / L, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, s = i % 2 ? amp : -amp; pts.push([lerp(x1, x2, t) + nx * s * (i && i < n ? 1 : 0), lerp(y1, y2, t) + ny * s * (i && i < n ? 1 : 0)]); }
    return _line(resample(pts, 5), { wob: .5, ...o }, keyOf('z', x1, y1));
  },
  spiral(cx, cy, r, turns = 2.5, o = {}) { const n = Math.ceil(turns * 40), p = []; for (let i = 0; i <= n; i++) { const k = i / n, a = k * turns * TAU; p.push([cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)]); } return _line(p, { wob: .6, ...o }, keyOf('sp', cx, cy)); },
  // speech bubble (ellipse with a tail pointing at [tx,ty]) / callout box with a tail
  bubble(cx, cy, rx, ry, tail, o = {}) {
    const ta = Math.atan2((tail[1] - cy) / ry, (tail[0] - cx) / rx), gap = .22, pts = [];
    const n = 60; for (let i = 0; i <= n; i++) { const a = ta + gap + i / n * (TAU - 2 * gap); pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    pts.push(tail, [cx + rx * Math.cos(ta + gap), cy + ry * Math.sin(ta + gap)]);
    return _line(resample(pts, 6), { ...o, bow: 0 }, o.key || keyOf('b', cx, cy));
  },
  box(x, y, w, h, o = {}) {       // o.tail = [tx, ty] below the box; o.r corner radius
    const r = o.r ?? 18, P = polyRect(x, y, w, h, r);
    if (o.tail) {
      const bx = clamp(o.tail[0], x + r + 30, x + w - r - 30), i = P.findIndex(p => p[1] >= y + h - .5 && p[0] <= x + w - r + .5);   // start of the bottom edge
      P.splice(i + 1, 0, [bx + 26, y + h], o.tail, [bx - 16, y + h]);
    }
    P.push([P[0][0] + 6, P[0][1] - 1]);
    return _line(resample(P, 6), { ...o, bow: .003 }, o.key || keyOf('bx', x, y, w, h));
  },
  cloud(cx, cy, rx, ry, o = {}) {
    const n = o.bumps || 9, r = rnd(keyOf('cl', cx, cy)), pts = [];
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i / n * TAU, a1 = -Math.PI / 2 + (i + 1) / n * TAU, p0 = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)], p1 = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)];
      const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], br = _d(p0, p1) / 2 * (1.05 + r() * .2), out = [m[0] - cx, m[1] - cy], s0 = Math.atan2(p0[1] - m[1], p0[0] - m[0]);
      const sw = (Math.cos(s0 - Math.PI / 2) * out[0] + Math.sin(s0 - Math.PI / 2) * out[1]) > 0 ? -Math.PI : Math.PI;
      for (let k = 0; k <= 10; k++) { const a = s0 + sw * k / 10; pts.push([m[0] + br * Math.cos(a), m[1] + br * Math.sin(a)]); }
    }
    pts.push(pts[0]);
    return _line(pts, { wob: .8, ...o, bow: 0 }, keyOf('cl', cx, cy));
  },
  heart(cx, cy, s, o = {}) {      // s ≈ width
    const pts = [], k = s / 34;
    for (let i = 0; i <= 64; i++) { const t = Math.PI + i / 64 * TAU * 1.02; pts.push([cx + 16 * Math.pow(Math.sin(t), 3) * k, cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * k - 2 * k]); }
    return _line(pts, { wob: .6, ...o, bow: 0 }, o.key || keyOf('h', cx, cy));
  },
  star(cx, cy, r, o = {}) { const p = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * .45 : r; p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } p.push([cx + r * .2 * Math.cos(-1.2), cy - r * .8]); return _line(resample(p, 5), { wob: .6, ...o, bow: 0 }, o.key || keyOf('st', cx, cy)); },
  check(x, y, s, o = {}) { return _line(resample([[x - s * .45, y - s * .02], [x - s * .12, y + s * .32], [x + s * .5, y - s * .42]], 5), { col: INK.green, w: WB.w * 1.4, ...o, bow: 0 }, keyOf('ck', x, y)); },
  cross(x, y, s, o = {}) { const h = s * .42, q = { col: INK.red, w: WB.w * 1.4, ...o }; return [S.line(x - h, y - h, x + h, y + h, q), S.line(x + h, y - h, x - h, y + h, q)]; },
  // emphasis rays around a point (o.a0/o.a1 limit the fan), sparkle, speed lines
  rays(cx, cy, r1, r2, n = 8, o = {}) { const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, full = Math.abs(a1 - a0 - TAU) < .01, out = []; for (let i = 0; i < n; i++) { const a = lerp(a0, a1, full ? i / n : n > 1 ? i / (n - 1) : .5); out.push(S.line(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), { ...o, key: (o.key || keyOf('ry', cx, cy)) + ':' + i })); } return out; },
  sparkle(x, y, s, o = {}) { const k = o.key || keyOf('sk', x, y); return [S.line(x, y - s, x, y + s, { ...o, key: k + '1' }), S.line(x - s, y, x + s, y, { ...o, key: k + '2' })]; },
  speed(x, y, len, ang = 0, n = 3, gap = 22, o = {}) { const c = Math.cos(ang), s = Math.sin(ang), out = []; for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * gap, l = len * (i % 2 ? .7 : 1), ox = -s * off, oy = c * off; out.push(S.line(x + ox, y + oy, x + ox - c * l, y + oy - s * l, { w: WB.w * .7, ...o, key: keyOf('sd', x, y, i) })); } return out; },
  // coloured-in shape: o.mode 'ink' (multiply, lines show through; default) or 'cover' (opaque, hides what's under)
  fill(poly, o = {}) {
    const bb = _bbox(poly);
    return { kind: 'fill', p: poly, cum: [0], len: 0, col: o.col || INK.yellow, w: 0, z: o.z ?? -1, a: o.alpha ?? .92, mode: o.mode || 'ink', shift: o.shift || [0, 0], cost: o.cost ?? (bb[2] + bb[3]) * .9, bb, pat: o.pat !== false };
  },
};
// quick hatching inside a polygon: parallel marker lines (o.angle deg, o.gap px); o.zig = one continuous scribble
function hatch(poly, o = {}) {
  const ang = (o.angle ?? 38) * Math.PI / 180, gap = o.gap ?? 16, c = Math.cos(-ang), s = Math.sin(-ang);
  const rp = poly.map(([x, y]) => [x * c - y * s, x * s + y * c]), ys = rp.map(p => p[1]), segs = [];
  const inset = o.inset ?? 4;
  for (let y = Math.min(...ys) + gap * .5; y < Math.max(...ys); y += gap) {
    const xs = [];
    for (let i = 0; i < rp.length; i++) { const a = rp[i], b = rp[(i + 1) % rp.length]; if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > inset * 2 + 2) segs.push([[xs[i] + inset, y], [xs[i + 1] - inset, y]]);
  }
  const back = ([x, y]) => [x * c + y * s, -x * s + y * c], r = rnd('h' + (poly[0][0] | 0) + (poly[0][1] | 0));
  const q = { w: o.w || WB.w * .55, col: o.col || INK.black, z: o.z ?? -1, alpha: o.alpha, hl: o.hl };
  if (o.zig) {   // one back-and-forth scribble
    const pts = []; segs.forEach((sg, i) => { const [a, b] = i % 2 ? [sg[1], sg[0]] : sg; pts.push(back([a[0] + (r() - .5) * 6, a[1]]), back([b[0] + (r() - .5) * 6, b[1]])); });
    return pts.length > 1 ? [mk(resample(pts, 6), q)] : [];
  }
  return segs.map(([a, b], i) => mk(resample([back([a[0] + (r() - .5) * 8, a[1] + (r() - .5) * 3]), back([b[0] + (r() - .5) * 8, b[1] + (r() - .5) * 3])], 6), q));
}
// highlighter scribble fill (translucent, multiply)
function scribble(poly, o = {}) { return hatch(poly, { zig: true, hl: true, gap: o.gap ?? 25, w: o.w ?? 28, col: o.col || HL.yellow, angle: o.angle ?? 28, inset: 10, alpha: o.alpha ?? .6, z: o.z ?? -1 }); }
// highlighter bar behind a word (x,y = top-left of the text box)
function hilite(x, y, w, h, o = {}) { return mk(resample([[x - 8, y + h * .55], [x + w + 8, y + h * .5]], 6), { hl: true, w: h * .75, col: o.col || HL.yellow, z: -1, alpha: o.alpha ?? .6 }); }

// ---------- icons: ICON.name(cx, cy, size, o) → strokes (o.col = accent colour, o.key = wobble seed) ----------
const ICON = {};
{
  const B = (name, fn) => { ICON[name] = (cx, cy, s = 140, o = {}) => place(fn(s / 100, o, o.key || keyOf(name, cx, cy)), cx, cy, o.rot || 0); };
  const L = (pts, k, o = {}) => _line(resample(pts, 5), { wob: .6, bow: 0, ...o }, k);
  const C = (pts, k, o = {}) => _line(catmull(pts), { wob: .6, bow: 0, ...o }, k);
  const circ = (x, y, r, k, o = {}) => S.circle(x, y, r, r, { key: k, ...o });
  B('bulb', (u, o, k) => {
    const g = [[-18, 22], [-24, 8], [-38, -12], [-40, -34], [-26, -56], [0, -64], [26, -56], [40, -34], [38, -12], [24, 8], [18, 22]].map(([x, y]) => [x * u, y * u]);
    const glass = C(g, k + 'g'), fil = L([[-10 * u, 20 * u], [-10 * u, -4 * u], [-4 * u, -14 * u], [2 * u, -4 * u], [8 * u, -14 * u], [10 * u, -4 * u], [10 * u, 20 * u]], k + 'f', { col: INK.orange, w: WB.w * .7 });
    const base = [0, 1, 2].map(i => L([[-19 * u, (28 + i * 9) * u], [19 * u, (28 + i * 9) * u]], k + 'b' + i));
    const tip = L([[-9 * u, 56 * u], [9 * u, 56 * u]], k + 't');
    const out = [glass, fil, ...base, tip, S.fill(catmull([...g]).concat([[0, 24 * u]]), { col: o.col || INK.yellow, alpha: .95 })];
    if (o.rays) out.push(...S.rays(0, -26 * u, 58 * u, 80 * u, 7, { a0: -Math.PI * 1.05, a1: Math.PI * .05, col: INK.orange, key: k + 'r' }));
    return out;
  });
  B('clock', (u, o, k) => [circ(0, 0, 48 * u, k + 'c'), ...[0, 1, 2, 3].map(i => { const a = i * Math.PI / 2; return L([[40 * u * Math.cos(a), 40 * u * Math.sin(a)], [33 * u * Math.cos(a), 33 * u * Math.sin(a)]], k + 't' + i); }),
    L([[0, 0], [0, -30 * u]], k + 'h'), L([[0, 0], [22 * u, 10 * u]], k + 'm'), S.dot(0, 0, WB.w * .7), S.fill(polyCircle(0, 0, 46 * u, 46 * u, 36), { col: o.col || HL.blue, alpha: .7 })]);
  B('coin', (u, o, k) => [circ(0, 0, 46 * u, k + 'c'), circ(0, 0, 34 * u, k + 'i', { w: WB.w * .6, turns: 1 }), C([[14 * u, -14 * u], [4 * u, -20 * u], [-12 * u, -16 * u], [-12 * u, -4 * u], [0, 0], [12 * u, 4 * u], [12 * u, 16 * u], [-2 * u, 20 * u], [-14 * u, 14 * u]], k + 's'),
    L([[0, -28 * u], [0, 28 * u]], k + 'v'), S.fill(polyCircle(0, 0, 45 * u), { col: o.col || INK.yellow, alpha: .9 })]);
  B('money', (u, o, k) => [S.rect(-60 * u, -32 * u, 120 * u, 64 * u, { key: k + 'r', r: 6 }), circ(0, 0, 18 * u, k + 'c', { w: WB.w * .7 }), L([[-46 * u, -18 * u], [-38 * u, -18 * u]], k + 'a'), L([[38 * u, 18 * u], [46 * u, 18 * u]], k + 'b'),
    S.fill(polyRect(-58 * u, -30 * u, 116 * u, 60 * u), { col: o.col || '#8CD49B', alpha: .9 })]);
  B('heart', (u, o, k) => [S.heart(0, 0, 100 * u, { key: k }), S.fill(catmull(S.heart(0, 0, 96 * u, { key: k, wob: 0 }).p.filter((_, i) => i % 3 === 0)), { col: o.col || INK.red, alpha: .9 })]);
  B('check', (u, o, k) => [S.check(0, 0, 100 * u, { key: k, col: o.col || INK.green })]);
  B('cross', (u, o, k) => S.cross(0, 0, 100 * u, { key: k, col: o.col || INK.red }));
  B('checkbox', (u, o, k) => [S.rect(-40 * u, -40 * u, 80 * u, 80 * u, { key: k + 'b' }), S.check(8 * u, -8 * u, 100 * u, { key: k, col: o.col || INK.green })]);
  B('phone', (u, o, k) => [S.rect(-32 * u, -58 * u, 64 * u, 116 * u, { key: k + 'r', r: 12 * u }), L([[-10 * u, -46 * u], [10 * u, -46 * u]], k + 's', { w: WB.w * .6 }), S.dot(0, 46 * u, WB.w * .55),
    S.fill(polyRect(-22 * u, -36 * u, 44 * u, 70 * u, 4), { col: o.col || HL.blue, alpha: .9 })]);
  B('house', (u, o, k) => { const roof = [[-58 * u, -6 * u], [0, -56 * u], [58 * u, -6 * u]]; return [L(roof, k + 'r'), L([[-44 * u, -14 * u], [-44 * u, 48 * u], [44 * u, 48 * u], [44 * u, -14 * u]], k + 'w'),
    L([[-12 * u, 48 * u], [-12 * u, 14 * u], [12 * u, 14 * u], [12 * u, 48 * u]], k + 'd'), S.rect(18 * u, 0, 18 * u, 16 * u, { key: k + 'wi', w: WB.w * .6 }), S.fill([[-52 * u, -8 * u], [0, -52 * u], [52 * u, -8 * u]], { col: o.col || INK.red, alpha: .85 })]; });
  B('star', (u, o, k) => [S.star(0, 0, 52 * u, { key: k }), S.fill(S.star(0, 0, 50 * u, { key: k, wob: 0 }).p, { col: o.col || INK.yellow })]);
  B('chart', (u, o, k) => { const bars = [[-40, 26], [-12, 48], [16, 76]]; return [L([[-56 * u, -56 * u], [-56 * u, 44 * u], [60 * u, 44 * u]], k + 'ax'),
    ...bars.map(([x, h], i) => S.rect(x * u, (44 - h) * u, 20 * u, h * u, { key: k + i, w: WB.w * .7 })), ...bars.map(([x, h], i) => S.fill(polyRect(x * u, (44 - h) * u, 20 * u, h * u), { col: [INK.blue, INK.orange, INK.green][i], alpha: .85 })),
    ...S.arrow(-48 * u, 0, 44 * u, -62 * u, { bend: -.1, col: INK.red, key: k + 'a', head: 22 * u })]; });
  B('gear', (u, o, k) => { const p = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; for (const [da, r] of [[-.2, 36], [-.13, 48], [.13, 48], [.2, 36]]) p.push([r * u * Math.cos(a + da), r * u * Math.sin(a + da)]); } p.push(p[0]);
    return [L(p, k + 'g'), circ(0, 0, 14 * u, k + 'c'), S.fill(p, { col: o.col || '#B9C3D0', alpha: .9 })]; });
  B('mail', (u, o, k) => [S.rect(-56 * u, -36 * u, 112 * u, 72 * u, { key: k + 'r' }), L([[-54 * u, -32 * u], [0, 6 * u], [54 * u, -32 * u]], k + 'v'), S.fill(polyRect(-54 * u, -34 * u, 108 * u, 68 * u), { col: o.col || '#FFF3C4' })]);
  B('search', (u, o, k) => [circ(-10 * u, -10 * u, 34 * u, k + 'c'), L([[14 * u, 14 * u], [48 * u, 48 * u]], k + 'h', { w: WB.w * 1.6 }), S.fill(polyCircle(-10 * u, -10 * u, 32 * u), { col: o.col || HL.blue, alpha: .6 })]);
  B('target', (u, o, k) => [circ(0, 0, 48 * u, k + 'a'), circ(0, 0, 30 * u, k + 'b'), S.dot(0, 0, 11 * u, { col: INK.red }), S.fill(polyCircle(0, 0, 47 * u), { col: o.col || '#FFB3A8', alpha: .8 }), ...S.arrow(52 * u, -52 * u, 6 * u, -6 * u, { bend: 0, key: k + 'ar', head: 18 * u })]);
  B('cloud', (u, o, k) => [S.cloud(0, 0, 60 * u, 36 * u, { key: k }), S.fill(polyCircle(0, 0, 58 * u, 34 * u), { col: o.col || HL.blue, alpha: .5 })]);
  B('trophy', (u, o, k) => { const cup = [[-34 * u, -46 * u], [-30 * u, -8 * u], [-12 * u, 10 * u], [12 * u, 10 * u], [30 * u, -8 * u], [34 * u, -46 * u]]; return [L([...cup, [-34 * u, -46 * u]], k + 'c'),
    C([[-32 * u, -38 * u], [-52 * u, -36 * u], [-46 * u, -16 * u], [-28 * u, -12 * u]], k + 'l'), C([[32 * u, -38 * u], [52 * u, -36 * u], [46 * u, -16 * u], [28 * u, -12 * u]], k + 'r'),
    L([[0, 10 * u], [0, 30 * u]], k + 's'), S.rect(-24 * u, 30 * u, 48 * u, 16 * u, { key: k + 'b' }), S.fill(cup, { col: o.col || INK.yellow })]; });
  B('person', (u, o, k) => [circ(0, -34 * u, 18 * u, k + 'h'), C([[-30 * u, 46 * u], [-28 * u, 4 * u], [0, -10 * u], [28 * u, 4 * u], [30 * u, 46 * u]], k + 'b'), S.fill(polyCircle(0, 20 * u, 26 * u, 30 * u), { col: o.col || HL.blue, alpha: .7 })]);
}

// ---------- textures (built once in ENGINE.setup) ----------
const TEX = {}, _pats = new Map();
function _noiseTile(size, base, amp, key, extra) {
  const c = makeCanvas(size, size), x = c.getContext('2d'), r = rnd(key);
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  const id = x.getImageData(0, 0, size, size), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n * .9; }
  x.putImageData(id, 0, 0);
  // extras are drawn 9 times (wrapped) with the same seed so the tile repeats without seams
  if (extra) for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { x.save(); x.translate(dx, dy); extra(x, rnd(key + 'x'), size); x.restore(); }
  return c;
}
function _buildTextures() {
  // white board: faint speckle, large soft blotches, eraser swirls and ghosts of old writing
  TEX.white = _noiseTile(1024, INK.board, 5, 'wb', (x, r, s) => {
    for (let i = 0; i < 14; i++) { const cx = r() * s, cy = r() * s, rr = 120 + r() * 260, g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, `rgba(${r() < .5 ? '150,150,160' : '255,255,255'},${.012 + r() * .014})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }
    x.lineCap = 'round';
    for (let i = 0; i < 9; i++) {      // eraser swirl streaks
      x.strokeStyle = `rgba(140,145,155,${.007 + r() * .009})`; x.lineWidth = 40 + r() * 70; x.beginPath();
      const cx = r() * s, cy = r() * s, R = 60 + r() * 140; for (let a = 0; a < 4.2; a += .2) x.lineTo(cx + Math.cos(a) * R * (1 + a * .12), cy + Math.sin(a) * R * .55); x.stroke();
    }
    if (!WB.ghost) return;
    for (let i = 0; i < 26; i++) {     // ghost writing: short scribbly "words"
      x.filter = 'blur(2.5px)'; x.strokeStyle = `rgba(${r() < .25 ? '60,90,170' : '70,72,80'},${.014 + r() * .016})`; x.lineWidth = 5 + r() * 5; x.beginPath();
      let px = r() * s, py = r() * s; const n = 10 + (r() * 30 | 0);
      for (let k = 0; k < n; k++) { px += 5 + r() * 9; py += (r() - .5) * 18; x.lineTo(px, py + Math.sin(k * 1.9) * 10); }
      x.stroke();
    }
  });
  // notebook paper: cream fibres (lines are drawn in world space so they stay put)
  TEX.paper = _noiseTile(512, INK.paper, 9, 'pp', (x, r, s) => { for (let i = 0; i < 400; i++) { x.strokeStyle = `rgba(150,130,90,${.03 + r() * .04})`; x.lineWidth = 1; x.beginPath(); const px = r() * s, py = r() * s, a = r() * TAU, l = 4 + r() * 10; x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); } });
  TEX.wall = _noiseTile(512, INK.wall, 10, 'wl');
  TEX.felt = _noiseTile(128, '#8C9097', 30, 'ft');
  // soft screen-space light falloff
  const v = makeCanvas(W, H), vx = v.getContext('2d'), g = vx.createRadialGradient(W * .5, H * .45, H * .35, W * .5, H * .5, H * 1.05);
  g.addColorStop(0, 'rgba(90,80,60,0)'); g.addColorStop(1, 'rgba(90,80,60,.10)'); vx.fillStyle = g; vx.fillRect(0, 0, W, H); TEX.vignette = v;
}
// marker ink: the colour with a little fibrous unevenness (used as stroke/fill style, so it costs nothing per stroke)
function markerPat(ctx, col) {
  let p = _pats.get(col);
  if (!p) {
    const c = _noiseTile(96, col, 16, 'mk' + col, (x, r, s) => { x.globalAlpha = .07; for (let i = 0; i < 30; i++) { x.fillStyle = r() < .5 ? '#fff' : '#000'; x.fillRect(r() * s, r() * s, 1 + r() * 18, 1 + r() * 3); } });
    p = OUT.createPattern(c, 'repeat'); _pats.set(col, p);
  }
  return p;
}
function _lighter(col, k = .45) { return mixCol(col, '#FFFFFF', k); }

// ---------- board ----------
// board(o) → fills the visible world with the surface. kinds: 'white' (whiteboard), 'paper' (ruled notebook),
// 'grid' (squared paper). o.frame = [x,y,w,h] draws the physical whiteboard's aluminium frame with wall around it.
function board(o = WB.bg, ctx = G, cam = CAM) {
  const z = cam ? cam.zoom : 1, cx = cam ? cam.cx : W / 2, cy = cam ? cam.cy : H / 2, hw = W / 2 / z * 1.5 + 60, hh = H / 2 / z * 1.5 + 60;
  const x0 = cx - hw, y0 = cy - hh, ww = hw * 2, hh2 = hh * 2, kind = o.kind || 'white';
  ctx.save();
  ctx.fillStyle = ctx.createPattern(kind === 'white' ? TEX.white : TEX.paper, 'repeat'); ctx.fillRect(x0, y0, ww, hh2);
  if (kind === 'paper' || kind === 'grid') {
    const sp = o.spacing || (kind === 'grid' ? 48 : 64), top = o.top ?? -1e9;
    ctx.strokeStyle = kind === 'grid' ? 'rgba(90,150,210,.28)' : 'rgba(80,140,210,.42)'; ctx.lineWidth = kind === 'grid' ? 1.6 : 2.4; ctx.beginPath();
    for (let y = Math.ceil(Math.max(y0, top) / sp) * sp; y < y0 + hh2; y += sp) { ctx.moveTo(x0, y); ctx.lineTo(x0 + ww, y); }
    if (kind === 'grid') for (let x = Math.ceil(x0 / sp) * sp; x < x0 + ww; x += sp) { ctx.moveTo(x, y0); ctx.lineTo(x, y0 + hh2); }
    ctx.stroke();
    if (o.margin != null) { ctx.strokeStyle = 'rgba(220,70,70,.5)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(o.margin, y0); ctx.lineTo(o.margin, y0 + hh2); ctx.stroke(); }
  }
  if (o.frame) {
    const [fx, fy, fw, fh] = o.frame, b = 34;
    ctx.fillStyle = ctx.createPattern(TEX.wall, 'repeat'); ctx.beginPath(); ctx.rect(x0, y0, ww, hh2); ctx.rect(fx - b, fy - b, fw + 2 * b, fh + 2 * b); ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(fx - b + 10, fy + fh + b, fw + 2 * b - 4, 16);   // cast shadow
    const g = ctx.createLinearGradient(0, fy - b, 0, fy + fh + b); g.addColorStop(0, '#E9ECEF'); g.addColorStop(.5, '#C4C9CF'); g.addColorStop(1, '#AEB4BB');
    ctx.fillStyle = g; ctx.beginPath(); ctx.rect(fx - b, fy - b, fw + 2 * b, fh + 2 * b); ctx.rect(fx, fy, fw, fh); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(60,65,72,.45)'; ctx.lineWidth = 2; ctx.strokeRect(fx - b, fy - b, fw + 2 * b, fh + 2 * b); ctx.strokeRect(fx, fy, fw, fh);
    ctx.fillStyle = '#B7BDC4'; ctx.fillRect(fx + fw * .1, fy + fh + b - 4, fw * .8, 22); ctx.fillStyle = 'rgba(40,40,50,.25)'; ctx.fillRect(fx + fw * .1, fy + fh + b + 16, fw * .8, 6);   // pen tray
    const trayY = fy + fh + b + 2; [[.2, INK.blue], [.26, INK.red], [.72, INK.black]].forEach(([k, c]) => { ctx.fillStyle = '#F2F2EE'; ctx.fillRect(fx + fw * k, trayY - 6, 120, 16); ctx.fillStyle = c; ctx.fillRect(fx + fw * k + 96, trayY - 7, 30, 18); });
    ctx.fillStyle = 'rgba(90,95,100,.12)'; ctx.fillRect(fx, fy, fw, 6); ctx.fillRect(fx, fy, 6, fh);    // inner lip shadow
  }
  ctx.restore();
}

// ---------- the clock + camera + board in one call ----------
// wbBegin(lt, { cam: [cx,cy,zoom] | [[t,[cx,cy,zoom]], ...], bg: {kind, frame, margin}, drift: px, ease })
function wbBegin(lt, o = {}) {
  WB.clock = lt; if (o.bg) WB.bg = o.bg; else WB.bg = { kind: 'white' };
  let c = o.cam || [W / 2, H / 2, 1];
  if (Array.isArray(c[0])) c = kf(lt, c, o.ease || ease);
  const d = o.drift ?? 6;
  camBegin(c[0] + d * Math.sin(lt * .5), c[1] + d * .6 * Math.sin(lt * .37 + 1), c[2], c[3] || 0);
  board(WB.bg);
  return CAM;
}

// ---------- rendering strokes ----------
function _part(s, L) {           // the first L px of a stroke
  if (L >= s.len) return s.p;
  let i = 1; while (i < s.cum.length && s.cum[i] < L) i++;
  if (i >= s.p.length) return s.p;
  const a = s.p[i - 1], b = s.p[i], k = (L - s.cum[i - 1]) / ((s.cum[i] - s.cum[i - 1]) || 1);
  return [...s.p.slice(0, i), [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]];
}
function _ptAt(s, r) {
  if (s.kind === 'fill') { const [x, y, w, h] = s.bb, f = clamp(r); return [x + s.shift[0] + f * w, y + s.shift[1] + h * (.5 + .42 * Math.sin(f * TAU * Math.max(2, w / 70)))]; }
  const L = clamp(r) * s.len; let i = 1; while (i < s.cum.length - 1 && s.cum[i] < L) i++;
  const a = s.p[i - 1] || s.p[0], b = s.p[i] || a, k = clamp((L - s.cum[i - 1]) / ((s.cum[i] - s.cum[i - 1]) || 1));
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}
function renderStroke(ctx, s, r = 1) {
  if (r <= 0) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s.kind === 'fill') {
    ctx.globalAlpha = s.a; if (s.mode !== 'cover') ctx.globalCompositeOperation = 'multiply';
    const [x, y, w, h] = s.bb;
    if (r < 1) { const f = x + s.shift[0] - 30 + (w + 60) * r; ctx.beginPath(); ctx.moveTo(x - 60, y - 40); ctx.lineTo(f + 20, y - 40); ctx.lineTo(f - 20, y + h + 40); ctx.lineTo(x - 60, y + h + 40); ctx.clip(); }
    ctx.translate(s.shift[0], s.shift[1]); ctx.beginPath(); s.p.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = s.pat ? markerPat(ctx, s.col) : s.col; ctx.fill();
  } else {
    const pts = s.len < 1 ? s.p : _part(s, r * s.len);
    if (pts.length >= 2) {
      if (s.kind === 'hl') {
        ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = s.a; ctx.strokeStyle = s.col; ctx.lineWidth = s.w;
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      } else {
        ctx.globalAlpha = s.a; ctx.strokeStyle = markerPat(ctx, s.col);
        // width breathes along the stroke in ~40 px chunks (opaque ink, so the overlaps don't show)
        let st = 0, ci = 0, acc = 0;
        for (let i = 1; i < pts.length; i++) {
          acc += _d(pts[i - 1], pts[i]);
          if (acc >= 40 || i === pts.length - 1) {
            ctx.beginPath(); ctx.moveTo(pts[st][0], pts[st][1]); for (let j = st + 1; j <= i; j++) ctx.lineTo(pts[j][0], pts[j][1]);
            ctx.lineWidth = s.w * (1 + .1 * Math.sin(ci * 1.9 + s.seed) - (ci === 0 ? .04 : 0)); ctx.stroke(); st = i; ci++; acc = 0;
          }
        }
        if (s.w >= 5 && s.len > 30) {   // felt-tip streak
          ctx.globalAlpha = .16 * s.a; ctx.strokeStyle = _lighter(s.col, .6); ctx.lineWidth = s.w * .28; ctx.translate(s.w * .16, -s.w * .12);
          ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.translate(-s.w * .16, s.w * .12);
        }
        if (s.len > 12) {   // ink pools a little where the pen lands
          ctx.globalAlpha = .28 * s.a; ctx.fillStyle = mixCol(s.col, '#000000', .35); ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], s.w * .5, 0, TAU); ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}
// ink(strokes) → draw everything fully (no hand)
function ink(d, o = {}) { return drawOn(d, -2, -1, { ...o, hand: false }); }

// drawOn(strokes, a, b, o) → reveals the strokes in array order between times a and b (WB.clock), drawn in z order.
// o: { hand: false (no hand), all: true (every stroke at once), t: clock override, x, y (offset), alpha, gap }
// → { p, done, tip: [x,y] }
function drawOn(d, a, b, o = {}) {
  const list = flatStrokes(d); if (!list.length) return { p: 0, done: false };
  const c = o.t ?? WB.clock, p0 = b > a ? seg(c, a, b) : c >= a ? 1 : 0, pe = lerp(p0, ease(p0), .35);
  const gap = o.gap ?? WB.gap, cost = list.map((s, i) => Math.max(s.kind === 'fill' ? s.cost : s.len, 4) + (i ? gap : 0));
  const total = cost.reduce((x, y) => x + y, 0), rev = new Array(list.length);
  let Lr = pe * total, cur = -1, inGap = false;
  for (let i = 0; i < list.length; i++) {
    if (o.all) { rev[i] = pe; continue; }
    const g = i ? gap : 0, r = p0 >= 1 ? 1 : clamp((Lr - g) / (cost[i] - g));
    rev[i] = r; if (cur < 0 && Lr < cost[i]) { cur = i; inGap = Lr < g; }
    Lr -= cost[i];
  }
  if (cur < 0) cur = list.length - 1;
  const alpha = o.alpha ?? 1;
  if (p0 > 0 && alpha > 0) {
    G.save(); if (o.x || o.y) G.translate(o.x || 0, o.y || 0); if (alpha < 1) G.globalAlpha = alpha;
    const order = list.map((s, i) => i).sort((i, j) => (list[i].z - list[j].z) || i - j);
    for (const i of order) if (rev[i] > 0) renderStroke(G, list[i], rev[i]);
    G.restore();
  }
  // pen tip (local), and the interval for the hand
  let tip;
  if (o.all) tip = _ptAt(list[list.length - 1], pe);
  else if (inGap && cur > 0) { const k = clamp(((pe * total) - cost.slice(0, cur).reduce((x, y) => x + y, 0)) / gap); tip = arcPt(_ptAt(list[cur - 1], 1), _ptAt(list[cur], 0), 14, k); }
  else tip = _ptAt(list[cur], rev[cur]);
  if (o.x || o.y) tip = [tip[0] + (o.x || 0), tip[1] + (o.y || 0)];
  if (o.hand !== false && b > a) {
    const off = [o.x || 0, o.y || 0], s0 = _ptAt(list[0], 0), s1 = _ptAt(list[list.length - 1], 1);
    penRecord(a, b, [s0[0] + off[0], s0[1] + off[1]], [s1[0] + off[0], s1[1] + off[1]], tip, list[cur].kind === 'hl' ? list[cur].col : list[cur].col, list[cur].kind === 'hl' ? 'highlighter' : 'marker', o.handScale);
  }
  return { p: p0, done: p0 >= 1, tip };
}

// ---------- handwriting ----------
function _font(o) { return `${o.weight || 700} ${o.size || 72}px ${o.font || FONT_HAND}`; }
// layout of a (multi-line) string: x,y = first line's baseline start (align 'left'), centre ('center') or end ('right')
function textLayout(str, x, y, o = {}) {
  const size = o.size || 72, lh = size * (o.lh || 1.22), lines = String(str).split('\n'), out = [];
  G.save(); G.font = _font(o);
  let x0 = 1e9, x1 = -1e9;
  lines.forEach((ln, li) => {
    const ch = Array.from(ln), xs = [0]; let acc = '';
    for (const c of ch) { acc += c; xs.push(G.measureText(acc).width); }
    const w = xs[xs.length - 1], lx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    out.push({ ch, xs, w, x: lx, y: y + li * lh }); x0 = Math.min(x0, lx); x1 = Math.max(x1, lx + w);
  });
  G.restore();
  const top = y - size * .78, h = (lines.length - 1) * lh + size * 1.02;
  return { lines, rows: out, size, box: { x: x0, y: top, w: x1 - x0, h, cx: (x0 + x1) / 2, cy: top + h / 2, x2: x1, y2: top + h, base: y + (lines.length - 1) * lh } };
}
function textBox(str, x, y, o = {}) { return textLayout(str, x, y, o).box; }
// writeOn(text, x, y, a, b, o) → writes the text left to right as the hand moves, returns its box
// o: { size, col, weight, font, align, lh, hand, slant (deg of the reveal edge), jitter }
function writeOn(str, x, y, a, b, o = {}) {
  const L = textLayout(str, x, y, o), size = L.size, c = o.t ?? WB.clock;
  const wt = ch => /\s/.test(ch) ? .35 : 1;
  const items = []; let total = 0;
  L.rows.forEach((r, li) => { if (li) total += 1.2; r.ch.forEach((ch, i) => { const cw = (r.xs[i + 1] - r.xs[i]); const k = wt(ch) * Math.max(.6, cw / size * 1.7); items.push({ r, i, ch, cw, t0: total, k }); total += k; }); });
  const p = b > a ? seg(c, a, b) : c >= a ? 1 : 0, at = lerp(p, ease(p), .25) * total;
  const jit = o.jitter ?? 1, slant = Math.tan((o.slant ?? 14) * Math.PI / 180) * size;
  let tip = null, tcol = o.col || INK.black;
  if (p > 0) {
    G.save(); G.font = _font(o); G.textBaseline = 'alphabetic'; G.fillStyle = markerPat(G, tcol); if (o.alpha != null) G.globalAlpha = o.alpha;
    for (const it of items) {
      if (at <= it.t0) break;
      const f = clamp((at - it.t0) / it.k), h = hash(it.i * 7.1 + it.r.y * .13 + it.r.x * .07), gx = it.r.x + it.r.xs[it.i], gy = it.r.y + (h - .5) * size * .045 * jit;
      if (/\s/.test(it.ch)) continue;
      G.save();
      if (f < 1) { G.beginPath(); const fx = gx + f * (it.cw + slant * .6) - slant * .3; G.moveTo(gx - size * .3, gy - size * 1.1); G.lineTo(fx + slant * .5, gy - size * 1.1); G.lineTo(fx - slant * .5, gy + size * .45); G.lineTo(gx - size * .3, gy + size * .45); G.clip(); }
      G.translate(gx + it.cw / 2, gy); G.rotate((h - .5) * .06 * jit); G.fillText(it.ch, -it.cw / 2, 0);
      G.restore();
      if (f < 1) tip = [gx + f * it.cw, gy - size * (.18 + .32 * (.5 + .5 * Math.sin(f * TAU * 1.5 + it.i)))];
    }
    G.restore();
  }
  if (!tip) { const last = items[items.length - 1]; tip = at <= 0 || !last ? [L.rows[0].x, L.rows[0].y - size * .3] : [last.r.x + last.r.w, last.r.y - size * .2]; }
  if (o.hand !== false && b > a && items.length) {
    const r0 = L.rows[0], rl = L.rows[L.rows.length - 1];
    penRecord(a, b, [r0.x, r0.y - size * .3], [rl.x + rl.w, rl.y - size * .2], tip, tcol, 'marker', o.handScale);
  }
  return { ...L.box, p, done: p >= 1, tip };
}

// ---------- the hand ----------
// Scenes don't draw the hand: drawOn/writeOn record where the pen is, and ENGINE.end draws one hand that follows the
// active pen tip, glides between nearby drawings and leaves/enters the frame (bottom-right) across longer pauses.
// handAt(x, y, o) forces it somewhere (world coords) this frame, e.g. to point or hover; WB.hand = false hides it.
function penRecord(a, b, s0, s1, now, col, tool, sc) {
  const m = G.getTransform(), T2 = ([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  PEN.push({ a, b, s0: T2(s0), s1: T2(s1), now: T2(now), col, tool, sc: (sc || 1) * Math.pow(clamp(Math.hypot(m.a, m.b), .6, 1.8), .55) });
}
let _handForce = null;
function handAt(x, y, o = {}) { const m = G.getTransform(); _handForce = { p: [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f], tool: o.tool || 'marker', col: o.col || INK.black, lift: o.lift ?? 1, sc: o.scale || 1 }; }
function _handPos() {
  if (_handForce) return _handForce;
  if (!WB.hand || !PEN.length) return null;
  const c = WB.clock, ev = [...PEN].sort((x, y) => x.a - y.a);
  const act = ev.filter(e => c >= e.a && c <= e.b); if (act.length) { const e = act[act.length - 1]; return { p: e.now, tool: e.tool, col: e.col, lift: 0, sc: e.sc }; }
  const prev = ev.filter(e => e.b < c).sort((x, y) => x.b - y.b).pop(), next = ev.find(e => e.a > c);
  const offOf = p => [Math.max(p[0] + 420, W + 260), H + 380];
  if (prev && next && next.a - prev.b < 1.1) { const k = ease(seg(c, prev.b, next.a)); return { p: arcPt(prev.s1, next.s0, 50, k), tool: k < .5 ? prev.tool : next.tool, col: k < .5 ? prev.col : next.col, lift: Math.sin(k * Math.PI), sc: lerp(prev.sc, next.sc, k) }; }
  if (prev && c < prev.b + .6) { const k = easeIn(seg(c, prev.b, prev.b + .6)); return { p: [lerp(prev.s1[0], offOf(prev.s1)[0], k), lerp(prev.s1[1], offOf(prev.s1)[1], k)], tool: prev.tool, col: prev.col, lift: k, sc: prev.sc }; }
  if (next && c > next.a - .6) { const k = easeOut(seg(c, next.a - .6, next.a)); return { p: [lerp(offOf(next.s0)[0], next.s0[0], k), lerp(offOf(next.s0)[1], next.s0[1], k)], tool: next.tool, col: next.col, lift: 1 - k, sc: next.sc }; }
  return null;
}
const _handSprites = new Map();
// the hand + marker, drawn once per ink colour into a sprite; local frame: pen tip at (0,0), marker along +x
function _paintHand(x, tool, col) {
  const OL = '#5A3B2E', SK = '#F4CBA6', SH = '#E3A987', NL = '#FBE3D2';
  const blob = (pts, fill, stroke = OL, lw = 4) => { x.beginPath(); const q = catmull(pts, true, 4); q.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.lineJoin = 'round'; x.stroke(); } };
  const capsule = (a, b, r, fill) => { x.save(); x.lineCap = 'round'; x.strokeStyle = OL; x.lineWidth = 2 * r + 8; x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); x.strokeStyle = fill; x.lineWidth = 2 * r; x.stroke(); x.restore(); };
  x.lineJoin = 'round'; x.lineCap = 'round';
  if (tool === 'eraser') {
    // eraser block (seen from the handle side), anchor at its centre; hand grips it from the right
    x.save(); x.fillStyle = '#6E737B'; x.beginPath(); x.roundRect(-82, -168, 164, 336, 22); x.fill();
    x.fillStyle = '#2F63C7'; x.beginPath(); x.roundRect(-70, -156, 140, 312, 30); x.fill();
    x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.roundRect(-58, -144, 36, 288, 18); x.fill();
    x.strokeStyle = '#1F2B45'; x.lineWidth = 4; x.beginPath(); x.roundRect(-82, -168, 164, 336, 22); x.stroke();
    x.restore();
    blob([[30, -90], [80, -118], [140, -104], [176, -40], [172, 40], [140, 96], [70, 104], [36, 60], [26, -20]], SK);
    for (let i = 0; i < 4; i++) capsule([60, -84 + i * 42], [-36, -80 + i * 44], 18, SK);
    blob([[26, -110], [70, -128], [96, -100], [60, -80], [26, -84]], SK);
    x.strokeStyle = SH; x.lineWidth = 5; x.beginPath(); x.moveTo(120, -60); x.quadraticCurveTo(150, 0, 128, 70); x.stroke();
    return;
  }
  // marker body
  const HW = 19;
  x.fillStyle = col; x.beginPath(); x.moveTo(-2, -5); x.quadraticCurveTo(-6, 0, -2, 5); x.lineTo(20, 10); x.lineTo(20, -10); x.closePath(); x.fill();
  x.strokeStyle = '#2B2E33'; x.lineWidth = 3; x.stroke();
  const bar = (a, b, hw, fill) => { x.beginPath(); x.roundRect(a, -hw, b - a, 2 * hw, 7); x.fillStyle = fill; x.fill(); x.strokeStyle = '#2B2E33'; x.lineWidth = 3.5; x.stroke(); };
  bar(18, 360, HW, '#F3F3EF'); bar(18, 40, HW - 3, '#DADBD6');
  x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(44, -HW + 5, 300, 6);
  x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(44, HW - 9, 300, 7);
  bar(305, 372, HW + 3, col); x.fillStyle = col; x.fillRect(180, -HW + 2, 70, 2 * HW - 4);
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(308, -HW + 1, 60, 6);
  // curled fingers under the index (middle + ring), then palm, thumb, index finger on top
  capsule([236, 58], [176, 52], 21, SK);                                 // curled middle finger peeking under the thumb
  blob([[150, -36], [196, -66], [262, -74], [318, -56], [342, -6], [330, 50], [290, 84], [232, 88], [176, 70], [150, 30]], SK);
  x.fillStyle = SH; x.globalAlpha = .55; x.beginPath(); x.ellipse(268, 50, 58, 22, -.3, 0, TAU); x.fill(); x.globalAlpha = 1;
  // knuckle bumps on the back of the hand
  x.strokeStyle = SH; x.lineWidth = 4;[[214, -52], [248, -56], [282, -50]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b + 14, 12, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); });
  capsule([204, 64], [104, 30], 21, SK);                                  // thumb
  x.fillStyle = NL; x.beginPath(); x.ellipse(112, 30, 11, 8, .33, 0, TAU); x.fill();
  capsule([200, -42], [70, -38], 18, SK);                                 // index finger along the marker
  x.fillStyle = NL; x.beginPath(); x.ellipse(78, -40, 11, 8, 0, 0, TAU); x.fill();
  x.strokeStyle = SH; x.lineWidth = 4; x.beginPath(); x.arc(132, -34, 10, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
}
function _handSprite(tool, col) {
  const key = tool + col; let c = _handSprites.get(key); if (c) return c;
  const S2 = 760, A = 140; c = makeCanvas(S2, S2); const x = c.getContext('2d');
  // soft shadow on the board first (the hand is a few cm in front of it)
  const sh = makeCanvas(S2, S2), sx = sh.getContext('2d'); sx.translate(A + (tool === 'eraser' ? 240 : 0), A + (tool === 'eraser' ? 240 : 0)); _paintHand(sx, tool, '#000');
  x.save(); x.filter = 'blur(14px)'; x.globalAlpha = .2; x.globalCompositeOperation = 'source-over';
  x.drawImage(sh, 22, 30); x.restore();
  x.save(); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#28231E'; x.fillRect(0, 0, S2, S2); x.restore();
  x.save(); x.translate(A + (tool === 'eraser' ? 240 : 0), A + (tool === 'eraser' ? 240 : 0)); _paintHand(x, tool, col); x.restore();
  c.anchor = tool === 'eraser' ? [A + 240, A + 240] : [A, A]; _handSprites.set(key, c); return c;
}
// draws the hand in SCREEN space: tip at p, `ang` = marker direction (radians; ~0.7 = pointing up-left from lower right)
function drawHand(ctx, p, o = {}) {
  const tool = o.tool || 'marker', col = o.col || INK.black, sc = (o.sc || 1) * WB.handScale * (1 + .05 * (o.lift || 0));
  const ang = o.ang ?? (tool === 'eraser' ? .08 : .64 + .12 * (p[1] / H) - .1 * (p[0] / W) + .025 * Math.sin(WB.clock * 7));
  const lift = (o.lift || 0) * 10, spr = _handSprite(tool, col);
  ctx.save(); ctx.translate(p[0], p[1] - lift); ctx.rotate(ang); ctx.scale(sc, sc);
  // sleeve/forearm running off-frame (drawn per frame: too long for the sprite)
  const [wx, wy, da] = tool === 'eraser' ? [150, 110, .7] : [318, 30, .3], dx = Math.cos(da), dy = Math.sin(da), nx = -dy, ny = dx, L = 3000;
  const arm = (off, fill, hw0 = 64, hw1 = 96) => { ctx.beginPath(); ctx.moveTo(wx + nx * hw0 + off, wy + ny * hw0 + off); ctx.lineTo(wx + dx * L + nx * hw1 + off, wy + dy * L + ny * hw1 + off); ctx.lineTo(wx + dx * L - nx * hw1 + off, wy + dy * L - ny * hw1 + off); ctx.lineTo(wx - nx * hw0 + off, wy - ny * hw0 + off); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  arm(26, 'rgba(40,35,30,.10)', 74, 110); arm(16, 'rgba(40,35,30,.08)');
  ctx.drawImage(spr, -spr.anchor[0], -spr.anchor[1]);
  arm(0, WB.sleeve); ctx.strokeStyle = '#243E73'; ctx.lineWidth = 4; ctx.stroke();
  // cuff
  const cx0 = wx + dx * 8, cy0 = wy + dy * 8; ctx.beginPath(); ctx.moveTo(cx0 + nx * 70, cy0 + ny * 70); ctx.lineTo(cx0 + dx * 40 + nx * 74, cy0 + dy * 40 + ny * 74); ctx.lineTo(cx0 + dx * 40 - nx * 74, cy0 + dy * 40 - ny * 74); ctx.lineTo(cx0 - nx * 70, cy0 - ny * 70); ctx.closePath();
  ctx.fillStyle = _lighter(WB.sleeve, .25); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ---------- transitions ----------
let _mask = null, _tmp = null, _tmpCtx = null, _maskCtx = null, _prev = null, _prevCtx = null;
function _scratch() { if (!_mask) { _mask = makeCanvas(); _maskCtx = _mask.getContext('2d'); _tmp = makeCanvas(); _tmpCtx = _tmp.getContext('2d'); _prev = makeCanvas(); _prevCtx = _prev.getContext('2d'); } }
function _zigPath(rows, pad = 260) { const pts = []; for (let r = 0; r < rows; r++) { const y = H * (r + .5) / rows, L = r % 2 ? [W + pad, y] : [-pad, y], R = r % 2 ? [-pad, y] : [W + pad, y]; if (!r) pts.push([W + pad, y - 40], [-pad, y + 10]); else pts.push(L, R); } return resample(pts.slice(0), 12); }
// eraseWipe(p): an eraser (held by the hand) scrubs the whole screen clean in zigzag passes. Call in SCREEN space
// (after camEnd()) at the end of a shot: p = seg(lt, dur - .9, dur). A faint ghost of the old drawing stays behind.
function eraseWipe(p, o = {}) {
  if (p <= 0) return;
  _scratch(); const rows = o.rows || 4, path = _zigPath(rows), cum = cumOf(path), tot = cum[cum.length - 1], L = lerp(p, ease(p), .5) * tot;
  const part = _part({ p: path, cum, len: tot }, L);
  _maskCtx.setTransform(1, 0, 0, 1, 0, 0); _maskCtx.clearRect(0, 0, W, H);
  _maskCtx.lineCap = 'round'; _maskCtx.lineJoin = 'round'; _maskCtx.lineWidth = H / rows * 1.32; _maskCtx.strokeStyle = '#000';
  if (p >= 1) _maskCtx.fillRect(0, 0, W, H); else { _maskCtx.beginPath(); part.forEach((q, i) => i ? _maskCtx.lineTo(q[0], q[1]) : _maskCtx.moveTo(q[0], q[1])); _maskCtx.stroke(); }
  const t = _tmpCtx; t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, W, H);
  const cam = LAST_CAM || { cx: W / 2, cy: H / 2, zoom: 1, rot: 0 };
  t.save(); t.translate(W / 2, H / 2); t.rotate(cam.rot || 0); t.scale(cam.zoom, cam.zoom); t.translate(-cam.cx, -cam.cy); board(o.bg || WB.bg, t, cam); t.restore();
  t.globalAlpha = o.ghost ?? .06; t.drawImage(OUTC, 0, 0); t.globalAlpha = 1;
  t.globalCompositeOperation = 'destination-in'; t.drawImage(_mask, 0, 0); t.globalCompositeOperation = 'source-over';
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.drawImage(_tmp, 0, 0); G.restore();
  if (p < 1 && o.hand !== false) { const e = part[part.length - 1], q = part[Math.max(0, part.length - 4)]; _handForce = { p: e, tool: 'eraser', col: INK.black, lift: 0, sc: H / rows * 1.32 / 336 / WB.handScale, ang: .08 + clamp((e[0] - q[0]) / 60, -1, 1) * .06 }; }
}
// eraseRect(x, y, w, h, a, b): erase one area of the board (world coords) with the eraser between times a→b.
// The eraser scrubs it in horizontal passes; whatever surface the shot uses (lines, grid) is restored underneath.
function eraseRect(x, y, w, h, a, b, o = {}) {
  const p = seg(o.t ?? WB.clock, a, b); if (p <= 0) return;
  const rows = Math.max(1, Math.round(h / 150)), bh = h / rows, pad = 30, k = ease(p) * rows;
  G.save(); G.beginPath();
  let tip = null;
  for (let r = 0; r < rows; r++) {
    const f = clamp(k - r); if (f <= 0) break;
    const ry = y + bh * r - (r ? 0 : pad * .5), rh = bh + (r === rows - 1 ? pad : 0) + (r ? 0 : pad * .5), ww = (w + 2 * pad) * f;
    if (r % 2) G.rect(x + w + pad - ww, ry, ww, rh); else G.rect(x - pad, ry, ww, rh);
    if (f < 1) tip = [r % 2 ? x + w + pad - ww : x - pad + ww, y + bh * (r + .5)];
  }
  G.clip(); board(WB.bg); G.restore();
  if (p < 1 && tip && o.hand !== false) { const m = G.getTransform(); _handForce = { p: [m.a * tip[0] + m.c * tip[1] + m.e, m.b * tip[0] + m.d * tip[1] + m.f], tool: 'eraser', col: INK.black, lift: 0, sc: bh * 1.2 / 336 / WB.handScale * Math.hypot(m.a, m.b), ang: .08 }; }
}
// render the previous shot's last frame into a canvas (for page flips / cross-shot effects)
function prevShotFrame() {
  let i = 0; while (i + 1 < SHOTS.length && T >= SHOTS[i + 1][0]) i++;
  if (i === 0) return null;
  _scratch(); const t0 = SHOTS[i - 1][0], t1 = SHOTS[i][0] - 1 / FPS, saveG = G, saveCam = CAM, saveLast = LAST_CAM, clk = WB.clock, bg = WB.bg, pen = PEN.splice(0), hf = _handForce;
  const c = _prevCtx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
  G = c; CAM = null; WB._nested = true;
  try { SHOTS[i - 1][1](t1, t1 - t0, SHOTS[i][0] - t0); if (CAM) camEnd(); } finally { WB._nested = false; }
  G = saveG; CAM = saveCam; LAST_CAM = saveLast; WB.clock = clk; WB.bg = bg; PEN.length = 0; PEN.push(...pen); _handForce = hf;
  return _prev;
}
// pageFlip(p): the previous shot's page curls away from the bottom-right corner, revealing this shot underneath.
// Call in SCREEN space at the START of the new shot (after camEnd()): p = seg(lt, 0, .9).
function pageFlip(p, o = {}) {
  if (p >= 1 || WB._nested) return;
  const old = prevShotFrame(); if (!old) return;
  const k = easeIn(p) * .55 + ease(p) * .45, C = [W, H], P = [W - 2.4 * W * k - 20 * k, H - 1.15 * H * k - 60 * Math.sin(k * Math.PI)];
  const M = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2], d = [C[0] - P[0], C[1] - P[1]], dl = Math.hypot(...d) || 1, n = [d[0] / dl, d[1] / dl];
  const side = q => (q[0] - M[0]) * n[0] + (q[1] - M[1]) * n[1];     // > 0: the part that has flipped over
  const rect = [[0, 0], [W, 0], [W, H], [0, H]];
  const clipPoly = (poly, keep) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b); if (keep(sa)) out.push(a); if ((sa > 0) !== (sb > 0)) { const t = sa / (sa - sb); out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); } } return out; };
  const stay = clipPoly(rect, s => s <= 0), flap = clipPoly(rect, s => s > 0).map(q => { const s = side(q); return [q[0] - 2 * s * n[0], q[1] - 2 * s * n[1]]; });
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
  const path = poly => { G.beginPath(); poly.forEach((q, i) => i ? G.lineTo(q[0], q[1]) : G.moveTo(q[0], q[1])); G.closePath(); };
  if (stay.length > 2) { G.save(); path(stay); G.clip(); G.drawImage(old, 0, 0); G.restore(); }
  if (flap.length > 2) {
    // shadow of the lifted flap on the new page, the flap's back, and a crease highlight
    G.save(); G.translate(-n[0] * 18, -n[1] * 18); path(flap); G.fillStyle = 'rgba(40,35,25,.16)'; G.filter = 'blur(12px)'; G.fill(); G.restore();
    path(flap); const g = G.createLinearGradient(M[0], M[1], M[0] - n[0] * 500, M[1] - n[1] * 500);
    g.addColorStop(0, '#D9D4C6'); g.addColorStop(.25, '#F4F1E8'); g.addColorStop(1, '#FBF9F2'); G.fillStyle = g; G.fill();
    G.strokeStyle = 'rgba(60,55,45,.35)'; G.lineWidth = 2; G.stroke();
  }
  G.restore();
}
// panCarry: the classic "slide to the next part of the board" is ONE shot whose camera keys travel across a big world;
// use wbBegin(lt, { cam: [[0,[960,540,1]], [3.2,[960,540,1]], [4,[2900,540,1]]] }) and draw both areas in world coords.

// ---------- captions (overlay) ----------
// wbCaption(c, text, o): a clean white card with handwritten text at the bottom; *word* = accent colour.
// wbCaptions([[a, b, 'text'], ...], o) installs window.overlayHook to show them at video times a..b.
function wbCaption(c, txt, o = {}) {
  const size = o.size || 64, y = o.y || H - 88, k = o.k ?? 1, font = `700 ${size}px ${FONT_HAND}`, acc = o.accent || INK.orange;
  const parts = String(txt).split('*');
  c.save(); c.font = font; c.textBaseline = 'middle';
  const widths = parts.map(s => c.measureText(s).width), w = widths.reduce((a, b) => a + b, 0), pw = w + size * 1.3, ph = size * 1.55;
  c.globalAlpha = clamp(k * 1.6); c.translate(W / 2, y); c.scale(lerp(.85, 1, backOut(k)), lerp(.85, 1, backOut(k))); c.rotate(-.006);
  c.fillStyle = 'rgba(30,30,40,.18)'; c.beginPath(); c.roundRect(-pw / 2 + 4, -ph / 2 + 7, pw, ph, 18); c.fill();
  c.fillStyle = '#FFFFFF'; c.beginPath(); c.roundRect(-pw / 2, -ph / 2, pw, ph, 18); c.fill();
  c.strokeStyle = 'rgba(35,38,43,.9)'; c.lineWidth = 4; c.stroke();
  let x = -w / 2; parts.forEach((s, i) => { c.fillStyle = i % 2 ? acc : INK.black; c.fillText(s, x, size * .06); x += widths[i]; });
  c.restore();
}
function wbCaptions(list, o = {}) {
  window.overlayHook = (c, t) => { for (const [a, b, txt] of list) if (t >= a && t < b) wbCaption(c, txt, { ...o, k: Math.min(seg(t, a, a + .3), 1 - seg(t, b - .2, b)) }); };
}

// ---------- engine hooks ----------
function _loadText() {   // every character used in the page's scripts, so the CJK font slices get fetched up front
  let s = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~，。！？、：；「」…—';
  for (const el of document.scripts) if (el.src) { try { const x = new XMLHttpRequest(); x.open('GET', el.src, false); x.send(); s += x.responseText; } catch (e) { } }
  s += (window.WB_TEXT || '');
  return [...new Set(s)].filter(ch => ch.codePointAt(0) > 32).join('');
}
window.ENGINE = {
  async setup() {
    const txt = _loadText();
    await Promise.all(['400', '700'].flatMap(w => ['Kalam', 'LXGW WenKai TC'].map(f => document.fonts.load(`${w} 60px "${f}"`, txt).catch(() => null))));
    _buildTextures();
  },
  begin(t) { PEN.length = 0; _handForce = null; WB.clock = t; WB.bg = { kind: 'white' }; },
  end(t) {
    G.save(); G.setTransform(1, 0, 0, 1, 0, 0);
    const h = _handPos(); if (h) drawHand(G, h.p, h);
    G.globalCompositeOperation = 'multiply'; G.drawImage(TEX.vignette, 0, 0);
    G.restore();
  },
};
