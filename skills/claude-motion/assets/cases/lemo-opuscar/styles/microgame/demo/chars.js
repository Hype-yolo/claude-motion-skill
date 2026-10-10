// 两个原创角色（"家"画风）：CADET DOT（见习宇航员）与 COACH TICK（秒表脑袋主持人）
import { P, K, part, tube, line, dot, circ, ell, rrect, poly, smooth, limb, lw } from './toon.js';
const TAU = Math.PI * 2;
// 两骨 IK（够不着就等比拉长——卡通橡皮臂）：返回与 limb 相同结构；bend = ±1 肘部方向
export function ik(x, y, l1, l2, tx, ty, bend = 1) {
  let dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy);
  const k = Math.max(1, d / (l1 + l2) * 1.001); l1 *= k; l2 *= k;
  const a0 = Math.atan2(dx, dy);
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))), off = Math.acos(c) * bend;
  const a1 = a0 + off, ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const a2 = Math.atan2(tx - ex, ty - ey);
  return [[x, y], [ex, ey], [tx, ty], a2];
}

// ───────────────────────── CADET DOT ─────────────────────────
// 局部单位：脚底 (0,0)，头盔圆心 (0,-178) 半径 62，总高约 300（含天线）
export const DOT_POSE = {
  stand:   { a: [-.18, .25], b: [.18, -.25] },
  pump:    { a: [-.55, 1.2], b: [.55, -1.2] },
  pumpDn:  { a: [-.12, .5], b: [.12, -.5] },
  salute:  { a: [-58, -206, -1], b: [.18, -.25] },
  bonk:    { a: [-14, -262, -1], b: [.5, -.2] },
  jump:    { a: [-2.5, .35], b: [2.5, -.35], hop: 1 },
  proud:   { a: [-.9, 2.1], b: [.9, -2.1] },
  reach:   { a: [-.3, .3], b: [1.9, -.1] },
  panic:   { a: [-2.2, -.6], b: [2.2, .6] },
  pull:    { a: [-2.8, .2], b: [2.8, -.2] },
};
export const R_H = 62, HY = -178;

