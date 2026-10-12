// The storm deck: a stack of noise-shaped layers between cloudBase and cloudTop. Lit from below by the city,
// from above by the moon, and from inside by lightning.
import * as THREE from 'three/webgpu';
import { Fn, positionWorld, vec2, vec3, vec4, float, mix, smoothstep, texture, length, cameraPosition, exp, uniform, abs, max, clamp, pow } from 'three/tsl';
import { U, noiseTex } from '../core/shared.js';
import { CITY } from '../city/layout.js';
import { lmUV } from '../city/lightmap.js';

export function createClouds(lightmap, layers = 7) {
  const group = new THREE.Group();
  group.name = 'clouds';
  const geo = new THREE.PlaneGeometry(16000, 16000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const meshes = [];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = CITY.cloudBase + t * (CITY.cloudTop - CITY.cloudBase);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const layerT = float(t);
    m.colorNode = Fn(() => {
      const P = positionWorld;
      const wind = vec2(U.time.mul(2.2), U.time.mul(0.7));
      const uv1 = P.xz.add(wind).div(2600).add(layerT.mul(0.13));
      const uv2 = P.xz.add(wind.mul(1.7)).div(700).sub(layerT.mul(0.21));
      const n = texture(noiseTex, uv1).r.mul(0.7).add(texture(noiseTex, uv2).b.mul(0.45)).sub(0.08);
      // thickest in the middle of the deck, ragged at the base and top
      const profile = float(1).sub(abs(layerT.sub(0.5)).mul(1.5));
      const cover = smoothstep(float(0.5).sub(profile.mul(0.22)), float(0.66).sub(profile.mul(0.18)), n);
      const d = length(P.xz.sub(cameraPosition.xz));
      const edge = smoothstep(7600, 3200, d);
      const camY = cameraPosition.y;
      const nearFade = smoothstep(4, 40, abs(camY.sub(P.y)));
      const alpha = cover.mul(edge).mul(nearFade).mul(0.55);
      const under = texture(lightmap.far, lmUV(P.xz)).rgb.mul(mix(float(2.2), float(0.5), layerT)).add(vec3(0.045, 0.04, 0.07));
      const moonTop = vec3(0.22, 0.25, 0.34).mul(layerT.mul(0.9).add(0.15)).mul(n.mul(0.8).add(0.5));
      const fromAbove = smoothstep(P.y.sub(10), P.y.add(10), camY);
      const lit = mix(under, moonTop.add(under.mul(0.25)), fromAbove.mul(layerT.mul(0.7).add(0.3)));
      const fl = U.flash.mul(exp(length(P.xz.sub(U.flashPos.xz)).negate().div(900))).mul(vec3(0.75, 0.82, 1.0)).mul(4.0).mul(n.add(0.3));
      return vec4(lit.add(fl), alpha);
    })();
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    group.add(mesh);
    meshes.push(mesh);
  }
  // seen from above, a solid cloud-top just under the upper layer: the deck reads as one surface and towers sink
  // into it instead of showing through the gaps. It is shaded like the layers and fades into the sky at the edge.
  const floorMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: true, fog: false });
  floorMat.colorNode = Fn(() => {
    const P = positionWorld;
    const wind = vec2(U.time.mul(2.2), U.time.mul(0.7));
    const n1 = texture(noiseTex, P.xz.add(wind).div(3000)).r;
    const n2 = texture(noiseTex, P.xz.add(wind.mul(1.3)).div(900)).b;
    const n3 = texture(noiseTex, P.xz.add(wind.mul(1.6)).div(260)).g;
    const n = n1.mul(0.6).add(n2.mul(0.35)).add(n3.mul(0.15));
    const under = texture(lightmap.far, lmUV(P.xz)).rgb;
    const billow = smoothstep(0.3, 0.8, n);
    const col = mix(vec3(0.045, 0.045, 0.075), vec3(0.13, 0.135, 0.2), billow).add(under.mul(float(1).sub(billow).mul(0.3).add(0.06)));
    const fl = U.flash.mul(exp(length(P.xz.sub(U.flashPos.xz)).negate().div(900))).mul(vec3(0.75, 0.82, 1.0)).mul(2.5).mul(n);
    const d = length(P.xz.sub(cameraPosition.xz));
    return vec4(col.add(fl), smoothstep(7800, 3600, d));
  })();
  const floor = new THREE.Mesh(geo, floorMat);
  floor.position.y = CITY.cloudTop - 22;
  floor.frustumCulled = false;
  floor.visible = false;
  floor.renderOrder = 4;
  group.add(floor);
  return {
    group,
    floor,
    update(camera) {
      floor.visible = camera.position.y > CITY.cloudTop + 5;
      floor.position.x = Math.round(camera.position.x / 50) * 50;
      floor.position.z = Math.round(camera.position.z / 50) * 50;
      for (const m of meshes) {
        m.position.x = Math.round(camera.position.x / 50) * 50;
        m.position.z = Math.round(camera.position.z / 50) * 50;
      }
    },
  };
}
