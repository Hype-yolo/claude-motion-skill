// Urban Sketch · Pen & Wash engine
// 钢笔淡彩引擎：细墨线（抖、出头、断笔、按笔顺出现）+ 透明水彩（错位、溢出、积色边、颗粒）
// 所有绘制都是确定性的（同样的 seed → 同样的笔触），可以逐帧离线渲染。
//
// 三层结构：
//   1. 静态层：penStroke/rasterPen 把墨线画进 ink+time 两张画布（time = 这一笔在第几秒被画到）；
//      wash/dab/foliage 把颜色画进 color 画布（乘法叠色，白 = 纸）。
//   2. 颜色到达场：arrivalField(sources) 给每个像素算"颜色哪一刻到"，GL 合成时按它洇开，前沿有积色暗边。
//   3. 动态层：figure()/hat() 生成图元（knock 纸色遮挡 / wash 颜色 / ink 墨线），drawPrims 每帧画到屏幕。

export const INK = [43, 37, 32];            // 深褐墨 #2b2520
export const PAPER = [245, 238, 222];       // 冷压水彩纸 #f5eede
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;

// ---------- 随机与噪声 ----------
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function h2(x, y, s) { let n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
export function n2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, o = 4) { let a = 0, w = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { a += w * n2(x * f, y * f, s + i * 13); n += w; w *= .5; f *= 2.03; } return a / n; }
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------- 路径工具 ----------
// 按弧长重采样，返回 [[x,y],...]
export function resample(pts, step) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const L = Math.hypot(x1 - x0, y1 - y0); if (L === 0) continue;
    let d = step - carry;
    while (d <= L) { out.push([x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L]); d += step; }
    carry = L - (d - step);
  }
  const last = pts[pts.length - 1], pl = out[out.length - 1];
  if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > step * .3) out.push(last);
  return out;
}
// Catmull-Rom 平滑
export function spline(pts, n = 8, closed = false) {
  const P = pts, out = [], N = P.length; if (N < 3) return P.slice();
  const g = i => closed ? P[(i + N) % N] : P[clamp(i, 0, N - 1)];
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(P[N - 1]);
  return out;
}
export const ellipse = (cx, cy, rx, ry, n = 28, a0 = 0) => [...Array(n)].map((_, i) => { const a = a0 + i / n * TAU; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
// 闭合多边形的边加噪声（水彩边缘）
export function rough(poly, amp, seed, step = 9, freq = .02) {
  const P = resample([...poly, poly[0]], step); P.pop();
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], [x, y] = P[i];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const d = (fbm(x * freq, y * freq, seed, 3) - .5) * 2 * amp + (n2(x * .15, y * .15, seed + 9) - .5) * amp * .35;
    out.push([x + nx * d, y + ny * d]);
  }
  return out;
}
function pathPoly(ctx, poly) { if (!poly || poly.length < 2) return; ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); }

