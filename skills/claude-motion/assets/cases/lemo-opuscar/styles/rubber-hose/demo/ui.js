// ui.js — 片名字、播音员字卡（字幕）、话筒图标：直接用 Canvas2D 屏幕坐标绘制
import { P } from './chars.js';

// 胖字片名：墨色外描边 + 右下投影 + 白色字面；letters 可逐字蹦（bounce(i) → 偏移像素）
export function fatTitle(g, text, cx, cy, size, { font = 'Shrikhand', bounce = null, face = P.white, shadow = P.ink, track = 0 } = {}) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `${size}px ${font}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.lineJoin = 'round';
  const ws = [...text].map(c => g.measureText(c).width + track), total = ws.reduce((a, b) => a + b, 0) - track;
  let x = cx - total / 2;
  const glyphs = [...text].map((c, i) => { const o = { c, x, dy: bounce ? bounce(i) : 0 }; x += ws[i]; return o; });
  const base = cy + size * .35;
  for (const L of glyphs) { g.fillStyle = shadow; g.strokeStyle = shadow; g.lineWidth = size * .16; g.strokeText(L.c, L.x + size * .06, base + L.dy + size * .07); g.fillText(L.c, L.x + size * .06, base + L.dy + size * .07); }
  for (const L of glyphs) { g.strokeStyle = P.ink; g.lineWidth = size * .14; g.strokeText(L.c, L.x, base + L.dy); }
  for (const L of glyphs) { g.fillStyle = face; g.fillText(L.c, L.x, base + L.dy); }
  g.restore();
}

// 30 年代丝带话筒小图标
export function mic(g, x, y, s, col = P.white) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.4; g.lineCap = 'round';
  g.beginPath(); g.roundRect(-9, -22, 18, 28, 9); g.stroke();
  for (const yy of [-15, -9, -3, 3]) { g.beginPath(); g.moveTo(-5, yy); g.lineTo(5, yy); g.stroke(); }
  g.beginPath(); g.arc(0, -8, 14, .15 * Math.PI, .85 * Math.PI); g.stroke();
  g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 16); g.moveTo(-8, 16); g.lineTo(8, 16); g.stroke();
  g.restore();
}

// 播音员字卡：黑牌 + 白色双线框 + 四角小花饰 + 话筒 + 旧式铅字小型大写
export function subPlate(g, text, cx, cy, { size = 38, alpha = 1 } = {}) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha;
  g.font = `${size}px "IM Fell English SC"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(text).width, padX = size * 1.0, micW = size * 1.05;
  const w = tw + padX * 2 + micW, h = size * 1.9, x0 = cx - w / 2, y0 = cy - h / 2;
  g.fillStyle = 'rgba(12,11,10,.92)'; g.beginPath(); g.roundRect(x0, y0, w, h, size * .22); g.fill();
  g.strokeStyle = P.paper; g.lineWidth = 2.2; g.beginPath(); g.roundRect(x0 + 7, y0 + 7, w - 14, h - 14, size * .16); g.stroke();
  g.lineWidth = 1; g.beginPath(); g.roundRect(x0 + 12, y0 + 12, w - 24, h - 24, size * .12); g.stroke();
  // 四角小花饰
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const ax = sx > 0 ? x0 + 12 : x0 + w - 12, ay = sy > 0 ? y0 + 12 : y0 + h - 12;
    g.fillStyle = P.paper; g.beginPath(); g.arc(ax + sx * 7, ay + sy * 7, 3.2, 0, 7); g.fill();
    g.lineWidth = 1.4; g.beginPath(); g.arc(ax + sx * 7, ay + sy * 7, 7.5, 0, 7); g.stroke();
  }
  mic(g, x0 + padX * .55 + micW * .45, cy + 2, size / 38 * 1.05, P.paper);
  g.fillStyle = P.paper; g.fillText(text, cx + micW / 2, cy + size * .06);
  g.restore();
  return { x0, y0, w, h };
}
