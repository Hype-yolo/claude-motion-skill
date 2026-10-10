// 无名侠客：写意造型，几笔成形。姿势 = 关节字典（局部坐标，身高 100，y 向下为正，脚底为原点，面朝右）。
// 每一帧按姿势重新生成笔触（种子固定 → 笔毫纹理稳定），面朝左时镜像。
import { mk, draw, mass, TONE } from './ink.js';
import { lerp, clamp, vnoise } from '/core/lib.js';

export const VERM = [176, 46, 34];

// ---------------- 姿势 ----------------
// 侧面（side）关节：H 胯 C 肩 Hd 头心 aF/aB 前后臂[肩,肘,手] lF/lB 前后腿[胯,膝,脚] hemF/hemB 前后摆 flare 摆尾飘出
// sword: {m:'sheath'|'hand', g 护手位置, a 鞘的方向} 或 {m:'hand', a 剑身方向}；rib 飘带方向与长度
export const POSE = {
  stand: {
    v: 'side', H: [-.5, -46], C: [1.5, -75], Hd: [3.5, -83], tilt: .03,
    aF: [[2.5, -74], [7, -60], [11.5, -50]], aB: null,
    lF: [[1, -46], [3, -23], [4, 0]], lB: [[-1, -46], [-2, -23], [-4, 0]],
    hemF: [10, -6], hemB: [-14, -6.5], flare: .6,
    sheath: [9, -49, 2.5], sword: null, rib: [-1, .08, 22],
  },
  // 轻功腾空：前膝提起，后腿拖直，身体前倾，双袖向后，袍摆长长拖在后面
  leap: {
    v: 'side', H: [0, -52], C: [14, -70], Hd: [21, -76.5], tilt: -.28,
    aF: [[13, -69], [3, -64.5], [-8, -63]], aB: [[12, -69.5], [1, -71], [-11, -73.5]],
    lF: [[2, -52], [15, -47], [6, -38]], lB: [[-1, -52], [-11, -44], [-20, -38]],
    hemF: [11, -43], hemB: [-44, -58], flare: 1.5,
    sheath: [6, -56, 3.05], sword: null, rib: [-1, -.2, 46],
  },
  // 点水：单脚点水，另一腿收起
  touch: {
    v: 'side', H: [0, -46], C: [8, -72], Hd: [12.5, -80], tilt: -.14,
    aF: [[8, -71], [0, -64], [-9, -60]], aB: [[7, -71.5], [-2, -71], [-12, -72]],
    lF: [[1, -46], [5, -23], [3, 0]], lB: [[-1, -46], [11, -38], [4, -28]],
    hemF: [10, -9], hemB: [-32, -30], flare: 1.2,
    sheath: [3, -48, 2.7], sword: null, rib: [-1, -.05, 34],
  },
  // 滑停：重心后坐，前脚撑，袍摆向前甩
  skid: {
    v: 'side', H: [-3, -38], C: [-5, -65], Hd: [-3.5, -73.5], tilt: .08,
    aF: [[-4, -64], [5, -56], [13, -54]], aB: [[-6, -64], [-15, -58], [-23, -62]],
    lF: [[-2, -38], [10, -21], [20, 0]], lB: [[-4, -38], [-10, -18], [-14, 0]],
    hemF: [16, -6], hemB: [-12, -4], flare: -.4,
    sheath: [4, -41, 2.6], sword: null, rib: [1, .05, 18],
  },
  walk1: {
    v: 'side', H: [0, -46], C: [1.5, -75], Hd: [3.5, -83], tilt: 0,
    aF: [[2, -74], [7, -60], [11.5, -50]], aB: null,
    lF: [[1, -46], [5, -23], [8, 0]], lB: [[-1, -46], [-4, -23], [-8, 0]],
    hemF: [12, -6], hemB: [-13, -5.5], flare: .3,
    sheath: [9, -49, 2.5], sword: null, rib: [-1, .08, 22],
  },
  walk2: {
    v: 'side', H: [0, -47], C: [1.5, -76], Hd: [3.5, -84], tilt: 0,
    aF: [[2, -75], [7, -61], [11.5, -51]], aB: null,
    lF: [[1, -47], [1, -24], [0, -1]], lB: [[-1, -47], [-1, -24], [1, -2]],
    hemF: [10, -6], hemB: [-12, -5.5], flare: .3,
    sheath: [9, -50, 2.5], sword: null, rib: [-1, .08, 22],
  },
  // 拔剑（侧面），剑指前方
  draw: {
    v: 'side', H: [0, -46], C: [2, -75], Hd: [4, -83], tilt: -.04,
    aF: [[3, -74], [15, -72], [28, -74]], aB: [[0, -74], [-8, -66], [-15, -62]],
    lF: [[1, -46], [8, -23], [13, 0]], lB: [[-1, -46], [-7, -23], [-10, 0]],
    hemF: [14, -6], hemB: [-15, -5.5], flare: .5,
    sheath: [7, -49, 2.55], sword: { a: -.1 }, rib: [-1, .02, 28],
  },
  front: {
    v: 'front', H: [0, -46], C: [0, -75], Hd: [0, -83], tilt: 0,
    aL: [[-8.5, -74], [-11, -60], [-11.5, -48]], aR: [[8.5, -74], [11, -60], [11.5, -48]],
    lL: [[-3, -46], [-4, -23], [-4.5, 0]], lR: [[3, -46], [4, -23], [4.5, 0]],
    hemL: [-14, -5.5], hemR: [14, -5.5], sheath: [-8, -48, 2.2], rib: [0, 1, 0],
  },
  // 抱拳一礼：左掌包右拳，头微低
  bow: {
    v: 'front', H: [0, -46], C: [0, -74], Hd: [0, -81.5], tilt: 0,
    aL: [[-8.5, -73], [-13, -63], [-2, -65]], aR: [[8.5, -73], [13, -63], [2, -65]],
    lL: [[-3, -46], [-4, -23], [-4.5, 0]], lR: [[3, -46], [4, -23], [4.5, 0]],
    hemL: [-14, -5.5], hemR: [14, -5.5], sheath: [-8, -48, 2.2], fist: 1, rib: [0, 1, 0],
  },
  back: {
    v: 'back', H: [0, -46], C: [0, -75], Hd: [0, -83], tilt: 0,
    aL: [[-8.5, -74], [-11, -60], [-11.5, -48]], aR: [[8.5, -74], [11, -60], [11.5, -48]],
    lL: [[-3, -46], [-4, -23], [-4.5, 0]], lR: [[3, -46], [4, -23], [4.5, 0]],
    hemL: [-14, -5.5], hemR: [14, -5.5], sheath: [8, -48, .8], rib: [.3, 1, 14],
  },
  // 背面执剑写字：右臂高举，剑向右上
  backWrite: {
    v: 'back', H: [0, -46], C: [1, -75], Hd: [0, -83], tilt: -.04,
    aL: [[-8.5, -74], [-14, -63], [-16, -54]], aR: [[8.5, -74], [19, -81], [29, -90]],
    lL: [[-3, -46], [-8, -23], [-11, 0]], lR: [[3, -46], [7, -23], [10, 0]],
    hemL: [-16, -5.5], hemR: [16, -5.5], sheath: [-8, -48, 2.3], sword: { a: -.9 }, rib: [-1, .2, 22],
  },
};

