// bg.js — 灰阶"水彩"背景（只画一次，缓存成大图；背景不 boil，线条更细更灰，比角色低一档对比）
// 对比度原则（关卡 1 反馈）：墙面用中灰退后，角色的白和墨黑要比背景任何一处都更亮/更黑
import * as T from './toon.js';
import { P } from './chars.js';
import { mulberry } from '/core/lib.js';
const { shape, stroke, ell, arc, rr, rect, spline, quad } = T;

// 水彩平涂：底色 + 软斑驳 + 边缘积色 + 细灰线
export function wash(pts, col, o = {}) {
  const g = T.g, Pth = shape(pts, { fill: col, stroke: false, boil: 0 });
  const rnd = mulberry(o.seed ?? 7);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clip(Pth);
  const bb = pts.map(p => T.tx(p[0], p[1])), xs = bb.map(p => p[0]), ys = bb.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const n = Math.min(110, Math.max(8, ((x1 - x0) * (y1 - y0)) / 9000 | 0));
  g.filter = 'blur(10px)';
  for (let i = 0; i < n; i++) { const r = 20 + rnd() * 90; g.fillStyle = rnd() > .5 ? `rgba(30,28,25,${.03 + rnd() * .05})` : `rgba(255,253,245,${.03 + rnd() * .05})`; g.beginPath(); g.ellipse(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), r, r * (.5 + rnd() * .6), rnd() * 3, 0, 7); g.fill(); }
  if ((o.edge ?? .16) > 0) { g.filter = 'blur(7px)'; g.strokeStyle = `rgba(20,18,16,${o.edge ?? .16})`; g.lineWidth = 26; g.stroke(Pth); }
  g.filter = 'none'; g.restore();
  if (o.line !== false) T.outline(Pth, o.lw ?? 3.2, o.lineCol ?? '#2A2927');
  return Pth;
}
function paperGrain(g, w, h, seed = 3) {
  const rnd = mulberry(seed); g.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < w * h / 900; i++) { g.fillStyle = rnd() > .5 ? 'rgba(20,18,15,.06)' : 'rgba(255,255,250,.05)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
}
function withCanvas(bg, fn) {
  const prev = T.g, oldB = T.BASE.slice(), oldL = T.S.lwScale, { PS, ox, oy } = bg;
  T.init(bg.cv); T.BASE.splice(0, 6, PS, 0, 0, PS, -ox * PS, -oy * PS); T.S.lwScale = PS; T.frame(0, { amp: 0 });
  const raw = () => T.g.setTransform(PS, 0, 0, PS, -ox * PS, -oy * PS);
  fn(T.g, raw); T.g.setTransform(1, 0, 0, 1, 0, 0);
  paperGrain(T.g, bg.cv.width, bg.cv.height, ox + 3);
  T.BASE.splice(0, 6, ...oldB); T.S.lwScale = oldL; T.init(prev.canvas);
}
function makeBG(x0, y0, x1, y1, PS) { const cv = document.createElement('canvas'); cv.width = Math.round((x1 - x0) * PS); cv.height = Math.round((y1 - y0) * PS); return { cv, ox: x0, oy: y0, PS, w: x1 - x0, h: y1 - y0 }; }
// 把背景按镜头画到场景画布：cam = {x,y,z} 世界点映射到画面中心；squash = 整面背景随拍呼吸（绕 pivotY）
export function drawBG(sg, bg, cam, squash = 0, pivotY = 1220) {
  const z = cam.z, ox = 960 - cam.x * z, oy = 540 - cam.y * z;
  sg.save(); sg.setTransform(z, 0, 0, z, ox, oy);
  if (squash) { sg.translate(0, pivotY); sg.scale(1 - squash * .4, 1 + squash); sg.translate(0, -pivotY); }
  sg.drawImage(bg.cv, bg.ox, bg.oy, bg.w, bg.h); sg.restore();
}
export const camBase = cam => [cam.z, 0, 0, cam.z, 960 - cam.x * cam.z, 540 - cam.y * cam.z];

