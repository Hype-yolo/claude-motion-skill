// "The Colour of Rain" — director's timeline. Every shot is repainted from strokes each frame.
import { Impasto, Strokes, hex, shade } from './engine/impasto.js';
import { T, TA, TB, BEAT_A, BEAT_B, NA, NB, POPS, bowPos, DUR } from './timeline.js';
import { buildWide, WW, WH, HZ, ARCH, figScale } from './scenes/wide.js';
import { buildMedium, MW, MH, CELL_AT, CELL_S } from './scenes/medium.js';
import { buildCellist, bowArm, face, CEL } from './scenes/cellist.js';
import { buildGirl, girlFace, girlArm, GIRL_AT, GW, GH, GOX, GOY, GRW, GRH } from './scenes/girl.js';
import { buildTop, TW, TH, TC } from './scenes/top.js';
import { buildEcu, ecuBow, EW, EH } from './scenes/ecu.js';
import { buildTitle, buildEnd } from './scenes/cards.js';
import { walker, umbrellaSide, umbrellaTop, rain, splashes, ribbon, pat, UMB } from './scenes/figures.js';
import { clamp, lerp, ss, seg, eo, eio, back, hash } from './scenes/common.js';

const NEVER = 1e6, W = 1920, H = 1080;
// affine [a,b,c,d,e,f]: x' = a x + c y + e, y' = b x + d y + f
const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const TR = (x, y) => [1, 0, 0, 1, x, y], SC = s => [s, 0, 0, s, 0, 0], RO = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const about = (px, py, a) => mul(TR(px, py), mul(RO(a), TR(-px, -py)));
const key = (t, ks) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 0; i < ks.length - 1; i++) { const [t0, v0, e] = ks[i], [t1, v1] = ks[i + 1]; if (t < t1) { const k = (e || eio)((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], k)) : lerp(v0, v1, k); } } return ks[ks.length - 1][1]; };
const lin1 = x => x;

let E, P = {}, dyn, credits;
export async function setup(canvas) {
  await document.fonts.load('italic 600 100px "Cormorant Garamond"'); await document.fonts.load('500 40px "Cormorant SC"');
  E = new Impasto(canvas); dyn = new Strokes(8192);
  const up = (built, w, h, ox = 0, oy = 0) => ({ b: E.batch(built.strokes.data()), tex: E.texture(built.ref.ctx.canvas), w, h, ox, oy });
  P.ecu = up(buildEcu(), EW, EH);
  P.wide = up(buildWide(), WW, WH);
  P.med = up(buildMedium(), MW, MH);
  const cm = buildCellist(CELL_S); P.celB = up(cm.body, 1120, 1120, 560, 1060); P.celH = up(cm.head, 1120, 1120, 560, 1060);
  const cw = buildCellist(.25, 6); P.celBs = up(cw.body, 1120, 1120, 560, 1060); P.celHs = up(cw.head, 1120, 1120, 560, 1060);
  const g = buildGirl(); P.gbg = up(g.bg, GW, GH); P.gB = up(g.body, GRW, GRH, GOX, GOY); P.gH = up(g.head, GRW, GRH, GOX, GOY);
  P.top = up(buildTop(), TW, TH);
  P.title = up(buildTitle(), 1500, 330); P.end = up(buildEnd(), 1920, 1080);
  credits = document.createElement('div');
  credits.style.cssText = 'position:fixed;left:0;right:0;top:640px;text-align:center;font-family:"Cormorant SC",serif;color:#efe2c4;letter-spacing:.08em;opacity:0;line-height:1.5;text-shadow:0 2px 6px rgba(0,0,0,.5)';
  credits.innerHTML = '<div style="font-size:38px">an impasto palette-knife study</div><div style="font-size:30px;margin-top:22px;color:#f6d690">Lemo-Opuscar &nbsp;·&nbsp; LemoLab × Claude Opus 5.5</div><div style="font-size:21px;margin-top:26px;color:#b8b4c8;font-family:\'Cormorant Garamond\',serif;font-style:italic;letter-spacing:.02em">painted and scored in code · samples: VS Chamber Orchestra CE &amp; VCSL (Versilian Studios), FreePats — CC0 · type: Cormorant (OFL)</div>';
  document.body.appendChild(credits);
  window.DUR = DUR;
  return frame;
}

