// Overhead: the wet square seen from above. Segmental-arc paving; knife strokes follow the arcs.
import { Ref, paintRef } from '../engine/plate.js';
import { P, E, lin, rad, hash } from './common.js';
export const TW = 3600, TH = 3600, TC = [1800, 1800];
const S = 250;
const fanDir = (x, y) => { const row = Math.floor(y / S), off = row % 2 ? S / 2 : 0; const cx = Math.floor((x + off) / S) * S + S / 2 - off, cy = row * S + S * 1.15; return Math.atan2(y - cy, x - cx) + Math.PI / 2; };
export function drawTop(R) {
  R.fill(P([[0, 0], [TW, 0], [TW, TH], [0, TH]]), rad(TC[0] - 300, TC[1] - 400, 100, 2600, [[0, '#9a94a8'], [.4, '#6e6878'], [1, '#403a4a']]), { dir: { fn: fanDir }, group: 'floor', maxR: 30, aj: .25, jit: .1 });
  // sky reflections pooled in the hollows (light, soft), a drain line
  for (let i = 0; i < 16; i++) { const x = hash(i * 3.1) * TW, y = hash(i * 7.7) * TH, rx = 120 + hash(i) * 260; R.tint(E(x, y, rx, rx * .45, hash(i * 2) * 3), rad(x, y, 5, rx, [[0, 'rgba(200,200,225,.55)'], [1, 'rgba(200,200,225,0)']])); }
  // joints of the arcs (dark thin curves)
  const c = R.ctx;
  for (let row = 0; row < TH / S + 1; row++) { const off = row % 2 ? S / 2 : 0; for (let col = -1; col < TW / S + 1; col++) { const cx = col * S + S / 2 - off, cy = row * S + S * 1.15; for (const rr of [S * .55, S * .85, S * 1.15]) { c.beginPath(); c.arc(cx, cy, rr, Math.PI * 1.18, Math.PI * 1.82); c.strokeStyle = 'rgba(40,34,48,.55)'; c.lineWidth = 7; c.stroke(); } } }
  R.line(cc => { cc.moveTo(0, 3000); cc.lineTo(TW, 2960); }, '#2e2a36', 26, { dir: 0, group: 'drain', maxR: 8 });
}
export function buildTop(seed = 13) {
  const R = new Ref(TW, TH, .42); drawTop(R);
  const st = paintRef(R, { R: [30, 15, 7.5, 4], T: 11, seed, app: (x, y) => Math.hypot(x - TC[0], y - TC[1]) / 3000 * .45 });
  return { strokes: st, ref: R };
}
