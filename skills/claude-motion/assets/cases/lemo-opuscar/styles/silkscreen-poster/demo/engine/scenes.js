// scenes.js · 引擎内置场景：lake / waterfall / ridge / forest / coast
// 每个场景返回按印刷顺序排好的"层"（plane）：{ id, depth, parts:[{ ink, path, knock?, sub }] }
//   ink = 调色板键（sky1 sky2 far mid near sun），sub = 同一节拍里的第几刮（0 主色，1 点缀色，晚半拍）
//   depth：视差系数（1 = 纸面；<1 更远；>1 更近），只在"分层视差"镜头里用
// 另返回 trail：步道折线 [{x,y,plane}]，按所在层分段，虚线由海报层画
// 坐标：海报单位，画幅 1000×1500，画面区 x 26..974、y 26..1190（其余为纸边和信息带）
import { mulberry, polyPath, circlePath, ringPath, rectPath, unionPath, ridgeLine, bandSteps, lerp } from './silk.js';

export const PW = 1000, PH = 1500, ART = [26, 26, 948, 1164];

// ---- 形状积木 ----
function pine(p, x, base, h, w, tiers = 4) {       // 一棵程式化松树：层层下垂的枝盘 + 短树干，一条外轮廓
  const tw = Math.max(3, w * .06), trunkTop = base - h * .1;
  const R = [[x, base - h]];
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers;
    const yb = base - h * .1 - (h * .9) * (1 - t) * .98;       // 这一盘的下沿
    const hw = w / 2 * (.28 + .72 * t);                          // 半宽：越往下越宽
    R.push([x + hw, yb + h * .012]);                             // 下垂的枝梢
    if (i < tiers - 1) R.push([x + hw * .42, yb - h * .02]);    // 收回到下一盘的起点
  }
  R.push([x + tw, trunkTop], [x + tw, base + 6]);
  const L = R.slice(1).reverse().map(q => [2 * x - q[0], q[1]]);
  const pts = R.concat(L);
  pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath();
}
function forest(x0, x1, base, hmin, hmax, seed, dense = 1, bottom = 1500) {   // 一排松林 + 实底
  const p = new Path2D(), r = mulberry(seed);
  p.rect(x0 - 40, base, x1 - x0 + 80, bottom - base);
  let x = x0 - 20;
  while (x < x1 + 30) { const h = lerp(hmin, hmax, r()), w = h * (.34 + r() * .12); pine(p, x, base + 4, h, w, 3 + (r() * 3 | 0)); x += w * (.42 + r() * .35) / dense; }
  return p;
}
function range(x0, x1, yBase, peaks, seed, rough = 22) {   // 山脉剪影：peaks=[[x,y],...]
  const pts = [[x0 - 30, yBase], [x0 - 30, peaks[0][1] + 60]];
  let prev = [x0 - 30, peaks[0][1] + 60];
  for (let i = 0; i < peaks.length; i++) { const seg = ridgeLine(prev, peaks[i], rough, 3, seed + i); pts.push(...seg.slice(1)); prev = peaks[i]; }
  const end = [x1 + 30, peaks[peaks.length - 1][1] + 80]; pts.push(...ridgeLine(prev, end, rough, 3, seed + 99).slice(1));
  pts.push([x1 + 30, yBase]);
  return { path: polyPath(pts), pts };
}
// 受光面：每座峰从峰顶沿一侧往下的锯齿块（WPA 的两色山体）
function facets(peaks, side, depth, seed, jag = 18) {
  const p = new Path2D(), r = mulberry(seed);
  for (const [x, y] of peaks) {
    const d = depth * (.8 + r() * .5), sx = side * d * .75;
    const pts = [[x, y]];
    const n = 5;
    for (let i = 1; i <= n; i++) { const t = i / n; pts.push([x + sx * t + (r() - .5) * jag, y + d * t]); pts.push([x + sx * t * .45 + side * jag * .3, y + d * t + jag * .5]); }
    pts.push([x + side * 4, y + d * 1.05]);
    pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath();
  }
  return p;
}
function sunParts(x, y, r, rings = 1) {
  const knock = new Path2D(); knock.addPath(circlePath(x, y, r + 5));
  for (let i = 0; i < rings; i++) knock.addPath(ringPath(x, y, r + 22 + i * 30, r + 32 + i * 30));
  return { knock, disc: circlePath(x, y, r) };
}
function skyPlane(sunKnock, bandTop, bandBot, extraTop = 0) {
  const flood = rectPath(-60, -60 - extraTop, PW + 120, 1700 + extraTop);
  const top = new Path2D(); top.rect(-60, -60 - extraTop, PW + 120, bandTop + 60 + extraTop); top.addPath(bandSteps(-60, PW + 120, bandTop, bandBot, 5, 10));
  return { id: 'sky', depth: .15, parts: [{ ink: 'sky1', path: flood, knock: sunKnock, sub: 0 }, { ink: 'sky2', path: top, sub: 1 }] };
}
function wavesPath(x0, x1, y0, y1, n, seed, len = 60) {   // 水面反光：横向短条
  const p = new Path2D(), r = mulberry(seed);
  for (let i = 0; i < n; i++) { const y = lerp(y0, y1, Math.pow(r(), 1.3)), l = len * (.4 + r()) * (.4 + (y - y0) / (y1 - y0)), x = lerp(x0, x1, r()), th = 2.5 + (y - y0) / (y1 - y0) * 5; p.rect(x, y, l, th); }
  return p;
}

