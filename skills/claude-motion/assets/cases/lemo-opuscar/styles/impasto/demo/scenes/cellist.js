// The street cellist. Local units: origin = floor under the crate, y up is negative; seated height ~1000.
// Plates: body (crate, legs, torso, cello, open case, fingering arm) and head (pivots at the neck).
// The bow arm is procedural (IK) so the bow really travels on each note.
import { Ref, paintRef, rnd } from '../engine/plate.js';
import { KNIFE, BRUSH, DAB, LINE, hex } from '../engine/impasto.js';
import { P, E, lin, rad, lerp } from './common.js';

export const CEL = {
  neck: [0, -735],              // head pivot
  shoulderR: [-178, -672],      // bow-arm shoulder (screen left)
  cello: { cx: 0, cy: -330, ang: .15 },
  coat: '#2c3a66', coat2: '#42538c', coatD: '#1a2240', skin: '#e2a887', bow: '#3a2418', hair: '#efe6d2',
};
// point in cello frame -> local
export const celloPt = (x, y) => { const a = CEL.cello.ang, c = Math.cos(a), s = Math.sin(a); return [CEL.cello.cx + c * x - s * y, CEL.cello.cy + s * x + c * y]; };
CEL.contact = celloPt(0, 14);
const OX = 560, OY = 1060;      // ref canvas origin offset (local -> ref pixels before scale)
const RW = 1120, RH = 1120;

// cello outline around (0,0), upright; h = body height
function celloPath(c, h) {
  const w = h * .3;
  c.moveTo(0, -h * .5);
  c.bezierCurveTo(w * .75, -h * .5, w * .95, -h * .38, w * .88, -h * .22);
  c.bezierCurveTo(w * .8, -h * .12, w * .6, -h * .08, w * .62, 0);
  c.bezierCurveTo(w * .64, h * .08, w * 1.02, h * .14, w * 1.02, h * .3);
  c.bezierCurveTo(w * 1.02, h * .46, w * .6, h * .5, 0, h * .5);
  c.bezierCurveTo(-w * .6, h * .5, -w * 1.02, h * .46, -w * 1.02, h * .3);
  c.bezierCurveTo(-w * 1.02, h * .14, -w * .64, h * .08, -w * .62, 0);
  c.bezierCurveTo(-w * .6, -h * .08, -w * .8, -h * .12, -w * .88, -h * .22);
  c.bezierCurveTo(-w * .95, -h * .38, -w * .75, -h * .5, 0, -h * .5);
}
const inLocal = (c, f) => { c.save(); c.translate(OX, OY); f(c); c.restore(); };
const inCello = (c, f) => { c.save(); c.translate(OX + CEL.cello.cx, OY + CEL.cello.cy); c.rotate(CEL.cello.ang); f(c); c.restore(); };

