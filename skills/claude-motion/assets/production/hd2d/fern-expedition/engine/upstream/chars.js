// 像素角色：程序化逐像素绘制（朝右的 3/4 侧身），每个姿势一帧，拼成图集；billboard 受场景光照
import * as THREE from 'three';
import { PX, ramp, hex, texOf, billboard, blob, glow } from './px.js';

export const SPX = 1 / 30;   // 角色像素 → 米
const FW = 34, FH = 50;       // 帧尺寸（像素）

const C = {
  cloak: ramp(['#2e0b14', '#521620', '#7c222c', '#a4333a', '#c9503f'], .22),
  skin: ramp(['#b87a62', '#dea282', '#f3c9a6', '#ffe2c8'], .22),
  hair: ramp(['#2e1712', '#4f2a1c', '#74412a', '#95603c'], .22),
  tunic: ramp(['#6e5b41', '#a38b64', '#cdb58a', '#e9d8b0'], .22),
  boot: ramp(['#1a100c', '#2e1d15', '#4a3022'], .22),
  brass: ramp(['#3e2a10', '#7a5a24', '#b88c3e', '#e6c26a'], .22),
  glass: ramp(['#ff8a1c', '#ffc14a', '#ffe79a', '#fffbe6'], .22),
  coat: ramp(['#10131f', '#1d2438', '#2c3754', '#40507a', '#5a6c98'], .22),
  beard: ramp(['#6d6a70', '#9c99a0', '#c8c6cc', '#eceaf0'], .22),
  cap: ramp(['#0e0e16', '#1e1e2c', '#34344a'], .22),
  scarf: ramp(['#6a4a12', '#b08424', '#e0b640'], .22),
};
const INK = hex('#1a1016');

// —— 灯笼（小提灯）：lit 0..1 控制火苗大小；em 画布同时画发光层 ——
function lantern(P, E, x, y, lit = 1, tilt = 0) {
  // 提手
  P.set(x + 2, y - 2, C.brass(.4, 0, 0)); P.set(x + 1, y - 1, C.brass(.6, 0, 0)); P.set(x + 3, y - 1, C.brass(.6, 0, 0));
  // 顶盖
  P.rect(x, y, 5, 1, C.brass(.85, 0, 0)); P.set(x + 2, y - 1 + 0, C.brass(.95, 0, 0));
  // 玻璃罩 5x5，框
  for (let j = 1; j <= 5; j++) for (let i = 0; i < 5; i++) {
    const edge = i === 0 || i === 4;
    if (edge) { P.set(x + i, y + j, C.brass(i === 0 ? .7 : .35, i, j)); continue; }
    const cx = i - 2, cy = j - 3.2 + tilt * cx * .3; const r = Math.hypot(cx * 1.1, cy * .8);
    const f = lit * (1.35 - r * .45);
    if (lit > .05 && f > .35) { const c = C.glass(Math.min(.99, f * .75), x + i, y + j); P.set(x + i, y + j, c); E && E.set(x + i, y + j, c); }
    else P.set(x + i, y + j, lit > .05 ? C.glass(.05, 0, 0) : hex('#3a3440'));
  }
  P.rect(x, y + 6, 5, 1, C.brass(.55, 0, 0));
}

