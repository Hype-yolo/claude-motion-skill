// Streets, pavements, road paint and the harbour. Wet surfaces read a half-resolution planar reflection,
// smeared into vertical streaks the way neon smears on wet asphalt, plus rain ripples in the puddles.
import * as THREE from 'three/webgpu';
import {
  Fn, positionWorld, screenUV, vec2, vec3, vec4, float, mix, smoothstep, texture, normalMap, normalView, normalWorld, cameraPosition,
  normalize, dot, pow, max, abs, length, step, uniform, attribute, Loop, int, sin, fract, floor, exp, clamp, select,
} from 'three/tsl';
import { CITY } from './layout.js';
import { U, noiseTex } from '../core/shared.js';
import { lmUV, streetLight } from './lightmap.js';
import { hash22, hash12 } from '../tsl/util.js';

export const LAYER_NOREFL = 1;
// modelled facades: only the main camera draws them (reflections and the car's probe see the photo facades)
export const LAYER_KIT = 2;

// expanding ring normals from raindrops, on a world-space grid (after the TSL ripples in threejs-punk, MIT)
const ripples = Fn(([p, t]) => {
  const p0 = floor(p);
  const acc = vec2(0).toVar();
  Loop({ start: int(-1), end: int(1), condition: '<=' }, ({ i }) => {
    Loop({ start: int(-1), end: int(1), condition: '<=' }, ({ i: j }) => {
      const c = p0.add(vec2(float(i), float(j)));
      const o = c.add(hash22(c));
      const ph = fract(t.mul(0.9).add(hash12(c.mul(1.7))));
      const v = o.sub(p);
      const d = length(v).sub(ph.mul(1.6));
      const w = sin(d.mul(31)).mul(smoothstep(-0.6, -0.3, d)).mul(smoothstep(0.0, -0.3, d));
      acc.addAssign(normalize(v.add(1e-4)).mul(w).mul(ph.oneMinus().pow(2)));
    });
  });
  return acc.div(9);
});