// 递归插值两个姿势（数组/数字），非数值取 b
export function mixPose(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mixPose(x, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const k in b) o[k] = k in a ? mixPose(a[k], b[k], t) : b[k]; return o; }
  return t < .5 ? a : b;
}

// ---------------- 笔触生成 ----------------
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]], mid = (a, b, t = .5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const rot = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * co - y * s, c[1] + x * s + y * co]; };

// 从 knee→foot 找到摆下沿以下的部分
function legBelow(l, hemY) {
  const [hp, kn, ft] = l;
  if (kn[1] >= hemY) { const u = clamp((hemY - hp[1]) / ((kn[1] - hp[1]) || 1)); return [mid(hp, kn, u), kn, ft]; }
  const u = clamp((hemY - kn[1]) / ((ft[1] - kn[1]) || 1)); return [mid(kn, ft, u), ft];
}

function hatStrokes(S, Hd, tilt, half = 20, M, skew = 0) {
  const R = p => rot(p, Hd, tilt);
  const by = Hd[1] - 3, ap = [Hd[0] + skew, by - 11.5];
  const bl = [Hd[0] - half * .92, by + .4], br = [Hd[0] + half * 1.05, by + .8], bc = [Hd[0] + skew * .3, by + 1.6];
  // 斗笠：一块浓墨（湿）铺出锥面，两条干笔勾出笠坡，笠檐一线焦墨
  M([R(ap), R(add2(mid(ap, bl), [-.6, -.8])), R(bl), R(bc), R(br), R(add2(mid(ap, br), [.6, -.8]))], .5);
  S([R(add2(bl, [2, -1])), R(add2(bc, [0, -1.6])), R(add2(br, [-2, -1]))], LOAD(4, .55, [0, 1], { dry: .5, prof: 'lens' }));
  S([R(add2(ap, [-.3, .3])), R(add2(mid(ap, bl), [-.6, -.6])), R(bl)], { w: 2.4, tone: TONE.jiao, wet: .2, dry: .5, prof: 'nail' });
  S([R(add2(ap, [.3, .3])), R(add2(mid(ap, br), [.6, -.6])), R(br)], { w: 2.2, tone: TONE.jiao, wet: .2, dry: .55, prof: 'nail' });
  S([R(add2(ap, [.5, 2.5])), R(mid(bl, br, .62))], { w: 1, tone: TONE.nong, dry: .85, prof: 'tip' });   // 竹篾
  S([R([bl[0] - 1.2, bl[1] + .2]), R(bc), R([br[0] + 1.2, br[1] + .2])], { w: 1.9, tone: TONE.jiao, wet: .1, dry: .45, prof: 'tip' });
}

