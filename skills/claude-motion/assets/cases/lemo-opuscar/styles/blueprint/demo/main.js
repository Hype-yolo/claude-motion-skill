import { W, H, g, f, ov, inkC, fxC, ovC, setCam, clear, proj, nibs, line, text, dim, LW, FONT, rect, circ, fillV, S, cam, fxWet } from './draw.js';
import { makePaper } from './paper.js';
import { renderFilm, DUR, EV, setLines, subs } from './film.js';
import { drawMachine, drawGarden, flower, explodePaths, G, X, M, gearAngles } from './machine.js';
import { SW, SH, border, header, titleBlock, partsList, notes, revCloud, revImprint, handShadow, stamp, makeDrops, rain } from './sheet.js';
const out = document.getElementById('c');
const comp = makePaper(out, W, H);
const Q = new URLSearchParams(location.search);
await Promise.all(['400 40px Architects', '400 40px B612', '700 40px B612', '400 40px B612Mono', '400 40px Allura'].map(s => document.fonts.load(s)));

// 屏幕固定的字幕：图纸上的 NOTE 注释框
function subtitle(n, str, u = 1, a = 1) {
  if (a <= 0) return;
  const c = ov; c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `400 44px Architects`; const tw = c.measureText(str).width;
  const x0 = 96, y1 = H - 64, x1 = x0 + 150 + tw + 44, y0 = y1 - 94;
  c.globalAlpha = a;
  c.fillStyle = 'rgba(13,30,66,.84)'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = 'rgba(232,240,250,.95)';
  c.lineWidth = 2.2; c.strokeRect(x0, y0, x1 - x0, y1 - y0); c.lineWidth = 1; c.strokeRect(x0 + 7, y0 + 7, x1 - x0 - 14, y1 - y0 - 14);
  c.lineWidth = 1.4; c.beginPath(); c.moveTo(x0 + 136, y0 + 18); c.lineTo(x0 + 136, y1 - 18); c.stroke();
  c.fillStyle = 'rgba(232,240,250,1)'; c.font = `700 22px B612`; c.letterSpacing = '3px'; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.fillText('NOTE', x0 + 70, y0 + 34);
  c.font = `700 36px B612`; c.fillText(String(n), x0 + 70, y0 + 66); c.letterSpacing = '0px'; c.textAlign = 'left';
  c.font = `400 44px Architects`; c.save(); c.beginPath(); c.rect(x0 + 150, y0, (tw + 24) * u, y1 - y0); c.clip();
  c.fillText(str, x0 + 162, (y0 + y1) / 2 + 3); c.restore(); c.globalAlpha = 1; c.textBaseline = 'alphabetic';
}

