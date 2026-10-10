// 女孩：红纸关节分片人物（侧面朝右）。单位：1 = 身高 424 中的 1；原点 = 脚底中心，y 向下
// 分片：头（含发髻、换脸片）、躯干（棉袄）、上臂 ×2、前臂+手 ×2、大腿 ×2、小腿+虎头鞋 ×2、剪刀（两片）
import { PAL, piece, P, trace, fill, cut, cutLine, cutTaper, inset, within, ellipsePoly, curve, wob, Pl } from './paper.js';
import { sawRow, sawEdge, crescent, crescentPts, crescentRows, swirl, rosette, plum, coin, dots, taper, strands } from './motifs.js';
import { mul, T, R, S, put, solveRig, ap } from './rig.js';

const FAR = '#b8191b';     // 远侧肢体（深一档的纸）
export const PELVIS = -120;
const G = {};              // 片缓存

// ---------- 头 ----------
const HEAD_OUT = [[-9, 10], [-10, -12], [-16, -19], [-32, -25], [-47, -38], [-60, -58], [-65, -84], [-57, -114], [-32, -138], [2, -147], [36, -137], [56, -117], [64, -100], [66, -86], [66, -79], [74, -68], [69, -62], [68, -55], [63, -50], [66, -46], [60, -34], [48, -24], [30, -19], [14, -17], [10, 10]];
function headPiece(expr = 'smile', col = PAL.red, seed = 3) {
  return piece([-110, -182, 90, 16], g => {
    const out = P(HEAD_OUT, true, .3, seed);
    const bunF = P(ellipsePoly(8, -150, 23, 22, 0, 28).slice(0, -1), true, .35, seed + 1);
    const bunB = P(ellipsePoly(-36, -142, 23, 22, 0, 28).slice(0, -1), true, .35, seed + 2);
    // 飘带（从后髻垂下，锯齿尾）
    const rib1 = [[-52, -148], [-64, -136], [-70, -118], [-72, -98], [-80, -84], [-68, -88], [-64, -104], [-60, -124], [-50, -136]];
    const rib2 = [[-56, -142], [-72, -130], [-82, -114], [-90, -98], [-94, -84], [-84, -92], [-76, -106], [-62, -128]];
    for (const r of [rib1, rib2]) fill(g, q => trace(q, P(r, true, .25, seed + 5)), col);
    fill(g, q => trace(q, bunB), col);
    fill(g, q => trace(q, bunF), col);
    fill(g, q => trace(q, out), col);
    // 两髻与头之间的刻线
    cutTaper(g, curve([[-58, -130], [-50, -150], [-34, -164], [-16, -160]], false, 2), 3);
    cutTaper(g, curve([[-16, -152], [-6, -168], [12, -172], [28, -160]], false, 2), 3);
    inset(g, out, 3.5, 1.5, col);
    // 发际线 + 刘海
    const fringe = curve([[55, -113], [46, -103], [32, -99], [18, -99], [6, -97]], false, 2);
    const hairline = curve([[6, -97], [1, -88], [-3, -74], [-8, -56], [-14, -36], [-14, -14]], false, 2);
    cutTaper(g, fringe.concat(hairline.slice(1)), 3.2);
    sawRow(g, fringe, 12, 5.5, -1, .7);                 // 刘海发梢（尖朝上进头发）
    // 头发丝：绕颅顶的弧形刻线
    for (const [r, a0, a1] of [[42, -2.75, -1.1], [54, -2.95, -1.3], [30, -2.55, -1.25]]) {
      const pts = []; for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20; pts.push([-2 + Math.cos(a) * r, -84 + Math.sin(a) * r]); }
      cutTaper(g, pts, 3);
    }
    cutTaper(g, curve([[-34, -56], [-42, -42], [-40, -28]], false, 2), 2.6);
    cutTaper(g, curve([[-50, -76], [-54, -60], [-50, -46]], false, 2), 2.6);
    // 发髻：旋涡 + 小花
    swirl(g, 8, -152, 15, 1.9, 3.2, -1.2, 1);
    plum(g, -38, -146, 9);
    crescent(g, -54, -122, 10, -2.2, -1.2, 3);
    // 耳朵
    cutTaper(g, curve([[6, -72], [-3, -68], [-3, -56], [6, -52]], false, 2), 2.8);
    // 腮红团花
    rosette(g, 36, -42, 10, 5, -.3, .22);
    // —— 换脸片 ——
    face(g, expr);
  }, { seed, col });
}
function face(g, expr) {
  const E = [41, -68];
  if (expr === 'smile') {
    crescent(g, E[0], E[1] + 5, 11, Math.PI * 1.08, Math.PI * 1.92, 5);         // ∩ 笑眼
    taper(g, [[29, -86], [41, -91], [53, -88]], 3.2);                           // 眉
    taper(g, [[60, -44], [55, -41], [50, -43]], 2.6);                           // 嘴角上扬
  } else if (expr === 'surprise') {
    crescent(g, E[0], E[1], 12, Math.PI * 1.06, Math.PI * 1.94, 3.4); crescent(g, E[0], E[1], 12, Math.PI * .08, Math.PI * .92, 2.6);   // 圆睁（上下眼眶留桥）
    cut(g, q => q.arc(E[0] + 2.5, E[1], 5.2, 0, 7));
    taper(g, [[28, -92], [41, -99], [54, -95]], 3.4);
    cut(g, q => q.ellipse(58, -43, 3.4, 4.4, 0, 0, 7));
  } else if (expr === 'scared') {
    crescent(g, E[0], E[1], 11, Math.PI * 1.06, Math.PI * 1.94, 3); crescent(g, E[0], E[1], 11, Math.PI * .08, Math.PI * .92, 2.4);
    cut(g, q => q.arc(E[0] + 3, E[1] + .8, 3, 0, 7));
    taper(g, [[28, -85], [41, -90], [53, -97]], 3.4);                           // 眉头（前端）上挑 = 担心
    taper(g, [[60, -43], [56, -45], [53, -42.5], [49, -44]], 2.4);                // 抖嘴
    cut(g, q => { q.moveTo(16, -106); q.quadraticCurveTo(21, -96, 16, -92); q.quadraticCurveTo(11, -96, 16, -106); });   // 汗滴
  } else if (expr === 'determined') {
    cut(g, q => { q.moveTo(30, -67); q.quadraticCurveTo(41, -77, 52, -69); q.quadraticCurveTo(41, -58, 30, -67); q.closePath(); });   // 杏眼
    cut(g, q => q.arc(44, -68, 2.6, 0, 7), 'nonzero');
    taper(g, [[27, -89], [40, -83], [55, -76]], 4.8);                           // 眉压下
    taper(g, [[60, -44.5], [55, -44.5], [50, -44.5]], 2.6);                     // 抿嘴
  } else if (expr === 'sleep') {
    crescent(g, E[0], E[1] - 5, 11, Math.PI * .1, Math.PI * .9, 4);             // ∪ 闭眼
    taper(g, [[30, -86], [41, -88], [52, -86]], 2.8);
    taper(g, [[60, -44.5], [55, -42.5], [50, -43.5]], 2.4);
  }
}
// ---------- 躯干（棉袄），原点 = 骨盆 ----------
const TORSO_OUT = [[-10, -114], [12, -117], [23, -108], [32, -92], [35, -66], [35, -40], [41, -12], [53, 14], [24, 21], [-10, 21], [-47, 16], [-39, -12], [-33, -46], [-32, -86], [-23, -106]];
function torsoPiece(col = PAL.red, seed = 7) {
  return piece([-56, -130, 60, 30], g => {
    const out = P(TORSO_OUT, true, .3, seed);
    fill(g, q => trace(q, out), col);
    inset(g, out, 3.5, 1.5, col);
    // 立领
    cutTaper(g, curve([[-14, -104], [0, -106], [16, -107], [24, -102]], false, 2), 2.6);
    // 前襟 + 盘扣
    cutTaper(g, curve([[22, -103], [27, -78], [31, -46], [34, -14], [38, 12]], false, 2), 2.6);
    for (const [x, y] of [[24, -90], [28, -64], [32, -38]]) { coin(g, x - 6, y, 4.2); }
    // 胸前团花
    within(g, out, () => {
      cut(g, q => { q.arc(0, -62, 21, 0, 7); q.arc(0, -62, 18.6, 0, 7, true); });
      rosette(g, 0, -62, 16, 8, .2, .2);
      // 下摆月牙纹
      g.save(); g.beginPath(); g.rect(-50, 0, 110, 14); g.clip(); crescentRows(g, -50, 2, 60, 14, 6.5, 2.6, 0, .75); g.restore();
    });
    cutTaper(g, curve([[-38, -2], [0, 0], [42, -2]], false, 2), 2.2);
    // 背部棉袄绗线
    taper(g, [[-24, -92], [-26, -60], [-27, -24]], 2.4);
    taper(g, [[-14, -40], [-16, -22], [-18, -8]], 2.2);
  }, { seed, col });
}
// ---------- 上臂（原点 = 肩，向下） ----------
function upperArmPiece(col, seed) {
  return piece([-22, -14, 24, 58], g => {
    const out = P([[-15, -8], [0, -12], [15, -8], [18, 16], [15, 46], [0, 52], [-13, 48], [-17, 18]], true, .3, seed);
    fill(g, q => trace(q, out), col); inset(g, out, 3, 1.4, col);
    within(g, out, () => { crescentRows(g, -20, 6, 22, 44, 7, 2.6, 0, .72); });
  }, { seed, col });
}
// ---------- 前臂 + 手（原点 = 肘） ----------
function foreArmPiece(col, seed, hand = 'open') {
  return piece([-26, -12, 30, 78], g => {
    const out = P([[-13, -6], [0, -9], [13, -6], [16, 20], [20, 40], [0, 44], [-19, 42], [-15, 18]], true, .3, seed);
    const H = hand === 'fist' ? P([[-9, 40], [8, 40], [12, 50], [9, 60], [-6, 61], [-11, 52]], true, .3, seed + 1)
      : hand === 'flat' ? P([[-8, 40], [9, 40], [11, 58], [7, 70], [0, 72], [-5, 66], [-10, 58]], true, .3, seed + 1)
        : P([[-9, 40], [8, 40], [12, 52], [8, 63], [-2, 65], [-9, 58]], true, .3, seed + 1);
    fill(g, q => trace(q, H), col);
    // 拇指
    fill(g, q => trace(q, P(hand === 'fist' ? [[8, 44], [16, 46], [16, 52], [10, 52]] : [[8, 43], [15, 48], [14, 54], [9, 52]], true, .2, seed + 2)), col);
    fill(g, q => trace(q, out), col); inset(g, out, 3, 1.4, col);
    // 袖口：锯齿边宽带
    cutTaper(g, curve([[-17, 30], [0, 32], [18, 30]], false, 2), 2.4);
    sawRow(g, curve([[-17, 33.5], [0, 35.5], [18, 33.5]], false, 2), 6, 5, 1, .7);
    within(g, out, () => { crescentRows(g, -20, 2, 22, 22, 6.5, 2.4, 0, .72); });
    if (hand !== 'fist') taper(g, [[2, 52], [4, 58]], 1.8);
  }, { seed, col });
}
// ---------- 大腿（原点 = 髋） ----------
function thighPiece(col, seed) {
  return piece([-22, -12, 24, 72], g => {
    g.scale(1, .82);
    const out = P([[-16, -8], [0, -10], [17, -8], [18, 28], [15, 64], [0, 68], [-14, 64], [-17, 28]], true, .3, seed);
    fill(g, q => trace(q, out), col);
    taper(g, [[4, 6], [6, 32], [4, 56]], 2.4); taper(g, [[-6, 12], [-8, 36], [-6, 54]], 2.2);
  }, { seed, col });
}
// ---------- 小腿 + 虎头鞋（原点 = 膝） ----------
function shinPiece(col, seed) {
  return piece([-22, -10, 50, 82], g => {
    g.scale(1, .85);
    const out = P([[-14, -6], [0, -8], [14, -6], [13, 30], [11, 52], [-12, 52], [-14, 30]], true, .3, seed);
    const shoe = P([[-14, 50], [4, 48], [14, 50], [28, 54], [38, 58], [44, 64], [42, 72], [30, 75], [-12, 75], [-17, 68], [-17, 58]], true, .3, seed + 1);
    fill(g, q => trace(q, out), col);
    fill(g, q => trace(q, shoe), col);
    cutTaper(g, curve([[-12, 47], [0, 45], [12, 47]], false, 2), 2.4);                 // 裤脚
    cutTaper(g, curve([[-15, 68], [10, 69], [40, 68]], false, 2), 2.2);                 // 鞋底线
    // 虎头：小耳朵 + 旋眼 + 须
    cut(g, q => { q.arc(30, 60, 3.2, 0, 7); });
    taper(g, [[36, 62], [42, 60]], 1.6); taper(g, [[36, 65], [42, 66]], 1.6);
    crescent(g, 20, 56, 5, Math.PI * 1.1, Math.PI * 1.9, 2);
    taper(g, [[-2, 10], [0, 30], [-1, 44]], 2.2);
  }, { seed, col });
}
// ---------- 剪刀（两片，原点 = 铆钉） ----------
function bladePiece(col, seed, flip) {
  const s = flip ? -1 : 1;
  return piece([-44, -18, 64, 18], g => {
    const blade = P([[-2, 0], [10, -4 * s], [30, -4.5 * s], [56, -1.2 * s], [58, 0], [30, 1.2 * s], [8, 3 * s]], true, .15, seed);
    const shank = P([[0, -2.5 * s], [-16, 2 * s], [-22, 6 * s], [-20, 9 * s], [-4, 3 * s]], true, .15, seed + 1);
    fill(g, q => trace(q, blade), col); fill(g, q => trace(q, shank), col);
    fill(g, q => { q.ellipse(-30, 9 * s, 12, 8, .25 * s, 0, 7); }, col);
    cut(g, q => { q.ellipse(-30, 9 * s, 7.2, 4.4, .25 * s, 0, 7); });
    cutLine(g, .9, q => { q.moveTo(12, -1.5 * s); q.lineTo(46, -.8 * s); });
  }, { seed, col, edge: .8 });
}

