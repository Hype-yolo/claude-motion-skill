// cutout.js: the paper cut-out / stop-motion drawing library (Canvas 2D, on top of kit.js).
//
// Everything is a piece of paper lying on a table under a warm lamp: construction paper, cardstock, kraft, felt, tissue
// and corrugated card, cut with scissors (slightly faceted, wobbly edges) or torn (a lighter fibrous rim). Each piece
// casts a soft drop shadow onto whatever is under it; the shadow's offset/blur is the piece's depth above the layer below.
// Puppets and props move in steps (PAPER.fps, default 12/s) with a tiny per-step placement jitter and light flicker.
//
// Conventions: sizes in world pixels, ALL ANGLES IN DEGREES, every function is a pure function of time (use sm()).
// See GUIDE.md for the full API with examples.

const D2R = Math.PI / 180;
const PAPER = {
  fps: 12,              // stop-motion step rate: puppets/props change pose this many times a second (use sm(lt))
  jit: 0,               // current per-step placement jitter in px (cast.js sets it while drawing a puppet)
  light: [0.5, 0.86],   // direction shadows fall (light from top-left → shadows to the bottom-right)
  shadow: 1,            // global drop-shadow strength
  flicker: 1,           // per-step exposure flicker strength (0 = off)
  grain: 1,             // photographic grain strength
  vignette: 1,          // warm lamp falloff at the frame edges
  step: 0,              // the stop-motion step index of the frame being drawn: floor(t * fps)
  dry: false,           // true = measure only: piece/brad/thread draw nothing (puppet(..., { dry: true }) uses it)
};
// the stop-motion clock: hold time in steps. Drive every puppet/prop pose with sm(lt), not lt.
const sm = (lt, fps = PAPER.fps) => onStep(lt, fps);
// stepped periodic sway for set dressing: amp * sin(...), phase from a key
const sway = (key, amp = 1, f = .5, fps = PAPER.fps) => amp * Math.sin((onStep(T, fps) * f + hash(String(key).length * 3.1 + keyNum(key))) * TAU);
function keyNum(k) { let h = 0; for (const c of String(k)) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; }

// ---------- palette: construction paper colours ----------
const PC = {
  white: '#FAF6EC', cream: '#F3E7CF', paper: '#EFE3C8', sand: '#E6CFA0', kraft: '#C39767', cork: '#B07E50', brown: '#865437', bark: '#6B4430',
  ink: '#2E2630', charcoal: '#45404A', grey: '#A29C94', silver: '#CFCBC3',
  red: '#D6402F', tomato: '#E8603C', orange: '#EF8733', tangerine: '#F5A043', mustard: '#E7B23A', yellow: '#F4D05A', lemon: '#F6E382',
  lime: '#B3CC4E', leaf: '#76AE48', grass: '#5E9A3E', forest: '#3F7A45', pine: '#2F5E44', mint: '#A6D8BC', sage: '#9DBE93',
  teal: '#2C9A93', aqua: '#7FCFCB', sky: '#9CCFE9', blue: '#3E7EC2', cobalt: '#2E5DA8', navy: '#2A3F6E',
  lilac: '#B7A0D8', violet: '#7E5CB0', plum: '#7A4A84', pink: '#F4A7B6', rose: '#E26D8A', blush: '#F7C2C4', peach: '#F8C49A', skin: '#F6D6BA',
};

// ---------- noise ----------
function vn1(x, s = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i * .713 + s * 17.31), hash((i + 1) * .713 + s * 17.31), u); }
const fbm1 = (x, s = 0) => vn1(x, s) * .55 + vn1(x * 2.13, s + 1) * .28 + vn1(x * 4.71, s + 2) * .17;

// ---------- materials: procedural paper textures, generated once and cached ----------
// mat(col, kind) → a CanvasPattern of that colour in that material. kinds:
//   paper (construction paper, default) · card (smooth cardstock) · kraft (brown fibres, specks) · felt (fuzzy)
//   tissue (see-through, multiplies over what's under it) · corr (corrugated card flutes) · wood (table top)
const GRAIN_SPEC = {
  paper: { mott: 9, mid: 6, fine: 7, fib: 520, fibL: [4, 18], fibA: .09, specks: 70, str: .6 },
  card: { mott: 4, mid: 3, fine: 4, fib: 90, fibL: [3, 10], fibA: .05, specks: 16, str: .5 },
  kraft: { mott: 14, mid: 9, fine: 9, fib: 1100, fibL: [5, 24], fibA: .15, specks: 260, str: .75 },
  felt: { mott: 12, mid: 14, fine: 26, fib: 2400, fibL: [3, 9], fibA: .16, specks: 0, str: .85 },
  tissue: { mott: 6, mid: 4, fine: 3, fib: 50, fibL: [8, 24], fibA: .05, specks: 0, creases: 26, str: .7 },
  corr: { mott: 8, mid: 5, fine: 6, fib: 400, fibL: [4, 14], fibA: .1, specks: 60, flutes: 16, str: .85 },
  wood: { mott: 10, mid: 0, fine: 5, fib: 0, fibL: [4, 8], fibA: 0, specks: 0, wood: 1, str: .9 },
};
const GRAIN = {}, MATC = new Map();
function makeGrain(kind) {
  const S = 512, sp = GRAIN_SPEC[kind] || GRAIN_SPEC.paper, c = makeCanvas(S, S), x = c.getContext('2d'), r = rnd('grain:' + kind);
  const lat = n => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };
  const L1 = lat(6), L2 = lat(24);
  const pn = (L, n, px, py) => {
    const gx = px / S * n, gy = py / S * n, i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), g = (i, j) => L[(j % n) * n + (i % n)];
    return lerp(lerp(g(i0, j0), g(i0 + 1, j0), ux), lerp(g(i0, j0 + 1), g(i0 + 1, j0 + 1), ux), uy);
  };
  const id = x.createImageData(S, S), d = id.data;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    let v = 128 + sp.mott * (pn(L1, 6, px, py) - .5) * 2 + sp.mid * (pn(L2, 24, px, py) - .5) * 2 + sp.fine * (r() - .5) * 2;
    if (sp.flutes) v += 26 * Math.sin((px % sp.flutes) / sp.flutes * TAU);
    if (sp.wood) { const w = py + 22 * Math.sin(px * TAU * 2 / S) + 30 * pn(L1, 6, px, py); v += 10 * Math.sin(w * TAU * 38 / S) + 6 * Math.sin(w * TAU * 97 / S); }
    const k = (py * S + px) * 4; d[k] = d[k + 1] = d[k + 2] = clamp(v, 0, 255); d[k + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  const wrap = (fn, bx, by, m) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { if (bx + ox < -m || bx + ox > S + m || by + oy < -m || by + oy > S + m) continue; fn(ox, oy); } };
  x.lineCap = 'round';
  for (let i = 0; i < sp.fib; i++) {   // fibres
    const fx = r() * S, fy = r() * S, L = lerp(sp.fibL[0], sp.fibL[1], r()), a = r() * TAU, b = (r() - .5) * 1.2, light = r() < .55;
    x.strokeStyle = light ? `rgba(255,255,255,${sp.fibA * (1 + r())})` : `rgba(0,0,0,${sp.fibA * (.6 + r())})`; x.lineWidth = .5 + r() * .9;
    wrap((ox, oy) => { x.beginPath(); x.moveTo(fx + ox, fy + oy); x.quadraticCurveTo(fx + ox + Math.cos(a + b) * L * .5, fy + oy + Math.sin(a + b) * L * .5, fx + ox + Math.cos(a) * L, fy + oy + Math.sin(a) * L); x.stroke(); }, fx, fy, 30);
  }
  for (let i = 0; i < sp.specks; i++) {
    const fx = r() * S, fy = r() * S, rr = .5 + r() * 1.4, dark = kind === 'kraft' ? r() < .8 : r() < .5;
    x.fillStyle = dark ? `rgba(40,20,5,${.12 + r() * .25})` : `rgba(255,255,255,${.2 + r() * .3})`;
    wrap((ox, oy) => { x.beginPath(); x.arc(fx + ox, fy + oy, rr, 0, TAU); x.fill(); }, fx, fy, 4);
  }
  for (let i = 0; i < (sp.creases || 0); i++) {   // tissue creases: long light/dark line pairs
    const fx = r() * S, fy = r() * S, a = r() * TAU, L = 60 + r() * 180, dx = Math.cos(a) * L, dy = Math.sin(a) * L, bx = (r() - .5) * 30;
    wrap((ox, oy) => {
      x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(fx + ox, fy + oy); x.quadraticCurveTo(fx + ox + dx / 2 + bx, fy + oy + dy / 2 - bx, fx + ox + dx, fy + oy + dy); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.moveTo(fx + ox + 1.5, fy + oy + 1.5); x.quadraticCurveTo(fx + ox + dx / 2 + bx + 1.5, fy + oy + dy / 2 - bx + 1.5, fx + ox + dx + 1.5, fy + oy + dy + 1.5); x.stroke();
    }, fx + dx / 2, fy + dy / 2, L);
  }
  return c;
}
function mat(col, kind = 'paper') {
  const key = kind + col; let p = MATC.get(key); if (p) return p;
  const g = GRAIN[kind] || (GRAIN[kind] = makeGrain(kind)), S = g.width, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, S, S);
  x.globalAlpha = (GRAIN_SPEC[kind] || GRAIN_SPEC.paper).str; x.globalCompositeOperation = 'overlay'; x.drawImage(g, 0, 0);
  x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.drawImage(c, 0, 0);
  p = x.createPattern(c, 'repeat'); MATC.set(key, p); return p;
}
// the pattern, shifted by a per-piece offset so neighbouring pieces don't share the same fibres
function matPat(col, kind, seed = 0) { const p = mat(col, kind); p.setTransform(new DOMMatrix([1, 0, 0, 1, hash(seed * 3.7) * 512, hash(seed * 5.3 + 1) * 512])); return p; }
const rimOf = col => mixCol(col, '#FBF6EA', .72);        // the lighter fibrous core seen on a torn edge

