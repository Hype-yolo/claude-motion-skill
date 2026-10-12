// Lofted shapes for the procedural vehicles: monotone curves through keys, and closed superellipse lofts.
import * as THREE from 'three/webgpu';

// monotone cubic through (t, v) keys
export function curve(keys) {
  const n = keys.length;
  const t = keys.map((k) => k[0]), v = keys.map((k) => k[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / (t[i + 1] - t[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= t[0]) return v[0];
    if (x >= t[n - 1]) return v[n - 1];
    let i = 0;
    while (x > t[i + 1]) i++;
    const h = t[i + 1] - t[i], s = (x - t[i]) / h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

const spow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

// a closed loft: rings of superellipse sections, with caps at both ends
export function loft({ z0, z1, rings = 72, seg = 56, halfW, yTop, yMid, yBot, nTop, nBot, tStart = 0, tEnd = 1 }) {
  const pos = [], idx = [];
  const ts = [];
  for (let i = 0; i <= rings; i++) {
    // denser rings at the ends where the shape turns fastest
    const u = i / rings;
    ts.push(tStart + (tEnd - tStart) * (0.5 - 0.5 * Math.cos(Math.PI * u)));
  }
  for (const t of ts) {
    const z = z0 + (z1 - z0) * t;
    const w = Math.max(1e-3, halfW(t)), yt = yTop(t), ym = yMid(t), yb = yBot(t), nt = nTop(t), nb = nBot(t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      const up = s >= 0;
      const n = up ? nt : nb;
      const x = w * spow(c, 2 / n);
      const y = up ? ym + (yt - ym) * Math.pow(Math.abs(s), 2 / n) : ym - (ym - yb) * Math.pow(Math.abs(s), 2 / n);
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, b, c, b, d, c);
    }
  }
  // caps
  for (const [ring, flip] of [[0, true], [rings, false]]) {
    const base = pos.length / 3;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < seg; j++) { cx += pos[(ring * seg + j) * 3]; cy += pos[(ring * seg + j) * 3 + 1]; cz += pos[(ring * seg + j) * 3 + 2]; }
    pos.push(cx / seg, cy / seg, cz / seg);
    for (let j = 0; j < seg; j++) {
      const a = ring * seg + j, b = ring * seg + ((j + 1) % seg);
      if (flip) idx.push(base, b, a); else idx.push(base, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