// ---------- 钢笔 ----------
// 一笔 = 抖动 + 两头出头 + 轻微粗细变化 + 偶尔断笔。o: w 线宽, wob 抖动幅度, over 出头, gap 断笔概率, seed
export function penStroke(pts, o = {}) {
  const w = o.w ?? 2.4, wob = o.wob ?? 1.1, seed = o.seed ?? 1, r = rng(seed);
  let P = pts.length > 2 && o.smooth !== false ? spline(pts, 6) : pts;
  const step = o.step ?? Math.max(2, w * 1.4);
  P = resample(P, step);
  if (P.length < 2) P = [pts[0], pts[pts.length - 1]];
  // 出头：两端沿切线延长一点（速写的"不封口"）
  const over = (o.over ?? 4) * (.4 + r());
  const ext = (a, b, d) => { const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return [a[0] + (a[0] - b[0]) / l * d, a[1] + (a[1] - b[1]) / l * d]; };
  P.unshift(ext(P[0], P[1], over * .5)); P.push(ext(P[P.length - 1], P[P.length - 2], over));
  const n = P.length, out = [], W = [], S = [0];
  const ph = r() * 100, f = (o.freq ?? .018) * (.7 + r() * .6);
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const s = i * step, d = (n2(s * f + ph, 0, seed) - .5) * 2 * wob + (n2(s * f * 5 + ph, 3, seed) - .5) * wob * .35;
    out.push([P[i][0] + nx * d, P[i][1] + ny * d]);
    const u = i / (n - 1);
    W.push(w * (.55 + .45 * Math.pow(Math.sin(Math.PI * clamp(u * 1.1 - .02)), .35)) * (.85 + .3 * n2(s * .01 + 5, ph, seed)));
    if (i) S.push(S[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  }
  // 断笔：钢笔划过纸面偶尔跳一下
  const gaps = [];
  if (o.gap && S[n - 1] > 60 && r() < o.gap) { const g0 = .25 + r() * .5; gaps.push([g0, g0 + (3 + r() * 6) / S[n - 1]]); }
  return { P: out, W, S, L: S[n - 1], gaps, alpha: o.alpha ?? 1 };
}
const inGap = (st, u) => st.gaps.some(g => u > g[0] && u < g[1]);
// 画一笔（p = 画到百分之几），动态层用
export function drawPen(ctx, st, p = 1, col = INK, alpha = 1, from = 0) {
  if (p <= 0 || from >= p) return;
  const end = st.L * clamp(p), beg = st.L * clamp(from); ctx.strokeStyle = rgba(col, alpha * st.alpha); ctx.lineCap = 'round';
  for (let i = 1; i < st.P.length; i++) {
    if (st.S[i - 1] > end) break;
    if (st.S[i] < beg) continue;
    const u = st.S[i] / st.L; if (inGap(st, u)) continue;
    let [x1, y1] = st.P[i];
    if (st.S[i] > end) { const k = (end - st.S[i - 1]) / (st.S[i] - st.S[i - 1] || 1); x1 = lerp(st.P[i - 1][0], x1, k); y1 = lerp(st.P[i - 1][1], y1, k); }
    ctx.lineWidth = st.W[i]; ctx.beginPath(); ctx.moveTo(st.P[i - 1][0], st.P[i - 1][1]); ctx.lineTo(x1, y1); ctx.stroke();
  }
}
// 画进静态层：ink 画布（不透明黑 = 覆盖度）+ time 画布（灰度 = 到达时间，darken 取最早）
export function rasterPen(inkCtx, timeCtx, st, t0, dur, win) {
  inkCtx.strokeStyle = '#000'; inkCtx.lineCap = 'round'; timeCtx.lineCap = 'round';
  for (let i = 1; i < st.P.length; i++) {
    const u = st.S[i] / st.L; if (inGap(st, u)) continue;
    const a = st.P[i - 1], b = st.P[i];
    inkCtx.globalAlpha = st.alpha; inkCtx.lineWidth = st.W[i];
    inkCtx.beginPath(); inkCtx.moveTo(a[0], a[1]); inkCtx.lineTo(b[0], b[1]); inkCtx.stroke();
    const tt = t0 + dur * (st.S[i - 1] / st.L), v = Math.round(1 + clamp((tt - win[0]) / win[1]) * 253);
    timeCtx.strokeStyle = `rgb(${v},${v},${v})`; timeCtx.lineWidth = st.W[i] + 3;
    timeCtx.beginPath(); timeCtx.moveTo(a[0], a[1]); timeCtx.lineTo(b[0], b[1]); timeCtx.stroke();
  }
  inkCtx.globalAlpha = 1;
}

// ---------- 水彩 ----------
// 一块淡彩：几层噪声边的半透明填充（乘法叠色）+ 干后积色的暗边。o: a 浓度, j 边缘抖动, layers, edge, seed, dx/dy 错位
export function wash(ctx, poly, col, o = {}) {
  if (!poly || poly.length < 3) return;
  const a = o.a ?? .5, j = o.j ?? 6, L = o.layers ?? 3, seed = o.seed ?? 7, dx = o.dx ?? 0, dy = o.dy ?? 0;
  const P0 = (dx || dy) ? poly.map(p => [p[0] + dx, p[1] + dy]) : poly;
  ctx.save(); ctx.globalCompositeOperation = o.op ?? 'multiply';
  let last;
  for (let l = 0; l < L; l++) {
    last = rough(P0, j * (1 + l * .35), seed + l * 31, o.step ?? Math.max(5, j * 1.4), o.freq ?? .02);
    ctx.fillStyle = rgba(col, a / L * (1.25 - l * .15)); pathPoly(ctx, last); ctx.fill();
  }
  const e = o.edge ?? .3;
  if (e > 0) { ctx.strokeStyle = rgba(mix3(col, [60, 50, 40], .15), a * e); ctx.lineWidth = o.edgeW ?? 1.8; ctx.lineJoin = 'round'; pathPoly(ctx, last); ctx.stroke(); }
  ctx.restore();
}
// 留白：把下面的颜色擦回纸色（水彩"留白"/前景遮挡）
export function reserve(ctx, poly, a = .9, j = 4, seed = 3) { ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(255,255,255,${a})`; pathPoly(ctx, j ? rough(poly, j, seed) : poly); ctx.fill(); ctx.restore(); }
// 一个叶片状色点
export function dab(ctx, x, y, r, ang, col, a, seed) {
  const R = rng(seed), n = 5 + (R() * 3 | 0), el = 1.15 + R() * .5, P = [];
  for (let i = 0; i < n; i++) { const t = i / n * TAU + R() * .5, rr = r * (.6 + R() * .55); const lx = Math.cos(t) * rr * el, ly = Math.sin(t) * rr; P.push([x + lx * Math.cos(ang) - ly * Math.sin(ang), y + lx * Math.sin(ang) + ly * Math.cos(ang)]); }
  ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  ctx.fill();
}
// 树冠：底色淡彩 + 上千个叶片色点（左上受光黄绿 → 右下暗绿），留出透光的洞
export const LEAF = { sun: hex('#d6d56f'), light: hex('#aabf57'), mid: hex('#7fa04a'), dark: hex('#56793c'), deep: hex('#3f5d36') };
export function crownDepth(crown, x, y) { let k = -1; for (const c of crown) k = Math.max(k, 1 - Math.hypot(x - c.x, y - c.y) / c.r); return k; }
export function foliage(ctx, crown, o = {}) {
  const R = rng(o.seed ?? 11), pal = o.pal ?? LEAF, dens = o.dens ?? 1, sc = o.scale ?? 1;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, area = 0;
  for (const c of crown) { x0 = Math.min(x0, c.x - c.r); y0 = Math.min(y0, c.y - c.r); x1 = Math.max(x1, c.x + c.r); y1 = Math.max(y1, c.y + c.r); area += Math.PI * c.r * c.r; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.max(x1 - x0, y1 - y0) / 2;
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  // 底色：整团浅黄绿
  for (const c of crown) wash(ctx, ellipse(c.x, c.y, c.r * .92, c.r * .88, 22), pal.sun, { a: .22 * (o.base ?? 1), j: c.r * .12, layers: 2, edge: 0, seed: (o.seed ?? 11) + c.x | 0 });
  // 体积：受光的一团 + 背光的一团（大块湿画），再点叶片
  for (const c of crown) {
    wash(ctx, ellipse(c.x + c.r * .18, c.y + c.r * .22, c.r * .7, c.r * .55, 18), pal.mid, { a: .22 * (o.base ?? 1), j: c.r * .15, layers: 2, edge: .08, seed: (o.seed ?? 11) + 7 + c.y | 0, freq: .012 });
    wash(ctx, ellipse(c.x + c.r * .3, c.y + c.r * .42, c.r * .5, c.r * .3, 16), pal.dark, { a: .2 * (o.base ?? 1), j: c.r * .12, layers: 2, edge: .1, seed: (o.seed ?? 11) + 9 + c.x | 0, freq: .012 });
  }
  ctx.globalCompositeOperation = 'multiply';
  const N = Math.round(area / (260 * sc * sc) * dens);
  for (let i = 0; i < N; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), k = crownDepth(crown, x, y);
    if (k < 0) continue;
    const hole = fbm(x * .012 / sc, y * .012 / sc, o.seed ?? 11, 3);
    if (k < .5 && hole > .6 + k * .3) continue;          // 边缘的透光洞
    if (R() > .35 + k * 1.6) continue;                    // 外缘稀疏
    if (k > .45 && R() < .45) continue;                  // 内部交给大块颜色
    const lx = (x - cx) / rad, ly = (y - cy) / rad, lit = clamp(.5 - lx * .45 - ly * .6 + (R() - .5) * .5 + (hole - .5) * .6, 0, 1);
    const col = lit > .78 ? pal.sun : lit > .55 ? pal.light : lit > .33 ? pal.mid : lit > .16 ? pal.dark : pal.deep;
    dab(ctx, x, y, (4 + R() * R() * 16) * sc * (1.1 - k * .3), R() * TAU, col, .32 + R() * .38, i * 7 + (o.seed ?? 11));
  }
  ctx.restore();
}

// ---------- 颜色到达场 ----------
// sources: {x,y,t,v,R}（从 (x,y) 在 t 秒开始，以 v px/s 洇开，最远 R）；返回 Float32Array(gw*gh)，单位秒
export function arrivalField(W, H, gw, gh, sources, o = {}) {
  const F = new Float32Array(gw * gh).fill(999), cw = W / gw, ch = H / gh;
  // 每格一个噪声偏移（像素）：让洇开的边缘成不规则的"花椰菜"形，而不是圆
  const N = new Float32Array(gw * gh), amp = o.amp ?? 170, creep = o.creep ?? .028;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = (i + .5) * cw, y = (j + .5) * ch; N[j * gw + i] = (fbm(x * .0024, y * .0024, 17, 4) - .5) * 2 * amp + (fbm(x * .011, y * .011, 23, 2) - .5) * amp * .35; }
  for (const s of sources) {
    const R = s.R ?? 1e5, reach = R + (s.hard ? 0 : 900), i0 = Math.max(0, Math.floor((s.x - reach) / cw)), i1 = Math.min(gw - 1, Math.ceil((s.x + reach) / cw));
    const Ry = reach / (s.sy ?? 1), j0 = Math.max(0, Math.floor((s.y - Ry) / ch)), j1 = Math.min(gh - 1, Math.ceil((s.y + Ry) / ch));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + .5) * cw, y = (j + .5) * ch;
      if (s.mask && !s.mask(x, y)) continue;
      const k = j * gw + i, d = Math.max(0, Math.hypot(x - s.x, (y - s.y) * (s.sy ?? 1)) + N[k] * (s.noise ?? 1));
      if (s.hard ? d > R : d > reach) continue;
      // R 以内按 v 洇开；R 以外慢慢渗（creep 秒/像素），边缘干后成一道深色水痕
      const t = s.t + Math.min(d, R) / s.v + Math.max(0, d - R) * creep; if (t < F[k]) F[k] = t;
    }
  }
  return F;
}
export function sampleField(F, W, H, gw, gh, x, y) { const i = clamp(Math.floor(x / W * gw), 0, gw - 1), j = clamp(Math.floor(y / H * gh), 0, gh - 1); return F[j * gw + i]; }

// ---------- GL 合成：纸 × 颜色（按到达场洇开）× 墨线（按笔顺出现） ----------
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uWorld; uniform vec3 uCam; uniform float uRot, uT; uniform vec4 uWin;
uniform sampler2D uColor, uInk, uTime, uArr;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=0., w=.5; for(int i=0;i<4;i++){ a+=w*n(p); p*=2.03; w*=.5; } return a/.9375; }
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uRes*.5;
  float c = cos(uRot), s = sin(uRot);
  vec2 w = uCam.xy + mat2(c,-s,s,c) * sp / uCam.z;
  vec2 uv = w / uWorld;
  // 纸：大块的深浅 + 纤维
  float m = fbm(w*.0011) * .6 + fbm(w*.0062 + 9.) * .4;
  vec3 paper = vec3(.961,.933,.871) * (1. - .045 * (m - .45)) ;
  paper *= 1. - .018 * smoothstep(.55, .9, n(w * vec2(.9, .05) + 3.));
  // 颜色：按到达时间洇开，前沿积色
  vec3 col = texture(uColor, uv).rgb;
  float T = texture(uArr, uv).r;
  float jn = (fbm(w*.0032 + 3.1) - .5) * .7 + (fbm(w*.021 + 7.) - .5) * .22 + (n(w*.09) - .5) * .06;
  float dt = uT - (T + jn);
  float rev = smoothstep(0., .16, dt);
  float front = exp(-pow((dt - .07) / .08, 2.));
  float wet = step(0., dt) * exp(-max(dt, 0.) / .55);
  vec3 pig = (1. - col) * rev * (1. + .7 * front + .12 * wet);
  float g = fbm(w * .21 + 1.7);
  pig *= .82 + .36 * g;                          // 颗粒：颜料沉在纸纹里
  vec3 outc = paper * (1. - clamp(pig, 0., 1.));
  // 墨线：按笔顺出现（time 纹理 = 到达时刻）
  vec2 ink = texture(uInk, uv).rg; vec2 tm = texture(uTime, uv).rg * 255.;
  float nowA = 1. + clamp((uT - uWin.x) / uWin.y, 0., 1.) * 253.;
  float nowB = 1. + clamp((uT - uWin.z) / uWin.w, 0., 1.) * 253.;
  float cov = ink.r * clamp(nowA - tm.r + 1., 0., 1.) + ink.g * clamp(nowB - tm.g + 1., 0., 1.);
  outc *= mix(vec3(1.), vec3(.169,.145,.125), clamp(cov, 0., 1.) * .96);
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) outc = paper;
  o = vec4(outc, 1.);
}`;
export function compositor(canvas, L) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const tex = (unit, name, up, mip) => {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); up();
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(pr, name), unit);
  };
  const W = L.W, H = L.H;
  tex(0, 'uColor', () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, L.color), true);
  tex(1, 'uInk', () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, L.ink), true);
  tex(2, 'uTime', () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, L.time), false);
  tex(3, 'uArr', () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, L.gw, L.gh, 0, gl.RED, gl.FLOAT, L.arr), false);
  const U = k => gl.getUniformLocation(pr, k);
  gl.uniform2f(U('uRes'), canvas.width, canvas.height); gl.uniform2f(U('uWorld'), W, H);
  gl.uniform4f(U('uWin'), L.winA[0], L.winA[1], L.winB[0], L.winB[1]);
  gl.viewport(0, 0, canvas.width, canvas.height);
  return ({ cx, cy, z, rot = 0 }, t) => { gl.uniform3f(U('uCam'), cx, cy, z); gl.uniform1f(U('uRot'), rot); gl.uniform1f(U('uT'), t); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); };
}