function dotFace(fx, view, face, o) {
  const g = K.g, fy = HY + 6;
  // 皮肤（头盔里的脸），丸子头被头盔顶压扁
  g.save(); g.beginPath(); g.arc(0, HY, R_H - 3, 0, TAU); g.clip();
  if (view === 'back') {
    part(circ(0, fy - 4, 46), P.hair, P.hairD);
    part(ell(0, HY - 44, 26, 14), P.hair, P.hairD);
    line([[-18, fy - 20], [-6, fy + 10]], 4, P.hairD); line([[16, fy - 22], [8, fy + 8]], 4, P.hairD);
    g.restore(); return;
  }
  const side = view === 'side';
  part(side ? smooth([[fx - 34, fy - 30], [fx + 10, fy - 44], [fx + 40, fy - 20], [fx + 44, fy + 2], [fx + 50, fy + 8], [fx + 42, fy + 16], [fx + 34, fy + 38], [fx - 4, fy + 44], [fx - 36, fy + 20]])
    : circ(fx, fy, 44), P.skin, P.skinD, { sh: 6 });
  // 发型：刘海 + 压扁的丸子头
  part(ell(fx - (side ? 18 : 4), HY - 46, 28, 13), P.hair, P.hairD, { sh: 4 });
  const fr = side ? [[fx - 40, fy - 6], [fx - 38, fy - 36], [fx - 4, fy - 48], [fx + 30, fy - 36], [fx + 26, fy - 26], [fx + 8, fy - 30], [fx - 14, fy - 20], [fx - 26, fy - 2]]
    : [[fx - 46, fy + 2], [fx - 40, fy - 30], [fx - 8, fy - 48], [fx + 30, fy - 40], [fx + 46, fy - 8], [fx + 36, fy - 20], [fx + 22, fy - 24], [fx + 10, fy - 18], [fx - 6, fy - 26], [fx - 22, fy - 20], [fx - 36, fy - 8]];
  part(smooth(fr), P.hair, P.hairD, { sh: 5 });
  // 眼睛
  const eyes = side ? [[fx + 20, 1]] : view === 'q' ? [[fx - 14, 1], [fx + 22, .82]] : [[fx - 18, 1], [fx + 18, 1]];
  const ey = fy - 4, look = o.look || [0, 0];
  for (const [ex, k] of eyes) {
    if (face === 'proud' || face === 'happy') { line([[ex - 9 * k, ey + 3], [ex, ey - 6], [ex + 9 * k, ey + 3]], 5); continue; }
    if (face === 'sneeze') { line([[ex - 10 * k, ey - 4], [ex + 8 * k, ey + 1], [ex - 10 * k, ey + 6]].map(p => ex < fx || side ? p : [2 * ex - p[0], p[1]]), 5); continue; }
    if (face === 'ah') { line([[ex - 10 * k, ey + 2], [ex + 10 * k, ey + 2]], 5); line([[ex - 9 * k, ey - 8], [ex + 8 * k, ey - 4]].map(p => ex < fx || side ? p : [2 * ex - p[0], p[1]]), 4); continue; }
    const big = face === 'panic' ? 1.25 : 1, rx = 10 * k * big, ry = 13 * big;
    part(ell(ex, ey, rx, ry), P.white, null, { lw: 4 });
    const pr = face === 'panic' ? 4 : 7.5;
    dot(ex + 2 * k + look[0] * 3, ey + 2 + look[1] * 3, pr * k, P.ink);
    dot(ex - 1 * k + look[0] * 3, ey - 3 + look[1] * 3, 2.6 * k, P.white);
    // 眉
    const bt = face === 'determined' ? .35 : face === 'panic' ? -.35 : face === 'idea' ? -.3 : 0;
    const bs = ex < fx || side ? 1 : -1, by = ey - ry - 7 - (face === 'panic' || face === 'idea' ? 5 : 0);
    line([[ex - 8 * k, by - bt * 10 * bs], [ex + 8 * k, by + bt * 10 * bs]], 5);
  }
  // 雀斑 + 腮红
  const ch = side ? [[fx + 8, fy + 12]] : view === 'q' ? [[fx - 22, fy + 14], [fx + 30, fy + 14]] : [[fx - 26, fy + 14], [fx + 26, fy + 14]];
  for (const [cx, cy] of ch) { g.globalAlpha = .55; dot(cx, cy, 8, P.blush); g.globalAlpha = 1; dot(cx - 5, cy - 2, 1.8, P.skinD); dot(cx + 1, cy + 1, 1.8, P.skinD); dot(cx + 6, cy - 3, 1.8, P.skinD); }
  // 嘴
  const mx = side ? fx + 26 : view === 'q' ? fx + 6 : fx, my = fy + 22;
  if (face === 'neutral' || face === 'idea') line([[mx - 7, my], [mx, my + 3], [mx + 7, my]], 4.5);
  else if (face === 'happy' || face === 'proud') part(g => { g.moveTo(mx - 14, my - 3); g.quadraticCurveTo(mx, my + 20, mx + 14, my - 3); g.closePath(); }, '#8a1f3a', null, { lw: 4.5, hi: g => { g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(mx + 2, my + 9, 7, 4, 0, 0, TAU); g.fill(); } });
  else if (face === 'determined') { line([[mx - 10, my + 2], [mx + 8, my - 1]], 4.5); part(ell(mx + 9, my + 3, 4.5, 5), '#ff7a8a', null, { lw: 3 }); }
  else if (face === 'panic') part(rrect(mx - 11, my - 6, 22, 18, 7), '#8a1f3a', null, { lw: 4.5 });
  else if (face === 'ah') part(ell(mx, my + 2, 7, 9), '#8a1f3a', null, { lw: 4.5 });
  else if (face === 'sneeze') { part(ell(mx + 2, my + 4, 15, 12, .2), '#8a1f3a', null, { lw: 4.5 }); }
  else if (face === 'oh') part(ell(mx, my + 2, 5, 6), '#8a1f3a', null, { lw: 4 });
  // 憋喷嚏：鼻孔张大
  if (face === 'ah' || face === 'sneeze') { dot(mx - 4, my - 12, 2.4, P.skinD); dot(mx + 4, my - 12, 2.4, P.skinD); }
  g.restore();
}

