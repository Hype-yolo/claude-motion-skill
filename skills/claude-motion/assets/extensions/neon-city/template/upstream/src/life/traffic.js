// Street traffic. Taxis, minibuses, buses, vans and private cars keep left, queue behind each other and stop for
// the signals. A fixed pool is spread over the lanes around the camera and recycled as it moves; from
// altitude the pool widens so the avenues read as rivers of headlights and tail-lights.
import * as THREE from 'three/webgpu';
import { attribute, positionGeometry, normalGeometry, uv, vec3, float, mix, step, abs, smoothstep, sin, cos, texture, cameraPosition, length, dot } from 'three/tsl';
import { CITY } from '../city/layout.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { toFloatGeometry } from '../vehicle/model.js';
import VEH from './vehicles.json';
import { useInstancing } from '../city/instancing.js';
import { U } from '../core/shared.js';
import { streetLight } from '../city/lightmap.js';
import { mulberry32 } from '../core/rng.js';
import { footprintVsBox } from '../vehicle/kite.js';

const _box = { x0: 0, x1: 0, z0: 0, z1: 0 };
const _c = { nx: 0, nz: 0, d: 0, cx: 0, cz: 0 };

// per axis; the other axis runs in the second half, after 2.5 s of all-red for the junction to clear
const CYCLE = 38, GREEN = 14, AMBER = 2.5;

// signal state for traffic moving along an axis: 0 green, 1 amber, 2 red
export function signalState(axis, t) {
  const c = ((t % CYCLE) + CYCLE) % CYCLE;
  const local = axis === 'x' ? c : (c + CYCLE / 2) % CYCLE;
  if (local < GREEN) return 0;
  if (local < GREEN + AMBER) return 1;
  return 2;
}

function buildLanes(city) {
  const lanes = [];
  const offs = (w) => (w >= 24 ? [3.1, 9.3] : [3.5]);
  for (const l of city.xs) {
    // runs along z; heading +z keeps left at +x
    const cross = city.zs.map((c) => ({ p: c.p, w: c.w }));
    for (const o of offs(l.w)) {
      lanes.push({ axis: 'z', dir: 1, c: l.p + o, street: l.p, a0: -CITY.half, a1: CITY.harbourZ - 18, cross });
      lanes.push({ axis: 'z', dir: -1, c: l.p - o, street: l.p, a0: -CITY.half, a1: CITY.harbourZ - 18, cross });
    }
  }
  for (const l of city.zs) {
    // runs along x; heading +x keeps left at -z
    const cross = city.xs.map((c) => ({ p: c.p, w: c.w }));
    for (const o of offs(l.w)) {
      lanes.push({ axis: 'x', dir: 1, c: l.p - o, street: l.p, a0: -CITY.half, a1: CITY.half, cross });
      lanes.push({ axis: 'x', dir: -1, c: l.p + o, street: l.p, a0: -CITY.half, a1: CITY.half, cross });
    }
  }
  lanes.forEach((ln, i) => (ln.id = i));
  return lanes;
}

// The Hong Kong street mix. Every type is an authored model baked to one atlas (assets-src/blender_bake.py);
// sizes come from the bake: half-width, roof height, length. Forward is -Z like the KITE.
const MIX = [
  ['taxi', 0.3], ['minibus', 0.1], ['van', 0.1], ['bus', 0.05],
  ['sedan', 0.1], ['minivan', 0.1], ['suv', 0.07], ['hatch', 0.06], ['wagon', 0.06], ['coupe', 0.06],
];
export const TYPES = MIX.map(([name, weight]) => {
  const v = VEH[name];
  return { name, weight, w: v.size[0] / 2, roof: v.size[1], len: v.size[2], emax: v.emax, paintLum: v.paintLum };
});
const LOD_NEAR = 75; // metres: inside it a car is drawn at full detail with a clearcoat

const LUMA = vec3(0.2126, 0.7152, 0.0722);

// Hong Kong colours: red urban taxis, green New Territories cabs, a few blue Lantau ones; private cars are mostly
// white, silver and black; minibuses are cream with a green or red roof
function paintFor(type, v) {
  const c = (r, g, b) => vec3(r, g, b);
  if (type.name === 'taxi') return mix(mix(c(0.42, 0.015, 0.012), c(0.03, 0.25, 0.07), step(0.8, v)), c(0.06, 0.22, 0.55), step(0.95, v));
  if (type.name === 'van') return mix(c(0.72, 0.72, 0.7), c(0.4, 0.41, 0.43), step(0.7, v));
  let p = c(0.74, 0.74, 0.72);
  p = mix(p, c(0.4, 0.41, 0.43), step(0.28, v));
  p = mix(p, c(0.012, 0.012, 0.014), step(0.5, v));
  p = mix(p, c(0.11, 0.115, 0.12), step(0.68, v));
  p = mix(p, c(0.02, 0.035, 0.1), step(0.8, v));
  p = mix(p, c(0.12, 0.01, 0.014), step(0.88, v));
  return mix(p, c(0.42, 0.36, 0.26), step(0.94, v));
}

