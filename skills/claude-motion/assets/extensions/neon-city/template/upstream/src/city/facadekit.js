// Modelled facades for the buildings around the camera. A kit is a real facade (kit_slice.py) cut into
// bay x floor cells; every wall near U.kitCenter is tiled with them on the same grid its photo facade uses
// (buildings.js facadeOf), so the windows, curtains and lit rooms carry over when a building changes over.
// Placement is CPU-side: when the camera has moved a few metres the visible cells are re-listed into one
// instanced batch per cell and level of detail.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  attribute, positionGeometry, normalGeometry, positionWorld, vec2, vec3, float, floor, fract, mix, smoothstep, step,
  select, abs, max, min, texture, cameraPosition, exp, sin, dot, normalize, transformNormalToView, If, Discard, Fn,
} from 'three/tsl';
import { STYLE, queryBoxes } from './layout.js';
import { hash12, hash13 } from '../tsl/util.js';
import { U, noiseTex, loadArray } from '../core/shared.js';
import { lmUV } from './lightmap.js';
import { KIT_NEAR } from './buildings.js';
import { LAYER_KIT } from './ground.js';
import { toFloatGeometry } from '../vehicle/model.js';
import FAC from './facades.json';
import BROWN from './kit_brown.json';
import PROC from './kit_proc.json';

const KITS = [{ name: 'brown', meta: BROWN }, { name: 'proc', meta: PROC }];
const LOD0 = 70; // full detail inside this; the authored low level of detail beyond
export const MOVE = 6; // metres the camera travels before the cells are re-listed
const NORM = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export async function loadFacadeKits() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return Promise.all(KITS.map(async (k) => {
    const [gltf, albedo, pbr, normal] = await Promise.all([
      loader.loadAsync(`/models/kit_${k.name}.glb`),
      loadArray(`/tex/kit_${k.name}_albedo.webp`, 1024, { srgb: true }),
      loadArray(`/tex/kit_${k.name}_pbr.webp`, 1024),
      loadArray(`/tex/kit_${k.name}_normal.webp`, 1024),
    ]);
    gltf.scene.updateMatrixWorld(true);
    const cells = new Map();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = toFloatGeometry(o.geometry);
      g.applyMatrix4(o.matrixWorld);
      cells.set(o.name, g);
    });
    return { ...k, layer: FAC.layers.findIndex((l) => l.name === k.meta.layer), cells, albedo, pbr, normal };
  }));
}