export function createGround(city, tex, lightmap) {
  const group = new THREE.Group();
  group.name = 'ground';
  const reflRT = new THREE.RenderTarget(16, 16, { type: THREE.HalfFloatType, depthBuffer: true });
  // mipmapped and anisotropic: each streak tap reads a footprint one texel wide and as tall as the gap to the next
  // tap, so the taps run together into one streak instead of stacking copies of every thin neon line
  reflRT.texture.minFilter = THREE.LinearMipmapLinearFilter;
  reflRT.texture.generateMipmaps = true;
  reflRT.texture.anisotropy = 16;
  const mirrorCam = new THREE.PerspectiveCamera();
  const uReflOn = uniform(1);
  const uReflTexel = uniform(new THREE.Vector2(1 / 960, 1 / 540));

  // wet-surface shading shared by road and pavement
  function wetSurface({ albedoTex, normalTex, raoTex, scale, darken, puddleBias }) {
    const m = new THREE.MeshStandardNodeMaterial();
    const P = positionWorld;
    // kerb faces take the texture on their own plane instead of a smear of the top
    const top = step(0.5, normalWorld.y);
    const uv = mix(vec2(P.x.add(P.z), P.y.mul(2.0)), P.xz, top).div(scale);
    const alb = texture(albedoTex, uv).rgb.mul(darken);
    const rao = texture(raoTex, uv);
    const big = texture(noiseTex, P.xz.div(37)).r;
    const mid = texture(noiseTex, P.xz.div(9.3)).b;
    // puddles collect in low, smooth patches
    const puddle = smoothstep(0.52 - puddleBias, 0.6 - puddleBias, big.mul(0.7).add(mid.mul(0.45)).sub(rao.r.mul(0.25))).mul(U.rain.mul(0.6).add(0.4)).mul(top);
    const rip = ripples(P.xz.mul(1.6), U.time).mul(U.rain).mul(puddle.mul(0.8).add(0.2));
    const nTex = texture(normalTex, uv);
    const nFlat = vec4(mix(nTex.xy, vec2(0.5), puddle.mul(0.9)).add(rip.mul(0.35)), nTex.zw);
    m.normalNode = normalMap(nFlat, vec2(0.9));
    m.colorNode = mix(alb, alb.mul(0.35), puddle);
    m.roughnessNode = mix(rao.r.mul(0.55).add(0.12), float(0.035), puddle);
    m.metalnessNode = float(0);
    // planar reflection, streaked vertically on the rougher wet areas
    const view = normalize(cameraPosition.sub(P));
    const fres = float(0.03).add(float(0.97).mul(pow(float(1).sub(max(view.y, 0)), 5)));
    const rough = float(1).sub(puddle);
    const baseUV = vec2(float(1).sub(screenUV.x), screenUV.y).add(rip.mul(0.012)).add(nTex.xy.sub(0.5).mul(0.012).mul(rough));
    // vertical streak: 7 gaussian taps, spread grows with roughness and a slow wobble so streak lengths vary
    const spread = rough.mul(1.3).add(0.06).mul(texture(noiseTex, P.xz.div(5.3)).b.mul(0.8).add(0.6)).mul(0.016);
    const gx = vec2(uReflTexel.x, 0), gy = vec2(0, spread.max(uReflTexel.y));
    const refl = Fn(() => {
      const acc = vec3(0).toVar();
      Loop({ start: int(0), end: int(7) }, ({ i }) => {
        const k = float(i).sub(3);
        const w = exp(k.mul(k).mul(-0.28));
        acc.addAssign(texture(reflRT.texture, baseUV.add(vec2(0, k.mul(spread)))).grad(gx, gy).rgb.mul(w));
      });
      return acc.div(3.325);
    })();
    const reflAmt = top.mul(fres).mul(mix(float(0.55), float(1.0), puddle)).mul(uReflOn).mul(U.rain.mul(0.5).add(0.5));
    const lm = streetLight(lightmap, P.xz);
    const flash = vec3(0.6, 0.7, 0.9).mul(U.flash).mul(0.25);
    // seen from altitude the planar reflection is off; the wet street still throws the city's light back up
    const aerial = smoothstep(90, 260, cameraPosition.y).mul(top);
    const lmFar = texture(lightmap.far, lmUV(P.xz)).rgb;
    m.emissiveNode = refl.mul(reflAmt).add(lm.mul(alb.mul(2.4).add(0.012)).mul(rough.mul(0.7).add(0.3))).add(flash.mul(alb))
      .add(lm.mul(0.35).add(lmFar.mul(0.25)).mul(aerial));
    return m;
  }

  // the street surface: one plane over the whole city, harbour excluded
  const zMin = -CITY.outer, zMax = CITY.harbourZ - 2;
  const roadGeo = new THREE.PlaneGeometry(CITY.outer * 2, zMax - zMin, 1, 1);
  roadGeo.rotateX(-Math.PI / 2);
  roadGeo.translate(0, 0, (zMin + zMax) / 2);
  const roadMat = wetSurface({ albedoTex: tex.roadAlbedo, normalTex: tex.roadNormal, raoTex: tex.roadRao, scale: 7.5, darken: 0.42, puddleBias: 0.0 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.name = 'road';
  road.layers.set(LAYER_NOREFL);
  group.add(road);

  // far shore ground beyond the harbour
  const fsGeo = new THREE.PlaneGeometry(CITY.outer * 2, CITY.outer - CITY.farShoreZ + 20);
  fsGeo.rotateX(-Math.PI / 2);
  fsGeo.translate(0, 0, (CITY.farShoreZ + CITY.outer) / 2);
  const fs = new THREE.Mesh(fsGeo, roadMat);
  fs.layers.set(LAYER_NOREFL);
  group.add(fs);

  // pavements: one slab per block
  const walkMat = wetSurface({ albedoTex: tex.walkAlbedo, normalTex: tex.walkNormal, raoTex: tex.walkRao, scale: 3.2, darken: 0.5, puddleBias: -0.04 });
  const slab = new THREE.BoxGeometry(1, 1, 1);
  slab.translate(0, 0.5, 0);
  const blocks = city.blocks;
  const walks = new THREE.InstancedMesh(slab, walkMat, blocks.length);
  const m4 = new THREE.Matrix4();
  blocks.forEach((b, i) => {
    m4.makeScale(b.x1 - b.x0, CITY.curb, b.z1 - b.z0).setPosition((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
    walks.setMatrixAt(i, m4);
  });
  walks.computeBoundingSphere();
  walks.layers.set(LAYER_NOREFL);
  group.add(walks);

  // road paint: centre dashes, lane lines, zebra crossings, stop lines
  const marks = [];
  const addMark = (x, z, w, d, yellow = 0) => marks.push(x, z, w, d, yellow);
  const lines = [...city.xs.map((l) => ({ ...l, axis: 'z' })), ...city.zs.map((l) => ({ ...l, axis: 'x' }))];
  for (const l of lines) {
    const cross = l.axis === 'z' ? city.zs : city.xs;
    for (let k = 0; k < cross.length - 1; k++) {
      const a0 = cross[k].p + cross[k].w / 2 + 4.5, a1 = cross[k + 1].p - cross[k + 1].w / 2 - 4.5;
      if (a1 - a0 < 8) continue;
      // double yellow on avenues, white dashes on streets
      const n = Math.floor((a1 - a0) / 7);
      for (let s = 0; s < n; s++) {
        const a = a0 + (s + 0.5) * ((a1 - a0) / n);
        if (l.w >= 24) {
          for (const off of [-0.18, 0.18]) l.axis === 'z' ? addMark(l.p + off, a, 0.14, (a1 - a0) / n + 0.02, 1) : addMark(a, l.p + off, (a1 - a0) / n + 0.02, 0.14, 1);
          for (const off of [-6.2, 6.2]) l.axis === 'z' ? addMark(l.p + off, a, 0.13, 3.2) : addMark(a, l.p + off, 3.2, 0.13);
        } else {
          l.axis === 'z' ? addMark(l.p, a, 0.13, 3.0) : addMark(a, l.p, 3.0, 0.13);
        }
      }
      // zebra crossings and stop lines at both ends of the segment
      for (const [edge, dir] of [[a0 - 4.5, 1], [a1 + 4.5, -1]]) {
        const half = l.w / 2 - 0.6;
        for (let s = -half; s < half; s += 1.1) l.axis === 'z' ? addMark(l.p + s + 0.3, edge + dir * 1.9, 0.55, 3.2) : addMark(edge + dir * 1.9, l.p + s + 0.3, 3.2, 0.55);
        l.axis === 'z' ? addMark(l.p, edge + dir * 4.2, l.w - 1.2, 0.3) : addMark(edge + dir * 4.2, l.p, 0.3, l.w - 1.2);
      }
    }
  }
  const nMarks = marks.length / 5;
  const quad = new THREE.PlaneGeometry(1, 1);
  quad.rotateX(-Math.PI / 2);
  const markInfo = new Float32Array(nMarks);
  const markMesh = new THREE.InstancedMesh(quad, null, nMarks);
  for (let i = 0; i < nMarks; i++) {
    m4.makeScale(marks[i * 5 + 2], 1, marks[i * 5 + 3]).setPosition(marks[i * 5], 0.012, marks[i * 5 + 1]);
    markMesh.setMatrixAt(i, m4);
    markInfo[i] = marks[i * 5 + 4];
  }
  quad.setAttribute('aYellow', new THREE.InstancedBufferAttribute(markInfo, 1));
  const markMat = new THREE.MeshStandardNodeMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const yellow = attribute('aYellow', 'float');
  const wear = texture(noiseTex, positionWorld.xz.div(2.3)).g;
  const paint = mix(vec3(0.55, 0.55, 0.52), vec3(0.62, 0.45, 0.08), yellow).mul(wear.mul(0.6).add(0.55));
  markMat.colorNode = paint;
  markMat.roughnessNode = float(0.35);
  markMat.opacityNode = smoothstep(0.18, 0.4, wear);
  markMat.transparent = true;
  markMat.depthWrite = false;
  markMat.emissiveNode = streetLight(lightmap, positionWorld.xz).mul(paint).mul(1.6);
  markMesh.material = markMat;
  markMesh.computeBoundingSphere();
  markMesh.layers.set(LAYER_NOREFL);
  markMesh.renderOrder = 1;
  group.add(markMesh);

  // harbour water with the far shore and the promenade wall
  const waterGeo = new THREE.PlaneGeometry(CITY.outer * 2, CITY.farShoreZ - CITY.harbourZ + 40, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, -1.2, (CITY.harbourZ + CITY.farShoreZ) / 2);
  const waterMat = new THREE.MeshStandardNodeMaterial();
  {
    const P = positionWorld;
    const w1 = texture(noiseTex, P.xz.div(vec2(60, 22)).add(vec2(U.time.mul(0.01), U.time.mul(0.013)))).rg;
    const w2 = texture(noiseTex, P.xz.div(vec2(14, 7)).sub(vec2(U.time.mul(0.03), 0))).ba;
    const wn = w1.sub(0.5).mul(0.6).add(w2.sub(0.5).mul(0.4));
    const view = normalize(cameraPosition.sub(P));
    const fres = float(0.02).add(float(0.98).mul(pow(float(1).sub(max(view.y, 0)), 5)));
    const ruv = vec2(float(1).sub(screenUV.x), screenUV.y).add(wn.mul(vec2(0.01, 0.05)));
    waterMat.colorNode = vec3(0.004, 0.008, 0.012);
    waterMat.roughnessNode = float(0.06);
    waterMat.metalnessNode = float(0);
    waterMat.normalNode = normalMap(vec4(wn.add(0.5), 1, 1), vec2(0.6));
    waterMat.emissiveNode = texture(reflRT.texture, ruv).rgb.mul(fres.mul(0.9).add(0.08)).mul(uReflOn);
  }
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.layers.set(LAYER_NOREFL);
  group.add(water);
  const wallGeo = new THREE.BoxGeometry(CITY.outer * 2, 3.4, 2);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardNodeMaterial({ color: 0x1a1b20, roughness: 0.7 }));
  wall.position.set(0, -1.5, CITY.harbourZ);
  group.add(wall);

  const _n = new THREE.Vector3(0, 1, 0);
  const _p = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _size = new THREE.Vector2();
  let reflScale = 0.5;

  return {
    group,
    reflRT,
    mirrorCam,
    uReflOn,
    setReflScale(s) { reflScale = s; },
    // mirror the camera in y = 0; nothing in the scene sits below the plane, so no oblique clip is needed
    updateReflection(renderer, scene, camera) {
      const on = camera.position.y < 140;
      uReflOn.value = on ? 1 : 0;
      if (!on) return;
      renderer.getDrawingBufferSize(_size);
      const w = Math.max(2, Math.round(_size.x * reflScale)), h = Math.max(2, Math.round(_size.y * reflScale));
      if (reflRT.width !== w || reflRT.height !== h) { reflRT.setSize(w, h); uReflTexel.value.set(1 / w, 1 / h); }
      camera.updateMatrixWorld();
      mirrorCam.copy(camera, false);
      mirrorCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
      camera.getWorldDirection(_t);
      _t.y = -_t.y;
      _p.copy(mirrorCam.position).add(_t);
      mirrorCam.up.set(0, -1, 0);
      mirrorCam.lookAt(_p);
      mirrorCam.far = Math.min(camera.far, 1400);
      mirrorCam.updateProjectionMatrix();
      mirrorCam.layers.set(0);
      mirrorCam.updateMatrixWorld();
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(reflRT);
      renderer.render(scene, mirrorCam);
      renderer.setRenderTarget(prev);
    },
  };
}
