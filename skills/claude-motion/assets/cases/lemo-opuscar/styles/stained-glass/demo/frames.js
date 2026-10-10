// Style frames for gate 1 (same renderer as the film).
import { POSE } from './knight.js';
import { DPOSE } from './dragon.js';
import { LX } from './window.js';

const K = (pose, x, y, s = 1, extra = {}) => ({ pose: { ...POSE[pose], ...(extra.p || {}) }, x, y, s, flip: extra.flip, o: extra.o });
const Dg = (pose, x, y, s = 1, extra = {}) => ({ pose: { ...DPOSE[pose], ...(extra.p || {}) }, x, y, s, flip: extra.flip ?? true, o: extra.o });
export const LANC = {
  i: { knight: K('raise', -20, 288) },
  ii: { knight: K('walkA', -6, 318), scroll: .3, doveX: 60, flap: 1 },
  iii: { knight: K('guard', -80, 424, .76), dragon: Dg('rear', 70, 214, .78), rock: 1 },
  iv: { knight: K('strike', -70, 400, .8), dragon: Dg('coil', 48, 470, .8, { o: { ember: { r: 15, lit: 0 } } }) },
};
export const AFTERNOON = { sunCol: [1, .86, .64], sunI: 2.3, sx: -.36, sz: 1.3, skyI: .13, skyCol: [.55, .65, .9], amb: .2, ambCol: [.78, .74, .82], roseI: 1.0, roseCol: [1, .85, .6] };
export const FRAMES = {
  wide: {
    cam: [0, 175, .5], sunU: LX[2] + 10, ...AFTERNOON, floorMode: 1, floor: { camD: 2600, eyeH: 320 },
    lancets: [LANC.i, LANC.ii, LANC.iii, LANC.iv], inscription: [['THE DRAGON OF THE EAST WINDOW', 60, 0]], gild: .8, time: 3, sweep: [0, 700, 1.6, 806],
  },
  close: {
    cam: [LX[2] - 60, 190, 1.3], sunU: LX[2] + 10, ...AFTERNOON, floorMode: 1, floor: { camD: 2600, eyeH: 320 },
    lancets: [LANC.i, LANC.ii, LANC.iii, LANC.iv], time: 3,
  },
  floor: {
    cam: [LX[2], 250, 1], sunU: LX[2] + 10, ...AFTERNOON, floorMode: 2, topCam: [-60, 800, 1.2], pm: [-760, 150, 1300, 1300], pmBlur: 2,
    lancets: [LANC.i, LANC.ii, LANC.iii, LANC.iv], time: 3, amb: .24, vign: .55, patchK: 3.0, bloom: .7, thr: .45,
  },
};
