// 第 3 镜 过江（横跟）+ 第 4 镜 浪起（低角大全景）
import { mk, draw, blot, mass } from './ink.js';
import { hero, POSE, mixPose } from './hero.js';
import { ridgeFn, mountainLayer, reed, ripple, vn2 } from './land.js';
import { wave } from './wave.js';
import { T, stepTimes } from './story.js';
import { clamp, lerp, ss, eio, eo, mulberry } from '/core/lib.js';

const HZ = 560, WATER_Y = 810, SC = 3.0, SPEED = 390;
let farC = null;
function farLayer() {
  if (!farC) farC = mountainLayer({ W: 4200, H: 1080, ridge: ridgeFn([[500, 190, 150], [1100, 120, 160], [1700, 230, 140], [2300, 150, 170], [2900, 210, 150], [3500, 130, 160], [4000, 180, 150]], HZ + 20, 13, 26), depth: 200, tone: .13, rim: .5, rimW: 24, mist: .9, seed: 13 });
  return farC;
}
// 侠客世界 x（向左为负）：起跳后的落点 x=0 在 T.step0
export const heroX = t => -SPEED * (t - T.step0);
export function crossPose(t) {
  const st = stepTimes();
  if (t < st[0]) {   // 从崖上飞来：腾空下落
    const u = clamp((t - (st[0] - .6)) / .6);
    return { P: mixPose(POSE.leap, POSE.touch, ss(u)), y: -140 * (1 - u) * (1 - u) };
  }
  const k = Math.min(st.length - 1, Math.floor((t - st[0]) / T.beat)), ph = (t - st[k]) / T.beat;
  let P;
  if (ph < .14) P = POSE.touch;
  else if (ph < .36) P = mixPose(POSE.touch, POSE.leap, ss((ph - .14) / .22));
  else if (ph < .8) P = POSE.leap;
  else P = mixPose(POSE.leap, POSE.touch, ss((ph - .8) / .2));
  return { P, y: -70 * Math.sin(Math.PI * clamp(ph)) };
}

export function renderCross(A, t) {
  const L = A.ink, t12 = Math.floor(t * 12) / 12;
  const hx = heroX(t), camX = hx - 190;          // 人在画面偏右，前方（左）留空
  const sx = x => x - camX + 960;
  // 远山：慢视差
  const far = farLayer(); A.cw.drawImage(far, -((camX * .12) % 1400) - 1400 - 400, 0);
  // 水面：几道淡淡的干笔水纹（贴在水面上，越近走得越快）
  const R = mulberry(5);
  for (let i = 0; i < 26; i++) {
    const wy = HZ + 40 + Math.pow(R(), 1.4) * 480, par = .3 + (wy - HZ) / 520 * 1.1;
    const wx0 = R() * 5000 - 3000, len = 60 + R() * 180 * par;
    const x = ((wx0 - camX * par) % 2600 + 2600) % 2600 - 340;
    draw(L, mk([[x, wy], [x + len * .5, wy - 2], [x + len, wy + 1]], { w: 2 + par * 1.5, tone: .35, dry: .7, wet: .3, prof: 'tip', seed: 900 + i, gapLen: 60 }), 1, .55);
  }
  // 涟漪：每个落点一个墨圈，随时间扩散变淡
  const st = stepTimes();
  st.forEach((ts, k) => {
    if (t < ts) return;
    const age = t - ts, x = sx(heroX(ts) + 8), y = WATER_Y + 4;
    for (let j = 0; j < 3; j++) {
      const a2 = age - j * .22; if (a2 < 0) continue;
      const r = 14 + 210 * Math.pow(a2, .6) * (1 - j * .18);
      ripple(L, x, y, r, clamp(1 - a2 / 2.4) * (j ? .55 : .9), k * 7 + j, .2, 3.2 - j * .8);
    }
    if (age < .35) { const R2 = mulberry(k + 40); for (let i = 0; i < 7; i++) { const a = -Math.PI * R2(), d = 20 + 60 * age / .35 * R2(); blot(A.cw, x + Math.cos(a) * d * 1.4, y + Math.sin(a) * d * .6 - 30 * Math.sin(age / .35 * Math.PI) * R2(), 2 + R2() * 3, .8 * (1 - age / .35), 0, 1, i); } }
  });
  // 前方江水渗墨（浪起的预兆）
  const dk = clamp((t - T.darken) / 1.4);
  if (dk > 0) {
    const cx = sx(hx - 900), R3 = mulberry(77);
    for (let i = 0; i < 14; i++) {
      const bx = cx + (R3() - .5) * 900 * (.4 + dk), by = WATER_Y - 60 + (R3() - .3) * 200;
      blot(A.cw, bx, by, (60 + R3() * 140) * eo(dk), .18 * dk, 0, .25 + R3() * .2, i);
    }
    draw(L, mk([[cx - 700, WATER_Y - 40], [cx - 200, WATER_Y - 70 - 40 * dk], [cx + 300, WATER_Y - 30]], { w: 60 * dk + 1, tone: .5, darkDir: [0, -1], side: .8, brWet: true, body: .3, dry: .55, wet: .9, prof: 'lens', seed: 950 }), 1, dk);
  }
  // 侠客（姿势 12fps，位置每帧）
  const { P, y } = crossPose(t12);
  hero(L, P, { x: sx(hx), y: WATER_Y + y, s: SC, dir: -1, seed: 2, t: t12, boil: t12 * 12 });
  // 前景芦苇（快视差，浓墨）
  const clumps = [900, 3300];
  clumps.forEach((wx, i) => {
    const x = ((wx - camX * 1.7) % 4200 + 4200) % 4200 - 600;
    if (x < -500 || x > 2400) return;
    for (let j = 0; j < 4; j++) reed(L, x + j * 40, 1110, 170 + j * 40 + (i % 2) * 50, 2.4, i * 20 + j, -.4 + j * .08 + Math.sin(t * 2 + j) * .04, .92);
  });
  return { bleed: 5, rim: 1, paper: [camX * .5, 0, 1] };
}

