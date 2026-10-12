// Chase, hood and cinematic cameras around the KITE. The chase camera lags in yaw, pulls back with speed,
// widens its field of view under boost, and never ends up inside a building.
import * as THREE from 'three/webgpu';
import { groundAt, queryBoxes } from '../city/layout.js';

const _boxes = [];
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

// first hit of the segment a->b against the city's boxes, as a fraction of its length
function segmentHit(city, a, b) {
  queryBoxes(city, Math.min(a.x, b.x) - 1, Math.min(a.z, b.z) - 1, Math.max(a.x, b.x) + 1, Math.max(a.z, b.z) + 1, _boxes);
  let best = 1;
  const d = _v.subVectors(b, a);
  for (const bx of _boxes) {
    if (bx.sign || bx.kind === 'pole') continue; // thin things the camera may pass behind for a frame
    let t0 = 0, t1 = best;
    let ok = true;
    for (const [o, dd, lo, hi] of [[a.x, d.x, bx.x0 - 0.35, bx.x1 + 0.35], [a.y, d.y, bx.y0 - 0.35, bx.y1 + 0.35], [a.z, d.z, bx.z0 - 0.35, bx.z1 + 0.35]]) {
      if (Math.abs(dd) < 1e-6) { if (o < lo || o > hi) { ok = false; break; } continue; }
      let ta = (lo - o) / dd, tb = (hi - o) / dd;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}

// the line-of-sight test lets signs pass (pulling in for every hanging sign would make the camera pump), so a
// camera that lands inside one steps out through its nearest face, plus the clearance the walls get
function clearOfSigns(city, p) {
  queryBoxes(city, p.x - 0.5, p.z - 0.5, p.x + 0.5, p.z + 0.5, _boxes);
  for (const b of _boxes) {
    if (!b.sign) continue;
    const m = 0.3;
    const opts = [[p.x - (b.x0 - m), 'x', b.x0 - m], [b.x1 + m - p.x, 'x', b.x1 + m], [p.z - (b.z0 - m), 'z', b.z0 - m], [b.z1 + m - p.z, 'z', b.z1 + m], [p.y - (b.y0 - m), 'y', b.y0 - m], [b.y1 + m - p.y, 'y', b.y1 + m]];
    if (opts.some((o) => o[0] <= 0)) continue;
    const o = opts.reduce((a, c) => (c[0] < a[0] ? c : a));
    p[o[1]] = o[2];
  }
}

export class CameraRig {
  constructor(camera, kite, city) {
    this.camera = camera;
    this.kite = kite;
    this.city = city;
    this.mode = 'chase';
    this.yaw = kite.yaw;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dist = 7;
    this.height = 2;
    this.fov = 62;
    this.shake = 0;
    this.orbit = 0;
    this.snap = true;
    this.pull = 1; // collision pull-in, eased
    this.fovBase = 60;
    this.shakeScale = 1;
  }

  cycle() {
    this.mode = this.mode === 'chase' ? 'hood' : this.mode === 'hood' ? 'far' : 'chase';
    this.snap = true;
  }

  update(dt) {
    const k = this.kite, cam = this.camera;
    const sp = k.speed;
    const air = k.mode === 'air';
    const lag = 1 - Math.exp(-dt * (air ? 3.2 : 4.5));
    let dy = k.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (this.snap ? 1 : lag);

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    // vertical follows with a little lag so climbs and drops read on screen; horizontal is locked to the car
    if (this.snap || this.ty === undefined) this.ty = k.pos.y;
    this.ty += (k.pos.y - this.ty) * (1 - Math.exp(-dt * (air ? 5 : 14)));
    const target = new THREE.Vector3(k.pos.x, this.ty + 0.75, k.pos.z);
    let fovT = this.fovBase + Math.min(24, sp * 0.17) + (k.boosting ? 8 : 0);

    if (this.mode === 'hood') {
      const p = new THREE.Vector3(0, 1.38, -0.15).applyEuler(k.model.rotation).add(k.pos);
      const ahead = new THREE.Vector3(0, 1.1, -30).applyEuler(k.model.rotation).add(k.pos);
      this.pos.copy(p);
      this.look.copy(ahead);
      fovT += 6;
    } else {
      const far = this.mode === 'far';
      const distT = (air ? 9.5 + sp * 0.045 : 6.6 + sp * 0.03) * (far ? 1.9 : 1);
      const hT = (air ? 2.8 - k.vel.y * 0.05 : 1.9) * (far ? 1.7 : 1);
      this.dist += (distT - this.dist) * (1 - Math.exp(-dt * 2));
      this.height += (hT - this.height) * (1 - Math.exp(-dt * 2.5));
      const want = target.clone().addScaledVector(fwd, -this.dist).add(new THREE.Vector3(0, this.height, 0));
      // keep line of sight to the car
      const t = segmentHit(this.city, target, want);
      const pullT = t < 1 ? Math.max(0.12, t - 0.05) : 1;
      this.pull += (pullT - this.pull) * (pullT < this.pull ? 1 : 1 - Math.exp(-dt * 2));
      want.lerpVectors(target, want, this.pull);
      const g = groundAt(this.city, want.x, want.z, want.y) + 0.45;
      if (want.y < g) want.y = g;
      clearOfSigns(this.city, want);
      this.pos.copy(want);
      this.look.copy(target).addScaledVector(fwd, 6).add(new THREE.Vector3(0, air ? 0.2 : 0.55, 0));
    }
    this.snap = false;
    this.fov += (fovT - this.fov) * (1 - Math.exp(-dt * 3));
    cam.fov = this.fov;
    cam.updateProjectionMatrix();
    cam.position.copy(this.pos);
    cam.lookAt(this.look);
    // bank a little with the car in the air
    if (air && this.mode !== 'hood') cam.rotateZ(k.roll * 0.35);
    if (this.mode === 'hood') cam.rotateZ(k.roll);

    // shake: impacts plus a fine buzz at boost
    this.shake = Math.max(this.shake * Math.exp(-dt * 5), k.impact);
    const s = (this.shake * 0.05 + (k.boosting ? 0.0025 : 0)) * this.shakeScale;
    if (s > 1e-4) {
      const t = performance.now() * 0.001;
      cam.rotateX(Math.sin(t * 61) * s);
      cam.rotateY(Math.sin(t * 47 + 1) * s);
    }
  }
}
