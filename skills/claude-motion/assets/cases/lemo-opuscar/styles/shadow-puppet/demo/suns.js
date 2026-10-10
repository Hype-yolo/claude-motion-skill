// 太阳皮影：一整片刻花圆皮件（外圈火焰纹镂空 + 联珠 + 半透明橙红盘）+ 盘心一只三足金乌剪影（单独一片，被射中时跌落）
import { piece, drawPiece, fill, cut, cutLine, ink, within, smooth, poly, beads, cloud, flameTongue, DYE } from './carve.js';
import { mulberry } from '/core/lib.js';

// 火焰舌：从角度 a 的根部卷出去（S 形，尖端回勾）
function tongue(q, a, r0, r1, wd, hook = 1) {
  const P = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
  const b0 = P(a - wd, r0), b1 = P(a + wd, r0), m0 = P(a - wd * .55, (r0 + r1) / 2), m1 = P(a + wd * .9, (r0 + r1) / 2 + 2);
  const tip = P(a + wd * .9 * hook, r1), hk = P(a + wd * 1.5 * hook, r1 - (r1 - r0) * .28);
  q.moveTo(b0[0], b0[1]); q.quadraticCurveTo(m0[0], m0[1], tip[0], tip[1]); q.quadraticCurveTo(hk[0], hk[1], m1[0], m1[1]); q.quadraticCurveTo(P(a + wd * 1.1, r0 + 3)[0], P(a + wd * 1.1, r0 + 3)[1], b1[0], b1[1]); q.closePath();
}
function sunDisk(n, seed) {
  return piece([-86, -86, 86, 86], g => {
    const R0 = 42, R1 = 56;
    const tongues = (q, s = 1) => { for (let k = 0; k < n; k++) { const a = seed + k / n * Math.PI * 2; tongueAt(q, a, R1 - 7, 40 * s, (Math.PI * 2 * R1 / n) * .78 * s, k % 2 ? 1 : -1); } };
    fill(g, DYE.orange, q => { q.moveTo(R1, 0); q.arc(0, 0, R1, 0, Math.PI * 2); tongues(q); }, 'nonzero');
    // 火舌内层黄
    fill(g, DYE.yellow, q => { for (let k = 0; k < n; k++) { const a = seed + k / n * Math.PI * 2; tongueAt(q, a, R1 - 2, 24, (Math.PI * 2 * R1 / n) * .4, k % 2 ? 1 : -1); } }, 'nonzero');
    // 外圈镂空：舌与舌之间的泪滴孔 + 舌根小卷
    for (let k = 0; k < n; k++) {
      const a = seed + (k + .5) / n * Math.PI * 2, P = r => [Math.cos(a) * r, Math.sin(a) * r];
      cut(g, q => { const c = P((R0 + R1) / 2 + 1); q.ellipse(c[0], c[1], 3.2, 5.4, a, 0, Math.PI * 2); });
      const a2 = seed + k / n * Math.PI * 2; cloud(g, Math.cos(a2) * (R1 + 6), Math.sin(a2) * (R1 + 6), 3.6, a2, 1.1, k % 2 ? 1 : -1);
    }
    fill(g, '#cf3a1c', q => q.arc(0, 0, R0, 0, Math.PI * 2));
    { const pts = []; for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2; pts.push([Math.cos(a) * 38, Math.sin(a) * 38]); } beads(g, pts, 1.7); }
    ink(g, 1.3, q => q.arc(0, 0, 34, 0, Math.PI * 2)); ink(g, 1.6, q => q.arc(0, 0, R0, 0, Math.PI * 2));
    ink(g, 1.6, q => { tongues(q); });
  }, { seed: 30 + Math.round(seed * 10) });
}
function tongueAt(q, a, r, h, w, dir) {   // 在半径 r、角度 a 处立一条向外的火舌
  const ca = Math.cos(a), sa = Math.sin(a);
  // 局部 (x, y)：-y = 向外；x = 切向
  const M = (x, y) => [ca * (r - y) + (-sa) * x, sa * (r - y) + ca * x];
  const P = { moveTo: (x, y) => q.moveTo(...M(x, y)), bezierCurveTo: (a1, b1, a2, b2, a3, b3) => q.bezierCurveTo(...M(a1, b1), ...M(a2, b2), ...M(a3, b3)), closePath: () => q.closePath() };
  flameTongue(P, h, w, dir);
}
// 三足乌：侧身朝右、双翅上扬、三根长尾羽、三足
function crowPath(q) {
  smooth(q, [[-13, 5], [-4, -1], [7, -3], [12, -8], [16, -10], [20, -9], [28, -6], [20, -4.5], [18, 0], [12, 6], [2, 9], [-10, 9]]);
  // 近翼
  smooth(q, [[-3, -1], [-6, -14], [-12, -26], [-22, -34], [-30, -33], [-26, -30], [-24, -25], [-18, -24], [-17, -18], [-11, -17], [-9, -10], [-3, -7], [3, -3]]);
  // 远翼
  smooth(q, [[2, -4], [3, -16], [8, -28], [14, -34], [13, -27], [16, -24], [12, -19], [12, -12], [9, -5]]);
  // 尾羽
  smooth(q, [[-11, 4], [-24, 0], [-35, -4], [-38, 0], [-33, 1], [-26, 6], [-37, 7], [-39, 12], [-34, 11], [-25, 10], [-33, 16], [-34, 20], [-28, 16], [-12, 9]]);
  // 三足
  for (const [a, b] of [[-5, 8], [1, 9], [7, 7]]) { q.moveTo(a - 1.3, b); q.lineTo(a + 1.3, b); q.lineTo(a + 2.4, b + 10); q.lineTo(a + 4.6, b + 11.5); q.lineTo(a - .4, b + 12); q.closePath(); }
}
export function crowPiece(col = '#3a120c') {
  return piece([-44, -40, 34, 26], g => {
    fill(g, col, q => crowPath(q), 'nonzero');
    // 刻羽：翅上三道弧缝 + 尾羽中缝 + 眼
    for (let k = 0; k < 3; k++) cutLine(g, 1, q => { q.moveTo(-6 - k * 5, -7 - k * 2); q.quadraticCurveTo(-12 - k * 4, -18 - k * 3, -20 - k * 3, -27 - k); });
    cutLine(g, .9, q => { q.moveTo(6, -8); q.quadraticCurveTo(8, -18, 12, -28); });
    cutLine(g, .9, q => { q.moveTo(-14, 5); q.lineTo(-33, -1); q.moveTo(-14, 7); q.lineTo(-35, 10); q.moveTo(-14, 8); q.lineTo(-30, 16); });
    cutLine(g, .8, q => { q.moveTo(-2, 3); q.quadraticCurveTo(4, 6, 10, 2); });
    cut(g, q => q.arc(16.5, -6.5, 1.5, 0, 7));
  }, { seed: 41 });
}
let SP = null;
export function buildSuns() {
  if (SP) return SP;
  SP = { disks: [sunDisk(14, 0), sunDisk(16, .2), sunDisk(13, .1), sunDisk(15, .3)], crow: crowPiece(), crowFall: crowPiece('#24100a') };
  return SP;
}
export const mulM = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const rotM = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
// 太阳（不含乌）：M = 屏幕变换；opt: {v 款式, rot, blur, alpha}
export function drawSun(g, M, opt = {}) {
  const sp = buildSuns();
  g.save(); g.globalCompositeOperation = 'multiply'; if (opt.alpha != null) g.globalAlpha = opt.alpha; if (opt.blur) g.filter = `blur(${opt.blur}px)`;
  g.setTransform(...mulM(M, rotM(opt.rot || 0))); drawPiece(g, sp.disks[(opt.v || 0) % 4]);
  if (!opt.noCrow) { g.setTransform(...mulM(M, [1.05, 0, 0, 1.05, 3, 1])); drawPiece(g, sp.crow); }
  g.restore();
}
export function drawCrow(g, M, blur = 0, alpha = 1) {
  const sp = buildSuns();
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = alpha; if (blur) g.filter = `blur(${blur}px)`;
  g.setTransform(...M); drawPiece(g, sp.crowFall); g.restore();
}
// 十个太阳在幕布上的位置（= 幕后油灯位置）；[0] 是开场第一盏、也是最后留下的那一个
export const SUNPOS = [[1450, 190, 12, 0], [820, 150, 14, 1], [1080, 105, 10, 2], [1260, 290, 12, 3], [1640, 110, 14, 0], [1830, 250, 10, 1], [960, 300, 12, 2], [1180, 460, 10, 3], [1560, 400, 14, 1], [1750, 520, 12, 2]];
