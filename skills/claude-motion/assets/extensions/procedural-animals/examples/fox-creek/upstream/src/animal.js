// The public Animal: build data + render object + motion engine behind a small game-facing API.
import * as THREE from 'three';
import { createAnimalObject } from './core/render/animalObject.js';
import { createMotion } from './core/motion/index.js';

const _v = new THREE.Vector3();

export class Animal {
  constructor(species, data, opts = {}) {
    this.species = species;
    this.id = species.id;
    this.data = data;
    this.seed = data.seed;
    this.params = data.params;
    this.quality = opts.quality || data.quality;
    const ground = opts.ground || (() => 0);
    this.ground = ground;
    this.water = opts.water || null;
    this.render = createAnimalObject(data, species, { quality: this.quality, castShadow: opts.castShadow, receiveShadow: opts.receiveShadow });
    /** Add this to your scene. Keep its own transform at identity: the animal moves by itself. */
    this.object = this.render.group;
    this.object.userData.animal = this;
    this._listeners = new Map();
    this.motion = createMotion(species.plan, {
      species, data, skeleton: this.render.skeleton, ground, water: this.water, perches: opts.perches,
      position: opts.position, heading: opts.heading ?? 0,
      emit: (type, payload) => this._emit(type, payload),
    });
    this.attachments = {};
    this._attachDefs = [];
    for (const [name, def] of Object.entries(this.motion.attachmentPoints || {})) {
      const o = new THREE.Object3D();
      o.name = name;
      o.matrixAutoUpdate = false;
      this.object.add(o);
      this.attachments[name] = o;
      this._attachDefs.push({ o, ...def });
    }
    this.stats = { vertices: data.nV, triangles: data.index.length / 3, bones: data.bones.length, buildMs: data.stats?.buildMs || 0, updateMs: 0 };
    this.time = 0;
    this._lastDt = 1 / 60;
    this.update(0);
  }

  // ---------------------------------------------------------------- control
  /** Locomotion: the animal moves itself. speed in m/s, heading in radians (0 = +Z). */
  move({ speed = 0, heading, climb = 0, gait } = {}) {
    const inp = this.motion.input;
    inp.follow = null;
    inp.target = null;
    inp.speed = Math.max(0, speed);
    if (heading !== undefined) inp.heading = heading;
    inp.climb = climb;
    inp.gait = gait || null;
    return this;
  }
  stop() { return this.move({ speed: 0 }); }
  /** Walk / run to a point and stop there. */
  moveTo(point, { speed = 3 } = {}) {
    const inp = this.motion.input;
    inp.follow = null;
    inp.target = point ? new THREE.Vector3().copy(point) : null;
    inp.targetSpeed = speed;
    return this;
  }
  /** Match your own physics body: the animal is placed at `position` and animates for `velocity`. */
  follow(position, velocity, { heading } = {}) {
    const inp = this.motion.input;
    inp.follow = inp.follow || { position: new THREE.Vector3(), velocity: new THREE.Vector3(), heading: null };
    inp.follow.position.copy(position);
    inp.follow.velocity.copy(velocity || _v.set(0, 0, 0));
    inp.follow.heading = heading ?? null;
    return this;
  }
  /** Look at a world point (Vector3) or stop looking (null). The animal keeps tracking the point you pass. */
  lookAt(target) {
    this.motion.input.look = target ? (target.isVector3 ? target : new THREE.Vector3().copy(target)) : null;
    return this;
  }
  /**
   * Play an action ('jump', 'sit', 'lie', 'sleep', 'eat', 'drink', 'attack', 'hit', 'death', 'stand', ...).
   * A new one-shot interrupts the running one; postures cross-fade.
   * Resolves with 'done' | 'interrupted' | 'stopped' | 'refused'.
   */
  play(name, opts = {}) { return this.motion.play(name, opts); }
  /** End an action (a posture: stand up), or every action but death when no name is given. */
  stopAction(name) { this.motion.stop(name); return this; }
  get actions() { return this.motion.actions; }
  get gaits() { return this.motion.gaits; }
  /** Named speeds for UIs ({ walk, trot, ... } in m/s, scaled to this individual's size). */
  get gears() { return this.motion.gears || {}; }

  // ---------------------------------------------------------------- events
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this._listeners.get(type)?.delete(fn); return this; }
  _emit(type, payload) {
    const set = this._listeners.get(type);
    if (set) for (const fn of set) fn({ type, animal: this, ...payload });
  }

  // ---------------------------------------------------------------- state
  get position() { return this.motion.state.position; }
  get heading() { return this.motion.state.heading; }
  get speed() { return this.motion.state.speed; }
  get velocity() { return this.motion.state.velocity; }
  get state() { return this.motion.state; }

  // ---------------------------------------------------------------- frame
  /** Call once per frame with the frame time in seconds. */
  update(dt) {
    const t0 = now();
    if (!(dt >= 0) || !Number.isFinite(dt)) dt = 0;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.motion.update(dt);
    this.render.update({ dt, time: this.time, motion: this.motion });
    for (const a of this._attachDefs) {
      const b = this.render.skeleton.byName[a.bone];
      if (!b) continue;
      a.o.matrix.multiplyMatrices(b.matrixWorld, a.local);
      a.o.matrixWorld.multiplyMatrices(this.object.matrixWorld, a.o.matrix);
      a.o.matrixWorldNeedsUpdate = false;
    }
    this.stats.updateMs = this.stats.updateMs * 0.9 + (now() - t0) * 0.1;
    return this;
  }

  setQuality(q) { this.render.setQuality?.(q); this.quality = q; return this; }
  /** Motion level of detail: 0 full, 1 reduced secondary motion, 2 crowd (half-rate IK). */
  setLod(level) { this.motion.setLod?.(level); this.lod = level; return this; }
  setDebug(mode, on) { this.render.setDebug?.(mode, on); return this; }
  /** Show or hide the coverings (fur shells and silhouette fins); the base still reads as fur. */
  setCoverings(on) { this.render.setCoverings?.(on); return this; }

  dispose() {
    this.render.dispose();
    this.motion.dispose?.();
    this._listeners.clear();
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