// —— 厨房台面（宽 2800、从天花板到地板）——
export const COUNTER_Y = 706, FLOOR_Y = 1220, SINK_X = 2660;
export function paintKitchen() {
  const bg = makeBG(0, -420, 2800, 1500, 1.25), W = 2800;
  withCanvas(bg, (g, raw) => {
    // 天花板线脚
    wash(rect(-10, -430, W + 20, 80), '#3E3D3A', { seed: 21, edge: 0 });
    wash(rect(-10, -352, W + 20, 16), '#5A5853', { seed: 22 });
    // 墙纸：中灰底 + 淡竖条 + 小菱形花（退后）
    wash(rect(-10, -336, W + 20, 840), '#8C8981', { line: false, seed: 1, edge: 0 });
    raw();
    for (let x = 0; x < W; x += 64) { g.fillStyle = 'rgba(255,253,245,.07)'; g.fillRect(x, -336, 22, 836); }
    for (let x = 32; x < W; x += 128) for (let y = -300; y < 500; y += 96) { g.fillStyle = 'rgba(30,28,24,.2)'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 6, y); g.lineTo(x, y + 8); g.lineTo(x - 6, y); g.fill(); }
    // 吊灯（中间）
    raw(); g.strokeStyle = '#2A2927'; g.lineWidth = 3; g.beginPath(); g.moveTo(1400, -336); g.lineTo(1400, -210); g.stroke();
    wash(arc(1400, -150, 70, 60, Math.PI, Math.PI * 2, 18), '#5E5C57', { seed: 23 });
    // 墙上挂画（空画框里画一只茶壶的剪影）
    wash(rr(1640, 40, 170, 210, 8), '#5E5C57', { seed: 24 }); wash(rr(1660, 60, 130, 170, 4), '#A9A69E', { seed: 25, edge: .1 });
    wash(spline([[1695, 190], [1690, 150], [1725, 128], [1760, 150], [1756, 190]], true, 5), '#6E6B64', { seed: 26, edge: 0 });
    // 挡水墙瓷砖
    wash(rect(-10, 500, W + 20, 206), '#A29F97', { line: false, seed: 2, edge: .08 });
    raw(); g.strokeStyle = 'rgba(40,38,34,.4)'; g.lineWidth = 2;
    for (let y = 500; y < 706; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += 52) { g.beginPath(); g.moveTo(x, 500); g.lineTo(x, 706); g.stroke(); }
    wash(rect(-10, 492, W + 20, 14), '#4A4844', { lw: 3, seed: 4 });
    // 搁板 + 罐子
    for (const sx of [1020, 2240]) {
      wash(rect(sx, 286, 420, 22), '#4A4844', { seed: sx });
      for (const [dx, h, wd] of [[40, 90, 70], [140, 120, 80], [250, 76, 64], [340, 104, 60]]) {
        wash(rr(sx + dx, 286 - h, wd, h, 14), dx === 140 ? '#8E8B83' : '#B3B0A8', { seed: dx + sx, edge: .1 });
        wash(rr(sx + dx - 4, 286 - h - 14, wd + 8, 18, 6), '#4A4844', { seed: dx * 3, edge: .1 });
      }
    }
    // 台面：顶面 + 前沿
    wash(rect(-10, COUNTER_Y - 16, W + 20, 34), '#C4C1B8', { seed: 11, edge: .05 });
    wash(rect(-10, COUNTER_Y + 16, W + 20, 30), '#3F3E3A', { seed: 12 });
    // 水槽（右端，嵌在台面里，只露出前沿的一道凹）
    wash(rr(SINK_X - 130, COUNTER_Y - 12, 260, 22, 8), '#5E5C57', { seed: 14 });
    // 橱柜
    wash(rect(-10, COUNTER_Y + 46, W + 20, FLOOR_Y - COUNTER_Y - 46), '#66635D', { seed: 13, line: false });
    for (let x = 30; x < W; x += 300) {
      wash(rr(x, COUNTER_Y + 70, 270, 360, 10), '#726F68', { seed: x, edge: .14 });
      wash(rr(x + 22, COUNTER_Y + 92, 226, 316, 8), '#7C7972', { seed: x + 1, edge: .1 });
      wash(ell(x + (x / 300 % 2 ? 36 : 234), COUNTER_Y + 130, 11, 11), '#2A2927', { seed: x + 2, edge: 0 });
    }
    wash(rect(-10, FLOOR_Y - 34, W + 20, 34), '#2E2D2A', { seed: 15 });
    // 地板：黑白棋盘格（透视压扁）
    wash(rect(-10, FLOOR_Y, W + 20, 290), '#8A877F', { seed: 16, line: false, edge: 0 });
    raw();
    const rows = [[FLOOR_Y, 40], [FLOOR_Y + 40, 56], [FLOOR_Y + 96, 76], [FLOOR_Y + 172, 104]];
    rows.forEach(([y, h], r) => { const tw = 90 + r * 18; for (let i = -2; i * tw < W + 200; i++) if ((i + r) % 2 === 0) { g.fillStyle = '#34332F'; const x = i * tw - (r * 40); g.beginPath(); g.moveTo(x, y); g.lineTo(x + tw * .92, y); g.lineTo(x + tw * .92 + (x + tw * .92 - 1400) * h / 900, y + h); g.lineTo(x + (x - 1400) * h / 900, y + h); g.fill(); } });
  });
  return bg;
}

