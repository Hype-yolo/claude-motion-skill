// "家"画风（主持人舞台）：粗描边扁平卡通 + 硬边阴影。所有角色/舞台/UI 共用。
export const P = {
  ink: '#1a1030', mag: '#ff2e88', magD: '#c3136a', vio: '#6b2bd9', vioD: '#4a1aa6', deep: '#2a0f5c', night: '#170838',
  gold: '#ffc928', goldD: '#e08a00', goldL: '#fff0a0', dial: '#fff6de', dialD: '#f0dcb0',
  cyan: '#1fd1d1', cyanD: '#10a0b0', suit: '#f6f1e4', suitD: '#d9cdb6', orange: '#ff7a1a', orangeD: '#d9540a',
  skin: '#ffc9a3', skinD: '#f0a07c', hair: '#7a4128', hairD: '#552a18', blush: '#ff8a8a',
  white: '#ffffff', red: '#ff3b3b', redD: '#c41f2a', green: '#3bdc5a', greenD: '#1e9e3a', black: '#241a33',
  glass: 'rgba(170,240,255,0.16)', gray: '#8a84a3', grayD: '#5c5577',
};

// 当前画布与"屏幕线宽→局部线宽"换算：角色在 scale s 下画，线宽 = LW/s，屏幕上恒定
export const K = { g: null, s: 1, lw: 7 };
export const setCtx = g => { K.g = g; };
export const lw = (px = K.lw) => px / K.s;

// 一块"零件"：阴影色打底 → 裁剪内把形状往左上挪 sh 再填亮色（剩下右下月牙 = 硬阴影）→ 描边
export function part(path, fill, shade, o = {}) {
  const g = K.g, sh = o.sh ?? 9;
  g.save();
  g.beginPath(); path(g); g.fillStyle = shade || fill; g.fill(o.rule || 'nonzero');
  if (shade) {
    g.save(); g.clip(o.rule || 'nonzero');
    g.translate(-(o.shx ?? sh) / K.s, -(o.shy ?? sh) / K.s);
    g.beginPath(); path(g); g.fillStyle = fill; g.fill(o.rule || 'nonzero');
    g.restore();
  }
  if (o.hi) { g.save(); g.beginPath(); path(g); g.clip(); o.hi(g); g.restore(); }
  if (o.stroke !== false) { g.beginPath(); path(g); g.lineWidth = lw(o.lw); g.strokeStyle = o.stroke || P.ink; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  g.restore();
}
// 描边管子（手臂/腿）：先粗墨线再细填色线
export function tube(pts, w, fill, o = {}) {
  const g = K.g;
  const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
  g.save(); g.lineCap = o.cap || 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = o.stroke || P.ink; g.lineWidth = w + 2 * lw(o.lw); g.stroke();
  path(); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  g.restore();
}
export function line(pts, px, col = P.ink, cap = 'round') {
  const g = K.g; g.save(); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineWidth = lw(px); g.strokeStyle = col; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); g.restore();
}
export function dot(x, y, r, col) { const g = K.g; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); }
export const circ = (x, y, r) => g => g.arc(x, y, r, 0, Math.PI * 2);
export const ell = (x, y, rx, ry, rot = 0) => g => g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
export const rrect = (x, y, w, h, r) => g => { if (w < 0) { x += w; w = -w; } g.roundRect(x, y, w, h, r); };
export const poly = pts => g => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
// 平滑闭合曲线（Catmull-Rom → 贝塞尔）
export const smooth = (pts, closed = true) => g => {
  const n = pts.length, p = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  g.moveTo(p(0)[0], p(0)[1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = p(i - 1), b = p(i), c = p(i + 1), d = p(i + 2);
    g.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  if (closed) g.closePath();
};
// 两段肢体：肩点、两段长度、角度（0 = 向下，正 = 向前/右转），返回 [肩, 肘, 手]
export function limb(x, y, l1, l2, a1, a2) {
  const ex = x + Math.sin(a1) * l1, ey = y + Math.cos(a1) * l1;
  const a = a1 + a2, hx = ex + Math.sin(a) * l2, hy = ey + Math.cos(a) * l2;
  return [[x, y], [ex, ey], [hx, hy], a];
}
// 带描边的粗体字（UI、命令词）
export function outlined(g, txt, x, y, o = {}) {
  g.save();
  g.font = o.font || '80px Titan'; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'alphabetic';
  if (o.ls) g.letterSpacing = o.ls + 'px';
  g.lineJoin = 'round'; g.miterLimit = 2;
  if (o.shadow) { g.fillStyle = o.shadow; g.strokeStyle = o.shadow; g.lineWidth = o.lw || 10; const [dx, dy] = o.sd || [0, 8]; g.strokeText(txt, x + dx, y + dy); g.fillText(txt, x + dx, y + dy); }
  if (o.lw !== 0) { g.strokeStyle = o.stroke || P.ink; g.lineWidth = o.lw || 10; g.strokeText(txt, x, y); }
  g.fillStyle = o.fill || P.white; g.fillText(txt, x, y);
  g.restore();
}
