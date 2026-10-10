// 角色：骑车的人（高瘦、圆眼镜、大鼻子、条纹毛衣、长围巾）+ 老式城市自行车 + 鸽子 + 法棍
// 颜色都是分版浓度 [蓝, 黄, 粉]。只开蓝版时他是一个完整的蓝色剪影；每加一版，他身上多一种颜色。
import { g, circle, ellipse, rect, rrect, poly, blob, line, curve, ring, limb, ik, lerp2, rot2, inkA, over } from './draw.js';

export const PAL = {
  skin: [0, .26, .0], skinSh: [.1, .42, .3], cheek: [0, .08, .62],
  hair: [1, 0, .22], glass: [1, 0, .25], eye: [1, 0, .3], mouth: [.9, 0, .55],
  stripeA: [.4, 0, 1], stripeB: [.4, 0, 1], sweaterSh: [.66, 0, 1], rib: [.55, 0, .85],
  trousers: [.75, 1, 0], trousersSh: [1, 1, .15],
  shoe: [1, 0, .4], sock: [0, .55, .5],
  scarf: [0, 1, 1], scarfSh: [.12, 1, 1], scarfRib: [0, .75, 1],
  frame: [.72, 0, 1], tire: [1, 0, .55], rim: [.55, 0, .2], spoke: [.6, 0, .15], metal: [.35, 0, 0],
  saddle: [.9, .5, .7], basket: [.3, .7, .3], weave: [1, .45, .25],
  bread: [0, 1, .38], breadSh: [.12, 1, .72], breadIn: [0, .35, .12],
  pigeon: [.42, 0, .06], pigeonSh: [1, 0, .3], pigeonNeck: [.5, .3, .9], pigeonWing: [.6, 0, .12], beak: [0, .5, .8], pigeonEye: [0, 1, .9],
};
const P = PAL;

// 骨长（单位：比例 1 时像素）
export const L = { thigh: 124, shin: 118, ankleH: 12, torso: 142, upper: 88, fore: 84, headR: 29 };