export function drawBody(R) {
  const L = (path, fill, props) => R.fill(c => inLocal(c, path), fill, props);
  const Cc = (path, fill, props) => R.fill(c => inCello(c, path), fill, props);
  // open cello case on the ground, front-left
  L(P([[-540, -30], [-330, -110], [-190, -60], [-400, 25]]), '#1e1a22', { dir: 20, group: 'case', maxR: 16 });
  L(P([[-515, -35], [-335, -102], [-215, -62], [-395, 10]]), lin(0, -110, 0, 10, [[0, '#c02c3c'], [1, '#801a28']]), { dir: 20, group: 'velvet', maxR: 12 });
  L(E(-360, -45, 16, 7, -.3), '#f0c050', { maxR: 3, group: 'coin1' });
  L(E(-305, -30, 13, 6, -.3), '#e8b848', { maxR: 3, group: 'coin2' });
  // crate
  L(P([[-200, -330], [200, -330], [205, 0], [-205, 0]]), lin(0, -330, 0, 0, [[0, '#a07a52'], [1, '#6a4e36']]), { dir: 0, group: 'crate', maxR: 18 });
  for (let k = 1; k < 4; k++) L(P([[-200, -330 + k * 82], [200, -330 + k * 82], [200, -324 + k * 82], [-200, -324 + k * 82]]), '#4a3626', { dir: 0, group: 'crate', maxR: 4 });
  // torso (behind the cello): broad navy coat, lit from screen-left
  L(c => { c.moveTo(-205, -660); c.bezierCurveTo(-170, -735, -80, -752, 0, -752); c.bezierCurveTo(80, -752, 170, -735, 205, -660); c.bezierCurveTo(222, -560, 232, -420, 245, -320); c.lineTo(-245, -320); c.bezierCurveTo(-232, -420, -222, -560, -205, -660); c.closePath(); },
    lin(-215, 0, 215, 0, [[0, '#566aa6'], [.35, CEL.coat2], [.7, CEL.coat], [1, CEL.coatD]]), { dir: 90, group: 'coat', maxR: 22 });
  // scarf
  L(c => { c.moveTo(-95, -735); c.bezierCurveTo(-40, -700, 40, -700, 95, -735); c.lineTo(100, -695); c.bezierCurveTo(40, -660, -40, -660, -100, -695); c.closePath(); }, lin(-100, 0, 100, 0, [[0, '#ecb84a'], [1, '#b88420']]), { dir: 0, group: 'scarf', maxR: 9 });
  L(P([[-60, -690], [-20, -688], [-30, -540], [-70, -545]]), '#d8a236', { dir: 95, group: 'scarf', maxR: 8 });
  // thighs + knees either side of the cello, shins, shoes
  L(c => { c.moveTo(-190, -360); c.bezierCurveTo(-250, -420, -300, -390, -292, -340); c.bezierCurveTo(-285, -240, -270, -120, -262, -25); c.lineTo(-206, -25); c.bezierCurveTo(-200, -140, -190, -250, -185, -320); c.closePath(); }, lin(-300, 0, -185, 0, [[0, '#6a5852'], [1, '#3a302e']]), { dir: 90, group: 'legL', maxR: 14 });
  L(c => { c.moveTo(190, -360); c.bezierCurveTo(250, -420, 300, -390, 292, -340); c.bezierCurveTo(285, -240, 270, -120, 262, -25); c.lineTo(206, -25); c.bezierCurveTo(200, -140, 190, -250, 185, -320); c.closePath(); }, lin(185, 0, 300, 0, [[0, '#4a3c3a'], [1, '#262022']]), { dir: 90, group: 'legR', maxR: 14 });
  L(E(-240, -372, 58, 44, -.3), lin(-290, -410, -200, -330, [[0, '#8a766c'], [1, '#54443e']]), { maxR: 10, group: 'kneeL' }); L(E(240, -372, 58, 44, .3), lin(200, -410, 290, -330, [[0, '#6a5a52'], [1, '#3a302c']]), { maxR: 10, group: 'kneeR' });
  L(E(-245, -10, 70, 24), '#1a1618', { maxR: 8, group: 'shoe1' }); L(E(245, -10, 70, 24), '#141012', { maxR: 8, group: 'shoe2' });
  // cello body between the knees
  Cc(c => celloPath(c, 520), rad(-70, -80, 20, 340, [[0, '#e08638'], [.5, '#b45a20'], [1, '#6a2a12']]), { dir: { radial: [CEL.cello.cx, CEL.cello.cy], off: 90 }, group: 'cello', maxR: 16, hgt: 1.1 });
  Cc(P([[-13, -540], [13, -540], [22, -110], [-22, -110]]), '#221a18', { dir: 90, group: 'fb', maxR: 5 });
  Cc(P([[-22, 150], [22, 150], [15, 240], [-15, 240]]), '#1a1414', { dir: 90, group: 'tail', maxR: 5 });
  Cc(P([[-48, 50], [48, 50], [42, 62], [-42, 62]]), '#ecd6a8', { dir: 0, group: 'bridge', maxR: 3 });
  R.line(c => inCello(c, c2 => { c2.moveTo(-58, -30); c2.bezierCurveTo(-72, 15, -48, 55, -62, 110); }), '#1e0e08', 7, { dir: 'edge', group: 'fh1', maxR: 3 });
  R.line(c => inCello(c, c2 => { c2.moveTo(58, -30); c2.bezierCurveTo(72, 15, 48, 55, 62, 110); }), '#1e0e08', 7, { dir: 'edge', group: 'fh2', maxR: 3 });
  R.line(c => inCello(c, c2 => { c2.moveTo(0, 240); c2.lineTo(0, 335); }), '#a8a8b0', 5, { dir: 90, group: 'pin', maxR: 3 });
  // strings (pale, thin)
  for (const x of [-9, -3, 3, 9]) R.line(c => inCello(c, c2 => { c2.moveTo(x * .8, -540); c2.lineTo(x * 1.4, 150); }), '#e6dcc4', 1.6, { dir: 90, group: 'str', maxR: 1.5, type: 3 });
  // neck + scroll (upper part, beside his left cheek)
  Cc(P([[-12, -540], [12, -540], [10, -560], [-10, -560]]), '#221a18', { dir: 90, group: 'fb', maxR: 4 });
  Cc(c => { c.moveTo(-11, -560); c.bezierCurveTo(-32, -575, -28, -628, 0, -628); c.bezierCurveTo(30, -628, 34, -578, 11, -560); c.closePath(); }, '#9a4a1e', { dir: 90, group: 'scroll', maxR: 5 });
  // fingering arm (screen right): shoulder -> elbow out -> hand on the neck
  L(c => { c.moveTo(150, -720); c.bezierCurveTo(230, -700, 290, -640, 300, -560); c.lineTo(250, -530); c.bezierCurveTo(230, -600, 190, -640, 130, -650); c.closePath(); }, lin(130, 0, 300, 0, [[0, CEL.coat], [1, CEL.coatD]]), { dir: 120, group: 'larm', maxR: 12 });
  // light accents: varnish glints and the lamp's rim light (thick, pure strokes)
  for (const [x, y, l, a] of [[-95, -170, 70, -1.2], [-118, -90, 44, -1.5], [-108, 60, 60, -1.7], [-60, -225, 34, -.5]]) { const [px, py] = celloPt(x, y); R.fill(c => inLocal(c, c2 => { c2.ellipse(px, py, l / 2, 7, a + CEL.cello.ang, 0, 7); }), '#ffd49a', { maxR: 4, group: 'glint' + x, hgt: 1.4 }); }
  L(c => { c.moveTo(-205, -655); c.bezierCurveTo(-222, -560, -232, -420, -244, -330); c.lineTo(-230, -330); c.bezierCurveTo(-216, -430, -208, -560, -192, -650); c.closePath(); }, '#7a90d0', { dir: 90, group: 'rim1', maxR: 5 });
  const hn = celloPt(0, -470);
  L(c => { c.moveTo(300, -570); c.lineTo(hn[0] + 40, hn[1] - 20); c.lineTo(hn[0] + 30, hn[1] + 30); c.lineTo(255, -525); c.closePath(); }, lin(hn[0], 0, 300, 0, [[0, CEL.coat2], [1, CEL.coatD]]), { dir: 50, group: 'larm2', maxR: 12 });
  L(E(hn[0] + 18, hn[1] + 4, 32, 26, -.7), CEL.skin, { maxR: 5, group: 'lhand' });
}

