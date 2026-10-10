// 民间剪纸纹样库（全部是"剪掉"的操作，在调用处的片坐标里用）
// 锯齿纹、月牙纹、云纹 / 旋涡纹、梅花孔、铜钱孔、鱼鳞、刻线
import { cut, cutLine, cutTaper, curve, trace } from './paper.js';

const TAU = Math.PI * 2;
// 折线按弧长重采样，返回 [{x,y,nx,ny}]（法线指向行进方向左侧）
export function along(pts, step) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1], n = Math.max(1, Math.round(tot / step)), out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = tot * k / n; while (j < pts.length - 2 && L[j + 1] < s) j++;
    const u = (s - L[j]) / ((L[j + 1] - L[j]) || 1), a = pts[j], b = pts[j + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    out.push({ x: a[0] + dx * u, y: a[1] + dy * u, nx: dy / l, ny: -dx / l, tx: dx / l, ty: dy / l, s });
  }
  return out;
}
// 锯齿纹：沿线剪一排细长三角孔（尖朝 side 侧），留下一根根红色细齿
export function sawRow(g, pts, h = 10, sp = 6, side = 1, gapFrac = .78) {
  const S = along(pts, sp);
  cut(g, q => {
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, hw = gapFrac / 2;
      const p0 = [a.x + (b.x - a.x) * (.5 - hw), a.y + (b.y - a.y) * (.5 - hw)], p1 = [a.x + (b.x - a.x) * (.5 + hw), a.y + (b.y - a.y) * (.5 + hw)];
      q.moveTo(p0[0], p0[1]); q.lineTo(p1[0], p1[1]); q.lineTo(mx + a.nx * h * side, my + a.ny * h * side); q.closePath();
    }
  });
}
// 锯齿边：把一条边做成锯齿轮廓（返回新折线，用来组成外轮廓）
export function sawEdge(pts, h = 12, sp = 14, side = 1, jit = 0, seed = 0) {
  const S = along(pts, sp / 2), out = [];
  S.forEach((p, i) => { const k = i % 2 ? h * side * (1 + jit * (Math.sin(i * 12.9898 + seed) * .5)) : 0; out.push([p.x + p.nx * k, p.y + p.ny * k]); });
  return out;
}
// 月牙：弧形孔，中间厚两头尖。c = 圆心，r = 半径，a0..a1 = 弧段，t = 最大厚度
export function crescentPts(cx, cy, r, a0, a1, t, n = 18) {
  const o = [], ins = [];
  for (let i = 0; i <= n; i++) { const u = i / n, a = a0 + (a1 - a0) * u, k = Math.sin(Math.PI * u); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); ins.push([cx + Math.cos(a) * (r - t * k), cy + Math.sin(a) * (r - t * k)]); }
  return o.concat(ins.reverse());
}
export function crescent(g, cx, cy, r, a0, a1, t) { cut(g, q => trace(q, crescentPts(cx, cy, r, a0, a1, t))); }
// 月牙纹（鳞片）：一行行错位的月牙孔，开口朝上（rot 可转）
export function crescentRows(g, x0, y0, x1, y1, r = 12, t = 4, rot = 0, span = .7) {
  const c = Math.cos(rot), s = Math.sin(rot);
  cut(g, q => {
    let row = 0;
    for (let y = y0 - r; y < y1 + r * 2; y += r * 1.05, row++)
      for (let x = x0 - r * 2 + (row % 2) * r; x < x1 + r * 2; x += r * 2) {
        const pts = crescentPts(0, 0, r, Math.PI * (.5 - span / 2), Math.PI * (.5 + span / 2), t, 12)
          .map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
        trace(q, pts);
      }
  });
}
// 旋涡纹：阿基米德螺线刻线（渐细），turns 圈，dir = ±1
export function swirl(g, cx, cy, r, turns = 2.2, w = 4, rot = 0, dir = 1) {
  const pts = [], n = Math.ceil(turns * 36);
  for (let i = 0; i <= n; i++) { const u = i / n, a = rot + dir * u * turns * TAU, rr = r * (1 - u * .92); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  cutTaper(g, pts, w);
  cut(g, q => { const e = pts[pts.length - 1]; q.arc(e[0], e[1], w * .7, 0, TAU); });
}
// 双旋（动物关节的"涡"）：一条 S 形双螺线
export function doubleSwirl(g, cx, cy, r, w = 5, rot = 0) {
  const a = [cx + Math.cos(rot) * r * .5, cy + Math.sin(rot) * r * .5], b = [cx - Math.cos(rot) * r * .5, cy - Math.sin(rot) * r * .5];
  swirl(g, a[0], a[1], r * .5, 1.6, w, rot + Math.PI, 1);
  swirl(g, b[0], b[1], r * .5, 1.6, w, rot, 1);
}
// 云纹：一个主卷 + 两个小卷的轮廓刻线
export function cloudCut(g, cx, cy, r, w = 3, rot = 0, flip = 1) {
  swirl(g, cx, cy, r, 1.4, w, rot, flip);
  swirl(g, cx + Math.cos(rot + flip * 2.2) * r * 1.25, cy + Math.sin(rot + flip * 2.2) * r * 1.25, r * .55, 1.2, w * .8, rot + Math.PI, -flip);
}
// 梅花孔：五瓣
export function plum(g, cx, cy, r, rot = -Math.PI / 2) {
  cut(g, q => { for (let k = 0; k < 5; k++) { const a = rot + k * TAU / 5, x = cx + Math.cos(a) * r * .62, y = cy + Math.sin(a) * r * .62; q.moveTo(x + r * .42, y); q.arc(x, y, r * .42, 0, TAU); } });
}
// 花瓣团：n 片水滴形花瓣孔围一圈（腮红 / 胸前团花）
export function rosette(g, cx, cy, r, n = 6, rot = 0, core = .18) {
  cut(g, q => {
    for (let k = 0; k < n; k++) {
      const a = rot + k * TAU / n, ca = Math.cos(a), sa = Math.sin(a), r0 = r * (core + .08), r1 = r, wd = r * Math.sin(Math.PI / n) * .72;
      const P = (u, v) => [cx + ca * u - sa * v, cy + sa * u + ca * v];
      q.moveTo(...P(r0, 0)); q.quadraticCurveTo(...P((r0 + r1) * .5, wd * 1.25), ...P(r1, 0)); q.quadraticCurveTo(...P((r0 + r1) * .5, -wd * 1.25), ...P(r0, 0)); q.closePath();
    }
  });
  cut(g, q => { q.moveTo(cx + r * core * .55, cy); q.arc(cx, cy, r * core * .55, 0, TAU); });
}
// 铜钱孔：圆孔中留方形
export function coin(g, cx, cy, r) { cut(g, q => { q.arc(cx, cy, r, 0, TAU); q.rect(cx - r * .4, cy - r * .4, r * .8, r * .8); }, 'evenodd'); }
// 一排小圆孔
export function dots(g, pts, r) { cut(g, q => { for (const [x, y] of pts) { q.moveTo(x + r, y); q.arc(x, y, r, 0, TAU); } }); }
// 平行刻线（头发丝、衣褶）：沿 base 曲线的偏移排线
export function strands(g, base, n, gap, w, len0 = 0, len1 = 1) {
  for (let k = 0; k < n; k++) {
    const pts = base.map(([x, y], i) => { const a = base[Math.max(0, i - 1)], b = base[Math.min(base.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [x + dy / l * gap * k, y - dx / l * gap * k]; });
    const i0 = Math.floor(pts.length * len0), i1 = Math.ceil(pts.length * len1);
    cutTaper(g, pts.slice(i0, i1), w);
  }
}
// 锥形刻线的简写：给控制点，平滑后刻
export function taper(g, pts, w) { cutTaper(g, curve(pts, false, 2), w); }