// 第 4 镜：低角大全景，巨浪自左升起，他在右下落水滑停
export function renderRise(A, t) {
  const L = A.ink, t12 = Math.floor(t * 12) / 12, u = t - T.shot4;
  const push = 1 + .06 * ss(u / 5.5), sh = u > 1.5 ? (u - 1.5) * .8 : 0;
  const shake = [Math.sin(t * 37) * sh, Math.cos(t * 29) * sh * .7];
  const X = x => 960 + (x - 960) * push, Y = y => 700 + (y - 700) * push;
  // 远山极淡（低角，地平线低）
  A.cw.save(); A.cw.translate(960, 700); A.cw.scale(push, push); A.cw.translate(-960, -700);
  A.cw.drawImage(mountainLayer.cacheRise || (mountainLayer.cacheRise = mountainLayer({ W: 1920, H: 1080, ridge: ridgeFn([[1500, 120, 160], [1800, 80, 140], [300, 70, 150]], 790, 17, 16), depth: 120, tone: .12, rim: .5, mist: .7, seed: 17 })), 0, 0);
  A.cw.restore();
  // 浪
  const rise = ss(clamp((u + .2) / 4.8)), curl = ss(clamp((u - 1.4) / 3.4));
  for (const c of [A.cw, A.cd]) { c.save(); c.translate(960, 700); c.scale(push, push); c.translate(-960, -700); }
  wave(L, { x: 820, y: 830, s: 1.02, rise: .15 + .85 * rise, curl, t, seed: 21 });
  // 雨沫（斜向短干笔）
  const R = mulberry(3), nR = Math.round(60 * clamp((u - 1) / 2));
  for (let i = 0; i < nR; i++) {
    const x0 = R() * 2200 - 100, sp = 900 + R() * 500, y0 = ((R() * 1200 + t * sp) % 1300) - 150;
    draw(L, mk([[x0 - y0 * .25, y0], [x0 - y0 * .25 - 14, y0 + 40]], { w: 1.6, tone: .4, dry: .5, prof: 'tip', seed: 1200 + i }), 1, .5);
  }
  // 侠客：从右上落下 → 点水 → 滑停，留下一道墨痕
  const land = clamp(u / .3), sk = clamp((t12 - T.skid - .25) / (T.skidEnd - T.skid - .25));
  const hx = 1560 - 120 * eo(sk), hy = 830 - 90 * (1 - land) * (1 - land);
  if (sk > 0) draw(L, mk([[1560, 834], [1560 - 60 * eo(sk), 836], [hx + 10, 835]], { w: 5, tone: .7, dry: .5, wet: .5, prof: 'brush', seed: 1300 }), 1, 1);
  if (sk > 0) ripple(L, 1500, 836, 30 + 140 * sk, .5 * (1 - sk * .5), 3, .18, 2.4);
  const P = u < .3 ? mixPose(POSE.leap, POSE.touch, land) : mixPose(POSE.touch, POSE.skid, ss(sk));
  hero(L, P, { x: hx, y: hy, s: 1.55, dir: -1, seed: 2, t: t12, boil: t12 * 12 });
  for (const c of [A.cw, A.cd]) c.restore();
  return { bleed: 5, rim: 1, shake };
}
