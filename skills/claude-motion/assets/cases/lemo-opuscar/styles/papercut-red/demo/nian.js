// 年兽：深红纸关节分片巨兽（侧面朝左）。憨：大头、大眼、圆身、短腿、云尾；压迫感来自体积。
// 原点 = 身体中心，站立时地面在 y ≈ +395。分片：身、头（换眼片）、下颌、鬃毛、尾、四腿（上 + 下）
import { PAL, piece, P, trace, fill, cut, cutLine, cutTaper, inset, within, ellipsePoly, curve } from './paper.js';
import { sawRow, sawEdge, crescent, crescentPts, crescentRows, swirl, doubleSwirl, rosette, plum, coin, dots, taper, along } from './motifs.js';
import { mul, T, R, S, put, ap } from './rig.js';

const COL = PAL.nian, FARC = '#8a0c20', NEAR = '#c4162c';
const N = {};
export const NJ = { neck: [-262, -130], jaw: [-196, 12], tail: [322, -128], fn: [-194, 38], ff: [-144, 26], bn: [208, 38], bf: [256, 26], knee: [0, 150], ground: 325 };
export const HS = 1.32;   // 头部放大（憨：大头）

// ---------- 身 ----------
function bodyPiece() {
  return piece([-350, -320, 380, 230], g => {
    g.scale(.85, 1.05);
    const top = curve([[-300, -168], [-200, -214], [-80, -238], [60, -240], [200, -222], [318, -182], [380, -120]], false, 4);
    const ridge = sawEdge(top.slice(8, top.length - 6), 46, 58, 1, .25, 3);   // 背脊锯齿（像山脊）
    const belly = curve([[330, 120], [240, 150], [80, 166], [-80, 166], [-220, 150], [-300, 110]], false, 4);
    const bellyF = sawEdge(belly, 26, 34, 1, .3, 5);                         // 腹下毛边
    const pts = [...top.slice(0, 8), ...ridge, ...top.slice(top.length - 6), ...curve([[380, -120], [398, -40], [384, 50], [330, 120]], false, 4), ...bellyF, ...curve([[-300, 110], [-352, 40], [-362, -60], [-336, -132], [-300, -168]], false, 4)];
    const out = pts;
    fill(g, q => trace(q, out), COL);
    inset(g, out, 7, 3, COL);
    within(g, out, () => {
      // 关节旋涡
      doubleSwirl(g, -222, -10, 96, 9, -.5);
      doubleSwirl(g, 252, -14, 96, 9, 2.4);
      // 中段月牙鳞
      const mid = ellipsePoly(16, -40, 150, 120, 0, 40);
      within(g, mid, () => crescentRows(g, -140, -170, 170, 90, 22, 8, 0, .72));
      cutTaper(g, curve([[-120, -150], [-150, -40], [-120, 80]], false, 3), 6);
      cutTaper(g, curve([[150, -150], [180, -40], [150, 80]], false, 3), 6);
      // 背脊下一条锯齿刻带
      const band = curve([[-250, -168], [-80, -200], [60, -202], [200, -188], [320, -150]], false, 3);
      cutTaper(g, band, 5);
      sawRow(g, band, 22, 13, 1, .7);
      // 腹部一串圆孔
      dots(g, along(curve([[-200, 118], [-60, 132], [80, 132], [220, 116]], false, 3), 34).map(p => [p.x, p.y]), 6.5);
    });
  }, { seed: 41, col: COL, ss: 2 });
}
// ---------- 头（原点 = 颈关节），朝左 ----------
function headOutline() {
  const mouthUp = sawEdge(curve([[-438, -4], [-360, 6], [-280, 4], [-212, -14]], false, 3), 20, 30, -1, 0, 7);   // 上牙朝下（嘴角上扬 = 憨笑）
  return [
    ...curve([[-20, -180], [-60, -250], [-110, -278]], false, 4),
    [-96, -268], [-40, -318], [0, -332], [-12, -294], [-50, -262],             // 耳
    ...curve([[-80, -272], [-150, -292], [-196, -292]], false, 4),
    ...curve([[-326, -238], [-352, -180], [-356, -146], [-372, -132], [-402, -138], [-438, -126], [-456, -96], [-450, -64], [-432, -50], [-444, -30], [-446, -8]], false, 4).slice(0, 0),
    ...curve([[-196, -292], [-260, -284], [-326, -238], [-352, -180], [-356, -146], [-374, -134], [-404, -140], [-440, -128], [-458, -96], [-452, -64], [-434, -50], [-444, -30], [-442, -6]], false, 4),
    ...mouthUp,
    ...curve([[-206, -12], [-176, 16], [-150, 44], [-80, 52], [-20, 24], [4, -60], [-20, -180]], false, 4)
  ];
}
const HORN = () => [...curve([[-200, -280], [-202, -350], [-170, -408], [-118, -444], [-62, -456], [-22, -440]], false, 3), ...curve([[-22, -440], [-44, -426], [-74, -424], [-110, -410], [-140, -380], [-154, -338], [-150, -282]], false, 3)];
function eye(g, kind) {
  const E = [-252, -166];
  if (kind === 'normal' || kind === 'sniff' || kind === 'fierce') {
    const up = kind === 'sniff' ? 26 : 16;
    crescent(g, E[0], E[1] + (kind === 'sniff' ? 12 : 0), 62, Math.PI * 1.06, Math.PI * 1.94, up);   // 上眼睑
    crescent(g, E[0], E[1], 60, Math.PI * .1, Math.PI * .9, 9);                                       // 下眼睑
    cut(g, q => q.arc(E[0] - 12, E[1] + (kind === 'sniff' ? 10 : 4), 24, 0, 7));                       // 瞳孔
    cut(g, q => q.arc(E[0] - 42, E[1] - 20, 7, 0, 7));                                                  // 眼角点
  } else if (kind === 'squint') {
    crescent(g, E[0], E[1] + 12, 46, Math.PI * 1.1, Math.PI * 1.9, 16);        // 紧闭 ∩
    crescent(g, E[0], E[1] - 16, 40, Math.PI * .15, Math.PI * .85, 8);
    for (const k of [0, 1, 2]) cut(g, q => { const x = E[0] + 26 - k * 30, y = E[1] + 50 + k * 26, z = 1.7 - k * .25; q.moveTo(x, y - 14 * z); q.quadraticCurveTo(x + 10 * z, y + 3 * z, x, y + 9 * z); q.quadraticCurveTo(x - 10 * z, y + 3 * z, x, y - 14 * z); });   // 泪（大颗，憨）
  } else if (kind === 'blink') {
    crescent(g, E[0], E[1] + 4, 56, Math.PI * .08, Math.PI * .92, 12);
    for (const k of [-2, -1, 0, 1, 2]) cutTaper(g, [[E[0] + k * 22, E[1] + 48], [E[0] + k * 26, E[1] + 66]], 6);
  } else if (kind === 'dizzy') {
    swirl(g, E[0], E[1], 46, 2.6, 9, 0, 1);
  }
  // 眉：火焰状锯齿眉
  const br = kind === 'fierce' ? [[-330, -206], [-280, -218], [-222, -236], [-180, -252]] : kind === 'squint' ? [[-330, -236], [-280, -228], [-226, -220], [-184, -226]] : [[-330, -222], [-280, -232], [-226, -236], [-180, -230]];
  const bc = curve(br, false, 3);
  cutTaper(g, bc, 12);
  sawRow(g, bc, 34, 16, 1, .72);
}
function headPiece(kind = 'normal') {
  return piece([-480, -470, 30, 70], g => {
    const out = headOutline();
    fill(g, q => trace(q, HORN()), COL);
    fill(g, q => trace(q, out), COL);
    inset(g, out, 6, 2.6, COL);
    cutTaper(g, curve([[-198, -286], [-176, -296], [-152, -290]], false, 2), 5);
    // 角上的环纹
    { const o = curve([[-200, -280], [-202, -350], [-170, -408], [-118, -444], [-62, -456], [-22, -440]], false, 3), inn = curve([[-150, -282], [-154, -338], [-140, -380], [-110, -410], [-74, -424], [-44, -426], [-22, -440]], false, 3);
      for (let k = 1; k <= 6; k++) { const f = k / 8, A = o[Math.floor(f * (o.length - 1))], B = inn[Math.floor(f * (inn.length - 1))], m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        cutTaper(g, [[A[0] + (m[0] - A[0]) * .25, A[1] + (m[1] - A[1]) * .25], [m[0] + 3, m[1] + 3], [B[0] + (m[0] - B[0]) * .25, B[1] + (m[1] - B[1]) * .25]], 7); } }
    // 耳内
    taper(g, [[-60, -276], [-30, -306], [-10, -320]], 8);
    // 鼻孔旋 + 鼻梁皱纹
    swirl(g, -424, -96, 24, 1.8, 7, 0, -1);
    cutTaper(g, curve([[-376, -134], [-392, -110], [-412, -70], [-434, -54]], false, 2), 5);
    for (const k of [0, 1, 2]) crescent(g, -318 + k * 18, -112 - k * 4, 16, Math.PI * .95, Math.PI * 1.6, 5);
    // 额头火纹（三瓣）
    for (const [dx, s] of [[0, 1], [-18, .7], [18, .7]]) cut(g, q => { const x = -300 + dx, y = -242; q.moveTo(x, y + 10); q.quadraticCurveTo(x - 9 * s, y - 6 * s, x, y - 26 * s); q.quadraticCurveTo(x + 9 * s, y - 6 * s, x, y + 10); });
    // 腮旋
    doubleSwirl(g, -150, -40, 58, 7, .6);
    // 口线（上唇刻线）
    cutTaper(g, curve([[-440, -24], [-360, -14], [-280, -16], [-200, -40]], false, 3), 5);
    // 脸颊月牙
    // 脸与后脑的分界：锯齿毛边
    { const b = curve([[-120, -262], [-96, -190], [-100, -110], [-130, -40], [-176, 10]], false, 3); cutTaper(g, b, 5); sawRow(g, b, 18, 12, 1, .7); }
    eye(g, kind);
  }, { seed: 43, col: COL, ss: 2 });
}
// ---------- 下颌（原点 = 铰链） ----------
function jawPiece() {
  return piece([-280, -40, 40, 150], g => {
    const upper = sawEdge(curve([[-240, -2], [-160, -4], [-80, -2], [-10, 0]], false, 3), 18, 30, 1, 0, 9);   // 下牙朝上
    const beard = sawEdge(curve([[-200, 88], [-120, 104], [-40, 90], [12, 50]], false, 3), 30, 26, -1, .3, 11);
    const out = [...upper, ...curve([[-10, 0], [16, 30], [12, 50]], false, 3), ...beard.reverse(), ...curve([[-200, 88], [-246, 60], [-252, 24], [-240, -2]], false, 3)];
    fill(g, q => trace(q, out), COL);
    inset(g, out, 5, 2.2, COL);
    cutTaper(g, curve([[-222, 26], [-150, 36], [-60, 30], [-10, 16]], false, 3), 5);
    // 舌头卷
    swirl(g, -150, 58, 20, 1.5, 6, 0, 1);
  }, { seed: 45, col: COL, ss: 2 });
}
// ---------- 鬃毛（在头后，原点 = 颈关节） ----------
function manePiece() {
  return piece([-260, -400, 170, 220], g => {
    const lobes = [[-130, -300, 74], [-40, -272, 80], [30, -196, 82], [66, -104, 80], [62, -10, 78], [24, 76, 72], [-50, 130, 62]];
    for (const [x, y, r] of lobes) fill(g, q => trace(q, P(ellipsePoly(x, y, r, r, 0, 36).slice(0, -1), true, .8, 50 + x)), COL);
    fill(g, q => trace(q, ellipsePoly(-80, -80, 170, 180, 0, 50)), COL);
    for (const [x, y, r] of lobes) { swirl(g, x - r * .08, y, r * .6, 1.7, 9, x * .01, 1); }
    for (const [x, y, r] of lobes) crescent(g, x, y, r * .9, -1.0, .9, 9);
  }, { seed: 47, col: COL, ss: 2 });
}
// ---------- 尾（原点 = 尾根） ----------
function tailPiece() {
  return piece([-120, -360, 220, 60], g => {
    const c = curve([[0, 0], [60, -30], [100, -110], [90, -200], [40, -270], [-30, -280], [-60, -230], [-30, -196]], false, 3);
    const L = [], Rr = [], n = c.length;
    for (let i = 0; i < n; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = 34 * (1 - i / n * .55);
      L.push([c[i][0] - dy / l * w, c[i][1] + dx / l * w]); Rr.push([c[i][0] + dy / l * w, c[i][1] - dx / l * w]);
    }
    const outer = sawEdge(L, 26, 30, 1, .35, 13);
    const out = [...outer, ...Rr.reverse()];
    fill(g, q => trace(q, out), COL);
    swirl(g, 14, -236, 56, 1.7, 8, 2.2, -1);
    cutTaper(g, c.slice(0, Math.floor(n * .55)), 6);
  }, { seed: 49, col: COL, ss: 2 });
}
// ---------- 腿 ----------
function upperLegPiece(col, seed) {
  return piece([-120, -60, 120, 180], g => {
    g.scale(1.1, .8);
    const back = sawEdge(curve([[64, -34], [78, 40], [58, 120], [46, 190]], false, 3), 22, 26, -1, .4, seed);
    const out = [[-76, -34], ...back, [-44, 194], ...curve([[-44, 194], [-58, 130], [-86, 40], [-76, -34]], false, 3)];
    fill(g, q => trace(q, out), col);
    // 毛：几道长锥形刻线（不做横纹）
    for (const [x, y, l] of [[-40, 40, 110], [-10, 60, 120], [20, 50, 110]]) cutTaper(g, curve([[x, y], [x - 4, y + l * .5], [x + 2, y + l]], false, 3), 7);
  }, { seed, col, ss: 2 });
}
function lowerLegPiece(col, seed) {
  return piece([-140, -40, 100, 210], g => {
    g.scale(1.12, .84);
    const back = sawEdge(curve([[46, -12], [40, 60], [48, 120], [56, 150]], false, 3), 18, 22, -1, .4, seed + 1);
    const out = [[-48, -14], ...back, ...curve([[56, 150], [58, 176], [40, 194], [-40, 196], [-96, 192], [-110, 176], [-96, 150], [-54, 128], [-40, 60], [-48, -14]], false, 3)];
    fill(g, q => trace(q, out), col);
    // 四个爪尖（向前下弯的尖月牙）
    for (const [x, k] of [[-104, 1], [-78, .95], [-52, .9], [-26, .8]]) fill(g, q => { q.moveTo(x - 12, 186); q.quadraticCurveTo(x - 20 * k, 206, x - 30 * k, 214 * 1); q.quadraticCurveTo(x - 6, 208, x + 10, 188); q.closePath(); }, col);
    for (const x of [-90, -64, -38]) cutTaper(g, [[x, 160], [x + 1, 176], [x, 192]], 5);   // 趾缝
    // 膝部旋涡（关节）
    swirl(g, -2, 16, 30, 1.8, 7, -1.2, 1);
    // 小腿两道毛线
    cutTaper(g, curve([[-24, 60], [-28, 100], [-22, 140]], false, 3), 6);
    cutTaper(g, curve([[14, 64], [12, 100], [18, 134]], false, 3), 5);
  }, { seed, col, ss: 2 });
}

