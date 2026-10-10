// hologram-hud · 界面层：目标框、引线标注、滚动数字、面板、画框、字幕、背景网格、故障闪烁
// 全部是 Canvas 2D 函数，参数化，确定性。颜色从 theme(hue, accent) 取。
const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

export const FONT = { ui: 'Rajdhani', mono: 'ShareTechMono' };

export function theme(hue = 190, accent = 38) {
  return {
    hue, accentHue: accent,
    line: a => `hsla(${hue},100%,72%,${a})`,
    hi: a => `hsla(${hue},60%,93%,${a})`,
    dim: a => `hsla(${hue},70%,52%,${a})`,
    acc: a => `hsla(${accent},100%,64%,${a})`,
    bg0: `hsl(${hue + 12},70%,2.4%)`, bg1: `hsl(${hue + 6},65%,7%)`,
  };
}

// ---------- 背景：暗场 + 中心微光 + 远景点阵（视差） ----------
export function background(ctx, W, H, T, o = {}) {
  ctx.fillStyle = T.bg0; ctx.fillRect(0, 0, W, H);
  const cx = o.cx ?? W * 0.5, cy = o.cy ?? H * 0.55;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62);
  g.addColorStop(0, T.bg1); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 点阵
  const px = o.px || 0, py = o.py || 0, step = 48, a = o.alpha ?? 1;
  ctx.fillStyle = T.dim(0.16 * a);
  const ox = ((px % step) + step) % step, oy = ((py % step) + step) % step;
  for (let y = -step + oy; y < H + step; y += step) for (let x = -step + ox; x < W + step; x += step) {
    const d = Math.hypot(x - cx, y - cy) / (W * 0.6);
    if (d > 1) continue;
    const s = (1 - d) * 1.6 + 0.4;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}