// head (drawn around the neck pivot): frontal 3/4, turned a little to screen-left. Eyes/brows are procedural (see face()).
export function drawHead(R) {
  const L = (path, fill, props) => R.fill(c => inLocal(c, path), fill, props);
  L(P([[-45, -770], [45, -770], [40, -720], [-40, -720]]), '#b8785e', { dir: 90, group: 'neck', maxR: 6 });
  // ears
  L(E(-80, -835, 13, 22, .1), '#d08a70', { maxR: 4, group: 'earL' }); L(E(70, -835, 12, 21, -.1), '#a86a58', { maxR: 4, group: 'earR' });
  // face: lamp from screen-left
  L(c => { c.ellipse(-6, -835, 74, 92, 0, 0, 7); }, lin(-80, 0, 70, 0, [[0, '#f4c49c'], [.45, '#e0a07e'], [1, '#a8685a']]), { dir: 'edge', fallback: 90, group: 'face', maxR: 7, detail: .8 });
  R.tint(c => inLocal(c, c2 => c2.ellipse(-44, -812, 26, 16, 0, 0, 7)), 'rgba(226,120,96,.55)');
  R.tint(c => inLocal(c, c2 => c2.ellipse(34, -812, 20, 14, 0, 0, 7)), 'rgba(180,96,90,.45)');
  // shadow side of the face (cool), eye sockets, lit forehead plane
  R.tint(c => inLocal(c, c2 => { c2.moveTo(8, -925); c2.bezierCurveTo(60, -900, 76, -820, 50, -760); c2.lineTo(20, -760); c2.bezierCurveTo(30, -820, 26, -880, 8, -925); }), 'rgba(110,80,110,.45)');
  R.tint(c => inLocal(c, c2 => { c2.ellipse(-36, -845, 22, 11, 0, 0, 7); c2.ellipse(24, -845, 20, 11, 0, 0, 7); }), 'rgba(150,80,70,.35)');
  R.tint(c => inLocal(c, c2 => c2.ellipse(-30, -885, 40, 14, -.1, 0, 7)), 'rgba(255,220,180,.5)');
  // nose
  L(c => { c.moveTo(-14, -842); c.lineTo(-24, -800); c.bezierCurveTo(-14, -792, 4, -792, 8, -800); c.lineTo(0, -842); c.closePath(); }, lin(-24, 0, 8, 0, [[0, '#f0b08e'], [1, '#c07a64']]), { dir: 90, group: 'nose', maxR: 3 });
  // beard + moustache: warm white, lilac shade
  L(c => { c.moveTo(-74, -812); c.bezierCurveTo(-82, -750, -44, -700, -6, -696); c.bezierCurveTo(34, -700, 70, -750, 64, -812); c.bezierCurveTo(40, -790, -50, -790, -74, -812); c.closePath(); },
    lin(-80, 0, 70, 0, [[0, '#fffaf0'], [.55, '#efe6dc'], [1, '#c4b6b0']]), { dir: 92, group: 'beard', maxR: 7 });
  L(c => { c.moveTo(-50, -792); c.bezierCurveTo(-30, -806, 12, -806, 30, -792); c.bezierCurveTo(12, -782, -30, -782, -50, -792); c.closePath(); }, '#fffaf2', { dir: 0, group: 'moust', maxR: 3 });
  // flat cap with brim toward us-left
  L(c => { c.moveTo(-86, -872); c.bezierCurveTo(-96, -950, 70, -960, 82, -880); c.bezierCurveTo(40, -890, -40, -892, -86, -872); c.closePath(); }, lin(0, -955, 0, -872, [[0, '#7a6a5a'], [1, '#4a3e34']]), { dir: 8, group: 'cap', maxR: 10 });
  L(c => { c.moveTo(-80, -900); c.bezierCurveTo(-60, -935, -20, -945, 10, -944); c.bezierCurveTo(-24, -936, -56, -920, -70, -896); c.closePath(); }, '#a89480', { dir: 10, group: 'caphl', maxR: 4 });
  L(c => { c.moveTo(-96, -872); c.bezierCurveTo(-60, -896, 40, -898, 76, -880); c.bezierCurveTo(50, -862, -50, -856, -96, -872); c.closePath(); }, '#2e2622', { dir: 0, group: 'brim', maxR: 4 });
}
// procedural eyes + brows in head-local units. gaze: [-1..1, -1..1] (x left/right, y up/down); lid: 0 open .. 1 closed; lift: brows up
export function face(out, { gaze = [-.3, .6], lid = .3, lift = 0, rev = 0 } = {}) {
  const ink = hex('#2a1a1a'), brow = hex('#f6f2ea');
  for (const [ex, k] of [[-36, 1], [24, .9]]) {
    const ey = -840 + gaze[1] * 4;
    const h = 13 * (1 - lid * .7);
    out.push({ x: ex + gaze[0] * 6, y: ey, ang: 0, len: 21 * k, wid: h, c: ink, seed: ex, type: 2, hgt: .6, rev });
    out.push({ x: ex, y: -860 - lift * 12 + lid * 3, ang: (ex < 0 ? -.12 : .12) - lift * (ex < 0 ? .25 : -.25), len: 32 * k, wid: 9, c: brow, c2: hex('#d6d0cc'), seed: ex + 5, type: 0, hgt: .9, rev });
  }
}