// ---------- shadows ----------
function curScale(c = G) { const m = c.getTransform(); return Math.hypot(m.a, m.b) || 1; }
// depth = how high the piece floats above what's under it (0 flat … 1 normal piece … 3 lifted card)
function setShadow(depth = 1, k = curScale(), alpha = 1, c = G) {
  const s = PAPER.shadow * depth;
  if (s <= 0) { c.shadowColor = 'transparent'; return; }
  c.shadowColor = `rgba(48,28,14,${Math.min(.6, (.2 + .09 * s) * alpha)})`;
  const off = (1.5 + 4.5 * s) * k; c.shadowOffsetX = PAPER.light[0] * off; c.shadowOffsetY = PAPER.light[1] * off; c.shadowBlur = (2 + 6 * s) * k;
}
function noShadow(c = G) { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = c.shadowOffsetY = 0; }

// ---------- shapes: dense outlines [x, y, corner?] with a .key (for caching the cut) ----------
const f1 = v => Math.round(v * 10) / 10;
const keyed = (a, k) => (a.key = k, a);
const SH = {
  ellipse(rx, ry = rx) {
    const n = clamp(Math.round((rx + ry) * .5), 18, 200), a = [];
    for (let i = 0; i < n; i++) { const t = i / n * TAU; a.push([Math.cos(t) * rx, Math.sin(t) * ry]); }
    return keyed(a, `e${f1(rx)},${f1(ry)}`);
  },
  circle(r) { return SH.ellipse(r, r); },
  poly(pts, key) {   // straight-edged polygon; every vertex is a sharp scissor corner
    const a = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 9));
      a.push([p[0], p[1], 1]); for (let j = 1; j < n; j++) a.push([lerp(p[0], q[0], j / n), lerp(p[1], q[1], j / n)]);
    }
    return keyed(a, key || 'p' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(';'));
  },
  rect(w, h) { return SH.poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], `r${f1(w)},${f1(h)}`); },
  round(w, h, r) {   // rounded rectangle, centred
    r = Math.min(r, w / 2, h / 2); const a = [], cs = [[w / 2 - r, -h / 2 + r, -90], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180]];
    const na = clamp(Math.round(r * .4), 3, 30);
    cs.forEach(([cx, cy, a0], k) => {
      for (let i = 0; i <= na; i++) { const t = (a0 + 90 * i / na) * D2R; a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
      const [nx, ny] = cs[(k + 1) % 4], ex = cx + Math.cos((a0 + 90) * D2R) * r, ey = cy + Math.sin((a0 + 90) * D2R) * r, fx = nx + Math.cos((a0 + 90) * D2R) * r, fy = ny + Math.sin((a0 + 90) * D2R) * r;
      const L = Math.hypot(fx - ex, fy - ey), m = Math.round(L / 10); for (let j = 1; j < m; j++) a.push([lerp(ex, fx, j / m), lerp(ey, fy, j / m)]);
    });
    return keyed(a, `R${f1(w)},${f1(h)},${f1(r)}`);
  },
  // closed Catmull-Rom curve through control points: the general tool for organic pieces (bodies, heads, leaves)
  smooth(ctrl, key) {
    const a = [], n = ctrl.length;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = clamp(Math.round(L / 5), 2, 60);
      for (let j = 0; j < m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t;
        const f = (a0, a1, a2, a3) => .5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
        a.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), j === 0 && p1[2] ? 1 : 0]);
      }
    }
    return keyed(a, key || 's' + ctrl.map(p => f1(p[0]) + ',' + f1(p[1])).join(';'));
  },
  // limb piece from (0,0) down to (0,len), round ends of radius r0 / r1 (joints sit at the two centres)
  capsule(len, r0, r1 = r0) {
    const a = [], n0 = clamp(Math.round(r0 * .5), 6, 30), n1 = clamp(Math.round(r1 * .5), 6, 30);
    for (let i = 0; i <= n0; i++) { const t = Math.PI + Math.PI * i / n0; a.push([Math.cos(t) * r0, Math.sin(t) * r0]); }
    const m = Math.max(1, Math.round(len / 10)); for (let j = 1; j < m; j++) a.push([lerp(r0, r1, j / m), len * j / m]);
    for (let i = 0; i <= n1; i++) { const t = Math.PI * i / n1; a.push([Math.cos(t) * r1, len + Math.sin(t) * r1]); }
    for (let j = m - 1; j >= 1; j--) a.push([-lerp(r0, r1, j / m), len * j / m]);
    return keyed(a, `c${f1(len)},${f1(r0)},${f1(r1)}`);
  },
  blob(r, n = 7, amt = .15, seed = 1) { const q = rnd('blob' + seed), c = []; for (let i = 0; i < n; i++) { const t = i / n * TAU; const rr = r * (1 + (q() - .5) * 2 * amt); c.push([Math.cos(t) * rr, Math.sin(t) * rr]); } return SH.smooth(c, `b${f1(r)},${n},${amt},${seed}`); },
  // scalloped cloud: flat-ish bottom, round bumps on top; centred on the bottom edge's middle
  cloud(w, h, seed = 1) {
    const q = rnd('cloud' + seed), a = [], bumps = 3 + Math.floor(q() * 2);
    const ws = []; let tot = 0; for (let i = 0; i < bumps; i++) { const v = .7 + q() * .6 + (i > 0 && i < bumps - 1 ? .5 : 0); ws.push(v); tot += v; }
    let x0 = -w / 2;
    for (let i = 0; i < bumps; i++) {
      const bw = ws[i] / tot * w, cx = x0 + bw / 2, env = Math.sin(Math.PI * (cx + w / 2) / w), top = h * (.35 + .65 * env), r = bw / 2;
      for (let j = 0; j <= 24; j++) { const t = Math.PI + Math.PI * j / 24; a.push([cx + Math.cos(t) * r, -top + r * .15 + Math.sin(t) * Math.min(r, top) * 1.0 - 0]); }
      x0 += bw;
    }
    a.push([w / 2, -h * .12]); a.push([w / 2 - h * .15, 0, 1]); for (let j = 1; j < 8; j++) a.push([w / 2 - h * .15 - (w - h * .3) * j / 8, 0 + Math.sin(j * 1.7) * 1.5]); a.push([-w / 2 + h * .15, 0, 1]); a.push([-w / 2, -h * .12]);
    return keyed(a, `cl${f1(w)},${f1(h)},${seed}`);
  },
  leaf(len, w) {   // pointed at both ends, from (0,0) to (0,-len)
    const a = [], n = clamp(Math.round(len / 5), 8, 60);
    for (let i = 0; i <= n; i++) { const t = i / n; a.push([Math.sin(t * Math.PI) * w / 2, -len * t, i === 0 || i === n ? 1 : 0]); }
    for (let i = n - 1; i >= 1; i--) { const t = i / n; a.push([-Math.sin(t * Math.PI) * w / 2 * .92, -len * t]); }
    return keyed(a, `lf${f1(len)},${f1(w)}`);
  },
  heart(s) { const a = []; for (let i = 0; i < 60; i++) { const t = i / 60 * TAU, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); a.push([x * s / 32, y * s / 32, i === 0 || i === 30 ? 1 : 0]); } return keyed(a, `h${f1(s)}`); },
  star(r1, r2 = r1 * .45, n = 5) { const p = []; for (let i = 0; i < n * 2; i++) { const t = (i / (n * 2)) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1; p.push([Math.cos(t) * r, Math.sin(t) * r]); } return SH.poly(p, `st${f1(r1)},${f1(r2)},${n}`); },
  drop(r) { const a = []; for (let i = 0; i < 40; i++) { const t = i / 40 * TAU, k = Math.sin(t / 2); a.push([Math.sin(t) * r * k * 1.05, -Math.cos(t) * r * 1.3 + r * .3, i === 0 ? 1 : 0]); } return keyed(a, `d${f1(r)}`); },
  tri(w, h) { return SH.poly([[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], `t${f1(w)},${f1(h)}`); },
  // a curved band (smile, brow, rainbow): centre radius r, thickness th, from angle a0 to a1 (deg, 0 = right, 90 = down)
  band(r, th, a0, a1) {
    const a = [], n = clamp(Math.round(Math.abs(a1 - a0) / 6), 6, 60), ro = r + th / 2, ri = r - th / 2, cap = th / 2, dir = a1 > a0 ? 1 : -1;
    const P = (rad, deg) => [Math.cos(deg * D2R) * rad, Math.sin(deg * D2R) * rad];
    const capAt = (deg, fwd) => { const t = deg * D2R, u = [Math.cos(t), Math.sin(t)], v = [-Math.sin(t) * dir * fwd, Math.cos(t) * dir * fwd], c = P(r, deg);
      for (let i = 1; i < 8; i++) { const f = i / 8 * Math.PI, cu = Math.cos(f) * fwd, sv = Math.sin(f); a.push([c[0] + (u[0] * cu + v[0] * sv) * cap, c[1] + (u[1] * cu + v[1] * sv) * cap]); } };
    for (let i = 0; i <= n; i++) a.push(P(ro, lerp(a0, a1, i / n)));
    capAt(a1, 1);
    for (let i = n; i >= 0; i--) a.push(P(ri, lerp(a0, a1, i / n)));
    capAt(a0, -1);
    return keyed(a, `bd${f1(r)},${f1(th)},${f1(a0)},${f1(a1)}`);
  },
  // a strip with a zig-zag top (grass, fringe): x from -w/2..w/2, base at y=0, teeth up to -h
  zig(w, h, n = 12, seed = 1) {
    const q = rnd('zig' + seed), a = [[w / 2, 0, 1], [-w / 2, 0, 1]];
    for (let i = 0; i <= n * 2; i++) { const x = -w / 2 + w * i / (n * 2), up = i % 2 === 1; a.push([x + (q() - .5) * w / n * .3, up ? -h * (.6 + q() * .4) : -h * (.05 + q() * .12), 1]); }
    return SH.poly(a, `z${f1(w)},${f1(h)},${n},${seed}`);
  },
  // rolling hill band: top edge around y=0 (± h/2), x from -w/2..w/2, reaching down `down` px
  hills(w, h, n = 3, seed = 1, down = 1400) {
    const q = rnd('hill' + seed), ph = [q() * TAU, q() * TAU, q() * TAU], c = [];
    const top = x => -h / 2 * (Math.sin(x / w * TAU * n * .5 + ph[0]) * .65 + Math.sin(x / w * TAU * n * 1.3 + ph[1]) * .25 + Math.sin(x / w * TAU * n * 3.1 + ph[2]) * .1);
    const m = Math.round(w / 12); for (let i = 0; i <= m; i++) { const x = -w / 2 + w * i / m; c.push([x, top(x), i === 0 || i === m ? 1 : 0]); }
    c.push([w / 2, down, 1]); c.push([-w / 2, down, 1]);
    return keyed(c, `hl${f1(w)},${f1(h)},${n},${seed},${down}`);
  },
};
// keep the part of a shape on one side of a line (n·p ≤ c): eyelids, overall bibs, half moons
function clipHalf(shape, nx, ny, c) {
  const out = [], n = shape.length, inside = p => nx * p[0] + ny * p[1] <= c;
  for (let i = 0; i < n; i++) {
    const p = shape[i], q = shape[(i + 1) % n], a = inside(p), b = inside(q);
    if (a) out.push(p);
    if (a !== b) { const dp = nx * p[0] + ny * p[1] - c, dq = nx * q[0] + ny * q[1] - c, k = dp / (dp - dq); out.push([lerp(p[0], q[0], k), lerp(p[1], q[1], k), 1]); }
  }
  return keyed(out, (shape.key || '') + `|${f1(nx * 100)},${f1(ny * 100)},${f1(c)}`);
}
// move / scale a shape's points (returns a new keyed shape)
function xform(shape, dx = 0, dy = 0, sx = 1, sy = sx) { return keyed(shape.map(p => [p[0] * sx + dx, p[1] * sy + dy, p[2]]), (shape.key || '') + `|x${f1(dx)},${f1(dy)},${f1(sx * 100)},${f1(sy * 100)}`); }

