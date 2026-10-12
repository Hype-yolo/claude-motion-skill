// KITE-9: Lotus Esprit Hover GT 2076 by maomornity (CC BY 4.0), a million-triangle hard-surface model with
// plain PBR materials. Here the materials become a black metallic-flake paint under clearcoat, chrome, tinted
// glass over the cabin, and lights that answer the game: headlights, brake bars, the cyan levitator strips
// flaring on boost. The four levitator pods pivot with flight like the spinner's did.
// Local frame: forward -Z, up +Y, origin under the body's centre.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  positionGeometry, normalGeometry, normalView, vec3, float, mix, smoothstep, step, sin, texture, uniform, exp, normalWorld,
  floor, fwidth, normalize, color,
} from 'three/tsl';
import { U } from '../core/shared.js';
import { streetLight } from '../city/lightmap.js';
import { LAYER_KIT } from '../city/ground.js';
import { hash13 } from '../tsl/util.js';

const LENGTH = 5.0; // metres, nose to tail

// quantized (int16, normalized) attributes can't hold a baked transform; widen them to float first
export function toFloatGeometry(geo) {
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k];
    if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j);
    g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
  }
  return g;
}

// position + normal only, indexed, in the car's own metres
function cleanGeometry(geo, matrix) {
  const g = toFloatGeometry(geo);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  g.applyMatrix4(matrix);
  return g;
}

// which levitator a node belongs to: 0 front left, 1 front right, 2 rear left, 3 rear right (as kite.js expects)
function podOf(o) {
  for (let p = o; p; p = p.parent) {
    const n = p.name.normalize('NFD').replace(/[^\w]/g, '').toLowerCase();
    if (n.startsWith('levavantgauche')) return 0;
    if (n.startsWith('levavantdroit')) return 1;
    if (n.startsWith('levarrieregauche')) return 2;
    if (n.startsWith('levarrieredroit')) return 3;
  }
  return -1;
}

const CHROME = /^(Chrome_lev|Chromeinterieur|Glassretro)$/;
const PAINT = /^Carbase$/;
const RED = /^(Redpaintcar|RedMetalFlake)$/;

// A cube of the street around the car, re-rendered two faces a frame so the paint and glass carry the real
// neon passing by. The car and the rain are hidden while it renders; the HDR target keeps the signs bright.
export function createReflectionProbe(size = 128) {
  const rt = new THREE.CubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.4, 1600, rt);
  for (const c of cam.children) { c.layers.enableAll(); c.layers.disable(LAYER_KIT); }
  let face = 0;
  return {
    texture: rt.texture,
    rt,
    cam,
    update(renderer, scene, pos, hide, faces = 2) {
      cam.position.copy(pos);
      cam.position.y += 0.8; // the middle of the body, not the road
      cam.updateMatrixWorld(true);
      if (cam.coordinateSystem !== renderer.coordinateSystem) {
        cam.coordinateSystem = renderer.coordinateSystem;
        cam.updateCoordinateSystem();
      }
      const was = hide.map((o) => o.visible);
      for (const o of hide) o.visible = false;
      const prev = renderer.getRenderTarget(), prevFace = renderer.getActiveCubeFace(), prevMip = renderer.getActiveMipmapLevel();
      for (let i = 0; i < faces; i++) {
        renderer.setRenderTarget(rt, face);
        renderer.render(scene, cam.children[face]);
        face = (face + 1) % 6;
        if (face === 0) rt.texture.needsPMREMUpdate = true;
      }
      renderer.setRenderTarget(prev, prevFace, prevMip);
      hide.forEach((o, i) => { o.visible = was[i]; });
    },
  };
}

