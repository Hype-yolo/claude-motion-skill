// 室内道具剪纸：圆窗窗棂、蒸笼、坛罐、挂历、吊灯、桌椅、碗碟、礼盒、字条
import { TAU, mulberry } from './lib.js';
import { text, vtext } from './paper.js';
import { FONT } from './art.js';

export const cut = (x, fn) => { x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; fn(); x.restore(); };

// 圆窗：墙上开圆洞 + 冰裂纹/回纹窗棂（在墙层里画：先整面墙，再挖洞，再画窗棂）
export function roundWindow(x, cx, cy, r, bar, style = 'ice') {
  cut(x, () => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); });
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.clip();
  x.strokeStyle = x.fillStyle; x.lineWidth = bar; x.lineCap = 'square';
  if (style === 'ice') {   // 冰裂纹：随机折线网
    const R = mulberry(9), pts = [];
    for (let i = 0; i < 14; i++) { const a = R() * TAU, rr = Math.sqrt(R()) * r * .9; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    for (const p of pts) { const q = pts.map(o => [o, Math.hypot(o[0] - p[0], o[1] - p[1])]).sort((a, b) => a[1] - b[1]).slice(1, 4); for (const [o] of q) { x.beginPath(); x.moveTo(...p); x.lineTo(...o); x.stroke(); } }
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .2; const p = pts.map(o => [o, Math.hypot(o[0] - cx - Math.cos(a) * r, o[1] - cy - Math.sin(a) * r)]).sort((a, b) => a[1] - b[1])[0][0]; x.beginPath(); x.moveTo(...p); x.lineTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1); x.stroke(); }
  } else {   // 方格回纹
    const n = 6;
    for (let i = -n; i <= n; i++) { x.beginPath(); x.moveTo(cx + i * r / n * 1.1, cy - r); x.lineTo(cx + i * r / n * 1.1, cy + r); x.stroke(); x.beginPath(); x.moveTo(cx - r, cy + i * r / n * 1.1); x.lineTo(cx + r, cy + i * r / n * 1.1); x.stroke(); }
  }
  x.restore();
  x.lineWidth = bar * 2.2; x.strokeStyle = x.fillStyle; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
}

