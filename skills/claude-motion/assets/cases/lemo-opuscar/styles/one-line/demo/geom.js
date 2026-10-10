// 一条路径：把各段 SVG path（各自的局部变换）按弧长采样，自动补切线连续的连接段，
// 再按"段时间窗 + 曲率减速 + 卡点/停笔"给每个点分配时间。整片只有这一条线。
import { vnoise, clamp, lerp } from '/core/lib.js';

const NS = 'http://www.w3.org/2000/svg';
let host;
function pathEl(d) {
  if (!host) {
    host = document.createElementNS(NS, 'svg');
    host.setAttribute('width', '0'); host.setAttribute('height', '0');
    host.style.position = 'absolute'; host.style.left = '-10px';
    document.body.appendChild(host);
  }
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); host.appendChild(p); return p;
}

export const STEP = 0.6;   // 采样间距（纸面单位）

export function sampleD(d, tf = {}, step = STEP) {
  const p = pathEl(d), L = p.getTotalLength();
  const s = tf.s ?? 1, r = (tf.r ?? 0) * Math.PI / 180, fx = tf.fx ?? 1, ox = tf.x ?? 0, oy = tf.y ?? 0;
  const c = Math.cos(r), sn = Math.sin(r);
  const n = Math.max(2, Math.ceil(L * s / step)); const out = [];
  for (let i = 0; i <= n; i++) {
    const q = p.getPointAtLength(L * i / n); const x = q.x * s * fx, y = q.y * s;
    out.push([ox + x * c - y * sn, oy + x * sn + y * c]);
  }
  return out;
}

function tangent(pts, atEnd) {
  const n = pts.length, k = Math.min(8, n - 1);
  const a = atEnd ? pts[n - 1 - k] : pts[0], b = atEnd ? pts[n - 1] : pts[k];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l];
}

// 连接段：三次 Hermite，端点切线与两段一致
function connector(a, ta, b, tb, step = STEP) {
  const D = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (D < 1.2) return [];
  const h = D * 0.42, p1 = [a[0] + ta[0] * h, a[1] + ta[1] * h], p2 = [b[0] - tb[0] * h, b[1] - tb[1] * h];
  const d = `M${a[0]},${a[1]} C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${b[0]},${b[1]}`;
  const pts = sampleD(d, {}, step); return pts.slice(1, -1);
}

