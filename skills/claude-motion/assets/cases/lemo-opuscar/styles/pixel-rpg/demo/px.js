// px.js — 索引色像素引擎：320×180 帧缓冲存调色板索引，色深 / 褪色 / 塌缩 / 回涨都是换查找表（像 SNES 的 CGRAM）
export const W = 320, H = 180, SCALE = 6;
export const T = 255;                      // 透明

// —— 主调色板：ENDESGA-32（0–31）+ 保护色（32+，褪色表不动它们）——
const HEX = [
  '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
  '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
  '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
  '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569',
  // 32 围巾红 33 围巾暗 34 围巾高光   35 水晶青 36 水晶蓝 37 水晶白 38 水晶深
  '#e43b44', '#a22633', '#f6757a', '#2ce8f5', '#0099db', '#ffffff', '#124e89',
];
export const C = {
  rust: 0, clay: 1, sand: 2, tan: 3, brown: 4, dbrown: 5, umber: 6, crimson: 7, red: 8, orange: 9, amber: 10, yellow: 11,
  lime: 12, green: 13, dgreen: 14, teal: 15, navy: 16, blue: 17, cyan: 18, white: 19, silver: 20, steel: 21, slate: 22,
  dslate: 23, night: 24, ink: 25, hot: 26, plum: 27, rose: 28, pink: 29, skin: 30, skinS: 31,
  scarf: 32, scarfD: 33, scarfL: 34, xc: 35, xb: 36, xw: 37, xd: 38,
};
export const NPAL = HEX.length;
export const PROTECT = new Set([32, 33, 34, 35, 36, 37, 38]);
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const RGB = HEX.map(rgb);
const lum = ([r, g, b]) => .299 * r + .587 * g + .114 * b;
const pack = ([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r;

// 查找表 = Uint32Array(256)：索引 → ABGR
function lutFrom(fn) { const L = new Uint32Array(256); for (let i = 0; i < NPAL; i++) L[i] = pack(fn(i)); return L; }
function nearest(c, set) {
  let best = set[0], bd = 1e9;
  for (const s of set) { const d = (c[0] - s[0]) ** 2 * .3 + (c[1] - s[1]) ** 2 * .59 + (c[2] - s[2]) ** 2 * .11; if (d < bd) { bd = d; best = s; } }
  return best;
}
// 按亮度分位映射到一条色带（保证层次不丢）
function rampMap(ramp, keep) {
  const Ls = RGB.map(lum), sorted = [...Ls].sort((a, b) => a - b);
  return lutFrom(i => {
    if (keep && PROTECT.has(i)) return RGB[i];
    const q = sorted.indexOf(Ls[i]) / (sorted.length - 1);
    return rgb(ramp[Math.min(ramp.length - 1, Math.floor(q * ramp.length))]);
  });
}

export const LUT = {};
LUT.full = lutFrom(i => RGB[i]);
// 现在：失去之后的褪色世界——7 阶蓝灰，只有围巾与水晶保留颜色
export const FADED_RAMP = ['#0e0d17', '#1d2031', '#2d3349', '#434c66', '#646e8a', '#8f99b0', '#c3c9d6'];
const fadedIdx = i => Math.min(6, Math.floor(Math.pow(lum(RGB[i]) / 255, .8) * 7.2));
LUT.faded = lutFrom(i => PROTECT.has(i) ? RGB[i] : rgb(FADED_RAMP[fadedIdx(i)]));
// 最早的回忆：4 色单色（偏橄榄的老掌机色，自定色值）
export const GB4 = ['#1f2a1c', '#4b5e3a', '#93a263', '#d6dba6'];
// 4 色按固定亮度阈值分级：画 4 色场景时用 GBI[0..3]（ink/slate/steel/white）即可精确落在每一级
LUT.gb4 = lutFrom(i => { const l = lum(RGB[i]); return rgb(GB4[l < 60 ? 0 : l < 115 ? 1 : l < 175 ? 2 : 3]); });
export const GBI = [25, 22, 21, 19];
// 8-bit：13 色受限调色板（自定，接近早期主机的"少而饱和"）
export const NES = ['#000000', '#fcfcfc', '#a4a4b8', '#58587c', '#1c2c8c', '#3c7cfc', '#94e0fc', '#b8141c', '#fc7454', '#fcb81c', '#8c4c1c', '#2c9c2c', '#fcd8a8', '#0c4c18', '#4c2410'];
const NESr = NES.map(rgb);
LUT.nes = lutFrom(i => nearest(RGB[i], NESr));
LUT.nesKeep = lutFrom(i => PROTECT.has(i) ? RGB[i] : nearest(RGB[i], NESr));
// 塌缩的中间级：16 色、8 色、4 色（从主调色板里取子集）
const SUB16 = [25, 24, 23, 22, 21, 19, 16, 17, 7, 8, 9, 10, 11, 27, 28, 5].map(i => RGB[i]);
const SUB8 = [25, 23, 21, 19, 7, 9, 11, 27].map(i => RGB[i]);
LUT.c16 = lutFrom(i => PROTECT.has(i) ? RGB[i] : nearest(RGB[i], SUB16));
LUT.c8 = lutFrom(i => PROTECT.has(i) ? RGB[i] : nearest(RGB[i], SUB8));
LUT.c4 = rampMap(['#16152a', '#3a3f60', '#7c86a8', '#c9cfe4'], true);
LUT.c2 = rampMap(['#1b1d2c', '#565f77'], true);
// 淡入淡出：整体压暗 n 级（调色板步进，而不是 alpha）
export function darken(L, f) {   // f 0..1，按 4 级量化
  const q = Math.round(f * 4) / 4, O = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const v = L[i]; if (!v) continue;
    const r = v & 255, g = v >> 8 & 255, b = v >> 16 & 255;
    O[i] = pack([r * (1 - q) | 0, g * (1 - q) | 0, b * (1 - q) | 0]);
  }
  return O;
}
export function whiten(L, f) {
  const q = Math.round(f * 4) / 4, O = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const v = L[i]; if (!v) continue;
    const r = v & 255, g = v >> 8 & 255, b = v >> 16 & 255;
    O[i] = pack([r + (255 - r) * q | 0, g + (255 - g) * q | 0, b + (255 - b) * q | 0]);
  }
  return O;
}