// ---- drawing a painted plate (+ its thin underpainting)
function plate(pl, o) {
  const M = o.M || [1, 0, 0, 1, 0, 0];
  const Mu = mul(M, TR(-pl.ox, -pl.oy));
  const inTrans = o.appear !== undefined && o.t < o.appear + (o.appDur ?? .5);
  const ua = o.appear === undefined ? 1 : seg(o.t, o.appear + (o.appDur ?? .5) * .55, o.appear + (o.appDur ?? .5));
  if (!o.noUnder && ua > 0) E.under(pl.tex, pl.w, pl.h, { ...o, M: Mu, alpha: (o.alpha ?? 1) * ua, revC: o.revC });
  E.draw(pl.b, { ...o, M, appear: inTrans ? o.appear : -1e6, appDur: .14 });
}
const flush = (o) => { if (dyn.n) E.drawNow(dyn.data(), o); dyn.clear(); };

// ---- post looks
const POST = {
  grey: { expo: 1.0, sat: 1, contrast: 1.04, vig: .3, spec: .3, shin: 26, lift: [.02, .02, .03] },
  warm: { expo: 1.02, sat: 1.06, contrast: 1.04, vig: .26, spec: .26, shin: 26 },
};

// ================= SHOTS =================
// 1 · ECU: the first bow stroke. The only colour in the world is the note.
function shotEcu(t, tr) {
  const cam = { x: EW / 2 + t * 18, y: EH / 2 + 10, zoom: lerp(.95, 1.04, ss(t / 2.8)) };
  plate(P.ecu, { t, cam, grey: 1, reveal: NEVER, ...tr });
  const lift = 1 - ss(seg(t, 0, .4));
  const p = t < T.hook ? 0 : eio(seg(t, T.hook, T.cutWide + .3));
  ecuBow(dyn, p, { y: 700, lift }); flush({ t, cam, grey: 1, reveal: NEVER, run: 0 });
  ribbon(dyn, u => bez([1010, 690], [760, 380], [360, 120], [-160, 40], u), t, T.hook + .05, 2.1, { cols: ['#f8c850', '#f0a030', '#ffdf80', '#e88a28'], wid: 46, n: 30, life: 1.6, drip: .7, seed: 1 });
  flush({ t, cam, grey: 0, run: .3 });
  rain(dyn, t, { n: 70, near: .5, alpha: .5, seed: 2 }); flush({ t, grey: 0, hgt: .4 });
}
const bez = (a, b, c, d, u) => { const v = 1 - u; return [v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0], v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1]]; };

// walkers crossing the grey square
const WALK = [
  { y: 760, x0: 260, x1: 900, f: 1, coat: '#34303e', seed: 1 }, { y: 850, x0: 1620, x1: 1120, f: -1, coat: '#2c3238', seed: 2, hat: '#1e1c22' },
  { y: 990, x0: -140, x1: 520, f: 1, coat: '#3a2e30', seed: 3 }, { y: 690, x0: 1330, x1: 1030, f: -1, coat: '#30303a', seed: 4 },
  { y: 640, x0: 640, x1: 840, f: 1, coat: '#2e2a34', seed: 5 }, { y: 1130, x0: 2300, x1: 1500, f: -1, coat: '#26242c', seed: 6, t0: 5.0 },
  { y: 720, x0: 470, x1: 700, f: 1, coat: '#3a3440', seed: 7 },
];
function drawWalkers(list, t, t0, t1, o = {}) {
  for (const w of list) {
    const H0 = 260 * figScale(w.y), k = seg(t, w.t0 ?? t0, t1), x = lerp(w.x0, w.x1, k);
    const speed = Math.abs(w.x1 - w.x0) / (t1 - (w.t0 ?? t0)), phase = (t - (w.t0 ?? t0)) * speed / (H0 * .55) * Math.PI;
    if (t < (w.t0 ?? t0) - .01 && w.t0) continue;
    walker(dyn, x, w.y, H0, { phase, f: w.f, coat: w.coat, hat: w.hat, seed: w.seed * 10, umb: { open: 1, cols: pat('black'), r: .34, tilt: w.f * .08 }, rev: NEVER });
  }
}
// the small cellist in the arch (wide shots)
function smallCellist(t, cam, { notes, reveal, rest = 0, grey = 1 }) {
  const s = .23, M = mul(TR(ARCH.x - 10, ARCH.y + 6), SC(s));
  const o = { t, cam, grey, reveal, revC: [560 + CEL.contact[0], 1060 + CEL.contact[1], 900] };
  plate(P.celBs, { ...o, M });
  bowArm(dyn, bowPos(notes, t), { rest }); flush({ ...o, M, run: .2 });
  plate(P.celHs, { ...o, M: mul(M, about(CEL.neck[0], CEL.neck[1], -.02)) });
}

