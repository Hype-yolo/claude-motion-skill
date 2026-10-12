import * as THREE from 'three';
import { RAPIER, GRAVITY, GROUPS_WHEEL_RAY } from '../physics/world';
import type { DriverInput } from '../core/input';
import type { CarSpec } from './specs';
import { clamp } from '../core/math';

export type WheelName = 'FL' | 'FR' | 'RL' | 'RR';

export interface WheelDef {
  name: WheelName;
  /** wheel centre at rest, car-local (nose +Z, left +X, up +Y) */
  mount: THREE.Vector3;
  radius: number;
  width: number;
  front: boolean;
  left: boolean;
}

export interface WheelState {
  def: WheelDef;
  attached: boolean;
  grounded: boolean;
  length: number; // suspension length (hardpoint → wheel centre)
  load: number; // N
  contact: THREE.Vector3;
  normal: THREE.Vector3;
  steer: number;
  spin: number;
  spinVel: number;
  skid: number; // 0..1
  slipSpeed: number; // m/s of sliding at the contact
  groundIsCar: boolean;
  /** per-wheel grip multiplier from damage (bent rim, flat tyre) */
  gripMul: number;
}

/** What damage does to the driving. Filled in by the damage model every step. */
export interface VehicleMods {
  powerMul: number;
  steerMul: number;
  steerPull: number; // rad, constant pull to one side
  engineDead: boolean;
  topSpeedMul: number;
}

export const defaultMods = (): VehicleMods => ({ powerMul: 1, steerMul: 1, steerPull: 0, engineDead: false, topSpeedMul: 1 });

const L_STATIC = 0.2; // hardpoint to wheel centre at rest
const DROOP = 0.16;
const BUMP = 0.13;
const ROLL_INFLUENCE = 0.55;

const _v = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _left = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _hp = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _wf = new THREE.Vector3();
const _f = new THREE.Vector3();
const _s = new THREE.Vector3();
const _imp = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

/**
 * Raycast vehicle on a Rapier rigid body. Each wheel is a ray; springs hold the body up, and a simple
 * "stick until the friction limit, then slide" tyre model gives arcade grip that still lets a hard hit on
 * the rear quarter spin a car round — the core of derby play.
 */
export class Vehicle {
  readonly wheels: WheelState[];
  readonly spec: CarSpec;
  readonly body: RAPIER.RigidBody;
  mods: VehicleMods = defaultMods();

  // outputs
  speed = 0; // forward speed m/s (signed)
  rpm = 800;
  gear = 1;
  reversing = false;
  throttleOut = 0;
  brakeOut = 0;
  groundedCount = 0;
  upDot = 1; // body up · world up
  steer = 0;

  private k: number[] = [];
  private c: number[] = [];
  private freeLen: number[] = [];
  private staticLoad: number[] = [];
  private world: RAPIER.World;
  readonly wheelbase: number;

  constructor(world: RAPIER.World, body: RAPIER.RigidBody, spec: CarSpec, defs: WheelDef[]) {
    this.world = world;
    this.body = body;
    this.spec = spec;
    this.wheels = defs.map((def) => ({
      def,
      attached: true,
      grounded: false,
      length: L_STATIC,
      load: 0,
      contact: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      steer: 0,
      spin: 0,
      spinVel: 0,
      skid: 0,
      slipSpeed: 0,
      groundIsCar: false,
      gripMul: 1,
    }));
    const front = defs.filter((d) => d.front);
    const rear = defs.filter((d) => !d.front);
    const zf = front.reduce((a, d) => a + d.mount.z, 0) / Math.max(1, front.length);
    const zr = rear.reduce((a, d) => a + d.mount.z, 0) / Math.max(1, rear.length);
    this.wheelbase = Math.max(1, zf - zr);
    // static weight split from the centre of mass position
    const comZ = spec.comForward;
    const frontShare = clamp((comZ - zr) / this.wheelbase, 0.3, 0.7);
    const g = -GRAVITY;
    const omega = 2 * Math.PI * spec.suspFreq;
    for (const d of defs) {
      const share = d.front ? frontShare / Math.max(1, front.length) : (1 - frontShare) / Math.max(1, rear.length);
      const m = spec.mass * share;
      const k = m * omega * omega;
      const c = 2 * spec.suspDamping * Math.sqrt(k * m);
      this.k.push(k);
      this.c.push(c);
      this.staticLoad.push(m * g);
      this.freeLen.push(L_STATIC + (m * g) / k);
    }
  }