function swordStrokes(S, g, a, len, hilt = 7, inHand = false) {
  const d = [Math.cos(a), Math.sin(a)];
  const tip = [g[0] + d[0] * len, g[1] + d[1] * len], pom = [g[0] - d[0] * hilt, g[1] - d[1] * hilt];
  if (inHand) S([g, mid(g, tip, .5), tip], { w: 1.5, tone: TONE.jiao, dry: .15, wet: 0, prof: 'tip', rough: .05 });   // 剑身：一线焦墨
  else S([g, mid(g, tip, .5), tip], { w: 2.6, tone: TONE.zhong, dry: .3, wet: .2, prof: 'even', rough: .08 });        // 鞘
  S([g, pom], { w: 2.1, tone: TONE.jiao, dry: .25, prof: 'even' });
  const n = [-d[1], d[0]];
  S([[g[0] + n[0] * 2.8, g[1] + n[1] * 2.8], [g[0] - n[0] * 2.8, g[1] - n[1] * 2.8]], { w: 2, tone: TONE.jiao, dry: .2, prof: 'even' });
  return { tip, pom };
}

function tassel(S, pom, t, wind = [0, 0]) {
  const sw = Math.sin(t * 5.1) * .8, sw2 = Math.sin(t * 7.3 + 1) * 1;
  S([[pom[0], pom[1] + .3], [pom[0] + .6 + wind[0] * 1.5 + sw * .3, pom[1] + 3 + wind[1]], [pom[0] + wind[0] * 3.5 + sw, pom[1] + 6 + wind[1] * 2], [pom[0] + .8 + wind[0] * 6 + sw2, pom[1] + 8.5 + wind[1] * 3]],
    { w: 1.7, color: VERM, tone: .9, dry: .35, prof: 'brush', nb: 5 });
}

function ribbon(S, p0, rib, t, w = 1.5) {
  const [dx, dy, L] = rib; if (L <= 0) return;
  const pts = []; const n = 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n, wav = Math.sin(t * 6.3 - u * 5.5) * 2.2 * u;
    pts.push([p0[0] + dx * L * u - dy * wav, p0[1] + dy * L * u + dx * wav * .9 + u * u * 2]);
  }
  S(pts, { w, tone: TONE.zhong, dry: .45, wet: .1, prof: 'tip' });
}

const curve = (a, c, b, n) => { const o = []; for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1), u = 1 - t; o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return o; };
// 含墨一笔（笔尖浓、笔根淡）：没骨法，浓的一侧就是轮廓
const LOAD = (w, tone, dark, o = {}) => ({ w, tone, darkDir: dark, side: o.side ?? .85, brWet: true, body: o.body ?? .18, dry: o.dry ?? .38, wet: .9, prof: o.prof || 'robe', nb: o.nb, rough: .12 });

