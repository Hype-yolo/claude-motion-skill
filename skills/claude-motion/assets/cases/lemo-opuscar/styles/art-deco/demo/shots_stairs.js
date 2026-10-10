// Stairwell one-take (C): crane up → pull out to the whole 30-floor section → push back in → into the "30" medallion.
import * as D from './engine/deco.js';
import * as T from './engine/type.js';
import * as CH from './chars.js';
import * as TL from './timeline.js';
import { drawStairs, pipAt, FLOOR_H, WALL, TOP_FLOOR } from './scenes/stairs.js';

const SB = TL.STAIR_BEATS;
// continuous beat index inside the stairwell (0..16)
export function stairBeat(t) {
  if (t <= SB[0]) return 0; if (t >= SB[16]) return 16;
  let k = 0; while (k < 15 && t >= SB[k + 1]) k++;
  return k + (t - SB[k]) / (SB[k + 1] - SB[k]);
}
// flight index u (0 = floor 1 flight A); 30th floor landing = u 58
export function stairU(bk) {
  if (bk < 8) return bk * .5;                                   // one flight per 2 beats (hop on eighths)
  if (bk < 12) return 4 + 50 * D.eio((bk - 8) / 4);               // time-lapse: floors 3 → 28
  return 54 + 4 * D.eo(Math.min(1, (bk - 12) / 2.2));              // arrive at 30
}
function camAt(bk, pip) {
  const zo = D.ss(D.seg(bk, 8, 9.6)) * (1 - D.ss(D.seg(bk, 11.2, 12.8)));       // zoom-out amount
  const ppmClose = 225, ppmFar = 9.8;
  let ppm = Math.exp(D.lerp(Math.log(ppmClose), Math.log(ppmFar), zo));
  let cy = D.lerp(pip.y + .95, TOP_FLOOR * FLOOR_H / 2 + 5, zo), cx = D.lerp(pip.x * .25, 0, zo);
  // final push into the 30 medallion
  const pin = D.ei(D.seg(bk, 14, 16));
  if (pin > 0) {
    const mx = -WALL + .75, my = TOP_FLOOR * FLOOR_H + 2.55;
    ppm = Math.exp(D.lerp(Math.log(ppm), Math.log(1500), pin));
    cx = D.lerp(cx, mx, D.ss(pin * 1.3)); cy = D.lerp(cy, my, D.ss(pin * 1.3));
  }
  return { ppm, cy, cx, zo };
}
export function stairShot(g, t, o = {}) {
  const bk = stairBeat(t), u = stairU(bk), pip = pipAt(u);
  const cam = camAt(bk, pip);
  const lit = pip.floor + (pip.n % 2 ? .5 : 0);
  const { X, Y } = drawStairs(g, cam, { t, litFloor: pip.floor });
  const s = cam.ppm * CH.PIP_M / CH.PIP_H;
  if (cam.ppm > 60) {
    // hop cycle: a step per eighth note (two treads per hop), turn at the landings
    const eighth = Math.floor(bk * 2), ph = bk * 2 - eighth;
    const turning = pip.run <= 0 || pip.run >= 1;
    const pose = turning ? CH.POSES.stand : (eighth % 2 ? CH.POSES.climb1 : CH.POSES.climb2);
    const hop = turning ? 0 : Math.sin(ph * Math.PI) * .18;
    const face = bk < 2.5 ? 'worry' : bk < 12 ? 'determined' : 'calm';
    const sole = CH.PIP_SOLE * s;
    CH.drawFigure(g, { x: X(pip.x), y: Y(pip.y + hop) - sole, s, view: 'side', dir: pip.dir, face, ...pose, letter: 'N' });
  } else {
    // time-lapse: a red spark with Cassandre speed lines climbing the zigzag
    const px = X(pip.x), py = Y(pip.y + .8);
    for (let k = 1; k < 14; k++) { const q = pipAt(Math.max(0, u - k * .45)); D.glow(g, X(q.x), Y(q.y + .8), 10, '#d4485c', .25 * (1 - k / 14)); }
    D.speedLines(g, px, py, -Math.PI / 2, { n: 5, len: 120, spread: 18, w: 3, color: '#f3d98b', alpha: .9, seed: Math.floor(bk * 8) });
    D.glow(g, px, py, 46, '#ff6070', .8); g.beginPath(); g.arc(px, py, 7, 0, D.TAU); g.fillStyle = '#d4485c'; g.fill();
  }
  // elevator-dial HUD (the building tracks him): top-right corner
  if (!o.noHud) {
    const a = D.ss(D.seg(bk, .3, 1.2)) * (1 - D.ss(D.seg(bk, 14, 14.8)));
    if (a > 0) {
      const v = D.clamp((pip.floor - 1 + (pip.n % 2 ? .5 : 0) + pip.run * .5) / (TOP_FLOOR - 1));
      T.dial(g, 1760, 150, 92, v, { labels: ['L', '5', '10', '15', '20', '25', '30'], alpha: a, lit: .6 });
      T.decoDigits(g, String(Math.min(TOP_FLOOR, pip.floor)).padStart(2, '0'), 1760, 262, 34, { alpha: a, rules: false });
    }
  }
  D.vignette(g, 1920, 1080, .4);
  return { bk, pip, cam };
}
