// The Runaway Loaf — shots. Each shot paints a TONAL 4:3 frame (1440×1080, grey values = print density);
// film.js runs it through Redraw (ink + hatch) and FilmPost (print + ageing). lt = seconds since the section started.
import { sky, house, street, sidewalk, lampPost, crate, melon, cart, contactShadow, rnd } from './sets.js';
import { drawFigure, P0, runPose, runBob, walkPose, walkBob, mixPose, solve, projector, BODY } from './engine/figure.js';
import { form, stroke, grey, rectPts, ellipsePts, mottle, catmull } from './engine/ink.js';
import { OTTO, GIRL, COP, SELLER, drawLoaf, drawBoule, drawBouleHalf } from './chars.js';
import { pose, EXPR, loafInHands, halves, bouleInHands, bouleHalves } from './poses.js';
import { SEC } from './timeline.js';

const W = 1440, H = 1080;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const eo = x => 1 - Math.pow(1 - clamp(x), 3);
const seg = (x, a, b) => clamp((x - a) / (b - a));
const withExpr = (p, e) => { p.expr = e; return p; };
const GLAD = { open: .62, brow: .45, browA: -.7, smile: .75, look: [0, -.1] };
const HOPE = { open: 1.0, brow: .7, browA: -1.0, smile: .1, look: [0, -.2] };     // the girl: hungry, hopeful (inner brows up)


// ---------- continuity helpers: every change of pose, position or facing is eased between keyframes ----------
// keys: [[beat, value], ...] (value = pose object, or fn(b) → pose for cycles like walking). Between two keys the poses are blended.
export function poseAt(b, keys, ease = ss) {
  const val = (v) => typeof v === 'function' ? v(b) : v;
  if (b <= keys[0][0]) return clonePose(val(keys[0][1]));
  for (let i = 1; i < keys.length; i++) if (b < keys[i][0]) {
    const [b0, A] = keys[i - 1], [b1, Bv] = keys[i];
    return mixPose(val(A), val(Bv), ease((b - b0) / (b1 - b0)));
  }
  return clonePose(val(keys[keys.length - 1][1]));
}
export function numAt(b, keys, ease = ss) {
  if (b <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (b < keys[i][0]) { const [b0, a] = keys[i - 1], [b1, c] = keys[i]; return lerp(a, c, ease((b - b0) / (b1 - b0))); }
  return keys[keys.length - 1][1];
}
const clonePose = p => mixPose(p, p, 0);
const lin = x => clamp(x);
// where a figure's two palms meet (for handing a prop over without a jump): same placement as drawFigure
export function palmsAt(ch, opt) {
  const B = BODY[ch.body || 'adult'], J = solve(opt.pose, B), s = opt.scale;
  const low = Math.min(J.legs.L.sole[1], J.legs.R.sole[1], J.legs.L.toe[1], J.legs.R.toe[1], J.legs.L.heel[1], J.legs.R.heel[1]);
  const pr = projector(opt.x, opt.ground + low * s, s, opt.yaw);
  const hc = side => { const a = pr.P(J.arms[side].wr), c = pr.P(J.arms[side].hand); return [(a[0] + c[0] * 2) / 3, (a[1] + c[1] * 2) / 3]; };
  const l = hc('L'), r = hc('R'); return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2 - s * .04, pr.P(J.arms.L.hand), pr.P(J.arms.R.hand), pr.P(J.head), l, r];
}

