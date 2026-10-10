// 人物剪影：关键点 + Catmull-Rom 平滑轮廓（点带第三个值 1 = 尖角）。面朝右，身高 H=1 时的坐标，s = 实际身高（米）
import { TAU } from './lib.js';
import { limb } from './art.js';

// 过点平滑闭合曲线（中心 Catmull-Rom → 三次贝塞尔）；尖角点的切线为 0
export function spline(x, s, pts, closed = true, k = 1 / 6) {
  const n = pts.length, P = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  x.beginPath(); x.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    x.bezierCurveTo(c1[0] * s, c1[1] * s, c2[0] * s, c2[1] * s, p2[0] * s, p2[1] * s);
  }
  if (closed) x.closePath();
}
const fill = (x, s, pts) => { spline(x, s, pts); x.fill(); };
const shift = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy, p[2]]);

// —— 小满（年轻女性，低马尾）——
const GIRL_HEAD = [[0, 1], [.04, .99], [.062, .965], [.066, .945], [.08, .922, 1], [.067, .912], [.07, .9], [.064, .893], [.066, .885], [.058, .872], [.035, .862], [.03, .845]];
const GIRL_BACKHEAD = [[-.055, .845], [-.058, .862], [-.075, .85], [-.1, .8], [-.105, .74, 1], [-.085, .8], [-.07, .87], [-.072, .925], [-.055, .975], [-.03, .995]];
const GIRL_TORSO_F = [[.035, .82], [.058, .8], [.078, .752], [.074, .712], [.055, .668], [.046, .612], [.054, .552], [.06, .5]];
const GIRL_TORSO_B = [[-.075, .5], [-.062, .58], [-.046, .64], [-.056, .72], [-.058, .79]];
export function girlStand(x, s) {
  fill(x, s, [...GIRL_HEAD, ...GIRL_TORSO_F, [.056, .42], [.05, .3], [.046, .18], [.04, .06], [.1, .022], [.106, 0, 1], [-.035, 0, 1], [-.042, .04], [-.03, .1], [-.046, .2], [-.036, .3], [-.05, .42], ...GIRL_TORSO_B, ...GIRL_BACKHEAD]);
}
export function girlSit(x, s) {   // 原点 = 坐点
  fill(x, s, [...shift([...GIRL_HEAD, ...GIRL_TORSO_F], 0, -.5), [.15, .03], [.25, .032], [.275, .005], [.265, -.12], [.258, -.22], [.322, -.248], [.326, -.262, 1], [.212, -.262, 1], [.21, -.22], [.21, -.1], [.215, -.03], [.1, -.036], [-.05, -.03],
    ...shift([...GIRL_TORSO_B, ...GIRL_BACKHEAD], 0, -.5)]);
}
export const GIRL_SHOULDER = [.0, .775];

// —— 外婆（驼背、发髻、开衫、阔腿裤）——
const GRAN_HEAD = [[.0, .955], [.05, .953], [.083, .926], [.094, .9, 1], [.08, .889], [.084, .877], [.075, .862], [.05, .85], [.045, .83]];
const GRAN_TORSO_F = [[.06, .8], [.085, .74], [.092, .66], [.086, .56], [.093, .5, 1], [.07, .49]];
const GRAN_TORSO_B = [[-.066, .48], [-.088, .5, 1], [-.094, .6], [-.098, .7], [-.075, .81], [-.035, .855]];
const GRAN_BACKHEAD = [[-.03, .88], [-.035, .92], [-.015, .952]];
export function grannyStand(x, s, o = {}) {
  fill(x, s, [...GRAN_HEAD, ...GRAN_TORSO_F, [.074, .35], [.07, .06], [.12, .03], [.126, 0, 1], [-.042, 0, 1], [-.047, .05], [-.052, .3], ...GRAN_TORSO_B, ...GRAN_BACKHEAD]);
  bun(x, s, 0, o);
}
export function grannySit(x, s, o = {}) {   // 原点 = 坐点
  fill(x, s, [...shift([...GRAN_HEAD, ...GRAN_TORSO_F], 0, -.48), [.16, .04], [.26, .04], [.285, .01], [.275, -.12], [.27, -.22], [.33, -.25], [.335, -.262, 1], [.215, -.262, 1], [.213, -.22], [.215, -.03], [.1, -.04], [-.07, -.03],
    ...shift([...GRAN_TORSO_B, ...GRAN_BACKHEAD], 0, -.48)]);
  bun(x, s, -.48, o);
}
function bun(x, s, dy, o) {
  x.beginPath(); x.ellipse(-.035 * s, (.925 + dy) * s, .034 * s, .03 * s, -.4, 0, TAU); x.fill();
  if (o.pin) { x.save(); x.fillStyle = o.pin; x.translate(-.035 * s, (.93 + dy) * s); x.rotate(-.35); x.fillRect(-.05 * s, -.003 * s, .085 * s, .006 * s); x.beginPath(); x.arc(-.05 * s, 0, .008 * s, 0, TAU); x.fill(); x.restore(); }
}
export const GRAN_SHOULDER = [.0, .77];

