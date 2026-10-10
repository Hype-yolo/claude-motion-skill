// LOBBY — grand one-point-perspective hall: lacquer walls, fluted gold pilasters with fan uplights, coffered ceiling,
// chevron-runner marble floor with a sunburst inlay, bronze elevator bank + semicircle floor dial, clock, concierge radio, stair doors.
import * as D from '../engine/deco.js';
import * as T from '../engine/type.js';
import { makeCam } from '../engine/cam.js';
const { C } = D;

export const ROOM = { W: 8, H: 9, ZB: 13 };
let floorTex = null;

function buildFloor() {
  const S = 50, w = 16 * S, h = 14 * S, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  // black marble with faint veins
  g.fillStyle = '#0b0a08'; g.fillRect(0, 0, w, h);
  const R = D.mulberry(7);
  for (let i = 0; i < 90; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - .5) * 120; y += (R() - .3) * 60; g.lineTo(x, y); } g.strokeStyle = `rgba(120,110,95,${.05 + R() * .07})`; g.lineWidth = .6 + R(); g.stroke(); }
  // diamond grid of thin gold lines outside the runner
  g.strokeStyle = 'rgba(201,162,75,.45)'; g.lineWidth = 1.4;
  for (let k = -30; k < 30; k++) { g.beginPath(); g.moveTo(k * S * 1.4, 0); g.lineTo(k * S * 1.4 + h, h); g.stroke(); g.beginPath(); g.moveTo(k * S * 1.4, 0); g.lineTo(k * S * 1.4 - h, h); g.stroke(); }
  // central runner (ivory) x ∈ [-2.4, 2.4]
  const X = x => (x + 8) * S, Z = z => z * S;
  const rx0 = X(-2.4), rx1 = X(2.4);
  const iv = g.createLinearGradient(rx0, 0, rx1, 0); iv.addColorStop(0, '#cdbf9f'); iv.addColorStop(.5, '#efe4cc'); iv.addColorStop(1, '#cdbf9f');
  g.fillStyle = iv; g.fillRect(rx0, 0, rx1 - rx0, Z(10.2));
  // black chevrons pointing toward the elevator (+z)
  g.fillStyle = '#12100d';
  for (let z = .4; z < 9.8; z += 1.3) {
    g.beginPath(); g.moveTo(rx0 + 12, Z(z)); g.lineTo(X(0), Z(z + .9)); g.lineTo(rx1 - 12, Z(z)); g.lineTo(rx1 - 12, Z(z + .38)); g.lineTo(X(0), Z(z + 1.28)); g.lineTo(rx0 + 12, Z(z + .38)); g.closePath(); g.fill();
  }
  // runner borders: triple gold rules
  for (const x of [rx0, rx1]) for (const d of [-10, 0, 10]) { g.fillStyle = d ? 'rgba(201,162,75,.8)' : '#e6c677'; g.fillRect(x + d - (d ? 1 : 2.5), 0, d ? 2 : 5, Z(10.2)); }
  // sunburst inlay before the elevator (semicircle, centre at the door)
  const cx = X(0), cz = Z(13);
  for (let i = 0; i < 24; i++) {
    const a0 = Math.PI + i * Math.PI / 24, a1 = a0 + Math.PI / 24;
    g.beginPath(); g.moveTo(cx, cz); g.arc(cx, cz, 3.4 * S, a0, a1); g.closePath(); g.fillStyle = i % 2 ? '#e9ddc2' : '#15120e'; g.fill();
  }
  g.beginPath(); g.arc(cx, cz, 3.4 * S, Math.PI, 0); g.strokeStyle = '#e6c677'; g.lineWidth = 6; g.stroke();
  g.beginPath(); g.arc(cx, cz, 3.7 * S, Math.PI, 0); g.strokeStyle = 'rgba(201,162,75,.8)'; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.arc(cx, cz, 1.0 * S, Math.PI, 0); g.fillStyle = '#0d0b08'; g.fill(); g.strokeStyle = '#e6c677'; g.lineWidth = 3; g.stroke();
  // wall base band
  g.fillStyle = 'rgba(201,162,75,.7)'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
  return cv;
}

