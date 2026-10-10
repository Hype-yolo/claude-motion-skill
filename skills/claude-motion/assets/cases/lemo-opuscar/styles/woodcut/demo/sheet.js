// The Bell Founder · model sheet (two 1920×1080 pages, stitched vertically by build tools)
import * as WC from './engine/index.js';
import * as ST from './stage.js';
import { drawFounder, FOUNDER_POSE, drawBoy, BOY_POSE, drawCompass } from './chars.js';
import { drawFounderFront, drawFounderBack, drawBoyFront, drawBoyBack } from './views.js';

const m = ST.m, c = ST.c;
function panel(x, y, w, h) { WC.fillPoly(m, [WC.rect(x, y, w, h)], '#000'); }
function label(txt, x, y, { size = 26, col = '#000', font = 'IM Fell English', align = 'center', italic = false } = {}) {
  m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.font = `${italic ? 'italic ' : ''}400 ${size}px "${font}"`; m.textAlign = align; m.textBaseline = 'middle'; m.fillStyle = col; m.fillText(txt, x, y); m.restore();
}
function clip(x, y, w, h, fn) { m.save(); m.beginPath(); m.rect(x, y, w, h); m.clip(); fn(); m.restore(); }

export function sheetA(g) {
  m.setTransform(1, 0, 0, 1, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
  m.fillStyle = '#fff'; m.fillRect(0, 0, 1920, 1080); c.clearRect(0, 0, 1920, 1080);
  label('THE FOUNDER  &  THE APPRENTICE', 960, 50, { size: 46, font: 'IM Fell English SC' });
  label('model sheet v1 · turnaround (front · profile · back) · all shots are staged in profile, like a carved frieze', 960, 92, { size: 24, italic: true });
  // turnaround panel
  panel(40, 120, 1840, 640);
  const k = .9, gy = 730;
  drawFounderFront(m, [k, 0, 0, k, 190, gy]);
  drawFounder(m, [k, 0, 0, k, 360, gy], FOUNDER_POSE.stand);
  drawFounderBack(m, [k, 0, 0, k, 640, gy]);
  drawBoyFront(m, [k, 0, 0, k, 1040, gy]);
  drawBoy(m, [k, 0, 0, k, 1250, gy], BOY_POSE.stand);
  drawBoyBack(m, [k, 0, 0, k, 1480, gy]);
  // height ruler (carved ticks)
  for (let i = 0; i <= 7; i++) { const y = gy - i * 90 * k; WC.fillPoly(m, [WC.rect(1700, y - 1.5, i % 2 ? 18 : 34, 3)], '#fff'); }
  label('head units', 1760, gy - 7 * 90 * k - 26, { size: 22, col: '#fff', italic: true });
  // ground line cut
  WC.drawStrokes(m, WC.cutAlong([[60, gy + 6], [1860, gy + 6]], { w: 4, kind: 'k', seg: [200, 500], seed: 3 }));
  for (const [x, t] of [[190, 'front'], [400, 'profile'], [640, 'back'], [1040, 'front'], [1270, 'profile'], [1480, 'back']]) label(t, x, gy + 22, { size: 22, col: '#fff', italic: true });
  // notes
  const notes = [
    ['THE FOUNDER', 'stooped, bald, a long white beard (his brightest mass), heavy brow over a black eye socket,', 'leather apron, rolled sleeves, hands a size too big. Silhouette: hump + forward head + beard.'],
    ['THE APPRENTICE', 'about twelve, a hand-me-down coat to the knees, knit cap with a bobble, a scarf tail behind,', 'and a brass compass on a cord over his heart — the thing that always led him home.'],
  ];
  notes.forEach(([h, a, b], i) => { const x = 60 + i * 930; label(h, x, 800, { size: 30, font: 'IM Fell English SC', align: 'left' }); label(a, x, 838, { size: 23, align: 'left' }); label(b, x, 868, { size: 23, align: 'left' }); });
  // palette
  const sw = [['#111111', 'ink  #111111'], ['#EFE8D8', 'paper  #EFE8D8'], ['#D8C29C', 'wood (block only)  #D8C29C'], ['#C8502A', 'molten copper, the only colour  #C8502A']];
  label('PALETTE', 60, 920, { size: 30, font: 'IM Fell English SC', align: 'left' });
  sw.forEach(([col, name], i) => {
    const x = 60 + i * 430, y = 950;
    if (col === '#111111') panel(x, y, 90, 70);
    else if (col === '#EFE8D8') { WC.drawStrokes(m, WC.cutAlong([[x, y], [x + 90, y], [x + 90, y + 70], [x, y + 70], [x, y]], { w: 3, kind: 'k', seed: i }), { color: '#000' }); }
    else if (col === '#D8C29C') { panel(x, y, 90, 70); WC.drawStrokes(m, WC.hatch(new WC.Region([WC.rect(x + 6, y + 6, 78, 58)]), { dir: WC.dirAngle(.1), tone: () => 1, sp: 7, seed: 4 })); }
    else { WC.plate(c, [WC.rect(x, y, 90, 70)], 1); }
    label(name, x + 104, y + 35, { size: 24, align: 'left' });
  });
  ST.print(g, { seed: 7 });
}

export function sheetB(g) {
  m.setTransform(1, 0, 0, 1, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
  m.fillStyle = '#fff'; m.fillRect(0, 0, 1920, 1080); c.clearRect(0, 0, 1920, 1080);
  label('EXPRESSIONS  —  a face is changed by re-cutting it, never by blending', 960, 44, { size: 32, font: 'IM Fell English SC' });
  const fx = [['focus', 'focused'], ['grief', 'the bell cracked'], ['nod', 'approval'], ['up', 'looking up']];
  const bx = [['curious', 'curious'], ['hesitant', 'hesitant'], ['determined', 'determined'], ['wonder', 'wonder']];
  const cw = 222, ch = 250, y0 = 76;
  fx.forEach(([e, name], i) => {
    const x = 40 + i * (cw + 10);
    panel(x, y0, cw, ch);
    clip(x, y0, cw, ch, () => drawFounder(m, [1.75, 0, 0, 1.75, x + cw / 2 - 90 * 1.75, y0 + ch / 2 + 574 * 1.75], { ...FOUNDER_POSE.stand, expr: e, head: e === 'grief' ? .3 : e === 'up' ? -.3 : e === 'nod' ? .12 : 0 }));
    label(name, x + cw / 2, y0 + ch + 20, { size: 22, italic: true });
  });
  bx.forEach(([e, name], i) => {
    const x = 40 + 4 * (cw + 10) + 20 + i * (cw + 10);
    panel(x, y0, cw, ch);
    clip(x, y0, cw, ch, () => drawBoy(m, [2.3, 0, 0, 2.3, x + cw / 2 - 58 * 2.3, y0 + ch / 2 + 396 * 2.3], { ...BOY_POSE.stand, expr: e, head: e === 'wonder' ? -.35 : e === 'hesitant' ? .15 : 0 }));
    label(name, x + cw / 2, y0 + ch + 20, { size: 22, italic: true });
  });
  label('KEY POSES  —  anticipation · action · follow-through', 960, 392, { size: 32, font: 'IM Fell English SC' });
  panel(40, 420, 1840, 560);
  const gy = 940, k = .68;
  // founder: hammer up → down (with motion cuts), pour with tongs
  drawFounder(m, [k, 0, 0, k, 110, gy], FOUNDER_POSE.hammerUp);
  drawFounder(m, [k, 0, 0, k, 330, gy], FOUNDER_POSE.hammerDown);
  WC.drawStrokes(m, [0, 1, 2, 3].map(i => WC.mkStroke(WC.spline([[330 + 150 * k - i * 12, gy - 590 * k + i * 16], [330 + 210 * k, gy - 470 * k + i * 10], [330 + 190 * k + i * 4, gy - 330 * k]], 3), 3 - i * .5, { kind: 'v', seed: i })));
  // crucible at the tongs' end (copper plate)
  const pr = drawFounder(m, [k, 0, 0, k, 560, gy], FOUNDER_POSE.pour), cx = pr.tip[0] + 10, cy = pr.tip[1] + 24;
  WC.fillPoly(m, [[[cx - 34, cy - 30], [cx + 34, cy - 30], [cx + 24, cy + 26], [cx - 24, cy + 26]]], '#000');
  WC.fillPoly(m, [WC.ellipse(cx, cy - 30, 30, 8, 20)], '#fff'); WC.plate(c, [WC.ellipse(cx, cy - 30, 32, 10, 20)], 1);
  drawFounder(m, [k, 0, 0, k, 900, gy], FOUNDER_POSE.ropePull);
  // apprentice
  drawBoy(m, [k * 1.1, 0, 0, k * 1.1, 1130, gy], BOY_POSE.bellowsDown);
  drawBoy(m, [k * 1.1, 0, 0, k * 1.1, 1330, gy], { ...BOY_POSE.clutch, expr: 'hesitant' });
  drawBoy(m, [k * 1.1, 0, 0, k * 1.1, 1520, gy], { ...BOY_POSE.throwOut, expr: 'determined' });
  drawCompass(m, 1520 + 160 * k * 1.1, gy - 270 * k * 1.1, 12);
  drawBoy(m, [k * 1.1, 0, 0, k * 1.1, 1730, gy], { ...BOY_POSE.lookUp, expr: 'wonder' });
  for (const [x, t] of [[150, 'hammer: wind-up'], [380, 'strike'], [640, 'the pour'], [950, 'bell rope'], [1160, 'bellows'], [1360, 'clutch'], [1570, 'let go'], [1760, 'wonder']]) label(t, x, gy + 18, { size: 21, col: '#fff', italic: true });
  label('Every figure is black wood; light is what the knife removes. Key light from the right (the fire), so faces are carved on one side only.', 960, 1040, { size: 23, italic: true });
  ST.print(g, { seed: 8 });
}