function trafficMaterial(type, src, lightmap, near) {
  const m = near ? new THREE.MeshPhysicalNodeMaterial() : new THREE.MeshStandardNodeMaterial();
  const info = attribute('aCar', 'vec4'); // paint variant, brake, seed, unused
  const P = positionGeometry, N = normalGeometry;
  const L = type.len, H = type.roof;
  const variant = info.x, brake = info.y;
  const alb = texture(src.map, uv());
  const mr = texture(src.metalnessMap, uv());
  const emt = texture(src.emissiveMap, uv());
  const lum = dot(alb.rgb, LUMA);
  let paint = mr.r;
  let glass = alb.a;
  let col;
  if (type.name === 'minibus') {
    // the coaster's livery: cream body, the band above the windows and the roof in the route colour
    const roofCol = mix(vec3(0.02, 0.26, 0.07), vec3(0.42, 0.02, 0.015), step(0.6, variant));
    const band = smoothstep(H * 0.8, H * 0.83, P.y);
    const shade = lum.div(type.paintLum).min(1.3);
    col = mix(alb.rgb, mix(vec3(0.66, 0.58, 0.4), roofCol, band).mul(shade), paint);
    // its windows are painted dark into the body texture: let them read as glass
    glass = glass.max(paint.mul(smoothstep(0.06, 0.02, lum)).mul(step(P.y, H * 0.8)).mul(step(0.9, P.y)));
  } else if (type.paintLum > 0) {
    const shade = lum.div(type.paintLum).min(1.6);
    col = mix(alb.rgb, paintFor(type, variant).mul(shade), paint);
  } else col = alb.rgb;
  col = mix(col, vec3(0.008, 0.009, 0.011), glass);
  m.colorNode = col;
  // the rain keeps every upward surface wet
  const wet = smoothstep(0.3, 0.8, N.y).mul(U.rain).mul(0.45);
  m.roughnessNode = mix(mix(mr.g, float(0.3), paint), float(0.04), glass).mul(float(1).sub(wet));
  m.metalnessNode = mr.b.mul(float(1).sub(paint)).mul(float(1).sub(glass));
  if (near) {
    m.clearcoatNode = paint.mul(0.9);
    m.clearcoatRoughnessNode = float(0.06);
  }
  m.opacityNode = emt.a;
  m.alphaTest = 0.5;

  // lamps: authored emission, white at the nose, red at the tail and brighter under braking
  const nose = smoothstep(-0.3 * L, -0.38 * L, P.z), tail = smoothstep(0.3 * L, 0.38 * L, P.z);
  const em = emt.rgb.mul(type.emax);
  const red = smoothstep(0.08, 0.25, em.r.sub(em.g.max(em.b)));
  let lamps = em.mul(float(2.5).add(nose.mul(U.headlights).mul(7))).mul(mix(float(1), mix(float(1.6), float(5), brake), tail.mul(red)));
  if (type.emax < 0.01) {
    // no authored lamps on this one: a pair at each corner
    const pair = smoothstep(0.13, 0.09, abs(abs(P.x).sub(type.w * 0.72))).mul(smoothstep(0.12, 0.08, abs(P.y.sub(0.78))));
    lamps = vec3(1.0, 0.92, 0.8).mul(pair.mul(step(N.z, -0.5)).mul(nose).mul(9))
      .add(vec3(1.0, 0.03, 0.03).mul(pair.mul(step(0.5, N.z)).mul(tail).mul(mix(float(2.5), float(8), brake))));
  }
  let e = lamps;
  // cabins lit from inside: buses and minibuses bright, cars faint
  const cabin = type.name === 'bus' ? 0.75 : type.name === 'minibus' ? 0.45 : 0.03;
  e = e.add(vec3(0.85, 0.9, 1.0).mul(glass.mul(cabin)));
  // neon from the street on the paint
  const ipr = attribute('iPR', 'vec4');
  const lm = streetLight(lightmap, ipr.xz);
  e = e.add(lm.mul(col).mul(1.3));
  // far away a car is just its lamps: white if it is coming towards us, red if it is going away
  const fwd = vec3(sin(ipr.w).negate(), 0, cos(ipr.w).negate());
  const toCam = cameraPosition.sub(ipr.xyz);
  const dist = length(toCam);
  const facing = step(0, dot(fwd, toCam));
  const dotCol = mix(vec3(1.0, 0.04, 0.03).mul(4), vec3(1.0, 0.9, 0.75).mul(7), facing);
  m.emissiveNode = near ? e : mix(e, dotCol, smoothstep(140, 420, dist));
  useInstancing(m);
  return m;
}

