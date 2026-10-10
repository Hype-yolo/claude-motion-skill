// scenes.js — 全片镜头。每个镜头 = 机位（世界点→画面中心 + 缩放）+ 背景 + 群演（随拍呼吸）+ 角色表演
// 角色用 tq = q(t)（12fps 拍两格），机位用连续 t（每帧平滑）
import * as T from './toon.js';
import { P, mug, cube, glove, ribbon, steam, shoe as _shoe } from './chars.js';
import * as C from './cast.js';
import { drawBG, camBase, COUNTER_Y as CY, FLOOR_Y, SINK_X, PLATES, LADLE, BASIN } from './bg.js';
import { bar, BEAT, K, q, breath, beats, SUBS } from './story.js';
import { clamp, lerp, seg, ss, eio, eo, ei, back, TAU, hash } from '/core/lib.js';
import { subPlate, fatTitle } from './ui.js';
const { shape, stroke, ell, arc, spline, rr, rect, push, pop, translate, rotate, scale, noodle: _noodle } = T;

let BGK, BGC, sg;
export function initScenes(bgK, bgC, sceneCtx) { BGK = bgK; BGC = bgC; sg = sceneCtx; }

// —— 小工具 ——
const tw = (t, t0, t1, a, b, e = eio) => lerp(a, b, e(seg(t, t0, t1)));
const pulse = (t, t0, k = 6) => t < t0 ? 0 : Math.exp(-(t - t0) * k);          // 冲击后衰减
const hop = (u, h) => -4 * h * u * (1 - u);                                     // 抛物线
function setCam(t, bg, cam, squash = 0) {
  drawBG(sg, bg, cam, squash, FLOOR_Y);
  T.BASE.splice(0, 6, ...camBase(cam)); T.frame(t);
}
// 走路（每步一拍）：p = 步数相位；返回腿、胳膊、身体起伏
function walk(p, { L = 56, lift = 22, bob = 10, swing = 26 } = {}) {
  const a = Math.PI * p, c = Math.cos(a), s = Math.sin(a);
  return {
    legL: { x: -6 + c * L / 2, y: -Math.max(0, s) * lift, dir: 1, bend: 6 }, legR: { x: 6 - c * L / 2, y: -Math.max(0, -s) * lift, dir: 1, bend: -6 },
    bob: -(1 - Math.abs(c)) * bob, sw: c * swing,
  };
}
// 跑（双腿抡成风车）：p = 步数相位
function run(p, R = 46) {
  const a = Math.PI * p;
  return { legL: { x: Math.cos(a) * R + 10, y: Math.min(0, -Math.sin(a) * R * .9), dir: 1, bend: -10, ang: -Math.sin(a) * .4 }, legR: { x: Math.cos(a + Math.PI) * R + 10, y: Math.min(0, -Math.sin(a + Math.PI) * R * .9), dir: 1, bend: -10, ang: -Math.sin(a + Math.PI) * .4 }, bob: -Math.abs(Math.sin(a)) * 12 };
}
function cubeRun(p, R = 18) {
  const a = Math.PI * p;
  return { legL: { x: Math.cos(a) * R + 4, y: Math.min(0, -Math.sin(a) * R), dir: 1 }, legR: { x: Math.cos(a + Math.PI) * R + 4, y: Math.min(0, -Math.sin(a + Math.PI) * R), dir: 1 }, bob: -Math.abs(Math.sin(a)) * 7 };
}
// 速度线（世界坐标，向左拖）
function speedLines(x, y, n = 3, len = 90, gap = 26, col = P.light) { for (let i = 0; i < n; i++) stroke([[x - len - i * 14, y + i * gap], [x - 14 - i * 14, y + i * gap]], T.S.lw * .7, { line: col }); }
function puff(x, y, r, col = P.light) { shape(ell(x, y, r, r * .8, 18), { fill: col, lw: T.S.lw * .6 }); }
function star(x, y, r, rot = 0) { const pts = []; for (let i = 0; i < 8; i++) { const a = rot + i / 8 * TAU, rr_ = i % 2 ? r * .38 : r; pts.push([x + Math.cos(a) * rr_, y + Math.sin(a) * rr_]); } shape(pts, { fill: P.white, lw: T.S.lw * .6 }); }
function drop(x, y, r) { shape(spline([[x, y - r * 1.8], [x + r, y], [x, y + r], [x - r, y]], true, 5), { fill: P.white, lw: T.S.lw * .55 }); }

// —— 厨房群演（标准站位）——
export const POS = { window: 330, clock: 380, mug: 640, bowl: 980, salt: 1400, pepper: 1456, toaster: 1900, hooks1: [1080, 1210, 1350], hooks2: [2300, 2430, 2570] };
function kitchen(tq, o = {}) {
  const amp = o.amp ?? 1, b = breath(tq) * amp, bt = beats(tq), dance = o.dance || 0;
  C.windowCurtain(POS.window, 470, 1, b);
  const kinds = ['pot', 'pan', 'ladle'];
  POS.hooks1.forEach((x, i) => C.hanging(x, 330, .8, kinds[i], b * .07 * (i % 2 ? -1 : 1)));
  POS.hooks2.forEach((x, i) => C.hanging(x, 330, .8, kinds[(i + 1) % 3], b * .07 * (i % 2 ? -1 : 1)));
  // 闹钟：响铃 / 跳舞时每拍一跳
  const ck = o.clock || {};
  const clockHop = dance ? -Math.abs(Math.cos(bt * Math.PI)) * 0 + (1 - Math.abs(Math.sin(bt * Math.PI))) * -34 * dance : 0;
  C.clock(POS.clock, CY + 4 + clockHop, .95, b, { t: tq, ring: ck.ring || 0, lx: ck.lx ?? .6, ly: ck.ly || 0, eyes: ck.eyes, mouth: ck.mouth || 'smile' });
  // 盐和胡椒：被经过时转成陀螺；跳舞时踢腿
  const spin = o.spin || 0;
  const kickL = dance ? { x: -12 + Math.max(0, Math.cos(bt * Math.PI)) * 26, y: -Math.max(0, Math.cos(bt * Math.PI)) * 30 * dance } : null;
  const kickR = dance ? { x: 12 + Math.max(0, -Math.cos(bt * Math.PI)) * 26, y: -Math.max(0, -Math.cos(bt * Math.PI)) * 30 * dance } : null;
  const sh = (x, pepper, ph) => { push(); translate(x, 0); scale(Math.cos(spin * TAU + ph) || .02, 1); translate(-x, 0); C.shaker(x, CY + 4, .95, pepper ? -b : b, { pepper, lx: o.shLook ?? (pepper ? -.6 : .6), eyes: o.shEyes, mouth: o.shMouth || 'smile', lean: dance ? (pepper ? -1 : 1) * .12 * Math.cos(bt * Math.PI) : 0, legL: kickL || undefined, legR: kickR || undefined }); pop(); };
  sh(POS.salt, false, 0); sh(POS.pepper, true, .25);
  // 烤面包机
  const ts = o.toaster || {};
  const toast = dance ? Math.max(0, Math.cos(bt * Math.PI * 2)) * 60 * dance : (ts.toast || 0);
  if (!o.noToaster) C.toaster(POS.toaster, CY + 4 + (ts.dy || 0), .9, b + (ts.pop || 0), { lx: ts.lx ?? -.6, ly: ts.ly || 0, eyes: ts.eyes, mouth: ts.mouth || 'smile', lever: ts.lever || 0, toast: toast || undefined });
  // 水龙头
  C.faucet(SINK_X, CY - 2, .9, b, { drip: 10 + (tq * 40 % 40), spin: dance ? bt * Math.PI * .5 : 0, ly: .3 });
}
function bowl(tq, lid = 0, amp = 1) { C.sugarBowl(POS.bowl, CY + 4, 1.12, breath(tq) * .5 * amp, { lid }); }

// —— 马克杯默认手臂 ——
const ARMS = { armL: { x: -128, y: -34, hand: 'open', bend: 14 }, armR: { x: 128, y: -34, hand: 'open', bend: -14 } };

// ———————————————————— 镜头 ————————————————————
const CAM_WIDE = { x: 720, y: 515, z: 1.3 };

