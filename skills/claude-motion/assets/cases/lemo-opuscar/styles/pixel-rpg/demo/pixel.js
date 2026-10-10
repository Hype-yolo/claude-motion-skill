// 像素基础：320×180 原生画布、ENDESGA-32 调色板、4×4 Bayer 抖动、5×7 位图字体、字符串精灵
export const W = 320, H = 180, SCALE = 6;

export const PAL = {
  rust: '#be4a2f', clay: '#d77643', sand: '#ead4aa', tan: '#e4a672', brown: '#b86f50', dbrown: '#733e39', umber: '#3e2731',
  crimson: '#a22633', red: '#e43b44', orange: '#f77622', amber: '#feae34', yellow: '#fee761',
  lime: '#63c74d', green: '#3e8948', dgreen: '#265c42', teal: '#193c3e',
  navy: '#124e89', blue: '#0099db', cyan: '#2ce8f5', white: '#ffffff',
  silver: '#c0cbdc', steel: '#8b9bb4', slate: '#5a6988', dslate: '#3a4466', night: '#262b44', ink: '#181425',
  hot: '#ff0044', plum: '#68386c', rose: '#b55088', pink: '#f6757a', skin: '#e8b796', skinS: '#c28569',
};

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + .5) / 16;

export function hash(x, y = 0) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }

export function makeCtx(canvas) {
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H;
  const g = lo.getContext('2d', { willReadFrequently: true });
  const o = canvas.getContext('2d'); o.imageSmoothingEnabled = false;
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const px = (x, y, c) => rect(x, y, 1, 1, c);
  const present = () => { o.drawImage(lo, 0, 0, W * SCALE, H * SCALE); };
  return { g, lo, o, rect, px, present };
}

// 抖动竖向渐变：cols 为从上到下的色带
export function ditherV(k, x0, y0, w, h, cols) {
  const n = cols.length - 1;
  for (let y = 0; y < h; y++) {
    const v = y / Math.max(1, h - 1) * n, b = Math.min(n - 1, Math.floor(v)), f = v - b;
    for (let x = 0; x < w; x++) k.px(x0 + x, y0 + y, cols[bayer(x0 + x, y0 + y) < f ? b + 1 : b]);
  }
}

// 字符串精灵：每个字符映射到调色板，'.' 透明；flip 水平翻转
export function sprite(k, rows, map, x0, y0, flip = false) {
  const w = rows[0].length;
  rows.forEach((r, y) => { for (let x = 0; x < w; x++) { const ch = r[x]; if (ch === '.' || ch === ' ') continue; k.px(x0 + (flip ? w - 1 - x : x), y0 + y, map[ch]); } });
}

// 5×7 位图字体（每行 5 bit）
const F = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4],
  "'": [12, 4, 8, 0, 0, 0, 0], '-': [0, 0, 0, 31, 0, 0, 0], ':': [0, 12, 12, 0, 12, 12, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  '*': [0, 4, 21, 14, 21, 4, 0], '>': [8, 12, 14, 15, 14, 12, 8], ' ': [0, 0, 0, 0, 0, 0, 0],
};
export function text(k, s, x0, y0, col, shadow) {
  let x = x0;
  for (const ch of s.toUpperCase()) {
    const gl = F[ch] || F[' '];
    for (let y = 0; y < 7; y++) for (let b = 0; b < 5; b++) if (gl[y] >> (4 - b) & 1) {
      if (shadow) k.px(x + b + 1, y0 + y + 1, shadow);
      k.px(x + b, y0 + y, col);
    }
    x += 6;
  }
  return x;
}
export const textW = s => s.length * 6 - 1;
