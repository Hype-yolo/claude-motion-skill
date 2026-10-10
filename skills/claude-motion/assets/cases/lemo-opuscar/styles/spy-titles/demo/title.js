// 片名 THE VELVET CIPHER：自己拼的剪纸几何字形（直线 + 圆弧，笔画不匀、基线错落），不参照任何真实片名 logo
// CIPHER 的 I = 一块黑色"锁板"，中间剪出红色钥匙孔；钥匙放进去就是芥末黄的 I
import { g, C, S, piece, rough, roughC, arcP } from './paper.js';
import { keyholeP } from './chars.js';

// 字形：高 100 单位，左上为原点；返回 [外轮廓, (镂空)...]
const arc = (cx, cy, r, a0, a1, n = 16) => arcP(cx, cy, r, a0 * Math.PI / 180, a1 * Math.PI / 180, n);
const D = Math.PI / 180;
export const GLYPH = {
  T: { w: 66, p: () => [[[0, 1], [66, -1], [65, 21], [43, 20], [42, 100], [21, 100], [22, 21], [1, 22]]] },
  H: { w: 66, p: () => [[[0, 0], [21, 1], [21, 39], [45, 40], [44, 0], [66, 1], [65, 100], [44, 100], [45, 60], [21, 59], [22, 100], [0, 99]]] },
  E: { w: 58, p: () => [[[0, 0], [57, 1], [55, 21], [21, 20], [21, 39], [47, 40], [47, 59], [21, 60], [21, 79], [58, 80], [57, 100], [0, 100]]] },
  V: { w: 74, p: () => [[[0, 0], [23, 0], [37, 66], [51, 0], [74, 1], [48, 100], [26, 100]]] },
  L: { w: 56, p: () => [[[0, 0], [22, 0], [21, 79], [56, 80], [55, 100], [0, 100]]] },
  C: { w: 76, p: () => [arc(50, 50, 50, 42, 318, 30).concat(arc(50, 50, 29, 318, 42, 24))] },
  P: { w: 66, p: () => [[[0, 0], [36, 0]].concat(arc(36, 31, 31, -90, 90, 16), [[36, 62], [21, 62], [21, 100], [0, 100]]), [[21, 19], [34, 19]].concat(arc(34, 31, 12, -90, 90, 10), [[34, 43], [21, 43]])] },
  R: { w: 68, p: () => [[[0, 0], [36, 0]].concat(arc(36, 30, 30, -90, 80, 16), [[68, 100], [45, 100], [28, 62], [21, 62], [21, 100], [0, 100]]), [[21, 18], [34, 18]].concat(arc(34, 30, 12, -90, 90, 10), [[34, 42], [21, 42]])] },
  I: { w: 44, lock: true },
};

// 片名排版（单位：像素，原点 = 片名框左上）
// 返回每个字母的 {ch, x, y, h, rot, seed}；THE 小、VELVET/CIPHER 大且错落
export function titleLayout(H = 250) {
  const out = []; const k = H / 100, sp = 12 * k;
  const put = (str, x0, y0, h, rots, dys, seed0) => {
    let x = x0; const kk = h / 100;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], G = GLYPH[ch];
      out.push({ ch, x, y: y0 + (dys[i] || 0) * kk, h, rot: (rots[i] || 0) * D, seed: seed0 + i, w: G.w * kk });
      x += G.w * kk + sp * h / H;
    }
    return x;
  };
  put('THE', 0, 0, H * .36, [-2, 1, -1], [0, -3, 2], 500);
  const wV = put('VELVET', 0, H * .46, H, [-1.5, 1, -.5, 2, -1, .8], [0, -6, 4, -2, 6, -4], 510);
  put('CIPHER', H * .9, H * .46 + H * 1.12, H, [1, 0, -1.2, .6, -2, 1.4], [-4, 0, 5, -3, 2, -5], 520);
  return out;
}
export function titleBox(H = 250) {
  const L = titleLayout(H); let x1 = 0, y1 = 0;
  for (const l of L) { x1 = Math.max(x1, l.x + l.w); y1 = Math.max(y1, l.y + l.h); }
  return { w: x1, h: y1, L };
}

// 画一个字母（x,y = 左上）。lock 字母：黑板 + 红钥匙孔（keyFill 0..1：钥匙已放入）
export function drawGlyph(l, col = C.ink, opt = {}) {
  const G = GLYPH[l.ch], k = l.h / 100;
  g.save(); g.translate(l.x + l.w / 2, l.y + l.h / 2); g.rotate(l.rot); g.translate(-l.w / 2, -l.h / 2);
  if (G.lock) {
    const plate = roughC('lockplate' + l.h.toFixed(0), () => [[0, 0], [G.w * k, 1 * k], [G.w * k - 1 * k, 100 * k], [1 * k, 100 * k]], l.seed, 1.4, 10);
    piece(plate, col, { gap: opt.gap });
    const kh = l.h * .62 / 154;   // 钥匙孔高 ≈ 62% 字高
    g.save(); g.translate(G.w * k / 2, l.h * .2 + 31 * kh);
    g.scale(kh, kh);
    piece(roughC('khT', () => keyholeP(1), 301, .7, 6), opt.holeCol || C.red, { gap: 0, shadow: false });
    g.restore();
    l.keyhole = { x: l.x + l.w / 2, y: l.y + l.h * .2 + 31 * kh, s: kh };  // 局部近似（不含旋转）
  } else {
    const all = G.p().map((p, j) => roughC('tg' + l.ch + l.seed + j + l.h.toFixed(0), () => p.map(([x, y]) => [x * k, y * k]), l.seed * 3 + j, 1.2 + l.h * .004, 8));
    piece(all, col, { gap: opt.gap });
  }
  g.restore();
}

// 整个片名：split = 沿斜线错开的距离（0 = 合拢）。斜线角度与开场劈刀一致（与竖直成 30°）
export const CUT_ANG = 30 * D;
export function drawTitle(x, y, H, opt = {}) {
  const { L, w, h } = titleBox(H);
  const split = opt.split || 0;
  const cx = x + (opt.cutX ?? w * .5), cy = y + (opt.cutY ?? h * .55);
  const dir = [Math.sin(CUT_ANG), -Math.cos(CUT_ANG)];      // 切线方向（向右上）
  const halves = split > .01 ? [0, 1] : [-1];
  for (const side of halves) {
    g.save();
    if (side >= 0) {
      // 半平面裁切
      const n = [dir[1], -dir[0]]; const sgn = side ? 1 : -1, big = 4000;
      g.beginPath();
      g.moveTo(cx - dir[0] * big, cy - dir[1] * big); g.lineTo(cx + dir[0] * big, cy + dir[1] * big);
      g.lineTo(cx + dir[0] * big + n[0] * big * sgn, cy + dir[1] * big + n[1] * big * sgn);
      g.lineTo(cx - dir[0] * big + n[0] * big * sgn, cy - dir[1] * big + n[1] * big * sgn);
      g.closePath(); g.clip();
      const o = split * (side ? 1 : -1) / 2;
      g.translate(dir[0] * o, dir[1] * o);
    }
    for (const l of L) {
      const ll = { ...l, x: x + l.x, y: y + l.y };
      if (opt.each) { const e = opt.each(ll); if (e?.hide) continue; if (e) Object.assign(ll, e); }
      drawGlyph(ll, opt.col || C.ink, opt);
      if (GLYPH[l.ch].lock) opt.onLock?.(ll);
    }
    g.restore();
  }
  return { L, w, h };
}