export function shotTitle(t) {
  shotWide1(t);                                         // 片名卡下面已经是厨房
  const u = eio(seg(t, K.roll[0], K.roll[1]));
  if (u >= 1) return;
  const g = sg, beat = beats(t), lift = u * 1180;
  g.save(); g.setTransform(1, 0, 0, 1, 0, -lift);
  g.beginPath(); g.rect(200, -100, 1520, 1180); g.clip();
  g.save(); g.translate(960, 540); g.rotate(t * .22);
  for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#8A877F' : '#C4C1B8'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1400, i / 24 * TAU, (i + 1) / 24 * TAU); g.fill(); }
  g.restore();
  // 卡片呼吸（每拍一次）
  const bb = Math.cos(beats(q(t)) * TAU);
  g.save(); g.translate(960, 540); g.scale(1 - bb * .008, 1 + bb * .012); g.translate(-960, -540);
  g.fillStyle = '#F4F1EA'; g.strokeStyle = P.ink; g.lineWidth = 9; g.beginPath(); g.roundRect(430, 290, 1060, 490, 60); g.fill(); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.roundRect(453, 313, 1014, 444, 44); g.stroke();
  const hopL = i => -(Math.max(0, Math.cos((beats(q(t)) - i * .12) * Math.PI)) ** 6) * 26;
  fatTitle(g, 'Coffee', 960, 425, 132, { bounce: hopL });
  fatTitle(g, 'Cup Chase', 960, 575, 132, { bounce: i => hopL(i + 6) });
  g.fillStyle = P.ink; g.font = '40px Limelight'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('A  RUBBER  HOSE  CARTOON', 960, 722);
  g.restore(); g.restore();
  // 卷轴（窗帘卷在下沿）
  if (u > 0) { const y = 1080 - lift; g.save(); g.fillStyle = '#4A4844'; g.strokeStyle = P.ink; g.lineWidth = 6; g.beginPath(); g.roundRect(222, y - 14, 1476, 58, 29); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,250,.35)'; g.fillRect(240, y - 2, 1440, 8); g.restore(); }
}

export function shotWide1(t) {
  const tq = q(t);
  setCam(t, BGK, CAM_WIDE);
  const ringing = tq >= K.ring[0] && tq < K.ring[1];
  kitchen(tq, { clock: { ring: ringing ? 1 : 0, lx: tq > K.ring[1] ? .8 : .6, mouth: ringing ? 'o' : 'smile', eyes: ringing ? 'wide' : undefined } });
  bowl(tq);
  // 马克杯
  const p = { x: POS.mug, y: CY + 6, turn: 0, t: tq, ...ARMS, eyes: { type: 'shut' }, mouth: { type: 'flat' }, steam: 'lazy' };
  const b = breath(tq);
  if (tq < K.wake) { const s = Math.sin(tq * Math.PI * 1.2); p.sy = 1 + s * .03; p.sx = 1 - s * .02; p.mouth = { type: 'o', open: .5 + s * .3 }; }
  else if (tq < K.wake + .34) { const u = seg(tq, K.wake, K.wake + .34); p.y += hop(u, 44); p.sy = 1.18 - u * .18; p.sx = .9 + u * .1; p.eyes = { type: 'wide' }; p.brows = 'up'; p.steam = 'up'; p.mouth = { type: 'o', open: 1 }; p.armL = { x: -170, y: -250, hand: 'open' }; p.armR = { x: 170, y: -250, hand: 'open' }; }
  else if (tq < K.yawn[0]) { p.eyes = { lx: -.8, lid: .3 }; p.brows = 'angry'; p.mouth = { type: 'frown' }; p.turn = -15; p.sy = 1 + b * .03; }
  else if (tq < K.yawn[1]) { const u = seg(tq, K.yawn[0], K.yawn[1]); p.eyes = { type: 'shut' }; p.mouth = { type: 'yawn' }; p.sy = 1 + Math.sin(u * Math.PI) * .1; p.sx = 1 - Math.sin(u * Math.PI) * .05; p.armL = { x: -150, y: -300 - Math.sin(u * Math.PI) * 40, hand: 'fist', bend: 30 }; p.armR = { x: 150, y: -300 - Math.sin(u * Math.PI) * 40, hand: 'fist', bend: -30 }; }
  else if (tq < K.dip) { p.eyes = { lid: .4 }; p.mouth = { type: 'smile' }; p.sy = 1 + b * .03; }
  else if (tq < K.lick) { p.eyes = { lid: .15, ly: -.6, lx: .2 }; p.mouth = { type: 'smile' }; p.armR = { x: 38, y: -262, hand: 'point', rot: Math.PI / 2 + .2, front: true, bend: -70 }; p.sy = 1 + b * .03; }
  else if (tq < K.taste) { p.eyes = { lid: .2, lx: -.2, ly: .4 }; p.mouth = { type: 'o', open: .7 }; p.armR = { x: 40, y: -116, hand: 'point', rot: Math.PI, front: true, bend: -40 }; }
  else { const pre = tq > bar(5, 4); p.eyes = pre ? { type: 'wide', lx: 0, ly: 0 } : { type: 'shut' }; p.mouth = pre ? { type: 'flat' } : { type: 'smile' }; p.steam = pre ? 'up' : 'lazy'; p.shake = pre ? 1.5 : 0; }
  mug(p);
}

export function shotBitter(t) {
  const tq = q(t);
  setCam(t, BGK, { x: POS.mug, y: 560, z: 2.4 });
  kitchen(tq, {});
  let sh = 0, sq = 0; for (const w of K.wah) { sh += pulse(tq, w, 5) * 7; sq += pulse(tq, w, 7); }
  if (tq > K.wah[2]) sh += 3.5 * (1 - seg(tq, K.wah[2] + .4, bar(7)));
  const bleh = tq >= K.wah[2];
  mug({ x: POS.mug, y: CY + 6, turn: 0, t: tq, shake: sh, sy: 1 - sq * .08, sx: 1 + sq * .05, eyes: { type: 'squeeze' }, brows: 'angry', mouth: { type: bleh ? 'bleh' : 'pucker', w: 66 }, steam: 'bitter',
    armL: { x: -150, y: -200 - sq * 30, hand: 'fist', bend: 30 }, armR: { x: 150, y: -200 - sq * 30, hand: 'fist', bend: -30 } });
}

export function shotWide2(t) {
  const tq = q(t), frozen = tq >= K.lock && tq < K.boing;
  setCam(t, BGK, CAM_WIDE);
  const ftq = frozen ? K.lock : tq;
  kitchen(ftq, { amp: 1 });
  // 方糖：探头 → 对视（定格）→ 眼珠弹出 → 蹦出糖罐 → 原地空转双腿
  const lidUp = tq < K.boing ? tw(tq, K.peek[0], K.peek[1], 0, 1.85, eo) : tw(tq, K.boing, K.boing + .2, 1.85, 0, ei);
  const peekY = tw(tq, K.peek[0], K.peek[1], 30, 0, eo);
  if (tq < K.boing) {
    cube({ x: POS.bowl - 4, y: CY - 72 + peekY, k: .95, turn: -20, eyes: { type: tq >= K.lock ? 'wide' : 'open', lx: -.9 }, mouth: { type: tq >= K.lock ? 'wavy' : 'flat', open: .5 }, brows: tq >= K.lock ? 'up' : undefined, sweat: tq >= K.lock ? [[44, -96, 5]] : null });
    bowl(ftq, lidUp);
  } else {
    bowl(tq, lidUp);
    const u = seg(tq, K.boing, K.boing + .3), inAir = tq < K.boing + .3;
    const x = lerp(POS.bowl, POS.bowl + 120, u), y = inAir ? lerp(CY - 72, CY, u) + hop(u, 110) : CY;
    const r = cubeRun((tq - K.boing) * 10);
    cube({ x, y, k: .95, turn: 40, sy: inAir ? 1.25 : 1, sx: inAir ? .85 : 1, eyes: { type: 'wide', lx: -.8 }, mouth: { type: 'wavy', open: .7 }, brows: 'up', sweat: [[-44, -100, 5], [40, -104, 4]],
      legL: inAir ? { x: -8, y: -10 } : r.legL, legR: inAir ? { x: 12, y: -16 } : r.legR, armL: { x: -44, y: -104, hand: 'open', bend: 8 }, armR: { x: 48, y: -110, hand: 'open', bend: -8 } });
    if (!inAir) speedLines(x - 40, CY - 80, 3, 60, 20);
  }
  // 马克杯
  const p = { x: POS.mug, y: CY + 6, turn: 30, t: ftq, ...ARMS, eyes: { lx: .95, ly: .1 }, mouth: { type: 'o', open: .6 }, steam: 'bitter' };
  if (tq >= K.peek[0]) { p.steam = 'up'; p.eyes = { lx: 1, lid: .35 }; p.mouth = { type: 'grin', open: .4 }; p.brows = 'angry'; }
  if (tq >= K.lock) { p.armR = { x: 150, y: -220, hand: 'grab', front: true, bend: -30 }; }
  if (tq >= K.windup) { const r = run((tq - K.windup) * 14, 40); Object.assign(p, { legL: r.legL, legR: r.legR, lean: -.12, turn: 40, eyes: { lx: 1, lid: .2 }, armL: { x: -170, y: -90, hand: 'fist' }, armR: { x: -60, y: -40, hand: 'fist' } }); p.y += r.bob * .4; }
  else if (tq >= K.boing) { p.eyes = { type: 'wide', lx: 1 }; p.mouth = { type: 'o' }; p.sy = 1.08; }
  mug(p);
}