function faceSide(S, Hd, tilt) {
  const R = p => rot(p, Hd, tilt);
  // 脸：一笔清墨（湿），笠下阴影一笔淡墨
  S([R([Hd[0] + .5, Hd[1] - 1.5]), R([Hd[0] + 2.2, Hd[1] + 2.2]), R([Hd[0] + 1.2, Hd[1] + 4.8])], { w: 5.5, tone: .1, wet: 1, dry: 0, prof: 'lens' });
  S([R([Hd[0] - 2.5, Hd[1] - 2]), R([Hd[0] + 3.5, Hd[1] - 2.2])], { w: 2.4, tone: .3, wet: 1, dry: .1, prof: 'lens' });
  S([R([Hd[0] + 3.4, Hd[1] - 1.8]), R([Hd[0] + 4.6, Hd[1] + .8]), R([Hd[0] + 3.6, Hd[1] + 2]), R([Hd[0] + 4, Hd[1] + 3.6]), R([Hd[0] + 2.4, Hd[1] + 5.2])], { w: 1.2, tone: TONE.nong, dry: .35, prof: 'tip' });   // 侧脸一线
  S([R([Hd[0] + 3.2, Hd[1] + 4.3]), R([Hd[0] + 2.4, Hd[1] + 8.2])], { w: 1.1, tone: TONE.nong, dry: .55, prof: 'tip' });   // 须
  S([R([Hd[0] - 2.6, Hd[1] - 1.5]), R([Hd[0] - 3.2, Hd[1] + 2.5])], { w: 2.2, tone: TONE.nong, wet: .3, dry: .4, prof: 'tip' });   // 鬓
}

function sideStrokes(P, S, M, t) {
  const [hx, hy] = P.H, [cx, cy] = P.C, Hd = P.Hd;
  const nape = [Hd[0] - 3.5, Hd[1] + 5], bw = [hx - 7, hy - 1], fw = [hx + 7, hy - 2], chestF = [cx + 5, cy + 1.5];
  const tail = [P.hemB[0] - 6 * P.flare, P.hemB[1] - 3 * Math.abs(P.flare)];
  const hemC = [lerp(P.hemB[0], P.hemF[0], .5), Math.max(P.hemB[1], P.hemF[1]) + 1];
  const hem = curve(tail, hemC, P.hemF, 4);
  // 后臂（身后，最淡）
  if (P.aB) {
    const [s, e, h] = P.aB;
    S([s, e, h], LOAD(7.5, .4, [0, 1], { dry: .5 }));
  }
  // 腿（摆下，先画，被袍压住）
  const hemAt = x => {  // 下摆曲线在 x 处的高度
    let best = hem[0][1], bd = 1e9;
    for (let i = 0; i < 40; i++) { const u = i / 39, q = curve(tail, hemC, P.hemF, 40)[i]; const d = Math.abs(q[0] - x); if (d < bd) { bd = d; best = q[1]; } }
    return best;
  };
  for (const l of [P.lB, P.lF]) {
    const kx = lerp(l[1][0], l[2][0], .3);
    const seg = legBelow(l, hemAt(kx) + 1.5);
    S(seg, { w: 2, tone: TONE.nong, dry: .4, wet: .1, prof: 'even' });
    const ft = l[2];
    S([[ft[0] - 1, ft[1] - .3], [ft[0] + 4, ft[1] + .3]], { w: 2.8, tone: TONE.jiao, dry: .2, wet: .2, prof: 'nail' });
  }
  // 袍：一块清墨打底 + 背一笔含墨（浓边在背）+ 前一笔含墨（浓边在前）
  M([nape, chestF, add2(fw, [1, 0]), P.hemF, ...hem.slice(1, -1).reverse(), tail, add2(bw, [-1, 0])], .19 + .05 * clamp(P.flare - .8));
  S([[nape[0] + .5, nape[1] - 1], add2(mid(nape, bw), [-1.6, 0]), [bw[0] - .8, bw[1]], add2(mid(bw, tail, .55), [-1.4, 0]), tail], LOAD(10, .78, [-1, 0], { dry: .42 }));
  S([[chestF[0] - 1, chestF[1] - 1.5], add2(mid(chestF, fw), [1, 0]), fw, add2(mid(fw, P.hemF), [.6, 0]), P.hemF], LOAD(7, .55, [1, 0], { dry: .5 }));
  // 衣褶（干、细）
  S([add2(mid(nape, chestF, .5), [0, 7]), add2(mid(bw, fw, .45), [0, 2]), hem[1]], { w: 1.2, tone: TONE.zhong, dry: .75, prof: 'tip' });
  // 交领
  S([[Hd[0] - 1.5, Hd[1] + 6], [cx + 3.5, cy + 3.5], [fw[0] - 1, fw[1] - 6]], { w: 2.1, tone: TONE.nong, dry: .45, prof: 'tip' });
  // 下摆一线
  S(hem.map((p, i) => [p[0], p[1] + (i === 0 || i === hem.length - 1 ? 0 : .8)]), { w: 1.6, tone: TONE.zhong, dry: .7, prof: 'tip' });
  // 腰带：一笔焦墨 + 垂下的带尾
  S([[bw[0] - 1, bw[1] - 1.5], [hx, hy - 2.5], [fw[0] + 1.2, fw[1] - 2]], { w: 3.4, tone: TONE.jiao, dry: .3, wet: .2, prof: 'nail' });
  S([[bw[0] + 1, bw[1] - 1], [bw[0] - 2 + P.rib[0] * 3, bw[1] + 6], [bw[0] - 1 + P.rib[0] * 6, bw[1] + 12]], { w: 1.7, tone: TONE.nong, dry: .45, prof: 'tip' });
  // 鞘（腰间）
  let pom = null;
  if (P.sheath) {
    const [gx, gy, a] = P.sheath;
    if (P.sword) { const d = [Math.cos(a), Math.sin(a)]; S([[gx, gy], [gx + d[0] * 36, gy + d[1] * 36]], { w: 2.4, tone: TONE.zhong, dry: .35, wet: .2, prof: 'even' }); }
    else pom = swordStrokes(S, [gx, gy], a, 36).pom;
  }
  // 前臂：宽袖 = 一块清墨 + 一笔含墨（浓边在袖底）+ 袖口焦墨
  {
    const [sh, e, h] = P.aF, droop = add2(mid(e, h, .6), [-.5, 7.5]);
    M([add2(sh, [-2, -1]), add2(e, [0, -2]), add2(h, [0, -2.2]), add2(h, [.5, 4]), droop, add2(e, [-1, 3])], .12);
    S([[sh[0] - 1, sh[1] - .5], add2(e, [0, 1]), add2(h, [0, .5])], LOAD(7, .5, [0, 1], { dry: .45 }));
    S([add2(e, [-.5, 3]), droop, add2(h, [.4, 4.2])], LOAD(3.5, .7, [0, 1], { dry: .5, prof: 'tip' }));
    S([add2(h, [-.4, -1.5]), add2(h, [.3, 3.2])], { w: 1.8, tone: TONE.nong, dry: .45, prof: 'tip' });
  }
  // 剑在手
  if (P.sword) { const h = P.aF[2]; pom = swordStrokes(S, add2(h, [1.5, 0]), P.sword.a, 42, 6, true).pom; }
  // 脸、斗笠、飘带
  faceSide(S, Hd, P.tilt);
  hatStrokes(S, Hd, P.tilt, 20, M, -1);
  const R = p => rot(p, Hd, P.tilt);
  ribbon(S, R([Hd[0] - 4, Hd[1] - 1]), P.rib, t);
  if (pom) tassel(S, pom, t, [P.rib[0] * .5, 0]);
}

