// 正片时间线：一镜到底在同一页画上移动；45s 后拉出成书页（end.js）
import { layer, clear, line, fill, dab, text, handCircle, ellipse, CAM, BOIL, W, H, sx, sy } from './crayon.js';
import { group, clearGroup, part } from './rig.js';
import { girl, sheep, moon, star } from './chars.js';
import { drawWorld, drawLadder, drawStars, drawWash, bandFront, BANDS, STARS, HOUSE, MOON, LAD, ridgeY, pr } from './world.js';
import { PAL } from './pal.js';
import { clamp, lerp, hash, track, ss, eio, eo } from '/core/lib.js';
import { endFrame } from './end.js';
const K = PAL.crayon;
const POSTER = new URLSearchParams(location.search).get('poster') === '1';
export const DUR = 52;
const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 3;

// —— 旁白与字幕（v3 声线 af_heart；t = 语音起点；字幕停留 ≥1.8s 且 ≥ 语音 + 0.6s）——
export const LINES = [
  { id: 'n1', t: 5.5, d: 1.446, text: 'The moon could not sleep.' },
  { id: 'n2', t: 8.05, d: 2.648, text: 'It tossed, and it turned, and it counted sheep.' },
  { id: 'n3', t: 15.3, d: 2.35, text: 'Down below, someone else was awake, too.' },
  { id: 'n4', t: 20.4, d: 2.441, text: 'So she climbed up, up, up, onto the roof,' },
  { id: 'n5', t: 24.8, d: 2.22, text: 'and sang the softest song she knew.' },
  { id: 'n6', t: 40.2, d: 2.027, text: 'And at last, the moon fell asleep.' },
  { id: 'n7', t: 49.2, d: 1.072, text: 'Night, night.' },
];
export const SUBS = LINES.map((L, i) => { const t0 = L.t - 0.1; let t1 = Math.max(t0 + 1.8, L.t + L.d + 0.7); const nx = LINES[i + 1]; if (nx) t1 = Math.min(t1, nx.t - 0.25); return { t0, t1, text: L.text }; });

// —— 镜头（世界坐标中心 + 缩放），单调三次插值 ——
const camT = track([
  [0, [1600, 900, 0.6]], [5.6, [1600, 900, 0.6]], [8.2, [2420, 650, 1.35]], [14.9, [2420, 650, 1.35]],
  [17.6, [1960, 1130, 0.88]], [19.8, [1960, 1130, 0.88]], [20.9, [1795, 1480, 1.7]], [21.6, [1795, 1480, 1.7]],
  [22.6, [1795, 1425, 1.7]], [23.5, [1795, 1355, 1.7]], [24.2, [1790, 1290, 1.55]], [27.1, [2110, 800, 0.75]], [37.4, [2110, 800, 0.75]],
  [40.0, [2400, 610, 1.25]], [42.4, [2410, 600, 1.3]], [43.3, [1458, 955, 2.0]], [44.8, [1458, 955, 2.0]], [46.0, [1600, 900, 0.6]],
]);

