// Timeline: 80 BPM (beat 0.75 s). One function t -> scene state. Glass figures step at 8 fps; light and camera move on ones.
import { clamp, lerp, seg, ss, eio, mulberry, hash } from '/core/lib.js';
import { POSE, lerpPose, fk } from './knight.js';
import { DPOSE, lerpD, spine } from './dragon.js';
import { LX, BOT, APEX, FLOOR } from './window.js';
import { smooth, circle } from './glass.js';

export const DUR = 56.5;
const D = Math.PI / 180;
const step = (t, fps = 8) => Math.floor(t * fps + 1e-6) / fps;           // glass moves in held steps
const sp = (t, a, b) => ss(seg(step(t), a, b));                           // stepped smooth progress
const key = (t, ks) => { if (t <= ks[0][0]) return ks[0][1]; for (let i = 0; i < ks.length - 1; i++) { const [t0, v0, e] = ks[i], [t1, v1] = ks[i + 1]; if (t < t1) { const u = (e || eio)(seg(t, t0, t1)); return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], u)) : lerp(v0, v1, u); } } return ks[ks.length - 1][1]; };

// ---------------- voice / subtitles ----------------
export const LINES = [
  { id: 'L1', t: 1.0, d: 3.481, text: 'This window only tells its story where the sun falls.' },
  { id: 'L2', t: 10.0, d: 3.79, text: 'At dawn, a knight was sent to slay the dragon that ate the sun.' },
  { id: 'L3', t: 17.8, d: 3.347, text: 'He crossed the hills and rivers in the white noon light.' },
  { id: 'L4', t: 24.4, d: 3.185, text: 'All afternoon they fought, and the shadows grew longer.' },
  { id: 'L5', t: 33.8, d: 3.799, text: 'Then, in the red of evening, he saw what the dragon was guarding.' },
  { id: 'L6', t: 38.3, d: 3.366, text: 'The last ember of the sun, kept warm until morning.' },
  { id: 'L7', t: 45.0, d: 2.217, text: 'So the knight laid down his sword.' },
  { id: 'L8', t: 49.2, d: 3.693, text: 'And every night since, one pane of glass keeps its own light.' },
];
export const SUBS = LINES.map((l, i) => { const nx = LINES[i + 1]; let t1 = Math.max(l.t + l.d + .6, l.t + 1.8); if (nx) t1 = Math.min(t1, nx.t - .3); return { t0: l.t, t1, text: l.text }; });

// ---------------- light (time of day) ----------------
const DAWN = [.7, .83, 1.0], NOON = [1, .97, .9], AFT = [1, .84, .6], DUSK = [1, .6, .34], VIOLET = [.62, .34, .55], MOON = [.55, .66, 1.0];
function light(t) {
  let sunU = key(t, [[0, LX[0]], [15.6, LX[0]], [17.2, LX[1]], [22.6, LX[1]], [23.4, LX[2]], [30.0, LX[2]], [30.35, LX[3]], [47.2, LX[3]]]);
  let col = key(t, [[0, DAWN], [15.6, DAWN], [17.2, NOON], [22.6, NOON], [23.4, AFT], [29.9, AFT], [30.3, DUSK], [47.2, DUSK], [48.2, VIOLET], [49.2, MOON]]);
  let I = key(t, [[0, 0], [.5, 0, ss], [.56, 2.6, ss], [1.5, 2.2], [15.6, 2.2], [17.2, 2.7], [22.6, 2.7], [23.4, 2.35], [29.9, 2.35], [30.3, 2.6], [47.2, 2.6], [48.4, .6], [49.2, .5], [54.6, .5], [55.4, .9], [56.5, .9]]);
  I *= 1 + .05 * Math.sin(t * 1.7) * Math.sin(t * .63);   // clouds
  let bandW = key(t, [[0, 18], [.5, 18, ss], [1.25, 310], [47.4, 310], [49.2, 3200], [54.8, 3200], [55.6, 310]]);
  if (t < 1.25) sunU = lerp(LX[0] - 140, LX[0], ss(seg(t, .5, 1.25)));
  if (t > 54.8) { sunU = lerp(0, LX[0], ss(seg(t, 54.8, 55.6))); col = col.map((c, j) => lerp(c, DAWN[j], ss(seg(t, 54.8, 55.6)))); }
  else if (t > 47.4) sunU = lerp(LX[3], 0, ss(seg(t, 47.4, 49.2)));
  const sx = key(t, [[0, .42], [15.6, .42], [17.2, .06], [22.6, .06], [23.4, -.28], [29.9, -.44], [30.3, -.52], [47.2, -.6], [49.2, 0]]);
  const sz = key(t, [[0, 1.5], [15.6, 1.5], [17.2, .62], [22.6, .62], [24.2, 1.05, ss], [29.9, 1.95], [30.3, 2.1], [47.2, 2.3], [49.2, 1.2]]);
  const roseI = key(t, [[0, 0], [.6, 0], [1.6, .45], [15.6, .45], [17.2, 1.3], [22.6, 1.3], [23.4, .95], [29.9, .95], [30.3, .65], [47.2, .65], [48.6, 0]]);
  const roseCol = key(t, [[0, [.7, .8, 1]], [15.6, [.7, .8, 1]], [17.2, [1, .95, .85]], [23.4, [1, .82, .6]], [30.3, [1, .5, .3]]]);
  const amb = key(t, [[0, .03], [.6, .03], [1.8, .13], [15.6, .13], [17.2, .22], [22.6, .22], [23.4, .18], [29.9, .18], [30.3, .14], [47.2, .14], [49.2, .1], [56.5, .1]]);
  const ambCol = key(t, [[0, [.7, .76, .9]], [15.6, [.7, .76, .9]], [17.2, [.9, .88, .82]], [23.4, [.9, .8, .7]], [30.3, [.9, .62, .5]], [47.2, [.9, .62, .5]], [49.2, [.5, .58, .8]]]);
  const skyI = key(t, [[0, .02], [1.5, .12], [17.2, .16], [30.3, .12], [47.2, .12], [49.2, .06]]);
  const skyCol = key(t, [[0, [.5, .6, .9]], [17.2, [.6, .72, .95]], [30.3, [.8, .45, .5]], [49.2, [.4, .5, .9]]]);
  const skew = key(t, [[0, .45], [.5, .45], [1.4, .06]]);
  return { skew, sunU, sunCol: col, sunI: Math.max(0, I), bandW, sx, sz, roseI, roseCol, amb, ambCol, skyI, skyCol };
}