export class Traffic {
  constructor(city, lightmap, { pool = 900 } = {}) {
    this.city = city;
    this.lanes = buildLanes(city);
    this.rng = mulberry32(4242);
    this.group = new THREE.Group();
    this.group.name = 'traffic';
    this.lightmap = lightmap;
    this.meshes = null;
    this.cars = [];
    for (let i = 0; i < pool; i++) {
      const r = this.rng();
      let ti = 0, acc = TYPES[0].weight;
      while (ti < TYPES.length - 1 && r > acc) acc += TYPES[++ti].weight;
      this.cars.push({ active: false, type: ti, lane: null, s: 0, v: 0, vmax: 0, brake: 0, variant: this.rng(), seed: this.rng(), x: 0, z: 0, yaw: 0 });
    }
    this.time = 0;
  }

  // the models arrive after construction; until then nothing is drawn but the simulation runs
  async load() {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const counts = TYPES.map((_, i) => this.cars.filter((c) => c.type === i).length);
    this.meshes = await Promise.all(TYPES.map(async (type, ti) => {
      const gltf = await loader.loadAsync(`/models/traffic/${type.name}.glb`);
      gltf.scene.updateMatrixWorld(true);
      const lods = [];
      for (const [k, near] of [['lod0', true], ['lod1', false]]) {
        let src = null;
        gltf.scene.traverse((o) => { if (o.isMesh && !src && (o.name === k || o.parent?.name === k)) src = o; });
        const base = toFloatGeometry(src.geometry).applyMatrix4(src.matrixWorld);
        const geo = new THREE.InstancedBufferGeometry();
        geo.index = base.index;
        for (const [name, a] of Object.entries(base.attributes)) geo.setAttribute(name, a);
        const n = Math.max(1, counts[ti]);
        const pr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
        const sc = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
        const car = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('iPR', pr);
        geo.setAttribute('iS', sc);
        geo.setAttribute('aCar', car);
        // one placeholder instance so the warm-up compile has something finite to draw
        geo.instanceCount = 1;
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
        const mesh = new THREE.Mesh(geo, trafficMaterial(type, src.material, this.lightmap, near));
        mesh.frustumCulled = false;
        mesh.name = `${type.name}-${k}`;
        this.group.add(mesh);
        lods.push({ mesh, geo, pr, car });
      }
      return lods;
    }));
  }

  radius(camY) {
    return THREE.MathUtils.clamp(260 + camY * 2.4, 260, 1500);
  }

  spawn(car, cam, R, fill) {
    // pick a lane that passes near the camera, and a spot on it inside the radius; after the first fill new cars
    // appear out at the edge of the radius, never in plain view, and never on top of the player
    for (let tries = 0; tries < 12; tries++) {
      const ln = this.lanes[Math.floor(this.rng() * this.lanes.length)];
      const across = ln.axis === 'z' ? cam.x : cam.z;
      const along = ln.axis === 'z' ? cam.z : cam.x;
      const d = Math.abs(across - ln.c);
      if (d > R) continue;
      const span = Math.sqrt(R * R - d * d);
      const a = along + (this.rng() * 2 - 1) * span;
      if (a < ln.a0 + 5 || a > ln.a1 - 5) continue;
      const x = ln.axis === 'z' ? ln.c : a, z = ln.axis === 'z' ? a : ln.c;
      const dc = Math.hypot(x - cam.x, z - cam.z);
      if (!fill && dc < R * 0.55) continue;
      if (this.avoid && Math.hypot(x - this.avoid.x, z - this.avoid.z) < 16) continue;
      if (this.cars.some((o) => o.active && o.lane === ln && Math.abs(o.s - a) < 14)) continue;
      // never in a junction or so close to one it could not stop for the lights, nor against a car on another lane
      if (ln.cross.some((c) => Math.abs(a - c.p) < c.w / 2 + 20)) continue;
      if (this.cars.some((o) => o.active && Math.abs(o.x - x) < 8 && Math.abs(o.z - z) < 8)) continue;
      car.lane = ln;
      car.s = a;
      car.vmax = (ln.axis === 'z' ? 1 : 1) * THREE.MathUtils.lerp(11, 17, this.rng());
      car.v = car.vmax * 0.8;
      car.active = true;
      return true;
    }
    return false;
  }