// —— 事件（拟音/配乐 cue，导出给 mix.py）——
export const EV = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });
LINES.forEach(L => ev(L.t, 'voice', { id: L.id }));
// 开场画线、涂色
[[0.3, 0.45, 'draw', -0.3], [0.6, 0.6, 'draw', -0.2], [0.9, 0.7, 'draw', 0.5], [1.7, 0.7, 'draw', -0.7]].forEach(([t, d, ty, pan]) => ev(t, 'scratch', { dur: d, pan }));
ev(1.67, 'pop', { pan: 0.5 });
ev(2.6, 'write', { dur: 1.6, pan: -0.5 });
[[2.6, 1.0, 0.5], [3.0, 1.0, -0.1], [3.3, 1.0, -0.2], [3.6, 1.0, -0.2], [4.0, 0.8, -0.7]].forEach(([t, d, pan]) => ev(t, 'scribble', { dur: d, pan }));
ev(0, 'paper');
// 翻身
[7.5, 9.17].forEach(t => ev(t, 'toss', { pan: 0.3 }));
// 数羊
const SHEEP_T = [0, 1, 2, 3, 4].map(i => 10.0 + BEAT * i);
SHEEP_T.forEach((t, i) => { ev(t + 0.75, 'hop', { i, pan: 0 }); ev(t + 0.2, 'baa', { i, pan: -0.4 + i * 0.1 }); ev(t + 0.6, 'number', { i }); });
ev(13.95, 'silence', { dur: 1.0 }); ev(14.3, 'cricket', { pan: -0.6 });
ev(18.33, 'wave');
// 爬梯
export const RUNG_T = [0, 1, 2, 3, 4, 5, 6, 7].map(i => 20.3 + 0.45 * i);
const STEP_T = [0, 1, 2, 3, 4].map(n => 20.3 + 0.45 * (n + 3));
RUNG_T.forEach((t, i) => ev(t, 'rung', { i }));
ev(19.75, 'hopout'); ev(24.0, 'climbover');
[24.6, 25.0, 25.4, 25.8].forEach(t => ev(t, 'step'));
ev(26.4, 'sit');
// 唱歌与刷子
BANDS.forEach(b => ev(b.t0, 'brush', { dur: b.t1 - b.t0, dir: b.dir }));
ev(27.6, 'dip');
// 星星显现：刷子前沿经过每颗星的时刻
STARS.forEach(s => { const b = BANDS.find(b => s.y >= b.y0 - 20 && s.y <= b.y1 + 20) || BANDS[2]; const u = b.dir > 0 ? (s.x + 260) / 3720 : (3460 - s.x) / 3720; const t = b.t0 + (b.t1 - b.t0) * clamp(u); if (s.big) ev(t, 'glint', { pan: (s.x - 1600) / 1600 }); });
ev(37.5, 'cap', { dur: 0.7 }); ev(38.3, 'yawn', { who: 'moon' }); ev(40.0, 'quilt', { dur: 1.6 }); ev(41.7, 'tuck'); ev(42.0, 'tuck');
ev(43.3, 'yawn', { who: 'girl' }); ev(44.1, 'liedown');
ev(46.0, 'room'); ev(47.6, 'page', { dur: 1.2 });
// 配乐 cue
[['A', 0], ['B', 7.5], ['C', 15], ['D', 20], ['E', 27.5], ['F', 37.5], ['G', 45]].forEach(([id, t]) => ev(t, 'cue', { id }));

// —— 层 ——
const STAR = group(), BG = { f: layer(), l: layer() }, MN = group(), SH = group(), GL = group(), WASH = layer(), FX = layer(), SUBK = layer(), SUBT = layer();
const wo = (x, y) => [x, y];

