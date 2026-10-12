// Sky lanes over the avenues. Each lane is a straight line at a fixed altitude; lanes that run north-south
// and lanes that run east-west sit at different heights so they never cross. Every craft's position is a
// pure function of time, so the GPU draws them with no per-frame upload and the CPU can recompute the few
// near the player for collisions. Lane markers float along each lane like runway lights.
import * as THREE from 'three/webgpu';
import {
  Fn, attribute, positionGeometry, normalGeometry, vec2, vec3, vec4, float, fract, mix, step, smoothstep, abs, sin, cos,
  length, normalize, cross, cameraPosition, transformNormalToView, varying, exp, dot,
} from 'three/tsl';
import { CITY } from '../city/layout.js';
import { loft, curve } from '../vehicle/loft.js';
import { U } from '../core/shared.js';
import { LAYER_NOREFL } from '../city/ground.js';
import { mulberry32 } from '../core/rng.js';
import { footprintVsBox } from '../vehicle/kite.js';

export const SKY_ALT = { z: [72, 168, 330], x: [118, 236] };
const SPACING = 64;
// the craft body (craftGeometry): half-length, half-width, bottom and top above its lane point
const CRAFT = { hl: 2.1, hw: 0.85, y0: -0.05, y1: 0.85 };
const _v = new THREE.Vector3(), _box = { x0: 0, x1: 0, z0: 0, z1: 0 }, _c = {};

export function buildSkyLanes(city) {
  const lanes = [];
  const rng = mulberry32(99);
  const avenues = (list) => list.filter((l) => l.w >= 24 && Math.abs(l.p) < CITY.half - 10 && !l.harbour);
  for (const l of avenues(city.xs)) {
    for (const [k, y] of SKY_ALT.z.entries()) {
      if (k === 2 && rng() < 0.5) continue; // the high express lanes only over some avenues
      // runs along z; keep left: heading +z on the +x side
      lanes.push({ axis: 1, c: l.p + 5, y, dir: 1, a0: -CITY.half, len: CITY.harbourZ + CITY.half, speed: k === 2 ? 46 : 30 + rng() * 6 });
      lanes.push({ axis: 1, c: l.p - 5, y, dir: -1, a0: -CITY.half, len: CITY.harbourZ + CITY.half, speed: k === 2 ? 46 : 30 + rng() * 6 });
    }
  }
  for (const l of avenues(city.zs)) {
    for (const y of SKY_ALT.x) {
      lanes.push({ axis: 0, c: l.p - 5, y, dir: 1, a0: -CITY.half, len: CITY.half * 2, speed: 28 + rng() * 8 });
      lanes.push({ axis: 0, c: l.p + 5, y, dir: -1, a0: -CITY.half, len: CITY.half * 2, speed: 28 + rng() * 8 });
    }
  }
  // craft: evenly spaced with jitter, a few gaps
  for (const ln of lanes) {
    ln.craft = [];
    const n = Math.floor(ln.len / SPACING);
    for (let i = 0; i < n; i++) if (rng() < 0.82) ln.craft.push({ phase: (i + rng() * 0.5) / n, seed: rng(), kind: rng() < 0.15 ? 1 : 0 });
  }
  return lanes;
}

// position along the lane at time t, identical to the shader
export function craftPos(ln, c, t, out) {
  const f = (((c.phase + (t * ln.speed) / ln.len) % 1) + 1) % 1;
  const s = ln.dir > 0 ? ln.a0 + f * ln.len : ln.a0 + (1 - f) * ln.len;
  const bob = Math.sin(t * 0.9 + c.seed * 40) * 0.6;
  if (ln.axis === 1) out.set(ln.c, ln.y + bob, s); else out.set(s, ln.y + bob, ln.c);
  return out;
}

function craftGeometry() {
  return loft({
    z0: -2.1, z1: 2.1, rings: 14, seg: 14,
    halfW: curve([[0, 0.2], [0.15, 0.7], [0.5, 0.85], [0.85, 0.8], [1, 0.55]]),
    yTop: curve([[0, 0.25], [0.3, 0.75], [0.6, 0.85], [1, 0.55]]),
    yMid: curve([[0, 0.2], [1, 0.3]]),
    yBot: curve([[0, 0.15], [0.5, -0.05], [1, 0.1]]),
    nTop: () => 2.6,
    nBot: () => 3,
  });
}

// shared lane maths for the shader: returns world position, forward vector and lane info
function laneNodes() {
  const L0 = attribute('aL0', 'vec4'); // axis, c, y, a0
  const L1 = attribute('aL1', 'vec4'); // len, speed*dir, phase, seed
  const axis = L0.x, c = L0.y, y = L0.z, a0 = L0.w;
  const len = L1.x, sv = L1.y, phase = L1.z, seed = L1.w;
  const dir = sv.sign();
  const f = fract(phase.add(U.time.mul(abs(sv)).div(len)));
  const s = a0.add(mix(float(1).sub(f), f, step(0, dir)).mul(len));
  const bob = sin(U.time.mul(0.9).add(seed.mul(40))).mul(0.6);
  const pos = mix(vec3(s, y.add(bob), c), vec3(c, y.add(bob), s), axis);
  const fwd = mix(vec3(dir, 0, 0), vec3(0, 0, dir), axis);
  return { pos, fwd, seed, axis, dir };
}

