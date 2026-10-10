// A Hundred Summers — the film. Story, camera and timing only; all drawing goes through engine.js.
import * as E from './engine.js';
import { P, W, H } from './engine.js';
import { B, T, K, yearK, X, U, BOX, BAND, LIFE0, LIFE1, DUR, lifeYears } from './timeline.js';
import { clamp, lerp, seg, ss, eio, eo, hash, vnoise } from '/core/lib.js';
export { DUR };

const LIFE = lifeYears();
const V = {};                       // year → JJA anomaly (°C)
export function setData(d) { d.years.forEach((y, i) => V[y] = d.jja[i]); }
const tl = y => T(yearK(y));

// ---------- value axis (rescale) ----------
function vmaxAt(t) {
  let v = .6;
  const [a, b] = K.rescale1;
  for (let i = 0; i < 4; i++) { const ks = a + i * (b - a) / 4; v += .15 * eo(clamp((t / B - ks) / .09)); }  // 4 ratchet clicks
  return lerp(v, 1.6, eio(seg(t, T(K.rescale2[0]), T(K.rescale2[1]))));
}
const Yv = (v, vm) => BOX.bot - (v - BOX.vmin) / (vm - BOX.vmin) * (BOX.bot - BOX.top);
const dotXY = (y, t) => [X(y), Yv(V[y], vmaxAt(t))];

// ---------- annotations (pinned in data space: dv = offset in °C, dx = px) ----------
const ANN = [
  { y: 1926, text: '1926 — she is born.', col: P.blue, k: K.write1926, dx: 26, dv: .47, up: true },
  { y: 1933, text: '1933 — the sea.', col: P.blue, k: K.write1933, dx: 20, dv: -.45, doodle: 'wave', dk: K.wave },
  { y: 1958, text: '1958 — a daughter.', col: P.blue, k: K.write1958, dx: 16, dv: -.4, doodle: 'heart', dk: K.heart },
  { y: 1998, text: '1998 — hottest yet', col: P.red, k: K.write1998, dx: -28, dv: .13, right: true },
  { y: 2026, text: '2026 — her 100th summer', col: P.red, k: K.write2026, dx: -28, dv: .2, right: true },
];
const ASZ = 30;
let _g = null; const _mw = new Map();
const handW = s => { if (!_mw.has(s)) _mw.set(s, E.measureHand(_g, s, ASZ)); return _mw.get(s); };
// geometry of an annotation at time t: ring, leader, text anchor
function annGeo(a, t) {
  const vm = vmaxAt(t), [dx0, dy0] = [X(a.y), Yv(V[a.y], vm)];
  const ty = Yv(V[a.y] + a.dv, vm), lines = a.text.split('\n'), lw = lines.map(handW), tw = Math.max(...lw);
  const tx = dx0 + a.dx, left = a.right ? tx - tw : tx;
  const r = 6 * 2.3;
  const la = a.right ? [tx + 8, ty - ASZ * .32] : a.up ? [left - 2, ty + ASZ * .12] : [left - 4, ty - ASZ * .78];
  const ang = Math.atan2(la[1] - dy0, la[0] - dx0), lb = [dx0 + Math.cos(ang) * r * 1.1, dy0 + Math.sin(ang) * r];
  const LH = ASZ * 1.08, nch = lines.map(l => l.length), tot = nch.reduce((a, b) => a + b, 0);
  const lastW = lw[lw.length - 1], lastY = ty + (lines.length - 1) * LH, lastL = a.right ? tx - lastW : tx;
  return { dot: [dx0, dy0], r, tx, ty, tw, left, la, lb, lines, lw, LH, nch, tot, lastW, lastY, lastL };
}
// phases inside a.k: ring 18%, leader 12%, text 70%
const phases = a => { const [k0, k1] = a.k, d = k1 - k0; return { ring: [T(k0), T(k0 + d * .18)], lead: [T(k0 + d * .18), T(k0 + d * .3)], text: [T(k0 + d * .3), T(k1)] }; };