// build plates at a given scale (ref px per unit)
export function buildCellist(scale = 1, seed = 5) {
  const mk = (draw, R0) => {
    const R = new Ref(RW, RH, scale); draw(R);
    const st = paintRef(R, { R: R0, T: 12, seed, rev: (x, y) => Math.hypot(x - (OX + CEL.contact[0]), y - (OY + CEL.contact[1])) / 900 });
    // strokes are in ref units; shift to local (origin under the crate)
    const a = st.a; for (let i = 0; i < st.n; i++) { a[i * 20] -= OX; a[i * 20 + 1] -= OY; }
    return { strokes: st, ref: R, ox: OX, oy: OY };
  };
  const k = Math.max(.25, scale);
  return {
    body: mk(drawBody, [30, 15, 8, 4, 2.2].map(r => r * k).filter(r => r >= 1.2)),
    head: mk(drawHead, [12, 6, 3.2, 1.8].map(r => r * k).filter(r => r >= 1)),
  };
}

// ---- procedural bow arm. p = bow position 0 (frog near the string) .. 1 (tip at the string)
const BOW_LEN = 720;
export function bowArm(out, p, { lift = 0, rest = 0, rev = 0 } = {}) {
  const sa = CEL.cello.ang;
  const bd = [Math.cos(sa), Math.sin(sa)];        // bow direction (toward the tip = screen right)
  const [cx, cy] = CEL.contact;
  const along = 70 + p * 470;                      // hand distance from the contact point
  let hx = cx - bd[0] * along, hy = cy - bd[1] * along - lift * 45;
  let tipx = hx + bd[0] * BOW_LEN, tipy = hy + bd[1] * BOW_LEN;
  if (rest > 0) {                                  // bow lowered onto the knee
    const rh = [-230, -380], rt = [260, -150];
    hx = lerp(hx, rh[0], rest); hy = lerp(hy, rh[1], rest); tipx = lerp(tipx, rt[0], rest); tipy = lerp(tipy, rt[1], rest);
  }
  const [sx, sy] = CEL.shoulderR, l1 = 235, l2 = 235;
  const dx = hx - sx, dy = hy - sy, d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1);
  const a = Math.atan2(dy, dx), cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), e = a + Math.acos(Math.max(-1, Math.min(1, cosA)));
  const ex = sx + Math.cos(e) * l1, ey = sy + Math.sin(e) * l1;
  const coat = hex(CEL.coat), coat2 = hex(CEL.coat2), dk = hex(CEL.coatD), sk = hex(CEL.skin), lit = hex('#5a70ae');
  const seg = (x0, y0, x1, y1, w, c, c2, sd, taper = 0) => out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, ang: Math.atan2(y1 - y0, x1 - x0), len: Math.hypot(x1 - x0, y1 - y0) * 1.08, wid: w, c, c2, seed: sd, type: KNIFE, rev, hgt: 1, taper });
  // bow: hair (pale ribbon) + stick (dark line) + frog
  const bang = Math.atan2(tipy - hy, tipx - hx);
  out.push({ x: (tipx + hx) / 2, y: (tipy + hy) / 2, ang: bang, len: BOW_LEN, wid: 7, c: hex(CEL.hair), c2: hex('#d8ccb4'), seed: 11, type: KNIFE, rev, hgt: .5 });
  out.push({ x: (tipx + hx) / 2 + Math.sin(bang) * 7, y: (tipy + hy) / 2 - Math.cos(bang) * 7, ang: bang, len: BOW_LEN, wid: 5, c: hex(CEL.bow), c2: hex('#5a3420'), seed: 12, type: LINE, rev });
  out.push({ x: hx + Math.cos(bang) * 18, y: hy + Math.sin(bang) * 18 + 2, ang: bang, len: 44, wid: 16, c: hex('#1a1210'), seed: 13, type: KNIFE, rev });
  // upper arm + forearm: lit edge + body + shade for volume
  seg(sx, sy, ex, ey, 96, coat2, coat, 21, .1); seg(sx - 14, sy - 6, ex - 12, ey - 4, 34, lit, coat2, 22); seg(sx + 16, sy + 10, ex + 14, ey + 6, 34, dk, coat, 27);
  seg(ex, ey, hx, hy, 78, coat2, coat, 23, .15); seg(ex - 8, ey - 10, hx - 6, hy - 10, 26, lit, coat2, 24);
  out.push({ x: sx + 4, y: sy + 14, ang: -.4, len: 96, wid: 84, c: coat, c2: coat2, seed: 28, type: KNIFE, rev, hgt: .8 });
  out.push({ x: hx + (ex - hx) * .1, y: hy + (ey - hy) * .1, ang: Math.atan2(hy - ey, hx - ex), len: 22, wid: 68, c: hex('#d8a236'), seed: 25, type: KNIFE, rev });
  out.push({ x: hx + 4, y: hy + 2, ang: bang, len: 56, wid: 40, c: sk, c2: hex('#c07a60'), seed: 26, type: DAB, rev });
  return { hx, hy, tipx, tipy, ex, ey };
}
