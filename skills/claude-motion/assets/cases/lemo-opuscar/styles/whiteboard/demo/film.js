// "Einstein in Your Pocket" — Whiteboard Explainer v2. One continuous board, no hands.
// All times are seconds. VO start times live in VO; visual beats hang off spoken words via at(id, word).
import * as W from './engine/wb.js';
import { clamp, lerp, TAU, mulberry } from '/core/lib.js';

const { INK } = W;
export const BPM = 120, BEAT = 60 / BPM, T0 = 10.0;           // music grid: downbeat of bar 1 = title
export const VO = {
  v01: 0.9, v02a: 5.7, v02b: 8.0, v03: 14.2, v04: 19.1, v05: 24.6, v06: 30.3, v07: 34.9, v08: 38.1,
  v09a: 40.3, v09b: 41.68, v10: 44.4, v11: 46.6, v12: 56.3, v13: 61.7, v14: 65.3, v15: 70.0, v16: 76.5,
  v17: 80.9, v18: 88.9, v19: 96.0,
};
export const END = 111;

export async function build() {
  await W.loadFont('tech', 'fonts/EMSTech.json');
  const words = await (await fetch('voices/words.json')).json();
  const lines = await (await fetch('lines.json')).json();
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const at = (id, w, k = 0, which = 1) => {          // absolute time of the k-th occurrence of word w in line id
    let n = 0; for (const x of words[id]) if (norm(x[0]).startsWith(norm(w)) && n++ === k) return VO[id] + Math.max(0, x[which]);
    throw new Error(`word ${w} not in ${id}`);
  };
  const atS = (id, w, k = 0) => at(id, w, k, 1), atE = (id, w, k = 0) => at(id, w, k, 2);

  const tl = new W.Timeline();
  const K = new W.Pen('black', INK.black, { park: [2200, 1320] });
  const O = new W.Pen('orange', INK.orange, { park: [2350, 1150] });
  const B = new W.Pen('blue', INK.blue, { park: [2100, 1420] });
  const PENS = [K, O, B];
  const T = W.text, R = mulberry(4242);

  // ───────── layout (world units)
  const PH = { x: 1070, y: 2460, w: 760, h: 1380 };           // phone body
  const SC = [PH.x + 44, PH.y + 110, PH.w - 88, PH.h - 230, 26];   // screen rect (clip)
  const PIN = [1450, 3120];
  const SAT = [[2720, 1230, 1.15], [4000, 1170, 1.45], [5280, 1230, 1.15]];
  const EQ = [2760, 2300];
  const CLK = [[6150, 700], [7300, 700]];
  const RUL = { x0: 6120, g: 1330, o: 1560, n: 12, sg: 140, so: 130.5 };
  const TRAIL = [[1450, 3120], [1840, 3240], [2350, 3420], [2950, 3300], [3550, 3520], [4150, 3380], [4750, 3600], [5350, 3440], [5950, 3660], [6600, 3560], [7050, 3790]];
  const SEA = [7050, 3790];

  // ghost marks: faint residue of old lessons that were wiped
  const ghosts = [];
  const gR = mulberry(99);
  for (let i = 0; i < 46; i++) {
    const x = gR() * 7600 + 200, y = gR() * 4100 + 200, k = gR();
    const o = { w: 12, alpha: .05 + gR() * .05, color: gR() < .2 ? '#8aa0c8' : '#9aa0a8' };
    if (k < .3) ghosts.push(...T(['x = 4', 'lab 3', 'TUE', 'q.2', 'f(x)', 'pH 7', 'due fri', '→ 12', 'ok!'][i % 9], x, y, { h: 50 + gR() * 40, ...o }));
    else if (k < .55) ghosts.push(W.circle(x, y, 40 + gR() * 110, o));
    else if (k < .8) ghosts.push(...W.arrow(x, y, x + (gR() - .5) * 500, y + (gR() - .5) * 300, o));
    else ghosts.push(W.line(x, y, x + 200 + gR() * 500, y + (gR() - .5) * 80, o));
  }

  const map = [], mS = { clip: SC, w: 7 };
  const dbl = (pts, gap, o) => {                     // a road = two parallel hand lines
    const off = sgn => pts.map((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)], dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1; return [p[0] - dy / l * gap * sgn, p[1] + dx / l * gap * sgn]; });
    return [W.curve(off(1), o), W.curve(off(-1), o)];
  };
  map.push(...dbl([[1480, 3035], [1640, 3025], [1800, 3045]], 17, { ...mS, w: 8 }));          // the street the pin sits on
  map.push(...dbl([[1100, 3040], [1300, 3030], [1480, 3035]], 17, { ...mS, w: 8 }));
  map.push(...dbl([[1270, 2560], [1300, 2800], [1290, 3040], [1330, 3400], [1310, 3730]], 17, { ...mS, w: 8 }));   // avenue
  map.push(W.circle(1292, 3035, 44, { ...mS, w: 7 }));                                            // roundabout
  map.push(W.curve([[1100, 3420], [1450, 3230], [1800, 2960]], { ...mS, w: 10 }));                // diagonal
  map.push(W.line(1560, 2560, 1590, 3018, { ...mS, bow: .01 }), W.line(1590, 3052, 1570, 3500, { ...mS, bow: .01 }));
  map.push(W.line(1100, 2780, 1282, 2790, mS), W.line(1318, 2780, 1800, 2760, mS), W.line(1318, 3260, 1800, 3280, mS), W.line(1100, 3250, 1288, 3262, mS));
  map.push(W.line(1700, 2560, 1705, 3018, mS), W.line(1440, 2560, 1430, 3018, mS), W.line(1180, 3052, 1175, 3440, mS));
  const bR = mulberry(77);
  for (const [bx, by] of [[1340, 2640], [1610, 2640], [1470, 2840], [1730, 2860], [1150, 2860], [1370, 3300], [1620, 3320], [1150, 3120], [1470, 2650], [1210, 2620]]) {
    const w = 44 + bR() * 40, h = 36 + bR() * 34; map.push(W.roundRect(bx, by, w, h, 6, { ...mS, w: 5 }));
  }
  const river = [W.curve([[1100, 3575], [1300, 3505], [1480, 3590], [1650, 3520], [1800, 3560]], { ...mS, w: 9, alpha: .8 }),
    W.curve([[1100, 3640], [1300, 3570], [1480, 3655], [1650, 3585], [1800, 3625]], { ...mS, w: 9, alpha: .8 })];
  const bridge = [W.line(1296, 3500, 1300, 3600, { ...mS, w: 6 }), W.line(1336, 3500, 1340, 3600, { ...mS, w: 6 })];
  const park = [W.roundRect(1620, 3330, 150, 120, 30, { ...mS, w: 5 }), ...[[1660, 3375], [1720, 3370], [1690, 3415]].map(([x, y]) => W.circle(x, y, 17, { ...mS, w: 5 }))];

  // ═════════ A · HOOK — the pin, the map, the phone (0–10)
  let t;
  const D = (pen, shapes, a, b, o = {}) => tl.draw(pen, shapes, a, { by: b, ...o });   // draw inside a window [a,b]
  D(K, T('you are here', 1540, 2985, { h: 30, w: 6 }), 1.25, 2.05);
  D(K, W.arrow(1560, 3010, 1478, 3060, { w: 6, head: 16, curve: [1500, 3030] }), 2.1, 2.4);
  D(K, map, 2.45, 5.3, { travel: 6000, minGap: .015, maxGap: .05 });
  D(B, river, 3.0, 3.75);
  D(B, W.circle(PIN[0], PIN[1] - 30, 88, { w: 6, a0: -1.2 }), atS('v01', 'meter') - .2, atS('v01', 'meter') + .3);
  D(B, T('±5 m', PIN[0] - 92, PIN[1] + 90, { h: 26, w: 5 }), atS('v01', 'meter') + .35, atS('v01', 'meter') + .75);
  D(K, [...bridge, ...park], 5.33, 5.75);
  // the phone drawn around the map; the ground it stands on
  const phone = [W.roundRect(PH.x, PH.y, PH.w, PH.h, 90, { w: 11 }), W.line(1380, 2515, 1520, 2515, { w: 9 }), W.circle(1450, PH.y + PH.h - 58, 30, { w: 7 })];
  D(K, phone, 5.8, 7.0);
  D(K, W.curve([[150, 3905], [700, 3870], [1450, 3860], [2300, 3880], [3050, 3915]], { w: 10 }), 7.05, 7.6);

  // ═════════ TITLE (bar 1 = 10.0)
  D(K, T('EINSTEIN', 250, 640, { h: 200, w: 17 }), T0 - .05, T0 + 3 * BEAT - .1, { minGap: .03, maxGap: .08 });
  D(K, T('IN YOUR POCKET', 262, 900, { h: 120, w: 12 }), T0 + 3 * BEAT, T0 + 6 * BEAT - .1, { minGap: .025, maxGap: .06 });
  D(O, W.curve([[240, 965], [900, 952], [1560, 968], [1990, 944]], { w: 16, over: 26 }), T0 + 6 * BEAT, T0 + 6.8 * BEAT);
  D(K, T('how GPS really works', 270, 1075, { h: 52, w: 7 }), T0 + 6 * BEAT + .05, T0 + 8 * BEAT - .1);

  // ═════════ B · SATELLITES (14–24)
  const EC = [4000, 13350], ER = 12200;               // orbit circle (Earth's centre far below the board)
  const orbitPts = []; for (let x = 1900; x <= 5750; x += 60) orbitPts.push([x, EC[1] - Math.sqrt(ER * ER - (x - EC[0]) ** 2)]);
  D(K, W.dashed(orbitPts, { w: 6, dash: 46, gap: 30 }), 14.3, 15.9, { travel: 9000, minGap: .01, maxGap: .02 });
  function satellite(cx, cy, s) {
    const b = 75 * s, pw = 190 * s, ph = 64 * s, o = { w: 8 };
    const out = [W.roundRect(cx - b, cy - b, 2 * b, 2 * b, 16 * s, o)];
    out.push(W.line(cx - b, cy, cx - b - 30 * s, cy, o), W.line(cx + b, cy, cx + b + 30 * s, cy, o));
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? cx - b - 30 * s - pw : cx + b + 30 * s;
      out.push(...W.rect(x0, cy - ph / 2, pw, ph, { w: 7, over: 4 }));
      for (let k = 1; k < 4; k++) out.push(W.line(x0 + pw * k / 4, cy - ph / 2, x0 + pw * k / 4, cy + ph / 2, { w: 4, alpha: .8 }));
    }
    out.push(W.arc(cx, cy + b + 34 * s, 36 * s, Math.PI * 1.1, Math.PI * 1.9, { w: 6 }), W.line(cx, cy + b, cx, cy + b + 12 * s, { w: 6 }));
    return out;
  }
  D(K, satellite(...SAT[1]), 15.95, 16.9, { minGap: .02, maxGap: .05 });
  D(K, satellite(...SAT[0]), 16.95, 17.6, { minGap: .015, maxGap: .04 });
  D(K, satellite(...SAT[2]), 17.65, 18.3, { minGap: .015, maxGap: .04 });
  D(B, T('20,000 km up', 4800, 1640, { h: 64, w: 8 }), atS('v03', '20') - .05, atE('v03', 'kilomet'));
  D(B, W.arrow(4900, 1560, 4900, 1250, { w: 7, head: 22 }), atE('v03', 'kilomet') + .05, atE('v03', 'kilomet') + .35);
  // the atomic clock on the main satellite
  const [sx, sy] = SAT[1];
  D(O, [W.circle(sx, sy, 50, { w: 7 }), W.line(sx, sy, sx, sy - 34, { w: 7 }), W.line(sx, sy, sx + 26, sy + 8, { w: 7 })], atS('v04', 'atomic') - .1, atE('v04', 'clock'));
  D(O, T('atomic clock', sx - 560, sy - 190, { h: 40, w: 6 }), atE('v04', 'clock') + .05, atE('v04', 'clock') + .75);
  D(O, W.arrow(sx - 250, sy - 170, sx - 62, sy - 40, { w: 6, head: 16, curve: [sx - 130, sy - 150] }), atE('v04', 'clock') + .8, atE('v04', 'clock') + 1.05);
  // broadcast: ripples + time stamps, "over and over"
  const ripples = [0, 1, 2].map(k => W.arc(sx, sy + 190, 80 + k * 70, Math.PI * .22, Math.PI * .78, { w: 7 }));
  const rip0 = atS('v04', 'broadcast') - .05;
  ripples.forEach((r, k) => { D(B, r, rip0 + k * .25, rip0 + k * .25 + .2); tl.cue(rip0 + k * .25, 'ping', { k }); });
  D(B, T('12:00:00.000', sx - 260, sy + 500, { h: 42, w: 6 }), rip0 + .8, rip0 + 1.35);
  D(B, T('.001', sx + 110, sy + 560, { h: 30, w: 5, alpha: .8 }), atS('v04', 'over') + .05, atS('v04', 'over') + .35);
  D(B, T('.002', sx + 190, sy + 610, { h: 26, w: 4, alpha: .7 }), atS('v04', 'over', 1) - .05, atS('v04', 'over', 1) + .25);
  tl.cue(atS('v04', 'over') + .05, 'ping', { k: 3 }); tl.cue(atS('v04', 'over', 1) - .05, 'ping', { k: 4 });

  // ═════════ C · DELAY = DISTANCE (24.6–34)
  const sig = W.dashed([[sx - 40, sy + 650], [3200, 2020], [2300, 2260], [1640, 2440]], { w: 7, dash: 52, gap: 30, smooth: 3 });
  D(B, sig, VO.v05 + .15, 27.55, { travel: 4000, minGap: .015, maxGap: .03 });
  D(B, W.arrow(1700, 2400, 1560, 2470, { w: 7, head: 22 }), 27.6, 27.85);
  D(B, T('heard 12:00:00.067', 1880, 2440, { h: 40, w: 6 }), 27.9, atS('v05', 'late') + .1);
  D(O, W.curve([[2295, 2465], [2420, 2458], [2560, 2470]], { w: 8 }), atS('v05', 'late') + .15, atS('v05', 'late') + .45);
  // the equation
  D(K, T('delay × speed of light = distance', EQ[0], EQ[1], { h: 66, w: 8 }), atS('v06', 'delay') - .3, atE('v06', 'distance') - .1, { minGap: .02, maxGap: .06 });
  D(O, W.curve([[EQ[0] + 1020, EQ[1] + 18], [EQ[0] + 1180, EQ[1] + 26], [EQ[0] + 1350, EQ[1] + 14]], { w: 9 }), atE('v06', 'distance') - .05, atE('v06', 'distance') + .3);
  D(K, T('0.067 s × c ≈ 20,000 km', EQ[0] + 30, EQ[1] + 150, { h: 56, w: 7 }), atE('v06', 'distance') + .1, atE('v06', 'distance') + 1.7, { minGap: .02, maxGap: .06 });

  // ═════════ D · TRILATERATION on the map (34.9–44)
  const pinOffAt = VO.v07 + .05, pinOnAt = atS('v09b', 'here') + .02;
  const C1 = [2585, 3270], C2 = [245, 2555], C3 = [1450, 4000];   // centres off-screen; radii pass through the pin
  for (const c of [C1, C2, C3]) c[2] = Math.hypot(c[0] - PIN[0], c[1] - PIN[1]);
  const cOpt = { w: 9, clip: SC };
  const ringArc = (c, a0, a1) => W.arc(c[0], c[1], c[2], a0, a1, cOpt);
  const ang = c => Math.atan2(PIN[1] - c[1], PIN[0] - c[0]);
  D(B, ringArc(C1, ang(C1) - .75, ang(C1) + .75), atS('v07', 'somewhere') - .1, atE('v07', 'circle'));
  D(B, ringArc(C2, ang(C2) + .6, ang(C2) - .6), atS('v08', 'two') - .1, atS('v08', 'points') + .05);
  const X2 = (() => {                                 // the other crossing of circles 1 & 2
    const [x1, y1, r1] = C1, [x2, y2, r2] = C2, d = Math.hypot(x2 - x1, y2 - y1), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
    const mx = x1 + a * (x2 - x1) / d, my = y1 + a * (y2 - y1) / d, P = [[mx + h * (y2 - y1) / d, my - h * (x2 - x1) / d], [mx - h * (y2 - y1) / d, my + h * (x2 - x1) / d]];
    return P.sort((p, q) => Math.hypot(q[0] - PIN[0], q[1] - PIN[1]) - Math.hypot(p[0] - PIN[0], p[1] - PIN[1]))[0];
  })();
  D(K, T('?', X2[0] + 24, X2[1] - 18, { h: 44, w: 7 }), atS('v08', 'points') + .05, atS('v08', 'points') + .3);
  D(K, T('?', PIN[0] + 26, PIN[1] - 20, { h: 44, w: 7 }), atS('v08', 'points') + .35, atS('v08', 'points') + .6);
  D(B, ringArc(C3, ang(C3) - .7, ang(C3) + .7), VO.v09a - .1, VO.v09a + .55);
  D(K, [...T('+1 more satellite', 1030, 3260, { h: 30, w: 5, align: 'right' }), ...T("fixes the phone's", 1030, 3310, { h: 30, w: 5, align: 'right' }), ...T('own cheap clock', 1030, 3360, { h: 30, w: 5, align: 'right' })], pinOnAt + .45, pinOnAt + 1.9);

  // ═════════ F · RELATIVITY (46–70)
  const clock = ([cx, cy], lab) => [W.circle(cx, cy, 190, { w: 10 }), ...[0, 1, 2, 3].map(k => { const a = k * Math.PI / 2; return W.line(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150, cx + Math.cos(a) * 175, cy + Math.sin(a) * 175, { w: 7 }); }),
    W.line(cx, cy, cx, cy - 120, { w: 10 }), W.line(cx, cy, cx + 80, cy + 30, { w: 10 }), ...T(lab, cx, cy + 290, { h: 54, w: 8, align: 'center' })];
  const cS = VO.v11 - .1;
  D(K, clock(CLK[0], 'ground'), cS, cS + 1.5);
  D(O, clock(CLK[1], 'orbit'), cS + .15, cS + 1.65);
  // two rulers drawn as a duet: each tick lands on its own clock's beat → the orbit ruler runs ahead
  const duet0 = T0 + 80 * BEAT;                       // 50.0
  D(K, [W.line(RUL.x0 - 30, RUL.g, RUL.x0 + RUL.sg * RUL.n + 20, RUL.g, { w: 8, bow: .003 }), ...T('ground', RUL.x0 - 70, RUL.g + 14, { h: 40, w: 6, align: 'right' })], cS + 1.6, duet0 - .25);
  D(O, [W.line(RUL.x0 - 30, RUL.o, RUL.x0 + RUL.sg * RUL.n + 20, RUL.o, { w: 8, bow: .003 }), ...T('orbit', RUL.x0 - 70, RUL.o + 14, { h: 40, w: 6, align: 'right' })], cS + 1.75, duet0 - .2);
  for (let i = 0; i <= RUL.n; i++) {
    const tg = duet0 + i * BEAT, to = duet0 + i * BEAT * RUL.so / RUL.sg;
    D(K, W.line(RUL.x0 + i * RUL.sg, RUL.g - 44, RUL.x0 + i * RUL.sg, RUL.g + 44, { w: 8, bow: 0 }), tg - .07, tg + .04);
    D(O, W.line(RUL.x0 + i * RUL.so, RUL.o - 44, RUL.x0 + i * RUL.so, RUL.o + 44, { w: 8, bow: 0 }), to - .07, to + .04);
    tl.cue(tg, 'tickG', { i }); tl.cue(to, 'tickO', { i });
  }
  const duetEnd = duet0 + RUL.n * BEAT;               // 56.0
  const gx0 = RUL.x0 + RUL.n * RUL.so, gx1 = RUL.x0 + RUL.n * RUL.sg;
  D(O, [W.line(gx0, RUL.o + 80, gx0, RUL.o + 110, { w: 6 }), W.line(gx0, RUL.o + 110, gx1, RUL.o + 110, { w: 6 }), W.line(gx1, RUL.o + 110, gx1, RUL.o + 80, { w: 6 })], duetEnd + .2, duetEnd + .6);
  const TX = 5900;
  D(K, T('speed', TX, 1900, { h: 58, w: 8 }), atS('v12', 'moving') - .05, atS('v12', 'fast'));
  D(K, [W.line(TX + 250, 1880, TX + 330, 1880, { w: 6 }), W.line(TX + 235, 1860, TX + 300, 1860, { w: 5 }), W.line(TX + 260, 1900, TX + 320, 1900, { w: 5 })], atS('v12', 'fast') + .05, atS('v12', 'slows'));
  D(K, T('slows it', TX + 400, 1900, { h: 44, w: 6 }), atS('v12', 'slows') + .05, atE('v12', 'orbiting'));
  D(K, T('−7 μs', TX + 1280, 1905, { h: 70, w: 9 }), atS('v12', '7') - .1, atS('v12', 'microseconds') + .3);
  D(K, T('gravity', TX, 2090, { h: 58, w: 8 }), atS('v13', 'weaker') - .05, atS('v13', 'gravity') + .3);
  D(K, T('↓', TX + 300, 2095, { h: 50, w: 7 }), atS('v13', 'gravity') + .3, atS('v13', 'speeds') + .15);
  D(K, T('speeds it up', TX + 400, 2090, { h: 44, w: 6 }), atS('v13', 'speeds') + .2, atE('v13', 'up') + .15);
  D(K, T('+45 μs', TX + 1240, 2095, { h: 70, w: 9 }), atS('v13', '45') - .15, atE('v13', '45') + .2);
  D(K, W.line(TX + 1150, 2160, TX + 1760, 2155, { w: 8 }), VO.v14 - .1, VO.v14 + .35);
  D(O, T('+38 μs', TX + 1180, 2310, { h: 86, w: 11 }), atS('v14', '38') - .1, atE('v14', 'microseconds'));
  D(O, T('fast / day', TX + 1210, 2400, { h: 40, w: 6 }), atS('v14', 'fast') - .05, atS('v14', 'fast') + .6);
  D(O, W.circle(TX + 1440, 2320, 290, { w: 9, ry: 160, a0: -2.6 }), atS('v14', 'every') - .05, atE('v14', 'day'));

  // ═════════ G · CONSEQUENCE: 38 μs × c, the drifting pin, the sea (70–87)
  D(K, T('38 μs × c', EQ[0] + 30, EQ[1] + 320, { h: 60, w: 8 }), atS('v15', '38') - .1, atE('v15', 'microseconds'));
  D(K, T('≈ 11 km', EQ[0] + 560, EQ[1] + 320, { h: 60, w: 8 }), atS('v15', '11') - .15, atE('v15', 'kilomet') - .1);
  D(O, W.curve([[EQ[0] + 560, EQ[1] + 342], [EQ[0] + 760, EQ[1] + 350], [EQ[0] + 960, EQ[1] + 336]], { w: 9, over: 12 }), atE('v15', 'kilomet'), atE('v15', 'kilomet') + .35);
  // drift: one day per two beats — the pin slides, the orange pen trails it, the black pen stamps the day
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const drift0 = T0 + 136 * BEAT, dayBeats = 2;       // 78.0 → 85.0
  const trailSegs = [], dayT = [];
  for (let d = 0; d < 7; d++) {
    const seg = [];
    for (let u = 0; u <= 1.0001; u += .1) {
      const f = (d + u) / 7 * (TRAIL.length - 1), i = Math.min(TRAIL.length - 2, f | 0), v = f - i, p = TRAIL[i], q = TRAIL[i + 1];
      seg.push([lerp(p[0], q[0], v), lerp(p[1], q[1], v) + Math.sin((d + u) * 5.1) * 30]);
    }
    trailSegs.push(seg);
  }
  for (let d = 0; d < 7; d++) {
    const td = drift0 + d * dayBeats * BEAT; dayT.push(td);
    D(O, W.dashed(trailSegs[d], { w: 7, dash: 30, gap: 22, smooth: 2 }), td + .12, td + .6, { minGap: .005, maxGap: .01 });
    const e = trailSegs[d][trailSegs[d].length - 1], up = d === 6 ? -250 : 95;
    D(O, [W.line(e[0], e[1] - 24, e[0], e[1] + 24, { w: 6 }), ...T(days[d], e[0] + (d === 6 ? -130 : 0), e[1] + up, { h: 40, w: 6, align: 'center' })], td + .63, td + .96, { minGap: .01, maxGap: .03 });
    tl.cue(td, 'day', { d });
  }
  const driftEnd = drift0 + 7 * dayBeats * BEAT;      // 85.0
  const waves = []; for (let r = 0; r < 3; r++) { const p = []; for (let x = 6700 + r * 60; x <= 7650 - r * 50; x += 20) p.push([x, 3830 + r * 70 + Math.sin(x / 45) * 16]); waves.push(W.curve(p, { w: 8, smooth: 1 })); }
  D(B, waves, driftEnd - 2.4, driftEnd - 1.3);
  D(B, T('sea', 7560, 4080, { h: 44, w: 6 }), driftEnd - 1.2, driftEnd - .8);
  D(B, [W.arc(SEA[0] - 60, SEA[1] - 30, 60, Math.PI * 1.1, Math.PI * 1.5, { w: 7 }), W.arc(SEA[0] + 60, SEA[1] - 30, 60, Math.PI * 1.5, Math.PI * 1.9, { w: 7 })], driftEnd + .05, driftEnd + .3);
  const fish = (x, y) => [W.curve([[x - 70, y], [x - 20, y - 40], [x + 40, y - 30], [x + 70, y], [x + 40, y + 30], [x - 20, y + 40], [x - 70, y]], { w: 7, smooth: 2 }), W.poly([[x - 70, y], [x - 110, y - 30], [x - 104, y + 32], [x - 70, y]], { w: 7 }), W.circle(x + 36, y - 6, 5, { w: 7 })];
  D(K, fish(7380, 3990), driftEnd + .5, driftEnd + 1.1);
  D(K, T('?', 7480, 3880, { h: 60, w: 8 }), driftEnd + 1.25, driftEnd + 1.5);

  // ═════════ H · THE FIX: rewind, retune (87–96)
  const rw0 = driftEnd + 2.0, rwDur = 2.0;            // 87.0 — the eraser runs the trail backwards
  const trailBack = []; for (let d = 6; d >= 0; d--) for (let k = trailSegs[d].length - 1; k >= 0; k--) trailBack.push(trailSegs[d][k]);
  tl.erase(trailBack.map(([x, y]) => [x, y + 42]), rw0, rwDur, { width: 230, strength: .9 });
  const fixE0 = atS('v18', 'engineers') - .25;        // wipe the orbit ticks…
  tl.erase([[RUL.x0 - 12, RUL.o - 10], [RUL.x0 + RUL.sg * RUL.n + 60, RUL.o - 10], [RUL.x0 + RUL.sg * RUL.n + 60, RUL.o + 100], [RUL.x0 - 12, RUL.o + 100]], fixE0, 1.1, { width: 120, strength: .9 });
  const fix0 = T0 + 163 * BEAT;                        // 91.5 — …and redraw them in step with the ground
  D(O, W.line(RUL.x0 - 30, RUL.o, RUL.x0 + RUL.sg * RUL.n + 20, RUL.o, { w: 8, bow: .003 }), fixE0 + 1.15, fix0 - .1);
  for (let i = 0; i <= RUL.n; i++) {
    const ti = fix0 + i * BEAT * .5;
    D(O, W.line(RUL.x0 + i * RUL.sg, RUL.o - 44, RUL.x0 + i * RUL.sg, RUL.o + 44, { w: 8, bow: 0 }), ti - .06, ti + .04);
    tl.cue(ti, 'tickFix', { i });
  }
  const fixEnd = fix0 + RUL.n * BEAT * .5;            // 94.5
  D(K, T('tuned slow before launch', RUL.x0 + 200, RUL.o + 180, { h: 40, w: 6 }), fixEnd - 1.2, fixEnd);
  D(K, T('✓', RUL.x0 + 1020, RUL.o + 195, { h: 90, w: 12 }), fixEnd + .05, fixEnd + .35);

  // ═════════ END CARD, written under the title
  const cr = [], credit = (s, y, h, o = {}) => cr.push(...T(s, 270, y, { h, w: Math.max(4, h * .13), ...o }));
  credit('Whiteboard Explainer', 1330, 50);
  credit('Lemo-Opuscar', 1420, 50, { color: INK.orange });
  credit('LemoLab × Claude Opus 5.5', 1510, 50);
  credit('voice: Kokoro (bm_george)  ·  lettering: EMS Tech (OFL)', 1600, 30);
  credit('samples: VSCO 2 CE, VCSL, FreePats (CC0)', 1650, 30);
  const crT0 = 103.3;
  D(K, cr, crT0, crT0 + 2.8, { minGap: .01, maxGap: .04 });
  tl.cue(.3, 'cap'); tl.cue(crT0 + 4.0, 'capOn');
  tl.end();

  // ───────── pin magnet choreography
  const pinPath = t => {                              // returns {x,y,lift,rot,vis}
    if (t < .55) return { x: PIN[0], y: PIN[1], lift: 1 - clamp((t - .25) / .3), vis: t > .25 };
    if (t < pinOffAt) return { x: PIN[0], y: PIN[1], lift: 0, vis: true };
    if (t < pinOffAt + .35) { const u = (t - pinOffAt) / .35; return { x: PIN[0] + u * u * 500, y: PIN[1] + u * u * 900, lift: Math.min(1, u * 3), vis: true }; }
    if (t < pinOnAt - .3) return { vis: false };
    if (t < pinOnAt) { const u = (t - pinOnAt + .3) / .3; return { x: PIN[0], y: PIN[1] - (1 - u) * 60, lift: 1 - u * u, vis: true }; }
    if (t < drift0) return { x: PIN[0], y: PIN[1], lift: 0, vis: true };
    if (t < driftEnd) {
      const d = Math.min(6, (t - drift0) / (dayBeats * BEAT) | 0), u = clamp((t - dayT[d]) / .5), e = u * u * (3 - 2 * u), seg = trailSegs[d];
      const f = e * (seg.length - 1), i = Math.min(seg.length - 2, f | 0), v = f - i;
      return { x: lerp(seg[i][0], seg[i + 1][0], v), y: lerp(seg[i][1], seg[i + 1][1], v), lift: Math.sin(Math.PI * u) * .25, vis: true };
    }
    if (t < rw0) { const u = clamp((t - driftEnd) / .5); return { x: SEA[0], y: SEA[1] + u * 40, lift: 0, rot: u * .5, vis: true, sunk: u }; }
    if (t < rw0 + rwDur) {
      const u = (t - rw0) / rwDur, n = trailBack.length - 1, f = u * n, i = Math.min(n - 1, f | 0), v = f - i;
      return { x: lerp(trailBack[i][0], trailBack[i + 1][0], v), y: lerp(trailBack[i][1], trailBack[i + 1][1], v), lift: .35 * Math.sin(Math.PI * u), rot: .5 * (1 - clamp(u * 4)), vis: true };
    }
    return { x: PIN[0], y: PIN[1], lift: 0, vis: true };
  };
  tl.cue(.55, 'magnet'); tl.cue(pinOffAt, 'magnetOff'); tl.cue(pinOnAt, 'magnet', { big: 1 }); tl.cue(driftEnd, 'splash'); tl.cue(rw0, 'rewind', { dur: rwDur }); tl.cue(rw0 + rwDur, 'magnet');

  // ───────── camera (t, x, y, zoom, rot, ease)
  const cam = new W.Camera([
    [0, 1478, 3060, 2.7],
    [1.2, 1478, 3060, 2.62, 0, 's'],
    [5.6, 1460, 3140, 1.25, 0, 'io'],                  // pull back: pin → map
    [8.2, 1450, 3150, .7, 0, 'io'],                    // → the whole phone
    [8.9, 1450, 3120, .69, 0, 'l'],
    [10.0, 1120, 830, .98, 0, 'io'],                   // tilt up to the title on "clocks"
    [14.5, 1150, 850, 1.04, 0, 'l'],
    [16.6, 3950, 1320, .62, 0, 'io'],                  // pan along the orbit as it is drawn
    [18.9, 3950, 1330, .66, 0, 'l'],
    [20.4, 4020, 1350, 1.3, 0, 'io'],                  // push to the atomic clock
    [23.9, 4030, 1480, 1.18, 0, 'io'],
    [24.9, 3900, 1640, 1.05, 0, 'io'],
    [28.0, 1900, 2460, 1.05, 0, 'io'],                 // ride the signal down to the phone
    [29.3, 1920, 2465, 1.06, 0, 'l'],
    [30.3, 3500, 2400, 1.0, 0, 'io'],                  // → the equation
    [33.9, 3560, 2410, 1.03, 0, 'l'],
    [35.0, 1450, 3140, .92, 0, 'io'],                  // back to the map
    [42.0, 1450, 3140, .96, 0, 'l'],
    [43.6, 1450, 3120, 1.0, 0, 'l'],
    [45.9, 1450, 3090, 1.35, -.015, 'io'],             // the catch: slow push, faint dutch
    [46.45, 6720, 1090, .86, 0, 'io'],                 // whip to the clocks
    [55.6, 6740, 1110, .88, 0, 'l'],
    [57.2, 6800, 1950, .98, 0, 'io'],                  // down to the terms
    [69.4, 6820, 2000, 1.02, 0, 'l'],
    [71.2, 3500, 2560, 1.0, 0, 'io'],                  // back to the equation (callback)
    [76.2, 3530, 2560, 1.03, 0, 'l'],
    [77.6, 1650, 3280, .9, 0, 'io'],                   // to the pin
    [78.0, 1650, 3290, .9, 0, 'l'],
    ...[...Array(7)].map((_, d) => { const s = trailSegs[d][trailSegs[d].length - 1]; return [drift0 + (d + 1) * dayBeats * BEAT, s[0] - 120, s[1] - 90, .9, 0, 'l']; }),
    [85.9, 7060, 3700, 1.05, 0, 'o'],
    [87.0, 7040, 3690, 1.06, 0, 'l'],
    [89.0, 1650, 3260, .85, 0, 'io'],                  // rewind ride
    [90.0, 6800, 1300, 1.0, 0, 'io'],                   // up to the rulers
    [96.2, 6820, 1310, 1.03, 0, 'l'],
    [101.5, 4000, 2250, .2, 0, 'io'],                  // the whole board, on the wall
    [102.8, 4000, 2260, .198, 0, 'l'],
    [105.3, 1250, 1060, .8, 0, 'io'],                 // into the title + credits
    [END, 1255, 1062, .81, 0, 'l'],
  ]);
  // pens and eraser drop into the tray on the wide shot (black stays out to sign the credits)
  const TRAY_Y = 4592, trayAt = { orange: T0 + 183 * BEAT, blue: T0 + 184 * BEAT }, trayX = { orange: 2900, blue: 3500 }, eraserTray = T0 + 185 * BEAT;
  const pose = (p, t) => {
    const ta = trayAt[p.id];
    if (ta && t > ta - .7) {
      const u = clamp((t - (ta - .7)) / .7), e = 1 - (1 - u) ** 3, [px, py] = cam.toWorld(p.park[0], p.park[1], ta - .7);
      return { x: lerp(px, trayX[p.id], e), y: lerp(py, TRAY_Y, e) - Math.sin(Math.PI * u) * 250, lift: (1 - u) * .8, ang: lerp(-.95, -.015, e), on: false };
    }
    return W.penPose(p, t, cam);
  };
  Object.entries(trayAt).forEach(([k, v]) => tl.cue(v, 'tray', { pen: k })); tl.cue(eraserTray, 'trayEraser');
  const trayEraser = { path: { start: [4300, TRAY_Y + 10], end: [4300, TRAY_Y + 10], at: () => [4300, TRAY_Y + 10], len: 1 }, t0: eraserTray, t1: 1e9, width: 150 };

  const board = new W.Board(tl, { ghosts });
  board.objs.push({ draw: (ctx, t, c) => { const p = pinPath(t); if (p.vis) W.drawPinMagnet(ctx, p.x, p.y, c, { lift: p.lift, rot: p.rot || 0, size: 150 }); } });
  board.objs.push({ draw: (ctx, t, c) => { for (const e of tl.erasers) W.drawEraser(ctx, e, t, c); W.drawEraser(ctx, trayEraser, t, c); } });
  if (!new URLSearchParams(location.search).has('nopens')) board.objs.push({ draw: (ctx, t, c) => { for (const p of PENS) W.drawMarker(ctx, p, pose(p, t), c, t); } });

  // ───────── subtitles (split long lines at commas / sentence breaks)
  const subs = [];
  for (const L of lines) {
    const ws = words[L.id].map(w => [w[0], Math.max(0, w[1]), w[2]]), t0 = VO[L.id];
    // whisper char-position → time, so text parts can be timed even when numerals differ
    const cum = [0]; ws.forEach(w => cum.push(cum[cum.length - 1] + w[0].length + 1)); const tot = cum[cum.length - 1];
    const timeAt = f => { const c = f * tot; let i = 0; while (i < ws.length - 1 && cum[i + 1] <= c) i++; const u = clamp((c - cum[i]) / (cum[i + 1] - cum[i])); return lerp(ws[i][1], ws[i][2], u); };
    const parts = L.text.match(/[^,.]+[,.…]*\s*/g).reduce((acc, p) => {   // clauses, merged while the line stays ≤ 44 chars
      const last = acc[acc.length - 1];
      if (last != null && ((last + p).trim().length <= 44 || ((last.trim().length < 24 || p.trim().length < 24) && (last + p).trim().length <= 90))) acc[acc.length - 1] += p; else acc.push(p); return acc; }, []);
    let c0 = 0;
    for (const p of parts) {
      const f0 = c0 / L.text.length, f1 = (c0 + p.trimEnd().length) / L.text.length; c0 += p.length;
      subs.push({ t0: t0 + (f0 === 0 ? ws[0][1] : timeAt(f0)) - .05, t1: t0 + (f1 >= .999 ? ws[ws.length - 1][2] : timeAt(f1)) + .35, text: p.trim() });
    }
  }
  for (let i = 0; i < subs.length - 1; i++) {        // hold each caption ≥1.4 s unless the next one needs the slot
    subs[i].t1 = Math.min(Math.max(subs[i].t1, subs[i].t0 + 1.4), subs[i + 1].t0 - .04);
  }
  window.__subs = subs;
  board.overlays.push({
    draw: (ctx, t) => {
      const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s) return;
      const a = Math.min(1, (t - s.t0) / .12, (s.t1 - t) / .12);
      ctx.font = '44px AD';
      let rows = [s.text];
      if (ctx.measureText(s.text).width > 1250) {     // two balanced lines
        const ws = s.text.split(' '); let best = 1, bd = 1e9;
        for (let i = 1; i < ws.length; i++) { const d = Math.abs(ctx.measureText(ws.slice(0, i).join(' ')).width - ctx.measureText(ws.slice(i).join(' ')).width); if (d < bd) { bd = d; best = i; } }
        rows = [ws.slice(0, best).join(' '), ws.slice(best).join(' ')];
      }
      const w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 64, h = 70 + (rows.length - 1) * 52, y0 = 1038 - h;
      ctx.globalAlpha = a * .9; ctx.fillStyle = '#fdfcf8'; ctx.shadowColor = 'rgba(30,30,40,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      ctx.beginPath(); ctx.roundRect(960 - w / 2, y0, w, h, 14); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.globalAlpha = a;
      ctx.fillStyle = INK.orange; ctx.fillRect(960 - w / 2 + 22, y0 + h - 12, 36, 4);
      ctx.fillStyle = '#23262c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      rows.forEach((r, i) => ctx.fillText(r, 960, y0 + 37 + i * 52));
    }
  });

  // ───────── frame render with camera motion blur on whips
  const off = new OffscreenCanvas(1920, 1080), oc = off.getContext('2d');
  const noSubs = new URLSearchParams(location.search).has('nosubs');
  if (noSubs) board.overlays.length = 0;
  const posterCam = new W.Camera([[0, 1120, 790, 1.0]]);
  function render(ctx, t) {
    if (new URLSearchParams(location.search).has('poster')) { board.render(ctx, t, posterCam); return; }
    const dt = 1 / 24, a = cam.at(t), b = cam.at(Math.max(0, t - dt));
    const sp = Math.hypot((a.x - b.x) * a.z, (a.y - b.y) * a.z) + Math.abs(Math.log(a.z / b.z)) * 900;
    const N = sp > 14 ? Math.min(12, Math.ceil(sp * .5 / 4)) : 1;       // 180° shutter, ≤4 px between sub-frames
    if (N === 1) { board.render(ctx, t, cam); return; }
    const ov = board.overlays; board.overlays = [];
    for (let i = 0; i < N; i++) {
      board.render(oc, t - dt * .5 * i / (N - 1), cam);
      ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(off, 0, 0);
    }
    ctx.globalAlpha = 1; board.overlays = ov;
    for (const o of ov) { ctx.save(); o.draw(ctx, t); ctx.restore(); }
  }

  const ev = [...tl.ev, ...Object.entries(VO).map(([id, t]) => ({ t, type: 'vo', id }))].sort((a, b) => a.t - b.t);
  for (const e of ev) if (e.x != null) { const c = cam.at(e.t), [px, py] = W.toScreen(c, e.x, e.y); e.pan = +clamp((px - 960) / 1400, -.7, .7).toFixed(2); e.z = +c.z.toFixed(2); e.on = px > -100 && px < 2020 && py > -100 && py < 1180 ? 1 : 0; }
  return { dur: END, render, ev, subs, cam, tl, VO, cues: { T0, BEAT, drift0, driftEnd, dayT, duet0, duetEnd, fix0, fixEnd, pinOnAt, pinOffAt, rw0, rwDur, trayAt, eraserTray, crT0 } };
}
