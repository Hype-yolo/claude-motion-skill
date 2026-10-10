// The girl: low shot on the puddle -> tilt up -> she opens the first colour.
// Scene units 2200 x 2400. Her feet at GIRL_AT; local units: origin at her feet, height ~1250, facing right.
import { Ref, paintRef } from '../engine/plate.js';
import { KNIFE, BRUSH, DAB, LINE, hex, shade } from '../engine/impasto.js';
import { P, E, lin, rad, lerp, clamp } from './common.js';
import { umbrellaSide, pat } from './figures.js';

export const GW = 2600, GH = 2400, GIRL_AT = [1150, 2150];
export const G = { neck: [10, -1000], shoulder: [40, -930], coat: '#f2c230', coatD: '#c8901a', boot: '#2f5fae', skin: '#f0bc98', hair: '#3a261e' };

export function drawGirlBg(R) {
  // soft square behind her: grey-violet facades, bright wet ground, big calm strokes (out of focus)
  R.fill(P([[0, 0], [GW, 0], [GW, 1500], [0, 1500]]), lin(0, 0, 0, 1500, [[0, '#7c86aa'], [.5, '#c7a4a0'], [1, '#e8c09a']]), { dir: -5, fallback: -5, group: 'sky', maxR: 60, detail: 2.5 });
  R.fill(P([[0, 380], [520, 470], [520, 1500], [0, 1500]]), lin(0, 400, 0, 1500, [[0, '#b28670'], [1, '#8a6a6c']]), { dir: 90, group: 'b1', maxR: 50, detail: 2.2 });
  R.fill(P([[1900, 520], [GW, 380], [GW, 1500], [1900, 1500]]), lin(0, 400, 0, 1500, [[0, '#c4a494'], [1, '#8e7680']]), { dir: 90, group: 'b2', maxR: 50, detail: 2.2 });
  [[90, 620], [300, 660], [90, 900], [300, 930], [2020, 700], [2260, 660], [2460, 640], [2040, 960], [2280, 930]].forEach(([x, y], i) => R.fill(P([[x, y], [x + 120, y + 10], [x + 120, y + 190], [x, y + 180]]), i % 3 ? '#e8c07c' : '#5c5068', { dir: 90, maxR: 30, group: 'w' + i, detail: 2 }));
  R.fill(P([[0, 1500], [GW, 1500], [GW, GH], [0, GH]]), lin(0, 1500, 0, GH, [[0, '#d8b49a'], [.25, '#8c7c8a'], [1, '#3a3446']]), { dir: 0, fallback: 0, group: 'ground', maxR: 34 });
  // puddle around her feet, mirroring the sky
  R.fill(c => { c.ellipse(GIRL_AT[0] + 40, GIRL_AT[1] + 40, 520, 110, 0, 0, 7); }, lin(0, 2090, 0, 2260, [[0, '#6a6a8a'], [.45, '#a8a0b0'], [1, '#4a4868']]), { dir: 0, group: 'puddle', maxR: 20, aj: .15 });
}

const inG = (c, f) => { c.save(); c.translate(560, 1300); f(c); c.restore(); };
export const GOX = 560, GOY = 1300, GRW = 1120, GRH = 1400;

