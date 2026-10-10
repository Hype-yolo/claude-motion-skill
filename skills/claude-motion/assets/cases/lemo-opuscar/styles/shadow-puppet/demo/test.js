// 角色设定表：index.html?test=model
import { build, drawHouYi, drawRods, J } from './houyi.js';
import { POSES } from './poses.js';
import { drawSun, drawCrow, buildSuns } from './suns.js';
import { drawPiece, DYE } from './carve.js';

const cam = (k, x, y) => [k, 0, 0, k, x, y];
export function modelSheet(tr, fr, lm, v = '1') {
  const W = 1920, H = 1080;
  tr.setTransform(1, 0, 0, 1, 0, 0); tr.fillStyle = '#fff'; tr.fillRect(0, 0, W, H);
  fr.setTransform(1, 0, 0, 1, 0, 0); fr.clearRect(0, 0, W, H);
  lm.setTransform(1, 0, 0, 1, 0, 0); lm.fillStyle = '#000'; lm.fillRect(0, 0, W, H);
  const panels = { A: [0, 64, 600, 640], B: [600, 64, 1240, 640], C: [1240, 64, 1920, 640], D: [0, 640, 1240, 1080], E: [1240, 640, 1920, 1080] };
  // 灯光图：每格一盏灯（中心 1.15 → 边缘 0.7）
  const lampAt = (x, y, r, I) => { const gr = lm.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${I / 6})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); lm.fillStyle = gr; lm.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const [k, [x0, y0, x1, y1]] of Object.entries(panels)) {
    lm.save(); lm.beginPath(); lm.rect(x0, y0, x1 - x0, y1 - y0); lm.clip();
    lm.fillStyle = `rgb(${.72 / 6 * 255},${.72 / 6 * 255},${.72 / 6 * 255})`; lm.fillRect(x0, y0, x1 - x0, y1 - y0);
    lm.globalCompositeOperation = 'lighter'; lampAt((x0 + x1) / 2, (y0 + y1) * .45, Math.max(x1 - x0, y1 - y0) * .8, .55);
    lm.restore();
  }
  lm.globalCompositeOperation = 'lighter';
  for (const x of [1350, 1580, 1810]) lampAt(x, 205, 150, 1.4);          // 太阳背后的热点
  lm.globalCompositeOperation = 'source-over';

  const clip = (g, [x0, y0, x1, y1], fn) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); fn(); g.restore(); };
  const label = (x, y, s, size = 21, col = '#2b170d', align = 'left', wt = 600) => { fr.save(); fr.setTransform(1, 0, 0, 1, 0, 0); fr.font = `${wt} ${size}px "Cormorant Garamond"`; fr.fillStyle = col; fr.textAlign = align; fr.textBaseline = 'alphabetic'; fr.fillText(s, x, y); fr.restore(); };
  const leader = (x0, y0, x1, y1) => { fr.save(); fr.setTransform(1, 0, 0, 1, 0, 0); fr.strokeStyle = 'rgba(60,30,15,.75)'; fr.lineWidth = 1.2; fr.setLineDash([4, 3]); fr.beginPath(); fr.moveTo(x0, y0); fr.lineTo(x1, y1); fr.stroke(); fr.setLineDash([]); fr.beginPath(); fr.arc(x1, y1, 3, 0, 7); fr.fillStyle = 'rgba(60,30,15,.85)'; fr.fill(); fr.restore(); };
  const marker = (x, y, n) => { fr.save(); fr.setTransform(1, 0, 0, 1, 0, 0); fr.beginPath(); fr.arc(x, y, 9, 0, 7); fr.strokeStyle = '#a3170f'; fr.lineWidth = 2; fr.stroke(); fr.font = '700 15px "Cormorant Garamond"'; fr.fillStyle = '#a3170f'; fr.textAlign = 'center'; fr.fillText(n, x + 17, y - 8); fr.restore(); };

  // —— A：装配完成 + 操纵杆 ——
  clip(tr, panels.A, () => {
    const k = .8, wx = 290, wy = 385, C = cam(k, wx, wy);
    const r = drawHouYi(tr, C, POSES.rest);
    drawRods(tr, r.rods, [[r.rods[0][0] - 70, 700], [r.rods[1][0] + 30, 700], [r.rods[2][0] - 20, 700]], 2.2, .7);
    A_r = r;
  });
  { const r = A_r; leader(470, 190, r.rods[0][0] + 10, r.rods[0][1] - 4); label(478, 186, 'neck rod', 19);
    leader(470, 560, r.rods[1][0] + 38, 620); label(478, 556, 'hand rods', 19); leader(470, 560, r.rods[2][0] + 14, 620);
    leader(90, 200, r.plume[0][4][0], r.plume[0][4][1]); label(18, 190, 'pheasant plumes', 19); label(18, 210, '(spring chain)', 17);
    leader(92, 440, r.rivets[6][0], r.rivets[6][1]); label(18, 436, 'rivet', 19); label(18, 456, '(thread knot)', 17);
    leader(470, 290, 312, 252); label(478, 286, 'open face', 19); label(478, 306, '(kong lian)', 17); }

  // —— B：分件图 ——
  const P = build();
  const place = [
    ['head', 690, 225, 1, 'head + helmet', [[6, 0]]], ['chest', 845, 240, 1, 'chest', [[6, -116], [14, -101], [1, -104], [0, 0]]],
    ['skirt', 1000, 120, 1, 'armoured skirt', [[0, 0], [10, 44], [-8, 42]]], ['quiver', 1175, 250, 1, 'quiver', []],
    ['ua', 670, 360, 1, 'upper arm ×2', [[0, 0], [0, 64]]], ['fa', 755, 372, 1, 'forearm ×2', [[0, 0], [0, 58]]],
    ['handBow', 820, 400, 1.3, 'bow hand', [[0, 0]]], ['handDraw', 880, 470, 1.3, 'draw hand', [[0, 0]]],
    ['leg', 950, 345, 1, 'leg ×2', [[0, 0]]], ['leg', 1040, 350, 1, '', [[0, 0]]]
  ];
  clip(tr, panels.B, () => { tr.globalCompositeOperation = 'multiply'; for (const [n, x, y, s] of place) { tr.setTransform(s, 0, 0, s, x, y); drawPiece(tr, P[n]); } tr.globalCompositeOperation = 'source-over'; });
  let num = 1;
  for (const [n, x, y, s, lab, joints] of place) {
    if (lab) label(x, y + (n === 'leg' ? 250 : n === 'skirt' ? 185 : n === 'chest' ? 34 : n === 'head' ? 36 : n === 'quiver' ? 20 : n.startsWith('hand') ? 58 : n === 'fa' ? 110 : 90), lab, 17, '#2b170d', 'center');
    for (const [jx, jy] of joints) marker(x + jx * s, y + jy * s, '');
  }
  label(618, 620, 'red rings = rivet holes (joints turn on knotted thread)', 17, '#a3170f');

  // —— C：太阳 ——
  clip(tr, panels.C, () => {
    [[1350, 205, 0, .1], [1580, 205, 1, .5], [1810, 205, 2, .9]].forEach(([x, y, v, rot]) => drawSun(tr, cam(1.12, x, y), { v, rot }));
    drawCrow(tr, cam(1.5, 1345, 470));
    drawCrow(tr, [1.5 * 1.7 * Math.cos(.6), 1.5 * 1.7 * Math.sin(.6), -1.5 * 1.7 * Math.sin(.6), 1.5 * 1.7 * Math.cos(.6), 1575, 480], 5, .8);
    drawCrow(tr, [1.5 * 2.8 * Math.cos(1.4), 1.5 * 2.8 * Math.sin(1.4), -1.5 * 2.8 * Math.sin(1.4), 1.5 * 2.8 * Math.cos(1.4), 1805, 490], 16, .45);
  });
  label(1350, 320, 'sun · 14 flame tongues', 17, '#2b170d', 'center'); label(1580, 320, 'sun · 16 flame tongues', 17, '#2b170d', 'center'); label(1810, 320, 'sun · 13 flame tongues', 17, '#2b170d', 'center');
  label(1258, 360, 'each sun has its own oil lamp behind the screen — shoot the sun, the lamp goes out', 17, '#a3170f');
  label(1345, 600, 'hit: the crow drops out', 17, '#2b170d', 'center'); label(1575, 600, 'falls, lifts off → grows, blurs', 17, '#2b170d', 'center'); label(1805, 600, 'gone into the light', 17, '#2b170d', 'center');

  // —— D：关键姿势 ——
  const poses = [['STRIDE IN', POSES.stride], ['LIANGXIANG · hero freeze', POSES.liang], ['DRAWING THE BOW', POSES.draw], ['THE LAST ARROW · spared', POSES.spare]];
  clip(tr, panels.D, () => {
    poses.forEach(([lab, p], i) => { const k = .56, x = 150 + i * 310, y = 885; const r = drawHouYi(tr, cam(k, x, y), p); drawRods(tr, r.rods, r.rods.map((q, j) => [q[0] - 40 + j * 30, 1100]), 1.8, .55); });
  });
  poses.forEach(([lab], i) => label(150 + i * 310, 1068, lab, 18, '#2b170d', 'center'));

  // —— E：头部特写 + 色板 + 光档 ——
  clip(tr, panels.E, () => {
    tr.globalCompositeOperation = 'multiply'; tr.setTransform(2.25, 0, 0, 2.25, 1395, 1010); drawPiece(tr, P.head); tr.globalCompositeOperation = 'source-over';
  });
  // 色板
  const sw = [['vermilion', DYE.red], ['flame', DYE.orange], ['ochre', DYE.yellow], ['malachite', DYE.green], ['jade', DYE.jade], ['indigo', DYE.teal], ['raw hide', DYE.hide], ['ink', DYE.ink]];
  clip(tr, panels.E, () => { tr.globalCompositeOperation = 'multiply'; sw.forEach(([n, c], i) => { tr.fillStyle = c; tr.fillRect(1590 + (i % 4) * 78, 700 + Math.floor(i / 4) * 92, 60, 52); }); tr.globalCompositeOperation = 'source-over'; });
  sw.forEach(([n], i) => label(1620 + (i % 4) * 78, 770 + Math.floor(i / 4) * 92, n, 15, '#2b170d', 'center'));
  label(1590, 690, 'DYES (seen by transmitted light)', 16);
  // 光档：10 盏灯 → 1 盏
  for (let i = 0; i < 10; i++) {
    const x = 1590 + i * 31.5, y = 915, L = 1 + (9 - i) * .42;
    lm.fillStyle = `rgb(${L / 6 * 255},${L / 6 * 255},${L / 6 * 255})`; lm.fillRect(x, y, 29, 95);
    tr.save(); tr.globalCompositeOperation = 'multiply'; tr.fillStyle = DYE.red; tr.fillRect(x + 4, y + 8, 21, 22); tr.fillStyle = DYE.green; tr.fillRect(x + 4, y + 36, 21, 22); tr.fillStyle = DYE.yellow; tr.fillRect(x + 4, y + 64, 21, 22); tr.restore();
    label(x + 14.5, y + 112, String(10 - i), 15, '#2b170d', 'center');
  }
  label(1590, 905, 'LIGHT STEPS · lamps lit 10 → 1 (colours return)', 16);

  // 表头 + 分隔
  fr.save(); fr.setTransform(1, 0, 0, 1, 0, 0); fr.fillStyle = '#140c08'; fr.fillRect(0, 0, W, 64);
  for (const [x0, y0, x1] of Object.values(panels)) { fr.fillStyle = 'rgba(20,12,8,.82)'; fr.fillRect(x0, y0, x1 - x0, 34); }
  fr.strokeStyle = '#140c08'; fr.lineWidth = 6; for (const [x0, y0, x1, y1] of Object.values(panels)) fr.strokeRect(x0, y0, x1 - x0, y1 - y0);
  fr.font = '700 34px "Cormorant Garamond"'; fr.fillStyle = '#f0dcb2'; fr.textBaseline = 'middle'; fr.fillText('HOU YI  —  SHADOW PUPPET MODEL SHEET  v' + v, 22, 34);
  fr.font = '600 21px "Cormorant Garamond"'; fr.fillStyle = '#c9a877'; fr.textAlign = 'right'; fr.fillText('Hou Yi Shoots the Suns · Shadow Puppetry · translucent dyed hide, back-lit by oil lamps', W - 22, 35);
  fr.font = '400 30px "Ma Shan Zheng"'; fr.fillStyle = '#c23a22'; fr.textAlign = 'left'; fr.fillText('后羿', 790, 36);
  fr.restore();
  label(18, 90, 'ASSEMBLED · ON THE LIT SCREEN', 20, '#e9d2a4');
  label(618, 90, 'EXPLODED · 11 PIECES OF DYED HIDE', 20, '#e9d2a4');
  label(1258, 90, 'TEN SUNS · A GOLDEN CROW CUT INSIDE EACH', 20, '#e9d2a4');
  label(18, 666, 'KEY POSES · a carved head never changes — attitude is head angle + body line', 20, '#e9d2a4');
  label(1258, 666, 'HEAD · OPEN-CUT FACE, SWORD BROW, PHOENIX EYE', 20, '#e9d2a4');
  return { useMap: true, lcol: [1, .8, .52], expo: 1.7, bloom: .2, vign: .0, cloth: 1, sat: 1.12, contrast: .18 };
}
let A_r = null;