// ================= LAKE（湖） =================
function lake(seed) {
  const sun = sunParts(640, 575, 92, 2);
  const peaks = [[120, 430], [300, 360], [470, 455], [610, 400], [800, 470], [930, 420]];
  const R = range(0, PW, 760, peaks, seed + 3, 26);
  const lakeTop = 660;
  const shore = forest(-40, 1040, 668, 26, 58, seed + 5, 1.3, 700);
  const lakeP = rectPath(-60, lakeTop, PW + 120, 900);
  const glints = new Path2D();
  for (let i = 0; i < 12; i++) { const y = 690 + i * 22 + i * i * 1.6, w = 170 - i * 9 + (i % 3) * 18; glints.rect(640 - w / 2 + ((i * 37) % 23) - 11, y, w, 4 + i * .7); }
  const refl = wavesPath(40, 900, 700, 1000, 22, seed + 7, 70);
  // 近景：左侧大松 + 右侧松 + 前景岸石
  const near = new Path2D();
  pine(near, 110, 1250, 1080, 330, 7); pine(near, 250, 1260, 760, 250, 6); pine(near, -20, 1250, 900, 300, 6);
  pine(near, 905, 1250, 820, 270, 6); pine(near, 1010, 1250, 1000, 300, 7);
  near.addPath(polyPath([[-60, 1030], [140, 1000], [300, 1022], [420, 1060], [560, 1045], [720, 1070], [860, 1020], [1060, 1000], [1060, 1600], [-60, 1600]]));
  near.addPath(polyPath([[560, 1045], [610, 990], [690, 975], [760, 1010], [790, 1060]]));   // 岸边大石
  const rockLit = polyPath([[610, 990], [690, 975], [705, 1000], [640, 1012]]);
  const trail = [[500, 1200], [470, 1150], [520, 1110], [640, 1090], [780, 1100], [880, 1080], [990, 1060]].map(q => ({ x: q[0], y: q[1], plane: 'near' }));
  return {
    planes: [
      skyPlane(sun.knock, 150, 360),
      { id: 'sun', depth: .15, parts: [{ ink: 'sun', path: sun.disc, sub: 0 }] },
      { id: 'far', depth: .35, parts: [{ ink: 'far', path: R.path, sub: 0 }, { ink: 'sky2', path: facets(peaks, 1, 110, seed + 11, 14), sub: 1 }] },
      { id: 'mid', depth: .7, parts: [{ ink: 'sky2', path: lakeP, sub: 0 }, { ink: 'sun', path: glints, sub: 1 }, { ink: 'sky1', path: refl, sub: 1 }, { ink: 'mid', path: shore, sub: 0 }] },
      { id: 'near', depth: 1.5, parts: [{ ink: 'near', path: near, sub: 0 }, { ink: 'mid', path: rockLit, sub: 1 }] },
    ], trail, sun: [640, 575],
  };
}