  /** Wheel centre in car-local space for the visuals. */
  wheelLocalCenter(i: number, out: THREE.Vector3) {
    const w = this.wheels[i];
    return out.copy(w.def.mount).setY(w.def.mount.y + (L_STATIC - w.length));
  }

  step(dt: number, input: DriverInput) {
    const body = this.body;
    const spec = this.spec;
    const mods = this.mods;
    const t = body.translation();
    const r = body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _pos.set(t.x, t.y, t.z);
    _up.set(0, 1, 0).applyQuaternion(_q);
    _fwd.set(0, 0, 1).applyQuaternion(_q);
    _left.set(1, 0, 0).applyQuaternion(_q);
    const lv = body.linvel();
    _vel.set(lv.x, lv.y, lv.z);
    this.speed = _vel.dot(_fwd);
    this.upDot = _up.y;
    const mass = body.mass();

    // --- driver intent → drive / brake / reverse -----------------------------------------------------
    let drive = 0;
    let brake = 0;
    if (this.reversing) {
      if (input.throttle > 0.1 && this.speed > -1.0) this.reversing = false;
    } else if (input.brake > 0.1 && input.throttle < 0.1 && this.speed < 0.8) {
      this.reversing = true;
    }
    if (this.reversing) {
      drive = -input.brake;
      brake = this.speed < -0.5 ? input.throttle : 0;
    } else {
      drive = input.throttle;
      brake = input.brake;
    }
    if (mods.engineDead) drive = 0;
    this.throttleOut = Math.abs(drive);
    this.brakeOut = brake;

    // --- steering: faster cars get less lock ----------------------------------------------------------
    const absSpeed = Math.abs(this.speed);
    const speedFactor = 1 / (1 + absSpeed / spec.steerFade);
    const steerTarget = clamp(input.steer, -1, 1) * spec.steerMax * mods.steerMul * speedFactor + mods.steerPull;
    const steerRate = 3.2;
    this.steer += clamp(steerTarget - this.steer, -steerRate * dt, steerRate * dt);

    // --- engine force at the current speed -------------------------------------------------------------
    const top = spec.topSpeed * mods.topSpeedMul;
    let engineF = 0;
    if (drive > 0) {
      engineF = Math.min(spec.maxDriveForce, spec.power / Math.max(absSpeed, 0.5));
      engineF *= clamp(1 - (this.speed - 0.88 * top) / (0.12 * top), 0, 1);
    } else if (drive < 0) {
      engineF = spec.maxDriveForce * 0.75;
      engineF *= clamp(1 - (-this.speed - 0.85 * spec.reverseSpeed) / (0.15 * spec.reverseSpeed), 0, 1);
    }
    engineF *= Math.abs(drive) * mods.powerMul;
    const driveSign = Math.sign(drive);

    // --- suspension rays ----------------------------------------------------------------------------
    let grounded = 0;
    let drivenGrounded = 0;
    const driven = (w: WheelState) => (spec.drive === 'AWD' ? true : spec.drive === 'FWD' ? w.def.front : !w.def.front);
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      w.grounded = false;
      w.groundIsCar = false;
      if (!w.attached) continue;
      _hp.copy(w.def.mount).setY(w.def.mount.y + L_STATIC).applyQuaternion(_q).add(_pos);
      _dir.copy(_up).negate();
      _ray.origin = { x: _hp.x, y: _hp.y, z: _hp.z };
      _ray.dir = { x: _dir.x, y: _dir.y, z: _dir.z };
      const maxLen = L_STATIC + DROOP + w.def.radius;
      const hit = this.world.castRayAndGetNormal(_ray, maxLen, true, undefined, GROUPS_WHEEL_RAY, undefined, body);
      if (!hit) {
        w.length += (L_STATIC + DROOP - w.length) * Math.min(1, dt * 12);
        w.load = 0;
        continue;
      }
      const toi = hit.timeOfImpact;
      const len = toi - w.def.radius;
      const prevLen = w.length;
      w.length = clamp(len, L_STATIC - BUMP, L_STATIC + DROOP);
      w.contact.copy(_hp).addScaledVector(_dir, toi);
      w.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      if (w.normal.dot(_up) < 0.2) {
        // hitting a wall edge-on with the wheel ray: treat as airborne
        w.load = 0;
        continue;
      }
      const compression = this.freeLen[i] - len;
      const compVel = clamp((prevLen - w.length) / dt, -5, 5);
      let f = this.k[i] * compression + this.c[i] * compVel;
      if (len < L_STATIC - BUMP) f += this.k[i] * 6 * (L_STATIC - BUMP - len); // bump stop
      f = clamp(f, 0, this.staticLoad[i] * 6);
      w.load = f;
      w.grounded = f > 0;
      if (!w.grounded) continue;
      grounded++;
      if (driven(w)) drivenGrounded++;
      _imp.copy(w.normal).multiplyScalar(f * dt);
      body.applyImpulseAtPoint(_imp, w.contact, true);
      const other = hit.collider.parent();
      if (other && other.isDynamic() && other.handle !== body.handle) {
        w.groundIsCar = true;
        other.applyImpulseAtPoint(_imp.negate(), w.contact, true);
      }
    }
    this.groundedCount = grounded;

