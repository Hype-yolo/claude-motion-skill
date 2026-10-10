// 字符网格引擎：VT323 字形图集 + 按格子贴字。
// 约定：场景画布用 'lighter' 叠加，R 通道 = 琥珀磷光强度，G 通道 = 地球蓝强度（crt.js 负责上色）。
// 格子：宽 cw，高 ch = 2cw（VT323 的 advance = 0.4em，字形竖向 0.8em），字号 fs = cw / 0.4。
export const W = 1920, H = 1080;
export const FONT = 'VT323';
const GS = 160;                 // 图集字号
const GW = GS * .4, GH = GS * .8, BASE = GS * .64;   // 图集格 64×128，基线 102.4
const PAD = 4;                  // 图集格子之间留边，缩放采样不串色
const CHARS = [];
for (let c = 32; c < 127; c++) CHARS.push(String.fromCharCode(c));
CHARS.push('\u00d7');   // 片尾卡的 ×
export const COLS_ATLAS = 16;

export let ATLAS = null;        // { red, green, alpha:Uint8 per glyph, cov:{ch:coverage} }

export async function initTerm() {
  await document.fonts.load(`${GS}px ${FONT}`);
  const rows = Math.ceil(CHARS.length / COLS_ATLAS);
  const aw = COLS_ATLAS * (GW + PAD * 2), ah = rows * (GH + PAD * 2);
  const white = document.createElement('canvas'); white.width = aw; white.height = ah;
  const g = white.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.font = `${GS}px ${FONT}`; g.textBaseline = 'alphabetic';
  g.lineJoin = 'round'; g.lineWidth = 2.2;      // 电子束的一点点扩散：字形略微变胖、边缘变圆
  const pos = {};
  CHARS.forEach((ch, i) => {
    const x = (i % COLS_ATLAS) * (GW + PAD * 2) + PAD, y = Math.floor(i / COLS_ATLAS) * (GH + PAD * 2) + PAD;
    pos[ch] = [x, y];
    g.save(); g.beginPath(); g.rect(x, y, GW, GH); g.clip();
    g.fillText(ch, x, y + BASE); g.strokeText(ch, x, y + BASE);
    g.restore();
  });
  // 覆盖率 + 每个字形的 alpha 位图（分形推进时在字形内部取样用）
  const cov = {}, bits = {};
  const d = g.getImageData(0, 0, aw, ah).data;
  for (const ch of CHARS) {
    const [x, y] = pos[ch]; let s = 0; const b = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const a = d[((y + j) * aw + x + i) * 4 + 3]; b[j * GW + i] = a; s += a; }
    cov[ch] = s / 255 / (GW * GH); bits[ch] = b;
  }
  // 不加描边的细字形位图：分形推进时按它取样，笔画间的空隙更清楚
  const thin = {};
  { const c2 = document.createElement('canvas'); c2.width = GW; c2.height = GH; const x2 = c2.getContext('2d', { willReadFrequently: true });
    x2.font = `${GS}px ${FONT}`; x2.fillStyle = '#fff';
    for (const ch of CHARS) { x2.clearRect(0, 0, GW, GH); x2.fillText(ch, 0, BASE); const dd = x2.getImageData(0, 0, GW, GH).data; const b = new Uint8Array(GW * GH); for (let k = 0; k < GW * GH; k++) b[k] = dd[k * 4 + 3]; thin[ch] = b; } }
  const tint = col => { const c = document.createElement('canvas'); c.width = aw; c.height = ah; const x = c.getContext('2d');
    x.drawImage(white, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, aw, ah); return c; };
  ATLAS = { red: tint('#ff0000'), green: tint('#00ff00'), black: tint('#000000'), white, pos, cov, bits, thin, GW, GH };
  return ATLAS;
}