// 2 · the grey square
function shotWideGrey(t, tr) {
  const cam = { x: lerp(1030, 1090, seg(t, T.cutWide, T.cutMed)), y: 600, zoom: lerp(.93, .975, ss(seg(t, T.cutWide, T.cutMed))) };
  plate(P.wide, { t, cam, grey: 1, reveal: NEVER, ...tr });
  smallCellist(t, cam, { notes: NA, reveal: NEVER });
  // each note sends a small amber ribbon out of the arch; the rain washes it down
  for (const [i, n] of NA.entries()) if (n.t > T.cutWide - 1 && n.t < T.cutMed) ribbon(dyn, u => bez([ARCH.x - 60, ARCH.y - 150], [ARCH.x - 200, ARCH.y - 300 - i * 12], [ARCH.x - 420, ARCH.y - 260], [ARCH.x - 600 - i * 30, ARCH.y - 380], u), t, n.t, n.d * .9, { cols: ['#f6c04a', '#eaa030', '#ffd870'], wid: 13, n: 16, life: 1.1, drip: 1, seed: 10 + i });
  flush({ t, cam, grey: 0 });
  drawWalkers(WALK, t, T.cutWide - .6, T.cutMed + .4); flush({ t, cam, grey: 1, reveal: NEVER, run: .3 });
  splashes(dyn, t, { x0: 0, x1: WW, y0: HZ + 30, y1: WH, n: 70, fs: y => figScale(y) + .15, alpha: .5 }); flush({ t, cam, grey: 1, reveal: NEVER });
  // title: laid in with the knife, then the rain takes it
  if (t > T.title) {
    const drift = Math.pow(seg(t, T.titleOut - .3, T.cutMed), 2);
    plate(P.title, { t, cam: { x: W / 2, y: H / 2, zoom: 1 }, M: TR(210, 140 + drift * 60), grey: 0, appear: T.title, appDur: 1.1, alpha: 1 - drift, noUnder: true });
  }
  rain(dyn, t, { n: 230, alpha: .5, seed: 3 }); flush({ t, grey: 1, reveal: NEVER, hgt: .4 });
}

// 3 · medium: nobody stops
function shotMedium(t, tr) {
  const cam = { x: key(t, [[T.cutMed, 1000], [T.stop, 1060], [T.splash, 1215]]), y: key(t, [[T.cutMed, 565], [T.stop, 545], [T.splash, 430]]), zoom: key(t, [[T.cutMed, 1.0, lin1], [T.stop, 1.07], [T.splash, 1.32]]) };
  const o = { t, cam, grey: 1, reveal: NEVER };
  plate(P.med, { ...o, ...tr });
  rain(dyn, t, { W: 800, H: MH, n: 90, alpha: .55, seed: 4, xmax: 790 }); flush(o);
  cellistMedium(t, o, { notes: NA, stopAt: T.stop + .3, headDown: [T.headDown, T.headDown + .9] });
  // passers-by right in front of the lens: dark, fast, nobody stops
  for (const [t0, t1, x0, x1, f, s] of [[7.55, 8.75, -500, 2400, 1, 1], [9.0, 10.05, 2500, -400, -1, 2]]) {
    if (t < t0 || t > t1) continue;
    const k = (t - t0) / (t1 - t0), x = lerp(x0, x1, k);
    walker(dyn, x, 1250, 1500, { phase: (t - t0) * 7.5, f, coat: '#1c1a22', legs: '#141218', seed: 70 + s, reflect: false, umb: { open: 1, cols: pat('black'), r: .36 }, rev: NEVER });
  }
  flush({ ...o, run: .25 });
}
function cellistMedium(t, o, { notes, stopAt = 1e9, headDown = null, look = null, playFrom = -1, lift = 0 }) {
  const s = CELL_S, M = mul(TR(CELL_AT[0], CELL_AT[1]), SC(s));
  const oo = { ...o, revC: [560 + CEL.contact[0], 1060 + CEL.contact[1], 900] };
  plate(P.celB, { ...oo, M });
  // bow: play the notes; after stopAt lift off and lower to the knee
  const rest = ss(seg(t, stopAt + .15, stopAt + 1.0)) * (1 - ss(seg(t, playFrom - .9, playFrom - .35)));
  const lf = Math.max(ss(seg(t, stopAt, stopAt + .25)) * (1 - ss(seg(t, playFrom - .35, playFrom))), lift);
  bowArm(dyn, bowPos(notes, t), { rest, lift: lf }); flush({ ...oo, M, run: .15 });
  // head: sways with the phrase; drops when he gives up; lifts when he sees the red
  let rot = Math.sin(t * Math.PI * 2 / (BEAT_A * 3)) * .025, gaze = [-.3, .7], lid = .3, br = 0;
  if (headDown) { const k = ss(seg(t, headDown[0], headDown[1])); rot += k * .13; lid = lerp(.3, .85, k); gaze = [-.1, lerp(.7, 1, k)]; }
  if (look) { const k = eo(seg(t, look[0], look[0] + .45)); rot = lerp(rot, -.07, k); lid = lerp(lid, 0, k); gaze = [lerp(gaze[0], -.6, k), lerp(gaze[1], -.9, k)]; br = k; if (t > look[1]) { const k2 = ss(seg(t, look[1], look[1] + .5)); rot = lerp(-.07, .02 + Math.sin(t * Math.PI * 2 / (BEAT_B * 3)) * .03, k2); gaze = [-.3, lerp(-.9, .5, k2)]; lid = lerp(0, .15, k2); br = lerp(1, .5, k2); } }
  const MH_ = mul(M, about(CEL.neck[0], CEL.neck[1], rot));
  plate(P.celH, { ...oo, M: MH_ });
  face(dyn, { gaze, lid, lift: br }); flush({ ...oo, M: MH_, run: .2 });
}

