// SHOT 10 — the market, one locked-off take (Keaton rule: the whole chain happens in one frame, no cuts).
// lt = shot-local time (s). 144 BPM → one beat = 0.41667 s. The chain lands on beats (see timeline.js HIT.*).
import { sky, house, street, sidewalk, lampPost, crate, fruit, melon, cart, awning, contactShadow, rnd } from '../sets.js';
import { drawFigure, P0, runPose, runBob, walkPose, walkBob, mixPose } from '../engine/figure.js';
import { OTTO, COP, SELLER, drawLoaf } from '../chars.js';
import { pose, EXPR } from '../poses.js';
import { grey, form } from '../engine/ink.js';

export const B = 60 / 144;
const W = 1440, H = 1080;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const SL = .06;                                     // street slope (downhill to the right)
const gy = x => 900 + (x - 720) * SL;               // ground line where the figures run (front of the street)
const by = x => 668 + (x - 720) * SL;               // back sidewalk line (building bases)

// fixed layout
export const L = { plankX: 330, cartX: 560, cartW: 330, lampX: 1150, sellerX: 985 };
export function drawMarket(g, lt, o = {}) {
  sky(g, W, 700, 4);
  // background houses (they step down the hill)
  const houses = [
    { x: -60, w: 360, h: 470, v: .7, floors: 2, shop: { text: 'HABERDASHER', awning: 0 }, seed: 11, stone: false },
    { x: 300, w: 300, h: 520, v: .62, floors: 3, seed: 12, stone: true, door: { at: .5 } },
    { x: 600, w: 380, h: 480, v: .74, floors: 2, shop: { text: 'FRUIT & GREENGROCER', awning: 0 }, seed: 13 },
    { x: 980, w: 300, h: 540, v: .66, floors: 3, seed: 14, stone: true, door: { at: .3 } },
    { x: 1280, w: 260, h: 500, v: .72, floors: 2, seed: 15 },
  ];
  for (const hs of houses) house(g, { ...hs, base: by(hs.x), slope: SL });
  // aerial haze: the far side of the street is lighter and softer so the action reads in front of it
  g.fillStyle = 'rgba(244,240,232,.46)'; g.fillRect(0, 0, W, by(W) + 10);
  sidewalk(g, W, by(W / 2) + 30, 30, SL);
  street(g, W, by(W / 2) + 44, H, SL, 3, .58);
  // lamp post (the crate will land on its arm)
  const lamp = lampPost(g, L.lampX, gy(L.lampX) - 150, 610, -1, 130);
  // --- the chain ---
  const b = lt / B;
  // plank see-saw on a little crate
  const px = L.plankX, pyb = gy(px) - 40;
  crate(g, px - 30, pyb - 40, 60, 42, .55, 201);
  const hit = clamp((b - 4) / .25);                       // Otto's foot lands at beat 4
  const plankA = lerp(.22, -.2, hit);                      // left end up before, slammed down after
  g.save(); g.translate(px, pyb - 44); g.rotate(plankA);
  form(g, [[-120, -8], [120, -8], [120, 8], [-120, 8]], { v: .55, line: 2, seed: 211, shade: 3 });
  g.restore();
  // melon: rests on the plank's right end, launched at beat 5, lands on the awning at beat 7
  const mStart = [px + 104, pyb - 44 - Math.sin(plankA) * 104 - 26], mEnd = [L.cartX + 90, 470];
  let mx = mStart[0], my = mStart[1], mr = 0;
  if (b >= 4.25) { const u = clamp((b - 4.25) / 2.75); mx = lerp(mStart[0], mEnd[0], u); my = lerp(mStart[1], mEnd[1], u) - Math.sin(u * Math.PI) * 330; mr = u * 5; }
  // cart + awning (awning tips at beat 7)
  const tip = clamp((b - 7) / .5), sit = clamp((b - 11) / .3), flip = clamp((b - 12) / .4);
  const cartTilt = -.13 * flip * (1 - clamp((b - 14) / 2) * .6);
  // awning poles + canvas
  const ax = L.cartX - 10, aw = L.cartW + 20, ay = 440;
  for (const pxx of [ax + 10, ax + aw - 10]) g.fillStyle = grey(.3), g.fillRect(pxx - 5, ay, 10, gy(pxx) - 60 - ay);
  const tilt = lerp(0, 110, tip), sag = lerp(10, 40, tip);
  awning(g, ax, ay, aw, 70, 7, 221, tilt, sag);
  if (b < 8.5) drawSeller(g, b, sit, lt);
  const c = cart(g, L.cartX, gy(L.cartX + L.cartW / 2) - 2, L.cartW, { tilt: cartTilt });
  // oranges: 12 spill from the low (right) end of the awning, one per 16th from beat 8, and roll downhill
  for (let i = 0; i < 12; i++) {
    const t0 = 8 + i * .25; if (b < t0) continue;
    const u = (b - t0) * B;                                       // seconds since release
    const x0 = ax + aw + 10 - (i % 3) * 18, y0 = ay + 120 + tilt;
    const fall = Math.min(u, .32), yy = Math.min(gy(x0) - 14, y0 + 900 * fall * fall);
    const roll = Math.max(0, u - .32), xx = x0 + roll * (220 + (i % 4) * 40) + fall * 60;
    if (xx > W + 40) continue;
    fruit(g, xx, Math.min(gy(xx) - 14, yy + (xx - x0) * SL), 14, .55, 300 + i);
  }
  // the crate that flies to the lamp arm (beat 12) and teeters (13–15), then drops on the constable (15)
  const cr0 = [L.cartX + L.cartW * .55, c.top], cr1 = [lamp.ax + 40, lamp.armY - 60];
  let cx = cr0[0], cy = cr0[1], crot = 0, crVis = true;
  if (b >= 12) {
    const u = clamp((b - 12) / 1);
    cx = lerp(cr0[0], cr1[0], u); cy = lerp(cr0[1], cr1[1], u) - Math.sin(u * Math.PI) * 260; crot = u * 3.3;
    if (b >= 13 && b < 15) { crot = Math.sin((b - 13) * Math.PI * 2.2) * .22; cx = cr1[0] + Math.sin((b - 13) * Math.PI * 2.2) * 6; }
    if (b >= 15) { const d = clamp((b - 15) / .22); cy = lerp(cr1[1], gy(L.lampX) - 7.5 * 64 - 10, d * d); crot = 0; }
  }
  // characters
  // the loaf, rolling ahead of Otto
  if (b < 7.2) { const u = b / 7; const lx = lerp(-60, 1520, u); drawLoaf(g, lx, gy(lx) - 24, 112, 0, u * 40); contactShadow(g, lx, gy(lx) - 2, 56, 7, .28); }
  // constable walks in along the back sidewalk from beat 6, reaches the lamp at beat 13
  const copX = b < 3.5 ? 1560 : b < 13 ? lerp(1560, L.lampX + 30, (b - 3.5) / 9.5) : L.lampX + 30;
  if (copX < 1540) {
    const wp = b < 13 ? walkPose((b - 3.5) * .5) : P0();
    if (b >= 13.6) { wp.nod = -.45; wp.expr = EXPR.deadpan; }
    if (b >= 15.2) { const sp = (b - 15.2); wp.expr = EXPR.alarm; }
    const yawC = b >= 15.2 ? -90 + Math.sin((b - 15.2) * 9) * 60 : -90;
    drawFigure(g, COP, { x: copX, ground: gy(copX) - 8, scale: 64, yaw: yawC, pose: wp, t: lt });
    if (b >= 15) { /* crate on his head drawn after */ }
  }
  // seller: behind her cart until beat 8.5, then steps out to the right onto the rolling oranges
  if (b >= 8.5) drawSeller(g, b, sit, lt);
  // Otto runs through (enters 1.5, plank at 4, exits 8.5)
  const ob = b - 1.5;
  if (ob > 0 && ob < 7.5) {
    const ox = lerp(-80, 1560, ob / 7);
    const ph = ob * .5;                            // one stride per beat
    const rp = runPose(ph); rp.expr = EXPR.deadpan;
    drawFigure(g, OTTO, { x: ox, ground: gy(ox) + runBob(ph, 64) * .4, scale: 64, yaw: 90, pose: rp, t: lt });
  }
  // melon (in front of the awning)
  if (b < 7.05) melon(g, mx, my, 30, mr); else { melon(g, mEnd[0] + 30 * (b - 7), mEnd[1] + 10, 30, 5); }
  if (crVis) crate(g, cx - 40, cy - 30, 80, 60, .6, 231, crot);
}
function windmill(b) {
  const p = pose('alarm'); const a = (b - 9) * Math.PI * 2 * .9;
  p.aL.fl = 2 + Math.sin(a) * 1.2; p.aR.fl = 2 + Math.sin(a + Math.PI) * 1.2; p.lean = -.2 + Math.sin(a * .5) * .1;
  p.L.hip = .5 + Math.sin(a) * .3; p.L.knee = .3; return p;
}
function sitPose(k) {
  const p = pose('alarm'); p.L.hip = lerp(.2, 1.4, k); p.R.hip = lerp(0, 1.3, k); p.L.knee = lerp(.2, 1.3, k); p.R.knee = lerp(.1, 1.2, k); p.lean = lerp(0, -.2, k); return p;
}

function drawSeller(g, b, sit, lt) {
  const behind = b < 8.5;
  const sp = b < 7 ? P0() : b < 9 ? pose('alarm') : b < 11 ? windmill(b) : sitPose(sit);
  sp.expr = b < 7 ? EXPR.deadpan : EXPR.alarm;
  if (b < 7) { sp.aL = { fl: .9, abd: .2, el: 1.2, wr: 0, hand: 'relax' }; sp.aR = { fl: .7, abd: .2, el: 1.3, wr: 0, hand: 'relax' }; }
  const x0 = L.cartX + 250, x1 = L.cartX + L.cartW + 70, x2 = L.cartX + L.cartW + 150;
  const sx = behind ? x0 : b < 9 ? lerp(x0, x1, clamp((b - 8.5) / .5)) : lerp(x1, x2, clamp((b - 9) / 2));
  const lift = behind ? 44 : 6;
  drawFigure(g, SELLER, { x: sx, ground: gy(sx) - lift, scale: behind ? 56 : 58, yaw: -60, pose: sp, t: lt });
}
