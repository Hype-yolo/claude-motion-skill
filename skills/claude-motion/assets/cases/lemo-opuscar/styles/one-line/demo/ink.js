// 墨线渲染：路径 + 笔压（快细慢粗）+ 边缘微毛 + 慢处积墨 + 老年颤抖/飞白 + 唯一一段红线
import { vnoise, clamp, lerp } from '/core/lib.js';

export const PAPER = [244, 239, 228];
export const INK = [29, 26, 23];
export const RED = [179, 51, 43];

const STY = {
  child: { w: 2.4, a: .82 },
  teen: { w: 2.5, a: .88 },
  adult: { w: 2.9, a: .96 },
  love: { w: 2.8, a: .96 },
  old: { w: 2.7, a: .93 },
  kid: { w: 2.0, a: .76 },
};

// 预计算每个点的样式（一旦画上纸就不再变）
export function prepare(P) {
  const { N, S, SEG, segs, range } = P;
  const W0 = new Float64Array(N), A0 = new Float64Array(N), RED_ = new Float64Array(N), TR = new Float64Array(N), DRY = new Float64Array(N), WOB = new Float64Array(N);
  const segOf = id => segs.findIndex(s => s.id === id);
  for (let i = 0; i < N; i++) { const st = STY[segs[SEG[i]].style] || STY.adult; W0[i] = st.w; A0[i] = st.a; }
  // 样式在段边界处平滑过渡（约 ±60 单位）
  const smooth = (arr, R) => { const out = new Float64Array(N); let acc = 0, lo = 0, hi = -1; for (let i = 0; i < N; i++) { while (hi < N - 1 && S[hi + 1] <= S[i] + R) acc += arr[++hi]; while (S[lo] < S[i] - R) acc -= arr[lo++]; out[i] = acc / (hi - lo + 1); } return out; };
  const W = smooth(W0, 60), A = smooth(A0, 60);
  // 红线：从初恋段下坠途中渐红，到房子段的法令纹上渐回墨色
  const li = segOf('love'), hi_ = segOf('house');
  if (li >= 0) {
    const [a, b] = range[li];
    // 红从嘴角开始：找离左嘴角最近的点
    let kc = a, best = 1e9; for (let i = a; i <= b; i++) { const d = Math.hypot(P.X[i] + 138, P.Y[i] - 212); if (d < best) { best = d; kc = i; } }
    for (let i = a; i <= b; i++) RED_[i] = clamp((S[i] - (S[kc] - 12)) / 34);
    if (hi_ >= 0) { const [c, d] = range[hi_]; for (let i = c; i <= d; i++) RED_[i] = 1 - clamp((S[i] - S[c] + 6) / 30); }
  }
  // 老年：颤抖 + 飞白逐渐加重
  const oi = segOf('old');
  if (oi >= 0) {
    const [a, b] = range[oi]; const sA = S[a], L = S[b] - sA;
    for (let i = a; i <= b; i++) { const u = (S[i] - sA) / L; TR[i] = clamp((S[i] - sA) / 90) * (0.75 + 0.6 * u) * (1 - 0.5 * clamp((u - .8) / .15)); DRY[i] = (0.12 + 0.4 * u) * (1 - 0.75 * clamp((u - .8) / .12)); }
  }
  const ki = segOf('kid');
  if (ki >= 0) { const [a, b] = range[ki]; for (let i = a; i <= b; i++) WOB[i] = clamp((S[i] - S[a]) / 40); }
  // 位移：老年高频颤抖（垂直于路径）；孩子低频歪扭
  const X = P.X.slice(), Y = P.Y.slice();
  for (let i = 1; i < N - 1; i++) {
    if (!TR[i] && !WOB[i]) continue;
    const dx = P.X[i + 1] - P.X[i - 1], dy = P.Y[i + 1] - P.Y[i - 1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const s = S[i];
    const tr = TR[i] * 1.05 * ((vnoise(s / 5.5) - .5) * 1.6 + (vnoise(s / 2.3 + 40) - .5) * .7);
    const wb = WOB[i] * 3.2 * ((vnoise(s / 26 + 90) - .5) * 2 + (vnoise(s / 9 + 13) - .5) * .8);
    X[i] += nx * (tr + wb); Y[i] += ny * (tr + wb);
  }
  P.DX = X; P.DY = Y;
  // 线宽：年龄基准 × 笔压（速度）× 细噪声
  const WID = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const v = P.V[i], pr = 0.66 + 0.8 * Math.exp(-v / 300);
    WID[i] = W[i] * pr * (1 + 0.16 * (vnoise(S[i] / 3.1 + 7) - .5));
  }
  // 颜色（与纸混合成不透明色）
  const COL = new Array(N);
  for (let i = 0; i < N; i++) {
    const base = [lerp(INK[0], RED[0], RED_[i]), lerp(INK[1], RED[1], RED_[i]), lerp(INK[2], RED[2], RED_[i])];
    const a = A[i]; COL[i] = [lerp(PAPER[0], base[0], a), lerp(PAPER[1], base[1], a), lerp(PAPER[2], base[2], a)];
  }
  Object.assign(P, { WID, COL, RED: RED_, DRY, A });
  // 停笔处的墨点（失去）
  P.blots = [];
  segs.forEach((sg, si) => (sg.holds || []).forEach(h => {
    const [a, b] = range[si]; const target = S[a] + h.f * (S[b] - S[a]); let k = a; while (k < b && S[k] < target) k++;
    P.blots.push({ k, t0: h.t, dur: h.dur, r: 9.5 });
  }));
  return P;
}