// 4 · the girl: splash -> tilt up -> the first colour
function shotGirl(t, tr) {
  const pop = T.pop;
  const zoomKick = t > pop ? -.06 * Math.exp(-(t - pop) * 5) * Math.sin((t - pop) * 30) - .05 * eo(seg(t, pop, pop + .3)) : 0;
  const cam = { x: key(t, [[12.4, GIRL_AT[0] + 60], [12.95, GIRL_AT[0] + 60], [13.95, 1270]]), y: key(t, [[12.4, GIRL_AT[1] - 170], [12.95, GIRL_AT[1] - 170], [13.95, 1170]]), zoom: key(t, [[12.4, 1.55], [12.95, 1.55], [13.95, .95]]) + zoomKick };
  const o = { t, cam, grey: 1, reveal: NEVER };
  plate(P.gbg, { ...o, ...tr });
  // her step lands exactly on the splash
  const k = ss(seg(t, T.splash - .22, T.splash)), bx = GIRL_AT[0] + (1 - k) * 110, by = GIRL_AT[1] - Math.sin(k * Math.PI) * 60 * (1 - k * .3) - (1 - k) * 20;
  const M = TR(bx, by);
  const og = { ...o, reveal: pop, revDur: .25, revC: [GOX + 100, GOY - 1300, 2200] };
  // puddle ripples + splash crown
  if (t > T.splash) {
    const a = t - T.splash;
    for (let i = 0; i < 3; i++) { const ai = a - i * .22; if (ai < 0 || ai > 1.6) continue; const r = 60 + ai * 260; for (let j = 0; j < 14; j++) { const th = j / 14 * Math.PI * 2; dyn.push({ x: GIRL_AT[0] + 30 + Math.cos(th) * r, y: GIRL_AT[1] + 20 + Math.sin(th) * r * .22, ang: th + Math.PI / 2, len: r * .42, wid: 7, c: [.9, .9, .96], seed: i * 20 + j, type: 1, alpha: .6 * (1 - ai / 1.6), hgt: .4 }); } }
    if (a < .6) for (let j = 0; j < 16; j++) { const th = -Math.PI * (.1 + .8 * hash(j)), v = 400 + hash(j * 3) * 500; dyn.push({ x: GIRL_AT[0] + 40 + Math.cos(th) * v * a, y: GIRL_AT[1] + Math.sin(th) * v * a + 1400 * a * a, ang: 0, len: 22, wid: 18, c: [.88, .9, .96], seed: j, type: 2, alpha: 1 - a / .6, hgt: .6 }); }
    flush(o);
  }
  plate(P.gB, { ...og, M });
  // head: looks at him, then up at her umbrella; happy after the pop
  const look = ss(seg(t, 14.2, 14.6)) * (1 - ss(seg(t, 15.5, 15.9)) * .6);
  const hrot = -.05 * look + (t > 13.3 && t < 14.1 ? Math.sin((t - 13.3) * 4) * .03 : 0);
  const MHd = mul(M, about(10, -1000, hrot));
  plate(P.gH, { ...og, M: MHd });
  const happy = t > pop + .15 ? 1 : 0, blink = (t > 13.75 && t < 13.85) ? 1 : 0;
  girlFace(dyn, { look, happy, blink }); flush({ ...og, M: MHd, grey: 1, reveal: pop, revDur: .1, run: .2 });
  // arm + umbrella: lift (anticipation dip) -> POP
  const lift = ss(seg(t, 14.8, 15.12)) - .06 * Math.sin(Math.PI * seg(t, 15.05, 15.3));
  const open = t < pop ? 0 : clamp(back(seg(t, pop, pop + .16), 2.2));
  const tilt = t > pop ? .12 * Math.sin((t - pop) / BEAT_B * Math.PI) * ss(seg(t, pop + .3, pop + .6)) : 0;
  girlArm(dyn, { lift, open, colour: t >= pop ? 1 : 0, tilt });
  flush({ ...o, M, grey: t >= pop ? 0 : 1, reveal: NEVER, run: 0 });
  // paint flies off the canopy as it snaps open
  if (t > pop && t < pop + .8) {
    const a = t - pop, cx = bx + 150, cy = by - 1340;
    for (let j = 0; j < 22; j++) { const th = Math.PI * (1.05 + .9 * hash(j * 1.3)), v = 700 + hash(j * 2.1) * 900; dyn.push({ x: cx + Math.cos(th) * v * a, y: cy + Math.sin(th) * v * a + 900 * a * a, ang: th, len: 34 - a * 20, wid: 24 - a * 14, c: hex(j % 3 ? '#e03028' : '#ff6a4a'), seed: j + 100, type: 2, alpha: 1 - a / .8, hgt: 1.2 }); }
    flush({ t, cam, grey: 0 });
  }
  rain(dyn, t, { n: 200, alpha: .5, seed: 5 }); flush({ t, grey: 1, reveal: NEVER, hgt: .4 });
}

