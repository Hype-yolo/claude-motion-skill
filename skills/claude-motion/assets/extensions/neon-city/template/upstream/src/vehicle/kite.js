// Flight model for KITE-9. Two regimes share one state: on the street it hovers a hand's width off the
// tarmac and handles like a car that can slide; in the air the pods hold altitude and it flies like a
// VTOL, climbing and sinking on demand. The body collides as the oriented box it is drawn as, against every
// box in the city's collision set (buildings, signs, shopfronts, awnings, lamp posts, rooftop plant).
import * as THREE from 'three/webgpu';
import { CITY, groundAt, queryBoxes } from '../city/layout.js';

const HOVER = 0.16; // ride height of the body origin above whatever is underneath
const HL = 2.5, HW = 1.27; // half length and half width of the body footprint, pods included (model bounds)
const Y_LO = 0.12, Y_HI = 1.18; // body extent below and above the origin
const INERTIA = (4 * HL * HL + 4 * HW * HW) / 12; // yaw inertia per unit mass of a uniform slab that size
const _boxes = [];
const _sep = { nx: 0, nz: 0, d: 0, cx: 0, cz: 0 };

// Separating axes between a footprint (centre p, forward f, half length hl, half width hw) and an axis-aligned
// box in plan. Fills out with the shallowest way out for the footprint (normal from box to footprint, depth)
// and the contact point; false when they are apart.
export function footprintVsBox(px, pz, fx, fz, hl, hw, b, out) {
  const rx = -fz, rz = fx;
  const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2, ex = (b.x1 - b.x0) / 2, ez = (b.z1 - b.z0) / 2;
  const dx = px - bx, dz = pz - bz;
  const dF = dx * fx + dz * fz, dR = dx * rx + dz * rz;
  const oX = hl * Math.abs(fx) + hw * Math.abs(rx) + ex - Math.abs(dx);
  if (oX <= 0) return false;
  const oZ = hl * Math.abs(fz) + hw * Math.abs(rz) + ez - Math.abs(dz);
  if (oZ <= 0) return false;
  const oF = hl + ex * Math.abs(fx) + ez * Math.abs(fz) - Math.abs(dF);
  if (oF <= 0) return false;
  const oR = hw + ex * Math.abs(rx) + ez * Math.abs(rz) - Math.abs(dR);
  if (oR <= 0) return false;
  let d = oX, nx = Math.sign(dx) || 1, nz = 0;
  if (oZ < d) { d = oZ; nx = 0; nz = Math.sign(dz) || 1; }
  if (oF < d) { d = oF; const s = Math.sign(dF) || 1; nx = fx * s; nz = fz * s; }
  if (oR < d) { d = oR; const s = Math.sign(dR) || 1; nx = rx * s; nz = rz * s; }
  // contact: the middle of the footprint corners inside the box (a square-on hit lands on the whole nose), or
  // else the box corner that has pushed into the footprint's side
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < 4; i++) {
    const x = px + fx * hl * (i < 2 ? 1 : -1) + rx * hw * (i % 2 ? 1 : -1), z = pz + fz * hl * (i < 2 ? 1 : -1) + rz * hw * (i % 2 ? 1 : -1);
    if (x >= b.x0 - 0.05 && x <= b.x1 + 0.05 && z >= b.z0 - 0.05 && z <= b.z1 + 0.05) { cx += x; cz += z; n++; }
  }
  if (n) { cx /= n; cz /= n; } else {
    let best = Infinity;
    for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) {
      const e = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (e < best) { best = e; cx = x; cz = z; }
    }
  }
  out.cx = cx; out.cz = cz;
  out.nx = nx; out.nz = nz; out.d = d;
  return true;
}

export class Kite {
  constructor(city, model) {
    this.city = city;
    this.model = model;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.yawRate = 0;
    this.mode = 'ground';
    this.pitch = 0;
    this.roll = 0;
    this.tilt = 0;
    this.spin = 0;
    this.boostHeat = 0;
    this.impact = 0; // decaying hit strength for camera shake and audio
    this.events = [];
    this.groundY = 0;
    this.slip = 0;
    this.throttle = 0;
    this.lift = 0;
    this.boosting = false;
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    // the body box, for whoever else collides with it
    this.hl = HL; this.hw = HW; this.yLo = Y_LO; this.yHi = Y_HI; this.inertia = INERTIA;
  }

