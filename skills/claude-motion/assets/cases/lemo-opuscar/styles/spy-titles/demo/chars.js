// 剪纸角色：特工 THE AGENT、信使 THE COURIER、黄铜钥匙。四肢是分开的纸片，关节处有切缝（Anatomy 断肢语法）
// 坐标：脚底中点为原点，y 向下，面朝 +x。s = 缩放（1 = 特工约 540px 高）
import { g, C, piece, roughC, rough, smooth, circP, ellP, xf, S, curScale, silhouette, slit } from './paper.js';
// 包一层剪影图层（已在图层里就直接画）
function cutPoly(pts) { g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = '#000'; g.fill(); g.restore(); }
function sil(fn, opt) { if (S.inLayer) return fn(); let r; silhouette(() => { r = fn(); }, opt || {}); return r; }

const R = Math;
// 锥形肢体（骨骼沿 +y，关节在原点）
function limbP(len, w0, w1, cap0 = .5, cap1 = .5) {
  const a = w0 / 2, b = w1 / 2;
  return smooth([[-a, -a * cap0], [0, -a * cap0 * 1.6], [a, -a * cap0], [b * 1.05, len * .55], [b, len], [0, len + b * cap1 * 1.4], [-b, len], [-a * 1.05, len * .45]], 1);
}
function P(key, fn, seed, amp = 1.3, step = 9) { return roughC(key, fn, seed, amp, step); }
// 在当前变换上画一块纸片
function part(poly, col, tx, ty, rot, opt) { g.save(); g.translate(tx, ty); g.rotate(rot); piece(poly, col, opt); g.restore(); }

// ═══════════════ THE AGENT ═══════════════
const AG = {
  hipY: -282, torso: 168, thigh: 136, shin: 132, uarm: 112, farm: 96,
  shoulder: [2, -150],
};
const agJacket = () => [[-40, 46], [-30, -8], [-32, -96], [-30, -148], [-16, -170], [10, -178], [25, -170], [22, -152], [42, -128], [44, -92], [30, -26], [38, 22], [34, 40], [6, 36], [-12, 28], [-26, 50]];
const agHead = () => [[-12, 6], [-13, -12], [-22, -24], [-31, -46], [-26, -70], [-6, -82], [16, -78], [27, -64], [30, -52], [27, -47], [31, -43], [44, -33], [44, -30], [31, -28], [33, -23], [29, -20], [32, -16], [26, -7], [15, -2], [10, 6]];
const agBrim = () => [[-42, -63], [-22, -69], [14, -73], [44, -74], [55, -69], [48, -64], [18, -63], [-10, -61], [-34, -58]];
const agCrown = () => smooth([[-27, -70], [-25, -93], [-15, -104], [-2, -98], [9, -104], [22, -99], [29, -72]], 1);
const agFoot = () => [[-13, -8], [-15, 9], [44, 11], [56, 7], [44, -3], [16, -9]];
const agHand = () => [[-7, -3], [8, -3], [8, 16], [2, 36], [-5, 21]];
const agCollar = () => [[16, -170], [27, -164], [22, -150]];

// 领带：锚点 + 飘动（fly 0 = 垂在胸前，1 = 向后平飘）
function tiePoly(fly, ph, len = 96 + R.abs(fly) * 18) {
  let x = 0, y = 0; const n = 10, L = [], Rr = [];
  const base = .1 + fly * 1.45;   // a>0 把领带摆向身后（−x）
  for (let i = 0; i <= n; i++) {
    const u = i / n, w = i === n ? .5 : (7 - 2.2 * u) * (1 + .12 * R.sin(ph * 1.3 + u * 7));
    const a = base + R.sin(ph + u * 5.5) * (.1 + R.abs(fly) * .5) * u;
    const dx = -R.sin(a), dy = R.cos(a);
    if (i > 0) { x += dx * len / n; y += dy * len / n; }
    L.push([x + dy * w, y - dx * w]); Rr.push([x - dy * w, y + dx * w]);
  }
  return { body: L.concat(Rr.reverse()), knot: [[-6, -4], [6, -4], [4, 7], [-4, 7]] };
}