// 5 · reaction: he looks up — and plays
function shotReact(t, tr) {
  const cam = { x: key(t, [[T.react, 1262], [T.bowIn, 1250], [T.cutStreet, 1150]]), y: key(t, [[T.react, 292], [T.bowIn, 330], [T.cutStreet, 520]]), zoom: key(t, [[T.react, 2.15], [T.bowIn, 1.95], [T.cutStreet, 1.28]]) };
  const o = { t, cam, grey: 1, reveal: T.bowIn + .2, revDur: .2, revC: [1260, 300, 1100] };
  plate(P.med, { ...o, revC: [CELL_AT[0], 600, 1000], ...tr });
  cellistMedium(t, { t, cam, grey: 1, reveal: T.bowIn, revDur: .2 }, { notes: NB, stopAt: -10, playFrom: T.bowIn, look: [T.react + .1, T.bowIn - .3], lift: ss(seg(t, T.bowIn - .6, T.bowIn - .25)) * (1 - ss(seg(t, T.bowIn - .12, T.bowIn))) });
  // colour pours out of the cello
  for (const [i, n] of NB.entries()) if (n.t < T.cutStreet) {
    const c0 = [CELL_AT[0] - 180, CELL_AT[1] - 420];
    ribbon(dyn, u => bez(c0, [c0[0] - 250, c0[1] - 200 - i * 40], [c0[0] - 600, c0[1] - 100 + i * 30], [-100, 300 + i * 90], u), t, n.t, n.d * 1.4, { cols: [['#f8c850', '#e8402a', '#2f62c0', '#23906c'][i % 4], '#ffe08a', ['#cc3a82', '#ee7a2a', '#26aab4'][i % 3]], wid: 30, n: 22, life: 3, seed: 30 + i });
  }
  flush({ t, cam, grey: 0 });
  rain(dyn, t, { W: 800, H: MH, n: 80, alpha: .5, seed: 6, xmax: 790 }); flush({ t, cam, grey: 1, reveal: NEVER });
}