// ---------- camera ----------
function penYearF(t) {                // fractional year position of the pen (for tracking)
  if (t <= tl(1927) - .45) return 1926;
  for (let i = 1; i < LIFE.length; i++) {
    const y = LIFE[i], t1 = tl(y), t0 = Math.max(tl(y - 1), t1 - .45);
    if (t < t0) return y - 1;
    if (t <= t1) return y - 1 + (t - t0) / (t1 - t0);
  }
  return LIFE1;
}
function smoothPen(t, win = .7) { let s = 0; for (let i = 0; i < 8; i++) s += penYearF(t - win * i / 7); return s / 8; }
function recentY(t, yf) {             // mean data height of the last ~6 summers at the pen
  const vm = vmaxAt(t); let s = 0, n = 0;
  for (let y = Math.floor(yf) - 6; y <= Math.floor(yf); y++) if (V[y] !== undefined && y >= LIFE0) { s += Yv(V[y], vm); n++; }
  return n ? s / n : 0;
}
const mix = (a, b, f) => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), f)), roll: lerp(a.roll || 0, b.roll || 0, f) });
const kz = (k, keys) => { for (let i = 0; i < keys.length - 1; i++) if (k <= keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], eio(seg(k, keys[i][0], keys[i + 1][0]))); return keys[keys.length - 1][1]; };
const CENTURY = { x: 722, y: 22, zoom: 1.06, roll: 0 };
function trackPose(t) {
  const k = t / B;
  let zoom = kz(k, [[9, 2.3], [20, 2.05], [27.5, 1.8], [29.5, 1.95], [32, 1.7], [40, 1.22]]);
  if (k >= 40) zoom = lerp(1.22, 1.42, eo(clamp((k - 40) / .12))) ;                 // punch-in on the break (2 frames)
  if (k >= 41.5) zoom = lerp(1.42, 1.25, eio(seg(k, 41.5, 43)));
  if (k >= 43) zoom = lerp(1.25, 1.0, eio(seg(k, 43, 46.4)));
  const yf = smoothPen(t), lead = 230 / zoom;
  const ry = recentY(t, yf);
  const off = kz(k, [[9, 70], [26, 55], [30, 45], [33, 70], [40, 90], [46, 120]]);
  const roll = -kz(k, [[32, 0], [40, 1.5], [46.5, 3]]) * Math.PI / 180;
  return { x: X(1926) + (yf - 1926) * U + lead, y: kz(k, [[0, 0], [9, 0], [10, 1]]) * 0 + ry + off, zoom, roll };
}
function camAt(t) {
  const k = t / B;
  let c;
  const C1a0 = { x: 70, y: 5, zoom: 4.1 }, C1a = { x: 132, y: -52, zoom: 3.8 }, C1b = { x: 134, y: -54, zoom: 3.9 };
  const C2 = { x: 330, y: -45, zoom: 1.55 };
  if (k < 3.2) c = mix(C1a0, C1a, ss(seg(k, 1.15, 2.25)));
  else if (k < 4) c = mix(C1a, C1b, ss(seg(k, 3.2, 4)));
  else if (k < 7.5) c = mix(C1b, C2, eio(seg(k, 4, 7)));
  else if (k < K.stop) {
    const tp = trackPose(t);
    c = k < 9.5 ? mix(C2, tp, eio(seg(k, 7.5, 9.5))) : tp;
  } else if (k < 48.2) {                                             // the only cut: close on the empty 2026 slot
    const y26 = Yv(1.28, vmaxAt(T(46)));
    c = mix({ x: X(2026) - 80, y: y26 + 30, zoom: 2.25 }, { x: X(2026) - 150, y: y26 + 55, zoom: 2.5 }, ss(seg(k, K.stop, 48.2)));
  } else if (k < 56) {
    const y26 = Yv(1.28, vmaxAt(t)), close = { x: X(2026) - 150, y: y26 + 55, zoom: 2.5 };
    c = k < 51 ? mix({ x: X(2026) - 150, y: Yv(1.28, vmaxAt(T(48.2))) + 55, zoom: 2.5 }, { x: X(2026) - 175, y: y26 + 62, zoom: 2.4 }, ss(seg(k, 48.2, 51)))
      : mix({ x: X(2026) - 175, y: y26 + 62, zoom: 2.4 }, CENTURY, eio(seg(k, 51, 55)));
  } else if (k < 60) c = { ...CENTURY };
  else if (k < 64) c = mix(CENTURY, { x: 420, y: 0, zoom: .72 }, eio(seg(k, 60, 63.6)));
  else if (k < 68) c = mix({ x: 420, y: 0, zoom: .72 }, { x: 1290, y: 0, zoom: 1.3 }, eio(seg(k, 64.3, 67.8)));
  else c = mix({ x: 1290, y: 0, zoom: 1.3 }, END_CAM, eio(seg(k, 68, 70)));
  c.roll = c.roll || 0; c.sx = 0; c.sy = 0;
  // shake: the break (k40), the second break, the rush
  const sh = (amp, f, s) => [(vnoise(t * f + s) - .5) * 2 * amp, (vnoise(t * f + s + 40) - .5) * 2 * amp];
  let amp = 0;
  if (k >= 40 && k < 42) amp += 12 * Math.exp(-(t - T(40)) * 6);
  if (k >= 41 && k < 42) amp += 4 * Math.exp(-(t - T(41)) * 9);
  const kb2 = K.break2; if (k >= kb2 && k < K.stop) amp += 9 * Math.exp(-(t - T(kb2)) * 7);
  if (k >= 43.1 && k < K.stop) amp += 2.2;
  if (amp > 0) { const [a, b2] = sh(amp, 22, 3); c.sx = a; c.sy = b2; }
  return c;
}
const ENDW = 1180, ENDH = 560;
const END_CAM = { x: X(2027) - U / 2 + ENDW / 2, y: 0, zoom: 1.0 };
const MINI = { x0: X(2027) - U / 2 + 64, w: 10, y0: -122, y1: -72 };   // the end card's own little stripes