// o: { cam overrides, t, glowK, pip: fn(g, cam) drawn at the right depth, dial (0..1), plaque (0..1 drop), clock {h,m,s}, radioOn }
export function drawLobby(g, o = {}) {
  const { W, H, ZB } = ROOM;
  const cam = makeCam({ x: 0, y: 1.3, z: 0, f: 900, oy: 600, ...(o.cam || {}) });
  const P = cam.P, t = o.t || 0;
  if (!floorTex) floorTex = buildFloor();
  g.save();
  g.fillStyle = '#060504'; g.fillRect(0, 0, 1920, 1080);
  const zN = cam.z + .6;
  const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => { const q = P(...p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fillStyle = fill; g.fill(); };
  const line = (a, b, opt = {}) => D.gline(g, [P(...a).slice(0, 2), P(...b).slice(0, 2)], opt);
  // ---- ceiling ----
  {
    const a = P(-W, H, ZB), b = P(W, H, ZB);
    const gr = g.createLinearGradient(0, 0, 0, a[1]); gr.addColorStop(0, '#15100a'); gr.addColorStop(1, '#070605');
    poly([[-W, H, zN], [W, H, zN], [W, H, ZB], [-W, H, ZB]], gr);
    for (let z = Math.ceil(zN); z <= ZB; z += 1.5) line([-W, H, z], [W, H, z], { w: 1.4, alpha: .55 });
    for (let x = -6; x <= 6; x += 3) line([x, H, zN], [x, H, ZB], { w: 1.2, alpha: .45 });
    // stepped cornice along both walls
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) line([sx * (W - k * .35), H - .3 - k * .3, zN], [sx * (W - k * .35), H - .3 - k * .3, ZB], { w: 1.8 - k * .4 });
  }
  // ---- side walls ----
  for (const sx of [-1, 1]) {
    const gr = g.createLinearGradient(sx < 0 ? 0 : 1920, 0, 960, 0); gr.addColorStop(0, '#1a130b'); gr.addColorStop(1, '#0a0806');
    poly([[sx * W, 0, zN], [sx * W, H, zN], [sx * W, H, ZB], [sx * W, 0, ZB]], gr);
    // dado + frieze rules
    for (const y of [1.1, 1.2, 6.2, 6.3]) line([sx * W, y, zN], [sx * W, y, ZB], { w: 1.2, alpha: .75 });
    D.gline(g, [P(sx * W, 6.6, zN), P(sx * W, 6.6, ZB)].map(p => p.slice(0, 2)), { w: 1, alpha: .5 });
    // pilasters
    for (let z = 2.5; z < ZB; z += 2) {
      if (z < zN + .2) continue;
      const w2 = .35, x = sx * W;
      const pl = [[x, 0, z - w2], [x, 6.2, z - w2], [x, 6.2, z + w2], [x, 0, z + w2]];
      const q0 = P(...pl[0]), q2 = P(...pl[2]);
      const pg = g.createLinearGradient(q0[0], 0, q2[0], 0); pg.addColorStop(0, '#3a2a12'); pg.addColorStop(.5, '#6b5024'); pg.addColorStop(1, '#2a1e0c');
      poly(pl, pg);
      for (let k = -2; k <= 2; k++) line([x, .2, z + k * .12], [x, 6, z + k * .12], { w: k ? .9 : 1.4, sheen: .3 });
      // stepped capital
      for (let k = 0; k < 3; k++) line([x, 6.2 + k * .22, z - w2 - k * .1], [x, 6.2 + k * .22, z + w2 + k * .1], { w: 1.4 });
      // fan uplight sconce + glow on the wall above
      const sc = P(x * .985, 3.3, z), sz = cam.scaleAt(x, 3.3, z);
      D.glow(g, sc[0], sc[1] - sz * 1.2, sz * 2.6, '#ffc36a', .42 * (o.glowK ?? 1), 1.5);
      D.fan(g, sc[0], sc[1], sz * .45, { a0: Math.PI, a1: D.TAU, ribs: 6, fill: '#c9a24b', ring: .25 });
    }
  }
  // ---- back wall ----
  {
    const gr = g.createLinearGradient(0, P(0, H, ZB)[1], 0, P(0, 0, ZB)[1]); gr.addColorStop(0, '#0d0a07'); gr.addColorStop(1, '#17110a');
    poly([[-W, 0, ZB], [-W, H, ZB], [W, H, ZB], [W, 0, ZB]], gr);
    // vertical gold bands framing the elevator bay
    for (const x of [-5.6, -5.3, 5.3, 5.6]) line([x, 0, ZB], [x, H, ZB], { w: 1.4 });
    // frieze of chevrons
    const f0 = P(-5.3, 7.6, ZB), f1 = P(5.3, 7.6, ZB);
    D.chevrons(g, f0[0], f1[0], f0[1], { n: 14, h: (f1[0] - f0[0]) / 28, rows: 3, gap: 9, w: 1.3 });
    // big stepped arch around the central elevator
    const base = P(0, 0, ZB), sc = cam.scaleAt(0, 0, ZB);
    D.archFrame(g, base[0], base[1], 5.2 * sc, 7.1 * sc, { rings: 3, gap: .16 * sc, steps: 3, crown: 'round', burst: true, lw: 2.2, fill: '#080605' });
    // side elevators (smaller, dark)
    for (const x of [-3.9, 3.9]) {
      const b = P(x, 0, ZB); doors(g, b[0], b[1], 1.5 * sc, 2.9 * sc, 0, false);
      T.dial(g, b[0], b[1] - 3.35 * sc, .5 * sc, x < 0 ? .1 : .9, { labels: [], ticks: 12 });
    }
    // centre elevator doors + dial
    doors(g, base[0], base[1], 2.2 * sc, 3.4 * sc, o.doorOpen || 0, true);
    const dialP = [base[0], base[1] - 4.05 * sc];
    T.dial(g, dialP[0], dialP[1], .72 * sc, o.dial ?? 0, { labels: ['L', '5', '10', '15', '20', '25', 'R'], lit: 1 });
    // clock above the arch
    const ck = P(0, 8.35, ZB);
    T.clockFace(g, ck[0], ck[1], .5 * sc, o.clock || { h: 11, m: 57, s: 10 });
    // out-of-order plaque (drops on a chain)
    if (o.plaque != null && o.plaque > 0) plaque(g, base[0], base[1] - 2.35 * sc, sc, o.plaque, t, o.plaqueText || null, o.plaqueFlip || 0);
    // button panel beside the door
    const bp = P(1.55, 1.25, ZB); g.save(); g.fillStyle = '#1a1208'; g.fillRect(bp[0] - .12 * sc, bp[1] - .3 * sc, .24 * sc, .6 * sc);
    D.gline(g, D.rectPts(bp[0] - .12 * sc, bp[1] - .3 * sc, .24 * sc, .6 * sc), { w: 1 });
    for (const [dy, lit] of [[-.12, o.btnUp || 0], [.12, 0]]) { g.beginPath(); g.arc(bp[0], bp[1] + dy * sc, .06 * sc, 0, D.TAU); g.fillStyle = lit ? '#ffd27a' : '#6b5024'; g.fill(); if (lit) D.glow(g, bp[0], bp[1] + dy * sc, .3 * sc, '#ffcf7a', .6 * lit); }
    g.restore();
  }
  // ---- floor (mode-7 rows) ----
  {
    const yB = P(0, 0, ZB)[1];
    for (let sy = Math.floor(yB); sy < 1080; sy++) {
      const zz = (cam.y) * cam.f / Math.max(.5, (sy + .5 - (cam.P(0, cam.y, 10)[1]))) + cam.z;
      if (zz > ZB || zz < zN) continue;
      const xl = P(-W, 0, zz)[0], xr = P(W, 0, zz)[0];
      const v = Math.min(floorTex.height - 1, Math.max(0, zz * 50));
      g.drawImage(floorTex, 0, v, floorTex.width, 1, xl, sy, xr - xl, 1.2);
    }
    // depth darkening + warm pools + reflections
    const fg = g.createLinearGradient(0, yB, 0, 1080); fg.addColorStop(0, 'rgba(0,0,0,.55)'); fg.addColorStop(.35, 'rgba(0,0,0,.15)'); fg.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = fg; g.fillRect(0, yB, 1920, 1080 - yB);
    const pool = P(0, 0, ZB - 2.2), ps = cam.scaleAt(0, 0, ZB - 2.2);
    D.glow(g, pool[0], pool[1], ps * 4, '#ffcf8a', .22, .35);
    // mirrored door glow
    const bs = P(0, 0, ZB), sc = cam.scaleAt(0, 0, ZB);
    const rg = g.createLinearGradient(0, bs[1], 0, bs[1] + 2.2 * sc); rg.addColorStop(0, 'rgba(230,190,110,.28)'); rg.addColorStop(1, 'rgba(230,190,110,0)');
    g.fillStyle = rg; g.fillRect(bs[0] - 1.1 * sc, bs[1], 2.2 * sc, 2.2 * sc);
    // pilaster reflections
    for (const sx of [-1, 1]) for (let z = 2.5; z < ZB; z += 2) {
      if (z < zN + .2) continue;
      const a = P(sx * W, 0, z), s2 = cam.scaleAt(sx * W, 0, z);
      const rr = g.createLinearGradient(0, a[1], 0, a[1] + 2.6 * s2); rr.addColorStop(0, 'rgba(201,162,75,.22)'); rr.addColorStop(1, 'rgba(201,162,75,0)');
      g.fillStyle = rr; g.fillRect(a[0] - .1 * s2, a[1], .2 * s2, 2.6 * s2);
    }
  }
  // ---- chandelier (stepped, inverted ziggurat with glowing tiers) ----
  ceilingLight(g, cam);
  // ---- concierge desk + radio (left), stair doors (right) ----
  desk(g, cam, -6.2, 7.5, o.radioOn ?? 1, t);
  stairDoors(g, cam, W, 9.6, o.stairOpen || 0);
  // ---- guests (silhouettes) ----
  if (o.guests !== false) {
    guest(g, cam, -3.6, 9.2, 1.8, 0, t); guest(g, cam, -3.1, 9.4, 1.65, 1, t);
    guest(g, cam, 4.4, 8.2, 1.78, 0, t); guest(g, cam, 5.0, 7.6, 1.62, 1, t);
  }
  if (o.pip) o.pip(g, cam);
  // haze
  const hz = g.createRadialGradient(960, 500, 100, 960, 500, 900); hz.addColorStop(0, 'rgba(255,200,120,.06)'); hz.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = hz; g.fillRect(0, 0, 1920, 1080);
  D.vignette(g, 1920, 1080, .5);
  g.restore();
  return cam;
}