// ───────── 头 ─────────
// view: side | q | front | back（均朝右；朝左用外层镜像）  expr: calm | sleepy | surprise | joy | look | blink | yawn
export function head(x, y, s, view = 'side', expr = 'calm', o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s); if (o.tilt) g.rotate(o.tilt);
  const R = 29;
  if (view === 'side') {
    blob([[0, -30], [18, -28], [26, -17], [27, -7], [33, -3], [46, 8], [42, 13], [30, 13], [29, 20], [23, 28], [9, 33], [-8, 29], [-22, 19], [-29, 1], [-25, -19]], P.skin);
    ellipse(-5, 3, 6, 8, 0, P.skinSh);
    circle(10, 11, 7, P.cheek);
    blob([[-29, 12], [-32, -8], [-27, -27], [-10, -37], [10, -37], [26, -33], [36, -27], [28, -22], [18, -22], [10, -19], [3, -20], [0, -11], [2, -1], [-4, -4], [-11, -1], [-14, 10], [-21, 16]], P.hair);
    face('side', expr, o);
  } else if (view === 'q') {
    blob([[-26, -18], [-8, -31], [14, -29], [26, -17], [28, -4], [38, 8], [28, 12], [26, 22], [14, 32], [-4, 31], [-20, 22], [-29, 4]], P.skin);
    ellipse(-20, 4, 5.5, 8, 0, P.skinSh);
    circle(21, 13, 6.5, P.cheek); circle(-6, 13, 5, P.cheek);
    blob([[-29, 10], [-32, -10], [-24, -30], [-4, -39], [18, -37], [32, -30], [38, -22], [26, -20], [14, -18], [4, -21], [-8, -18], [-14, -8], [-15, 4], [-22, 14]], P.hair);
    face('q', expr, o);
  } else if (view === 'front') {
    ellipse(-29, 3, 5.5, 8, 0, P.skinSh); ellipse(29, 3, 5.5, 8, 0, P.skinSh);
    blob([[-27, -16], [-14, -30], [14, -30], [27, -16], [28, 4], [22, 22], [9, 32], [-9, 32], [-22, 22], [-28, 4]], P.skin);
    circle(-15, 14, 6.5, P.cheek); circle(15, 14, 6.5, P.cheek);
    blob([[-29, 4], [-31, -16], [-20, -33], [0, -39], [22, -36], [33, -25], [30, -12], [26, -18], [14, -19], [4, -16], [-6, -20], [-16, -17], [-24, -8], [-25, 6]], P.hair);
    face('front', expr, o);
  } else { // back
    ellipse(-29, 3, 5.5, 8, 0, P.skinSh); ellipse(29, 3, 5.5, 8, 0, P.skinSh);
    blob([[-27, -16], [-14, -30], [14, -30], [27, -16], [28, 4], [22, 22], [9, 30], [-9, 30], [-22, 22], [-28, 4]], P.skin);
    blob([[-30, 6], [-31, -16], [-20, -33], [0, -38], [22, -35], [32, -18], [30, 4], [22, 16], [8, 20], [-8, 20], [-22, 16]], P.hair);
    line([[-12, -38], [-4, -44], [2, -39]], 5, P.hair);
  }
  g.restore();
}
function face(view, expr, o) {
  const eyes = view === 'side' ? [[16, -4, 10]] : view === 'q' ? [[17, -3, 10.5], [-5, -3, 8]] : [[-13, -3, 10], [13, -3, 10]];
  const lw = 3.6;
  const bounce = expr === 'surprise' ? -5 : 0;
  // 眼睛
  for (const [ex, ey0, r] of eyes) {
    const ey = ey0 + bounce * .6;
    if (expr === 'joy') line([[ex - 4.5, ey + 1.5], [ex, ey - 3], [ex + 4.5, ey + 1.5]], 3, P.eye);
    else if (expr === 'blink') line([[ex - 4, ey + 1], [ex + 4, ey + 1]], 3, P.eye);
    else if (expr === 'sleepy' || expr === 'yawn') { line([[ex - 4.5, ey + .5], [ex + 4.5, ey + .5]], 3, P.eye); circle(ex + .5, ey + 2.5, 2.2, P.eye); }
    else circle(ex + (view === 'side' ? 1.5 : 0) + (o.lookX || 0), ey + (o.lookY || 0), expr === 'surprise' ? 3.8 : 3.1, P.eye);
  }
  // 眼镜（惊讶时往上跳一下）
  g.save(); g.translate(0, bounce);
  for (const [ex, ey, r] of eyes) ring(ex, ey, r, lw, P.glass);
  if (view === 'side') line([[6, -5], [-4, -3]], 3, P.glass);
  else if (view === 'q') line([[6.5, -3], [3, -3]], 3, P.glass), line([[-13, -4], [-19, -3]], 3, P.glass);
  else line([[-3, -4], [3, -4]], 3, P.glass);
  g.restore();
  // 眉毛
  const by = expr === 'surprise' ? -22 : expr === 'sleepy' ? -14 : -17;
  if (view === 'side') line([[10, by + 1], [24, by]], 3.4, P.hair);
  else if (view === 'q') { line([[10, by], [24, by - 1]], 3.4, P.hair); line([[-10, by], [-1, by - 1]], 3.2, P.hair); }
  else { line([[-20, by], [-7, by - 1]], 3.4, P.hair); line([[7, by - 1], [20, by]], 3.4, P.hair); }
  // 鼻（正/3/4 面）
  if (view === 'front') curve([[-1, 2], [-3, 10], [2, 11]], 2.6, P.skinSh);
  // 嘴
  const mx = view === 'side' ? 24 : view === 'q' ? 17 : 0, my = view === 'side' ? 22 : 21;
  if (expr === 'surprise' || expr === 'yawn') ellipse(mx + (view === 'side' ? 1 : 0), my + 1, view === 'side' ? 3.5 : 4.5, expr === 'yawn' ? 6.5 : 5, 0, P.mouth);
  else if (expr === 'joy') { g.beginPath(); g.moveTo(mx - 7, my - 2); g.quadraticCurveTo(mx, my + 10, mx + 7, my - 2); g.closePath(); g.fillStyle = inkA(P.mouth); g.fill(); }
  else if (view === 'side') curve([[mx - 3, my - 1], [mx + 1, my + 1.5], [mx + 5, my - 1.5]], 2.8, P.mouth);
  else curve([[mx - 6, my - 1], [mx, my + 2.5], [mx + 6, my - 1]], 2.8, P.mouth);
}

