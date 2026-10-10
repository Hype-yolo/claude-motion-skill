// 片中各场景的"世界"绘制（世界坐标 + 摄像机）。角色表演、时间线在 film.js
import { g, C, S, W, H, clear, piece, rough, roughC, rectP, circP, ellP, arcP, label } from './paper.js';
import { layout, drawLine } from './glyph.js';
import { agentSide, courierSide, key, keyholeP } from './chars.js';
import { drawTitle, titleBox, drawGlyph, CUT_ANG, GLYPH } from './title.js';
import { hash, clamp, lerp } from '/core/lib.js';

// ── 摄像机：世界点 (cx,cy) 放在画面中心，缩放 s ──
export const CAM = { cx: 960, cy: 540, s: 1 };
export function cam(cx = 960, cy = 540, s = 1) { CAM.cx = cx; CAM.cy = cy; CAM.s = s; g.setTransform(s, 0, 0, s, W / 2 - cx * s, H / 2 - cy * s); }
export function view(m = 60) { const hw = W / 2 / CAM.s + m, hh = H / 2 / CAM.s + m; return { x0: CAM.cx - hw, x1: CAM.cx + hw, y0: CAM.cy - hh, y1: CAM.cy + hh }; }
export const DIR = [Math.sin(CUT_ANG), -Math.cos(CUT_ANG)];   // 斜切线方向（向右上）
export const NRM = [Math.cos(CUT_ANG), Math.sin(CUT_ANG)];    // 法线（向右下）

// ═══════════ 开场：黑底红钥匙孔（= 片名 I 的大特写） ═══════════
export const KH_SCREEN = { x: 960, y: 430, h: 560 };          // 开场与结尾共用的钥匙孔屏幕位置/高度
export function keyholeShot(grow = 1, splitOpen = 0) {
  clear(C.ink);
  const k = KH_SCREEN.h / 154 * grow;
  const draw = () => { g.save(); g.translate(KH_SCREEN.x, KH_SCREEN.y); g.scale(k, k); piece(roughC('khT', () => keyholeP(1), 301, .7, 6), C.red, { gap: 0, shadow: false }); g.restore(); };
  if (splitOpen <= 0) { draw(); return; }
}

// ── 斜线网格（North by Northwest 语法）：A 族平行于切线，B 族浅斜线 ──
export const GRID = { ang2: -20 * Math.PI / 180, dA: 170, dB: 150 };
export function gridField(prog, opt = {}) {
  // prog：0..1 网格从切线向两侧长出来的进度
  clear(opt.bg || C.red);
  const cx = KH_SCREEN.x, cy = KH_SCREEN.y + 90;
  const nA = 12, L = 2600;
  for (let i = -nA; i <= nA; i++) {
    const d = Math.abs(i) / nA; if (d > prog + 1e-6) continue;
    const ox = cx + NRM[0] * i * GRID.dA, oy = cy + NRM[1] * i * GRID.dA;
    const w = i === 0 ? 7 : 4;
    piece(rough([[ox - DIR[0] * L - NRM[0] * w / 2, oy - DIR[1] * L - NRM[1] * w / 2], [ox + DIR[0] * L - NRM[0] * w / 2, oy + DIR[1] * L - NRM[1] * w / 2], [ox + DIR[0] * L + NRM[0] * w / 2, oy + DIR[1] * L + NRM[1] * w / 2], [ox - DIR[0] * L + NRM[0] * w / 2, oy - DIR[1] * L + NRM[1] * w / 2]], 900 + i, .8, 40), opt.line || C.ink, { gap: 0, shadow: false });
  }
  const c2 = Math.cos(GRID.ang2), s2 = Math.sin(GRID.ang2);
  for (let j = -6; j <= 6; j++) {
    const d = Math.abs(j) / 6; if (d > prog * 1.1 + 1e-6) continue;
    const oy = cy + j * GRID.dB, w = 3;
    piece(rough([[-600, oy - 600 * s2 * -1 * 0 + (-600 - cx) * s2 - w], [2600, oy + (2600 - cx) * s2 - w], [2600, oy + (2600 - cx) * s2 + w], [-600, oy + (-600 - cx) * s2 + w]], 950 + j, .8, 40), opt.line || C.ink, { gap: 0, shadow: false });
  }
}
// B 族第 j 条线上 x 处的 y
export function gridBY(j, x) { const cx = KH_SCREEN.x, cy = KH_SCREEN.y + 90; return cy + j * GRID.dB + (x - cx) * Math.sin(GRID.ang2); }

