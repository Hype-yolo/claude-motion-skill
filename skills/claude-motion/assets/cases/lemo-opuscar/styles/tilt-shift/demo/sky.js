// 天空与时刻：城市时钟（6:00 起的秒数）→ 太阳高度/方位、天空渐变、雾、光照、夜间系数；环境贴图按太阳高度量化缓存
import * as THREE from 'three';
import { U } from './city.js';
import { clamp, lerp } from '/core/lib.js';

const skyMat = new THREE.ShaderMaterial({
  uniforms: { zen: { value: new THREE.Color() }, horS: { value: new THREE.Color() }, horA: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(1, .1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 1 } },
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
  fragmentShader: `varying vec3 vD; uniform vec3 zen, horS, horA, sunDir, sunCol; uniform float glow;
    void main(){ vec3 d = normalize(vD); float t = max(d.y, 0.);
      vec2 hd = normalize(d.xz + 1e-5), hs = normalize(sunDir.xz + 1e-5); float side = dot(hd, hs) * .5 + .5;
      vec3 hor = mix(horA, horS, pow(side, 2.));
      vec3 c = mix(hor, zen, pow(t, .45));
      float s = max(dot(d, normalize(sunDir)), 0.);
      c += sunCol * (pow(s, 8.) * .35 + pow(s, 64.) * .6) * glow;
      c += sunCol * smoothstep(.9995, .99975, s) * 8. * glow;
      if (d.y < 0.) c = mix(hor, hor * .7, min(-d.y * 4., 1.));
      gl_FragColor = vec4(c, 1.); }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});

// 关键帧（太阳高度°）
const K = [
  { e: -6, zen: '#0b1633', horS: '#51466e', horA: '#1e2c52', sun: '#ff7a3c', sunI: 0, hemS: '#4a64a8', hemG: '#23252e', hemI: 1.0, night: 1, fog: '#2c3a64', expo: 1.5, glow: .3 },
  { e: -3.5, zen: '#23386e', horS: '#f0a08a', horA: '#4e5f94', sun: '#ff8a60', sunI: 0, hemS: '#5d74b4', hemG: '#2c2e38', hemI: 1.05, night: .8, fog: '#56628e', expo: 1.42, glow: .8 },
  { e: -1.5, zen: '#34529a', horS: '#f7a878', horA: '#7580ae', sun: '#ff8a50', sunI: .0, hemS: '#7c8cc4', hemG: '#46404a', hemI: 1.0, night: .7, fog: '#8a88aa', expo: 1.3, glow: .9 },
  { e: 1, zen: '#3d62a3', horS: '#f7a766', horA: '#8591b8', sun: '#ff9950', sunI: 2.2, hemS: '#7288c0', hemG: '#4a4038', hemI: .8, night: .55, fog: '#9aa0bc', expo: 1.12, glow: 1 },
  { e: 5, zen: '#4f7fc4', horS: '#f8c690', horA: '#a9b8d4', sun: '#ffb877', sunI: 3.6, hemS: '#8aa6d6', hemG: '#5d5448', hemI: .7, night: .15, fog: '#b9c2d6', expo: 1.05, glow: 1 },
  { e: 12, zen: '#4a88d4', horS: '#f0dcc0', horA: '#c3d3e6', sun: '#ffd9a8', sunI: 4.4, hemS: '#b3c6dc', hemG: '#8a7a62', hemI: .6, night: 0, fog: '#c8d4e2', expo: 1.0, glow: .9 },
  { e: 25, zen: '#3f86dc', horS: '#e3e6e6', horA: '#cddcec', sun: '#ffe8c8', sunI: 4.8, hemS: '#b8cae0', hemG: '#8d7d66', hemI: .6, night: 0, fog: '#cfdbe8', expo: 1.0, glow: .8 },
];
const _a = new THREE.Color(), _b = new THREE.Color();
const cl = (k0, k1, u, f) => _a.set(k0[f]).lerp(_b.set(k1[f]), u).clone();

export const sunElev = clock => -3.5 + clock / 3600 * 13.5;     // 6:00 ≈ -3.5°（蓝调+粉橙晨光），6:15 ≈ 0°，8:00 ≈ 23.5°
export const sunAz = clock => (72 + clock / 3600 * 12) * Math.PI / 180;

export function skyState(clock, azDeg) {
  const e = sunElev(clock), az = azDeg !== undefined ? azDeg * Math.PI / 180 : sunAz(clock);
  let i = 0; while (i < K.length - 2 && e > K[i + 1].e) i++;
  const k0 = K[i], k1 = K[i + 1], u = clamp((e - k0.e) / (k1.e - k0.e));
  const er = e * Math.PI / 180;
  return {
    e, az, u,
    dir: new THREE.Vector3(Math.sin(az) * Math.cos(er), Math.sin(er), -Math.cos(az) * Math.cos(er)),
    zen: cl(k0, k1, u, 'zen'), horS: cl(k0, k1, u, 'horS'), horA: cl(k0, k1, u, 'horA'), sun: cl(k0, k1, u, 'sun'), hemS: cl(k0, k1, u, 'hemS'), hemG: cl(k0, k1, u, 'hemG'), fog: cl(k0, k1, u, 'fog'),
    sunI: lerp(k0.sunI, k1.sunI, u), hemI: lerp(k0.hemI, k1.hemI, u), night: lerp(k0.night, k1.night, u), expo: lerp(k0.expo, k1.expo, u), glow: lerp(k0.glow, k1.glow, u),
  };
}

export function makeSky(scene, renderer) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), skyMat); dome.frustumCulled = false; dome.renderOrder = -1; scene.add(dome);
  const sun = new THREE.DirectionalLight('#fff', 3); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0003; sun.shadow.normalBias = .4; sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#9cbce6', '#6b6356', .9); scene.add(hemi);
  // 黎明的天光：从东边低角度打来的粉橙色辅光（无阴影），让楼顶和东立面的边缘带一点晨光
  const glow = new THREE.DirectionalLight('#ffb48c', 0); scene.add(glow, glow.target);
  scene.fog = new THREE.FogExp2('#c8d4e2', .00022);
  // 环境贴图：只放天空的小场景
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
  const pm = new THREE.PMREMGenerator(renderer); const cache = new Map();
  function env(e) {
    const key = Math.round(e * 2) / 2;
    if (!cache.has(key)) cache.set(key, pm.fromScene(envScene, 0, .1, 200).texture);
    return cache.get(key);
  }
  function apply(clock, focus, span, o = {}) {
    const s = skyState(clock, o.az);
    const U2 = skyMat.uniforms;
    U2.zen.value.copy(s.zen); U2.horS.value.copy(s.horS); U2.horA.value.copy(s.horA); U2.sunDir.value.copy(s.dir); U2.sunCol.value.copy(s.sun); U2.glow.value = s.glow;
    const el = Math.max(s.dir.y, .06), d = s.dir.clone(); if (d.y < .06) { d.y = .06; d.normalize(); }
    sun.color.copy(s.sun); sun.intensity = s.sunI * (o.sunMul ?? 1);
    sun.position.copy(focus).addScaledVector(d, 1500); sun.target.position.copy(focus); sun.target.updateMatrixWorld();
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 100, far: 3200 }); sun.shadow.camera.updateProjectionMatrix();
    hemi.color.copy(s.hemS); hemi.groundColor.copy(s.hemG); hemi.intensity = s.hemI;
    scene.fog.color.copy(s.fog); scene.fog.density = o.fog ?? .00022;
    U.night.value = s.night; U.sky.value.copy(s.horA).lerp(s.zen, .5); U.lit.value = clamp(.35 + (s.night - .7) * 2, .2, 1);
    const gi = clamp((2.5 - s.e) / 3) * 1.25; glow.intensity = gi; const ga = sunAz(clock); glow.position.copy(focus).add(new THREE.Vector3(Math.sin(ga), .22, -Math.cos(ga)).multiplyScalar(500)); glow.target.position.copy(focus); glow.target.updateMatrixWorld();
    scene.environment = env(s.e); scene.environmentIntensity = .35 + .25 * (1 - s.night);
    return s;
  }
  return { dome, sun, hemi, apply };
}