// —— 手臂：肩在 (0,0)；a 上臂角，b 前臂相对角；返回手心位置 ——
export function arm(x, s, a, b, o = {}) {
  const L1 = (o.L1 ?? .175) * s, L2 = (o.L2 ?? .155) * s, w = (o.w ?? .046) * s, sl = o.sleeve ?? 1;
  const ex = Math.cos(a) * L1, ey = Math.sin(a) * L1, hx = ex + Math.cos(a + b) * L2, hy = ey + Math.sin(a + b) * L2;
  limb(x, 0, 0, ex, ey, w * 1.25 * sl, w * .95 * sl, 0);
  limb(x, ex, ey, hx, hy, w * .92 * sl, w * .62 * (o.cuff ?? 1), 0);
  x.beginPath(); x.arc(ex, ey, w * .47 * sl, 0, TAU); x.fill();
  x.beginPath(); x.arc(0, 0, w * .62 * sl, 0, TAU); x.fill();
  const ha = a + b + (o.wrist || 0), hl = w * 1.35;   // 手：连指手套形
  x.save(); x.translate(hx, hy); x.rotate(ha);
  x.beginPath(); x.moveTo(0, w * .3); x.quadraticCurveTo(hl * .7, w * .42, hl, w * .08); x.quadraticCurveTo(hl * 1.02, -w * .2, hl * .7, -w * .3); x.lineTo(hl * .35, -w * .52); x.quadraticCurveTo(hl * .2, -w * .45, hl * .25, -w * .28); x.lineTo(0, -w * .3); x.closePath(); x.fill();
  x.restore();
  return [hx + Math.cos(ha) * hl * .6, hy + Math.sin(ha) * hl * .6];
}

// —— 小孩（双丸子头）——
export function childStand(x, s) {
  fill(x, s, [[0, .98], [.07, .96], [.1, .9], [.115, .86, 1], [.1, .845], [.09, .8], [.05, .77], [.05, .74], [.09, .7], [.1, .58], [.13, .4, 1], [.05, .4], [.05, .02], [.09, .0, 1], [.0, 0, 1], [.0, .38], [-.03, .38], [-.03, 0, 1], [-.1, 0, 1], [-.08, .02], [-.08, .4], [-.13, .4, 1], [-.1, .58], [-.08, .7], [-.04, .75], [-.08, .8], [-.1, .9], [-.07, .96]]);
  x.beginPath(); x.arc(-.07 * s, .96 * s, .045 * s, 0, TAU); x.arc(.06 * s, .985 * s, .042 * s, 0, TAU); x.fill();
}

// —— 苏轼（东坡巾、宽袍、长须）——
export function sushi(x, s) {
  fill(x, s, [[-.02, 1.1, 1], [.07, 1.1, 1], [.065, .99], [.07, .975], [.078, .955], [.086, .935, 1], [.074, .928], [.076, .915], [.07, .9], [.075, .87], [.06, .8], [.04, .76], [.03, .8], [.036, .86],
    [.05, .82], [.095, .76], [.11, .6], [.13, .3], [.19, .02], [.2, 0, 1], [-.2, 0, 1], [-.17, .1], [-.13, .4], [-.1, .65], [-.09, .78], [-.05, .86], [-.055, .92], [-.045, .97], [-.035, 1.0]]);
  // 帽后垂带
  x.beginPath(); x.moveTo(-.03 * s, 1.05 * s); x.quadraticCurveTo(-.09 * s, 1.0 * s, -.11 * s, .9 * s); x.lineTo(-.095 * s, .9 * s); x.quadraticCurveTo(-.075 * s, .99 * s, -.03 * s, 1.02 * s); x.fill();
}
export const SUSHI_SHOULDER = [.02, .8];

// —— 嫦娥（飞天，原点=腰；长裙向后飘）——
export function change(x, s, ph = 0) {
  const w = k => .02 * Math.sin(ph + k);
  fill(x, s, [[.0, .34], [.03, .345], [.05, .33], [.058, .315, 1], [.05, .31], [.052, .3], [.045, .29], [.03, .285], [.03, .26], [.05, .24], [.06, .18], [.05, .1], [.035, .03],
    [-.05, -.06], [-.18, -.12 + w(1)], [-.34, -.15 + w(2)], [-.5, -.13 + w(3)], [-.62, -.07 + w(4), 1], [-.5, -.1 + w(3)], [-.36, -.1 + w(2)], [-.2, -.06 + w(1)], [-.08, .0], [-.04, .1], [-.045, .2], [-.03, .26], [-.035, .3]]);
  x.beginPath(); x.arc(-.01 * s, .37 * s, .028 * s, 0, TAU); x.arc(.028 * s, .375 * s, .024 * s, 0, TAU); x.fill();   // 双髻
}
// 飘带：沿路径的变宽带（pts 为米制绝对坐标）
export function ribbon(x, pts, w0, w1) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], r = pts[Math.max(0, i - 1)];
    const dx = q[0] - r[0], dy = q[1] - r[1], d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
    L.push([p[0] - dy / d * w, p[1] + dx / d * w]); R.push([p[0] + dy / d * w, p[1] - dx / d * w]);
  }
  x.beginPath(); L.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); R.reverse().forEach(p => x.lineTo(...p)); x.closePath(); x.fill();
}
// 玉兔（蹲坐，面朝右）
export function rabbit(x, s) {
  fill(x, s, [[.3, .66], [.36, .6], [.42, .5, 1], [.36, .44], [.3, .38], [.3, .3], [.26, .12], [.3, .04], [.34, 0, 1], [-.18, 0, 1], [-.28, .08], [-.34, .12], [-.3, .2], [-.26, .3], [-.12, .44], [.1, .5], [.16, .6]]);
  x.beginPath(); x.ellipse(.2 * s, .82 * s, .05 * s, .2 * s, -.35, 0, TAU); x.fill();
  x.beginPath(); x.ellipse(.28 * s, .8 * s, .045 * s, .18 * s, .05, 0, TAU); x.fill();
}
