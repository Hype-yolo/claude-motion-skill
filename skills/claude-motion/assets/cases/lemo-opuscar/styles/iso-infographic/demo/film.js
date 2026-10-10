// From Bean to Cup — one continuous camera over one isometric board. Timeline, camera, stations, overlays, sound events.
// Scenes only call engine.js (style) / world.js (the board) / hero.js (close-ups).
import { Iso, PAL, tri, hex, mix, clamp, lerp, seg, ss, eo, eio, back, hash, TAU, C30, S30, pin, inset, ring, cutLine, ICON, iconGrid, haloText, person, FONT } from './engine.js';
import * as W from './world.js';
import * as H from './hero.js';
import { TL, SUBS, KM } from './timeline.js';
export const DUR = TL.END;
const fmt = n => Math.round(n).toLocaleString('en-US');
const lg = Math.log, ex = Math.exp;
const mixK = (a, b, f) => ex(lerp(lg(a), lg(b), f));
const mixP = (a, b, f) => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f) });

// ---------- paths ----------
function polyPath(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, at(u) { const d = this.L[this.L.length - 1] * clamp(u); let i = 1; while (i < this.pts.length - 1 && this.L[i] < d) i++; const a = this.pts[i - 1], b = this.pts[i], f = (d - this.L[i - 1]) / (this.L[i] - this.L[i - 1] || 1); return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), rot: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } }; }
const TRUCK_A = polyPath([[97, 74], [104, 66], [110, 52], [118, 40], [128, 30], [140, 18], [152, 13], [183, 13]]);
const TRUCK_B = polyPath([[103, 210], [124, 214], [140, 225], [151, 228.5]]);
const BIKE = polyPath([[158, 229.5], [168, 230.5], [188, 234.5], [195, 235.5]]);
const QBOX = { x: 189.6, y: 8.2 };                                     // our container waiting on quay A
const SHIP_A = { x: W.PORT_A.x, y: W.PORT_A.y, rot: Math.PI };
const SHIP_B = (() => { const s = W.shipAt(1); return { x: W.PORT_B.x, y: W.PORT_B.y, rot: Math.PI }; })();

// ---------- the story state ----------
function shipU(t) {
  if (t < TL.DEPART) return 0;
  if (t < TL.FF0) { const f = (t - TL.DEPART) / (TL.FF0 - TL.DEPART); return .2 * (.45 * f * f + .55 * f); }
  if (t < TL.DIVE0) return .2 + .4 * (t - TL.FF0) / (TL.DIVE0 - TL.FF0);
  if (t < 30.4) return .6 + .04 * eo((t - TL.DIVE0) / 2.8);
  return 1;
}
function shipPose(t) { if (t < TL.DEPART) return SHIP_A; if (t >= 30.4) return SHIP_B; return W.shipAt(shipU(t)); }
const truckA = t => t < TL.TRUCK_GO ? TRUCK_A.at(0) : TRUCK_A.at(eio(seg(t, TL.TRUCK_GO, TL.PORT0 - .05)));
const truckB = t => TRUCK_B.at(eio(seg(t, TL.TRUCK_B, TL.ROAST0 - .05)));
const hullCut = t => t < TL.HULL ? 0 : t < 34.2 ? ss(seg(t, TL.HULL, TL.HULL + .35)) : 1 - ss(seg(t, 34.2, 34.7));
const boxOpen = t => t < TL.BOX_CUT ? 0 : t < 34.0 ? ss(seg(t, TL.BOX_CUT, TL.BOX_CUT + .25)) : 1 - ss(seg(t, 34.0, 34.3));
const tearA = t => t < TL.SACK_CUT ? 0 : t < 33.95 ? eo(seg(t, TL.SACK_CUT, TL.SACK_CUT + .18)) : 0;
const roastOpen = t => ss(seg(t, TL.WALL, TL.WALL + .35)) * (1 - ss(seg(t, 41.0, 41.4)));
const cafeOpen = t => ss(seg(t, TL.ROOF, TL.ROOF + .35));
function beanColor(t) { const f = seg(t, TL.POUR, TL.CRACK1); return f < .35 ? hex(mix('#A9B27C', '#D9C27A', f / .35)) : f < .7 ? hex(mix('#D9C27A', '#B07A45', (f - .35) / .35)) : hex(mix('#B07A45', '#6A3B22', (f - .7) / .3)); }

// our container & bean in world coordinates (depends on the ship pose)
function holdCentre(sh) { return W.shipToWorld(sh, W.HOLD.u + W.SHIP.cl / 2, W.HOLD.v + W.SHIP.cw / 2, W.HOLD.z + 1.05); }
function sackFace(sh) { return W.shipToWorld(sh, W.HOLD.u + W.SACK.a, W.HOLD.v + .05, W.HOLD.z + W.SACK.c); }
const V = a => ({ x: a[0], y: a[1], z: a[2] });

// the café: counter, machine, cup, customer
const C = W.CAFE, CUPP = { x: C.x + 7.3, y: C.y + 4.75, z: 2.2 };
function cupPos(t) {
  if (t < TL.SLIDE) return { ...CUPP };
  const f = eio(seg(t, TL.SLIDE, TL.CLINK)), l = eo(seg(t, TL.CLINK + .1, TL.PUSH + .5));
  return { x: lerp(CUPP.x, C.x + 9.5, f), y: lerp(CUPP.y, C.y + 5.15, f), z: 2.2 + l * .9 };
}
const A0 = (() => { const P = picker(0); return { x: P.x - 1.05, y: P.y + .75, z: P.z + 1.25 }; })();
const LIFTZ = .17;   // camera sits a little above the palm so the branch fits above it   // opening palm (hero anchor)
function A1(t) { const c = cupPos(Math.max(t, TL.PUSH + .5)); return { x: c.x, y: c.y, z: c.z }; }

// ---------- camera ----------
const HILL = { x: 55, y: 53, z: 3 }, BEDC = { x: 84, y: 67, z: 1 }, PORTC = { x: 191, y: 21, z: 3 }, PORTB = { x: 100, y: 206, z: 2 };
const ROASTC = { x: W.ROASTERY.x + 8, y: W.ROASTERY.y + 7, z: 3 }, DRUMC = { x: W.ROASTERY.x + 7, y: W.ROASTERY.y + 6.5, z: 3.2 };
const CAFEC = { x: C.x + 7, y: C.y + 5, z: 2.5 }, FULLC = { x: 134, y: 110, z: -8 };
function shipFollow(t) { const s = shipPose(t), lead = t < TL.SEA0 ? 4 : 10; return { x: s.x + Math.cos(s.rot) * lead, y: s.y + Math.sin(s.rot) * lead, z: 2 }; }
export function camAt(t) {
  const K = (p, k) => ({ ...p, k });
  const A0c = { ...A0, z: A0.z + LIFTZ };
  if (t < TL.PULL0) return K(A0c, lerp(600, 580, t / TL.PULL0));
  if (t < TL.PULL1) { const f = eio(seg(t, TL.PULL0, TL.PULL1)); return K(mixP(A0c, HILL, ss(f)), mixK(580, 16.5, f)); }
  if (t < TL.DESC0) return K(HILL, mixK(16.5, 16, seg(t, TL.PULL1, TL.DESC0)));
  if (t < TL.DRY0) { const f = eio(seg(t, TL.DESC0, TL.DRY0)); return K(mixP(HILL, BEDC, f), mixK(16, 27, f)); }
  if (t < TL.TRUCK0) return K(BEDC, mixK(27, 32, ss(seg(t, TL.DRY0, TL.TRUCK0))));
  if (t < TL.TRUCK_GO) { const f = eio(seg(t, TL.TRUCK0, TL.TRUCK_GO)), tp = truckA(t); return K(mixP(BEDC, { x: tp.x, y: tp.y, z: 1 }, f), mixK(32, 22, f)); }
  if (t < TL.JCUT_PORT) { const tp = truckA(t); return K({ x: tp.x, y: tp.y, z: 1 }, 22); }
  if (t < TL.PORT0) { const f = eio(seg(t, TL.JCUT_PORT, TL.PORT0)), tp = truckA(t); return K(mixP({ x: tp.x, y: tp.y, z: 1 }, PORTC, f), mixK(22, 17, f)); }
  if (t < 21.2) return K(PORTC, mixK(17, 17.5, seg(t, TL.PORT0, 21.2)));
  if (t < TL.DEPART) return K(mixP(PORTC, { x: 190, y: 24, z: 3 }, eio(seg(t, 21.2, TL.DEPART))), mixK(17.5, 15, eio(seg(t, 21.2, TL.DEPART))));
  if (t < TL.SEA0) { const f = eio(seg(t, TL.DEPART, TL.SEA0)); return K(mixP({ x: 190, y: 24, z: 3 }, shipFollow(t), f), mixK(15, 8, f)); }
  if (t < TL.FF0) return K(shipFollow(t), mixK(8, 8.5, seg(t, TL.SEA0, TL.FF0)));
  if (t < TL.DIVE0) return K(shipFollow(t), mixK(8.5, 11, ss(seg(t, TL.FF0, TL.DIVE0))));
  // the dive: first level slow, the next two faster (a fall)
  const sh = shipPose(t), P0 = { ...V(W.shipToWorld(sh, 0, 0, 3)) }, Pc = V(holdCentre(sh)), Ps = V(sackFace(sh)), Pb = Ps;
  if (t < TL.HULL) { const f = ss(seg(t, TL.DIVE0, TL.HULL)); return K(mixP(shipFollow(t), P0, f), mixK(11, 13, f)); }
  if (t < TL.BOX_CUT) { const f = eio(seg(t, TL.HULL, TL.BOX_CUT)); return K(mixP(P0, Pc, f), mixK(13, 60, f)); }
  if (t < TL.SACK_CUT) { const f = eio(seg(t, TL.BOX_CUT, TL.SACK_CUT)); return K(mixP(Pc, Ps, f), mixK(60, 420, f)); }
  if (t < TL.SIL0) { const f = ss(seg(t, TL.SACK_CUT, TL.SIL0)); return K(Pb, mixK(420, 3200, f)); }
  if (t < TL.HORN) return K(Pb, mixK(3200, 8000, ss(seg(t, TL.SIL0, TL.HORN))));
  if (t < TL.ARRIVE) { const f = eo(seg(t, TL.HORN, TL.ARRIVE)); return K(mixP(Pb, PORTB, f * f), mixK(8000, 17, f)); }
  if (t < TL.TRUCK_B) return K(PORTB, 17);
  if (t < TL.ROAST0) { const f = eio(seg(t, TL.TRUCK_B, TL.ROAST0)); return K(mixP(PORTB, ROASTC, f), mixK(17, 40, f)); }
  if (t < TL.BIKE - .3) return K(mixP(ROASTC, DRUMC, ss(seg(t, TL.ROAST0, TL.CRACK0))), mixK(40, 70, ss(seg(t, TL.ROAST0, TL.CRACK1))));
  if (t < TL.CAFE0) { const f = eio(seg(t, TL.BIKE - .3, TL.CAFE0)); return K(mixP(DRUMC, CAFEC, f), mixK(70, 45, f)); }
  if (t < TL.MACHINE) return K(mixP(CAFEC, { x: C.x + 6.5, y: C.y + 4.4, z: 2.6 }, ss(seg(t, TL.CAFE0, TL.MACHINE))), mixK(45, 62, ss(seg(t, TL.CAFE0, TL.MACHINE))));
  if (t < TL.DROP) { const f = eio(seg(t, TL.MACHINE, TL.SIL2)); return K(mixP({ x: C.x + 6.5, y: C.y + 4.4, z: 2.6 }, { ...CUPP, z: 3.0 }, f), mixK(62, 340, f)); }
  if (t < TL.SLIDE) return K({ ...CUPP, z: 3.0 }, mixK(340, 360, seg(t, TL.DROP, TL.SLIDE)));
  if (t < TL.PUSH) { const c = cupPos(t), f = eio(seg(t, TL.SLIDE, TL.PUSH)); return K(mixP({ ...CUPP, z: 3.0 }, { x: c.x, y: c.y, z: c.z + .6 }, f), mixK(360, 110, f)); }
  const A1c = { ...A1(t), z: A1(t).z + LIFTZ };
  if (t < TL.HAND) { const f = eio(seg(t, TL.PUSH, TL.HAND)), c = cupPos(t); return K(mixP({ x: c.x, y: c.y, z: c.z + .6 }, A1c, f), mixK(110, 600, f)); }
  if (t < TL.FULL0) return K(A1c, lerp(600, 580, seg(t, TL.HAND, TL.FULL0)));
  { const f = eio(seg(t, TL.FULL0, TL.FULL1)); return K(mixP(A1c, FULLC, ss(f)), mixK(580, 3.75, f)); }
}

