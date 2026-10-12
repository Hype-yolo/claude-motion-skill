// Modelled shopfronts for the shops near the camera: the Asian Shop Pack's Hong Kong fronts (shop_slice.py), laid
// side by side in the street strip's order and stretched to fill the shop, the same way the far strip (props.js)
// is mapped, so a shop shows the very same fronts at every distance. Listing is CPU-side like facadekit.js and
// runs on the same re-lists, around the same U.kitCenter the strip measures from.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  attribute, positionGeometry, normalGeometry, positionWorld, vec2, vec3, float, mix, step, texture, fract, cos, sin,
  normalize, cross, dot, max, inverseSqrt, select, dFdx, dFdy, transformNormalToView,
} from 'three/tsl';
import { loadArray } from '../core/shared.js';
import { streetLight } from './lightmap.js';
import { makeBatch, MOVE } from './facadekit.js';
import { toFloatGeometry } from '../vehicle/model.js';
import KIT from './shopkit.json';

export const SHOP_NEAR = 110;
const N = KIT.modules.length;
const START = KIT.modules.map((_, k) => KIT.modules.slice(0, k).reduce((a, m) => a + m.w, 0));
export const STRIP = START[N - 1] + KIT.modules[N - 1].w;

// the whole fronts a shop of width w shows, from the module boundary nearest its strip offset; stretch = strip
// metres per metre of shop
export function shopFit(seed, w) {
  const o = ((seed * 5.13) % 1) * STRIP;
  let k0 = 0;
  for (let k = 1; k < N; k++) if (Math.abs(START[k] - o) < Math.abs(START[k0] - o)) k0 = k;
  const list = [];
  let sum = 0;
  for (;;) {
    const next = sum + KIT.modules[(k0 + list.length) % N].w;
    if (list.length && Math.abs(next - w) >= Math.abs(sum - w)) break;
    list.push((k0 + list.length) % N);
    sum = next;
  }
  return { start: START[k0], sum, list };
}

export async function loadShopKit() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [gltf, albedo, normal, mr] = await Promise.all([
    loader.loadAsync('/models/shops.glb'),
    loadArray('/tex/shopkit_albedo.webp', 1024, { srgb: true }),
    loadArray('/tex/shopkit_normal.webp', 1024),
    loadArray('/tex/shopkit_mr.webp', 1024),
  ]);
  gltf.scene.updateMatrixWorld(true);
  const mods = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = toFloatGeometry(o.geometry);
    g.applyMatrix4(o.matrixWorld);
    mods.set(o.name.replace(/^S_/, ''), g);
  });
  return { mods, albedo, normal, mr };
}

export function createShopKit(city, kit, lightmap) {
  const group = new THREE.Group();
  group.name = 'shop-kit';
  const material = shopMaterial(kit, lightmap);
  const batches = KIT.modules.map((m) => {
    const bt = makeBatch(kit.mods.get(m.name), material);
    group.add(bt.mesh);
    return bt;
  });

  // every module a shop wears: (module, origin xyz + x scale, rotY, open, seed, 0, 0 0 0 0)
  const shops = city.shopfronts.map((s) => {
    const fit = shopFit(s.seed, s.w);
    const c = Math.cos(s.rotY), sn = Math.sin(s.rotY);
    const nx = sn, nz = c, rx = c, rz = -sn;
    const lx = s.x - nx * 0.02 - rx * s.w / 2, lz = s.z - nz * 0.02 - rz * s.w / 2;
    const sx = s.w / fit.sum;
    const recs = [];
    let at = 0;
    for (const k of fit.list) {
      recs.push(k, lx + rx * at * sx, 0.2, lz + rz * at * sx, sx, s.rotY, s.open ? 1 : 0, s.seed, 0, 0, 0, 0, 0);
      at += KIT.modules[k].w;
    }
    return { s, nx, nz, wx: s.x - nx * 0.02, wz: s.z - nz * 0.02, recs: new Float32Array(recs) };
  });

  function list(c) {
    for (const bt of batches) bt.n = 0;
    for (const S of shops) {
      const { s } = S;
      // half a metre past the strip's own threshold, so between the two something always stands
      if (Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z) >= SHOP_NEAR + 0.5) continue;
      if ((c.x - S.wx) * S.nx + (c.z - S.wz) * S.nz < -MOVE) continue;
      for (let i = 0; i < S.recs.length; i += 13) batches[S.recs[i]].push(S.recs, i + 1);
    }
    for (const bt of batches) bt.commit();
  }

  return { group, list };
}

