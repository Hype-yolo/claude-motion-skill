// Model sheet: the owner (June) + the product (Pip). Rendered with ?test=sheet
import { PAL, setClock, shape, ink, ellipse, rrect, rect, text, star, sparkle, paperFinish, plane } from './engine/toon.js';
import { drawOwner, drawPip, drawDock, drawHand } from './engine/chars.js';

export function drawSheet(ctx, t, C) {
  setClock(0.25);
  const W = 1920, H = 1080;
  ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, W, H);
  // header
  text(ctx, 'Model Sheet', 60, 92, { font: '700 64px Oleo', fill: PAL.ink, plate: PAL.mustard, off: [4, 3] });
  text(ctx, 'JUNE, THE NEW HOMEOWNER  ·  PIP, THE PRODUCT', 420, 84, { font: '600 24px Jost', fill: PAL.inkSoft, track: 5 });
  ink(ctx, [[60, 118], [1860, 118]], 3, { breaks: 0.2, seed: 2 });
  // turnaround
  plane(ctx, rrect(40, 140, 1000, 560, 20), PAL.blueL, { off: [0, 0], grain: 0.2 });
  text(ctx, 'TURNAROUND', 70, 180, { font: '600 22px Jost', fill: PAL.ink, track: 5 });
  const views = [['front', 1, 'FRONT'], ['q', 1, '3/4'], ['side', 1, 'PROFILE'], ['back', 1, 'BACK']];
  views.forEach(([v, d, lab], i) => {
    const x = 170 + i * 240;
    ink(ctx, [[x - 110, 660], [x + 110, 660]], 2.5, { seed: 5 + i, breaks: 0.3 });
    drawOwner(ctx, { x, y: 660, s: 0.78, dir: d, view: v, face: 'neutral' }, 0);
    text(ctx, lab, x, 690, { font: '500 20px Jost', fill: PAL.inkSoft, align: 'center', track: 4 });
  });
  // height guides
  [[660, 'feet'], [660 - 0.78 * 600, 'top']].forEach(([y], i) => ink(ctx, [[62, y], [1020, y]], 1.4, { seed: 9 + i, breaks: 0.6, alpha: 0.35 }));
  // expressions (head crops)
  plane(ctx, rrect(1060, 140, 820, 300, 20), PAL.pink, { off: [0, 0], grain: 0.2 });
  text(ctx, 'EXPRESSIONS', 1090, 180, { font: '600 22px Jost', fill: PAL.ink, track: 5 });
  [['neutral', 'NEUTRAL'], ['happy', 'DELIGHTED'], ['wow', 'SURPRISED'], ['focus', 'FOCUSED'], ['wink', 'KNOWING']].forEach(([f, lab], i) => {
    const cx = 1150 + i * 160, cy = 300;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fillStyle = PAL.white; ctx.fill(); ctx.clip();
    drawOwner(ctx, { x: cx - 20, y: cy + 470, s: 0.98, view: 'q', face: f, dir: 1 }, 0);
    ctx.restore();
    ink(ctx, ellipse(cx, cy, 70, 70, 40), 3, { closed: true, seed: 20 + i, breaks: 0.2 });
    text(ctx, lab, cx, cy + 108, { font: '500 18px Jost', fill: PAL.ink, align: 'center', track: 3 });
  });
  // key poses (limited animation: body held, only arms / hands / face change)
  plane(ctx, rrect(1060, 460, 820, 580, 20), PAL.mustardL, { off: [0, 0], grain: 0.2 });
  text(ctx, 'KEY POSES  ·  body held, arms + face on twos', 1090, 500, { font: '600 22px Jost', fill: PAL.ink, track: 3 });
  const py = 990;
  drawOwner(ctx, { x: 1170, y: py, s: 0.66, view: 'q', face: 'happy', armB: { a1: -2.2, a2: -2.0 }, armF: { a1: -0.9, a2: -1.2 } }, 0);
  drawOwner(ctx, { x: 1370, y: py, s: 0.66, view: 'q', face: 'focus', armF: { a1: 1.0, a2: -0.6 }, armB: { a1: 1.9, a2: 1.7 }, handF: 'grip', look: [4, 6], prop: { kind: 'phone', rot: -0.15 } }, 0);
  drawOwner(ctx, { x: 1570, y: py, s: 0.66, view: 'q', face: 'focus', armF: { a1: 0.55, a2: 0.35 }, armB: { a1: 0.9, a2: 0.5 }, handF: 'flat', handB: 'flat' }, 0);
  drawOwner(ctx, { x: 1770, y: py, s: 0.66, view: 'q', face: 'wink', armF: { a1: -0.25, a2: -1.25 }, armB: { a1: 1.86, a2: 1.7 }, handF: 'point' }, 0);
  ['TA-DA', 'TAP', 'PUSH', 'TIP!'].forEach((l, i) => text(ctx, l, 1170 + i * 200, 1025, { font: '500 18px Jost', fill: PAL.inkSoft, align: 'center', track: 4 }));
  // hands (four-finger UPA glove)
  ['open', 'flat', 'point', 'grip'].forEach((k, i) => { drawHand(ctx, 1500 + i * 95, 560, -0.5, k, 1, 1.6); });
  text(ctx, 'HANDS', 1640, 620, { font: '500 16px Jost', fill: PAL.inkSoft, align: 'center', track: 4 });
  // Pip
  plane(ctx, rrect(40, 720, 1000, 320, 20), PAL.avocadoL, { off: [0, 0], grain: 0.2 });
  text(ctx, 'PIP  ·  THE PRODUCT', 70, 760, { font: '600 22px Jost', fill: PAL.ink, track: 5 });
  drawPip(ctx, 220, 960, { s: 0.9, light: 0 });
  drawPip(ctx, 500, 960, { s: 0.9, light: 1, press: 1 });
  drawPip(ctx, 760, 900, { view: 'top', s: 0.72, ang: -Math.PI / 2 });
  drawDock(ctx, 950, 990, 0.9, 0, { light: true });
  ['OFF', 'ON · PRESSED', 'TOP (PLAN VIEW)', 'DOCK'].forEach((l, i) => text(ctx, l, [220, 500, 760, 950][i], 1025, { font: '500 18px Jost', fill: PAL.inkSoft, align: 'center', track: 3 }));
  // palette
  const sw = [PAL.coral, PAL.mustard, PAL.teal, PAL.blue, PAL.avocado, PAL.pink, PAL.plum, PAL.hair, PAL.skin, PAL.ink, PAL.paper];
  sw.forEach((c, i) => { shape(ctx, rrect(1440 + i * 38, 60, 30, 30, 6), { fill: c, line: 2, seed: 60 + i, grain: 0, off: [3, 2] }); });
  paperFinish(ctx, W, H, 0.8);
}