const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// 在 ctx 上画出 [0, head] 的线。M = 世界 → 屏幕的变换函数，k = 每单位像素
export function drawLine(ctx0, P, head, M, k, opts = {}) {
  let ctx = ctx0;
  const n = Math.min(P.N - 1, Math.floor(head)); if (n < 1) return;
  const X = P.DX, Y = P.DY, WID = P.WID, COL = P.COL, DRY = P.DRY;
  const f = head - n;
  const kw = Math.max(k, 1.3);   // 线宽用的缩放：拉远时不再变细
  // 屏幕坐标
  const sx = new Float32Array(n + 2), sy = new Float32Array(n + 2);
  for (let i = 0; i <= n; i++) { const p = M(X[i], Y[i]); sx[i] = p[0]; sy[i] = p[1]; }
  let m = n;
  if (f > 0 && n + 1 < P.N) { const p = M(lerp(X[n], X[n + 1], f), lerp(Y[n], Y[n + 1], f)); sx[n + 1] = p[0]; sy[n + 1] = p[1]; m = n + 1; }
  const idx = i => Math.min(i, n);
  // 法线
  const nx = new Float32Array(m + 1), ny = new Float32Array(m + 1);
  for (let i = 0; i <= m; i++) {
    const a = Math.max(0, i - 1), b = Math.min(m, i + 1); let dx = sx[b] - sx[a], dy = sy[b] - sy[a]; const l = Math.hypot(dx, dy) || 1; nx[i] = -dy / l; ny[i] = dx / l;
  }
  // 屏幕外裁剪：只画可见附近的点段
  const Wd = ctx.canvas.width, Ht = ctx.canvas.height, mg = 60;
  const vis = new Uint8Array(m + 1);
  for (let i = 0; i <= m; i++) vis[i] = (sx[i] > -mg && sx[i] < Wd + mg && sy[i] > -mg && sy[i] < Ht + mg) ? 1 : 0;
  // 头部笔尖处线宽略收（笔刚到）
  const wAt = (i, scale) => {
    let w = WID[idx(i)] * kw * scale;
    const back = (m - i) * 0.6; if (back < 3) w *= 0.75 + 0.25 * back / 3;
    return Math.max(w, 0.6);
  };
  // 按颜色/可见性/飞白断墨切成若干 run，每个 run 填一个多边形
  function runs(pass) {
    const out = []; let cur = null;
    for (let i = 0; i <= m; i++) {
      const ii = idx(i);
      let on = vis[i] || (i > 0 && vis[i - 1]) || (i < m && vis[i + 1]);
      if (on && DRY[ii] > 0 && pass.strand == null) {
        // 老年断墨：长尺度噪声决定断点
        const g = vnoise(P.S[ii] / 23 + 3.7) * .7 + vnoise(P.S[ii] / 7 + 9) * .3;
        if (g < DRY[ii] * 0.36) on = false;
      }
      if (on && pass.strand != null) {
        const g = vnoise(P.S[ii] / (9 + pass.strand * 3) + pass.strand * 17.3);
        if (g < 0.2 + DRY[ii] * 0.35) on = false;
      }
      const ck = COL[ii]; const key = ((ck[0] / 6) | 0) * 10000 + ((ck[1] / 6) | 0) * 100 + ((ck[2] / 6) | 0);
      if (!on) { if (cur) { out.push(cur); cur = null; } continue; }
      if (!cur) cur = { a: i, b: i, key };
      else if (key !== cur.key) { cur.b = i; out.push(cur); cur = { a: i, b: i, key }; }
      else cur.b = i;
    }
    if (cur) out.push(cur);
    return out;
  }
  function fillRun(r, scale, offset, colorFn) {
    if (r.b <= r.a) return;
    ctx.beginPath();
    for (let i = r.a; i <= r.b; i++) { const w = wAt(i, scale) / 2, o = offset ? offset * wAt(i, 1) : 0; ctx.lineTo(sx[i] + nx[i] * (w + o), sy[i] + ny[i] * (w + o)); }
    for (let i = r.b; i >= r.a; i--) { const w = wAt(i, scale) / 2, o = offset ? offset * wAt(i, 1) : 0; ctx.lineTo(sx[i] - nx[i] * (w - o), sy[i] - ny[i] * (w - o)); }
    ctx.closePath(); ctx.fillStyle = colorFn(COL[idx(r.a)]); ctx.fill();
    // 圆头
    for (const i of [r.a, r.b]) { const w = wAt(i, scale) / 2; ctx.beginPath(); ctx.arc(sx[i] + nx[i] * (offset ? offset * wAt(i, 1) : 0), sy[i] + ny[i] * (offset ? offset * wAt(i, 1) : 0), w, 0, Math.PI * 2); ctx.fill(); }
  }
  const core = c => rgb(c);
  // 1 晕边（墨渗进纸纤维）：离屏画一遍加宽的线，整体模糊后低透明度叠回
  const R0 = runs({});
  if (!drawLine.halo) { drawLine.halo = document.createElement('canvas'); drawLine.halo.width = Wd; drawLine.halo.height = Ht; }
  const hc = drawLine.halo, hx = hc.getContext('2d'); hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, Wd, Ht);
  const main = ctx; ctx = hx;
  for (const r of R0) fillRun(r, 1.0 + 1.6 / Math.max(1, WID[idx(r.a)]), 0, core);
  ctx = main;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = .22; ctx.filter = `blur(${Math.max(.6, k * .9).toFixed(2)}px)`; ctx.drawImage(hc, 0, 0); ctx.restore();
  // 2 主体
  for (const r of R0) fillRun(r, 1.0, 0, core);
  // 3 老年飞白：几根笔毫轨迹穿过断墨处
  if (P.DRY[idx(m)] > 0 || opts.allDry) for (let s = 0; s < 3; s++) {
    const R = runs({ strand: s }).filter(r => DRY[idx(r.a)] > 0);
    const off = [-0.32, 0.05, 0.36][s];
    for (const r of R) fillRun(r, 0.28, off, core);
  }
  // 慢处积墨：速度很低的点加圆墨点
  ctx.fillStyle = rgb(INK);
  for (let i = 0; i <= n; i += 2) {
    if (!vis[i]) continue; const v = P.V[i]; if (v > 45) continue;
    const w = WID[i] * kw * (0.62 + 0.3 * (1 - v / 45)); ctx.fillStyle = core(COL[i]); ctx.beginPath(); ctx.arc(sx[i], sy[i], w, 0, Math.PI * 2); ctx.fill();
  }
  return { tip: [sx[m], sy[m]], dir: [sx[m] - sx[Math.max(0, m - 6)], sy[m] - sy[Math.max(0, m - 6)]] };
}

