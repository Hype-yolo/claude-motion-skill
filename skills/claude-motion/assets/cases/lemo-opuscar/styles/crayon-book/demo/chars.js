// 角色：小女孩（Pip）、月亮、小羊玩偶。全部参数化：视角 × 表情 × 姿势。
import { line, fill, dab, ellipse, handCircle, xf, smooth, bez } from './crayon.js';
import { part, tube, curve, knock } from './rig.js';
import { PAL } from './pal.js';
import { hash, clamp, lerp } from '/core/lib.js';
const C_ = PAL.crayon;
const LW = 7;   // 角色轮廓笔粗（屏幕 px，s=1 时）

// 局部坐标变换器
function T0(o) { const k = o.flip ? -1 : 1; return pts => xf(pts, { x: o.x || 0, y: o.y || 0, s: o.s || 1, r: o.r || 0, sx: k }); }
const lo = (seed, extra = {}) => ({ w: LW, seed, ...extra });

// ———————————————— 小女孩 ————————————————
// 头：局部原点 = 脸中心，R≈62
export function head(C, o) {
  const T = T0(o), view = o.view || 'front', ex = o.expr || 'awake', sd = (o.seed || 100);
  const P = (pts) => T(pts);
  const faceC = [0, 0];
  // 视角带来的五官偏移
  const turn = { front: 0, q: 1, side: 2, back: 3 }[view];
  const hairF = { col: C_.brown, p: 0.85, gap: 8, w: 10, ang: 1.2, seed: sd + 1, over: 2.5 };
  const skinF = { col: C_.peach, p: 0.5, gap: 10, w: 12, ang: 0.5, seed: sd + 2, over: 4 };
  // 1) 后发
  if (turn === 3) {
    const back = smooth([[-68, 14], [-72, -30], [-48, -66], [0, -78], [48, -66], [72, -30], [68, 14], [38, 24], [0, 20], [-38, 24]], 6);
    part(C, P(back), hairF, lo(sd + 3));
    // 后脑的几根发丝
    line(C.l, P(curve([[-20, -60], [-26, -20], [-22, 16]])), lo(sd + 4, { w: 4, p: 0.6 }));
    line(C.l, P(curve([[18, -62], [24, -22], [20, 14]])), lo(sd + 5, { w: 4, p: 0.6 }));
    star(C, P([[-52, -34]])[0], 13 * (o.s || 1), sd + 6, o.r || 0);
    tuft(C, P, sd);
    return;
  }
  const hx = turn === 0 ? 0 : turn === 1 ? -12 : -26;
  const backHair = smooth([[-70 + hx * .4, 16], [-74 + hx * .5, -24], [-54 + hx * .3, -64], [0 + hx * .2, -78], [52, -64], [72 - (turn ? 10 : 0), -26], [68 - (turn ? 18 : 0), 14], [0, 12]], 6);
  part(C, P(backHair), hairF, lo(sd + 3));
  // 2) 脸
  let face;
  if (turn < 2) face = ellipse(0, 0, 64, 60, 44);
  else {   // 侧面：圆脸 + 小鼻头 + 下巴
    face = smooth([[0, -60], [40, -50], [60, -24], [66, -2], [74, 6], [66, 14], [62, 30], [44, 52], [14, 60], [-24, 54], [-50, 30], [-60, 0], [-50, -34], [-28, -56]], 6);
  }
  part(C, P(face), skinF, null);
  // 脸的轮廓只描头发外露的下半圈
  if (turn < 2) line(C.l, P(ellipse(0, 0, 64, 60, 36, -0.12, Math.PI + 0.12)), lo(sd + 7));
  else line(C.l, P(face.slice(Math.floor(face.length * 2 / 14), Math.floor(face.length * 11 / 14))), lo(sd + 7));
  // 3) 刘海 + 两侧发片
  const bangs = turn === 0
    ? [[-64, -10], [-60, -36], [-40, -56], [0, -64], [40, -56], [60, -36], [64, -10], [52, -22], [40, -12], [26, -24], [12, -14], [-4, -24], [-18, -14], [-32, -24], [-46, -12], [-56, -22]]
    : turn === 1
      ? [[-60, -12], [-56, -40], [-30, -60], [12, -64], [48, -52], [64, -30], [66, -12], [56, -22], [46, -12], [34, -24], [20, -14], [6, -24], [-8, -14], [-22, -24], [-36, -12], [-48, -22]]
      : [[-58, 4], [-56, -34], [-30, -60], [10, -64], [42, -52], [58, -30], [54, -18], [44, -26], [32, -16], [20, -28], [8, -20], [-6, -28], [-14, -8], [-26, 14], [-40, 20], [-52, 18]];
  const bs = smooth(bangs, 3); part(C, P(bs), { ...hairF, seed: sd + 8, ang: 1.0 }, null);
  const nb = bangs.length, lowIdx = 7 * 3;   // 下缘（锯齿刘海）才描线
  line(C.l, P(bs.slice(lowIdx - 3, bs.length - 1)), lo(sd + 9));
  if (turn === 0) {
    part(C, P(smooth([[-64, -14], [-56, -10], [-52, 12], [-58, 20], [-70, 18], [-72, 0]], 4)), { ...hairF, seed: sd + 10 }, null);
    part(C, P(smooth([[64, -14], [56, -10], [52, 12], [58, 20], [70, 18], [72, 0]], 4)), { ...hairF, seed: sd + 12 }, null);
    line(C.l, P([[-58, -12], [-53, 6], [-58, 20]]), lo(sd + 11, { w: 5.5 })); line(C.l, P([[58, -12], [53, 6], [58, 20]]), lo(sd + 13, { w: 5.5 }));
  } else if (turn === 1) {
    part(C, P(smooth([[-60, -14], [-52, -8], [-48, 12], [-54, 20], [-68, 18], [-70, 0]], 4)), { ...hairF, seed: sd + 10 }, null);
    line(C.l, P([[-54, -10], [-49, 6], [-54, 20]]), lo(sd + 11, { w: 5.5 }));
  }
  tuft(C, P, sd);
  // 发夹：黄色小星星（呼应星空）
  const clipAt = turn === 0 ? [48, -40] : turn === 1 ? [36, -48] : [-10, -52];
  star(C, P([clipAt])[0], 12 * (o.s || 1), sd + 6, o.r || 0);
  // 4) 五官
  const fx = turn === 0 ? 0 : turn === 1 ? 16 : 34;
  const eyeX = turn === 0 ? [-22, 22] : turn === 1 ? [-6, 30] : [42];
  const eyeY = 4;
  eyeX.forEach((x, i) => eye(C, P, x, eyeY, ex, sd + 20 + i, o, turn === 1 && i === 0 ? 0.85 : 1, turn));
  // 腮红
  const ck = turn === 0 ? [[-38, 22], [38, 22]] : turn === 1 ? [[-22, 24], [46, 22]] : [[30, 24]];
  ck.forEach(([x, y], i) => dab(C.f, ...P([[x, y]])[0], 10 * (o.s || 1), { col: C_.pink, p: 0.75, seed: sd + 30 + i, sq: 0.75 }));
  // 鼻子（3/4 侧才画一小笔）
  mouth(C, P, fx + (turn === 2 ? 20 : 0), 30, ex, sd + 40, o, turn);
  // 眉毛（表情需要时）
  if (ex === 'surprised' || ex === 'worried') eyeX.forEach((x, i) => line(C.l, P([[x - 9, -22 - (ex === 'surprised' ? 6 : 0) + (ex === 'worried' ? (i ? 4 : -4) * (turn ? 0 : 1) : 0)], [x + 9, -22 - (ex === 'surprised' ? 6 : 0) - (ex === 'worried' ? (i ? 4 : -4) * (turn ? 0 : 1) : 0)]]), lo(sd + 50 + i, { w: 4, p: 0.85 })));
}
function tuft(C, P, sd) {
  line(C.l, P(curve([[-6, -76], [2, -96], [18, -98], [16, -84], [6, -88]])), lo(sd + 60, { w: 6, col: C_.brown, p: 0.95 }));
}
function eye(C, P, x, y, ex, sd, o, k, turn) {
  const s = o.s || 1;
  if (ex === 'sleep' || ex === 'closed') { line(C.l, P([[x - 10 * k, y - 2], [x - 4 * k, y + 5], [x + 4 * k, y + 5], [x + 10 * k, y - 2]]), lo(sd, { w: 5, taper: 0.3 })); return; }
  if (ex === 'happy') { line(C.l, P([[x - 10 * k, y + 5], [x - 4 * k, y - 4], [x + 4 * k, y - 4], [x + 10 * k, y + 5]]), lo(sd, { w: 5, taper: 0.3 })); return; }
  const r = ex === 'surprised' ? 9 : ex === 'wide' ? 8.5 : 7;
  const pupil = ellipse(x, y, r * 0.8 * k, r * 1.05, 16);
  part(C, P(pupil), { col: C_.ink, p: 1, gap: 3.2, w: 5, over: 0.5, seed: sd, ang: 1.3 }, lo(sd + 1, { w: 4 }), { occ: false });
  // 小高光（白蜡）
  dab(C.l, ...P([[x + 2.5 * k, y - 3.5]])[0], 2.4 * s, { col: C_.white, p: 1, seed: sd + 2, gap: 2, w: 3 });
  if (ex === 'sleepy') {   // 眼皮盖下一半
    const lid = [[x - r - 3, y - r - 4], [x + r + 3, y - r - 4], [x + r + 3, y + 1], [x - r - 3, y + 1]];
    part(C, P(lid), { col: C_.peach, p: 0.6, gap: 4, w: 6, over: 1, seed: sd + 3 }, null, { occ: true, kn: false });
    line(C.l, P([[x - r - 2, y + 1], [x + r + 2, y + 1]]), lo(sd + 4, { w: 4.5 }));
  }
}
function mouth(C, P, x, y, ex, sd, o, turn) {
  const k = turn === 2 ? 0.6 : 1;
  if (ex === 'sing') { const m = ellipse(x, y, 7 * k, 9, 20); part(C, P(m), { col: C_.red, p: 0.85, gap: 3, w: 4, over: 0.5, seed: sd }, lo(sd + 1, { w: 4.5 }), { occ: false }); return; }
  if (ex === 'yawn') { const m = ellipse(x, y + 2, 9 * k, 14, 20); part(C, P(m), { col: C_.red, p: 0.9, gap: 3, w: 4, over: 0.5, seed: sd }, lo(sd + 1, { w: 4.5 }), { occ: false }); return; }
  if (ex === 'surprised') { const m = ellipse(x, y + 2, 6 * k, 7, 16); part(C, P(m), { col: C_.red, p: 0.8, gap: 3, w: 4, over: 0.5, seed: sd }, lo(sd + 1, { w: 4 }), { occ: false }); return; }
  if (ex === 'smile' || ex === 'happy') { const m = [[x - 12 * k, y - 3], [x - 6 * k, y + 6], [x + 6 * k, y + 6], [x + 12 * k, y - 3]]; part(C, P(m), { col: C_.red, p: 0.8, gap: 3, w: 4, over: 0.5, seed: sd }, lo(sd + 1, { w: 4.5 }), { occ: false }); return; }
  if (ex === 'worried') { line(C.l, P([[x - 7 * k, y + 3], [x, y - 1], [x + 7 * k, y + 3]]), lo(sd, { w: 4.5 })); return; }
  // awake / sleep / sleepy：小弧
  line(C.l, P([[x - 7 * k, y - 1], [x, y + 3], [x + 7 * k, y - 1]]), lo(sd, { w: 4.5 }));
}
export function star(C, c, r, seed, rot = 0, col = C_.yellow, lineOn = true) {
  const pts = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + rot + k * Math.PI / 5; const rr = k % 2 ? r * 0.48 : r; pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]); }
  part(C, pts, { col, p: 0.95, gap: 3.5, w: 5, over: 1, seed }, lineOn ? { w: 4, seed: seed + 1, col: C_.orange, p: 0.8 } : null, { occ: false });
}

