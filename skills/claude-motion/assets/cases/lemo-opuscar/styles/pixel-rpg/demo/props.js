// props.js — 存档水晶（程序化旋转八面体，平面着色量化到保护青色阶）、石台、光晕、最终之门
import { C, T, bayer, hash } from './px.js';

// —— 水晶：frame 0..7 覆盖 90°（四重对称），返回 {w,h,d} ——
const XR = [C.xd, C.xb, C.xc, C.xw];
export function crystalSprite(phase, h = 11, r = 6) {
  const w = r * 2 + 3, H = h * 2 + 3, d = new Uint8Array(w * H).fill(T), zb = new Float32Array(w * H).fill(-1e9);
  const cx = (w - 1) / 2, cy = (H - 1) / 2, tilt = .28;
  const a0 = phase * Math.PI / 2;
  // 顶点（x 右、y 下、z 朝向观众）
  const V = [[0, -h, 0], [0, h, 0]];
  for (let k = 0; k < 4; k++) { const a = a0 + k * Math.PI / 2; V.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
  const P = V.map(([x, y, z]) => { const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt); return [x, y2, z2]; });
  const faces = []; for (let k = 0; k < 4; k++) { const a = 2 + k, b = 2 + (k + 1) % 4; faces.push([0, a, b], [1, b, a]); }
  const Ld = [-.5, -.7, .5]; const ln = Math.hypot(...Ld); Ld.forEach((v, i) => Ld[i] = v / ln);
  for (const [i, j, k] of faces) {
    const A = P[i], B = P[j], Cc = P[k];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const nl = Math.hypot(...n); n = n.map(q => q / nl);
    if (n[2] < 0) n = n.map(q => -q);
    const lit = n[0] * Ld[0] + n[1] * Ld[1] + n[2] * Ld[2];
    const tone = lit > .72 ? 3 : lit > .35 ? 2 : lit > 0 ? 1 : 0;
    // 光栅化三角形
    const xs = [A[0], B[0], Cc[0]], ys = [A[1], B[1], Cc[1]];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x, py = y;
      const w0 = (B[0] - A[0]) * (py - A[1]) - (B[1] - A[1]) * (px - A[0]), w1 = (Cc[0] - B[0]) * (py - B[1]) - (Cc[1] - B[1]) * (px - B[0]), w2 = (A[0] - Cc[0]) * (py - Cc[1]) - (A[1] - Cc[1]) * (px - Cc[0]);
      if (!((w0 >= -.5 && w1 >= -.5 && w2 >= -.5) || (w0 <= .5 && w1 <= .5 && w2 <= .5))) continue;
      const X = Math.round(cx + px), Y = Math.round(cy + py); if (X < 0 || Y < 0 || X >= w || Y >= H) continue;
      const z = (A[2] + B[2] + Cc[2]) / 3; if (z < zb[Y * w + X]) continue; zb[Y * w + X] = z; d[Y * w + X] = XR[tone];
    }
  }
  // 描边 + 闪光
  const o = d.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) { if (d[y * w + x] !== T) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < H && d[Y * w + X] !== T) { o[y * w + x] = C.xd; break; } } }
  const gx = Math.round(cx - 2), gy = Math.round(cy - h * .45); if (o[gy * w + gx] !== T) o[gy * w + gx] = C.xw;
  return { w, h: H, d: o };
}
const xcache = new Map();
export function crystal(frame) { const f = ((frame % 8) + 8) % 8; if (!xcache.has(f)) xcache.set(f, crystalSprite(f / 8)); return xcache.get(f); }

// 光晕：以 (cx,cy) 为中心的有序抖动环（保护青，褪色世界里依然发光）
export function halo(fb, cx, cy, R, k = 1, cols = [C.xd, C.xb]) {
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const d = Math.hypot(x, y * 1.15) / R; if (d > 1) continue;
    const f = (1 - d) * (1 - d) * k;
    const X = cx + x, Y = cy + y, b = bayer(X, Y);
    if (b < f * .9) fb.px(X, Y, b < f * .35 ? cols[1] : cols[0]);
  }
}
// 石台
export function pedestal(fb, cx, by) {
  const rows = [
    '...kkkkkkkkkkkkkk...',
    '..kssssssssssssssk..',
    '..kSSSSSSSSSSSSSSk..',
    '...kdddddddddddk....',
    '....kSSxSSSSxSSk....',
    '....kSSSSxxSSSSk....',
    '....kSSSSSSSSSdk....',
    '....kSSSSSSSSSdk....',
    '...kssssssssssssk...',
    '..kSSSSSSSSSSSSSSk..',
    '..kddddddddddddddk..',
  ];
  const map = { k: C.ink, s: C.silver, S: C.steel, d: C.slate, x: C.xb };
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = r[x]; if (c === '.') continue; fb.px(cx - 10 + x, by - rows.length + y, map[c]); } });
}