// the square's people for the colour scenes: where they stand, their umbrella colours (pop order = index)
const CROWD = [
  { x: 420, y: 820, cols: pat('yellow'), f: 1 }, { x: 760, y: 700, cols: pat('cobalt', 'cream'), f: 1 }, { x: 1010, y: 900, cols: pat('viridian'), f: 1 },
  { x: 260, y: 1000, cols: pat('magenta'), f: 1 }, { x: 1250, y: 760, cols: pat('orange', 'yellow'), f: -1 }, { x: 600, y: 1080, cols: pat('turq'), f: 1 },
  { x: 1380, y: 1060, cols: pat('violet', 'cream'), f: -1 }, { x: 1120, y: 640, cols: pat('lime'), f: 1 }, { x: 880, y: 1120, cols: pat('red', 'cream'), f: 1 },
].map((p, i) => ({ ...p, coat: ['#34303e', '#2c3238', '#3a2e30', '#30303a', '#2e2a34', '#26242c', '#3a3440', '#2a3036', '#382c34'][i], seed: 100 + i * 7, pop: POPS[i].t }));
const GIRL_W = () => [ARCH.x - 250, ARCH.y + 40];
function smallGirl(t, cam, { colour = 1, open = 1, spin = 0 }) {
  const [gx, gy] = GIRL_W(), s = .17, M = mul(TR(gx, gy), SC(s));
  const o = { t, cam, grey: colour ? 0 : 1, reveal: colour ? -1e6 : NEVER };
  plate(P.gB, { ...o, M }); plate(P.gH, { ...o, M });
  girlFace(dyn, { happy: 1, look: .4 }); girlArm(dyn, { lift: 1, open, colour, tilt: .1 * Math.sin(spin) }); flush({ ...o, M, grey: 0, run: 0 });
}
function crowd(t, cam, { popped, closing = null, turnAt = 0, grey = 1 }) {
  for (const [i, p] of CROWD.entries()) {
    const H0 = 260 * figScale(p.y);
    const isPop = popped(p, i), pk = isPop ? clamp((t - p.pop) / .14) : 0;
    const walking = t < p.pop - .2 && !closing;
    const x = p.x - (walking ? (p.pop - .2 - t) * 60 * p.f : 0);
    const turn = t > p.pop + BEAT_B && !closing ? 1 : p.f;
    const bounce = isPop ? 1 + .18 * Math.sin(Math.PI * clamp((t - p.pop) / .3)) : 1;
    const open = closing ? 1 - ss(seg(t, closing[i], closing[i] + .35)) : 1;
    const sway = !walking ? Math.sin((t - p.pop) / BEAT_B / 3 * Math.PI * 2) * .5 : 0;
    const hang = closing ? ss(seg(t, closing[i] + .25, closing[i] + .7)) : 0;
    walker(dyn, x, p.y, H0, { phase: walking ? t * 5 : 0, stride: walking ? 1 : 0, f: turn, coat: p.coat, seed: p.seed, sway, umb: { open, hang, r: .34 * bounce, cols: isPop && pk > .5 ? p.cols : pat('black'), tilt: turn * .08 + sway * .1 }, rev: NEVER });
    if (isPop && t - p.pop < .5) { const a = t - p.pop, cx = x + turn * H0 * .12, cy = p.y - H0 * 1.25; for (let j = 0; j < 10; j++) { const th = Math.PI * (1.1 + .8 * hash(j + i * 13)), v = H0 * (2 + hash(j) * 2.5); dyn.push({ x: cx + Math.cos(th) * v * a, y: cy + Math.sin(th) * v * a + H0 * 4 * a * a, ang: th, len: H0 * .09, wid: H0 * .07, c: hex(p.cols[0][0]), seed: j + i * 30, type: 2, alpha: 1 - a / .5, hgt: 1 }); } }
  }
  flush({ t, cam, grey: 0, run: .25 });
}

// 6 · the street: one umbrella per beat
function shotStreet(t, tr) {
  const cam = { x: lerp(1180, 1230, seg(t, T.cutStreet, T.cutTop)), y: 700, zoom: lerp(1.2, 1.24, seg(t, T.cutStreet, T.cutTop)) };
  plate(P.wide, { t, cam, grey: 1, reveal: NEVER, ...tr });
  smallCellist(t, cam, { notes: NB, reveal: -1e6, grey: 0 });
  smallGirl(t, cam, { spin: t * 4 });
  for (const [i, p] of CROWD.entries()) {
    const H0 = 260 * figScale(p.y), a0 = [ARCH.x - 120, ARCH.y - 200], tip = [p.x + p.f * H0 * .12, p.y - H0 * 1.3];
    ribbon(dyn, u => bez(a0, [a0[0] - 200, a0[1] - 380], [tip[0] + 240, tip[1] - 300], tip, u), t, p.pop - BEAT_B, BEAT_B, { cols: [p.cols[0][0], '#ffe08a', p.cols[0][1]], wid: 16, n: 20, life: 2.4, seed: 60 + i });
  }
  flush({ t, cam, grey: 0 });
  crowd(t, cam, { popped: p => t >= p.pop });
  splashes(dyn, t, { x0: 0, x1: WW, y0: HZ + 30, y1: WH, n: 70, fs: y => figScale(y) + .15, alpha: .45 }); flush({ t, cam, grey: 1, reveal: NEVER });
  rain(dyn, t, { n: 200, alpha: .45, seed: 7 }); flush({ t, grey: 1, reveal: NEVER, hgt: .4 });
}