// ---------------- lancet contents ----------------
const Kst = (pose, x, y, s, flip) => ({ pose, x, y, s, flip });
function lancetI(t) {
  const lt = Math.min(t, 15.9);
  let p = { ...POSE.stand, neck: lerp(14 * D, 0, sp(lt, 2.5, 2.75)), face: 'resolute' };
  p = lerpPose(p, POSE.raise, sp(lt, 10.6, 11.1));
  return { knight: Kst(p, -20, 288, 1) };
}
function lancetII(t) {
  const lt = clamp(t, 16.9, 22.95), k = Math.floor((lt - 17.2) / .375 + 1e-6);
  const cyc = [POSE.walkA, lerpPose(POSE.walkA, POSE.walkB, .5), POSE.walkB, lerpPose(POSE.walkB, POSE.walkA, .5)];
  const p = { ...cyc[((k % 4) + 4) % 4] };
  const bob = (k & 1) ? -4 : 0;
  const dv = seg(t, 19.6, 21.8);
  return { knight: Kst(p, -6, 318 + bob, 1), scroll: Math.max(0, k) * .22, doveX: dv > 0 && dv < 1 ? lerp(-190, 190, dv) : null, flap: Math.floor(t * 6) & 1 };
}
function lancetIII(t) {
  const lt = clamp(t, 0, 30.0);
  let k = { ...POSE.guard }, d = JSON.parse(JSON.stringify(DPOSE.rear));
  const lunge = { neck: [22, 30, 34, 38], head: 30, jaw: 34, rootA: -70 };
  const beat = (a) => sp(lt, a, a + .25) * (1 - sp(lt, a + .5, a + .75));
  d = lerpD(d, { ...d, ...lunge }, beat(24.75));
  k = lerpPose(k, { ...POSE.blow, face: 'fierce' }, beat(26.25));
  d = lerpD(d, { ...d, wing: { ...d.wing, humA: -150, foreA: 90 }, rootA: -90 }, beat(27.75));
  k = lerpPose(k, { ...POSE.strike }, sp(lt, 29.25, 29.5));
  return { knight: Kst(k, -80, 424, .76), dragon: { pose: d, x: 70, y: 214, s: .78, flip: true }, rock: 1 };
}
// crack network (world coords around the impact point in lancet IV)
const IMPACT = [LX[3] - 22, 452];
const CRACKS = (() => {
  const rnd = mulberry(31), out = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + rnd() * .5; let x = IMPACT[0], y = IMPACT[1], ang = a; const pts = [[x, y]];
    const L = 70 + rnd() * 170;
    for (let l = 0; l < L; l += 14) { ang += (rnd() - .5) * .7; x += Math.cos(ang) * 14; y += Math.sin(ang) * 14; pts.push([x, y]); if (Math.abs(x - LX[3]) > 150 || y < APEX || y > BOT) break; }
    out.push({ pts, delay: rnd() * .12, w: 2.6 + rnd() * 2 });
    if (rnd() < .6) { const j = 2 + Math.floor(rnd() * (pts.length - 3)); let [bx, by] = pts[Math.max(0, j)], ba = ang + (rnd() > .5 ? 1 : -1) * (.6 + rnd() * .5); const bp = [[bx, by]]; for (let l = 0; l < 90; l += 12) { ba += (rnd() - .5) * .6; bx += Math.cos(ba) * 12; by += Math.sin(ba) * 12; bp.push([bx, by]); } out.push({ pts: bp, delay: .1 + rnd() * .1, w: 1.2 }); }
  }
  return out;
})();
export const WELDS = [41.75, 42.5, 43.25, 44.0, 44.6];
const T_BLOW = 31.8;
function crackAfter(t) {
  return (P, base) => {
    if (t < T_BLOW) return;
    P.setTransform(base);
    const g = P.g, s = P.s, grow = seg(t, T_BLOW, T_BLOW + .28);
    CRACKS.forEach((c, i) => {
      const f = clamp((grow - c.delay) / (1 - c.delay)), n = Math.max(2, Math.ceil(c.pts.length * f)); if (f <= 0) return;
      const pts = c.pts.slice(0, n), path = new Path2D(); pts.forEach((q, k) => k ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]));
      const mended = t >= WELDS[i % 4];
      if (!mended) { g.strokeStyle = 'rgba(255,248,232,.95)'; g.lineWidth = c.w; g.lineJoin = 'round'; g.stroke(path);   // light pours through the fresh crack
        if (P.mode === 'full') { s.strokeStyle = 'rgba(20,20,24,.55)'; s.lineWidth = c.w * .5; s.stroke(path); } }
      else P.lead(path, 3.2);   // mending lead: the scar stays
    });
  };
}
function knightIV(t) {
  // before the blow: guard -> raise overhead -> blow
  let p = { ...POSE.guard, face: 'fierce' };
  p = lerpPose(p, POSE.strike, sp(t, 30.25, 30.75));
  p = lerpPose(p, POSE.blow, sp(t, 31.65, 31.8));
  // after the crack he lowers the sword and straightens, looking at what the coil holds
  p = lerpPose(p, { ...POSE.stand, wF: 30 * D, sF: -6 * D, eF: -30 * D, neck: 10 * D, lean: 2 * D, sB: 14 * D, eB: -24 * D, shA: -8 * D, shX: -10, shY: 20 }, sp(t, 33.6, 34.6));
  if (t >= 34.3) p.face = t < 38.9 ? 'wonder' : 'gentle';
  // re-lead: groups of pieces slide one after another into the kneeling pose
  const K = { ...POSE.kneel }, off = {};
  if (t > 41.3) {
    const win = (a) => sp(t, a - .5, a);
    const gs = win(WELDS[0]), gl = win(WELDS[1]), gt = win(WELDS[2]), ga = win(WELDS[3]);
    const J0 = fk({ ...POSE.stand, wF: 30 * D, sF: -6 * D, eF: -30 * D, neck: 10 * D, lean: 2 * D, sB: 14 * D, eB: -24 * D, shA: -8 * D, shX: -10, shY: 20 }).sword, tgt = K.sword;
    p.sword = { free: true, x: lerp(J0[0], tgt.x, gs), y: lerp(J0[1], tgt.y, gs), a: lerp(J0[2], tgt.a - 2 * Math.PI * 0, gs) };
    for (const k of ['hB', 'kB', 'aB', 'hF', 'kF', 'aF', 'rootDy']) p[k] = lerp(p[k] ?? 0, K[k] ?? 0, gl);
    p.sword.y += (K.rootDy - p.rootDy) * gs;   // the sword lies on the ground, not on the (still standing) body
    for (const k of ['lean', 'neck']) p[k] = lerp(p[k] ?? 0, K[k] ?? 0, gt);
    for (const k of ['sF', 'eF', 'sB', 'eB', 'shA', 'shX', 'shY']) p[k] = lerp(p[k] ?? 0, K[k] ?? 0, ga);
    const bump = (a, parts, dx, dy) => { const u = sp(t, a - .5, a), b = Math.sin(u * Math.PI) * 7; for (const q of parts) off[q] = [dx * b, dy * b, 0]; };
    bump(WELDS[1], ['thB', 'shB', 'ftB', 'thF', 'shF', 'ftF'], 0, 1);
    bump(WELDS[2], ['torso', 'skirt', 'cloak', 'head'], -1, 0);
    bump(WELDS[3], ['upF', 'foF', 'haF', 'upB', 'foB', 'haB', 'shield'], 1, -1);
  }
  const shake = t > T_BLOW && t < T_BLOW + .1 ? 3 : 0;
  return { pose: p, x: -94 + shake, y: 429, s: .64, o: { off } };
}
export function emberLit(t) { return t < 32.5 ? 0 : clamp(ss(seg(t, 32.5, 34.8))); }
const DX = 22, DY = 480, DS = .68;
const REVEAL = { ...JSON.parse(JSON.stringify(DPOSE.coil)), neckL: 28, neck: [-20, -40, -30, -20], head: -160, headS: 1.05, eyeLid: .5, look: -1 };
function lancetIV(t) {
  const lt = t;
  let d = JSON.parse(JSON.stringify(DPOSE.coil));
  // reveal: the coil stays whole around the ember; the head lifts a little, eyes soften, still facing the knight
  d = lerpD(d, REVEAL, sp(lt, 33.0, 34.3));
  const k = knightIV(lt);
  return { knight: k, dragon: { pose: d, x: DX, y: DY, s: DS, flip: true, o: { ember: { r: 27, lit: emberLit(t) } } }, after: crackAfter(t) };
}
// ember in world coords (for its glow)
export function emberWorld(t) {
  const L = lancetIV(t), d = L.dragon, s = spine(d.pose); let x = 0, y = 0, n = 0;
  for (let k = 1; k < s.nT - 1; k++) { x += s.pts[k][0]; y += s.pts[k][1]; n++; }
  x /= n; y /= n; return [LX[3] + d.x + (d.flip ? -1 : 1) * x * d.s, d.y + y * d.s];
}
export function knightJointWorld(t, name) {
  const k = knightIV(t), J = fk(k.pose), j = J[name];
  return [LX[3] + k.x + j[0] * k.s, k.y + (k.pose.rootDy || 0) * k.s + j[1] * k.s];
}

