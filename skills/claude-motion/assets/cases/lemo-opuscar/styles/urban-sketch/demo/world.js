// 静态世界：整页公园速写（5120×2880 世界坐标 = 最后拉远时的整页）
// 画进四张画布：color（淡彩）、inkA/timeA（开场扩散的线稿）、inkB/timeB（天际线，按笔顺）
import { rng, fbm, n2, hex, mix3, lerp, clamp, ellipse, spline, penStroke, rasterPen, wash, reserve, dab, foliage, crownDepth, figure, drawPrims, TAU, LEAF } from './engine.js';

export const W = 5120, H = 2880;
export const WIN_A = [0, 5.0], WIN_B = [15.3, 3.9];
export const depthS = Y => .3 + (Y - 1600) / 900 * .78;          // 深度比例（1 = 前景）
export const FIG_H = 480;                                          // 前景人物身高（像素）
export const ORIGIN = [2950, 2250];                                // 线稿从这里向外长
export const LAMP = { x: 1120, y: 2200, top: 1440 };
export const PATH = [[-80, 2335], [400, 2262], [900, 2165], [1350, 2045], [1750, 1912], [2100, 1797], [2420, 1724], [2620, 1690]];
export const POND = [[3780, 2800], [3830, 2660], [3990, 2600], [4250, 2572], [4600, 2562], [4950, 2572], [5160, 2600], [5160, 2900], [3760, 2900]];
export const BRIDGE = { x0: 4300, x1: 4980, deck: 2462, rail: 2418, a0: 4420, a1: 4860, apex: 2505, water: 2645 };
export const BLANKET = [[2690, 2478], [3240, 2484], [3196, 2362], [2728, 2356]];
export const CROWNS = {};   // 命名的树冠（节拍树、前景大树），供到达场和遮挡用

const C = {
  sky: hex('#9fbcd6'), skyDeep: hex('#86a6c8'), cloud: hex('#b7b3c9'),
  lime: hex('#d8c6a0'), ochre: hex('#cfaa72'), glass: hex('#98b1c8'), glassD: hex('#7892ad'), stone: hex('#c7b396'), haze: hex('#b9c0cc'), brick: hex('#c49a7a'),
  lawnFar: hex('#a3b466'), lawn: hex('#c3c96f'), lawnLit: hex('#dcd98b'), lawnShade: hex('#7f9c52'), shadow: hex('#6f8a55'),
  path: hex('#d8ccb1'), pathEdge: hex('#b8a98c'), water: hex('#8fb2ae'), waterD: hex('#5d8280'), bridge: hex('#d7ccb5'), bridgeD: hex('#80898a'),
  lamp: hex('#3c4640'), bark: hex('#8a735e'), barkD: hex('#5d4c40'),
  plaid: hex('#dcd4c0'), plaidB: hex('#7d8fae'), plaidR: hex('#c07a68'), wicker: hex('#bf904f'),
};

function cv(w, h, fill) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); if (fill) { x.fillStyle = fill; x.fillRect(0, 0, w, h); } return [c, x]; }

// 页面边缘：左、下、右下碎成色点溶进纸；左下角留出写片名的空白
export function pageMask(x, y) {
  const n = (fbm(x * .004, y * .004, 5, 3) - .5) * 160 + (n2(x * .03, y * .03, 8) - .5) * 40;
  const dl = x - 60 + n, db = H - 70 - y + n, dr = W - 20 - x + n * .5;
  const cx = (x - 560) / 1060, cy = (y - 2860) / 400, corner = (Math.sqrt(cx * cx + cy * cy) - 1) * 300 + n;
  const cr = ((x - 5200) / 700) ** 2 + ((y - 2950) / 260) ** 2 < 1 ? -1 : 1;
  return Math.min(dl, db, dr, corner) * (cr);
}
export const inPage = (x, y, m = 0) => pageMask(x, y) > m;

