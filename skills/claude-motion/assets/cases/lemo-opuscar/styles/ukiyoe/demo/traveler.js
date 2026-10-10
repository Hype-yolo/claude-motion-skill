// 旅人：斗笠、藍色旅装（下摆掖起）、深色绑腿、草鞋、背后包袱、手杖；雨天披蓑衣
// 局部坐标：脚底 (0,0)，身高约 100 单位（含斗笠），面朝左（-x）。s = 像素身高。
import { clamp, lerp, TAU } from '/core/lib.js';
import { PAL, smooth, poly } from './print.js';

const INK = PAL.sumi, KIMONO = '#2c4a70', KIMONO_D = '#1f3656', GAITER = '#1d2c44', BUNDLE = '#a9b48c', PATE = '#c5ccc8';
function shape(x, pts, fill, lw, closed = true, sm = true) {
  x.beginPath(); sm ? smooth(x, pts, closed) : poly(x, pts);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (lw) { x.lineWidth = lw; x.strokeStyle = INK; x.stroke(); }
}
// 变宽肢体（折线 + 各点宽度）→ 多边形
function limbPoly(pts, ws) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    L.push([pts[i][0] - dy * ws[i] / 2, pts[i][1] + dx * ws[i] / 2]); R.push([pts[i][0] + dy * ws[i] / 2, pts[i][1] - dx * ws[i] / 2]);
  }
  return L.concat(R.reverse());
}
const lp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
function leg(x, hip, knee, ankle, lw, far, toe = -1) {
  const skin = far ? '#dcc39c' : PAL.skin, gait = far ? '#141f33' : GAITER;
  shape(x, limbPoly([hip, knee, ankle], [6.4, 5, 3.4]), skin, lw, true, false);
  // 绑腿（膝下到踝上）
  const g0 = lp(knee, ankle, .12), gm = lp(knee, ankle, .45), g1 = lp(knee, ankle, .93);
  shape(x, limbPoly([g0, gm, g1], [5.8, 5.9, 4]), gait, lw * .8, true, false);
  // 草鞋 + 脚
  const f = ankle;
  shape(x, [[f[0] - 1.5, f[1] - 2.2], [f[0] + toe * 5.2, f[1] - .8], [f[0] + toe * 5.6, f[1] + .4], [f[0] + 2.2, f[1] + .4], [f[0] + 2, f[1] - 2]], skin, lw * .7, true, false);
  x.fillStyle = PAL.straw; x.fillRect(Math.min(f[0] + toe * 6, f[0] + 2.6), f[1] + .2, 8.6, 1.5);
}
// 斗笠（侧视：低矮的圆锥，笠沿略翘）
export function kasa(x, cx, cy, tilt, lw, scale = 1, under = true) {
  x.save(); x.translate(cx, cy); x.rotate(tilt); x.scale(scale, scale);
  const Wd = 27, Hh = 11.5;
  if (under) shape(x, [[-Wd, 0], [-8, 3.4], [8, 3.4], [Wd, 0], [0, 1]], '#7d5d2c', 0);
  shape(x, [[-Wd - 1, .6], [-13, -5.6], [-2, -Hh], [2, -Hh], [13, -5.6], [Wd + 1, .6], [0, 2.2]], PAL.straw, lw, true, false);
  x.lineWidth = lw * .4; x.strokeStyle = '#7a5a2a';
  for (let i = -6; i <= 6; i++) { if (!i) continue; x.beginPath(); x.moveTo(i * .25, -Hh + .8); x.lineTo(i / 6.3 * Wd, 1.2 - Math.abs(i) * .05); x.stroke(); }
  x.lineWidth = lw * .5; x.beginPath(); x.moveTo(-Wd + 2, -.8); x.quadraticCurveTo(0, 2.6, Wd - 2, -.8); x.stroke();
  x.restore();
}
// 侧脸（摘斗笠时）：月代（剃青的前额）+ 发髻
function headSide(x, lw) {
  shape(x, [[-7.5, -86], [-6.5, -91], [-2, -94.5], [4, -95], [7.5, -91], [8, -85], [5.5, -79.5], [1, -77.6], [-3.5, -77.8], [-5.2, -80], [-7.4, -81.2], [-6.4, -83.2], [-8.2, -85]], PAL.skin, lw * .8, true, false);
  // 月代（浅青灰）+ 鬓发（黑）
  shape(x, [[-6.4, -90.8], [-2, -94.4], [3, -94.9], [1.5, -91.5], [-3.5, -89.4]], PATE, 0, true, true);
  shape(x, [[3, -95.1], [7.6, -91.2], [8.2, -85], [6, -80.5], [3.6, -84], [4.2, -88], [1.5, -91.5]], INK, 0, true, true);
  // 发髻（向前折在头顶）
  shape(x, [[5.5, -95], [1, -97.6], [-3.4, -97.2], [-3.2, -96], [1, -96], [4.6, -93.6]], INK, 0, true, false);
  x.lineWidth = lw * .45; x.strokeStyle = INK;
  x.beginPath(); x.moveTo(-5.6, -88.4); x.quadraticCurveTo(-4, -89.2, -2.2, -88.6); x.stroke();        // 眉
  x.beginPath(); x.moveTo(-5.4, -86.3); x.lineTo(-2.8, -86.5); x.stroke();                               // 眼
  x.beginPath(); x.moveTo(-5.6, -80.7); x.lineTo(-3.6, -80.9); x.stroke();                               // 口
  x.beginPath(); x.moveTo(3.2, -86.5); x.quadraticCurveTo(1.6, -85, 2.8, -83.6); x.stroke();             // 耳
}
export function traveler(x, px, py, s, o = {}) {
  const u = s / 100, lw = clamp(s / 60, 1.1, 2.6) / u;
  x.save(); x.translate(px, py); x.scale(u * (o.flip ? -1 : 1), u); x.lineJoin = 'round'; x.lineCap = 'round';
  if (o.mode === 'back') back(x, lw, o); else if (o.mode === 'sit') sit(x, lw, o); else side(x, lw, o);
  x.restore();
}