export const AGENT_POSE = {
  stand: { lean: 0, bob: 0, head: 0, thF: .04, knF: .02, ftF: 0, thB: -.04, knB: .02, ftB: 0, shF: .05, elF: .12, shB: -.04, elB: .1, tie: 0, tph: 0 },
};
// 跑步循环（p ∈ [0,1)，一个完整循环 = 两步）
export function runPose(p, o = {}) {
  const f = p * R.PI * 2;
  const leg = (q) => {
    const s = R.sin(q), c = R.cos(q);
    const th = .18 + .78 * s;                          // 大腿前后摆
    const kn = .12 + 1.5 * R.pow(R.max(0, R.sin(q + 2.1)), 1.4) + .15 * R.max(0, -s); // 摆动相收小腿
    const ft = -.05 + .7 * R.max(0, R.sin(q + 2.6));    // 蹬地时脚尖下压
    return [th, kn, ft];
  };
  const [thF, knF, ftF] = leg(f), [thB, knB, ftB] = leg(f + R.PI);
  return {
    lean: o.lean ?? .3, bob: -14 * R.abs(R.cos(f)) + 6, head: -.12,
    thF, knF, ftF, thB, knB, ftB,
    shF: .1 - .72 * R.sin(f), elF: 1.7 + .2 * R.sin(f), shB: .1 + .72 * R.sin(f), elB: 1.7 - .2 * R.sin(f),
    tie: o.tie ?? .72, tph: f * 1.3,
  };
}
AGENT_POSE.flatten = { lean: -.03, bob: -6, head: -.12, thF: .02, knF: 0, ftF: .55, thB: -.02, knB: 0, ftB: .55, shF: -.08, elF: -.05, shB: -.1, elB: -.05, tie: -.95, tph: 1.2, eye: 'peek', suck: 1 };
AGENT_POSE.skid = { lean: -.42, bob: 34, head: .2, thF: 1.05, knF: .05, ftF: -.45, thB: .1, knB: 1.55, ftB: .2, shF: -1.4, elF: .4, shB: -1.9, elB: .5, tie: .1, tph: 1, tieFwd: 1 };
AGENT_POSE.overShoulder = { lean: -.05, bob: 0, head: 0, thF: .3, knF: .2, ftF: 0, thB: -.2, knB: .35, ftB: 0, shF: .4, elF: .9, shB: -.3, elB: .4, tie: .15, tph: 2, headFlip: true, eye: 'open' };
AGENT_POSE.leap = { lean: .38, bob: -30, head: -.15, thF: 1.3, knF: 1.25, ftF: .1, thB: -.95, knB: .55, ftB: .5, shF: 1.95, elF: .35, shB: -1.25, elB: .45, tie: 1.05, tph: 3 };
AGENT_POSE.reach = { lean: .15, bob: -40, head: -.5, thF: .5, knF: 1.4, ftF: .2, thB: -.4, knB: 1.2, ftB: .4, shF: 2.9, elF: .1, shB: .6, elB: 1.2, tie: 1.0, tph: 4, eye: 'open' };

