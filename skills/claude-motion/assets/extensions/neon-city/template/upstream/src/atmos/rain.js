// Stateless GPU rain. Every drop is a pure function of its index and time: a world-anchored position that
// wraps inside a box around the camera, falling and drifting with the wind. Drops vanish under roofs, signs
// and awnings (heightmap), are drawn as streaks stretched along their velocity relative to the camera, and
// take their colour from the neon below them. Splashes crown where drops land near the camera.
import * as THREE from 'three/webgpu';
import {
  Fn, instanceIndex, positionGeometry, vec2, vec3, vec4, float, fract, floor, mix, smoothstep, step, texture, uniform,
  normalize, cross, length, max, min, abs, exp, cameraPosition, sin, cos, select, varying, uv,
} from 'three/tsl';
import { U } from '../core/shared.js';
import { hash12, hash13 } from '../tsl/util.js';
import { lmUV } from '../city/lightmap.js';
import { hmUV, HM } from '../city/heightmap.js';
import { LAYER_NOREFL } from '../city/ground.js';

const WIND = new THREE.Vector3(2.2, 0, 0.9);

function rainLayer({ count, box, height, width, alpha, lightmap, heightTex, seed }) {
  const fall = 11.5;
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const vAlpha = varying(float(0), 'vRainA');
  const vCol = varying(vec3(0), 'vRainC');
  const vX = varying(float(0), 'vRainX');
  const fade = uniform(1);

  m.positionNode = Fn(() => {
    const id = float(instanceIndex);
    const h = vec3(hash12(vec2(id, seed)), hash12(vec2(id.add(17.1), seed)), hash12(vec2(id.mul(1.37), seed.add(3))));
    const speed = mix(float(0.85), float(1.15), hash12(vec2(id, 9.3)));
    const t = U.time;
    const vel = vec3(WIND.x, -fall, WIND.z).mul(speed);
    // world-anchored lattice drifting with the wind; wrapped into the box around the camera
    const anchor = vec3(h.x.mul(box), h.y.mul(height), h.z.mul(box)).add(vel.mul(t));
    const rel = anchor.sub(cameraPosition);
    const half = vec3(box * 0.5, height * 0.5, box * 0.5);
    const wrapped = rel.add(half).div(vec3(box, height, box)).fract().mul(vec3(box, height, box)).sub(half);
    const p = cameraPosition.add(wrapped).toVar();
    // under cover, above the cloud deck, or below the street: no drop
    const cover = texture(heightTex, hmUV(p.xz)).r;
    const inMap = step(abs(p.x), HM.extent).mul(step(abs(p.z), HM.extent));
    const covered = step(p.y, cover.mul(inMap)).max(step(p.y, -0.5)).max(step(U.cloudBase, p.y));
    // streak: velocity relative to the moving camera, as if exposed for a 30th of a second
    const relV = vel.sub(U.camVel.mul(0.85));
    const axis = normalize(relV);
    const len = length(relV).mul(0.034).clamp(0.25, 3.5);
    const toCam = p.sub(cameraPosition);
    const dist = length(toCam);
    const side = normalize(cross(axis, toCam.div(dist.max(1e-3))));
    // never thinner than about a pixel, conserving brightness as it widens
    const w = max(float(width), dist.mul(0.0011));
    const pos = p.add(axis.mul(positionGeometry.y.mul(len))).add(side.mul(positionGeometry.x.mul(w)));
    const nearFade = smoothstep(0.6, 2.5, dist);
    const farFade = smoothstep(box * 0.5, box * 0.28, length(toCam.xz));
    const a = float(alpha).mul(nearFade).mul(farFade).mul(float(width).div(w)).mul(covered.oneMinus()).mul(U.rain).mul(fade);
    vAlpha.assign(a);
    // lit by the street: neon from the lightmap, stronger near the ground, plus lightning
    const lm = texture(lightmap.near, lmUV(p.xz)).rgb;
    const lowness = exp(p.y.sub(cover.max(0)).negate().div(26));
    vCol.assign(vec3(0.42, 0.46, 0.56).mul(0.22).add(lm.mul(lowness.mul(2.4).add(0.25))).add(vec3(0.7, 0.8, 1.0).mul(U.flash.mul(1.6))));
    vX.assign(positionGeometry.x);
    return pos;
  })();
  const across = float(1).sub(abs(vX).mul(2)).max(0);
  m.colorNode = vCol;
  m.opacityNode = vAlpha.mul(across.mul(across));

  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.layers.set(LAYER_NOREFL);
  return { mesh, fade, geo };
}

