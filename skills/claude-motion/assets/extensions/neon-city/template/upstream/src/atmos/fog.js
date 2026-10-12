// Analytic fog: exponential height haze plus the storm-cloud slab, both integrated along the view ray.
// The haze takes its colour from the city light below it; the slab glows from underneath and is moonlit on top.
import * as THREE from 'three/webgpu';
import { Fn, positionWorld, cameraPosition, vec3, vec4, float, exp, abs, max, min, select, mix, smoothstep, clamp, texture, fog, uniform, length } from 'three/tsl';
import { U } from '../core/shared.js';
import { lmUV } from '../city/lightmap.js';

export const FOG = {
  hazeA: uniform(0.0024),
  hazeB: uniform(1 / 210),
  cloudK: uniform(0.065),
  base: uniform(new THREE.Color(0.018, 0.016, 0.032)),
  glow: uniform(new THREE.Color(0.55, 0.32, 0.62)),
};

// optical depth of the haze and of the cloud slab between the camera and a point
export const fogDepths = Fn(([P, C]) => {
  const d = P.sub(C);
  const dist = length(d).max(1e-3);
  const dy = d.y.div(dist);
  const k = FOG.hazeB.mul(dy).mul(dist);
  const shape = select(abs(k).greaterThan(1e-3), float(1).sub(exp(k.negate())).div(k), float(1).sub(k.mul(0.5)));
  const haze = FOG.hazeA.mul(exp(FOG.hazeB.negate().mul(C.y.max(-50)))).mul(dist).mul(shape);
  // path length inside [cloudBase, cloudTop]
  const lo = min(C.y, P.y), hi = max(C.y, P.y);
  const inside = min(hi, U.cloudTop).sub(max(lo, U.cloudBase)).max(0);
  const span = hi.sub(lo).max(1e-3);
  const path = select(span.greaterThan(0.05), inside.div(span).mul(dist), select(C.y.greaterThan(U.cloudBase).and(C.y.lessThan(U.cloudTop)), dist, float(0)));
  const cloud = path.mul(FOG.cloudK);
  return vec4(haze, cloud, dist, dy);
});

export const hazeColor = Fn(([P, lmFar]) => {
  const glowHere = texture(lmFar, lmUV(P.xz)).rgb;
  const h = smoothstep(U.cloudTop, float(0), P.y);
  const below = vec3(FOG.base).add(glowHere.mul(0.45).add(vec3(FOG.glow).mul(0.022)).mul(h.mul(0.8).add(0.2)));
  const above = vec3(0.03, 0.04, 0.07);
  return mix(above, below, smoothstep(U.cloudTop.add(120), U.cloudBase, cameraPosition.y.max(P.y)));
});

export const cloudColor = Fn(([P, lmFar]) => {
  const under = texture(lmFar, lmUV(P.xz)).rgb.mul(1.0).add(vec3(0.038, 0.034, 0.06));
  // from above: moonlit grey-violet, with the city's glow coming up through it
  const top = vec3(0.075, 0.074, 0.115).add(under.mul(0.22));
  const t = smoothstep(U.cloudBase, U.cloudTop.add(60), cameraPosition.y);
  const flash = vec3(0.6, 0.7, 1.0).mul(U.flash).mul(2.0);
  return mix(under, top, t).add(flash);
});

export function installFog(scene, lightmap) {
  const node = Fn(() => {
    const P = positionWorld;
    const fd = fogDepths(P, cameraPosition);
    const haze = fd.x, cloud = fd.y;
    const total = haze.add(cloud);
    const factor = float(1).sub(exp(total.negate()));
    const col = mix(hazeColor(P, lightmap.far), cloudColor(P, lightmap.far), cloud.div(total.max(1e-5)));
    return vec4(col, clamp(factor, 0, 1));
  })();
  scene.fogNode = fog(node.rgb, node.a);
  return node;
}