export function shotChase(t) {
  const tq = q(t);
  const TX = POS.toaster, camX = tw(t, K.go - .1, K.dive + .2, 860, TX - 100, eio);
  setCam(t, BGK, { x: camX, y: 515, z: 1.3 });
  // 谁经过盐胡椒就把它们转起来
  const cubeX = tq < K.dive - .17 ? lerp(POS.bowl + 120, TX - 60, ss(seg(tq, K.go, K.dive - .17)) * .15 + seg(tq, K.go, K.dive - .17) * .85) : TX - 60;
  const mugX = lerp(POS.mug, TX - 170, clamp(seg(tq, K.go, K.skid[1]) ** .9 * 1.0));
  const nearSh = x => Math.max(0, 1 - Math.abs(x - 1428) / 120);
  const spin = (tq - K.go) * 2.2 * Math.max(nearSh(cubeX) > 0 ? 1 : 0, 0) + seg(tq, K.shakerPass - .2, K.shakerPass + .9) * 2 + seg(tq, K.shakerPass + .6, K.shakerPass + 1.4) * 2;
  kitchen(tq, { spin, shEyes: 'wide', shMouth: 'o', shLook: 1 });
  bowl(tq, 0);
  // 方糖：跑 → 跳 → 挤进吐司槽（被机身挡住）
  const slotY = CY + 4 - 118 * .9;
  if (tq < K.dive + .2) {
    let x = cubeX, y = CY, sx = 1, sy = 1, r = cubeRun((tq - K.go) * 10);
    if (tq >= K.dive - .17) { const u = seg(tq, K.dive - .17, K.dive); x = lerp(TX - 60, TX - 18, u); y = lerp(CY, slotY - 40, u) + hop(u, 70); sy = 1.2; sx = .85; }
    if (tq >= K.dive) { const u = seg(tq, K.dive, K.dive + .2); x = TX - 18; y = slotY - 40 + u * 120; sx = .55; sy = 1.4; }
    cube({ x, y, k: .95, turn: 40, lean: .2, sx, sy, eyes: { type: 'wide', lx: -1 }, mouth: { type: 'wavy', open: .7 }, brows: 'up', sweat: [[-44, -100, 5]], legL: r.legL, legR: r.legR, armL: { x: -40, y: -110, hand: 'open', bend: 10 }, armR: { x: 44, y: -116, hand: 'open', bend: -10 } });
    if (tq < K.dive - .17) speedLines(x - 30, CY - 80, 3, 70, 18);
  }
  // 烤面包机最后画（挡住钻进去的方糖）
  C.toaster(POS.toaster, CY + 4, .9, breath(tq) + pulse(tq, K.dive, 8) * 1.4, { lx: -.8, eyes: tq > K.dive ? 'wide' : undefined, mouth: tq > K.dive ? 'o' : 'smile' });
  // 马克杯：风车腿追 → 急刹
  const skid = tq >= K.skid[0], r = run((tq - K.go) * 7, 46);
  const p = { x: mugX, y: CY + 6 + (skid ? 0 : r.bob), turn: 40, t: tq, lean: skid ? -.22 : .24, eyes: { lx: 1, lid: .15 }, brows: 'angry', mouth: { type: 'grin', open: .5 }, steam: 'blown', legL: r.legL, legR: r.legR,
    armR: { x: 190, y: -150, hand: 'grab', front: true, bend: -26 }, armL: { x: -170, y: -70, hand: 'fist', bend: 24 } };
  if (skid) { Object.assign(p, { legL: { x: 70, y: 0, dir: 1, ang: -.3 }, legR: { x: 36, y: 0, dir: 1 }, eyes: { type: 'wide', lx: 1 }, mouth: { type: 'o' }, steam: 'up', armR: { x: 150, y: -250, hand: 'open', front: true }, armL: { x: -180, y: -230, hand: 'open' } }); for (let i = 0; i < 3; i++) puff(mugX + 60 - i * 34, CY - 8 - i * 6, 14 + i * 5 + (tq * 50 % 6)); }
  mug(p);
  if (!skid) speedLines(mugX - 120, CY - 220, 3, 110, 30);
}

export function shotToaster(t) {
  const tq = q(t);
  const TX = POS.toaster; setCam(t, BGK, { x: TX - 60, y: 560, z: 1.9 });
  const ding = tq >= K.ding;
  kitchen(tq, { noToaster: true });
  // 方糖像吐司一样弹上天
  if (ding && tq < K.ding + .35) { const u = seg(tq, K.ding, K.ding + .35); const y = lerp(CY - 110, 180, eo(u)); cube({ x: TX - 18, y, k: .95, turn: 0, sy: 1.35, sx: .8, eyes: { type: 'wide' }, mouth: { type: 'o', open: 1 }, brows: 'up', legL: { x: -8, y: 0 }, legR: { x: 8, y: 0 }, armL: { x: -40, y: -120, hand: 'open' }, armR: { x: 40, y: -120, hand: 'open' } }); for (let i = 0; i < 3; i++) stroke([[TX - 44 + i * 26, y + 30], [TX - 44 + i * 26, y + 110]], T.S.lw * .7, { line: P.light }); }
  const tick = !ding ? Math.sin(tq * 60) * 2 : 0;
  C.toaster(POS.toaster + tick, CY + 4, .9, ding ? pulse(tq, K.ding, 6) * -2 + breath(tq) : breath(tq) * .4, { lever: ding ? 1 - seg(tq, K.ding, K.ding + .1) : seg(tq, K.lever, K.lever + .1), lx: ding ? -.6 : -.3, ly: ding ? -.8 : .3, eyes: ding ? 'happy' : 'wide', mouth: ding ? 'grin' : 'flat' });
  // 热浪一闪：放射线
  if (ding && tq < K.ding + .25) for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .3; stroke([[TX - 20 + Math.cos(a) * 80, 596 + Math.sin(a) * 80], [TX - 20 + Math.cos(a) * 170, 596 + Math.sin(a) * 170]], T.S.lw * 1.2); }
  // 马克杯凑过去看
  const blink = (tq > K.blink[0] && tq < K.blink[0] + .12) || (tq > K.blink[1] && tq < K.blink[1] + .12);
  const p = { x: TX - 180, y: CY + 6, turn: 38, t: tq, lean: ding ? -.08 : .16, eyes: ding ? { type: blink ? 'shut' : 'open', lx: 0, ly: 0 } : { lx: tq < K.lever + .3 ? .9 : .6, ly: tq < K.lever + .3 ? .7 : .2 }, mouth: ding ? { type: 'flat' } : { type: 'grin', open: .3 }, brows: ding ? undefined : 'angry', steam: ding ? 'none' : 'up',
    armR: { x: 160, y: -60, hand: 'open', front: true, bend: -20 }, armL: { x: -130, y: -40, hand: 'open' }, sooty: ding };
  if (ding) { p.armR = { x: 130, y: -30, hand: 'open', front: true }; p.shake = pulse(tq, K.ding, 4) * 4; }
  mug(p);
  if (ding) { const off = [[-40, 0], [18, -30], [58, 10], [-8, -60], [30, -85]]; off.forEach(([ox, oy], i) => { const u = seg(tq, K.ding + i * .07, K.ding + .75 + i * .05); if (u > 0 && u < 1) puff(TX - 180 + ox + Math.sin(u * 5 + i) * 10, CY - 280 + oy - u * 150, (14 + i * 3) * (1 + u * 1.3) * (1 - u * .3), i % 2 ? P.dmid : P.mid); }); }
}