// ---------- pencil ----------
function annTip(a, t) {
  const g = annGeo(a, t), ph = phases(a);
  if (t < ph.ring[1]) { const u = seg(t, ...ph.ring), p = E.ringPath(g.dot[0], g.dot[1], g.r, a.y); const i = Math.floor(u * (p.length - 1)); return p[i]; }
  if (t < ph.lead[1]) { const u = seg(t, ...ph.lead); return [lerp(g.lb[0], g.la[0], u), lerp(g.lb[1], g.la[1], u)]; }
  const u0 = seg(t, ...ph.text);
  if (a.right && u0 < HOP) { const q = eio(u0 / HOP), st = [g.tx - g.lw[0], g.ty - ASZ * .3]; return [lerp(g.la[0], st[0], q), lerp(g.la[1], st[1], q) - Math.sin(q * Math.PI) * 12]; }
  const u = textU(a, t), lp = lineProg(g, u); let i = lp.findIndex(p => p < 1); if (i < 0) i = lp.length - 1;
  const f = lp[i] * g.lw[i], wig = Math.sin(f * .55) * .5 + Math.sin(f * 1.31 + 1) * .3, L = a.right ? g.tx - g.lw[i] : g.tx;
  return [L + f, g.ty + i * g.LH - ASZ * (.28 + .22 * wig)];
}
// right-aligned notes: the pen hops from the leader end back to where the words start before writing
const HOP = .16;
function textU(a, t) { const ph = phases(a), u = seg(t, ...ph.text); return a.right ? clamp((u - HOP) / (1 - HOP)) : u; }
function annLift(a, t) { const ph = phases(a), u = seg(t, ...ph.text); return a.right && u > 0 && u < HOP ? .04 + .3 * Math.sin(u / HOP * Math.PI) : .04 + .05 * Math.abs(Math.sin(t * 31)); }
function lineProg(g, u) { let acc = 0; return g.nch.map(n => { const p = clamp((u * g.tot - acc) / n); acc += n; return p; }); }
function doodleGeo(a, t) { const g = annGeo(a, t); return a.doodle === 'wave' ? E.wavePath(g.lastL + g.lastW + 14, g.lastY - 4, 1) : E.heartPath(g.lastL + g.lastW + 26, g.lastY - 12, 1); }
function cellRect(t) {
  const x0 = X(2027) - U / 2, k = t / B, f = eio(seg(k, 68, 70));
  return { x0, x1: x0 + lerp(U, ENDW, f), y0: lerp(BAND.top, -ENDH / 2, f), y1: lerp(BAND.bot, ENDH / 2, f) };
}
const NEXT = { x: X(2027) + 26, y: 12 };
// activities: [t0, t1, tipFn(t) → [x,y], lift(t)]
let ACTS = null;
function buildActs() {
  const A = [];
  A.push([T(.55), T(1), t => dotXY(1926, t), t => { const u = seg(t, T(.55), T(1)); return u < .6 ? lerp(.45, .6, u / .6) : lerp(.6, 0, eo((u - .6) / .4)); }]);
  for (const a of ANN) {
    if (a.y === 2026) continue;
    A.push([T(a.k[0]), T(a.k[1]), t => annTip(a, t), t => annLift(a, t)]);
    if (a.doodle) A.push([T(a.dk[0]), T(a.dk[1]), t => { const p = doodleGeo(a, t), u = seg(t, T(a.dk[0]), T(a.dk[1])); return p[Math.floor(u * (p.length - 1))]; }, () => .04]);
  }
  for (let i = 1; i < LIFE.length - 1; i++) {                       // the pencil draws each line segment and taps the dot
    const y = LIFE[i], t1 = tl(y), sp = t1 - tl(y - 1), trav = Math.min(.45, sp * .8), t0 = t1 - trav;
    A.push([t0, t1, t => { const a = dotXY(y - 1, t), b = dotXY(y, t), u = seg(t, t0, t1); let x = lerp(a[0], b[0], u), yy = lerp(a[1], b[1], u);
      if (sp < .1) { x += (hash(t * 97) - .5) * 5; yy += (hash(t * 131) - .5) * 7; } return [x, yy]; },
      t => { const u = seg(t, t0, t1); return u > .7 ? .22 * Math.sin((u - .7) / .3 * Math.PI) : .03; }]);
  }
  // startled: the pencil recoils off the number and freezes for half a beat (tiny tremble)
  A.push([T(K.startle[0]) + .02, T(K.startle[1]), t => { const b = dotXY(1998, t), u = seg(t, T(K.startle[0]), T(K.startle[0]) + .12); return [b[0] + 14 * eo(u) + (hash(t * 53) - .5) * 1.2, b[1] + 16 * eo(u) + (hash(t * 71) - .5) * 1.2]; }, t => .32 * eo(seg(t, T(K.startle[0]), T(K.startle[0]) + .1))]);
  A.push([T(K.flip[0]), T(K.flip[1]), t => { const b = dotXY(1998, t), u = seg(t, T(K.flip[0]), T(K.flip[1])); return [b[0] + 14 - 44 * ss(u), b[1] + 16 - 56 * Math.sin(u * Math.PI)]; }, t => .32 + .6 * Math.sin(seg(t, T(K.flip[0]), T(K.flip[1])) * Math.PI)]);
  // after the cut: hover over the empty slot, anticipation, tap
  A.push([T(K.stop), T(48), t => dotXY(2026, t), t => { const k = t / B; return k < 47.3 ? .95 : k < 47.62 ? lerp(.95, 1.1, ss(seg(k, 47.3, 47.62))) : lerp(1.1, 0, Math.pow(seg(k, 47.62, 48), 1.6)); }]);
  A.push([T(K.write2026[0]), T(K.write2026[1]), t => annTip(ANN[4], t), t => annLift(ANN[4], t)]);
  A.push([T(K.cell[0]), T(K.cell[1]), t => { const r = cellRect(t), u = seg(t, T(K.cell[0]), T(K.cell[1])), per = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1], [r.x0, r.y0]]; const R = E.resample(per, 2); const L = R.total * u; let j = 0; while (j < R.len.length - 1 && R.len[j] < L) j++; return R.pts[j]; }, t => .03 + .12 * Math.abs(Math.sin(seg(t, T(K.cell[0]), T(K.cell[1])) * Math.PI * 4))]);
  A.push([T(K.writeNext[0]), T(K.writeNext[1]), t => { const u = seg(t, T(K.writeNext[0]), T(K.writeNext[1])), w = handW('Next summer?') * 34 / ASZ, f = u * w; return [NEXT.x + f, NEXT.y - 34 * (.3 + .2 * Math.sin(f * .5))]; }, t => .04 + .05 * Math.abs(Math.sin(t * 31))]);
  A.sort((a, b) => a[0] - b[0]);
  return A;
}
function penAt(t, cam) {
  if (!ACTS) ACTS = buildActs();
  const k = t / B;
  if (k >= 55.5 && k < 64.2) return null;                           // off stage during the pull-back, morph and scale
  if (k >= 68.3) return null;
  const off = tt => { const c = camAt(tt); return E.s2w(c, 2150, 1320); };
  let cur = null, prev = null, next = null;
  for (let i = 0; i < ACTS.length; i++) {
    const a = ACTS[i];
    if (t >= a[0] && t <= a[1]) { cur = a; break; }
    if (a[1] < t) prev = a;
    if (a[0] > t) { next = a; break; }
  }
  let p, lift;
  if (cur) { p = cur[2](t); lift = cur[3](t); }
  else {
    const pa = prev ? prev[2](prev[1]) : off(t), na = next ? next[2](next[0]) : off(t);
    const t0 = prev ? prev[1] : 0, t1 = next ? next[0] : DUR, gap = t1 - t0;
    if (gap > 1.6 || !prev || !next) {                               // leave the frame and come back
      const mid = (t0 + t1) / 2;
      if (!prev || (next && t > mid)) { const u = eio(clamp((t - Math.max(t0, t1 - .9)) / Math.min(.9, t1 - t0))); const o = off(t); p = [lerp(o[0], na[0], u), lerp(o[1], na[1], u)]; lift = lerp(.8, next ? next[3](next[0]) : .8, u); }
      else { const u = eio(clamp((t - t0) / .9)); const o = off(t); p = [lerp(pa[0], o[0], u), lerp(pa[1], o[1], u)]; lift = lerp(prev[3](prev[1]), .8, u); }
    } else {
      const u = eio(seg(t, t0, t1)); p = [lerp(pa[0], na[0], u), lerp(pa[1], na[1], u)];
      lift = Math.max(lerp(prev[3](prev[1]), next[3](next[0]), u), Math.sin(u * Math.PI) * Math.min(.5, gap * .9));
    }
  }
  if (k >= K.stop && k < 55.5) {                                    // exit after writing 2026
    const u = eio(seg(k, K.pencilExit[0], K.pencilExit[1]));
    if (u > 0) { const o = off(t), q = annTip(ANN[4], T(K.write2026[1])); p = [lerp(q[0], o[0], u), lerp(q[1], o[1], u)]; lift = lerp(.05, .8, u); }
  }
  const flip = eio(seg(k, 40.56, 40.94));
  // hand posture: steeper in the dense passages so the body stays clear of fresh dots
  const ang = k < K.stop ? lerp(.62, 1.02, ss(seg(k, 27, 32))) : k < 48.2 ? .85 : k < 60 ? lerp(.85, 1.15, ss(seg(k, 48.2, 48.9))) : .8;
  // foreground defocus in the silent close-up; focus racks to the tip as it lands
  const blur = k >= K.stop && k < 48 ? lerp(11, 0, Math.pow(seg(k, 47.55, 48), .8)) : 0;
  const focus = k >= K.stop && k < 48 ? seg(k, 47.6, 48) : 1;
  return { p, lift: clamp(lift, 0, 1.2), flip, blur, focus, ang };
}

