// engine.js — Dark Tech Keynote 绘制引擎（可复用：场景只调用这里的函数）
// 暗色近黑渐变底 + 细线网格 + 柔光 + 圆角 UI 面板 + 唯一强调色；光扫揭幕、乱码滚数字、吸附飞行、条带透视、2.5D 摄影机。
import { clamp, lerp, seg, ss, eo, ei, eio, back, spring, mulberry, hash, TAU } from '../../../core/lib.js';
export { clamp, lerp, seg, ss, eo, ei, eio, back, spring, mulberry, hash, TAU };

export const W = 1920, H = 1080;
export const PAL = {
  bg0: '#0A0B0F', bg1: '#151822', surf: '#12151C', surf2: '#1A1E28', surf3: '#222734',
  line: 'rgba(255,255,255,.08)', hi: 'rgba(255,255,255,.10)',
  text: '#E8EAF0', dim: '#8A90A0', mute: '#5C6272',
  accent: '#B7F34A', red: '#FF5A5F', cool: '#3B4CCA',
};
export const FONT = { ui: 'Inter', disp: 'InterTight', mono: 'JBMono' };
/** 换品牌强调色（唯一彩色）。例：setAccent('#D97757') */
export function setAccent(hex) { PAL.accent = hex; }
export const font = (px, wt = 500, fam = 'ui') => `${wt} ${px}px ${FONT[fam] || fam}`;
export function rgba(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
export function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = s => Math.round(lerp(a >> s & 255, b >> s & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// ───────────────────────── 画布工具 ─────────────────────────
const _pool = {};
/** 取一张离屏画布（按名字复用） */
export function buf(name, w = W, h = H) {
  let c = _pool[name];
  if (!c || c.width !== w || c.height !== h) { c = _pool[name] = document.createElement('canvas'); c.width = w; c.height = h; }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  return [c, g];
}
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }

// ───────────────────────── 背景 / 网格 / 光晕 ─────────────────────────
/** 近黑渐变底 + 冷光斑 + 暗角。o.lift 顶部提亮，o.cool 冷光强度，o.dark 整体压暗 0..1 */
export function bg(g, o = {}) {
  const { lift = 1, cool = 1, dark = 0, cx = W * 0.5, cy = H * 0.34 } = o;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = PAL.bg0; g.fillRect(0, 0, W, H);
  let gr = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
  gr.addColorStop(0, rgba(PAL.bg1, 0.95 * lift)); gr.addColorStop(1, rgba(PAL.bg0, 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (cool > 0) glow(g, W * 0.78, H * 0.12, 900, PAL.cool, 0.08 * cool);
  if (dark > 0) { g.fillStyle = `rgba(4,5,7,${dark})`; g.fillRect(0, 0, W, H); }
  g.restore();
}
/** 柔和径向光晕 */
export function glow(g, x, y, r, color, a) {
  if (a <= 0 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.45, rgba(color, a * 0.35)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
/** 细线网格：屏幕空间，ox/oy/scale 让它跟着摄影机走。module 世界单位 */
export function grid(g, o = {}) {
  const { ox = 0, oy = 0, scale = 1, module = 48, alpha = 1, major = 4, rect = [0, 0, W, H], color = '255,255,255' } = o;
  const step = module * scale; if (step < 4 || alpha <= 0) return;
  const [rx, ry, rw, rh] = rect;
  g.save(); g.beginPath(); g.rect(rx, ry, rw, rh); g.clip(); g.lineWidth = 1;
  const i0 = Math.floor((rx - ox) / step), i1 = Math.ceil((rx + rw - ox) / step);
  const j0 = Math.floor((ry - oy) / step), j1 = Math.ceil((ry + rh - oy) / step);
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = `rgba(${color},${(pass ? 0.06 : 0.032) * alpha})`; g.beginPath();
    for (let i = i0; i <= i1; i++) { if ((i % major === 0) !== !!pass) continue; const x = Math.round(ox + i * step) + 0.5; g.moveTo(x, ry); g.lineTo(x, ry + rh); }
    for (let j = j0; j <= j1; j++) { if ((j % major === 0) !== !!pass) continue; const y = Math.round(oy + j * step) + 0.5; g.moveTo(rx, y); g.lineTo(rx + rw, y); }
    g.stroke();
  }
  g.restore();
}
export function vignette(g, a = 0.55) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

// ───────────────────────── 面板 / 任意形状 ─────────────────────────
/** 圆角 UI 面板：柔影 + 顶亮渐变 + 1px 描边 + 顶边内高光。o.cheap 用廉价阴影（大量元素时） */
export function panel(g, x, y, w, h, o = {}) {
  const { r = 14, fill = PAL.surf, fill2 = null, stroke = PAL.line, shadow = 1, cheap = false, hi = 1, alpha = 1 } = o;
  g.save(); g.globalAlpha *= alpha;
  if (shadow > 0) {
    if (cheap) { g.fillStyle = `rgba(0,0,0,${0.35 * shadow})`; rr(g, x + 2, y + h * 0.06 + 4, w, h, r); g.fill(); }
    else { g.shadowColor = `rgba(0,0,0,${0.55 * shadow})`; g.shadowBlur = Math.min(90, 18 + h * 0.18); g.shadowOffsetY = Math.min(40, 6 + h * 0.06); g.fillStyle = fill; rr(g, x, y, w, h, r); g.fill(); g.shadowColor = 'transparent'; }
  }
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, fill2 || mix(fill.startsWith('#') ? fill : '#12151C', '#2A3040', 0.25)); gr.addColorStop(Math.min(1, 60 / Math.max(h, 1)), fill); gr.addColorStop(1, fill);
  g.fillStyle = gr; rr(g, x, y, w, h, r); g.fill();
  g.lineWidth = 1; g.strokeStyle = stroke; rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r); g.stroke();
  if (hi > 0) { g.strokeStyle = `rgba(255,255,255,${0.07 * hi})`; g.beginPath(); g.moveTo(x + r, y + 1.5); g.lineTo(x + w - r, y + 1.5); g.stroke(); }
  g.restore();
}
/**
 * 用本风格画任意形状（Path2D）：外发光 + 顶亮渐变填充 + 1px 边缘光 + 可选光扫高光。
 * o.accent=true → 强调色实心发光（"唯一彩色"）；o.color 指定别的颜色；o.sweep 0..1 光带位置；o.glow 发光半径
 */
export function litShape(g, path, o = {}) {
  const { accent = false, color = null, glowR = accent ? 28 : 0, alpha = 1, sweep = null, bbox = [0, 0, W, H], stroke = true } = o;
  const [bx, by, bw, bh] = bbox; const c = color || (accent ? PAL.accent : null);
  g.save(); g.globalAlpha *= alpha;
  if (c) {
    if (glowR > 0) { g.shadowColor = rgba(c, 0.75); g.shadowBlur = glowR; }
    g.fillStyle = c; g.fill(path); g.shadowColor = 'transparent';
    const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fill(path);
  } else {
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
    const gr = g.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, '#262B38'); gr.addColorStop(0.35, PAL.surf2); gr.addColorStop(1, PAL.surf);
    g.fillStyle = gr; g.fill(path); g.shadowColor = 'transparent';
  }
  if (stroke) { g.lineWidth = 1; g.strokeStyle = c ? rgba('#ffffff', 0.35) : 'rgba(255,255,255,.12)'; g.stroke(path); }
  if (sweep != null) {
    g.save(); g.clip(path);
    const d = Math.hypot(bw, bh), sx = bx - d * 0.3 + sweep * d * 1.6;
    const gr = g.createLinearGradient(sx - 120, by, sx + 120, by + bh * 0.4);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(bx, by, bw, bh); g.restore();
  }
  g.restore();
}
/** 四角光点（四角星）路径：r 外半径，k 腰部收缩 0..1 */
export function sparklePath(cx, cy, r, k = 0.18, rot = 0) {
  const p = new Path2D();
  for (let i = 0; i < 4; i++) {
    const a = rot + i * TAU / 4, b = a + TAU / 8, a2 = a + TAU / 4;
    const P = [cx + Math.cos(a) * r, cy + Math.sin(a) * r], Q = [cx + Math.cos(a2) * r, cy + Math.sin(a2) * r];
    const C = [cx + Math.cos(b) * r * k, cy + Math.sin(b) * r * k];
    if (i === 0) p.moveTo(...P);
    p.quadraticCurveTo(C[0], C[1], Q[0], Q[1]);
  }
  p.closePath(); return p;
}
/** 光标尾巴：沿一串点画渐隐的光带，末端可接一根光标。pts=[[x,y],...] 从旧到新 */
export function trail(g, pts, o = {}) {
  const { color = PAL.accent, width = 6, alpha = 1, caretH = 0 } = o;
  if (pts.length < 2) return;
  g.save(); g.lineCap = 'butt'; g.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const u = i / (pts.length - 1);
    g.strokeStyle = rgba(color, alpha * u * u * 0.9); g.lineWidth = width * (0.25 + 0.75 * u);
    g.shadowColor = rgba(color, 0.6 * u * alpha); g.shadowBlur = 18 * u;
    g.beginPath(); g.moveTo(...pts[i - 1]); g.lineTo(...pts[i]); g.stroke();
  }
  g.restore();
  if (caretH > 0) { const [x, y] = pts[pts.length - 1]; caret(g, x, y, caretH, { color, alpha }); }
}

// ───────────────────────── 光标 / 品牌 ─────────────────────────
/** 光标：中心锚点。o.sx/o.sy 挤压拉伸，o.on 亮度（眨眼），o.glow 光晕倍率 */
export function caret(g, x, y, h, o = {}) {
  const { sx = 1, sy = 1, on = 1, glow: gl = 1, color = PAL.accent, alpha = 1, wr = 1 / 14 } = o;
  if (on <= 0.001 || alpha <= 0) return;
  const w = Math.max(2, h * wr) * sx, hh = h * sy;
  g.save(); g.globalAlpha *= alpha * on;
  if (gl > 0) { glow(g, x, y, hh * 0.9 * gl, color, 0.22 * gl); g.shadowColor = rgba(color, 0.9); g.shadowBlur = hh * 0.22 * gl; }
  g.fillStyle = color; rr(g, x - w / 2, y - hh / 2, w, hh, Math.min(w / 2, 4 + h * 0.01)); g.fill();
  g.shadowColor = 'transparent'; g.restore();
}
/** Tidy 标志：圆角方块 + 一根强调色光标 */
export function tidyMark(g, x, y, s, o = {}) {
  const { alpha = 1, on = 1 } = o;
  g.save(); g.globalAlpha *= alpha;
  panel(g, x - s / 2, y - s / 2, s, s, { r: s * 0.28, fill: PAL.surf3, shadow: 0.6 });
  caret(g, x, y, s * 0.52, { on, glow: 0.6, wr: 1 / 6.5 });
  g.restore();
}
/** 文字标 "Tidy" + 光标，(x,y) 为基线起点；返回宽度 */
export function wordmark(g, x, y, px, o = {}) {
  const { alpha = 1, on = 1, color = PAL.text } = o;
  g.save(); g.globalAlpha *= alpha; g.font = font(px, 600); g.fillStyle = color; g.textBaseline = 'alphabetic';
  if (g.letterSpacing !== undefined) g.letterSpacing = `${-0.03 * px}px`;
  g.fillText('Tidy', x, y); const w = g.measureText('Tidy').width;
  if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
  caret(g, x + w + px * 0.14, y - px * 0.36, px * 0.86, { on, wr: 1 / 11 });
  g.restore(); return w + px * 0.2;
}

// ───────────────────────── UI 元件（混乱段的素材） ─────────────────────────
const APPS = [
  { c: '#5B7CFA', g: 'bubble' }, { c: '#8C6CF0', g: 'cal' }, { c: '#2FB6A6', g: 'bell' }, { c: '#E0A33A', g: 'star' },
  { c: '#4C9BE8', g: 'mail' }, { c: '#D0668A', g: 'heart' }, { c: '#6E7890', g: 'gear' },
];
export function appIcon(g, x, y, s, k) {
  const a = APPS[((k % APPS.length) + APPS.length) % APPS.length];
  const gr = g.createLinearGradient(0, y, 0, y + s); gr.addColorStop(0, mix(a.c, '#ffffff', 0.15)); gr.addColorStop(1, mix(a.c, '#000000', 0.25));
  g.fillStyle = gr; rr(g, x, y, s, s, s * 0.26); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.92)'; g.fillStyle = 'rgba(255,255,255,.92)'; g.lineWidth = Math.max(1, s * 0.08); g.lineCap = 'round';
  const cx = x + s / 2, cy = y + s / 2, u = s * 0.22;
  g.beginPath();
  switch (a.g) {
    case 'bubble': g.ellipse(cx, cy - u * 0.1, u * 1.2, u * 0.9, 0, 0, TAU); g.fill(); break;
    case 'cal': g.rect(cx - u, cy - u * 0.8, u * 2, u * 1.8); g.stroke(); g.beginPath(); g.moveTo(cx - u, cy - u * 0.2); g.lineTo(cx + u, cy - u * 0.2); g.stroke(); break;
    case 'bell': g.arc(cx, cy, u, Math.PI, 0); g.lineTo(cx + u * 1.2, cy + u * 0.7); g.lineTo(cx - u * 1.2, cy + u * 0.7); g.closePath(); g.fill(); break;
    case 'star': for (let i = 0; i < 10; i++) { const r = i % 2 ? u * 0.5 : u * 1.2, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); } g.closePath(); g.fill(); break;
    case 'mail': g.rect(cx - u * 1.2, cy - u * 0.8, u * 2.4, u * 1.6); g.moveTo(cx - u * 1.2, cy - u * 0.8); g.lineTo(cx, cy + u * 0.1); g.lineTo(cx + u * 1.2, cy - u * 0.8); g.stroke(); break;
    case 'heart': g.moveTo(cx, cy + u); g.bezierCurveTo(cx - u * 2, cy - u * 0.2, cx - u * 0.6, cy - u * 1.5, cx, cy - u * 0.4); g.bezierCurveTo(cx + u * 0.6, cy - u * 1.5, cx + u * 2, cy - u * 0.2, cx, cy + u); g.fill(); break;
    default: g.arc(cx, cy, u, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, u * 0.35, 0, TAU); g.fill();
  }
}
/** 红色计数角标（中心锚点） */
export function badge(g, x, y, text, s = 1) {
  g.save(); g.font = font(13 * s, 700); const w = Math.max(20 * s, g.measureText(text).width + 12 * s), h = 20 * s;
  g.fillStyle = PAL.red; g.shadowColor = rgba(PAL.red, 0.5); g.shadowBlur = 8 * s; rr(g, x - w / 2, y - h / 2, w, h, h / 2); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y + 0.5 * s); g.restore();
}
/** 通知卡（左上锚点） */
export function notif(g, x, y, w, h, o = {}) {
  const { app = 0, title = 'Reminder', body = 'You have 3 unread messages', time = 'now', cheap = true, badge: bd = null, alpha = 1 } = o;
  g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, w, h, { r: h * 0.24, fill: '#1A1E28', cheap, shadow: 1 });
  const s = h * 0.46; appIcon(g, x + h * 0.22, y + (h - s) / 2, s, app);
  const tx = x + h * 0.22 + s + h * 0.18;
  g.textBaseline = 'alphabetic'; g.fillStyle = PAL.text; g.font = font(h * 0.2, 600); g.fillText(title, tx, y + h * 0.42);
  g.fillStyle = PAL.dim; g.font = font(h * 0.18, 400); g.fillText(body, tx, y + h * 0.7);
  g.fillStyle = PAL.mute; g.font = font(h * 0.15, 500); g.textAlign = 'right'; g.fillText(time, x + w - h * 0.2, y + h * 0.38);
  if (bd) badge(g, x + h * 0.22 + s, y + (h - s) / 2, bd, h / 76);
  g.restore();
}
/** 文件图标（中心锚点，s = 1 时 44×56 + 文件名） */
export function fileIcon(g, x, y, s, o = {}) {
  const { name = 'Untitled.txt', ext = 'TXT', tint = '#8A90A0', cheap = true, label = true } = o;
  const w = 44 * s, h = 56 * s, x0 = x - w / 2, y0 = y - h / 2 - 8 * s, f = 12 * s;
  g.save();
  if (cheap) { g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x0 + 2 * s, y0 + 4 * s, w, h, 5 * s); g.fill(); }
  const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#E9ECF3'); gr.addColorStop(1, '#B9BFCC');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0 + 5 * s, y0); g.lineTo(x0 + w - f, y0); g.lineTo(x0 + w, y0 + f); g.lineTo(x0 + w, y0 + h - 5 * s);
  g.quadraticCurveTo(x0 + w, y0 + h, x0 + w - 5 * s, y0 + h); g.lineTo(x0 + 5 * s, y0 + h); g.quadraticCurveTo(x0, y0 + h, x0, y0 + h - 5 * s); g.lineTo(x0, y0 + 5 * s); g.quadraticCurveTo(x0, y0, x0 + 5 * s, y0); g.fill();
  g.fillStyle = '#9EA5B4'; g.beginPath(); g.moveTo(x0 + w - f, y0); g.lineTo(x0 + w - f, y0 + f); g.lineTo(x0 + w, y0 + f); g.fill();
  g.fillStyle = tint; rr(g, x0 + 5 * s, y0 + h - 19 * s, w - 10 * s, 12 * s, 3 * s); g.fill();
  g.fillStyle = '#fff'; g.font = font(8 * s, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ext, x, y0 + h - 13 * s);
  g.fillStyle = 'rgba(40,46,60,.28)'; for (let i = 0; i < 3; i++) g.fillRect(x0 + 8 * s, y0 + (14 + i * 6) * s, (w - 18 * s) * (i === 2 ? 0.6 : 1), 2 * s);
  if (label) { g.font = font(9 * s, 500, 'mono'); g.fillStyle = PAL.text; g.textBaseline = 'top'; g.fillText(name.length > 16 ? name.slice(0, 15) + '…' : name, x, y0 + h + 5 * s); }
  g.restore();
}
/** 程序化风景照片（左上锚点） */
const SKY = [['#F7B267', '#F4845F', '#7D4E88'], ['#8EC5FC', '#A7C7E7', '#E0C3FC'], ['#2B3A67', '#496A81', '#F2A65A'], ['#9BE3DE', '#BEEBE9', '#F4DADA'], ['#FFD194', '#D1913C', '#5C3D2E'], ['#3A1C71', '#D76D77', '#FFAF7B']];
export function photo(g, x, y, w, h, seed = 1, o = {}) {
  const { border = true, cheap = true, r = Math.min(w, h) * 0.06 } = o;
  const R = mulberry(seed * 7919 + 13), sky = SKY[Math.floor(R() * SKY.length)];
  g.save();
  if (cheap) { g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, x + 3, y + 6, w, h, r); g.fill(); }
  rr(g, x, y, w, h, r); g.clip();
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, sky[0]); gr.addColorStop(0.6, sky[1]); gr.addColorStop(1, sky[2]);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,250,235,.85)'; g.beginPath(); g.arc(x + w * (0.2 + R() * 0.6), y + h * (0.25 + R() * 0.25), h * (0.07 + R() * 0.06), 0, TAU); g.fill();
  for (let L = 0; L < 3; L++) {
    const base = y + h * (0.55 + L * 0.15); g.fillStyle = `rgba(${20 + L * 8},${24 + L * 6},${40 - L * 6},${0.35 + L * 0.25})`;
    g.beginPath(); g.moveTo(x, y + h); let px = x; g.lineTo(x, base);
    while (px < x + w) { px += w * (0.08 + R() * 0.16); g.lineTo(Math.min(px, x + w), base - h * (R() * 0.22)); }
    g.lineTo(x + w, y + h); g.fill();
  }
  g.restore();
  if (border) { g.save(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r); g.stroke(); g.restore(); }
}
/** 窗口（左上锚点）：标题栏 40px（小图标 + 标题，无系统按钮），返回内容区矩形 */
export function windowBox(g, x, y, w, h, o = {}) {
  const { title = 'Untitled', app = 6, cheap = false, alpha = 1, r = 14, bar = 40 } = o;
  g.save(); g.globalAlpha *= alpha;
  panel(g, x, y, w, h, { r, fill: PAL.surf, cheap, shadow: 1 });
  g.fillStyle = 'rgba(255,255,255,.025)'; rr(g, x + 1, y + 1, w - 2, bar, r); g.fill();
  g.fillStyle = PAL.line; g.fillRect(x, y + bar, w, 1);
  appIcon(g, x + 14, y + bar / 2 - 9, 18, app);
  g.fillStyle = PAL.dim; g.font = font(14, 500); g.textBaseline = 'middle'; g.fillText(title, x + 42, y + bar / 2 + 0.5);
  g.restore();
  return [x, y + bar + 1, w, h - bar - 1];
}
/** 窗口内容：kind = note | inbox | browser | sheet | chat | viewer | code */
export function windowContent(g, rect, kind, o = {}) {
  const [x, y, w, h] = rect, { seed = 1, n = 6, scroll = 0, text = '', tabs = 6, unread = 0 } = o;
  const R = mulberry(seed * 131 + 7);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (kind === 'inbox') {
    const rh = 46; const off = scroll % rh;
    for (let i = -1; i < h / rh + 1; i++) {
      const yy = y + i * rh - off + 8, k = i + Math.floor(scroll / rh);
      if (hash(k * 3.1 + seed) < 0.6 || k < unread) { g.fillStyle = '#5B8CFF'; g.beginPath(); g.arc(x + 16, yy + 16, 4, 0, TAU); g.fill(); }
      g.fillStyle = PAL.text; g.font = font(13, 600); g.textBaseline = 'alphabetic';
      g.fillText(['Weekly digest', 'Re: Re: Fwd: final deck', 'Your order shipped', 'Invoice #2291', 'Team sync moved', 'Don’t miss this', 'Security alert', 'Photos from Sat'][(k % 8 + 8) % 8], x + 30, yy + 20);
      g.fillStyle = PAL.mute; g.fillRect(x + 30, yy + 28, w * (0.4 + hash(k * 1.7) * 0.4), 5);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 12, yy + rh - 8, w - 24, 1);
    }
  } else if (kind === 'browser') {
    const tw = (w - 16) / tabs;
    for (let i = 0; i < tabs; i++) {
      g.fillStyle = i === tabs - 1 ? PAL.surf3 : 'rgba(255,255,255,.04)'; rr(g, x + 8 + i * tw, y + 6, Math.max(1, tw - 3), 26, Math.min(7, tw / 3)); g.fill();
      if (tw > 34) { appIcon(g, x + 14 + i * tw, y + 12, 14, i + seed); }
      if (tw > 90) { g.fillStyle = PAL.dim; g.font = font(11, 500); g.textBaseline = 'middle'; g.fillText('New Tab', x + 34 + i * tw, y + 19); }
    }
    g.fillStyle = 'rgba(255,255,255,.05)'; rr(g, x + 12, y + 40, w - 24, 24, 12); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 20, y + 84 + i * 26, (w - 40) * (0.5 + R() * 0.5), 10); }
  } else if (kind === 'sheet') {
    const cw = 64, ch = 24; g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let i = 0; i <= w / cw; i++) { g.beginPath(); g.moveTo(x + i * cw + 0.5, y); g.lineTo(x + i * cw + 0.5, y + h); g.stroke(); }
    for (let j = 0; j <= h / ch; j++) { g.beginPath(); g.moveTo(x, y + j * ch + 0.5); g.lineTo(x + w, y + j * ch + 0.5); g.stroke(); }
    g.fillStyle = PAL.dim; g.font = font(11, 500, 'mono'); g.textBaseline = 'middle';
    for (let j = 0; j < h / ch; j++) for (let i = 0; i < w / cw; i++) if (R() < 0.55) g.fillText(String(Math.floor(R() * 9000 + 100)), x + i * cw + 8, y + j * ch + 12);
  } else if (kind === 'chat') {
    for (let i = 0; i < n; i++) {
      const me = R() < 0.4, bw = w * (0.35 + R() * 0.3), yy = y + 14 + i * 40;
      g.fillStyle = me ? 'rgba(91,124,250,.35)' : 'rgba(255,255,255,.07)'; rr(g, me ? x + w - bw - 14 : x + 14, yy, bw, 30, 14); g.fill();
    }
  } else if (kind === 'viewer') {
    photo(g, x + 10, y + 10, w - 20, h - 20, seed, { cheap: false });
  } else if (kind === 'code') {
    for (let i = 0; i < h / 20; i++) { const ind = Math.floor(R() * 4) * 18; g.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.08})`; g.fillRect(x + 20 + ind, y + 14 + i * 20, (w - 60 - ind) * (0.2 + R() * 0.7), 8); }
  } else if (kind === 'note') {
    g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x, y, w, h);
  }
  g.restore();
}
/** 存储条 */
export function storageBar(g, x, y, w, h, p, o = {}) {
  const { label = 'Storage almost full', value = '' } = o;
  g.save();
  g.fillStyle = 'rgba(255,255,255,.06)'; rr(g, x, y, w, h, h / 2); g.fill();
  const c = p > 0.85 ? PAL.red : mix('#8A90A0', PAL.red, clamp((p - 0.6) / 0.25));
  g.fillStyle = typeof c === 'string' ? c : PAL.red; g.shadowColor = rgba(PAL.red, p > 0.85 ? 0.6 : 0); g.shadowBlur = h;
  rr(g, x, y, w * p, h, h / 2); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = PAL.text; g.font = font(h * 1.1, 600); g.textBaseline = 'bottom'; g.fillText(label, x, y - h * 0.8);
  g.fillStyle = PAL.dim; g.font = font(h * 0.9, 500, 'mono'); g.textAlign = 'right'; g.fillText(value, x + w, y - h * 0.8);
  g.restore();
}

// ───────────────────────── 吸附网格 · 飞行 · 运动模糊 ─────────────────────────
/** 吸附网格槽位：cols×rows，tile 边长，gap 间距，原点 (x0,y0) */
export function snapGrid(cols, rows, tile, gap, x0, y0) {
  const out = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push({ i, j, x: x0 + i * (tile + gap) + tile / 2, y: y0 + j * (tile + gap) + tile / 2 });
  return out;
}
/** 贪心就近分配：items[{x,y}] → slots，返回 slot 下标数组（每个元素去最近的空位 = "吸附"） */
export function assignSlots(items, slots) {
  const pairs = [];
  items.forEach((a, i) => slots.forEach((s, j) => pairs.push([(a.x - s.x) ** 2 + (a.y - s.y) ** 2, i, j])));
  pairs.sort((p, q) => p[0] - q[0]);
  const res = new Array(items.length).fill(-1), used = new Set(); let left = items.length;
  for (const [, i, j] of pairs) { if (res[i] >= 0 || used.has(j)) continue; res[i] = j; used.add(j); if (--left === 0) break; }
  return res;
}
/** 吸附飞行：from/to = {x,y,rot,s}，p 0..1 → 位置带弹性过冲、旋转弹簧归零、morph 形态过渡 */
export function flyPose(from, to, p, o = {}) {
  const { over = 1.35 } = o; const q = back(p, over), r = spring(p * 1.2, 9, 0.42);
  return { x: lerp(from.x, to.x, q), y: lerp(from.y, to.y, q), rot: lerp(from.rot || 0, to.rot || 0, clamp(r)), s: lerp(from.s ?? 1, to.s ?? 1, eo(p)), morph: ss(seg(p, 0.15, 0.7)) };
}
/** 运动模糊：在 [p-span, p] 之间取 n 个样本各画一次（越旧越淡），draw(pSample, alpha) */
export function motionBlur(p, span, n, draw) {
  if (span <= 0 || n <= 1) { draw(p, 1); return; }
  for (let k = n - 1; k >= 0; k--) { const pk = p - span * k / (n - 1); const a = k === 0 ? 1 : 0.5 * (1 - k / n) / (n - 1) * 2.2; draw(pk, Math.min(1, a)); }
}

// ───────────────────────── 光扫揭幕 / 条带透视 ─────────────────────────
/**
 * 光扫揭幕：把 src 画到 (dx,dy,dw,dh)。p 0..1 光带位置：光扫过的地方亮起并保持，前沿一道窄高光，未扫到的地方只剩 base 亮度。
 * angle 光带方向（弧度，默认左上→右下），soft 前沿软度（像素）
 */
export function lightReveal(g, src, dx, dy, dw, dh, p, o = {}) {
  const { base = 0.07, angle = 0.62, soft = 260, band = 90, glint = 0.5, keep = 1 } = o;
  const [c, t] = buf('reveal', Math.ceil(dw), Math.ceil(dh));
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const L = Math.abs(dw * ca) + Math.abs(dh * sa);   // 沿光带法向的总长
  const front = -soft + p * (L + soft * 2);
  const cx = dw / 2, cy = dh / 2;
  const p0 = [cx - ca * L / 2, cy - sa * L / 2], at = d => [p0[0] + ca * d, p0[1] + sa * d];
  // 亮版：src × 遮罩（front 之前亮）
  t.drawImage(src, 0, 0, dw, dh);
  t.globalCompositeOperation = 'destination-in';
  const A = at(front - soft), B = at(front);
  let gr = t.createLinearGradient(A[0], A[1], B[0], B[1]);
  gr.addColorStop(0, `rgba(0,0,0,${keep})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = gr; t.fillRect(0, 0, dw, dh);
  g.save(); g.globalAlpha = base; g.drawImage(src, dx, dy, dw, dh); g.globalAlpha = 1; g.drawImage(c, dx, dy); g.restore();
  // 前沿高光：只在 src 有像素的地方
  if (glint > 0 && p > 0 && p < 1) {
    const [c2, t2] = buf('reveal2', Math.ceil(dw), Math.ceil(dh));
    t2.drawImage(src, 0, 0, dw, dh); t2.globalCompositeOperation = 'source-in';
    const A2 = at(front - band * 1.6), B2 = at(front + band * 0.4);
    const g2 = t2.createLinearGradient(A2[0], A2[1], B2[0], B2[1]);
    g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(0.7, `rgba(235,240,255,${glint})`); g2.addColorStop(1, 'rgba(255,255,255,0)');
    t2.fillStyle = g2; t2.fillRect(0, 0, dw, dh);
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(c2, dx, dy); g.restore();
  }
}
/**
 * 条带透视（绕 Y 轴转）：把 src 当成一块平板，中心在 (cx,cy)，屏幕尺寸 w×h，rotY 弧度（正 = 右边转远）。
 * 返回 map(u,v) → 屏幕坐标（u,v ∈ 0..1），方便在透视面上放高光 / 推镜头
 */