// —— 橱柜 + 水槽（同一张竖长背景，下摇）——
function plateState(i, tq) {
  // 返回 {x,y,rot,press,gone}
  const [x, y] = PLATES[i];
  if (tq >= K.crash) { const d = tq - K.crash - (6 - i) * .05; if (d > 0) { return { x: x - d * 120 * (i % 2 ? 1 : -.6), y: y + 600 * d * d + 60 * d, rot: d * (i % 2 ? 4 : -5), press: 0 }; } }
  let press = 0;
  const tc = K.plateCube(i), tm = K.plateMug(i);
  press += pulse(tq, tc, 14) * .5 + pulse(tq, tm, 9) * 1.2;
  const wob = tq > K.plateMug(0) && tq < K.crash ? Math.sin(tq * 26 + i) * .03 * clamp((tq - tm) * 2 + .5, 0, 1) : 0;
  return { x, y, rot: wob, press };
}
function cubeInCupboard(tq) {
  // 返回 {x,y,sx,sy,turn,visible}
  if (tq < K.plateCube(0)) { const u = seg(tq, K.fallIn, K.plateCube(0)); return { x: PLATES[0][0], y: lerp(PLATES[0][1] - 420, PLATES[0][1] - 8, u * u), sy: 1.2, sx: .85, turn: 30, air: true }; }
  for (let i = 1; i <= 6; i++) if (tq < K.plateCube(i)) { const u = seg(tq, K.plateCube(i - 1), K.plateCube(i)); const a = PLATES[i - 1], b = PLATES[i]; return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u) - 8 + hop(u, 50), turn: 40, air: true, sy: 1.1, sx: .92 }; }
  if (tq < K.leap) return { x: PLATES[6][0], y: PLATES[6][1] - 8, turn: -30, taunt: true };
  const hk = LADLE.hook, bw = LADLE.bowl, top = [lerp(hk[0], bw[0], .08), lerp(hk[1], bw[1], .08)];
  if (tq < K.slide[0]) { const u = seg(tq, K.leap, K.slide[0]); return { x: lerp(PLATES[6][0], top[0], u), y: lerp(PLATES[6][1] - 8, top[1] - 6, u) + hop(u, 60), turn: 40, air: true, sy: 1.2, sx: .85 }; }
  if (tq < K.slide[1]) { const u = ei(seg(tq, K.slide[0], K.slide[1])); return { x: lerp(top[0], bw[0] - 10, u), y: lerp(top[1], bw[1] - 30, u) - 6, turn: 40, slide: true }; }
  const u = seg(tq, K.slide[1], K.splash);
  return { x: lerp(bw[0] - 10, 1010, u), y: lerp(bw[1] - 36, 1800, u * u) + hop(u, 160) * (1 - u), turn: 20, air: true, fall: true, sy: 1.15, sx: .88, spin: u * 5 };
}
function ladle(tq) {
  const hk = LADLE.hook, bw = LADLE.bowl, sw = pulse(tq, K.slide[0], 4) * Math.sin((tq - K.slide[0]) * 14) * .08 + breath(tq) * .02;
  push(); translate(hk[0], hk[1]); rotate(sw); translate(-hk[0], -hk[1]);
  shape(ribbon([hk, [lerp(hk[0], bw[0], .5), lerp(hk[1], bw[1], .5)], [bw[0] - 18, bw[1] - 34]], 14, 14), { fill: P.light });
  shape(arc(bw[0], bw[1] - 30, 46, 40, -.2, Math.PI - .2, 16), { fill: P.light, shade: () => shape(rect(bw[0] + 8, bw[1] - 60, 60, 90), { fill: P.mid, stroke: false, boil: 0 }) });
  pop();
}
function plateLerp(f) { f = clamp(f, 0, 6); const i = Math.min(5, Math.floor(f)), u = ss(f - i); return [lerp(PLATES[i][0], PLATES[i + 1][0], u), lerp(PLATES[i][1], PLATES[i + 1][1], u)]; }
function clampCam(c) { const hw = 960 / c.z, hh = 540 / c.z; return { x: clamp(c.x, hw, 1440 - hw), y: clamp(c.y, -200 + hh, 2400 - hh), z: c.z }; }
function cupCam(t) {
  if (t < K.mugHand) { const [x, y] = plateLerp((t - K.plateCube(0)) / (BEAT / 2)); return clampCam({ x: x + 40, y: y - 80, z: 2.3 }); }
  if (t < K.cubeSpot) { const [x, y] = plateLerp((t - K.plateMug(0)) / BEAT); return clampCam({ x: x + 60, y: y - 140, z: 1.6 }); }
  const u = eio(seg(t, K.tilt[0], K.tilt[1])), c0 = { x: 1040, y: 480, z: 1.45 }, c1 = { x: 720, y: 1740, z: 1 };
  return clampCam({ x: lerp(c0.x, c1.x, u), y: lerp(c0.y, c1.y, u), z: Math.exp(lerp(Math.log(c0.z), Math.log(c1.z), u)) });
}
export function shotCupboard(t) {
  const tq = q(t);
  // 三个中景：A 跟方糖爬楼梯（木琴八分音符）→ B 跟杯子爬（大号四分音符）→ C 顶部：方糖跳勺子、盘子塌 → 下摇到水槽
  const cam = cupCam(t), camY = cam.y;
  setCam(t, BGC, cam);
  const b = breath(tq);
  ladle(tq);
  for (let i = 0; i < 7; i++) { const s = plateState(i, tq); C.plate(s.x, s.y, 1, { press: s.press, rot: s.rot }); }
  // 方糖
  const c = cubeInCupboard(tq), ck = 1.1;
  const cr = cubeRun(tq * 10);
  const cp = { x: c.x, y: c.y, k: ck, turn: c.turn, sx: c.sx || 1, sy: c.sy || 1, eyes: { type: 'wide', lx: -.6 }, mouth: { type: 'o', open: .7 }, brows: 'up', legL: c.air ? { x: -8, y: -10 } : cr.legL, legR: c.air ? { x: 12, y: -16 } : cr.legR, armL: { x: -42, y: -108, hand: 'open', bend: 8 }, armR: { x: 46, y: -112, hand: 'open', bend: -8 } };
  if (c.taunt) {
    const spot = tq >= K.cubeSpot, bb = breath(tq);
    Object.assign(cp, { sy: 1 + bb * .08, sx: 1 - bb * .05, eyes: spot ? { type: 'wide', lx: -1, ly: .6 } : { lid: .45, lx: -.8, ly: .5 }, mouth: spot ? { type: 'wavy', open: .6 } : { type: 'grin', open: .35 }, brows: spot ? 'up' : undefined, legL: { x: -15, y: 0 }, legR: { x: 15, y: 0 },
      armR: spot ? { x: 50, y: -120, hand: 'open' } : { x: 30 + Math.sin(tq * 30) * 4, y: -64, hand: 'open', rot: 0, front: true }, armL: spot ? { x: -50, y: -120, hand: 'open' } : { x: -44, y: -60, hand: 'open', bend: 6 } });
  }
  if (c.slide) Object.assign(cp, { lean: .5, legL: { x: 20, y: -6 }, legR: { x: 30, y: -2 }, eyes: { type: 'happy' }, mouth: { type: 'beam', open: .7 }, armL: { x: -50, y: -126, hand: 'open' }, armR: { x: 40, y: -130, hand: 'open' } });
  if (c.fall) Object.assign(cp, { lean: c.spin, eyes: { type: 'wide' }, mouth: { type: 'wavy', open: .8 } });
  if (tq < K.splash) cube(cp);
  // 马克杯：抓住隔板把自己拽上来 → 踩盘子 → 塌 → 踩盘子滑下
  const mk = .78;
  if (tq >= K.mugHand && tq < K.crash + .75) {
    let x, y, p = { turn: 35, t: tq, eyes: { lx: .8, ly: -.6, lid: .15 }, brows: 'angry', mouth: { type: 'grin', open: .4 }, steam: 'up', ...ARMS };
    const P0 = PLATES[0];
    if (tq < K.mugUp) { x = P0[0] - 150; y = 1260; p.armR = { x: 230, y: -390, hand: 'grab', front: true, bend: -10 }; }
    else if (tq < K.plateMug(0)) { const u = eo(seg(tq, K.mugUp, K.plateMug(0))); x = lerp(P0[0] - 150, P0[0], u); y = lerp(1260, P0[1] - 8, u) + hop(u, 60); p.sy = 1.15; p.armR = { x: 150, y: -250, hand: 'grab', front: true }; }
    else {
      let i = 0; while (i < 6 && tq >= K.plateMug(i + 1)) i++;
      const a = PLATES[i], bn = PLATES[Math.min(6, i + 1)];
      const u = i < 6 ? seg(tq, K.plateMug(i) + .15, K.plateMug(i + 1)) : 0;
      x = lerp(a[0], bn[0], u); y = lerp(a[1], bn[1], u) - 8 + hop(u, 70);
      const land = pulse(tq, K.plateMug(i), 10); p.sy = 1 - land * .15 + (u > 0 && u < 1 ? .08 : 0); p.sx = 1 + land * .1;
      p.armL = { x: -140, y: -170, hand: 'open', bend: 20 }; p.armR = { x: 150, y: -190, hand: 'open', front: true };
      if (tq >= K.plateMug(6)) { p.eyes = { lx: .9, ly: .8 }; p.mouth = { type: 'o' }; p.brows = 'up'; p.turn = 30; }
      if (tq >= K.crash) { // 踩着盘子滑下去
        const d = tq - K.crash, u2 = seg(d, 0, .7), path = Math.min(6, u2 * 6), j = Math.floor(path), f = path - j;
        const A = PLATES[6 - j], B = PLATES[Math.max(0, 5 - j)];
        x = lerp(A[0], B[0], f); y = lerp(A[1], B[1], f) - 22;
        C.plate(x, y + 16, 1, { rot: -.35 });
        Object.assign(p, { turn: -30, lean: -.3, eyes: { type: 'wide', lx: -1 }, mouth: { type: 'o', open: 1 }, steam: 'blown', armL: { x: -170, y: -300, hand: 'open' }, armR: { x: 170, y: -300, hand: 'open' }, legL: { x: -30, y: 0 }, legR: { x: 30, y: 0 } });
      }
    }
    mug({ x, y, k: mk, ...p });
  }
  shotSinkLayer(t, tq, camY);
}

