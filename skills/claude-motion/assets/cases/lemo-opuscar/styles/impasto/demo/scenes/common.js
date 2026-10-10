// shared drawing helpers for reference illustrations
export const P = pts => c => { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
export const E = (x, y, rx, ry, rot = 0) => c => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
export const RR = (x, y, w, h, r) => c => c.roundRect(x, y, w, h, r);
export const lin = (x0, y0, x1, y1, stops) => c => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
export const rad = (x, y, r0, r1, stops) => c => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ss = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const eo = t => 1 - Math.pow(1 - clamp(t), 3);
export const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const back = (t, s = 1.7) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
// quad bilinear: corners tl, tr, br, bl -> point at (u,v)
export const quadPt = (q, u, v) => { const [a, b, c, d] = q; const top = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)], bot = [lerp(d[0], c[0], u), lerp(d[1], c[1], u)]; return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)]; };
export const subQuad = (q, u0, v0, u1, v1) => [quadPt(q, u0, v0), quadPt(q, u1, v0), quadPt(q, u1, v1), quadPt(q, u0, v1)];