export function buildWorld() {
  const [colorC, cx] = cv(W, H, '#fff');
  const [inkAC, ia] = cv(W, H), [timeAC, ta] = cv(W, H, '#fff'), [inkBC, ib] = cv(W, H), [timeBC, tb] = cv(W, H, '#fff');
  ta.globalCompositeOperation = 'darken'; tb.globalCompositeOperation = 'darken';
  const R = rng(4242);
  // 开场线稿：离情侣越远越晚出现
  const strokes = [];
  const penA = (pts, o = {}, t0) => {
    const st = penStroke(pts, o); if (st.P.length < 2) return st;
    const m = st.P[st.P.length >> 1], d = Math.hypot(m[0] - ORIGIN[0], (m[1] - ORIGIN[1]) * 1.3);
    const t = t0 ?? (2.3 + d / 1500 + R() * .12), du = clamp(st.L / 2600, .04, .35);
    rasterPen(ia, ta, st, t, du, WIN_A); strokes.push([+t.toFixed(3), +du.toFixed(3), Math.round(st.L), 0]); return st;
  };
  const penB = (pts, o, t0, dur) => { const st = penStroke(pts, o); rasterPen(ib, tb, st, t0, dur, WIN_B); strokes.push([+t0.toFixed(3), +dur.toFixed(3), Math.round(st.L), 1]); return st; };
  const lw = Y => 1.3 + 2.1 * depthS(Y);      // 远细近粗

  // ============ 天空 ============
  // 天际线后面一片灰蓝，越往上越淡、越碎；云是留白
  // 大片湿画法：几层大块灰蓝，边缘软、互相融；越往上越淡
  for (let i = 0; i < 70; i++) {
    const x = 900 + R() * 3500, y = 250 + R() * 1150;
    const core = Math.exp(-(((x - 2750) / 1500) ** 2)) * clamp((y - 150) / 800);
    if (R() > core * 1.3 || !inPage(x, y, 250)) continue;
    const rx = 180 + R() * 320, ry = rx * (.35 + R() * .3);
    wash(cx, ellipse(x, y, rx, ry, 24, R()), R() < .3 ? C.skyDeep : C.sky, { a: .12 + .1 * core, j: rx * .18, layers: 3, edge: .12, seed: 1000 + i, freq: .006 });
  }
  for (let i = 0; i < 26; i++) { const x = 2100 + R() * 1400, y = 40 + R() * 420, rx = 160 + R() * 260; wash(cx, ellipse(x, y, rx, rx * (.35 + R() * .25), 22, R()), C.sky, { a: .1 + R() * .06, j: rx * .18, layers: 3, edge: .1, seed: 1500 + i, freq: .006 }); }
  const clouds = [[1560, 930, 260, 90], [1900, 860, 200, 80], [3420, 720, 300, 110], [3760, 800, 240, 90], [3120, 820, 160, 60], [2150, 700, 150, 55]];
  for (const [x, y, rx, ry] of clouds) {
    const puff = []; for (let k = 0; k < 9; k++) { const a = Math.PI + k / 8 * Math.PI; puff.push([x + Math.cos(a) * rx * (0.85 + .3 * R()), y + Math.sin(a) * ry * (1.2 + .6 * R())]); }
    puff.push([x + rx * .9, y + ry * .35], [x - rx * .9, y + ry * .35]);
    reserve(cx, spline(puff, 4, true), .82, 14, x);
    wash(cx, ellipse(x + rx * .05, y + ry * .25, rx * .8, ry * .32, 18), C.cloud, { a: .22, j: 10, edge: .1, seed: x | 0 });
  }
  cx.globalCompositeOperation = 'source-over';

  // ============ 天际线（inkB 按笔顺；颜色按楼）============
  const B = [];
  const bld = (x, hw, tiers, col, o = {}) => B.push({ x, hw, tiers, col, ...o });
  // tiers: [[顶 y, 半宽], ...] 从下往上；base 1500 藏在树后
  // 远处的矮楼（偏蓝灰，大气透视）
  for (let i = 0; i < 16; i++) { const x = 1250 + i * 190 + R() * 80, hw = 60 + R() * 60, top = 960 + R() * 200; if (Math.abs(x - 2650) < 150) continue; bld(x, hw, [[top, hw]], mix3(R() < .5 ? C.stone : C.glass, C.haze, .5), { far: 1, seed: i }); }
  bld(1720, 95, [[700, 95], [600, 70], [600, 70]], C.ochre, { pyramid: [600, 470], seed: 31 });
  bld(2160, 120, [[900, 120], [820, 92]], C.lime, { seed: 32 });
  bld(3000, 100, [[880, 100]], C.brick, { tank: 1, seed: 33 });
  bld(3250, 112, [[760, 112]], C.stone, { seed: 34 });
  bld(3520, 72, [[360, 72]], C.glass, { glassy: 1, seed: 35 });
  bld(3790, 100, [[700, 100], [640, 84]], C.glassD, { glassy: 1, seed: 36 });
  bld(1420, 80, [[820, 80]], C.stone, { seed: 37 });
  bld(2380, 70, [[980, 70]], C.brick, { seed: 38 });
  bld(4050, 90, [[900, 90]], C.lime, { seed: 39 });
  // 主角：阶梯式尖顶塔（帽子最后停在它旁边）
  bld(2650, 150, [[980, 150], [760, 118], [600, 88], [470, 60], [405, 36]], C.lime, { spire: [405, 238], hero: 1, seed: 40 });
  B.sort((a, b) => (b.far ?? 0) - (a.far ?? 0) || (a.hero ?? 0) - (b.hero ?? 0) || a.tiers[0][0] - b.tiers[0][0]);
  const BASE = 1500;
  // 颜色
  for (const b of B) {
    let yb = BASE;
    for (const [top, hw] of b.tiers) {
      const poly = [[b.x - hw, yb], [b.x - hw, top], [b.x + hw, top], [b.x + hw, yb]];
      reserve(cx, poly, .6, 3, b.seed);
      wash(cx, poly, b.col, { a: b.far ? .32 : .5, j: 4, layers: 2, edge: .35, seed: b.seed * 7 + top });
      const sh = [[b.x + hw * .35, yb], [b.x + hw * .35, top], [b.x + hw, top], [b.x + hw, yb]];     // 背光面
      wash(cx, sh, mix3(b.col, [90, 95, 130], .45), { a: b.far ? .15 : .3, j: 3, layers: 2, edge: 0, seed: b.seed * 9 + top });
      if (b.glassy) for (let k = 0; k < 5; k++) wash(cx, [[b.x - hw + 8, top + 30 + k * 190], [b.x + hw - 8, top + 10 + k * 190], [b.x + hw - 8, top + 90 + k * 190], [b.x - hw + 8, top + 110 + k * 190]], hex('#dfe8ef'), { a: .0, j: 2, edge: 0 });
      yb = top;
    }
    if (b.pyramid) wash(cx, [[b.x - 70, b.pyramid[0]], [b.x, b.pyramid[1]], [b.x + 70, b.pyramid[0]]], hex('#8aa39a'), { a: .5, j: 3, edge: .3, seed: 77 });
    if (b.spire) wash(cx, [[b.x - 14, b.spire[0]], [b.x, b.spire[1]], [b.x + 14, b.spire[0]]], hex('#b9b6ae'), { a: .5, j: 1, edge: .2, seed: 78 });
    if (b.glassy) { // 玻璃楼：天空的倒影（竖向留白条）
      const t = b.tiers[0][0]; reserve(cx, [[b.x - b.hw * .6, BASE], [b.x - b.hw * .6, t + 60], [b.x - b.hw * .25, t + 20], [b.x - b.hw * .25, BASE]], .35, 2, b.seed);
    }
  }
  // 墨线：主塔跟着帽子往上画（15.6→18.9），其余楼从中间向两边
  const tierOutline = b => {  // 左边线自下而上 + 顶 + 右边线，按 tier
    const L = [], Rr = []; let yb = BASE;
    for (const [top, hw] of b.tiers) { L.push([b.x - hw, yb], [b.x - hw, top]); Rr.push([b.x + hw, yb], [b.x + hw, top]); yb = top; }
    return { L, R: Rr, top: yb };
  };
  for (const b of B) {
    // 近的楼挡住远的楼的线
    ib.save(); ib.globalCompositeOperation = 'destination-out'; { let yb = BASE; for (const [top, hw] of b.tiers) { ib.fillRect(b.x - hw + 2, top + 2, hw * 2 - 4, yb - top); yb = top; } } ib.restore();
    const o = tierOutline(b); const w = b.far ? 1.5 : 2.2;
    let t0, span;
    if (b.hero) { t0 = 15.55; span = 3.2; } else { t0 = 15.7 + Math.abs(b.x - 2650) / 1400 * 1.7 + (b.far ? .5 : 0) + R() * .2; span = .9; }
    // 边线：一格一格（台阶）画上去
    const stepL = [], stepR = []; let yb = BASE;
    for (const [top, hw] of b.tiers) { stepL.push([[b.x - hw, yb], [b.x - hw, top]]); stepR.push([[b.x + hw, yb], [b.x + hw, top]]); yb = top; }
    const nT = b.tiers.length;
    b.tiers.forEach(([top, hw], k) => {
      const ts = t0 + span * k / nT, d = span / nT;
      penB(stepL[k], { w, wob: .9, over: 5, seed: b.seed * 13 + k, smooth: false }, ts, d * .8);
      penB(stepR[k], { w: w * 1.1, wob: .9, over: 5, seed: b.seed * 17 + k, smooth: false }, ts + d * .15, d * .8);
      const nextHw = b.tiers[k + 1]?.[1] ?? 0;
      penB([[b.x - hw - 4, top], [b.x - nextHw, top]], { w, wob: .7, over: 3, seed: b.seed * 19 + k, smooth: false }, ts + d * .7, d * .3);
      penB([[b.x + nextHw, top], [b.x + hw + 4, top]], { w, wob: .7, over: 3, seed: b.seed * 23 + k, smooth: false }, ts + d * .75, d * .3);
      // 窗：一小片一小片，不画满（速写的"暗示"）
      const rows = Math.floor(((b.tiers[k - 1]?.[0] ?? BASE) - top) / 34), Rw = rng(b.seed * 31 + k);
      for (let r = 1; r < rows; r++) {
        const y = top + r * 34; if (y > 1420) break;
        const patch = fbm(b.x * .01, y * .02, b.seed, 2); if (patch < (b.far ? .6 : .47)) continue;
        const cols = Math.max(2, Math.floor(hw * 2 / 22)), ts2 = ts + d * .5 + Rw() * d * .5;
        for (let c = 0; c < cols; c++) { if (Rw() < .3) continue; const x = b.x - hw + 11 + c * (hw * 2 - 16) / cols; penB([[x, y], [x + (b.far ? 4 : 5), y + 10]], { w: w * .75, wob: .3, over: 0, seed: b.seed * 1000 + r * 50 + c, smooth: false }, ts2 + c * .01, .04); }
      }
    });
    if (b.pyramid) { const ts = t0 + span; penB([[b.x - 70, b.pyramid[0]], [b.x, b.pyramid[1]], [b.x + 70, b.pyramid[0]]], { w, wob: .6, over: 4, seed: 91, smooth: false }, ts, .3); }
    if (b.spire) penB([[b.x, b.spire[0] + 4], [b.x, b.spire[1]]], { w: 2.4, wob: .4, over: 8, seed: 92, smooth: false }, t0 + span - .05, .3);
    if (b.tank) { const t = b.tiers[0][0], ts = t0 + span; penB([[b.x + 20, t], [b.x + 24, t - 50], [b.x + 70, t - 50], [b.x + 74, t]], { w, wob: .6, seed: 93, smooth: false }, ts, .25); penB([[b.x + 18, t - 50], [b.x + 47, t - 76], [b.x + 76, t - 50]], { w, wob: .5, seed: 94 }, ts + .2, .15); }
    b.inkEnd = t0 + span + .2;
  }
  // 楼的颜色到达：画完线才上色
  // 楼的真实轮廓（按台阶），给颜色到达的遮罩用
  const inB = (b, x, y, pad = 14) => { if (y > BASE + pad) return false; let yb = BASE; for (const [top, hw] of b.tiers) { if (y <= yb + pad && y >= top - pad && Math.abs(x - b.x) <= hw + pad) return true; yb = top; }
    if (b.pyramid && y >= b.pyramid[1] - pad && y <= b.pyramid[0] && Math.abs(x - b.x) <= 70 * (y - b.pyramid[1]) / (b.pyramid[0] - b.pyramid[1]) + pad) return true;
    if (b.spire && y >= b.spire[1] - pad && y <= b.spire[0] && Math.abs(x - b.x) <= 14 + pad) return true;
    if (b.tank && y >= b.tiers[0][0] - 80 && y <= b.tiers[0][0] && x > b.x + 10 && x < b.x + 84) return true; return false; };
  const bSources = B.map(b => { const top = b.spire ? b.spire[1] : b.pyramid ? b.pyramid[1] : b.tiers[b.tiers.length - 1][0]; return { x: b.x, y: (top + BASE) / 2, t: b.inkEnd - .1, v: 800, R: Math.max(b.hw * 1.3, (BASE - top) * .7), mask: (x, y) => inB(b, x, y), sy: .6 }; });
  const insideBuilding = (x, y) => B.some(b => inB(b, x, y, 6));

  // ============ 草坪 ============
  const lawnTop = x => 1715 + Math.sin(x * .002) * 25 + (fbm(x * .004, 3, 3) - .5) * 40;
  const lawn = [[-20, lawnTop(-20)]]; for (let x = 0; x <= W + 20; x += 80) lawn.push([x, lawnTop(x)]); lawn.push([W + 20, H + 20], [-20, H + 20]);
  wash(cx, lawn, C.lawnFar, { a: .42, j: 20, layers: 2, edge: 0, seed: 501 });
  // 近处更黄更亮：一层层横向带
  for (let k = 0; k < 7; k++) { const y0 = 1850 + k * 150; const band = [[-20, y0 + (R() - .5) * 60], [W * .35, y0 - 30], [W * .7, y0 + 20], [W + 20, y0 - 10], [W + 20, H + 20], [-20, H + 20]]; wash(cx, band, k % 2 ? C.lawn : C.lawnLit, { a: .1, j: 40, layers: 2, edge: 0, seed: 510 + k }); }
  // 光斑和暗块
  for (let i = 0; i < 140; i++) { const x = R() * W, y = 1760 + R() * 1100; if (!inPage(x, y, 50)) continue; const s = depthS(y); dab(cx, x, y, (60 + R() * 120) * s, R() * .4 - .2, R() < .45 ? C.lawnShade : C.lawnLit, .1 + R() * .1, 700 + i); }

  // 树：远排 + 中排 + 节拍树 + 草坪上的树 + 右前景大树
  const trees = [];
  const tree = (x, gy, crown, o = {}) => trees.push({ x, gy, crown, ...o });
  for (let i = 0; i < 22; i++) { const x = -80 + i * 245 + R() * 90, y = 1450 + R() * 90, r = 150 + R() * 70; tree(x, 1740, [{ x, y, r }, { x: x - r * .6, y: y + r * .3, r: r * .7 }, { x: x + r * .55, y: y + r * .25, r: r * .72 }], { far: 1, seed: 900 + i }); }
  for (let i = 0; i < 15; i++) { const x = -40 + i * 360 + R() * 140; if (x > 1300 && x < 2400) continue; const y = 1520 + R() * 80, r = 190 + R() * 90; tree(x, 1760 + R() * 20, [{ x, y, r }, { x: x - r * .55, y: y + r * .2, r: r * .75 }, { x: x + r * .6, y: y + r * .3, r: r * .7 }, { x: x + r * .1, y: y - r * .45, r: r * .6 }], { seed: 950 + i }); }
  const beat = [[1480, 1440, 250, 1745], [1840, 1300, 285, 1740], [2230, 1190, 265, 1735]];
  beat.forEach(([x, y, r, gy], k) => { const cr = [{ x, y, r }, { x: x - r * .6, y: y + r * .35, r: r * .72 }, { x: x + r * .62, y: y + r * .3, r: r * .74 }, { x: x - r * .15, y: y - r * .5, r: r * .62 }, { x: x + r * .3, y: y + r * .75, r: r * .5 }]; CROWNS['beat' + k] = { x, y, r: r * 1.4, crown: cr }; tree(x, gy, cr, { seed: 980 + k, beat: k }); });
  tree(380, 1960, [{ x: 380, y: 1640, r: 250 }, { x: 180, y: 1720, r: 180 }, { x: 560, y: 1700, r: 200 }, { x: 330, y: 1480, r: 170 }], { seed: 990 });
  tree(3720, 1930, [{ x: 3720, y: 1610, r: 240 }, { x: 3540, y: 1680, r: 170 }, { x: 3890, y: 1680, r: 190 }, { x: 3700, y: 1450, r: 170 }], { seed: 991 });
  tree(4180, 1880, [{ x: 4180, y: 1580, r: 210 }, { x: 4030, y: 1650, r: 150 }, { x: 4330, y: 1640, r: 160 }], { seed: 992 });
  const bigCrown = [{ x: 4650, y: 330, r: 420 }, { x: 4250, y: 230, r: 300 }, { x: 4980, y: 640, r: 430 }, { x: 4600, y: 820, r: 330 }, { x: 4330, y: 600, r: 250 }, { x: 5050, y: 1050, r: 330 }, { x: 4800, y: 1180, r: 220 }, { x: 3960, y: 280, r: 190 }];
  CROWNS.big = { crown: bigCrown };
  tree(4960, 2560, bigCrown, { seed: 999, big: 1 });
  // 树下阴影
  for (const t of trees) { if (t.big) continue; const s = depthS(t.gy), r = t.crown[0].r; wash(cx, ellipse(t.x + r * .25, t.gy + 14 * s, r * 1.05, 34 * s + 10, 18), C.shadow, { a: t.far ? .18 : .3, j: 8, edge: 0, seed: t.seed + 3 }); }
  // 从远到近画
  trees.sort((a, b) => (b.far ?? 0) - (a.far ?? 0) || a.gy - b.gy);
  for (const t of trees) {
    const s = t.big ? 1.15 : depthS(t.gy), top = Math.min(...t.crown.map(c => c.y - c.r)), cyb = Math.max(...t.crown.map(c => c.y + c.r * .5));
    // 树干
    const tw = t.big ? 46 : (t.far ? 9 : 14) * (0.6 + s * .7);
    const trunk = t.big ? [[t.x - 78, t.gy], [t.x - 58, 2100], [t.x - 62, 1700], [t.x - 96, 1350], [t.x - 150, 1120], [t.x - 30, 1110], [t.x + 22, 1380], [t.x + 44, 1750], [t.x + 52, 2150], [t.x + 84, t.gy]]
      : [[t.x - tw, t.gy], [t.x - tw * .7, cyb - 30], [t.x + tw * .7, cyb - 30], [t.x + tw, t.gy]];
    reserve(cx, trunk, .7, 2, t.seed);
    wash(cx, trunk, C.bark, { a: .45, j: 3, edge: .3, seed: t.seed + 1 });
    wash(cx, trunk.slice(Math.floor(trunk.length / 2)).concat([[t.x, t.gy]]), C.barkD, { a: .35, j: 2, edge: 0, seed: t.seed + 2 });
    // 树冠：先留白再点叶（前面的树盖住后面的楼和树）
    for (const c of t.crown) reserve(cx, ellipse(c.x, c.y, c.r * .8, c.r * .76, 20), t.far ? .45 : .75, c.r * .12, t.seed + c.x);
    foliage(cx, t.crown, { seed: t.seed, scale: t.big ? 1.5 : t.far ? .75 : (0.8 + s * .4), dens: t.far ? .8 : 1.05, pal: t.far ? farLeaf : LEAF, base: t.far ? .8 : 1 });
    // 墨线：树干 + 几根枝 + 树冠边缘的零碎"m"形叶簇
    const wl = t.big ? 3.2 : lw(t.gy) * (t.far ? .75 : 1);
    if (t.big) { penA(trunk.slice(0, 5), { w: wl, wob: 2, seed: t.seed + 5 }); penA(trunk.slice(5), { w: wl, wob: 2, seed: t.seed + 6 });
      // 枝：从树干分叉，弯、渐细，只露出树冠下半部分
      const br = (x, y, a, L, d, sd) => { if (d > 2 || L < 60) return; const pts = [[x, y]]; let px = x, py = y, aa = a; for (let m = 0; m < 4; m++) { aa += (n2(sd, m) - .5) * .5; px += Math.cos(aa) * L / 4; py += Math.sin(aa) * L / 4; pts.push([px, py]); } penA(spline(pts, 4), { w: wl * (.8 - d * .2), wob: 1.5, seed: sd, gap: .3 }); br(px, py, aa - .5, L * .6, d + 1, sd * 3 + 1); br(pts[2][0], pts[2][1], aa + .6, L * .5, d + 1, sd * 3 + 2); };
      br(t.x - 90, 1130, -2.2, 420, 0, 11); br(t.x - 60, 1180, -1.3, 380, 0, 12); br(t.x - 40, 1400, -2.7, 300, 1, 13); br(t.x - 20, 1300, -.6, 260, 1, 14); for (let k = 0; k < 18; k++) { const y = 1300 + k * 70 + R() * 40; penA([[t.x - 30 + R() * 50, y], [t.x - 20 + R() * 40, y + 30 + R() * 30]], { w: wl * .6, wob: 1, seed: t.seed + 50 + k }); } }
    else {
      penA([[t.x - tw, t.gy], [t.x - tw * .6, cyb - 20]], { w: wl, wob: 1.2, seed: t.seed + 5 }); penA([[t.x + tw, t.gy], [t.x + tw * .6, cyb - 10]], { w: wl, wob: 1.2, seed: t.seed + 6 });
      if (!t.far) for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k - 1) * .6, L = t.crown[0].r * (.5 + R() * .3); penA(spline([[t.x, cyb - 30], [t.x + Math.cos(a) * L * .5, cyb - 30 + Math.sin(a) * L * .5 - 20], [t.x + Math.cos(a) * L, cyb - 30 + Math.sin(a) * L]], 4), { w: wl * .75, wob: 1.2, seed: t.seed + 10 + k, gap: .5 }); }
    }
    // 树冠外缘：断断续续的扇贝线（线稿阶段也读得出是树）
    { const Rs = rng(t.seed * 7 + 1), pts = [];
      for (const c of t.crown) for (let k = 0; k < 64; k++) { const a = k / 64 * TAU, px = c.x + Math.cos(a) * c.r * .9, py = c.y + Math.sin(a) * c.r * .86; if (crownDepth(t.crown, px, py) <= .105 && py < cyb + 10) pts.push({ a, c, px, py }); }
      let run = [];
      const flush = () => { if (run.length > 2 && Rs() < (t.far ? .5 : .8)) { const sc = [], bump = (t.big ? 30 : t.far ? 11 : 17) * (0.7 + s * .4); run.forEach((p, i) => { sc.push([p.px, p.py]); if (i < run.length - 1) { const q = run[i + 1], mx = (p.px + q.px) / 2, my = (p.py + q.py) / 2, dx = mx - p.c.x, dy = my - p.c.y, l = Math.hypot(dx, dy) || 1; sc.push([mx + dx / l * bump * .55, my + dy / l * bump * .55]); } }); penA(sc, { w: wl * .7, wob: 1, seed: t.seed + sc.length * 13 + (run[0].px | 0), over: 2 }); } run = []; };
      let prev = null; for (const p of pts) { if (prev && (prev.c !== p.c || Math.hypot(p.px - prev.px, p.py - prev.py) > 80)) flush(); run.push(p); if (run.length > 5 + Rs() * 5) flush(); prev = p; } flush(); }
    const nClumps = t.big ? 70 : t.far ? 6 : 14;
    for (let k = 0; k < nClumps; k++) {
      const c = t.crown[(R() * t.crown.length) | 0], a = R() * TAU, px = c.x + Math.cos(a) * c.r * .9, py = c.y + Math.sin(a) * c.r * .85;
      if (crownDepth(t.crown, px, py) > .18) continue;
      const sz = (t.big ? 26 : 14 * (0.6 + s)) * (0.7 + R() * .6), pts = []; for (let m = 0; m < 4; m++) pts.push([px + m * sz * .5 * Math.cos(a + Math.PI / 2), py + m * sz * .5 * Math.sin(a + Math.PI / 2) + (m % 2 ? -sz * .35 : 0)]);
      penA(pts, { w: wl * .7, wob: 1, seed: t.seed + 100 + k, over: 1 });
    }
    t.top = top;
  }
  // 天际线墨线被前面的树冠挡住：擦掉 inkB 里树冠范围
  ib.save(); ib.globalCompositeOperation = 'destination-out';
  for (const t of trees) for (const c of t.crown) { ib.beginPath(); ib.ellipse(c.x, c.y, c.r * .86, c.r * .82, 0, 0, TAU); ib.fill(); }
  ib.restore();

  // ============ 小路 ============
  const pw = Y => 200 * depthS(Y) + 20;
  const pathC = spline(PATH, 10);
  const edge = s => pathC.map((p, i) => { const a = pathC[Math.max(0, i - 1)], b = pathC[Math.min(pathC.length - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny); return [p[0] + nx / l * pw(p[1]) / 2 * s, p[1] + ny / l * pw(p[1]) / 2 * s]; });
  const eU = edge(-1), eD = edge(1);
  const pathPoly = [...eU, ...eD.slice().reverse()];
  reserve(cx, pathPoly, .75, 5, 61);
  wash(cx, pathPoly, C.path, { a: .5, j: 6, layers: 3, edge: .45, seed: 62 });
  for (let i = 0; i < 90; i++) { const k = (R() * pathC.length) | 0, p = pathC[k]; const s = depthS(p[1]); dab(cx, p[0] + (R() - .5) * pw(p[1]) * .8, p[1] + (R() - .5) * 20 * s, (10 + R() * 26) * s, R() * .3, C.pathEdge, .15, 1200 + i); }
  const cutPath = (pts, seed) => { for (let k = 0; k < pts.length - 6; k += 6 + ((R() * 5) | 0)) { const seg = pts.slice(k, k + 5 + ((R() * 6) | 0)); if (seg.length > 1) penA(seg, { w: lw(seg[0][1]), wob: 1.3, seed: seed + k, over: 4 }); } };
  cutPath(eU.filter(p => inPage(p[0], p[1], 20)), 3000); cutPath(eD.filter(p => inPage(p[0], p[1], 20)), 4000);

  // ============ 路灯 ============
  { const { x, y, top } = LAMP;
    const shaft = [[x - 14, y], [x - 8, top + 150], [x + 8, top + 150], [x + 14, y]];
    wash(cx, shaft, C.lamp, { a: .75, j: 1.5, edge: .3, seed: 71 });
    const plinth = [[x - 34, y + 6], [x - 26, y - 70], [x + 26, y - 70], [x + 34, y + 6]]; wash(cx, plinth, C.lamp, { a: .8, j: 1.5, seed: 72 });
    const lantern = [[x - 30, top + 60], [x - 38, top - 30], [x + 38, top - 30], [x + 30, top + 60]]; reserve(cx, lantern, 1, 0); wash(cx, lantern, hex('#e9dfb0'), { a: .5, j: 1, edge: 0, seed: 73 });
    wash(cx, [[x - 46, top - 30], [x, top - 80], [x + 46, top - 30]], C.lamp, { a: .8, j: 1, seed: 74 });
    wash(cx, [[x - 22, top + 60], [x + 22, top + 60], [x + 10, top + 150], [x - 10, top + 150]], C.lamp, { a: .8, j: 1, seed: 75 });
    wash(cx, ellipse(x + 60, y + 8, 90, 14, 14), C.shadow, { a: .35, j: 3, edge: 0, seed: 76 });
    const Lw = 3;
    penA([[x - 14, y], [x - 8, top + 150]], { w: Lw, wob: .8, seed: 80, smooth: false }); penA([[x + 14, y], [x + 8, top + 150]], { w: Lw, wob: .8, seed: 81, smooth: false });
    penA(plinth, { w: Lw, wob: .6, seed: 82, smooth: false });
    penA([...lantern, lantern[0]], { w: Lw, wob: .5, seed: 83, smooth: false }); penA([[x, top - 30], [x, top + 60]], { w: 2, wob: .4, seed: 84 });
    penA([[x - 46, top - 30], [x, top - 80], [x + 46, top - 30]], { w: Lw, wob: .5, seed: 85, smooth: false }); penA([[x, top - 80], [x, top - 110]], { w: Lw, wob: .3, seed: 86 });
    penA([[x - 22, top + 60], [x - 10, top + 150], [x + 10, top + 150], [x + 22, top + 60]], { w: Lw, wob: .5, seed: 87, smooth: false });
    for (let k = 0; k < 7; k++) penA([[x + 2 + k * 1.5, y - 60 - k * 160], [x + 6 + k * 1.2, y - 110 - k * 160]], { w: 1.4, wob: .3, seed: 88 + k }); }

  // ============ 池塘 + 石桥 ============
  { const pond = spline(POND.slice(0, 7), 6).concat(POND.slice(7));
    reserve(cx, pond, .8, 6, 301);
    wash(cx, pond, C.water, { a: .5, j: 8, layers: 3, edge: .4, seed: 302 });
    const { x0, x1, deck, rail, a0, a1, apex, water } = BRIDGE;
    // 桥洞倒影
    const refl = [...Array(17)].map((_, i) => { const u = i / 16, x = lerp(a0, a1, u); return [x, water + (water - apex) * Math.sin(u * Math.PI) * .9]; });
    wash(cx, [[a0, water], ...refl, [a1, water]], C.waterD, { a: .55, j: 4, edge: .2, seed: 303 });
    wash(cx, [[x0 - 40, water + 4], [x1, water + 4], [x1, water + 60], [x0 - 20, water + 50]], C.waterD, { a: .25, j: 10, edge: 0, seed: 304 });
    // 桥身：拱桥，桥面中间微微拱起
    const hump = x => -22 * Math.sin(clamp((x - x0) / (x1 - x0)) * Math.PI);
    const arch = [...Array(19)].map((_, i) => { const u = i / 18, x = lerp(a0, a1, u); return [x, water - (water - apex) * Math.pow(Math.sin(u * Math.PI), .8)]; });
    const topL = [...Array(13)].map((_, i) => { const x = lerp(x0, x1, i / 12); return [x, rail - 6 + hump(x)]; });
    const body = [[x0 - 70, water], ...topL, [x1 + 70, water], ...arch.slice().reverse()];
    reserve(cx, body, .92, 3, 305);
    wash(cx, body, C.bridge, { a: .5, j: 3, edge: .4, seed: 306 });
    wash(cx, [[a0 - 10, water], ...arch.slice(1, 18).map(p => [p[0], p[1] + 16]), [a1 + 10, water]], C.bridgeD, { a: .5, j: 3, edge: 0, seed: 307 });
    wash(cx, [...topL.map(p => [p[0], p[1] + 44]), ...topL.slice().reverse().map(p => [p[0], p[1] + 60])], C.bridgeD, { a: .18, j: 3, edge: 0, seed: 308 });
    const Bw = 2.6;
    penA(arch, { w: Bw, wob: .9, seed: 310 });
    penA(topL.map(p => [p[0], p[1] + 6]), { w: Bw, wob: 1, seed: 311, gap: .4 }); penA(topL.map(p => [p[0], p[1] + 46]), { w: Bw, wob: 1, seed: 312, gap: .5 });
    penA([[x0 - 70, water], [x0 - 20, rail + 40], [x0, rail]], { w: Bw, wob: 1, seed: 313 }); penA([[x1 + 70, water], [x1 + 20, rail + 40], [x1, rail]], { w: Bw, wob: 1, seed: 314 });
    for (let x = x0 + 16; x < x1 - 6; x += 22) { const h = hump(x); penA([[x, rail + 10 + h], [x + 1, rail + 40 + h]], { w: 1.5, wob: .3, seed: 320 + x, over: 1 }); }
    for (let k = 1; k < 18; k++) { const p = arch[k], cx0 = (a0 + a1) / 2, dx = p[0] - cx0, dy = p[1] - water, l = Math.hypot(dx, dy) || 1; if (k % 2) penA([[p[0], p[1]], [p[0] + dx / l * 26, p[1] + dy / l * 26]], { w: 1.5, wob: .3, seed: 400 + k, over: 0 }); }
    for (let k = 0; k < 10; k++) { const x = x0 + 30 + ((k * 71) % (x1 - x0 - 60)), y = rail + 70 + (k % 3) * 40; if (y < water - (water - apex) * Math.pow(Math.sin(clamp((x - a0) / (a1 - a0)) * Math.PI), .8) - 20 || x < a0 || x > a1) penA([[x, y], [x + 34, y + 1]], { w: 1.3, wob: .4, seed: 430 + k, over: 1 }); }
    // 水纹
    for (let i = 0; i < 40; i++) { const x = 3900 + R() * 1200, y = 2610 + R() * 250; if (!inPage(x, y, 30)) continue; penA([[x, y], [x + 30 + R() * 50, y + (R() - .5) * 3]], { w: 1.5, wob: .5, seed: 500 + i, over: 2 }); }
    penA(spline(POND.slice(0, 7), 6).filter(p => inPage(p[0], p[1], 20)), { w: 2.4, wob: 1.5, seed: 330, gap: .6 });
  }

  // ============ 野餐布 + 篮子（开场 0.9–1.8 秒画出来）============
  { const [a, b, c, d] = BLANKET;
    reserve(cx, BLANKET, .9, 2, 601);
    wash(cx, BLANKET, C.plaid, { a: .5, j: 3, edge: .3, seed: 602 });
    for (let k = 1; k < 7; k++) { const u = k / 7; const p = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)], q = [lerp(d[0], c[0], u), lerp(d[1], c[1], u)]; wash(cx, [[p[0] - 12, p[1]], [p[0] + 12, p[1]], [q[0] + 8, q[1]], [q[0] - 8, q[1]]], k % 3 ? C.plaidB : C.plaidR, { a: .3, j: 2, edge: 0, seed: 610 + k }); }
    for (let k = 1; k < 4; k++) { const u = k / 4; const p = [lerp(a[0], d[0], u), lerp(a[1], d[1], u)], q = [lerp(b[0], c[0], u), lerp(b[1], c[1], u)]; wash(cx, [[p[0], p[1] - 8], [q[0], q[1] - 8], [q[0], q[1] + 8], [p[0], p[1] + 8]], k % 2 ? C.plaidB : C.plaidR, { a: .25, j: 2, edge: 0, seed: 620 + k }); }
    wash(cx, [[a[0] + 20, a[1] + 4], [b[0] + 30, b[1] + 6], [b[0] + 80, b[1] + 26], [a[0] + 60, a[1] + 24]], C.shadow, { a: .35, j: 6, edge: 0, seed: 630 });
    penA([a, b], { w: 2.8, wob: 1.2, seed: 640 }, 1.0); penA([b, c], { w: 2.8, wob: 1.2, seed: 641 }, 1.15); penA([c, d], { w: 2.6, wob: 1.2, seed: 642, gap: .6 }, 1.25); penA([d, a], { w: 2.8, wob: 1.2, seed: 643 }, 1.35);
    for (let k = 1; k < 7; k += 2) { const u = k / 7; penA([[lerp(a[0], b[0], u), lerp(a[1], b[1], u)], [lerp(d[0], c[0], u), lerp(d[1], c[1], u)]], { w: 1.4, wob: .8, seed: 650 + k, gap: .6 }, 1.45 + k * .02); }
    // 篮子
    const bx = 2770, by = 2392, basket = [[bx - 70, by], [bx - 80, by - 70], [bx + 80, by - 70], [bx + 70, by]];
    reserve(cx, basket, .95, 1, 660); wash(cx, basket, C.wicker, { a: .6, j: 2, edge: .4, seed: 661 });
    wash(cx, [[bx + 20, by], [bx + 30, by - 70], [bx + 80, by - 70], [bx + 70, by]], mix3(C.wicker, [80, 60, 60], .4), { a: .35, j: 1, edge: 0, seed: 662 });
    penA([...basket, basket[0]], { w: 2.8, wob: .9, seed: 663, smooth: false }, 1.5);
    penA(spline([[bx - 60, by - 70], [bx - 40, by - 150], [bx + 40, by - 150], [bx + 60, by - 70]], 6), { w: 2.6, wob: .9, seed: 664 }, 1.62);
    for (let k = 0; k < 5; k++) penA([[bx - 76, by - 56 + k * 12], [bx + 76, by - 56 + k * 12]], { w: 1.2, wob: .8, seed: 670 + k, gap: .5 }, 1.66 + k * .03);
    for (let k = 0; k < 9; k++) penA([[bx - 64 + k * 16, by - 66], [bx - 60 + k * 15, by - 4]], { w: 1, wob: .5, seed: 680 + k }, 1.72 + k * .01);
  }

  // ============ 远处的小人（静态）：速写里的"胡萝卜人"——一块衣服色、两条腿、一个头点 ============
  const Rp = rng(777);
  const TOPS = ['#8ea6c4', '#d9d2c2', '#c9796a', '#e2c46a', '#7fa084', '#b58fb0', '#f0ece0', '#5f6f8f'].map(hex);
  const SKIN = ['#e2b394', '#c89274', '#e8c0a0', '#9c6a50'].map(hex), HAIR = ['#4a3a30', '#2e2622', '#8a5a3a', '#231c1a'].map(hex);
  const crowd = [];
  for (let g = 0; g < 16; g++) {   // 成群出现，不均匀
    const gx = 150 + Rp() * 4800, gy = 1735 + Rp() * 90, n = 1 + ((Rp() * 4) | 0);
    if (Math.abs(gx - 2650) < 80 || !inPage(gx, gy, 150)) continue;
    for (let k = 0; k < n; k++) crowd.push([gx + (k - n / 2) * 26 + Rp() * 14, gy + Rp() * 16]);
  }
  crowd.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of crowd) {
    const S = FIG_H * depthS(y) * .62, top = TOPS[(Rp() * TOPS.length) | 0], sk = SKIN[(Rp() * SKIN.length) | 0], hr = HAIR[(Rp() * HAIR.length) | 0];
    const d = Math.hypot(x - ORIGIN[0], (y - ORIGIN[1]) * 1.3), t0 = 2.3 + d / 1500;
    const hipY = y - S * .47, shY = y - S * .8, hw = S * .075, walk = Rp() < .6, st = (Rp() - .5) * S * .12;
    wash(cx, ellipse(x + S * .05, y + 2, S * .12, S * .025, 10), C.shadow, { a: .3, j: 1, edge: 0 });
    const body = [[x - hw * .8, hipY + S * .04], [x - hw, shY + S * .02], [x - hw * .5, shY - S * .02], [x + hw * .5, shY - S * .02], [x + hw, shY + S * .02], [x + hw * .8, hipY + S * .04]];
    reserve(cx, body, .8, 0); wash(cx, body, top, { a: .6, j: 1.2, layers: 2, edge: .3, seed: x | 0, dx: 1.5 });
    const legs = [[[x - hw * .4, hipY], [x - hw * .5 - (walk ? st : 0), y]], [[x + hw * .4, hipY], [x + hw * .5 + (walk ? st : 0), y]]];
    wash(cx, [[x - hw * .8, hipY], [x + hw * .8, hipY], [x + hw * .6, hipY + S * .18], [x - hw * .6, hipY + S * .18]], mix3(top, [90, 90, 100], .6), { a: .35, j: 1, edge: 0 });
    for (const l of legs) rasterPen(ia, ta, penStroke(l, { w: 1.5, wob: .3, over: 0, seed: x + l[1][0] | 0, smooth: false }), t0, .08, WIN_A);
    const hy = shY - S * .075, hr0 = S * .052;
    wash(cx, ellipse(x, hy, hr0, hr0 * 1.1, 10), sk, { a: .5, j: .6, edge: 0 });
    wash(cx, ellipse(x, hy - hr0 * .3, hr0 * 1.05, hr0 * .8, 10), hr, { a: .7, j: .6, edge: 0 });
    rasterPen(ia, ta, penStroke(ellipse(x, hy, hr0, hr0 * 1.1, 10).slice(2, 9), { w: 1.3, wob: .2, over: 0, seed: y | 0, smooth: false }), t0, .06, WIN_A);
    rasterPen(ia, ta, penStroke([body[1], body[0]], { w: 1.3, wob: .3, over: 1, seed: x * 3 | 0, smooth: false }), t0, .06, WIN_A);
    rasterPen(ia, ta, penStroke([body[4], body[5]], { w: 1.4, wob: .3, over: 1, seed: x * 5 | 0, smooth: false }), t0, .06, WIN_A);
  }

  // ============ 草的笔触 ============
  for (let i = 0; i < 2200; i++) {
    const x = R() * W, y = 1760 + Math.pow(R(), .7) * 1100; if (!inPage(x, y, 60)) continue;
    const s = depthS(y); if (inPoly(pathPoly, x, y) || inPoly(POND, x, y) || inPoly(BLANKET, x, y - 10)) continue;
    if (R() > .17 + s * .42) continue;
    const n = 2 + ((R() * 3) | 0), h = (10 + R() * 18) * s;
    for (let k = 0; k < n; k++) { const bx = x + k * 6 * s, lean = (R() - .3) * .5; penA([[bx, y], [bx + lean * h, y - h * (0.7 + R() * .5)]], { w: lw(y) * .55, wob: .3, over: 0, seed: 8000 + i * 5 + k, smooth: false }); }
  }

  // ============ 页面边缘：碎成色点，溶进纸 ============
  { const [mc, mx] = cv(W, H);
    mx.fillStyle = '#fff';
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) { const m = pageMask(x, y); if (m < 0) mx.fillRect(x, y, 4, 4); }
    // 边界处用色点打碎
    const Rm = rng(31);
    for (let i = 0; i < 30000; i++) { const x = Rm() * W, y = 1300 + Rm() * (H - 1300), m = pageMask(x, y); if (m > 0 && m < 70 && Rm() < (1 - m / 70) * .45) dab(mx, x, y, 3 + Rm() * 7, Rm() * TAU, [255, 255, 255], .95, i); }
    cx.globalCompositeOperation = 'source-over'; cx.drawImage(mc, 0, 0);
    // 边缘外的墨线也去掉
    for (const c of [ia, ib]) { c.save(); c.globalCompositeOperation = 'destination-out'; c.drawImage(mc, 0, 0); c.restore(); }
    // 边缘内侧留一圈零星色点（颜料飞溅）
    cx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 9000; i++) { const x = Rm() * W, y = 1650 + Rm() * (H - 1650), m = pageMask(x, y); if (m < 0 && m > -70 && Rm() < (1 + m / 70) * .7) { const k = Rm(); dab(cx, x, y, 5 + Rm() * 12, Rm() * TAU, k < .35 ? LEAF.light : k < .7 ? C.lawn : LEAF.mid, .3 + Rm() * .3, 40000 + i); } }
    cx.globalCompositeOperation = 'source-over';
  }

  // ============ 打包成纹理数据 ============
  const pack = (r, g) => {
    const out = new Uint8Array(W * H * 4);
    const A = r.getImageData(0, 0, W, H).data; for (let i = 0, n = W * H; i < n; i++) out[i * 4] = A[i * 4 + 3];
    const Bd = g.getImageData(0, 0, W, H).data; for (let i = 0, n = W * H; i < n; i++) { out[i * 4 + 1] = Bd[i * 4 + 3]; out[i * 4 + 3] = 255; }
    return out;
  };
  const packT = (r, g) => {
    const out = new Uint8Array(W * H * 4);
    const A = r.getImageData(0, 0, W, H).data, Bd = g.getImageData(0, 0, W, H).data;
    for (let i = 0, n = W * H; i < n; i++) { out[i * 4] = A[i * 4]; out[i * 4 + 1] = Bd[i * 4]; out[i * 4 + 3] = 255; }
    return out;
  };
  const ink = pack(ia, ib), time = packT(ta, tb);
  return { W, H, color: colorC, ink, time, winA: WIN_A, winB: WIN_B, bSources, insideBuilding, buildings: B, trees, pathPoly, strokes };
}
const farLeaf = { sun: hex('#c9cf86'), light: hex('#a6b775'), mid: hex('#85a068'), dark: hex('#6b8a66'), deep: hex('#5a7662') };
export function inPoly(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