// 7 · overhead: the dance paints the square
const DANCE = (() => {
  const L = [{ cols: pat('red'), ring: 0, k: 0 }];
  const inner = ['yellow', 'cobalt', 'magenta', 'viridian', 'orange', 'turq'];
  const outer = ['cream', 'violet', 'yellow', 'red', 'lime', 'cobalt', 'orange', 'magenta', 'turq', 'viridian', 'violet', 'yellow'];
  inner.forEach((c, k) => L.push({ cols: k % 2 ? pat(c, 'cream') : pat(c), ring: 1, k, n: 6 }));
  outer.forEach((c, k) => L.push({ cols: k % 3 === 0 ? pat(c, 'cream') : pat(c), ring: 2, k, n: 12 }));
  return L;
})();
function dancePos(u, tt) {   // tt = seconds since the overhead cut (frozen at the grand pause)
  const bar = BEAT_B * 3, b = tt / bar;
  if (u.ring === 0) return [TC[0], TC[1], tt * 2.2];
  const n = u.n, base = u.k / n * Math.PI * 2 + (u.ring === 1 ? Math.PI / 6 : 0);
  const rr0 = u.ring === 1 ? 340 : 640;
  // enter from far away during bar 0, arrive on bar 1's downbeat
  const enter = eo(clamp(b)), rStart = 1500 + (u.k % 3) * 200;
  let rot = u.ring === 1 ? -Math.max(0, b - 1) * Math.PI / 3 : Math.max(0, b - 1) * Math.PI / 4.5;
  let r = lerp(rStart, rr0, enter);
  // waltz breath: rings swell on every downbeat
  const beatIn = (tt / BEAT_B) % 3, swell = b > 1 ? Math.exp(-beatIn * 1.6) * 38 : 0;
  r += swell;
  // bars 3-4: petals — alternate outer umbrellas swing out and in
  if (u.ring === 2) r += Math.sin(Math.PI * clamp((b - 3) / 2)) * (u.k % 2 ? 190 : -110);
  if (u.ring === 1) r -= Math.sin(Math.PI * clamp((b - 3) / 2)) * 90;
  // bar 5 downbeat: everyone blooms outward and holds
  r += eo(clamp((b - 5) * 3)) * (u.ring === 1 ? 160 : 260);
  const th = base + rot + (1 - enter) * .9;
  return [TC[0] + Math.cos(th) * r, TC[1] + Math.sin(th) * r, tt * (u.k % 2 ? 2.6 : -2.6)];
}
function shotTop(t, tr) {
  const tf = Math.min(t, T.gp), tt = tf - T.cutTop;
  const cam = { x: TC[0], y: TC[1], zoom: key(tf, [[T.cutTop, 1.32], [TB(11), .6]]), rot: key(tf, [[T.cutTop, 0, lin1], [T.gp, .62]]) };
  const o = { t, cam, grey: 1, reveal: NEVER };
  plate(P.top, { ...o, ...tr });
  // trails: each umbrella drips its colour along its path
  for (const [i, u] of DANCE.entries()) {
    const col = hex(u.cols[0][0]);
    for (let s = 0; s < tt; s += .055) {
      const [x, y] = dancePos(u, s), [x2, y2] = dancePos(u, s + .03);
      if (u.ring === 0 && s > .2) break;
      dyn.push({ x: x + (hash(i * 31 + s * 7) - .5) * 40, y: y + (hash(i * 17 + s * 5) - .5) * 40, ang: Math.atan2(y2 - y, x2 - x), len: 60 + hash(s + i) * 30, wid: 26 + hash(s * 3 + i) * 16, c: col, c2: shade(col, .85), seed: i * 1000 + s * 50, type: 0, alpha: .9, hgt: 1 });
    }
  }
  flush({ t, cam, grey: 0, run: .6 });
  // people's shoulders + a dark wet shadow under each umbrella, then the umbrellas
  for (const [i, u] of DANCE.entries()) { const [x, y] = dancePos(u, tt); dyn.push({ x: x + 16, y: y + 22, ang: 0, len: 300, wid: 280, c: [.16, .14, .2], seed: i, type: 2, alpha: .35, hgt: .2 }); }
  flush({ t, cam, grey: 0 });
  for (const [i, u] of DANCE.entries()) { const [x, y, sp] = dancePos(u, tt); umbrellaTop(dyn, x, y, u.ring === 0 ? 150 : 128, { rot: sp, cols: u.cols, seed: 300 + i * 9, light: -2.3 - cam.rot }); }
  flush({ t, cam, grey: 0, run: 0 });
  // rain seen from above: streaks flying out from the centre of view (frozen in the grand pause)
  for (let i = 0; i < 160; i++) {
    const ph = ((tf * 1.6 + hash(i * 1.3)) % 1), a = hash(i * 7.7) * Math.PI * 2, d = 80 + ph * 1300 * (.6 + hash(i) * .6);
    dyn.push({ x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, ang: a, len: 10 + ph * 70, wid: 2 + ph * 2, c: [.86, .88, .94], seed: i, type: 3, alpha: .55 * ph, hgt: .2 });
  }
  flush({ t, grey: 0 });
}