// ---------- background / clouds ----------
function background(g, iso) {
  g.fillStyle = PAL.bg; g.fillRect(0, 0, 1920, 1080);
  const k = iso.cam.k; if (k > 60) return;
  const step = k < 8 ? 10 : 5; g.fillStyle = 'rgba(160,130,90,.16)';
  const cs = [iso.unP(0, 0, -11), iso.unP(1920, 1080, -11), iso.unP(1920, 0, -11), iso.unP(0, 1080, -11)];
  const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
  const mnx = Math.floor(Math.min(...xs) / step) * step, mxx = Math.max(...xs), mny = Math.floor(Math.min(...ys) / step) * step, mxy = Math.max(...ys);
  if ((mxx - mnx) / step * (mxy - mny) / step > 40000) return;
  for (let x = mnx; x <= mxx; x += step) for (let y = mny; y <= mxy; y += step) { const [sx, sy] = iso.P(x, y, -11); if (sx < -4 || sx > 1924 || sy < -4 || sy > 1084) continue; g.fillRect(sx - 1.2, sy - 1.2, 2.4, 2.4); }
}
function clouds(g, iso, t) {
  const k = iso.cam.k; if (k > 40) return;
  const Cl = [[30, 110, 22, 9], [120, 60, 26, 11], [205, 150, 24, 8], [60, 200, 20, 10], [175, 235, 18, 9], [20, 20, 16, 12], [150, 120, 28, 7]];
  for (const [cx, cy, z, s] of Cl) {
    const px = 1.25; const [sx, sy] = iso.P(cx + t * .8, cy - t * .5, z); const X = 960 + (sx - 960) * px, Y = 540 + (sy - 540) * px, R = s * k * px;
    if (X < -R * 2 || X > 1920 + R * 2 || Y < -R * 2 || Y > 1080 + R * 2) continue;
    g.save(); g.globalAlpha = .88 * clamp((40 - k) / 20);
    const blob = (dx, dy, r) => { g.beginPath(); g.ellipse(X + dx * R, Y + dy * R, r * R, r * R * .58, 0, 0, TAU); g.fill(); };
    g.fillStyle = '#E3D6BD'; blob(.05, .12, .5); blob(.45, .14, .38); blob(-.38, .16, .34);
    g.fillStyle = '#FFFDF7'; blob(0, 0, .5); blob(.42, .04, .36); blob(-.4, .06, .32); blob(.12, -.16, .34);
    g.restore();
  }
}

// ---------- people ----------
function picker(t) { const a = .52, r = (W.TER[1].R + W.TER[2].R) / 2 + .4; return { x: W.MTN.x + Math.cos(a) * r, y: W.MTN.y + Math.sin(a) * r * .92, z: W.TER[1].z1 }; }
const PICK_WALK = polyPath([[0, 0], [-1.5, 5], [2, 9.5], [9, 11], [14.5, 10.5]]);   // relative to the picker, down the terraces to the beds
function pickerNow(t) {
  const P = picker(0);
  if (t < TL.DESC0) return { ...P, walk: 0 };
  const f = seg(t, TL.DESC0, TL.DRY0 - .1), q = PICK_WALK.at(f);
  const z = t < 11.1 ? P.z : t < 11.4 ? W.TER[0].z1 : 0;          // one terrace step per beat
  return { x: P.x + q.x, y: P.y + q.y, z, walk: f < 1 ? 1 : 0, face: q.rot > -1.6 && q.rot < 1.6 ? 1 : -1 };
}
function peopleNow(t) {
  const st = Math.floor(t * 12) / 12, L = [];
  const p = pickerNow(t), bob = p.walk ? Math.abs(Math.sin(st * 9)) * .12 : 0;
  const reach = t < TL.BASKET ? 2.25 : lerp(2.25, .35, eo(seg(t, TL.BASKET, TL.BASKET + .4)));
  const pourArm = t > TL.DRY0 - .1 && t < TL.DRY0 + .6 ? 2.5 : null;
  const heroA = heroAlpha(t);
  L.push({ x: p.x, y: p.y, z: p.z, o: { body: PAL.red[1], hat: 'straw', skin: '#9C6644', basket: t < TL.DRY0 ? 2 : 1, arm: pourArm ?? (p.walk ? .3 + Math.sin(st * 9) * .3 : reach), face: t < TL.DESC0 ? -1 : 1, h: 3.6, bob }, alpha: 1 - heroA });
  L.push({ x: W.MTN.x - 6, y: W.MTN.y + 14.5, z: W.TER[1].z1, o: { body: '#5E8C4A', hat: 'straw', skin: '#B07A52', basket: 2, arm: 2.1 + Math.sin(st * 4) * .3, face: 1, h: 3.4 } });
  L.push({ x: W.MTN.x + 11, y: W.MTN.y - 8, z: W.TER[2].z1, o: { body: '#3C7FB1', hat: 'straw', skin: '#8E5B3C', basket: 2, arm: 2.2 + Math.sin(st * 5 + 1) * .3, face: 1, h: 3.4 } });
  // rake worker: one stroke per beat on the rake cues
  let ra = 1.0; for (const r of TL.RAKES) if (t >= r - .2 && t < r + .4) ra = 1.0 + Math.sin(clamp((t - r + .2) / .6) * Math.PI) * .9;
  const scoop = t >= TL.SACK_POUR && t < TL.SACK ? 2.3 : null, throwA = (t >= TL.TRUCK0 - .15 && t < TL.TRUCK0 + .2) || (t >= 15.75 && t < 16.1) ? 2.9 : null;
  L.push({ x: W.BEDS.x + 9, y: W.BEDS.y + 12.6, o: { body: '#F0E3C4', hat: 'straw', skin: '#9C6644', arm: throwA ?? scoop ?? ra, face: 1, h: 3.4, tool: scoop || throwA ? null : rake } });
  // café: barista + customer (seated)
  const bArm = (t > TL.TAMP - .3 && t < TL.TAMP + .3) ? 1.2 : (t > TL.SLIDE && t < TL.CLINK) ? 2.4 : 1.8;
  L.push({ x: C.x + 4.6, y: C.y + 2.0, o: { body: '#3C7FB1', apron: '#F3ECDD', hair: '#3A2A22', skin: '#C98B62', arm: bArm, face: 1, h: 3.3 } });
  L.push({ x: C.x + 9.8, y: C.y + 6.4, z: 0, o: { body: '#3C7FB1', hair: '#5A4030', skin: '#E8B894', arm: t > TL.CLINK ? lerp(1.2, 2.6, eo(seg(t, TL.CLINK, TL.PUSH))) : 1.2, face: -1, h: 3.0, legs: '#2F3B4A' }, alpha: 1 - heroAlpha(t) });
  // roaster
  L.push({ x: W.ROASTERY.x + 3, y: W.ROASTERY.y + 9, o: { body: '#5E8C4A', apron: '#E9DCC2', hat: 'cap', hatColor: '#B3352B', skin: '#B07A52', arm: t > TL.COOL && t < TL.COOL + .6 ? 2.6 : 1.4, face: 1, h: 3.3 } });
  return L;
}
function heroAlpha(t) { const k = camAt(t).k; return (t < 8 || (t > TL.PUSH && t < TL.FULL1)) ? ss(clamp((k - 70) / 110)) : 0; }
function rake(g, ex, ey, h) { g.strokeStyle = '#7A5236'; g.lineWidth = .05 * h; g.beginPath(); g.moveTo(ex - .35 * h, ey - .25 * h); g.lineTo(ex + .45 * h, ey + .3 * h); g.stroke(); g.fillStyle = '#5E4631'; g.fillRect(ex + .38 * h, ey + .26 * h, .22 * h, .04 * h); }