// —— Wren ——（p: {step 0..3 走路相位 | null, bob, arm:'low'|'fwd'|'up'|'hug'|'pour', kneel, lit, blink, look}）
function drawWren(P, E, p) {
  const kx = p.kneel ? 1 : 0, by = (p.bob || 0) + (p.kneel ? 8 : 0);
  const hx = 16, hy = 12 + by;
  // 腿 / 靴
  if (!p.kneel) {
    const st = p.step ?? -1;
    const legs = st < 0 ? [[13, 0], [18, 0]] : [[[11, 0], [20, -1]], [[14, -1], [17, 0]], [[20, -1], [11, 0]], [[17, 0], [14, -1]]][st];
    legs.forEach(([lx, ly], i) => {
      for (let y = 40; y < 48 + ly; y++) for (let x = lx; x < lx + 4; x++) P.set(x, y + ly * 0, C.boot(y > 44 + ly ? .35 : (i ? .6 : .9) - (x === lx ? .3 : 0), x, y));
      P.rect(lx, 47 + ly, 5, 1, C.boot(.1, 0, 0));
    });
  }
  // 斗篷主体（梯形 + 下摆摆动）
  const hem = p.hem || 0, top = 18 + by, bot = p.kneel ? 47 : 41;
  const shL = 10, shR = 22, hmL = p.kneel ? 5 : 8 - hem, hmR = p.kneel ? 27 : 24 + hem;
  P.poly([[shL, top], [shR, top], [hmR, bot], [hmL + 1, bot + 0], [hmL, bot - 1]], (x, y) => {
    const u = (y - top) / (bot - top), l = hmL * u + shL * (1 - u), r = hmR * u + shR * (1 - u), s = (x - l) / (r - l);
    let v = .62 - s * .45 + (1 - u) * .15;
    if ((x + (y >> 2)) % 5 === 0 && u > .25) v -= .18;    // 褶
    if (s < .12) v += .12;
    return C.cloak(v, x, y);
  });
  // 前襟露出的衣服与腰带（朝右的前侧）
  if (!p.kneel) {
    for (let y = top + 2; y < bot - 3; y++) for (let x = 19; x < 21; x++) P.set(x, y, C.tunic(.75 - (x - 19) * .3 - (y > top + 12 ? .15 : 0), x, y));
    P.rect(18, top + 11, 4, 1, C.hair(.25, 0, 0)); P.set(20, top + 11, C.brass(.9, 0, 0));
  }
  // 围巾（金色一抹）
  P.rect(12, top - 1, 9, 2, C.scarf(.6, 0, 0)); P.rect(12, top - 1, 9, 1, C.scarf(.9, 0, 0)); P.set(11, top, C.scarf(.3, 0, 0));
  if (p.scarf) { P.set(10, top + 1, C.scarf(.4, 0, 0)); P.set(9, top + 1 + (p.scarf > 1 ? 1 : 0), C.scarf(.3, 0, 0)); P.set(8, top + 2, C.scarf(.2, 0, 0)); }
  // 兜帽（外）
  P.ellipse(hx - .5, hy - .5, 7.5, 7.5, (x, y, dx, dy) => C.cloak(.72 - dx * .35 - dy * .25, x, y));
  // 脸（兜帽开口朝右）
  const fx = hx + 2 + (p.look || 0), fy = hy + 1.2 + (p.kneel ? 1 : 0);
  P.ellipse(fx, fy, 4.6, 4.6, (x, y, dx, dy) => C.skin(.62 - dx * .1 - dy * .3 + (dx > .55 ? -.2 : 0), x, y));
  // 刘海 + 侧发
  for (let x = Math.floor(fx - 4); x <= fx + 4; x++) { const d = 1 + ((x * 7) % 3 === 0 ? 1 : 0); for (let y = Math.floor(fy - 4.5); y < fy - 4.5 + d + 1; y++) P.set(x, y, C.hair(.55 + (x - fx) * .05, x, y)); }
  for (let y = Math.floor(fy - 3); y < fy + 3; y++) P.set(Math.floor(fx - 4), y, C.hair(.35, 0, y));
  for (let y = Math.floor(fy - 2); y < fy + 4; y++) { P.set(Math.floor(fx + 4), y, C.hair(.45, 0, y)); }
  for (let y = Math.floor(fy - 1); y < fy + 5; y++) P.set(Math.floor(fx - 4), y, C.hair(.3, 0, y));
  // 眼睛（3/4 两只）、腮红
  const ey = Math.round(fy);
  if (p.blink) { P.set(Math.round(fx + 2), ey, C.skin(.2, 0, 0)); P.set(Math.round(fx - 1), ey, C.skin(.2, 0, 0)); }
  else if (p.closed) { P.set(Math.round(fx + 2), ey, INK); P.set(Math.round(fx + 1), ey, INK); P.set(Math.round(fx - 1), ey, INK); P.set(Math.round(fx - 2), ey, INK); }
  else { P.set(Math.round(fx + 2), ey, INK); P.set(Math.round(fx + 2), ey - 1, INK); P.set(Math.round(fx - 1), ey, INK); P.set(Math.round(fx - 1), ey - 1, INK); P.set(Math.round(fx + 2), ey - 1, hex('#3a2a40')); }
  P.set(Math.round(fx + 3), ey + 2, hex('#e8907a')); P.set(Math.round(fx - 2), ey + 2, hex('#e8907a'));
  P.set(Math.round(fx + 4), ey + 1, C.skin(.4, 0, 0));   // 鼻尖
  // 兜帽边缘（脸周围一圈暗边）
  // 手臂 + 灯
  const lit = p.lit ?? 1, arm = p.arm || 'low';
  const sleeve = (pts) => pts.forEach(([x, y], i) => { P.set(x, y, C.cloak(.55, x, y)); P.set(x, y + 1, C.cloak(.3, x, y)); });
  if (arm === 'low') { sleeve([[21, top + 2], [22, top + 3], [23, top + 4], [23, top + 5], [23, top + 6], [23, top + 7]]); P.rect(23, top + 8, 2, 2, C.skin(.6, 0, 0)); lantern(P, E, 22, top + 12, lit); }
  if (arm === 'fwd') { sleeve([[21, top + 2], [22, top + 3], [23, top + 3], [24, top + 4], [25, top + 5], [26, top + 5]]); P.rect(27, top + 5, 2, 2, C.skin(.6, 0, 0)); lantern(P, E, 26, top + 9, lit); }
  if (arm === 'up') { sleeve([[21, top + 1], [22, top], [23, top - 2], [24, top - 4], [24, top - 6], [25, top - 8]]); P.rect(25, top - 10, 2, 2, C.skin(.6, 0, 0)); lantern(P, E, 24, top - 6, lit); }
  if (arm === 'pour') { sleeve([[21, top + 1], [22, top], [23, top - 1], [24, top - 2], [25, top - 3], [26, top - 4]]); P.rect(27, top - 5, 2, 2, C.skin(.6, 0, 0)); lantern(P, E, 27, top - 2, lit, 1); }
  if (arm === 'hug') {   // 跪下护灯：灯在胸前，斗篷一侧包住
    lantern(P, E, 19, top + 6, lit);
    for (let y = top + 3; y < top + 14; y++) for (let x = 22; x < 26 - (y > top + 10 ? 1 : 0); x++) P.set(x, y, C.cloak(.45 - (x - 22) * .08, x, y));
    P.rect(18, top + 12, 3, 2, C.skin(.55, 0, 0)); P.rect(23, top + 7, 2, 2, C.skin(.5, 0, 0));
  }
  // 后手（远侧）一点点露出
  if (!p.kneel && arm !== 'hug') P.set(9, top + 9, C.skin(.35, 0, 0));
}