// Bronze elevator doors with an etched sunburst; open (0..1) slides the leaves apart (symmetric).
export function doors(g, cx, base, w, h, open = 0, main = true, back = true) {
  // back=false: leaves only (the end transition slides them in over the live shot)
  const top = base - h, hw = w / 2;
  g.save();
  if (back) g.fillStyle = '#050403', g.fillRect(cx - hw, top, w, h);
  if (back && open > 0) { const ig = g.createLinearGradient(0, top, 0, base); ig.addColorStop(0, '#3a2a14'); ig.addColorStop(1, '#120c06'); g.fillStyle = ig; g.fillRect(cx - hw, top, w, h); }
  const lw = hw * (1 - open);
  for (const sd of [-1, 1]) {
    const x0 = sd < 0 ? cx - hw : cx + hw - lw;
    if (lw < 1) continue;
    g.save(); g.beginPath(); g.rect(x0, top, lw, h); g.clip();
    const lg = g.createLinearGradient(cx - hw, top, cx + hw, base); lg.addColorStop(0, '#4a3515'); lg.addColorStop(.45, main ? '#9c7a3c' : '#5a4420'); lg.addColorStop(.55, main ? '#b8964f' : '#6a5028'); lg.addColorStop(1, '#3a2810');
    g.fillStyle = lg; g.fillRect(x0, top, lw, h);
    // etched sunburst centred on the door seam (moves with the leaf)
    const seamX = sd < 0 ? cx - hw * open : cx + hw * open;
    D.sunburst(g, seamX, top + h * .62, { rays: 28, r0: w * .05, r1: w * .62, a0: Math.PI, a1: D.TAU, mode: 'lines', w: 1.3, alpha: .8 });
    D.gline(g, D.arcPts(seamX, top + h * .62, w * .2, Math.PI, D.TAU, 30), { w: 1.4 });
    for (let k = 0; k < 3; k++) D.gline(g, [[x0, top + h * (.78 + k * .05)], [x0 + lw, top + h * (.78 + k * .05)]], { w: .9, alpha: .8 });
    g.restore();
  }
  D.gline(g, D.rectPts(cx - hw, top, w, h), { w: 2 });
  if (open < 1) D.gline(g, [[cx - hw * open, top], [cx - hw * open, base]], { w: 1, alpha: .6 });
  g.restore();
}

