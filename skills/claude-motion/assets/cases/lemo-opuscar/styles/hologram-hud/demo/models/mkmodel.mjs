// 线框模型构建工具：几何基本体 → {v, e, q}（顶点 / 边 / 四边面）
// 输出格式（engine/holo.js 读取）：
// { name, parts: [{ id, anchor:[x,y,z], pieces: [{ id, v:[x,y,z,...], e:[a,b,...], q:[a,b,c,d,...], explode:[dx,dy,dz], axis?:{c,d} }] }] }
const TAU = Math.PI * 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
function basis(d) {
  d = norm(d);
  const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(d, ref)), w = cross(d, u);
  return [d, u, w];
}

export class Model {
  constructor(name) { this.name = name; this.parts = []; }
  part(id, o = {}) { this.P = { id, anchor: o.anchor || [0, 0, 0], ...(o.center ? { center: o.center } : {}), ...(o.tagDir ? { tagDir: o.tagDir } : {}), pieces: [] }; this.parts.push(this.P); }
  piece(id, o = {}) { this.C = { id, v: [], e: [], q: [], explode: o.explode || [0, 0, 0] }; if (o.axis) this.C.axis = o.axis; if (o.internal) this.C.internal = true; if (o.box === false) this.C.box = false; if (o.hot) this.C.hot = true; this.P.pieces.push(this.C); }
  vtx(p) { this.C.v.push(p); return this.C.v.length - 1; }
  edge(a, b) { this.C.e.push([a, b]); }
  quad(a, b, c, d) { this.C.q.push([a, b, c, d]); }
  // 圆环（可选厚度：两道圈 + 连线）
  circle(c, n, r, seg, [u, w] = basis(n).slice(1), a0 = 0, a1 = TAU, closed = true) {
    const ids = [];
    const cnt = closed ? seg : seg + 1;
    for (let i = 0; i < cnt; i++) { const a = a0 + (a1 - a0) * i / seg; ids.push(this.vtx(add(c, add(mul(u, Math.cos(a) * r), mul(w, Math.sin(a) * r))))); }
    for (let i = 0; i < ids.length - (closed ? 0 : 1); i++) this.edge(ids[i], ids[(i + 1) % ids.length]);
    return ids;
  }
  ring(c, n, r, seg, width = 0) {
    if (!width) return this.circle(c, n, r, seg);
    const d = norm(n);
    const A = this.circle(add(c, mul(d, -width / 2)), n, r, seg), B = this.circle(add(c, mul(d, width / 2)), n, r, seg);
    for (let i = 0; i < seg; i++) { if (i % 4 === 0) this.edge(A[i], B[i]); this.quad(A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]); }
    return [A, B];
  }
  // 管子：环 + 纵线 + 面；arc = [起, 止]（以圈为单位，可只做半圈）；zA 起点 z 偏移（叉子外张）
  tube(a, b, r, o = {}) {
    const rings = o.rings || 6, seg = o.seg || 10, longs = o.longs || 4;
    if (o.zA) a = add(a, [0, 0, o.zA]);
    const [d, u, w] = basis(sub(b, a));
    const arc = o.arc || [0, 1], full = arc[1] - arc[0] >= 1 - 1e-6;
    const segN = full ? seg : Math.max(2, Math.round(seg * (arc[1] - arc[0])));
    const R = [];
    for (let k = 0; k < rings; k++) {
      const c = lerp3(a, b, k / (rings - 1));
      R.push(this.circle(c, d, r, segN, [u, w], arc[0] * TAU, arc[1] * TAU, full));
    }
    const m = R[0].length;
    for (let k = 0; k < rings - 1; k++) for (let i = 0; i < m - (full ? 0 : 1); i++) this.quad(R[k][i], R[k][(i + 1) % m], R[k + 1][(i + 1) % m], R[k + 1][i]);
    const step = Math.max(1, Math.floor(m / longs));
    for (let i = 0; i < m; i += step) for (let k = 0; k < rings - 1; k++) this.edge(R[k][i], R[k + 1][i]);
    if (!full) for (const i of [0, m - 1]) for (let k = 0; k < rings - 1; k++) this.edge(R[k][i], R[k + 1][i]);
    return R;
  }
  polyTube(pts, r, o = {}) {
    for (let i = 0; i < pts.length - 1; i++) this.tube(pts[i], pts[i + 1], r, { rings: o.ringsPer || 3, seg: o.seg || 8, longs: o.longs || 3 });
  }
  box(c, s) {
    const [hx, hy, hz] = s.map(x => x / 2), ids = [];
    for (const z of [-hz, hz]) for (const y of [-hy, hy]) for (const x of [-hx, hx]) ids.push(this.vtx([c[0] + x, c[1] + y, c[2] + z]));
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [a, b] of E) this.edge(ids[a], ids[b]);
    const F = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
    for (const f of F) this.quad(...f.map(i => ids[i]));
  }
  disc(c, n, r, o = {}) {
    const rs = o.rings || [r], seg = o.seg || 16, R = rs.map(x => this.circle(c, n, x, seg));
    for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < seg; i++) { this.quad(R[k][i], R[k][(i + 1) % seg], R[k + 1][(i + 1) % seg], R[k + 1][i]); if (i % 4 === 0) this.edge(R[k][i], R[k + 1][i]); }
  }
  saddle(c) {
    // 由 5 道截面环组成的座垫
    const secs = [[-0.13, 0.075, 0.018], [-0.08, 0.08, 0.024], [-0.01, 0.06, 0.022], [0.06, 0.028, 0.016], [0.12, 0.018, 0.012]];
    const seg = 12, R = [];
    for (const [x, hw, hh] of secs) {
      const ids = [];
      for (let i = 0; i < seg; i++) { const a = i / seg * TAU; ids.push(this.vtx([c[0] + x, c[1] + Math.sin(a) * hh + hh * 0.3, c[2] + Math.cos(a) * hw])); }
      for (let i = 0; i < seg; i++) this.edge(ids[i], ids[(i + 1) % seg]);
      R.push(ids);
    }
    for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < seg; i++) { this.quad(R[k][i], R[k][(i + 1) % seg], R[k + 1][(i + 1) % seg], R[k + 1][i]); if (i % 3 === 0) this.edge(R[k][i], R[k + 1][i]); }
  }
  fender(c, r, w, a0, a1, front) {
    const seg = 30, A = [], B = [], M = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * i / seg, x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r;
      const rr = r + 0.012;
      A.push(this.vtx([x, y, -w / 2])); B.push(this.vtx([x, y, w / 2])); M.push(this.vtx([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, 0]));
    }
    for (let i = 0; i < seg; i++) { this.edge(A[i], A[i + 1]); this.edge(B[i], B[i + 1]); this.edge(M[i], M[i + 1]); this.quad(A[i], A[i + 1], M[i + 1], M[i]); this.quad(M[i], M[i + 1], B[i + 1], B[i]); if (i % 5 === 0) { this.edge(A[i], M[i]); this.edge(M[i], B[i]); } }
    this.edge(A[0], M[0]); this.edge(M[0], B[0]); this.edge(A[seg], M[seg]); this.edge(M[seg], B[seg]);
  }
  wheel(c, R, o) {
    const n = [0, 0, 1];
    // 胎：3 道环（外径 + 两侧胎壁）+ 横纹
    const tw = 0.022, seg = 72;
    const T0 = this.circle([c[0], c[1], -tw], n, R - 0.02, seg), T1 = this.circle(c, n, R, seg), T2 = this.circle([c[0], c[1], tw], n, R - 0.02, seg);
    for (let i = 0; i < seg; i++) { this.quad(T0[i], T0[(i + 1) % seg], T1[(i + 1) % seg], T1[i]); this.quad(T1[i], T1[(i + 1) % seg], T2[(i + 1) % seg], T2[i]); if (i % 3 === 0) { this.edge(T0[i], T1[i]); this.edge(T1[i], T2[i]); } }
    // 轮圈
    const r1 = R - 0.045, r2 = R - 0.07;
    const A = this.circle([c[0], c[1], -0.012], n, r1, 60), B = this.circle([c[0], c[1], 0.012], n, r1, 60), C = this.circle(c, n, r2, 60);
    for (let i = 0; i < 60; i++) { this.quad(A[i], A[(i + 1) % 60], C[(i + 1) % 60], C[i]); this.quad(C[i], C[(i + 1) % 60], B[(i + 1) % 60], B[i]); }
    // 辐条
    const k = o.spokes, rf = o.spokeFrom;
    for (let i = 0; i < k; i++) {
      const s = i % 2 ? 1 : -1, a = i / k * TAU, a2 = a + (s > 0 ? 0.35 : -0.35);
      const p = this.vtx([c[0] + Math.cos(a) * rf, c[1] + Math.sin(a) * rf, 0.03 * s]);
      const q = this.vtx([c[0] + Math.cos(a2) * r2, c[1] + Math.sin(a2) * r2, 0]);
      this.edge(p, q);
    }
    if (o.hub) { this.tube([c[0], c[1], -0.045], [c[0], c[1], 0.045], o.hub, { rings: 3, seg: 12, longs: 6 }); }
  }
  beltLines(a, ra, b, rb) {
    for (const s of [1, -1]) { const p = this.vtx([a[0], a[1] + ra * s, a[2]]), q = this.vtx([b[0], b[1] + rb * s, b[2]]); this.edge(p, q); }
  }
  // 电池电芯：沿下管排两行圆柱
  cells(a, b, r, n, rows) {
    const [d, u, w] = basis(sub(b, a)), L = len(sub(b, a)), cl = L / n * 0.86;
    for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) {
      const c = add(lerp3(a, b, (i + 0.5) / n), mul(w, (row - (rows - 1) / 2) * r * 0.95));
      const p0 = add(c, mul(d, -cl / 2)), p1 = add(c, mul(d, cl / 2));
      this.tube(p0, p1, r * 0.46, { rings: 2, seg: 10, longs: 3 });
    }
  }
  board(a, b, t0, t1) {
    const [d, u, w] = basis(sub(b, a));
    const p0 = lerp3(a, b, t0), p1 = lerp3(a, b, t1), wv = mul(w, 0.028), off = mul(u, 0.03);
    const P = [add(add(p0, off), wv), add(add(p1, off), wv), add(add(p1, off), mul(wv, -1)), add(add(p0, off), mul(wv, -1))].map(p => this.vtx(p));
    for (let i = 0; i < 4; i++) this.edge(P[i], P[(i + 1) % 4]);
    this.quad(...P);
    for (let i = 1; i < 6; i++) { const q = lerp3(p0, p1, i / 6); const A = this.vtx(add(add(q, off), mul(wv, 0.6))), B = this.vtx(add(add(add(q, off), mul(d, 0.02)), mul(wv, 0.6))), C = this.vtx(add(add(add(q, off), mul(d, 0.02)), mul(wv, 0.1))), D = this.vtx(add(add(q, off), mul(wv, 0.1))); this.edge(A, B); this.edge(B, C); this.edge(C, D); this.edge(D, A); }
  }
  hubCap(c, s) {
    const n = [0, 0, 1];
    this.disc(c, n, 0.095, { rings: [0.095, 0.08, 0.04, 0.015], seg: 32 });
    const b = this.circle([c[0], c[1], c[2] + 0.012 * s], n, 0.092, 32), a = this.circle(c, n, 0.095, 32);
    for (let i = 0; i < 32; i++) { this.quad(a[i], a[(i + 1) % 32], b[(i + 1) % 32], b[i]); if (i % 4 === 0) this.edge(a[i], b[i]); }
    for (let i = 0; i < 6; i++) { const ang = i / 6 * TAU; this.box([c[0] + Math.cos(ang) * 0.06, c[1] + Math.sin(ang) * 0.06, c[2] + 0.004 * s], [0.008, 0.008, 0.006]); }
  }
  magnetRing(c, ro, ri, w, n) {
    this.ring(c, [0, 0, 1], ro, 48, w); this.ring(c, [0, 0, 1], ri, 48, w);
    for (let i = 0; i < n; i++) { const a = i / n * TAU, a2 = a + TAU / n * 0.7; const P = [[ri, a], [ro, a], [ro, a2], [ri, a2]].map(([r, t]) => this.vtx([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2] + w / 2])); for (let k = 0; k < 4; k++) this.edge(P[k], P[(k + 1) % 4]); this.quad(...P); }
  }
  stator(c, ro, ri, w, n) {
    this.ring(c, [0, 0, 1], ri, 36, w);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, h = TAU / n * 0.28;
      const P = [[ri, a - h * 0.6], [ro * 0.86, a - h * 0.6], [ro, a - h * 1.3], [ro, a + h * 1.3], [ro * 0.86, a + h * 0.6], [ri, a + h * 0.6]];
      for (const z of [-w / 2, w / 2]) { const ids = P.map(([r, t]) => this.vtx([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2] + z])); for (let k = 0; k < ids.length - 1; k++) this.edge(ids[k], ids[k + 1]); if (z > 0) { this.quad(ids[0], ids[1], ids[4], ids[5]); this.quad(ids[1], ids[2], ids[3], ids[4]); } }
      // 线圈绕组：两道小环
      const mid = (ri + ro * 0.86) / 2;
      this.circle([c[0] + Math.cos(a) * mid, c[1] + Math.sin(a) * mid, c[2]], [Math.cos(a), Math.sin(a), 0], 0.012, 8);
    }
    this.tube([c[0], c[1], -0.09], [c[0], c[1], 0.09], 0.008, { rings: 3, seg: 8, longs: 4 });   // 轴
  }
  rotor(c, r) {
    const n = [0, 0, 1];
    this.disc(c, n, r, { rings: [r, r - 0.018], seg: 48 });
    this.circle(c, n, 0.028, 16);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const p = this.vtx([c[0] + Math.cos(a) * 0.028, c[1] + Math.sin(a) * 0.028, c[2]]), q = this.vtx([c[0] + Math.cos(a + 0.5) * (r - 0.018), c[1] + Math.sin(a + 0.5) * (r - 0.018), c[2]]); this.edge(p, q); }
    // 通风孔两圈（交错）
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + 0.1; this.circle([c[0] + Math.cos(a) * (r - 0.006), c[1] + Math.sin(a) * (r - 0.006), c[2]], n, 0.0034, 8); }
    for (let i = 0; i < 24; i++) { const a = (i + 0.5) / 24 * TAU + 0.1; this.circle([c[0] + Math.cos(a) * (r - 0.0135), c[1] + Math.sin(a) * (r - 0.0135), c[2]], n, 0.003, 8); }
  }
  // 弧形块：以 c 为圆心、半径 r0–r1、角度 a0–a1、z0–z1 的扇环体（卡钳体、刹车片）
  arcBlock(c, r0, r1, a0, a1, z0, z1, seg = 10) {
    const L = [];
    for (const z of [z0, z1]) for (const r of [r0, r1]) { const ids = []; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; ids.push(this.vtx([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z])); } for (let i = 0; i < seg; i++) this.edge(ids[i], ids[i + 1]); L.push(ids); }
    const [A, B, C, D] = L;   // z0r0 z0r1 z1r0 z1r1
    for (const i of [0, seg]) { this.edge(A[i], B[i]); this.edge(C[i], D[i]); this.edge(A[i], C[i]); this.edge(B[i], D[i]); }
    for (let i = 0; i < seg; i++) { this.quad(A[i], A[i + 1], B[i + 1], B[i]); this.quad(C[i], C[i + 1], D[i + 1], D[i]); this.quad(B[i], B[i + 1], D[i + 1], D[i]); this.quad(A[i], A[i + 1], C[i + 1], C[i]); }
    for (let i = 2; i < seg; i += 3) { this.edge(B[i], D[i]); }
  }
  // 油压卡钳的一半（s = ±1 表示碟片哪一侧）：弧形钳体 + 两个活塞孔
  caliperHalf(c, rc, ac, zr, s) {
    this.arcBlock(c, rc - 0.024, rc + 0.02, ac - 0.42, ac + 0.42, zr + s * 0.007, zr + s * 0.03, 12);
    for (const da of [-0.19, 0.19]) { const p = [c[0] + Math.cos(ac + da) * rc, c[1] + Math.sin(ac + da) * rc, zr + s * 0.007]; this.circle(p, [0, 0, 1], 0.0125, 16); }   // 活塞孔
    const m = [c[0] + Math.cos(ac) * (rc + 0.03), c[1] + Math.sin(ac) * (rc + 0.03), zr + s * 0.02]; this.box(m, [0.02, 0.014, 0.016]);   // 固定耳
  }
  // 活塞：端面看是圆（端面同心圆 + 短圆柱）
  pistons(c, rc, ac, zr, s) {
    for (const da of [-0.19, 0.19]) {
      const x = c[0] + Math.cos(ac + da) * rc, y = c[1] + Math.sin(ac + da) * rc;
      this.tube([x, y, zr + s * 0.006], [x, y, zr + s * 0.02], 0.011, { rings: 3, seg: 16, longs: 6 });
      this.disc([x, y, zr + s * 0.006], [0, 0, 1], 0.011, { rings: [0.011, 0.007, 0.003], seg: 16 });
    }
  }
  // 刹车片：贴着碟片的弧形片（背板 + 摩擦块）
  pad(c, rc, ac, zr, s) {
    this.arcBlock(c, rc - 0.016, rc + 0.014, ac - 0.36, ac + 0.36, zr + s * 0.0035, zr + s * 0.0065, 10);
    this.arcBlock(c, rc - 0.013, rc + 0.011, ac - 0.32, ac + 0.32, zr + s * 0.0065, zr + s * 0.0085, 8);
  }
  caliper(c, s) {
    const z = c[2] + 0.018 * s;
    this.box([c[0], c[1], z], [0.07, 0.035, 0.022]);
    this.tube([c[0] - 0.02, c[1], z], [c[0] - 0.02, c[1], z + 0.012 * s], 0.012, { rings: 2, seg: 10, longs: 4 });   // 活塞
    this.tube([c[0] + 0.02, c[1], z], [c[0] + 0.02, c[1], z + 0.012 * s], 0.012, { rings: 2, seg: 10, longs: 4 });
    this.box([c[0], c[1] - 0.012, c[2] + 0.004 * s], [0.05, 0.016, 0.004]);   // 刹车片
  }
  lever(p) {
    this.box([p[0] + 0.01, p[1] + 0.005, p[2]], [0.035, 0.03, 0.03]);
    this.polyTube([[p[0] + 0.02, p[1], p[2]], [p[0] + 0.06, p[1] - 0.01, p[2] + 0.04], [p[0] + 0.07, p[1] - 0.015, p[2] + 0.12]], 0.005, { seg: 6, longs: 2, ringsPer: 2 });
  }
  toJSON() {
    const r = x => Math.round(x * 10000) / 10000;
    return {
      name: this.name, units: 'm', up: 'y',
      parts: this.parts.map(P => ({
        id: P.id, anchor: P.anchor, ...(P.center ? { center: P.center } : {}), ...(P.tagDir ? { tagDir: P.tagDir } : {}),
        pieces: P.pieces.map(C => ({ id: C.id, explode: C.explode, ...(C.axis ? { axis: C.axis } : {}), ...(C.internal ? { internal: true } : {}), ...(C.box === false ? { box: false } : {}), ...(C.hot ? { hot: true } : {}), v: C.v.flat().map(r), e: C.e.flat(), q: C.q.flat() }))
      }))
    };
  }
}