// 8 · finale: the chord floods the square with colour; the sun rakes across the paint
function shotFinale(t, tr) {
  const zoom = key(t, [[T.chord, .925], [T.last + .3, 1.04]]), half = W / 2 / zoom;
  const cam = { x: Math.min(WW - half - 4, key(t, [[T.chord, 1056], [T.last + .3, 1180]])), y: key(t, [[T.chord, 596], [T.last + .3, 630]]), zoom };
  plate(P.wide, { t, cam, grey: 1, reveal: T.chord - .05, revDur: .18, revC: [ARCH.x, ARCH.y, 1500], ...tr });
  smallCellist(t, cam, { notes: NB, reveal: -1e6, grey: 0 });
  smallGirl(t, cam, { spin: 0, open: 1 - ss(seg(t, TB(14, 1), TB(14, 1) + .4)) });
  const closing = CROWD.map((p, i) => TB(12, 2) + ((i * 4) % 9) * BEAT_B * .5);
  crowd(t, cam, { popped: () => true, closing });
  // the last notes rise as gold ribbons into the clearing sky
  for (const [i0, n] of NB.entries()) if (n.t >= T.chord - .1) { const i = i0 - NB.findIndex(m => m.t >= T.chord - .1); ribbon(dyn, u => bez([ARCH.x - 70, ARCH.y - 110], [ARCH.x - 170, ARCH.y - 330], [ARCH.x - 380, ARCH.y - 250 - i * 20], [ARCH.x - 540 - i * 70, ARCH.y - 470 - i * 40], u), t, n.t, n.d * 1.6, { cols: ['#ffe08a', '#f8c850', '#ffb870', '#fff0c0'], wid: 13, n: 22, life: 1.8, seed: 90 + i }); }
  flush({ t, cam, grey: 0 });
}

// 9 · end card
function shotEnd(t, tr) {
  plate(P.end, { t, cam: { x: W / 2, y: H / 2, zoom: 1 }, grey: 0, ...tr });
}

// ================= EDIT =================
// [start, fn, transition-in duration (0 = hard cut), post]
const EDIT = [
  [0, shotEcu, 0, 'grey'], [T.cutWide, shotWideGrey, .45, 'grey'], [T.cutMed, shotMedium, .35, 'grey'], [T.splash - .22, shotGirl, 0, 'grey'],
  [T.react, shotReact, 0, 'warm'], [T.cutStreet, shotStreet, .3, 'grey'], [T.cutTop, shotTop, .45, 'warm'], [T.chord, shotFinale, 0, 'warm'], [T.last, shotEnd, .8, 'warm'],
];
function frame(t) {
  let i = 0; while (i < EDIT.length - 1 && t >= EDIT[i + 1][0]) i++;
  E.begin();
  const [t0, fn, d, look] = EDIT[i];
  let post = { ...POST[look] };
  if (d > 0 && t < t0 + d && i > 0) { EDIT[i - 1][1](t, {}); fn(t, { appear: t0, appDur: d }); }
  else fn(t, {});
  // finale light: a low sun rakes across the paint, then settles
  if (fn === shotFinale || fn === shotEnd) {
    const k = seg(t, T.chord, T.chord + 2.2);
    post.light = [lerp(-.95, -.55, ss(k)), lerp(-.15, -.6, ss(k)), lerp(.22, .7, ss(k))];
    post.norm = lerp(7.5, 3.4, ss(k)); post.expo = lerp(1.16, 1.05, ss(k)); post.lightCol = [1, .9, .74]; post.spec = .3;
  }
  if (fn === shotTop && t > T.gp) { post.expo = 1.02; post.sat = .96; }
  E.finish(post);
  credits.style.opacity = String(ss(seg(t, T.last + 1.0, T.last + 1.6)));
}
