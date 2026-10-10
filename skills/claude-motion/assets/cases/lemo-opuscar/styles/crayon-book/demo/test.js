import { layer, clear, line, fill, dab, text, handCircle, ellipse, CAM, WMUL } from './crayon.js';
import { PAL } from './pal.js';
import { hash } from '/core/lib.js';
import { sheet } from './sheet.js';
const L1 = layer(), L2 = layer(), L3 = layer(), LW = layer();

export function test(comp, t, name, Q) {
  CAM.x = 960; CAM.y = 540; CAM.s = 1;
  [L1, L2, L3, LW].forEach(clear);
  if (name === 'swatch') return swatch(comp, t);
  if (name === 'model') return sheet(comp, t, Q);
}

function swatch(comp, t) {
  const cols = Object.entries(PAL.crayon);
  cols.forEach(([k, c], i) => {
    const x = 80 + i * 150;
    fill(L1, [[x, 80], [x + 110, 80], [x + 110, 260], [x, 260]], { col: c, p: 0.75, seed: i + 1 });
    fill(L1, [[x, 300], [x + 110, 300], [x + 110, 420], [x, 420]], { col: c, p: 0.45, seed: i + 11, ang: -0.5 });
    line(L1, [[x, 460], [x + 40, 440], [x + 80, 470], [x + 115, 450]], { col: c, w: 9, p: 0.95, seed: i + 3 });
  });
  // 轮廓 + 涂色的小房子
  const house = [[300, 900], [300, 700], [520, 700], [520, 900]];
  fill(L1, house, { col: PAL.crayon.ochre, p: 0.6, seed: 4 });
  fill(L1, [[270, 710], [410, 580], [550, 710]], { col: PAL.crayon.red, p: 0.75, seed: 5, ang: -0.4 });
  line(L2, [...house, house[0]], { w: 7, seed: 8 });
  line(L2, [[270, 710], [410, 580], [550, 710]], { w: 7, seed: 9 });
  // 月亮
  fill(L1, handCircle(820, 760, 120, 3, 0), { col: PAL.crayon.yellow, p: 0.8, seed: 6, cross: true });
  line(L2, handCircle(820, 760, 120, 3), { w: 7, seed: 10 });
  dab(L2, 775, 790, 16, { col: PAL.crayon.pink });
  // 蜡笔防水试样：白蜡星星 + 深蓝水彩
  for (let i = 0; i < 40; i++) { const x = 1150 + hash(i) * 650, y = 560 + hash(i + 50) * 440; star(L3, x, y, 8 + hash(i + 9) * 14, i); }
  line(L3, handCircle(1600, 700, 70, 12), { col: PAL.crayon.yellow, w: 14, p: 1, seed: 21 });
  const g = LW.g; g.fillStyle = '#000';
  const prog = (t % 3) / 3 * 1.2;
  g.save(); g.beginPath(); g.rect(1120, 540, 740 * Math.min(1, prog), 500); g.clip();
  for (let k = 0; k < 5; k++) { g.globalAlpha = 0.5; g.beginPath(); g.ellipse(1490, 790, 360 + k * 6, 230 + k * 5, 0.05 * k, 0, 7); g.fill(); }
  g.restore();
  text(L2, 'The moon could not sleep.', 960, 1040, { size: 64 });
  comp.begin();
  comp.crayon(L1.c); comp.crayon(L3.c); comp.wash(LW.c); comp.crayon(L2.c);
  comp.finish();
}
export function star(L, x, y, r, seed, col = '#fbfaf5') {
  const pts = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5; const rr = k % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  fill(L, pts, { col, p: 1, gap: 4, w: 6, over: 1, seed });
  line(L, pts, { col, w: 5, p: 1, seed, wob: 0.3 });
}