// 身体：局部原点 = 脚底中心，身高约 330
// pose: stand | wave | climb | sit | lie | bed ；view: front | q | side | back
export function girl(C, o) {
  const T = T0(o), view = o.view || 'front', pose = o.pose || 'stand', sd = o.seed || 200;
  const P = pts => T(pts);
  const gownF = { col: C_.pink, p: 0.62, gap: 11, w: 12, ang: 0.35, seed: sd + 1 };
  const skinF = { col: C_.peach, p: 0.5, gap: 10, w: 11, ang: 0.6, seed: sd + 2, over: 3 };
  const sockF = { col: C_.sky, p: 0.7, gap: 7, w: 9, ang: 1.4, seed: sd + 3, over: 2 };
  const A = o.arms || {};
  const side = view === 'side' || view === 'q';
  const legW = 20, armW = 16;
  const limb = (pts, w, f, s) => part(C, P(tube(curve(pts, 5), w)), f, lo(s));
  const leg = (pts, s) => {   // 腿 + 条纹袜 + 脚
    limb(pts, legW, skinF, s);
    const n = pts.length; const a = pts[n - 2], b = pts[n - 1];
    const sock = [a.map((v, i) => lerp(v, b[i], 0.25)), b];
    part(C, P(tube(sock, legW + 2)), sockF, lo(s + 1));
    // 袜子条纹
    for (let k = 1; k <= 2; k++) { const u = 0.35 + k * 0.22; const c = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy); const nx = -dy / d * 9, ny = dx / d * 9; line(C.l, P([[c[0] - nx, c[1] - ny], [c[0] + nx, c[1] + ny]]), lo(s + 2 + k, { w: 4, col: C_.white, p: 1 })); }
    const fd = o.footDir ?? (view === 'side' ? 1 : 0);
    const foot = ellipse(b[0] + (fd ? 10 : 0), b[1] + 2, fd ? 17 : 13, 9, 20);
    part(C, P(foot), sockF, lo(s + 5));
  };
  const hand = (c, s) => part(C, P(handCircle(c[0], c[1], 10, s, 0, 18)), skinF, lo(s, { w: 5.5 }));
  // 各姿势骨架（局部坐标）
  let headC = [0, -252], headR = 0, headView = view;
  let legs = [], arms = [], gown = null, collar = true, sleeves = [];
  const hem = (x0, x1, y, n = 5) => { const out = []; for (let i = 0; i <= n * 2; i++) { const u = i / (n * 2); out.push([lerp(x1, x0, u), y + (i % 2 ? 7 : 0)]); } return out; };
  if (pose === 'stand' || pose === 'wave') {
    const wide = view === 'side' ? 0.72 : view === 'q' ? 0.9 : 1;
    legs = view === 'side'
      ? [[[4, -90], [6, -50], [2, -12]], [[-6, -90], [-8, -50], [-12, -12]]]
      : [[[-18, -90], [-19, -50], [-20, -12]], [[18, -90], [19, -50], [20, -12]]];
    gown = smooth([[-28 * wide, -198], [28 * wide, -198], [44 * wide, -176], [74 * wide + (side ? 8 : 0), -78], ...hem(-74 * wide + (side ? -4 : 0), 74 * wide + (side ? 8 : 0), -78).slice(1, -1), [-74 * wide - (side ? 4 : 0), -78], [-44 * wide, -176]], 3);
    const aR = pose === 'wave' ? [[34, -182], [78, -200], [92, -250]] : [[34 * wide, -182], [54 * wide, -146], [64 * wide, -112]];
    const aL = [[-34 * wide, -182], [-54 * wide, -146], [-64 * wide, -112]];
    if (view === 'side') arms = [[[4, -182], [18, -146], [30, -114]]];
    else if (view === 'q') arms = [aL, aR];
    else arms = [aL, aR];
    if (A.R) arms[arms.length - 1] = A.R; if (A.L && arms.length > 1) arms[0] = A.L;
    if (o.legs) legs = o.legs;
  } else if (pose === 'climb') {
    // 背面爬梯：左手高抓、右手低抓，左脚踩实、右脚抬起
    const ph = o.ph || 0;   // 0/1 两个交替关键姿势
    const up = ph ? 1 : 0;
    legs = [[[-18, -90], [-20, -52], [-20, -14]], [[18, -90], [32, -68], [26, -46]]];
    if (up) legs = [[[-18, -90], [-32, -68], [-26, -46]], [[18, -90], [20, -52], [20, -14]]];
    gown = smooth([[-28, -198], [28, -198], [44, -176], [68, -82], ...hem(-68, 68, -82).slice(1, -1), [-68, -82], [-44, -176]], 3);
    arms = up ? [[[-34, -184], [-66, -206], [-72, -236]], [[34, -184], [70, -236], [66, -300]]] : [[[-34, -184], [-70, -236], [-66, -300]], [[34, -184], [66, -206], [72, -236]]];
    headView = 'back';
  } else if (pose === 'sit') {
    // 侧坐（面朝右），原点 = 屁股着地点；腿搭在前方斜面上
    headC = [4, -168]; headR = o.headTilt ?? -0.18;
    const knee = [58, -22];
    legs = [[[20, -18], knee, [74, 36], [80, 60]]];
    legs.push([[12, -16], [50, -26], [60, 30], [68, 54]]);
    gown = smooth([[-16, -118], [24, -118], [34, -96], [40, -48], [70, -40], ...hem(-10, 76, -14, 4).slice(1, -1).map(([x, y]) => [x, y]), [-26, -10], [-34, -40], [-30, -96]], 3);
    arms = o.hug ? [[[20, -104], [38, -70], [54, -60]]] : [[[16, -106], [34, -72], [52, -56]]];
    if (A.R) arms = [A.R];
    collar = true; headView = view === 'front' ? 'q' : view;
  } else if (pose === 'lie') {
    // 蜷着睡（侧躺面朝右），原点 = 身体下方中心
    headC = [96, -58]; headR = 1.35; headView = 'side';
    legs = [[[-70, -40], [-40, -10], [-76, 0], [-96, -4]], [[-66, -30], [-30, -4], [-64, 6], [-86, 8]]];
    gown = smooth([[64, -78], [70, -44], [40, -8], [-20, 0], ...hem(-66, -30, -2, 3).slice(1, -1), [-78, -24], [-60, -60], [0, -82], [40, -86]], 3);
    arms = [[[50, -64], [74, -34], [100, -26]]];
    collar = false;
  } else if (pose === 'lieback') {
    // 仰面躺着（头在左、脚在右），原点 = 臀部着地点；小羊趴在胸口
    headC = [-150, -56]; headR = -Math.PI / 2 + (o.headTilt || 0); headView = 'side';
    legs = [[[30, -26], [92, -46], [150, -14]], [[24, -18], [96, -30], [158, -6]]];
    gown = smooth([[-112, -64], [-96, -78], [-50, -82], [-6, -72], [40, -58], [66, -46], ...hem(72, 60, -6, 4).slice(1, -1).map(([x, y]) => [lerp(66, 58, (y + 46) / 40) + (x - 66) * 0, y]).map((q, i) => [q[0] + (i % 2 ? 6 : 0), -46 + i * 5]), [58, -4], [0, -2], [-60, -2], [-110, -8]], 3);
    arms = [[[-86, -60], [-66, -92], [-40, -100]]];
    collar = false;
  } else if (pose === 'bed') {
    // 被窝里坐起：只有上半身（被子另画）
    gown = smooth([[-28, -198], [28, -198], [44, -176], [58, -110], [-58, -110], [-44, -176]], 3);
    arms = [[[-34, -182], [-54, -146], [-40, -118]], [[34, -182], [54, -146], [40, -118]]];
    if (A.R) arms[1] = A.R; if (A.L) arms[0] = A.L;
  }
  // —— 绘制顺序：远侧腿/臂 → 身体 → 近侧 → 头 ——
  const farArm = view === 'side' || pose === 'sit' ? null : (view === 'q' ? arms[0] : null);
  // 腿（被睡裙盖住上端）
  if (pose === 'sit' || pose === 'lie' || pose === 'lieback') { leg(legs[1], sd + 40); leg(legs[0], sd + 50); }
  else legs.forEach((lg, i) => leg(lg, sd + 40 + i * 10));
  if (farArm) { limb(farArm, armW, skinF, sd + 60); hand(farArm[2], sd + 62); }
  if (pose === 'climb' || view === 'back') arms.forEach((a, i) => { limb(a, armW, skinF, sd + 64 + i * 3); hand(a[a.length - 1], sd + 66 + i * 3); });
  // 睡裙
  part(C, P(gown), gownF, lo(sd + 70));
  // 睡裙上的小圆点（白蜡）
  if (pose !== 'lie') {
    const dots = pose === 'lieback' ? [[-80, -40], [-40, -54], [-20, -24], [16, -40], [40, -22], [-64, -16]] : pose === 'sit' ? [[4, -90], [20, -64], [-12, -50], [50, -30], [10, -28]] : pose === 'bed' ? [[-24, -150], [20, -160], [0, -128], [-36, -120], [36, -126]] : [[-20, -160], [16, -150], [-34, -122], [4, -118], [36, -120], [-48, -104], [24, -100], [-10, -140]];
    dots.forEach(([x, y], i) => { if (view === 'side' && pose !== 'sit') x *= 0.7; dab(C.f, ...P([[x, y]])[0], 4.2 * (o.s || 1), { col: C_.white, p: 1, seed: sd + 80 + i, gap: 2.4, w: 3.5, over: 0.3 }); });
  }
  // 领子
  if (collar && view !== 'back' && pose !== 'climb') {
    const cx = pose === 'sit' ? 6 : 0, cy = pose === 'sit' ? -118 : -198;
    const cl = view === 'side' || pose === 'sit' ? [smooth([[cx - 6, cy - 2], [cx + 22, cy - 2], [cx + 18, cy + 12], [cx + 2, cy + 14]], 4)] : [smooth([[cx - 26, cy - 2], [cx - 2, cy], [cx - 4, cy + 14], [cx - 20, cy + 14]], 4), smooth([[cx + 2, cy], [cx + 26, cy - 2], [cx + 20, cy + 14], [cx + 4, cy + 14]], 4)];
    cl.forEach((c, i) => part(C, P(c), { col: C_.sky, p: 0.7, gap: 5, w: 7, seed: sd + 90 + i, over: 2 }, lo(sd + 92 + i, { w: 5 })));
  }
  // 近侧手臂
  if (!(pose === 'climb' || view === 'back')) {
    const near = view === 'q' ? [arms[1]] : (view === 'side' || pose === 'sit' || pose === 'lie' || pose === 'lieback') ? [arms[0]] : arms;
    near.forEach((a, i) => { if (!a) return; limb(a, armW, skinF, sd + 100 + i * 4); hand(a[a.length - 1], sd + 102 + i * 4); });
    // 泡泡袖
    const sl = view === 'front' || pose === 'bed' ? [[-36, -182], [36, -182]] : view === 'q' ? [[34 * 0.9, -182]] : pose === 'sit' ? [[16, -104]] : pose === 'lieback' ? [[-88, -62]] : pose === 'lie' ? [] : [[4, -182]];
    sl.forEach(([x, y], i) => part(C, P(smooth([[x - 16, y - 8], [x, y - 16], [x + 16, y - 8], [x + 14, y + 10], [x - 14, y + 10]], 4)), { ...gownF, seed: sd + 110 + i }, lo(sd + 112 + i, { w: 6 })));
  }
  // 抱着的小羊
  if (o.sheep) o.sheep(P);
  // 头
  const hs = (o.s || 1), hc = P([headC])[0];
  head(C, { x: hc[0], y: hc[1], s: hs, r: (o.r || 0) + headR * (o.flip ? -1 : 1), flip: o.flip, view: headView, expr: o.expr, seed: sd + 300 });
}