// ================= WATERFALL（瀑布） =================
function waterfall(seed) {
  const sun = sunParts(810, 190, 52, 1);
  const peaks = [[90, 330], [260, 280], [430, 350], [640, 300], [860, 360]];
  const R = range(0, PW, 700, peaks, seed + 3, 20);
  // 峭壁：左右两块 + 后壁，中间 V 口出水；岩面用三块大切面（WPA 的刻面山石）
  const cliff = polyPath([[-60, 430], [120, 398], [260, 412], [380, 440], [452, 478], [470, 520], [530, 520], [550, 476], [640, 452], [780, 424], [900, 440], [1060, 420], [1060, 1300], [-60, 1300]]);
  const fall = polyPath([[470, 516], [530, 516], [538, 600], [552, 760], [578, 950], [422, 950], [448, 760], [462, 600]]);
  const shadows = unionPath([
    polyPath([[-60, 440], [120, 398], [70, 520], [130, 640], [60, 780], [140, 920], [80, 1000], [-60, 1000]]),
    polyPath([[1060, 420], [900, 440], [950, 560], [880, 700], [960, 840], [900, 1000], [1060, 1000]]),
    polyPath([[380, 441], [452, 478], [463, 600], [449, 760], [423, 950], [352, 950], [392, 770], [404, 600], [370, 520]]),
    polyPath([[550, 476], [640, 453], [612, 540], [602, 700], [622, 850], [646, 950], [578, 950], [552, 760], [538, 600]])]);
  const lit = new Path2D(); lit.addPath(polyPath([[120, 398], [260, 412], [380, 440], [452, 478], [456, 492], [380, 456], [260, 424], [124, 410]])); lit.addPath(polyPath([[550, 476], [640, 452], [780, 424], [900, 440], [900, 452], [780, 437], [640, 465], [552, 490]]));
  const streaks = new Path2D(); for (let i = 0; i < 5; i++) { const x0 = 480 + i * 10, x1 = 452 + i * 24; streaks.addPath(polyPath([[x0, 560 + i * 20], [x0 + 3, 560 + i * 20], [x1 + 4, 940], [x1, 940]])); }
  const topForest = unionPath([forest(-40, 230, 418, 40, 84, seed + 6, .8, 424), forest(700, 1040, 448, 40, 88, seed + 7, .8, 452)]);
  const pool = new Path2D(); pool.ellipse(500, 985, 250, 48, 0, 0, Math.PI * 2);
  const foam = new Path2D();
  for (let i = 0; i < 2; i++) { const rx = 150 + i * 70, y = 978 + i * 18; foam.moveTo(500 - rx, y); foam.quadraticCurveTo(500, y + 10, 500 + rx, y); foam.quadraticCurveTo(500, y + 16, 500 - rx, y); foam.closePath(); }
  foam.addPath(polyPath([[422, 950], [578, 950], [600, 968], [400, 968]]));
  const slopeForest = unionPath([forest(-40, 300, 1010, 90, 170, seed + 8, .8, 1300), forest(700, 1040, 1000, 90, 180, seed + 9, .8, 1300)]);
  const near = new Path2D();
  pine(near, 40, 1260, 1000, 300, 7); pine(near, 180, 1270, 620, 210, 5);
  pine(near, 920, 1260, 1060, 320, 8); pine(near, 1040, 1260, 820, 260, 6);
  near.addPath(polyPath([[-60, 1080], [200, 1060], [330, 1110], [520, 1120], [700, 1100], [880, 1070], [1060, 1090], [1060, 1600], [-60, 1600]]));
  const ferns = new Path2D(); for (let i = 0; i < 9; i++) { const x = 250 + i * 64, y = 1112 - (i % 3) * 6; ferns.addPath(polyPath([[x, y], [x + 22, y - 44 - (i % 2) * 18], [x + 32, y - 40], [x + 16, y]])); }
  const trail = [[330, 1200], [360, 1150], [300, 1120], [360, 1090], [440, 1080]].map(q => ({ x: q[0], y: q[1], plane: 'near' }));
  return {
    planes: [
      skyPlane(sun.knock, 110, 270),
      { id: 'sun', depth: .15, parts: [{ ink: 'sun', path: sun.disc, sub: 0 }] },
      { id: 'far', depth: .35, parts: [{ ink: 'sky2', path: R.path, sub: 0 }, { ink: 'sky1', path: facets(peaks, -1, 70, seed + 12, 10), sub: 1 }] },
      { id: 'mid', depth: .7, parts: [{ ink: 'far', path: cliff, knock: fall, sub: 0 }, { ink: 'near', path: shadows, sub: 1 }, { ink: 'sky1', path: lit, sub: 1 }, { ink: 'sky1', path: streaks, sub: 1 }, { ink: 'sky2', path: pool, knock: foam, sub: 0 }, { ink: 'near', path: topForest, sub: 0 }, { ink: 'mid', path: slopeForest, sub: 0 }] },
      { id: 'near', depth: 1.5, parts: [{ ink: 'near', path: near, sub: 0 }, { ink: 'mid', path: ferns, sub: 1 }] },
    ], trail, dark: [920, 700],
  };
}

