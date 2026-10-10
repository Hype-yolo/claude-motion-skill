// Extreme close-up: cello top under the strings, raindrops on the varnish. Bow is procedural.
import { Ref, paintRef, rnd } from '../engine/plate.js';
import { KNIFE, BRUSH, DAB, LINE, hex } from '../engine/impasto.js';
import { P, E, lin, rad, hash } from './common.js';
export const EW = 2100, EH = 1180;
export const STR = x => 1030 + (x - 1050) * .0 ; // strings are vertical, slightly tilted
export const strings = [860, 960, 1060, 1160].map((x, i) => ({ x0: x - 60, x1: x + 90, w: [7, 6, 5, 4][i] }));  // top y=0 -> bottom y=EH
export function drawEcu(R) {
  // varnished spruce top: warm amber-red with grain along the strings
  R.fill(P([[0, 0], [EW, 0], [EW, EH], [0, EH]]), rad(700, 420, 50, 1500, [[0, '#f0a050'], [.4, '#c0642a'], [.8, '#7a3218'], [1, '#4a1c10']]), { dir: 84, fallback: 84, group: 'wood', maxR: 36, detail: 1.4, len: 1.4, jit: .08 });
  for (let i = 0; i < 26; i++) { const x = hash(i * 1.7) * EW; R.tint(P([[x, 0], [x + 14, 0], [x + 160, EH], [x + 146, EH]]), 'rgba(90,30,10,.22)'); }
  // f-hole (left), purfling edge (right), bridge (lower middle)
  R.line(c => { c.moveTo(430, 120); c.bezierCurveTo(380, 360, 520, 560, 440, 820); c.bezierCurveTo(420, 900, 360, 950, 330, 930); }, '#1a0a06', 34, { dir: 'edge', group: 'fh', maxR: 6 });
  R.fill(E(452, 118, 36, 30), '#1a0a06', { maxR: 6, group: 'fhA' }); R.fill(E(322, 930, 38, 32), '#1a0a06', { maxR: 6, group: 'fhB' });
  R.line(c => { c.moveTo(1880, 0); c.bezierCurveTo(1820, 400, 1850, 800, 1960, EH); }, '#2a120a', 16, { dir: 'edge', group: 'purf', maxR: 5 });
  R.fill(P([[760, 900], [1360, 880], [1350, 960], [770, 980]]), lin(0, 880, 0, 980, [[0, '#f4e0b4'], [1, '#c8a878']]), { dir: 0, group: 'bridge', maxR: 10 });
  // varnish glints
  for (const [x, y, l] of [[560, 300, 160], [640, 520, 90], [1500, 260, 120], [1420, 640, 70]]) R.fill(E(x, y, l, 12, 1.45), 'rgba(255,220,160,.9)', { maxR: 6, group: 'gl' + x, hgt: 1.4 });
}
export function buildEcu(seed = 17) {
  const R = new Ref(EW, EH, .6); drawEcu(R);
  const st = paintRef(R, { R: [30, 15, 7.5, 3.5], T: 12, seed });
  // strings: long pale lines with a dark shadow line beside them
  for (const s of strings) {
    const ang = Math.atan2(EH, s.x1 - s.x0);
    st.push({ x: (s.x0 + s.x1) / 2 + 9, y: EH / 2, ang, len: EH * 1.15, wid: s.w * 1.4, c: hex('#3a1408'), type: LINE, alpha: .6, seed: s.x0 });
    st.push({ x: (s.x0 + s.x1) / 2, y: EH / 2, ang, len: EH * 1.15, wid: s.w, c: hex('#ece2cc'), c2: hex('#b8aa90'), type: KNIFE, seed: s.x0 + 1, hgt: .8 });
  }
  // raindrops beaded on the varnish: dark rim + bright core
  for (let i = 0; i < 38; i++) {
    const x = hash(i * 4.1 + 2) * EW, y = hash(i * 9.3 + 1) * EH, r = 10 + hash(i) * 22;
    st.push({ x, y: y + r * .2, ang: 0, len: r * 2, wid: r * 1.7, c: hex('#5a200e'), type: DAB, seed: i, alpha: .6, hgt: .6 });
    st.push({ x, y, ang: 0, len: r * 1.7, wid: r * 1.5, c: hex('#e8a068'), c2: hex('#fbd0a0'), type: DAB, seed: i + 50, hgt: 1.3 });
    st.push({ x: x - r * .3, y: y - r * .3, ang: 0, len: r * .5, wid: r * .4, c: [1, 1, 1], type: DAB, seed: i + 90, hgt: 1.5 });
  }
  return { strokes: st, ref: R };
}
// the bow over the strings: p = travel 0..1 (moves along its length), y = crossing height
export function ecuBow(out, p, { y = 760, lift = 0, alpha = 1 } = {}) {
  const x = 1600 - p * 1100, yy = y - lift * 60, ang = -.05;
  out.push({ x, y: yy + 26, ang, len: 2600, wid: 50, c: hex('#3a1408'), type: KNIFE, alpha: .35 * alpha, seed: 3, hgt: .2 });   // shadow on the wood
  out.push({ x, y: yy, ang, len: 2600, wid: 30, c: hex('#f2eadb'), c2: hex('#d8ccb4'), type: KNIFE, seed: 4, alpha, hgt: .7 });   // hair
  out.push({ x, y: yy - 40, ang, len: 2600, wid: 22, c: hex('#4a2614'), c2: hex('#6a3a20'), type: KNIFE, seed: 5, alpha, hgt: 1.1 });  // stick
  out.push({ x: x - 10, y: yy - 46, ang, len: 2600, wid: 5, c: hex('#9a6a44'), type: LINE, seed: 6, alpha: alpha * .8 });
}