function antenna(o) {
  const g = K.g, w = o.ant || 0, top = HY - R_H;
  const bx = Math.sin(w) * 40, by = top - Math.cos(w) * 40;
  part(rrect(-9, top - 8, 18, 12, 4), P.gray, P.grayD, { sh: 3 });
  // 弹簧：沿弯曲路径的锯齿
  const pts = []; const N = 9;
  for (let i = 0; i <= N; i++) { const u = i / N, cx = bx * u * u, cy = top - 8 + (by - top + 8) * u; pts.push([cx + (i % 2 ? 6 : -6) * (i > 0 && i < N ? 1 : 0), cy]); }
  line(pts, 4.5);
  part(circ(bx, by - 8, 13), P.orange, P.orangeD, { sh: 5, hi: g => { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(bx - 4, by - 13, 3.5, 0, TAU); g.fill(); } });
}

function glove(x, y, r, a = 0) { part(circ(x, y, r), P.orange, P.orangeD, { sh: 4 }); }

export function drawDot(x, y, s, o = {}) {
  const g = K.g, view = o.view || 'front', face = o.face || 'neutral', pose = { ...DOT_POSE[o.pose || 'stand'], ...(o.arms || {}) };
  const ps = K.s; K.s = s;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); if (o.rot) g.rotate(o.rot);
  const q = view === 'q', side = view === 'side', back = view === 'back';
  const hop = pose.hop ? -10 : 0;
  // 背包（身后）
  if (!back) part(q ? rrect(-72, -140, 60, 96, 16) : side ? rrect(-84, -140, 50, 96, 16) : rrect(-64, -140, 128, 96, 18), P.orange, P.orangeD, { sh: 6 });
  // 腿与靴
  const legs = side ? [[-6, 0]] : q ? [[-24, 0], [18, -2]] : [[-24, 0], [24, 0]];
  for (const [lx, ly] of legs) {
    const bend = pose.hop ? -12 : 0;
    part(rrect(lx - 17, -56 + bend, 34, 44, 12), P.suit, P.suitD, { sh: 6 });
    part(side || q ? smooth([[lx - 22, -4 + bend], [lx - 20, -22 + bend], [lx + 12, -24 + bend], [lx + 28, -12 + bend], [lx + 28, bend], [lx - 18, bend + 2]]) : rrect(lx - 22, -22 + bend, 44, 24, 11), P.orange, P.orangeD, { sh: 5 });
  }
  // 远侧手臂（3/4 与侧面在身体后）
  const shoulderY = -112;
  const L2 = (sx, A) => A.length === 3 ? ik(sx, shoulderY, 32, 30, A[0], A[1], A[2]) : limb(sx, shoulderY, 32, 30, ...A);
  const armA = L2(q ? -44 : side ? -8 : -50, pose.a);
  const armB = L2(q ? 40 : side ? 6 : 50, pose.b);
  const drawArm = A => { tube([A[0], A[1], A[2]], 25, P.suit); glove(A[2][0], A[2][1], 15); };
  if (q || side) drawArm(armB);
  // 躯干
  if (back) {
    part(smooth([[-50, -126], [50, -126], [58, -50], [0, -40], [-58, -50]]), P.suit, P.suitD, { sh: 8 });
    part(rrect(-54, -146, 108, 104, 18), P.orange, P.orangeD, { sh: 8 });
    part(rrect(-34, -128, 68, 22, 8), P.orangeD, null, { lw: 4 });
    line([[-30, -80], [30, -80]], 4, P.orangeD);
  } else {
    const tw = side ? 44 : q ? 50 : 54, tx = q ? 4 : side ? 2 : 0;
    part(smooth([[tx - tw, -124], [tx + tw, -124], [tx + tw + 8, -54], [tx + 4, -40], [tx - tw - 8, -54]]), P.suit, P.suitD, { sh: 9 });
    // 腰带
    part(g => { g.moveTo(tx - tw - 6, -66); g.lineTo(tx + tw + 6, -66); g.lineTo(tx + tw + 8, -52); g.quadraticCurveTo(tx, -40, tx - tw - 8, -52); g.closePath(); }, P.gray, P.grayD, { sh: 4 });
    // 05 胸牌
    if (!side) {
      const px = q ? tx + 10 : tx - 14;
      part(rrect(px - 20, -112, 40, 30, 8), P.orange, P.orangeD, { sh: 4, lw: 5 });
      g.save(); g.translate(px, -89); if (o.flip) g.scale(-1, 1);
      g.font = '26px Lilita'; g.textAlign = 'center'; g.fillStyle = P.white; g.fillText('05', 0, 0); g.restore();
      // 按钮
      dot(q ? tx + 34 : tx + 28, -100, 5, P.cyan); dot(q ? tx + 34 : tx + 28, -86, 5, P.red);
    } else part(rrect(tx + 20, -112, 16, 28, 6), P.orange, P.orangeD, { sh: 3, lw: 5 });
  }
  // 领圈 + 头盔
  g.save(); g.translate(0, hop * 0);
  part(ell(0, -124, 50, 15), P.cyan, P.cyanD, { sh: 5 });
  antenna(o);
  part(circ(0, HY, R_H), 'rgba(40,70,120,.10)', null, { lw: 0.01, stroke: false });
  dotFace(view === 'front' ? 0 : q ? 14 : 20, view, face, o);
  // 玻璃：淡青 + 高光
  g.save(); g.beginPath(); g.arc(0, HY, R_H, 0, TAU); g.fillStyle = P.glass; g.fill();
  g.beginPath(); g.arc(0, HY, R_H - 11, Math.PI * 1.08, Math.PI * 1.42); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
  dot(-18, HY - 50, 4.5, 'rgba(255,255,255,.9)');
  g.beginPath(); g.arc(0, HY, R_H - 8, Math.PI * .15, Math.PI * .4); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 5; g.stroke();
  g.restore();
  g.beginPath(); g.arc(0, HY, R_H, 0, TAU); g.lineWidth = lw(); g.strokeStyle = P.ink; g.stroke();
  // 领圈前沿
  g.save(); g.beginPath(); g.ellipse(0, -124, 50, 15, 0, 0, Math.PI); g.lineWidth = lw(); g.strokeStyle = P.ink; g.stroke(); g.restore();
  g.restore();
  // 近侧手臂（在最前）
  drawArm(armA); if (!(q || side)) drawArm(armB);
  if (o.extra) o.extra(g, { armA, armB });
  g.restore(); K.s = ps;
  return { armA, armB };
}