function splashLayer({ count, box, lightmap, heightTex }) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const vA = varying(float(0), 'vSplA');
  const vC = varying(vec3(0), 'vSplC');
  const vUV = varying(vec2(0), 'vSplUV');
  const period = 0.55;
  m.positionNode = Fn(() => {
    const id = float(instanceIndex);
    const h = vec3(hash12(vec2(id, 1.7)), hash12(vec2(id, 5.3)), hash12(vec2(id, 9.1)));
    const t = U.time.div(period).add(h.y);
    const cycle = floor(t);
    const life = fract(t);
    // each cycle lands somewhere new inside the box around the camera
    const r = vec2(hash12(vec2(id, cycle)), hash12(vec2(cycle, id.add(3.3)))).sub(0.5).mul(box);
    const xz = cameraPosition.xz.add(r);
    const cover = texture(heightTex, hmUV(xz)).r;
    const y = cover.max(0).add(0.02);
    const p = vec3(xz.x, y, xz.y);
    // a crown: grows quickly, then sinks and fades
    const s = smoothstep(0.0, 0.18, life).mul(0.14).add(0.02);
    const toCam = cameraPosition.sub(p);
    const dist = length(toCam);
    const right = normalize(vec3(toCam.z, 0, toCam.x.negate()));
    const pos = p.add(right.mul(positionGeometry.x.mul(s))).add(vec3(0, positionGeometry.y.add(0.5).mul(s).mul(0.7), 0));
    const show = step(life, 0.3).mul(smoothstep(0.3, 0.05, life)).mul(smoothstep(box * 0.5, box * 0.2, dist)).mul(step(cameraPosition.y.sub(y), 40));
    vA.assign(show.mul(U.rain).mul(0.55));
    const lm = texture(lightmap.near, lmUV(xz)).rgb;
    vC.assign(vec3(0.5, 0.55, 0.65).mul(0.3).add(lm.mul(2.2)));
    vUV.assign(positionGeometry.xy.add(0.5));
    return pos;
  })();
  // two arcs of droplets, like a crown seen side-on
  const q = vUV.sub(vec2(0.5, 0.0));
  const ring = smoothstep(0.08, 0.0, abs(length(q.mul(vec2(1, 1.6))).sub(0.42)));
  const dots = step(0.5, fract(q.x.mul(9).add(0.25)));
  m.colorNode = vC;
  m.opacityNode = vA.mul(ring).mul(dots.mul(0.6).add(0.4));
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.layers.set(LAYER_NOREFL);
  return { mesh, geo };
}

export function createRain(lightmap, heightTex, { quality = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'rain';
  const near = rainLayer({ count: Math.round(14000 * quality), box: 26, height: 18, width: 0.006, alpha: 0.32, lightmap, heightTex, seed: float(1.3) });
  const far = rainLayer({ count: Math.round(22000 * quality), box: 110, height: 60, width: 0.012, alpha: 0.2, lightmap, heightTex, seed: float(7.9) });
  const splash = splashLayer({ count: Math.round(2600 * quality), box: 36, lightmap, heightTex });
  group.add(near.mesh, far.mesh, splash.mesh);
  return {
    group,
    setQuality(q) {
      near.geo.instanceCount = Math.round(14000 * q);
      far.geo.instanceCount = Math.round(22000 * q);
      splash.geo.instanceCount = Math.round(2600 * q);
    },
  };
}