// ---------- 正面（对折剪：画半边再镜像） ----------
function frontPiece(col = PAL.red, seed = 23) {
  return piece([-120, -440, 120, 6], g => {
    const half = (m) => {
      g.save(); g.scale(m, 1);
      // 发髻 + 飘带
      fill(g, q => trace(q, P(ellipsePoly(44, -392, 23, 22, 0, 26).slice(0, -1), true, .3, seed + 1)), col);
      fill(g, q => trace(q, P([[58, -398], [80, -386], [92, -360], [96, -334], [86, -344], [78, -364], [62, -384]], true, .25, seed + 2)), col);
      // 头
      fill(g, q => trace(q, P([[0, -398], [34, -392], [58, -370], [66, -336], [60, -302], [44, -280], [22, -268], [10, -264], [10, -250], [0, -250]], false, .3, seed + 3).concat([[0, -250]])), col);
      // 棉袄半边
      fill(g, q => trace(q, Pl([[0, -258], [18, -260], [46, -246], [56, -210], [60, -170], [72, -118], [0, -116]], true, .3, seed + 4)), col);
      // 袖 + 手
      fill(g, q => trace(q, P([[46, -246], [62, -236], [72, -196], [80, -150], [58, -146], [54, -190], [50, -226]], true, .3, seed + 5)), col);
      fill(g, q => trace(q, P(ellipsePoly(70, -136, 11, 13, 0, 18).slice(0, -1), true, .2, seed + 6)), col);
      // 裤腿 + 虎头鞋
      fill(g, q => trace(q, Pl([[4, -118], [42, -118], [40, -30], [8, -30]], true, .3, seed + 7)), col);
      fill(g, q => trace(q, P([[2, -32], [44, -32], [50, -14], [46, 0], [4, 0], [0, -14]], true, .3, seed + 8)), col);
      g.restore();
    };
    half(1); half(-1);
    for (const m of [1, -1]) {
      g.save(); g.scale(m, 1);
      swirl(g, 44, -393, 15, 1.9, 3, -1.2, 1);
      // 刘海锯齿
      sawRow(g, curve([[2, -354], [22, -356], [42, -350], [56, -340]], false, 2), 12, 5.5, 1, .7);
      cutTaper(g, curve([[2, -350], [24, -352], [44, -346], [58, -334], [62, -318]], false, 2), 3);
      crescent(g, 25, -318, 11, Math.PI * 1.08, Math.PI * 1.92, 5);           // 笑眼
      rosette(g, 38, -292, 9, 5, -.3, .22);                                   // 腮红
      taper(g, [[14, -338], [26, -342], [38, -338]], 3);                      // 眉
      rosette(g, 30, -206, 14, 8, .2, .2);                                     // 胸前团花
      g.save(); g.beginPath(); g.rect(0, -140, 80, 20); g.clip(); crescentRows(g, 0, -138, 80, -122, 6.5, 2.6, 0, .75); g.restore();
      cutTaper(g, curve([[52, -170], [66, -168], [78, -162]], false, 2), 2.4);
      sawRow(g, curve([[56, -166], [67, -164], [79, -158]], false, 2), 6, 5, 1, .7);
      taper(g, [[26, -104], [24, -70], [25, -40]], 2.4);
      cut(g, q => { q.arc(30, -16, 3, 0, 7); });                              // 虎头鞋眼
      crescent(g, 20, -22, 5, Math.PI * 1.1, Math.PI * 1.9, 2);
      g.restore();
    }
    taper(g, [[-6, -284], [0, -281], [6, -284]], 2.6);                          // 嘴
    cutTaper(g, curve([[0, -250], [0, -200], [0, -122]], false, 2), 2.6);       // 前襟
    for (const y of [-236, -210, -184, -158]) coin(g, 0, y, 4);
    cutTaper(g, curve([[-10, -262], [0, -258], [10, -262]], false, 2), 2.4);
    cutTaper(g, curve([[-1, -118], [0, -60], [-1, -30]], false, 2), 2.4);
  }, { seed, col });
}
export function buildGirl() {
  if (G.torso) return G;
  G.head = {}; for (const e of ['smile', 'surprise', 'scared', 'determined', 'sleep']) G.head[e] = headPiece(e);
  G.torso = torsoPiece(); G.front = frontPiece();
  G.uaF = upperArmPiece(PAL.red, 11); G.uaB = upperArmPiece(FAR, 12);
  G.faF = {}; G.faB = {};
  for (const h of ['open', 'fist', 'flat']) { G.faF[h] = foreArmPiece(PAL.red, 13, h); G.faB[h] = foreArmPiece(FAR, 14, h); }
  G.thF = thighPiece(PAL.red, 15); G.thB = thighPiece(FAR, 16);
  G.shF = shinPiece(PAL.red, 17); G.shB = shinPiece(FAR, 18);
  G.bladeA = bladePiece(PAL.mid, 19, false); G.bladeB = bladePiece(PAL.mid, 20, true);
  return G;
}
// 关节布局（父坐标里的关节位置）
export const GJ = { hipF: [5, 4], hipB: [-9, 4], shF: [4, -100], shB: [-8, -102], neck: [2, -106], elbow: [0, 46], knee: [0, 52.5] };
// 默认姿势（弧度）
export const GPOSE = {
  rest: { lean: 0, head: 0, shB: .12, elB: -.1, shF: -.1, elF: -.2, hipB: .06, knB: 0, hipF: -.06, knF: 0, expr: 'smile', handF: 'open', handB: 'open' },
};
export function drawGirl(g, C, pose, opt = {}) {
  const Gp = buildGirl(), p = { ...GPOSE.rest, ...pose };
  let dy = 0;
  if (p.ground) {   // 让较低的那只脚落地
    const r0 = mul(T(0, PELVIS), R(p.lean || 0));
    const fk = (hip, a1, a2) => ap(mul(mul(mul(r0, T(...hip)), R(a1)), mul(T(...GJ.knee), R(a2))), [0, 64]);
    const f1 = fk(GJ.hipF, p.hipF, p.knF), f2 = fk(GJ.hipB, p.hipB, p.knB);
    dy = -Math.max(f1[1], f2[1]);
  }
  let root = mul(C, T(p.x || 0, (p.y || 0)));
  if (p.flip) root = mul(root, S(-1, 1));
  root = mul(root, T(0, PELVIS + dy)); root = mul(root, R(p.lean || 0));
  const M = {};
  M.torso = root;
  M.thB = mul(mul(root, T(...GJ.hipB)), R(p.hipB)); M.shB = mul(mul(M.thB, T(...GJ.knee)), R(p.knB));
  M.thF = mul(mul(root, T(...GJ.hipF)), R(p.hipF)); M.shF = mul(mul(M.thF, T(...GJ.knee)), R(p.knF));
  M.uaB = mul(mul(root, T(...GJ.shB)), R(p.shB)); M.faB = mul(mul(M.uaB, T(...GJ.elbow)), R(p.elB));
  M.uaF = mul(mul(root, T(...GJ.shF)), R(p.shF)); M.faF = mul(mul(M.uaF, T(...GJ.elbow)), R(p.elF));
  M.head = mul(mul(root, T(...GJ.neck)), R(p.head));
  const o = { shadow: opt.shadow ?? 1 };
  const order = opt.order || ['uaB', 'faB', 'thB', 'shB', 'thF', 'shF', 'torso', 'head', 'uaF', 'faF'];
  for (const k of order) {
    if (k === 'uaB') put(g, Gp.uaB, M.uaB, o);
    else if (k === 'faB') put(g, Gp.faB[p.handB], M.faB, o);
    else if (k === 'thB') put(g, Gp.thB, M.thB, o);
    else if (k === 'shB') put(g, Gp.shB, M.shB, o);
    else if (k === 'thF') put(g, Gp.thF, M.thF, o);
    else if (k === 'shF') put(g, Gp.shF, M.shF, o);
    else if (k === 'torso') put(g, Gp.torso, M.torso, o);
    else if (k === 'head') put(g, Gp.head[p.expr], M.head, o);
    else if (k === 'uaF') put(g, Gp.uaF, M.uaF, o);
    else if (k === 'faF') {
      if (p.scissors) drawScissors(g, mul(mul(M.faF, T(2, 52)), S(p.scissors.s ?? 1.4)), p.scissors.ang ?? -1.2, p.scissors.open ?? .3, o);
      put(g, Gp.faF[p.handF], M.faF, o);
    }
  }
  // 关节点（世界坐标）供设定表标注
  return {
    M, joints: {
      neck: ap(M.head, [0, 0]), shF: ap(M.uaF, [0, 0]), elF: ap(M.faF, [0, 0]), hipF: ap(M.thF, [0, 0]), knF: ap(M.shF, [0, 0]),
      shB: ap(M.uaB, [0, 0]), elB: ap(M.faB, [0, 0]), hipB: ap(M.thB, [0, 0]), knB: ap(M.shB, [0, 0]), hand: ap(M.faF, [2, 52])
    }
  };
}
export function drawScissors(g, M, ang = 0, open = .3, o = {}) {
  const Gp = buildGirl(), base = mul(M, R(ang));
  put(g, Gp.bladeB, mul(base, R(open / 2)), o);
  put(g, Gp.bladeA, mul(base, R(-open / 2)), o);
  // 铆钉
  g.save(); g.setTransform(...base); g.beginPath(); g.arc(0, 0, 2.6, 0, 7); g.fillStyle = '#5a0a12'; g.fill(); g.restore();
}