// —— 风格帧：?test=frame&f=ten | one ——
import { drawLand, groundY } from './scenery.js';
import { SUNPOS } from './suns.js';
import { drawSub } from './hud.js';
import { LEGLEN } from './houyi.js';
export function styleFrame(tr, fr, f) {
  const W = 1920, H = 1080, C = [1, 0, 0, 1, 0, 0];
  tr.setTransform(1, 0, 0, 1, 0, 0); tr.fillStyle = '#fff'; tr.fillRect(0, 0, W, H);
  fr.setTransform(1, 0, 0, 1, 0, 0); fr.clearRect(0, 0, W, H);
  const ten = f === 'ten';
  drawLand(tr, C, { burn: ten ? 1 : 0, flames: ten ? 1 : 0, t: .3 });
  const n = ten ? 10 : 1;
  for (let i = 0; i < n; i++) { const [x, y, rays, v] = SUNPOS[i]; drawSun(tr, [.95, 0, 0, .95, x, y], { n: rays, v, rot: i * .7, seed: i + 3 }); }
  const hx = 560, wy = groundY(hx) - LEGLEN + 8;
  const r = drawHouYi(tr, [1, 0, 0, 1, hx, wy], ten ? POSES.draw : POSES.spare);
  drawRods(tr, r.rods, r.rods.map((q, j) => [q[0] - 120 + j * 50, 1180]), 2.2, .78);
  if (!ten) drawSub(fr, 'But the last one, he spared.');
  const lamps = SUNPOS.slice(0, n).map(([x, y]) => [x, y, 1, .9]);
  return { lamps, expo: 1.75 / Math.sqrt(n), amb: .3, sigB: 700, sigC: 120, haze: ten ? 3 : 0, bloom: ten ? .45 : .3, vign: ten ? .7 : .5, sat: 1.1, contrast: .15 };
}

