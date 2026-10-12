// Timed runs through gates, and the shards scattered from the alleys to the spire. Routes are generated from
// the city itself and every gate is pushed clear of the buildings, so each run is flyable as laid out.
import * as THREE from 'three/webgpu';
import {
  Fn, attribute, positionGeometry, normalGeometry, vec2, vec3, float, mix, step, abs, smoothstep, sin, cos, fract, atan, length,
  uniform, cameraPosition, transformNormalToView, exp, varying,
} from 'three/tsl';
import { CITY, queryBoxes, groundAt, SEEDS } from '../city/layout.js';
import { SKY_ALT } from '../life/skytraffic.js';
import { U } from '../core/shared.js';
import { mulberry32, shuffle } from '../core/rng.js';
import { LAYER_NOREFL } from '../city/ground.js';

const _b = [];
function blocked(city, x, y, z, r) {
  queryBoxes(city, x - r, z - r, x + r, z + r, _b);
  for (const b of _b) {
    if (y + r < b.y0 || y - r > b.y1) continue;
    const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
    const cy = Math.max(b.y0, Math.min(y, b.y1));
    if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

// nudge a point until a sphere of radius r fits, searching outward
function clearPoint(city, p, r, dirs = 16) {
  if (!blocked(city, p.x, p.y, p.z, r)) return p;
  for (let d = 2; d < 60; d += 2) {
    for (let k = 0; k < dirs; k++) {
      const a = (k / dirs) * Math.PI * 2;
      const q = new THREE.Vector3(p.x + Math.cos(a) * d, p.y, p.z + Math.sin(a) * d);
      if (!blocked(city, q.x, q.y, q.z, r)) return q;
    }
    for (const dy of [d, -d]) {
      const q = new THREE.Vector3(p.x, Math.max(r + 0.5, p.y + dy), p.z);
      if (!blocked(city, q.x, q.y, q.z, r)) return q;
    }
  }
  return p;
}

function nearestLine(list, v) {
  return list.reduce((a, l) => (Math.abs(l.p - v) < Math.abs(a.p - v) ? l : a), list[0]);
}

// street run: a loop through the narrow streets of the Temple night market, gates mid-block and at the corners,
// all on the left-hand lane like the traffic
function marketRoute(city) {
  const near = (list, v) => list.reduce((a, l) => (Math.abs(l.p - v) < Math.abs(a.p - v) ? l : a), list[0]).p;
  const X = (v) => near(city.xs, v), Z = (v) => near(city.zs, v);
  const corners = [[X(-745), Z(-319)], [X(-1017), Z(-319)], [X(-1017), Z(-202)], [X(-528), Z(-202)], [X(-528), Z(-319)]];
  const start = new THREE.Vector3(X(-745) - 3.5, 0, -130);
  const pts = [];
  let px = start.x + 3.5, pz = start.z;
  for (const [cx, cz] of corners) {
    const dx = Math.sign(cx - px), dz = Math.sign(cz - pz);
    // keep left: heading north (-z) the left is west, heading east the left is north, and so on
    const ox = dz !== 0 ? (dz < 0 ? -3.5 : 3.5) : 0, oz = dx !== 0 ? (dx > 0 ? -3.5 : 3.5) : 0;
    const L = Math.hypot(cx - px, cz - pz);
    const n = Math.max(1, Math.round(L / 62));
    for (let k = 1; k < n; k++) pts.push(new THREE.Vector3(px + ((cx - px) * k) / n + ox, 2.6, pz + ((cz - pz) * k) / n + oz));
    pts.push(new THREE.Vector3(cx, 2.6, cz));
    px = cx; pz = cz;
  }
  return { pts, radius: 6, start };
}

// sky lane run: north up one avenue on the 168 m lane, climb to the 236 m east-west lane, then south down the
// avenue beside the Zenith. Lanes keep left like the street traffic, so the gates sit on the real lanes.
function laneRoute(city) {
  const av = (list) => list.filter((l) => l.w >= 24 && !l.harbour).map((l) => l.p);
  const ax = av(city.xs), az = av(city.zs);
  const near = (list, v) => list.reduce((a, p) => (Math.abs(p - v) < Math.abs(a - v) ? p : a), list[0]);
  const xW = near(ax, -880), xE = near(ax, -100), zS = near(az, 450), zN = near(az, -440);
  const yN = SKY_ALT.z[1], yE = SKY_ALT.x[1];
  const pts = [];
  const leg = (x0, z0, x1, z1, y, n) => { for (let k = 1; k <= n; k++) pts.push(new THREE.Vector3(x0 + ((x1 - x0) * k) / n, y, z0 + ((z1 - z0) * k) / n)); };
  leg(xW - 5, zS, xW - 5, zN + 60, yN, 4);
  pts.push(new THREE.Vector3(xW - 5, (yN + yE) / 2, zN - 2));
  leg(xW + 60, zN - 5, xE - 60, zN - 5, yE, 3);
  pts.push(new THREE.Vector3(xE + 5, (yN + yE) / 2, zN + 4));
  leg(xE + 5, zN + 60, xE + 5, zS, yN, 4);
  return { pts, radius: 11, start: new THREE.Vector3(xW - 5, yN, zS + 150) };
}

// the ascent: up the avenue to the foot of the Zenith, spiral up its faces through the cloud deck, land on the pad
function ascentRoute(city) {
  const x = city.xs.reduce((a, l) => (l.p > 0 && l.p < a ? l.p : a), 1e9) - 3.1;
  const pts = [new THREE.Vector3(x, 3, 200), new THREE.Vector3(x, 12, 118), new THREE.Vector3(x, 46, 40)];
  const n = 14;
  for (let k = 0; k < n; k++) {
    const a = (k + 1) * 0.95; // from the east face, clockwise seen from above: east, south, west, north...
    const y = 80 + (k / (n - 1)) * (CITY.zenith.pad + 12 - 80); // the last one is above the pad, to land from
    const r = 92 - Math.max(0, k - 7) * 6;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r));
  }
  pts.push(new THREE.Vector3(12.5, CITY.zenith.pad + 0.4, 0));
  return { pts, radius: 14, land: true, start: new THREE.Vector3(x, 0, 330) };
}