// —— 水槽：漩涡、方糖打转、胳膊伸长 ——
const DRAIN = [BASIN.x, BASIN.y + 14];
const MUGSINK = { x: 230, y: 1810, k: .8 };
const armPath = (() => {
  const sh = [MUGSINK.x + 96 * MUGSINK.k, MUGSINK.y - 150 * MUGSINK.k], pts = [sh, [sh[0] + 90, sh[1] - 90]];
  const ryk = BASIN.ry / BASIN.rx;
  for (let i = 0; i <= 60; i++) { const w = i / 60, r = 340 * (1 - w) + 4, a = Math.PI * 1.02 + w * TAU * 1.35; pts.push([DRAIN[0] + Math.cos(a) * r, DRAIN[1] + Math.sin(a) * r * ryk]); }
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, L, total: L[L.length - 1] };
})();
function armPrefix(f) {
  const len = f * armPath.total, out = [armPath.pts[0]];
  for (let i = 1; i < armPath.pts.length; i++) { if (armPath.L[i] <= len) out.push(armPath.pts[i]); else { const a = armPath.pts[i - 1], b = armPath.pts[i], u = (len - armPath.L[i - 1]) / (armPath.L[i] - armPath.L[i - 1]); out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]); break; } }
  return out;
}
function cubeSpiral(tq) {
  const u = seg(tq, K.splash, K.sink), r = 250 * Math.pow(1 - u, .8), a = -.3 + (tq - K.splash) * 1.8 + u * u * 7;
  return [DRAIN[0] + Math.cos(a) * r, DRAIN[1] + Math.sin(a) * r * BASIN.ry / BASIN.rx - 30 * (1 - u)];
}
function water(tq) {
  const { x, y, rx, ry } = BASIN;
  shape(ell(x, y + 16, rx - 26, ry - 22, 60), { fill: '#9C9991', lw: T.S.lw * .6, shade: () => {
    const rot = tq * 2.4, active = tq >= K.splash ? 1 : .35;
    for (let k = 0; k < 6; k++) { const pts = []; for (let i = 0; i <= 26; i++) { const r = 20 + i * 15, a = rot + k * TAU / 6 + i * .16; pts.push([DRAIN[0] + Math.cos(a) * r, DRAIN[1] + Math.sin(a) * r * ry / rx]); } stroke(pts, T.S.lw * (.5 + active * .4), { line: k % 2 ? P.white : P.light, boil: .6 }); }
  } });
  shape(ell(DRAIN[0], DRAIN[1], 40, 26, 30), { fill: P.dark, lw: T.S.lw * .7 });
}
function drainHole() { shape(ell(DRAIN[0], DRAIN[1], 30, 19, 26), { fill: P.ink, lw: T.S.lw * .6 }); for (let i = -1; i <= 1; i++) stroke([[DRAIN[0] + i * 12, DRAIN[1] - 14], [DRAIN[0] + i * 12, DRAIN[1] + 14]], T.S.lw * .5, { line: P.dmid }); }
function shotSinkLayer(t, tq, camY) {
  if (camY < 1150) return;
  water(tq);
  C.faucet(BASIN.x, 1545, 1.1, breath(tq), { drip: (tq * 60) % 60, ly: .7 });
  // 方糖在漩涡里打转、被吸进下水口
  if (tq >= K.splash && tq < K.sink + .25) {
    const [x, y] = cubeSpiral(tq), sk = 1 - seg(tq, K.sink - .1, K.sink + .25);
    const splash = pulse(tq, K.splash, 5);
    if (splash > .05) for (let i = 0; i < 6; i++) drop(1010 + Math.cos(i) * 60 * (1 - splash) * 2, 1790 - splash * 60 - Math.sin(i * 2) * 30, 7);
    cube({ x, y, k: .78 * sk, turn: (tq * 400) % 360 > 180 ? 30 : -30, lean: Math.sin(tq * 9) * .3, legLen: 10, eyes: { type: 'wide', lx: Math.cos(tq * 5) }, mouth: { type: 'wavy', open: .8 }, brows: 'up', sweat: [[-40, -80, 4]], armL: { x: -44, y: -100, hand: 'open', bend: 8 }, armR: { x: 48, y: -104, hand: 'open', bend: -8 } });
    stroke(arc(x, y - 4, 50 * sk, 12 * sk, 0, Math.PI, 12), T.S.lw * .6, { line: P.white });
  }
  // 马克杯
  if (tq < K.mugLand - .25) return;
  const M = MUGSINK;
  let y = M.y, p = { x: M.x, y, k: M.k, turn: 30, t: tq, ...ARMS, eyes: { lx: .9, ly: .5 }, mouth: { type: 'o' }, brows: 'up', steam: 'up' };
  if (tq < K.mugLand) { const u = seg(tq, K.mugLand - .25, K.mugLand); p.y = lerp(1150, M.y, u * u); p.sy = 1.2; p.armL = { x: -150, y: -280, hand: 'open' }; p.armR = { x: 150, y: -290, hand: 'open' }; p.eyes = { type: 'wide' }; }
  else if (tq < K.worry) { const l = pulse(tq, K.mugLand, 8); p.sy = 1 - l * .2; p.sx = 1 + l * .12; }
  else if (tq < K.reach) { Object.assign(p, { armL: { x: -40, y: -175, hand: 'open', front: true, bend: 10 }, armR: { x: 44, y: -178, hand: 'open', front: true, bend: -10 }, mouth: { type: 'wavy', open: .6 }, shake: 1.5 }); }
  else if (tq < K.recoil) { p.armR = { x: 240, y: -80, hand: 'open', front: true, bend: -20 }; p.lean = .12; p.mouth = { type: 'o' }; }
  else if (tq < K.resolve) { p.armR = { x: 60, y: -170, hand: 'fist', front: true }; p.lean = -.1; p.shake = 2.5; p.mouth = { type: 'wavy', open: .5 }; p.eyes = { type: 'wide', lx: .9, ly: .5 }; }
  else if (tq < K.stretch[0]) { Object.assign(p, { brows: 'angry', mouth: { type: 'grin', open: .25 }, eyes: { lx: 1, ly: .6, lid: .2 }, sy: 1.06, armR: { x: 120, y: -200, hand: 'fist', front: true } }); }
  else {
    // 伸长 → 钻进下水口 → 静音 → 收回
    let f;
    if (tq < K.stretch[1]) f = eio(seg(tq, K.stretch[0], K.stretch[1]));
    else if (tq < K.retract[0]) f = 1 - (tq > K.tug && tq < K.tug + .2 ? .012 : 0);
    else f = lerp(1, .06, eo(seg(tq, K.retract[0], K.retract[1])));
    const done = tq >= K.retract[1];
    Object.assign(p, { brows: 'angry', eyes: { type: tq >= K.silence[0] && tq < K.retract[0] ? 'squeeze' : 'open', lx: 1, ly: .6, side: -1 }, mouth: { type: 'grin', open: .25 }, lean: .1, shake: tq >= K.silence[0] && tq < K.retract[0] ? 1.2 : 0, legL: { x: -50, y: 0, bend: 10 }, legR: { x: 44, y: 0, bend: -8 } });
    if (!done) {
      const pre = armPrefix(f), tip = pre[pre.length - 1], prev = pre[Math.max(0, pre.length - 3)];
      const loc = pre.slice(1, -1).filter((_, i) => i % 2 === 0).map(q => [(q[0] - M.x) / M.k, (q[1] - M.y) / M.k]);
      p.armR = { x: (tip[0] - M.x) / M.k, y: (tip[1] - M.y) / M.k, hand: tq >= K.retract[0] ? 'grab' : 'open', front: true, via: loc.length ? loc : undefined, hk: 1, rot: Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) };
      mug(p);
      if (tq >= K.retract[0]) { cube({ x: tip[0] + 10, y: tip[1] + 20, k: .62, turn: 0, legLen: 16, eyes: { type: 'shut' }, mouth: { type: 'wavy' }, armL: { x: -40, y: -80, hand: 'open' }, armR: { x: 40, y: -80, hand: 'open' } }); for (let i = 0; i < 4; i++) drop(tip[0] - 20 + i * 16, tip[1] + 40 + ((tq * 900 + i * 37) % 80), 6); }
      if (tq < K.retract[0] && f > .95) drainHole();
      return;
    }
    // 收回来了：手里捧着湿淋淋的方糖，两人对视
    Object.assign(p, { lean: 0, shake: 0, brows: undefined, eyes: { lx: .7, ly: -.1, lid: .15 }, mouth: { type: 'smile' }, steam: 'lazy', armR: { x: 150, y: -196, hand: 'grab', front: true, bend: -30 } });
    mug(p);
    const cx = M.x + 162 * M.k, cy2 = M.y - 214 * M.k;
    cube({ x: cx, y: cy2, k: .62, turn: -25, legLen: 18, eyes: { type: (tq % .8) < .1 ? 'shut' : 'wide', lx: -.8, ly: -.4 }, mouth: { type: 'o', open: .5 }, armL: { x: -44, y: -70, hand: 'open' }, armR: { x: 44, y: -70, hand: 'open' } });
    for (let i = 0; i < 3; i++) drop(cx - 20 + i * 20, cy2 + 10 + ((tq * 500 + i * 41) % 90), 5);
    return;
  }
  mug(p);
}

