// Medium set: inside the arcade. Left: the arch opening onto the grey rainy square (bright). Right: warm lamp-lit plaster.
// Scene units 2000 x 1130; the cellist sits at CELL_AT with scale CELL_S.
import { Ref, paintRef, rnd } from '../engine/plate.js';
import { P, E, lin, rad } from './common.js';

export const MW = 2000, MH = 1130;
export const CELL_AT = [1260, 1085], CELL_S = .96;
export const LAMP = [905, 250];

export function drawMedium(R) {
  // outside: grey-blue rain light, far facades, wet street
  R.fill(P([[0, 0], [820, 0], [820, MH], [0, MH]]), lin(0, 0, 0, MH, [[0, '#8ea0c4'], [.45, '#e0b89a'], [.62, '#c9a79a'], [1, '#5a5468']]), { dir: -6, fallback: -6, group: 'out', maxR: 34, detail: 1.8 });
  R.fill(P([[0, 250], [240, 300], [240, 640], [0, 650]]), lin(0, 250, 0, 650, [[0, '#c9906a'], [1, '#8a6a70']]), { dir: 90, group: 'ob1', maxR: 30, detail: 2 });
  R.fill(P([[240, 330], [520, 380], [520, 620], [240, 640]]), '#b88a86', { dir: 90, group: 'ob2', maxR: 30, detail: 2 });
  R.fill(P([[520, 400], [820, 420], [820, 610], [520, 620]]), '#a79ab6', { dir: 90, group: 'ob3', maxR: 30, detail: 2 });
  [[40, 330], [140, 345], [40, 470], [140, 480], [300, 410], [400, 425], [300, 510], [600, 450], [700, 460]].forEach(([x, y], i) => R.fill(P([[x + 8, y + 10], [x + 38, y + 14], [x + 38, y + 56], [x + 8, y + 52]]), i % 3 ? '#e8c48a' : '#6a5a70', { dir: 90, maxR: 12, group: 'ow' + i, detail: 2 }));
  R.fill(P([[0, 640], [820, 612], [820, MH], [0, MH]]), lin(0, 612, 0, MH, [[0, '#d8b49a'], [.3, '#8a7a88'], [1, '#3a3444']]), { dir: 0, group: 'ost', maxR: 30, detail: 1.8 });
  // pillar + arch curve framing the opening
  R.fill(c => { c.moveTo(820, MH); c.lineTo(820, 300); c.bezierCurveTo(780, 120, 560, 30, 300, 0); c.lineTo(1000, 0); c.lineTo(1000, MH); c.closePath(); }, lin(820, 0, 1000, 0, [[0, '#e8c8a4'], [.25, '#b88a6c'], [1, '#6a4a40']]), { dir: 90, fallback: 90, group: 'pillar', maxR: 20 });
  R.fill(c => { c.moveTo(0, 0); c.lineTo(300, 0); c.bezierCurveTo(200, 20, 80, 60, 0, 110); c.closePath(); }, '#9a7662', { dir: 20, group: 'archtop', maxR: 14 });
  // interior wall, lamp-lit
  R.fill(P([[1000, 0], [MW, 0], [MW, 900], [1000, 900]]), rad(LAMP[0] + 120, LAMP[1] + 60, 30, 1100, [[0, '#d8905a'], [.35, '#a06440'], [.75, '#5a3a34'], [1, '#34262c']]), { dir: 90, fallback: 80, group: 'wall', maxR: 32, detail: 1.6 });
  // lamp bracket on the pillar
  R.fill(P([[LAMP[0] - 6, LAMP[1] - 80], [LAMP[0] + 90, LAMP[1] - 80], [LAMP[0] + 90, LAMP[1] - 68], [LAMP[0] - 6, LAMP[1] - 68]]), '#241e22', { dir: 0, group: 'brk', maxR: 3 });
  R.fill(P([[LAMP[0] + 60, LAMP[1] - 70], [LAMP[0] + 120, LAMP[1] - 70], [LAMP[0] + 110, LAMP[1] + 20], [LAMP[0] + 70, LAMP[1] + 20]]), '#ffe6a6', { dir: 90, group: 'lamp', maxR: 5 });
  R.tint(E(LAMP[0] + 90, LAMP[1] - 25, 260, 260), rad(LAMP[0] + 90, LAMP[1] - 25, 10, 260, [[0, 'rgba(255,210,140,.75)'], [1, 'rgba(255,210,140,0)']]));
  // floor
  R.fill(P([[820, 900], [MW, 900], [MW, MH], [820, MH]]), lin(0, 900, 0, MH, [[0, '#6a4a3a'], [1, '#3a2c2c']]), { dir: 0, group: 'floor', maxR: 20 });
  R.tint(E(1150, 960, 420, 70), rad(1150, 960, 10, 420, [[0, 'rgba(255,190,120,.35)'], [1, 'rgba(255,190,120,0)']]));
}

export function buildMedium(seed = 7) {
  const R = new Ref(MW, MH, 1); drawMedium(R);
  const st = paintRef(R, { R: [40, 20, 10, 5, 2.6], T: 13, seed, rev: (x, y) => x < 830 ? 1000 : Math.hypot(x - CELL_AT[0], y - 600) / 1200, app: (x, y, lv) => ((MW - x) / MW) * .3 + lv * .03 });
  return { strokes: st, ref: R };
}