export function buildNian() {
  if (N.body) return N;
  N.body = bodyPiece(); N.jaw = jawPiece(); N.mane = manePiece(); N.tail = tailPiece();
  N.head = {}; for (const k of ['normal', 'sniff', 'fierce', 'squint', 'dizzy', 'blink']) N.head[k] = headPiece(k);
  N.ul = upperLegPiece(NEAR, 51); N.ll = lowerLegPiece(NEAR, 53);
  N.ulF = upperLegPiece(FARC, 55); N.llF = lowerLegPiece(FARC, 57);
  return N;
}
export const NPOSE = {
  stand: { lean: 0, head: 0, jaw: 0, tail: 0, fnU: .05, fnL: -.05, ffU: -.1, ffL: .05, bnU: -.08, bnL: .08, bfU: .1, bfL: -.05, eye: 'normal' },
  stalk: { lean: -.1, head: -.22, jaw: 0, tail: .2, fnU: .3, fnL: -.3, ffU: -.25, ffL: .2, bnU: -.2, bnL: .35, bfU: .25, bfL: -.1, eye: 'sniff' },
  roar: { lean: .12, head: .3, jaw: .42, tail: -.25, fnU: -.25, fnL: .2, ffU: .15, ffL: -.1, bnU: .2, bnL: -.1, bfU: -.1, bfL: .1, eye: 'fierce' },
  flinch: { lean: .14, pivot: [230, 40], head: .34, jaw: .08, tail: -.8, pawUp: true, fnU: 1.05, fnL: -1.15, ffU: .1, ffL: -.05, bnU: -.3, bnL: .12, bfU: -.12, bfL: .05, eye: 'squint' },
  run: { lean: -.04, head: -.08, jaw: .15, tail: -.9, fnU: -.9, fnL: .7, ffU: .6, ffL: -.3, bnU: .9, bnL: -.5, bfU: -.6, bfL: .8, eye: 'dizzy' },
};
export function drawNian(g, C, pose, opt = {}) {
  const Np = buildNian(), p = { ...NPOSE.stand, ...pose };
  let root = mul(C, T(p.x || 0, p.y || 0));
  if (p.flip) root = mul(root, S(-1, 1));
  if (p.pivot) root = mul(mul(mul(root, T(...p.pivot)), R(p.lean || 0)), T(-p.pivot[0], -p.pivot[1])); else root = mul(root, R(p.lean || 0));
  const M = {};
  const leg = (k, at, u, l) => { M[k + 'U'] = mul(mul(root, T(...at)), R(u)); M[k + 'L'] = mul(mul(M[k + 'U'], T(...NJ.knee)), R(l)); };
  leg('ff', NJ.ff, p.ffU, p.ffL); leg('bf', NJ.bf, p.bfU, p.bfL); leg('fn', NJ.fn, p.fnU, p.fnL); leg('bn', NJ.bn, p.bnU, p.bnL);
  M.body = root; M.tail = mul(mul(root, T(...NJ.tail)), R(p.tail));
  M.head = mul(mul(mul(root, T(...NJ.neck)), R(p.head)), S(HS)); M.mane = mul(mul(mul(root, T(...NJ.neck)), R(p.head * .5)), S(HS));
  M.jaw = mul(mul(M.head, T(...NJ.jaw)), R(-p.jaw));
  const o = { shadow: opt.shadow ?? 1.6 };
  put(g, Np.ulF, M.ffU, o); put(g, Np.llF, M.ffL, o); put(g, Np.ulF, M.bfU, o); put(g, Np.llF, M.bfL, o);
  put(g, Np.tail, M.tail, o);
  put(g, Np.ul, M.bnU, o); put(g, Np.ll, M.bnL, o);
  if (!p.pawUp) { put(g, Np.ul, M.fnU, o); put(g, Np.ll, M.fnL, o); }
  put(g, Np.body, M.body, o);
  put(g, Np.mane, M.mane, o);
  put(g, Np.jaw, M.jaw, o);
  put(g, Np.head[p.eye], M.head, o);
  if (p.pawUp) { put(g, Np.ul, M.fnU, o); put(g, Np.ll, M.fnL, o); }
  if (opt.after) opt.after(M);
  return { M, joints: Object.fromEntries(Object.entries({ neck: M.head, jaw: M.jaw, tail: M.tail, fn: M.fnU, fnK: M.fnL, bn: M.bnU, bnK: M.bnL }).map(([k, m]) => [k, ap(m, [0, 0])])) };
}