// ---------- captions ----------
let CAPS = [];
export function setCaptions(lines, dur, words) {
  CAPS = lines.map((L, i) => {
    const d = dur?.[L.id] ?? L.text.length * .068;
    let ws;
    if (words?.[L.id]) ws = words[L.id].map(w => ({ w: w.w, t: L.t + w.t }));
    else { const toks = L.text.split(' '); const per = d / toks.length; ws = toks.map((w, j) => ({ w, t: L.t + j * per })); }
    const t1 = L.hold ? L.t + L.hold : Math.max(L.t + 1.8, L.t + d + .6) + .5;
    return { id: L.id, t0: L.t - .05, t1, words: ws, text: L.text, t: L.t, d };
  });
}
export const subs = () => CAPS.map(c => ({ t0: c.t0, t1: c.t1, text: c.text }));
function kickerAt(t) { let last = LIFE0; for (const y of LIFE) if (tl(y) <= t) last = y; return `${LIFE0}–${last}`; }

// ---------- chart layer ----------
function drawAxes(g, t, cam, fade) {
  const k = t / B, vm = vmaxAt(t);
  const x0 = -40, x1 = X(LIFE1) + 30;
  const gridIn = seg(k, K.grid[0], K.grid[1]);
  g.save(); g.globalAlpha = fade;
  // gridlines & ceiling
  for (let v = -.8; v <= 1.61; v += .4) {
    const y = Yv(v, vm); if (y < BOX.top - .5 || y > BOX.bot) continue;
    const a = gridIn * clamp((y - BOX.top + 40) / 40);
    g.strokeStyle = Math.abs(v) < .01 ? '#BDB4A5' : P.rule; g.lineWidth = Math.abs(v) < .01 ? 1.3 : 1; g.globalAlpha = fade * a;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, x1, eo(gridIn)), y); g.stroke();
  }
  // the ceiling (top of the frame) with scars where data broke through
  g.globalAlpha = fade * gridIn; g.strokeStyle = P.ink; g.lineWidth = 1.4;
  const gaps = [];
  if (t >= tl(1998)) gaps.push(X(1998)); if (t >= tl(2024)) gaps.push(X(2024));
  let cx = x0; const xe = lerp(x0, x1, eo(gridIn));
  for (const gx of gaps) { g.beginPath(); g.moveTo(cx, BOX.top); g.lineTo(Math.min(xe, gx - 11), BOX.top); g.stroke(); cx = gx + 11; }
  g.beginPath(); g.moveTo(cx, BOX.top); g.lineTo(xe, BOX.top); g.stroke();
  for (const gx of gaps) {                                          // torn ends
    g.lineWidth = 1; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(gx + s * 11, BOX.top); g.lineTo(gx + s * 7, BOX.top - 6); g.moveTo(gx + s * 11, BOX.top); g.lineTo(gx + s * 14, BOX.top - 5); g.stroke(); }
  }
  // y axis
  g.lineWidth = 1.4; g.globalAlpha = fade * gridIn;
  g.beginPath(); g.moveTo(x0, BOX.bot); g.lineTo(x0, lerp(BOX.bot, BOX.top, eo(gridIn))); g.stroke();
  // x axis (drawn from the birth dot's drop line to the right)
  const ax = seg(k, K.axis[0] + .5, K.axis[1]);
  const [bx, by] = dotXY(1926, t);
  const drop = seg(k, K.axis[0], K.axis[0] + .6);
  if (drop > 0) {
    g.globalAlpha = fade * .8; g.setLineDash([3, 5]); g.lineWidth = 1; g.strokeStyle = P.inkSoft;
    g.beginPath(); g.moveTo(bx, by + 10); g.lineTo(bx, lerp(by + 10, BOX.bot, eo(drop))); g.stroke(); g.setLineDash([]);
  }
  if (ax > 0) {
    g.globalAlpha = fade; g.strokeStyle = P.ink; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(Math.min(x0, bx), BOX.bot); g.lineTo(lerp(bx, x1, eo(ax)), BOX.bot); g.stroke();
    // decade ticks + labels, written as the pen passes
    const pf = penYearF(t);
    for (let y = 1926; y <= 2026; y++) {
      if (!(y === 1926 || y % 10 === 0 || y === 2026)) continue;
      const xx = X(y); if (xx > lerp(bx, x1, eo(ax))) continue;
      const shown = y === 1926 ? seg(k, K.axis[0] + .8, K.axis[0] + 1.6) : clamp((pf - y + .5) * 1.5) * (k > 9 ? 1 : 0) + (k >= 55 ? 1 : 0);
      const s = clamp(shown);
      if (s <= 0) continue;
      g.globalAlpha = fade; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xx, BOX.bot); g.lineTo(xx, BOX.bot + 7); g.stroke();
      E.setType(g, String(y), xx, BOX.bot + 30, { size: 17, align: 'center', progress: s, alpha: fade, color: y === 1926 || y === 2026 ? P.ink : P.inkSoft });
    }
  }
  g.restore();
}
function stickyLabels(g, t, cam, fade) {
  const k = t / B, vm = vmaxAt(t), gridIn = seg(k, K.grid[0] + .4, K.grid[1] + .4);
  if (gridIn <= 0 || fade <= 0) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  { // frozen column: once the real axis scrolls off-screen the labels pin to the left edge over a paper strip
    const ax = E.w2s(cam, -40, 0)[0], fz = clamp((150 - ax) / 60) * gridIn * fade;
    if (fz > 0) { const gr = g.createLinearGradient(118, 0, 175, 0); gr.addColorStop(0, `rgba(246,243,236,${.96 * fz})`); gr.addColorStop(1, 'rgba(246,243,236,0)'); g.fillStyle = `rgba(246,243,236,${.96 * fz})`; g.fillRect(0, 0, 118, H); g.fillStyle = gr; g.fillRect(118, 0, 57, H);
      g.strokeStyle = P.rule; g.globalAlpha = fz; g.lineWidth = 1; g.beginPath(); g.moveTo(124.5, 0); g.lineTo(124.5, H); g.stroke(); g.globalAlpha = 1; }
  }
  for (let v = -.8; v <= 1.61; v += .4) {
    const y = Yv(v, vm); if (y < BOX.top - .5 || y > BOX.bot) continue;
    const A = E.w2s(cam, cam.x - 3000, y), Bp = E.w2s(cam, cam.x + 3000, y);
    const axS = E.w2s(cam, -40, y);
    const sxRight = Math.max(112, axS[0] - 10);
    const f = (sxRight - A[0]) / (Bp[0] - A[0]), sy = lerp(A[1], Bp[1], f);
    if (sy < 20 || sy > 880) continue;
    const lab = Math.abs(v) < .01 ? '0.0' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1);
    g.globalAlpha = fade * gridIn * clamp((y - BOX.top + 40) / 40);
    g.fillStyle = P.paper; g.fillRect(sxRight - 62, sy - 13, 66, 22);
    E.setType(g, lab + '°', sxRight, sy + 6, { size: 18, align: 'right', color: Math.abs(v) < .01 ? P.ink : P.inkSoft });
    if (Math.abs(v) < .01) { g.fillRect(sxRight + 10, sy - 26, 170, 20); E.setType(g, '0 = 1951–80 average', sxRight + 14, sy - 10, { size: 15, align: 'left', color: P.inkSoft }); }
  }
  g.restore();
}