// ---------- loading at port A ----------
const B = .6;
const ORDER = (() => { const first = [], rest = []; W.DECK.forEach((d, i) => { if (d.b === 3 && d.tier === 0 && d.r === 0) first[0] = i; else if (d.b === 3 && d.tier === 0 && d.r === 1) first[1] = i; else if (d.b === 3 && d.tier === 1 && d.r === 0) first[2] = i; else rest.push(i); }); return [...first, ...rest]; })();
const RANK = (() => { const r = []; ORDER.forEach((i, k) => r[i] = k); return r; })();
const NCAS = ORDER.length - 5;
function landTimeK(k) {
  if (k < 3) return TL.DECK_CRANE[k];
  if (k < 5) return TL.DECK_EIGHTH[k - 3];
  const w = Math.min(3, Math.floor((k - 5) / (NCAS / 4)));                 // four sixteenth-note waves
  return TL.CASCADE + .15 + w * .15 - hash(k * 3.7) * .04;
}
const landTime = i => landTimeK(RANK[i]);
function dropState(i, t) { const tl = landTime(i), k = RANK[i]; if (k < 3) return t >= tl ? [0, 1] : null; const fall = .28; if (t < tl - fall) return null; if (t >= tl) { const q = clamp((t - tl) / .16); return [Math.sin(q * Math.PI) * .2 * (1 - q), 1]; } const f = (tl - t) / fall; return [f * f * 7, 1]; }
function slotWorld(u, v, z) { return W.shipToWorld(SHIP_A, u + W.SHIP.cl / 2, v + W.SHIP.cw / 2, z); }
function craneState(t) {
  const hold = slotWorld(W.HOLD.u, W.HOLD.v, W.HOLD.z), q = [QBOX.x + 2.9, QBOX.y + 1.1, 0];
  const ours = tri('#B3352B', .2, .24);
  if (t < TL.LIFT) return { x: q[0], trolley: q[1] - 8, zb: 2.6, box: null };
  if (t < 18.7) { const f = eo(seg(t, TL.LIFT, 18.7)), m = ss(seg(t, 18.4, 18.7)); return { x: lerp(q[0], hold[0], m), trolley: lerp(q[1], hold[1], m) - 8, zb: lerp(0, 14, f), box: ours, ours: true }; }
  if (t < TL.LOAD0) return { x: hold[0], trolley: hold[1] - 8, zb: lerp(14, hold[2], eio(seg(t, 18.7, TL.LOAD0))), box: ours, ours: true };
  const tg = [TL.LOAD0, ...TL.DECK_CRANE];
  for (let j = 1; j < tg.length; j++) if (t < tg[j]) {
    const d = W.DECK[ORDER[j - 1]], p = slotWorld(d.u, d.v, d.z), prevP = j === 1 ? hold : (() => { const e = W.DECK[ORDER[j - 2]]; return slotWorld(e.u, e.v, e.z); })();
    const mv = ss(seg(t, tg[j - 1] + .05, tg[j] - .4)), low = eio(seg(t, tg[j] - .4, tg[j]));
    return { x: lerp(prevP[0], p[0], mv), trolley: lerp(prevP[1], p[1], mv) - 8, zb: t < tg[j] - .4 ? 15 : lerp(15, p[2], low), box: mv > .02 ? W.containerTri(d.c) : null };
  }
  const d = W.DECK[ORDER[2]], p = slotWorld(d.u, d.v, d.z); return { x: p[0], trolley: p[1] - 8, zb: lerp(p[2] + 2.3, 15, eo(seg(t, 21.0, 21.6))), box: null };
}

// ---------- route (dashed) ----------
export const ROUTE = (() => {
  const P = picker(0), pts = [[P.x, P.y, P.z], [P.x - 1.5, P.y + 5, W.TER[0].z1], [P.x + 2, P.y + 9.5, 0], [W.BEDS.x - 2, W.BEDS.y + 3, 0], [W.BEDS.x + 8, W.BEDS.y + 13.5, 0], ...TRUCK_A.pts.map(p => [p[0], p[1], 0]), [QBOX.x + 3, QBOX.y + 3, 0]];
  for (let i = 2; i <= 60; i++) { const s = W.shipAt(i / 60); pts.push([s.x, s.y, W.ZW]); }
  pts.push(...TRUCK_B.pts.map(p => [p[0], p[1], 0]), ...BIKE.pts.map(p => [p[0], p[1], 0]), [C.x + 9.5, C.y + 7, 0]);
  let L = 0; const out = [[...pts[0], 0]]; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); out.push([...pts[i], L]); }
  return out;
})();
const RL = ROUTE[ROUTE.length - 1][3];
const frAt = (x, y) => { let b = 0, bd = 1e9; ROUTE.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; b = i; } }); return ROUTE[b][3] / RL; };
const FR = { beds: frAt(W.BEDS.x + 8, W.BEDS.y + 13.5), truck0: frAt(97, 74), quay: frAt(QBOX.x + 3, QBOX.y + 3), shipEnd: frAt(W.PORT_B.x, W.PORT_B.y), roast: frAt(151, 228.5), cafe: 1 };
function routeLead(t) {   // the line always runs a little ahead of the story
  if (t < TL.DESC0 - .5) return 0;
  if (t < TL.DRY0) return lerp(0, FR.beds, ss(seg(t, TL.DESC0 - .5, TL.DESC0 + .7)));
  if (t < TL.TRUCK0) return FR.beds;
  if (t < TL.PORT0) return lerp(FR.beds, FR.quay, ss(seg(t, TL.TRUCK0, TL.PORT0 - .6)));
  if (t < TL.DEPART - .4) return FR.quay;
  if (t < 30.4) { const s = W.shipAt(Math.min(1, shipU(t + .5) + .03)); return Math.max(FR.quay, frAt(s.x, s.y)); }
  if (t < TL.TRUCK_B - .3) return FR.shipEnd;
  if (t < TL.ROAST0) return lerp(FR.shipEnd, FR.roast, ss(seg(t, TL.TRUCK_B - .3, TL.ROAST0 - .2)));
  if (t < TL.BIKE - .3) return FR.roast;
  return lerp(FR.roast, 1, ss(seg(t, TL.BIKE - .3, TL.CAFE0 - .1)));
}
function drawRoute(iso, u0, u1, o = {}) {
  const a = RL * u0, b = RL * u1; if (b - a < .01) return;
  iso.add(5e5, () => {
    const g = iso.g, k = iso.cam.k; g.save(); g.globalAlpha = o.a ?? 1; g.beginPath(); let started = false;
    for (let i = 1; i < ROUTE.length; i++) {
      const p = ROUTE[i - 1], q = ROUTE[i]; if (q[3] < a || p[3] > b) continue;
      const f0 = clamp((a - p[3]) / (q[3] - p[3])), f1 = clamp((b - p[3]) / (q[3] - p[3]));
      const s0 = iso.P(lerp(p[0], q[0], f0), lerp(p[1], q[1], f0), lerp(p[2], q[2], f0) + .15), s1 = iso.P(lerp(p[0], q[0], f1), lerp(p[1], q[1], f1), lerp(p[2], q[2], f1) + .15);
      if (!started) { g.moveTo(s0[0], s0[1]); started = true; } g.lineTo(s1[0], s1[1]);
    }
    g.lineJoin = 'round'; g.lineCap = 'round';
    const lw = Math.min(8, Math.max(2.2, k * .2));
    g.strokeStyle = 'rgba(251,244,230,.85)'; g.lineWidth = lw + 4; g.stroke();
    g.strokeStyle = PAL.ink; g.lineWidth = lw; g.setLineDash([lw * 3.2, lw * 2.4]); g.lineDashOffset = -(o.t || 0) * lw * 4; g.stroke();
    g.restore();
  }, 2);
}