// —— 放下、拍拍、转身（台面，水槽旁）——
export function shotTwo(t) {
  const tq = q(t);
  setCam(t, BGK, { x: 2420, y: 560, z: 1.9 });
  kitchen(tq, {});
  const mx = 2330, turned = tq >= K.turnAway + .09;
  let hand = { x: 150, y: -170 }, cubePos = null;
  if (tq < K.lower) hand = { x: 150, y: -170 };
  else if (tq < K.setDown) { const u = eio(seg(tq, K.lower, K.setDown)); hand = { x: lerp(150, 196, u), y: lerp(-170, -12, u) }; }
  else hand = { x: 196, y: -12 };
  const cubeOnCounter = tq >= K.setDown;
  const cubeX = mx + hand.x + 6, cubeY = cubeOnCounter ? CY : CY + 6 + hand.y - 36;
  // 拍拍
  let pat = null;
  if (tq >= K.pats[0] - .12 && tq < K.turnAway) { const ph = Math.min(1, Math.abs(((tq - K.pats[0]) / (BEAT / 2)) % 1 - .5) * 2); pat = { x: 206, y: -120 + (1 - ph) * 22, hand: 'open', rot: Math.PI / 2, front: true, bend: -40 }; }
  const drip = !cubeOnCounter || tq < K.setDown + .8;
  const cubeSquash = pat ? pulse(tq, K.pats[0], 12) + pulse(tq, K.pats[1], 12) : 0;
  const drawCube = () => cube({ x: cubeX, y: cubeY, k: .95, turn: -30, sy: 1 - cubeSquash * .12, sx: 1 + cubeSquash * .08, eyes: { type: pat && cubeSquash > .3 ? 'shut' : 'open', lx: turned ? -1 : -.7, ly: turned ? 0 : -.7, lid: turned ? .25 : 0 }, brows: turned ? 'sad' : undefined, mouth: { type: turned ? 'flat' : 'o', open: .4 }, armL: { x: -42, y: -60, hand: 'open', bend: 6 }, armR: { x: 42, y: -60, hand: 'open', bend: -6 } });
  if (cubeOnCounter) drawCube();
  const p = { x: mx, y: CY + 6, turn: 30, t: tq, ...ARMS, eyes: { lx: .8, ly: .3, lid: .2 }, mouth: { type: 'smile' }, steam: 'lazy', sy: 1 + breath(tq) * .02 };
  if (!cubeOnCounter) p.armR = { x: hand.x, y: hand.y, hand: 'grab', front: true, bend: -30 };
  else if (pat) p.armR = pat;
  else if (!turned) p.armR = { x: 150, y: -60, hand: 'open', front: true, bend: -20 };
  if (tq >= K.turnAway && !turned) { p.turn = 95; p.eyes = { lx: .3, lid: .4 }; p.mouth = { type: 'frown' }; }
  if (turned) { Object.assign(p, { mirror: true, turn: 155, steam: 'sad', mouth: { type: 'frown' }, ...ARMS }); }
  mug(p);
  if (!cubeOnCounter) drawCube();
  if (drip) for (let i = 0; i < 3; i++) drop(cubeX - 18 + i * 18, cubeY - 20 + ((tq * 400 + i * 33) % 70), 5);
}

// —— 背影走开；前景的方糖犹豫、跳 ——
const LEAVE_CAM = { x: 2300, y: 600, z: 1.35 };
const MUG_STOP = 2150;
function leaveMugX(tq) { return tq < K.walk[0] ? 2330 : lerp(2330, MUG_STOP, seg(tq, K.walk[0], K.walk[1])); }
export function shotLeaving(t) {
  const tq = q(t);
  // 犹豫那一小节：镜头慢慢推近方糖（让眼神来回看读得清）
  const pu = eio(seg(t, bar(21, 3), bar(22, 1.5)));
  setCam(t, BGK, { x: lerp(LEAVE_CAM.x, 2390, pu), y: lerp(LEAVE_CAM.y, 715, pu), z: lerp(LEAVE_CAM.z, 1.7, pu) });
  kitchen(tq, {});
  // 马克杯背影：慢、小起伏
  const mx = leaveMugX(tq), walking = tq < K.walk[1];
  const w = walk((tq - K.walk[0]) / BEAT, { L: 34, lift: 10, bob: 4 });
  const sag = seg(tq, K.sigh, K.sigh + .35);
  const plop = pulse(tq, K.plop, 7);
  const p = { x: mx, y: CY + 6 + (walking ? w.bob : 0), mirror: true, turn: 158, t: tq, steam: tq >= K.plop ? 'none' : 'sad', eyes: { lid: .4 }, mouth: { type: 'frown' },
    armL: { x: -112, y: -18 + (walking ? w.sw * .3 : 0), hand: 'open', bend: 8 }, armR: { x: 112, y: -18 - (walking ? w.sw * .3 : 0), hand: 'open', bend: -8 },
    legL: walking ? w.legL : undefined, legR: walking ? w.legR : undefined, sy: 1 - sag * .07 + plop * .14, sx: 1 + sag * .04 - plop * .06 };
  mug(p);
  if (tq >= K.plop && tq < K.plop + .45) { const u = seg(tq, K.plop, K.plop + .45); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .35; drop(mx + Math.cos(a) * 90 * u, CY - 256 + Math.sin(a) * 110 * u + u * u * 120, 7); } }
  // 叹气：一小团蒸汽
  if (tq >= K.sigh && tq < K.sigh + .6) puff(mx - 30 - seg(tq, K.sigh, K.sigh + .6) * 40, CY - 300 - seg(tq, K.sigh, K.sigh + .6) * 30, 16, P.white);
  // 前景：离镜头更近的一截台面（方糖站在上面）
  T.push(); shape(T.rect(2470, 956, 420, 30), { fill: '#C4C1B8', lw: T.S.lw * .8, boil: .3 }); shape(T.rect(2470, 986, 420, 140), { fill: '#3F3E3A', lw: T.S.lw * .8, boil: .3 }); T.pop();
  // 前景方糖（大一号、靠近镜头）
  if (tq < K.plop) {
    const fx = 2640, fy = 960, fk = 2.0;
    let x = fx, y = fy, k = fk, sy = 1, sx = 1;
    let eyes = { lx: -1, ly: -.2 }, mouthT = { type: 'flat' }, brows = 'sad', lean = 0, arms = { armL: { x: -44, y: -54, hand: 'open', bend: 6 }, armR: { x: 44, y: -54, hand: 'open', bend: -6 } };
    if (tq >= K.lookDown && tq < K.lookUp) eyes = { lx: 0, ly: 1, lid: .3 };
    if (tq >= K.lookUp) eyes = { lx: -1, ly: -.3 };
    if (tq >= K.crouch) { sy = .8; sx = 1.12; brows = undefined; arms = { armL: { x: -50, y: -30, hand: 'fist', bend: 10 }, armR: { x: 50, y: -30, hand: 'fist', bend: -10 } }; }
    const [g1, g2, g3, g4] = K.glances;
    if (tq >= g1) { eyes = { lx: -1, ly: .1 }; lean = .06; }                  // 看杯子背影
    if (tq >= g2) { eyes = { lx: -.6, ly: -1 }; lean = -.12; }                // 抬头看杯口
    if (tq >= g3) { eyes = { lx: -1, ly: .1 }; lean = .06; }
    if (tq >= g4) { eyes = { lx: -.6, ly: -1, lid: .25 }; mouthT = { type: 'grin', open: .4 }; lean = -.12; }
    if (tq >= K.hop && tq < K.launch) { const u = seg(tq, K.hop, K.launch); y = fy + hop(u, 26); sy = u < .8 ? 1.15 : .85; sx = u < .8 ? .9 : 1.1; }
    if (tq >= K.launch) { // 纵身一跳：从前景跳进背景里的杯口（边飞边缩小 = 纵深）
      const u = seg(tq, K.launch, K.plop), tx2 = MUG_STOP + 8, ty2 = CY - 228;
      x = lerp(fx, tx2, u); y = lerp(fy, ty2, u) + hop(u, 110); k = lerp(fk, .8, u); sy = 1.25; sx = .82; lean = -.5 * u; eyes = { type: 'happy' }; mouthT = { type: 'beam', open: .7 };
      arms = { armL: { x: -40, y: -120, hand: 'open' }, armR: { x: 44, y: -124, hand: 'open' } };
    }
    cube({ x, y, k, turn: -32, sy, sx, lean, eyes, mouth: mouthT, brows, ...arms, legL: tq >= K.launch ? { x: -6, y: -12 } : undefined, legR: tq >= K.launch ? { x: 12, y: -18 } : undefined });
  }
}