export function createFacadeKit(city, kits, facades, lightmap, tex) {
  const group = new THREE.Group();
  group.name = 'facade-kit';
  const byLayer = new Map(kits.map((k) => [k.layer, k]));
  const tiers = [];
  for (const b of [...city.buildings, ...city.outer]) {
    if (b.baked) continue;
    for (const t of b.tiers) if (t.fac?.kit && byLayer.has(t.fac.layer)) tiers.push({ b, t, kit: byLayer.get(t.fac.layer), recs: null });
  }

  // one batch per (kit, level of detail, cell)
  const batches = [];
  for (const kit of kits) {
    const material = kitMaterial(kit, facades, lightmap, tex);
    kit.batch = [0, 1].map((lod) => {
      const list = [];
      for (let r = 0; r < kit.meta.rows; r++) {
        for (let c = 0; c < kit.meta.cols; c++) {
          // the far cells may come from a narrower authored panel
          const src = kit.cells.get(`L${lod}_${lod ? c % kit.meta.cols1 : c}_${r}`);
          if (!src) { list.push(null); continue; }
          const bt = makeBatch(src, material);
          group.add(bt.mesh);
          batches.push(bt);
          list.push(bt);
        }
      }
      return list;
    });
  }

  const _q = [];
  // how high the neighbours stand against a face at a point along it
  function coveredTo(T, f, x, z) {
    const [nx, nz] = NORM[f];
    const px = x + nx * 0.4, pz = z + nz * 0.4;
    queryBoxes(city, px, pz, px, pz, _q);
    let h = 0;
    for (const bx of _q) if (!bx.sign && bx.t !== T.t && bx.y0 < 0.5 && px >= bx.x0 && px <= bx.x1 && pz >= bx.z0 && pz <= bx.z1) h = Math.max(h, bx.y1);
    return h;
  }

  // every cell this tier wears: (cell index, kO xyzw, kF xyzw, kB xyzw)
  function place(T) {
    const { b, t, kit } = T;
    const L = FAC.layers[kit.layer];
    const bayW = L.w / L.bays, ph = kit.meta.pitch;
    const out = [];
    const m0 = Math.ceil((Math.max(t.y0, t.fac.split) - 0.01) / ph) - (t.fac.split > 0 ? 1 : 0);
    const m1 = Math.floor((t.y1 + 0.01) / ph);
    for (let f = 0; f < 4; f++) {
      const [nx, nz] = NORM[f];
      const ux = nz, uz = -nx;
      const faceW = f >= 2 ? t.w : t.d;
      const nb = Math.max(1, Math.round(faceW / bayW));
      const colFit = faceW / nb;
      const ox = t.x + nx * t.w / 2 - ux * faceW / 2, oz = t.z + nz * t.d / 2 - uz * faceW / 2;
      const bayOff = t.fac.bayOff[f], floorOff = t.fac.floorOff[f];
      for (let k = 0; k < nb; k++) {
        const cx = ox + ux * (k + 0.5) * colFit, cz = oz + uz * (k + 0.5) * colFit;
        const hidden = coveredTo(T, f, cx, cz);
        const col = (k + bayOff) % L.bays;
        for (let m = Math.max(0, m0); m < m1; m++) {
          if ((m + 1) * ph <= hidden + 0.05) continue;
          const row = (m + floorOff) % L.floors;
          out.push(row * L.bays + col,
            ox + ux * k * colFit, m * ph, oz + uz * k * colFit, colFit / kit.meta.geoBay,
            f, k, bayOff, colFit,
            b.style, b.seed, b.h, floorOff);
        }
      }
    }
    return new Float32Array(out);
  }

  const last = new THREE.Vector3(0, -1e5, 0);
  const front = [false, false, false, false];
  function update(cam, force = false) {
    if (!force && cam.distanceToSquared(last) < MOVE * MOVE) return false;
    last.copy(cam);
    U.kitCenter.value.copy(cam);
    for (const bt of batches) bt.n = 0;
    for (const T of tiers) {
      const { t } = T;
      const dy = Math.max(0, t.y0 - cam.y, cam.y - t.y1);
      const d = Math.hypot(t.x - cam.x, dy, t.z - cam.z);
      // a metre inside the shader's threshold: a stepped-back wall without cells is fine, cells on a full wall are not
      if (d >= KIT_NEAR - 1) continue;
      const recs = T.recs || (T.recs = place(T));
      const list = T.kit.batch[d < LOD0 ? 0 : 1];
      // faces the camera is well behind stay hidden until the next re-list
      for (let f = 0; f < 4; f++) front[f] = (cam.x - t.x - NORM[f][0] * t.w / 2) * NORM[f][0] + (cam.z - t.z - NORM[f][1] * t.d / 2) * NORM[f][1] > -MOVE;
      for (let i = 0; i < recs.length; i += 13) if (front[recs[i + 5]]) list[recs[i]]?.push(recs, i + 1);
    }
    for (const bt of batches) bt.commit();
    return true;
  }

  return { group, update, tiers };
}