export function agentSide(x, y, s, pose, opt = {}) { return sil(() => agentSideRaw(x, y, s, pose, opt), opt.sil); }
function agentSideRaw(x, y, s, pose, opt = {}) {
  const p = { ...AGENT_POSE.stand, ...pose };
  g.save(); g.translate(x, y); g.scale(s * (opt.flip ? -1 : 1), s);
  const ink = opt.col || C.ink;
  const hip = [0, AG.hipY + p.bob];
  const leanR = p.lean;
  // 躯干局部 → 世界
  const T = (px, py) => [hip[0] + px * R.cos(leanR) - py * R.sin(leanR), hip[1] + px * R.sin(leanR) + py * R.cos(leanR)];
  const sh = T(AG.shoulder[0], AG.shoulder[1]);
  const neck = T(12, -170);
  const legAt = (th, kn, ft, key) => {
    const knee = [hip[0] + R.sin(th) * AG.thigh, hip[1] + R.cos(th) * AG.thigh];
    const sa = th - kn;
    const ank = [knee[0] + R.sin(sa) * AG.shin, knee[1] + R.cos(sa) * AG.shin];
    part(P('agThigh', () => limbP(AG.thigh, 32, 21), 11), ink, hip[0], hip[1], -th);
    part(P('agShin', () => limbP(AG.shin, 21, 14), 12), ink, knee[0], knee[1], -sa);
    part(P('agFoot', agFoot, 13), ink, ank[0], ank[1], -sa + ft);
    slit(knee[0], knee[1], -sa, 30);                                                   // 膝
    if (key === 'F') slit(hip[0] + R.sin(th) * 44, hip[1] + R.cos(th) * 44, -th, 38);  // 髋（衣摆下沿）
  };
  const armAt = (shA, el, key, front) => {
    const elb = [sh[0] + R.sin(shA) * AG.uarm, sh[1] + R.cos(shA) * AG.uarm];
    const fa = shA + el;
    const wr = [elb[0] + R.sin(fa) * AG.farm, elb[1] + R.cos(fa) * AG.farm];
    part(P('agUarm', () => limbP(AG.uarm, 26, 19), 21), ink, sh[0], sh[1], -shA);
    part(P('agFarm', () => limbP(AG.farm, 19, 15), 22), ink, elb[0], elb[1], -fa);
    part(P('agHand', agHand, 24), ink, wr[0] + R.sin(fa) * 4, wr[1] + R.cos(fa) * 4, -fa);
    if (front) {   // 近侧：衬衫袖口（纸白一条）、肩缝
      part(P('agCuff', () => [[-8, -2], [8, -2], [8, 3], [-8, 3]], 23, .5), C.paper, wr[0], wr[1], -fa);
      slit(sh[0] + R.sin(shA) * 10, sh[1] + R.cos(shA) * 10, -shA, 30);
    }
    slit(elb[0], elb[1], -fa, 24);                                                      // 肘
    return wr;
  };
  // 远侧（稍暗一点的墨 = 叠在后面的纸）
  const far = opt.farCol || ink;
  S._ink = ink;
  armAt(p.shB, p.elB, 'B', false);
  { const c0 = ink; legAt(p.thB, p.knB, p.ftB, 'B'); }
  // 躯干
  g.save(); g.translate(hip[0], hip[1]); g.rotate(leanR);
  if (p.suck) g.scale(.86, 1);
  piece(P('agJacket', agJacket, 31), ink);
  piece(P('agCollar', agCollar, 32, .5), C.paper, { gap: 0, shadow: false });
  g.restore();
  // 头 + 帽（头颈接在领口）
  g.save(); g.translate(neck[0], neck[1]); g.rotate(p.head + leanR * .4); if (p.headFlip) g.scale(-1, 1);
  piece(P('agHead', agHead, 41, 1.0, 7), ink);
  if (p.eye || opt.eye) {
    const e = p.eye || opt.eye;
    const ey = e === 'peek' ? [[16, -52], [26, -54], [25, -50], [16, -49]] : [[15, -53], [25, -55], [24, -49], [15, -48]];
    piece(ey, C.paper, { gap: 0, shadow: false });
  }
  piece(P('agBrim', agBrim, 42, .9, 7), ink);
  piece(P('agCrown', agCrown, 43, 1.0, 7), ink);
  g.save(); g.translate(1, -71.5); g.rotate(-.035); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(-27, -1.1, 56, 2.2); g.restore();   // 帽带缝
  g.restore();
  // 近侧腿
  legAt(p.thF, p.knF, p.ftF, 'F');
  // 领带（红）
  const ta = T(27, -160);
  g.save(); g.translate(ta[0], ta[1]); g.rotate(leanR * (1 - p.tie * .6));
  const tp = tiePoly(p.tie, p.tph);
  piece(rough(tp.body, 51, .6, 6), C.red);
  piece(tp.knot, C.red);
  g.restore();
  // 近侧手臂
  const wr = armAt(p.shF, p.elF, 'F', true);
  g.restore();
  return { wrist: [x + wr[0] * s * (opt.flip ? -1 : 1), y + wr[1] * s] };
}