export function drawGirlBody(R) {
  const L = (path, fill, props) => R.fill(c => inG(c, path), fill, props);
  // tights
  L(P([[-80, -440], [-10, -440], [-20, -200], [-70, -200]]), '#d6cdc4', { dir: 90, group: 'leg1', maxR: 8 });
  L(P([[20, -440], [90, -440], [80, -200], [30, -200]]), '#bdb2aa', { dir: 90, group: 'leg2', maxR: 8 });
  // rubber boots
  const boot = (x, k) => L(c => { c.moveTo(x - 50, -230); c.lineTo(x + 45, -230); c.lineTo(x + 50, -40); c.bezierCurveTo(x + 110, -40, x + 120, 0, x + 110, 0); c.lineTo(x - 55, 0); c.closePath(); }, lin(x - 55, 0, x + 110, 0, [[0, k === 1 ? '#4a7ad0' : '#3a66b4'], [1, '#1c3a78']]), { dir: 90, group: 'boot' + x, maxR: 10 });
  boot(-45, 1); boot(55, .9);
  L(P([[-95, -238], [0, -238], [0, -212], [-95, -212]]), '#5a88d0', { dir: 0, group: 'bootrim1', maxR: 4 });
  L(P([[10, -238], [100, -238], [100, -212], [10, -212]]), '#4a78c0', { dir: 0, group: 'bootrim2', maxR: 4 });
  // raincoat: A-line, lit from the left (sky), shaded right
  L(c => { c.moveTo(-110, -960); c.bezierCurveTo(-60, -1000, 90, -1000, 140, -950); c.bezierCurveTo(170, -800, 210, -560, 240, -430); c.bezierCurveTo(120, -405, -80, -405, -200, -430); c.bezierCurveTo(-170, -560, -140, -800, -110, -960); c.closePath(); },
    lin(-200, 0, 240, 0, [[0, '#ffe07a'], [.45, G.coat], [1, G.coatD]]), { dir: 90, group: 'coat', maxR: 18, hgt: 1.1 });
  // hood folded at the back, collar, buttons, pocket
  L(c => { c.moveTo(-120, -970); c.bezierCurveTo(-200, -960, -210, -860, -150, -830); c.lineTo(-100, -900); c.closePath(); }, '#e0a826', { dir: 60, group: 'hood', maxR: 8 });
  L(c => { c.moveTo(-60, -985); c.lineTo(100, -985); c.lineTo(80, -935); c.lineTo(-40, -935); c.closePath(); }, '#e8b42a', { dir: 0, group: 'collar', maxR: 6 });
  for (const y of [-880, -780, -680, -580]) L(E(55 + (y + 880) * .05, y, 13, 13), '#6a4a1a', { maxR: 3, group: 'btn' + y });
  L(P([[90, -640], [180, -645], [185, -600], [95, -595]]), '#d8a020', { dir: 0, group: 'pocket', maxR: 5 });
  // far arm (hangs behind)
  L(c => { c.moveTo(-100, -930); c.bezierCurveTo(-160, -840, -170, -720, -150, -620); c.lineTo(-110, -625); c.bezierCurveTo(-120, -720, -100, -820, -70, -900); c.closePath(); }, '#c8901a', { dir: 95, group: 'farm', maxR: 8 });
  L(E(-132, -605, 26, 22), '#d8a080', { maxR: 5, group: 'fhand' });
  // light accent down the lit edge
  L(c => { c.moveTo(-108, -950); c.bezierCurveTo(-138, -800, -170, -560, -196, -440); c.lineTo(-176, -440); c.bezierCurveTo(-150, -560, -120, -800, -92, -950); c.closePath(); }, '#fff0b0', { dir: 90, group: 'rim', maxR: 4, hgt: 1.3 });
}

export function drawGirlHead(R) {
  const L = (path, fill, props) => R.fill(c => inG(c, path), fill, props);
  // hair back mass
  L(c => { c.ellipse(-10, -1130, 150, 150, 0, 0, 7); }, lin(-160, 0, 140, 0, [[0, '#5a3a2a'], [1, '#2a1a14']]), { dir: 'edge', fallback: 90, group: 'hairB', maxR: 10 });
  // face (3/4 to the right)
  L(c => { c.moveTo(40, -1210); c.bezierCurveTo(130, -1200, 150, -1120, 142, -1070); c.bezierCurveTo(134, -1020, 90, -990, 40, -995); c.bezierCurveTo(0, -1000, -20, -1050, -20, -1110); c.closePath(); }, lin(-20, 0, 150, 0, [[0, '#e8a888'], [.5, G.skin], [1, '#f8d0b0']]), { dir: 'edge', fallback: 90, group: 'face', maxR: 6, detail: .8 });
  R.tint(c => inG(c, c2 => c2.ellipse(92, -1060, 26, 17, 0, 0, 7)), 'rgba(240,120,110,.5)');
  // nose, mouth
  L(E(146, -1098, 10, 12), '#f0b090', { maxR: 2, group: 'nose' });
  // bangs + bob, framing the face
  L(c => { c.moveTo(-60, -1200); c.bezierCurveTo(-20, -1290, 120, -1280, 150, -1190); c.bezierCurveTo(110, -1165, 60, -1175, 20, -1160); c.bezierCurveTo(10, -1100, -10, -1040, -30, -1000); c.bezierCurveTo(-90, -1000, -140, -1030, -150, -1080); c.closePath(); }, lin(-150, 0, 150, 0, [[0, '#2e1c14'], [.6, '#4a3020'], [1, '#6a4630']]), { dir: 'edge', fallback: 40, group: 'hairF', maxR: 8 });
  // hair clip (a small red dot that will be the first colour echo)
  L(E(40, -1225, 16, 10, -.4), '#e0302a', { maxR: 3, group: 'clip' });
  // ear
  L(E(-8, -1105, 14, 20), '#e09a80', { maxR: 3, group: 'ear' });
}