// ---------- main render ----------
export function renderFilm(g, t, opt = {}) {
  _g = g;
  const k = t / B, cam = camAt(t);
  E.drawPaper(g, cam, { dots: .9 });
  E.applyCam(g, cam);
  const vm = vmaxAt(t);
  const morphing = k >= K.morph[0];
  const axisFade = 1 - seg(k, K.morph[0], K.morph[0] + 1.2);

  // title (the chart's own headline, world space)
  const tIn = seg(k, ...K.title), sIn = seg(k, ...K.sub);
  const titleFade = (1 - seg(k, 9, 10) + seg(k, 54.4, 55.4)) * (1 - seg(k, 64.3, 65.3));
  if (tIn > 0) E.setType(g, 'A Hundred Summers', 0, -300, { size: 66, font: 'Newsreader', weight: 500, color: P.ink, progress: tIn, alpha: titleFade, rise: 10 });
  if (sIn > 0) E.setType(g, 'Global summer temperature (June–August), °C · one dot per summer', 2, -272, { size: 17, progress: sIn, alpha: titleFade });

  if (axisFade > 0) drawAxes(g, t, cam, axisFade);

  // prior record (1880–1925), printed right-to-left during the scale reveal
  if (k >= K.prior[0] && k < 69.2) {
    g.save(); g.globalAlpha = 1 - seg(k, 68, 69.2);
    for (let y = 1925; y >= 1880; y--) {
      const ta = T(K.prior[0]) + (1925 - y) / 45 * (T(K.prior[1]) - T(K.prior[0])), u = clamp((t - ta) / .12);
      if (u <= 0) continue;
      const h = (BAND.bot - BAND.top) * eo(u), cy = (BAND.top + BAND.bot) / 2;
      E.stripe(g, X(y) - U / 2, X(y) + U / 2, cy - h / 2, cy + h / 2, E.valueColor(V[y]));
    }
    g.restore();
  }

  // life series: line + dots, or the morph into stripes
  const mStart = y => T(K.morph[0]) + (y - LIFE0) / 101 * B * .85;
  const mU = y => clamp((t - mStart(y)) / .3);
  g.save();
  for (let i = 1; i < LIFE.length; i++) {
    const y = LIFE[i], t1 = tl(y), t0 = Math.max(tl(y - 1), t1 - Math.min(.45, (t1 - tl(y - 1)) * .8));
    if (t < t0) break;
    const a = dotXY(y - 1, t), b = dotXY(y, t), u = seg(t, t0, t1);
    const al = morphing ? 1 - clamp(mU(y - 1) * 3) : 1; if (al <= 0) continue;
    E.inkLine(g, [a, [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]], { width: 2.4, alpha: al });
  }
  for (const y of LIFE) {
    const fr = t - tl(y); if (fr < 0) continue;
    const [x, yy] = dotXY(y, t), col = E.valueColor(V[y]);
    if (k >= 68) { const i = y - LIFE0, f = eio(seg(k, 68.05 + (100 - i) / 100 * .7, 69.25 + (100 - i) / 100 * .7)), mx = MINI.x0 + i * MINI.w;
      E.stripe(g, lerp(x - U / 2, mx, f), lerp(x + U / 2, mx + MINI.w, f), lerp(BAND.top, MINI.y0, f), lerp(BAND.bot, MINI.y1, f), col); }
    else if (morphing && mU(y) > 0) E.morphMark(g, mU(y), { x, y: yy, r: 6 }, { x0: x - U / 2, x1: x + U / 2, y0: BAND.top, y1: BAND.bot }, col);
    else E.dataDot(g, x, yy, 6, col, { fresh: fr, ripple: y === 1926 || y === 2026 ? 2.2 : y > 1998 ? 0 : .8 });
  }
  g.restore();
  // the first and the last summer carry their number (bookends)
  for (const [y, k0] of [[1926, 1.15], [2026, 48.3]]) {
    const u = seg(k, k0, k0 + .5), f = (morphing ? 1 - clamp((t - mStart(y)) / .25) : 1) * (y === 1926 ? 1 - seg(k, 9, 10) : 1);
    if (u <= 0 || f <= 0) continue;
    const [x, yy] = dotXY(y, t), lab = (V[y] > 0 ? '+' : '−') + Math.abs(V[y]).toFixed(2) + '°C';
    const zs = 1.25 / Math.sqrt(cam.zoom);
    E.setType(g, lab, x + 11 + 9 * zs, yy + 5 * zs, { size: 15 * zs, progress: u, alpha: f, color: P.inkSoft });
  }
  // band frame after the morph
  const bf = seg(k, 57, 57.6);
  if (bf > 0 && k < 69) {
    const bx0 = k >= K.prior[0] ? X(1925 - Math.floor(clamp(seg(t, T(K.prior[0]), T(K.prior[1]))) * 45)) - U / 2 : X(1926) - U / 2;
    g.save(); g.strokeStyle = P.ink; g.lineWidth = 1.1; g.globalAlpha = bf * (1 - seg(k, 67.8, 68.4)); g.strokeRect(bx0, BAND.top, X(2026) + U / 2 - bx0, BAND.bot - BAND.top); g.restore();
    const lf = bf * (1 - seg(k, 67.5, 68.5));
    E.setType(g, '1926', X(1926), BAND.bot + 30, { size: 18, align: 'center', color: P.ink, alpha: lf });
    E.setType(g, '2026', X(2026), BAND.bot + 30, { size: 18, align: 'center', color: P.ink, alpha: lf });
    const pf = seg(k, 62.8, 63.6);
    if (pf > 0) E.setType(g, '1880', X(1880), BAND.bot + 30, { size: 18, align: 'center', color: P.inkSoft, progress: pf, alpha: lf });
  }

  // the empty column waiting for 2026 (appears at the cut, dissolves as the dot lands)
  if (k >= K.stop && k < 50) {
    const ga = seg(k, K.stop, K.stop + .5) * (1 - seg(k, 48, 49.5));
    g.save(); g.globalAlpha = ga * .8; g.strokeStyle = P.inkSoft; g.lineWidth = 1; g.setLineDash([4, 6]);
    g.beginPath(); g.moveTo(X(2026), BOX.top - 150); g.lineTo(X(2026), BOX.bot); g.stroke(); g.setLineDash([]);
    E.setType(g, '2026', X(2026), BOX.top - 162, { size: 16, align: 'center', color: P.inkSoft, alpha: ga });
    g.restore();
  }
  // annotations
  const annFade = a => morphing ? 1 - clamp((t - mStart(a.y)) / .25) : 1;
  for (const a of ANN) {
    if (t < T(a.k[0])) continue;
    const G = annGeo(a, t), ph = phases(a), f = annFade(a); if (f <= 0) continue;
    g.save(); g.globalAlpha = f;
    E.pencilStroke(g, E.ringPath(G.dot[0], G.dot[1], G.r, a.y), { color: a.col, width: 1.6, progress: seg(t, ...ph.ring), seed: a.y, passes: 1 });
    if (t >= ph.lead[0]) E.leader(g, G.lb, G.la, { color: a.col, progress: seg(t, ...ph.lead), seed: a.y + 3 });
    if (t >= ph.text[0]) { const lp = lineProg(G, textU(a, t)); G.lines.forEach((ln, i) => { if (lp[i] > 0) E.handText(g, ln, G.tx, G.ty + i * G.LH, { size: ASZ, color: a.col, progress: lp[i], align: a.right ? 'right' : 'left', zoom: cam.zoom }); }); }
    if (a.doodle && t >= T(a.dk[0])) E.pencilStroke(g, doodleGeo(a, t), { color: a.col, width: 1.7, progress: seg(t, T(a.dk[0]), T(a.dk[1])), seed: a.y + 9, passes: 1 });
    g.restore();
  }
  // after the morph: tiny pencil marks above the band (the life notes, compressed)
  const lab = seg(k, ...K.labels), labFade = 1 - seg(k, 67.5, 68.5);
  if (lab > 0) {
    const Ly = BAND.top - 16;
    const marks = [[1926, 'born', P.blue, 0], [1933, null, P.blue, .15, 'wave'], [1958, null, P.blue, .3, 'heart'], [1998, '1998', P.red, .5], [2026, '100', P.red, .7]];
    for (const [y, txt, col, d, dd] of marks) {
      const u = clamp((lab - d) / .3); if (u <= 0) continue;
      g.save(); g.globalAlpha = labFade;
      E.pencilStroke(g, [[X(y), Ly + 4], [X(y), Ly - 6]], { color: col, width: 1.4, progress: u, passes: 1, seed: y });
      if (txt) E.handText(g, txt, X(y), Ly - 12, { size: 24, color: col, progress: u, align: 'center', zoom: cam.zoom });
      if (dd === 'wave') E.pencilStroke(g, E.wavePath(X(y) - 17, Ly - 12, .5), { color: col, width: 1.4, progress: u, passes: 1, seed: 5 });
      if (dd === 'heart') E.pencilStroke(g, E.heartPath(X(y), Ly - 18, .6), { color: col, width: 1.4, progress: u, passes: 1, seed: 6 });
      g.restore();
    }
  }
  // bracket: her hundred summers
  const br = seg(k, ...K.bracket);
  if (br > 0) {
    g.save(); g.globalAlpha = 1 - seg(k, 67.6, 68.3);
    E.pencilStroke(g, E.bracketPath(X(1926) - 6, X(2026) + 6, BAND.bot + 52, 12), { color: P.blue, width: 1.8, progress: clamp(br * 1.6), seed: 21 });
    E.handText(g, 'her hundred summers', (X(1926) + X(2026)) / 2, BAND.bot + 100, { size: 38, color: P.blue, progress: clamp(br * 1.6 - .5), align: 'center', zoom: cam.zoom });
    g.restore();
  }
  // the empty cell and the question
  if (k >= K.cell[0]) {
    const r = cellRect(t);
    E.dashedCell(g, r.x0, r.y0, r.x1, r.y1, { progress: seg(t, T(K.cell[0]), T(K.cell[1])), color: P.red, width: 1.8 / Math.max(1, cam.zoom * .8) * 1.4 });
    const nf = 1 - seg(k, 68, 68.6);
    if (k >= K.writeNext[0] && nf > 0) E.handText(g, 'Next summer?', NEXT.x, NEXT.y, { size: 34, color: P.red, progress: seg(k, ...K.writeNext), zoom: cam.zoom, alpha: nf });
  }

  // screen space: sticky axis labels, pencil, caption, end card
  stickyLabels(g, t, cam, axisFade);
  const pen = penAt(t, cam);
  if (!opt.nosub) {
    let vis = 0; for (const c of CAPS) vis = Math.max(vis, clamp((t - c.t0) / .25) * (1 - clamp((t - c.t1) / .3)));
    if (vis > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); const gr = g.createLinearGradient(0, 850, 0, 925); gr.addColorStop(0, 'rgba(246,243,236,0)'); gr.addColorStop(1, `rgba(246,243,236,${.94 * vis})`); g.fillStyle = gr; g.fillRect(0, 850, W, 230); g.restore(); }
  }
  if (pen) { const s = E.w2s(cam, pen.p[0], pen.p[1]); E.drawPencil(g, { tip: s, s: .72 * Math.pow(cam.zoom, .6), lift: pen.lift, flip: pen.flip, blur: pen.blur, focus: pen.focus, ang: pen.ang }); }
  if (!opt.nosub) {
    for (const c of CAPS) E.caption(g, c.words, t, { t0: c.t0, t1: c.t1, kicker: kickerAt(t) });
  }
  if (k >= 68.6) { E.applyCam(g, cam); endCard(g, t, cam); }
}