// 正面 / 背面（只在设定表用；片中永远侧面）
export function agentFront(x, y, s, back = false) { return sil(() => agentFrontRaw(x, y, s, back)); }
function agentFrontRaw(x, y, s, back) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const ink = C.ink;
  // 腿
  piece(P('agLegL', () => [[-30, -262], [-4, -262], [-6, -14], [-24, -14]], 61), ink);
  piece(P('agLegR', () => [[4, -262], [30, -262], [24, -14], [6, -14]], 62), ink);
  piece(P('agShoeL', () => smooth([[-28, -16], [-4, -16], [-2, 2], [-34, 2]], 1), 63), ink);
  piece(P('agShoeR', () => smooth([[4, -16], [28, -16], [34, 2], [2, 2]], 1), 64), ink);
  // 手臂
  // 外套
  piece(P('agJacketF', () => [[-60, -412], [-20, -430], [20, -430], [60, -412], [48, -330], [40, -262], [44, -220], [-44, -220], [-40, -262], [-48, -330]], 67), ink);
  piece(P('agArmL', () => smooth([[-62, -410], [-44, -404], [-50, -262], [-58, -228], [-72, -232], [-70, -300]], 1), 65), ink, { cut: 1.6 });
  piece(P('agArmR', () => smooth([[62, -410], [44, -404], [50, -262], [58, -228], [72, -232], [70, -300]], 1), 66), ink, { cut: 1.6 });
  if (!back) {
    // V 领：衬衫 + 红领带
    piece(P('agShirt', () => [[-16, -428], [16, -428], [0, -318]], 68, .6), C.paper, { gap: 0, shadow: false });
    piece(P('agTieF', () => [[-4, -424], [4, -424], [7, -330], [0, -312], [-7, -330]], 69, .5), C.red, { gap: 1.2, shadow: false });
    piece(P('agBtn', () => circP(0, -284, 4, 10), 70, .3), C.paper, { gap: 0, shadow: false });
  } else {
    // 后开衩
    cutPoly([[-1.5, -270], [1.5, -270], [2, -220], [-2, -220]]);
  }
  // 头（正面：窄椭圆 + 耳）
  piece(P('agNeckF', () => [[-10, -440], [10, -440], [11, -424], [-11, -424]], 72), ink);
  piece(P('agHeadF', () => smooth([[-22, -478], [-19, -500], [0, -508], [19, -500], [22, -478], [18, -455], [8, -440], [-8, -440], [-18, -455]], 1), 73, .9, 7), ink);
  piece(P('agEarL', () => ellP(-22, -474, 3.5, 7, 12), 74, .4), ink);
  piece(P('agEarR', () => ellP(22, -474, 3.5, 7, 12), 75, .4), ink);
  if (!back) { piece([[-14, -479], [-5, -480], [-5, -476], [-14, -475]], C.paper, { gap: 0, shadow: false }); piece([[5, -480], [14, -479], [14, -475], [5, -476]], C.paper, { gap: 0, shadow: false }); }
  // 帽：宽檐 + 冠（帽带缝）
  piece(P('agBrimF', () => smooth([[-50, -500], [0, -506], [50, -500], [46, -492], [0, -496], [-46, -492]], 1), 76, .8, 7), ink);
  piece(P('agCrownF', () => smooth([[-27, -503], [-24, -530], [-8, -536], [0, -530], [8, -536], [24, -530], [27, -503]], 1), 77, .9, 7), ink);
  g.restore();
}

// ═══════════════ THE COURIER ═══════════════
const CO = { hipY: -300, thigh: 142, shin: 138, uarm: 118, farm: 108 };
function coatPoly(flare, ph) {
  // flare: 0 静止（A 字）… 1 奔跑（后摆飞起）
  const bx = -78 - flare * 70, by = 150 - flare * 70;
  const fx = 62 + R.sin(ph) * 6 * flare, fy = 150 - flare * 10;
  return smooth([[30, -232], [44, -212], [46, -150], [42, -60], [fx, fy], [(fx + bx) * .5 + 8, (fy + by) * .5 + 6 + flare * 18], [bx, by], [-42, -90], [-40, -180], [-30, -222], [-22, -250], [-6, -232], [14, -238]], 1);
}
const coHead = () => [[-14, 4], [-18, -16], [-26, -34], [-24, -62], [-6, -76], [16, -72], [26, -58], [30, -46], [40, -34], [30, -28], [26, -14], [14, -4], [10, 4]];
const coBrim = () => [[-66, -70], [-30, -76], [30, -78], [82, -76], [84, -70], [30, -68], [-30, -66], [-64, -64]];
const coCrown = () => [[-30, -74], [-27, -104], [-4, -108], [22, -106], [28, -76]];
const coGlove = () => [[-10, -3], [11, -3], [12, 18], [3, 40], [-7, 24]];
const coShoe = () => [[-12, -8], [-14, 9], [40, 11], [50, 6], [38, -3], [14, -9]];

