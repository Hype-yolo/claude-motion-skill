// 几何构建器：把成千上万个盒子/面片合并成一个 BufferGeometry（一次 draw call）
// 属性：position / normal / color / uv（立面坐标：u = 沿立面米数，v = 离地高度；屋顶 u=-1）/ wp（vec3：开间宽、层高、种子）
import * as THREE from 'three';

const _c = new THREE.Color();
export class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.wp = []; }
  col(hex) { if (hex instanceof THREE.Color) return hex; return _c.set(hex).clone(); }
  // 四边形（a,b,c,d 逆时针，从外面看）
  quad(a, b, c, d, nrm, col, uvs = null, wp = [0, 0, 0]) {
    const C = this.col(col), U = uvs || [[-1, -1], [-1, -1], [-1, -1], [-1, -1]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = [a, b, c, d][i]; this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]);
      this.c.push(C.r, C.g, C.b); this.uv.push(U[i][0], U[i][1]); this.wp.push(wp[0], wp[1], wp[2]);
    }
  }
  tri(a, b, c, nrm, col) {
    const C = this.col(col);
    for (const v of [a, b, c]) { this.p.push(...v); this.n.push(...nrm); this.c.push(C.r, C.g, C.b); this.uv.push(-1, -1); this.wp.push(0, 0, 0); }
  }
  // 轴对齐盒子；wall/roof 颜色；facade=true 时墙面带立面 uv（开窗）
  box(x0, x1, y0, y1, z0, z1, wall, roof = wall, o = {}) {
    const W = this.col(wall), R = this.col(roof), wp = o.wp || [0, 0, 0], fac = !!o.facade;
    const fu = (u0, u1) => fac ? [[u0, y0], [u1, y0], [u1, y1], [u0, y1]] : null;
    const dx = x1 - x0, dz = z1 - z0;
    if (!o.noSides) {
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], W, fu(0, dx), wp);          // 南 +z
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], W, fu(0, dx), wp);         // 北 -z
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], W, fu(0, dz), wp);          // 东 +x
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], W, fu(0, dz), wp);         // 西 -x
    }
    if (!o.noTop) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], R);
    if (o.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], R);
  }
  // 水平面片（y 高度）
  flat(x0, x1, z0, z1, y, col) { this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], col); }
  // 人字屋顶（沿 x 或 z 方向的屋脊）
  gable(x0, x1, z0, z1, y0, h, col, wallCol, alongX = true) {
    const C = this.col(col), Wc = this.col(wallCol);
    if (alongX) {
      const zm = (z0 + z1) / 2, yt = y0 + h, sl = Math.hypot(h, (z1 - z0) / 2), ny = ((z1 - z0) / 2) / sl, nz = h / sl;
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, yt, zm], [x0, yt, zm], [0, ny, nz], C);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, yt, zm], [x1, yt, zm], [0, ny, -nz], C);
      this.tri([x1, y0, z1], [x1, y0, z0], [x1, yt, zm], [1, 0, 0], Wc);
      this.tri([x0, y0, z0], [x0, y0, z1], [x0, yt, zm], [-1, 0, 0], Wc);
    } else {
      const xm = (x0 + x1) / 2, yt = y0 + h, sl = Math.hypot(h, (x1 - x0) / 2), ny = ((x1 - x0) / 2) / sl, nx = h / sl;
      this.quad([x1, y0, z1], [x1, y0, z0], [xm, yt, z0], [xm, yt, z1], [nx, ny, 0], C);
      this.quad([x0, y0, z0], [x0, y0, z1], [xm, yt, z1], [xm, yt, z0], [-nx, ny, 0], C);
      this.tri([x0, y0, z1], [x1, y0, z1], [xm, yt, z1], [0, 0, 1], Wc);
      this.tri([x1, y0, z0], [x0, y0, z0], [xm, yt, z0], [0, 0, -1], Wc);
    }
  }
  // 竖直圆柱（水塔、柱子）
  cyl(x, z, r, y0, y1, col, seg = 10, top = true) {
    const C = this.col(col);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, am = (a0 + a1) / 2;
      const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
      this.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [Math.cos(am), 0, Math.sin(am)], C);
      if (top) this.tri([x, y1, z], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], [0, 1, 0], C);
    }
  }
  // 地面上的椭圆片（池塘、花坛）
  disc(x, z, rx, rz, y, col, seg = 40) {
    const C = this.col(col);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      this.tri([x, y, z], [x + Math.cos(a1) * rx, y, z + Math.sin(a1) * rz], [x + Math.cos(a0) * rx, y, z + Math.sin(a0) * rz], [0, 1, 0], C);
    }
  }
  // 平面上的环带（跑道、池塘岸）
  ring(x, z, rx0, rz0, rx1, rz1, y, col, seg = 48) {
    const C = this.col(col);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const q = (a, rx, rz) => [x + Math.cos(a) * rx, y, z + Math.sin(a) * rz];
      this.quad(q(a1, rx1, rz1), q(a0, rx1, rz1), q(a0, rx0, rz0), q(a1, rx0, rz0), [0, 1, 0], C);
    }
  }
  // 体育场跑道形（两端半圆 + 直道）
  stadium(cx, cz, L, r0, r1, y, col, seg = 20) {
    const C = this.col(col), pts = a => a;
    const edge = (r) => {
      const P = [];
      for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + i / seg * Math.PI; P.push([cx + L / 2 + Math.cos(a) * r, cz + Math.sin(a) * r]); }
      for (let i = 0; i <= seg; i++) { const a = Math.PI / 2 + i / seg * Math.PI; P.push([cx - L / 2 + Math.cos(a) * r, cz + Math.sin(a) * r]); }
      return P;
    };
    const A = edge(r0), B = edge(r1);
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      this.quad([B[j][0], y, B[j][1]], [B[i][0], y, B[i][1]], [A[i][0], y, A[i][1]], [A[j][0], y, A[j][1]], [0, 1, 0], C);
    }
    return pts;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('wp', new THREE.Float32BufferAttribute(this.wp, 3));
    g.computeBoundingSphere();
    return g;
  }
}