// ---------- cutting: scissor facets & wobble, or torn edges ----------
const CUTS = new Map();
function normalsOf(pts) {
  const n = pts.length; let area = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
  const s = area > 0 ? 1 : -1, N = [];
  for (let i = 0; i < n; i++) { const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n]; let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; N.push([s * dy / L, -s * dx / L]); }
  return N;
}
function toPath(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }
function buildCut(shape, seed, o) {
  const r = rnd('cut' + seed), n = shape.length, N = normalsOf(shape);
  let per = 0; for (let i = 0; i < n; i++) { const p = shape[i], q = shape[(i + 1) % n]; per += Math.hypot(q[0] - p[0], q[1] - p[1]); }
  if (o.torn) return buildTorn(shape, seed, o, N);
  const wob = o.wob ?? Math.min(1.4, .3 + per / 1000), s0 = clamp(per / 46, 2, 16), s1 = clamp(per / 13, 4.5, 30);
  let out = [], acc = 0, next = lerp(s0, s1, r());
  for (let i = 0; i < n; i++) {
    const p = shape[i], q = shape[(i - 1 + n) % n]; acc += Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (p[2] || acc >= next || i === 0) { const d = (r() - .5) * 2 * (p[2] ? wob * .3 : wob); out.push([p[0] + N[i][0] * d, p[1] + N[i][1] * d]); acc = 0; next = lerp(s0, s1, r()); }
  }
  if (out.length < 3) out = shape.map(p => [p[0], p[1]]);
  return { outer: toPath(out) };
}
function buildTorn(shape, seed, o, N) {
  const amp = o.tornAmp ?? 5, rimW = o.rimW ?? amp * .9, sel = o.torn, q = rnd('tear' + seed);
  const on = nv => sel === true || sel === 'all' ? 1 : sel === 'top' ? nv[1] < -.35 : sel === 'bottom' ? nv[1] > .35 : sel === 'left' ? nv[0] < -.35 : sel === 'right' ? nv[0] > .35 : sel === 'sides' ? Math.abs(nv[0]) > .35 : 0;
  // resample densely so the tear has fine detail
  const dense = [], n = shape.length;
  for (let i = 0; i < n; i++) {
    const p = shape[i], nx = shape[(i + 1) % n], L = Math.hypot(nx[0] - p[0], nx[1] - p[1]), m = Math.max(1, Math.round(L / 2.5));
    for (let j = 0; j < m; j++) dense.push([lerp(p[0], nx[0], j / m), lerp(p[1], nx[1], j / m), j === 0 ? p[2] : 0]);
  }
  const DN = normalsOf(dense), outer = [], inner = [], fib = new Path2D(); let s = 0;
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i], pv = dense[(i - 1 + dense.length) % dense.length]; s += Math.hypot(p[0] - pv[0], p[1] - pv[1]);
    const t = on(DN[i]) ? 1 : 0;
    if (!t) { outer.push([p[0], p[1]]); inner.push([p[0], p[1]]); continue; }
    const jag = (fbm1(s / 26, seed) - .5) * 2 * amp + (q() - .5) * amp * .45, rim = rimW * (.35 + .9 * fbm1(s / 11, seed + 7));
    const ox = p[0] + DN[i][0] * jag, oy = p[1] + DN[i][1] * jag;
    outer.push([ox, oy]); inner.push([ox - DN[i][0] * rim, oy - DN[i][1] * rim]);
    if (q() < .22) { const fl = 1.5 + q() * amp * .7, a = (q() - .5) * 1.4, cx = DN[i][0] * Math.cos(a) - DN[i][1] * Math.sin(a), cy = DN[i][0] * Math.sin(a) + DN[i][1] * Math.cos(a); fib.moveTo(ox - DN[i][0], oy - DN[i][1]); fib.lineTo(ox + cx * fl, oy + cy * fl); }
  }
  return { outer: toPath(outer), inner: toPath(inner), fib };
}
function cutOf(shape, seed, o) {
  const ck = shape.key != null ? `${shape.key}|${seed}|${o.torn || ''}|${o.wob ?? ''}|${o.tornAmp ?? ''}` : null;
  let P = ck && CUTS.get(ck);
  if (!P) { P = buildCut(shape, seed, o); if (ck) { if (CUTS.size > 8000) CUTS.clear(); CUTS.set(ck, P); } }
  return P;
}