// ───────────────────────── COACH TICK ─────────────────────────
// 局部单位：脚底 (0,0)，秒表圆心 (0,-330) 半径 100，总高约 470
export const TICK_POSE = {
  idle:     { a: [-.25, .35], b: [.25, -.35] },
  present:  { a: [-.3, .4], b: [1.35, .35] },
  slap:     { a: [-.4, .5], b: [14, -452, 1] },
  shout:    { a: [-1.5, 1.9], b: [1.7, .1], mic: 'a' },
  facepalm: { a: [-.3, .5], b: [-20, -350, 1] },
  serious:  { a: [-.1, .12], b: [.1, -.12] },
  cheer:    { a: [-2.6, -.2], b: [2.6, .2] },
  point:    { a: [-.3, .4], b: [1.55, .05] },
  press:    { a: [-.3, .4], b: [.6, .5] },
};
const HX = 0, HYt = -330, RT = 100;

export function whiteGlove(x, y, a, s = 1, flip = 1) {
  const g = K.g; g.save(); g.translate(x, y); g.rotate(-a); g.scale(s * flip, s);
  part(poly([[-11, -16], [11, -16], [14, -4], [-14, -4]]), P.white, P.dialD, { sh: 3, lw: 5 });
  part(smooth([[-16, 0], [-10, -6], [10, -6], [18, 2], [20, 18], [12, 30], [-8, 30], [-18, 18]]), P.white, P.dialD, { sh: 4, lw: 5 });
  part(ell(-19, 10, 7, 11, .5), P.white, P.dialD, { sh: 3, lw: 5 });
  line([[-4, 18], [-4, 28]], 3.5); line([[5, 18], [5, 28]], 3.5);
  g.restore();
}