// the dive: off the south edge of the pad, corkscrew down the Zenith, out along the avenue to the harbour
function diveRoute(city) {
  const x = city.xs.reduce((a, l) => (l.p > 0 && l.p < a ? l.p : a), 1e9) + 3.1;
  const pts = [new THREE.Vector3(0, CITY.zenith.pad - 20, 42)];
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 - (k + 1) * 0.9; // start south, swing round
    const y = CITY.zenith.pad - 170 - k * 175;
    const r = 74 + k * 3;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r));
  }
  pts.push(new THREE.Vector3(x, 60, 30), new THREE.Vector3(x, 30, 180));
  for (let z = 360; z < CITY.harbourZ - 40; z += 200) pts.push(new THREE.Vector3(x, Math.max(14, 30 - z * 0.012), z));
  pts.push(new THREE.Vector3(x, 4, CITY.harbourZ - 14));
  return { pts, radius: 14, start: new THREE.Vector3(6, CITY.zenith.pad, -12) };
}

function pathLength(pts, start) {
  let L = 0, prev = start;
  for (const p of pts) { L += p.distanceTo(prev); prev = p; }
  return L;
}

export function buildRuns(city) {
  const defs = [
    { zh: '街市衝刺', en: 'MARKET DASH', desc: 'Street level through the Temple night market. Keep it on the tarmac, keep left.', route: marketRoute(city), speeds: [26, 20, 15], ground: true },
    { zh: '航道', en: 'SKY LANE', desc: 'North on the 168 m lane, across at 236 m, south past the Zenith. Mind the traffic.', route: laneRoute(city), speeds: [58, 46, 36] },
    { zh: '登頂', en: 'ASCENT', desc: 'Spiral up the Zenith, through the cloud deck, and land on the pad at 1,418 m.', route: ascentRoute(city), speeds: [40, 31, 24] },
    { zh: '俯衝', en: 'THE DIVE', desc: 'Off the pad, corkscrew down through the storm, then flat out to the harbour.', route: diveRoute(city), speeds: [60, 47, 37] },
  ];
  const runs = [];
  for (const d of defs) {
    const pts = d.route.land ? d.route.pts.slice() : d.route.pts.map((p) => clearPoint(city, p, d.route.radius * 0.5));
    if (d.ground) for (const p of pts) p.y = groundAt(city, p.x, p.z, 4) + 2.6;
    let start = d.route.start;
    if (!start) {
      const back = pts[0].clone().sub(pts[1]).setY(0).normalize();
      start = pts[0].clone().addScaledVector(back, 46);
    }
    start = start.clone();
    if (d.ground || start.y < 2) start.y = groundAt(city, start.x, start.z, start.y + 4);
    const toFirst = pts[0].clone().sub(start);
    const yaw = Math.atan2(-toFirst.x, -toFirst.z);
    const L = pathLength(pts, start);
    runs.push({ ...d, gates: pts, radius: d.route.radius, land: !!d.route.land, start, yaw, length: L, medals: d.speeds.map((v) => Math.round((L / v) * 10) / 10) });
  }
  return runs;
}