// ---------------- camera ----------------
function camera(t) {
  const W = [0, 175, .5];
  if (t < 4.8) return key(t, [[0, [LX[0], 236, 1.32]], [4.8, [LX[0], 214, 1.42]]]);
  if (t < 9.6) return key(t, [[4.8, [LX[0], 214, 1.42]], [7.3, W], [9.6, [0, 178, .52]]]);
  if (t < 15.6) return key(t, [[9.6, [0, 178, .52]], [11.0, [LX[0], 190, 1.28]], [15.6, [LX[0], 180, 1.34]]]);
  if (t < 17.2) return key(t, [[15.6, [LX[0], 180, 1.34]], [17.2, [LX[1], 200, 1.3]]]);
  if (t < 22.6) return key(t, [[17.2, [LX[1], 200, 1.3]], [22.6, [LX[1], 190, 1.36]]]);
  if (t < 24.2) return key(t, [[22.6, [LX[1], 190, 1.36]], [23.4, [LX[2], 220, 1.3]], [24.2, [LX[2] - 120, 1180, .8]]]);
  if (t < 30.0) return [LX[2], 300, 1];   // top-down floor shot (topCam used)
  if (t < 33.8) return key(t, [[30.0, [LX[3], 330, 1.3]], [33.8, [LX[3], 340, 1.36]]]);
  if (t < 41.3) return key(t, [[33.8, [LX[3], 340, 1.36]], [36.4, [LX[3] + 20, 468, 2.85]], [41.3, [LX[3] + 22, 470, 2.95]]]);
  if (t < 47.2) return key(t, [[41.3, [LX[3] + 22, 470, 2.95]], [42.6, [LX[3], 420, 1.9]], [47.2, [LX[3], 412, 1.96]]]);
  return key(t, [[47.2, [LX[3], 412, 1.96]], [51.2, W], [52.9, [0, 182, .52]], [55.0, [-60, 640, 1.0]], [56.5, [-60, 636, 1.02]]]);
}

