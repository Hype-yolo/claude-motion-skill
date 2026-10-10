// 皮影"刻皮"工具：每一片驴皮 = 一张预渲染的透射率贴图（颜色 = 透过的光色；镂空 = 透明；墨线 = 近黑）
// 画到透射率画布上时用 multiply，重叠的皮片自然更暗。坐标单位 = 1920×1080 幕布上的 1 px（机位 1×）。
export const SS = 3;                 // 贴图每单位像素数（特写 2.8× 时仍清晰）
export const DYE = {
  red: '#b8211a', crim: '#8e1813', orange: '#d9541c', yellow: '#dc9d1e', gold: '#c98a26',
  green: '#236e3a', jade: '#2f8a5c', teal: '#22647e', blue: '#2a5690', hide: '#e2bd80', hide2: '#cf9f5e',
  ink: '#1a100a', brown: '#6b3a1c', white: '#f4ead2', skin: '#efcf98'
};
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d')]; }

// 平滑闭合路径（过中点的二次曲线）
export function smooth(g, pts, closed = true) {
  const n = pts.length; if (n < 2) return;
  if (!closed) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    g.lineTo(pts[n - 1][0], pts[n - 1][1]); return;
  }
  const m = i => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const s = m(0); g.moveTo(s[0], s[1]);
  for (let i = 1; i <= n; i++) { const p = pts[i % n], q = m(i); g.quadraticCurveTo(p[0], p[1], q[0], q[1]); }
  g.closePath();
}
// 折线闭合（尖角，用于锯齿、刀刻感的边）
export function poly(g, pts, closed = true) { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (closed) g.closePath(); }