// ---------- 图元：knock（纸色遮挡）/ wash（淡彩）/ ink（墨线） ----------
// 动态物体（人物、帽子）先生成图元列表，再统一画；静态物体可以用同一套图元烘进静态层。
export function drawPrims(ctx, prims, o = {}) {
  const colorAmt = o.color ?? 1, inkP = o.ink ?? 1, clip = o.clip;
  for (const p of prims) {
    if (p.k === 'knock') {
      if (o.noKnock) continue;
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba(PAPER, (p.a ?? .93) * (o.knock ?? 1)); pathPoly(ctx, p.poly); ctx.fill(); ctx.restore();
    } else if (p.k === 'wash') {
      if (colorAmt <= 0) continue;
      ctx.save(); if (clip) { clip(ctx); ctx.clip(); }
      wash(ctx, p.poly, p.col, { a: (p.a ?? .6) * Math.min(1, colorAmt), j: p.j ?? 2.5, layers: p.layers ?? 2, edge: p.edge ?? .35, seed: p.seed ?? 1, dx: p.dx ?? 0, dy: p.dy ?? 0, step: p.step, edgeW: p.edgeW ?? 1.2 });
      ctx.restore();
    } else if (p.k === 'ink') {
      const pp = typeof inkP === 'function' ? inkP(p) : inkP; if (pp <= 0) continue;
      drawPen(ctx, p.st, pp, p.col ?? INK, p.alpha ?? 1);
    } else if (p.k === 'fn') p.fn(ctx, o);
  }
}