// —— 手的试画页：?test=hands ——
import { silhouette, fistHand, pinchHand, lampBody, flame as lampFlame, smoke } from './backstage.js';
export function handsTest(fr, t) {
  fr.setTransform(1, 0, 0, 1, 0, 0);
  const gr = fr.createRadialGradient(1300, 380, 50, 1100, 500, 1300); gr.addColorStop(0, '#fff3d2'); gr.addColorStop(.45, '#f0c98a'); gr.addColorStop(1, '#7a4a22');
  fr.fillStyle = gr; fr.fillRect(0, 0, 1920, 1080);
  // 杆
  const rods = [];
  silhouette(fr, g => {
    const a = fistHand(g, [1.7, 0, 0, 1.7, 1250, 900]); rods.push([a.grip, [1310, 60], 7]);
    const b = pinchHand(g, [1.7, 0, 0, 1.7, 620, 930], .3); rods.push([b.gripA, [980, 80], 4.5]); rods.push([b.gripB, [420, 90], 4.5]);
    for (const [p, q, w] of rods) { g.lineWidth = w; g.beginPath(); g.moveTo(p[0] - (q[0] - p[0]) * .25, p[1] - (q[1] - p[1]) * .25); g.lineTo(...q); g.stroke(); }
  }, { dir: [.35, -.94], k: 6 });
  silhouette(fr, g => lampBody(g, 1560, 300, 1.6), { dir: [0, -1], k: 4 });
  lampFlame(fr, 1560, 300, 1.6, t);
  silhouette(fr, g => { lampBody(g, 300, 260, 1.1); lampBody(g, 520, 180, 1.1); }, { dir: [1, 0], k: 3, rimA: .5 });
  smoke(fr, 300, 260, 1.1, t, 3, (x, y) => Math.max(0, 1 - Math.hypot(x - 1560, y - 300) / 1400), 3);
  smoke(fr, 520, 180, 1.1, t, 3, (x, y) => Math.max(0, 1 - Math.hypot(x - 1560, y - 300) / 1400), 5);
  return { frontOnly: true, bloom: .35, vign: .3 };
}