// —— 叮！甜 ——
export function shotSweet(t) {
  const tq = q(t);
  setCam(t, BGK, { x: MUG_STOP, y: 530, z: 2.3 });
  kitchen(tq, {});
  const ding = tq >= K.dingSweet, sp = ding ? pulse(tq, K.dingSweet, 5) : 0;
  const smack = !ding && tq >= K.smack && Math.floor((tq - K.smack) * 12) % 2 === 0;
  const p = { x: MUG_STOP, y: CY + 6, turn: 0, t: tq, ...ARMS, eyes: ding ? { type: 'happy' } : { lx: 0, ly: -.9 }, mouth: ding ? { type: 'beam', open: .75 } : { type: smack ? 'o' : 'flat', open: .5 }, steam: ding ? 'heart' : 'none', blush: ding,
    sy: 1 + sp * .16 * Math.cos((tq - K.dingSweet) * 25), sx: 1 - sp * .08 * Math.cos((tq - K.dingSweet) * 25) };
  if (ding) { p.armL = { x: -170, y: -250, hand: 'open', bend: 20 }; p.armR = { x: 170, y: -250, hand: 'open', bend: -20 }; }
  if (tq >= K.popUp) p.inCup = () => { const u = eo(seg(tq, K.popUp, K.popUp + .2)); cube({ x: -26, y: -226 - (1 - u) * -60, k: 1.15, turn: 0, legLen: 0, towel: true, eyes: { type: 'happy' }, mouth: { type: 'smile' }, armL: { x: -64, y: -100, hand: 'wave', bend: 8 } }); };
  p.steamX = 60;
  mug(p);
  if (ding && tq < K.dingSweet + .8) { const u = seg(tq, K.dingSweet, K.dingSweet + .8); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; star(MUG_STOP + Math.cos(a) * (150 + u * 90), CY - 180 + Math.sin(a) * (130 + u * 70), 16 * (1 - u * .6), u * 3); } }
}

// —— 高潮：全厨房同拍起舞（中全景，前景塞满跳舞的物件）——
// 三种舞步：24 小节左右摇摆 → 25 小节踢腿 → 26 小节一起下蹲弹起 → 26.4 全体定格亮相（保持到 iris 关上）
function move(t) {
  const tq = q(t), bt = beats(tq) - beats(bar(24));
  if (tq >= bar(26, 4)) return { step: 'pose', lean: 0, dx: 0, sy: 1.04, hop: 0, kick: 0, side: 0, freeze: 1 };
  if (tq < bar(25)) { const c = Math.cos(Math.PI * bt); return { step: 'sway', lean: .2 * c, dx: 16 * c, sy: 1, hop: 0, kick: 0, side: c > 0 ? 1 : -1 }; }
  if (tq < bar(26)) { const c = Math.cos(Math.PI * bt); return { step: 'kick', lean: -.06 * c, dx: 0, sy: 1, hop: -(1 - Math.abs(Math.sin(Math.PI * bt))) * 10, kick: Math.abs(c), side: c > 0 ? 1 : -1 }; }
  const v = Math.cos(2 * Math.PI * bt);
  return { step: 'bounce', lean: 0, dx: 0, sy: 1 - .2 * Math.max(0, v), hop: -Math.max(0, -v) * 46, kick: 0, side: 0 };
}
// 通用舞者包装：绕脚底摇摆、蹲、跳
function dancer(x, y, m, fn, amp = 1) {
  push(); translate(x + m.dx * amp, y + m.hop * amp); rotate(m.lean * amp); scale(1 + (1 - m.sy) * .6, m.sy); translate(-x, -y); fn(); pop();
}
function danceMug(t, x) {
  const tq = q(t), m = move(t), bt = beats(tq);
  const up = m.side > 0;
  const p = { x: x + m.dx, y: CY + 6 + m.hop, turn: m.step === 'sway' ? 18 * m.side : 0, t: tq, lean: m.lean * .7, eyes: { type: 'happy' }, mouth: { type: 'beam', open: .75 }, steam: 'heart', steamX: 60, blush: true,
    sy: m.sy * (m.freeze ? 1.04 : 1 + breath(tq) * .04), sx: 1 + (1 - m.sy) * .5 };
  if (m.step === 'sway') { p.armL = { x: -170, y: up ? -290 : -170, hand: 'open', bend: 24 }; p.armR = { x: 170, y: up ? -170 : -290, hand: 'open', bend: -24 }; }
  if (m.step === 'kick') { const k = m.kick; p.legL = up ? { x: -150 - k * 50, y: -k * 100, dir: -1, ang: .7 * k, bend: -20 } : { x: -26, y: 0 }; p.legR = !up ? { x: 150 + k * 50, y: -k * 100, dir: 1, ang: -.7 * k, bend: 20 } : { x: 26, y: 0 }; p.armL = { x: -190, y: -120, hand: 'open', bend: 20 }; p.armR = { x: 190, y: -120, hand: 'open', bend: -20 }; }
  if (m.step === 'bounce') { const c = m.sy < .95; p.armL = { x: -170, y: c ? -60 : -280, hand: c ? 'fist' : 'open', bend: 24 }; p.armR = { x: 170, y: c ? -60 : -280, hand: c ? 'fist' : 'open', bend: -24 }; p.legL = { x: c ? -52 : -26, y: 0 }; p.legR = { x: c ? 52 : 26, y: 0 }; }
  if (m.freeze) { p.armL = { x: -210, y: -330, hand: 'open', bend: 30 }; p.armR = { x: 210, y: -330, hand: 'open', bend: -30 }; p.legL = { x: -46, y: 0 }; p.legR = { x: 70, y: -8, dir: 1, ang: -.3 }; p.mouth = { type: 'beam', open: .9 }; }
  const cubeUp = m.freeze || (m.step === 'sway' ? up : (m.step === 'bounce' ? m.sy > .95 : true));
  p.inCup = () => cube({ x: -26, y: -226, k: 1.15, turn: m.step === 'sway' ? -18 * m.side : 0, legLen: 0, towel: true, lean: m.lean * .6, eyes: { type: 'happy' }, mouth: { type: 'beam', open: .6 },
    armL: { x: -66, y: cubeUp ? -120 : -70, hand: 'wave', bend: 8 }, armR: { x: 66, y: (m.freeze || !up) ? -120 : -70, hand: 'wave', bend: -8 } });
  mug(p);
}
function shakerDancer(x, y, k, pepper, m, b) {
  const up = m.side > 0;
  const kick = m.step === 'kick' ? m.kick : 0;
  const legL = (pepper ? !up : up) && kick > .05 ? { x: -12 - kick * 16, y: -kick * 30 } : { x: -12, y: 0 };
  const legR = (pepper ? up : !up) && kick > .05 ? { x: 12 + kick * 16, y: -kick * 30 } : { x: 12, y: 0 };
  dancer(x, y, m, () => C.shaker(x, y, k, m.freeze ? 0 : (pepper ? -b : b), { pepper, eyes: 'happy', mouth: 'grin', legL, legR }));
}
function saucepan(x, y, k, m, b) {   // 会跳舞的小锅（锅把当胳膊甩）
  dancer(x, y, m, () => {
    push(); translate(x, y); scale(k);
    const L = m.step === 'kick' && m.side > 0 ? { x: -30, y: -26 * m.kick } : { x: -20, y: 0 }, R = m.step === 'kick' && m.side < 0 ? { x: 30, y: -26 * m.kick } : { x: 20, y: 0 };
    shape(noodleL(-14, -20, L.x, L.y - 4), { fill: P.ink, lw: T.S.lw * .8 }); shape(noodleL(14, -20, R.x, R.y - 4), { fill: P.ink, lw: T.S.lw * .8 });
    shoeK(L.x - 3, L.y, -1); shoeK(R.x + 3, R.y, 1);
    shape(rr(50, -96, 90, 16, 8).map(p => [p[0], p[1] + (m.side || 0) * -8]), { fill: P.dark });
    shape(spline([[-56, -100], [56, -100], [52, -30], [30, -18], [-30, -18], [-52, -30]], true, 5), { fill: P.mid, shade: () => shape(rect(-44, -110, 16, 100), { fill: P.light, stroke: false, boil: 0 }) });
    shape(ell(0, -100, 56, 10), { fill: P.dark });
    const lid = 12 + Math.max(0, b) * 16 * (m.freeze ? 0 : 1); shape(ell(0, -104 - lid, 50, 9), { fill: P.light }); shape(ell(0, -112 - lid, 8, 6), { fill: P.dark });
    for (const ex of [-14, 14]) { shape(ell(ex, -64, 9, 12), { fill: P.white, lw: T.S.lw * .6 }); stroke(arc(ex, -60, 7, 6, Math.PI * 1.1, Math.PI * 1.9, 8), T.S.lw * .9); }
    shape([...arc(0, -44, 14, 10, 0, Math.PI, 10)], { fill: P.ink, lw: T.S.lw * .6 });
    pop();
  });
}
const noodleL = (ax, ay, bx, by) => _noodle([ax, ay], [bx, by], 3, 8, 8);
const shoeK = (x, y, d) => _shoe(x, y, d, .5);
const CAM_DANCE = { x: 2150, y: 610, z: 1.12 };
const FG_Y = 1000;   // 前景台面（离镜头更近的一排舞者）
function danceCam(t) {
  const u = eio(seg(t, K.pull[0], K.pull[0] + 1.1));
  return { x: lerp(MUG_STOP, CAM_DANCE.x, u), y: lerp(530, CAM_DANCE.y, u), z: Math.exp(lerp(Math.log(2.3), Math.log(CAM_DANCE.z), u)) };
}
function danceStage(t, cam) {
  const tq = q(t), m = move(t), b = m.freeze ? 0 : breath(tq) * 3;
  setCam(t, BGK, cam, m.freeze ? 0 : breath(tq) * .025);
  // 背景层：窗帘、挂锅、烤面包机、水龙头（都随拍）
  dancer(1760, 470, { ...m, hop: 0, dx: 0 }, () => C.windowCurtain(1760, 470, .9, m.freeze ? 1 : b), .4);
  POS.hooks2.forEach((x, i) => C.hanging(x, 330, .8, ['pan', 'ladle', 'pot'][i], m.freeze ? 0 : (m.step === 'sway' ? m.lean * 1.4 : b * .1) * (i % 2 ? -1 : 1)));
  POS.hooks1.forEach((x, i) => C.hanging(x, 330, .8, ['pot', 'pan', 'ladle'][i], m.freeze ? 0 : (m.step === 'sway' ? m.lean * 1.4 : b * .1) * (i % 2 ? 1 : -1)));
  dancer(POS.toaster, CY + 4, m, () => C.toaster(POS.toaster, CY + 4, .9, b * .3, { eyes: 'happy', mouth: 'grin', toast: m.step === 'bounce' ? Math.max(0, -Math.cos(2 * Math.PI * beats(tq))) * 70 : (m.freeze ? 50 : 0), lx: 0 }));
  dancer(SINK_X, CY - 2, m, () => C.faucet(SINK_X, CY - 2, .9, b * .3, { spin: beats(tq) * Math.PI * .5, eyes: 'happy', mouth: 'grin', drip: (tq * 60) % 40 }));
  dancer(2420, CY + 4, m, () => C.sugarBowl(2420, CY + 4, .9, 0, { lid: m.freeze ? 1.2 : .3 + Math.max(0, b / 3) * .9 }));
  // 中间：杯子和方糖
  danceMug(t, MUG_STOP);
  // 前景台面 + 前景舞者（大一号）
  shape(T.rect(1300, FG_Y, 1800, 28), { fill: '#C4C1B8', lw: T.S.lw * .8, boil: .3 }); shape(T.rect(1300, FG_Y + 28, 1800, 200), { fill: '#3F3E3A', lw: T.S.lw * .8, boil: .3 });
  dancer(1600, FG_Y + 4, m, () => C.clock(1600, FG_Y + 4, 1.55, m.freeze ? 0 : b / 3, { eyes: 'happy', mouth: 'grin', ring: m.step === 'bounce' && m.sy < .95 ? .6 : 0, t: tq }));
  shakerDancer(1775, FG_Y + 4, 1.8, false, m, b / 3); shakerDancer(1880, FG_Y + 4, 1.8, true, m, b / 3);
  saucepan(2450, FG_Y + 4, 1.6, m, b / 3);
  dancer(2690, FG_Y + 4, m, () => { C.hanging(2690, FG_Y - 290, 1.4, 'pan', m.freeze ? 0 : m.lean * 1.2 + b * .03); });
}
export function shotDance(t) { danceStage(t, danceCam(t)); }