// ───────── 侧面身体（按关节画）─────────
// J: { hip, sh, head:[x,y], elbowN, wristN, elbowF, wristF, kneeN, ankleN, toeN, kneeF, ankleF, toeF }（N=近侧 F=远侧）
export function scarf(J, ph, amt = 1, o = {}) {
  const n = [J.sh[0] + 10, J.sh[1] - 22];
  // 围巾绕脖子一圈
  rrect(n[0] - 26, n[1] - 8, 48, 24, 11, P.scarf);
  for (let k = 0; k < 5; k++) line([[n[0] - 18 + k * 9, n[1] - 5], [n[0] - 20 + k * 9, n[1] + 13]], 2.5, P.scarfRib);
  // 飘带（向后）
  const pts = [], pts2 = [];
  const len = 150 * amt, back = o.dir || -1;
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const wv = Math.sin(ph * 9 - u * 5.5) * (6 + 18 * u) * amt;
    pts.push([n[0] - 6 + back * len * u * 1.0, n[1] + 6 + u * 26 * (1.3 - amt) + wv]);
    pts2.push([n[0] - 10 + back * len * u * .78, n[1] + 10 + u * 34 * (1.3 - amt) + Math.sin(ph * 9 - u * 5 + 1.7) * (5 + 14 * u) * amt]);
  }
  curve(pts2, 17, P.scarfSh);
  curve(pts, 20, P.scarf);
  // 流苏
  for (const pp of [pts, pts2]) { const e = pp[pp.length - 1], e2 = pp[pp.length - 2], a = Math.atan2(e[1] - e2[1], e[0] - e2[0]);
    for (let k = -2; k <= 2; k++) { const ox = -Math.sin(a) * k * 4, oy = Math.cos(a) * k * 4; line([[e[0] + ox, e[1] + oy], [e[0] + ox + Math.cos(a) * 14, e[1] + oy + Math.sin(a) * 14 + 3]], 2.5, P.scarfSh); } }
}
function foot(ankle, toe, c) {
  const a = Math.atan2(toe[1] - ankle[1], toe[0] - ankle[0]);
  g.save(); g.translate(ankle[0], ankle[1]); g.rotate(a);
  blob([[-10, -9], [8, -9], [30, -3], [33, 6], [-9, 8], [-13, 0]], c);
  g.restore();
}
export function torsoSide(hip, sh, o = {}) {
  const ax = sh[0] - hip[0], ay = sh[1] - hip[1], Lt = Math.hypot(ax, ay), a = Math.atan2(ay, ax) + Math.PI / 2;
  g.save(); g.translate(hip[0], hip[1]); g.rotate(a);
  // 局部：y 负向 = 朝肩；x 正 = 前
  const pts = [[-22, 6], [-25, -Lt * .45], [-22, -Lt + 6], [-8, -Lt - 6], [16, -Lt - 3], [26, -Lt * .72], [27, -Lt * .35], [23, 6]];
  blob(pts, P.stripeB);
  g.save(); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const n = pts.length;
  let s0 = m(pts[n - 1], pts[0]); g.beginPath(); g.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = m(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  g.closePath(); g.clip();
  g.fillStyle = inkA(P.stripeA);
  g.fillStyle = inkA(P.rib); g.fillRect(-40, -10, 80, 18);
  g.fillStyle = inkA(P.sweaterSh); for (let xx = -24; xx < 30; xx += 7) g.fillRect(xx, -10, 2.5, 18);
  g.restore();
  g.restore();
}
export function figureSide(J, o = {}) {
  const sleeve = [P.stripeA, P.stripeB, 13, 0];
  const legW = 31, armW = 25;
  // 远侧臂、远侧腿
  if (!o.noFarArm) { limb(J.sh, J.elbowF, armW, P.sweaterSh); limb(J.elbowF, J.wristF, armW - 3, P.sweaterSh); circle(J.wristF[0], J.wristF[1], 10, P.skinSh); }
  limb(J.hip, J.kneeF, legW, P.trousersSh); limb(J.kneeF, J.ankleF, legW - 4, P.trousersSh);
  line([J.ankleF, lerp2(J.ankleF, J.kneeF, .12)], 20, P.sock);
  foot(J.ankleF, J.toeF, P.shoe);
  if (o.between) o.between();
  // 躯干
  torsoSide(J.hip, J.sh);
  // 近侧腿
  limb(J.hip, J.kneeN, legW, P.trousers); limb(J.kneeN, J.ankleN, legW - 4, P.trousers);
  line([J.ankleN, lerp2(J.ankleN, J.kneeN, .12)], 20, P.sock);
  foot(J.ankleN, J.toeN, P.shoe);
  if (o.afterLegs) o.afterLegs();
  // 围巾 + 头
  if (!o.noScarf) scarf(J, o.ph || 0, o.scarfAmt ?? .6, o);
  if (o.headFlip) { g.save(); g.translate(J.head[0], J.head[1]); g.scale(-1, 1); head(0, 0, 1, o.view || 'side', o.expr || 'calm', o.headO || {}); g.restore(); }
  else head(J.head[0], J.head[1], 1, o.view || 'side', o.expr || 'calm', o.headO || {});
  if (o.afterHead) o.afterHead();
  // 近侧臂
  limb(J.sh, J.elbowN, armW, null, sleeve); limb(J.elbowN, J.wristN, armW - 3, null, [P.stripeA, P.stripeB, 13, 4]);
  if (o.hand) o.hand(J.wristN); else circle(J.wristN[0], J.wristN[1], 10.5, P.skin);
}

// ───────── 站姿（侧面）─────────
export function poseStandSide(o = {}) {
  const hip = [0, -(L.thigh + L.shin + L.ankleH)];
  const sh = [4, hip[1] - L.torso];
  const J = { hip, sh, head: [sh[0] + 10, sh[1] - 52] };
  J.kneeN = [hip[0] + 6, hip[1] + L.thigh]; J.ankleN = [4, -L.ankleH]; J.toeN = [30, -2];
  J.kneeF = [hip[0] - 2, hip[1] + L.thigh]; J.ankleF = [-10, -L.ankleH]; J.toeF = [16, -2];
  const sw = o.armSwing || 0;
  J.elbowN = [sh[0] + Math.sin(sw) * 30, sh[1] + 84]; J.wristN = [sh[0] + Math.sin(sw) * 60 + 8, sh[1] + 164];
  J.elbowF = [sh[0] - 6, sh[1] + 84]; J.wristF = [sh[0] - 2, sh[1] + 166];
  return J;
}

// ───────── 自行车 ─────────
export const BIKE = { Rw: 96, R: [-165, -96], F: [165, -96], BB: [-20, -88], crank: 36, seat: [-84, -274], grip: [42, -306] };
function wheel(c, a, o = {}) {
  const [x, y] = c, R = BIKE.Rw;
  ring(x, y, R - 7, 13, P.tire);
  ring(x, y, R - 16, 3.5, P.rim);
  for (let i = 0; i < 12; i++) { const t = a + i * Math.PI / 6; line([[x + Math.cos(t) * 8, y + Math.sin(t) * 8], [x + Math.cos(t + .25) * (R - 16), y + Math.sin(t + .25) * (R - 16)]], 1.8, P.spoke); }
  circle(x, y, 9, P.metal); circle(x, y, 4, P.frame);
}
export function bikeBack(crank, wa) {       // 车后层：远侧曲柄/踏板、两个轮子
  const B = BIKE;
  const pf = [B.BB[0] + Math.cos(crank + Math.PI) * B.crank, B.BB[1] + Math.sin(crank + Math.PI) * B.crank];
  line([B.BB, pf], 9, P.metal); rrect(pf[0] - 13, pf[1] - 4, 26, 8, 3, P.metal);
  wheel(B.R, wa); wheel(B.F, wa);
}
export function bikeFrame(o = {}) {
  const B = BIKE, fw = 14;
  // 挡泥板
  g.lineCap = 'round';
  g.beginPath(); g.arc(B.R[0], B.R[1], B.Rw + 8, Math.PI * 1.05, Math.PI * 1.85); g.lineWidth = 7; g.strokeStyle = inkA(P.frame); g.stroke();
  g.beginPath(); g.arc(B.F[0], B.F[1], B.Rw + 8, Math.PI * 1.15, Math.PI * 1.95); g.stroke();
  // 车架
  const st = [-72, -238], ht = [116, -246], hb = [126, -204];
  line([B.BB, B.R], fw - 3, P.frame); line([st, B.R], fw - 4, P.frame);
  line([B.BB, [-80, -262]], fw, P.frame);
  line([st, ht], fw, P.frame); line([B.BB, hb], fw, P.frame);
  line([[112, -262], hb], fw + 3, P.frame);
  curve([hb, [146, -150], [B.F[0], B.F[1]]], fw - 3, P.frame);
  // 链罩
  blob([[-40, -110], [-150, -112], [-176, -96], [-150, -78], [-30, -66], [-4, -88]], P.frame);
  // 座杆 + 车座
  line([[-80, -262], B.seat], 7, P.metal);
  blob([[-118, -284], [-60, -284], [-50, -276], [-70, -268], [-114, -268]], P.saddle);
  // 把立 + 车把
  line([[112, -262], [108, -296]], 8, P.metal);
  curve([[108, -296], [92, -304], [64, -306], B.grip], 8, P.metal);
  // 车铃
  if (!o.noBell) { circle(94, -313, 9, P.metal); circle(94, -313, 5, P.frame); }
  // 车筐（前）
  if (!o.noBasket) basket(o);
  // 前灯
  circle(142, -228, 8, P.metal);
}
export function basket(o = {}) {
  const x0 = 138, x1 = 236, y0 = -302, y1 = -222;
  if (o.inBasket) o.inBasket();  // 篮内物（法棍从筐里伸出）
  poly([[x0, y0], [x1, y0 - 4], [x1 - 8, y1], [x0 + 8, y1]], P.basket);
  for (let yy = y0 + 12; yy < y1; yy += 14) line([[x0 + 4, yy], [x1 - 4, yy - 3]], 3, P.weave);
  for (let xx = x0 + 16; xx < x1 - 4; xx += 18) line([[xx, y0 + 2], [xx + 2, y1 - 2]], 2.5, P.weave);
  line([[x0 - 2, y0], [x1 + 3, y0 - 5]], 6, P.weave);
}
export function crankFront(crank) {
  const B = BIKE;
  circle(B.BB[0], B.BB[1], 25, P.metal); circle(B.BB[0], B.BB[1], 18, P.frame); circle(B.BB[0], B.BB[1], 6, P.metal);
  const pn = [B.BB[0] + Math.cos(crank) * B.crank, B.BB[1] + Math.sin(crank) * B.crank];
  line([B.BB, pn], 9, P.metal); rrect(pn[0] - 13, pn[1] - 4, 26, 8, 3, P.metal);
}

// 骑车姿势：返回关节
export function posePedal(crank, o = {}) {
  const B = BIKE, lean = o.lean ?? .2;
  const hip = o.hip || [B.seat[0] - 4, B.seat[1] - 16 + (o.bob || 0)];
  const sh = [hip[0] + Math.sin(lean) * L.torso, hip[1] - Math.cos(lean) * L.torso];
  const J = { hip, sh, head: [sh[0] + 14 + (o.headDX || 0), sh[1] - 50 + (o.headDY || 0)] };
  const legs = (a, key) => {
    const p = [B.BB[0] + Math.cos(a) * B.crank, B.BB[1] + Math.sin(a) * B.crank];
    const ank = [p[0] - 5, p[1] - 12];
    const [k, e] = ik(hip, ank, L.thigh, L.shin, -1);
    J['knee' + key] = k; J['ankle' + key] = e; J['toe' + key] = [e[0] + 26, e[1] + 10];
  };
  legs(crank, 'N'); legs(crank + Math.PI, 'F');
  if (o.footDown) {   // 单脚撑地（近侧脚落到地面）
    const fd = o.footDown, ank = [fd[0], fd[1] - L.ankleH];
    const [k, e] = ik(hip, ank, L.thigh, L.shin, -1); J.kneeN = k; J.ankleN = e; J.toeN = [e[0] + 28, e[1] + 10];
  }
  const grip = o.grip || B.grip;
  const [eN, wN] = ik(sh, grip, L.upper, L.fore, 1); J.elbowN = eN; J.wristN = wN;
  const [eF, wF] = ik([sh[0] - 4, sh[1] + 2], o.gripF || [grip[0] - 6, grip[1] - 2], L.upper, L.fore, 1); J.elbowF = eF; J.wristF = wF;
  return J;
}
// 整车 + 人（朝右，原点 = 两轮中间的地面）。o: crank, wa(轮转角), lean, expr, view, ph(围巾相位), armN(近侧手目标), inBasket
export function riderBike(x, y, s, o = {}) {
  const crank = o.crank || 0, wa = o.wa ?? crank * 1.6;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
  const J = posePedal(crank, o);
  if (o.armN) { const [e, w] = ik(J.sh, o.armN, L.upper, L.fore, o.armBend ?? 1); J.elbowN = e; J.wristN = w; }
  if (o.shadow !== false) { g.save(); over(() => { g.beginPath(); g.ellipse(0, 4, 250, 12, 0, 0, Math.PI * 2); g.fillStyle = inkA(o.shadowC || [.35, 0, 0]); g.fill(); }); g.restore(); }
  if (o.noRider) { bikeBack(crank, wa); bikeFrame(o); crankFront(crank); g.restore(); return J; }
  bikeBack(crank, wa);
  figureSide(J, {
    ...o,
    between: () => { bikeFrame(o); },
    afterLegs: () => { crankFront(crank); },
  });
  g.restore();
  return J;
}

// ───────── 鸽子（朝右）─────────
// 个性：圆滚滚的胸、小碎步点头、歪头。尺寸：站立约 72 单位高（≈ 骑车人头部的 1.2 倍）
// pose: stand | walk | peck | fly ；step: 碎步相位；tilt: 歪头（rad）；frame: 扑翅帧 0..3（12fps 循环）
const WINGF = [-1.25, -.45, .55, -.1];   // 四帧：上举、半举、下拍、回收
export function pigeon(x, y, s, o = {}) {
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); if (o.rot) g.rotate(o.rot);
  const pose = o.pose || 'stand';
  const bodyC = P.pigeon, wingC = P.pigeonWing, barC = P.pigeonSh, neckC = P.pigeonNeck;
  if (pose === 'fly') {
    const a = WINGF[((o.frame || 0) % 4 + 4) % 4];
    const wing = (sx, len, c, dy) => {
      g.save(); g.translate(sx, -18 + dy); g.rotate(a);
      blob([[-4, 6], [-20, -8], [-34, -len * .55], [-26, -len], [-8, -len * .8], [10, -len * .35], [14, 0]], c);
      for (let k = 0; k < 4; k++) line([[-22 + k * 7, -len * .85 + k * 6], [-18 + k * 7, -len * .6 + k * 6]], 2, barC);
      g.restore();
    };
    wing(6, 70, P.pigeonSh, -4);                                   // 远翼
    blob([[-58, -12], [-70, -6], [-58, 2], [-24, 12], [14, 12], [36, 0], [30, -20], [0, -26], [-30, -20]], bodyC);
    poly([[-60, -12], [-80, -8], [-80, 0], [-60, 2]], barC);        // 尾
    blob([[20, -18], [34, -34], [48, -30], [42, -8]], neckC);
    circle(44, -36, 13, bodyC);
    poly([[55, -39], [67, -35], [55, -31]], P.beak); circle(47, -39, 3.6, P.pigeonEye); circle(48, -39, 1.8, [1, 0, .3]);
    line([[-6, 12], [-16, 22]], 3, P.beak); line([[2, 12], [-8, 22]], 3, P.beak);
    wing(-2, 82, wingC, 0);                                        // 近翼
  } else {
    const st = o.step || 0, walking = pose === 'walk';
    const bob = walking ? Math.sin(st * Math.PI * 2) : 0;
    const lf = walking ? Math.sin(st * Math.PI * 2) * 7 : 0;
    // 腿（小碎步）
    line([[-4, 14], [-4 - lf, 30]], 3.5, P.beak); line([[-4 - lf, 30], [4 - lf, 30]], 3, P.beak);
    line([[8, 14], [8 + lf, 30]], 3.5, P.beak); line([[8 + lf, 30], [16 + lf, 30]], 3, P.beak);
    // 身体：圆胸
    blob([[-50, -12], [-64, -16], [-52, -2], [-28, 12], [4, 20], [30, 12], [38, -8], [30, -30], [6, -34], [-24, -24]], bodyC);
    poly([[-52, -12], [-72, -18], [-70, -8], [-52, -2]], barC);
    blob([[-44, -16], [-18, -28], [12, -24], [14, -6], [-10, 4], [-38, -4]], wingC);
    line([[-30, -12], [-6, -8]], 3, barC); line([[-26, -4], [-4, 0]], 3, barC);
    // 脖子 + 头（点头 + 歪头）
    const pk = pose === 'peck' ? 1 : 0;
    const hx = 32 + bob * 8 + pk * 16, hy = -44 + pk * 44 + (walking ? Math.abs(bob) * 2 : 0);
    blob([[14, -30], [hx - 10, hy + 2], [hx + 8, hy + 6], [38, -8]], neckC);
    g.save(); g.translate(hx, hy); g.rotate((o.tilt || 0) + pk * .6);
    circle(0, 0, 14, bodyC);
    poly([[11, -4], [24, 1], [11, 5]], P.beak); circle(10, -5, 2.6, [0, .1, 0]);
    circle(3, -4, 4, P.pigeonEye); circle(4, -4, 2, [1, 0, .3]);
    if (o.look === 'back') { circle(-3, -4, 4, P.pigeonEye); circle(-4, -4, 2, [1, 0, .3]); }
    g.restore();
  }
  g.restore();
}