// —— 最终之门（正面）：x0 为门框左上，W×H，open 0..1 ——
// 结构：两根方柱 + 拱券（楔石、拱心石）+ 扇形浮雕门楣 + 两扇嵌板石门（斜面、铁钉、门环）+ 跨两扇的符文圆环
export function door(fb, x0, y0, W, H, open = 0, t = 0, glowK = 1) {
  const pil = Math.max(10, Math.round(W * .14)), cx = x0 + W / 2;
  const innerX0 = x0 + pil, innerX1 = x0 + W - pil, archR = (innerX1 - innerX0) / 2;
  const archY = y0 + archR + 9;                     // 拱的圆心 = 门扇顶
  const base = y0 + H;
  // 墙体砌块（整个区域先铺）
  for (let y = y0; y < base; y++) for (let x = x0; x < x0 + W; x++) {
    const row = Math.floor((y - y0) / 8), off = row % 2 ? 6 : 0, ly = (y - y0) % 8;
    const mort = ly === 7 || (x - x0 + off) % 12 === 0;
    let c = mort ? C.night : (ly === 0 ? C.slate : C.dslate);
    if (!mort && hash(Math.floor((x - x0 + off) / 12), row, 7) < .18) c = C.night;
    fb.px(x, y, c);
  }
  // 方柱
  for (const [px0, side] of [[x0, -1], [x0 + W - pil, 1]]) {
    for (let y = y0 + 4; y < base; y++) for (let x = px0; x < px0 + pil; x++) {
      const u = (x - px0) / (pil - 1);
      let c = u < .12 ? C.steel : u > .85 ? C.night : C.slate;
      if (Math.abs(u - .35) < .07 || Math.abs(u - .62) < .07) c = C.dslate;   // 竖槽
      if (Math.abs(u - .42) < .05) c = C.steel;
      fb.px(x, y, c);
    }
    for (const yy of [archY - 4, base - 8]) { fb.rect(px0 - 1, yy, pil + 2, 5, C.slate); fb.rect(px0 - 1, yy, pil + 2, 1, C.silver); fb.rect(px0 - 1, yy + 4, pil + 2, 1, C.ink); }
  }
  // 拱内扇形浮雕（门楣）
  for (let y = Math.floor(archY - archR); y < archY; y++) for (let x = innerX0; x < innerX1; x++) {
    const dx = x + .5 - cx, dy = archY - y, r = Math.hypot(dx, dy); if (r >= archR) continue;
    const a = Math.atan2(dy, dx), ray = Math.floor(a / (Math.PI / 11));
    const edge = Math.abs(a / (Math.PI / 11) - Math.round(a / (Math.PI / 11))) < .09;
    let c = edge ? C.night : ray % 2 ? C.dslate : C.slate;
    if (r < archR * .28) c = r < archR * .22 ? (r < archR * .12 ? C.hot : C.crimson) : C.ink;
    if (r > archR - 2) c = C.ink;
    fb.px(x, y, c);
  }
  // 拱券楔石
  for (let a = 0; a <= 180; a += .5) {
    const rad = a * Math.PI / 180;
    for (let rr = archR; rr < archR + 7; rr++) {
      const x = Math.round(cx - .5 - Math.cos(rad) * rr), y = Math.round(archY - Math.sin(rad) * rr);
      const seg = Math.floor(a / 15);
      fb.px(x, y, (a % 15 < .8) ? C.night : rr === Math.ceil(archR) ? C.ink : rr >= archR + 6 ? C.night : rr === Math.ceil(archR) + 1 ? C.steel : (seg % 2 ? C.slate : C.steel));
    }
  }
  const ky = Math.round(archY - archR - 9);
  for (let y = 0; y < 13; y++) for (let x = -6 + Math.floor(y / 3); x <= 6 - Math.floor(y / 3); x++) fb.px(Math.round(cx - .5) + x, ky + y, y === 0 || Math.abs(x) === 6 - Math.floor(y / 3) || y === 12 ? C.ink : y < 3 ? C.silver : C.steel);
  // 门扇 / 开门的光
  const gap = open * archR;
  const leafTop = archY;
  for (let y = leafTop; y < base - 8; y++) for (let x = innerX0; x < innerX1; x++) {
    const dx = Math.abs(x + .5 - cx);
    if (open > 0 && dx < gap + .5) { const f = 1 - dx / (gap + 2); fb.px(x, y, bayer(x, y) < f * 1.8 ? C.white : bayer(x, y) < f * 3 ? C.yellow : C.amber); continue; }
    const leafW = archR - gap, lx = x < cx ? (x + .5 - innerX0) : (innerX1 - x - .5), u = lx / leafW;   // 0 = 铰链侧
    const v = y - leafTop, pH = 28, pv = v % pH, prow = Math.floor(v / pH);
    // 嵌板：左右各留边框
    const inPanel = u > .14 && u < .86 && pv > 4 && pv < pH - 1;
    let c = C.dslate;
    if (inPanel) {
      const pu0 = .14, pu1 = .86;
      if (pv === 5 || u < pu0 + .06) c = x < cx ? C.night : C.steel;        // 斜面：光从左上
      else if (pv === pH - 2 || u > pu1 - .06) c = x < cx ? C.steel : C.night;
      else c = bayer(x, y) < .18 ? C.night : C.dslate;
    } else {
      c = pv === 0 ? C.slate : (pv === 1 ? C.night : C.slate);
      if ((u < .06 || u > .94)) c = C.night;
    }
    if (!inPanel && (pv === 2) && Math.abs((u * 8) % 1 - .5) < .12) c = C.silver;   // 铁钉
    if (dx < gap + 1.5 && open === 0) c = dx < 1 ? C.ink : C.night;          // 中缝
    fb.px(x, y, c);
  }
  // 门槛
  fb.rect(innerX0 - 2, base - 8, innerX1 - innerX0 + 4, 3, C.steel); fb.rect(innerX0 - 2, base - 8, innerX1 - innerX0 + 4, 1, C.silver); fb.rect(innerX0 - 2, base - 5, innerX1 - innerX0 + 4, 5, C.slate);
  // 门环（中缝两侧）
  const ry = Math.round(leafTop + (base - leafTop) * .62);
  for (const sgn of [-1, 1]) {
    const rx = Math.round(cx - .5 + sgn * (4 + gap));
    if (open > 0 && Math.abs(rx - cx) < gap) continue;
    for (let a = 0; a < 6.283; a += .2) fb.px(Math.round(rx + Math.cos(a) * 3), Math.round(ry + 3 + Math.sin(a) * 3), C.steel);
    fb.rect(rx - 1, ry - 2, 3, 3, C.slate); fb.px(rx, ry - 1, C.silver);
  }
  // 符文圆环（跨两扇，开门时随门扇分开）
  const ey = Math.round(leafTop + (base - leafTop) * .38), er = Math.max(8, Math.round(archR * .42));
  for (let y = -er - 2; y <= er + 2; y++) for (let x = -er - 2; x <= er + 2; x++) {
    const d = Math.hypot(x + .5, y); if (d > er + 1.5 || d < er - 3.5) continue;
    const X = Math.round(cx - .5 + x + (x < 0 ? -gap : gap)), Y = ey + y;
    if (open > 0 && Math.abs(X + .5 - cx) < gap + .5) continue;
    fb.px(X, Y, d > er + .5 ? C.ink : d > er - .5 ? C.silver : d > er - 2.5 ? C.slate : C.ink);
  }
  const pulse = (.6 + .4 * Math.sin(t * 2.4)) * glowK;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + Math.PI / 8, X = Math.round(cx - .5 + Math.cos(a) * (er - 1.5)), Y = Math.round(ey + Math.sin(a) * (er - 1.5));
    const sx = X + (Math.cos(a) < 0 ? -gap : gap); if (open > 0 && Math.abs(sx + .5 - cx) < gap + .5) continue;
    fb.px(sx, Y, pulse > .55 ? C.hot : C.crimson);
  }
}
