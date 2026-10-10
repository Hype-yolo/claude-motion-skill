// 全片时间线：108 BPM，21 小节。所有动作、镜头、字幕、音效事件都从这里来。
import { W, H, g, f, ov, setCam, clear, proj, nibs, line, text, dim, LW, FONT, rect, circ, fillV, S, cam, fxWet, fxShadow, knock, TAU, NIBS, lw, trunc, xf } from './draw.js';
import { drawMachine, drawGarden, flower, explodePaths, G, X, M } from './machine.js';
import { SW, SH, TB, border, header, titleBlock, partsList, notes, revCloud, revImprint, cloudLobes, handShadow, stamp, makeDrops, rain, wrap } from './sheet.js';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const ei = t => Math.pow(clamp(t), 3);
export const BEAT = 60 / 108, BAR = BEAT * 4;
export const B = (n, b = 0) => (n - 1) * BAR + b * BEAT;     // 第 n 小节第 b 拍
export const DUR = B(22);                                       // 46.667
const PETAL0 = B(17, 1);                                        // 花瓣：一瓣一拍（竖琴分解和弦）
// ——— 单调插值轨道 ———
function mono(keys) {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]); const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = 0; m[n - 1] = 0; for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
  return t => { if (t <= xs[0]) return ys[0]; if (t >= xs[n - 1]) return ys[n - 1]; let i = 0; while (t > xs[i + 1]) i++; const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1]; };
}
const trk = keys => { const fs = [0, 1, 2].map(j => mono(keys.map(k => [k[0], k[1][j]]))); return t => fs.map(q => q(t)); };
// ——— 镜头：分段（段间硬切） ———
const CAMS = [
  [0, trk([[0, [1600, 1100, .44]], [1.9, [1600, 1100, .455]], [2.3, [1480, 900, .52]], [4.3, [1120, 560, .74]], [5.7, [1400, 1250, .72]], [10.9, [1390, 1240, .76]], [12.4, [1440, 1250, .70]], [15.4, [1500, 1225, .64]], [16.7, [1500, 1225, .645]], [17.7, [1470, 1250, .70]]])],
  [B(9), trk([[B(9), [X - 130, G - 185, 2.05]], [19.0, [X - 80, G - 215, 1.95]], [19.3, [X - 20, G - 330, 1.85]], [20.5, [X + 10, M.pivot[1] + 60, 1.6]], [21.4, [X + 320, 720, 1.1]], [22.3, [1570, 790, .78]]])],
  [B(11), trk([[B(11), [1570, 790, .78]], [23.6, [1610, 840, .77]], [24.44, [1640, 860, .78]], [28.4, [1700, 800, .82]], [29.9, [1760, 740, .95]], [31.1, [1790, 720, 1.05]]])],
  [B(15), trk([[B(15), [1790, 720, 1.05]], [31.9, [1780, 780, .9]], [33.4, [1760, 1330, .72]], [34.4, [1740, 1400, .8]], [35.3, [1668, 1660, 1.38]], [38.9, [1662, 1650, 1.44]], [39.85, [1600, 1100, .47]], [40.25, [1600, 1100, .475]], [41.8, [2430, 1790, 1.25]], [43.4, [2445, 1800, 1.28]], [44.6, [2690, 1925, 1.95]], [DUR, [2690, 1928, 2.0]]])],
];
function camAt(t) { let c = CAMS[0][1]; for (const [t0, fn] of CAMS) if (t >= t0) c = fn; const [x, y, z] = c(t); return { x, y, z }; }
// ——— 旁白 / 字幕 ———
export let LINES = [], DURS = {};
const VO = { v1: 5.2, v2: 12.2, v3: 21.9, v4: 26.1, v5: 35.0, v6: 40.7 };
const SUBPOS = { v1: [940, 300], v2: [1000, 300], v3: [1180, 860], v4: [1180, 860], v5: [1200, 70], v6: [90, 60] };
const NOTETEXT = { v1: 'An apparatus for catching clouds.', v2: 'Thirteen parts, one bellows, one rather optimistic net.', v3: 'Works beautifully. No clouds on this sheet.', v4: 'Revision issued (see REV. 1).', v5: 'It rained on the drawing.', v6: 'Status: works. Slightly damp.' };
export function setLines(lines, dur) { LINES = lines; DURS = dur; }
export function subs() {
  const ids = Object.keys(VO); return ids.map((id, i) => { const t0 = VO[id], L = LINES.find(l => l.id === id); let t1 = Math.max(t0 + DURS[id] + .6, t0 + 1.8); const nx = ids[i + 1]; if (nx) t1 = Math.min(t1 + .3, VO[nx] - .1); if (id === 'v4') t1 = Math.min(t1, B(14) - .1); if (id === 'v5') t1 = Math.min(t1, 38.95); return { id, n: i + 1, t0, t1, text: L ? L.text : '' }; });
}
function subtitle(n, str, u, a, x0, y0, maxW = 880) {
  if (a <= 0) return;
  const c = ov; c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `400 38px Architects`;
  const ls = wrap(str, 38, maxW), tw = Math.max(...ls.map(l => c.measureText(l).width));
  const w = 124 + tw + 36, h = 58 + ls.length * 46;
  x0 = Math.min(x0, W - 40 - w);
  c.globalAlpha = a;
  c.fillStyle = 'rgba(12,28,62,.58)'; c.fillRect(x0, y0, w, h);
  c.strokeStyle = 'rgba(232,240,250,.9)'; c.lineWidth = 1.2; c.strokeRect(x0 + .5, y0 + .5, w, h);
  c.lineWidth = .8; c.strokeRect(x0 + 5.5, y0 + 5.5, w - 10, h - 10);
  c.beginPath(); c.moveTo(x0 + 108, y0 + 16); c.lineTo(x0 + 108, y0 + h - 16); c.stroke();
  // 引线折角（注释框的"指针"）
  c.beginPath(); c.moveTo(x0, y0 + h); c.lineTo(x0 - 18, y0 + h + 18); c.stroke();
  c.fillStyle = 'rgba(234,241,250,1)'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 17px B612`; c.letterSpacing = '3px'; c.fillText('NOTE', x0 + 56, y0 + 28);
  c.font = `700 30px B612`; c.letterSpacing = '0px'; c.fillText(String(n), x0 + 55, y0 + 58);
  c.textAlign = 'left'; c.font = `400 38px Architects`;
  const total = ls.reduce((s, l) => s + l.length, 0); let acc = 0;
  ls.forEach((l, i) => { const uu = clamp((u * total - acc) / l.length); acc += l.length; if (uu <= 0) return; const lw2 = c.measureText(l).width; c.save(); c.beginPath(); c.rect(x0 + 116, y0, (lw2 + 16) * uu, h); c.clip(); c.fillText(l, x0 + 124, y0 + 30 + 23 + i * 46 - 1); c.restore(); });
  c.globalAlpha = 1; c.textBaseline = 'alphabetic';
}
// ——— 机器状态 ———
const eighths = (t, t0, t1) => { const n = (t - t0) / (BEAT / 2); if (n < 0) return 0; const nmax = (t1 - t0) / (BEAT / 2); const k = Math.min(Math.floor(n), nmax); return k + (k < nmax ? eo((n - k) / .35) : 0); };
function gearAt(t) {
  // 运转段：每个八分音符一格（7.5° = 1 齿）；泄气段减速
  let a = .3;
  if (t > B(9)) a += eighths(Math.min(t, B(11)), B(9), B(11)) * TAU / 48;
  if (t > B(11)) { const k = t - B(11); a += Math.min(k, 1.6) * TAU / 48 * 1.2 * (1 - Math.min(k, 1.6) / 3.2) / (BEAT / 2) * .5; }
  if (t > B(15)) a += eighths(Math.min(t, B(16)), B(15), B(16)) * TAU / 48 * 1.5;
  if (t > B(16)) a += (t - B(16)) * .25;
  return a;
}
function boomAt(t) {
  return mono([[0, -.52], [20.0, -.52], [21.2, -.8], [21.8, -.74], [22.3, -.78], [23.0, -.75], [24.4, .05], [24.9, .09], [25.5, .06], [30.95, .06], [31.35, -.5], [31.6, -.45], [32.3, -.3], [33.2, .1], [33.5, .08], [DUR, .08]])(t) + (t > 15.9 && t < 16.67 ? 0 : 0);
}
export const netHC = boomA => [X + Math.cos(boomA) * (M.boomLen + 104), M.pivot[1] + Math.sin(boomA) * (M.boomLen + 104)];
// ——— 雨 ———
const DROPS = makeDrops(7, 150, [1590, 1060, 2020, G - 58], 34.35, 38.6).concat(makeDrops(11, 40, [1560, 1060, 2060, G + 110], 34.8, 38.6));
const LATE = makeDrops(19, 30, [1600, 1060, 2000, G - 58], 38.6, 41.5);
// 结尾一滴落在签名上
const SIGN = [TB.x0 + 200, TB.y0 + 96 + 52];
// ——— 事件（音效）———
export const EV = [];
function ev(t, type, o = {}) { EV.push({ t: +t.toFixed(3), type, ...o }); }
(function buildEV() {
  ev(.06, 'unroll'); ev(.55, 'slap'); ev(.72, 'tsquare', { d: .6 }); ev(1.25, 'pen', { d: .65, v: .8 }); ev(1.45, 'tsquare_off', { d: .5 });
  ev(1.9, 'pen', { d: .45, v: .5 });
  ev(2.25, 'letter', { d: 1.35 }); ev(3.3, 'pen', { d: .5, v: .6 }); ev(3.6, 'letter', { d: .9, v: .6 }); ev(2.8, 'pen', { d: 1.4, v: .3 });
  ev(B(3), 'pen', { d: .8, v: .7 }); ev(B(3, 2), 'pen', { d: 1.4, v: .9 }); ev(B(4), 'compass', { d: 1.2 }); ev(B(4, 1), 'pen', { d: 1.6, v: .6 }); ev(B(4, 2), 'hatch', { d: 1.1 });
  ev(B(5), 'pen', { d: 1.0, v: .7 }); ev(B(5, 1.5), 'letter', { d: 1.3, v: .6 }); ev(9.8, 'letter', { d: .7, v: .8 });
  ev(B(6), 'scratch'); ev(B(6, .6), 'letter', { d: .5, v: .8 }); ev(B(6, 1), 'turn', { d: 1.0 });
  for (let i = 0; i < 14; i++) ev(12.25 + i * .22, 'whoosh', { v: .35 + .3 * ((i * 7) % 5) / 5, pan: ((i * 5) % 7) / 7 - .5 });
  ev(13.6, 'section', { d: 1.4 }); ev(12.3, 'letter', { d: 2.4, v: .35 });
  for (let i = 0; i < 4; i++) ev(B(8, 2 + i * .5), 'click', { v: 1 });
  ev(B(9) - .05, 'scratch', { v: .6 }); ev(B(9), 'letter', { d: .5, v: .7 });
  for (let i = 0; i < 16; i++) ev(B(9) + i * BEAT / 2, 'tick', { v: i % 2 ? .6 : 1 });
  for (let i = 0; i < 8; i++) ev(B(9) + i * BEAT, 'bellows', { v: .5 });
  ev(B(9), 'chain', { d: B(11) - B(9) + .6 }); ev(21.0, 'swing', { d: 1.0 });
  ev(22.3, 'gaugetwitch'); ev(22.5, 'winddown', { d: 1.8 }); ev(23.4, 'deflate', { d: 1.0 });
  ev(24.6, 'room', { d: 4.4 });
  for (let i = 0; i < 15; i++) ev(25.0 + i * .133, 'pen', { d: .12, v: .7 });
  ev(27.05, 'pen', { d: .3, v: .8 }); ev(27.35, 'letter', { d: .6, v: .8 });
  ev(B(14), 'puff', { v: .4 }); ev(B(14, 1), 'puff', { v: .5 }); ev(B(14, 2), 'swell', { d: 1.1 });
  ev(B(15), 'catch'); ev(B(15), 'swing', { d: .6 }); ev(31.4, 'gaugeping'); ev(32.2, 'swing', { d: 1.0 });
  ev(33.5, 'pen', { d: .5, v: .5 }); ev(33.9, 'letter', { d: .4, v: .5 });
  for (const d of DROPS.concat(LATE)) ev(d.t + (d.y1 - d.y0) / d.v, 'drop', { v: .3 + .5 * d.sz, pan: (d.x - 1800) / 600 });
  ev(34.3, 'rainbed', { d: 7.5 }); ev(34.9, 'pen', { d: .85, v: .8 }); ev(35.45, 'pen', { d: .35, v: .6 }); ev(35.7, 'pen', { d: .35, v: .6 });
  for (let k = 0; k < 5; k++) ev(PETAL0 + k * BEAT, 'pen', { d: .32, v: .9 }); ev(38.5, 'letter', { d: .3, v: .5 });
  ev(37.9, 'whoosh', { v: .3 }); ev(39.75, 'stampair'); ev(B(19), 'stamp');
  ev(40.35, 'whoosh', { v: .4 }); ev(42.0, 'drop', { v: .9, pan: .2 });
  ev(43.8, 'letter', { d: .9, v: .8 }); ev(44.6, 'letter', { d: 1.0, v: .8 }); ev(46.0, 'cap');
  for (const id of Object.keys(VO)) ev(VO[id], 'vo', { id });
})();
// ——— 渲染 ———
export function renderFilm(t) {
  const c = camAt(t);
  // 开印章时镜头轻震
  const shake = (t > 40 && t < 40.35 ? Math.sin((t - 40) * 90) * 5 * (1 - (t - 40) / .35) : 0) + (t > .55 && t < .8 ? Math.sin((t - .55) * 80) * 4 * (1 - (t - .55) / .25) : 0);
  setCam({ x: c.x, y: c.y + shake / c.z, z: c.z, r: 0 });
  clear();
  const P = {};
  // 投影方式：爆炸时转成斜二测，之后保持 0.42
  proj.k = lerp(0, .5, eio(seg(t, B(6), B(6) + 1.1))) - .08 * ss(seg(t, 16.6, 17.8));
  // 图框、丁字尺
  border(seg(t, .95, 2.35));
  // 页眉
  header(seg(t, B(2), B(2) + 1.35), seg(t, 3.3, 4.3));
  // 标题栏、零件表、注释
  const tbU = seg(t, 2.6, 4.6);
  const stampT = B(19);
  const signWet = seg(t, 42.05, 43.2);
  titleBlock({ u: tbU, sign: seg(t, 4.0, 4.9), last: seg(t, 43.8, 45.6) });
  partsList(seg(t, 12.3, 15.6));
  const S0 = subs();
  notes(S0.map(s => [NOTETEXT[s.id], seg(t, s.t0 + .2, s.t0 + 1.4)]), seg(t, 4.2, 5.2));
  // Fig 标签
  figLabel(t);
  // 花坛
  drawGarden({ u: seg(t, 6.1, 7.6), ud: seg(t, 7.2, 8.4), uh: seg(t, 7.9, 8.9), ug: seg(t, 4.5, 5.3) });
  // 花：低垂的老花 + 雨后新花
  const lift = ss(seg(t, 35.2, 36.8));
  flower(1570, G - 62, 96 + 18 * lift, .85 * (1 - lift), .25 + .6 * lift, seg(t, 8.0, 9.3), { sway: .05 * Math.sin(t * 1.3) * lift });
  flower(1525, G - 62, 34 + 20 * lift, .5 * (1 - lift), lift * .6, seg(t, 8.3, 9.1), { size: .5, leaf: .5 });
  flower(1730, G - 62, 26 + 30 * lift, .6 * (1 - lift), lift * .7, seg(t, 8.5, 9.2), { size: .45, leaf: .45 });
  heroFlower(t);
  // 机器
  const E = t < B(8, 2) ? eio(seg(t, B(6) + 1.05, 15.5)) : 1 - eighths(t, B(8, 2), B(9)) / 4;
  const boomA = lerp(boomAt(t), -.18, t < B(9) ? E : 0);
  const bel = t < B(9) ? .45 : t < B(11) ? .45 + .4 * Math.sin((t - B(9)) / BEAT * Math.PI) : t < B(15) ? .45 * (1 - ss(seg(t, 23.3, 24.3))) : .45 * ss(seg(t, 31.1, 31.8)) + .3 * Math.sin((t - B(15)) / BEAT * Math.PI) * seg(t, 31.1, 31.8);
  const vane = t < 22.9 ? .12 * Math.sin(t * 2) ** 2 : t < B(15) ? .1 + .85 * ss(seg(t, 23.0, 24.2)) : .95 - .95 * eo(seg(t, B(15), B(15) + .3)) + .1 * Math.sin(t * 5) ** 2;
  const gv = t < 22.3 ? 0 : t < 31.3 ? .06 * Math.sin((t - 22.3) * 30) * Math.exp(-(t - 22.3) * 4) : clamp(back(seg(t, 31.3, 31.7)), 0, 1.08);
  const secX = t < 13.5 ? null : t < 16.3 ? lerp(M.house[0] - 20, M.house[2] + 20, eio(seg(t, 13.6, 15.0))) : t < 16.66 ? lerp(M.house[2] + 20, M.house[0] - 20, seg(t, 16.3, 16.66)) : null;
  const drawn = {
    c: seg(t, B(3), B(3) + .9), o: seg(t, B(3, 2), B(4, 2.3)), g: seg(t, B(4), B(4, 2.2)), d: seg(t, B(4, 1), B(5, .2)), h: seg(t, B(4, 2), B(5, 1)), b: seg(t, 9.3, 10.7),
  };
  const catchT = B(15), caught = t >= catchT + .12;
  const bag = caught ? eo(seg(t, catchT, catchT + .5)) : 0;
  const mp = { E, gear: gearAt(t), boom: boomA, bellows: bel, vane, gauge: gv, section: secX, pr: drawn, bag, balloons: t < 31 };
  if (t < 4.4) { /* 机器还没画 */ } else drawMachine({ ...mp, net: caught ? 'skip' : undefined });
  if (t > B(6) && t < B(9) + .3) explodePaths(E, boomA, 1);
  if (t < 4.4) {}
  // 尺寸线（活的）
  dims(t, E, boomA);
  // 运转段的活标注：齿轮转速
  if (t > B(9) && t < B(11) + .8) { const a = clamp(seg(t, B(9) + .2, B(9) + .8)) * (1 - seg(t, B(11), B(11) + .8)); if (a > 0) { text(`n = ${Math.round(108 / 2 * (1 - seg(t, B(11), B(11) + 1.5)))} RPM`, X - 470, G - 400, { size: 28, v: a }); } }
  // (NO CLOUDS ON SHEET)
  const nc = seg(t, 22.5, 23.3) * (1 - seg(t, 28.9, 29.5));
  if (nc > 0) { text('(NO CLOUDS ON SHEET)', 1800, 632, { size: 30, u: nc, v: .75, align: 'center' }); }
  // 修订云线 → 云
  cloud(t, boomA, caught, mp);
  // 雨
  if (t > 33.3) rainScene(t);
  // 印章
  stampScene(t);
  // 签名洇开
  if (signWet > 0) { fxWet(SIGN[0], SIGN[1], 40 + 120 * eo(signWet), .95); fxWet(SIGN[0] + 90, SIGN[1] + 6, 30 + 70 * eo(seg(t, 42.2, 43.6)), .8); }
  if (t > 41.2 && t < 42.08) { const k = seg(t, 41.2, 42.05); const y = lerp(SIGN[1] - 700, SIGN[1], ei(k)); line([[SIGN[0], y - 40], [SIGN[0], y]], { w: LW.thin, v: .9, nib: false }); }
  // 丁字尺
  tsquare(t);
  nibs(1);
  // 字幕
  for (const s of S0) { if (t < s.t0 - .05 || t > s.t1 + .2) continue; const a = seg(t, s.t0 - .05, s.t0 + .15) * (1 - seg(t, s.t1, s.t1 + .2)); const [x0, y0] = SUBPOS[s.id]; subtitle(s.n, s.text, seg(t, s.t0, s.t0 + .35), a, x0, y0, s.id === 'v5' ? 600 : 880); }
  // 纸卷
  const roll = t < .6 ? [lerp(260, SW, eo(seg(t, 0, .55))), 80] : [1e6, 80];
  return { cam: c, roll, sheet: [SW, SH], seed: 3, wetBlur: 1.35, fade: seg(t, DUR - .5, DUR) };
}
function back(x, s = 1.8) { x = clamp(x) - 1; return 1 + x * x * ((s + 1) * x + s); }
function figLabel(t) {
  const x = 2090, y = G - 40;
  const u1 = seg(t, 9.9, 10.5);
  if (u1 <= 0) return;
  const n = t < B(6) ? '1' : t < B(9) ? '2' : '3';
  text('FIG.', x - 30, y, { size: 64, align: 'right', ls: 4, u: u1 });
  // 编号改写：划掉旧号 → 写新号
  const tw = [B(6), B(9)];
  let shown = '1';
  if (t >= tw[0]) shown = t < tw[1] ? '2' : '3';
  const prev = shown === '2' ? '1' : shown === '3' ? '2' : null;
  const tc = shown === '2' ? tw[0] : tw[1];
  if (prev && t < tc + 1.6) {
    text(prev, x + 10, y, { size: 64, v: .5 });
    line([[x - 2, y - 14], [x + 50, y - 34]], { w: LW.det, u: seg(t, tc - .05, tc + .15) });
    text(shown, x + 70, y, { size: 64, u: seg(t, tc + .15, tc + .45) });
    text(shown === '2' ? 'EXPLODED VIEW' : 'IN OPERATION', x - 190, y + 44, { size: 26, font: FONT.tech, ls: 5, u: seg(t, tc + .3, tc + .9) });
    if (t > tc + .8) {}
  } else {
    text(shown, x + 10, y, { size: 64, u: u1 });
    if (shown !== '1') text(shown === '2' ? 'EXPLODED VIEW' : 'IN OPERATION', x - 190, y + 44, { size: 26, font: FONT.tech, ls: 5 });
  }
  line([[x - 190, y + 14], [x + 110, y + 14]], { w: LW.det, u: u1 });
}
function dims(t, E, boomA) {
  const u = seg(t, B(5), B(5) + 1.1) * (1 - seg(t, B(6), B(6) + .5));
  const ub = u + (t > B(9) ? 0 : 0);
  if (u > 0) {
    dim([X - 322, G - 28], [X + 198, G - 28], 118, '1560', { u });
    dim([X, G - 1136], [X, G], 470, '3410', { u, size: 26 });
    dim([X, M.mastTop], [X, M.mastBot], -150, '1680', { u });
    const p0 = [X, M.pivot[1]], p1 = [X + Math.cos(boomA) * M.boomLen, M.pivot[1] + Math.sin(boomA) * M.boomLen];
    dim(p0, p1, -70, '1800', { u });
  }
  // 爆炸：活尺寸（数字跟着变）
  const ue = seg(t, 12.6, 13.2) * (1 - seg(t, 16.55, 16.75));
  if (ue > 0 && E > .02) {
    const e1 = clamp(E * 1.2), gap = 170 * e1 - 0;           // 桅杆顶 ↔ 顶箱
    const headE = E, mastE = E;
    const topM = M.mastTop - 170 * mastE, botH = M.pivot[1] + 40 - 260 * headE;
    const val = Math.max(0, Math.round((topM - botH) * 3));
    dim([X + 60, topM], [X + 60, botH], -110, String(val), { d: -36, size: 32, u: ue });
    // 网 ↔ 吊臂尖
    const bt = [X + 80 * E + Math.cos(boomA) * M.boomLen, M.pivot[1] - 280 * E + Math.sin(boomA) * M.boomLen];
    const nt = [X + 210 * E + Math.cos(boomA) * M.boomLen, M.pivot[1] - 300 * E + Math.sin(boomA) * M.boomLen];
    if (Math.hypot(nt[0] - bt[0], nt[1] - bt[1]) > 30) dim(bt, nt, -60, String(Math.round(Math.hypot(nt[0] - bt[0], nt[1] - bt[1]) * 3)), { size: 28, u: ue, d: -10 });
  }
}
// 丁字尺：0.7–1.3 从下滑到上图框线，1.25–1.9 沿尺边画线，1.45–2.0 退出
function tsquare(t) {
  if (t < .66 || t > 2.1) return;
  const yEdge = t < 1.3 ? lerp(SH + 300, 80, eo(seg(t, .7, 1.28))) : t < 1.5 ? 80 : lerp(80, -260, ei(seg(t, 1.5, 2.05)));
  const x0 = 40, x1 = SW - 180, th = 110;
  const blade = [[x0, yEdge], [x1, yEdge], [x1, yEdge + th], [x0, yEdge + th]];
  fxShadow(blade.map(([x, y]) => [x + 22, y + 30]), .75, 12);
  knock(blade); fillV(blade, .2);
  line(blade, { w: LW.out * 1.4, closed: true, v: 1, nib: false });
  line([[x0, yEdge + 12], [x1, yEdge + 12]], { w: LW.thin, v: .6, nib: false });
  // 刻度
  for (let x = x0 + 40; x < x1; x += 40) line([[x, yEdge + th], [x, yEdge + th - ((x / 40) % 5 ? 14 : 30)]], { w: LW.hair, v: .7, nib: false });
  // 尺头
  const hd = [[x0 - 40, yEdge - 60], [x0 + 60, yEdge - 60], [x0 + 60, yEdge + th + 60], [x0 - 40, yEdge + th + 60]];
  fxShadow(hd.map(([x, y]) => [x + 22, y + 30]), .75, 12); knock(hd); fillV(hd, .26); line(hd, { w: LW.out * 1.4, closed: true, v: 1, nib: false });
  line(circ(x0 + 10, yEdge + th / 2, 14, 16), { w: LW.det, closed: true, v: .8, nib: false });
}
function cloud(t, boomA, caught, mp) {
  if (t < 24.6) return;
  const C0 = [1800, 620];
  const drawU = seg(t, 25.0, 27.0);
  const hand = t < 28.7;
  const pulse = (t0) => Math.sin(clamp((t - t0) / .45) * Math.PI) * (t > t0 && t < t0 + .45 ? 1 : 0);
  const breath = .07 * pulse(B(14)) + .1 * pulse(B(14, 1));
  const pf = Math.max(breath, eio(seg(t, B(14, 2), B(15) - .15)));
  const liftK = eo(seg(t, B(14, 2) + .2, B(15) + .3));
  // 云的位置：醒来后向网漂过去，接住后跟着网走
  const hc = netHC(boomA);
  let cx = C0[0], cy = C0[1];
  const drift = eio(seg(t, B(14, 2), B(15)));
  cx = lerp(cx, 1760, drift); cy = lerp(cy, 520, drift);
  if (t > B(15)) { const k = eio(seg(t, B(15), B(15) + .5)); cx = lerp(cx, hc[0] + 10, k); cy = lerp(cy, hc[1] - 70, k); }
  const dark = ss(seg(t, 32.6, 34.2)) * .8;
  // 纸上的修订云线（醒来前）/ 印子（醒来后）
  if (pf < .15) revCloud(C0[0], C0[1], 250, 120, { pf: 0, u: drawU, tremble: 0 });
  if (liftK > 0) revImprint(C0[0], C0[1], 250, 120, Math.min(1, liftK * 2));
  // 修订三角 + 注释
  const tx = C0[0] + 250, ty = C0[1] + 210;
  const ut = seg(t, 27.0, 27.3);
  if (ut > 0) {
    line([[tx, ty - 30], [tx + 30, ty + 22], [tx - 30, ty + 22]], { w: LW.det, closed: true, u: ut });
    text('1', tx, ty + 14, { size: 30, align: 'center', u: seg(t, 27.25, 27.35) });
    text('REV. 1 — ADD ONE (1) CLOUD.', tx - 60, ty + 70, { size: 30, u: seg(t, 27.35, 27.85) });
    text('C.W.', tx - 60, ty + 108, { size: 30, font: FONT.sign, u: seg(t, 27.8, 28.0) });
  }
  // 鼓起的云（全片唯一有柔和体积和辉光的东西）
  if (pf >= .15) {
    const glowA = clamp(liftK) * (1 - .6 * dark);
    if (glowA > 0) {   // 柔和白色辉光
      const L = cloudLobes(cx, cy, 250, 120, pf);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.filter = `blur(${40 * cam.z}px)`;
      g.fillStyle = `rgba(255,255,255,${.22 * glowA})`; g.beginPath();
      for (const q of L) if (q.r > 1) { const [sx, sy] = S(q.x, q.y); g.moveTo(sx + q.r * cam.z * 1.08, sy); g.arc(sx, sy, q.r * cam.z * 1.08, 0, TAU); }
      g.fill(); g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    }
    const tr = t < B(15) ? .6 * seg(t, B(14), B(14) + .3) * (1 - liftK) : 0;
    revCloud(cx, cy, 250, 120, { pf, lift: liftK, dark, t, tremble: tr, glow: glowA });
  }
  // 接住后：网画在云上面
  if (caught) drawMachine({ ...mp, net: 'only', netNoFill: true, bagFill: eo(seg(t, B(15), B(15) + .5)) * (1 - .4 * dark) });
  // 手影 + 笔尖
  if (hand) {
    let nx, ny;
    if (t < 25.0) { const k = eo(seg(t, 24.5, 25.0)); nx = lerp(2600, C0[0], k); ny = lerp(1300, C0[1] - 120, k); }
    else if (t < 27.0) { const L = cloudLobes(C0[0], C0[1], 250, 120, 0); const i = Math.min(14, Math.floor(drawU * 15)); const a = L[i], b = L[(i + 1) % 15], k = drawU * 15 - i; nx = lerp(a.x, b.x, k) + Math.cos(a.a) * 20; ny = lerp(a.y, b.y, k) + Math.sin(a.a) * 20 - 18 * Math.sin(k * Math.PI); }
    else if (t < 27.35) { const k = seg(t, 27.0, 27.35); nx = lerp(tx - 30, tx + 30, k); ny = ty + 20; }
    else if (t < 28.0) { const k = seg(t, 27.35, 28.0); nx = lerp(tx - 60, tx + 420, k); ny = ty + 62 + 40 * seg(t, 27.8, 28.0); }
    else { const k = ei(seg(t, 28.0, 28.7)); nx = lerp(tx + 420, tx + 1200, k); ny = lerp(ty + 100, ty + 900, k); }
    const a = seg(t, 24.5, 24.8) * (1 - seg(t, 28.3, 28.7));
    handShadow(nx, ny, a);
    if (t > 25.0 && t < 28.0) NIBS.push([nx, ny, 0]);
  }
}
function rainScene(t) {
  // 雨线标注：先画几滴带 Ø 的水滴标注
  const ua = seg(t, 33.4, 34.0) * (1 - seg(t, 34.3, 34.6));
  const specs = [[1650, 1180, '4'], [1790, 1250, '6'], [1930, 1170, '5']];
  for (const [x, y, dd] of specs) {
    if (ua <= 0) break;
    const r = 7 + +dd * 1.6;
    const drop = [[x, y - r * 2.4], [x + r * .85, y - r * .4], [x + r * .7, y + r * .45], [x, y + r], [x - r * .7, y + r * .45], [x - r * .85, y - r * .4]];
    line(drop, { w: LW.det, closed: true, u: ua });
    line([[x + r, y], [x + 60, y - 40], [x + 110, y - 40]], { w: LW.hair, u: ua, nib: false });
    text(`Ø ${dd}`, x + 66, y - 48, { size: 24, u: ua, nib: false });
  }
  const ud = seg(t, 33.6, 34.1) * (1 - seg(t, 34.4, 34.7));
  if (ud > 0) dim([2080, 1100], [2080, G - 60], 0, '2280', { size: 24, u: ud });
  // 真雨
  rain(DROPS, t);
  rain(LATE, t);
  // 大水渍：花坛下
  const bloom = eo(seg(t, 34.8, 37.6));
  if (bloom > 0) { fxWet(1665, G - 40, 30 + 190 * bloom, .95); fxWet(1600, G - 10, 20 + 110 * eo(seg(t, 35.4, 38)), .85); fxWet(1760, G + 20, 20 + 120 * eo(seg(t, 35.9, 38.6)), .85); }
  const puddle = ss(seg(t, 35.0, 38.0));
  if (puddle > 0) { fxWet(1700, G - 20, 60 + 220 * puddle, .9); fxWet(1600, G + 30, 40 + 130 * puddle, .8); fxWet(1860, G + 10, 30 + 110 * ss(seg(t, 36, 39)), .7); }
}
function stampScene(t) {
  const x = TB.x0 + 505, y = TB.y0 + 272;
  if (t > 39.55 && t < B(19)) { const k = seg(t, 39.55, B(19)); fxShadow(rect(x - 115, y - 38, x + 115, y + 38).map(([a, b]) => [a + 90 * (1 - k), b + 120 * (1 - k)]), .15 + .4 * k, 30 * (1 - k) + 6); }
  if (t >= B(19)) stamp(x, y, .6 + .05 * (1 - eo(seg(t, B(19), B(19) + .12))), 1);
}

// 雨后的主花：逐笔画出（茎 → 叶 → 花瓣一瓣一拍 → 花心）
function heroFlower(t) {
  if (t < 34.85) return;
  const rx = 1665, ry = G - 62, H0 = 200, d = -45;
  const sway = .012 * Math.sin(t * 1.3) * seg(t, 36, 37);
  const stem = []; for (let i = 0; i <= 30; i++) { const k = i / 30; stem.push([rx + 10 * Math.sin(k * 3.2) + sway * H0 * k * k * 3, ry - H0 * k]); }
  line(stem, { w: LW.out, u: eo(seg(t, 34.9, 35.75)), d });
  const hd = stem[30];
  // 叶
  const leaf = (k, side, t0) => { const u = seg(t, t0, t0 + .35); if (u <= 0) return; const [bx, by] = stem[k], la = -Math.PI / 2 + side * 1.0, L = 86;
    const tip = [bx + Math.cos(la) * L, by + Math.sin(la) * L], n = [-Math.sin(la) * 22, Math.cos(la) * 22];
    const pts = []; for (let i = 0; i <= 16; i++) { const q = i / 16, w = Math.sin(q * Math.PI); pts.push([bx + (tip[0] - bx) * q + n[0] * w, by + (tip[1] - by) * q + n[1] * w]); }
    for (let i = 16; i >= 0; i--) { const q = i / 16, w = Math.sin(q * Math.PI); pts.push([bx + (tip[0] - bx) * q - n[0] * w, by + (tip[1] - by) * q - n[1] * w]); }
    line(pts, { w: LW.det, u, d }); line([[bx, by], tip], { w: LW.thin, u: seg(t, t0 + .25, t0 + .5), d, nib: false }); };
  leaf(9, 1, 35.45); leaf(16, -1, 35.7);
  // 花瓣
  for (let k = 0; k < 5; k++) {
    const t0 = PETAL0 + k * BEAT, u = eo(seg(t, t0, t0 + .34)); if (u <= 0) continue;
    const a = -Math.PI / 2 + (k - 2) * (TAU / 5) + .2, L = 62, W2 = 26;
    const c = Math.cos(a), s2 = Math.sin(a), P = (x, y) => [hd[0] + c * x - s2 * y, hd[1] + s2 * x + c * y];
    const pts = []; for (let i = 0; i <= 18; i++) { const q = i / 18, w = Math.sin(q * Math.PI) * (1 - .35 * q); pts.push(P(12 + L * q, W2 * w)); }
    for (let i = 18; i >= 0; i--) { const q = i / 18, w = Math.sin(q * Math.PI) * (1 - .35 * q); pts.push(P(12 + L * q, -W2 * w)); }
    knock(pts, d); line(pts, { w: LW.det, u, d });
    const uv = seg(t, t0 + .25, t0 + .5); if (uv > 0) { line([P(18, 0), P(60, 0)], { w: LW.hair, u: uv, d, nib: false }); line([P(24, 6), P(48, 12)], { w: LW.hair, u: uv, d, nib: false }); line([P(24, -6), P(48, -12)], { w: LW.hair, u: uv, d, nib: false }); }
  }
  // 花心
  const uc = seg(t, 38.45, 38.8);
  if (uc > 0) { knock(circ(hd[0], hd[1], 15, 24), d); line(circ(hd[0], hd[1], 15, 30, -Math.PI / 2, -Math.PI / 2 + TAU), { w: LW.det, u: uc, d }); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; if (uc > i / 7) line(circ(hd[0] + Math.cos(a) * 7, hd[1] + Math.sin(a) * 7, 1.6, 8), { w: LW.thin, closed: true, d, nib: false }); } }
}