// ---------------- events (sfx / music cues for the mixer) ----------------
export const EV = [];
EV.push({ t: .5, type: 'beam' }, { t: 5.4, type: 'title' }, { t: 2.5, type: 'tink', v: .5 }, { t: 10.6, type: 'tink', v: .5 }, { t: 11.1, type: 'tink', v: .8 });
EV.push({ t: 15.6, type: 'move', d: 1.6 }, { t: 22.6, type: 'move', d: .8 }, { t: 29.95, type: 'move', d: .4 }, { t: 47.4, type: 'dusk' }, { t: 54.8, type: 'dawnwink' });
for (let k = 0; k < 15; k++) { const tt = 17.2 + k * .375; if (tt < 22.9) EV.push({ t: tt, type: 'step', v: k & 1 ? .5 : .8 }); }
EV.push({ t: 20.0, type: 'wings' }, { t: 21.0, type: 'wings' });
for (const a of [24.75, 26.25, 27.75, 29.25]) EV.push({ t: a, type: 'clash' });
EV.push({ t: 30.25, type: 'creak' }, { t: 31.8, type: 'crack' }, { t: 33.0, type: 'grind', d: 1.3 }, { t: 32.6, type: 'ignite' });
WELDS.forEach((w, i) => EV.push({ t: w - .5, type: 'slide', d: .5 }, { t: w, type: i === 4 ? 'bell' : 'weld', i }));
LINES.forEach(l => EV.push({ t: l.t, type: 'voice', id: l.id }));
EV.push({ t: 52.9, type: 'endcard' });
SUBS.forEach(q => EV.push({ t: q.t0, type: 'sub', t1: q.t1, text: q.text }));
EV.sort((a, b) => a.t - b.t);