// 一片皮：box = [x0,y0,x1,y1]（单位，相对枢轴），draw(g) 在单位坐标里画，枢轴在原点
export function piece(box, draw, opt = {}) {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0, K = opt.ss || SS;
  const [c, g] = canvas(w * K, h * K);
  g.setTransform(K, 0, 0, K, -x0 * K, -y0 * K); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g);
  if (opt.tex !== false) hideTexture(c, g, opt.seed || 0);
  return { c, x0, y0, w, h };
}
// 驴皮质感：半透明皮子的疏密斑驳 + 纤维 + 手染不匀；乘上去后用原 alpha 还原镂空
let HIDE = null;
function hideCanvas() {
  if (HIDE) return HIDE;
  const N = 512, [c, g] = canvas(N, N), id = g.createImageData(N, N), d = id.data;
  const h = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const w = (a, b) => h(((a % 64) + 64) % 64, ((b % 64) + 64) % 64);   // 64 格周期 → 可平铺
    return (w(i, j) * (1 - u) + w(i + 1, j) * u) * (1 - v) + (w(i, j + 1) * (1 - u) + w(i + 1, j + 1) * u) * v; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const f = vn(x / 64, y / 64) * .5 + vn(x / 32, y / 32) * .3 + vn(x / 8, y / 8) * .2;
    const sp = h(x, y) > .985 ? .8 : 1;
    const v = (.8 + .22 * f) * sp, i = (y * N + x) * 4;
    d[i] = Math.min(255, v * 255); d[i + 1] = Math.min(255, v * 250); d[i + 2] = Math.min(255, v * 238); d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.globalAlpha = .1; g.strokeStyle = '#6a4a2a'; g.lineWidth = .8;
  for (let k = 0; k < 900; k++) { const x = h(k, 1) * N, y = h(k, 2) * N, a = h(k, 3) * 6.28, l = 6 + h(k, 4) * 18; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + 3, y + Math.sin(a) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  HIDE = c; return c;
}
export function hideTexture(c, g, seed) {
  const [m, mg] = canvas(c.width, c.height); mg.drawImage(c, 0, 0);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const pat = g.createPattern(hideCanvas(), 'repeat'); pat.setTransform(new DOMMatrix([1, 0, 0, 1, (seed * 137) % 512, (seed * 71) % 512]));
  g.globalCompositeOperation = 'multiply'; g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(m, 0, 0);
  g.restore();
}
export function drawPiece(g, p) { g.drawImage(p.c, p.x0, p.y0, p.w, p.h); }

// —— 刻皮基本操作 ——
export function fill(g, col, pathFn, rule = 'evenodd') { g.beginPath(); pathFn(g); g.fillStyle = col; g.fill(rule); }
export function cut(g, pathFn, rule = 'evenodd') {       // 镂空：destination-out，先设不透明黑（fillStyle 的 alpha 决定挖多少）
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000';
  g.beginPath(); pathFn(g); g.fill(rule); g.restore();
}
export function cutLine(g, w, pathFn) {  // 刻一条细缝
  g.save(); g.globalCompositeOperation = 'destination-out'; g.strokeStyle = '#000'; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pathFn(g); g.stroke(); g.restore();
}
export function ink(g, w, pathFn, col = DYE.ink) { g.beginPath(); pathFn(g); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
// 把当前内容裁在 pathFn 内（atop 绘制用）
export function within(g, pathFn, fn) { g.save(); g.beginPath(); pathFn(g); g.clip('evenodd'); fn(); g.restore(); }

// —— 纹样库（都在调用处的 clip 范围内使用）——
// 鱼鳞甲：一排排小月牙缝
export function scales(g, x0, y0, x1, y1, r = 7, w = 1.3) {
  let row = 0;
  for (let y = y0; y < y1 + r; y += r * 1.05, row++) {
    for (let x = x0 - r + (row % 2) * r; x < x1 + r; x += r * 2) {
      cutLine(g, w, q => { q.arc(x, y, r * .9, .15 * Math.PI, .85 * Math.PI); });
    }
  }
}
// 云头卷：螺旋细缝 + 泪滴孔
export function cloud(g, x, y, r, rot = 0, w = 1.4, flip = 1) {
  cutLine(g, w, q => {
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2.2, rr = r * (1 - i / 40 * .78);
      const px = x + Math.cos(rot + a * flip) * rr, py = y + Math.sin(rot + a * flip) * rr;
      if (i === 0) q.moveTo(px, py); else q.lineTo(px, py);
    }
  });
  cut(g, q => { q.arc(x + Math.cos(rot + Math.PI * 2.2 * flip) * r * .2, y + Math.sin(rot + Math.PI * 2.2 * flip) * r * .2, r * .16, 0, Math.PI * 2); });
}
// 联珠：一串小圆孔
export function beads(g, pts, r) { cut(g, q => { for (const [x, y] of pts) { q.moveTo(x + r, y); q.arc(x, y, r, 0, Math.PI * 2); } }); }
export function beadLine(g, x0, y0, x1, y1, r, gap) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / gap)), pts = [];
  for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
  beads(g, pts, r);
}
// 梅花：五瓣小圆孔
export function plum(g, x, y, r) { const pts = []; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } beads(g, pts, r * .62); }
// 水波纹：一排平行弧缝
export function waves(g, x0, y0, x1, y1, r = 8, w = 1.3) {
  for (let y = y0, row = 0; y < y1; y += r * .9, row++)
    for (let x = x0 + (row % 2) * r; x < x1 + r; x += r * 2)
      cutLine(g, w, q => { q.arc(x, y, r, 1.1 * Math.PI, 1.9 * Math.PI); });
}
// 回纹（方折线）
export function meander(g, x0, y, x1, s = 6, w = 1.2) {
  cutLine(g, w, q => {
    q.moveTo(x0, y);
    for (let x = x0; x < x1 - s * 2; x += s * 2) { q.lineTo(x, y - s); q.lineTo(x + s * 1.4, y - s); q.lineTo(x + s * 1.4, y - s * .3); q.lineTo(x + s * .7, y - s * .3); q.lineTo(x + s * .7, y); q.lineTo(x + s * 2, y); }
  });
}
// 铆钉：深色小圈 + 浅色线结（画在透射率画布上，世界坐标）
export function rivet(g, x, y, r = 3.4) {
  g.save(); g.globalCompositeOperation = 'multiply';
  g.beginPath(); g.arc(x, y, r * .74, 0, Math.PI * 2); g.strokeStyle = '#2e1c10'; g.lineWidth = r * .52; g.stroke();
  g.beginPath(); g.arc(x, y, r * .48, 0, Math.PI * 2); g.fillStyle = '#b58a5e'; g.fill();
  g.restore();
}