// 蒸笼叠（正视）
export function steamers(x, cx, by, w, n, col, band) {
  const h = w * .28;
  for (let i = 0; i < n; i++) {
    const y = by + i * h * .92;
    x.fillStyle = col; x.beginPath(); x.roundRect(cx - w / 2, y, w, h, h * .2); x.fill();
    x.fillStyle = band; x.fillRect(cx - w / 2, y + h * .38, w, h * .1);
    for (let k = 1; k < 8; k++) x.fillRect(cx - w / 2 + k * w / 8, y + h * .12, w * .006, h * .7);
  }
  const y = by + n * h * .92;   // 盖
  x.fillStyle = col; x.beginPath(); x.moveTo(cx - w / 2, y); x.quadraticCurveTo(cx, y + h * 1.1, cx + w / 2, y); x.closePath(); x.fill();
  x.beginPath(); x.arc(cx, y + h * .58, w * .05, 0, TAU); x.fill();
}
// 灶台
export function stove(x, cx, by, w, h, col, mouth) {
  x.fillStyle = col; x.fillRect(cx - w / 2, by, w, h); x.fillRect(cx - w * .55, by + h, w * 1.1, h * .08);
  x.fillStyle = mouth; x.beginPath(); x.moveTo(cx - w * .14, by); x.lineTo(cx - w * .14, by + h * .3); x.arc(cx, by + h * .3, w * .14, Math.PI, 0, true); x.lineTo(cx + w * .14, by); x.closePath(); x.fill();
}
// 坛罐 / 碗
export function jar(x, cx, by, w, h) {
  x.beginPath(); x.moveTo(cx - w * .3, by); x.bezierCurveTo(cx - w * .6, by + h * .3, cx - w * .55, by + h * .8, cx - w * .25, by + h * .88); x.lineTo(cx - w * .22, by + h); x.lineTo(cx + w * .22, by + h); x.lineTo(cx + w * .25, by + h * .88);
  x.bezierCurveTo(cx + w * .55, by + h * .8, cx + w * .6, by + h * .3, cx + w * .3, by); x.closePath(); x.fill();
}
export function bowl(x, cx, by, w, h) {
  x.beginPath(); x.moveTo(cx - w / 2, by + h); x.quadraticCurveTo(cx - w * .45, by + h * .1, cx - w * .15, by + h * .08); x.lineTo(cx - w * .15, by); x.lineTo(cx + w * .15, by); x.lineTo(cx + w * .15, by + h * .08); x.quadraticCurveTo(cx + w * .45, by + h * .1, cx + w / 2, by + h); x.closePath(); x.fill();
}
export function teapot(x, cx, by, s) {
  x.beginPath(); x.ellipse(cx, by + s * .4, s * .5, s * .4, 0, 0, TAU); x.fill();
  x.fillRect(cx - s * .15, by + s * .75, s * .3, s * .12); x.beginPath(); x.arc(cx, by + s * .92, s * .07, 0, TAU); x.fill();
  x.beginPath(); x.moveTo(cx + s * .4, by + s * .45); x.quadraticCurveTo(cx + s * .75, by + s * .5, cx + s * .8, by + s * .8); x.lineTo(cx + s * .72, by + s * .8); x.quadraticCurveTo(cx + s * .65, by + s * .6, cx + s * .4, by + s * .3); x.fill();
  x.lineWidth = s * .08; x.strokeStyle = x.fillStyle; x.beginPath(); x.arc(cx - s * .55, by + s * .45, s * .2, Math.PI * .4, Math.PI * 1.6); x.stroke();
}
// 吊灯（灯罩 + 灯泡 glow）
export function pendant(x, cx, cy, s, col, g) {
  x.fillStyle = col; x.fillRect(cx - s * .02, cy + s * .4, s * .04, 1);
  x.beginPath(); x.moveTo(cx - s * .08, cy + s * .4); x.lineTo(cx + s * .08, cy + s * .4); x.lineTo(cx + s * .5, cy); x.lineTo(cx - s * .5, cy); x.closePath(); x.fill();
  if (g) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy - s * .02, s * .25, s * .1, 0, 0, TAU); g.fill(); }
  else { x.save(); x.fillStyle = '#ffe2a8'; x.beginPath(); x.ellipse(cx, cy - s * .02, s * .25, s * .1, 0, 0, TAU); x.fill(); x.restore(); }
}
// 挂历
export function calendar(x, cx, cy, w, col, ink, red) {
  x.fillStyle = col; x.fillRect(cx - w / 2, cy - w * .7, w, w * 1.3);
  x.fillStyle = red; x.fillRect(cx - w / 2, cy + w * .42, w, w * .18);
  text(x, '八月', cx, cy + w * .3, w * .2, FONT.song, { fill: ink, weight: 700 });
  text(x, '十五', cx, cy - w * .1, w * .42, FONT.song, { fill: red, weight: 900 });
  text(x, '中秋', cx, cy - w * .5, w * .16, FONT.song, { fill: ink, weight: 700 });
}
// 桌（正视：桌面 + 桌腿），椅（侧视，面朝左/右）
export function table(x, cx, ty, w, h, top = .012) {
  x.fillRect(cx - w / 2, ty - top, w, top); x.fillRect(cx - w / 2 + w * .02, ty - top * 2, w * .96, top);
  x.fillRect(cx - w / 2 + w * .05, ty - h, w * .03, h); x.fillRect(cx + w / 2 - w * .08, ty - h, w * .03, h);
  x.fillRect(cx - w / 2 + w * .05, ty - h * .7, w * .9, top * .5);
}
export function chair(x, cx, by, s, dir = 1) {   // dir=1 椅背在左（人面朝右）
  const bx = cx - dir * s * .22;
  x.fillRect(bx - s * .025, by, s * .05, s * 1.0);                       // 后腿+椅背
  x.fillRect(cx + dir * s * .2 - s * .025, by, s * .05, s * .45);        // 前腿
  x.fillRect(cx - s * .26, by + s * .43, s * .52, s * .05);              // 座面
  x.fillRect(Math.min(bx, bx + dir * s * .02) - s * .02, by + s * .98, s * .09, s * .04);
  for (const k of [.62, .8]) x.fillRect(bx - s * .025, by + s * k, dir * s * .05 + (dir < 0 ? 0 : 0), s * .03);
}
// 礼盒（正视）：盒身 + 回纹金边
export function boxFront(x, cx, by, w, h, col, gold) {
  x.fillStyle = col; x.fillRect(cx - w / 2, by, w, h);
  x.strokeStyle = gold; x.lineWidth = h * .035; x.strokeRect(cx - w / 2 + h * .08, by + h * .08, w - h * .16, h * .84);
  x.lineWidth = h * .015; x.strokeRect(cx - w / 2 + h * .14, by + h * .14, w - h * .28, h * .72);
  for (const sx of [-1, 1]) for (const sy of [0, 1]) {   // 角上回纹
    const px = cx + sx * (w / 2 - h * .14), py = by + (sy ? h - h * .14 : h * .14);
    x.beginPath(); x.moveTo(px, py); x.lineTo(px - sx * h * .12, py); x.lineTo(px - sx * h * .12, py + (sy ? -1 : 1) * h * .12); x.lineTo(px - sx * h * .05, py + (sy ? -1 : 1) * h * .12); x.lineTo(px - sx * h * .05, py + (sy ? -1 : 1) * h * .05); x.stroke();
  }
}
// 快递面单 / 字条
export function label(x, cx, cy, w, h, lines, o = {}) {
  x.save(); x.translate(cx, cy); x.rotate(o.rot || 0);
  x.fillStyle = o.paper || '#f4ecd8'; x.fillRect(-w / 2, -h / 2, w, h);
  x.fillStyle = o.line || '#c0392b'; x.fillRect(-w / 2, h / 2 - h * .16, w, h * .05);
  lines.forEach(([s, dy, size], i) => text(x, s, o.align === 'left' ? -w / 2 + w * .08 : 0, dy, size, o.font || FONT.xing, { fill: o.ink || '#2a1a12', align: o.align || 'center' }));
  x.restore();
}

// 3/4 俯视的月饼（侧壁 + 压扁的顶面纹样）：faceFn(x) 画顶面（半径 r，米制，未压扁）
export function cake3q(x, cx, cy, r, faceFn, o = {}) {
  const k = o.k ?? .42, side = r * (o.side ?? .36);
  x.save(); x.translate(cx, cy);
  x.fillStyle = o.sideCol || '#8a5220';
  x.beginPath(); x.ellipse(0, -side, r * .97, r * k * .97, 0, 0, TAU); x.fill(); x.fillRect(-r * .97, -side, r * 1.94, side);
  x.fillStyle = o.sideHi || 'rgba(255,220,160,.25)'; x.fillRect(-r * .97, -side * .55, r * 1.94, side * .12);
  x.scale(1, k); faceFn(x);
  x.restore();
}