// ---------- the piece: one cut-out on the table ----------
// piece(shape, { x, y, rot (deg), sx, sy, col, mat, depth, seed, torn, tornAmp, rim, alpha, jit, edge, hi })
//   torn: true | 'top' | 'bottom' | 'left' | 'right' | 'sides' → torn edge(s) with a lighter fibrous rim
//   depth: shadow height (0 = glued flat, 1 = a normal layer, 2–3 = lifted); jit: per-step jitter px (default PAPER.jit)
function piece(shape, o = {}) {
  if (PAPER.dry || !shape || shape.length < 3) return;
  const seed = o.seed ?? 1, col = o.col || PC.cream, kind = o.mat || 'paper', P = cutOf(shape, seed, o);
  let x = o.x || 0, y = o.y || 0, rot = o.rot || 0;
  const jit = o.jit ?? PAPER.jit;
  if (jit) { const h = seed * 13.17 + PAPER.step * 7.31; x += (hash(h) - .5) * 2 * jit; y += (hash(h + 1.7) - .5) * 2 * jit; rot += (hash(h + 3.1) - .5) * .7 * jit; }
  G.save(); G.translate(x, y); if (rot) G.rotate(rot * D2R); if (o.sx != null || o.sy != null) G.scale(o.sx ?? 1, o.sy ?? o.sx ?? 1);
  const k = curScale(), tissue = kind === 'tissue';
  if (o.alpha != null) G.globalAlpha *= o.alpha;
  if (tissue) { G.globalAlpha *= .8; G.globalCompositeOperation = 'multiply'; }
  setShadow((o.depth ?? 1) * (tissue ? .35 : 1), k);
  const pat = matPat(col, kind, seed);
  if (P.inner) {
    G.fillStyle = o.rim || rimOf(col); G.fill(P.outer); noShadow();
    G.lineWidth = .9 / k * (k > 1 ? k * .7 : 1); G.strokeStyle = o.rim || rimOf(col); G.stroke(P.fib);
    G.fillStyle = pat; G.fill(P.inner);
  } else { G.fillStyle = pat; G.fill(P.outer); noShadow(); }
  if (!tissue && o.edge !== false) { G.lineWidth = Math.max(.8, 1.3 / k); G.strokeStyle = 'rgba(52,30,16,.2)'; G.stroke(P.outer); }
  if (o.hi) { G.globalCompositeOperation = 'source-atop'; }   // reserved
  G.restore();
}
// a split-pin paper fastener (brass brad) at a joint
function brad(x, y, r = 6, o = {}) {
  if (PAPER.dry) return;
  G.save(); G.translate(x, y); const k = curScale();
  setShadow(.35, k);
  const g = G.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
  g.addColorStop(0, o.hi || '#FFF2B8'); g.addColorStop(.45, o.col || '#D9AE4B'); g.addColorStop(1, o.lo || '#8A6420');
  G.fillStyle = g; G.beginPath(); G.arc(0, 0, r, 0, TAU); G.fill(); noShadow();
  G.strokeStyle = 'rgba(80,50,10,.55)'; G.lineWidth = Math.max(.7, r * .12); G.beginPath(); G.arc(0, 0, r * .92, 0, TAU); G.stroke();
  G.fillStyle = 'rgba(255,255,240,.8)'; G.beginPath(); G.ellipse(-r * .35, -r * .38, r * .28, r * .18, -.6, 0, TAU); G.fill();
  G.restore();
}
// a thread / string (hangs clouds, stars, bunting): a thin line with its own faint shadow
function thread(pts, o = {}) {
  if (PAPER.dry) return;
  G.save(); const k = curScale(); setShadow(o.depth ?? .6, k, .7);
  G.strokeStyle = o.col || 'rgba(110,98,84,.85)'; G.lineWidth = (o.w || 2) * (o.world ? 1 : 1); G.lineCap = 'round'; G.lineJoin = 'round';
  G.beginPath(); G.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) G.lineTo(pts[i][0], pts[i][1]); G.stroke();
  G.restore();
}
// draw fn() scaled up from a hinge line (pop-up book element): k 0 = flat, 1 = standing
function popUp(k, x, y, fn) {
  if (k <= 0) return; if (k >= 1) return fn();
  G.save(); G.translate(x, y); G.scale(1, Math.max(.02, k)); G.translate(-x, -y); fn(); G.restore();
}

// ---------- camera & depth planes ----------
// paperCam(lt, [[t, [cx, cy, zoom, rotDeg]], ...], { stepped, fps, ease }) → camBegin(...). stepped = move in steps
// like a hand-nudged stop-motion camera; default is a smooth motion-control move.
function paperCam(lt, keys, o = {}) {
  const tt = o.stepped ? sm(lt, o.fps || PAPER.fps) : lt, v = kf(tt, keys, o.ease || ease);
  camBegin(v[0], v[1], v[2] ?? 1, (v[3] || 0) * D2R);
}
// layer(k, fn): a depth plane. k = 1 moves with the world, k < 1 is farther away (moves & zooms less), k > 1 is a
// foreground plane that sweeps past faster. Call inside camBegin/paperCam.
function layer(k, fn) {
  if (!CAM || k === 1) return fn();
  const { cx, cy, zoom } = CAM, zk = 1 + (zoom - 1) * k, ckx = W / 2 + (cx - W / 2) * k, cky = H / 2 + (cy - H / 2) * k;
  G.save(); G.translate(cx, cy); G.scale(zk / zoom, zk / zoom); G.translate(-ckx, -cky); fn(); G.restore();
}

// ---------- backdrops ----------
// backdrop(col, { to, mat, par }): a full sheet of paper behind everything (screen-fixed; par>0 slides it a little with the camera)
function backdrop(col = PC.sky, o = {}) {
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); noShadow(); G.globalAlpha = 1;
  const p = mat(col, o.mat || 'paper'), cam = CAM || { cx: W / 2, cy: H / 2 }, par = o.par ?? .15;
  p.setTransform(new DOMMatrix([1, 0, 0, 1, -(cam.cx - W / 2) * par, -(cam.cy - H / 2) * par]));
  G.fillStyle = p; G.fillRect(0, 0, W, H);
  if (o.to) { const g = G.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, o.to); G.fillStyle = g; G.fillRect(0, 0, W, H); }
  G.restore();
}
// the table the paper lies on (seen around flip cards / pop-up pages)
function table(o = {}) {
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); noShadow(); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over';
  const p = mat(o.col || '#B48458', 'wood'); p.setTransform(new DOMMatrix([1.6, 0, 0, 1.6, 0, 0])); G.fillStyle = p; G.fillRect(0, 0, W, H);
  G.restore();
}