// —— 橱柜（上）+ 水槽（下，稍俯视）：一张竖长图，下摇镜头 ——
export const PLATES = Array.from({ length: 7 }, (_, i) => [330 + i * 105, 1030 - i * 115]);
export const LADLE = { hook: [1060, 250], bowl: [1300, 760] };
export const BASIN = { x: 760, y: 1840, rx: 440, ry: 300 };
export function paintCupboard() {
  const bg = makeBG(0, -200, 1440, 2400, 1.25), W = 1440;
  withCanvas(bg, (g, raw) => {
    // 墙
    wash(rect(-10, -210, W + 20, 1700), '#8C8981', { line: false, seed: 31, edge: 0 });
    raw(); for (let x = 0; x < W; x += 64) { g.fillStyle = 'rgba(255,253,245,.07)'; g.fillRect(x, -200, 22, 1560); }
    // 柜体外框
    wash(rr(90, -160, 1260, 1330, 16), '#4A4844', { seed: 32 });
    // 内壁（深，好让白盘子跳出来）
    wash(rr(140, -110, 1160, 1220, 10), '#55534E', { seed: 33, edge: .25 });
    raw(); for (let y = -110; y < 1110; y += 60) { g.strokeStyle = 'rgba(20,18,16,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(140, y); g.lineTo(1300, y + 4); g.stroke(); }
    // 隔板
    for (const y of [380, 1100]) wash(rect(140, y, 1160, 24), '#8E8B83', { seed: y });
    // 盘子托架（每只盘子下一个小木托）
    for (const [x, y] of PLATES) wash(rr(x - 22, y + 4, 44, 16, 4), '#3F3E3A', { seed: x });
    // 挂勺的钩子
    wash(ell(LADLE.hook[0], LADLE.hook[1] - 4, 9, 9), '#2A2927', { seed: 34, edge: 0 });
    // 两扇打开的柜门（斜的平行四边形）
    wash([[90, -150], [10, -110], [10, 1130], [90, 1170]], '#6E6B64', { seed: 35 });
    wash([[1350, -150], [1430, -110], [1430, 1130], [1350, 1170]], '#6E6B64', { seed: 36 });
    // 下方瓷砖墙
    wash(rect(-10, 1180, W + 20, 330), '#A29F97', { line: false, seed: 37, edge: .06 });
    raw(); g.strokeStyle = 'rgba(40,38,34,.4)'; g.lineWidth = 2;
    for (let y = 1180; y < 1500; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x < W; x += 52) { g.beginPath(); g.moveTo(x, 1180); g.lineTo(x, 1500); g.stroke(); }
    // 台面（俯视，大面积浅色）
    wash(rect(-10, 1500, W + 20, 910), '#C4C1B8', { seed: 38, edge: .06 });
    raw(); for (let y = 1530; y < 2400; y += 70) { g.strokeStyle = 'rgba(40,38,34,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // 水槽盆：外沿 + 内壁
    const { x, y, rx, ry } = BASIN;
    wash(ell(x, y, rx + 34, ry + 30, 60), '#8E8B83', { seed: 39 });
    wash(ell(x, y + 10, rx, ry, 60), '#4A4844', { seed: 40, edge: .3 });
  });
  return bg;
}