// shards: placed where the city is worth seeing, at every height
export function buildShards(city) {
  const rng = mulberry32(31);
  const out = [];
  const add = (x, y, z, where) => {
    const p = clearPoint(city, new THREE.Vector3(x, y, z), 1.6);
    out.push({ x: p.x, y: p.y, z: p.z, where });
  };
  // alleys in the markets
  const alleys = shuffle(rng, city.alleys.slice()).slice(0, 8);
  for (const a of alleys) add((a.x0 + a.x1) / 2, 1.6, (a.z0 + a.z1) / 2, 'alley');
  // under the signs that hang over the street
  const over = shuffle(rng, city.signs.filter((s) => s.kind === 'over')).slice(0, 5);
  for (const s of over) add(s.x, Math.max(2.5, s.y - s.h / 2 - 2.2), s.z, 'sign');
  // tenement rooftops, among the water tanks
  const roofs = shuffle(rng, city.buildings.filter((b) => b.style === 0 && b.h > 30 && b.h < 90 && !b.baked)).slice(0, 6);
  for (const b of roofs) add(b.x, b.h + 1.8, b.z, 'roof');
  // tower setbacks
  const towers = shuffle(rng, city.buildings.filter((b) => b.arch === 'corp' && b.tiers.length >= 3 && b.h > 260 && !b.zenith && b.tiers[1].w < b.tiers[0].w - 4)).slice(0, 4);
  for (const b of towers) {
    const t = b.tiers[0], u = b.tiers[1];
    add(t.x + (t.w / 2 - Math.max(2, (t.w - u.w) / 4)), t.y1 + 1.8, t.z, 'ledge');
  }
  // inside the cloud deck, and above it
  for (let k = 0; k < 3; k++) { const a = rng() * Math.PI * 2; add(Math.cos(a) * 260, 590, Math.sin(a) * 260, 'cloud'); }
  for (let k = 0; k < 2; k++) { const a = rng() * Math.PI * 2; add(Math.cos(a) * 180, CITY.zenith.pad + 40, Math.sin(a) * 180, 'sky'); }
  add(0, CITY.zenith.top + 4, 0, 'spire');
  add(40, 3.5, CITY.harbourZ - 8, 'harbour');
  add(-900, 60, CITY.harbourZ + 500, 'water');
  return out;
}