// ———————————————— 小羊玩偶 ————————————————
export function sheep(C, o) {
  const T = T0(o), sd = o.seed || 500, P = pts => T(pts);
  const s = o.s || 1;
  // 四条小腿
  [[-18, 18], [-6, 22], [10, 22], [22, 18]].forEach(([x, y], i) => part(C, P(tube([[x, y - 8], [x, y + 8]], 9)), { col: C_.ink, p: 0.8, gap: 4, w: 6, seed: sd + i }, lo(sd + 10 + i, { w: 4.5 })));
  // 卷毛身体：波浪圆
  const body = []; const n = 11;
  for (let i = 0; i <= n * 6; i++) { const a = i / (n * 6) * Math.PI * 2; const bump = Math.abs(Math.sin(a * n / 2)); body.push([Math.cos(a) * (34 + 5 * bump), Math.sin(a) * (24 + 4 * bump)]); }
  part(C, P(body), { col: C_.white, p: 0.95, gap: 6, w: 8, seed: sd + 20, over: 2 }, lo(sd + 21, { w: 5.5 }));
  // 身上几个小卷
  [[-10, -4], [8, 6], [-2, 10], [14, -8]].forEach(([x, y], i) => line(C.l, P(ellipse(x, y, 5, 4, 10, 0.4, 5.6)), lo(sd + 30 + i, { w: 3.5, p: 0.55 })));
  // 头（深色）+ 耳朵
  const hx = 30, hy = -10;
  part(C, P(ellipse(hx + 8, hy - 8, 6, 11, 12, 0, 6.3, -0.9)), { col: C_.ink, p: 0.85, gap: 3, w: 5, seed: sd + 40 }, lo(sd + 41, { w: 4 }));
  part(C, P(ellipse(hx, hy, 15, 13, 20)), { col: C_.violet, p: 0.9, gap: 4, w: 6, seed: sd + 42 }, lo(sd + 43, { w: 5 }));
  part(C, P(ellipse(hx - 10, hy - 6, 6, 10, 12, 0, 6.3, 0.9)), { col: C_.ink, p: 0.85, gap: 3, w: 5, seed: sd + 44 }, lo(sd + 45, { w: 4 }));
  if (o.eyesClosed) line(C.l, P([[hx + 1, hy - 2], [hx + 5, hy + 1], [hx + 9, hy - 2]]), lo(sd + 46, { w: 3, col: C_.white, p: 1 }));
  else dab(C.l, ...P([[hx + 5, hy - 2]])[0], 2.6 * s, { col: C_.white, p: 1, seed: sd + 46, gap: 2, w: 3 });
}

