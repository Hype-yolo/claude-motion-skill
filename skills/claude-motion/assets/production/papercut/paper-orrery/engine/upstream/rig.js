// 关节分片骨架：2D 仿射矩阵 [a,b,c,d,e,f]（与 canvas setTransform 同序）
import { drawPiece, paperShadow, noShadow, transmitOf } from './paper.js';
export const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
export const T = (x, y) => [1, 0, 0, 1, x, y];
export const R = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
export const S = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
export const ap = (M, p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
export const scaleOf = M => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
export const I = [1, 0, 0, 1, 0, 0];

// 画一片：M = 片局部→屏幕；opt.shadow（纸影强度，0 = 不投影）
export function put(g, p, M, opt = {}) {
  g.save(); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
  if (opt.alpha != null) g.globalAlpha = opt.alpha;
  if (opt.shadow !== 0) paperShadow(g, scaleOf(M) * (opt.shadowScale || 1), opt.shadow ?? 1, opt.shadowCol); else noShadow(g);
  if (opt.filter) g.filter = opt.filter;
  g.drawImage(opt.img || p.c, p.x0, p.y0, p.w, p.h);
  g.restore();
}
// 骨架：parts = [{name, parent, at:[x,y]（在父坐标里的关节位置）, piece, ang:key, z}]
// 返回各部件的矩阵表（供铆钉示意、道具挂点使用）
export function solveRig(parts, root, pose) {
  const Ms = {};
  for (const p of parts) {
    const base = p.parent ? Ms[p.parent] : root;
    const a = (pose[p.ang] || 0) + (p.a0 || 0);
    let M = mul(base, T(p.at[0], p.at[1]));
    M = mul(M, R(a));
    if (p.flipKey && pose[p.flipKey]) M = mul(M, S(-1, 1));
    Ms[p.name] = M;
  }
  return Ms;
}