export function plaque(g, cx, cy, sc, p, t = 0, o_text = null, flip = 0) {
  // p: 0..1 drop progress (with a swing afterwards driven by t since drop)
  const drop = D.back(Math.min(1, p * 1.25), 1.2), sw = p >= 1 ? Math.sin((p - 1) * 9) * Math.exp(-(p - 1) * 2.2) * .22 : Math.sin(p * 7) * .2 * (1 - p);
  const w = 1.7 * sc, h = .52 * sc, y = cy - (1 - drop) * 2.4 * sc;
  g.save(); g.translate(cx, y - 1.1 * sc); g.rotate(sw);
  g.strokeStyle = '#c9a24b'; g.lineWidth = Math.max(1, sc * .015); g.setLineDash([sc * .05, sc * .03]);
  g.beginPath(); g.moveTo(-w * .35, 0); g.lineTo(-w * .38, 1.1 * sc); g.moveTo(w * .35, 0); g.lineTo(w * .38, 1.1 * sc); g.stroke(); g.setLineDash([]);
  g.translate(0, 1.1 * sc);
  if (flip > 0) { g.translate(0, h / 2); g.scale(1, Math.max(.04, Math.abs(Math.cos(flip * Math.PI)))); g.translate(0, -h / 2); if (flip > .5) o_text = 'IN SERVICE'; }
  g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = sc * .1; g.shadowOffsetY = sc * .05;
  g.fillStyle = D.goldGrad(g, -w / 2, 0, w / 2, h, { sheen: .45 }); g.fillRect(-w / 2, 0, w, h); g.shadowBlur = 0;
  g.fillStyle = '#16100a'; g.fillRect(-w / 2 + sc * .05, sc * .05, w - sc * .1, h - sc * .1);
  { const fs = Math.min(h * .5, w * .8 / 8.2); T.goldText(g, o_text || 'OUT OF ORDER', 0, h * .5 + fs * .35, { size: fs, font: 'Poiret', track: fs * .08, shadow: false }); }
  g.restore();
}