export const COURIER_POSE = {
  stand: { lean: 0, bob: 0, head: 0, thF: .03, knF: 0, ftF: 0, thB: -.03, knB: 0, ftB: 0, shF: .1, elF: .15, shB: -.05, elB: .1, flare: 0, ph: 0, key: 0 },
  lookBack: { lean: -.04, bob: 0, head: 0, thF: .1, knF: .05, ftF: 0, thB: -.12, knB: .1, ftB: 0, shF: .15, elF: .3, shB: -.1, elB: .2, flare: .05, ph: 0, key: .25, headFlip: true },
};
export function walkPose(p, o = {}) {
  const f = p * R.PI * 2;
  const leg = q => { const s = R.sin(q); return [.02 + .42 * s, .1 + .7 * R.pow(R.max(0, R.sin(q + 1.7)), 2), -.05 + .3 * R.max(0, R.sin(q + 2.4))]; };
  const [thF, knF, ftF] = leg(f), [thB, knB, ftB] = leg(f + R.PI);
  return { lean: o.lean ?? .06, bob: -6 * R.abs(R.cos(f)) + 3, head: 0, thF, knF, ftF, thB, knB, ftB, shF: .05 - .45 * R.sin(f), elF: .35, shB: .05 + .45 * R.sin(f), elB: .35, flare: o.flare ?? .12, ph: f, key: R.sin(f + .8) * .5 };
}
export function coRunPose(p) { const q = runPose(p, { lean: .28 }); return { ...q, flare: .95, ph: p * R.PI * 4, key: R.sin(p * R.PI * 2 + 1) * .9 - .6, tie: undefined }; }