// ---------- stations on the lower land ----------
function plate(iso, x, y, w, d) { iso.flat([[x, y], [x + w, y], [x + w, y + d], [x, y + d]], .03, '#F6EEDD', { layer: 0 }); iso.add(-8.7e5, () => { const g = iso.g, pts = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(q => iso.P(q[0], q[1], .04)); g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.strokeStyle = iso.col(PAL.ink, .5); g.lineWidth = 1.4; g.setLineDash([6, 5]); g.stroke(); g.restore(); }, 0); }
function roastery(iso, t) {
  const R = W.ROASTERY, T = tri('#B3352B', .2, .24), o = roastOpen(t), bc = beanColor(t);
  plate(iso, R.x - 3, R.y - 3, R.w + 6, R.d + 8);
  W.cutBuilding(iso, R, {
    open: o, wall: T, inner: tri('#EFE4CF', .12, .2), floor: '#D6CCBC',
    decal: (I) => { for (let i = 0; i < 4; i++) { const u = R.x + 1.5 + i * 3.6; I.face3([[u, R.y + R.d + .02, 3], [u + 2, R.y + R.d + .02, 3], [u + 2, R.y + R.d + .02, 6.4], [u, R.y + R.d + .02, 6.4]], tri('#F3DDB0'), { out: [0, 1, 0] }); } I.face3([[R.x + R.w + .02, R.y + 3, 0], [R.x + R.w + .02, R.y + 6, 0], [R.x + R.w + .02, R.y + 6, 4.5], [R.x + R.w + .02, R.y + 3, 4.5]], tri('#6A432A'), { out: [1, 0, 0] }); },
    roof: (I, dz, a) => { I.push(0, 0, dz, 0); I.prismNow([[R.x - .3, R.y - .3], [R.x + R.w + .3, R.y - .3], [R.x + R.w + .3, R.y + R.d + .3], [R.x - .3, R.y + R.d + .3]], R.h, .6, tri('#6E6A62')); I.cylNow(R.x + 12.5, R.y + 2.5, R.h, .9, 5.5, tri('#8C4634'), { axis: 'z' }); I.pop(); },
    interior: (I) => {
      const dx = R.x + 4.2, dy = R.y + 6.5, dz = 3.4, r = 2.4, L = 5.2, spin = t * 2.2;
      I.box(R.x + 1, R.y + 1, 0, 3, 2.2, 2.1, tri('#9FAF7A', .2, .24)); I.box(R.x + 1, R.y + 3.3, 0, 3, 2.2, 1.4, tri('#A8B882', .2, .24)); I.box(R.x + 1.4, R.y + 1.2, 2.1, 2.2, 1.8, 1.1, tri('#9FAF7A', .2, .24));   // green-bean sacks
      I.box(dx - .2, dy - 1.8, 0, L + .4, 3.6, 1.2, tri('#3A3432'));
      I.cyl(dx, dy, dz, r, L, tri('#3A3432'), { axis: 'x', n: 28, spin, stripe: i => i % 7 === 0 ? '#5A524E' : null, decal: (J) => {
        // round window on the +x cap: the beans tumbling, colour follows the roast
        const c = J.L(dx + L + .02, dy, dz), k = J.cam.k, rw = 1.35 * k; const g = J.g; g.save();
        g.beginPath(); g.ellipse(c[0], c[1], rw * .72, rw * 1.02, -.52, 0, TAU); g.fillStyle = J.col('#C9C2B4'); g.fill();
        g.beginPath(); g.ellipse(c[0], c[1], rw * .6, rw * .86, -.52, 0, TAU); g.fillStyle = J.col('#2A2420'); g.fill(); g.clip();
        if (t > TL.POUR) for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + spin * (1 + i % 3 * .2), rr = rw * (.25 + .5 * hash(i)); g.beginPath(); g.ellipse(c[0] + Math.cos(a) * rr * .6, c[1] + Math.sin(a) * rr * .8 + rw * .25, rw * .09, rw * .065, a, 0, TAU); g.fillStyle = J.col(bc); g.fill(); }
        g.restore();
      } });
      I.box(dx + 1.2, dy - .7, dz + r - .2, 1.6, 1.4, 1.5, tri('#6E6A62'));   // hopper
      I.cyl(dx + 3.6, dy, dz + r - .3, .32, 8 - (dz + r - .3), tri('#8A8580'), { axis: 'z', n: 12 });   // chimney pipe
      // cooling tray
      const tf = seg(t, TL.COOL, TL.COOL + .7);
      I.cyl(R.x + 12.4, R.y + 8.6, 0, 2.3, 1.2, tri('#B8B2A6'), { axis: 'z', n: 28, capColor: tf > 0 ? hex(mix('#8E8A82', '#5A301C', ss(tf))) : '#8E8A82' });
      if (tf > 0) { const a = t * 3; I.line3([[R.x + 12.4, R.y + 8.6, 1.3], [R.x + 12.4 + Math.cos(a) * 2, R.y + 8.6 + Math.sin(a) * 2, 1.3]], '#3A3432', 3, { bias: 5 }); }
      // bean streams
      if (t > TL.POUR && t < TL.POUR + .7) stream(I, [dx + 2, dy, dz + r + 1.2], [dx + 2, dy, dz + .6], t, '#A9B27C');
      if (tf > 0 && tf < .9) stream(I, [dx + L + .3, dy + .6, dz - 1.2], [R.x + 12.1, R.y + 8.4, 1.3], t, '#5A301C');
      // first-crack pops around the window
      for (const c of TL.CRACKS) { const q = seg(t, c, c + .22); if (q > 0 && q < 1) pop(I, dx + L + .3, dy + (hash(c * 9) - .5) * 2.4, dz + (hash(c * 5) - .5) * 2, q); }
    },
  });
}
function stream(I, a, b, t, col) { I.add(1e4, () => { const g = I.g; for (let i = 0; i < 16; i++) { const f = (i / 16 + t * 2.2) % 1, p = [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f) - f * f * .4]; const s = I.L(...p); g.beginPath(); g.ellipse(s[0] + (hash(i) - .5) * 6, s[1], .1 * I.cam.k, .07 * I.cam.k, i, 0, TAU); g.fillStyle = I.col(col); g.fill(); } }, 1); }
function pop(I, x, y, z, q) { I.add(2e4, () => { const g = I.g, s = I.L(x, y, z), k = I.cam.k; g.save(); g.strokeStyle = I.col(PAL.ink, 1 - q); g.lineWidth = 2.2; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3, r0 = (.25 + q * .5) * k, r1 = r0 + .3 * k; g.beginPath(); g.moveTo(s[0] + Math.cos(a) * r0, s[1] + Math.sin(a) * r0); g.lineTo(s[0] + Math.cos(a) * r1, s[1] + Math.sin(a) * r1); g.stroke(); } for (let i = 0; i < 3; i++) { const a = hash(x + i) * TAU; g.beginPath(); g.ellipse(s[0] + Math.cos(a) * q * k * 1.1, s[1] + Math.sin(a) * q * k * .8 + q * q * k, .1 * k, .07 * k, a, 0, TAU); g.fillStyle = I.col('#8A5A34', 1 - q); g.fill(); } g.restore(); }, 1); }
function cafe(iso, t) {
  const T = tri('#F1E7D2', .15, .2), o = cafeOpen(t);
  plate(iso, C.x - 3, C.y - 3, C.w + 6, C.d + 8);
  const awning = (I, off, a) => { for (let i = 0; i < 7; i++) { const u = C.x + i * C.w / 7; I.face3([[u, C.y + C.d + off, 4.6], [u + C.w / 7, C.y + C.d + off, 4.6], [u + C.w / 7, C.y + C.d + 2 + off, 3.8], [u, C.y + C.d + 2 + off, 3.8]], i % 2 ? tri('#F3ECDD') : PAL.red, { out: [0, 1, 1] }); } };
  W.cutBuilding(iso, C, {
    open: o, wall: T, floor: '#E4D6BC',
    floorDecal: (I) => { const g = I.g; for (let i = 0; i < 14; i++) for (let j = 0; j < 11; j++) if ((i + j) % 2) I.poly([[C.x + i, C.y + j], [C.x + i + 1, C.y + j], [C.x + i + 1, C.y + j + 1], [C.x + i, C.y + j + 1]].map(q => I.P(q[0], q[1], .03)), '#D2C09F'); },
    decal: (I) => { I.face3([[C.x + 1.5, C.y + C.d + .02, .8], [C.x + C.w - 1.5, C.y + C.d + .02, .8], [C.x + C.w - 1.5, C.y + C.d + .02, 4], [C.x + 1.5, C.y + C.d + .02, 4]], tri('#9CC3DD'), { out: [0, 1, 0] }); I.face3([[C.x + C.w + .02, C.y + 1.5, .8], [C.x + C.w + .02, C.y + C.d - 1.5, .8], [C.x + C.w + .02, C.y + C.d - 1.5, 4], [C.x + C.w + .02, C.y + 1.5, 4]], tri('#9CC3DD'), { out: [1, 0, 0] }); awning(I, 0, 1); },
    roof: (I, dz, a) => { I.push(0, 0, dz, 0); I.prismNow([[C.x - .2, C.y - .2], [C.x + C.w + .2, C.y - .2], [C.x + C.w + .2, C.y + C.d + .2], [C.x - .2, C.y + C.d + .2]], C.h, .5, tri('#B3352B')); I.pop(); if (dz > 0) { I.push(0, dz * .7, 0, 0); awning(I, 0, a); I.pop(); } },
    interior: (I) => {
      I.box(C.x + 1.2, C.y + 3, 0, 11.4, 2.4, 2.2, tri('#9A6B45', .2, .22));                       // counter
      I.box(C.x + 1.2, C.y + 3, 2.2, 11.4, 2.4, .12, tri('#C9A574'));
      // grinder
      I.box(C.x + 2.8, C.y + 3.3, 2.32, 1.0, 1.0, 1.1, tri('#3A3432'));
      I.coneNow ? I.add(C.x + C.y + 10, () => { I.coneNow(C.x + 3.3, C.y + 3.8, 4.9, .7, -1.5, tri('#D8D2C4'), { n: 16 }); if (t > TL.HOPPER && t < TL.GRIND + 1.2) I.poly([[-.55, -.1], [.55, -.1], [.3, .3], [-.3, .3]].map(q => { const s = I.P(C.x + 3.3, C.y + 3.8, 4.7); return [s[0] + q[0] * I.cam.k, s[1] + q[1] * I.cam.k]; }), hex(mix('#6A3B22', '#3A2016', .3))); }, 1) : 0;
      if (t > TL.HOPPER - .1 && t < TL.HOPPER + .5) stream(I, [C.x + 3.3, C.y + 3.8, 7.5], [C.x + 3.3, C.y + 3.8, 4.8], t, '#6A3B22');
      machine(I, t);
      // cup (small, world scale) — hidden when the hero close-up takes over
      if (heroAlpha(t) < 1) { const c = cupPos(t); I.bill(c.x, c.y, c.z, (g) => { g.globalAlpha *= 1 - heroAlpha(t); H.cup(g, t, { fill: seg(t, TL.DROP + .05, TL.SLIDE - .2), steam: t > TL.SLIDE }); }, { r: 1, bias: 3 }); }
      // stool + table by the window
      I.box(C.x + 10.6, C.y + 8.2, 0, 2.2, 1.6, 1.8, tri('#C9A574'));
    },
  });
}
function machine(I, t) {
  const x = C.x + 5.8, y = C.y + 3.1, z = 2.32, w = 3.0, d = 1.3, h = 1.9, o = ss(seg(t, TL.MACHINE, TL.MACHINE + .35));
  const T = tri('#B9B6AE', .25, .28);
  I.add(x + w / 2 + y + d / 2 + z + h, () => {
    if (o < 1) { const pa = I.alpha; I.alpha = 1; I.boxNow(x, y, z, w, d, h, T); I.alpha = pa; }
    if (o > 0) {   // side panel off: boiler + pipes + element glow
      I.face3([[x + w + .01, y, z], [x + w + .01, y + d, z], [x + w + .01, y + d, z + h], [x + w + .01, y, z + h]], T, { color: '#3A3432', out: [1, 0, 0] });
      const g = I.g; g.save(); g.globalAlpha = o;
      I.cylNow(x + w - .9, y + .65, z + .35, .45, 1.1, tri('#C0704A'), { axis: 'z', n: 16 });
      const glow = .5 + .5 * Math.sin(t * 9); const e = I.L(x + w - .9, y + .65, z + .5); g.beginPath(); g.ellipse(e[0], e[1], .3 * I.cam.k, .15 * I.cam.k, 0, 0, TAU); g.fillStyle = I.col('#F09A3E', .5 + .4 * glow); g.fill();
      I.line3([[x + w - .9, y + .65, z + 1.45], [x + w - .9, y + .65, z + 1.7], [x + 1.5, y + .65, z + 1.7], [x + 1.5, y + d + .2, z + 1.2]], '#8A8580', Math.max(2, I.cam.k * .08), { now: true });
      g.restore();
      I.face3([[x, y + d + .01, z], [x + w, y + d + .01, z], [x + w, y + d + .01, z + h], [x, y + d + .01, z + h]], T, { out: [0, 1, 0] });
    }
    I.boxNow(x - .05, y - .05, z + h, w + .1, d + .1, .1, tri('#3A3432'));
    for (let i = 0; i < 3; i++) I.cylNow(x + .5 + i * .8, y + .6, z + h + .1, .22, .3, tri('#F4ECDC'), { axis: 'z', n: 12 });
    I.face3([[x + .2, y + d + .01, z + .9], [x + w - .2, y + d + .01, z + .9], [x + w - .2, y + d + .01, z + h - .25], [x + .2, y + d + .01, z + h - .25]], tri('#3A3432'), { out: [0, 1, 0] });
    I.boxNow(x + .6, y + d, z, w - 1.2, .55, .12, tri('#6E6A62'));
    // group head + spout over the cup
    I.boxNow(x + 1.2, y + d, z + 1.0, .5, .4, .35, tri('#8A8580'));
    I.boxNow(x + 1.33, y + d + .4, z + .9, .24, .18, .12, tri('#6E6A62')); I.boxNow(x + 1.39, y + d + .55, z + .92, .12, 1.0, .1, tri('#2E2A28'));   // portafilter + handle
    // the drop: forms in the silence, falls on DROP, then a thin stream
    const sp = I.L(CUPP.x, CUPP.y - .1, z + .95), cz = I.L(CUPP.x, CUPP.y - .1, z + .4); const g = I.g, k = I.cam.k;
    if (t > TL.SIL2 && t < TL.DROP) { const s = seg(t, TL.SIL2, TL.DROP); g.beginPath(); g.ellipse(sp[0], sp[1] + s * .05 * k, .04 * k * (.5 + s), .05 * k * (.5 + s * 1.2), 0, 0, TAU); g.fillStyle = I.col('#3A2016'); g.fill(); }
    if (t >= TL.DROP && t < TL.DROP + .12) { const s = seg(t, TL.DROP, TL.DROP + .12); g.beginPath(); g.ellipse(sp[0], lerp(sp[1], cz[1], s * s), .05 * k, .07 * k, 0, 0, TAU); g.fillStyle = I.col('#3A2016'); g.fill(); }
    if (t >= TL.DROP + .1 && t < TL.SLIDE - .25) { g.save(); g.strokeStyle = I.col('#4A2A1A'); g.lineWidth = Math.max(1.5, .035 * k * (1 - .5 * seg(t, TL.SLIDE - .8, TL.SLIDE - .25))); g.beginPath(); g.moveTo(sp[0], sp[1]); g.lineTo(cz[0], cz[1]); g.stroke(); g.restore(); }
  }, 1);
}

