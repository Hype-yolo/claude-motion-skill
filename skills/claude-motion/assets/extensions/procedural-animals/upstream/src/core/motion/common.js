// Shared helpers for the motion engines: scalar easing, a critically damped spring, allocation-free
// temporaries and bone-frame writers.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrap01 = (x) => x - Math.floor(x);
export const d01 = (a, b) => {
  let d = wrap01(b - a);
  if (d > 0.5) d -= 1;
  return d;
};
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
// smooth minimum (polynomial), k = blend width
export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
// 0 -> 1 -> 0 envelope over [0, dur] with fade-in a and fade-out b (seconds)
export const envelope = (t, dur, a, b) => (t <= 0 ? 0 : Math.min(smooth(0, a, t), dur === Infinity ? 1 : 1 - smooth(dur - b, dur, t)));

// Critically damped (or custom-damped) spring, implicit Euler: stable for any dt.
export class Spring {
  constructor(x = 0) { this.x = x; this.v = 0; }
  step(target, omega, dt) {
    const f = 1 + 2 * dt * omega, hoo = dt * omega * omega, hhoo = dt * hoo;
    const inv = 1 / (f + hhoo);
    const x = (f * this.x + dt * this.v + hhoo * target) * inv;
    this.v = (this.v + hoo * (target - this.x)) * inv;
    this.x = x;
    return x;
  }
  reset(x) { this.x = x; this.v = 0; }
}

// Ring buffers of temporaries: zero allocations in hot paths. A value taken from a ring is valid
// until the ring wraps (hundreds of calls later), so only use them within one solve step.
export class Ring {
  constructor(make, n) { this.a = Array.from({ length: n }, make); this.i = 0; this.n = n; }
  get() { const o = this.a[this.i]; this.i = (this.i + 1) % this.n; return o; }
}
const VR = new Ring(() => new THREE.Vector3(), 768);
const QR = new Ring(() => new THREE.Quaternion(), 192);
export const tv = (x = 0, y = 0, z = 0) => VR.get().set(x, y, z);
export const tvc = (v) => VR.get().copy(v);
export const tq = () => QR.get().identity();
export const tqc = (q) => QR.get().copy(q);
export const tqa = (axis, a) => QR.get().setFromAxisAngle(axis, a);

export const UP = Object.freeze(new THREE.Vector3(0, 1, 0));
export const X1 = Object.freeze(new THREE.Vector3(1, 0, 0));
export const Z1 = Object.freeze(new THREE.Vector3(0, 0, 1));
export const ONE = Object.freeze(new THREE.Vector3(1, 1, 1));

const _m = new THREE.Matrix4();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
// Rotation (world) whose +Y is dirY and whose +X is as close as possible to latX: the bone
// convention of core/rig/rig.js. Writes into q.
export function frameQuat(q, dirY, latX) {
  _Y.copy(dirY);
  const l = _Y.length();
  if (l < 1e-9) _Y.set(0, 1, 0); else _Y.multiplyScalar(1 / l);
  _X.copy(latX).addScaledVector(_Y, -latX.dot(_Y));
  if (_X.lengthSq() < 1e-10) { _X.set(0, 0, 1).addScaledVector(_Y, -_Y.z); if (_X.lengthSq() < 1e-10) _X.set(1, 0, 0); }
  _X.normalize();
  _Z.crossVectors(_X, _Y);
  const e = _m.elements;
  e[0] = _X.x; e[1] = _X.y; e[2] = _X.z;
  e[4] = _Y.x; e[5] = _Y.y; e[6] = _Y.z;
  e[8] = _Z.x; e[9] = _Z.y; e[10] = _Z.z;
  return q.setFromRotationMatrix(_m);
}

// Writes a bone world matrix directly from its head position and frame (no quaternion round trip).
export function writeFrame(m, o, dirY, latX) {
  _Y.copy(dirY);
  const l = _Y.length();
  if (l < 1e-9) _Y.set(0, 1, 0); else _Y.multiplyScalar(1 / l);
  const d = latX.x * _Y.x + latX.y * _Y.y + latX.z * _Y.z;
  _X.set(latX.x - _Y.x * d, latX.y - _Y.y * d, latX.z - _Y.z * d);
  if (_X.lengthSq() < 1e-10) { _X.set(0, 0, 1).addScaledVector(_Y, -_Y.z); if (_X.lengthSq() < 1e-10) _X.set(1, 0, 0); }
  _X.normalize();
  _Z.crossVectors(_X, _Y);
  const e = m.elements;
  e[0] = _X.x; e[1] = _X.y; e[2] = _X.z; e[3] = 0;
  e[4] = _Y.x; e[5] = _Y.y; e[6] = _Y.z; e[7] = 0;
  e[8] = _Z.x; e[9] = _Z.y; e[10] = _Z.z; e[11] = 0;
  e[12] = o.x; e[13] = o.y; e[14] = o.z; e[15] = 1;
  return m;
}