// ================= RIDGE（山脊，纵深多层，签名镜头用） =================
function ridge(seed) {
  const sun = sunParts(735, 400, 105, 2);
  const farPeaks = [[80, 400], [250, 350], [420, 420], [900, 390]];
  const FR = range(0, PW, 800, farPeaks, seed + 2, 18);
  const summit = [470, 250];
  const main = polyPath([[-60, 620], [90, 540], [200, 470], [300, 380], [380, 330], summit, [520, 285], [560, 300], [610, 350], [680, 395], [760, 470], [860, 520], [1060, 600], [1060, 1600], [-60, 1600]]);
  const mainLit = polyPath([summit, [520, 285], [560, 300], [610, 350], [680, 395], [760, 470], [860, 520], [1060, 600], [1060, 660], [820, 610], [700, 540], [600, 470], [540, 400], [490, 320]]);
  const rim = polyPath([[380, 330], summit, [520, 285], [560, 300], [556, 309], [518, 296], [472, 262], [384, 339]]);
  const spurA = polyPath([[-60, 700], [80, 640], [200, 600], [300, 590], [420, 630], [540, 690], [650, 760], [700, 800], [700, 1600], [-60, 1600]]);
  const spurALit = polyPath([[200, 600], [300, 590], [420, 630], [540, 690], [650, 760], [560, 745], [440, 690], [330, 640]]);
  const spurB = polyPath([[1060, 760], [930, 720], [820, 700], [700, 730], [600, 790], [500, 870], [460, 920], [460, 1600], [1060, 1600]]);
  const spurBLit = polyPath([[820, 700], [700, 730], [600, 790], [500, 870], [560, 850], [660, 790], [760, 750]]);
  const spurC = polyPath([[-60, 900], [60, 860], [180, 850], [300, 880], [420, 950], [520, 1010], [560, 1060], [560, 1600], [-60, 1600]]);
  const spurCLit = polyPath([[60, 860], [180, 850], [300, 880], [420, 950], [340, 935], [200, 890]]);
  const valley = forest(-60, 1060, 1060, 60, 130, seed + 8, 1.2, 1700);
  const near = new Path2D(); pine(near, 60, 1300, 820, 260, 7); pine(near, -40, 1300, 1000, 300, 7); pine(near, 950, 1300, 760, 250, 6); pine(near, 1050, 1300, 980, 300, 7);
  near.addPath(valley);
  // 步道：从谷底之字形爬到山顶，按所在层分段
  const T = [[500, 1200, 'near'], [470, 1130, 'near'], [520, 1060, 'near'], [440, 1020, 'spurC'], [360, 960, 'spurC'], [470, 930, 'spurB'], [560, 860, 'spurB'], [640, 800, 'spurB'], [560, 760, 'spurA'], [430, 700, 'spurA'], [330, 650, 'spurA'], [380, 610, 'main'], [440, 540, 'main'], [400, 470, 'main'], [455, 400, 'main'], [430, 330, 'main'], summit.concat('main')];
  const trail = T.map(q => ({ x: q[0], y: q[1], plane: q[2] }));
  return {
    planes: [
      skyPlane(sun.knock, 120, 300, 200),
      { id: 'sun', depth: .1, parts: [{ ink: 'sun', path: sun.disc, sub: 0 }] },
      { id: 'far', depth: .25, parts: [{ ink: 'far', path: FR.path, sub: 0 }] },
      { id: 'main', depth: .5, parts: [{ ink: 'mid', path: main, sub: 0 }, { ink: 'far', path: mainLit, sub: 1 }, { ink: 'glow', path: rim, sub: 1 }] },
      { id: 'spurA', depth: .8, side: -1, parts: [{ ink: 'far', path: spurA, sub: 0 }, { ink: 'glow', path: spurALit, sub: 1 }] },
      { id: 'spurB', depth: 1.05, side: 1, parts: [{ ink: 'mid', path: spurB, sub: 0 }, { ink: 'far', path: spurBLit, sub: 1 }] },
      { id: 'spurC', depth: 1.3, side: -1, parts: [{ ink: 'far', path: spurC, sub: 0 }, { ink: 'glow', path: spurCLit, sub: 1 }] },
      { id: 'near', depth: 1.9, parts: [{ ink: 'near', path: near, sub: 0 }] },
    ], trail, summit, sun: [735, 400],
  };
}

