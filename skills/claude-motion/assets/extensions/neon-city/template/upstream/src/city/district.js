// Temple Street, composed and lit in Blender (assets-src/district): tenements, signs, cables and the market gate as
// static meshes over an atlas of Cycles' diffuse light; air-conditioners and street clutter as instances carrying
// the light measured where each stands; and the light at street level as a top-down map that the ground, the
// shopfronts and anything moving through the street read in place of the city-wide glow (lightmap.js).
// Baked surfaces take no diffuse from the scene's lights (their light is all in the bake) and keep their specular.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  texture, uv, vec2, vec3, float, color, positionWorld, normalWorld, normalMap, attribute, mix, smoothstep, step, fract, select, cross,
  normalize, cameraPosition, min, Fn, lights, normalView, positionViewDirection,
} from 'three/tsl';
import { noiseTex } from '../core/shared.js';
import { hash12 } from '../tsl/util.js';
import { toFloatGeometry } from '../vehicle/model.js';
import D from './district.json';

export const DISTRICT = D;
// the exposure the district was lit for in Blender, so baked light and emitters land as they rendered there
export const EXPO = 2 ** -0.8;

let ktx2 = null;
export async function loadDistrict(renderer, { small = false } = {}) {
  ktx2 ??= new KTX2Loader().detectSupport(renderer);
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
  const [scene, props, lm, ground] = await Promise.all([
    gltf.loadAsync('/district/district.glb'),
    gltf.loadAsync('/district/props.glb'),
    ktx2.loadAsync(small ? '/district/lightmap_2k.ktx2' : '/district/lightmap.ktx2'),
    ktx2.loadAsync('/district/ground.ktx2'),
  ]);
  for (const t of [lm, ground]) { t.colorSpace = THREE.LinearSRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; }
  const ids = new Set();
  scene.scene.traverse((o) => { if (o.isMesh && o.material.userData.nz_tex) ids.add(o.material.userData.nz_tex); });
  const ph = {};
  await Promise.all([...ids].map(async (id) => {
    const [diff, nor, arm] = await Promise.all(['diff', 'nor', 'arm'].map((k) => ktx2.loadAsync(`/district/ph/${id}_${k}${small && k !== 'arm' ? '_1k' : ''}.ktx2`)));
    for (const t of [nor, arm]) t.colorSpace = THREE.NoColorSpace;
    for (const t of [diff, nor, arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    ph[id] = { diff, nor, arm };
  }));
  return { scene: scene.scene, props: props.scene, lm, ground, ph };
}

// the street-level map: game (x, z) → texel; rows run from z1 down (the EXR's top row is the plane's far edge)
const R = D.region;
export const groundUV = (xz) => vec2(xz.x.sub(R.x0).div(R.x1 - R.x0), float(R.z1).sub(xz.y).div(R.z1 - R.z0));
// metres inside the region's edge, for fading between the baked map and the city's own
export const insideRegion = (xz) => xz.x.sub(R.x0).min(float(R.x1).sub(xz.x)).min(xz.y.sub(R.z0)).min(float(R.z1).sub(xz.y));

// rain streaks down every wall, as compose.py's grime() darkens the base colour in Blender
const grime = (amount) => {
  const n = texture(noiseTex, vec2(positionWorld.x.add(positionWorld.z).mul(0.35), positionWorld.y.mul(0.35))).a;
  return mix(float(1), float(1 - amount), smoothstep(0.42, 0.78, n));
};

// A room behind every lit pane (interior mapping). export.py gives each pane its own frame: metres across and up
// from its lower left corner (uv2) and its size (uv3). The view ray, in that frame, runs to the first of the side
// walls, floor, ceiling or back wall of a room a little wider and taller than the window: a fluorescent tube on
// the ceiling, cabinets and counters against the back wall, and on some panes a curtain or blinds part drawn.
// Returns how bright the pane is against its flat emission.
const room = Fn(() => {
  // glTF stores every UV set as 1 - v, these two included
  const p = vec2(uv(2).x, float(1).sub(uv(2).y)), size = vec2(uv(3).x, float(1).sub(uv(3).y));
  const n = normalWorld, t = normalize(cross(vec3(0, 1, 0), n));
  const V = normalize(positionWorld.sub(cameraPosition));
  const d = vec3(V.dot(t), V.y, V.dot(n).min(-0.03));
  const w = size.x, h = size.y;
  const x0 = float(-0.5), x1 = w.add(0.5), y0 = float(-0.95), y1 = h.add(0.45), depth = float(3.2);
  const tx = select(d.x.greaterThan(0), x1.sub(p.x), p.x.sub(x0)).div(d.x.abs().max(1e-4));
  const ty = select(d.y.greaterThan(0), y1.sub(p.y), p.y.sub(y0)).div(d.y.abs().max(1e-4));
  const tz = depth.div(d.z.negate());
  const tm = min(tx, min(ty, tz));
  const H = vec3(p.x.add(d.x.mul(tm)), p.y.add(d.y.mul(tm)), d.z.mul(tm));
  // one id per window: the world position of its lower left corner, snapped to half metres first (the hash
  // turns the last bits of float jitter across the pane into speckle)
  const o = positionWorld.sub(t.mul(p.x)).sub(vec3(0, p.y, 0)).mul(2).add(0.37).floor();
  const seed = hash12(vec2(o.x.add(o.z.mul(17.0)), o.y));
  const back = step(tz, tx).mul(step(tz, ty));
  const flat = step(ty, tx).mul(step(ty, tz)).mul(back.oneMinus());
  const side = back.oneMinus().mul(flat.oneMinus());
  const ceiling = flat.mul(step(0, d.y)), floorHit = flat.mul(step(d.y, 0));
  const up = H.y.sub(y0); // height above the room's floor
  // cabinets and counters along the back wall, one per 0.9 m cell, or a gap
  const cell = hash12(vec2(H.x.div(0.9).floor(), seed.mul(57)));
  const top = select(cell.lessThan(0.3), float(0), select(cell.lessThan(0.65), float(0.85), float(1.85)));
  const furn = back.mul(step(up, top));
  const lip = furn.mul(smoothstep(top.sub(0.05), top.sub(0.01), up));
  // walls, floor, ceiling and furniture; the room is tinted by the pane's own colour (the caller multiplies)
  const base = float(0.7).sub(side.mul(0.16)).sub(floorHit.mul(0.42)).add(ceiling.mul(0.08));
  const surf = mix(base, float(0.2), furn).add(lip.mul(0.5));
  // lit from the tube: falls off with distance from it
  const L = vec3(w.mul(0.5), y1.sub(0.08), depth.mul(-0.5));
  const r2 = H.sub(L).dot(H.sub(L));
  const lamp = float(1.5).div(r2.mul(0.4).add(1)).add(0.22);
  const tube = ceiling.mul(smoothstep(0.07, 0.03, H.z.sub(L.z).abs())).mul(smoothstep(w.mul(0.32), w.mul(0.28), H.x.sub(L.x).abs()));
  let shade = surf.mul(lamp).add(tube.mul(5));
  // a curtain pulled across part of some panes, lit through from behind; blinds half down on others
  const k = fract(seed.mul(13.1));
  const curtain = step(0.3, seed).mul(step(seed, 0.55)).mul(step(p.x, w.mul(k.mul(0.5).add(0.25))));
  const folds = p.x.mul(26).sin().mul(0.18).add(0.72);
  const blind = step(seed, 0.3).mul(step(h.mul(k.mul(0.5).add(0.3)), p.y));
  const slats = smoothstep(0.35, 0.5, fract(p.y.mul(12))).mul(smoothstep(0.95, 0.8, fract(p.y.mul(12)))).mul(0.45).add(0.4);
  shade = mix(mix(shade, folds, curtain), slats, blind);
  return shade.mul(fract(seed.mul(7.31)).mul(0.6).add(0.7));
});

// the surface as glTF describes it, or as the Poly Haven set its extras name
function surface(src, ph) {
  const ex = src.userData;
  const t = ex.nz_tex && ph[ex.nz_tex];
  const s = {};
  if (t) {
    s.alb = texture(t.diff).rgb.mul(vec3(...ex.nz_tint));
    const arm = texture(t.arm);
    s.ao = arm.r; s.rough = arm.g; s.metal = arm.b;
    // glTF UVs run down the image; derivative tangents then need the y flip GLTFLoader also applies
    s.normal = normalMap(texture(t.nor), vec2(1, -1));
  } else {
    s.alb = src.map ? texture(src.map).rgb.mul(color(src.color)) : color(src.color);
    s.ao = src.aoMap ? texture(src.aoMap).r : float(1);
    s.rough = src.roughnessMap ? texture(src.roughnessMap).g.mul(src.roughness) : float(src.roughness);
    s.metal = src.metalnessMap ? texture(src.metalnessMap).b.mul(src.metalness) : float(src.metalness);
    if (src.normalMap) s.normal = normalMap(texture(src.normalMap), vec2(src.normalScale.x, src.normalScale.y));
  }
  if (ex.nz_grime) s.alb = s.alb.mul(grime(ex.nz_grime));
  // Blender's tubes run to strength 45, which AgX takes in its stride; under ACES and the game's bloom that much
  // turns every board into a haze, so strong emitters are rolled off (windows at 1-3 barely move)
  const I = src.emissiveIntensity * EXPO;
  let e = color(src.emissive).mul(I / (1 + I / 8));
  if (src.emissiveMap) e = e.mul(texture(src.emissiveMap).rgb);
  s.emit = src.emissive.getHex() ? e : null;
  s.room = !!s.emit && src.name.startsWith('glass_');
  return s;
}

function material(src, s, light, panes = false) {
  const m = new THREE.MeshStandardNodeMaterial({ name: src.name, side: src.side });
  // a metal's colour is its specular; everything else gets its diffuse from the bake alone
  m.colorNode = s.alb.mul(s.metal);
  m.roughnessNode = s.rough;
  // glass reflects the environment alone: the moon, a point light, would be a sub-pixel spike on a near-mirror pane
  if (src.name.startsWith('glass_')) m.lightsNode = lights([]);
  m.metalnessNode = s.metal;
  if (s.normal) m.normalNode = s.normal;
  const lit = s.alb.mul(s.ao).mul(light);
  const emit = s.emit && (s.room && panes ? s.emit.mul(room()) : s.emit);
  m.emissiveNode = emit ? lit.add(emit) : lit;
  if (src.alphaTest > 0 || src.transparent) {
    m.opacityNode = src.map ? texture(src.map).a.mul(src.opacity) : float(src.opacity);
    m.alphaTest = src.alphaTest || 0.5;
  }
  return m;
}

export function createDistrict(data) {
  const group = new THREE.Group();
  group.name = 'district';
  const root = data.scene;
  // compose.py built the street around the origin; glTF's y-up export keeps x and turns Blender's -y into z
  root.position.set(D.origin[0], 0, D.origin[1]);
  group.add(root);

  const lmLight = texture(data.lm, uv(1)).rgb.mul(EXPO);
  // signs and cables have no bake of their own: the street's light reaches them from below
  const spill = texture(data.ground, groundUV(positionWorld.xz)).rgb.mul(EXPO * 0.6)
    .mul(smoothstep(-0.6, 0.4, normalWorld.y.negate()).mul(0.6).add(0.4));
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const baked = !!o.geometry.attributes.uv1;
    const key = o.material.uuid + baked;
    if (!cache.has(key)) cache.set(key, material(o.material, surface(o.material, data.ph), baked ? lmLight : spill, !!o.geometry.attributes.uv3));
    o.material = cache.get(key);
    o.frustumCulled = true;
  });

  const props = createProps(data);
  group.add(props.group);
  return { group, update: props.update, warm: props.warm, materials: cache.size };
}