export function createKiteModel(env) {
  const root = new THREE.Group();
  root.name = 'kite9';
  const accent = uniform(new THREE.Color(0.15, 0.95, 1.0));
  const brake = uniform(0);
  const boost = uniform(0);
  const fanSpin = uniform(0);

  // the city's neon reaches the car's flanks and belly when it is low
  function bounce(lightmap) {
    const lm = streetLight(lightmap, U.carPos.xz);
    const lowness = exp(U.carPos.y.negate().div(18));
    const facing = normalWorld.y.negate().mul(0.5).add(0.5);
    return lm.mul(lowness).mul(facing.mul(0.8).add(0.2));
  }

  // metallic flake: a sparse jitter of the base normal under an untouched clearcoat, faded out before it aliases
  function flakeNormal() {
    const q = positionGeometry.mul(520);
    const j = hash13(floor(q)).sub(0.5).mul(2);
    const k = hash13(floor(q).add(17.3)).sub(0.5).mul(2);
    const fade = smoothstep(0.9, 0.25, fwidth(q.x).add(fwidth(q.y)));
    return normalize(normalView.add(vec3(j, k, j.mul(k)).mul(0.22).mul(fade)));
  }

  function makeMaterial(sm, lightmap, inPod) {
    const name = sm.name;
    const base = sm.color.clone();
    const m = new THREE.MeshPhysicalNodeMaterial({ envMap: env, envMapIntensity: 1.0 });
    m.colorNode = color(base);
    m.roughnessNode = float(sm.roughness);
    m.metalnessNode = float(sm.metalness);
    let emit = null;
    if (PAINT.test(name)) {
      // gunmetal: a dark paint reflects almost nothing of a street lit only by signs; this one takes their colour
      m.colorNode = color(0x666c76);
      m.metalnessNode = float(0.9);
      m.roughnessNode = float(0.22);
      // a studio's worth of reflection: the street is lit only by its signs, so the car is too
      m.envMapIntensity = 2.2;
      m.normalNode = flakeNormal();
      m.clearcoatNode = float(1);
      m.clearcoatRoughnessNode = float(0.035);
    } else if (RED.test(name)) {
      m.colorNode = color(0x5a0508);
      m.metalnessNode = float(0.4);
      m.roughnessNode = float(0.32);
      m.clearcoatNode = float(1);
      m.clearcoatRoughnessNode = float(0.05);
      m.envMapIntensity = 2;
    } else if (CHROME.test(name)) {
      m.colorNode = color(0xd8dce2);
      m.metalnessNode = float(1);
      m.roughnessNode = float(0.08);
      m.envMapIntensity = 2;
    } else if (name === 'Chrome_MetalWorn') {
      // gunmetal mechanics in the pods and under the tail
      m.colorNode = color(0x2a2c30);
      m.metalnessNode = float(0.9);
      m.roughnessNode = float(0.34);
    } else if (name === 'Glass') {
      m.transparent = true;
      m.colorNode = color(0x020306);
      m.metalnessNode = float(0);
      m.roughnessNode = float(0.02);
      m.clearcoatNode = float(1);
      m.clearcoatRoughnessNode = float(0.01);
      m.opacityNode = float(0.72);
      m.envMapIntensity = 2.2;
    } else if (name === 'Phare_avant') {
      emit = vec3(1.0, 0.93, 0.8).mul(U.headlights.mul(1.6).add(0.9));
    } else if (name === 'Phare_arriere') {
      emit = vec3(1.0, 0.04, 0.03).mul(mix(float(3.5), float(13), brake));
    } else if (name === 'Clignotant') {
      emit = vec3(1.0, 0.32, 0.02).mul(1.6);
    } else if (name === 'material') {
      // the cyan strips on the levitators and flanks: the car's colour, flaring on boost
      emit = vec3(accent).mul(boost.mul(9).add(2.2));
    }
    if (emit) {
      m.colorNode = vec3(0.02);
      m.roughnessNode = float(0.3);
      m.metalnessNode = float(0);
      m.emissiveNode = emit;
      return m;
    }
    let e = bounce(lightmap).mul(m.colorNode).mul(1.2);
    if (inPod) {
      // levitator throats glow from below, white-hot on boost
      const down = smoothstep(-0.4, -0.85, normalGeometry.y);
      const heat = mix(vec3(accent), vec3(0.85, 0.95, 1.0), boost);
      e = e.add(heat.mul(down).mul(boost.mul(5).add(0.25)).mul(sin(fanSpin.mul(3)).mul(0.08).add(0.92)));
    } else if (PAINT.test(name)) {
      // a cool accent along the underside, the hover field
      const under = step(normalGeometry.y, -0.6).mul(sin(U.time.mul(3)).mul(0.15).add(0.85));
      e = e.add(vec3(accent).mul(under.mul(0.35)));
    }
    m.emissiveNode = e;
    return m;
  }

  root.userData.build = async (lightmap) => {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/kite.glb');
    const src = gltf.scene;
    src.updateMatrixWorld(true);
    const box0 = new THREE.Box3().setFromObject(src);
    const size0 = box0.getSize(new THREE.Vector3());
    // the source faces +Z; KITE flies toward -Z. Centre it, metres, wheels-down later.
    const centre = box0.getCenter(new THREE.Vector3());
    const toCar = new THREE.Matrix4().makeRotationY(Math.PI)
      .multiply(new THREE.Matrix4().makeScale(LENGTH / size0.z, LENGTH / size0.z, LENGTH / size0.z))
      .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box0.min.y, -centre.z));

    // gather geometry per (pod, material)
    const groups = new Map();
    src.traverse((o) => {
      if (!o.isMesh) return;
      const pod = podOf(o);
      const key = `${pod}|${o.material.name}`;
      if (!groups.has(key)) groups.set(key, { pod, sm: o.material, geos: [] });
      groups.get(key).geos.push(cleanGeometry(o.geometry, toCar.clone().multiply(o.matrixWorld)));
    });

    const car = new THREE.Group();
    root.add(car);
    // pods pivot about their own centres
    const podBoxes = [0, 1, 2, 3].map(() => new THREE.Box3());
    for (const g of groups.values()) if (g.pod >= 0) for (const geo of g.geos) { geo.computeBoundingBox(); podBoxes[g.pod].union(geo.boundingBox); }
    const pods = podBoxes.map((b) => {
      const p = new THREE.Group();
      if (!b.isEmpty()) b.getCenter(p.position);
      car.add(p);
      return p;
    });

    let tris = 0;
    for (const g of groups.values()) {
      const geo = mergeGeometries(g.geos, false);
      for (const x of g.geos) x.dispose();
      if (g.pod >= 0) geo.translate(-pods[g.pod].position.x, -pods[g.pod].position.y, -pods[g.pod].position.z);
      geo.computeBoundingSphere();
      tris += geo.index.count / 3;
      const mesh = new THREE.Mesh(geo, makeMaterial(g.sm, lightmap, g.pod >= 0));
      mesh.name = `kite-${g.pod >= 0 ? 'pod' + g.pod : 'body'}-${g.sm.name}`;
      if (g.sm.name === 'Glass') mesh.renderOrder = 1;
      (g.pod >= 0 ? pods[g.pod] : car).add(mesh);
    }
    root.userData.pods = pods;
    root.userData.podScale = 0.32; // the pods are big; tip them less than the spinner's fans
    const box = new THREE.Box3().setFromObject(car);
    // sit the lowest point (the pod feet) a touch above the ride height
    car.position.y = -box.min.y - 0.12;
    root.userData.tris = tris;
  };

  root.userData.uniforms = { accent, brake, boost, fanSpin };
  return root;
}