// —— iris：收拢到杯子上；方糖的小手伸出来把 iris 拉上 ——
export function shotIris(t) {
  const tq = q(t);
  const u = eio(seg(t, K.irisClose[0], K.irisClose[0] + 1.2));
  const cam = { x: lerp(CAM_DANCE.x, MUG_STOP, u), y: lerp(CAM_DANCE.y, 520, u), z: Math.exp(lerp(Math.log(CAM_DANCE.z), Math.log(1.45), u)) };
  danceStage(t, cam);
  // 圆心 = 杯口附近（屏幕坐标）
  const cx = 960 + (MUG_STOP - cam.x) * cam.z, cy = 540 + (CY - 200 - cam.y) * cam.z;
  let r;
  if (t < K.handOut) r = lerp(1250, 175, eio(seg(t, K.irisClose[0], K.handOut)));
  else if (t < K.grab + .15) r = 175;
  else r = 175 * (1 - ei(seg(t, K.grab + .15, K.shut)));
  const g = sg; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#050505'; g.beginPath(); g.rect(0, 0, 1920, 1080); g.arc(cx, cy, Math.max(0, r), 0, TAU, true); g.fill('evenodd'); g.restore();
  // 小手：从洞口伸出来、抓住边、往里拉
  if (t >= K.handOut && t < K.shut + .05) {
    T.BASE.splice(0, 6, 1, 0, 0, 1, 0, 0); T.frame(t);
    const ang = -.75, reach = t < K.grab ? eo(seg(t, K.handOut, K.grab)) : 1;
    const hx = cx + Math.cos(ang) * (r - 30 + reach * 34), hy = cy + Math.sin(ang) * (r - 30 + reach * 34);
    const bx = cx + Math.cos(ang) * (r * .35), by = cy + Math.sin(ang) * (r * .35);
    shape(ribbon([[bx, by], [hx, hy]], 22, 22), { fill: P.ink, lw: T.S.lw * .8 });
    glove(hx, hy, ang, t < K.grab ? 'open' : 'grab', 2.3);
  }
}

// —— 片尾卡 ——
export function shotEnd(t) {
  const g = sg, tq = q(t), bt = beats(tq);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080);
  g.translate(960, 540); g.rotate(-t * .2);
  for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#8A877F' : '#C4C1B8'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1400, i / 24 * TAU, (i + 1) / 24 * TAU); g.fill(); }
  g.restore();
  g.save(); const bb = Math.cos(bt * TAU); g.translate(960, 540); g.scale(1 - bb * .008, 1 + bb * .012); g.translate(-960, -540);
  // 波浪形标牌
  g.fillStyle = '#F4F1EA'; g.strokeStyle = P.ink; g.lineWidth = 9; g.beginPath();
  const x0 = 470, x1 = 1450, y0 = 300, y1 = 790; g.moveTo(x0, y0);
  for (let x = x0; x <= x1; x += 10) g.lineTo(x, y0 + Math.sin((x - x0) / (x1 - x0) * TAU * 3) * 14);
  for (let x = x1; x >= x0; x -= 10) g.lineTo(x, y1 + Math.sin((x - x0) / (x1 - x0) * TAU * 3 + Math.PI) * 14);
  g.closePath(); g.fill(); g.stroke();
  const hopL = i => -(Math.max(0, Math.cos((bt - i * .15) * Math.PI)) ** 6) * 22;
  fatTitle(g, 'The End', 960, 470, 170, { bounce: hopL });
  g.fillStyle = P.ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '38px Limelight'; g.fillText('RUBBER  HOSE  ·  1930s  CARTOON  STYLE', 960, 650);
  g.font = '40px "IM Fell English SC"'; g.fillText('LemoLab  ×  Claude Opus 5.5', 960, 722);
  g.restore();
  g.save(); g.fillStyle = '#F4F1EA'; g.strokeStyle = 'rgba(10,10,8,.85)'; g.lineWidth = 5; g.font = '22px "IM Fell English SC"'; g.textAlign = 'center';
  const cr = ['Original score & sound made in code  ·  Samples: VSCO 2 CE, VCSL (CC0)  ·  Voice: Kokoro TTS', 'Drums: "MuldjordKit" by Lars Muldjord (drumgizmo.org), CC BY 4.0  ·  Fonts: Shrikhand, Limelight, IM Fell English SC (OFL)'];
  cr.forEach((s, i) => { g.strokeText(s, 960, 960 + i * 32); g.fillText(s, 960, 960 + i * 32); }); g.restore();
  // 从黑里 iris 打开
  const r = 1250 * eo(seg(t, K.end, K.end + .45));
  if (r < 1250) { g.save(); g.fillStyle = '#050505'; g.beginPath(); g.rect(0, 0, 1920, 1080); g.arc(960, 540, r, 0, TAU, true); g.fill('evenodd'); g.restore(); }
}

// —— 字卡（画在场景画布上，跟着片门一起抖）——
export function subtitles(t) {
  for (const [t0, t1, text, pos] of SUBS) {
    if (t < t0 || t >= t1) continue;
    subPlate(sg, text, 960, pos === 't' ? 96 : 986, { size: 36 });
  }
}