export function perspective(g, src, cx, cy, w, h, rotY, o = {}) {
  const { slices = 96, dist = 2.2, alpha = 1 } = o;
  const D = dist * w, cs = Math.cos(rotY), sn = Math.sin(rotY);
  const map = (u, v) => { const X = (u - 0.5) * w, Z = X * sn, f = D / (D + Z); return [cx + X * cs * f, cy + (v - 0.5) * h * f]; };
  g.save(); g.globalAlpha *= alpha;
  const sw = src.width / slices;
  for (let i = 0; i < slices; i++) {
    const u0 = i / slices, u1 = (i + 1) / slices;
    const [x0] = map(u0, 0.5), [x1] = map(u1, 0.5);
    const X = ((u0 + u1) / 2 - 0.5) * w, f = D / (D + X * sn), hh = h * f;
    g.drawImage(src, i * sw, 0, sw, src.height, Math.min(x0, x1) - 0.35, cy - hh / 2, Math.abs(x1 - x0) + 0.7, hh);
  }
  g.restore();
  return map;
}

// ───────────────────────── 乱码滚数字 ─────────────────────────
const GLYPH = '0123456789#%/*+=<>?$&@ABCDEFXZ';
/**
 * 乱码滚成答案：text 每个字符有自己的锁定时间 locks[i]（秒）。锁定前按 24fps 乱跳（带竖向运动模糊），锁定时向下落定（弹簧）。
 * (x,y) 为基线左端；o.align='center' 居中；o.colorOf(i) 每字颜色
 */