function side(x, lw, o) {
  const walk = o.mode === 'walk', ph = (o.ph || 0) * TAU, tw = o.t || 0;
  const bob = walk ? -Math.abs(Math.sin(ph)) * 1.4 + .7 : 0, lean = walk ? -.1 : (o.lean || 0);
  const hip = [1.5, -40 + bob];
  // 步态：两腿反相
  const gait = p => {
    const sw = Math.sin(p), lift = Math.max(0, Math.cos(p));
    const th = walk ? .44 * sw : .05, kn = walk ? .05 + lift * .75 : .03;
    const knee = [hip[0] - Math.sin(th) * 19, hip[1] + Math.cos(th) * 19], a2 = th - kn;
    const ank = [knee[0] - Math.sin(a2) * 21, knee[1] + Math.cos(a2) * 21];
    return [knee, [ank[0], Math.min(ank[1], -1.2 * (walk ? 0 : 0))]];
  };
  const [kF, aF] = gait(ph), [kB, aB] = gait(ph + Math.PI);
  const wind = o.wind || 0;
  // 帽绳（背风向右飘）
  if (wind) { x.lineWidth = lw * .45; x.strokeStyle = INK; const fl = Math.sin(tw * 9) * 2.5; x.beginPath(); x.moveTo(-1, -78); x.quadraticCurveTo(9, -79 + fl, 18 + wind * 5, -82 + fl * 1.5); x.stroke(); x.beginPath(); x.moveTo(0, -78); x.quadraticCurveTo(8, -75 - fl, 15 + wind * 4, -74 - fl * 1.2); x.stroke(); }
  leg(x, hip, kB, aB, lw, true);
  x.save(); x.translate(hip[0], hip[1]); x.rotate(lean); x.translate(-hip[0], -hip[1]);
  // 手杖
  const st = walk ? Math.sin(ph) * .07 : 0;
  if (!o.noStaff) { x.save(); x.translate(-13.5, -58); x.rotate(-.1 + st); shape(x, [[-1.3, -28], [1.3, -28], [1.3, 58], [-1.3, 58]], PAL.woodL, lw * .8, true, false); x.restore(); }
  // 包袱（斜背，结在胸前）
  shape(x, [[3, -75], [13, -77.5], [19, -70], [18.5, -60], [12, -54], [4, -57]], BUNDLE, lw);
  x.strokeStyle = '#6f7a58'; x.lineWidth = lw * .5; [[9, -70], [14, -64], [11, -59]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 2, .3, 5.4); x.stroke(); });
  // 后襟掖进腰带的尖角
  shape(x, [[5, -49], [10.5, -47], [11.5, -36], [7, -38.5]], KIMONO_D, lw, true, false);
  // 上身 + 下摆
  shape(x, [[-7.5, -74.5], [3.5, -76.5], [8, -66], [9, -50], [8.5, -36], [2, -33.5], [-4, -34.5], [-9, -31], [-9.5, -44], [-8.8, -60]], KIMONO, lw);
  // 前襟与衣纹
  x.strokeStyle = INK; x.lineWidth = lw * .55;
  x.beginPath(); x.moveTo(-5.5, -74); x.quadraticCurveTo(-3, -62, -8.6, -50); x.stroke();
  x.beginPath(); x.moveTo(-2, -47); x.quadraticCurveTo(-3, -40, -4.5, -34.5); x.moveTo(4, -47); x.quadraticCurveTo(4, -41, 3.5, -34.5); x.stroke();
  // 衣上的井桁絣（小白十字）
  x.strokeStyle = 'rgba(236,228,206,.85)'; x.lineWidth = lw * .35;
  [[-4, -68], [2, -65], [5, -58], [-3, -58], [1, -43], [-6, -40], [6, -40]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a - 1.2, b); x.lineTo(a + 1.2, b); x.moveTo(a, b - 1.2); x.lineTo(a, b + 1.2); x.stroke(); });
  shape(x, [[-7, -75], [-3.5, -76], [-5.6, -69.5]], PAL.white, lw * .5, true, false);   // 白衬领
  shape(x, [[-9.2, -53], [9, -54], [9.2, -49], [-9.3, -48]], PAL.ochre, lw * .7, true, false); // 腰带
  shape(x, [[-8, -71], [-4.4, -72], [-5.4, -67.4], [-8.6, -67.2]], BUNDLE, lw * .5, true, false); // 包袱结
  // 蓑衣
  if (o.mino) {
    const mp = [[-10, -79], [4, -81], [14, -74], [19, -54], [17, -38], [5, -36], [-6, -37], [-12, -41], [-12, -62]];
    shape(x, mp, '#a38650', lw);
    x.lineWidth = lw * .4; x.strokeStyle = '#5a4526';
    for (let i = 0; i < 18; i++) { const a = -11 + i * 1.7; x.beginPath(); x.moveTo(a + 1, -76 + Math.abs(i - 8) * .4); x.lineTo(a + 1.8 + (i - 9) * .3, -38 - (i % 3) * 1.4); x.stroke(); }
    x.beginPath(); x.moveTo(-12, -40); for (let i = 0; i < 12; i++) x.lineTo(-12 + i * 2.6, -37 + (i % 2) * 2.6); x.stroke();
  }
  // 前袖与手
  const hold = o.holdHat, sw = walk ? Math.sin(ph) * 1.5 : 0;
  if (hold) shape(x, [[-4, -74], [-10, -80], [-16, -86], [-19, -84], [-15, -78], [-8, -68], [0, -66]], KIMONO, lw);
  else shape(x, [[-4, -74], [-11, -65 + sw * .3], [-14, -56 + sw], [-15, -50 + sw], [-8, -49.5 + sw], [-4, -56], [1, -66]], KIMONO, lw);
  x.fillStyle = PAL.skin; x.beginPath(); hold ? x.arc(-18.5, -86.5, 2.2, 0, TAU) : x.arc(-13.5, -52 + sw * .6, 2.3, 0, TAU); x.fill(); x.lineWidth = lw * .55; x.strokeStyle = INK; x.stroke();
  // 头：斗笠下只露下半张脸
  const tilt = o.tilt ?? 0;
  if (o.hatOff) headSide(x, lw);
  else {
    shape(x, [[-6.6, -84], [-6.4, -81], [-7.2, -80.4], [-5.6, -78], [-2, -76.8], [3, -78], [4.5, -83]], PAL.skin, lw * .75, true, false);
    x.lineWidth = lw * .45; x.strokeStyle = INK; x.beginPath(); x.moveTo(-5.4, -79.2); x.lineTo(-3.8, -79.4); x.stroke();
    kasa(x, -1, -84, tilt, lw);
  }
  x.restore();
  leg(x, hip, kF, aF, lw, false);
}