// 女孩的状态机：返回 girl() 参数
const SEAT = [1452, 1032];
function girlState(t) {
  const sheepIn = (P, o = {}) => (Pp) => sheep(GL, { x: Pp([o.at || [4, -128]])[0][0], y: Pp([o.at || [4, -128]])[0][1], s: o.s ?? 0.78, r: o.r ?? 0, flip: o.flip, seed: 3350, eyesClosed: o.closed });
  const S = 0.56;
  if (t < 19.75) {
    // 被窝里：17.8 抬头，18.33 起挥手，笑
    const waving = t > 18.2 && t < 19.6;
    const wv = Math.floor(t * 6) % 2;
    const arms = waving ? { R: wv ? [[34, -182], [80, -200], [94, -252]] : [[34, -182], [86, -206], [112, -246]] } : {};
    return { x: 1548, y: 1602, s: 0.44, view: 'front', pose: 'bed', expr: t > 18.2 ? 'smile' : 'awake', arms, bed: true, seed: 3000 };
  }
  if (t < 20.2) {  // 从窗口跳下来
    const u = pr(t, 19.75, 20.2); const x = lerp(1560, 1740, u), y = lerp(1560, 1640, u) - 90 * Math.sin(u * Math.PI);
    return { x, y, s: S, view: 'side', pose: 'stand', expr: 'awake', seed: 3000, sheep: sheepIn(null, { at: [-6, -130], flip: true }) };
  }
  if (t < 24.0) {  // 背面爬梯
    let n = -1; for (let i = 0; i < STEP_T.length; i++) if (t >= STEP_T[i]) n = i;
    const yOf = k => k < 0 ? 1640 : LAD.rung(k) + 4;
    const tn = n >= 0 ? STEP_T[n] : 20.2; const u = eo(pr(t, tn, tn + 0.22));
    const y = n >= 0 ? lerp(yOf(n - 1), yOf(n), u) : 1640;
    const reach = t < STEP_T[0] ? (t > 20.3 ? 1 : 0) : 0;
    return { x: 1792, y, s: S, view: 'back', pose: 'climb', ph: (n + 1) % 2, expr: 'awake', seed: 3000, sheep: sheepIn(null, { at: [4, -128], r: -0.2 }) };
  }
  if (t < 26.25) { // 上屋顶，往屋脊走（侧面朝左）
    const u = pr(t, 24.3, 26.2); const x = lerp(1850, SEAT[0] + 20, u), y = lerp(1306, SEAT[1] + 2, u) - Math.abs(Math.sin(u * Math.PI * 4)) * 10;
    const ph = Math.floor(t * 4) % 2;
    const legs = ph ? [[[4, -90], [14, -50], [18, -12]], [[-6, -90], [-14, -50], [-20, -12]]] : [[[4, -90], [-6, -50], [-10, -12]], [[-6, -90], [6, -50], [10, -12]]];
    return { x, y, s: S, view: 'side', pose: 'stand', flip: true, legs, r: 0.12, expr: 'awake', seed: 3000, sheep: sheepIn(null, { at: [-8, -130], flip: true }) };
  }
  // 坐在屋脊上
  let expr = 'awake';
  if (t > 27.5 && t < 36.0) { const inPh = [[27.6, 29.8], [30.0, 32.3], [32.5, 34.8], [35.0, 36.0]].some(([a, b]) => t > a && t < b); expr = inPh ? 'sing' : 'awake'; }
  else if (t >= 36.0 && t < 43.2) expr = t > 41.3 ? 'sleepy' : 'smile';
  else if (t >= 43.2 && t < 44.0) expr = 'yawn';
  if (t < 44.0) {
    const tilt = t > 27.3 ? -0.3 : -0.18;
    return { x: SEAT[0], y: SEAT[1], s: S, view: 'side', pose: 'sit', hug: true, headTilt: tilt + (expr === 'sing' ? -0.04 * Math.sin(t * 5) : 0), expr, seed: 3000, sheep: sheepIn(null, { at: [46, -58], s: 0.72 }) };
  }
  if (t < 44.3) return { x: SEAT[0], y: SEAT[1], s: S, view: 'side', pose: 'sit', hug: true, headTilt: -0.4, r: -0.55, expr: 'sleep', seed: 3000, sheep: sheepIn(null, { at: [46, -58], s: 0.72, r: -0.55, closed: true }) };
  const sl = Math.atan2(-40, 620);
  return { x: SEAT[0] - 40, y: SEAT[1] + 6, s: S, view: 'side', pose: 'lieback', flip: true, r: sl, expr: 'sleep', seed: 3000, breathe: true, sheep: sheepIn(null, { at: [-58, -112], s: 0.74, r: sl, flip: true, closed: true }) };
}