function ceilingLight(g, cam) {
  // recessed stepped coffer with a luminous sunburst panel
  const P = cam.P, H = ROOM.H;
  for (let k = 0; k < 3; k++) {
    const hw = 2.6 - k * .45, z0 = 6.4 + k * .4, z1 = 11.6 - k * .4;
    const pts = [P(-hw, H, z0), P(hw, H, z0), P(hw, H, z1), P(-hw, H, z1), P(-hw, H, z0)].map(p => p.slice(0, 2));
    if (k === 2) { g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); const gr = g.createLinearGradient(0, pts[0][1], 0, pts[2][1]); gr.addColorStop(0, 'rgba(255,226,170,.55)'); gr.addColorStop(1, 'rgba(255,210,140,.25)'); g.fillStyle = gr; g.fill(); g.restore(); }
    D.gline(g, pts, { w: 1.6 - k * .3 });
  }
  const c = P(0, H, 9); D.glow(g, c[0], c[1], 700, '#ffd494', .16, .35);
}
function chandelier(g, cam, x, yTop, yBot, t) {
  const P = cam.P, z = 7.2, top = P(x, yTop, z), s = cam.scaleAt(x, yTop, z);
  const b = P(x, yBot, z);
  D.gline(g, [[top[0], P(x, 9, z)[1]], [top[0], top[1]]], { w: 1.4 });
  D.glow(g, b[0], (top[1] + b[1]) / 2, s * 3.2, '#ffd08a', .35);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const y = D.lerp(top[1], b[1], (i + .5) / tiers), w = s * (2.2 - i * .38), h = (b[1] - top[1]) / tiers * .62;
    const gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2); gr.addColorStop(0, 'rgba(255,236,190,.95)'); gr.addColorStop(1, 'rgba(210,160,80,.8)');
    g.fillStyle = gr; g.fillRect(top[0] - w / 2, y - h / 2, w, h);
    D.gline(g, D.rectPts(top[0] - w / 2, y - h / 2, w, h), { w: 1.2 });
    for (let k = 1; k < 8; k++) { const xx = top[0] - w / 2 + w * k / 8; g.fillStyle = 'rgba(120,80,30,.5)'; g.fillRect(xx - .5, y - h / 2, 1, h); }
  }
  D.sunburst(g, top[0], b[1], { rays: 16, r0: s * .3, r1: s * 1.1, a0: .2, a1: Math.PI - .2, mode: 'lines', w: 1.2, alpha: .7 });
}

