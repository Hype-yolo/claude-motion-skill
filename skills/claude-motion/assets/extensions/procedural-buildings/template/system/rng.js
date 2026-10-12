/**
 * Bit-exact emulation of the Blender pieces the FR_* node graphs depend on:
 * Bob Jenkins' lookup3 hashes (BLI noise::hash*), the Hash Value / Random Value
 * function nodes, and float32 arithmetic (Math.fround) where a hash consumes a
 * computed position. Verified against the .blend's evaluated geometry with
 * tools/verify.ts.
 */

const f32 = Math.fround;

function rot(x        , k        )         {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** lookup3 final mix, returns c */
function final(a        , b        , c        )         {
  c = (c ^ b) >>> 0; c = (c - rot(b, 14)) >>> 0;
  a = (a ^ c) >>> 0; a = (a - rot(c, 11)) >>> 0;
  b = (b ^ a) >>> 0; b = (b - rot(a, 25)) >>> 0;
  c = (c ^ b) >>> 0; c = (c - rot(b, 16)) >>> 0;
  a = (a ^ c) >>> 0; a = (a - rot(c, 4)) >>> 0;
  b = (b ^ a) >>> 0; b = (b - rot(a, 14)) >>> 0;
  c = (c ^ b) >>> 0; c = (c - rot(b, 24)) >>> 0;
  return c;
}

/** noise::hash(kx, ky) */
export function hashInt2d(kx        , ky        )         {
  const init = (0xdeadbeef + (2 << 2) + 13) >>> 0;
  return final((init + (kx >>> 0)) >>> 0, (init + (ky >>> 0)) >>> 0, init);
}

/** noise::hash(kx, ky, kz) */
export function hashInt3d(kx        , ky        , kz        )         {
  const init = (0xdeadbeef + (3 << 2) + 13) >>> 0;
  return final((init + (kx >>> 0)) >>> 0, (init + (ky >>> 0)) >>> 0, (init + (kz >>> 0)) >>> 0);
}

const f32buf = new Float32Array(1);
const u32view = new Uint32Array(f32buf.buffer);
export function floatBits(x        )         {
  f32buf[0] = x;
  return u32view[0];
}

/** noise::uint_to_float_01 — float(k) / float(0xFFFFFFFF), in float32 */
export function uintTo01(k        )         {
  return f32(f32(k) / 4294967296);
}

/** Hash Value node (Vector): noise::hash(noise::hash_float(v), seed), as a signed int */
export function hashValueVec3(x        , y        , z        , seed        )         {
  return hashInt2d(hashInt3d(floatBits(x), floatBits(y), floatBits(z)), seed) | 0;
}

/** Random Value node (Float): hash_to_float(seed, id) * (max - min) + min */
export function randomFloat(min        , max        , id        , seed        )         {
  return f32(f32(uintTo01(hashInt2d(seed, id)) * f32(max - min)) + min);
}

/** Random Value node (Int): hash(id, seed) % (max - min + 1) + min */
export function randomInt(min        , max        , id        , seed        )         {
  return min + (hashInt2d(id, seed) % (max - min + 1));
}

/** Random Value node (Boolean): hash_to_float(id, seed) <= probability */
export function randomBool(probability        , id        , seed        )          {
  return uintTo01(hashInt2d(id, seed)) <= f32(probability);
}