// ═══════════ 丝绒垫 + 钥匙 ═══════════
export function velvet(o = {}) {
  clear(C.paper);
  // 一束纸剪的光（淡）
  piece(rough([[760, -20], [1160, -20], [1500, 900], [420, 900]], 960, 2, 30), 'rgba(255,248,226,.55)', { gap: 0, shadow: false });
  const cx = 960, cy = 610, w = 980, h = 430;
  // 垫子（圆角 + 扣钉簇绒）
  const pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push([cx + Math.sign(c) * Math.pow(Math.abs(c), .35) * w / 2, cy + Math.sign(s) * Math.pow(Math.abs(s), .35) * h / 2]); }
  piece(roughC('cushion', () => pts, 961, 2.2, 16), C.red, { gap: 0, shA: .38, shB: 10, shX: 6, shY: 10 });
  for (let i = -4; i <= 4; i++) for (let j = -1; j <= 1; j++) {
    const bx = cx + i * 105 + (j & 1) * 52, by = cy + j * 120; if (Math.abs(i * 105) > 440) continue;
    // 簇绒折线（暗红细缝）
    g.save(); g.strokeStyle = C.redD; g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx - 50, by - 60); g.lineTo(bx, by); g.lineTo(bx + 50, by - 60); g.stroke(); g.restore();
    piece(circP(bx, by, 7, 12), C.redD, { gap: 0, shadow: false });
  }
  if (o.dent) { g.save(); g.translate(cx - 20, cy - 10); g.rotate(-.55); g.scale(1.9, 1.9); piece(roughC('keyDent', () => { const r = 26, p = []; for (let i = 0; i <= 30; i++) { const a = Math.PI * .5 + .36 + i / 30 * (Math.PI * 2 - .72); p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p.concat([[9, 72], [15, 76], [15, 88], [11, 90], [11, 96], [19, 100], [19, 114], [6, 118], [-6, 118], [-19, 114], [-19, 100], [-11, 96], [-11, 90], [-15, 88], [-15, 76], [-9, 72]]); }, 962, .8, 6), C.redD, { gap: 0, shadow: false }); g.restore(); }
  if (o.key) key(cx - 20, cy - 10, 1.9, -.55);
}

// ═══════════ 特工登场：纸白底 + 大红斜条 ═══════════
export function introSet() {
  clear(C.paper);
  piece(roughC('introSlash', () => [[1180, -40], [1520, -40], [820, 1120], [480, 1120]], 970, 2, 20), C.red, { gap: 0, shadow: false });
  piece(roughC('introFloor', () => rectP(-40, 880, W + 80, 260), 971, 1.4, 14), C.ink, { gap: 0, shadow: false });
}