export function scramble(g, text, x, y, t, locks, o = {}) {
  const { px = 200, wt = 600, fam = 'disp', color = PAL.text, colorOf = null, align = 'left', tracking = -0.04, start = -1e9, fps = 24 } = o;
  g.save(); g.font = font(px, wt, fam); g.textBaseline = 'alphabetic';
  const tw = [...text].map(c => g.measureText(c).width);
  const adv = tw.map(w => w + tracking * px), total = adv.reduce((a, b) => a + b, 0) - tracking * px;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const f = Math.floor(t * fps);
  [...text].forEach((ch, i) => {
    const lk = locks[i] ?? locks[locks.length - 1], col = colorOf ? colorOf(i) : color;
    if (t < start) { cx += adv[i]; return; }
    const isDigit = /[0-9]/.test(ch);
    if (t < lk && isDigit) {
      const gch = GLYPH[Math.floor(hash(f * 13.7 + i * 91.3) * GLYPH.length)];
      g.fillStyle = col;
      for (let k = 0; k < 3; k++) { g.globalAlpha = [0.85, 0.3, 0.14][k]; g.fillText(gch, cx + (tw[i] - g.measureText(gch).width) / 2, y - k * px * 0.09); }
      g.globalAlpha = 1;
    } else if (t >= lk || !isDigit) {
      if (!isDigit && t < lk) { cx += adv[i]; return; }
      const d = t - lk, dy = d < 0.3 ? -px * 0.12 * Math.exp(-d * 14) * Math.cos(d * 40) : 0;
      g.fillStyle = col; g.globalAlpha = clamp(d * 30 + 0.4); g.fillText(ch, cx, y + dy); g.globalAlpha = 1;
    }
    cx += adv[i];
  });
  g.restore();
  return total;
}