function sit(x, lw, o) {
  // 坐在凳上：凳面高度 = y -40；面朝左
  const breath = Math.sin((o.t || 0) * 2.2) * .5;
  leg(x, [2, -40], [-15, -41.5], [-14, -2], lw, true, -1);
  leg(x, [-2, -38.5], [-19, -39.5], [-19.5, -1.5], lw, false, -1);
  // 下摆盖住大腿
  shape(x, [[-6, -53], [10, -53], [12, -38], [4, -35], [-22, -35.5], [-23.5, -43], [-10, -47]], KIMONO, lw);
  x.strokeStyle = INK; x.lineWidth = lw * .5; x.beginPath(); x.moveTo(-8, -46); x.quadraticCurveTo(-14, -41, -21, -38); x.stroke();
  x.save(); x.translate(0, breath);
  shape(x, [[-6, -78], [5, -80], [10, -68], [11, -51], [-6.5, -50.5], [-8.5, -63]], KIMONO, lw);
  x.strokeStyle = 'rgba(236,228,206,.85)'; x.lineWidth = lw * .35;
  [[-2, -70], [4, -66], [6, -58], [-3, -59], [-12, -40], [0, -41]].forEach(([a, b]) => { x.beginPath(); x.moveTo(a - 1.2, b); x.lineTo(a + 1.2, b); x.moveTo(a, b - 1.2); x.lineTo(a, b + 1.2); x.stroke(); });
  shape(x, [[-7, -54], [11, -55], [11, -50], [-6.5, -49.5]], PAL.ochre, lw * .7, true, false);
  shape(x, [[-5.5, -78.5], [-1.8, -79.5], [-4.2, -72]], PAL.white, lw * .5, true, false);
  // 双手捧茶碗
  const lift = o.cup ?? 0, cy = lerp(-56, -74, lift), cx = lerp(-15, -11.5, lift);
  shape(x, [[-2, -77], [-10, -68], [cx - 3, cy + 5], [cx + 4, cy + 7.5], [0, -63], [5, -73]], KIMONO, lw);
  x.fillStyle = PAL.skin; x.beginPath(); x.arc(cx + .5, cy + 2.4, 2.4, 0, TAU); x.fill(); x.lineWidth = lw * .55; x.strokeStyle = INK; x.stroke();
  shape(x, [[cx - 5.5, cy - 4.4], [cx + 3.5, cy - 4.4], [cx + 2.4, cy + 1.2], [cx - 4.4, cy + 1.2]], '#6b5a42', lw * .6, true, false);
  x.fillStyle = PAL.white; x.fillRect(cx - 4.6, cy - 4.2, 7.6, 1.1);
  // 头：喝茶时微仰
  x.save(); x.translate(0, -78); x.rotate(lerp(0, -.14, lift)); x.translate(0, 78);
  headSide(x, lw);
  x.restore();
  x.restore();
}