// ═══════════ 机场 ═══════════
export const AIR = { floor: 880, size: 900 };
let airLay = null;
export function airLayout() { if (!airLay) { airLay = layout('STARRING', AIR.size, { track: .2 }); } return airLay; }
export function airIx() { const L = airLayout().letters.find(l => l.i === 5); return L.x + (L.x0 + L.x1) / 2; }
export function airport(o) {
  clear(C.mus);
  const v = view(120), lay = airLayout();
  if (o.plane) o.plane();
  // 地面 + 跑道长破折号
  piece(rough(rectP(v.x0, AIR.floor, v.x1 - v.x0, 900), 610, 1.4, 14), C.ink, { gap: 0, shadow: false });
  const d0 = Math.floor(v.x0 / 260) - 1;
  for (let i = d0; i < d0 + (v.x1 - v.x0) / 260 + 3; i++) piece(roughC('dash' + (i & 3), () => [[0, 0], [150, -2], [152, 14], [2, 16]], 620 + (i & 3), 1, 10).map(([a, b]) => [a + i * 260, b + 980]), C.paper, { gap: 0, shadow: false });
  // 悬挂翻牌指示牌 THE AGENT（在 N G 上方）
  const sx = lay.width - 720;
  piece([[sx + 60, -400], [sx + 66, -400], [sx + 66, 60], [sx + 60, 60]], C.ink, { gap: 0 });
  piece([[sx + 454, -400], [sx + 460, -400], [sx + 460, 60], [sx + 454, 60]], C.ink, { gap: 0 });
  piece(roughC('board', () => rectP(0, 0, 520, 150), 630, 1.2, 12).map(([a, b]) => [a + sx, b + 52]), C.ink);
  const bl = layout('THE AGENT', 132, { track: .1 });
  drawLine(bl, sx + 260 - bl.width / 2, 52 + 128, { col: C.paper, seed: 40, jit: .6, gap: 0, shadow: false, amp: .8, each: o.flap });
  for (let i = 1; i < 9; i++) piece([[sx + i * 57.7, 56], [sx + i * 57.7 + 2, 56], [sx + i * 57.7 + 2, 198], [sx + i * 57.7, 198]], C.ink, { gap: 0, shadow: false });
  piece([[sx + 4, 124], [sx + 516, 124], [sx + 516, 127], [sx + 4, 127]], C.ink, { gap: 0, shadow: false });
  // STARRING
  const iIdx = 5;
  drawLine(lay, 0, AIR.floor + 4, { col: C.ink, seed: 21, jit: .7, amp: 2.2, shA: .35, each: (L) => L.i === iIdx ? { hide: true } : null });
  if (o.behindI) o.behindI(airIx());
  drawLine(lay, 0, AIR.floor + 4, { col: C.ink, seed: 21, jit: .7, amp: 2.2, shA: .45, each: (L) => L.i === iIdx ? null : { hide: true } });
  if (o.front) o.front();
}
export function plane(x, y, s, r) {
  g.save(); g.translate(x, y); g.rotate(r); g.scale(s, s);
  piece(roughC('plane', () => [[-120, -8], [60, -12], [96, -4], [104, 2], [60, 10], [-110, 10], [-128, 2]], 601, 1, 8), C.red);
  piece(roughC('planeW', () => [[-10, 0], [22, 0], [-40, 58], [-62, 58]], 602, 1, 8), C.red);
  piece(roughC('planeT', () => [[-104, -4], [-86, -4], [-118, -40], [-132, -40]], 603, 1, 8), C.red);
  for (let i = 0; i < 6; i++) piece([[-60 + i * 18, -4], [-52 + i * 18, -4], [-52 + i * 18, 1], [-60 + i * 18, 1]], C.mus, { gap: 0, shadow: false });
  g.restore();
}