// ---------------- state ----------------
export function state(t) {
  const Lt = light(t), cam = camera(t);
  const st = { ...Lt, cam, time: t, lancets: [lancetI(t), lancetII(t), lancetIII(t), lancetIV(t)], floorMode: 1, floor: { camD: 2600, eyeH: 320 } };
  // opening darkness
  st.fade = key(t, [[0, 1], [.35, 1], [.6, 0], [55.9, 0], [56.5, 1]]);
  if (t >= 24.2 && t < 30.0) {   // top-down: the duel in the light patch
    st.floorMode = 2;
    const z = key(t, [[24.2, 1.3], [30.0, 1.05]]), zc = key(t, [[24.2, [60, 780]], [30.0, [120, 980]]]);
    st.topCam = [zc[0], zc[1], z]; st.pm = [-900, 150, 1500, 2300]; st.pmBlur = 2; st.patchK = 3.0; st.amb = .2; st.vign = .5; st.bloom = .65; st.thr = .45;
  }
  // points: ember glow, weld sparks
  const pts = [];
  const eL = emberLit(t);
  if (eL > 0) { const e = emberWorld(t), pulse = 1 + .12 * Math.sin(t * 3.1) + .06 * Math.sin(t * 7.3); const nt = seg(t, 47.2, 49.5); const rv = seg(t, 34.0, 36.0) * (1 - seg(t, 44.6, 47.2)) * .5; pts.push([e[0], e[1], (44 + 36 * eL) * (1 + .7 * nt + rv * .4), eL * 3.4 * pulse * (1 + .9 * nt + rv), [1, .55, .2]]); }
  const joints = ['shield', 'thF', 'torso', 'upF', 'head'];
  WELDS.forEach((w, i) => { const u = seg(t, w, w + .45); if (u > 0 && u < 1) { const j = knightJointWorld(w + .01, joints[i]); pts.push([j[0], j[1], 14, 5 * (1 - u) * (1 - u), [1, .8, .5]]); } });
  const fl = seg(t, T_BLOW, T_BLOW + .45); if (fl > 0 && fl < 1) pts.push([IMPACT[0], IMPACT[1], 40 + 90 * fl, 7 * (1 - fl) * (1 - fl), [1, .95, .85]]);
  st.pts = pts;
  // title / end card carved in the stone band (a sweep of light reveals it)
  const endA = seg(t, 52.9, 53.5);
  st.inscription = [['THE DRAGON OF THE EAST WINDOW', 60, 0, 1 - endA], ['STAINED GLASS', 64, -14, endA], ['LEMOLAB × CLAUDE OPUS 5.5', 30, 34, endA]];
  st.gild = key(t, [[0, 0], [5.4, 0], [7.0, .85], [47, .85], [49, .35], [52.9, .35], [53.6, 0]]);
  const sw = seg(t, 5.2, 7.6), sw2 = seg(t, 52.9, 55.0);
  if (sw > 0 && sw < 1) st.sweep = [lerp(-1100, 1100, sw), 380, 1.9 * Math.sin(sw * Math.PI), BOT + 166];
  else if (sw2 > 0) st.sweep = [lerp(-1000, -40, eio(sw2)), lerp(420, 760, sw2), 2.6 * ss(sw2 * 1.6), BOT + 166];
  else if (t > 7.6 && t < 49) st.sweep = [0, 900, key(t, [[7.6, .9], [9.6, .9], [11, .25]]), BOT + 166];
  return st;
}