// ───────── 法棍 ─────────
export function baguette(x, y, len, a, o = {}) {
  g.save(); g.translate(x, y); g.rotate(a);
  const r = o.r || 13;
  rrect(-len / 2, -r, len, r * 2, r, P.bread);
  g.save(); g.beginPath(); g.roundRect(-len / 2, -r, len, r * 2, r); g.clip();
  rect(-len / 2, r * .25, len, r, P.breadSh);
  for (let i = 1; i < Math.floor(len / 34); i++) { const xx = -len / 2 + i * 34; line([[xx - 9, r * .5], [xx + 9, -r * .6]], 4, P.breadSh); }
  g.restore();
  if (o.half) { ellipse(len / 2 - 2, 0, 5, r - 1, 0, P.breadIn); }
  g.restore();
}

// ───────── 正面 / 3/4 / 背面站姿（设定表用）─────────
function stripedBlob(pts, sw = 13, rot = 0) {
  blob(pts, P.stripeB);
  const n = pts.length, m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  g.save(); let s0 = m(pts[n - 1], pts[0]); g.beginPath(); g.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = m(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  g.closePath(); g.clip(); g.fillStyle = inkA(P.stripeA);
  for (let yy = -260 + 4; yy > -440; yy -= sw * 2) g.fillRect(-80, yy - sw, 160, sw);
  g.restore();
}
export function standFront(x, y, s, view = 'front', o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const q = view === 'q' ? 1 : 0, bk = view === 'back';
  const hipY = -(L.thigh + L.shin + L.ankleH), shY = hipY - L.torso;
  const cx = q * 4;
  // 背面：围巾尾巴在背后先画不对；正面：一条尾巴在后
  const legX = q ? [-8, 16] : [-15, 15];
  const sleeve = [P.stripeA, P.stripeB, 13, 0];
  // 远侧臂（3/4 时左臂在后）
  const armL = [[cx - (q ? 30 : 44), shY + 8], [cx - (q ? 36 : 52), shY + 86], [cx - (q ? 34 : 54), shY + 160]];
  const armR = [[cx + (q ? 40 : 44), shY + 8], [cx + (q ? 50 : 52), shY + 86], [cx + (q ? 52 : 54), shY + 160]];
  if (q) { limb(armL[0], armL[1], 23, null, sleeve); limb(armL[1], armL[2], 21, null, sleeve); circle(armL[2][0], armL[2][1], 9.5, P.skinSh); }
  // 腿
  for (let i = 0; i < 2; i++) {
    const lx = legX[i], c = (q && i === 0) ? P.trousersSh : P.trousers;
    limb([lx, hipY + 6], [lx + (i ? 1 : -1), hipY + L.thigh], 32, c); limb([lx + (i ? 1 : -1), hipY + L.thigh], [lx, -L.ankleH - 4], 29, c);
    line([[lx, -L.ankleH - 4], [lx, -L.ankleH - 16]], 22, P.sock);
    if (bk) ellipse(lx, -7, 15, 9, 0, P.shoe);
    else if (q) blob([[lx - 14, -14], [lx + 8, -14], [lx + 28, -6], [lx + 28, 2], [lx - 14, 2]], P.shoe);
    else ellipse(lx + (i ? 3 : -3), -6, 17, 9, 0, P.shoe);
  }
  // 躯干
  const tw = q ? [34, 42] : [42, 42];
  stripedBlob([[cx - 29, hipY + 10], [cx - tw[0] + 1, shY + 40], [cx - tw[0] - 2, shY + 8], [cx - 18, shY - 4], [cx + 18, shY - 4], [cx + tw[1] + 2, shY + 8], [cx + tw[1] - 1, shY + 40], [cx + 30, hipY + 10]]);
  rrect(cx - 31, hipY - 4, 62, 18, 6, P.rib); for (let xx = cx - 26; xx < cx + 28; xx += 7) rect(xx, hipY - 4, 2.5, 18, P.sweaterSh);
  // 围巾
  if (bk) {
    rrect(cx - 30, shY - 18, 60, 26, 12, P.scarf);
    curve([[cx + 8, shY - 2], [cx + 12, shY + 40], [cx + 6, shY + 90]], 13, P.scarfSh);
    curve([[cx - 4, shY - 2], [cx - 10, shY + 50], [cx - 4, shY + 120]], 14, P.scarf);
  }
  // 手臂
  if (!q) { limb(armL[0], armL[1], 24, null, sleeve); limb(armL[1], armL[2], 22, null, sleeve); circle(armL[2][0], armL[2][1], 10, bk ? P.skinSh : P.skin); }
  limb(armR[0], armR[1], 24, null, sleeve); limb(armR[1], armR[2], 22, null, sleeve); circle(armR[2][0], armR[2][1], 10, P.skin);
  if (!bk) {
    rrect(cx - 30 + q * 4, shY - 20, 60, 26, 12, P.scarf);
    curve([[cx - 12 + q * 6, shY - 2], [cx - 16 + q * 6, shY + 50], [cx - 10 + q * 6, shY + 126]], 21, P.scarf);
    curve([[cx + 4 + q * 6, shY], [cx + 8 + q * 6, shY + 40], [cx + 5 + q * 6, shY + 92]], 18, P.scarfSh);
  }
  head(cx + q * 6, shY - 50, 1, bk ? 'back' : view, o.expr || 'calm');
  g.restore();
}

// 坐姿（侧面，坐在墙上，朝右）。原点 = 臀下墙面
export function poseSit(o = {}) {
  const hip = [0, -14];
  const sh = [hip[0] + 22, hip[1] - L.torso];
  const J = { hip, sh, head: [sh[0] + 16, sh[1] - 48] };
  J.kneeN = [hip[0] + 116, hip[1] + 2]; J.ankleN = [J.kneeN[0] + 14 + (o.swing || 0), J.kneeN[1] + 112]; J.toeN = [J.ankleN[0] + 26, J.ankleN[1] + 8];
  J.kneeF = [hip[0] + 110, hip[1] - 2]; J.ankleF = [J.kneeF[0] - 6 - (o.swing || 0), J.kneeF[1] + 114]; J.toeF = [J.ankleF[0] + 26, J.ankleF[1] + 8];
  const tN = o.handN || [sh[0] + 150, sh[1] + 70], tF = o.handF || [sh[0] + 46, sh[1] + 30];
  [J.elbowN, J.wristN] = ik(sh, tN, L.upper, L.fore, 1);
  [J.elbowF, J.wristF] = ik([sh[0] - 4, sh[1] + 2], tF, L.upper, L.fore, 1);
  return J;
}