// ───────────────────────── 字幕气泡（toast） ─────────────────────────
/** UI 说明气泡：底部居中胶囊 + 青柠说话点。a 0..1 进出场，o.dense 混乱段加深 */
export function toast(g, text, a, o = {}) {
  if (a <= 0) return;
  const { y = H - 72, px = 40, dense = 0 } = o;
  g.save(); g.font = font(px, 500);
  const tw = g.measureText(text).width, h = px * 1.9, w = tw + px * 2.4, x = W / 2 - w / 2, yy = y - h + (1 - eo(a)) * 12;
  g.globalAlpha = eo(a);
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 10;
  g.fillStyle = `rgba(12,14,19,${0.72 + 0.16 * dense})`; rr(g, x, yy, w, h, h / 2); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; rr(g, x + 0.5, yy + 0.5, w - 1, h - 1, h / 2); g.stroke();
  g.fillStyle = PAL.accent; g.shadowColor = rgba(PAL.accent, 0.8); g.shadowBlur = 10; g.beginPath(); g.arc(x + px * 0.95, yy + h / 2, px * 0.14, 0, TAU); g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = PAL.text; g.textBaseline = 'middle'; g.fillText(text, x + px * 1.5, yy + h / 2 + 1);
  g.restore();
}

// ───────────────────────── 2.5D 摄影机 ─────────────────────────
/**
 * 摄影机：看向世界点 (x,y)，zoom = 桌面平面（z=0）的放大倍数，rot 荷兰角，shake 抖动像素。
 * 世界点高度 z（离桌面朝镜头）→ 透视缩放 s = 1/(1/zoom − z)，越靠近镜头越大、移动越快（视差）。
 */
export function camera(c) {
  const { x = W / 2, y = H / 2, zoom = 1, rot = 0, sx = 0, sy = 0 } = c;
  const inv = 1 / zoom;
  const proj = (px, py, z = 0) => {
    const d = inv - z; if (d <= 0.02) return null;
    const s = 1 / d; let X = (px - x) * s, Y = (py - y) * s;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    return { x: W / 2 + X * cr - Y * sr + sx, y: H / 2 + X * sr + Y * cr + sy, s };
  };
  /** 把 ctx 变换到深度 z 的平面（之后按世界坐标画） */
  const apply = (g, z = 0) => {
    const d = inv - z, s = 1 / Math.max(d, 0.02);
    g.setTransform(1, 0, 0, 1, 0, 0); g.translate(W / 2 + sx, H / 2 + sy); g.rotate(rot); g.scale(s, s); g.translate(-x, -y);
    return s;
  };
  return { x, y, zoom, rot, sx, sy, proj, apply };
}