// procedural eye + mouth (head-local). look: 0 at the cellist (right), 1 up at the umbrella; happy: closed smiling arcs
export function girlFace(out, { look = 0, happy = 0, blink = 0, rev = 0 } = {}) {
  const ink = hex('#2a1812');
  const ex = 96 + look * 2, ey = -1112 - look * 5;
  if (happy > .5) out.push({ x: ex, y: ey, ang: 0, len: 26, wid: 7, c: ink, seed: 3, type: BRUSH, bend: -.35, rev, hgt: .6 });
  else out.push({ x: ex + 4, y: ey, ang: 0, len: 16, wid: 20 * (1 - blink * .85), c: ink, seed: 3, type: DAB, rev, hgt: .6 });
  if (happy <= .5 && blink < .5) out.push({ x: ex + 7, y: ey - 5, ang: 0, len: 5, wid: 5, c: [1, 1, 1], seed: 4, type: DAB, rev, hgt: .8 });
  out.push({ x: ex - 4, y: ey - 26 - look * 4 - happy * 4, ang: -.15, len: 26, wid: 6, c: hex('#3a2418'), seed: 5, type: KNIFE, rev });
  out.push({ x: 128, y: -1040, ang: 0, len: 20 + happy * 14, wid: 6 + happy * 4, c: hex('#b84a4a'), seed: 6, type: BRUSH, bend: .3 * (.3 + happy), rev });
}

// near arm + umbrella. lift 0 (hanging, tip down) .. 1 (raised overhead); open 0..1; spin/tilt for the twirl
export function girlArm(out, { lift = 0, open = 0, tilt = 0, colour = 0, rev = 0, spinPh = 0 } = {}) {
  const [sx, sy] = G.shoulder;
  // hand path: down by her side -> up and forward over the head
  const hx = lerp(150, 300, lift) + Math.sin(lift * Math.PI) * 40, hy = lerp(-640, -930, lift) - Math.sin(lift * Math.PI) * 60;
  const ex = lerp((sx + hx) / 2 + 50, 170, lift), ey = lerp((sy + hy) / 2 + 30, -800, lift);
  const C = hex('#f4c63a'), Cd = hex(G.coatD);
  const seg = (x0, y0, x1, y1, w, sd) => out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, ang: Math.atan2(y1 - y0, x1 - x0), len: Math.hypot(x1 - x0, y1 - y0) * 1.1, wid: w, c: C, c2: Cd, seed: sd, type: KNIFE, rev });
  const cols = colour > 0 ? pat('red') : pat('grey');
  if (lift < .5) {
    // closed umbrella hanging, tip to the ground: draw as a furled shape along the hand -> tip line
    const tx = hx + 40, ty = hy + 560;
    out.push({ x: (hx + tx) / 2, y: (hy + ty) / 2, ang: Math.atan2(ty - hy, tx - hx), len: 600, wid: 66, c: hex(cols[0][0]), c2: hex(cols[0][1]), seed: 31, type: KNIFE, taper: -.6, rev });
    out.push({ x: hx - 10, y: hy - 40, ang: -.4, len: 70, wid: 18, c: hex('#3a2a20'), seed: 32, type: BRUSH, bend: .5, rev });
  }
  seg(sx, sy, ex, ey, 86, 21); seg(ex, ey, hx, hy, 74, 22);
  out.push({ x: hx, y: hy, ang: 0, len: 44, wid: 40, c: hex(G.skin), c2: hex('#e0a080'), seed: 23, type: DAB, rev });
  if (lift >= .5) umbrellaSide(out, hx, hy, 400 * (.4 + .6 * Math.min(1, open * 1.5)), { open, tilt: tilt - .45, cols, seed: 40 + spinPh, rev, shaft: .95 });
  return [hx, hy];
}

export function buildGirl(seed = 11) {
  const bg = new Ref(GW, GH, .5); drawGirlBg(bg);
  const bst = paintRef(bg, { R: [30, 15, 8, 4], T: 12, seed });
  const mk = (draw) => {
    const R = new Ref(GRW, GRH, 1); draw(R);
    const st = paintRef(R, { R: [26, 13, 7, 3.5, 2], T: 11, seed, rev: (x, y) => Math.max(0, (y - 100) / 1300) * .6 });
    const a = st.a; for (let i = 0; i < st.n; i++) { a[i * 20] -= GOX; a[i * 20 + 1] -= GOY; }
    return { strokes: st, ref: R };
  };
  return { bg: { strokes: bst, ref: bg }, body: mk(drawGirlBody), head: mk(drawGirlHead) };
}