// —— 4×4 Bayer ——
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + .5) / 16;
const B8 = (() => { const m = new Float32Array(64);
  const base = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  for (let i = 0; i < 64; i++) m[i] = (base[i] + .5) / 64; return m; })();
export const bayer8 = (x, y) => B8[(y & 7) * 8 + (x & 7)];

export function hash(x, y = 0, z = 0) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const eo = t => 1 - (1 - t) * (1 - t);
export const eio = t => t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

// —— 帧缓冲 ——
export class FB {
  constructor(w = W, h = H) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.clip = [0, 0, w, h]; }
  clear(c = 0) { this.d.fill(c); }
  px(x, y, c) { x |= 0; y |= 0; const [cx, cy, cw, ch] = this.clip; if (x < cx || y < cy || x >= cw || y >= ch || c === T) return; this.d[y * this.w + x] = c; }
  get(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T; return this.d[y * this.w + x]; }
  rect(x, y, w, h, c) { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); }
  hline(x0, x1, y, c) { for (let x = Math.round(x0); x <= Math.round(x1); x++) this.px(x, y, c); }
  vline(x, y0, y1, c) { for (let y = Math.round(y0); y <= Math.round(y1); y++) this.px(x, y, c); }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  disc(cx, cy, r, c) { for (let y = Math.floor(-r); y <= r; y++) for (let x = Math.floor(-r); x <= r; x++) if (x * x + y * y <= r * r + r * .8) this.px(cx + x, cy + y, c); }
  // 抖动填充：f(x,y) 返回 0..1，按 Bayer 在 a/b 两色之间取
  dither(x0, y0, w, h, f, a, b) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = x0 + x, Y = y0 + y; this.px(X, Y, bayer(X, Y) < f(X, Y) ? b : a); } }
  // 竖向多色抖动渐变
  gradV(x0, y0, w, h, cols) {
    const n = cols.length - 1;
    for (let y = 0; y < h; y++) {
      const v = y / Math.max(1, h - 1) * n, b = Math.min(n - 1, Math.floor(v)), f = v - b;
      for (let x = 0; x < w; x++) this.px(x0 + x, y0 + y, cols[bayer(x0 + x, y0 + y) < f ? b + 1 : b]);
    }
  }
  blit(src, dx, dy, flip = false, map = null) {   // src: {w,h,d}
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      let c = src.d[y * src.w + (flip ? src.w - 1 - x : x)]; if (c === T) continue;
      if (map) { c = map[c]; if (c === undefined || c === T) continue; }
      this.px(dx + x, dy + y, c);
    }
  }
  copy(src, sx, sy, sw, sh, dx, dy) { for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const c = src.get(sx + x, sy + y); if (c !== T) this.px(dx + x, dy + y, c); } }
}
export function sprFromRows(rows, map) {       // 字符串精灵 → {w,h,d}
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), d = new Uint8Array(w * h).fill(T);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.' || ch === ' ') continue; const c = map[ch]; if (c === undefined) throw new Error('sprite char ' + ch); d[y * w + x] = c; } });
  return { w, h, d };
}

// —— 输出：索引 → RGB（可选两张表 + 逐像素选择：回涨 / 塌缩的抖动过渡）→ ×6 最近邻 ——
export function makeOut(canvas) {
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H;
  const g = lo.getContext('2d'); const img = g.createImageData(W, H); const u32 = new Uint32Array(img.data.buffer);
  const o = canvas.getContext('2d'); o.imageSmoothingEnabled = false;
  return {
    lo, u32,
    present(fb, lut, lutB = null, pick = null) {
      const d = fb.d;
      if (!lutB) for (let i = 0; i < d.length; i++) u32[i] = lut[d[i]];
      else for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) u32[i] = (pick(x, y) ? lutB : lut)[d[i]];
      g.putImageData(img, 0, 0);
    },
    post(fn) { fn(u32); g.putImageData(img, 0, 0); },   // RGB 级后处理（马赛克、旋涡）
    show() { o.drawImage(lo, 0, 0, W * SCALE, H * SCALE); },
  };
}
// RGB 级马赛克：块 n，块取左上角颜色（对齐到屏幕中心）
export function mosaic(u32, n) {
  if (n <= 1) return; const src = u32.slice();
  const ox = (W / 2) % n, oy = (H / 2) % n;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bx = Math.max(0, Math.floor((x - ox) / n) * n + ox), by = Math.max(0, Math.floor((y - oy) / n) * n + oy);
    u32[y * W + x] = src[Math.min(H - 1, by) * W + Math.min(W - 1, bx)];
  }
}