function back(x, lw, o) {
  // 背影，面朝画内（山）
  leg(x, [-3.5, -40], [-4.2, -21], [-4.8, 0], lw, false, 0);
  leg(x, [3.5, -40], [4.2, -21], [4.8, 0], lw, false, 0);
  if (!o.noStaff) shape(x, [[14, -86], [16.4, -86], [18.6, 1], [16.2, 1]], PAL.woodL, lw * .8, true, false);
  shape(x, [[-11, -52], [11, -52], [12.5, -32], [4, -30], [-4, -31], [-12.5, -32]], KIMONO, lw);
  shape(x, [[-10.5, -76], [10.5, -76], [12.5, -63], [11, -51], [-11, -51], [-12.5, -63]], KIMONO, lw);
  shape(x, [[-11, -55], [11, -55], [11, -50], [-11, -50]], PAL.ochre, lw * .7, true, false);
  x.strokeStyle = INK; x.lineWidth = lw * .5; x.beginPath(); x.moveTo(0, -49); x.lineTo(0, -31); x.stroke();
  // 包袱
  shape(x, [[-8.5, -75.5], [8.5, -75.5], [10.5, -64], [7, -57], [-7, -57], [-10.5, -64]], BUNDLE, lw);
  x.strokeStyle = '#6f7a58'; x.lineWidth = lw * .5; [[-4, -69], [4, -66], [-1, -61]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 2, .3, 5.4); x.stroke(); });
  const off = o.hatOff || 0;
  shape(x, [[-10.5, -75], [-14.5, -62], [-14, -51], [-9.5, -52], [-9, -68]], KIMONO, lw);
  if (off > 0) shape(x, [[10.5, -75], [14.5, -62], [15, -52], [10.5, -52], [9, -68]], KIMONO, lw);
  else shape(x, [[10.5, -75], [15.5, -76], [15.5, -84], [11.5, -82], [9, -71]], KIMONO, lw);
  // 后脑：黑发 + 发髻
  shape(x, [[-5.8, -85], [-5, -91], [0, -93.5], [5, -91], [5.8, -85], [4, -78.5], [-4, -78.5]], INK, 0);
  shape(x, [[-1.5, -93], [1.5, -93], [1.2, -98], [-1.2, -98]], INK, 0, true, false);
  if (off > 0) {
    const hx = lerp(0, 21, off), hy = lerp(-86, -50, off), tl = lerp(0, 1.3, off), sq = lerp(1, .3, off);
    x.save(); x.translate(hx, hy); x.rotate(tl);
    x.beginPath(); x.ellipse(0, 0, 27, 27 * lerp(.26, 1, off) * sq + 2, 0, 0, TAU); x.fillStyle = PAL.straw; x.fill(); x.lineWidth = lw; x.strokeStyle = INK; x.stroke();
    x.lineWidth = lw * .4; x.strokeStyle = '#7a5a2a'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 26, Math.sin(a) * (27 * lerp(.26, 1, off) * sq + 1)); x.stroke(); }
    x.restore();
  } else {
    x.beginPath(); x.ellipse(0, -86, 27, 6.5, 0, 0, TAU); x.fillStyle = PAL.straw; x.fill(); x.lineWidth = lw; x.strokeStyle = INK; x.stroke();
    x.beginPath(); x.moveTo(-26, -86); x.quadraticCurveTo(0, -101, 26, -86); x.closePath(); x.fill(); x.stroke();
    x.lineWidth = lw * .4; x.strokeStyle = '#7a5a2a'; for (let i = -5; i <= 5; i++) { x.beginPath(); x.moveTo(0, -97); x.lineTo(i * 4.9, -85.5 + Math.abs(i) * .15); x.stroke(); }
  }
}