// --- visuals ---
export class RunVisuals {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'runs';
    // gate rings: segmented, chevrons chasing round the rim; the next gate is bright magenta
    const torus = new THREE.TorusGeometry(1, 0.035, 8, 96);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.gateState = uniform(0); // index of next gate
    const info = attribute('aGate', 'vec4'); // index, radius, active, unused
    const P = positionGeometry;
    const ang = atan(P.y, P.x);
    const seg = step(0.18, fract(ang.mul(12 / (2 * Math.PI)).sub(U.time.mul(0.6))));
    const rel = info.x.sub(this.gateState);
    const isNext = step(abs(rel), 0.5);
    const isAfter = step(abs(rel.sub(1)), 0.5);
    const col = mix(vec3(0.2, 0.85, 1.0).mul(isAfter.mul(1.2).add(0.4)), vec3(1.0, 0.24, 0.95).mul(3.2), isNext);
    const pulse = sin(U.time.mul(5)).mul(0.25).add(1);
    m.colorNode = col.mul(seg.mul(0.75).add(0.25)).mul(mix(float(1), pulse, isNext));
    m.opacityNode = info.z.mul(step(-0.5, rel)).mul(mix(float(0.55), float(1), isNext));
    m.positionNode = Fn(() => {
      const c = attribute('aC', 'vec4'); // centre, yaw
      const r = info.y;
      // a landing gate lies flat on the pad
      const p = mix(P, vec3(P.x, P.z, P.y), info.w).mul(r);
      const cy = cos(c.w), sy = sin(c.w);
      return vec3(p.x.mul(cy).add(p.z.mul(sy)), p.y, p.z.mul(cy).sub(p.x.mul(sy))).add(c.xyz);
    })();
    this.gateGeo = new THREE.InstancedBufferGeometry();
    this.gateGeo.index = torus.index;
    this.gateGeo.setAttribute('position', torus.attributes.position);
    this.gateGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    // one inactive gate so the pipeline compiles during the warm-up
    this.gateGeo.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
    this.gateGeo.setAttribute('aGate', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
    this.gateGeo.instanceCount = 1;
    this.gateMesh = new THREE.Mesh(this.gateGeo, m);
    this.gateMesh.frustumCulled = false;
    this.gateMesh.layers.set(LAYER_NOREFL);
    this.gateMesh.visible = false;
    this.group.add(this.gateMesh);

    // run beacons: a shaft of amber light where each run starts, a landmark from across the city, and a ring on
    // the ground that marks where to stop. Close to, the shaft thins out to a haze so it never walls off the view.
    this.beaconGeo = null;
    this.beaconMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    {
      const P = positionGeometry;
      const b = attribute('aB', 'vec4');
      const h = P.y; // 0..1 up the pillar
      const flow = fract(h.mul(18).sub(U.time.mul(0.8)));
      const ang = atan(P.z, P.x);
      const ribs = smoothstep(0.4, 0.5, fract(ang.mul(3 / Math.PI)).sub(0.5).abs().oneMinus());
      this.beaconMat.colorNode = vec3(1.0, 0.62, 0.18).mul(flow.mul(0.6).add(0.6)).mul(ribs.mul(0.4).add(0.8)).mul(1.6);
      const world = vec3(P.x.mul(3), P.y.mul(160), P.z.mul(3)).add(b.xyz);
      const camD = length(cameraPosition.xz.sub(b.xz));
      // a volume, not a tube: the walls fade where they turn edge-on, so the silhouette is soft
      const toCam = cameraPosition.sub(world).xz.normalize();
      const face = abs(vec2(P.x, P.z).normalize().dot(toCam)).pow(1.5);
      const near = mix(float(0.1), float(1), smoothstep(14, 90, camD));
      this.beaconMat.opacityNode = float(1).sub(h).pow(1.6).mul(smoothstep(0, 0.04, h)).mul(0.42).mul(face).mul(near).mul(b.w);
      this.beaconMat.positionNode = world;
    }
    this.padMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    {
      const P = positionGeometry; // unit disc in xy
      const b = attribute('aB', 'vec4');
      const r = length(P.xy);
      const dash = step(0.3, fract(atan(P.y, P.x).mul(16 / Math.PI).sub(U.time.mul(1.2))));
      const rim = smoothstep(0.9, 0.93, r).mul(smoothstep(1.0, 0.97, r)).mul(dash.mul(0.7).add(0.3));
      const pool = smoothstep(0.2, 0.95, r).pow(2).mul(smoothstep(1.0, 0.95, r)).mul(0.16);
      this.padMat.colorNode = vec3(1.0, 0.62, 0.18).mul(1.6);
      const camD = length(cameraPosition.sub(b.xyz));
      this.padMat.opacityNode = rim.add(pool).mul(smoothstep(180, 110, camD)).mul(b.w);
      // on the street, above the kerb-high bumps of the paving; sky runs start from a ring in the air
      this.padMat.positionNode = vec3(P.x.mul(6), 0.12, P.y.mul(6)).add(b.xyz);
    }

    // shards: spinning crystals with a halo
    const oct = new THREE.OctahedronGeometry(0.9, 0);
    oct.scale(0.7, 1.25, 0.7);
    const sm = new THREE.MeshStandardNodeMaterial({ transparent: false });
    const sInfo = attribute('aS', 'vec4'); // x y z alive
    const spin = U.time.mul(1.4);
    const rot = (v) => vec3(v.x.mul(cos(spin)).add(v.z.mul(sin(spin))), v.y, v.z.mul(cos(spin)).sub(v.x.mul(sin(spin))));
    sm.positionNode = rot(positionGeometry).mul(sInfo.w).add(sInfo.xyz).add(vec3(0, sin(U.time.mul(2).add(sInfo.x)).mul(0.25), 0));
    sm.normalNode = transformNormalToView(rot(normalGeometry)).normalize();
    sm.colorNode = vec3(0.1, 0.02, 0.1);
    sm.roughnessNode = float(0.15);
    sm.metalnessNode = float(0.2);
    const facet = abs(normalGeometry.y).mul(0.5).add(0.5);
    sm.emissiveNode = vec3(1.0, 0.25, 0.95).mul(facet.mul(4.5)).mul(sin(U.time.mul(3).add(sInfo.z)).mul(0.25).add(1));
    this.shardMat = sm;
    this.shardBase = oct;
    // halo sprites
    const hm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const vUV = varying(vec2(0), 'vHaloUV');
    hm.positionNode = Fn(() => {
      const s = attribute('aS', 'vec4');
      const toCam = cameraPosition.sub(s.xyz);
      const right = vec3(toCam.z, 0, toCam.x.negate()).normalize();
      const up = vec3(0, 1, 0);
      vUV.assign(positionGeometry.xy);
      const size = float(5).add(length(toCam).mul(0.012)).mul(s.w);
      return s.xyz.add(right.mul(positionGeometry.x.mul(size))).add(up.mul(positionGeometry.y.mul(size)));
    })();
    const rr = length(vUV);
    hm.colorNode = vec3(1.0, 0.3, 0.95).mul(1.6);
    hm.opacityNode = smoothstep(0.5, 0.0, rr).pow(2).mul(0.8);
    this.haloMat = hm;
  }