// ═══════════ 列车 ═══════════
export const TR = { rail: 858, base: 808, size: 380, speed: 900 };
let trLay = null;
export function trainLayout() {
  if (trLay) return trLay;
  const words = ['MUSIC', 'BY', 'THE', 'SAMPLER'], cars = []; let x = 0;
  for (const w of words) { const L = layout(w, TR.size, { track: .05 }); cars.push({ w, L, x, x1: x + L.width }); x += L.width + 130; }
  trLay = { cars, len: x - 130, top: TR.base - TR.size * .74 };
  return trLay;
}
export function train(o) {
  clear(C.red);
  const t = o.t || 0, v = view(200), scroll = t * TR.speed;
  // 远山（屏幕空间视差）
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const ss = CAM.s, sy = (y) => H / 2 + (y - CAM.cy) * ss * .6;
  for (let k = 0; k < 2; k++) {
    const off = -((CAM.cx * ss * (.1 + k * .1) + scroll * (.08 + k * .1)) % 1600);
    for (let r = -1; r < 3; r++) {
      const bx = off + r * 1600;
      piece(roughC('hill' + k, () => { const p = [[0, 1400]]; for (let i = 0; i <= 16; i++) p.push([i * 100, 640 + k * 70 - Math.abs(Math.sin(i * 1.3 + k)) * (110 - k * 30) - (i % 5 === 2 ? 60 : 0)]); p.push([1600, 1400]); return p; }, 700 + k, 2, 16).map(([a, b]) => [a + bx, sy(b)]), k ? '#b3301c' : C.redD, { gap: 0, shadow: false });
    }
  }
  g.restore();
  // 电线杆（暗红，背景层）+ 电线
  const P0 = Math.floor((v.x0 + scroll) / 520) - 1;
  for (let i = P0; i < P0 + (v.x1 - v.x0) / 520 + 3; i++) {
    const x = i * 520 - scroll;
    piece(roughC('pole', () => [[-6, 250], [6, 250], [8, 870], [-8, 870]], 710, 1, 10).map(([a, b]) => [a + x, b]), C.redD, { gap: 0, shadow: false });
    piece(roughC('bar', () => [[-56, 280], [56, 276], [56, 289], [-56, 293]], 711, 1, 10).map(([a, b]) => [a + x, b]), C.redD, { gap: 0, shadow: false });
    g.save(); g.strokeStyle = 'rgba(239,228,201,.75)'; g.lineWidth = 2.2 / CAM.s; g.beginPath();
    g.moveTo(x - 50, 283); g.quadraticCurveTo(x + 210, 330, x + 470, 283); g.moveTo(x + 50, 280); g.quadraticCurveTo(x + 310, 326, x + 570, 280);
    g.stroke(); g.restore();
  }
  // 地面 + 铁轨 + 枕木
  piece(rough(rectP(v.x0, TR.rail + 6, v.x1 - v.x0, 900), 720, 1.4, 14), C.ink, { gap: 0, shadow: false });
  piece(rough(rectP(v.x0, TR.rail - 2, v.x1 - v.x0, 9), 721, .8, 14), C.paper, { gap: 0, shadow: false });
  const K0 = Math.floor((v.x0 + scroll) / 96) - 1;
  for (let i = K0; i < K0 + (v.x1 - v.x0) / 96 + 3; i++) { const x = i * 96 - scroll; piece([[x, TR.rail + 16], [x + 44, TR.rail + 16], [x + 42, TR.rail + 24], [x + 2, TR.rail + 24]], C.redD, { gap: 0, shadow: false }); }
  // 车厢 = 单词
  const { cars } = trainLayout();
  const bob = (i) => (Math.floor(t * 12) % 2) * (i % 2 ? 1 : -1) * 1.5;
  cars.forEach((c, i) => {
    const cx = c.x, w = c.L.width, by = TR.base + bob(i);
    piece(roughC('chassis' + i, () => rectP(-18, 0, w + 36, 26), 730 + i, 1.1, 10).map(([a, b]) => [a + cx, b + by]), C.ink);
    if (i < cars.length - 1) piece([[cx + w + 18, by + 8], [cx + w + 112, by + 8], [cx + w + 112, by + 16], [cx + w + 18, by + 16]], C.ink, { gap: 0 });
    const nw = Math.max(2, Math.round(w / 150));
    for (let k = 0; k < nw; k++) {
      const wx = cx + 10 + (w - 20) * (nw === 1 ? .5 : k / (nw - 1)), wy = by + 34;
      piece(circP(wx, wy, 19, 20), C.ink, { gap: 2 });
      g.save(); g.translate(wx, wy); g.rotate(-scroll / 19);
      piece([[-14, -2], [14, -2], [14, 2], [-14, 2]], C.red, { gap: 0, shadow: false });
      g.restore();
    }
    drawLine(c.L, cx, by + 2, { col: C.ink, seed: 50 + i * 9, jit: .8, amp: 1.8, shA: .35 });
  });
  // 火车头
  const last = cars[cars.length - 1], lx = last.x1 + 60, by = TR.base + bob(9);
  piece(roughC('loco', () => [[0, -250], [120, -250], [240, -40], [260, 30], [0, 30]], 740, 1.4, 10).map(([a, b]) => [a + lx, b + by]), C.ink);
  piece(roughC('beam', () => [[0, 0], [900, -140], [900, 110]], 741, 2, 20).map(([a, b]) => [a + lx + 200, b + by - 70]), 'rgba(226,165,42,.5)', { gap: 0, shadow: false });
  piece(circP(lx + 196, by - 70, 18, 18), C.mus, { gap: 3 });
  piece([[lx + 40, -330 + by], [lx + 80, -330 + by], [lx + 78, -250 + by], [lx + 42, -250 + by]], C.ink, { gap: 2 });
  for (const wx of [lx + 60, lx + 170]) { piece(circP(wx, by + 34, 24, 22), C.ink, { gap: 2 }); g.save(); g.translate(wx, by + 34); g.rotate(-scroll / 24); piece([[-18, -2.5], [18, -2.5], [18, 2.5], [-18, 2.5]], C.red, { gap: 0, shadow: false }); g.restore(); }
  if (o.front) o.front();
}
// 车轮大特写（→ 轮盘的图形匹配）
export const RW = { x: 960, y: 470, r: 170 };
export function wheelShot(t) {
  clear(C.red);
  piece(rough(rectP(-20, RW.y + RW.r - 8, W + 40, 20), 750, 1, 14), C.paper, { gap: 0, shadow: false });
  piece(rough(rectP(-20, RW.y + RW.r + 12, W + 40, 500), 751, 1.4, 14), C.ink, { gap: 0, shadow: false });
  piece(roughC('bigWheel', () => circP(0, 0, RW.r, 60), 752, 1.6, 12).map(([a, b]) => [a + RW.x, b + RW.y]), C.ink);
  g.save(); g.translate(RW.x, RW.y); g.rotate(-Math.floor(t * 12) / 12 * 9);
  for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); piece([[-6, 26], [6, 26], [5, RW.r - 22], [-5, RW.r - 22]], C.red, { gap: 0, shadow: false }); g.restore(); }
  piece(circP(0, 0, 26, 20), C.mus, { gap: 0, shadow: false });
  g.restore();
  // 连杆
  const a = -Math.floor(t * 12) / 12 * 9, px = RW.x + Math.cos(a) * RW.r * .6, py = RW.y + Math.sin(a) * RW.r * .6;
  piece(rough([[px - 8, py - 10], [px + 700, py - 14], [px + 700, py + 14], [px - 8, py + 10]], 753, 1, 14), C.ink, { gap: 3 });
}