// ================= FOREST（森林） =================
function forestScene(seed) {
  const sun = sunParts(300, 300, 70, 1);
  const peaks = [[150, 420], [420, 380], [700, 430], [900, 400]];
  const R = range(0, PW, 800, peaks, seed + 3, 18);
  const back = forest(-40, 1040, 640, 80, 170, seed + 4, 1, 900);
  const midF = forest(-40, 1040, 820, 150, 300, seed + 5, .9, 1300);
  const near = new Path2D(); for (let i = 0; i < 6; i++) { const x = [-10, 150, 330, 690, 850, 1000][i], top = 190 + (i % 3) * 40; near.addPath(polyPath([[x - 20 - i % 2 * 8, top + 120], [x + 20 + i % 2 * 8, top + 120], [x + 30, 1300], [x - 30, 1300]])); pine(near, x, top + 260, 300, 150 + (i % 2) * 40, 4); }
  near.addPath(polyPath([[-60, 1060], [300, 1040], [700, 1070], [1060, 1040], [1060, 1600], [-60, 1600]]));
  const shafts = new Path2D(); for (let i = 0; i < 4; i++) { const x = 380 + i * 90; shafts.addPath(polyPath([[x, 700], [x + 30, 700], [x + 120, 1060], [x + 60, 1060]])); }
  const trail = [[500, 1200], [540, 1130], [480, 1080], [520, 1050]].map(q => ({ x: q[0], y: q[1], plane: 'near' }));
  return {
    planes: [
      skyPlane(sun.knock, 110, 280),
      { id: 'sun', depth: .15, parts: [{ ink: 'sun', path: sun.disc, sub: 0 }] },
      { id: 'far', depth: .35, parts: [{ ink: 'far', path: R.path, sub: 0 }, { ink: 'far', path: back, sub: 1 }] },
      { id: 'mid', depth: .7, parts: [{ ink: 'mid', path: midF, sub: 0 }, { ink: 'sky1', path: shafts, sub: 1 }] },
      { id: 'near', depth: 1.5, parts: [{ ink: 'near', path: near, sub: 0 }] },
    ], trail,
  };
}

// ================= COAST（海岸） =================
function coast(seed) {
  const sun = sunParts(700, 520, 80, 2);
  const sea = rectPath(-60, 600, PW + 120, 1000);
  const swell = wavesPath(0, 1000, 620, 960, 30, seed + 4, 90);
  const stacks = polyPath([[160, 600], [190, 470], [240, 440], [270, 600]]); stacks.addPath(polyPath([[300, 600], [315, 520], [345, 530], [360, 600]]));
  const cliffs = polyPath([[-60, 520], [120, 540], [240, 610], [340, 700], [420, 820], [480, 960], [520, 1300], [-60, 1300]]);
  const cliffLit = polyPath([[120, 540], [240, 610], [340, 700], [420, 820], [380, 830], [300, 720], [200, 630]]);
  const near = polyPath([[-60, 1040], [200, 1010], [500, 1040], [800, 1000], [1060, 1020], [1060, 1600], [-60, 1600]]);
  const grass = new Path2D(); const r = mulberry(seed + 9); for (let i = 0; i < 40; i++) { const x = r() * 1000, y = 1000 + r() * 40; grass.addPath(polyPath([[x, y + 20], [x + 4 + r() * 10, y - 40 - r() * 60], [x + 8, y + 20]])); }
  const trail = [[600, 1200], [640, 1120], [720, 1060], [820, 1020]].map(q => ({ x: q[0], y: q[1], plane: 'near' }));
  return {
    planes: [
      skyPlane(sun.knock, 140, 330),
      { id: 'sun', depth: .15, parts: [{ ink: 'sun', path: sun.disc, sub: 0 }] },
      { id: 'far', depth: .35, parts: [{ ink: 'sky2', path: sea, sub: 0 }, { ink: 'sky1', path: swell, sub: 1 }, { ink: 'far', path: stacks, sub: 0 }] },
      { id: 'mid', depth: .7, parts: [{ ink: 'mid', path: cliffs, sub: 0 }, { ink: 'far', path: cliffLit, sub: 1 }] },
      { id: 'near', depth: 1.5, parts: [{ ink: 'near', path: near, sub: 0 }, { ink: 'near', path: grass, sub: 0 }] },
    ], trail,
  };
}

export const SCENES = { lake, waterfall, ridge, forest: forestScene, coast };
export function buildScene(name, seed = 1) { const f = SCENES[name] || SCENES.lake; return f(seed); }