// —— 老守灯人 ——（p: {arm:'low'|'give'|'wave'|'taper', bob, look:-1..1 抬头, blink}）
function drawKeeper(P, E, p) {
  const by = p.bob || 0, hx = 15, hy = 12 + by + 1;
  // 腿
  for (const [lx, sh] of [[11, .5], [17, .8]]) { for (let y = 41; y < 49; y++) for (let x = lx; x < lx + 5; x++) P.set(x, y, C.coat(sh * .5 - (x === lx ? .1 : 0), x, y)); P.rect(lx, 48, 6, 2, C.boot(.3, 0, 0)); P.rect(lx + 1, 48, 5, 1, C.boot(.6, 0, 0)); }
  // 长外套
  const top = 19 + by, bot = 42;
  P.poly([[9, top + 1], [22, top], [25, bot], [7, bot]], (x, y) => { const u = (y - top) / (bot - top), l = 9 - 2 * u, r = 22 + 3 * u, s = (x - l) / (r - l); let v = .7 - s * .5 + (1 - u) * .1; if (s > .62 && s < .68) v -= .25; return C.coat(v, x, y); });
  for (let y = top + 4; y < bot - 2; y += 5) P.set(21, y, C.brass(.9, 0, 0));
  P.rect(8, top + 13, 17, 2, C.boot(.5, 0, 0)); P.set(19, top + 13, C.brass(.95, 0, 0));
  // 头：驼背前倾
  P.ellipse(hx + 1, hy, 5.5, 6, (x, y, dx, dy) => C.skin(.6 - dx * .15 - dy * .25, x, y));
  // 白发（后脑）
  P.ellipse(hx - 2.5, hy + 1, 3, 4.5, (x, y, dx, dy) => C.beard(.7 - dy * .2, x, y));
  // 鸭舌帽
  P.ellipse(hx + .5, hy - 4, 6.5, 3.2, (x, y, dx, dy) => C.cap(.6 - dy * .3, x, y)); P.rect(hx + 3, hy - 3, 6, 1, C.cap(.2, 0, 0));
  // 胡子：从耳下到胸口
  const look = p.look || 0;
  P.poly([[hx - 2, hy + 1], [hx + 6, hy + 1 - look], [hx + 6, hy + 5 - look], [hx + 3, hy + 10], [hx - 1, hy + 8]], (x, y) => C.beard(.75 - (y - hy) * .04 + ((x + y) % 4 === 0 ? -.15 : 0), x, y));
  // 眉 + 眼 + 鼻
  P.rect(hx + 2, hy - 2 - look, 3, 1, C.beard(.95, 0, 0));
  if (!p.blink) P.set(hx + 4, hy - 1 - look, INK); else P.set(hx + 4, hy - 1 - look, C.skin(.2, 0, 0));
  P.set(hx + 1, hy - 1 - look, INK);
  P.rect(hx + 5, hy - look, 2, 2, C.skin(.8, 0, 0)); P.set(hx + 6, hy + 1 - look, C.skin(.45, 0, 0));
  // 手臂
  const arm = p.arm || 'low';
  const sl = (pts) => pts.forEach(([x, y]) => { P.set(x, y, C.coat(.75, x, y)); P.set(x, y + 1, C.coat(.45, x, y)); P.set(x - 1, y + 1, C.coat(.35, x, y)); });
  if (arm === 'low') { sl([[21, top + 3], [22, top + 5], [22, top + 7], [22, top + 9], [22, top + 11]]); P.rect(21, top + 13, 3, 2, C.skin(.55, 0, 0)); }
  if (arm === 'taper') {   // 伸出点火棒
    sl([[21, top + 3], [23, top + 4], [24, top + 5], [25, top + 6]]); P.rect(26, top + 6, 2, 2, C.skin(.6, 0, 0));
    P.line(27, top + 6, 32, top + 1, C.hair(.5, 0, 0)); P.set(33, top, C.glass(.95, 0, 0)); E.set(33, top, C.glass(.95, 0, 0)); P.set(33, top - 1, C.glass(.6, 0, 0)); E.set(33, top - 1, C.glass(.6, 0, 0));
  }
  if (arm === 'give') { sl([[21, top + 3], [23, top + 4], [25, top + 5], [26, top + 6]]); P.rect(27, top + 6, 3, 2, C.skin(.6, 0, 0)); }
  if (arm === 'wave') { sl([[21, top + 2], [22, top], [23, top - 2], [24, top - 4], [24, top - 6]]); P.rect(23 + (p.w || 0), top - 9, 3, 3, C.skin(.6, 0, 0)); }
}