function stopwatchHead(view, face, o) {
  const g = K.g, q = view === 'q', side = view === 'side', back = view === 'back';
  const sx = side ? .28 : q ? .84 : 1;
  const hand = o.hand ?? 0;   // 秒针角度（弧度，0 = 12 点）
  // 挂环 + 表冠
  part(g => { g.ellipse(0, HYt - RT - 44, 20, 17, 0, 0, TAU); g.ellipse(0, HYt - RT - 44, 11, 9, 0, 0, TAU); }, P.gold, P.goldD, { rule: 'evenodd', sh: 4 });
  const press = o.press || 0;
  part(rrect(-12, HYt - RT - 20, 24, 24, 4), P.gold, P.goldD, { sh: 4 });
  part(rrect(-24, HYt - RT - 34 + press * 10, 48, 18, 7), P.goldL, P.gold, { sh: 4 });
  // 侧按钮（2 点方向）
  if (!side) { g.save(); g.translate(HX, HYt); g.scale(sx, 1); g.rotate(.72); part(rrect(-9, -RT - 16, 18, 20, 4), P.gold, P.goldD, { sh: 3 }); g.restore(); }
  // 表壳厚度（3/4 时左侧露出）
  if (q) part(ell(-10, HYt, RT * .9, RT), P.goldD, null, {});
  if (side) { part(rrect(-RT * .32, HYt - RT, RT * .64, RT * 2, RT * .3), P.gold, P.goldD, { sh: 8 }); line([[0, HYt - RT + 10], [0, HYt + RT - 10]], 4, P.goldD); return; }
  part(ell(q ? 4 : 0, HYt, RT * sx, RT), P.gold, P.goldD, { sh: 10, hi: g => { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.ellipse(q ? 4 : 0, HYt, RT * sx - 12, RT - 12, 0, Math.PI * 1.1, Math.PI * 1.45); g.stroke(); } });
  if (back) { part(ell(0, HYt, 70, 70), P.goldD, P.goldD, {}); for (let i = 0; i < 3; i++) line([[-40 + i * 8, HYt - 20 + i * 14], [40 - i * 8, HYt - 20 + i * 14]], 3, '#b86a00'); return; }
  const cx = q ? 10 : 0, rx = 80 * sx, ry = 80;
  part(ell(cx, HYt, rx, ry), P.dial, P.dialD, { sh: 7 });
  // 刻度
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, big = i % 3 === 0, r1 = big ? 60 : 66, r2 = 74;
    line([[cx + Math.sin(a) * r1 * sx, HYt - Math.cos(a) * r1], [cx + Math.sin(a) * r2 * sx, HYt - Math.cos(a) * r2]], big ? 6 : 3.5);
  }
  // 眼睛
  const ex = [cx - 30 * sx, cx + 30 * sx], ey = HYt - 16, look = o.look || [0, 0];
  for (let i = 0; i < 2; i++) {
    const x = ex[i], k = q && i === 0 ? .9 : 1;
    if (face === 'grin' || face === 'cheer') { line([[x - 13 * sx, ey + 4], [x, ey - 10], [x + 13 * sx, ey + 4]], 6.5); continue; }
    if (face === 'wink' && i === 1) { line([[x - 12, ey], [x + 12, ey]], 6.5); continue; }
    if (face === 'facepalm') { line([[x - 12 * sx, ey + 2], [x + 12 * sx, ey + 2]], 6); continue; }
    const ry2 = face === 'serious' ? 12 : face === 'shout' ? 22 : 19, rx2 = (face === 'shout' ? 13 : 12) * sx * k;
    part(ell(x, ey, rx2, ry2), P.ink, null, { lw: 2 });
    dot(x - 4 * sx + look[0] * 3, ey - ry2 * .45 + look[1] * 2, 4.5, P.white);
    if (face === 'serious') { g.save(); g.fillStyle = P.dial; g.fillRect(x - 16, ey - 24, 32, 14); g.restore(); line([[x - 15 * sx, ey - 9], [x + 15 * sx, ey - 9]], 6); }
  }
  // 眉
  const bl = face === 'shout' ? -14 : face === 'serious' ? 6 : face === 'sly' ? 4 : -2;
  if (face !== 'serious') for (let i = 0; i < 2; i++) { const x = ex[i], d = i ? 1 : -1; line([[x - 13 * sx, ey - 32 + (face === 'sly' ? d * 5 : 0) + bl * .3], [x + 13 * sx, ey - 32 - (face === 'sly' ? d * 5 : 0) + bl * .3 - d * (face === 'shout' ? 4 : 0)]], 6); }
  // 嘴
  const my = HYt + 30;
  if (face === 'grin' || face === 'cheer' || face === 'sly' || face === 'wink') {
    const w = face === 'sly' ? 26 : 40;
    part(g => { g.moveTo(cx - w * sx, my - 6); g.quadraticCurveTo(cx, my + (face === 'sly' ? 18 : 42), cx + w * sx, my - 6); g.closePath(); }, '#7a1030', null, { lw: 6, hi: g => { g.fillStyle = P.white; g.fillRect(cx - 50, my - 10, 100, 11); g.fillStyle = '#ff5a7a'; g.beginPath(); g.ellipse(cx + 4, my + 26, 18, 10, 0, 0, TAU); g.fill(); } });
  } else if (face === 'shout') {
    part(ell(cx, my + 8, 30 * sx, 26), '#7a1030', null, { lw: 6, hi: g => { g.fillStyle = P.white; g.fillRect(cx - 40, my - 22, 80, 10); g.fillStyle = '#ff5a7a'; g.beginPath(); g.ellipse(cx, my + 26, 18, 10, 0, 0, TAU); g.fill(); } });
  } else if (face === 'serious') line([[cx - 22 * sx, my + 6], [cx + 22 * sx, my + 6]], 6);
  else if (face === 'facepalm') line([[cx - 20 * sx, my + 12], [cx, my + 4], [cx + 20 * sx, my + 12]], 6);
  // 秒针：从中心（金色小帽 = 鼻子）伸出
  const L = 58;
  line([[cx - Math.sin(hand) * 14 * sx, HYt + Math.cos(hand) * 14], [cx + Math.sin(hand) * L * sx, HYt - Math.cos(hand) * L]], 4.5, P.red);
  part(circ(cx, HYt, 8), P.red, P.redD, { sh: 2, lw: 4 });
  // 玻璃反光
  g.save(); g.beginPath(); g.ellipse(cx, HYt, rx, ry, 0, 0, TAU); g.clip();
  g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(cx - 90, HYt - 40); g.lineTo(cx - 40, HYt - 90); g.lineTo(cx - 20, HYt - 90); g.lineTo(cx - 90, HYt - 20); g.fill();
  g.restore();
}

