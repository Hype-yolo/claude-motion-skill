// cast.js — 会动的厨房群演（都随节拍呼吸：b = −1..1 呼吸相位，正 = 拉长）
// 局部坐标：原点 = 底部中心（挂着的东西 = 挂钩处）
import * as T from './toon.js';
import { P, pieEye, mouth, ribbon, glove, shoe, hose } from './chars.js';
import { lerp, TAU } from '/core/lib.js';
const { shape, stroke, ell, arc, spline, quad, rr, rect, push, pop, translate, rotate, scale, S } = T;
const D2R = Math.PI / 180;
const breathe = (b, a = .06) => { scale(1 - b * a * .6, 1 + b * a); };

// 闹钟：钟面就是脸，两只铃铛是帽子；ring = 0..1 响铃抖动
export function clock(x, y, k = 1, b = 0, o = {}) {
  push(); translate(x, y); scale(k); const ring = o.ring || 0, jit = ring ? Math.sin((o.t || 0) * 120) * 5 * ring : 0;
  translate(jit, -Math.abs(Math.sin((o.t || 0) * 30)) * 16 * ring); rotate(jit * .01); breathe(b);
  // 小脚
  shoe(-40, 0, -1, .6); shoe(40, 0, 1, .6);
  hose([-26, -24], [-40, -8], 3, 9); hose([26, -24], [40, -8], -3, 9);
  // 铃铛 + 锤
  for (const s of [-1, 1]) { push(); translate(s * 52, -146); rotate(s * (.5 + (ring ? Math.sin((o.t || 0) * 90 + s) * .15 : 0))); shape(arc(0, 10, 34, 34, Math.PI, TAU, 18), { fill: P.dmid }); shape(ell(0, -26, 6, 6), { fill: P.dark }); pop(); }
  stroke([[0, -150], [0, -176]], S.lw * 1.4); shape(ell(0, -180, 8, 8), { fill: P.dark });
  // 机身 + 表盘
  shape(ell(0, -86, 72, 72, 48), { fill: P.dmid });
  shape(ell(0, -86, 58, 58, 44), {
    fill: P.white, shade: () => { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; stroke([[Math.cos(a) * 49, -86 + Math.sin(a) * 49], [Math.cos(a) * 55, -86 + Math.sin(a) * 55]], S.lw * (i % 3 ? .5 : .9), { boil: .3 }); } }
  });
  pieEye(-17, -104, 12, 17, { lx: o.lx || 0, ly: o.ly || 0, type: o.eyes, lwk: .7 }); pieEye(17, -104, 12, 17, { lx: o.lx || 0, ly: o.ly || 0, type: o.eyes, lwk: .7 });
  // 指针 7:00（时针指 7，分针指 12）当"胡子/鼻子"
  const hA = (7 / 12) * TAU - Math.PI / 2;
  stroke([[0, -80], [Math.cos(hA) * 30, -80 + Math.sin(hA) * 30]], S.lw * 1.1); stroke([[0, -80], [0, -80 - 44]], S.lw * .7);
  shape(ell(0, -80, 5, 5), { fill: P.ink });
  mouth(6, -58, 26, o.mouth || 'smile', { open: .7 });
  pop();
}

// 烤面包机：镀铬（硬边高光色带）、两道槽、侧拉杆、格栅嘴
export function toaster(x, y, k = 1, b = 0, o = {}) {
  push(); translate(x, y); scale(k); breathe(b, .05);
  shape(rr(-70, -10, 30, 12, 5), { fill: P.ink }); shape(rr(40, -10, 30, 12, 5), { fill: P.ink });
  const lever = o.lever ?? 0;
  const body = rr(-78, -118, 156, 112, 34);
  shape(body, {
    fill: P.light, shade: () => {
      const f = (x0, w, c) => shape(rect(x0, -130, w, 140), { fill: c, stroke: false, boil: 0 });
      f(-60, 14, P.white); f(-40, 6, P.white); f(34, 22, P.mid); f(58, 30, P.dmid);
    }
  });
  // 槽
  shape(rr(-54, -126, 44, 12, 6), { fill: P.ink }); shape(rr(10, -126, 44, 12, 6), { fill: P.ink });
  // 拉杆
  shape(rr(76, -92 + lever * 50, 22, 12, 4), { fill: P.dark }); stroke([[78, -96], [78, -30]], S.lw * .7);
  // 脸
  pieEye(-24, -72, 14, 20, { lx: o.lx || 0, ly: o.ly || 0, type: o.eyes, lwk: .7, lidCol: P.light, lid: o.lid || 0 }); pieEye(10, -72, 14, 20, { lx: o.lx || 0, ly: o.ly || 0, type: o.eyes, lwk: .7, lidCol: P.light, lid: o.lid || 0 });
  // 格栅嘴
  shape(rr(-36, -44, 58, 22, 10), { fill: P.ink, shade: () => { for (const dx of [-22, -8, 6]) shape(rect(dx, -42, 6, 18), { fill: P.dmid, stroke: false, boil: 0 }); } });
  if (o.toast) { const ty = o.toast; shape(rr(-50, -126 - ty, 36, 40, 10), { fill: P.pale }); }
  pop();
}