// As writeFrame, then post-multiplied by a constant rotation (column-major 3x3 `c`, e.g. a bone's
// bind correction) and scaled per column by s (Vector3 or null): the matrix of
// compose(o, frameQuat(dirY, latX) * C, s) without the quaternion round trips.
export function writeFrameC(m, o, dirY, latX, c, s) {
  _Y.copy(dirY);
  const l = _Y.length();
  if (l < 1e-9) _Y.set(0, 1, 0); else _Y.multiplyScalar(1 / l);
  const d = latX.x * _Y.x + latX.y * _Y.y + latX.z * _Y.z;
  _X.set(latX.x - _Y.x * d, latX.y - _Y.y * d, latX.z - _Y.z * d);
  if (_X.lengthSq() < 1e-10) { _X.set(0, 0, 1).addScaledVector(_Y, -_Y.z); if (_X.lengthSq() < 1e-10) _X.set(1, 0, 0); }
  _X.normalize();
  _Z.crossVectors(_X, _Y);
  const e = m.elements, sx = s ? s.x : 1, sy = s ? s.y : 1, sz = s ? s.z : 1;
  for (let j = 0; j < 3; j++) {
    const a = c[3 * j], b = c[3 * j + 1], g = c[3 * j + 2], k = j === 0 ? sx : j === 1 ? sy : sz, o4 = 4 * j;
    e[o4] = (_X.x * a + _Y.x * b + _Z.x * g) * k;
    e[o4 + 1] = (_X.y * a + _Y.y * b + _Z.y * g) * k;
    e[o4 + 2] = (_X.z * a + _Y.z * b + _Z.z * g) * k;
    e[o4 + 3] = 0;
  }
  e[12] = o.x; e[13] = o.y; e[14] = o.z; e[15] = 1;
  return m;
}

// out = A * B for affine matrices (last row 0 0 0 1): 36 multiplies instead of 64. out may be A or B.
export function mulAffine(out, A, B) {
  const a = A.elements, b = B.elements, o = out.elements;
  const a0 = a[0], a1 = a[1], a2 = a[2], a4 = a[4], a5 = a[5], a6 = a[6], a8 = a[8], a9 = a[9], a10 = a[10], a12 = a[12], a13 = a[13], a14 = a[14];
  const b0 = b[0], b1 = b[1], b2 = b[2], b4 = b[4], b5 = b[5], b6 = b[6], b8 = b[8], b9 = b[9], b10 = b[10], b12 = b[12], b13 = b[13], b14 = b[14];
  o[0] = a0 * b0 + a4 * b1 + a8 * b2; o[1] = a1 * b0 + a5 * b1 + a9 * b2; o[2] = a2 * b0 + a6 * b1 + a10 * b2; o[3] = 0;
  o[4] = a0 * b4 + a4 * b5 + a8 * b6; o[5] = a1 * b4 + a5 * b5 + a9 * b6; o[6] = a2 * b4 + a6 * b5 + a10 * b6; o[7] = 0;
  o[8] = a0 * b8 + a4 * b9 + a8 * b10; o[9] = a1 * b8 + a5 * b9 + a9 * b10; o[10] = a2 * b8 + a6 * b9 + a10 * b10; o[11] = 0;
  o[12] = a0 * b12 + a4 * b13 + a8 * b14 + a12; o[13] = a1 * b12 + a5 * b13 + a9 * b14 + a13; o[14] = a2 * b12 + a6 * b13 + a10 * b14 + a14; o[15] = 1;
  return out;
}

export const isFiniteV = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

// Tiny seeded PRNG so idle behaviour is reproducible per individual.
export function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Piecewise table lookup by speed: rows [v, ...values]; returns into out (array) with smoothstep blend.
export function tableAt(rows, v, out) {
  let i = 0;
  while (i < rows.length - 2 && v > rows[i + 1][0]) i++;
  const a = rows[i], b = rows[Math.min(i + 1, rows.length - 1)];
  const t = b === a ? 0 : smooth(0, 1, (v - a[0]) / (b[0] - a[0]));
  for (let k = 1; k < a.length; k++) out[k - 1] = lerp(a[k], b[k], t);
  return out;
}