function frontStrokes(P, S, M, t, back = false) {
  const [hx, hy] = P.H, [cx, cy] = P.C, Hd = P.Hd;
  const sL = [cx - 8.5, cy + 1.5], sR = [cx + 8.5, cy + 1.5];
  const nL = [Hd[0] - 4.5, Hd[1] + 6], nR = [Hd[0] + 4.5, Hd[1] + 6];
  const wL = [hx - 7.5, hy - 1], wR = [hx + 7.5, hy - 1];
  const hemC = [hx, Math.max(P.hemL[1], P.hemR[1]) + 1.2];
  const hem = curve(P.hemL, hemC, P.hemR, 5);
  const sleeve = (a, side) => {
    const [sh, e, h] = a, droop = add2(mid(e, h, .55), [side * 2.5, 8]);
    M([add2(sh, [-side * 2, -1]), add2(e, [side * 1.5, -1]), add2(h, [0, -1.5]), add2(h, [0, 4]), droop, add2(e, [-side * 1, 3])], .12);
    S([sh, add2(e, [side * 1, 1]), h], LOAD(7, .5, [side, .3], { dry: .45 }));
    S([add2(e, [side * 1.5, 3]), droop, add2(h, [0, 4.2])], LOAD(3.5, .66, [side, 1], { dry: .5, prof: 'tip' }));
  };
  // 腿
  for (const l of [P.lL, P.lR]) {
    const seg = legBelow(l, hemC[1] - 3);
    S(seg, { w: 2.2, tone: TONE.nong, dry: .35, wet: .1, prof: 'even' });
    const ft = l[2]; S([[ft[0] - 1.8, ft[1]], [ft[0] + 1.8, ft[1] + .3]], { w: 3, tone: TONE.jiao, dry: .2, wet: .2, prof: 'even' });
  }
  // 袍：一块清墨 + 左右两笔含墨（浓边在外）
  M([nL, sL, add2(wL, [-1, 0]), ...hem, add2(wR, [1, 0]), sR, nR], .19);
  S([add2(nL, [-.5, -1]), add2(mid(sL, wL), [-1.2, 0]), add2(wL, [-.8, 0]), add2(mid(wL, P.hemL), [-.8, 0]), P.hemL], LOAD(8.5, back ? .72 : .66, [-1, 0], { dry: .42 }));
  S([add2(nR, [.5, -1]), add2(mid(sR, wR), [1.2, 0]), add2(wR, [.8, 0]), add2(mid(wR, P.hemR), [.8, 0]), P.hemR], LOAD(8, back ? .68 : .6, [1, 0], { dry: .46 }));
  S(hem, { w: 1.5, tone: TONE.zhong, dry: .7, prof: 'tip' });
  if (!back) {
    S([[Hd[0] - 4, Hd[1] + 5.5], [Hd[0] + 1, cy + 4], [hx + 4.5, hy - 4]], { w: 2.2, tone: TONE.nong, dry: .45, prof: 'tip' });   // 交领（右衽）
    S([[Hd[0] + 4, Hd[1] + 5.5], [Hd[0] + 1.5, cy + 2]], { w: 2, tone: TONE.nong, dry: .45, prof: 'tip' });
    S([add2(wL, [3, 3]), add2(hem[1], [.8, -1])], { w: 1.1, tone: TONE.zhong, dry: .75, prof: 'tip' });
    S([add2(wR, [-2.5, 3]), add2(hem[3], [-.8, -1])], { w: 1.1, tone: TONE.zhong, dry: .75, prof: 'tip' });
  } else {
    S([[Hd[0], Hd[1] + 7], [cx + .3, cy + 12], [hx, hy - 3], [hx - .5, hy + 20]], { w: 1.3, tone: TONE.zhong, dry: .7, prof: 'tip' });   // 背缝
  }
  S([[wL[0] - 1, wL[1] - 2.5], [hx, hy - 3.2], [wR[0] + 1, wR[1] - 2.5]], { w: 3.4, tone: TONE.jiao, dry: .3, wet: .2, prof: 'nail' });
  let pom = null;
  if (P.sheath) {
    const [gx, gy, a] = P.sheath;
    if (P.sword) { const d = [Math.cos(a), Math.sin(a)]; S([[gx, gy], [gx + d[0] * 30, gy + d[1] * 30]], { w: 2.4, tone: TONE.zhong, dry: .35, wet: .2, prof: 'even' }); }
    else pom = swordStrokes(S, [gx, gy], a, back ? 32 : 28, 6).pom;
  }
  sleeve(P.aL, -1); sleeve(P.aR, 1);
  if (P.fist) {
    const h = mid(P.aL[2], P.aR[2]);
    S([add2(h, [-2.4, -1.2]), add2(h, [2.4, -1])], { w: 4.4, tone: .2, wet: .8, dry: .1, prof: 'dot' });
    S([add2(h, [-2.8, -2.8]), add2(h, [-3.3, .8]), add2(h, [2.2, 1.4])], { w: 1.2, tone: TONE.nong, dry: .4, prof: 'tip' });
  } else if (!P.sword) {
    for (const a of [P.aL, P.aR]) { const h = a[2]; S([add2(h, [0, 3.8]), add2(h, [0, 6.2])], { w: 2.6, tone: .2, wet: .7, dry: .1, prof: 'dot' }); }
  }
  if (P.sword) { const h = P.aR[2]; pom = swordStrokes(S, h, P.sword.a, 42, 6, true).pom; }
  const R = p => rot(p, Hd, P.tilt);
  if (!back) {
    S([R([Hd[0], Hd[1] - 1.5]), R([Hd[0], Hd[1] + 3])], { w: 7, tone: .1, wet: 1, dry: 0, prof: 'lens' });            // 脸
    S([R([Hd[0] - 4, Hd[1] - 2.2]), R([Hd[0] + 4, Hd[1] - 2.2])], { w: 2.4, tone: .3, wet: 1, dry: .1, prof: 'lens' }); // 笠影
    S([R([Hd[0] - 3.4, Hd[1] + .5]), R([Hd[0] - 2.2, Hd[1] + 3.6]), R([Hd[0], Hd[1] + 4.6]), R([Hd[0] + 2.2, Hd[1] + 3.6]), R([Hd[0] + 3.4, Hd[1] + .5])], { w: 1.1, tone: TONE.nong, dry: .45, prof: 'tip' });
    S([R([Hd[0], Hd[1] + 3.8]), R([Hd[0] + .3, Hd[1] + 7.5])], { w: 1.2, tone: TONE.nong, dry: .55, prof: 'tip' });
    S([R([Hd[0] - 2.2, Hd[1] + 1.4]), R([Hd[0], Hd[1] + 1]), R([Hd[0] + 2.2, Hd[1] + 1.4])], { w: 1, tone: TONE.nong, dry: .5, prof: 'tip' });
    S([R([Hd[0] - 3.8, Hd[1] - 1.5]), R([Hd[0] - 4.2, Hd[1] + 2])], { w: 1.8, tone: TONE.nong, wet: .3, dry: .4, prof: 'tip' });
    if (P.eyes) {   // 抱拳时的笑眼：两弯
      S([R([Hd[0] - 3.2, Hd[1] - .2]), R([Hd[0] - 1.9, Hd[1] - .9]), R([Hd[0] - .8, Hd[1] - .2])], { w: .9, tone: TONE.jiao, dry: .3, prof: 'tip' });
      S([R([Hd[0] + .8, Hd[1] - .2]), R([Hd[0] + 1.9, Hd[1] - .9]), R([Hd[0] + 3.2, Hd[1] - .2])], { w: .9, tone: TONE.jiao, dry: .3, prof: 'tip' });
    }
    S([R([Hd[0] + 3.8, Hd[1] - 1.5]), R([Hd[0] + 4.2, Hd[1] + 2])], { w: 1.8, tone: TONE.nong, wet: .3, dry: .4, prof: 'tip' });
  } else {
    S([R([Hd[0], Hd[1] - 1]), R([Hd[0], Hd[1] + 4])], { w: 7.5, tone: .34, wet: .9, dry: .2, prof: 'lens' });          // 后脑发
    ribbon(S, R([Hd[0] - 1, Hd[1] + 2]), [P.rib[0] - .15, P.rib[1], P.rib[2]], t, 1.2);
    ribbon(S, R([Hd[0] + 1, Hd[1] + 2]), [P.rib[0] + .15, P.rib[1], P.rib[2] * .85], t + .7, 1.2);
  }
  hatStrokes(S, Hd, P.tilt, 20, M);
  if (pom) tassel(S, pom, t);
}