// ---------- the dive: bean field (screen-space pile anchored on our bean) ----------
function beanField(g, iso, t, anchor, clip) {
  const k = iso.cam.k, u = .045 * k; if (u < 3) return;
  const [ax, ay] = iso.P(anchor.x, anchor.y, anchor.z);
  g.save();
  if (clip && k < 2600) { g.beginPath(); clip.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip(); }
  const x0 = Math.floor((-ax) / u) - 2, x1 = Math.ceil((1920 - ax) / u) + 2, y0 = Math.floor((-ay) / (u * .66)) - 2, y1 = Math.ceil((1080 - ay) / (u * .66)) + 2;
  if ((x1 - x0) * (y1 - y0) > 9000) { g.fillStyle = iso.col('#A9B27C'); g.fillRect(0, 0, 1920, 1080); g.restore(); return; }
  g.fillStyle = iso.col('#6F7650'); g.fillRect(0, 0, 1920, 1080);
  let mine = null;
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const h1 = hash(i * 17.3 + j * 91.7), h2 = hash(i * 5.1 + j * 13.9 + 2), px = ax + (i + (j % 2) * .5 + (h1 - .5) * .3) * u, py = ay + (j + (h2 - .5) * .3) * u * .66;
    if (i === 0 && j === 0) { mine = [ax, ay]; continue; }
    const rot = (h1 - .5) * 2.4, c = hex(mix('#A9B27C', h2 < .5 ? '#8E9A60' : '#C2C38E', Math.abs(h2 - .5) * 1.4));
    bean(g, iso, px, py, u, rot, c, false);
  }
  const rock = .09 * Math.sin(t * 1.7);
  const k0 = iso.keep; iso.keep = true; bean(g, iso, mine[0], mine[1], u * 1.04, -.35 + rock, '#AFBE6E', true); iso.keep = k0;
  g.restore();
  return [ax, ay, u];
}
function bean(g, iso, x, y, u, rot, c, ours) {
  const T = tri(c, .22, .26); g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.ellipse(u * .04, u * .06, u * .52, u * .36, 0, 0, TAU); g.fillStyle = iso.col('#4E5236', .5); g.fill();
  g.beginPath(); g.ellipse(0, 0, u * .5, u * .34, 0, 0, TAU); g.fillStyle = iso.col(T[1]); g.fill(); g.save(); g.clip();
  g.beginPath(); g.ellipse(-u * .12, -u * .14, u * .44, u * .26, 0, 0, TAU); g.fillStyle = iso.col(T[0]); g.fill();
  g.beginPath(); g.ellipse(u * .3, u * .22, u * .4, u * .24, 0, 0, TAU); g.fillStyle = iso.col(T[2]); g.fill(); g.restore();
  g.beginPath(); g.moveTo(-u * .4, u * .02); g.bezierCurveTo(-u * .12, -u * .12, u * .12, u * .12, u * .4, -u * .02); g.strokeStyle = iso.col(T[2]); g.lineWidth = u * .06; g.lineCap = 'round'; g.stroke();
  g.restore();
}
function tearPoly(iso, sh, a) {
  const pts = []; for (let i = 0; i < 18; i++) { const q = i / 18 * TAU, j = .75 + .35 * hash(i * 7.1); pts.push(iso.P(...W.shipToWorld(sh, W.HOLD.u + W.SACK.a + Math.cos(q) * .36 * a * j, W.HOLD.v + .045, W.HOLD.z + W.SACK.c + Math.sin(q) * .22 * a * j))); }
  return pts;
}

// ---------- the hillside inset: a cherry, cut open ----------
function cherryCut(g, cx, cy, R, a) {
  const r = R * .5, sep = eo(seg(a, .15, .7)) * R * .34, red = PAL.red;
  g.save(); g.translate(cx, cy + R * .06);
  if (sep <= .5) { H.cherry(g, 0, 0, r); g.strokeStyle = '#6A4A2E'; g.lineWidth = R * .03; g.beginPath(); g.moveTo(0, -r * .95); g.quadraticCurveTo(R * .05, -r * 1.35, R * .18, -r * 1.55); g.stroke(); }
  else {
    g.save(); g.translate(-sep, 0);
    g.beginPath(); g.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fillStyle = red[1]; g.fill(); g.save(); g.clip(); g.beginPath(); g.arc(-r * .25, -r * .5, r * .82, 0, TAU); g.fillStyle = red[0]; g.fill(); g.restore();
    g.beginPath(); g.ellipse(0, 0, r * .22, r, 0, -Math.PI / 2, Math.PI / 2); g.fillStyle = '#F2D3A0'; g.fill();
    g.restore();
    g.save(); g.translate(sep, 0);
    g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fillStyle = red[2]; g.fill();
    const fw = r * lerp(.22, .92, eo(seg(a, .35, .8)));
    g.beginPath(); g.ellipse(0, 0, fw, r, 0, 0, TAU); g.fillStyle = red[1]; g.fill();
    g.beginPath(); g.ellipse(0, 0, fw * .9, r * .9, 0, 0, TAU); g.fillStyle = '#F4D9A6'; g.fill();
    const sa = seg(a, .55, .95);
    if (sa > 0) for (const s of [-1, 1]) {
      const bx = s * fw * .27, bw = fw * .3, bh = r * .62;
      g.beginPath(); g.ellipse(bx, 0, bw, bh, 0, 0, TAU); g.fillStyle = '#E9E3BF'; g.fill();
      g.beginPath(); g.ellipse(bx, 0, bw * .86, bh * .88, 0, 0, TAU); g.fillStyle = '#B9BE86'; g.fill();
      g.beginPath(); g.ellipse(bx - s * bw * .12, -bh * .1, bw * .6, bh * .7, 0, 0, TAU); g.fillStyle = '#CDD19B'; g.fill();
      g.beginPath(); g.moveTo(bx, -bh * .75); g.bezierCurveTo(bx + s * bw * .35, -bh * .25, bx - s * bw * .35, bh * .25, bx, bh * .75); g.strokeStyle = '#7F8552'; g.lineWidth = R * .022; g.lineCap = 'round'; g.stroke();
    }
    g.restore();
  }
  g.restore();
}