function shopMaterial(kit, lightmap) {
  const m = new THREE.MeshStandardNodeMaterial();
  const kO = attribute('kO', 'vec4'), kF = attribute('kF', 'vec4');
  const mat = attribute('_mat', 'vec4'), col = attribute('_col', 'vec4'), uv2 = attribute('_uv2', 'vec4'), uv = attribute('uv', 'vec2');
  const open = kF.y, seed = kF.z;
  const c = cos(kF.x), s = sin(kF.x);
  const right = vec3(c, 0, s.negate()), n = vec3(s, 0, c);
  const pg = positionGeometry, ng = normalGeometry;
  m.positionNode = kO.xyz.add(right.mul(pg.x.mul(kO.w))).add(vec3(0, pg.y, 0)).add(n.mul(pg.z));
  const N0 = normalize(right.mul(ng.x.div(kO.w)).add(vec3(0, ng.y, 0)).add(n.mul(ng.z)));

  // the normal and metal-rough maps are tiling detail on their own UV sets: tangents from screen derivatives
  const P = positionWorld;
  const tn = texture(kit.normal, uv2.zw).depth(mat.y.max(0)).xyz.mul(2).sub(1).mul(vec3(1, -1, 1));
  const q0 = dFdx(P), q1 = dFdy(P), st0 = dFdx(uv2.zw), st1 = dFdy(uv2.zw);
  const q1p = cross(q1, N0), q0p = cross(N0, q0);
  const T = q1p.mul(st0.x).add(q0p.mul(st1.x)), B = q1p.mul(st0.y).add(q0p.mul(st1.y));
  const det = max(dot(T, T), dot(B, B));
  const sc = select(det.equal(0), float(0), inverseSqrt(det));
  const Nmap = normalize(T.mul(tn.x.mul(sc)).add(B.mul(tn.y.mul(sc))).add(N0.mul(tn.z)));
  m.normalNode = transformNormalToView(mix(N0, Nmap, step(0, mat.y))).normalize();

  const A = select(mat.x.lessThan(0), vec3(1), texture(kit.albedo, uv).depth(mat.x.max(0)).rgb);
  const MR = texture(kit.mr, uv2.xy).depth(mat.z.max(0));
  const hasMR = step(0, mat.z);
  const kind = mat.w;
  const isLit = step(0.5, kind).mul(step(kind, 1.5)), isSign = step(1.5, kind);
  m.roughnessNode = mix(mix(col.x, MR.g.mul(col.x), hasMR), float(0.08), isLit);
  m.metalnessNode = mix(col.y, MR.b.mul(col.y), hasMR).mul(isLit.oneMinus());

  // lit as the strip is: interiors glow when the shop is open, signs always, dimmer once it has shut
  const warmI = mix(vec3(1.0, 0.86, 0.66), vec3(0.86, 0.95, 1.0), step(0.45, fract(seed.mul(7.31))));
  const albedo = A.mul(0.85);
  const spill = streetLight(lightmap, P.xz.add(vec2(n.x, n.z)));
  m.colorNode = albedo;
  m.emissiveNode = A.mul(isLit.mul(warmI).mul(1.9).mul(open).add(isSign.mul(mix(float(0.5), float(1.1), open)))).add(spill.mul(albedo).mul(2.2));
  return m;
}