  update(dt, camPos, simTime, kite) {
    this.time = simTime;
    const R = this.radius(Math.max(0, camPos.y));
    // a big jump of the camera (start, teleport to a run) refills the whole radius
    const fill = !this.lastCam || this.lastCam.distanceToSquared(camPos) > 150 * 150;
    if (fill && this.lastCam) for (const car of this.cars) car.active = false;
    this.lastCam = (this.lastCam || new THREE.Vector3()).copy(camPos);
    this.avoid = kite && kite.pos.y - kite.groundY < 3 ? kite.pos : null;
    // a believable density: about one car per 40 m of lane at street level, more when the view is wide
    const maxActive = Math.min(this.cars.length, Math.round(180 + (R - 260) * 0.58));
    let active = 0;
    const byLane = new Map();
    for (const car of this.cars) {
      if (car.active) {
        const ln = car.lane;
        const dx = (ln.axis === 'z' ? ln.c : car.s) - camPos.x, dz = (ln.axis === 'z' ? car.s : ln.c) - camPos.z;
        if (dx * dx + dz * dz > R * R * 1.3 || car.s < ln.a0 || car.s > ln.a1) car.active = false;
      }
      if (!car.active && (active >= maxActive || !this.spawn(car, camPos, R, fill))) continue;
      if (++active > maxActive * 1.1) { car.active = false; continue; }
      let arr = byLane.get(car.lane.id);
      if (!arr) byLane.set(car.lane.id, (arr = []));
      arr.push(car);
    }

    // which junctions have a car in them, and from which axis (1 along z, 2 along x): nobody enters a junction
    // the cross traffic is still in, whatever the lights say
    const occ = this.occ || (this.occ = new Map());
    occ.clear();
    const jKey = (ln, c) => (ln.axis === 'z' ? ln.street * 7919 + c.p : c.p * 7919 + ln.street);
    for (const arr of byLane.values()) {
      const ln = arr[0].lane, bit = ln.axis === 'z' ? 1 : 2;
      for (const car of arr) {
        const half = TYPES[car.type].len / 2;
        for (const c of ln.cross) if (Math.abs(car.s - c.p) < c.w / 2 + half) { const k = jKey(ln, c); occ.set(k, (occ.get(k) || 0) | bit); }
      }
    }

    for (const arr of byLane.values()) {
      const ln = arr[0].lane;
      const other = ln.axis === 'z' ? 2 : 1;
      arr.sort((a, b) => (a.s - b.s) * ln.dir);
      const sig = signalState(ln.axis, simTime);
      for (let i = 0; i < arr.length; i++) {
        const car = arr[i];
        let target = car.vmax;
        // queue behind the car ahead
        const lead = arr[i + 1];
        if (lead) {
          const gap = (lead.s - car.s) * ln.dir - TYPES[lead.type].len * 0.5 - TYPES[car.type].len * 0.5;
          target = Math.min(target, Math.max(0, (gap - 3) * 0.9), lead.v + (gap - 8) * 0.6);
        }
        // the player's car, when it is down on the street in this lane, is a car to queue behind as well
        const av = this.avoid;
        if (av) {
          const across = ln.axis === 'z' ? av.x : av.z, along = ln.axis === 'z' ? av.z : av.x;
          const gap = (along - car.s) * ln.dir - TYPES[car.type].len * 0.5 - 2.6;
          if (Math.abs(across - ln.c) < 2.6 && gap > -1.5 && gap < 60) {
            const kv = Math.max(0, (ln.axis === 'z' ? kite.vel.z : kite.vel.x) * ln.dir);
            target = Math.min(target, Math.max(0, (gap - 3) * 0.9), kv + (gap - 8) * 0.6);
          }
        }
        // the next stop line: hold there on red, on amber if we still can, or while cross traffic is in the junction
        let stop = Infinity, next = null;
        for (const c of ln.cross) {
          const line = c.p - ln.dir * (c.w / 2 + 4.6);
          const d = (line - car.s) * ln.dir;
          if (d > 0 && d < stop) { stop = d; next = c; }
        }
        if (stop < 60) {
          const canStop = car.v * car.v / (2 * 6) < stop + 2;
          const busy = (occ.get(jKey(ln, next)) || 0) & other;
          if (sig === 2 || ((sig === 1 || busy) && canStop)) target = Math.min(target, Math.max(0, (stop - 1.5) * 0.8));
        }
        target = Math.max(0, target);
        const acc = target > car.v ? 2.6 : -7;
        car.v = target > car.v ? Math.min(target, car.v + acc * dt) : Math.max(target, car.v + acc * dt);
        car.brake = target < car.v - 0.3 || car.v < 0.2 ? 1 : 0;
        car.s += car.v * dt * ln.dir;
        // whatever the braking, a car never runs into the one ahead
        if (lead) {
          const room = (lead.s - car.s) * ln.dir - (TYPES[lead.type].len + TYPES[car.type].len) * 0.5 - 0.6;
          if (room < 0) { car.s += room * ln.dir; car.v = Math.min(car.v, lead.v); }
        }
      }
    }

    // write instance data: full detail near the camera, the light model beyond
    if (!this.meshes) return;
    const counts = TYPES.map(() => [0, 0]);
    for (const car of this.cars) {
      if (!car.active) continue;
      const ln = car.lane;
      const x = ln.axis === 'z' ? ln.c : car.s, z = ln.axis === 'z' ? car.s : ln.c;
      // forward is -Z in model space: heading +z needs yaw pi, heading +x needs -pi/2
      const yaw = ln.axis === 'z' ? (ln.dir > 0 ? Math.PI : 0) : ln.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      car.x = x; car.z = z; car.yaw = yaw;
      const dx = x - camPos.x, dy = camPos.y, dz = z - camPos.z;
      const lod = dx * dx + dy * dy + dz * dz < LOD_NEAR * LOD_NEAR ? 0 : 1;
      const m = this.meshes[car.type][lod];
      const i = counts[car.type][lod]++;
      const bob = Math.sin(simTime * 2.1 + car.seed * 40) * 0.012;
      const pr = m.pr.array, ca = m.car.array, o = i * 4;
      pr[o] = x; pr[o + 1] = 0.02 + bob; pr[o + 2] = z; pr[o + 3] = yaw;
      ca[o] = car.variant; ca[o + 1] = car.brake; ca[o + 2] = car.seed; ca[o + 3] = 0;
    }
    for (let k = 0; k < TYPES.length; k++) {
      for (let l = 0; l < 2; l++) {
        const m = this.meshes[k][l];
        m.geo.instanceCount = counts[k][l];
        m.pr.needsUpdate = true;
        m.car.needsUpdate = true;
      }
    }
  }