// ═══════════ 赌场：and THE COURIER，O = 轮盘 ═══════════
let caLay = null;
export function casinoLayout() {
  if (caLay) return caLay;
  const size = 330, A = layout('THE C', size, { track: .08 }), Bw = layout('URIER', size, { track: .08 });
  const gapW = RW.r * 2.16 + 40;
  caLay = { A, Bw, xA: RW.x - gapW / 2 - A.width, xB: RW.x + gapW / 2 + 6, base: RW.y + size * .74 / 2 + 6, size };
  return caLay;
}
export function casino(o) {
  clear(C.red);
  // 桌面边框（纸白细线）+ 下注格
  const cl = casinoLayout();
  g.save(); g.strokeStyle = 'rgba(239,228,201,.8)'; g.lineWidth = 3; g.strokeRect(70, 60, W - 140, H - 120); g.restore();
  for (let i = 0; i < 12; i++) {
    const x = 300 + i * 110, y = 810;
    piece(roughC('cell' + i, () => rectP(0, 0, 100, 150), 1000 + i, 1, 10).map(([a, b]) => [a + x, b + y]), i % 2 ? C.ink : C.redD, { gap: 0, shA: .2 });
  }
  // and（小）+ THE C URIER（大）
  const aL = layout('and', 120, { track: .05 });
  drawLine(aL, cl.xA + 8, cl.base - cl.size * .74 - 26, { col: C.paper, seed: 71, jit: 1, amp: 1.2, shA: .3 });
  drawLine(cl.A, cl.xA, cl.base, { col: C.paper, seed: 72, jit: .8, amp: 1.8, shA: .35 });
  drawLine(cl.Bw, cl.xB, cl.base, { col: C.paper, seed: 73, jit: .8, amp: 1.8, shA: .35 });
  // 轮盘
  roulette(RW.x, RW.y, RW.r, o.spin || 0, o.ball || 0, o.ballR);
  if (o.front) o.front();
}
export function roulette(x, y, r, spin, ball, ballR) {
  piece(roughC('rouOuter', () => circP(0, 0, 1, 64), 1010, .006, .08).map(([a, b]) => [x + a * r * 1.08, y + b * r * 1.08]), C.ink, { gap: 0, shA: .4 });
  g.save(); g.translate(x, y); g.rotate(spin);
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p = [[Math.cos(a0) * r * .98, Math.sin(a0) * r * .98], ...arcP(0, 0, r * .98, a0, a1, 4).slice(1), [Math.cos(a1) * r * .62, Math.sin(a1) * r * .62], [Math.cos(a0) * r * .62, Math.sin(a0) * r * .62]];
    piece(p, i === 0 ? C.mus : (i % 2 ? C.red : C.ink), { gap: 0, shadow: false });
  }
  g.strokeStyle = C.paper; g.lineWidth = 2;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * r * .62, Math.sin(a) * r * .62); g.lineTo(Math.cos(a) * r * .98, Math.sin(a) * r * .98); g.stroke(); }
  piece(circP(0, 0, r * .6, 40), C.paper, { gap: 0, shadow: false });
  piece(circP(0, 0, r * .42, 36), C.inkL, { gap: 0, shadow: false });
  for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); piece([[-5, 0], [5, 0], [4, r * .5], [-4, r * .5]], C.mus, { gap: 0, shadow: false }); g.restore(); }
  piece(circP(0, 0, 14, 14), C.mus, { gap: 0, shadow: false });
  g.restore();
  const br = (ballR ?? .84) * r;
  piece(circP(x + Math.cos(ball) * br, y + Math.sin(ball) * br, 11, 14), C.paper, { gap: 2, gapCol: C.ink });
}