function endCard(g, t, cam) {
  const k = t / B, x0 = X(2027) - U / 2, L = x0 + 64;
  const p = s => seg(k, s, s + 1.2);
  E.setType(g, 'A Hundred Summers', L, -170, { size: 74, font: 'Newsreader', weight: 500, color: P.ink, progress: p(68.9), rise: 8 });
  E.setType(g, 'DATA STORYTELLING', L + 2, -138, { size: 18, color: P.red, progress: p(69.4), track: 3 });
  // the little stripes arrive from the band; the empty next-summer cell sits at their end
  const ce = seg(k, 69.7, 70.3);
  if (ce > 0) E.dashedCell(g, MINI.x0 + 101 * MINI.w + 2, MINI.y0, MINI.x0 + 102 * MINI.w + 2, MINI.y1, { progress: ce, color: P.red, width: 1.4, dash: 5, gap: 4 });
  E.setType(g, '1926', MINI.x0, MINI.y1 + 20, { size: 14, progress: p(69.9) });
  E.setType(g, '2026', MINI.x0 + 101 * MINI.w, MINI.y1 + 20, { size: 14, progress: p(69.9), align: 'right' });
  E.setType(g, 'Lemo-Opuscar  ·  LemoLab × Claude Opus 5.5', L, 12, { size: 30, font: 'Newsreader', weight: 400, color: P.ink, progress: p(70.2) });
  const cr = ['Data: NASA GISS Surface Temperature Analysis (GISTEMP v4), global land–ocean, June–August',
    'anomaly vs 1951–80, public domain. 2026 value preliminary, retrieved 2026-09-26.',
    'Fonts: Newsreader, Caveat, IBM Plex Mono (SIL OFL) · Voice: Kokoro-82M, af_alloy (Apache-2.0)',
    'Music, sound and pictures: original, made in code.'];
  cr.forEach((s, i) => E.setType(g, s, L, 62 + i * 26, { size: 16, color: P.inkSoft, progress: p(70.6 + i * .15) }));
  const hf = seg(k, 71.6, 73.0);
  if (hf > 0) E.handText(g, 'Her story is fiction. Every number is real.', L, 232, { size: 34, color: P.blue, progress: hf, zoom: cam.zoom });
}