// —— 加密镂空纹样（大面积透光，只留细皮筋）——
// 开口鱼鳞：每片鳞刻成一个厚月牙孔
export function scalesOpen(g, x0, y0, x1, y1, r = 7) {
  cut(g, q => {
    let row = 0;
    for (let y = y0; y < y1 + r; y += r * .95, row++)
      for (let x = x0 - r + (row % 2) * r; x < x1 + r; x += r * 2) {
        q.moveTo(x + Math.cos(.08 * Math.PI) * r * .86, y + Math.sin(.08 * Math.PI) * r * .86);
        q.arc(x, y, r * .86, .08 * Math.PI, .92 * Math.PI);
        q.arc(x, y - r * .18, r * .5, .88 * Math.PI, .12 * Math.PI, true); q.closePath();
      }
  }, 'nonzero');
}
// 菱形格（锦纹）
export function lattice(g, x0, y0, x1, y1, s = 10, w = 2.2) {
  cut(g, q => {
    let row = 0;
    for (let y = y0; y < y1 + s; y += s / 2, row++)
      for (let x = x0 + (row % 2) * s / 2; x < x1 + s; x += s) {
        const h = s / 2 - w; q.moveTo(x, y - h * .9); q.lineTo(x + h, y); q.lineTo(x, y + h * .9); q.lineTo(x - h, y); q.closePath();
      }
  }, 'nonzero');
}
// 古钱纹：圆孔里留方形皮
export function coin(g, x, y, r) { cut(g, q => { q.arc(x, y, r, 0, Math.PI * 2); q.rect(x - r * .38, y - r * .38, r * .76, r * .76); }, 'evenodd'); }
// 厚条纹（地层 / 山纹）：沿曲线 fn(x)+k*gap 刻出宽缝
export function strata(g, x0, x1, fn, n, gap, w) {
  for (let k = 1; k <= n; k++) cutLine(g, w, q => { for (let x = x0; x <= x1; x += 8) { const y = fn(x) + k * gap; if (x === x0) q.moveTo(x, y); else q.lineTo(x, y); } });
}

// 火舌（传统火焰纹）：宽根、腹部鼓起、尖端向一侧卷成小钩。局部坐标：根在 (0,0)，向 -y 生长，高 h、宽 w，dir=±1 卷向
export function flameTongue(q, h, w, dir = 1) {
  const d = dir;
  q.moveTo(-w / 2, 0);
  q.bezierCurveTo(-w * .75, -h * .3, -w * .25 * d - w * .1, -h * .55, w * .15 * d, -h * .82);
  q.bezierCurveTo(w * .3 * d, -h * .95, w * .55 * d, -h * 1.02, w * .62 * d, -h * .9);      // 钩尖
  q.bezierCurveTo(w * .52 * d, -h * .93, w * .38 * d, -h * .88, w * .36 * d, -h * .76);
  q.bezierCurveTo(w * .55, -h * .5, w * .62, -h * .22, w / 2, 0);
  q.closePath();
}
// 锥形裂缝：沿折线刻出中间宽两头尖的缝
export function cutTaper(g, pts, w) {
  if (pts.length < 2) return;
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const k = Math.sin(Math.PI * (i / (n - 1))) * .9 + .1, ww = w * k / 2;
    L.push([pts[i][0] - dy / l * ww, pts[i][1] + dx / l * ww]); R.push([pts[i][0] + dy / l * ww, pts[i][1] - dx / l * ww]);
  }
  cut(g, q => { q.moveTo(...L[0]); for (const p of L) q.lineTo(...p); for (let i = n - 1; i >= 0; i--) q.lineTo(...R[i]); q.closePath(); }, 'nonzero');
}