function desk(g, cam, x, z, radioOn, t) {
  const P = cam.P, s = cam.scaleAt(x, 0, z);
  const a = P(x - 1.1, 0, z), b = P(x + 1.6, 1.1, z);
  // streamline desk: rounded front with horizontal gold speed bands
  g.save();
  const dg = g.createLinearGradient(a[0], b[1], b[0], a[1]); dg.addColorStop(0, '#2a1d0e'); dg.addColorStop(1, '#0c0906');
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0], b[1] + s * .2); g.quadraticCurveTo(a[0], b[1], a[0] + s * .3, b[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], a[1]); g.closePath(); g.fillStyle = dg; g.fill();
  for (let k = 0; k < 3; k++) D.gline(g, [[a[0] + s * .05, a[1] - s * (.3 + k * .14)], [b[0], a[1] - s * (.3 + k * .14)]], { w: 1.2 });
  D.gline(g, [[a[0], b[1]], [b[0], b[1]]], { w: 2 });
  // cathedral radio
  const r = P(x + .9, 1.1, z), rs = s;
  const rw = .55 * rs, rh = .62 * rs;
  if (radioOn) D.glow(g, r[0], r[1] - rh * .5, rs * 1.2, '#ffc36a', .35 * radioOn);
  g.beginPath(); g.moveTo(r[0] - rw / 2, r[1]); g.lineTo(r[0] - rw / 2, r[1] - rh * .6); g.arc(r[0], r[1] - rh * .6, rw / 2, Math.PI, D.TAU); g.lineTo(r[0] + rw / 2, r[1]); g.closePath();
  const rg = g.createLinearGradient(r[0] - rw / 2, 0, r[0] + rw / 2, 0); rg.addColorStop(0, '#5a3a1a'); rg.addColorStop(.5, '#8a5a2a'); rg.addColorStop(1, '#3a2410'); g.fillStyle = rg; g.fill();
  g.beginPath(); g.moveTo(r[0] - rw * .32, r[1] - rh * .35); g.lineTo(r[0] - rw * .32, r[1] - rh * .62); g.arc(r[0], r[1] - rh * .62, rw * .32, Math.PI, D.TAU); g.lineTo(r[0] + rw * .32, r[1] - rh * .35); g.closePath();
  g.fillStyle = radioOn ? 'rgba(255,200,110,.85)' : '#2a1a0c'; g.fill();
  g.strokeStyle = '#3a2410'; g.lineWidth = Math.max(1, rs * .02); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(r[0] + k * rw * .11, r[1] - rh * .36); g.lineTo(r[0] + k * rw * .11, r[1] - rh * .9); g.stroke(); }
  g.restore();
}