// ---------- events for the mix (foley / music cue hooks) ----------
export function buildEvents() {
  const ev = [];
  for (const y of LIFE) ev.push({ t: tl(y), type: 'dot', year: y, v: V[y], idx: y - LIFE0 });
  for (const a of ANN) { const ph = phases(a); ev.push({ t: ph.ring[0], type: 'ring', year: a.y, d: ph.ring[1] - ph.ring[0] }); ev.push({ t: ph.lead[0], type: 'leader', d: ph.lead[1] - ph.lead[0] }); { const td = ph.text[1] - ph.text[0], h = a.right ? HOP * td : 0; ev.push({ t: ph.text[0] + h, type: 'write', year: a.y, d: td - h, pan: 0 }); } if (a.doodle) ev.push({ t: T(a.dk[0]), type: 'doodle', kind: a.doodle, d: T(a.dk[1]) - T(a.dk[0]) }); }
  ev.push({ t: T(K.axis[0]), type: 'ruler', d: T(.6) }, { t: T(K.axis[0] + .5), type: 'ruler', d: T(1) }, { t: T(K.grid[0]), type: 'ruler', d: T(1.6) });
  ev.push({ t: T(K.break1), type: 'break' }, { t: T(K.break2), type: 'break' }, { t: T(40.03), type: 'startle' }, { t: T(40.56), type: 'flip' }, { t: T(40.96), type: 'flipland' });
  for (let i = 0; i < 4; i++) ev.push({ t: T(K.rescale1[0] + i * (K.rescale1[1] - K.rescale1[0]) / 4), type: 'ratchet', i });
  ev.push({ t: T(K.stop), type: 'stop' }, { t: T(K.tap2026), type: 'tap2026' });
  ev.push({ t: T(K.rescale2[0]), type: 'rescale2', d: T(1.5) });
  for (const y of LIFE) ev.push({ t: T(K.morph[0]) + (y - LIFE0) / 101 * B * .85, type: 'morph', year: y, v: V[y], idx: y - LIFE0 });
  for (let y = 1925; y >= 1880; y--) ev.push({ t: T(K.prior[0]) + (1925 - y) / 45 * (T(K.prior[1]) - T(K.prior[0])), type: 'prior', year: y, v: V[y] });
  ev.push({ t: T(K.bracket[0]), type: 'write', d: T(1.2), pan: 0 });
  for (let i = 0; i < 4; i++) ev.push({ t: T(K.cell[0] + i * .25), type: 'celltap', i });
  ev.push({ t: T(K.writeNext[0]), type: 'write', d: T(1.3), pan: .4 }, { t: T(K.end[0]), type: 'end' });
  return ev.sort((a, b) => a.t - b.t);
}