// ---------- subtitles: a map label pinned to the bottom of the frame ----------
function subtitle(g, text, a, fade) {
  if (a <= 0 || fade <= 0) return;
  g.save(); g.font = `500 42px ${FONT}`; const tw = g.measureText(text).width, pad = 28, icon = 46, w = tw + pad * 2 + icon, h = 76, x = 960 - w / 2, y = 1080 - 64 - h;
  g.globalAlpha = ss(fade); g.translate(0, (1 - ss(fade)) * 8);
  const bw = eo(seg(a, 0, .35));
  g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = 'rgba(251,244,230,.96)'; g.fill();
  g.save(); g.beginPath(); g.rect(x - 4, y - 4, (w + 8) * bw, h + 8); g.clip(); g.beginPath(); g.roundRect(x, y, w, h, 10); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.stroke(); g.restore();
  const ix = x + pad + 14, iy = y + h / 2 + 2, s = 13, P = (u, v, z) => [ix + (u - v) * C30 * s, iy + ((u + v) * .5 - z) * s];
  const f = (pts, c) => { g.beginPath(); pts.forEach((p, i) => { const q = P(...p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fillStyle = c; g.fill(); };
  f([[-.5, .5, -.5], [.5, .5, -.5], [.5, .5, .5], [-.5, .5, .5]], PAL.red[1]); f([[.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [.5, -.5, .5]], PAL.red[2]); f([[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]], PAL.red[0]);
  g.save(); g.beginPath(); g.rect(x + pad + icon - 6, y, (tw + 12) * ss(seg(a, .2, .75)), h); g.clip();
  g.fillStyle = PAL.ink; g.textBaseline = 'middle'; g.fillText(text, x + pad + icon, y + h / 2 + 2); g.restore();
  g.restore();
}

// ---------- title: extruded isometric words on a cream plate (screen space) ----------
function acc0(g) { g.save(); g.font = '700 100px Jost'; let a = 0; for (const wd of ['FROM', 'BEAN', 'TO', 'CUP']) a += (g.measureText(wd).width + 34) * .96; g.restore(); return a - 30; }
function titleCard(g, t) {
  const a = seg(t, TL.TITLE0 - .3, TL.TITLE0) * (1 - seg(t, TL.TITLE1, TL.TITLE1 + .35)); if (a <= 0) return;
  const I = new Iso(g); I.cam = { x: 0, y: 0, z: 0, k: 1 };
  const X0 = -545, Y0 = 485;                                         // plate origin (world px): text reads along −y (up-right)
  const lift = -(1 - ss(a)) * 40;
  g.save(); g.globalAlpha = ss(a);
  I.push(X0, Y0, lift, 0);
  I.prismNow([[-40, 40], [185, 40], [185, -acc0(g) - 40], [-40, -acc0(g) - 40]], -14, 14, tri('#FBF4E6', .1, .18));
  I.add(0, () => { const pts = [[-40, 40], [185, 40], [185, -acc0(g) - 40], [-40, -acc0(g) - 40]].map(q => I.L(q[0], q[1], .5)); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.stroke(); }, 0); I.flush();
  const words = ['FROM', 'BEAN', 'TO', 'CUP']; g.font = '700 100px Jost'; const offs = []; let acc = 0; for (const wd of words) { offs.push(acc); acc += (g.measureText(wd).width + 34) * .96; }
  words.forEach((wd, i) => { const tw = TL.TITLE_WORDS[i]; if (t < tw - .02) return; const e = back(seg(t, tw, tw + .22), 2.2); I.text3Now(wd, 95, -offs[i], 0, { size: 96, plane: 'xy', extrude: 22 * e, tri: [PAL.cream[0], PAL.red[1], PAL.red[2]], face: '#FBF4E6', weight: 700 }); });
  const sa = seg(t, 6.6, 7.0); if (sa > 0) { g.save(); g.globalAlpha *= sa; I.text3Now('the journey of one coffee bean', 150, 0, 0, { size: 34, plane: 'xy', extrude: 0, tri: [PAL.ink, PAL.ink, PAL.ink], face: PAL.ink, weight: 500 }); g.restore(); }
  I.pop(); g.restore();
}

// ---------- labels ----------
const LAB = {
  harvest: { at: () => [W.MTN.x + 1, W.MTN.y + 1, W.TER[5].z1 + .4], title: 'HARVEST', num: '1,600', unit: 'm', dir: -1, up: 120, len: 70 },
  dry: { at: () => [W.BEDS.x + 12, W.BEDS.y + 11, 1.6], title: 'DRY', num: '21', unit: 'days', dir: 1, up: 150 },
  truck: { at: () => [118, 40, 0], title: 'TRUCK', num: fmt(KM.farm), unit: 'km', dir: 1, up: 120 },
  sea: { at: () => { const s = W.shipAt(.36); return [s.x, s.y, W.ZW]; }, title: 'SEA · 18 DAYS', num: fmt(KM.sea), unit: 'km', dir: -1, up: 22, len: 90 },
  city: { at: () => [128, 217, 0], title: 'TRUCK', num: fmt(KM.city), unit: 'km', dir: -1, up: 120, len: 70 },
  roast: { at: () => [W.ROASTERY.x + 6, W.ROASTERY.y + 4, 11], title: 'ROAST', num: '220', unit: '°C', dir: -1, up: -150, len: 90 },
  cafe: { at: () => [C.x + 7, C.y + 5, 7.5], title: 'CUP', num: '70', unit: 'beans', dir: 1, up: 110 },
};
function label(iso, key, a, o = {}) { const L = LAB[key], p = L.at(); pin(iso, p[0], p[1], p[2], { ...L, a, ...o }); }
// cup silhouette mask for the 70-bean Isotype (7 × 12 grid, 70 cells on)
const CUPMASK = (() => { const rows = ['..........', '.#######..', '.########.', '.#######.#', '.#######.#', '..######.#', '..#######.', '...#####..', '...#####..', '....###...', '..#######.', '..........']; const out = []; rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') out.push([i, j]); })); return out.slice(0, 70); })();

// ---------- the scene ----------
export function render(g, t, Q) {
  const iso = new Iso(g);
  iso.cam = Q.has('k') ? { x: +Q.get('cx'), y: +Q.get('cy'), z: +(Q.get('cz') || 0), k: +Q.get('k') } : camAt(t);
  const k = iso.cam.k, sh = shipPose(t), desat = t >= TL.SIL0 && t < TL.HORN + .15 ? ss(seg(t, TL.SIL0, TL.SIL0 + .35)) * (1 - seg(t, TL.HORN, TL.HORN + .15)) : 0;
  background(g, iso);
  const deep = k > 2600;
  if (!deep) {
    W.drawBoard(iso); W.drawGround(iso, t);
    W.drawMountain(iso, t); W.drawTrees(iso); W.drawBeds(iso, t, { dry: t < TL.DRY0 ? 0 : seg(t, TL.DRY0, TL.DRY1), rake: t, rakeAmp: TL.RAKES.some(r => t > r - .1 && t < r + .3) ? 1 : 0 });
    W.farmhouse(iso, 66, 72.5);
    W.quayStuff(iso, t);
    // sacks by the beds, then on the truck, then into our container
    const sackH = seg(t, TL.SACK_POUR, TL.SACK);
    if (t < TL.TRUCK0) iso.box(W.BEDS.x + 18, W.BEDS.y + 12, 0, 1.0, 1.1, .75, tri('#C9A874', .2, .22));
    if (t < 15.9 && sackH > 0) iso.box(W.BEDS.x + 16.6, W.BEDS.y + 12.6, 0, 1.0, 1.1, .75 * sackH + (t >= TL.SACK && t < TL.SACK + .12 ? -.06 : 0), tri('#C9A874', .2, .22));
    for (const [t0, from] of [[TL.TRUCK0, [W.BEDS.x + 18.5, W.BEDS.y + 12.5]], [15.9, [W.BEDS.x + 17.1, W.BEDS.y + 13.1]]]) { const f = seg(t, t0, t0 + .3); if (f > 0 && f < 1) { const tp = TRUCK_A.at(0); iso.box(lerp(from[0], tp.x - 1.2, f), lerp(from[1], tp.y + .4, f), Math.sin(f * Math.PI) * 2.2 + f * 1, 1.0, 1.1, .7, tri('#C9A874', .2, .22)); } }
    const ta = truckA(t), nS = t < TL.TRUCK0 + .3 ? 0 : t < 16.2 ? 1 : t < TL.PORT0 ? 2 : t < 18.15 ? 1 : 0;
    W.drawTruck(iso, ta.x, ta.y, ta.rot, { sacks: nS, cab: '#B3352B' });
    for (const t0 of [TL.PORT0, 18.15]) { const f = seg(t, t0, t0 + .15); if (f > 0 && f < 1) iso.box(lerp(ta.x - 1.5, QBOX.x + 3, f), lerp(ta.y, QBOX.y + 2, f), Math.sin(f * Math.PI) * 1.6 + 1, 1.0, 1.1, .7, tri('#C9A874', .2, .22)); }
    // our container on the quay (doors open until DOOR)
    if (t < TL.LIFT) iso.box(QBOX.x, QBOX.y, 0, W.SHIP.cl, W.SHIP.cw, W.SHIP.ch, tri('#B3352B', .2, .24), { decal: (I) => { if (t < TL.DOOR) I.face3([[QBOX.x + 3.4, QBOX.y + W.SHIP.cw + .01, .1], [QBOX.x + 5.6, QBOX.y + W.SHIP.cw + .01, .1], [QBOX.x + 5.6, QBOX.y + W.SHIP.cw + .01, 2.1], [QBOX.x + 3.4, QBOX.y + W.SHIP.cw + .01, 2.1]], tri('#2A2622'), { out: [0, 1, 0] }); W.ribs(QBOX.x, QBOX.y, 0, W.SHIP.cl, W.SHIP.cw, W.SHIP.ch)(I); } });
    // ship
    const atDock = t < TL.DEPART, cr = craneState(t);
    const opening = () => { const Hh = W.HOLD, pts = []; for (const u of [Hh.u - .6, Hh.u + W.SHIP.cl + .6]) for (const v of [-W.SHIP.W / 2 + 1, W.SHIP.W / 2 - 1]) for (const dz of [W.SHIP.deck, W.SHIP.deck + 40]) pts.push(iso.P(...W.shipToWorld(SHIP_A, u, v, dz))); return W.hull2(pts); };
    W.drawShip(iso, {
      ...sh, n: W.DECK.length, drop: t < TL.DEPART ? (i) => dropState(i, t) : null,
      hatch: atDock ? seg(t, TL.LOAD0 + .05, TL.LOAD0 + .35) : undefined,
      holdBox: (I) => { if (t < TL.LOAD0) return; const Hh = W.HOLD; I.add(-5e3, () => { const cl = opening(); g.save(); g.beginPath(); cl.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip(); I.boxNow(Hh.u, Hh.v, Hh.z, W.SHIP.cl, W.SHIP.cw, W.SHIP.ch, tri('#B3352B', .2, .24)); g.restore(); }, 0); },
      cut: hullCut(t), holdDraw: (I) => W.holdContainers(I, { boxOpen: boxOpen(t) }),
      wake: t > TL.DEPART && t < 30.4 ? clamp((t - TL.DEPART) / 1.5) * (t > TL.FF0 && t < TL.DIVE0 ? 1.8 : 1) : 0,
    });
    if (cr.ours && cr.zb < W.SHIP.deck + W.ZW) cr.clip = opening();
    W.crane(iso, cr.x, 8, { trolley: cr.trolley, hookZ: cr.zb + 1.0, box: cr.box, clip: cr.clip });
    W.crane(iso, 178, 8, { trolley: 12, hookZ: 16 });
    // lower land
    W.drawCity(iso, t); W.quayB(iso, t);
    const ub = seg(t, TL.UNLOAD, TL.UNLOAD + .55);
    const cbA = clamp((80 - k) / 40);
    W.crane(iso, 94, 214, { flip: true, alpha: cbA, trolley: lerp(-14, -4, ss(ub)), hookZ: t > TL.UNLOAD && t < TL.TRUCK_B ? 6 + Math.sin(ub * Math.PI) * 6 : 16 });
    W.crane(iso, 118, 214, { flip: true, trolley: -8, hookZ: 16, alpha: cbA });
    const tb = t < TL.TRUCK_B ? TRUCK_B.at(0) : truckB(t);
    W.drawTruck(iso, tb.x, tb.y, tb.rot, { cab: '#3C7FB1', box: t > TL.UNLOAD + .5 ? tri('#B3352B', .2, .24) : null });
    roastery(iso, t); cafe(iso, t);
    const bk = BIKE.at(eio(seg(t, TL.BIKE, TL.CAFE0))); if (t > 39.8 && t < TL.CAFE0 + 1) W.drawBike(iso, bk.x, bk.y, bk.rot);
    W.people(iso, peopleNow(t).map(p => ({ ...p, o: p.o })).filter(p => (p.alpha ?? 1) > .02));
    const rl = t >= TL.FULL0 ? 0 : routeLead(t);
    if (rl > 0 && k < 60) drawRoute(iso, 0, rl, { t, a: clamp((60 - k) / 25) });
    if (t >= TL.FULL0) drawRoute(iso, 0, seg(t, TL.FULL_STATIONS[0] - .3, TL.FULL_STATIONS[6]), { t: 0 });
    iso.desat = desat;
    iso.flush();
    iso.desat = 0;
  }
  // hero close-ups (palm + cherry / palm + cup)
  const ha = heroAlpha(t); if (ha > 0) hero(g, iso, t, ha);
  // the bean field (through the tear, then filling the frame)
  let bf = null;
  if (tearA(t) > 0 && k > 150) { iso.desat = desat; bf = beanField(g, iso, t, V(sackFace(sh)), tearPoly(iso, sh, tearA(t))); iso.desat = 0; }
  if (!deep) clouds(g, iso, t);
  overlays(g, iso, t, sh, bf, Q);
  const sub = SUBS.find(s => t >= s.t0 && t < s.t1 + .3);
  if (sub && !Q.has('nosub')) subtitle(g, sub.text, seg(t, sub.t0, sub.t0 + .6), 1 - seg(t, sub.t1, sub.t1 + .3));
}

function hero(g, iso, t, ha) {
  const opening = t < 10, A = opening ? A0 : A1(t);
  const [sx, sy] = iso.P(A.x, A.y, A.z), k = iso.cam.k;
  g.save(); g.globalAlpha = ha * ha; g.fillStyle = opening ? '#7AA65D' : '#C9A574'; g.fillRect(0, 0, 1920, 1080);
  if (!opening) { g.fillStyle = '#B8935F'; g.fillRect(0, sy + .55 * k, 1920, 1080); }
  g.globalAlpha = ha; g.translate(sx, sy); g.scale(k, k);
  if (opening) {
    // branch above, the picked cherry falls into the palm on LAND (squash + two small bounces)
    g.save(); g.translate(0, -.1); H.branch(g, { sway: Math.sin(t * 1.3) + (t > TL.SNAP && t < TL.SNAP + .4 ? Math.sin((t - TL.SNAP) * 30) * 3 * (1 - (t - TL.SNAP) / .4) : 0), picked: [0.02, -0.55], attached: t < TL.SNAP }); g.restore();
    const cy = t < TL.SNAP ? -0.65 + Math.sin(t * 2) * .004 : t < TL.LAND ? lerp(-0.65, -0.02, Math.pow(seg(t, TL.SNAP, TL.LAND), 2)) : -0.02 - Math.abs(Math.sin(seg(t, TL.LAND, TL.LAND + .5) * Math.PI * 2)) * .05 * (1 - seg(t, TL.LAND, TL.LAND + .5));
    const sq = t >= TL.LAND && t < TL.LAND + .1 ? 1 - Math.sin(seg(t, TL.LAND, TL.LAND + .1) * Math.PI) * .18 : 1;
    const rot = t < TL.SNAP ? (t > .6 ? Math.sin(seg(t, 1.2, TL.SNAP) * Math.PI) * .35 : 0) : (t - TL.SNAP) * 1.4 * (t < TL.LAND ? 1 : 0) + (t >= TL.LAND ? 1.26 : 0);
    const close = ss(seg(t, 3.0, 3.6)) * .5;
    H.palm(g, { skin: '#9C6644', sleeve: PAL.red[1], close, inside: (gg) => { gg.save(); gg.translate(0.02, cy); gg.scale(1 / sq, sq); H.cherry(gg, 0, 0, .12, null, c => c, rot * .3); gg.restore(); } });
    // picking fingers: reach in, pinch, twist, snap, withdraw
    const pin_ = seg(t, .4, .9), out = seg(t, TL.SNAP + .1, TL.SNAP + .7);
    if (pin_ > 0 && out < 1) { g.save(); g.translate(0.03 + (1 - eo(pin_)) * .9 + eo(out) * 1.1, -0.72 - (1 - eo(pin_)) * .6 - eo(out) * .7); H.pinch(g, { skin: '#9C6644', twist: t < TL.SNAP ? Math.sin(seg(t, 1.2, TL.SNAP) * Math.PI) : 0 }); g.restore(); }
  } else {
    H.palm(g, { skin: '#E8B894', sleeve: '#3C7FB1', close: .5, inside: (gg) => H.cup(gg, t, { fill: 1 }) });
  }
  g.restore();
  // the km tag: identical pixel geometry both times
  const tagA = opening ? seg(t, TL.ZERO_LAB, TL.ZERO_LAB + .6) * clamp((k - 250) / 150) : seg(t, TL.HAND, TL.HAND + .6) * clamp((k - 250) / 150);
  H.kmTag(g, sx + .02 * k + 40, sy - .1 * k, opening ? '0 km' : fmt(KM.total) + ' km', tagA);
}

function overlays(g, iso, t, sh, bf, Q) {
  titleCard(g, t);
  if (t >= TL.HARV_LAB && t < 11.4) label(iso, 'harvest', seg(t, TL.HARV_LAB, TL.HARV_LAB + .6), { fade: 1 - seg(t, 10.8, 11.3) });
  if (t >= TL.INSET0 && t < TL.INSET1 + .5) {
    const P = picker(0), [ax, ay] = iso.P(P.x - .8, P.y + .3, P.z + 1.4); const a = seg(t, TL.INSET0, TL.INSET0 + .6) * (1 - seg(t, TL.INSET1, TL.INSET1 + .4));
    inset(iso, ax, ay, 1430, 330, 250, a, (g2, cx, cy, R) => { g2.fillStyle = '#F7EEDC'; g2.fillRect(cx - R, cy - R, 2 * R, 2 * R); const ca = seg(t, TL.CUT, TL.CUT + .7); cherryCut(g2, cx, cy - 10, R, ca); if (ca < .2) cutLine(g2, [[cx - R * .1, cy - R * .8], [cx - R * .02, cy + R * .8]], seg(t, TL.KNIFE, TL.CUT)); });
    const la = seg(t, TL.CUT + .5, TL.CUT + 1.0) * (1 - seg(t, TL.INSET1, TL.INSET1 + .3));
    if (la > 0) { g.save(); g.globalAlpha = la; haloText(g, '1 CHERRY', 1240, 630, { font: `600 26px ${FONT}`, track: 3.5 }); haloText(g, '=', 1412, 632, { font: `400 40px ${FONT}` }); ICON.bean(g, 1470, 620, 46, '#B9BE86', 1, -.3); ICON.bean(g, 1522, 620, 46, '#B9BE86', 1, .3); haloText(g, 'SEEDS', 1558, 630, { font: `600 26px ${FONT}`, track: 3.5 }); g.restore(); }
  }
  // drying: 21 suns fill on sixteenths
  if (t >= TL.DRY0 && t < 15.9) label(iso, 'dry', seg(t, TL.DRY0, TL.DRY0 + .5), { fade: 1 - seg(t, 15.3, 15.8), up: 190, icons: (g2, x, y, dir) => iconGrid(g2, x, y, 21, TL.SUNS.filter(s => s <= t).length, 7, 36, (gg, px, py, s, on) => ICON.sun(gg, px, py, s, on), dir) });
  if (t >= TL.SACK && t < 17.4) { const tp = [W.BEDS.x + 17, W.BEDS.y + 13, 1]; pin(iso, tp[0], tp[1], tp[2], { title: '1 SACK · 60 KG', num: '400,000', unit: 'beans', dir: 1, up: 120, len: 50, a: seg(t, TL.SACK, TL.SACK + .5), fade: 1 - seg(t, 16.6, 17.2) }); }
  if (t >= TL.TRUCK_GO && t < TL.PORT0) { const tp = truckA(t); pin(iso, tp.x, tp.y, 3, { title: 'TRUCK', num: fmt(KM.farm * seg(t, TL.TRUCK_GO, TL.PORT0 - .1)), unit: 'km', dir: 1, up: 110, len: 50, a: seg(t, TL.TRUCK_GO, TL.TRUCK_GO + .4), fade: 1 - seg(t, 17.6, 18.0) }); }
  if (t >= TL.SHIP_LAB && t < 22.8) label2(iso, t, [168, 25, 10.5], { title: 'SHIP', num: '14,000', unit: 'containers', dir: -1, up: 90, len: 60, a: seg(t, TL.SHIP_LAB, TL.SHIP_LAB + .6), fade: 1 - seg(t, 22.2, 22.7), icons: (g2, x, y, dir) => iconGrid(g2, x, y, 14, 14 * seg(t, TL.SHIP_LAB + .3, 21.0), 7, 34, (gg, px, py, s, on, i) => ICON.box(gg, px, py, s, W.containerTri(i), on), dir) });
  // our container: hidden-line box + ring while it rides in the hold
  if (t >= TL.LOAD0 && t < TL.HULL + .2) tracker(g, iso, t, sh, 1 - seg(t, TL.DIVE0, TL.HULL + .2));
  // sea: 18 days, km counter
  if (t >= TL.FF0 && t < 28.2) { const s = W.shipAt(shipU(t)); pin(iso, s.x, s.y, 12, { title: 'SEA', num: fmt(KM.sea * seg(t, TL.FF0, TL.DAYS[17])), unit: 'km', dir: 1, up: 150, len: 60, a: seg(t, TL.FF0, TL.FF0 + .4), fade: 1 - seg(t, TL.DIVE0, 28.1), icons: (g2, x, y, dir) => iconGrid(g2, x, y, 18, TL.DAYS.filter(d => d <= t).length, 9, 34, (gg, px, py, sz, on, i) => (i % 2 ? ICON.moon : ICON.sun)(gg, px, py, sz, on), dir) }); }
  // dive knife lines + tracking rings
  if (t >= TL.DIVE0 && t < TL.HULL + .1) { const nv = [-1]; const L = W.SHIP.L, pts = [[-L / 2, -W.SHIP.W / 2, W.SHIP.deck - .6], [L / 2 - 7, -W.SHIP.W / 2, W.SHIP.deck - .6]].map(q => iso.P(...W.shipToWorld(sh, ...q))); cutLine(g, pts, seg(t, TL.DIVE0, TL.HULL)); }
  if (t >= 28.5 && t < TL.BOX_CUT + .05) { const Hh = W.HOLD, pts = [[Hh.u, Hh.v - .02, Hh.z + 2.1], [Hh.u + W.SHIP.cl, Hh.v - .02, Hh.z + 2.1], [Hh.u + W.SHIP.cl, Hh.v - .02, Hh.z], [Hh.u, Hh.v - .02, Hh.z], [Hh.u, Hh.v - .02, Hh.z + 2.1]].map(q => iso.P(...W.shipToWorld(sh, ...q))); cutLine(g, pts, seg(t, 28.5, TL.BOX_CUT)); }
  if (t >= TL.HULL && t < TL.SACK_CUT + .2) { const c = iso.P(...holdCentre(sh)); ring(g, c[0], c[1], Math.max(50, iso.cam.k * 3.6), seg(t, TL.HULL + .1, TL.HULL + .5) * (1 - seg(t, TL.BOX_CUT + .2, TL.BOX_CUT + .5)), t, 'OURS', { ang: -2.3 }); }
  if (t >= TL.BOX_CUT + .2 && t < TL.SIL0) { const c = iso.P(...sackFace(sh)); ring(g, c[0], c[1], Math.max(50, iso.cam.k * .62), seg(t, TL.BOX_CUT + .25, TL.BOX_CUT + .5) * (1 - seg(t, TL.SACK_CUT + .2, TL.SACK_CUT + .5)), t, 'OURS', { ang: -2.3 }); }
  if (bf && t >= TL.RING && t < TL.HORN + .1) { ring(g, bf[0], bf[1], bf[2] * .78, seg(t, TL.RING, TL.RING + .5) * (1 - seg(t, TL.HORN, TL.HORN + .1)), t, '1 of 400,000', { ang: -.75, ts: 30, lw: 3 }); }
  if (t >= TL.TRUCK_B && t < 36.4) label(iso, 'city', seg(t, TL.TRUCK_B, TL.TRUCK_B + .5), { num: fmt(KM.city * seg(t, TL.TRUCK_B, TL.ROAST0)), fade: 1 - seg(t, 35.9, 36.3) });
  if (t >= TL.POUR && t < 40.6) { const R = W.ROASTERY; const temp = lerp(20, 220, ss(seg(t, TL.POUR, TL.CRACK0))); pin(iso, R.x + 4.5, R.y + 6.5, 6.4, { title: 'ROAST · 12 MIN', num: fmt(temp), unit: '°C', dir: -1, up: 190, len: 70, a: seg(t, TL.POUR, TL.POUR + .5), fade: 1 - seg(t, 40.0, 40.5), icons: (g2, x, y, dir) => thermo(g2, x - 64, y + 4, temp / 220) }); }
  if (t >= TL.HOPPER && t < 44.1) pin(iso, C.x + 3.3, C.y + 3.8, 6.2, { title: '1 CUP ≈', num: '70', unit: 'beans', dir: -1, up: 120, len: 330, a: seg(t, TL.HOPPER, TL.HOPPER + .4), fade: 1 - seg(t, 43.6, 44.1), icons: (g2, x, y) => { const n = 70 * seg(t, TL.HOPPER + .1, TL.GRIND); CUPMASK.forEach(([i, j], q) => { if (q >= n) return; const pop = back(clamp(n - q), 2.2); g2.save(); g2.translate(x - 250 + i * 24, y + 10 + j * 19); g2.scale(pop, pop); ICON.bean(g2, 0, 0, 24, '#6A3B22', 1, -.4 + (q % 3) * .3); g2.restore(); }); } });
  if (t >= TL.FULL0) fullMap(g, iso, t, Q && Q.has('nocard'));
}
function label2(iso, t, p, o) { pin(iso, p[0], p[1], p[2], o); }
function thermo(g, x, y, f) { g.save(); g.fillStyle = PAL.paper; g.strokeStyle = PAL.ink; g.lineWidth = 2; g.beginPath(); g.roundRect(x - 9, y, 18, 110, 9); g.fill(); g.stroke(); g.beginPath(); g.arc(x, y + 118, 15, 0, TAU); g.fill(); g.stroke(); g.fillStyle = PAL.red[1]; g.beginPath(); g.arc(x, y + 118, 10, 0, TAU); g.fill(); const hh = 96 * clamp(f); g.fillRect(x - 4.5, y + 108 - hh, 9, hh + 4); g.restore(); }
function tracker(g, iso, t, sh, fade) {
  const Hh = W.HOLD, c = W.SHIP, cs = [];
  for (const du of [0, c.cl]) for (const dv of [0, c.cw]) for (const dz of [0, c.ch]) cs.push(iso.P(...W.shipToWorld(sh, Hh.u + du, Hh.v + dv, Hh.z + dz)));
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const a = seg(t, TL.LOAD0 + .3, TL.LOAD0 + .7) * fade;
  g.save(); g.globalAlpha = a; g.strokeStyle = PAL.ink; g.lineWidth = 2; g.setLineDash([7, 6]); g.beginPath(); for (const [i, j] of E) { g.moveTo(cs[i][0], cs[i][1]); g.lineTo(cs[j][0], cs[j][1]); } g.stroke(); g.setLineDash([]); g.restore();
  const cx = cs.reduce((q, p) => q + p[0], 0) / 8, cy = cs.reduce((q, p) => q + p[1], 0) / 8;
  ring(g, cx, cy, Math.max(40, iso.cam.k * 4.4), a, t, 'OURS', { ang: -2.4 });
}

// ---------- the finished infographic + end card ----------
function fullMap(g, iso, t, nocard) {
  const keys = ['harvest', 'dry', 'truck', 'sea', 'city', 'roast', 'cafe'];
  keys.forEach((key, i) => label(iso, key, seg(t, TL.FULL_STATIONS[i], TL.FULL_STATIONS[i] + .5)));
  const la = seg(t, TL.CARD, TL.CARD + .6); if (la <= 0 || nocard) return;
  g.save(); g.globalAlpha = la; const x = 1350, y = 630, w = 530, h = 410, sl = (1 - ss(la)) * 20;
  g.translate(0, sl);
  g.beginPath(); g.roundRect(x, y, w, h, 12); g.fillStyle = 'rgba(251,244,230,.97)'; g.fill(); g.strokeStyle = PAL.ink; g.lineWidth = 2; g.stroke();
  haloText(g, 'FROM BEAN TO CUP', x + 30, y + 64, { font: `700 44px ${FONT}`, track: 2, halo: false });
  haloText(g, 'Isometric Infographic', x + 30, y + 102, { font: `500 24px ${FONT}`, halo: false, color: '#8A5A3C' });
  g.fillStyle = PAL.ink; g.fillRect(x + 30, y + 124, w - 60, 1.5);
  haloText(g, 'TOTAL', x + 30, y + 166, { font: `600 20px ${FONT}`, track: 3.5, halo: false });
  haloText(g, fmt(KM.total), x + 30, y + 222, { font: `400 58px ${FONT}`, halo: false });
  haloText(g, 'km', x + 232, y + 222, { font: `500 28px ${FONT}`, halo: false, track: 2 });
  haloText(g, 'NOT TO SCALE', x + w - 30, y + 166, { font: `500 15px ${FONT}`, track: 3, align: 'right', halo: false, color: '#8A7A66' });
  // isotype bar: 11 cells × 1,000 km, coloured by leg (road 400 · sea 10,500 · road 100)
  const legs = [[0, KM.farm, '#D9A53A'], [KM.farm, KM.farm + KM.sea, '#3C7FB1'], [KM.farm + KM.sea, KM.total, '#D9A53A']];
  for (let i = 0; i < 11; i++) { const bx = x + 30 + i * 43, by = y + 240; for (const [a0, a1, c] of legs) { const s = Math.max(a0, i * 1000), e = Math.min(a1, (i + 1) * 1000); if (e > s) { g.fillStyle = c; g.fillRect(bx + (s - i * 1000) / 1000 * 38, by, (e - s) / 1000 * 38, 20); } } }
  const lx = x + 30, ly = y + 290; g.fillStyle = '#3C7FB1'; g.fillRect(lx, ly - 14, 20, 14); haloText(g, '= 1,000 km', lx + 28, ly, { font: `500 18px ${FONT}`, halo: false });
  g.fillStyle = '#D9A53A'; g.fillRect(lx + 150, ly - 14, 14, 14); haloText(g, 'road 500', lx + 172, ly, { font: `500 18px ${FONT}`, halo: false });
  g.fillStyle = '#3C7FB1'; g.fillRect(lx + 270, ly - 14, 14, 14); haloText(g, 'sea 10,500', lx + 292, ly, { font: `500 18px ${FONT}`, halo: false });
  g.fillStyle = PAL.ink; g.fillRect(x + 30, y + 312, w - 60, 1.5);
  haloText(g, 'Lemo-Opuscar  ·  LemoLab × Claude Opus 5.5', x + 30, y + 346, { font: `600 20px ${FONT}`, halo: false });
  haloText(g, 'Voice Kokoro (Apache-2.0)  ·  Font Jost (OFL)', x + 30, y + 370, { font: `400 15px ${FONT}`, halo: false, color: '#6E5E50' });
  haloText(g, 'Samples FreePats · VCSL · Karoryfer (CC0)  ·  score & sound original', x + 30, y + 390, { font: `400 15px ${FONT}`, halo: false, color: '#6E5E50' });
  g.restore();
}

// ---------- sound events (mix.py reads events.json) ----------
export function events() {
  const E = [], e = (t, type, o = {}) => E.push({ t: +t.toFixed(3), type, ...o });
  e(0, 'amb_hill'); e(TL.SNAP, 'snap'); e(TL.LAND, 'palm'); e(TL.ZERO_LAB, 'tag'); e(TL.BASKET, 'basket');
  TL.TITLE_WORDS.forEach(t => e(t, 'title_word')); e(TL.HARV_LAB, 'pin'); e(TL.INSET0, 'inset_open'); e(TL.KNIFE, 'knife'); e(TL.CUT, 'cherry_cut'); e(TL.INSET1, 'inset_close');
  [10.8, 11.1, 11.4].forEach(t => e(t, 'step')); e(TL.DRY0, 'basket_pour'); e(TL.DRY0, 'pin');
  TL.RAKES.forEach(t => e(t, 'rake')); TL.SUNS.forEach((t, i) => e(t, 'sun', { i })); e(TL.SACK_POUR, 'sack_fill'); e(TL.SACK, 'sack_thump'); e(TL.SACK, 'pin');
  e(TL.TRUCK0 + .3, 'sack_load'); e(16.2, 'sack_load'); e(TL.TRUCK_GO, 'truck', { dur: 1.9 }); e(TL.JCUT_PORT, 'amb_port');
  e(TL.PORT0 + .15, 'sack_load'); e(18.3, 'sack_load'); e(TL.DOOR, 'door'); e(TL.LIFT, 'crane', { dur: 2.8 }); e(TL.LOAD0, 'box_hold'); e(TL.LOAD0 + .1, 'hatch');
  [...TL.DECK_CRANE, ...TL.DECK_EIGHTH].forEach(t => e(t, 'box_land')); [21.75, 21.9, 22.05, 22.2].forEach(t => e(t, 'box_land', { wave: 1 })); e(TL.SHIP_LAB, 'pin');
  e(TL.DEPART, 'ship_engine', { dur: 8 }); e(22.2, 'amb_sea'); e(TL.FF0, 'whoosh_ff'); TL.DAYS.forEach(t => e(t, 'day_tick'));
  e(TL.DIVE0, 'knife'); e(TL.HULL, 'slide_steel'); e(28.5, 'knife'); e(TL.BOX_CUT, 'slide_steel', { small: 1 }); e(29.2, 'knife'); e(TL.SACK_CUT, 'tear'); e(TL.SIL0, 'silence'); e(31.6, 'creak');
  e(TL.HORN, 'horn'); e(TL.HORN, 'amb_city'); e(TL.UNLOAD, 'crane', { dur: .8 }); e(TL.TRUCK_B, 'truck', { dur: .7 }); e(TL.TRUCK_B, 'pin');
  e(TL.ROAST0 - .6, 'drum', { dur: 4.2 }); e(TL.ROAST0, 'knife'); e(TL.WALL, 'slide_wall'); e(TL.POUR, 'beans_metal'); e(TL.POUR, 'pin'); TL.CRACKS.forEach(t => e(t, 'crack')); e(TL.COOL, 'cool_pour'); e(TL.BIKE, 'bike');
  e(TL.CAFE0 - .3, 'amb_cafe'); e(TL.CAFE0, 'knife'); e(TL.ROOF, 'slide_wall'); e(TL.HOPPER, 'beans_hopper'); e(TL.HOPPER, 'pin'); e(TL.GRIND, 'grinder', { dur: 1.2 }); e(TL.TAMP, 'tamp'); e(TL.LOCK, 'lock'); e(TL.MACHINE, 'panel'); e(TL.MACHINE + .2, 'pump', { dur: .6 });
  e(TL.SIL2, 'silence'); e(TL.DROP, 'drip'); e(TL.DROP + .12, 'pour', { dur: 1.2 }); e(TL.DROP, 'amb_morning'); e(TL.SLIDE, 'cup_slide'); e(TL.CLINK, 'clink'); e(TL.HAND, 'tag');
  TL.FULL_STATIONS.forEach((t, i) => e(t, 'station', { i })); e(TL.CARD, 'card');
  for (const s of SUBS) e(s.t0, 'voice', { id: s.id });
  return E.sort((a, b) => a.t - b.t);
}
