// Dual-quaternion skinning with a bind-space scale pre-pass.
//
// Linear blend skinning averages matrices, so wherever a vertex blends two bones that have rotated
// apart (hip, shoulder, elbow, stifle) the skin shrinks toward the joint and the coat pattern
// shears and pinches. Blending unit dual quaternions instead rotates the skin *about the joint* by
// an interpolated angle, which keeps volume and spreads the stretch evenly across the blend band.
//
// Bones may also carry a local scale (breathing, lumbar compression); that is applied first, as a
// linear blend of per-bone affine maps expressed in bind space, then the rigid DQ blend.
//
// Per bone the data texture holds 5 texels:
//   0: rotation quaternion (real part)   1: dual part
//   2..4: rows of the 3x4 bind-space scale map  A = R_B S R_B^T,  b = t_B - A t_B
import * as THREE from 'three';

export const DQS_GLSL = /* glsl */ `
uniform highp sampler2D uDQ;
vec4 dqT(int b, int k) { return texelFetch(uDQ, ivec2(b * 5 + k, 0), 0); }
void dqsAccum(int b, float w, vec4 hp, vec4 r0, inout vec3 ps, inout vec4 real, inout vec4 dual) {
  if (w <= 0.0) return;
  ps += w * vec3(dot(dqT(b, 2), hp), dot(dqT(b, 3), hp), dot(dqT(b, 4), hp));
  vec4 rq = dqT(b, 0);
  float s = dot(rq, r0) < 0.0 ? -w : w;
  real += s * rq;
  dual += s * dqT(b, 1);
}
vec3 dqsRotate(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
// Skins a position plus two direction vectors (normal and a tangent) with 4 bone influences.
void dqsSkinW(inout vec3 p, inout vec3 n, inout vec3 t, vec4 sIdx, vec4 sW) {
  ivec4 bi = ivec4(sIdx + 0.5);
  vec4 r0 = dqT(bi.x, 0);
  vec4 hp = vec4(p, 1.0);
  vec3 ps = vec3(0.0);
  vec4 real = vec4(0.0), dual = vec4(0.0);
  dqsAccum(bi.x, sW.x, hp, r0, ps, real, dual);
  dqsAccum(bi.y, sW.y, hp, r0, ps, real, dual);
  dqsAccum(bi.z, sW.z, hp, r0, ps, real, dual);
  dqsAccum(bi.w, sW.w, hp, r0, ps, real, dual);
  ps /= max(sW.x + sW.y + sW.z + sW.w, 1e-5);
  float L = max(length(real), 1e-6);
  real /= L; dual /= L;
  vec3 tr = 2.0 * (real.w * dual.xyz - dual.w * real.xyz + cross(real.xyz, dual.xyz));
  p = dqsRotate(real, ps) + tr;
  n = dqsRotate(real, n);
  t = dqsRotate(real, t);
}
`;

// vertex-attribute flavour (one influence set per vertex)
export const DQS_ATTR_GLSL = /* glsl */ `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
void dqsSkin(inout vec3 p, inout vec3 n, inout vec3 t) { dqsSkinW(p, n, t, skinIndex, skinWeight); }
`;