  setBeacons(runs, enabled) {
    if (this.beaconMesh) this.group.remove(this.beaconMesh, this.padMesh);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = cyl.index;
    g.setAttribute('position', cyl.attributes.position);
    const data = new Float32Array(runs.length * 4);
    runs.forEach((r, i) => data.set([r.start.x, r.start.y, r.start.z, enabled ? 1 : 0], i * 4));
    g.setAttribute('aB', new THREE.InstancedBufferAttribute(data, 4));
    g.instanceCount = runs.length;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    this.beaconMesh = new THREE.Mesh(g, this.beaconMat);
    this.beaconMesh.frustumCulled = false;
    this.beaconMesh.layers.set(LAYER_NOREFL);
    this.group.add(this.beaconMesh);
    const disc = new THREE.CircleGeometry(1, 96);
    const pg = new THREE.InstancedBufferGeometry();
    pg.index = disc.index;
    pg.setAttribute('position', disc.attributes.position);
    pg.setAttribute('aB', g.attributes.aB);
    pg.instanceCount = runs.length;
    pg.boundingSphere = g.boundingSphere;
    this.padMesh = new THREE.Mesh(pg, this.padMat);
    this.padMesh.frustumCulled = false;
    this.padMesh.layers.set(LAYER_NOREFL);
    this.group.add(this.padMesh);
    this.beaconData = g.attributes.aB;
  }