// ---------- 人物：3D 骨架正交投影成 2D，胶囊体 + 服装色 ----------
// 身体坐标：y 上、z 前（面朝方向）、x 右，单位 = 身高。yaw=0 背对镜头，-90° 朝画面左，180° 朝镜头。
const V = (x, y, z) => [x, y, z];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k], sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = a => Math.hypot(a[0], a[1], a[2]), nrm3 = a => sc3(a, 1 / (len3(a) || 1)), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const rx = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const ry = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rz = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
export const R3 = { V, add3, sc3, sub3, len3, nrm3, rx, ry, rz };
// 两段 IK：从 a 出发，段长 l1/l2，够向 target，pole 决定肘/膝朝向
export function ik(a, target, l1, l2, pole) {
  let d = sub3(target, a), L = len3(d); const Lc = clamp(L, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3); d = nrm3(d);
  const cosA = (l1 * l1 + Lc * Lc - l2 * l2) / (2 * l1 * Lc), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let pv = sub3(pole, sc3(d, pole[0] * d[0] + pole[1] * d[1] + pole[2] * d[2])); pv = nrm3(len3(pv) < 1e-4 ? [0, 0, 1] : pv);
  const mid = add3(a, add3(sc3(d, cosA * l1), sc3(pv, sinA * l1)));
  return [mid, add3(a, sc3(d, Lc))];
}
// 姿势参数 → 关节（身体坐标）。q 里全是角度（弧度）或目标点
export const BODY = { hip: .52, torso: .29, neck: .035, head: .066, sh: .105, hipW: .055, ua: .165, fa: .155, th: .245, sn: .25 };
export function skeleton(q = {}) {
  const B = BODY, j = {};
  const pel = V(0, q.hipY ?? B.hip, q.hipZ ?? 0);
  const lean = q.lean ?? 0, side = q.side ?? 0, twist = q.twist ?? 0;
  const up = rz(rx(V(0, 1, 0), lean), side);
  j.pel = pel; j.chest = add3(pel, sc3(up, B.torso * .62)); j.neck = add3(pel, sc3(up, B.torso));
  const hx = ry(V(1, 0, 0), twist * .5), sx = ry(rz(V(1, 0, 0), side), twist);
  j.head = add3(j.neck, add3(sc3(rx(rz(V(0, 1, 0), side + (q.headSide ?? 0)), lean + (q.nod ?? 0)), B.neck + B.head * .95), V(0, 0, 0)));
  j.headYaw = (q.headYaw ?? 0) + twist;
  for (const s of [-1, 1]) {
    const S = s < 0 ? 'L' : 'R';
    const sh = add3(add3(j.neck, sc3(up, -.025)), sc3(sx, s * B.sh));
    j['sh' + S] = sh;
    const tgt = q['hand' + S];
    if (tgt) { const [el, ha] = ik(sh, tgt, B.ua, B.fa, q['elb' + S] ?? V(s * .6, -.3, -1)); j['el' + S] = el; j['ha' + S] = ha; }
    else {
      const sw = q['arm' + S] ?? 0, ab = q['abd' + S] ?? .08, bend = q['bend' + S] ?? .25;
      const ua = rz(rx(V(0, -B.ua, 0), -sw), s * ab); j['el' + S] = add3(sh, ua);
      const fa = rz(rx(V(0, -B.fa, 0), -(sw + bend)), s * ab * .6); j['ha' + S] = add3(j['el' + S], fa);
    }
    const hp = add3(pel, sc3(hx, s * B.hipW)); j['hp' + S] = hp;
    const ft = q['foot' + S];
    if (ft) { const [kn, an] = ik(hp, ft, B.th, B.sn, q.kneePole ?? V(s * .15, .6, 1)); j['kn' + S] = kn; j['an' + S] = an; }
    else {
      const th = q['leg' + S] ?? 0, kb = q['knee' + S] ?? 0, la = q['lat' + S] ?? 0;
      const tv = rz(rx(V(0, -B.th, 0), -th), s * la); j['kn' + S] = add3(hp, tv);
      j['an' + S] = add3(j['kn' + S], rz(rx(V(0, -B.sn, 0), -(th - kb)), s * la * .5));
    }
    const fd = nrm3(sub3(j['an' + S], j['kn' + S])), fwd = nrm3(add3(cross(V(1, 0, 0), fd), V(0, 0, 0)));
    j['to' + S] = add3(j['an' + S], add3(sc3(fwd, -.07), V(0, -.012, 0)));
  }
  return j;
}
// 投影：身体坐标 → 屏幕（ground 点 gx,gy，比例 S = 身高像素，yaw 朝向，pitch 俯视）
export function projector(gx, gy, S, yaw, pitch = .28) {
  return p => { const q = ry(p, yaw); return [gx + q[0] * S, gy - (q[1] + q[2] * pitch) * S, q[2]]; };
}
// 胶囊链轮廓：pts=[[x,y],...] radii=[...] → 闭合多边形 + 左右边线
function tube(pts, rad) {
  const n = pts.length, Lft = [], Rgt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    Lft.push([pts[i][0] + nx * rad[i], pts[i][1] + ny * rad[i]]); Rgt.push([pts[i][0] - nx * rad[i], pts[i][1] - ny * rad[i]]);
  }
  const cap = (c, r, a0, dir) => [...Array(7)].map((_, k) => { const a = a0 + dir * Math.PI * (k + 1) / 8; return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]; });
  const e = pts[n - 1], e2 = pts[n - 2], s0 = pts[0], s1 = pts[1];
  const ae = Math.atan2(e[1] - e2[1], e[0] - e2[0]), as = Math.atan2(s0[1] - s1[1], s0[0] - s1[0]);
  const poly = [...Lft, ...cap(e, rad[n - 1], ae + Math.PI / 2, -1), ...Rgt.reverse(), ...cap(s0, rad[0], as + Math.PI / 2, -1)];
  Rgt.reverse();
  return { poly, L: Lft, R: Rgt };
}
// 一个人：pose → 图元。look: {skin, top, bottom, hair, shoe, hairLong, curly, dress, sleeve, torso:[臀,腰,肩]}
export function figure(look, pose, place, o = {}) {
  const S = place.S, yaw = place.yaw ?? 0, pr = projector(place.x, place.y, S, yaw, place.pitch ?? .28);
  const j = skeleton(pose), P = k => pr(j[k]);
  const lw = Math.max(1.1, (o.lw ?? .005) * S), seed = (o.seed ?? 1) + (o.boil ?? 0) * 101;
  const parts = [];
  const shadeCol = c => mix3(c, [70, 72, 115], .4);
  const addTube = (keys, radii, col, lay = 0, opt = {}) => {
    const pts = keys.map(k => typeof k === 'string' ? P(k) : pr(k)); const z = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    parts.push({ z: z - lay * .004, pts: pts.map(p => [p[0], p[1]]), rad: radii.map(r => r * S), col, opt });
  };
  const side = Math.abs(Math.sin(yaw + (pose.twist ?? 0)));
  const tr = look.torso ?? [.078, .084, .104];
  const tR = tr.map((r, i) => r * (1 - side * (i === 2 ? .45 : .32)));
  const midBack = add3(j.chest, sc3(sub3(j.neck, j.chest), .45));
  // 躯干：几圈横截面（宽 × 厚）投影后沿脊柱法线取外轮廓
  const upv = nrm3(sub3(j.neck, j.pel)), sxv = nrm3(sub3(j.shR, j.shL)), fzv = nrm3(cross(sxv, upv));
  const lvl = (c, wx, wz) => ({ c, wx, wz });
  const torsoPoly = (levels) => {
    const sp0 = pr(levels[0].c), sp1 = pr(levels[levels.length - 1].c); let dx = sp1[0] - sp0[0], dy = sp1[1] - sp0[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; const nx = -dy, ny = dx;
    const Lp = [], Rp = []; let zs = 0;
    for (const L of levels) {
      let mn = 1e9, mx = -1e9, pm, pM; const c2 = pr(L.c); zs += c2[2];
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; const q = pr(add3(L.c, add3(sc3(sxv, Math.cos(a) * L.wx), sc3(fzv, Math.sin(a) * L.wz)))); const d = (q[0] - c2[0]) * nx + (q[1] - c2[1]) * ny; if (d < mn) { mn = d; pm = q; } if (d > mx) { mx = d; pM = q; } }
      Lp.push([pm[0], pm[1]]); Rp.push([pM[0], pM[1]]);
    }
    const top = Lp[Lp.length - 1], topR = Rp[Rp.length - 1], bot = Lp[0], botR = Rp[0];
    const capT = [[lerp(top[0], topR[0], .5) + dx * 4, lerp(top[1], topR[1], .5) + dy * 4]], capB = [[lerp(bot[0], botR[0], .5) - dx * S * .02, lerp(bot[1], botR[1], .5) - dy * S * .02]];
    return { poly: spline([...Rp, ...capT, ...Lp.slice().reverse(), ...capB], 4, true), z: zs / levels.length, L: Lp, R: Rp };
  };
  const tw = look.torso ?? [.078, .084, .104];
  const levels = [lvl(add3(j.pel, sc3(upv, -.03)), tw[0], .065), lvl(add3(j.pel, sc3(upv, .1)), tw[1], .058), lvl(j.chest, tw[2] * .92, .068), lvl(add3(j.neck, sc3(upv, -.03)), tw[2], .055), lvl(add3(j.neck, sc3(upv, .005)), tw[2] * .62, .045), lvl(add3(j.neck, sc3(upv, .02)), .042, .036)];
  if (look.dress) {
    const sk = torsoPoly(levels); parts.push({ z: sk.z + .006, torsoP: sk, col: look.skin });
    const dr = torsoPoly(levels.slice(0, 3).concat([lvl(midBack, tw[2] * .88, .06)])); parts.push({ z: sk.z + .002, torsoP: dr, col: look.top, straps: true });
  } else { const tp = torsoPoly(levels); parts.push({ z: tp.z + .004, torsoP: tp, col: look.top }); }
  const neckBase = add3(j.neck, sc3(nrm3(sub3(j.head, j.neck)), -.012));
  addTube([neckBase, add3(j.neck, sc3(nrm3(sub3(j.head, j.neck)), .06))], [.032, .029], look.skin, -3);
  const seg = (a, b, n) => [...Array(n)].map((_, i) => add3(sc3(a, 1 - i / (n - 1)), sc3(b, i / (n - 1))));
  for (const s of ['L', 'R']) {
    const sh = j['sh' + s], el = j['el' + s], ha = j['ha' + s], hp = j['hp' + s], kn = j['kn' + s], an = j['an' + s];
    const mid = sc3(add3(sh, el), .5), fore = [...seg(el, ha, 3)];
    if (look.sleeve === 'long') addTube([...seg(sh, el, 2), ...seg(el, ha, 3).slice(1)], [.037, .032, .03, .026], look.top, 0);
    else if (look.sleeve === 'none') addTube([...seg(sh, el, 3), ...fore.slice(1)], [.034, .031, .025, .026, .019], look.skin, 0);
    else { addTube(fore, [.025, .026, .019], look.skin, 0); addTube([mid, el], [.03, .025], look.skin, .5); addTube([sh, mid], [.036, .033], look.top, 1); }
    // 手：顺着前臂方向的小椭圆
    const hd = nrm3(sub3(ha, el)), hc = add3(ha, sc3(hd, .022));
    parts.push({ z: pr(hc)[2] - .003, hand: true, c: pr(hc), c2: pr(add3(ha, sc3(hd, .045))), r: .021 * S, col: look.skin });
    const shortsEnd = add3(sc3(hp, .35), sc3(kn, .65)), shin = seg(kn, an, 4);
    if (look.dress) addTube([...seg(hp, kn, 3), ...shin.slice(1)], [.056, .046, .036, .04, .03, .022], look.skin, 0);
    else if (look.pants) addTube([hp, kn, an], [.058, .044, .036], look.bottom, 0);
    else { addTube([shortsEnd, ...shin], [.04, .035, .039, .03, .022], look.skin, 0); addTube([hp, shortsEnd], [.058, .05], look.bottom, 1); }
    addTube([an, j['to' + s]], [.026, .02], look.shoe ?? [80, 70, 64], -.5);
  }
  if (look.dress) {   // 裙摆：腰 → 膝上，张开的圆锥（坐着时铺在地上）
    const w = j.pel, kn = sc3(add3(j.knL, j.knR), .5), seated = w[1] < .25;
    const hem = seated ? V(w[0], .02, w[2] + .1) : add3(sc3(w, .25), sc3(kn, .75));
    const sp = seated ? .2 : look.flare ?? .15;
    const ring = (c, r, n) => [...Array(n)].map((_, i) => { const a = i / n * TAU; return pr(add3(c, V(Math.cos(a) * r, 0, Math.sin(a) * r * (seated ? .75 : .9)))); });
    const hull = spline(convexHull([...ring(add3(w, V(0, .09, 0)), .075, 16), ...ring(hem, sp, 20)].map(p => [p[0], p[1]])), 3, true);
    parts.push({ z: Math.min(pr(w)[2], pr(hem)[2]) - .006, poly: hull, col: look.top });
  }
  // 头 + 头发（一个整体：先整颗头发色，再按朝向擦出脸）
  const hc = pr(add3(j.neck, sc3(nrm3(sub3(j.head, j.neck)), .1)));
  const fwd = ry(V(Math.sin(j.headYaw), 0, Math.cos(j.headYaw)), yaw);
  parts.push({ z: hc[2] - .004 - (fwd[2] > 0 ? .01 : 0), head: true, c: hc, r: .063 * S, fwd });
  if (look.hairLong) {   // 长发：从头顶散开到肩，再收成发梢；风从右往左吹（hairBlow）
    const hb = pose.hairBlow ?? 0, hz = -.05, hd = j.head, nk = j.neck;
    const q = (x, y, z) => pr(add3(V(0, 0, 0), V(x, y, z)));
    const at = (base, x, dy, z, blow) => { const p = add3(base, V(x - blow * hb, dy, z)); return pr(p); };
    const pts = [at(hd, -.062, .01, hz * .4, 0), at(hd, -.07, -.05, hz, .01), at(nk, -.085, -.02, hz, .03), at(j.chest, -.08, .02, hz, .06), at(j.chest, -.055, -.07, hz, .09), at(j.chest, -.01, -.12 + hb * .03, hz, .12),
      at(j.chest, .03, -.1 + hb * .02, hz, .11), at(j.chest, .07, -.04, hz, .08), at(nk, .085, -.03, hz, .04), at(hd, .07, -.05, hz, .01), at(hd, .062, .01, hz * .4, 0), at(hd, 0, .06, hz * .4, 0)];
    const z = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    parts.push({ z: z + (fwd[2] > 0 ? -.03 : .03), hairP: spline(pts.map(p => [p[0], p[1]]), 5, true), col: look.hair });
  }
  parts.sort((a, b) => b.z - a.z);
  const prims = []; let si = 0;
  const light = (poly) => { let sx = 0, sy = 0; for (const p of poly) { sx += p[0]; sy += p[1]; } return [sx / poly.length, sy / poly.length]; };
  for (const p of parts) {
    si++; const sd = seed + si * 17;
    if (p.head) {
      const { c, r, fwd } = p, circ = ellipse(c[0], c[1], r * .93, r, 20);
      prims.push({ k: 'knock', poly: circ });
      const hair = rough(ellipse(c[0] - fwd[0] * r * .06, c[1] - r * .04, r * 1.02 * (look.hairVol ?? 1), r * 1.04 * (look.hairVol ?? 1), 20), r * (look.curly ? .12 : .05), sd, Math.max(3, r * .22), .08);
      const faceAmt = clamp(.45 - fwd[2]);           // 背对 = 0
      prims.push({ k: 'wash', poly: circ, col: look.skin, a: .5, seed: sd, dx: lw * .5 });
      prims.push({ k: 'knock', poly: hair, a: .5 }, { k: 'wash', poly: hair, col: look.hair, a: .8, seed: sd + 1, j: 1.2 });
      if (faceAmt > .05) {
        const fx = c[0] + fwd[0] * r * .42, fy = c[1] + r * (.22 + .12 * clamp(-fwd[2])), fr = r * (.55 + .22 * clamp(-fwd[2]));
        const face = ellipse(fx, fy, fr, r * .72, 16).map(([x, y]) => { const dx = x - c[0], dy = y - c[1], d = Math.hypot(dx, dy), m = r * .95; return d > m ? [c[0] + dx / d * m, c[1] + dy / d * m] : [x, y]; });
        prims.push({ k: 'knock', poly: face, a: .97 * clamp(faceAmt * 2) }, { k: 'wash', poly: face, col: look.skin, a: .48, seed: sd + 2 });
        if (Math.abs(fwd[0]) > .5) prims.push({ k: 'ink', st: penStroke([[fx + fwd[0] * fr * .9, fy - r * .25], [fx + fwd[0] * fr * 1.12, fy - r * .02], [fx + fwd[0] * fr * .95, fy + r * .12]], { w: lw * .8, wob: lw * .2, seed: sd + 3, over: 1 }) });   // 侧脸鼻子
      }
      prims.push({ k: 'ink', st: penStroke(hair.slice(0, Math.ceil(hair.length * .7)), { w: lw, wob: lw * .35, seed: sd + 4, smooth: false, over: lw * 2 }) });
      prims.push({ k: 'ink', st: penStroke(circ.slice(1, 9), { w: lw * .9, wob: lw * .3, seed: sd + 5, smooth: false, over: lw }) });
      if (look.curly) for (let k = 0; k < 9; k++) { const a = -3.1 + k * .42 + n2(k, 3) * .3, rr = r * (.45 + n2(k, 7) * .5); const cxx = c[0] + Math.cos(a) * rr, cyy = c[1] + Math.sin(a) * rr * .9 - r * .05, cr = r * (.08 + n2(k, 9) * .08); prims.push({ k: 'ink', st: penStroke([...Array(7)].map((_, i) => { const t = -.5 + i / 6 * 4.2; return [cxx + Math.cos(t) * cr, cyy + Math.sin(t) * cr * .8]; }), { w: lw * .55, wob: lw * .15, seed: sd + 10 + k, smooth: true, over: 0 }), alpha: .75 }); }
      else for (let k = 0; k < 4; k++) { const a0 = -2.7 + k * .45; const arc = [...Array(6)].map((_, i) => { const a = a0 + i * .2; return [c[0] + Math.cos(a) * r * (.9 - i * .05), c[1] + Math.sin(a) * r * (.9 - i * .04) + i * r * .05]; }); prims.push({ k: 'ink', st: penStroke(arc, { w: lw * .7, wob: lw * .3, seed: sd + 20 + k, over: 1 }), alpha: .8 }); }
      continue;
    }
    if (p.torsoP) {
      const T = p.torsoP, poly = T.poly;
      prims.push({ k: 'knock', poly }, { k: 'wash', poly, col: p.col, a: .6, seed: sd, dx: lw * .8, dy: lw * .4 });
      const dk = (T.R[0][0] + T.R[0][1]) > (T.L[0][0] + T.L[0][1]) ? T.R : T.L, lt = dk === T.R ? T.L : T.R;
      const band = [...dk, ...dk.map((q, i) => [lerp(q[0], lt[i][0], .38), lerp(q[1], lt[i][1], .38)]).reverse()];
      prims.push({ k: 'wash', poly: spline(band, 3, true), col: shadeCol(p.col), a: .3, seed: sd + 2, j: 2.5 });
      prims.push({ k: 'ink', st: penStroke(lt, { w: lw * .9, wob: lw * .4, seed: sd, gap: .35, over: lw * 2 }) });
      prims.push({ k: 'ink', st: penStroke(dk, { w: lw * 1.1, wob: lw * .4, seed: sd + 1, over: lw * 2 }) });
      const tl = lt[lt.length - 2], tr2 = dk[dk.length - 2];
      prims.push({ k: 'ink', st: penStroke([lt[lt.length - 3], tl, [lerp(tl[0], tr2[0], .3), lerp(tl[1], tr2[1], .3) - lw]], { w: lw * .9, wob: lw * .3, seed: sd + 3, over: lw }) });
      prims.push({ k: 'ink', st: penStroke([dk[dk.length - 3], tr2, [lerp(tr2[0], tl[0], .3), lerp(tr2[1], tl[1], .3) - lw]], { w: lw * .9, wob: lw * .3, seed: sd + 4, over: lw }) });
      const m0 = [lerp(T.L[1][0], T.R[1][0], .45), lerp(T.L[1][1], T.R[1][1], .45)], m1 = [lerp(T.L[3][0], T.R[3][0], .5), lerp(T.L[3][1], T.R[3][1], .5)];
      prims.push({ k: 'ink', st: penStroke([m0, [lerp(m0[0], m1[0], .5) + lw, lerp(m0[1], m1[1], .5)], m1], { w: lw * .6, wob: lw * .4, seed: sd + 5, over: 0, gap: .6 }), alpha: .55 });
      if (p.straps) for (const s of ['L', 'R']) { const top = pr(midBack), sh2 = P('sh' + s); prims.push({ k: 'ink', st: penStroke([[lerp(top[0], sh2[0], .5), top[1]], [lerp(top[0], sh2[0], .72), sh2[1] - lw * 2]], { w: lw * .8, wob: .3, seed: sd + 50 + (s === 'L' ? 0 : 1), over: 0 }) }); }
      continue;
    }
    if (p.hairP) {
      const poly = p.hairP;
      prims.push({ k: 'knock', poly }, { k: 'wash', poly, col: p.col, a: .78, seed: sd, j: 2 });
      const c = light(poly); prims.push({ k: 'wash', poly: poly.filter(([x, y]) => (x - c[0]) + (y - c[1]) * .3 > -2), col: mix3(p.col, [40, 30, 40], .45), a: .3, seed: sd + 1 });
      const n = poly.length; prims.push({ k: 'ink', st: penStroke(poly.slice(0, n * .55 | 0), { w: lw, wob: lw * .5, seed: sd + 2, over: lw * 2 }) }, { k: 'ink', st: penStroke(poly.slice(n * .5 | 0, n - 2), { w: lw * 1.05, wob: lw * .5, seed: sd + 3, over: lw * 2 }) });
      for (let k = 0; k < 5; k++) { const u = .2 + k * .15, top = [lerp(poly[1][0], poly[n - 5][0], u), lerp(poly[1][1], poly[n - 5][1], u)], tip = poly[(n * .42) | 0]; prims.push({ k: 'ink', st: penStroke([top, [lerp(top[0], tip[0], .5) + (k - 2) * lw * 1.5, lerp(top[1], tip[1], .5)], [lerp(top[0], tip[0], .85 + k * .02), lerp(top[1], tip[1], .85)]], { w: lw * .55, wob: lw * .6, seed: sd + 10 + k, over: 0, gap: .5 }), alpha: .7 }); }
      continue;
    }
    if (p.hand) { const a = Math.atan2(p.c2[1] - p.c[1], p.c2[0] - p.c[0]); const h = ellipse(p.c[0], p.c[1], p.r * 1.35, p.r * .85, 10).map(([x, y]) => { const dx = x - p.c[0], dy = y - p.c[1]; return [p.c[0] + dx * Math.cos(a) - dy * Math.sin(a), p.c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; }); prims.push({ k: 'knock', poly: h }, { k: 'wash', poly: h, col: p.col, a: .5, seed: sd }, { k: 'ink', st: penStroke(h.slice(0, 7), { w: lw * .8, wob: lw * .2, seed: sd, smooth: false, over: 1 }) }); continue; }
    if (p.poly) {   // 裙子
      const c = light(p.poly);
      prims.push({ k: 'knock', poly: p.poly }, { k: 'wash', poly: p.poly, col: p.col, a: .42, seed: sd, dx: lw, dy: lw * .5 });
      prims.push({ k: 'wash', poly: p.poly.map(([x, y]) => [lerp(c[0], x, .95) + (x - c[0]) * .0, y]).filter(([x, y]) => x + y * .6 > c[0] + c[1] * .6), col: shadeCol(p.col), a: .28, seed: sd + 5 });
      prims.push({ k: 'ink', st: penStroke([...p.poly, p.poly[0]], { w: lw, wob: lw * .4, seed: sd, gap: .5, smooth: false, over: lw * 2 }) });
      for (let k = 0; k < 3; k++) { const a = p.poly[(k + 1) * Math.floor(p.poly.length / 4)]; prims.push({ k: 'ink', st: penStroke([[lerp(c[0], a[0], .2), lerp(c[1], a[1], .1)], [lerp(c[0], a[0], .8), lerp(c[1], a[1], .85)]], { w: lw * .6, wob: lw * .3, seed: sd + 30 + k, over: 0 }), alpha: .6 }); }
      continue;
    }
    const T = tube(p.pts, p.rad);
    prims.push({ k: 'knock', poly: T.poly });
    prims.push({ k: 'wash', poly: T.poly, col: p.col, a: p.opt.hair ? .8 : .62, seed: sd, dx: lw * .7, dy: lw * .4 });
    // 背光面：离左上光源远的那一侧
    const n0 = T.L[0], m0 = T.R[0], dark = (m0[0] + m0[1]) > (n0[0] + n0[1]) ? T.R : T.L, lit = dark === T.R ? T.L : T.R;
    const sh = [...p.pts.map((q, i) => [lerp(q[0], dark[i][0], .5), lerp(q[1], dark[i][1], .5)]), ...dark.slice().reverse()];
    prims.push({ k: 'wash', poly: sh, col: shadeCol(p.col), a: p.opt.hair ? .35 : .3, seed: sd + 2, j: 1.2 });
    prims.push({ k: 'ink', st: penStroke(lit, { w: lw * .9, wob: lw * .35, seed: sd, gap: p.pts.length > 2 ? .4 : .15, over: lw * 2 }) });
    prims.push({ k: 'ink', st: penStroke(dark, { w: lw * 1.1, wob: lw * .35, seed: sd + 1, over: lw * 2 }) });
    if (p.opt.hair) for (let k = 0; k < 3; k++) { const u = .25 + k * .25; prims.push({ k: 'ink', st: penStroke(p.pts.map((q, i) => [lerp(T.L[i][0], T.R[i][0], u), lerp(T.L[i][1], T.R[i][1], u)]), { w: lw * .6, wob: lw * .6, seed: sd + 40 + k, over: 2 }), alpha: .7 }); }
    if (p.opt.torso) {
      const a = p.pts[0], b = p.pts[p.pts.length - 1];
      prims.push({ k: 'ink', st: penStroke([[lerp(a[0], b[0], .25) - p.rad[1] * .25, lerp(a[1], b[1], .25)], [lerp(a[0], b[0], .6) - p.rad[1] * .05, lerp(a[1], b[1], .62)]], { w: lw * .65, wob: lw * .3, seed: sd + 4, over: 1 }), alpha: .75 });
      if (p.opt.straps) for (const s of ['L', 'R']) { const top = pr(midBack), sh2 = P('sh' + s); prims.push({ k: 'ink', st: penStroke([[lerp(top[0], sh2[0], .55), top[1] + p.rad[2] * .1], [lerp(top[0], sh2[0], .8), sh2[1] + lw]], { w: lw * .8, wob: .3, seed: sd + 50 + (s === 'L' ? 0 : 1), over: 0 }) }); }
    }
  }
  prims.head = { c: hc, r: .063 * S, fwd };
  prims.hand = { L: P('haL'), R: P('haR') };
  return prims;
}
export function convexHull(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}

// ---------- 草帽：3D 帽檐 + 帽冠，任意翻转 ----------
// c: 中心 [x,y]，r: 帽檐半径（像素），rot: [绕 x, 绕 y, 绕 z]，col: 草黄
export const STRAW = hex('#d8ad5f'), BAND = hex('#4b4a6a');
export function hat(c, r, rot, o = {}) {
  const pitch = o.pitch ?? .28, lw = o.lw ?? Math.max(1.2, r * .035), seed = o.seed ?? 5;
  const tf = v => { let q = rx(v, rot[0]); q = rz(q, rot[2]); q = ry(q, rot[1]); q = rx(q, pitch); return [c[0] + q[0] * r, c[1] - q[1] * r, q[2]]; };
  const ring = (h, rr, n = 28, wob = 0) => [...Array(n)].map((_, i) => { const a = i / n * TAU, w = 1 + wob * Math.sin(a * 3 + 1); return tf(V(Math.cos(a) * rr * w, h, Math.sin(a) * rr * w)); });
  const brim = ring(0, 1, 36, .035), crownB = ring(.02, .5, 24), crownM = ring(.3, .47, 24), crownT = ring(.44, .34, 24), band = ring(.1, .505, 24);
  const upv = sub3(tf(V(0, 1, 0)), tf(V(0, 0, 0))); const topFacing = upv[2] < 0 ? 1 : 0; // 帽顶朝向镜头？
  const hull = pts => convexHull(pts.map(p => [p[0], p[1]]));
  const crownPoly = hull([...crownB, ...crownM, ...crownT]), brimPoly = brim.map(p => [p[0], p[1]]), bandPoly = hull([...band, ...ring(.2, .49, 24)]);
  const prims = [];
  const colA = o.color ?? 1;
  const shade = mix3(STRAW, [120, 80, 60], .4);
  const drawCrown = () => {
    prims.push({ k: 'knock', poly: crownPoly }, { k: 'wash', poly: crownPoly, col: STRAW, a: .62 * colA, seed, dx: lw * .6 });
    prims.push({ k: 'wash', poly: crownPoly.slice(Math.floor(crownPoly.length / 2)), col: shade, a: .3 * colA, seed: seed + 1 });
    prims.push({ k: 'knock', poly: bandPoly, a: .5 }, { k: 'wash', poly: bandPoly, col: BAND, a: .7 * colA, seed: seed + 2, j: 1 });
    prims.push({ k: 'ink', st: penStroke(crownPoly, { w: lw, wob: lw * .3, seed: seed + 3, over: lw * 2, smooth: false }) });
  };
  const drawBrim = () => {
    prims.push({ k: 'knock', poly: brimPoly }, { k: 'wash', poly: brimPoly, col: STRAW, a: .55 * colA, seed: seed + 4, dx: lw * .8, dy: lw * .4 });
    const under = brim.filter(p => p[2] < 0).map(p => [p[0], p[1]]);
    if (under.length > 4 && !topFacing) prims.push({ k: 'wash', poly: [...under, ...under.slice().reverse().map(p => [lerp(p[0], c[0], .25), lerp(p[1], c[1], .25)])], col: shade, a: .3 * colA, seed: seed + 5 });
    // 草编的短线纹理
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2; const p0 = tf(V(Math.cos(a) * .62, 0, Math.sin(a) * .62)), p1 = tf(V(Math.cos(a) * .92, 0, Math.sin(a) * .92)); prims.push({ k: 'ink', st: penStroke([[p0[0], p0[1]], [p1[0], p1[1]]], { w: lw * .5, wob: .3, seed: seed + 20 + i, over: 0 }), alpha: .5 }); }
    prims.push({ k: 'ink', st: penStroke([...brimPoly, brimPoly[0], brimPoly[1]], { w: lw, wob: lw * .35, seed: seed + 6, over: lw * 2, smooth: false, gap: .5 }) });
  };
  if (topFacing) { drawBrim(); drawCrown(); } else { drawCrown(); drawBrim(); }
  return prims;
}