// 画侠客。X: {x, y, s, dir, seed, t, am, p(被画出来的进度 0..1), boil}
export function hero(L, pose, X = {}) {
  const x0 = X.x ?? 0, y0 = X.y ?? 0, sc = X.s ?? 1, dir = X.dir ?? 1, t = X.t ?? 0, am = X.am ?? 1;
  const list = [];
  let idx = 0;
  const T = p => [x0 + p[0] * sc * dir, y0 + p[1] * sc, p[2] ?? 1];
  const S = (pts, o) => {
    const oo = { ...o, w: o.w * sc, seed: (X.seed ?? 7) * 1000 + (idx++) * 97, gapLen: 45 * sc, boil: X.boil ? (Math.floor(X.boil) % 5) : 0 };
    if (o.darkDir) oo.darkDir = [o.darkDir[0] * dir, o.darkDir[1]];
    list.push({ s: mk(pts.map(T), oo) });
  };
  const M = (poly, a) => { list.push({ m: poly.map(T), a, seed: idx++ }); };
  if (pose.v === 'side') sideStrokes(pose, S, M, t);
  else frontStrokes(pose, S, M, t, pose.v === 'back');
  const p = X.p ?? 1, N = list.length;
  for (let i = 0; i < N; i++) {
    const it = list[i];
    const pi = p >= 1 ? 1 : (p - i / N * .8) / .25;
    if (pi <= 0) continue;
    if (it.s) draw(L, it.s, pi, am);
    else mass(L.wet, it.m, it.a * am * clamp(pi), .6 * sc, it.seed);
  }
  return list;
}