  showBeacons(on) {
    if (!this.beaconData) return;
    for (let i = 0; i < this.beaconData.count; i++) this.beaconData.array[i * 4 + 3] = on ? 1 : 0;
    this.beaconData.needsUpdate = true;
  }

  setGates(run) {
    if (!run) { this.gateMesh.visible = false; return; }
    const n = run.gates.length;
    const C = new Float32Array(n * 4), I = new Float32Array(n * 4);
    run.gates.forEach((p, i) => {
      const next = run.gates[i + 1] || p.clone().add(p.clone().sub(run.gates[i - 1] || run.start));
      const prev = run.gates[i - 1] || run.start;
      const dir = next.clone().sub(prev).setY(0);
      // ring faces along the path; a landing gate lies flat
      const yaw = Math.atan2(dir.x, dir.z);
      C.set([p.x, p.y, p.z, yaw], i * 4);
      I.set([i, run.land && i === n - 1 ? 6 : run.radius, 1, run.land && i === n - 1 ? 1 : 0], i * 4);
    });
    this.gateGeo.setAttribute('aC', new THREE.InstancedBufferAttribute(C, 4));
    this.gateGeo.setAttribute('aGate', new THREE.InstancedBufferAttribute(I, 4));
    this.gateGeo.instanceCount = n;
    this.gateMesh.visible = true;
    this.gateState.value = 0;
  }

  setShards(shards, collected) {
    for (const m of [this.shardMesh, this.haloMesh]) if (m) this.group.remove(m);
    const data = new Float32Array(shards.length * 4);
    shards.forEach((s, i) => data.set([s.x, s.y, s.z, collected.has(i) ? 0 : 1], i * 4));
    const attr = new THREE.InstancedBufferAttribute(data, 4);
    const mk = (base, mat) => {
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
      g.setAttribute('aS', attr);
      g.instanceCount = shards.length;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.layers.set(LAYER_NOREFL);
      this.group.add(mesh);
      return mesh;
    };
    this.shardMesh = mk(this.shardBase, this.shardMat);
    this.haloMesh = mk(new THREE.PlaneGeometry(1, 1), this.haloMat);
    this.shardAttr = attr;
  }

  collectShard(i) {
    this.shardAttr.array[i * 4 + 3] = 0;
    this.shardAttr.needsUpdate = true;
  }
}

export class RunBook {
  constructor(runs) {
    this.list = runs;
    try { this.data = JSON.parse(localStorage.getItem('nz.runs') || '{}'); } catch { this.data = {}; }
  }
  best(i) { return this.data[i]?.best ?? null; }
  splits(i) { return this.data[i]?.splits ?? null; }
  medal(i, t) {
    const m = this.list[i].medals;
    return t <= m[0] ? 'gold' : t <= m[1] ? 'silver' : t <= m[2] ? 'bronze' : null;
  }
  record(i, t, splits) {
    const prev = this.best(i);
    const better = prev === null || t < prev;
    if (better) this.data[i] = { best: t, splits };
    try { localStorage.setItem('nz.runs', JSON.stringify(this.data)); } catch {}
    return better;
  }
}
