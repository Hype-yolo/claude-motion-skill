// 侠客面部特写（3/4 侧向右）：斗笠檐压在额上，线描为主、清墨托阴影。
// 局部坐标：脸心 (0,0)，额到下巴约 70 单位；expr: calm(闭目) / alert(睁眼) / resolve(决) / peace(笑)
import { mk, draw, mass, TONE } from './ink.js';
import { lerp, clamp } from '/core/lib.js';

const EXPR = {
  //   brow: 内端/外端高度偏移（负=高），eye: 0 闭 1 睁，lid: 上眼睑压低，smile: 嘴角上扬，iris: 瞳孔
  calm: { bi: 0, bo: 0, eye: 0, lid: 0, smile: 0, mouth: 0 },
  alert: { bi: -2, bo: -1, eye: 1, lid: 0, smile: 0, mouth: 0 },
  resolve: { bi: 3, bo: -2.5, eye: 1, lid: .45, smile: -1.2, mouth: 1 },
  peace: { bi: -1, bo: .5, eye: .35, lid: .2, smile: 2.2, mouth: 0 },
};
export { EXPR };

export function face(L, expr, X = {}) {
  const e = typeof expr === 'string' ? EXPR[expr] : expr;
  const x0 = X.x ?? 0, y0 = X.y ?? 0, sc = X.s ?? 1, am = X.am ?? 1;
  let idx = 0; const list = [];
  const T = p => [x0 + p[0] * sc, y0 + p[1] * sc, p[2] ?? 1];
  const S = (pts, o) => list.push({ s: mk(pts.map(T), { ...o, w: o.w * sc, seed: (X.seed ?? 11) * 1000 + (idx++) * 131 }) });
  const M = (poly, a) => list.push({ m: poly.map(T), a, seed: idx++ });
  const hatY = X.hatY ?? -30;          // 笠檐高度
  // 笠下阴影（淡墨，湿）
  S([[-40, hatY + 5], [0, hatY + 7], [38, hatY + 4]], { w: 14, tone: .34, darkDir: [0, -1], side: .9, brWet: true, body: .3, dry: .3, wet: 1, prof: 'lens', rough: .2 });
  // 脸的轮廓：远侧（右）一线浓淡，近侧（左）断续
  S([[23, hatY + 5, .6], [26.5, -9, 1.3], [24.5, 4, .8], [19, 17, 1.1], [8, 27.5, 1], [1, 29.5, .6]], { w: 2.4, tone: TONE.nong, dry: .45, prof: 'brush' });
  list.push({ m: [[26, hatY + 6], [14, hatY + 8], [12, -2], [20, 14], [24, 4]].map(T), a: .07, seed: 21 });   // 远侧脸颊清墨
  S([[-25, hatY + 8, .5], [-26.5, -8, 1.2], [-23.5, 8, 1], [-15, 21, .6]], { w: 2, tone: TONE.zhong, dry: .6, prof: 'tip' });
  // 耳
  S([[-24, -12], [-30, -9], [-30, -1], [-25, 2]], { w: 1.8, tone: TONE.zhong, dry: .5, prof: 'tip' });
  // 鬓发（干笔）
  S([[-21, hatY + 2], [-24, -18], [-26, -8]], { w: 3.6, tone: TONE.nong, dry: .7, wet: .2, prof: 'tip' });
  S([[-17, hatY + 3], [-19, -18]], { w: 2.4, tone: TONE.nong, dry: .75, prof: 'tip' });
  if (!X.hide) {
  // 剑眉：眉头重、眉尾上挑出锋
  const by = -16;
  S([[-3.5, by + e.bi], [-11, by - 2 + (e.bo + e.bi) / 2], [-20, by - 3.5 + e.bo]], { w: 3.6, tone: TONE.jiao, dry: .5, wet: .2, prof: 'nail' });
  S([[4, by + e.bi * .8], [11, by - 1.8 + (e.bo + e.bi) / 2 * .8], [18, by - 3 + e.bo * .8]], { w: 3.1, tone: TONE.jiao, dry: .55, wet: .2, prof: 'nail' });
  // 丹凤眼：上睑一笔由内眼角挑到外眼角，瞳孔被上睑压住一半
  const eye = (ci, co, far) => {    // ci 内眼角, co 外眼角
    const o = e.eye, lid = e.lid, mx = (ci[0] + co[0]) / 2, my = (ci[1] + co[1]) / 2;
    const sgn = Math.sign(co[0] - ci[0]);
    if (o < .2) {
      S([ci, [mx, my + 1.6], [co[0], co[1] - .2], [co[0] + sgn * 1.5, co[1] - 1]], { w: 1.9, tone: TONE.jiao, dry: .35, prof: 'tip' });
      return;
    }
    if (e.smile > 1) {
      S([[ci[0], ci[1] + .8], [mx, my - 1.6], [co[0], co[1] + .4]], { w: 2, tone: TONE.jiao, dry: .35, prof: 'tip' });
      S([[mx - sgn * 2, my + 2.2], [mx + sgn * 2, my + 2]], { w: .8, tone: TONE.dan, dry: .6, prof: 'tip' });
      return;
    }
    const up = lerp(-2.6, -1, lid);
    const ir = far ? 1.8 : 2.2;
    list.push({ dot: T([mx + sgn * (far ? -.3 : .4), my + .6 + lid * .5]), r: ir * sc, a: .9 });
    S([ci, [lerp(ci[0], co[0], .4), my + up], [co[0], co[1] + up * .2], [co[0] + sgn * 2, co[1] - 1.4]], { w: 2.4, tone: TONE.jiao, dry: .3, prof: 'nail' });
    S([[lerp(ci[0], co[0], .25), my + 2], [lerp(ci[0], co[0], .8), my + 1.6]], { w: .8, tone: TONE.zhong, dry: .6, prof: 'tip' });
  };
  eye([-4, -7.5], [-17, -8.5], false); eye([5, -7.5], [16, -8.3], true);
  }
  // 鼻：一笔由眉间下到鼻翼
  S([[3, -12], [5, -2], [7.5, 5], [4, 8.5], [0, 8]], { w: 1.8, tone: TONE.zhong, dry: .4, prof: 'brush' });
  // 髭（两笔下垂）
  S([[-.5, 12], [-6, 14.5], [-11, 19]], { w: 1.6, tone: TONE.nong, dry: .65, prof: 'tip' });
  S([[3, 12], [8, 14], [12, 18]], { w: 1.4, tone: TONE.nong, dry: .65, prof: 'tip' });
  // 嘴
  const sm = e.smile;
  S([[-5, 17.5 - sm * .8], [1, 17.5 + sm * .2 + e.mouth * .3], [7, 17 - sm * .7]], { w: 1.7 + e.mouth * .4, tone: TONE.nong, dry: .35, prof: 'tip' });
  // 颏须
  S([[2, 24], [2.5, 32], [1, 40]], { w: 2, tone: TONE.nong, dry: .7, prof: 'tip' });
  S([[6, 23], [7.5, 31], [7, 37]], { w: 1.4, tone: TONE.zhong, dry: .75, prof: 'tip' });
  // 颈与交领
  S([[-14, 26], [-15, 40]], { w: 1.6, tone: TONE.dan * 1.4, dry: .6, prof: 'tip' });
  S([[16, 22], [17, 36]], { w: 1.6, tone: TONE.zhong, dry: .55, prof: 'tip' });
  list.push({ m: [[-60, 64], [-44, 44], [-24, 40], [-6, 46], [8, 60], [12, 47], [26, 38], [46, 42], [58, 64]].map(T), a: .15, seed: 9, g: [0, T([0, 40])[1], 0, T([0, 64])[1], 1, 0] });
  S([[-26, 40], [-6, 46], [8, 59]], { w: 3.6, tone: TONE.nong, dry: .45, wet: .2, prof: 'brush' });
  S([[28, 38], [12, 46], [4, 56]], { w: 3.2, tone: TONE.nong, dry: .5, wet: .2, prof: 'brush' });
  S([[-56, 62], [-44, 45], [-26, 40]], { w: 3, tone: TONE.zhong, dry: .6, prof: 'tip' });
  S([[54, 62], [44, 44], [28, 38]], { w: 2.6, tone: TONE.zhong, dry: .65, prof: 'tip' });
  // 斗笠：一块浓墨（上浅下深）+ 两笔含墨压出锥面明暗 + 几丝干笔竹篾 + 笠檐焦墨一线
  const ap = [2, hatY - 44];
  list.push({ m: [[-86, hatY], [ap[0] - 3, ap[1]], [ap[0] + 3, ap[1]], [90, hatY - 1], [40, hatY + 2.5], [-40, hatY + 3]].map(T), a: .66, seed: 5, g: [0, T([0, ap[1]])[1], 0, T([0, hatY])[1], .75, 1.1] });
  [-58, -22, 16, 50].forEach(bx => S([[ap[0], ap[1] + 4], [bx, hatY - 2]], { w: 1.6, tone: TONE.jiao, dry: .8, prof: 'tip' }));
  S([[-88, hatY + .5, .7], [-30, hatY + 3, 1], [30, hatY + 3, 1.1], [92, hatY - .5, .7]], { w: 3.6, tone: TONE.jiao, dry: .4, wet: .2, prof: 'brush' });
  // 画
  for (const it of list) {
    if (it.s) draw(L, it.s, 1, am);
    else if (it.m) mass(L.wet, it.m, it.a * am, .5 * sc, it.seed, it.g || null);
    else if (it.dot) { const c = L.dry; c.globalAlpha = clamp(it.a * am); c.fillStyle = '#000'; c.beginPath(); c.arc(it.dot[0], it.dot[1], it.r, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  }
  // 笠檐的水珠
  if (X.drop != null && X.drop >= 0) {
    const d = X.drop, px = T([30 + d * 2, hatY + 3 + d * d * 60]);
    const c = L.wet; c.globalAlpha = clamp((1 - d * .6) * .55 * am); c.fillStyle = '#000';
    c.beginPath(); c.ellipse(px[0], px[1], 1.6 * sc, 2.4 * sc, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  }
}