export function courierSide(x, y, s, pose, opt = {}) { return sil(() => courierSideRaw(x, y, s, pose, opt), opt.sil); }
function courierSideRaw(x, y, s, pose, opt = {}) {
  const p = { ...COURIER_POSE.stand, ...pose };
  g.save(); g.translate(x, y); g.scale(s * (opt.flip ? -1 : 1), s);
  const ink = C.ink;
  const hip = [0, CO.hipY + p.bob], L = p.lean;
  const T = (px, py) => [hip[0] + px * R.cos(L) - py * R.sin(L), hip[1] + px * R.sin(L) + py * R.cos(L)];
  const sh = T(4, -190), neck = T(8, -236);
  const legAt = (th, kn, ft) => {
    const knee = [hip[0] + R.sin(th) * CO.thigh, hip[1] + R.cos(th) * CO.thigh], sa = th - kn;
    const ank = [knee[0] + R.sin(sa) * CO.shin, knee[1] + R.cos(sa) * CO.shin];
    part(P('coThigh', () => limbP(CO.thigh, 30, 22), 111), ink, hip[0], hip[1], -th);
    part(P('coShin', () => limbP(CO.shin, 20, 14), 112), ink, knee[0], knee[1], -sa);
    part(P('coShoe', coShoe, 113), ink, ank[0], ank[1], -sa + ft);
    slit(knee[0], knee[1], -sa, 26);
  };
  let wristF = null;
  const armAt = (shA, el, front) => {
    const elb = [sh[0] + R.sin(shA) * CO.uarm, sh[1] + R.cos(shA) * CO.uarm], fa = shA + el;
    const wr = [elb[0] + R.sin(fa) * CO.farm, elb[1] + R.cos(fa) * CO.farm];
    part(P('coUarm', () => limbP(CO.uarm, 36, 30), 121), ink, sh[0], sh[1], -shA);
    part(P('coFarm', () => limbP(CO.farm, 30, 24), 122), ink, elb[0], elb[1], -fa);
    part(P('coGlove', coGlove, 123), ink, wr[0] + R.sin(fa) * 3, wr[1] + R.cos(fa) * 3, -fa);
    if (front) { slit(elb[0], elb[1], -fa, 32); slit(sh[0] + R.sin(shA) * 12, sh[1] + R.cos(shA) * 12, -shA, 40); slit(wr[0], wr[1], -fa, 26); }
    return wr;
  };
  armAt(p.shB, p.elB, false);
  legAt(p.thB, p.knB, p.ftB);
  legAt(p.thF, p.knF, p.ftF);
  // 风衣（奔跑时后摆翻出红内衬）
  g.save(); g.translate(hip[0], hip[1]); g.rotate(L);
  if (p.flare > .3) {   // 后摆翻起露出的红内衬（画在风衣下面，只露出后摆下沿的一条）
    const k = (p.flare - .3) / .7, bx = -78 - p.flare * 70, by = 150 - p.flare * 70;
    piece(rough([[-24, 60], [bx - 4, by + 2], [bx + 26, by + 34 * k], [-18, 150 - k * 6]], 131, 1.0, 9), C.red, { gap: 0 });
  }
  piece(rough(coatPoly(p.flare, p.ph), 132, 1.3, 9), ink);
  // 腰带（一道切缝）
  g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(-40, -91); g.lineTo(44, -95); g.lineTo(44, -92); g.lineTo(-40, -88); g.closePath(); g.fillStyle = '#000'; g.fill(); g.restore();
  g.restore();
  // 头 + 竖领 + 宽檐帽
  g.save(); g.translate(neck[0], neck[1]); g.rotate(p.head + L * .5); if (p.headFlip) g.scale(-1, 1);
  piece(P('coHead', coHead, 141, 1.0, 7), ink);
  piece([[14, -52], [27, -54], [26, -49], [14, -47]], C.paper, { gap: 0, shadow: false });   // 眼缝
  piece(P('coCollar', () => [[-24, 8], [-30, -40], [-12, -18], [4, -6], [22, -30], [30, 6]], 142, 1.0, 7), ink);
  piece(P('coBrim', coBrim, 143, .9, 7), ink);
  piece(P('coCrown', coCrown, 144, 1.0, 7), ink);
  g.restore();
  // 近侧手臂 + 手腕上的钥匙链
  const wr = armAt(p.shF, p.elF, true);
  if (!opt.noKey) {
    const ka = p.key || 0;
    const chainL = 46;
    const kx = wr[0] + R.sin(ka) * chainL, ky = wr[1] + 20 + R.cos(ka) * chainL;
    // 链环
    for (let i = 1; i <= 5; i++) { const u = i / 6; const cx = wr[0] + (kx - wr[0]) * u, cy = wr[1] + 20 + (ky - wr[1] - 20) * u; piece(ellP(cx, cy, 3.2, 4.6, 10, ka), C.mus, { gap: 1.2, shadow: false }); }
    key(kx, ky, .62, -ka);
  }
  g.restore();
}
export function courierFront(x, y, s) { return sil(() => courierFrontRaw(x, y, s)); }
function courierFrontRaw(x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const ink = C.ink;
  piece(P('coLegLF', () => [[-26, -170], [-6, -170], [-8, -14], [-22, -14]], 151), ink);
  piece(P('coLegRF', () => [[6, -170], [26, -170], [22, -14], [8, -14]], 152), ink);
  piece(P('coShoeLF', () => smooth([[-26, -16], [-6, -16], [-4, 2], [-32, 2]], 1), 153), ink);
  piece(P('coShoeRF', () => smooth([[6, -16], [26, -16], [32, 2], [4, 2]], 1), 154), ink);
  piece(P('coArmLF', () => smooth([[-70, -500], [-52, -490], [-66, -330], [-70, -292], [-90, -296], [-88, -380]], 1), 155), ink);
  piece(P('coArmRF', () => smooth([[70, -500], [52, -490], [66, -330], [70, -292], [90, -296], [88, -380]], 1), 156), ink);
  piece(P('coCoatF', () => [[-72, -500], [-30, -528], [30, -528], [72, -500], [66, -380], [100, -150], [-100, -150]], 157), ink);
  cutPoly([[-1.5, -470], [1.5, -470], [2, -150], [-2, -150]]);
  cutPoly([[-66, -392], [66, -392], [67, -384], [-67, -384]]);
  piece(P('coCollarF', () => [[-46, -548], [-22, -600], [-10, -540], [0, -528], [10, -540], [22, -600], [46, -548], [30, -510], [-30, -510]], 158), ink);
  piece(P('coHeadF', () => smooth([[-22, -596], [-18, -620], [0, -628], [18, -620], [22, -596], [14, -566], [-14, -566]], 1), 159, .9, 7), ink);
  piece([[-15, -600], [-5, -601], [-5, -597], [-15, -596]], C.paper, { gap: 0, shadow: false });
  piece([[5, -601], [15, -600], [15, -596], [5, -597]], C.paper, { gap: 0, shadow: false });
  piece(P('coBrimF', () => smooth([[-82, -612], [0, -620], [82, -612], [78, -604], [0, -608], [-78, -604]], 1), 160, .8, 7), ink);
  piece(P('coCrownF', () => [[-30, -616], [-28, -648], [28, -648], [30, -616]], 161, .9, 7), ink);
  // 钥匙挂在右手腕
  for (let i = 1; i <= 5; i++) piece(ellP(82 + i * 1.5, -290 + i * 9, 3.2, 4.6, 10), C.mus, { gap: 1.2, shadow: false });
  key(92, -228, .62, .12);
  g.restore();
}