// ---------- set dressing ----------
// hills(x, y, w, h, col, { bumps, seed, depth, torn, mat }): a torn-top paper hill band (top edge around y)
function hills(x, y, w, h, col, o = {}) { piece(SH.hills(w, h, o.bumps || 3, o.seed || 1, o.down || 1400), { x, y, col, mat: o.mat, torn: o.torn ?? 'top', tornAmp: o.tornAmp ?? 5, depth: o.depth ?? 1.1, seed: o.seed || 1, jit: 0 }); }
// grass(x, y, w, h, col, seed): zig-zag cut grass strip standing on y
function grass(x, y, w, h, col = PC.grass, seed = 1, o = {}) { piece(SH.zig(w, h, Math.max(3, Math.round(w / (h * .9))), seed), { x, y, col, depth: o.depth ?? .8, seed, jit: 0 }); }
// tree(x, y, s, { cols, trunk, seed, sway, fruit }) → returns { top:[x,y], fruit:[[x,y],...] } (fruit anchor points)
function tree(x, y, s = 1, o = {}) {
  const cols = o.cols || [PC.forest, PC.grass, PC.leaf], seed = o.seed || 1, q = rnd('tree' + seed), sw = o.sway ?? sway('tree' + seed, 1.2, .35);
  // trunk with two branches (kraft)
  piece(SH.smooth([[-34 * s, 0, 1], [-22 * s, -150 * s], [-26 * s, -300 * s], [-70 * s, -380 * s], [-50 * s, -395 * s], [-8 * s, -335 * s], [14 * s, -390 * s], [36 * s, -380 * s], [22 * s, -300 * s], [26 * s, -150 * s], [40 * s, 0, 1]]), { x, y, col: o.trunk || PC.cork, mat: 'kraft', depth: 1, seed: seed * 7 });
  G.save(); G.translate(x, y - 300 * s); G.rotate(sw * D2R); G.translate(-x, -(y - 300 * s));
  const cx = x, cy = y - 470 * s, blobs = [[0, 0, 190], [-140, 40, 120], [140, 30, 130], [-80, -110, 120], [90, -110, 120], [0, 70, 130]];
  blobs.forEach(([bx, by, br], i) => piece(SH.blob(br * s, 8, .12, seed * 10 + i), { x: cx + bx * s, y: cy + by * s, col: cols[i % 2], depth: 1.1, seed: seed * 10 + i }));
  const front = [[-60, 20, 95], [70, 10, 100], [0, -60, 105]];
  front.forEach(([bx, by, br], i) => piece(SH.blob(br * s, 7, .14, seed * 20 + i), { x: cx + bx * s, y: cy + by * s, col: cols[2 + (i % Math.max(1, cols.length - 2))] || cols[2], depth: 1.2, seed: seed * 20 + i }));
  for (let i = 0; i < 7; i++) { const a = -150 + i * 50 + (q() - .5) * 20, rr = 215 * s; piece(SH.leaf(60 * s, 30 * s), { x: cx + Math.cos(a * D2R) * rr * .98, y: cy + Math.sin(a * D2R) * rr * .9, rot: a + 90, col: cols[i % cols.length], depth: 1.2, seed: seed * 30 + i }); }
  G.restore();
  const rot = (px, py) => { const a = sw * D2R, dx = px - x, dy = py - (y - 300 * s); return [x + dx * Math.cos(a) - dy * Math.sin(a), y - 300 * s + dx * Math.sin(a) + dy * Math.cos(a)]; };
  return { top: rot(cx, cy - 190 * s), fruit: (o.fruit || [[-120, 60], [110, -40], [30, 120]]).map(([fx, fy]) => rot(cx + fx * s, cy + fy * s)), sway: sw };
}
function bush(x, y, s = 1, o = {}) {
  const cols = o.cols || [PC.forest, PC.leaf], seed = o.seed || 1;
  [[-70, -40, 70], [60, -45, 75], [0, -75, 85]].forEach(([bx, by, br], i) => piece(SH.blob(br * s, 7, .12, seed * 5 + i), { x: x + bx * s, y: y + by * s, col: cols[i % cols.length], depth: 1, seed: seed * 5 + i }));
}
// flower(x, y, s, col, { center, stem, seed, sway }) standing on (x, y)
function flower(x, y, s = 1, col = PC.rose, o = {}) {
  const seed = o.seed || 1, sw = o.sway ?? sway('fl' + seed, 3, .5), top = [x + Math.sin(sw * D2R) * 90 * s, y - 90 * s * Math.cos(sw * D2R)];
  piece(SH.capsule(92 * s, 4 * s), { x: top[0], y: top[1], rot: -sw, col: o.stem || PC.grass, depth: .7, seed: seed * 3 });
  piece(SH.leaf(34 * s, 16 * s), { x: x + (top[0] - x) * .5, y: y - 40 * s, rot: 50, col: o.stem || PC.leaf, depth: .7, seed: seed * 3 + 1 });
  for (let i = 0; i < 5; i++) { const a = (i / 5 * 360 + sw * 2) * D2R; piece(SH.ellipse(15 * s, 10 * s), { x: top[0] + Math.cos(a) * 15 * s, y: top[1] + Math.sin(a) * 15 * s, rot: a / D2R, col, depth: .8, seed: seed * 7 + i }); }
  piece(SH.circle(10 * s), { x: top[0], y: top[1], col: o.center || PC.yellow, depth: .8, seed: seed * 11 });
}
// cloud(x, y, w, { col, hang: 'string'|'stick'|null, bob, seed, depth }) — a cloud cut-out hung on a thread or on a stick
function cloud(x, y, w = 260, o = {}) {
  const seed = o.seed || 1, bob = o.bob ?? 1, dy = sway('cl' + seed, 7 * bob, .3), rot = sway('clr' + seed, 1.6 * bob, .23), h = w * .5;
  if (o.hang === 'string' || o.hang === true) { thread([[x - w * .22, y + dy - 1600], [x - w * .22, y + dy - h * .6]]); thread([[x + w * .24, y + dy - 1600], [x + w * .24, y + dy - h * .55]]); }
  if (o.hang === 'stick') piece(SH.rect(w * .05, 900), { x: x + w * .05, y: y + dy + 440, rot: rot * .3, col: PC.kraft, mat: 'kraft', depth: .9, seed: seed * 3 });
  piece(SH.cloud(w, h, seed), { x, y: y + dy, rot, col: o.col || PC.white, mat: o.mat || 'card', depth: o.depth ?? 1.6, seed: seed * 17 });
}
// sun(x, y, r, { col, rays, spin }) — disc + triangular ray pieces that tick round
function sun(x, y, r = 90, o = {}) {
  const n = o.rays ?? 12, spin = sm(T) * (o.spin ?? 6);
  for (let i = 0; i < n; i++) { const a = (i / n * 360 + spin) * D2R, d = r * 1.32; piece(SH.tri(r * .38, r * .5), { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, rot: a / D2R + 90, col: i % 2 ? (o.col2 || PC.orange) : (o.col || PC.yellow), depth: .9, seed: 400 + i }); }
  piece(SH.circle(r), { x, y, col: o.col || PC.yellow, depth: 1.2, seed: 399 });
  if (o.inner !== false) piece(SH.circle(r * .72), { x: x - r * .06, y: y - r * .06, col: o.col3 || PC.lemon, mat: 'tissue', depth: .2, seed: 398 });
}
// stripes(x, y, w, h, n, cols, { rot, depth }) — n separate strips side by side (awnings, flags, patterned grounds)
function stripes(x, y, w, h, n, cols, o = {}) { for (let i = 0; i < n; i++) piece(SH.rect(w / n + .5, h), { x: x - w / 2 + (i + .5) * w / n, y, col: cols[i % cols.length], depth: o.depth ?? .5, seed: (o.seed || 50) + i, rot: o.rot || 0 }); }
// bunting(x0, y0, x1, y1, n, cols, { sag }) — flags on a sagging string
function bunting(x0, y0, x1, y1, n = 8, cols = [PC.red, PC.yellow, PC.teal, PC.pink], o = {}) {
  const sag = o.sag ?? 60, pt = k => [lerp(x0, x1, k), lerp(y0, y1, k) + sag * 4 * k * (1 - k)], pts = []; for (let i = 0; i <= 20; i++) pts.push(pt(i / 20));
  thread(pts, { col: o.string || '#EDE6D6' });
  const fw = Math.hypot(x1 - x0, y1 - y0) / n * .8;
  for (let i = 0; i < n; i++) { const k = (i + .5) / n, [px, py] = pt(k), a = sway('bn' + i, 4, .6); piece(SH.poly([[-fw / 2, 0], [fw / 2, 0], [0, fw * 1.1]]), { x: px, y: py - 2, rot: a, col: cols[i % cols.length], depth: 1, seed: 700 + i }); }
}
// house(x, y, s, { wall, roof, door, win }) — a little paper house standing on (x, y)
function house(x, y, s = 1, o = {}) {
  const wall = o.wall || PC.cream, roof = o.roof || PC.red;
  piece(SH.rect(300 * s, 240 * s), { x, y: y - 120 * s, col: wall, mat: 'card', depth: 1, seed: 801 });
  piece(SH.poly([[-190 * s, 0], [0, -150 * s], [190 * s, 0]]), { x, y: y - 236 * s, col: roof, depth: 1.3, seed: 802 });
  stripes(x, y - 246 * s, 250 * s, 14 * s, 5, [PC.white, roof], { seed: 810, depth: .4 });
  piece(SH.round(80 * s, 130 * s, 38 * s), { x: x + 60 * s, y: y - 65 * s, col: o.door || PC.teal, depth: .6, seed: 803 });
  brad(x + 84 * s, y - 62 * s, 6 * s);
  piece(SH.round(80 * s, 70 * s, 8 * s), { x: x - 70 * s, y: y - 150 * s, col: o.win || PC.sky, depth: .5, seed: 804 });
  piece(SH.rect(84 * s, 8 * s), { x: x - 70 * s, y: y - 150 * s, col: wall, depth: .4, seed: 805 });
  piece(SH.rect(8 * s, 74 * s), { x: x - 70 * s, y: y - 150 * s, col: wall, depth: .4, seed: 806 });
}
// confetti(lt, x, y, { t0, n, cols, spread, power, seed }) — a stepped paper-confetti burst from (x, y) at t0
function confetti(lt, x, y, o = {}) {
  const t0 = o.t0 || 0, a = sm(lt) - t0; if (a < 0) return;
  const n = o.n || 40, cols = o.cols || [PC.red, PC.yellow, PC.teal, PC.pink, PC.blue, PC.lime, PC.orange], q = rnd('conf' + (o.seed || 1)), pw = o.power || 1;
  for (let i = 0; i < n; i++) {
    const ang = (-90 + (q() - .5) * (o.spread || 110)) * D2R, v = (700 + q() * 900) * pw, drag = Math.exp(-1.6 * a), sz = (18 + q() * 16) * (o.size || 1), kind = Math.floor(q() * 4), c = cols[i % cols.length], ph = q() * TAU, spin = (q() - .5) * 900;
    const px = x + Math.cos(ang) * v * (1 - drag) / 1.6 + Math.sin(a * 3 + ph) * 25 * Math.min(1, a), py = y + Math.sin(ang) * v * (1 - drag) / 1.6 + 260 * a * a;
    const sh = kind === 0 ? SH.rect(sz, sz * .6) : kind === 1 ? SH.circle(sz * .45) : kind === 2 ? SH.tri(sz, sz * .9) : SH.rect(sz * 1.5, sz * .35);
    piece(sh, { x: px, y: py, rot: spin * a, sx: Math.max(.15, Math.abs(Math.cos(a * 7 + ph))), col: c, depth: 2, seed: 900 + i, edge: false, jit: 0 });
  }
}