// ============ 1 · THE BAKERY (locked full shot) ============
const BK = { gy: x => 960 + Math.max(0, x - 1090) * .36, door: [150, 330], win: [640, 1000], sillY: 704 };
function bakerySet(g) {
  sky(g, W, 760, 2);
  // the town drops away downhill on the right
  for (const [x, w, h, v, s] of [[1110, 250, 360, .8, 31], [1330, 260, 420, .76, 32]])
    house(g, { x, w, h, v, floors: 2, base: BK.gy(x) + 30, slope: .36, seed: s, chimney: true });
  g.fillStyle = 'rgba(245,242,236,.5)'; g.fillRect(1090, 0, 360, H);
  // the bakery front
  form(g, rectPts(30, -20, 1060, 985), { v: .8, line: 2.6, grad: .1, seed: 1 }); mottle(g, 30, 0, 1060, 965, .12, 3);
  // stone base course
  form(g, rectPts(30, 900, 1060, 62), { v: .64, line: 2, seed: 2 });
  for (let x = 30; x < 1090; x += 88) stroke(g, [[x, 900], [x, 962]], 1.2, { seed: 5 + x, alpha: .6 });
  // sign band
  form(g, rectPts(60, 14, 1000, 100), { v: .2, line: 2.6, grad: .18, seed: 4, shade: 6 });
  form(g, rectPts(74, 26, 972, 76), { v: .26, line: 1.4, seed: 6 });
  g.save(); g.font = '700 82px "Playfair Display SC"'; g.fillStyle = grey(.9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '22px'; g.fillText('BAKERY', 568, 66); g.restore();
  // door (open, dark interior) with a transom
  const [d0, d1] = BK.door;
  form(g, rectPts(d0 - 22, 520, d1 - d0 + 44, 445), { v: .6, line: 2.4, seed: 7, shade: 8 });
  form(g, rectPts(d0, 560, d1 - d0, 400), { v: .1, line: 2, grad: .2, seed: 8 });
  form(g, rectPts(d0, 530, d1 - d0, 26), { v: .3, line: 1.6, seed: 9 });
  // an open door leaf, swung inward
  form(g, [[d0, 560], [d0 + 46, 580], [d0 + 46, 950], [d0, 960]], { v: .42, line: 2, seed: 10, shade: 4 });
  // shop window with loaves on display
  const [w0, w1] = BK.win;
  form(g, rectPts(w0 - 26, 400, w1 - w0 + 52, 320), { v: .6, line: 2.4, seed: 11, shade: 6 });
  form(g, rectPts(w0, 424, w1 - w0, 276), { v: .16, line: 2, grad: .22, seed: 12 });
  form(g, rectPts(w0 + 10, 612, w1 - w0 - 20, 16), { v: .55, line: 1.4, seed: 13 });
  for (let i = 0; i < 4; i++) drawLoaf(g, w0 + 70 + i * 82, 586, 80, -.08 + i * .05, 1, { v: .62 });
  for (let i = 0; i < 3; i++) drawLoaf(g, w0 + 110 + i * 90, 516, 72, .06, 1, { v: .58 });
  g.fillStyle = grey(.7, .35); g.beginPath(); g.moveTo(w0 + 8, 430); g.lineTo(w0 + 150, 430); g.lineTo(w0 + 8, 560); g.fill();   // glass glint
  stroke(g, [[(w0 + w1) / 2, 424], [(w0 + w1) / 2, 700]], 3, { color: grey(.6), seed: 14 });
  // the stone sill (the loaf will cool here)
  form(g, [[w0 - 44, BK.sillY], [w1 + 44, BK.sillY], [w1 + 50, BK.sillY + 30], [w0 - 50, BK.sillY + 30]], { v: .88, line: 2.4, seed: 15 });
  g.fillStyle = 'rgba(20,16,12,.25)'; g.fillRect(w0 - 50, BK.sillY + 30, w1 - w0 + 100, 14);
  // hanging sign on a bracket at the corner: a loaf silhouette
  stroke(g, [[1090, 300], [1200, 300]], 5, { seed: 16 }); stroke(g, catmull([[1090, 360], [1140, 320], [1200, 302]], false, 6), 3, { seed: 17 });
  stroke(g, [[1130, 300], [1130, 330]], 2, { seed: 18 }); stroke(g, [[1190, 300], [1190, 330]], 2, { seed: 19 });
  form(g, rectPts(1110, 330, 100, 70), { v: .88, line: 2, seed: 20 }); drawBoule(g, 1160, 366, 26, .3, { v: .35 });
  // pavement + the street going downhill
  form(g, [[0, 960], [1090, 960], [W, BK.gy(W)], [W, H], [0, H]], { v: .62, line: 0, seed: 21 });
  street(g, W, 1000, 1060, 0, 7, .6);
  form(g, [[0, 960], [1090, 960], [W, BK.gy(W)], [W, BK.gy(W) + 16], [1090, 976], [0, 976]], { v: .78, line: 2, seed: 22 });
}
export function bakery(g, lt) {
  const B = SEC.BAKERY.beat, b = lt / B, s = 88, R = s * .6;
  bakerySet(g);
  // ---- Otto's keyframes ----
  const carry = pose('carry'), crouch = pose('crouch'), lift = pose('lift');
  const liftUp = mixPose(lift, lift, 0); liftUp.lean = -.16; liftUp.nod = -.34;          // the overshoot at the top of the lift
  const breathe = bb => { const p = clonePose(lift); p.nod = -.28 + Math.sin((bb - 1.6) * Math.PI * 1.5) * .035; p.lean = -.1 + Math.sin((bb - 1.6) * Math.PI) * .02; return p; };
  const carryWalk = bb => { const w = walkPose((bb - 4.2) * .9, .75), p = clonePose(carry); p.L = w.L; p.R = w.R; p.lean = .05; return p; };
  const place = mixPose(carry, carry, 0); Object.assign(place, { lean: .22, nod: .3 });
  place.aL = { fl: .95, abd: .05, el: .35, wr: .2, hand: 'grip' }; place.aR = { ...place.aL };
  const admire = P0(); admire.nod = .22; admire.aL = { fl: .15, abd: .05, el: .4, wr: 0, hand: 'relax' }; admire.aR = { fl: .1, abd: .05, el: .35, wr: 0, hand: 'relax' };
  const pat = bb => { const p = clonePose(admire); const k = Math.abs(Math.sin((bb - 5.9) * Math.PI * 2)); p.aL = { fl: .95 + .12 * k, abd: .05, el: .3, wr: .25, hand: 'open' }; p.lean = .12; return p; };
  const walkAway = bb => { const p = walkPose((bb - 6.7) * .9, .9); p.nod = -.08; return p; };
  const stop = P0(); stop.nod = -.05;
  const look = P0(); look.headTurn = .6; look.nod = 0;
  const take = pose('alarm');
  const P = poseAt(b, [[0, carry], [.75, crouch], [1.0, crouch], [1.3, liftUp], [1.6, breathe], [3.9, breathe], [4.25, carryWalk], [4.9, carryWalk],
    [5.15, place], [5.45, place], [5.8, admire], [5.9, pat], [6.35, pat], [6.5, admire], [6.75, walkAway], [8.6, walkAway], [8.78, stop], [8.9, look], [8.97, look], [9.05, take]]);
  const x = numAt(b, [[4.2, 560], [5.1, 692], [6.65, 692], [8.7, 360]], lin);
  const yaw = numAt(b, [[0, 15], [4.2, 15], [4.6, 72], [6.5, 72], [6.78, -90], [8.97, -90], [9.05, 35]]);
  const hop = b >= 8.97 ? Math.sin(seg(b, 8.97, 9.35) * Math.PI) * 34 : 0;
  P.expr = b < 1 ? EXPR.deadpan : b < 8.97 ? EXPR.proud : EXPR.alarm;
  const fig = { x, ground: 962 - hop, scale: s, yaw, pose: P, t: lt };
  // ---- the loaf: in his hands until beat 5.45, then its own (rolling) life ----
  const held = b < 5.45;
  const rel = palmsAt(OTTO, { ...fig, pose: poseAt(5.45, [[0, place]]), x: 692, yaw: 72, ground: 962 });   // where it leaves his hands
  const restX = rel[0], restY = BK.sillY - R;
  let lx = restX, ly = restY, rot = 0, squash = 1;
  if (!held) {
    const k = seg(b, 5.45, 5.7); lx = restX; ly = lerp(rel[1], restY, k * k); if (b < 5.8) squash = 1 - .08 * Math.sin(seg(b, 5.62, 5.8) * Math.PI);
    if (b >= 6.9 && b < 7.7) { const w = Math.sin((b - 6.9) * Math.PI * 5) * (b - 6.9) * .6; rot = w * .25; lx = restX + w * 5; }            // wobble after the pat
    if (b >= 7.7) {                                                                                                 // rolls along the sill, off the end, down to the pavement, away downhill
      const x1 = BK.win[1] + 50, xl = BK.win[1] + 120, yl = BK.gy(xl) - R;
      if (b < 8.0) { const k2 = seg(b, 7.7, 8.0); lx = lerp(restX, x1, k2 * k2); ly = restY; }
      else if (b < 8.5) { const k2 = seg(b, 8.0, 8.5); lx = lerp(x1, xl, k2); ly = lerp(restY, yl, k2 * k2); }
      else { const u = b - 8.5; lx = xl + u * 420 + u * u * 380; const bounce = u < .35 ? Math.sin(u / .35 * Math.PI) * 55 : u < .55 ? Math.sin((u - .35) / .2 * Math.PI) * 14 : 0; ly = BK.gy(lx) - R - bounce; squash = u < .06 ? .82 : 1; }
      rot = (lx - restX) / R;                                                                                       // true rolling
    }
  }
  if (!held && b < 9 && lx < 1060) { contactShadow(g, lx, ly + R, R * .9, 7, .25); drawBoule(g, lx, ly, R, rot, { squash }); }
  contactShadow(g, x, 962, 90, 12, .3);
  drawFigure(g, OTTO, { ...fig, props: held ? { between: bouleInHands() } : null });
  if (!held && (b >= 9 || lx >= 1060)) { contactShadow(g, lx, BK.gy(lx), R * .9, 7, .25 * clamp(1 - (BK.gy(lx) - R - ly) / 80)); drawBoule(g, lx, ly, R, rot, { squash }); }
}

// ============ 2 · DOWNHILL (tracking shot, undercranked) ============
// the camera travels with them; the town scrolls at 0.8 (parallax), lamp posts in front at 1.35
export function chase(g, lt) {
  const B = SEC.CHASE.beat, b = lt / B, s = 80;
  const cam = lt * 520;                                          // px/s of travel
  const SL = .07, gy = x => 870 + (x - 720) * SL;
  sky(g, W, 700, 6);
  // back row of houses, stepping down the hill (world-anchored, parallax .8)
  const pc = cam * .8, hw = 330;
  for (let i = Math.floor(pc / hw) - 1; i < Math.floor(pc / hw) + 6; i++) {
    const x = i * hw - pc, v = .62 + rnd(i, 3) * .16, h = 420 + rnd(i, 5) * 150;
    house(g, { x, w: hw - 10, h, v, floors: 2 + (rnd(i, 7) > .5 ? 1 : 0), base: gy(x) - 210, slope: SL, seed: 40 + ((i % 9) + 9) % 9, stone: rnd(i, 9) > .6,
      shop: rnd(i, 11) > .7 ? { text: ['CHEMIST', 'TAILOR', 'NEWS', 'CAFÉ'][((i % 4) + 4) % 4], awning: 0 } : null, door: { at: .5 } });
  }
  g.fillStyle = 'rgba(244,240,232,.42)'; g.fillRect(0, 0, W, gy(W) - 180);
  sidewalk(g, W, gy(W / 2) - 170, 30, SL);
  // street (texture scrolls with the camera)
  g.save(); g.translate(-(cam % 120), 0); street(g, W + 240, gy(W / 2) - 150, H, SL, 9, .58); g.restore();
  // the loaf: ahead, bouncing over cobbles; hops over the reaching hand at beat 6, then pulls away
  let lx = 910 + Math.sin(b * 1.3) * 18, hop = Math.abs(Math.sin(b * Math.PI)) * 12;
  if (b >= 5.75 && b < 6.75) hop = Math.sin((b - 5.75) * Math.PI) * 210;          // pops up over his hand
  if (b >= 8.5) lx += (b - 8.5) * (b - 8.5) * 110;
  const lroll = lt * 16;
  // Otto: closes in until his hand is right at the loaf (beat 6), stumbles back a little, then chases it out of frame
  let ox = b < 6 ? lerp(240, 770, ss(b / 6)) : b < 8.5 ? lerp(770, 640, ss((b - 6) / 2.5)) : 640 + (b - 8.5) * (b - 8.5) * 95;
  const ph = b * 1.0, rp = runPose(ph); rp.expr = EXPR.deadpan;
  if (b >= 5.4 && b < 6.6) {                           // the swipe: bends right down, near hand sweeps the cobbles where the loaf was
    const k = Math.sin(seg(b, 5.4, 6.6) * Math.PI); rp.lean = .2 + .62 * k; rp.nod = .25 * k;
    rp.aL = { fl: lerp(rp.aL.fl, .45, k), abd: .1, el: lerp(1.4, .05, k), wr: 0, hand: b < 6.05 ? 'open' : 'fist' };
  }
  if (b >= 6.6 && b < 8.4) {                           // …straightens up and looks into his empty fist, still running
    const k = Math.sin(seg(b, 6.6, 8.4) * Math.PI); rp.aL = { fl: lerp(rp.aL.fl, 1.7, k), abd: .1, el: lerp(1.3, 1.9, k), wr: 0, hand: 'fist' }; rp.nod = lerp(-.08, .35, k); rp.lean = lerp(.2, .08, k);
  }
  const R = s * .55, rot = (cam + lx) / R;                   // it rolls: angle = distance travelled / radius
  contactShadow(g, lx, gy(lx) + 4, R * .9, 7, .28 * (1 - hop / 220));
  drawBoule(g, lx, gy(lx) - R - hop, R, rot);
  contactShadow(g, ox, gy(ox) + 4, 80, 10, .3);
  drawFigure(g, OTTO, { x: ox, ground: gy(ox) + runBob(ph, s) * .4, scale: s, yaw: 90, pose: rp, t: lt });
  // foreground lamp posts sweep past (parallax 1.35) — speed made visible
  const fc = cam * 1.35, sp = 900;
  for (let i = Math.floor(fc / sp); i < Math.floor(fc / sp) + 3; i++) { const x = i * sp - fc + 200; if (x > -60 && x < W + 60) lampPost(g, x, H + 40, 1000, 1, 90); }
}

// ============ 3 · THE MARKET (locked-off: the whole chain in one take) ============
const MK = { gy: x => 900 + (x - 720) * .06, by: x => 668 + (x - 720) * .06, plankX: 330, cartX: 560, cartW: 330, copX: 1010 };
function marketSet(g) {
  sky(g, W, 700, 4);
  const houses = [
    { x: -60, w: 360, h: 470, v: .7, floors: 2, shop: { text: 'HABERDASHER', awning: 0 }, seed: 11 },
    { x: 300, w: 300, h: 520, v: .62, floors: 3, seed: 12, stone: true, door: { at: .5 } },
    { x: 600, w: 380, h: 480, v: .74, floors: 2, shop: { text: 'GREENGROCER', awning: 0 }, seed: 13 },
    { x: 980, w: 300, h: 540, v: .66, floors: 3, seed: 14, stone: true, door: { at: .3 } },
    { x: 1280, w: 260, h: 500, v: .72, floors: 2, seed: 15 },
  ];
  for (const hs of houses) house(g, { ...hs, base: MK.by(hs.x), slope: .06 });
  g.fillStyle = 'rgba(244,240,232,.46)'; g.fillRect(0, 0, W, MK.by(W) + 10);
  sidewalk(g, W, MK.by(W / 2) + 30, 30, .06);
  street(g, W, MK.by(W / 2) + 44, H, .06, 3, .58);
}
export function market(g, lt) {
  const B = SEC.MARKET.beat, b = lt / B, s = 64, gy = MK.gy;
  marketSet(g);
  // see-saw plank on a little crate; Otto's foot slams it at beat 5
  const px = MK.plankX, pyb = gy(px) - 40, hit = seg(b, 4.95, 5.12);
  crate(g, px - 30, pyb - 40, 60, 42, .55, 201);
  const plankA = lerp(.22, -.24, hit);
  g.save(); g.translate(px, pyb - 44); g.rotate(plankA); form(g, [[-120, -8], [120, -8], [120, 8], [-120, 8]], { v: .55, line: 2, seed: 211, shade: 3 }); g.restore();
  // the melon: resting on the plank end → launched up and out of the top of frame → falls back onto the constable at beat 12
  const m0 = [px + 104, pyb - 44 - Math.sin(.22) * 104 - 26];
  const copY = gy(MK.copX) - 8;
  const headTop = copY - 8.15 * s;
  let mel = null;
  if (b < 5.05) mel = [m0[0], m0[1], 0];
  else if (b < 6.2) { const u = (b - 5.05) / 1.15; mel = [lerp(m0[0], 700, u), m0[1] - 1500 * u + 300 * u * u, u * 6]; }
  else if (b >= 11.3 && b < 12) { const u = (b - 11.3) / .7; mel = [MK.copX, lerp(-120, headTop - 26, u * u), 2]; }
  else if (b >= 12) { const sq = b < 12.3 ? Math.sin(seg(b, 12, 12.3) * Math.PI) * 10 : 0; mel = [MK.copX + 4, headTop - 26 + sq + (b >= 12 ? 10 : 0), .15]; }
  // the loaf rolls straight through, under the cart
  const R = s * .55;
  if (b < 6.4) { const u = b / 6.2, lx = lerp(-60, 1520, u); contactShadow(g, lx, gy(lx) - 2, R * .9, 7, .28); drawBoule(g, lx, gy(lx) - R - 2 - Math.abs(Math.sin(b * Math.PI)) * 8, R, (lx + 60) / R); }
  // seller behind her cart: watches the melon go up, keeps watching the sky, flings her hands up when it lands
  const sBase = P0(); sBase.aL = { fl: .9, abd: .2, el: 1.2, wr: 0, hand: 'relax' }; sBase.aR = { fl: .7, abd: .2, el: 1.3, wr: 0, hand: 'relax' };
  const sUp = clonePose(sBase); sUp.nod = -.55; sUp.headTilt = .1;
  const sUpL = clonePose(sUp); sUpL.aL = { fl: 1.1, abd: .3, el: 1.5, wr: 0, hand: 'open' };      // shades her eyes
  const sShock = pose('alarm'); sShock.nod = -.05;
  const sp = poseAt(b, [[0, sBase], [5.05, sBase], [5.45, sUp], [6.6, sUpL], [11.2, sUpL], [11.6, sUp], [12, sUp], [12.2, sShock]]);
  sp.expr = b < 5.1 ? EXPR.deadpan : EXPR.alarm;
  drawFigure(g, SELLER, { x: MK.cartX + 250, ground: gy(MK.cartX + 250) - 44, scale: 56, yaw: -60, pose: sp, t: lt });
  cart(g, MK.cartX, gy(MK.cartX + MK.cartW / 2) - 2, MK.cartW, {});
  // Otto runs through
  const ob = b - 1.5;
  if (ob > 0 && b < 8.4) {
    const ox = b < 5 ? lerp(-80, px - 20, ob / 3.5) : lerp(px - 20, 1560, (b - 5) / 3.2), ph = ob * .9;
    const rp = runPose(ph); rp.expr = EXPR.deadpan;
    contactShadow(g, ox, gy(ox) + 2, 70, 9, .28);
    drawFigure(g, OTTO, { x: ox, ground: gy(ox) + runBob(ph, s) * .4, scale: s, yaw: 90, pose: rp, t: lt });
  }
  // the constable strolls in, stops, looks around … and receives the melon
  if (b >= 8) {
    const walk = bb => walkPose((bb - 8) * .9);
    const stand = P0(); stand.nod = .02;
    const lookL = clonePose(stand); lookL.headTurn = -.45; const lookR = clonePose(stand); lookR.headTurn = .4;
    const front = clonePose(stand); front.nod = -.06;
    const buckle = clonePose(front); Object.assign(buckle, { nod: .12 }); buckle.L = { hip: .35, abd: .1, knee: .6, ankle: .15 }; buckle.R = { hip: .3, abd: .06, knee: .55, ankle: .15 };
    buckle.aL = { fl: .3, abd: .35, el: .3, wr: 0, hand: 'open' }; buckle.aR = { ...buckle.aL };
    const fist = bb => { const p = clonePose(front); const sh = Math.sin((bb - 13.4) * Math.PI * 4) * .22; p.aL = { fl: 2.45 + sh, abd: .25, el: .9, wr: 0, hand: 'fist' }; p.nod = -.12; p.lean = .06; return p; };
    const cp = poseAt(b, [[8, walk], [9.7, walk], [10, stand], [10.25, lookL], [10.6, lookL], [10.8, lookR], [11.1, lookR], [11.35, front], [12, front], [12.12, buckle], [12.6, buckle], [12.9, front], [13.1, front], [13.4, fist]]);
    cp.expr = b < 12 ? EXPR.deadpan : EXPR.alarm;
    const cx = numAt(b, [[8, 1560], [10, MK.copX]], x => x < .8 ? x / .8 * .9 : .9 + (x - .8) / .2 * .1);
    const yaw = numAt(b, [[8, -90], [11.1, -90], [11.4, 10], [13.1, 10], [13.4, 55]]);
    const co = { x: cx, ground: copY, scale: s, yaw, pose: cp, t: lt };
    contactShadow(g, cx, copY + 6, 70, 9, .28);
    drawFigure(g, COP, co);
    if (b >= 12) { const hd = palmsAt(COP, co)[4]; mel = [hd[0] + 4, hd[1] - s * 1.02 - 20, .15]; }    // the melon rides on his helmet
  }
  if (mel) melon(g, mel[0], mel[1], 30, mel[2]);
}
// ============ 4 · THE STEPS (bottom of the hill) — the last roll, the silence, then the tender two-shot ============
const ST = { gy: 930, girlX: 1010, stepX: [930, 1300], stopX: 806 };
function stepsSet(g) {
  sky(g, W, 700, 8);
  house(g, { x: -80, w: 380, h: 520, v: .7, floors: 2, base: ST.gy - 30, seed: 51, stone: true, door: { at: .5 } });
  house(g, { x: 290, w: 360, h: 470, v: .76, floors: 2, base: ST.gy - 40, seed: 52, shop: { text: 'COBBLER', awning: 0 } });
  g.fillStyle = 'rgba(244,240,232,.42)'; g.fillRect(0, 0, 660, ST.gy);
  // the girl's house, nearer: plaster wall, a tall door, a stone stoop of three steps
  form(g, rectPts(640, -20, 820, ST.gy + 20), { v: .74, line: 2.6, grad: .1, seed: 53 }); mottle(g, 640, 0, 820, ST.gy, .14, 9);
  for (const [x, y] of [[720, 150], [1180, 150], [720, 470]]) { form(g, rectPts(x, y, 130, 210), { v: .18, line: 2, grad: .2, seed: x + y }); form(g, rectPts(x - 12, y + 210, 154, 14), { v: .82, line: 1.6, seed: x + y + 1 }); stroke(g, [[x + 65, y], [x + 65, y + 210]], 2.4, { color: grey(.7), seed: 3 }); }
  form(g, rectPts(1030, 400, 190, 420), { v: .58, line: 2.4, seed: 54, shade: 8 });
  form(g, rectPts(1048, 430, 154, 390), { v: .3, line: 2, grad: .18, seed: 55 });
  for (let k = 0; k < 2; k++) form(g, rectPts(1066 + k * 66, 460, 52, 150 + k * 0), { v: .36, line: 1.4, seed: 56 + k });
  const [s0, s1] = ST.stepX;
  for (let k = 2; k >= 0; k--) {                          // three steps, the lowest in front
    const y = ST.gy - (k + 1) * 38, x0 = s0 + k * 40, x1 = s1 - k * 20;
    form(g, rectPts(x0, y, x1 - x0, 40 + k * 0), { v: .84 - k * .05, line: 2.2, seed: 60 + k, shade: 4 });
    form(g, rectPts(x0, y, x1 - x0, 8), { v: .92, line: 1.2, seed: 63 + k });
  }
  // pavement + street
  street(g, W, ST.gy + 30, H, 0, 11, .6);
  form(g, rectPts(0, ST.gy, W, 32), { v: .78, line: 2, seed: 66 });
}
function girlSit(o = {}) {
  const p = P0(); Object.assign(p, { lean: .06, nod: o.nod ?? .12, headTilt: o.tilt ?? .08 });
  p.L = { hip: 1.5, abd: .12, knee: 1.55, ankle: .15 }; p.R = { hip: 1.4, abd: .06, knee: 1.45, ankle: .2 };
  p.aL = { fl: .3, abd: .12, el: .75, wr: .15, hand: 'relax' }; p.aR = { fl: .25, abd: .12, el: .8, wr: .15, hand: 'relax' };   // hands resting in her lap
  p.expr = o.expr ?? EXPR.worry; return p;
}
const girlGround = () => ST.gy;                          // her shoes on the pavement, bottom step under her
function drawGirl(g, p, o = {}) { drawFigure(g, GIRL, { x: ST.girlX, ground: girlGround(), scale: o.s ?? 80, yaw: o.yaw ?? -55, pose: p, t: 0, props: o.props }); }

const R2 = 80 * .55;                                     // loaf radius at this set's scale
const gSit = () => girlSit({ nod: .12 });
const gLook = () => girlSit({ nod: .42 });
const gReach = () => { const p = girlSit({ nod: .4 }); p.lean = .55; p.aL = { fl: .85, abd: .1, el: .05, wr: .1, hand: 'grip' }; p.aR = { ...p.aL }; return p; };
const gOffer = () => { const p = girlSit({ nod: -.05, expr: HOPE }); p.aL = { fl: .95, abd: .12, el: .7, wr: 0, hand: 'grip' }; p.aR = { ...p.aL }; return p; };
const gLap = () => { const p = girlSit({ nod: -.05, expr: HOPE }); return p; };
const gTake = () => { const p = girlSit({ nod: -.08, expr: HOPE }); p.lean = .12; p.aL = { fl: .9, abd: .1, el: .35, wr: 0, hand: 'grip' }; p.aR = { fl: .25, abd: .12, el: .8, wr: .15, hand: 'relax' }; return p; };
const gHoldHalf = () => { const p = girlSit({ nod: -.05, expr: GLAD }); p.aR = { fl: .25, abd: .12, el: .8, wr: .15, hand: 'relax' }; p.aL = { fl: .95, abd: .15, el: .75, wr: 0, hand: 'grip' }; return p; };
const gLift = () => { const p = girlSit({ nod: -.12, expr: EXPR.proud }); p.aR = { fl: .25, abd: .12, el: .8, wr: .15, hand: 'relax' }; p.aL = { fl: .35, abd: 2.5, el: .3, wr: .2, hand: 'grip' }; return p; };
const GO = yaw => ({ x: ST.girlX, ground: ST.gy, scale: 80, yaw, t: 0 });

export function roll(g, lt) {
  const B = SEC.ROLL.beat, b = lt / B;
  stepsSet(g);
  // ritardando: the loaf decelerates, noses up against her shoe at beat 5, rocks back and forth, settles
  const u = clamp(b / 5), e = 1 - Math.pow(1 - u, 2.2), x = lerp(-80, ST.stopX, e);
  let rot = (x + 80) / R2; if (b > 5) rot += Math.sin((b - 5) * Math.PI * 2.6) * Math.exp(-(b - 5) * 1.8) * .35;
  const gp = poseAt(b, [[0, gSit()], [4.5, gSit()], [5.3, gLook()]]); gp.expr = EXPR.worry;
  drawFigure(g, GIRL, { ...GO(-55), pose: gp });
  contactShadow(g, x, ST.gy + 4, R2 * .9, 7, .28);
  drawBoule(g, x + (b > 5 ? Math.sin((b - 5) * Math.PI * 2.6) * Math.exp(-(b - 5) * 1.8) * .35 * R2 : 0), ST.gy - R2, R2, rot);
}
export function sil(g, lt) {
  stepsSet(g);
  // she leans down, gathers the loaf, lifts it into her lap and holds it out; he runs in, brakes, doubles over to breathe
  const gp = poseAt(lt, [[0, gLook()], [.3, gLook()], [.62, gReach()], [.78, gReach()], [1.25, gOffer()]]);
  gp.expr = HOPE;
  const go = { ...GO(-55), pose: gp }, palm = palmsAt(GIRL, go);
  const onGround = [ST.stopX, ST.gy - R2], grabbed = ss((lt - .62) / .16);
  const lp = lt < .62 ? onGround : [lerp(onGround[0], palm[0], grabbed), lerp(onGround[1], palm[1], grabbed)];
  drawFigure(g, GIRL, go);
  if (lt < .62) contactShadow(g, onGround[0], ST.gy + 4, R2 * .9, 7, .28);
  drawBoule(g, lp[0], lp[1], R2, 3.2);                         // in front of her legs: she gathers it up toward her
  const run = tt => { const p = runPose(tt * 2.2); p.expr = EXPR.deadpan; return p; };
  const brake = P0(); Object.assign(brake, { lean: -.12, nod: -.05 }); brake.L = { hip: .45, abd: .1, knee: .15, ankle: -.1 }; brake.R = { hip: -.25, abd: .08, knee: .3, ankle: 0 };
  brake.aL = { fl: .6, abd: .3, el: .6, wr: 0, hand: 'open' }; brake.aR = { fl: .3, abd: .3, el: .6, wr: 0, hand: 'open' };
  const pant = tt => { const k = Math.sin((tt - 1.1) * Math.PI * 5) * .04, p = P0(); Object.assign(p, { lean: .55 + k, nod: .1 });
    p.L = { hip: .45, abd: .12, knee: .55, ankle: .1 }; p.R = { hip: .35, abd: .1, knee: .5, ankle: .1 };
    p.aL = { fl: .55, abd: .2, el: .15, wr: 0, hand: 'relax' }; p.aR = { fl: .5, abd: .2, el: .15, wr: 0, hand: 'relax' }; return p; };
  const p = poseAt(lt, [[0, run], [.7, run], [.85, brake], [1.0, brake], [1.25, pant]]); p.expr = EXPR.deadpan;
  const ox = numAt(lt, [[0, -100], [.9, 520]], x => 1 - Math.pow(1 - x, 2.4));
  contactShadow(g, ox, ST.gy + 4, 80, 10, .3);
  drawFigure(g, OTTO, { x: ox, ground: ST.gy + 2, scale: 80, yaw: 70, pose: p, t: lt });
}

// the tender two-shot: same set; the push-in is motivated — the camera comes down to their level as he kneels (beats 2.6–4.4)
const tenderCam = lt => { const b = lt / SEC.TENDER.beat, k = ss((b - 2.6) / 1.8), d = .08 * ss(lt / (SEC.TENDER.dur + SEC.IRIS.dur));
  return { z: lerp(1.6, 2.1, k) + d, fx: lerp(850, 900, k), fy: lerp(560, 650, k) }; };
export function tender(g, lt) {
  const B = SEC.TENDER.beat, b = lt / B, C = tenderCam(lt);
  g.translate(W / 2, H / 2); g.scale(C.z, C.z); g.translate(-C.fx, -C.fy);
  stepsSet(g);
  // ---------- Otto ----------
  const K = pose('kneel');
  const stand = P0(); stand.nod = .35; stand.aL.fl = .2; stand.aR.fl = .15;
  const standLook = clonePose(stand); standLook.nod = .05; standLook.headTilt = .1;
  const kneel = clonePose(K); kneel.aL = { fl: .45, abd: .2, el: .6, wr: 0, hand: 'relax' }; kneel.aR = { ...kneel.aL };
  const reachK = clonePose(K); reachK.lean = .2; reachK.aL = { fl: 1.0, abd: .08, el: .35, wr: .1, hand: 'grip' }; reachK.aR = { ...reachK.aL };
  const holdK = clonePose(K); holdK.aL = { fl: .6, abd: .06, el: .95, wr: .1, hand: 'grip' }; holdK.aR = { ...holdK.aL };
  const splitK = clonePose(holdK); splitK.aL = { fl: .6, abd: .5, el: .9, wr: .1, hand: 'grip' }; splitK.aR = { ...splitK.aL };
  const giveK = clonePose(splitK); giveK.lean = .18; giveK.aL = { fl: .85, abd: .05, el: .15, wr: 0, hand: 'grip' };
  const keepK = clonePose(splitK); keepK.aL = { fl: .3, abd: .1, el: .5, wr: 0, hand: 'relax' }; keepK.aR = { fl: .6, abd: .3, el: .9, wr: .1, hand: 'grip' };
  const liftK = clonePose(keepK); liftK.aR = { fl: .3, abd: 2.4, el: .35, wr: .2, hand: 'grip' }; liftK.nod = -.2;
  const op = poseAt(b, [[0, stand], [1.4, stand], [1.9, standLook], [2.7, standLook], [3.6, kneel], [3.8, kneel], [4.2, reachK], [4.5, reachK], [4.85, holdK], [5.0, holdK], [5.3, splitK], [5.9, splitK], [6.35, giveK], [6.55, giveK], [7.0, keepK], [8.0, keepK], [8.5, liftK]]);
  op.expr = b < 1.4 ? EXPR.deadpan : b < 8 ? EXPR.tender : EXPR.proud;
  const ox = numAt(b, [[2.7, 700], [3.6, 770]]);
  const oo = { x: ox, ground: ST.gy + 2, scale: 80, yaw: 60, pose: op, t: lt };
  // ---------- the girl ----------
  const gp = poseAt(b, [[0, gOffer()], [4.4, gOffer()], [4.9, gLap()], [5.8, gLap()], [6.3, gTake()], [6.6, gTake()], [6.9, gHoldHalf()], [7.0, gHoldHalf()], [7.55, gLift()]]);
  gp.expr = b < 5 ? HOPE : b < 7.2 ? GLAD : EXPR.proud;
  if (b >= SEC.TENDER.beats + 2.4 && b < SEC.TENDER.beats + 3.2) gp.expr = EXPR.wink;      // the iris shot continues this function
  const gyaw = numAt(b, [[7.0, -55], [7.55, -8]]);
  const go = { ...GO(gyaw), pose: gp };
  // ---------- the loaf: her palms → (hand-over) → his palms → cracks where it is → one half travels to her hand ----------
  const hp = palmsAt(OTTO, oo), gpP = palmsAt(GIRL, go);
  const hand = (P, i) => P[i];                         // hand centres: 5 = L, 6 = R
  let whole = null, halvesAt = null;
  if (b < 4.35) whole = { at: 'girl', p: [gpP[0], gpP[1]] };
  else if (b < 4.75) { const k = ss((b - 4.35) / .4); whole = { at: 'otto', p: [lerp(gpP[0], hp[0], k), lerp(gpP[1], hp[1], k)] }; }
  else if (b < 5.0) whole = { at: 'otto', p: [hp[0], hp[1]] };
  else {
    // while he holds both, each half's flat face sits a loaf-radius in from the hand that grips its crust;
    // once a half is held on its own it sits in that palm (crust in the palm, crumb toward us)
    const L = hp[5], Rh = hp[6], d = Math.hypot(Rh[0] - L[0], Rh[1] - L[1]) || 1, ux = (Rh[0] - L[0]) / d, uy = (Rh[1] - L[1]) / d;
    const splitL = [L[0] + ux * R2 * .85, L[1] + uy * R2 * .85], splitR = [Rh[0] - ux * R2 * .85, Rh[1] - uy * R2 * .85];
    const inPalm = (P, i, j) => { const c = P[i], tip = P[j], dx = tip[0] - c[0], dy = tip[1] - c[1], l = Math.hypot(dx, dy) || 1; return [c[0] + dx / l * R2 * .35, c[1] + dy / l * R2 * .35]; };
    const hisPalm = inPalm(hp, 6, 3), herPalm = inPalm(gpP, 5, 2);
    const kh = ss((b - 6.35) / .5), hk = ss((b - 6.35) / .25);
    const his = [lerp(splitR[0], hisPalm[0], kh), lerp(splitR[1], hisPalm[1], kh)];
    const hers = b < 6.35 ? splitL : [lerp(splitL[0], herPalm[0], hk), lerp(splitL[1], herPalm[1], hk)];
    const face = Math.atan2(splitL[1] - splitR[1], splitL[0] - splitR[0]);      // flat faces toward each other
    halvesAt = { his, hers, rotHis: lerp(face + Math.PI, -Math.PI / 2 - .3, kh), rotHers: lerp(face, -Math.PI / 2 + .3, ss((b - 6.6) / .6)) };
  }
  const R = R2;
  const betweenOf = who => whole && whole.at === who ? { between: gg => drawBoule(gg, whole.p[0], whole.p[1], R, 3.2) } : null;
  drawFigure(g, GIRL, { ...go, props: betweenOf('girl') });                 // she is drawn first: his reaching hands and the loaf pass in front of her
  contactShadow(g, ox, ST.gy + 4, 80, 10, .3);
  drawFigure(g, OTTO, { ...oo, props: betweenOf('otto') });
  if (halvesAt) {
    drawBouleHalf(g, halvesAt.his[0], halvesAt.his[1], R, halvesAt.rotHis);
    drawBouleHalf(g, halvesAt.hers[0], halvesAt.hers[1], R, halvesAt.rotHers);
  }
}
export function irisShot(g, lt) { tender(g, lt + SEC.TENDER.dur); }
// film-space position of the girl's face during the tender / iris shots (for the iris centre)
export function girlFace(ltTender) {
  const C = tenderCam(ltTender), wx = 1004, wy = 626;           // her face (seated), measured in world space
  return [W / 2 + (wx - C.fx) * C.z, H / 2 + (wy - C.fy) * C.z];
}