// ═══════════ 瞳孔 ═══════════
export function pupilShot(pr) {
  clear(C.ink);
  const x = RW.x, y = RW.y;
  const eye = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = u * Math.PI; eye.push([x - 520 + u * 1040, y - Math.sin(a) * 250 * (1 - .15 * Math.cos(a))]); }
  for (let i = 1; i < 40; i++) { const u = 1 - i / 40, a = u * Math.PI; eye.push([x - 520 + u * 1040, y + Math.sin(a) * 180]); }
  g.save(); piece(roughC('eye', () => eye, 1100, 2, 16), C.paper, { gap: 0, shadow: false });
  g.beginPath(); eye.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.clip();
  piece(circP(x, y, RW.r, 50), C.red, { gap: 0, shadow: false });
  for (let i = 0; i < 18; i += 2) { const a0 = i / 18 * Math.PI * 2, a1 = (i + 1) / 18 * Math.PI * 2; piece([[x + Math.cos(a0) * RW.r * .55, y + Math.sin(a0) * RW.r * .55], ...arcP(x, y, RW.r * .96, a0, a1, 4), [x + Math.cos(a1) * RW.r * .55, y + Math.sin(a1) * RW.r * .55]], C.redD, { gap: 0, shadow: false }); }
  piece(circP(x, y, pr, 30), C.ink, { gap: 0, shadow: false });
  piece(ellP(x - RW.r * .35, y - RW.r * .4, 22, 14, 16, -.5), 'rgba(239,228,201,.9)', { gap: 0, shadow: false });
  g.restore();
  // 帽檐的阴影压在上方
  piece(roughC('brimBand', () => [[-40, -40], [W + 40, -40], [W + 40, 150], [-40, 230]], 1101, 2, 20), C.ink, { gap: 0 });
}