export class DQSkin {
  constructor(sk) {
    this.sk = sk;
    const n = (this.n = sk.bones.length);
    this.data = new Float32Array(n * 20);
    this.tex = new THREE.DataTexture(this.data, n * 5, 1, THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.bindQinv = [];
    this.bindT = [];
    this.bindR = [];
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const m of sk.bind) {
      m.decompose(p, q, s);
      this.bindQinv.push(q.clone().invert());
      this.bindT.push(p.clone());
      this.bindR.push(new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)));
    }
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._A = new THREE.Matrix3();
    this._S = new THREE.Matrix3();
    this._RT = new THREE.Matrix3();
    this.update();
  }

  update() {
    const d = this.data, p = this._p, q = this._q, s = this._s, t = this._t;
    for (let i = 0; i < this.n; i++) {
      // inline decompose (no matrix copies): scale = column lengths, rotation from the normalised
      // columns (Shepperd), translation = column 3
      const m = this.sk.bones[i].matrixWorld.elements;
      let sx = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]); const sy = Math.sqrt(m[4] * m[4] + m[5] * m[5] + m[6] * m[6]), sz = Math.sqrt(m[8] * m[8] + m[9] * m[9] + m[10] * m[10]);
      if (m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]) < 0) sx = -sx;
      s.set(sx, sy, sz); p.set(m[12], m[13], m[14]);
      const ix = 1 / sx, iy = 1 / sy, iz = 1 / sz;
      const m11 = m[0] * ix, m21 = m[1] * ix, m31 = m[2] * ix, m12 = m[4] * iy, m22 = m[5] * iy, m32 = m[6] * iy, m13 = m[8] * iz, m23 = m[9] * iz, m33 = m[10] * iz;
      const tr = m11 + m22 + m33;
      if (tr > 0) { const k = 0.5 / Math.sqrt(tr + 1); q.set((m32 - m23) * k, (m13 - m31) * k, (m21 - m12) * k, 0.25 / k); }
      else if (m11 > m22 && m11 > m33) { const k = 2 * Math.sqrt(1 + m11 - m22 - m33); q.set(0.25 * k, (m12 + m21) / k, (m13 + m31) / k, (m32 - m23) / k); }
      else if (m22 > m33) { const k = 2 * Math.sqrt(1 + m22 - m11 - m33); q.set((m12 + m21) / k, 0.25 * k, (m23 + m32) / k, (m13 - m31) / k); }
      else { const k = 2 * Math.sqrt(1 + m33 - m11 - m22); q.set((m13 + m31) / k, (m23 + m32) / k, 0.25 * k, (m21 - m12) / k); }
      q.multiply(this.bindQinv[i]); // rigid rotation: q_world * conj(q_bind)
      t.copy(this.bindT[i]).applyQuaternion(q).negate().add(p);
      const o = i * 20;
      const qx = q.x, qy = q.y, qz = q.z, qw = q.w, tx = t.x, ty = t.y, tz = t.z;
      d[o] = qx; d[o + 1] = qy; d[o + 2] = qz; d[o + 3] = qw;
      d[o + 4] = 0.5 * (qw * tx + ty * qz - tz * qy);
      d[o + 5] = 0.5 * (qw * ty + tz * qx - tx * qz);
      d[o + 6] = 0.5 * (qw * tz + tx * qy - ty * qx);
      d[o + 7] = -0.5 * (tx * qx + ty * qy + tz * qz);
      if (Math.abs(s.x - 1) + Math.abs(s.y - 1) + Math.abs(s.z - 1) < 1e-5) {
        d[o + 8] = 1; d[o + 9] = 0; d[o + 10] = 0; d[o + 11] = 0;
        d[o + 12] = 0; d[o + 13] = 1; d[o + 14] = 0; d[o + 15] = 0;
        d[o + 16] = 0; d[o + 17] = 0; d[o + 18] = 1; d[o + 19] = 0;
      } else {
        const R = this.bindR[i];
        this._S.set(s.x, 0, 0, 0, s.y, 0, 0, 0, s.z);
        this._RT.copy(R).transpose();
        const A = this._A.multiplyMatrices(R, this._S).multiply(this._RT);
        const e = A.elements; // column-major
        const b = this.bindT[i];
        const bx = b.x - (e[0] * b.x + e[3] * b.y + e[6] * b.z);
        const by = b.y - (e[1] * b.x + e[4] * b.y + e[7] * b.z);
        const bz = b.z - (e[2] * b.x + e[5] * b.y + e[8] * b.z);
        d[o + 8] = e[0]; d[o + 9] = e[3]; d[o + 10] = e[6]; d[o + 11] = bx;
        d[o + 12] = e[1]; d[o + 13] = e[4]; d[o + 14] = e[7]; d[o + 15] = by;
        d[o + 16] = e[2]; d[o + 17] = e[5]; d[o + 18] = e[8]; d[o + 19] = bz;
      }
    }
    this.tex.needsUpdate = true;
  }

  // The whole skeleton moved rigidly by D (a rotation + translation matrix, no scale) since the last
  // update: premultiply every bone's dual quaternion by D's instead of decomposing every bone matrix
  // again (crowd LOD in-between frames, see core/motion/bird.js carryRigid). The bind-space scale maps
  // are unchanged by a rigid motion.
  carry(D) {
    const e = D.elements, d = this.data;
    const qD = this._q.setFromRotationMatrix(D);
    const ax = qD.x, ay = qD.y, az = qD.z, aw = qD.w;
    // dual part of D: 0.5 * (t, 0) * qD
    const tx = e[12], ty = e[13], tz = e[14];
    const bx = 0.5 * (aw * tx + ty * az - tz * ay), by = 0.5 * (aw * ty + tz * ax - tx * az), bz = 0.5 * (aw * tz + tx * ay - ty * ax), bw = -0.5 * (tx * ax + ty * ay + tz * az);
    for (let i = 0; i < this.n; i++) {
      const o = i * 20;
      const rx = d[o], ry = d[o + 1], rz = d[o + 2], rw = d[o + 3];
      const sx = d[o + 4], sy = d[o + 5], sz = d[o + 6], sw = d[o + 7];
      // real' = qD * r
      d[o] = aw * rx + ax * rw + ay * rz - az * ry;
      d[o + 1] = aw * ry - ax * rz + ay * rw + az * rx;
      d[o + 2] = aw * rz + ax * ry - ay * rx + az * rw;
      d[o + 3] = aw * rw - ax * rx - ay * ry - az * rz;
      // dual' = qD * s + dD * r
      d[o + 4] = aw * sx + ax * sw + ay * sz - az * sy + (bw * rx + bx * rw + by * rz - bz * ry);
      d[o + 5] = aw * sy - ax * sz + ay * sw + az * sx + (bw * ry - bx * rz + by * rw + bz * rx);
      d[o + 6] = aw * sz + ax * sy - ay * sx + az * sw + (bw * rz + bx * ry - by * rx + bz * rw);
      d[o + 7] = aw * sw - ax * sx - ay * sy - az * sz + (bw * rw - bx * rx - by * ry - bz * rz);
    }
    this.tex.needsUpdate = true;
  }
}