    // --- tyres ----------------------------------------------------------------------------------------
    const mEff = mass / Math.max(1, grounded);
    const brakeFront = spec.brakeForce * 0.6 * 0.5;
    const brakeRear = spec.brakeForce * 0.4 * 0.5;
    let maxWheelSpin = 0;
    for (const w of this.wheels) {
      w.skid *= Math.exp(-dt * 8);
      w.slipSpeed = 0;
      if (!w.attached) continue;
      w.steer = w.def.front ? this.steer : 0;
      if (!w.grounded) {
        // free spin in the air
        const isDriven = driven(w);
        const target = isDriven && Math.abs(drive) > 0 ? driveSign * 60 : w.spinVel * 0.98;
        w.spinVel += (target - w.spinVel) * Math.min(1, dt * 2);
        w.spin += w.spinVel * dt;
        continue;
      }
      // wheel frame on the contact plane
      _wf.copy(_fwd).applyAxisAngle(_up, w.steer);
      _f.copy(_wf).addScaledVector(w.normal, -_wf.dot(w.normal)).normalize();
      _s.crossVectors(w.normal, _f).normalize(); // points left
      const vp = body.velocityAtPoint(w.contact);
      _v.set(vp.x, vp.y, vp.z);
      const vLong = _v.dot(_f);
      const vLat = _v.dot(_s);

      const handbrakeRear = input.handbrake && !w.def.front;
      const muLat = spec.grip * w.gripMul * (handbrakeRear ? 0.38 : 1);
      const muLong = spec.longGrip * w.gripMul;
      const maxLat = muLat * w.load * dt;
      const maxLong = muLong * w.load * dt;

      // lateral: kill sideways velocity at this wheel, as far as friction allows
      let latImp = -vLat * mEff * 0.9;

      // longitudinal
      let longImp = 0;
      const isDriven = driven(w);
      if (isDriven && drivenGrounded > 0) longImp += (engineF / drivenGrounded) * driveSign * dt;
      // brakes (never reverse the wheel's motion)
      let brakeF = brake * (w.def.front ? brakeFront : brakeRear);
      if (handbrakeRear) brakeF = Math.max(brakeF, spec.brakeForce * 0.45);
      if (brakeF > 0) {
        const stop = -vLong * mEff;
        longImp += clamp(stop, -brakeF * dt, brakeF * dt);
      }
      // rolling resistance + engine braking when coasting
      if (Math.abs(drive) < 0.05) {
        const coast = (isDriven ? 0.05 : 0.012) * mEff * vLong * dt * 6;
        longImp -= clamp(coast, -Math.abs(vLong) * mEff, Math.abs(vLong) * mEff);
      }

      // friction ellipse
      const wantLat = latImp;
      const wantLong = longImp;
      const e = (latImp / Math.max(maxLat, 1e-6)) ** 2 + (longImp / Math.max(maxLong, 1e-6)) ** 2;
      let sliding = false;
      if (e > 1) {
        const sc = 1 / Math.sqrt(e);
        latImp *= sc;
        longImp *= sc;
        sliding = true;
        // kinetic friction is a little lower than static: lets a slide keep going
        latImp *= 0.88;
      }
      const latSlide = sliding ? Math.abs(wantLat - latImp) / mEff : 0;
      const longSlide = sliding ? Math.abs(wantLong - longImp) / mEff : 0;
      const wheelSpin = isDriven && sliding && Math.abs(engineF) > 0 && Math.abs(wantLong) > maxLong ? longSlide : 0;
      maxWheelSpin = Math.max(maxWheelSpin, wheelSpin);
      w.slipSpeed = Math.max(latSlide, longSlide);
      w.skid = Math.max(w.skid, clamp((w.slipSpeed - 1.2) / 6, 0, 1));

      _imp.copy(_s).multiplyScalar(latImp).addScaledVector(_f, longImp);
      _ap.copy(w.contact).addScaledVector(_up, spec.comHeight * ROLL_INFLUENCE);
      body.applyImpulseAtPoint(_imp, _ap, true);

      // wheel visual spin: rolling, plus wheelspin / lockup
      const locked = brakeF > 0 && sliding && !isDriven ? true : handbrakeRear;
      let target = vLong / w.def.radius;
      if (locked) target = 0;
      if (wheelSpin > 0) target += driveSign * (wheelSpin * 4) / w.def.radius;
      w.spinVel += (target - w.spinVel) * Math.min(1, dt * 20);
      w.spin += w.spinVel * dt;
    }