export function drawTick(x, y, s, o = {}) {
  const g = K.g, view = o.view || 'front', face = o.face || 'grin', pose = { ...TICK_POSE[o.pose || 'idle'], ...(o.arms || {}) };
  const ps = K.s; K.s = s;
  g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s); if (o.rot) g.rotate(o.rot);
  const q = view === 'q', side = view === 'side', back = view === 'back';
  // 燕尾（身后）
  part(poly([[-40, -140], [40, -140], [34, -70], [8, -92], [0, -80], [-8, -92], [-34, -70]].map(p => side ? [p[0] * .5 - 26, p[1]] : q ? [p[0] * .8 - 10, p[1]] : p)), P.magD, null, {});
  // 腿 + 球鞋
  const lx = side ? [0] : [-22, 22];
  for (const L of lx) {
    const bx = L + (q ? 4 : 0);
    line([[bx, -118], [bx, -20]], 18); line([[bx, -118], [bx, -20]], 11, P.black);
    const toe = side || q ? 1 : L < 0 ? -.35 : .35;
    part(smooth([[bx - 26 + toe * 10, -2], [bx - 22 + toe * 8, -26], [bx + 6 + toe * 16, -30], [bx + 30 + toe * 22, -14], [bx + 30 + toe * 22, 2], [bx - 24 + toe * 10, 4]]), P.white, P.dialD, { sh: 5, hi: g => { g.fillStyle = P.red; g.fillRect(bx - 40, -8, 120, 14); g.fillStyle = P.cyan; g.beginPath(); g.arc(bx + toe * 14, -18, 5, 0, TAU); g.fill(); } });
  }
  const arm = (side2, A) => {
    const sx = side2 < 0 ? (q ? -48 : side ? -6 : -60) : (q ? 44 : side ? 4 : 60);
    const Lb = A.length === 3 ? ik(sx, -212, 58, 54, A[0], A[1], A[2]) : limb(sx, -212, 58, 54, ...A);
    tube([Lb[0], Lb[1], Lb[2]], 20, P.mag);
    whiteGlove(Lb[2][0], Lb[2][1], Lb[3], 1.05, side2 < 0 ? -1 : 1);
    return Lb;
  };
  if (q || side) arm(1, pose.b);
  // 夹克
  const jw = side ? 36 : q ? 52 : 62;
  part(smooth([[-jw, -226], [jw, -226], [jw * .82, -120], [0, -108], [-jw * .82, -120]].map(p => [p[0] + (q ? 2 : 0), p[1]])), P.mag, P.magD, { sh: 9, hi: g => {
    // 亮片
    for (let i = 0; i < 40; i++) { const px = -60 + (i * 37 % 120), py = -222 + (i * 53 % 110); g.fillStyle = i % 3 ? 'rgba(255,190,230,.55)' : 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(px, py, i % 3 ? 2.2 : 1.6, 0, TAU); g.fill(); }
  } });
  if (!back && !side) {
    const c = q ? 8 : 0;
    part(poly([[c - 22, -226], [c + 22, -226], [c, -150]]), P.white, P.dialD, { sh: 3, lw: 5 });
    part(poly([[c - 24, -226], [c - 42, -226], [c - 30, -170], [c - 4, -140]]), P.cyan, P.cyanD, { sh: 3, lw: 5 });
    part(poly([[c + 24, -226], [c + 42, -226], [c + 30, -170], [c + 4, -140]]), P.cyan, P.cyanD, { sh: 3, lw: 5 });
    // 领结
    part(g => { g.moveTo(c, -214); g.lineTo(c - 26, -228); g.lineTo(c - 26, -198); g.closePath(); g.moveTo(c, -214); g.lineTo(c + 26, -228); g.lineTo(c + 26, -198); g.closePath(); }, P.black, null, { lw: 5 });
    part(circ(c, -213, 6), P.black, null, { lw: 4 });
    dot(c, -176, 4, P.gold); dot(c, -156, 4, P.gold);
  }
  // 颈
  part(rrect(-14, -236, 28, 14, 4), P.goldD, null, { lw: 5 });
  stopwatchHead(view, face, o);
  // 近侧手臂
  const A = arm(-1, pose.a);
  if (!(q || side)) arm(1, pose.b);
  // 麦克风
  if (pose.mic && !back) {
    const [hx, hy] = A[2]; g.save(); g.translate(hx, hy); g.rotate(-A[3] + Math.PI);
    part(rrect(-7, -40, 14, 44, 5), P.black, null, { lw: 5 });
    part(circ(0, -52, 17), '#c9c6d6', '#8f8aa3', { sh: 4, lw: 5, hi: g => { g.strokeStyle = 'rgba(40,30,60,.35)'; g.lineWidth = 2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(-20, -52 + i * 5); g.lineTo(20, -52 + i * 5); g.stroke(); } } });
    g.restore();
  }
  if (o.extra) o.extra(g);
  g.restore(); K.s = ps;
}