function stairDoors(g, cam, xw, z, open) {
  // double doors set in the right wall (plane x = xw), with a STAIRS plaque
  const P = cam.P, h = 3.1, w = 1.0;
  const q = (dz, y) => P(xw, y, z + dz).slice(0, 2);
  const frame = [q(-w, 0), q(-w, h), q(w, h), q(w, 0)];
  g.save();
  g.beginPath(); frame.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = open ? '#3a2a12' : '#0a0806'; g.fill();
  for (const sd of [-1, 1]) {
    const leaf = [q(sd * w * (1 - open * .0), 0), q(sd * w, h), q(sd * w * open * .1, h), q(sd * w * open * .1, 0)];
    const L = [q(sd * w, 0), q(sd * w, h), q(0 + sd * open * w * .9, h), q(0 + sd * open * w * .9, 0)];
    g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    const lg = g.createLinearGradient(L[0][0], 0, L[2][0], 0); lg.addColorStop(0, '#2a1d0c'); lg.addColorStop(1, '#4a3416'); g.fillStyle = lg; g.fill();
    D.gline(g, [...L, L[0]], { w: 1.2 });
    // porthole with sunburst
    const c = P(xw, 1.9, z + sd * w * .5 + sd * open * w * .45), rr = cam.scaleAt(xw, 1.9, z) * .22;
    g.save(); g.translate(c[0], c[1]); g.scale(.45, 1); g.beginPath(); g.arc(0, 0, rr, 0, D.TAU); g.fillStyle = 'rgba(255,200,120,.35)'; g.fill(); g.strokeStyle = C.gold1; g.lineWidth = 2; g.stroke(); g.restore();
  }
  D.gline(g, [...frame, frame[0]], { w: 2 });
  // STAIRS plaque above
  const pl = P(xw, h + .45, z), ps = cam.scaleAt(xw, h + .45, z);
  g.save(); g.translate(pl[0], pl[1]); g.transform(.55, -.18, 0, 1, 0, 0);
  g.fillStyle = '#050403'; g.fillRect(-ps * .8, -ps * .2, ps * 1.6, ps * .4); D.gline(g, D.rectPts(-ps * .8, -ps * .2, ps * 1.6, ps * .4), { w: 1.2 });
  T.goldText(g, 'STAIRS', 0, ps * .12, { size: ps * .28, font: 'Poiret', track: ps * .05, shadow: false });
  g.restore();
  g.restore();
}

// Evening-wear silhouettes (black with gold rim light): kind 0 = gentleman in tails, 1 = lady in a column gown.
export function guest(g, cam, x, z, h, kind, t = 0, face = 1) {
  const P = cam.P, f = P(x, 0, z), s = cam.scaleAt(x, 0, z) * h / 1.8;
  g.save(); g.translate(f[0], f[1]); g.scale(s / 100 * face, s / 100);
  const sm = pts => { const p = new Path2D(), n = pts.length; p.moveTo(pts[0][0], pts[0][1]); for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); } p.closePath(); return p; };
  let body;
  if (kind) { // lady: bob hair, bare shoulders, long bias-cut gown flaring at the hem, fan in hand
    body = sm([[-15, 0], [-8, -40], [-7, -85], [-11, -112], [-15, -128], [-12, -140], [-5, -146], [-4, -153], [4, -153], [5, -146], [12, -140], [15, -128], [11, -112], [7, -85], [9, -40], [18, 0]]);
  } else {    // gentleman: tailcoat with tails, broad shoulders, slick hair
    body = sm([[-9, 0], [-8, -48], [-10, -78], [-15, -84], [-17, -120], [-19, -138], [-8, -150], [-5, -157], [5, -157], [8, -150], [19, -138], [17, -120], [15, -84], [11, -78], [8, -48], [9, 0]]);
  }
  g.fillStyle = '#060504'; g.fill(body);
  g.save(); g.clip(body); g.translate(3, -1); g.strokeStyle = 'rgba(243,217,139,.6)'; g.lineWidth = 3.4; g.stroke(body); g.restore();
  // head
  const hd = new Path2D(); hd.ellipse(0, -168, 10, 12, 0, 0, D.TAU);
  g.fillStyle = '#060504'; g.fill(hd); g.save(); g.clip(hd); g.translate(2.5, -1); g.strokeStyle = 'rgba(243,217,139,.5)'; g.lineWidth = 3; g.stroke(hd); g.restore();
  if (kind) { // bob + headband glint, fan
    g.beginPath(); g.moveTo(-11, -160); g.quadraticCurveTo(-13, -182, 0, -182); g.quadraticCurveTo(13, -182, 11, -160); g.fillStyle = '#060504'; g.fill();
    g.fillStyle = 'rgba(243,217,139,.8)'; g.fillRect(-10, -174, 20, 2);
    D.fan(g, 17, -108, 16, { a0: -2.4, a1: -.5, ribs: 5, fill: '#1d6b57', ring: .2 });
  } else { g.fillStyle = 'rgba(243,217,139,.75)'; g.beginPath(); g.moveTo(-4, -150); g.lineTo(0, -142); g.lineTo(4, -150); g.closePath(); g.fill(); }
  g.restore();
}