// 月亮的状态
function moonState(t) {
  const o = { x: MOON.x, y: MOON.y, s: MOON.R, seed: 700, expr: 'wide', look: [0, 0], r: 0 };
  o.lineDraw = pr(t, 0.9, 1.6); o.fillDraw = pr(t, 2.6, 3.6);
  if (t < 1.67) { o.face = false; return o; }
  if (t > 6.4 && t < 6.56) o.lid = 1;
  if (t >= 7.5 && t < 10) {
    if (t < 8.33) { o.expr = 'grumpy'; o.r = -0.35 + 0.04 * Math.sin(t * 20); }
    else if (t < 9.17) { o.expr = 'wide'; }
    else if (t < 9.9) { o.expr = 'grumpy'; o.r = 0.35 + 0.04 * Math.sin(t * 20); }
  }
  if (t >= 10 && t < 13.95) { o.expr = 'look'; const sx_ = sheepX(t); o.look = [clamp((sx_ - MOON.x) / 420, -1, 1), 0.35]; }
  if (t >= 13.95 && t < 15) { o.expr = 'wide'; o.eyeK = 1.15; }
  const toGirl = [-0.75, 0.66];
  if (t >= 15 && t < 27.5) { o.expr = t > 18.33 && t < 19.8 ? 'smile' : 'look'; o.look = toGirl; }
  if (t >= 27.5 && t < 37.5) { o.expr = 'look'; o.look = [lerp(-0.75, -0.3, pr(t, 27.5, 37)), lerp(0.66, 0.3, pr(t, 27.5, 37))]; o.lid = 0.5 * pr(t, 30, 37); }
  if (t >= 37.5) { o.cap = pr(t, 37.5, 38.2); o.expr = 'drowsy'; o.lid = 0.6; }
  if (t >= 38.3 && t < 39.2) { o.expr = 'yawn'; o.yawnK = 0.6 + 0.6 * Math.sin(pr(t, 38.3, 39.2) * Math.PI); }
  if (t >= 39.2) { o.expr = 'asleep'; o.lid = 0; }
  o.r += -1.0 * ss(pr(t, 38.6, 40.0));
  if (t >= 40.0) { o.blanket = ss(pr(t, 40.0, 41.6)); o.hand = t < 42.3 ? 1 : 0; o.tuck = t > 41.6 && t < 42.3 ? pr(t, 41.6, 42.3) * 2 : 0; }
  if (t > 39.2) o.s = MOON.R * (1 + 0.012 * Math.sin(t * 2.2));
  return o;
}
// 数羊：第 i 只的位置
function sheepPos(i, t) {
  const t0 = SHEEP_T[i], u = (t - t0) / 1.5; if (u < 0 || u > 1) return null;
  const q = Math.floor(u * 1.5 * 12) / (1.5 * 12);             // 12fps 步进
  const x = lerp(1640, 3260, q), y = 960 - 330 * Math.sin(q * Math.PI);
  return { x, y, r: i === 4 && q > 0.55 ? Math.sin((q - 0.55) * 30) * 0.25 : (q - 0.5) * 0.3 };
}
function sheepX(t) { let best = MOON.x; for (let i = 0; i < 5; i++) { const p = sheepPos(i, t); if (p && p.x > 1900 && p.x < 3000) best = p.x; } return best; }