// ---------- props (all drawn around a grip point, angle in degrees, size unit s ≈ the character's u) ----------
const PROPS = {
  apple(x, y, ang = 0, s = 30) {
    G.save(); G.translate(x, y); G.rotate(ang * D2R);
    piece(SH.smooth([[0, -.55 * s], [.55 * s, -.75 * s], [.95 * s, -.2 * s], [.8 * s, .55 * s], [.35 * s, .85 * s], [0, .72 * s], [-.35 * s, .85 * s], [-.8 * s, .55 * s], [-.95 * s, -.2 * s], [-.55 * s, -.75 * s]]), { y: -.1 * s, col: PC.red, depth: 1, seed: 1201 });
    piece(SH.ellipse(.2 * s, .32 * s), { x: -.45 * s, y: -.25 * s, rot: 20, col: '#F08A7A', depth: 0, seed: 1204, edge: false });
    piece(SH.capsule(.45 * s, .07 * s), { x: .05 * s, y: -1.05 * s, rot: -15, col: PC.bark, mat: 'kraft', depth: .6, seed: 1202 });
    piece(SH.leaf(.6 * s, .3 * s), { x: .1 * s, y: -.75 * s, rot: 60, col: PC.leaf, depth: .7, seed: 1203 });
    G.restore();
  },
  balloon(x, y, ang = 0, s = 30, col = PC.red) {
    const bx = x + Math.sin(ang * D2R) * 4 * s, by = y - 4 * s;
    thread([[x, y], [lerp(x, bx, .5) + s * .3, lerp(y, by, .5)], [bx, by + 1.3 * s]], { col: '#F4EEE2', w: 2 });
    piece(SH.ellipse(1.1 * s, 1.35 * s), { x: bx, y: by, rot: ang, col, depth: 1.6, seed: 1301 });
    piece(SH.tri(.4 * s, .3 * s), { x: bx, y: by + 1.42 * s, col, depth: .8, seed: 1302 });
    piece(SH.ellipse(.22 * s, .38 * s), { x: bx - .45 * s, y: by - .5 * s, rot: 25, col: '#FFFFFF', mat: 'tissue', depth: 0, seed: 1303 });
  },
  flower(x, y, ang = 0, s = 30, col = PC.pink) { G.save(); G.translate(x, y); G.rotate(ang * D2R); flower(0, 1.6 * s, s / 22, col, { seed: 1400, sway: 0 }); G.restore(); },
  star(x, y, ang = 0, s = 30, col = PC.yellow) {   // a star wand
    G.save(); G.translate(x, y); G.rotate(ang * D2R);
    piece(SH.capsule(2.6 * s, .1 * s), { y: -2.2 * s, col: PC.kraft, mat: 'kraft', depth: .7, seed: 1501 });
    piece(SH.star(.9 * s, .42 * s), { y: -2.4 * s, col, depth: 1.4, seed: 1502 }); G.restore();
  },
  gift(x, y, ang = 0, s = 30, col = PC.teal, rib = PC.pink) {
    G.save(); G.translate(x, y); G.rotate(ang * D2R);
    piece(SH.rect(1.6 * s, 1.3 * s), { y: -.3 * s, col, depth: 1, seed: 1601 });
    piece(SH.rect(.3 * s, 1.34 * s), { y: -.3 * s, col: rib, depth: .3, seed: 1602 });
    piece(SH.ellipse(.4 * s, .25 * s), { x: -.3 * s, y: -1.05 * s, rot: 20, col: rib, depth: .6, seed: 1603 });
    piece(SH.ellipse(.4 * s, .25 * s), { x: .3 * s, y: -1.05 * s, rot: -20, col: rib, depth: .6, seed: 1604 });
    G.restore();
  },
  letter(x, y, ang = 0, s = 30, col = PC.white) {
    G.save(); G.translate(x, y); G.rotate(ang * D2R);
    piece(SH.rect(1.8 * s, 1.2 * s), { y: -.3 * s, col, mat: 'card', depth: 1, seed: 1701 });
    piece(SH.poly([[-.9 * s, -.9 * s], [.9 * s, -.9 * s], [0, -.2 * s]]), { col: mixCol(col, '#C8B89A', .25), mat: 'card', depth: .3, seed: 1702 });
    piece(SH.heart(.45 * s), { y: -.35 * s, col: PC.red, depth: .3, seed: 1703 });
    G.restore();
  },
};