// ———————————————— 月亮 ————————————————
// 局部原点 = 圆心，R = 1（按 o.s 缩放，s 即半径）
// expr: wide | grumpy | look | smile | yawn | drowsy | asleep
// o: look [x,y]（眼珠方向 -1..1）、lid（眼皮 0..1）、cap（睡帽画出进度 0..1）、
//    blanket（被子 0 = 没盖，1 = 盖好只剩一弯）、hand（小手可见 0..1）、tuck（掖被角的拍动相位）
export function moon(C, o) {
  const s = o.s || 200, sd = o.seed || 700, ex = o.expr || 'wide';
  const T = pts => xf(pts, { x: o.x || 0, y: o.y || 0, s, r: o.r || 0, sx: o.flip ? -1 : 1 });
  const moonF = { col: C_.yellow, p: 0.82, gap: 11, w: 13, ang: 0.55, seed: sd + 1, cross: true, crossP: 0.45, draw: o.fillDraw ?? 1 };
  const lw = { w: 8.5, seed: sd + 2, draw: o.lineDraw ?? 1 };
  const bl = clamp(o.blanket || 0);
  const k = lerp(-1.02, 0.16, bl);                 // 被子折边（弯月内缘）的位置
  // 1) 圆盘
  const disc = handCircle(0, 0, 1, sd + 3, 0.1);
  part(C, T(disc), (o.fillDraw ?? 1) > 0 ? moonF : null, null);
  line(C.l, T(disc), lw);
  if ((o.lineDraw ?? 1) < 1) return;
  // 2) 环形山
  [[0.42, -0.5, 0.13], [-0.55, 0.42, 0.1], [0.62, 0.35, 0.08], [-0.2, -0.72, 0.07]].forEach(([x, y, r], i) => {
    if ((o.fillDraw ?? 1) < 0.6) return;
    part(C, T(ellipse(x, y, r, r * 0.85, 16)), { col: C_.orange, p: 0.55, gap: 5, w: 7, seed: sd + 20 + i }, { w: 4.5, seed: sd + 24 + i, col: C_.orange, p: 0.8 }, { occ: false, kn: false });
  });
  // 3) 脸：被子盖上时往右转成侧脸
  if (o.face !== false) {
    if (bl < 0.62) moonFace(C, T, ex, sd, s, o, bl);
    else crescentFace(C, T, sd, s, k, o);
  }
  // 4) 睡帽（画出来）
  if ((o.cap || 0) > 0) nightcap(C, T, sd, s, o.cap);
  // 5) 被子
  if (bl > 0.003) blanket(C, T, sd, s, bl, k, o);
}
const term = (k, y) => k * Math.sqrt(Math.max(0, 1 - y * y));
function blanket(C, T, sd, s, bl, k, o) {
  // 被子轮廓：折边沿弯月内缘；左下多出一截垂下来的被角（带波浪下摆）
  const f = clamp(bl * 1.4);
  const edge = []; for (let i = 0; i <= 30; i++) { const y = -1 + 2 * i / 30; edge.push([term(k, y), y]); }
  const drape = [];
  const hem = [[0.1, 1.04], [-0.25, 1.14], [-0.6, 1.08], [-0.92, 0.82], [-1.1, 0.4], [-1.08, -0.1], [-0.9, -0.55], [-0.5, -0.92], [-0.05, -1.04]];
  hem.forEach(([x, y], i) => { const r = Math.hypot(x, y), a = Math.atan2(y, x); const rr = lerp(1.0, r, f); let px = Math.cos(a) * rr, py = Math.sin(a) * rr; px = Math.min(px, term(k, clamp(py, -1, 1)) - 0.01); drape.push([px, py + (i % 2 ? 0.025 : 0) * f]); });
  const poly = [...edge, ...drape];
  const g = C.f.g;
  part(C, T(poly), { col: C_.violet, p: 0.8, gap: 10, w: 12, ang: -1.1, seed: sd + 100, draw: 1 }, { w: 7.5, seed: sd + 101, col: C_.ink });
  // 拼布：天蓝方块（裁在被子里）+ 白色缝线格
  const Sp = T(poly).map(([x, y]) => [sxs(x), sys(y)]);
  g.save(); g.beginPath(); Sp.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.clip();
  const q = 0.34;
  for (let gy = -3; gy <= 3; gy++) for (let gx = -4; gx <= 2; gx++) {
    if ((gx + gy) % 2 === 0) continue;
    const x0 = gx * q - 0.1, y0 = gy * q - 0.05;
    fill(C.f, T([[x0, y0], [x0 + q, y0], [x0 + q, y0 + q], [x0, y0 + q]]), { col: C_.sky, p: 0.8, gap: 7, w: 9, ang: 0.4, seed: sd + 110 + gx * 7 + gy, over: 1 });
  }
  g.restore();
  const gl = C.l.g; gl.save(); gl.beginPath(); Sp.forEach(([x, y], i) => i ? gl.lineTo(x, y) : gl.moveTo(x, y)); gl.closePath(); gl.clip();
  for (let i = -4; i <= 3; i++) { stitch(C.l, T([[i * q - 0.1, -1.3], [i * q - 0.1, 1.3]]), sd + 130 + i); stitch(C.l, T([[-1.4, i * q - 0.05], [1, i * q - 0.05]]), sd + 140 + i); }
  gl.restore();
  // 星星贴花
  [[-0.62, 0.05], [-0.3, 0.62], [-0.72, -0.5], [-0.15, -0.3]].forEach(([x, y], i) => { if (x > term(k, y) - 0.2) return; star(C, T([[x, y]])[0], 0.085 * s, sd + 150 + i, 0.3 * i, C_.yellow, true); });
  // 翻折边：粉色衬里一条，波浪缝边
  const fb = 0.22 * Math.min(1, bl * 3);
  const fold = []; for (let i = 0; i <= 30; i++) { const y = -1 + 2 * i / 30; fold.push([term(k, y) + 0.01, y]); }
  for (let i = 30; i >= 0; i--) { const y = -1 + 2 * i / 30; fold.push([term(k, y) - fb - 0.035 * Math.abs(Math.sin(i * 0.9)), y]); }
  const foldC = fold.map(([x, y]) => [x, clamp(y, -Math.sqrt(Math.max(0, 1 - x * x)) * 1.03, 1.1)]);
  part(C, T(foldC), { col: C_.pink, p: 0.6, gap: 7, w: 9, ang: 1.4, seed: sd + 160, over: 1.5 }, { w: 6.5, seed: sd + 161 });
  const wav = []; for (let i = 2; i <= 28; i++) { const y = -1 + 2 * i / 30; wav.push([term(k, y) - fb * 0.5 + 0.018 * Math.sin(i * 2.2), y]); }
  stitch(C.l, T(wav), sd + 162, C_.white);
  // 小手：抓着折边往上拉，最后拍一下掖好
  const hv = o.hand ?? 0;
  if (hv > 0) {
    const hy = -0.05 + (o.tuck ? -0.06 * Math.abs(Math.sin(o.tuck * Math.PI * 2)) : 0);
    const hx = term(k, hy) - 0.02;
    // 连指手套式小手：掌 + 拇指，捏住折边
    const hand = smooth([[hx - 0.13, hy - 0.02], [hx - 0.1, hy - 0.12], [hx + 0.02, hy - 0.14], [hx + 0.12, hy - 0.08], [hx + 0.14, hy + 0.04], [hx + 0.06, hy + 0.12], [hx - 0.08, hy + 0.1]], 5);
    part(C, T(hand), { col: C_.yellow, p: 0.95, gap: 5, w: 7, seed: sd + 170, over: 1 }, { w: 6.5, seed: sd + 171 });
    part(C, T(smooth([[hx - 0.05, hy - 0.1], [hx - 0.02, hy - 0.2], [hx + 0.05, hy - 0.2], [hx + 0.05, hy - 0.1]], 4)), { col: C_.yellow, p: 0.95, gap: 4, w: 5, seed: sd + 172 }, { w: 5.5, seed: sd + 173 });
    line(C.l, T([[hx + 0.02, hy + 0.0], [hx + 0.1, hy + 0.02]]), { w: 4, seed: sd + 174, p: 0.8 });
  }
}
import { sx as sxs, sy as sys } from './crayon.js';
function stitch(L, pts, seed, col = C_.white) {
  // 虚线缝线：沿路径每隔一段画一小笔
  let acc = 0; const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; const d = Math.hypot(bx - ax, by - ay); const n = Math.max(1, Math.floor(d / 14));
    for (let j = 0; j < n; j++) { const u0 = j / n, u1 = (j + 0.55) / n; if ((acc + j) % 2 === 0) segs.push([[ax + (bx - ax) * u0, ay + (by - ay) * u0], [ax + (bx - ax) * u1, ay + (by - ay) * u1]]); }
    acc += n;
  }
  segs.forEach((sg, i) => line(L, sg, { w: 3.5, col, p: 0.95, seed: seed + i * 0.13, wob: 0.2, taper: 0.1, streak: 0 }));
}
function nightcap(C, T, sd, s, prog) {
  const a0 = -2.05, a1 = -0.55;
  const base = []; for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * i / 12; base.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0]); }
  const body = [...base, ...bez([[Math.cos(a1) * 1.0, Math.sin(a1) * 1.0], [1.0, -1.1], [1.25, -1.2], [1.42, -0.98]], 10).slice(1), ...bez([[1.42, -0.98], [1.1, -1.55], [0.2, -1.6], [Math.cos(a0) * 1.0, Math.sin(a0) * 1.0]], 12).slice(1)];
  const drawL = clamp(prog * 2), drawF = clamp(prog * 2 - 1);
  if (drawF > 0) part(C, T(body), { col: C_.sky, p: 0.8, gap: 9, w: 11, ang: 0.9, seed: sd + 200, draw: drawF }, null);
  else part(C, T(body), null, null);
  line(C.l, T([...body, body[0]]), { w: 7.5, seed: sd + 201, draw: drawL });
  if (drawF > 0) {
    // 白条纹 + 帽檐
    [[0.35, -1.36, 0.95, -1.22], [0.72, -1.4, 1.2, -1.16]].forEach(([x0, y0, x1, y1], i) => line(C.l, T([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 0.04], [x1, y1]]), { w: 9, col: C_.white, p: 1, seed: sd + 205 + i, draw: drawF }));
    const brim = []; for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * i / 12; brim.push([Math.cos(a) * 0.96, Math.sin(a) * 0.96]); }
    for (let i = 12; i >= 0; i--) { const a = a0 + (a1 - a0) * i / 12; brim.push([Math.cos(a) * 1.12, Math.sin(a) * 1.12]); }
    part(C, T(brim), { col: C_.white, p: 1, gap: 6, w: 8, ang: 0.2, seed: sd + 210, draw: drawF }, { w: 6, seed: sd + 211, draw: drawF });
    // 毛球
    const pom = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; const b = 1 + 0.18 * Math.abs(Math.sin(a * 4)); pom.push([1.44 + Math.cos(a) * 0.13 * b, -0.96 + Math.sin(a) * 0.13 * b]); }
    part(C, T(pom), { col: C_.white, p: 1, gap: 5, w: 7, seed: sd + 215, draw: drawF }, { w: 5.5, seed: sd + 216, draw: drawF });
  }
}
function moonFace(C, T, ex, sd, s, o, bl) {
  const turn = clamp(bl / 0.62);                       // 被子往上拉时，脸往右转
  const cx = 0.42 * turn, spread = 1 - 0.45 * turn;
  const look = o.look || (ex === 'look' ? [1, 0] : [0, 0]);
  const ey = -0.08, exs = [cx - 0.34 * spread, cx + 0.34 * spread];
  const pw = { w: 6, seed: sd + 40 };
  const lid = o.lid ?? (ex === 'drowsy' ? 0.55 : ex === 'yawn' ? 0.45 : 0);
  exs.forEach((x, i) => {
    const kk = i === 0 ? 1 - 0.3 * turn : 1;
    if (ex === 'asleep') { line(C.l, T([[x - 0.17 * kk, ey], [x - 0.08 * kk, ey + 0.08], [x + 0.08 * kk, ey + 0.08], [x + 0.17 * kk, ey]]), { ...pw, seed: sd + 41 + i, w: 7 }); line(C.l, T([[x + (i ? 0.17 : -0.17) * kk, ey], [x + (i ? 0.24 : -0.24) * kk, ey - 0.04]]), { ...pw, seed: sd + 43 + i, w: 5 }); return; }
    if (ex === 'grumpy') { line(C.l, T(i ? [[x + 0.15, ey - 0.08], [x - 0.12, ey + 0.01], [x + 0.15, ey + 0.1]] : [[x - 0.15, ey - 0.08], [x + 0.12, ey + 0.01], [x - 0.15, ey + 0.1]]), { ...pw, seed: sd + 41 + i, w: 7.5 }); return; }
    if (ex === 'smile' && (o.happyEyes)) { line(C.l, T([[x - 0.15, ey + 0.05], [x - 0.06, ey - 0.05], [x + 0.06, ey - 0.05], [x + 0.15, ey + 0.05]]), { ...pw, seed: sd + 41 + i, w: 7 }); return; }
    const r = (ex === 'wide' ? 0.17 : 0.155) * (o.eyeK || 1);
    part(C, T(ellipse(x, ey, r * kk, r * 1.08, 26)), { col: C_.white, p: 1, gap: 5, w: 8, seed: sd + 45 + i, over: 1 }, { ...pw, seed: sd + 47 + i, w: 6 }, { occ: true, kn: false });
    const pr = ex === 'wide' ? 0.06 : 0.075;
    const px = x + look[0] * (r - pr - 0.01) * kk, py = ey + look[1] * (r - pr - 0.01) + 0.005;
    part(C, T(ellipse(px, py, pr * kk, pr * 1.1, 14)), { col: C_.ink, p: 1, gap: 3, w: 5, seed: sd + 49 + i, over: 0.5 }, null, { occ: false, kn: false });
    dab(C.l, ...T([[px + 0.022, py - 0.03]])[0], 0.018 * s, { col: C_.white, p: 1, seed: sd + 51 + i, gap: 2, w: 3 });
    if (lid > 0.02) {
      const lidY = ey - r * 1.08 + lid * 2 * r * 1.08;
      const lidP = [...ellipse(x, ey, r * kk + 0.018, r * 1.08 + 0.018, 20, Math.PI, Math.PI * 2), [x + r * kk + 0.018, lidY], [x - r * kk - 0.018, lidY]];
      part(C, T(lidP), { col: C_.yellow, p: 0.95, gap: 4, w: 7, seed: sd + 53 + i, over: 0.5 }, null, { occ: true, kn: false });
      line(C.l, T([[x - r * kk - 0.02, lidY], [x + r * kk + 0.02, lidY]]), { ...pw, seed: sd + 55 + i, w: 6.5 });
    }
    line(C.l, T(ellipse(x, ey + 0.03, r * 0.95 * kk, r * 1.2, 12, 0.35, 2.8)), { w: 5, col: C_.violet, p: 0.75 * (1 - turn), seed: sd + 57 + i, taper: 0.4 });
    if (ex === 'wide') line(C.l, T(ellipse(x, ey + 0.05, r * 1.05 * kk, r * 1.35, 12, 0.5, 2.6)), { w: 4, col: C_.violet, p: 0.55, seed: sd + 59 + i, taper: 0.4 });
  });
  dab(C.f, ...T([[cx + 0.5 * spread, 0.2]])[0], 0.09 * s, { col: C_.orange, p: 0.6, seed: sd + 60, sq: 0.7 });
  if (turn < 0.5) dab(C.f, ...T([[cx - 0.5 * spread, 0.2]])[0], 0.09 * s, { col: C_.orange, p: 0.6, seed: sd + 61, sq: 0.7 });
  const my = 0.3, mx = cx;
  if (ex === 'yawn') part(C, T(ellipse(mx, my + 0.04, 0.1 * (o.yawnK ?? 1), 0.15 * (o.yawnK ?? 1), 22)), { col: C_.red, p: 0.85, gap: 4, w: 6, seed: sd + 62 }, { ...pw, seed: sd + 63 }, { occ: false, kn: false });
  else if (ex === 'grumpy') line(C.l, T([[mx - 0.13, my + 0.04], [mx - 0.06, my - 0.01], [mx + 0.02, my + 0.03], [mx + 0.1, my - 0.01], [mx + 0.15, my + 0.03]]), { ...pw, seed: sd + 64 });
  else if (ex === 'asleep' || ex === 'smile') line(C.l, T([[mx - 0.11, my - 0.02], [mx, my + 0.06], [mx + 0.11, my - 0.02]]), { ...pw, seed: sd + 65 });
  else if (ex === 'wide' || ex === 'look') line(C.l, T([[mx - 0.08, my + 0.03], [mx + 0.08, my + 0.03]]), { ...pw, seed: sd + 66 });
  else line(C.l, T([[mx - 0.09, my + 0.02], [mx, my - 0.02], [mx + 0.09, my + 0.02]]), { ...pw, seed: sd + 67 });
}
function crescentFace(C, T, sd, s, k, o) {
  // 被子折边上方露出的侧脸：闭着的眼睛 + 睫毛、一点笑、腮红
  const ey = -0.22, ex = term(k, ey) + 0.24;
  line(C.l, T([[ex - 0.12, ey - 0.01], [ex - 0.04, ey + 0.07], [ex + 0.06, ey + 0.06], [ex + 0.12, ey - 0.01]]), { w: 7.5, seed: sd + 80 });
  [[-0.12, -0.01, -0.17, -0.06], [-0.05, 0.065, -0.07, 0.12], [0.04, 0.07, 0.05, 0.125]].forEach(([a, b, c, d], i) => line(C.l, T([[ex + a, ey + b], [ex + c, ey + d]]), { w: 4.5, seed: sd + 85 + i }));
  const my = 0.12, mx = term(k, my) + 0.2;
  line(C.l, T([[mx - 0.06, my - 0.02], [mx + 0.01, my + 0.04], [mx + 0.08, my - 0.01]]), { w: 6.5, seed: sd + 82 });
  dab(C.f, ...T([[ex + 0.14, ey + 0.2]])[0], 0.075 * s, { col: C_.orange, p: 0.65, seed: sd + 83, sq: 0.7 });
}