// 贴一个字：左上角 (x,y)，格宽 cw；a = 亮度 0..1+；chan 0 = 琥珀，1 = 地球蓝
export function glyph(g, ch, x, y, cw, a = 1, chan = 0) {
  if (ch === ' ' || a <= 0.004) return;
  const p = ATLAS.pos[ch]; if (!p) return;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(chan ? ATLAS.green : ATLAS.red, p[0], p[1], GW, GH, x, y, cw, cw * 2);
  if (a > 1) { g.globalAlpha = Math.min(1, a - 1); g.drawImage(chan ? ATLAS.green : ATLAS.red, p[0], p[1], GW, GH, x, y, cw, cw * 2); }
}
// 一行字（从第 col 列、第 row 行开始），view = {ox, oy, cw}
export function text(g, str, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  for (let i = 0; i < str.length; i++) glyph(g, str[i], ox + (col + i) * cw, oy + row * cw * 2, cw, a, chan);
}
// 反白：实心块 + 挖掉字形
export function inverse(g, str, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  const x = ox + col * cw, y = oy + row * cw * 2;
  g.globalAlpha = Math.min(1, a); g.fillStyle = chan ? '#00ff00' : '#ff0000';
  g.fillRect(x, y + cw * .1, str.length * cw, cw * 1.8);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;   // 场景画布是不透明黑底，挖字 = 盖黑字
  for (let i = 0; i < str.length; i++) { const p = ATLAS.pos[str[i]]; if (p && str[i] !== ' ') g.drawImage(ATLAS.black, p[0], p[1], GW, GH, x + i * cw, y, cw, cw * 2); }
  g.globalCompositeOperation = 'lighter';
}
// 块状光标
export function cursor(g, col, row, view, a = 1, chan = 0) {
  const { ox, oy, cw } = view;
  g.globalAlpha = Math.min(1, a); g.fillStyle = chan ? '#00ff00' : '#ff0000';
  g.fillRect(ox + col * cw + cw * .06, oy + row * cw * 2 + cw * .22, cw * .88, cw * 1.56);
}

// 密度表：给一组字符按实测墨量排序，乘以亮度属性（dim/normal/bold）→ 级别表
export function makeRamp(chars, attrs = [.42, .7, 1]) {
  const set = [...new Set(chars.split(''))].filter(c => c !== ' ');
  const mx = Math.max(...set.map(c => ATLAS.cov[c]));
  const lv = [{ ch: ' ', a: 0, v: 0 }];
  for (const c of set) for (const a of attrs) lv.push({ ch: c, a, v: ATLAS.cov[c] / mx * a });
  lv.sort((p, q) => p.v - q.v);
  // 去掉亮度几乎重复的级别（保留更"粗"的字）
  const out = [lv[0]];
  for (const l of lv.slice(1)) { if (l.v - out[out.length - 1].v > .018) out.push(l); else if (l.a > out[out.length - 1].a) out[out.length - 1] = l; }
  return out;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);
// 亮度 L(0..1) → 级别（带 4×4 有序抖动）
export function pick(ramp, L, i, j, dither = .6) {
  const n = ramp.length - 1;
  let hsh = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; hsh -= Math.floor(hsh);
  const x = L * n + (BAYER[(j & 3) * 4 + (i & 3)] * .5 + (hsh - .5) * .5) * dither * 1.6;
  const k = Math.max(0, Math.min(n, Math.round(x)));
  return ramp[k];
}

// 图像 → 格子：art 是一张 cols*sx × rows*sy 的画布（R = 琥珀亮度，G = 地球亮度），按格取平均
export function cellsFromImage(data, aw, cols, rows, sx, sy) {
  const A = new Float32Array(cols * rows), E = new Float32Array(cols * rows), N = new Float32Array(cols * rows);
  const n = sx * sy * 255;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let r = 0, gg = 0, bb = 0;
    for (let v = 0; v < sy; v++) { let o = ((j * sy + v) * aw + i * sx) * 4; for (let u = 0; u < sx; u++, o += 4) { r += data[o]; gg += data[o + 1]; bb += data[o + 2]; } }
    A[j * cols + i] = r / n; E[j * cols + i] = gg / n; N[j * cols + i] = bb / n;
  }
  return { A, E, N, cols, rows };
}