// ---------- transitions (screen space: call after camEnd(), with k = 0 → 1) ----------
// The incoming shot calls them over its own first frames; they render the PREVIOUS shot themselves (still moving),
// so the previous shot must not draw an out-transition of its own. Drive k with stepped time for a stop-motion feel:
// trTear(t, seg(sm(lt), 0, .7)).
let IN_PREV = false;
const BUFS = {};
const buf = name => BUFS[name] || (BUFS[name] = makeCanvas());
function shotIndexAt(t) { let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++; return i; }
// render the previous shot (at time t, i.e. still running) into a buffer; null if this is the first shot
function prevFrame(t) {
  const i = shotIndexAt(t); if (i === 0) return null;
  const b = buf('prev'), c = b.getContext('2d'), [t0, fn] = SHOTS[i - 1], end = SHOTS[i][0];
  const sG = G, sCAM = CAM, sLAST = LAST_CAM, sJ = PAPER.jit;
  G = c; G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over'; noShadow(); G.clearRect(0, 0, W, H); CAM = null; IN_PREV = true;
  try { fn(t, t - t0, end - t0); if (CAM) camEnd(); } finally { IN_PREV = false; G = sG; CAM = sCAM; LAST_CAM = sLAST; PAPER.jit = sJ; }
  return b;
}
function snapCur() { const b = buf('cur'), c = b.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'copy'; c.drawImage(G.canvas, 0, 0); c.globalCompositeOperation = 'source-over'; return b; }
function plainSheet(col = PC.cream) { const b = buf('sheet' + col), c = b.getContext('2d'); if (!b.done) { c.fillStyle = mat(col, 'paper'); c.fillRect(0, 0, W, H); b.done = 1; } return b; }
function screenReset() { G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over'; noShadow(); }
// 1. a paper sheet with the new shot on it slides over the old one (dir: 'left' | 'right' | 'up' | 'down' = where it travels)
function trSlide(t, k, o = {}) {
  if (IN_PREV || k >= 1) return; const prev = prevFrame(t) || plainSheet(o.col), cur = snapCur(), e = easeOut(k);
  screenReset(); G.drawImage(prev, 0, 0);
  const d = o.dir || 'left', dx = d === 'left' ? W * (1 - e) : d === 'right' ? -W * (1 - e) : 0, dy = d === 'up' ? H * (1 - e) : d === 'down' ? -H * (1 - e) : 0;
  G.fillStyle = `rgba(40,25,12,${.25 * e})`; G.fillRect(0, 0, W, H);
  G.save(); G.translate(W / 2 + dx, H / 2 + dy); G.rotate((1 - e) * (o.tilt ?? 3) * D2R);
  setShadow(3.5, 1); G.fillStyle = PC.white; G.fillRect(-W / 2, -H / 2, W, H); noShadow(); G.drawImage(cur, -W / 2, -H / 2);
  G.restore();
}
// 2. flip-card turn: the old frame is a card that flips over; its back is the new shot. Table shows behind.
function trFlip(t, k, o = {}) {
  if (IN_PREV || k >= 1) return; const prev = prevFrame(t) || plainSheet(o.col), cur = snapCur(), e = ease(k);
  const img = e < .5 ? prev : cur, sx = Math.max(.004, Math.abs(Math.cos(e * Math.PI))), lift = 1 - .16 * Math.sin(e * Math.PI);
  screenReset(); table(o);
  G.save(); G.translate(W / 2, H / 2 - 30 * Math.sin(e * Math.PI)); G.rotate((o.tilt ?? -4) * Math.sin(e * Math.PI) * D2R); G.scale(sx * lift, lift);
  setShadow(2 + 5 * Math.sin(e * Math.PI), lift); G.fillStyle = PC.white; G.fillRect(-W / 2, -H / 2, W, H); noShadow(); G.drawImage(img, -W / 2, -H / 2);
  G.fillStyle = `rgba(30,18,8,${(1 - sx) * .45})`; G.fillRect(-W / 2, -H / 2, W, H);
  G.strokeStyle = 'rgba(255,252,240,.9)'; G.lineWidth = 14; G.strokeRect(-W / 2 + 7, -H / 2 + 7, W - 14, H - 14);
  G.restore();
}
// 3. torn-paper reveal: the old frame is torn in two down a ragged line and the halves pull apart
function trTear(t, k, o = {}) {
  if (IN_PREV || k >= 1) return; const prev = prevFrame(t) || plainSheet(o.col), e = easeIn(k), seed = o.seed || 3;
  screenReset();
  const pts = []; for (let y = -40; y <= H + 40; y += 6) pts.push([W / 2 + (fbm1(y / 260, seed) - .5) * 420 + (fbm1(y / 23, seed + 4) - .5) * 30 + (hash(y * .37 + seed) - .5) * 7, y]);
  const halves = [{ side: -1, rot: -(o.rot ?? 9) }, { side: 1, rot: o.rot ?? 7 }];
  for (const hf of halves) {
    const tear = pts.map(([x, y]) => [x, y]), rimPts = pts.map(([x, y], i) => [x - hf.side * (5 + 11 * fbm1(i / 5, seed + 9)), y]);
    const edgeX = hf.side < 0 ? -60 : W + 60, outer = new Path2D(), inner = new Path2D();
    outer.moveTo(edgeX, -40); tear.forEach(p => outer.lineTo(p[0], p[1])); outer.lineTo(edgeX, H + 40); outer.closePath();
    inner.moveTo(edgeX, -40); rimPts.forEach(p => inner.lineTo(p[0], p[1])); inner.lineTo(edgeX, H + 40); inner.closePath();
    const fib = new Path2D(); tear.forEach(([x, y], i) => { if (hash(i * 1.3 + seed) < .5) { fib.moveTo(x, y); fib.lineTo(x + hf.side * -1 * (3 + hash(i) * 7), y + (hash(i * 2.1) - .5) * 8); } });
    G.save();
    const px = hf.side < 0 ? 0 : W, py = H * .9;   // pull pivot at the outer bottom corner
    G.translate(px + hf.side * e * W * .62, py + e * 90); G.rotate(hf.rot * e * D2R); G.translate(-px, -py);
    setShadow(1.5 + 3 * e, 1); G.fillStyle = PC.white; G.fill(outer); noShadow();
    G.strokeStyle = '#FBF7EE'; G.lineWidth = 1.2; G.stroke(fib);
    G.save(); G.clip(inner); G.drawImage(prev, 0, 0); G.restore();
    G.restore();
  }
}
// 4. pop-up book fold: the new shot stands up off the page from a hinge at the bottom (old shot / table lies behind).
//    Pair it with popUp() on scene elements for pieces that unfold a beat later.
function trBook(t, k, o = {}) {
  if (IN_PREV || k >= 1) return; const prev = prevFrame(t), cur = snapCur(), sy = Math.max(.01, easeOut(k) * (1 + (o.bounce === false ? 0 : .07) * Math.sin(k * Math.PI)));
  screenReset(); if (prev) G.drawImage(prev, 0, 0); else table(o);
  G.fillStyle = `rgba(30,18,8,${.3 * k})`; G.fillRect(0, 0, W, H);
  G.save(); G.translate(0, H); G.scale(1, sy);
  setShadow(3, 1); G.fillStyle = PC.white; G.fillRect(0, -H, W, H); noShadow(); G.drawImage(cur, 0, -H);
  G.fillStyle = `rgba(30,18,8,${(1 - Math.min(1, sy)) * .55})`; G.fillRect(0, -H, W, H);
  G.restore();
  // the page crease
  G.fillStyle = 'rgba(40,24,10,.25)'; G.fillRect(0, H - 6, W, 6);
}
// sheetIn / sheetOut: a plain paper sheet slides off (opening) or over (ending) the frame — no previous shot needed
function sheetOut(k, o = {}) { if (IN_PREV || k <= 0) return; sheetAt(1 - easeOut(clamp(k)), o); }
function sheetIn(k, o = {}) { if (IN_PREV || k >= 1) return; sheetAt(easeIn(clamp(k)), o); }
function sheetAt(off, o) {
  screenReset(); const d = o.dir || 'left', dx = d === 'left' ? W * off : d === 'right' ? -W * off : 0, dy = d === 'up' ? H * off : d === 'down' ? -H * off : 0;
  G.save(); G.translate(W / 2 + dx, H / 2 + dy); G.rotate(off * 3 * D2R);
  piece(SH.rect(W + 40, H + 40), { col: o.col || PC.cream, torn: 'left', tornAmp: 9, depth: 3.2, seed: 4242, jit: 0 });
  G.restore();
}

// ---------- captions (overlay, crisp, CJK-capable) ----------
// captionTrack([[t0, t1, text, { style: 'label' | 'letters', y, size, col, bg, cols, rot }], ...])
//   label   = ink letters printed on a torn paper label strip        (subtitles, speech)
//   letters = each glyph cut out of coloured paper with a white margin (titles, shouts)
const CAP_FONT = '"Chiron GoRound TC", "Zen Maru Gothic", "Noto Sans TC", "Noto Sans", system-ui, sans-serif';
window.EXTRA_FONTS = [[`900 64px "Chiron GoRound TC"`, '紙片字幕'], [`900 64px "Zen Maru Gothic"`, 'あ字'], [`900 64px "Noto Sans TC"`, '紙片字幕']];
const CAPS = [], FONT_TEXT = [];
function captionTrack(list) { CAPS.push(...list); list.forEach(c => FONT_TEXT.push(c[2])); window.overlayHook = drawCaptions; }
function drawCaptions(c, t) {
  for (const [t0, t1, txt, o = {}] of CAPS) {
    if (t < t0 || t > t1 + .4) continue;
    const kin = seg(sm(t - t0), 0, .34), kout = seg(sm(t - t1), 0, .34);
    (o.style === 'letters' ? lettersCap : labelCap)(c, txt, { ...o, kin, kout, t0 });
  }
}
function withG(c, fn) { const s = G; G = c; try { fn(); } finally { G = s; } }
function labelCap(c, txt, o = {}) {
  const size = o.size || 72, kin = o.kin ?? 1, kout = o.kout ?? 0; if (kin <= 0 || kout >= 1) return;
  c.save(); c.font = `900 ${size}px ${CAP_FONT}`; const tw = c.measureText(txt).width, w = tw + size * 1.3, h = size * 1.55;
  const x = o.x ?? W / 2, y = (o.y ?? H - 118) + kout * 260, pop = kin < 1 ? backOut(kin) : 1, rot = o.rot ?? (hash(keyNum(txt)) - .5) * 3;
  c.translate(x, y); c.rotate(rot * D2R); c.scale(pop, pop);
  withG(c, () => { piece(SH.rect(w, h), { col: o.bg || PC.white, mat: 'card', torn: 'sides', tornAmp: 6, depth: 2.2, seed: keyNum(txt) % 997, jit: 0 }); piece(SH.rect(w * .16, h * .34), { x: -w * .5 + size * .1, y: -h * .5, rot: -30, col: '#E9E2C9', mat: 'tissue', depth: .2, seed: 5, jit: 0 }); });
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.col || PC.ink; c.fillText(txt, 0, size * .05);
  c.restore();
}
function lettersCap(c, txt, o = {}) {
  const size = o.size || 96, kin = o.kin ?? 1, kout = o.kout ?? 0; if (kout >= 1) return;
  const cols = o.cols || [PC.red, PC.orange, PC.teal, PC.blue, PC.rose, PC.grass], chars = [...txt];
  c.save(); c.font = `900 ${size}px ${CAP_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const ws = chars.map(ch => c.measureText(ch).width + size * .12), tot = ws.reduce((a, b) => a + b, 0);
  let x = (o.x ?? W / 2) - tot / 2; const y0 = (o.y ?? 150) - kout * 420, n = chars.length;
  chars.forEach((ch, i) => {
    const cx = x + ws[i] / 2; x += ws[i]; if (ch === ' ') return;
    const kk = clamp(kin * (n + 2) - i), pop = kk <= 0 ? 0 : kk < 1 ? backOut(kk) : 1; if (pop <= 0) return;
    const h = keyNum(txt) + i * 7.7, r = (hash(h) - .5) * 12 + (hash(h + PAPER.step * .31) - .5) * 1.2, dy = (hash(h + 3) - .5) * size * .14;
    c.save(); c.translate(cx, y0 + dy); c.rotate(r * D2R); c.scale(pop, pop);
    setShadow(2.2, 1, 1, c); c.lineWidth = size * .26; c.strokeStyle = mat(PC.white, 'card'); c.strokeText(ch, 0, 0); c.fillStyle = PC.white; c.fillText(ch, 0, 0); noShadow(c);
    c.fillStyle = mat(cols[i % cols.length], 'paper'); c.fillText(ch, 0, 0);
    c.restore();
  });
  c.restore();
}

// ---------- the photographed look: lamp light, vignette, flicker, grain ----------
const LOOK = {};
function buildLook() {
  const c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * .4, H * .36, H * .28, W * .5, H * .5, W * .75);
  g.addColorStop(0, 'rgba(255,250,240,0)'); g.addColorStop(.6, 'rgba(236,214,190,.35)'); g.addColorStop(1, 'rgba(150,112,80,.8)');
  x.fillStyle = g; x.fillRect(0, 0, W, H); LOOK.mul = c;
  const s = makeCanvas(480, 270), y = s.getContext('2d'), g2 = y.createRadialGradient(150, 80, 0, 150, 80, 300);
  g2.addColorStop(0, 'rgba(255,226,170,.55)'); g2.addColorStop(1, 'rgba(255,226,170,0)'); y.fillStyle = g2; y.fillRect(0, 0, 480, 270); LOOK.spot = s;
  const n = makeCanvas(256, 256), z = n.getContext('2d'), id = z.createImageData(256, 256), r = rnd('filmgrain');
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  z.putImageData(id, 0, 0); LOOK.grain = OUT.createPattern(n, 'repeat');
}
function applyLook(t) {
  const c = OUT; c.setTransform(1, 0, 0, 1, 0, 0); noShadow(c);
  if (PAPER.vignette) { c.globalCompositeOperation = 'multiply'; c.globalAlpha = PAPER.vignette; c.drawImage(LOOK.mul, 0, 0); }
  c.globalCompositeOperation = 'screen'; c.globalAlpha = .55; c.drawImage(LOOK.spot, 0, 0, W, H);
  const f = (hash(PAPER.step * .917 + .3) - .5) * 2 * .03 * PAPER.flicker;
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  if (f > 0) { c.fillStyle = `rgba(255,240,215,${f})`; c.fillRect(0, 0, W, H); } else if (f < 0) { c.fillStyle = `rgba(35,22,12,${-f})`; c.fillRect(0, 0, W, H); }
  if (PAPER.grain) {
    LOOK.grain.setTransform(new DOMMatrix([1, 0, 0, 1, hash(PAPER.step * 1.3) * 256, hash(PAPER.step * 2.9) * 256]));
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = .07 * PAPER.grain; c.fillStyle = LOOK.grain; c.fillRect(0, 0, W, H);
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

window.ENGINE = {
  async setup() {
    for (const k of Object.keys(GRAIN_SPEC)) GRAIN[k] = makeGrain(k);
    for (const col of Object.values(PC)) mat(col, 'paper');
    buildLook();
    if (FONT_TEXT.length) { const all = FONT_TEXT.join(''); await Promise.all([`900 64px "Chiron GoRound TC"`, `900 64px "Zen Maru Gothic"`, `900 64px "Noto Sans TC"`].map(f => document.fonts.load(f, all).catch(() => { }))); }
  },
  begin(t) { PAPER.step = Math.floor(t * PAPER.fps + 1e-6); PAPER.jit = 0; PAPER.dry = false; IN_PREV = false; },
  end(t) { applyLook(t); },
};