// ---------------------------------------------------------------- instanced props, one list per level of detail
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);

function createProps(data) {
  const group = new THREE.Group();
  group.name = 'district-props';
  const nodes = new Map();
  data.props.updateMatrixWorld(true);
  data.props.traverse((o) => {
    if (!o.isMesh) return;
    // a multi-material node comes in as a group of meshes
    const name = (o.parent && o.parent !== data.props && !o.parent.isScene ? o.parent : o).name;
    if (!nodes.has(name)) nodes.set(name, []);
    const g = toFloatGeometry(o.geometry);
    g.applyMatrix4(o.matrixWorld);
    nodes.get(name).push({ geometry: g, src: o.material });
  });
  const irr = attribute('aIrr', 'vec3');
  // the light they were measured in, a little stronger on what faces up
  const light = irr.mul(EXPO).mul(normalWorld.y.mul(0.15).add(0.9));
  const mats = new Map();
  const sets = [];
  for (const [kind, items] of Object.entries(D.props)) {
    const lods = [0, 1, 2].map((i) => nodes.get(`${kind}_lod${i}`)).filter(Boolean);
    if (!lods.length) continue;
    const n = items.length;
    lods[0][0].geometry.computeBoundingSphere();
    const r = lods[0][0].geometry.boundingSphere.radius;
    const levels = lods.map((parts) => {
      const matrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16).setUsage(THREE.DynamicDrawUsage);
      const aIrr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const meshes = parts.map(({ geometry, src }) => {
        if (!mats.has(src.uuid)) {
          const s = surface(src, {});
          const m = material(src, s, light);
          // the bake holds no specular, but in light from all round a dielectric still reflects a Fresnel share of
          // it: that sheen is what shows a glossy black bin bag under the neon instead of a hole
          const f = float(1).sub(normalView.dot(positionViewDirection).abs()).pow(5).mul(0.96).add(0.04);
          m.emissiveNode = m.emissiveNode.add(light.mul(f).mul(float(1).sub(s.rough).pow(2)).mul(float(1).sub(s.metal)));
          mats.set(src.uuid, m);
        }
        geometry.setAttribute('aIrr', aIrr);
        const mesh = new THREE.InstancedMesh(geometry, mats.get(src.uuid), n);
        mesh.instanceMatrix = matrix;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.name = `${kind}`;
        group.add(mesh);
        return mesh;
      });
      return { matrix, aIrr, meshes };
    });
    // full detail within a few dozen metres of the camera, whatever their size
    const d0 = Math.max(14, r * 26), d1 = Math.max(60, r * 110);
    sets.push({ items, levels, d0, d1 });
  }

  let last = new THREE.Vector3(1e9, 0, 0), frame = 0;
  // the boot warm-up draws one of every level, so no level's buffers or pipeline wait for its first close pass
  const warm = () => {
    for (const s of sets) for (const L of s.levels) {
      const it = s.items[0];
      _m.compose(_v.set(it[0], it[1], it[2]), _q.setFromAxisAngle(_up, it[3]), _s).toArray(L.matrix.array, 0);
      L.aIrr.array.set([it[4], it[5], it[6]], 0);
      for (const m of L.meshes) m.count = 1;
      L.matrix.needsUpdate = L.aIrr.needsUpdate = true;
    }
    last.set(1e9, 0, 0);
  };
  const update = (camera) => {
    frame++;
    if (camera.position.distanceToSquared(last) < 0.25 && frame % 30) return;
    last.copy(camera.position);
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (const s of sets) {
      const counts = s.levels.map(() => 0);
      for (const it of s.items) {
        const dx = it[0] - cx, dy = it[1] - cy, dz = it[2] - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 900) continue;
        const li = Math.min(s.levels.length - 1, d < s.d0 ? 0 : d < s.d1 ? 1 : 2);
        const L = s.levels[li], k = counts[li]++;
        _m.compose(_v.set(it[0], it[1], it[2]), _q.setFromAxisAngle(_up, it[3]), _s);
        _m.toArray(L.matrix.array, k * 16);
        L.aIrr.array[k * 3] = it[4]; L.aIrr.array[k * 3 + 1] = it[5]; L.aIrr.array[k * 3 + 2] = it[6];
      }
      s.levels.forEach((L, i) => {
        const c = counts[i];
        for (const m of L.meshes) m.count = c;
        for (const a of [L.matrix, L.aIrr]) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, Math.max(1, c) * a.itemSize);
          a.needsUpdate = true;
        }
      });
    }
  };
  return { group, update, warm };
}