function frame1() {  // 标题栏 + Fig. 1 总图
  setCam({ x: 1650, y: 1310, z: .6 }); proj.k = 0; clear();
  border(1); header(1, 1);
  drawGarden(); flower(1570, G - 62, 96, .85, .25, 1); flower(1525, G - 62, 34, .5, 0, 1, { size: .5, leaf: .5 }); flower(1730, G - 62, 26, .6, 0, 1, { size: .4, leaf: .4 });
  drawMachine({ gear: .3, boom: -.52, bellows: .45, vane: .15, gauge: 0 });
  fig1Dims(1);
  text('FIG. 1', 2090, G - 24, { size: 64, font: FONT.hand, ls: 6, align: 'center' });
  line([[2000, G - 10], [2180, G - 10]], { w: LW.det });
  notes([['An apparatus for catching clouds.', 1]]);
  partsList(1); titleBlock({});
  subtitle(1, 'Figure one. An apparatus for catching clouds.', 1);
}
export function fig1Dims(u) {
  dim([X - 322, G - 28], [X + 198, G - 28], 118, '1560', { u });
  dim([X, G - 1136], [X, G], 470, '3410', { u, size: 26 });
  dim([X, M.mastTop], [X, M.mastBot], -150, '1680', { u });
  const a = -.52, p0 = [X, M.pivot[1]], p1 = [X + Math.cos(a) * M.boomLen, M.pivot[1] + Math.sin(a) * M.boomLen];
  dim(p0, p1, -70, '1800', { u });
}
function frame2() {  // 爆炸视图
  setCam({ x: 1600, y: 1304, z: .62 }); proj.k = .5; clear();
  border(1); header(1, 1);
  drawGarden();
  flower(1570, G - 62, 96, .85, .25, 1);
  const E = 1;
  partsList(1); titleBlock({}); notes([['An apparatus for catching clouds.', 1]]);
  explodePaths(E, -.18);
  drawMachine({ E, gear: .3, boom: -.18, bellows: .45, vane: .15, gauge: 0, section: X - 60 });
  // 活标注：桅杆顶 ↔ 顶箱间距
  const gap = 260 - 170;
  dim([X + 60, M.mastTop - 170], [X + 60, M.pivot[1] + 40 - 260], -110, String(Math.round(gap * 3)), { d: -36, size: 32 });
  // 装配轴（点划线）
  for (const [x, y0, y1] of [[X, M.pivot[1] - 400, M.mastBot + 80]]) line([[x, y0], [x, y1]], { w: LW.hair, dash: 'center', v: .7 });
  text('FIG. 2', 2090, G - 60, { size: 64, font: FONT.hand, ls: 6, align: 'center' });
  text('EXPLODED VIEW', 2090, G - 16, { size: 26, font: FONT.tech, ls: 5, align: 'center' });
  subtitle(2, 'Figure two. Thirteen parts, one bellows, and a rather optimistic net.', 1);
}
function frame3() {  // 修订云线变成雨云
  setCam({ x: 1800, y: 990, z: .92 }); proj.k = 0; clear();
  border(1); header(1, 1);
  drawGarden(); flower(1570, G - 62, 96, .85, .25, 1);
  drawMachine({ gear: .3, boom: -.03, bellows: .2, vane: .75, gauge: 0 });
  // 离开纸面后留下的曝光印子
  revImprint(2010, 790, 250, 120, .8);
  text('△', 2150, 470, { size: 1, u: 0 });
  // 修订三角 + 注释
  const tx = 2150, ty = 1130;
  line([[tx, ty - 30], [tx + 30, ty + 22], [tx - 30, ty + 22]], { w: LW.det, closed: true });
  text('1', tx, ty + 14, { size: 30, align: 'center' });
  text('REV. 1 — ADD ONE (1) CLOUD.', tx + 48, ty + 12, { size: 30 });
  text('C.W.', tx + 48, ty + 50, { size: 26, font: FONT.sign });
  revCloud(2010, 660, 262, 128, { pf: .9, lift: .75, dark: .5, t: 0 });
  dim([1730, 500], [2290, 500], -40, '1680', { size: 26 });
  text('(NO CLOUDS ON SHEET)', 1330, 690, { size: 26, v: .3 });
  subtitle(4, 'So, I issued a revision.', 1);
}
function styleframe() { frame1(); }
const lines = await (await fetch('lines.json')).json();
const durs = await (await fetch('voices/dur.json')).json();
setLines(lines, durs);
window.render = t => {
  const fr = Q.get('frame');
  if (fr) {
    if (fr === '1') frame1(); else if (fr === '2') frame2(); else frame3();
    nibs(); comp(inkC, fxC, ovC, { sheet: [SW, SH], cam, seed: 3 }); return;
  }
  const o = renderFilm(t);
  if (Q.has('nosub') || Q.has('poster')) ov.clearRect(0, 0, W, H);
  if (Q.has('poster')) {   // 海报：片名写在左上的天空里
    const bx = 1120, by = 830, bw = 770, bh = 200;
    ov.setTransform(1, 0, 0, 1, 0, 0); ov.fillStyle = 'rgba(12,28,62,.5)'; ov.fillRect(bx, by, bw, bh);
    ov.strokeStyle = 'rgba(234,241,250,.9)'; ov.lineWidth = 1.5; ov.strokeRect(bx + .5, by + .5, bw, bh); ov.strokeRect(bx + 8.5, by + 8.5, bw - 16, bh - 16);
    ov.fillStyle = '#eaf1fa'; ov.font = '400 58px Architects'; ov.letterSpacing = '4px'; ov.fillText('THE CLOUD CATCHER', bx + 34, by + 84);
    ov.font = '700 26px B612'; ov.letterSpacing = '6px'; ov.fillText('PATENT PENDING', bx + 38, by + 134);
    ov.font = '400 20px B612'; ov.letterSpacing = '3px'; ov.fillText('A BLUEPRINT FILM  ·  LemoLab × Claude Opus 5.5', bx + 38, by + 170); ov.letterSpacing = '0px';
  }
  comp(inkC, fxC, ovC, o);
};
window.DUR = DUR; window.EV = EV; window.SUBS = subs();
window.READY = true;