// 水龙头：立柱上是眼睛，弯管是长鼻子，鼻尖滴水
export function faucet(x, y, k = 1, b = 0, o = {}) {
  push(); translate(x, y); scale(k); breathe(b, .05);
  shape(rr(-34, -18, 68, 20, 8), { fill: P.mid });
  // 两个十字阀门
  for (const s of [-1, 1]) { push(); translate(s * 52, -78); rotate((o.spin || 0) * s); shape(rr(-6, -20, 12, 40, 5), { fill: P.light }); shape(rr(-20, -6, 40, 12, 5), { fill: P.light }); shape(ell(0, 0, 7, 7), { fill: P.dmid }); pop(); stroke([[s * 26, -74], [s * 44, -76]], S.lw * 1.6); }
  // 立柱
  shape(rr(-28, -150, 56, 136, 22), { fill: P.light, shade: () => { shape(rect(-18, -160, 10, 160), { fill: P.white, stroke: false, boil: 0 }); shape(rect(12, -160, 16, 160), { fill: P.mid, stroke: false, boil: 0 }); } });
  pieEye(-11, -118, 10, 14, { lx: o.lx || 0, ly: o.ly ?? .4, type: o.eyes, lwk: .7 }); pieEye(11, -118, 10, 14, { lx: o.lx || 0, ly: o.ly ?? .4, type: o.eyes, lwk: .7 });
  // 鹅颈鼻子
  const neck = spline([[0, -150], [10, -196], [60, -214], [104, -196], [118, -156]], false, 8);
  const g = T.g, P2 = shape(neck, { closed: false, stroke: false }); const zk = T.zoom();
  g.setTransform(1, 0, 0, 1, 0, 0); g.lineCap = 'round'; g.strokeStyle = P.ink; g.lineWidth = 26 * zk + S.lw * 2; g.stroke(P2); g.strokeStyle = P.light; g.lineWidth = 26 * zk; g.stroke(P2); g.strokeStyle = P.white; g.lineWidth = 6 * zk; g.stroke(P2);
  shape(rr(106, -160, 24, 16, 6), { fill: P.mid });
  mouth(0, -92, 22, o.mouth || 'smile');
  if (o.drip != null) { const dy = o.drip; shape(spline([[118, -140 + dy - 10], [124, -140 + dy + 2], [118, -140 + dy + 8], [112, -140 + dy + 2]], true, 5), { fill: P.white, lw: S.lw * .6 }); }
  pop();
}

// 盐瓶 / 胡椒瓶（一对跳舞搭档）
export function shaker(x, y, k = 1, b = 0, o = {}) {
  const dark = o.pepper, body = dark ? P.dmid : P.white;
  push(); translate(x, y); scale(k); rotate(o.lean || 0); breathe(b, .07);
  const L = o.legL || { x: -12, y: 0 }, R = o.legR || { x: 12, y: 0 };
  hose([-9, -18], [L.x, L.y - 4], 2, 7); hose([9, -18], [R.x, R.y - 4], -2, 7); shoe(L.x - 3, L.y, -1, .45); shoe(R.x + 3, R.y, 1, .45);
  shape(spline([[-22, -18], [-26, -60], [-20, -96], [20, -96], [26, -60], [22, -18]], true, 6), { fill: body, shade: () => shape(rect(8, -110, 30, 110), { fill: dark ? P.dark : P.pale, stroke: false, boil: 0 }) });
  shape(arc(0, -96, 22, 22, Math.PI, TAU, 16), { fill: P.light });
  for (const [dx, dy] of [[-8, -106], [0, -110], [8, -106]]) shape(ell(dx, dy, 2.4, 2.4), { fill: P.ink, stroke: false, boil: 0 });
  pieEye(-8, -68, 7, 10, { lwk: .6, type: o.eyes, lx: o.lx || 0 }); pieEye(8, -68, 7, 10, { lwk: .6, type: o.eyes, lx: o.lx || 0 });
  mouth(0, -46, 16, o.mouth || 'smile');
  pop();
}

// 一摞盘子 = 木琴（斜着往上的台阶）；lit = 当前被踩到的那只（压下去）
export function plateStair(x, y, k = 1, n = 6, o = {}) {
  push(); translate(x, y); scale(k);
  for (let i = 0; i < n; i++) {
    const px = i * 58, py = -i * 44 + (o.press === i ? 8 : 0), wob = o.wob ? Math.sin((o.t || 0) * 20 + i) * o.wob * 3 : 0;
    push(); translate(px, py); rotate(wob * .02);
    shape([...arc(0, -8, 62, 13, 0, Math.PI, 16), ...arc(0, 0, 62, 13, Math.PI, 0, 16)], { fill: P.pale });
    shape(ell(0, -8, 62, 13, 30), { fill: P.white, shade: () => stroke(arc(0, -8, 44, 8, 0, TAU, 24), S.lw * .5, { line: P.mid }) });
    pop();
  }
  pop();
}