    // --- mild air stabilisation: damp roll/pitch tumbling when airborne ------------------------------
    if (grounded === 0) {
      const av = body.angvel();
      const yaw = _up.x * av.x + _up.y * av.y + _up.z * av.z;
      const k = Math.exp(-dt * 0.8);
      body.setAngvel(
        { x: _up.x * yaw + (av.x - _up.x * yaw) * k, y: _up.y * yaw + (av.y - _up.y * yaw) * k, z: _up.z * yaw + (av.z - _up.z * yaw) * k },
        true,
      );
    }

    // --- engine rpm (for sound and the tach) ---------------------------------------------------------
    const idle = 800;
    const wheelRps = absSpeed / (this.wheels[0]?.def.radius ?? 0.33);
    const gears = spec.gears;
    let rpmGear = (wheelRps * 60 * gears[this.gear - 1] * spec.finalDrive) / (2 * Math.PI);
    if (!this.reversing) {
      if (rpmGear > spec.redline * 0.92 && this.gear < gears.length) this.gear++;
      else if (this.gear > 1 && rpmGear < spec.redline * 0.42) this.gear--;
    } else this.gear = 1;
    rpmGear = (wheelRps * 60 * gears[this.gear - 1] * spec.finalDrive) / (2 * Math.PI);
    let target = Math.max(idle, rpmGear);
    if (maxWheelSpin > 0.5 || grounded === 0) target = Math.max(target, idle + this.throttleOut * (spec.redline - idle) * 0.95);
    else if (this.throttleOut > 0.1 && absSpeed < 2) target = Math.max(target, idle + this.throttleOut * 2200);
    if (mods.engineDead) target = 0;
    target = Math.min(target, spec.redline);
    this.rpm += (target - this.rpm) * Math.min(1, dt * (target > this.rpm ? 9 : 5));
  }
}