// 暗角
export function vignette(ctx, W, H, k = 0.6) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---------- 底板：深色半透明（~70%）+ 细边框 + 四角短刻，让文字永远不和线框互相干扰 ----------
export function plate(ctx, T, x, y, w, h, a = 1, o = {}) {
  if (a <= 0 || w <= 0 || h <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(1,8,12,${(o.op ?? 0.72) * a})`; ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = T.line(0.28 * a); ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.strokeStyle = T.line(0.7 * a); ctx.lineWidth = 1.4; corners(ctx, x, y, x + w, y + h, 10);
  ctx.restore();
}

// ---------- 取景框：四角 + 边缘刻度 + 顶部状态 ----------
export function chrome(ctx, W, H, T, o = {}) {
  const a = o.alpha ?? 1, m = 44, L = 46, px = o.px || 0;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = T.line(0.55 * a); ctx.lineWidth = 1.5;
  corners(ctx, m, m, W - m, H - m, L);
  // 左右刻度尺（前景视差）
  ctx.strokeStyle = T.dim(0.45 * a); ctx.lineWidth = 1;
  ctx.beginPath();
  const off = ((px * 1.4) % 24 + 24) % 24;
  for (let y = 160 + off; y < H - 160; y += 24) {
    const big = Math.round((y - off) / 24) % 5 === 0;
    ctx.moveTo(m + 8, y); ctx.lineTo(m + 8 + (big ? 14 : 7), y);
    ctx.moveTo(W - m - 8, y); ctx.lineTo(W - m - 8 - (big ? 14 : 7), y);
  }
  ctx.stroke();
  // 顶部状态
  ctx.font = `20px ${FONT.mono}`; ctx.textBaseline = 'middle';
  ctx.fillStyle = T.line(0.75 * a);
  if (o.tl) { ctx.textAlign = 'left'; ctx.fillText(o.tl, m + 22, m + 26); }
  if (o.tr) { ctx.textAlign = 'right'; ctx.fillText(o.tr, W - m - 22, m + 26); }
  if (o.bl) { ctx.textAlign = 'left'; ctx.fillStyle = T.dim(0.7 * a); ctx.fillText(o.bl, m + 22, H - m - 22); }
  if (o.br) { ctx.textAlign = 'right'; ctx.fillStyle = T.dim(0.7 * a); ctx.fillText(o.br, W - m - 22, H - m - 22); }
  ctx.restore();
}

export function corners(ctx, x0, y0, x1, y1, L) {
  ctx.beginPath();
  ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
  ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
  ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
  ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
  ctx.stroke();
}

// ---------- 目标框：k=0 大而斜、k=1 锁定贴合；flash 为锁定瞬间闪白 ----------
export function targetBox(ctx, T, bb, k, o = {}) {
  if (!bb || k <= 0) return;
  const pad = o.pad ?? 26;
  let [x0, y0, x1, y1] = bb; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const e = o.lockK ?? eo(k);
  const s = lerp(1.9, 1, e), rot = lerp(Math.PI / 4, 0, e);
  const hw = (x1 - x0) / 2 * s, hh = (y1 - y0) / 2 * s;
  const a = (o.alpha ?? 1) * clamp(k * 4);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.globalCompositeOperation = 'lighter';
  const L = Math.min(hw, hh) * 0.38 + 8;
  ctx.strokeStyle = o.flash ? T.hi(a) : T.line(0.9 * a); ctx.lineWidth = o.flash ? 3 : 2;
  corners(ctx, -hw, -hh, hw, hh, L);
  // 中心十字 + 边中点刻度
  ctx.lineWidth = 1; ctx.strokeStyle = T.line(0.5 * a);
  ctx.beginPath();
  ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10);
  ctx.moveTo(-hw, 0); ctx.lineTo(-hw + 10, 0); ctx.moveTo(hw, 0); ctx.lineTo(hw - 10, 0);
  ctx.moveTo(0, -hh); ctx.lineTo(0, -hh + 10); ctx.moveTo(0, hh); ctx.lineTo(0, hh - 10);
  ctx.stroke();
  ctx.restore();
  // 标签（锁定后出现）
  if (o.tag && e > 0.8) {
    const ta = a * clamp((e - 0.8) * 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.font = `600 19px ${FONT.ui}`; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
    const tx = cx - hw, ty = cy - hh - 8;
    const w = ctx.measureText(o.tag).width + 20;
    ctx.fillStyle = o.flash ? T.hi(0.95 * ta) : T.line(0.9 * ta);
    ctx.fillRect(tx, ty - 26, w, 26);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = T.bg0; ctx.fillText(o.tag, tx + 10, ty - 3);
    ctx.restore();
  }
}

// ---------- 引线：锚点圆 → 斜线 → 水平线；prog 0–1 逐段画出 ----------
export function leader(ctx, T, from, elbow, to, prog, o = {}) {
  if (prog <= 0) return;
  const a = o.alpha ?? 1;
  const d1 = Math.hypot(elbow[0] - from[0], elbow[1] - from[1]), d2 = Math.hypot(to[0] - elbow[0], to[1] - elbow[1]);
  let L = (d1 + d2) * clamp(prog);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = T.line(0.85 * a); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(from[0], from[1]);
  if (L <= d1) ctx.lineTo(lerp(from[0], elbow[0], L / d1), lerp(from[1], elbow[1], L / d1));
  else { ctx.lineTo(elbow[0], elbow[1]); L -= d1; ctx.lineTo(lerp(elbow[0], to[0], L / d2), lerp(elbow[1], to[1], L / d2)); }
  ctx.stroke();
  // 锚点
  const ra = clamp(prog * 5);
  ctx.beginPath(); ctx.arc(from[0], from[1], 9 * ra, 0, TAU); ctx.stroke();
  ctx.fillStyle = T.hi(a); ctx.beginPath(); ctx.arc(from[0], from[1], 3, 0, TAU); ctx.fill();
  if (o.pulse) { ctx.strokeStyle = T.line(a * (1 - o.pulse)); ctx.beginPath(); ctx.arc(from[0], from[1], 9 + 26 * o.pulse, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---------- 滚动数字：从乱码滚到真值 ----------
// k 0–1：各字符从右往左依次锁定；frame 决定乱码帧（24fps 每帧换一次）
const GLY_D = '0123456789', GLY_A = 'ABCDEFGHJKLMNPRSTUVWXYZ#%/<>=';
export function rollText(str, k, frame, seed = 0) {
  if (k >= 1) return str;
  const n = str.length; let out = '';
  for (let i = 0; i < n; i++) {
    const ch = str[i];
    const order = (n - 1 - i) / Math.max(1, n);          // 右边先锁
    const lockAt = 0.25 + order * 0.7;
    if (k >= lockAt || ch === ' ' || ch === '.' || ch === ',' || ch === '·') { out += ch; continue; }
    if (k <= 0) { out += ' '; continue; }
    const set = /\d/.test(ch) ? GLY_D : GLY_A;
    out += set[Math.floor(hash(frame * 13.7 + i * 7.1 + seed) * set.length)];
  }
  return out;
}

// 等宽排版（按最宽数字定字距，滚动时不抖）
export function monoText(ctx, s, x, y, adv) {
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i], w = ctx.measureText(ch).width;
    const narrow = ch === '.' || ch === ',' || ch === ' ' || ch === ':';
    const a = narrow ? w * 1.1 : adv;
    if (ch === '.') {   // 小数点画成方点（细字重的句点在辉光下像逗号）
      const m = ctx.measureText('0'), d = Math.max(3, m.width * 0.13);
      ctx.fillRect(cx + (a - d) / 2, y - d, d, d);
    } else ctx.fillText(ch, cx + (a - w) / 2, y);
    cx += a;
  }
  return cx - x;
}

// 文字适配：超宽时缩字号
export function fitFont(ctx, text, weight, size, family, maxW, minSize = 12) {   // 注意：先设好 letterSpacing 再调用
  let s = size; ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > minSize) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

// 自动换行
export function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- 参数卡：序号 / 名称 / 大数值 + 单位 / 细节 ----------
// st: { reveal 0–1(框体), roll 0–1(数值), detail 0–1, frame, flash }
export function specCard(ctx, T, x, y, c, st, o = {}) {
  const w = o.w ?? 460, a = o.alpha ?? 1, big = o.big ?? 132;
  if (st.reveal <= 0) return { w, h: 0 };
  const r = eo(st.reveal);
  {   // 底板：按最终高度一次画好（跟随展开）
    ctx.save(); ctx.font = `500 25px ${FONT.ui}`;
    const dl = c.detail ? wrap(ctx, c.detail, w).length : 0; ctx.restore();
    const hh = 48 + big * 0.9 + 12 + (dl ? 36 + dl * 30 : 0) + 20;
    plate(ctx, T, x - 22, y - 20, (w + 44) * r, hh + 20, a * clamp(st.reveal * 2));
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // 顶线从左往右展开
  ctx.strokeStyle = T.line(0.9 * a); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * r, y); ctx.stroke();
  ctx.fillStyle = T.line(0.9 * a); ctx.fillRect(x, y - 3, 34 * r, 6);
  // 序号 + 名称
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `20px ${FONT.mono}`; ctx.fillStyle = T.dim(0.95 * a * r);
  ctx.fillText(o.index || '', x, y + 34);
  const lab = (c.label || '').toUpperCase();
  fitFont(ctx, lab, 600, 30, FONT.ui, w - 60, 18);
  ctx.fillStyle = T.hi(0.95 * a * clamp(r * 2 - 0.6));
  ctx.letterSpacing = '3px';
  ctx.fillText(rollText(lab, clamp(st.reveal * 1.6 - 0.2), st.frame, 3), x + 52, y + 36);
  ctx.letterSpacing = '0px';
  // 大数值
  let h = 48;
  if (st.roll > 0) {
    const val = String(c.value), unit = c.unit || '';
    const bs = fitFont(ctx, val, 300, big, FONT.ui, w - 110, 60);
    const adv = ctx.measureText('0').width * 1.02;
    const locked = st.roll >= 1;
    const col = locked ? (st.flash ? T.hi(a) : T.acc(a)) : T.line(0.85 * a);
    ctx.fillStyle = col;
    const s = rollText(val, st.roll, st.frame, 11);
    const vw = monoText(ctx, s, x - 4, y + 48 + bs * 0.78, adv);
    ctx.font = `500 ${Math.round(bs * 0.3)}px ${FONT.ui}`; ctx.fillStyle = locked ? T.acc(0.9 * a) : T.line(0.6 * a);
    ctx.fillText(unit, x + vw + 10, y + 48 + bs * 0.78);
    h = 48 + bs * 0.9;
    // 进度条（数值滚动时满格）
    ctx.fillStyle = T.dim(0.35 * a); ctx.fillRect(x, y + h + 8, w, 2);
    ctx.fillStyle = locked ? T.acc(0.9 * a) : T.line(0.9 * a); ctx.fillRect(x, y + h + 8, w * clamp(st.roll), 2);
    h += 12;
  }
  if (c.detail && st.detail > 0) {
    ctx.font = `500 25px ${FONT.ui}`; ctx.fillStyle = T.line(0.8 * a * clamp(st.detail * 2));
    const lines = wrap(ctx, c.detail, w);
    lines.forEach((ln, i) => ctx.fillText(rollText(ln, clamp(st.detail * 1.5 - i * 0.2), st.frame, 21 + i), x, y + h + 36 + i * 30));
    h += 36 + lines.length * 30;
  }
  ctx.restore();
  return { w, h };
}

// ---------- 参数芯片：停靠在侧栏、一直留到落版（名称 + 数值 + 细节） ----------
export function chip(ctx, T, x, y, c, a = 1, o = {}) {
  if (a <= 0) return 0;
  const w = o.w ?? 360;
  plate(ctx, T, x - 16, y - 16, w + 32, (c.detail ? 72 : 44) + 28, a);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = T.line(0.5 * a); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  ctx.fillStyle = T.line(0.9 * a); ctx.fillRect(x, y - 2, 14, 4);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `18px ${FONT.mono}`; ctx.fillStyle = T.dim(0.9 * a); ctx.fillText(o.index || '', x, y + 30);
  const lab = (c.label || '').toUpperCase();
  ctx.letterSpacing = '2px'; fitFont(ctx, lab, 600, 21, FONT.ui, w - 170, 13);
  ctx.fillStyle = T.line(0.95 * a); ctx.fillText(lab, x + 40, y + 30); ctx.letterSpacing = '0px';
  ctx.textAlign = 'right';
  const u = c.unit || '';
  ctx.font = `500 18px ${FONT.ui}`; const uw = ctx.measureText(u).width;
  ctx.fillStyle = T.acc(0.95 * a); ctx.fillText(u, x + w, y + 32);
  ctx.font = `400 42px ${FONT.ui}`; ctx.textAlign = 'left';
  const vw = ctx.measureText(String(c.value)).width;
  monoTextFit(ctx, String(c.value), x + w - uw - 6 - vw, y + 34);
  let h = 44;
  if (c.detail) {
    ctx.textAlign = 'left';
    fitFont(ctx, c.detail, 500, 20, FONT.ui, w - 40, 13);
    ctx.fillStyle = T.line(0.72 * a); ctx.fillText(c.detail, x + 40, y + 62); h = 72;
  }
  ctx.restore();
  return h;
}
function monoTextFit(ctx, s, x, y) {   // 普通排版，但小数点画成方点
  let cx = x;
  for (const ch of s) {
    const w = ctx.measureText(ch).width;
    if (ch === '.') { const d = Math.max(3, ctx.measureText('0').width * 0.13); ctx.fillRect(cx + (w - d) / 2, y - d, d, d); }
    else ctx.fillText(ch, cx, y);
    cx += w;
  }
}

// ---------- 字幕：界面里的"语音转写"条 ----------
export function subtitle(ctx, W, H, T, text, a, o = {}) {
  if (!text || a <= 0) return;
  ctx.save();
  const y = o.y ?? H - 118, maxW = o.maxW ?? 1180;
  ctx.font = `500 38px ${FONT.ui}`;
  const lines = wrap(ctx, text, maxW);
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  const x = (o.x ?? W / 2) - tw / 2, lh = 46, h = lines.length * lh;
  // 底板
  ctx.fillStyle = `rgba(1,8,12,${0.62 * a})`;
  ctx.fillRect(x - 58, y - h - 18, tw + 86, h + 30);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = T.line(0.55 * a); ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 58, y - h - 18 + 12); ctx.lineTo(x - 58, y - h - 18); ctx.lineTo(x - 46, y - h - 18);
  ctx.moveTo(x + tw + 28 - 12, y + 12); ctx.lineTo(x + tw + 28, y + 12); ctx.lineTo(x + tw + 28, y);
  ctx.stroke();
  // 声纹指示
  ctx.fillStyle = T.line(0.9 * a);
  for (let i = 0; i < 4; i++) { const hh = 6 + 14 * Math.abs(Math.sin((o.t || 0) * 9 + i * 1.7)); ctx.fillRect(x - 42 + i * 7, y - h / 2 - 3 - hh / 2, 3, hh); }
  ctx.fillStyle = T.hi(0.96 * a); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x, y - h + (i + 1) * lh - 10));
  ctx.restore();
}

// ---------- 故障闪烁：横向切片错位 + 色偏（克制，只在一两帧） ----------
export function glitch(ctx, W, H, amt, seed) {
  if (amt <= 0) return;
  const src = ctx.canvas;
  const tmp = glitch.tmp || (glitch.tmp = Object.assign(document.createElement('canvas'), { width: W, height: H }));
  const g = tmp.getContext('2d'); g.clearRect(0, 0, W, H); g.drawImage(src, 0, 0);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const y = Math.floor(hash(seed + i * 3.1) * H), h = 6 + Math.floor(hash(seed + i * 5.7) * 60), dx = (hash(seed + i * 9.3) - 0.5) * 120 * amt;
    ctx.drawImage(tmp, 0, y, W, h, dx, y, W, h);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * amt;
  ctx.drawImage(tmp, 8 * amt, 0); ctx.restore();
}

// ---------- 热点标记：钉在零件本体上的编号圈，编号牌紧贴圈的一侧（落版用） ----------
export function marker(ctx, T, p, label, a = 1, pulse = 0, dir = 1) {
  if (!p || a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = 17;
  ctx.strokeStyle = T.hi(0.95 * a); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.4; ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(p[0] + dx * (r - 6), p[1] + dy * (r - 6)); ctx.lineTo(p[0] + dx * (r + 6), p[1] + dy * (r + 6)); }
  ctx.stroke();
  ctx.fillStyle = T.hi(a); ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, TAU); ctx.fill();
  if (pulse > 0) { ctx.strokeStyle = T.line(0.8 * a * (1 - pulse)); ctx.beginPath(); ctx.arc(p[0], p[1], r + 36 * pulse, 0, TAU); ctx.stroke(); }
  ctx.font = `600 22px ${FONT.ui}`; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width + 18, gap = r + 12, bx = dir > 0 ? p[0] + gap : p[0] - gap - tw;
  ctx.strokeStyle = T.hi(0.9 * a); ctx.beginPath(); ctx.moveTo(p[0] + dir * (r + 6), p[1]); ctx.lineTo(dir > 0 ? bx : bx + tw, p[1]); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(1,8,12,${0.88 * a})`; ctx.fillRect(bx, p[1] - 15, tw, 30);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = T.line(0.9 * a); ctx.lineWidth = 1.2; ctx.strokeRect(bx, p[1] - 15, tw, 30);
  ctx.fillStyle = T.hi(a); ctx.textAlign = 'left'; ctx.fillText(label, bx + 9, p[1] + 1);
  ctx.restore();
}

// ---------- 投影光柱：从投影台升起的光锥 + 上升光尘 ----------
export function beam(ctx, T, project, a, t, o = {}) {
  if (a <= 0) return;
  const r0 = o.r0 ?? 1.05, r1 = o.r1 ?? 0.9, y1 = o.y1 ?? 1.25, c = o.c || [0, 0, 0];
  const p = new Float32Array(3);
  const bot = [], top = [];
  for (let i = 0; i < 96; i++) {
    const th = i / 96 * TAU;
    project(c[0] + Math.cos(th) * r0, 0, c[2] + Math.sin(th) * r0, p); bot.push([p[0], p[1]]);
    project(c[0] + Math.cos(th) * r1, y1, c[2] + Math.sin(th) * r1, p); top.push([p[0], p[1]]);
  }
  const ext = arr => { let l = 0, r = 0; arr.forEach((q, i) => { if (q[0] < arr[l][0]) l = i; if (q[0] > arr[r][0]) r = i; }); return [l, r]; };
  const [bl, br] = ext(bot), [tl, tr] = ext(top);
  const L0 = bot[bl][0], R0 = bot[br][0], L1 = top[tl][0], R1 = top[tr][0];
  const yb = Math.max(...bot.map(q => q[1])), yt = Math.min(...top.map(q => q[1]));
  project(c[0], 0, c[2], p); const ym = p[1]; project(c[0], y1, c[2], p); const ytc = p[1];
  // 下弧（屏幕上靠下的一半）与上弧（靠上的一半）
  const arc = (arr, from, to, lower) => { const out = []; const n = arr.length; const cy = arr.reduce((s, q) => s + q[1], 0) / n; for (let k = 0; k <= n; k++) { const q = arr[(from + k) % n]; if ((lower ? q[1] >= cy - 1 : q[1] <= cy + 1)) out.push(q); if ((from + k) % n === to && k > 0) break; } return out; };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, yb, 0, yt);
  g.addColorStop(0, T.line(0.10 * a)); g.addColorStop(0.45, T.line(0.04 * a)); g.addColorStop(1, T.line(0));
  ctx.fillStyle = g;
  // 一条路径三个子路径（底椭圆 + 侧面梯形 + 顶椭圆），一次 nonzero 填充 = 并集，不会重叠加亮
  ctx.beginPath();
  const poly = arr => { arr.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); };
  const cw = arr => { let a = 0; for (let i = 0; i < arr.length; i++) { const p0 = arr[i], p1 = arr[(i + 1) % arr.length]; a += p0[0] * p1[1] - p1[0] * p0[1]; } return a > 0 ? arr : arr.slice().reverse(); };
  poly(cw(bot)); poly(cw(top)); poly(cw([[L0, bot[bl][1]], [L1, top[tl][1]], [R1, top[tr][1]], [R0, bot[br][1]]]));
  ctx.fill('nonzero');
  const yT = ytc;
  // 竖向光纹
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const u = (i + 0.5) / 26, w = 0.5 + 0.5 * Math.sin(i * 12.9898 + t * 1.3);
    ctx.strokeStyle = T.line(0.05 * a * w);
    ctx.beginPath(); ctx.moveTo(L0 + (R0 - L0) * u, ym + (yb - ym) * Math.sin(u * Math.PI)); ctx.lineTo(L1 + (R1 - L1) * u, yT); ctx.stroke();
  }
  // 光尘
  for (let i = 0; i < 70; i++) {
    const h1 = hash(i * 3.7), h2 = hash(i * 9.1), h3 = hash(i * 1.3);
    const life = (t * (0.12 + 0.1 * h3) + h1) % 1;
    const th = h2 * TAU, rr = r0 * (0.3 + 0.7 * hash(i * 5.3)) * (1 - life * 0.15);
    project(c[0] + Math.cos(th) * rr, life * y1, c[2] + Math.sin(th) * rr, p);
    const al = Math.sin(life * Math.PI) * a * 0.8;
    ctx.fillStyle = T.hi(al); ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
  }
  ctx.restore();
}