  // push the player's KITE out of any car it overlaps, body box against body box; returns the strongest hit speed
  collide(kite) {
    const p = kite.pos;
    if (p.y > 6) return 0;
    let hit = 0;
    const fx = -Math.sin(kite.yaw), fz = -Math.cos(kite.yaw);
    for (const car of this.cars) {
      if (!car.active) continue;
      const dx = p.x - car.x, dz = p.z - car.z;
      if (dx * dx + dz * dz > 100) continue;
      const t = TYPES[car.type];
      if (p.y - kite.yLo > t.roof) continue; // clear over the roof
      const alongZ = car.lane.axis === 'z';
      const hx = alongZ ? t.w : t.len / 2, hz = alongZ ? t.len / 2 : t.w;
      _box.x0 = car.x - hx; _box.x1 = car.x + hx; _box.z0 = car.z - hz; _box.z1 = car.z + hz;
      if (!footprintVsBox(p.x, p.z, fx, fz, kite.hl, kite.hw, _box, _c)) continue;
      // standing on its roof beats being shoved off when we are mostly above it
      if (p.y - kite.yLo > t.roof - 0.5) { p.y = t.roof + kite.yLo; if (kite.vel.y < 0) kite.vel.y = 0; continue; }
      p.x += _c.nx * (_c.d + 0.002);
      p.z += _c.nz * (_c.d + 0.002);
      const carVx = alongZ ? 0 : car.v * car.lane.dir, carVz = alongZ ? car.v * car.lane.dir : 0;
      const rv = (kite.vel.x - carVx) * _c.nx + (kite.vel.z - carVz) * _c.nz;
      if (rv < 0) {
        const j = -rv * 1.25;
        kite.vel.x += _c.nx * j;
        kite.vel.z += _c.nz * j;
        const lx = _c.cx - p.x, lz = _c.cz - p.z;
        kite.yawRate += THREE.MathUtils.clamp(((lz * _c.nx - lx * _c.nz) * j * 0.22) / kite.inertia, -1.2, 1.2);
        hit = Math.max(hit, -rv);
        // only a real knock slows the car; nudging it from behind must not pin it to the spot
        if (-rv > 4) car.v *= 0.7;
      }
    }
    if (hit > 2.5) kite.hit(hit, 'car');
    return hit;
  }
}
