import * as THREE from 'three';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const saturate = (v: number) => clamp(v, 0, 1);
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential smoothing: move `current` toward `target` with time constant-ish `rate`. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export const dampVec3 = (current: THREE.Vector3, target: THREE.Vector3, rate: number, dt: number) =>
  current.lerp(target, 1 - Math.exp(-rate * dt));

/** Wrap an angle to [-PI, PI]. */
export const wrapAngle = (a: number) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};

/** Deterministic hash of a 3D point to [-1, 1]. Used so split vertices that share a position move together. */
export function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(Math.round(x * 1000) | 0, 0x27d4eb2d) ^ Math.imul(Math.round(y * 1000) | 0, 0x165667b1) ^
    Math.imul(Math.round(z * 1000) | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();

/** Yaw (rotation about +Y) of a quaternion's forward (+Z) vector. */
const _fwd = new THREE.Vector3();
export function yawOf(q: THREE.Quaternion): number {
  _fwd.set(0, 0, 1).applyQuaternion(q);
  return Math.atan2(_fwd.x, _fwd.z);
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