export function makeBatch(src, material) {
  const mesh = new THREE.Mesh(undefined, material);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_KIT);
  const bt = { mesh, n: 0, cap: 0, arrays: null };
  // growing swaps in a whole new geometry: a render object keeps the buffers it was first built with
  const grow = (need) => {
    bt.cap = Math.max(256, need * 2);
    const next = ['kO', 'kF', 'kB'].map(() => new Float32Array(bt.cap * 4));
    if (bt.arrays) bt.arrays.forEach((a, i) => next[i].set(a.subarray(0, bt.n * 4)));
    bt.arrays = next;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = src.index;
    for (const [k, a] of Object.entries(src.attributes)) geo.setAttribute(k, a);
    ['kO', 'kF', 'kB'].forEach((k, i) => geo.setAttribute(k, new THREE.InstancedBufferAttribute(next[i], 4).setUsage(THREE.DynamicDrawUsage)));
    geo.instanceCount = 0;
    const old = mesh.geometry;
    mesh.geometry = geo;
    if (old && old.isInstancedBufferGeometry) old.dispose();
  };
  grow(0);
  // element by element: a re-list moves tens of thousands of records, and a view per copy feeds the collector
  bt.push = (recs, i) => {
    if (bt.n >= bt.cap) grow(bt.n + 1);
    const o = bt.n * 4, A = bt.arrays[0], B = bt.arrays[1], C = bt.arrays[2];
    for (let j = 0; j < 4; j++) { A[o + j] = recs[i + j]; B[o + j] = recs[i + 4 + j]; C[o + j] = recs[i + 8 + j]; }
    bt.n++;
  };
  bt.commit = () => {
    const geo = mesh.geometry;
    geo.instanceCount = bt.n;
    mesh.visible = bt.n > 0;
    for (const k of ['kO', 'kF', 'kB']) {
      const a = geo.attributes[k];
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(4, bt.n * 4));
      a.needsUpdate = true;
    }
  };
  return bt;
}

const TILE_TINT = ['#f0e6d2', '#d9e6e0', '#e8d6d6', '#d6dfeb', '#efe3c4', '#e0e0e0', '#dcd2e6', '#cfe3d0'].map((h) => new THREE.Color(h));
const WALLPAPER = ['#d8d2c4', '#c9d6cf', '#e2d8c0', '#bfc8d4', '#d4c3c3'].map((h) => new THREE.Color(h));

function palette(list, idx) {
  let c = vec3(list[0].r, list[0].g, list[0].b);
  for (let i = 1; i < list.length; i++) c = select(idx.greaterThanEqual(i - 0.5), vec3(list[i].r, list[i].g, list[i].b), c);
  return c;
}