// ═══════════ 屋顶 ═══════════
export const RF = { ledge: 720, end: 2500 };
export function rooftop(o) {
  clear(C.ink);
  const v = view(200);
  // 月亮（屏幕空间固定 = 远景）
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const mr = o.moonR ?? 330, mx = o.moonX ?? 960, my = o.moonY ?? 430;
  piece(roughC('moon', () => circP(0, 0, 1, 90), 1200, .004, .06).map(([a, b]) => [mx + a * mr, my + b * mr]), C.paper, { gap: 0, shadow: false });
  // 远处楼群（屏幕空间，慢视差）
  const off = -(CAM.cx * .25) % 2400;
  for (let r = -1; r < 2; r++) piece(roughC('farCity', () => { const p = [[0, 1200]]; let x = 0; let i = 0; while (x < 2400) { const hgt = 520 + hash(i * 3.3) * 260; p.push([x, 1200 - 0], [x, hgt]); x += 80 + hash(i * 7.1) * 140; p.push([x, hgt]); i++; } p.push([2400, 1200]); return p.map(([a, b]) => [a, b]); }, 1201, 1.4, 14).map(([a, b]) => [a + off + r * 2400, b + 120]), C.inkL, { gap: 0, shadow: false });
  g.restore();
  // 近处屋顶（红）+ 黄窗
  const B0 = Math.floor(v.x0 / 300) - 1;
  for (let i = B0; i < B0 + (v.x1 - v.x0) / 300 + 3; i++) {
    const x = i * 300, top = RF.ledge + 30 + hash(i * 1.7) * 120, w = 260 + hash(i * 2.9) * 60;
    if (x > RF.end + 100) { const t2 = RF.ledge + 260 + hash(i) * 80; piece(roughC('bld' + i, () => rectP(0, 0, w, 900), 1210 + i, 1.4, 12).map(([a, b]) => [a + x, b + t2]), C.redD, { gap: 3 }); continue; }
    piece(roughC('bld' + i, () => rectP(0, 0, w, 900), 1210 + i, 1.4, 12).map(([a, b]) => [a + x, b + top]), C.red, { gap: 3 });
    for (let k = 0; k < 6; k++) { if (hash(i * 13 + k) < .45) continue; const wx = x + 30 + (k % 3) * 75, wy = top + 50 + Math.floor(k / 3) * 110; piece([[wx, wy], [wx + 40, wy], [wx + 40, wy + 60], [wx, wy + 60]], C.mus, { gap: 0, shadow: false }); }
  }
  // 长破折号 = 屋檐
  piece(roughC('ledge', () => [[-2000, 0], [RF.end, -3], [RF.end + 2, 24], [-2000, 26]], 1220, 1.6, 14).map(([a, b]) => [a, b + RF.ledge]), C.paper, { gap: 3 });
  if (o.front) o.front();
}

// ═══════════ 片名 ═══════════
export const TT = { H: 250 };
export function titleGeom() {
  const { w, h, L } = titleBox(TT.H);
  const x = (W - w) / 2 - 50, y = (H - h) / 2 - 20;
  const li = L.find(l => l.ch === 'I'), kh = li.h * .62 / 154;
  const khx = x + li.x + li.w / 2, khy = y + li.y + li.h * .2 + 31 * kh;
  return { x, y, w, h, L, kh, khx, khy, cutX: khx - x, cutY: khy - y };
}
export function titleBG(alpha = .9) {
  clear(C.paper);
  const v = view(100);
  g.save(); g.globalAlpha = alpha;
  for (let i = Math.floor(v.x0 / 150) - 8; i < v.x1 / 150 + 8; i++) {
    const bx = i * 150, tn = Math.tan(CUT_ANG) * 1400;
    piece(rough([[bx, -200], [bx + 3, -200], [bx + 3 - tn, 1200], [bx - tn, 1200]], 800 + (i & 31), .4, 30), 'rgba(210,58,34,.22)', { gap: 0, shadow: false });
  }
  g.restore();
}