export class SkyTraffic {
  constructor(city) {
    this.lanes = buildSkyLanes(city);
    this.group = new THREE.Group();
    this.group.name = 'skytraffic';
    const all = [];
    for (const ln of this.lanes) for (const c of ln.craft) all.push([ln, c]);
    this.count = all.length;
    const L0 = new Float32Array(all.length * 4), L1 = new Float32Array(all.length * 4);
    all.forEach(([ln, c], i) => {
      L0.set([ln.axis, ln.c, ln.y, ln.a0], i * 4);
      L1.set([ln.len, ln.speed * ln.dir, c.phase, c.seed], i * 4);
    });
    const inst = (base) => {
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
      g.setAttribute('aL0', new THREE.InstancedBufferAttribute(L0, 4));
      g.setAttribute('aL1', new THREE.InstancedBufferAttribute(L1, 4));
      g.instanceCount = all.length;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
      return g;
    };

    // craft bodies
    {
      const m = new THREE.MeshStandardNodeMaterial();
      const { pos, fwd, seed } = laneNodes();
      // model forward is -Z: yaw so that -Z maps onto fwd
      const cy = fwd.z.negate(), sy = fwd.x.negate();
      const rot = (v) => vec3(v.x.mul(cy).add(v.z.mul(sy)), v.y, v.z.mul(cy).sub(v.x.mul(sy)));
      const toCam = cameraPosition.sub(pos);
      const dist = length(toCam);
      // beyond a couple of kilometres nothing is drawn
      const keep = step(dist, 2600);
      m.positionNode = rot(positionGeometry).mul(keep).add(pos);
      m.normalNode = transformNormalToView(rot(normalGeometry)).normalize();
      const P = positionGeometry, N = normalGeometry;
      const paint = mix(vec3(0.05, 0.05, 0.06), vec3(0.5, 0.45, 0.1), step(0.82, seed));
      m.colorNode = paint;
      m.metalnessNode = float(0.6);
      m.roughnessNode = float(0.3);
      const front = step(N.z, -0.5), rear = step(0.5, N.z);
      const facing = step(0, dot(fwd, toCam));
      const near = mix(vec3(1.0, 0.92, 0.8).mul(front.mul(7)), vec3(1.0, 0.05, 0.06).mul(rear.mul(4)), rear)
        .add(vec3(0.2, 0.9, 1.0).mul(step(abs(P.y.sub(0.3)), 0.04).mul(2)));
      // far: the whole craft is a lamp
      const dotCol = mix(vec3(1.0, 0.05, 0.05).mul(2.2), vec3(1.0, 0.9, 0.75).mul(3), facing);
      m.emissiveNode = mix(near, dotCol, smoothstep(160, 500, dist)).add(vec3(1, 0.1, 0.1).mul(step(0.5, fract(U.time.add(seed.mul(7)))).mul(step(abs(P.x), 0.1)).mul(step(0.7, P.y)).mul(3)));
      const mesh = new THREE.Mesh(inst(craftGeometry()), m);
      mesh.frustumCulled = false;
      mesh.layers.set(LAYER_NOREFL);
      this.group.add(mesh);
    }

    // light trails: a long streak behind each craft, white in front and red behind depending on view
    {
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const { pos, fwd } = laneNodes();
      const vA = varying(float(0), 'vTrA');
      const vC = varying(vec3(0), 'vTrC');
      m.positionNode = Fn(() => {
        const toCam = cameraPosition.sub(pos);
        const dist = length(toCam);
        const side = normalize(cross(fwd, toCam.div(dist.max(1e-3))));
        const lenT = float(44);
        const along = positionGeometry.y.add(0.5); // 0 at the craft, 1 at the end of the trail
        const w = dist.mul(0.0011).max(0.3);
        const p = pos.sub(fwd.mul(along.mul(lenT).add(1.6))).add(side.mul(positionGeometry.x.mul(w)));
        const facing = step(0, dot(fwd, toCam));
        vC.assign(mix(vec3(1.0, 0.06, 0.08), vec3(0.85, 0.9, 1.0), facing));
        vA.assign(float(1).sub(along).pow(1.3).mul(smoothstep(2600, 900, dist)).mul(smoothstep(8, 30, dist)).mul(0.75));
        return p;
      })();
      const across = varying(positionGeometry.x, 'vTrX');
      m.colorNode = vC;
      m.opacityNode = vA.mul(float(1).sub(abs(across).mul(2)).max(0));
      const mesh = new THREE.Mesh(inst(new THREE.PlaneGeometry(1, 1)), m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      mesh.layers.set(LAYER_NOREFL);
      this.group.add(mesh);
    }

    // lane markers: soft lights every 40 m on both edges of each lane pair
    {
      const items = [];
      for (const ln of this.lanes) {
        if (ln.dir < 0) continue;
        const cMid = ln.c - 5 * (ln.axis === 1 ? 1 : -1);
        for (let s = ln.a0 + 20; s < ln.a0 + ln.len; s += 40) {
          for (const side of [-1, 1]) {
            const off = cMid + side * 10;
            items.push(ln.axis === 1 ? [off, ln.y - 1.5, s, ln.axis] : [s, ln.y - 1.5, off, ln.axis]);
          }
        }
      }
      const data = new Float32Array(items.length * 4);
      items.forEach((v, i) => data.set(v, i * 4));
      const base = new THREE.PlaneGeometry(1, 1);
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute('position', base.attributes.position);
      g.setAttribute('aM', new THREE.InstancedBufferAttribute(data, 4));
      g.instanceCount = items.length;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const aM = attribute('aM', 'vec4');
      const vA = varying(float(0), 'vMkA');
      const vUV = varying(vec2(0), 'vMkUV');
      m.positionNode = Fn(() => {
        const p = aM.xyz;
        const toCam = cameraPosition.sub(p);
        const dist = length(toCam);
        const right = normalize(cross(vec3(0, 1, 0), toCam));
        const up = normalize(cross(toCam, right));
        const s = dist.mul(0.004).max(0.5);
        // a pulse runs along each lane in the direction of travel
        const run = fract(p.x.add(p.z).div(160).sub(U.time.mul(0.35)));
        vA.assign(smoothstep(2200, 500, dist).mul(smoothstep(6, 20, dist)).mul(run.pow(6).mul(1.6).add(0.35)));
        vUV.assign(positionGeometry.xy);
        return p.add(right.mul(positionGeometry.x.mul(s))).add(up.mul(positionGeometry.y.mul(s)));
      })();
      const r = length(vUV);
      m.colorNode = mix(vec3(0.15, 0.85, 1.0), vec3(1.0, 0.65, 0.2), aM.w.oneMinus()).mul(2.5);
      m.opacityNode = vA.mul(smoothstep(0.5, 0.0, r));
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      mesh.layers.set(LAYER_NOREFL);
      this.group.add(mesh);
    }
  }

  // the kite's body against every craft it touches, box to box: out over or under it when that is the shorter
  // way, otherwise off its side or nose, with a knock that depends on the closing speed
  collide(kite, t) {
    const p = kite.pos;
    const fx = -Math.sin(kite.yaw), fz = -Math.cos(kite.yaw);
    let hit = 0;
    for (const ln of this.lanes) {
      if (Math.abs(p.y - ln.y) > 4) continue;
      const across = ln.axis === 1 ? p.x : p.z;
      if (Math.abs(across - ln.c) > kite.hl + CRAFT.hw + 0.5) continue;
      for (const c of ln.craft) {
        craftPos(ln, c, t, _v);
        const hx = ln.axis === 1 ? CRAFT.hw : CRAFT.hl, hz = ln.axis === 1 ? CRAFT.hl : CRAFT.hw;
        if (Math.abs(p.x - _v.x) > hx + kite.hl + 0.5 || Math.abs(p.z - _v.z) > hz + kite.hl + 0.5) continue;
        const y0 = _v.y + CRAFT.y0, y1 = _v.y + CRAFT.y1;
        if (p.y + kite.yHi < y0 || p.y - kite.yLo > y1) continue;
        _box.x0 = _v.x - hx; _box.x1 = _v.x + hx; _box.z0 = _v.z - hz; _box.z1 = _v.z + hz;
        if (!footprintVsBox(p.x, p.z, fx, fz, kite.hl, kite.hw, _box, _c)) continue;
        const up = y1 + kite.yLo - p.y, down = p.y + kite.yHi - y0;
        if (Math.min(up, down) < _c.d) {
          const s = up < down ? 1 : -1;
          p.y += s * (Math.min(up, down) + 0.002);
          const rv = kite.vel.y * s;
          if (rv < 0) { kite.vel.y -= rv * 1.3 * s; hit = Math.max(hit, -rv); }
          continue;
        }
        p.x += _c.nx * (_c.d + 0.002);
        p.z += _c.nz * (_c.d + 0.002);
        const cvx = ln.axis === 1 ? 0 : ln.speed * ln.dir, cvz = ln.axis === 1 ? ln.speed * ln.dir : 0;
        const rv = (kite.vel.x - cvx) * _c.nx + (kite.vel.z - cvz) * _c.nz;
        if (rv < 0) {
          const j = -rv * 1.3;
          kite.vel.x += _c.nx * j;
          kite.vel.z += _c.nz * j;
          const lx = _c.cx - p.x, lz = _c.cz - p.z;
          kite.yawRate += THREE.MathUtils.clamp(((lz * _c.nx - lx * _c.nz) * j * 0.22) / kite.inertia, -1.2, 1.2);
          hit = Math.max(hit, -rv);
        }
      }
    }
    if (hit > 2.5) kite.hit(hit, 'craft');
    return hit;
  }
}