// Walls take the kit's own textures with the photo facade's pastel tint; glass shows the same lit room the
// photo facade shows at that spot. The room code is buildings.js's home-facade path and has to stay in step
// with it, or windows change state as a building swaps between the two.
function kitMaterial(kit, fac, lightmap, tex) {
  const m = new THREE.MeshStandardNodeMaterial();
  const kO = attribute('kO', 'vec4'), kF = attribute('kF', 'vec4'), kB = attribute('kB', 'vec4');
  const mat = attribute('_mat', 'vec4'), col = attribute('_col', 'vec4'), uv = attribute('uv', 'vec2');
  const L = FAC.layers[kit.layer];
  const tW = L.w, tH = L.h, tBays = L.bays, tFloors = L.floors;
  const resFloorH = tH / tFloors;

  const f = kF.x;
  const n = select(f.lessThan(0.5), vec3(-1, 0, 0), select(f.lessThan(1.5), vec3(1, 0, 0), select(f.lessThan(2.5), vec3(0, 0, -1), vec3(0, 0, 1))));
  const uDir = vec3(n.z, 0, n.x.negate());
  const pg = positionGeometry;
  m.positionNode = kO.xyz.add(uDir.mul(pg.x.mul(kO.w))).add(vec3(0, pg.y, 0)).add(n.mul(pg.z));
  const ng = normalGeometry;
  m.normalNode = transformNormalToView(uDir.mul(ng.x).add(vec3(0, ng.y, 0)).add(n.mul(ng.z))).normalize();

  const style = kB.x, seed = kB.y, floorOff = kB.w;
  const isTen = step(abs(style.sub(STYLE.TENEMENT)), 0.5);
  const isEst = step(abs(style.sub(STYLE.ESTATE)), 0.5);
  const colW = kF.w, floorH = float(resFloorH);
  const P = positionWorld;
  const cu = kF.y.add(pg.x.div(kit.meta.geoBay));
  const u = cu.mul(colW);
  const v = P.y;
  const faceId = n.x.add(n.z.mul(2)).add(3);

  const resUV = vec2(cu.add(kF.z).div(tBays), v.div(resFloorH).add(floorOff).div(tFloors).negate());
  const fA = texture(fac.albedo, resUV).depth(kit.layer).rgb;
  const fM = texture(fac.mask, resUV).depth(kit.layer);
  const cv = v.div(floorH);
  const fu = fract(cu), fv = fract(cv);
  const winId = floor(fM.g.mul(255).add(0.5));
  const rep = floor(resUV);
  const cell = vec2(winId.add(rep.x.mul(257)), rep.y);
  const rnd = hash13(vec3(cell.x.add(faceId.mul(1013)), cell.y, seed.mul(977)));
  const rnd2 = hash13(vec3(cell.x.mul(1.7).add(seed.mul(311)), cell.y.mul(3.1), faceId));
  const rnd3 = hash13(vec3(cell.y.mul(2.3), cell.x.add(seed.mul(53)), faceId.mul(7)));
  const slow = floor(U.time.div(mix(float(50), float(170), rnd2)).add(rnd2.mul(9)));
  const flick = hash13(vec3(cell.x, cell.y, slow.add(seed.mul(53))));
  const litRatio = isTen.mul(0.36).add(isEst.mul(0.5));
  const lit = step(mix(rnd, flick, 0.3), litRatio);
  const warm = vec3(1.0, 0.66, 0.36), fluo = vec3(0.82, 0.96, 1.0);
  const neonRoom = mix(vec3(1.0, 0.3, 0.8), vec3(0.3, 0.85, 1.0), step(0.5, fract(rnd2.mul(13.0))));
  const roomCol = mix(mix(fluo, warm, step(0.58, rnd2)), neonRoom, step(0.94, rnd2).mul(isTen));

  const rd = normalize(P.sub(cameraPosition));
  const du = dot(rd, uDir), dv = rd.y, dn = dot(rd, n.negate()).max(0.02);
  const depth = float(3.6);
  const x0 = fu.mul(colW), yy0 = fv.mul(floorH);
  const sdu = select(du.greaterThanEqual(0), du.max(1e-4), du.min(-1e-4));
  const sdv = select(dv.greaterThanEqual(0), dv.max(1e-4), dv.min(-1e-4));
  const tx = select(sdu.greaterThan(0), colW.sub(x0).div(sdu), x0.negate().div(sdu));
  const ty = select(sdv.greaterThan(0), floorH.sub(yy0).div(sdv), yy0.negate().div(sdv));
  const tz = depth.div(dn);
  const tmin = min(min(tx, ty), tz);
  const hx = x0.add(sdu.mul(tmin)), hy = yy0.add(sdv.mul(tmin)), hz = dn.mul(tmin);
  const onBack = step(tz, min(tx, ty));
  const onSide = step(tx, min(ty, tz)).mul(onBack.oneMinus());
  const onCeil = step(ty, min(tx, tz)).mul(step(0, sdv)).mul(onBack.oneMinus());
  const onFloor = step(ty, min(tx, tz)).mul(step(sdv, 0)).mul(onBack.oneMinus());
  const lamp = vec3(colW.mul(0.5), floorH.sub(0.05), depth.mul(0.45));
  const toLamp = vec3(hx, hy, hz).sub(lamp);
  const fall = float(1.6).div(float(1).add(dot(toLamp, toLamp).mul(0.22)));
  const paper = palette(WALLPAPER, floor(rnd3.mul(WALLPAPER.length)));
  const furniture = step(hy, mix(float(0.9), float(1.9), hash12(vec2(floor(hx.div(0.9)), rnd)))).mul(step(0.35, hash12(vec2(floor(hx.div(0.9)).add(5), rnd2)))).mul(onBack);
  const tube = onCeil.mul(smoothstep(0.08, 0.02, abs(hz.sub(lamp.z)))).mul(smoothstep(0.5, 0.35, abs(hx.sub(lamp.x)).div(colW)));
  const surf = paper.mul(onBack.add(onSide.mul(0.7))).add(vec3(0.5, 0.45, 0.4).mul(onFloor.mul(0.45))).add(vec3(0.8).mul(onCeil.mul(0.6)));
  const roomLit = surf.mul(furniture.mul(-0.75).add(1)).mul(fall).mul(roomCol).add(roomCol.mul(tube.mul(5)));
  const roomDark = surf.mul(0.012).mul(fall);
  const paneLum = dot(fA, vec3(0.2126, 0.7152, 0.0722));
  const drawn = smoothstep(0.04, 0.22, paneLum);
  const photoRoom = fA.mul(roomCol).mul(fall.mul(0.8).add(2.2));
  const inside = mix(roomLit.mul(0.7), photoRoom, drawn.mul(0.5).add(0.45));
  const tv = step(0.95, rnd).mul(sin(U.time.mul(9).add(rnd.mul(40))).mul(0.3).add(sin(U.time.mul(23.0).add(rnd2.mul(20))).mul(0.2)).add(0.5));
  const roomOut = mix(roomDark.add(vec3(0.4, 0.55, 1.0).mul(tv).mul(0.5)), inside, lit);

  // kit surfaces
  const kind = mat.z;
  // only the panes facing out are glass; the reveals of the window openings share the material but are frame
  const isGlass = step(0.5, kind).mul(step(kind, 1.5)).mul(step(0.7, ng.z));
  const isWall = step(kind, 0.5);
  const kA = select(mat.x.lessThan(0), vec3(1), texture(kit.albedo, uv).depth(mat.x.max(0)).rgb).mul(col.rgb);
  const kP = texture(kit.pbr, uv).depth(mat.y.max(0));
  const hasP = step(0, mat.y);
  const nz = texture(noiseTex, vec2(u.div(41), v.div(53)));
  const tileTint = palette(TILE_TINT, floor(fract(seed.mul(31.7)).mul(TILE_TINT.length)));
  const tintAmt = mix(float(0.25), float(0.75), fract(seed.mul(5.9)));
  // the photo is about 25 px a metre: a tiling concrete grain carries the wall up close
  const grain = dot(texture(tex.concreteAlbedo, vec2(u, v).div(1.7)).rgb, vec3(0.333)).mul(2.1);
  const wallCol = kA.mul(mix(vec3(1), tileTint.mul(1.15), tintAmt)).mul(nz.r.mul(0.3).add(0.85)).mul(smoothstep(0.0, 14.0, v).mul(0.25).add(0.75)).mul(mix(float(1), grain, 0.3));
  const albedo = mix(mix(kA, wallCol, isWall), fA.mul(0.06), isGlass);

  const rough = mix(mat.w, kP.g.mul(mat.w), hasP).mul(mix(float(1), float(0.7), U.rain));
  m.roughnessNode = mix(rough, fM.b.mul(mix(float(1), float(0.7), U.rain)), isGlass);
  m.metalnessNode = mix(mix(col.w, kP.b.mul(col.w), hasP), fM.r.mul(0.35), isGlass);

  const spill = texture(lightmap.near, lmUV(P.xz.add(vec2(n.x, n.z).mul(2.0)))).rgb.mul(exp(v.negate().div(5.5)).mul(1.5).add(exp(v.negate().div(26)).mul(0.18)));
  const flash = U.flash.mul(0.45).mul(vec3(0.7, 0.8, 1.0)).mul(albedo.add(0.04)).mul(smoothstep(-200, 400, v));
  m.colorNode = Fn(() => {
    // the tenement's shop band belongs to the shopfronts
    If(isTen.mul(step(P.y, 4.6)).greaterThan(0.5), () => { Discard(); });
    return albedo;
  })();
  m.emissiveNode = roomOut.mul(fM.r).mul(0.85).mul(isGlass).add(spill.mul(albedo.add(0.03))).add(flash);
  return m;
}