// 帧表（名字 → 参数）
const WREN = {
  idle0: { arm: 'low' }, idle1: { arm: 'low', bob: 1 }, blink: { arm: 'low', blink: 1 },
  w0: { step: 0, arm: 'low', hem: 1, scarf: 1 }, w1: { step: 1, arm: 'low', bob: -1, scarf: 2 }, w2: { step: 2, arm: 'low', hem: -1, scarf: 1 }, w3: { step: 3, arm: 'low', bob: -1, scarf: 2 },
  fwd: { arm: 'fwd' }, fwd1: { arm: 'fwd', bob: 1 }, empty: { arm: 'fwd', lit: 0 }, emptyLow: { arm: 'low', lit: 0 },
  upE: { arm: 'up', lit: 0 }, up: { arm: 'up' }, up1: { arm: 'up', bob: 1 }, pour: { arm: 'pour', lit: .6 }, pourEnd: { arm: 'pour', lit: 0 },
  kneel: { kneel: 1, arm: 'hug', closed: 1 }, kneelDim: { kneel: 1, arm: 'hug', lit: .25, closed: 1 }, kneelOut: { kneel: 1, arm: 'hug', lit: .08, closed: 1 }, kneelOpen: { kneel: 1, arm: 'hug' },
  lookUp: { arm: 'low', look: 0 },
  // 风暴中：斗篷被吹
  g0: { step: 0, arm: 'fwd', hem: 3, scarf: 2 }, g1: { step: 1, arm: 'fwd', hem: 4, bob: -1, scarf: 2 }, g2: { step: 2, arm: 'fwd', hem: 3, scarf: 2 }, g3: { step: 3, arm: 'fwd', hem: 4, bob: -1, scarf: 2 },
  gDim: { arm: 'fwd', hem: 4, lit: .3, scarf: 2 },
};
const KEEP = {
  idle0: { arm: 'low' }, idle1: { arm: 'low', bob: 1 }, blink: { arm: 'low', blink: 1 },
  taper: { arm: 'taper' }, give: { arm: 'give' }, look: { arm: 'low', look: 1 }, look1: { arm: 'low', look: 1, bob: 1 },
  wave0: { arm: 'wave', look: 1 }, wave1: { arm: 'wave', look: 1, w: 1 },
};