// ═══════════════ 黄铜钥匙 ═══════════════
// 原点 = 圆头中心，钥匙杆沿 +y；外轮廓 ≈ 片名 I 的钥匙孔（圆 + 下宽的竖）
export const KEY = { r: 26, len: 118 };
export function key(x, y, s = 1, rot = 0, opt = {}) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const out = P('keyOut', () => {
    const r = KEY.r, pts = [];
    for (let i = 0; i <= 30; i++) { const a = R.PI * .5 + .36 + i / 30 * (R.PI * 2 - .72); pts.push([R.cos(a) * r, R.sin(a) * r]); }
    const t = R.sin(.36) * r; // 杆半宽 ≈ 9
    return pts.concat([[t, 72], [15, 76], [15, 88], [11, 90], [11, 96], [19, 100], [19, 114], [6, 118], [-6, 118], [-19, 114], [-19, 100], [-11, 96], [-11, 90], [-15, 88], [-15, 76], [-t, 72]]);
  }, 171, .7, 6);
  const hole = P('keyHole', () => circP(0, -4, 7, 16).slice(0), 172, .3, 4);
  const holeStem = [[-3, 0], [3, 0], [5, 12], [-5, 12]];
  // 墨黑衬底（钥匙贴在一块黑纸上 = 描边）
  g.save(); g.lineJoin = 'round'; g.lineWidth = (opt.line ?? 3.2) * 2 / curScale();
  g.beginPath(); for (let i = 0; i < out.length; i++) i ? g.lineTo(out[i][0], out[i][1]) : g.moveTo(out[i][0], out[i][1]); g.closePath();
  g.strokeStyle = C.ink; if (opt.line !== 0) g.stroke(); g.restore();
  piece([out, hole], opt.col || C.mus, { gap: 0, shadow: opt.shadow ?? true });
  piece(holeStem, C.ink, { gap: 0, shadow: false });
  // 一道高光（纸白细条）
  piece([[-4, 26], [-2, 26], [-2, 66], [-4, 66]], 'rgba(255,245,210,.55)', { gap: 0, shadow: false });
  g.restore();
}

// 钥匙孔（= 片名 CIPHER 的 I）：圆 + 下宽的竖；比例与钥匙匹配（钥匙放进去四周留一道缝）
export function keyholeP(k = 1) {
  const r = 31 * k, o = [];
  const a0 = Math.asin(12.5 / 31);
  for (let i = 0; i <= 32; i++) { const a = Math.PI / 2 + a0 + i / 32 * (Math.PI * 2 - 2 * a0); o.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return o.concat([[12.5 * k, 60 * k], [23.5 * k, 123 * k], [-23.5 * k, 123 * k], [-12.5 * k, 60 * k]]).map(([x, y], i, arr) => [x, y]);
}