// 挂着的锅 / 平底锅 / 长柄汤勺（原点 = 挂钩；swing = 摆角）
export function hanging(x, y, k = 1, kind = 'pot', swing = 0) {
  push(); translate(x, y); scale(k); shape(ell(0, 0, 6, 6), { fill: P.dark }); rotate(swing);
  if (kind === 'pot') {
    stroke([[0, 0], [0, 26]], S.lw * .8);
    shape(rr(-9, 20, 18, 70, 8), { fill: P.dark });
    shape(spline([[-58, 92], [58, 92], [54, 168], [30, 180], [-30, 180], [-54, 168]], true, 5), { fill: P.mid, shade: () => shape(rect(-40, 80, 16, 110), { fill: P.light, stroke: false, boil: 0 }) });
    shape(ell(0, 92, 58, 10), { fill: P.dark });
  } else if (kind === 'pan') {
    shape(rr(-8, 4, 16, 90, 8), { fill: P.dark });
    shape(ell(0, 150, 62, 62, 40), { fill: P.dark, shade: () => shape(ell(-8, 142, 44, 44, 30), { fill: P.dmid, stroke: false }) });
  } else if (kind === 'ladle') {
    const c = [[0, 6], [0, 150]]; shape(ribbon(c, 10, 10), { fill: P.light });
    shape(arc(0, 150, 34, 30, 0, Math.PI, 16), { fill: P.light, shade: () => shape(rect(8, 140, 30, 50), { fill: P.mid, stroke: false, boil: 0 }) });
  }
  pop();
}

// 糖罐（方糖的家）
export function sugarBowl(x, y, k = 1, b = 0, o = {}) {
  push(); translate(x, y); scale(k); breathe(b, .04);
  for (const s of [-1, 1]) shape(arc(s * 64, -52, 18, 20, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : Math.PI * 1.5, 12), { fill: 'transparent', closed: false, lw: S.lw * 1.4 });
  shape(spline([[-66, -84], [66, -84], [60, -30], [36, -2], [-36, -2], [-60, -30]], true, 6), { fill: P.white, shade: () => { stroke(arc(0, -84, 64, 12, 0, Math.PI, 16).map(p => [p[0], p[1] + 18]), S.lw * 1.4); shape(rect(26, -100, 50, 110), { fill: P.pale, stroke: false, boil: 0 }); } });
  const lift = o.lid || 0;
  push(); translate(0, -lift * 34); rotate(-lift * .25);
  shape(ell(0, -86, 68, 13), { fill: P.white }); shape(arc(0, -88, 58, 22, Math.PI, TAU, 16), { fill: P.white }); shape(ell(0, -114, 10, 8), { fill: P.dmid });
  pop();
  pop();
}

// 窗户 + 会呼吸的窗帘
export function windowCurtain(x, y, k = 1, b = 0) {
  push(); translate(x, y); scale(k);
  shape(rect(-120, -260, 240, 220), { fill: P.pale, shade: () => { shape(ell(60, -200, 40, 18), { fill: P.white, stroke: false }); shape(ell(-40, -180, 50, 16), { fill: P.white, stroke: false }); } });
  stroke([[0, -260], [0, -40]], S.lw * 1.6); stroke([[-120, -150], [120, -150]], S.lw * 1.6);
  shape(rect(-140, -46, 280, 18), { fill: P.dmid });
  for (const s of [-1, 1]) {
    const bil = b * 10;
    const c = [[s * 150, -290], [s * 70, -290], [s * (62 - bil), -210], [s * (96 - bil), -130], [s * (88 - bil * 1.4), -40], [s * 150, -40]];
    shape(spline(c, true, 6), { fill: P.white, shade: () => { for (const d of [0, 1, 2]) stroke([[s * (84 + d * 18), -280], [s * (94 + d * 16 - bil * .5), -60]], S.lw * .5, { line: P.mid }); } });
  }
  shape(rr(-170, -304, 340, 18, 9), { fill: P.dark });
  pop();
}

// 单只盘子（橱柜木琴的一级台阶）：press = 被踩下的量 0..1，rot = 倾斜
export function plate(x, y, k = 1, o = {}) {
  push(); translate(x, y + (o.press || 0) * 9); scale(k); rotate(o.rot || 0);
  shape([...arc(0, -8, 62, 13, 0, Math.PI, 16), ...arc(0, 0, 62, 13, Math.PI, 0, 16)], { fill: P.pale });
  shape(ell(0, -8, 62, 13, 30), { fill: P.white, shade: () => stroke(arc(0, -8, 44, 8, 0, TAU, 24), S.lw * .5, { line: P.mid }) });
  pop();
}