function atlas(table, draw, lanternLit) {
  const names = Object.keys(table), n = names.length;
  const P = new PX(FW * n, FH), E = new PX(FW * n, FH);
  names.forEach((k, i) => {
    const p1 = new PX(FW, FH), e1 = new PX(FW, FH);
    draw(p1, e1, table[k]); p1.outline(.3);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const c = p1.get(x, y); if (c) P.set(i * FW + x, y, c); const e = e1.get(x, y); if (e) E.set(i * FW + x, y, e); }
  });
  const tex = texOf(P.done()), em = texOf(E.done());
  for (const t of [tex, em]) { t.repeat.set(1 / n, 1); }
  return { tex, em, names, n, canvas: P.c };
}

// 角色对象：mesh + 设置帧/朝向/位置
export function makeChar(kind, extra = {}) {
  const TB = { ...(kind === 'wren' ? WREN : KEEP), ...extra };
  const A = kind === 'wren' ? atlas(TB, drawWren) : atlas(TB, drawKeeper);
  const mesh = billboard(A.tex, FW * SPX, FH * SPX, { em: A.em, emCol: '#ffffff', emI: 2.2 });
  const root = new THREE.Group(); root.add(mesh); root.userData.char = kind;
  const sh = blob(.42, .55); sh.position.y = .015; root.add(sh);
  return {
    root, mesh, atlas: A, shadowBlob: sh,
    frame(name) { const i = A.names.indexOf(name); if (i < 0) throw new Error('frame ' + name); A.tex.offset.x = A.em.offset.x = i / A.n; },
    face(cam, flip = false) { root.rotation.y = Math.atan2(cam.position.x - root.position.x, cam.position.z - root.position.z); mesh.scale.x = flip ? -1 : 1; },
    // 灯笼在世界里的位置（按帧的像素坐标近似）
    lanternPos(name, flip = false) {
      const L = { low: [24.5, 33], fwd: [28.5, 30], up: [26.5, 15], pour: [29.5, 19], hug: [21.5, 29] }, p = TB[name] || {}, k = L[p.arm || 'low'];
      const by = (p.bob || 0) + (p.kneel ? 8 : 0) * 0;
      const lx = (k[0] - FW / 2) * SPX * (flip ? -1 : 1), ly = (FH - k[1] - by) * SPX;
      const v = new THREE.Vector3(lx, ly, .08); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), root.rotation.y); return v.add(root.position);
    },
  };
}
export const FRAMES = { WREN: Object.keys(WREN), KEEP: Object.keys(KEEP) };
export { atlas, WREN, KEEP, drawWren, drawKeeper, FW, FH };