// ---------- 手写字 ----------
// 从左到右"写出来"（按字宽裁切），p = 进度。字体用 OFL 手写体（Caveat / Reenie Beanie）
export function handwrite(ctx, text, x, y, size, p, o = {}) {
  if (p <= 0) return;
  ctx.save(); ctx.font = `${o.weight ?? 400} ${size}px ${o.font ?? 'Caveat'}`; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(text).width, a = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  ctx.beginPath(); ctx.rect(a - size, y - size * 1.4, (w + size) * clamp(p) + size * .2, size * 2.2); ctx.clip();
  ctx.fillStyle = rgba(o.col ?? INK, o.alpha ?? .92);
  if (o.rot) { ctx.translate(a, y); ctx.rotate(o.rot); ctx.fillText(text, 0, 0); } else ctx.fillText(text, a, y);
  ctx.restore();
  return w;
}

// ---------- 自行车（身体坐标，和骑车人共用投影）----------
export function bike(place, ph, col, o = {}) {
  const S = place.S, pr = projector(place.x, place.y, S, place.yaw ?? 0, place.pitch ?? .28), lw = Math.max(1, (o.lw ?? .0045) * S), seed = o.seed ?? 3;
  const P = (x, y, z) => { const q = pr(V(x, y, z)); return [q[0], q[1]]; };
  const wr = .19, rear = [0, wr, -.34], front = [0, wr, .34], bb = [0, .2, .02], seat = [0, .6, -.1], head = [0, .66, .26], bar = [0, .74, .3];
  const prims = [];
  const wheel = (c, sd) => { const pts = [...Array(20)].map((_, i) => { const a = i / 20 * TAU; return P(c[0], c[1] + Math.cos(a) * wr, c[2] + Math.sin(a) * wr); }); prims.push({ k: 'ink', st: penStroke([...pts, pts[0], pts[1]], { w: lw * 1.2, wob: lw * .3, seed: sd, smooth: true, over: lw }) });
    for (let k = 0; k < 3; k++) { const a = ph + k * TAU / 3; prims.push({ k: 'ink', st: penStroke([P(c[0], c[1], c[2]), P(c[0], c[1] + Math.cos(a) * wr * .9, c[2] + Math.sin(a) * wr * .9)], { w: lw * .45, wob: .2, seed: sd + k, over: 0 }), alpha: .6 }); } };
  wheel(rear, seed); wheel(front, seed + 10);
  const tube = (a, b, sd, w = 1) => prims.push({ k: 'ink', st: penStroke([P(...a), P(...b)], { w: lw * w, wob: lw * .25, seed: sd, over: lw * .5 }) });
  const frame = [P(...rear), P(...bb), P(...seat), P(...head), P(...bb)];
  prims.push({ k: 'wash', poly: [P(...rear), P(...bb), P(...head), P(...seat)], col, a: .0 });
  for (const [a, b] of [[rear, bb], [bb, seat], [seat, head], [bb, head], [rear, seat], [head, front], [head, bar]]) { const pa = P(...a), pb = P(...b); const w = 1.4; prims.push({ k: 'wash', poly: [[pa[0] - lw, pa[1] - lw], [pb[0] - lw, pb[1] - lw], [pb[0] + lw, pb[1] + lw], [pa[0] + lw, pa[1] + lw]], col, a: .8, j: .4, edge: 0 }); tube(a, b, seed + a[2] * 100 + b[1] * 10 | 0, w); }
  const cr = .085; for (const s of [0, Math.PI]) { const pd = [0, bb[1] + Math.sin(ph + s) * cr, bb[2] + Math.cos(ph + s) * cr]; tube(bb, pd, seed + 40 + s | 0, .8); }
  prims.push({ k: 'ink', st: penStroke([P(0, .62, -.17), P(0, .63, -.02)], { w: lw * 2.2, wob: .2, seed: seed + 50, over: 0 }) });
  prims.push({ k: 'ink', st: penStroke([P(-.1, .75, .28), P(.1, .75, .28)], { w: lw * 1.3, wob: .2, seed: seed + 51, over: 0 }) });
  return prims;
}