// —— 渲染一帧 ——
export function frame(comp, t) {
  if (t >= 46.0) return endFrame(comp, t, { drawPage, subTo });
  drawPage(comp, t, camT(t), { vig: 0.3 * (1 - pr(t, 45, 46)) });
}
export function drawPage(comp, t, cam, { subs = true, vig = 0.3 } = {}) {
  [CAM.x, CAM.y, CAM.s] = cam;
  BOIL.amp = t > 44.4 ? 0.55 : 1;
  clearGroup(STAR); clearGroup(MN); clearGroup(SH); clearGroup(GL);
  [BG.f, BG.l, WASH, FX, SUBK, SUBT].forEach(clear);
  // 开场画出来的进度
  const p = { hl: pr(t, 0.3, 1.2), hf: pr(t, 3.0, 4.3), tl: pr(t, 1.7, 2.3), tf: pr(t, 4.0, 4.8), gl: pr(t, 1.8, 2.4), gf: pr(t, 3.6, 4.6), wf: pr(t, 3.6, 4.4) };
  drawWorld(BG.f, BG.l, p);
  if (p.hf >= 1) drawStars(STAR);
  // 片名（写在纸上）
  if (t > 2.6) {
    text(BG.l, 'The Moon', sx(110), sy(210), { size: 140 * CAM.s, font: 'Gaegu', weight: 700, reveal: pr(t, 2.6, 3.3), seed: 21, p: 0.95, stroke: 2, align: 'left' });
    text(BG.l, "Can't Sleep", sx(150), sy(345), { size: 140 * CAM.s, font: 'Gaegu', weight: 700, reveal: pr(t, 3.35, 4.2), seed: 29, p: 0.95, stroke: 2, align: 'left' });
  }
  // 数羊的数字
  SHEEP_T.forEach((t0, i) => { if (t > t0 + 0.6) text(BG.l, String(i + 1), sx(1860 + 78 * i), sy(390 + (i % 2) * 18), { size: 96 * CAM.s, font: 'Gaegu', weight: 700, seed: 40 + i, reveal: pr(t, t0 + 0.6, t0 + 0.8), p: 0.9 }); });
  // 梯子
  const rungs = RUNG_T.reduce((a, rt) => a + clamp((t - rt + 0.12) / 0.12), 0);
  drawLadder(BG.f, BG.l, rungs, pr(t, 20.15, 20.35) * (0.42 + 0.58 * clamp(rungs / 8)));
  // 月亮
  const mo = moonState(t);
  if (t > 0.9) moon(MN, mo);
  // 羊
  for (let i = 0; i < 5; i++) { const q = sheepPos(i, t); if (q) sheep(SH, { x: q.x, y: q.y, s: 1.8, r: q.r, seed: 900 + i * 17 }); }
  // 女孩
  if (t > 4.2) {
    const gs = girlState(t);
    girl(GL, gs);
    if (gs.bed) {   // 被子 + 被窝里的小羊
      sheep(GL, { x: 1618, y: 1558, s: 0.5, seed: 3350, r: -0.1 });
      part(GL, [[1446, 1560], [1520, 1548], [1600, 1556], [1676, 1546], [1676, 1590], [1446, 1600]], { col: K.sky, p: 0.8, gap: 8, w: 10, ang: 0.2, seed: 3990 }, { w: 7, seed: 3991 });
    } else if (t < 46) part(GL, [[1446, 1566], [1676, 1556], [1676, 1590], [1446, 1600]], { col: K.sky, p: 0.8, gap: 8, w: 10, ang: 0.2, seed: 3990 }, { w: 7, seed: 3991 });
  }
  // 唱歌的音符
  if (t > 27.6 && t < 40) for (let j = 0; j < 11; j++) {
    const t0 = 27.7 + BEAT * j; if (t0 > 36) break; const u = (t - t0) / 3.2; if (u < 0 || u > 1) continue;
    const bx = SEAT[0] + 44 + 150 * u + 26 * Math.sin(u * 6 + j), by = SEAT[1] - 116 - 330 * u;
    noteGlyph(FX, bx, by, j, 1 - pr(u, 0.6, 1), pr(u, 0, 0.12));
  }
  // 星星闪烁
  if (t > 34.6) for (let k = 0; k < 16; k++) {
    const s = STARS[(k * 37) % STARS.length]; if (!s.big) continue;
    const ph = (t * 0.7 + hash(k) * 3) % 3; if (ph > 0.5) continue;
    const a = Math.sin(ph / 0.5 * Math.PI), r = s.r * (1.6 + 1.2 * a);
    line(FX, [[s.x - r, s.y], [s.x + r, s.y]], { w: 3.5, col: K.white, p: a, seed: 800 + k, wob: 0.2 });
    line(FX, [[s.x, s.y - r], [s.x, s.y + r]], { w: 3.5, col: K.white, p: a, seed: 820 + k, wob: 0.2 });
  }
  // 睡着的 z
  if (t > 44.7) for (let j = 0; j < 4; j++) { const t0 = 44.7 + j * 1.1; const u = (t - t0) / 2.4; if (u < 0 || u > 1) continue; text(FX, 'z', sx(SEAT[0] + 40 + 60 * u), sy(SEAT[1] - 70 - 140 * u), { size: (40 + 30 * u) * CAM.s, font: 'Gaegu', weight: 700, p: 1 - pr(u, 0.6, 1), seed: 60 + j }); }
  // 海报：白蜡笔写的片名（?poster=1）
  if (POSTER) { text(FX, 'The Moon', 150, 170, { size: 120, font: 'Gaegu', weight: 700, col: K.yellow, p: 1, stroke: 3, align: 'left', seed: 5 }); text(FX, "Can't Sleep", 190, 290, { size: 120, font: 'Gaegu', weight: 700, col: K.yellow, p: 1, stroke: 3, align: 'left', seed: 6 }); text(FX, 'a crayon picture book', 200, 360, { size: 46, col: K.white, p: 1, align: 'left', seed: 7 }); }
  // 水彩
  if (t > BANDS[0].t0) drawWash(WASH, t);
  // 字幕
  if (subs) subTo(SUBK, SUBT, t);
  // 合成（纸纹锚定在这一页上，跟着镜头走）
  comp.paperCam(CAM.x * 0.6, CAM.y * 0.6, CAM.s / 0.6);
  comp.begin();
  comp.group(STAR, { goff: [0, 0] });
  comp.crayon(BG.f.c); comp.crayon(BG.l.c);
  const go = [hash(BOIL.step) * 300, hash(BOIL.step + 7) * 300];
  comp.group(MN, { goff: go }); comp.group(SH, { goff: go });
  if (t > BANDS[0].t0) comp.wash(WASH.c, { color: PAL.wash });
  comp.group(GL, { goff: go });       // 女孩画在水彩之后：夜里也读得清她的脸
  comp.crayon(FX.c, { goff: go });
  comp.knock(SUBK.c); comp.crayon(SUBT.c);
  comp.finish({ vig });
}
function noteGlyph(L, x, y, j, p, draw) {
  const s = 1.0, c = K.ink;
  if (j % 3 === 2) {   // 双音符
    line(L, [[x, y], [x, y - 44 * s]], { w: 6, col: c, seed: 1000 + j, p, draw });
    line(L, [[x + 30, y - 6], [x + 30, y - 50 * s]], { w: 6, col: c, seed: 1001 + j, p, draw });
    line(L, [[x, y - 44 * s], [x + 30, y - 50 * s]], { w: 9, col: c, seed: 1002 + j, p, draw });
    fill(L, handCircle(x - 9, y, 10, j, 0, 16), { col: c, p: 0.95 * p, gap: 3.5, w: 5, seed: 1003 + j, over: 1 });
    fill(L, handCircle(x + 21, y - 6, 10, j + 1, 0, 16), { col: c, p: 0.95 * p, gap: 3.5, w: 5, seed: 1004 + j, over: 1 });
  } else {
    line(L, [[x, y], [x, y - 44 * s]], { w: 6, col: c, seed: 1000 + j, p, draw });
    line(L, [[x, y - 44 * s], [x + 18, y - 34 * s], [x + 20, y - 22 * s]], { w: 6, col: c, seed: 1001 + j, p, draw });
    fill(L, handCircle(x - 9, y, 10, j, 0, 16), { col: c, p: 0.95 * p, gap: 3.5, w: 5, seed: 1003 + j, over: 1 });
  }
}
export function subTo(SUBK, SUBT, t) {
  const S = SUBS.find(s => t >= s.t0 && t < s.t1); if (!S) return;
  const rv = pr(t, S.t0, S.t0 + 0.35);
  const g = SUBK.g; g.save(); g.font = '400 54px "Patrick Hand"'; const tw = g.measureText(S.text).width; g.restore();
  // 给字留出的一块纸（不规则边）
  const cx = 960, cy = 1002, hw = tw / 2 + 46, hh = 44;
  g.save(); g.fillStyle = '#000'; g.beginPath();
  for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; const px = Math.cos(a), py = Math.sin(a); const sq = Math.pow(Math.abs(px), 0.3) * Math.sign(px); const n = 1 + 0.06 * Math.sin(a * 7 + 1.3) + 0.03 * Math.sin(a * 17); const X = cx + sq * hw * n, Y = cy + py * hh * n; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
  g.closePath(); g.fill(); g.restore();
  text(SUBT, S.text, cx, cy + 18, { size: 54, col: K.ink, reveal: rv, seed: 11 + S.t0 * 3, p: 1, stroke: 1.2 });
}