// 失去：停笔处墨点慢慢洇开（泪滴形：尖朝上贴着停笔点，圆肚往下坠；带深色水线和不规则边）
export function drawBlots(ctx, P, t, M, k) {
  for (const b of P.blots) {
    if (t < b.t0) continue;
    const u = clamp((t - b.t0) / b.dur), g = 1 - Math.pow(1 - u, 2.2);
    const R = (P.WID[b.k] * 0.7 + b.r * g) * k, c0 = M(P.DX[b.k], P.DY[b.k]);
    const drop = g * 0.9;                       // 越洇越往下坠
    const c = [c0[0], c0[1] + R * (0.25 + drop)];
    const pts = []; const n = 90;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2; let x = Math.cos(a), y = Math.sin(a);
      const up = Math.pow(Math.max(0, -y), 1.6) * drop;       // 上半部拉成尖
      x *= 1 - 0.72 * up; y *= 1 + 0.95 * up;
      const rr = R * (0.9 + 0.16 * vnoise(i * 0.37 + 5) + 0.08 * vnoise(i * 1.3 + 20) * g);
      pts.push([c[0] + x * rr, c[1] + y * rr]);
    }
    ctx.beginPath(); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath();
    const gr = ctx.createRadialGradient(c[0], c[1] + R * .2, 0, c[0], c[1], R * 1.25);
    gr.addColorStop(0, 'rgba(29,26,23,0.82)'); gr.addColorStop(0.7, 'rgba(29,26,23,0.66)'); gr.addColorStop(0.9, 'rgba(22,19,17,0.95)'); gr.addColorStop(1, 'rgba(22,19,17,0.7)');
    ctx.fillStyle = gr; ctx.fill();
  }
}