// ---------- 任意形状 → 钢笔淡彩 ----------
// poly: 闭合多边形（世界坐标）；col: [r,g,b]；o: { ink 线宽, wash 浓度, offset 错位, reserve 留白度, color 0..1（到达程度）, p 墨线进度 }
// 例：一颗暖橙色 #D97757 的四角光点 + 光标尾巴 —— 见 DEMO.md（Engine reference）
export function sketchShape(ctx, poly, col, o = {}) {
  const lw = o.ink ?? 2.4, off = o.offset ?? lw * .8, seed = o.seed ?? 1;
  const prims = [{ k: 'knock', poly, a: o.reserve ?? .9 }, { k: 'wash', poly, col, a: o.wash ?? .6, dx: off, dy: off * .5, seed, j: o.jitter ?? lw * 1.2, layers: 3, edge: .35 },
    { k: 'ink', st: penStroke([...poly, poly[0], poly[1]], { w: lw, wob: lw * .4, seed, over: lw * 2, gap: .5, smooth: o.smooth ?? true }) }];
  drawPrims(ctx, prims, { color: o.color ?? 1, ink: o.p ?? 1 });
  return prims;
}
export function sparkle(cx, cy, r, k = .22) {   // 四角星
  const P = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, rr = i % 2 ? r * k : r; P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return P;
}