  place(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.yawRate = 0;
    this.groundY = groundAt(this.city, x, z, y + 1);
    this.mode = y - this.groundY < 2 ? 'ground' : 'air';
    if (this.mode === 'ground') this.pos.y = this.groundY + HOVER;
    this.syncModel(0);
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  get altitude() {
    return this.pos.y - this.groundY;
  }

  update(dt, c) {
    const steps = Math.min(6, Math.max(1, Math.ceil((this.vel.length() * dt) / 0.9)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, c);
    this.syncModel(dt, c);
  }

  step(dt, c) {
    const { throttle, steer, lift } = c;
    const x0 = this.pos.x, y0 = this.pos.y, z0 = this.pos.z, yaw0 = this.yaw;
    const boost = c.boost && throttle >= 0;
    this.throttle = throttle;
    this.lift = lift;
    this.boosting = boost && this.speed > 5;
    const fwd = this.fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let vF = this.vel.dot(fwd), vR = this.vel.dot(right);
    const air = this.mode === 'air';

    // longitudinal
    const accel = air ? (boost ? 38 : 19) : boost ? 26 : 14;
    const vmax = air ? (boost ? 125 : 72) : boost ? 64 : 42;
    if (throttle > 0) vF += accel * throttle * dt * Math.max(0, 1 - Math.max(0, vF) / vmax) * 1.6;
    else if (throttle < 0) vF += (vF > 0.5 ? -30 : -9) * -throttle * dt;
    if (vF < -14) vF = -14;
    vF -= vF * (throttle === 0 ? 0.35 : 0.08) * dt;
    if (vF > vmax) vF += (vmax - vF) * 2 * dt;

    // steering: yaw rate scales up with speed, then tightens again at the top end
    const sp = Math.abs(vF);
    const maxRate = air ? 1.45 / (1 + sp / 80) : (2.1 * Math.min(1, sp / 7)) / (1 + sp / 55);
    const target = -steer * maxRate * (vF < -0.5 ? -1 : 1);
    this.yawRate += (target - this.yawRate) * Math.min(1, dt * (air ? 4 : 9));
    this.yaw += this.yawRate * dt;

    // lateral grip: drop it while boosting through a hard turn and the tail steps out
    const drifting = !air && boost && Math.abs(steer) > 0.5 && vF > 18;
    const grip = air ? 2.6 : drifting ? 1.6 : 10;
    vR *= Math.exp(-grip * dt);
    this.slip += ((drifting ? Math.min(1, Math.abs(vR) / 8) : 0) - this.slip) * Math.min(1, dt * 6);

    // re-project onto the new heading so speed carries through the turn
    fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const vy0 = this.vel.y;
    this.vel.copy(fwd).multiplyScalar(vF).addScaledVector(right, vR);
    this.vel.y = vy0;

    // vertical
    this.groundY = groundAt(this.city, this.pos.x, this.pos.z, this.pos.y);
    const rest = this.groundY + HOVER;
    if (!air) {
      if (lift > 0) {
        this.mode = 'air';
        this.vel.y = 7;
        this.events.push('liftoff');
      } else if (this.pos.y > rest + 1.6) {
        this.mode = 'air'; // drove off a roof edge or a pier
      } else {
        const bob = Math.sin(performance.now() * 0.0021) * 0.03;
        this.vel.y += ((rest + bob - this.pos.y) * 70 - this.vel.y * 13) * dt;
      }
    } else {
      // descending is quicker than climbing: a boosted dive drops through the cloud deck in seconds
      const climb = lift > 0 ? (boost ? 32 : 17) : boost ? 62 : 26;
      const tv = lift * climb;
      this.vel.y += (tv - this.vel.y) * Math.min(1, dt * (lift ? 2.2 : 3.2));
      if (this.pos.y - rest < 0.6 && lift <= 0 && this.vel.y <= 0.5) {
        this.mode = 'ground';
        this.events.push({ type: 'land', v: -this.vel.y });
      }
    }

    this.pos.addScaledVector(this.vel, dt);

    // never below the surface
    if (this.pos.y < rest - 0.05) {
      if (this.vel.y < -6) this.hit(-this.vel.y * 0.5, 'scrape');
      this.pos.y = rest - 0.05;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    if (this.pos.y > 1760) { this.pos.y = 1760; this.vel.y = Math.min(0, this.vel.y); }
    const lim = CITY.outer - 60;
    for (const k of ['x', 'z']) {
      if (Math.abs(this.pos[k]) > lim) {
        this.pos[k] = Math.sign(this.pos[k]) * lim;
        this.vel[k] *= -0.3;
      }
    }

    if (this.collide() > 0.02) {
      // wedged, say between a wall and a sign hung close to it: where it has turned or moved to the body does
      // not fit, so it stays where it last did (height too: the passes may have lifted or dropped it into
      // something else) and loses the spin that put it there
      this.pos.set(x0, y0, z0); this.yaw = yaw0; this.yawRate = 0;
      this.vel.x *= -0.2; this.vel.z *= -0.2; this.vel.y = 0;
    }
  }

  // resolves what it can and returns the deepest overlap left
  collide() {
    const p = this.pos;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const reach = HL + 1;
    queryBoxes(this.city, p.x - reach, p.z - reach, p.x + reach, p.z + reach, _boxes);
    // a few passes: leaving one box at a corner can put the body into its neighbour
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const b of _boxes) {
        if (p.y + Y_HI < b.y0 || p.y - Y_LO > b.y1) continue;
        if (!footprintVsBox(p.x, p.z, fx, fz, HL, HW, b, _sep)) continue;
        // mostly above something solid: settle on it rather than being shoved off sideways
        if (b.solid && p.y - Y_LO > b.y1 - 0.7) {
          p.y = b.y1 + HOVER;
          if (this.vel.y < 0) this.vel.y = 0;
          continue;
        }
        // above a thin overhang's top or below its bottom by less than the body: lift or drop clear if that is shorter
        const up = b.y1 + Y_LO - p.y, down = p.y + Y_HI - b.y0;
        if (!b.solid && Math.min(up, down) < _sep.d) {
          if (up < down) { p.y += up; if (this.vel.y < 0) this.vel.y = 0; } else { p.y -= down; if (this.vel.y > 0) this.vel.y = 0; }
          moved = true;
          continue;
        }
        this.resolve(_sep, b);
        moved = true;
      }
      if (!moved) return 0;
    }
    let left = 0;
    for (const b of _boxes) {
      if (p.y + Y_HI < b.y0 || p.y - Y_LO > b.y1 || (b.solid && p.y - Y_LO > b.y1 - 0.7)) continue;
      if (footprintVsBox(p.x, p.z, fx, fz, HL, HW, b, _sep)) left = Math.max(left, Math.min(_sep.d, b.y1 + Y_LO - p.y, p.y + Y_HI - b.y0));
    }
    return left;
  }

  // push the body out along the contact normal and bounce it off: the normal speed reverses with a little
  // restitution, the tangential speed scrubs with how square-on the hit was, and an off-centre hit spins it
  resolve(c, b) {
    const p = this.pos;
    p.x += c.nx * (c.d + 0.002);
    p.z += c.nz * (c.d + 0.002);
    const vn = this.vel.x * c.nx + this.vel.z * c.nz;
    if (vn >= 0) return;
    const j = -vn * 1.25;
    this.vel.x += c.nx * j;
    this.vel.z += c.nz * j;
    const k = Math.max(0.55, 1 - (-vn / (this.speed + 1)) * 0.6);
    this.vel.x *= k; this.vel.z *= k;
    const lx = c.cx - p.x, lz = c.cz - p.z;
    // capped: a car that pirouettes off every wall is no fun to drive
    this.yawRate += THREE.MathUtils.clamp(((lz * c.nx - lx * c.nz) * j * 0.22) / INERTIA, -1.2, 1.2);
    if (-vn > 3) this.hit(-vn, b.kind === 'bldg' ? 'wall' : b.kind);
  }

  hit(strength, kind) {
    if (strength > this.impact) this.impact = Math.min(1.5, strength / 25);
    this.events.push({ type: 'hit', strength, kind });
  }

  syncModel(dt, c = { throttle: 0, steer: 0, lift: 0 }) {
    const m = this.model;
    const air = this.mode === 'air';
    const vF = this.vel.dot(this.fwd);
    const k = 1 - Math.exp(-dt * 5);
    const accelPitch = (c.throttle || 0) * (air ? 0.05 : 0.02) * (vF < 40 ? 1 : 0.4);
    const tp = air ? -this.vel.y * 0.012 - accelPitch + (this.boosting ? -0.04 : 0) : -accelPitch * 0.6;
    const tr = air ? -this.yawRate * 0.45 * Math.min(1, this.speed / 20) : -this.yawRate * Math.min(1, this.speed / 30) * 0.06 - this.slip * 0.05;
    this.pitch += (THREE.MathUtils.clamp(tp, -0.35, 0.35) - this.pitch) * k;
    this.roll += (THREE.MathUtils.clamp(tr, -0.6, 0.6) - this.roll) * k;
    this.tilt += ((air ? Math.min(1, Math.max(0, vF) / 45) * 1.25 : 0) - this.tilt) * (1 - Math.exp(-dt * 3));
    this.spin += dt * (5 + Math.abs(c.throttle || 0) * 12 + Math.abs(c.lift || 0) * 10 + (this.boosting ? 14 : 0));
    this.impact *= Math.exp(-dt * 3.5);
    m.position.copy(this.pos);
    m.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    const pods = m.userData.pods;
    if (pods) for (let i = 0; i < 4; i++) pods[i].rotation.x = (-this.tilt + (i < 2 ? c.steer * 0.12 * (air ? 1 : 0) : 0)) * (m.userData.podScale ?? 1);
    const u = m.userData.uniforms;
    u.fanSpin.value = this.spin;
    u.brake.value += ((c.throttle < 0 && vF > 0.5 ? 1 : 0) - u.brake.value) * Math.min(1, dt * 14);
    u.boost.value += ((this.boosting ? 1 : 0) - u.boost.value) * Math.min(1, dt * 6);
  }
}