// segs: [{id, style, t:[t0,t1], parts:[{d, tf}], marks:[{f,t}], holds:[{f,dur}], slowK}]
export function buildPath(segs) {
  const X = [], Y = [], SEG = [], PARTS = [];
  let prev = null;
  segs.forEach((sg, si) => {
    let pts = []; const pstart = [];
    for (const pt of sg.parts) {
      pstart.push(pts.length);
      const q = sampleD(pt.d, pt.tf || {});
      if (pts.length) { const c = connector(pts[pts.length - 1], tangent(pts, true), q[0], tangent(q, false)); pts = pts.concat(c); }
      pts = pts.concat(pts.length ? q.slice(1) : q);
    }
    let off = 0;
    if (prev) { const c = connector(prev.at(-1), tangent(prev, true), pts[0], tangent(pts, false)); pts = c.concat(pts); off = c.length; }
    const start = X.length ? 1 : 0;   // 去掉与上一段重合的首点
    const base = X.length, skip = (prev && Math.hypot(pts[0][0] - prev.at(-1)[0], pts[0][1] - prev.at(-1)[1]) < 0.05) ? 1 : 0;
    pstart.forEach((p, pi) => PARTS.push({ seg: si, part: pi, i: base + p + off - skip }));
    for (let i = skip; i < pts.length; i++) { X.push(pts[i][0]); Y.push(pts[i][1]); SEG.push(si); }
    prev = pts;
  });
  const N = X.length, S = new Float64Array(N);
  for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  // 每段的点范围
  const range = segs.map(() => [Infinity, -1]);
  for (let i = 0; i < N; i++) { const r = range[SEG[i]]; r[0] = Math.min(r[0], i); r[1] = Math.max(r[1], i); }
  // 转角（曲率）：前后 4 单位的方向差
  const TURN = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 6), b = Math.min(N - 1, i + 6), m = i;
    const d1 = Math.atan2(Y[m] - Y[a], X[m] - X[a]), d2 = Math.atan2(Y[b] - Y[m], X[b] - X[m]);
    let da = Math.abs(d2 - d1); if (da > Math.PI) da = 2 * Math.PI - da;
    TURN[i] = (a === m || b === m) ? 0 : da;
  }
  // 时间分配
  const T = new Float64Array(N);
  segs.forEach((sg, si) => {
    const [i0, i1] = range[si]; const K = sg.slowK ?? 2.2;
    const w = new Float64Array(i1 - i0 + 1);
    for (let i = i0 + 1; i <= i1; i++) w[i - i0] = (S[i] - S[i - 1]) * (1 + K * Math.min(TURN[i] * 3.2, 3));
    // 平滑权重，避免速度跳变
    const ws = new Float64Array(w.length), R = 14;
    for (let j = 0; j < w.length; j++) { let a = 0, c = 0; for (let k = -R; k <= R; k++) { const q = j + k; if (q > 0 && q < w.length) { const g = 1 - Math.abs(k) / (R + 1); a += w[q] * g; c += g; } } ws[j] = j === 0 ? 0 : a / c; }
    const cum = new Float64Array(w.length); for (let j = 1; j < w.length; j++) cum[j] = cum[j - 1] + ws[j];
    const L = S[i1] - S[i0];
    // 卡点：f（段内弧长比例）→ t；停笔 = 同一 f 上两个卡点
    const keys = [{ f: 0, t: sg.t[0] }];
    const ev = [];
    // 卡点可以写成比例 f，或写成位置 at:[x,y]（第 n 次经过该点附近，半径 r）
    const fAt = (at, n = 1, r = 4) => { let cnt = 0, inside = false; for (let i = i0; i <= i1; i++) { const d = Math.hypot(X[i] - at[0], Y[i] - at[1]); if (d < r && !inside) { cnt++; inside = true; if (cnt === n) { let j = i, best = d; while (j + 1 <= i1 && Math.hypot(X[j + 1] - at[0], Y[j + 1] - at[1]) < best) { j++; best = Math.hypot(X[j] - at[0], Y[j] - at[1]); } return (S[j] - S[i0]) / L; } } if (d > r * 2) inside = false; } console.warn('mark not found', at); return null; };
    (sg.marks || []).forEach(m => { const ff = m.at ? fAt(m.at, m.n, m.r) : m.f; if (ff != null) ev.push({ f: ff, t: m.t }); });
    sg.markF = ev.map(e => e.f);
    (sg.holds || []).forEach(h => { ev.push({ f: h.f, t: h.t }); ev.push({ f: h.f + 1e-6, t: h.t + h.dur }); });
    ev.sort((a, b) => a.f - b.f).forEach(e => keys.push(e));
    keys.push({ f: 1, t: sg.t[1] });
    // f → 累计权重位置
    const idxAtF = f => { const target = S[i0] + f * L; let lo = i0, hi = i1; while (lo < hi) { const md = (lo + hi) >> 1; if (S[md] < target) lo = md + 1; else hi = md; } return lo; };
    for (let k = 0; k < keys.length - 1; k++) {
      const a = keys[k], b = keys[k + 1];
      const ia = idxAtF(a.f), ib = idxAtF(b.f);
      const ca = cum[ia - i0], cb = cum[ib - i0];
      for (let i = ia; i <= ib; i++) T[i] = cb > ca ? lerp(a.t, b.t, (cum[i - i0] - ca) / (cb - ca)) : b.t;
      if (ib === ia) { T[ia] = a.t; if (ib + 1 <= i1) T[ib + 1] = Math.max(T[ib + 1], b.t); }
    }
  });
  for (let i = 1; i < N; i++) if (T[i] < T[i - 1]) T[i] = T[i - 1];
  // 速度（单位/秒）
  const V = new Float64Array(N);
  for (let i = 1; i < N - 1; i++) { const dt = T[i + 1] - T[i - 1]; V[i] = dt > 1e-6 ? (S[i + 1] - S[i - 1]) / dt : 0; }
  V[0] = V[1]; V[N - 1] = V[N - 2];
  return { X, Y, S, T, V, SEG, TURN, N, range, segs, PARTS };
}

// 时间 → 笔尖位置（点下标 + 小数）
export function headAt(P, t) {
  const { T, N } = P;
  if (t <= T[0]) return 0;
  if (t >= T[N - 1]) return N - 1;
  let lo = 0, hi = N - 1; while (lo < hi - 1) { const md = (lo + hi) >> 1; if (T[md] <= t) lo = md; else hi = md; }
  const dt = T[hi] - T[lo]; return lo + (dt > 1e-9 ? (t - T[lo]) / dt : 1);
}
export function posAt(P, h) {
  const i = Math.floor(h), f = h - i, j = Math.min(P.N - 1, i + 1);
  return [lerp(P.X[i], P.X[j], f), lerp(P.Y[i], P.Y[j], f)];
}
