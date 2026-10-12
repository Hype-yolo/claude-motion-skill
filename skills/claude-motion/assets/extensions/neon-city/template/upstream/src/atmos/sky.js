// Sky dome: city light-dome under the storm, a starfield and the moon above it.
import * as THREE from 'three/webgpu';
import { Fn, positionLocal, normalize, vec3, vec4, float, mix, smoothstep, pow, max, dot, floor, fract, step, sin, length, cameraPosition, abs } from 'three/tsl';
import { U } from '../core/shared.js';
import { hash13 } from '../tsl/util.js';

export function createSky() {
  const geo = new THREE.SphereGeometry(9000, 48, 24);
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  m.colorNode = Fn(() => {
    const d = normalize(positionLocal);
    const above = smoothstep(U.cloudBase, U.cloudTop.add(80), cameraPosition.y);
    // under the clouds: a low dome of sodium-magenta light pollution
    const dome = mix(vec3(0.16, 0.07, 0.14), vec3(0.02, 0.018, 0.035), smoothstep(-0.05, 0.45, d.y));
    // above: clean night, horizon still warm from the city through the cloud deck
    const night = mix(vec3(0.06, 0.07, 0.12), vec3(0.004, 0.007, 0.02), smoothstep(-0.02, 0.6, d.y))
      .add(vec3(0.12, 0.06, 0.1).mul(smoothstep(0.12, -0.04, d.y)));
    const cell = floor(d.mul(420));
    const h = hash13(cell);
    const f = fract(d.mul(420)).sub(0.5);
    const star = step(0.9965, h).mul(smoothstep(0.32, 0.0, length(f))).mul(hash13(cell.add(7)).mul(1.6).add(0.3))
      .mul(sin(U.time.mul(hash13(cell.add(3)).mul(3).add(1)).add(h.mul(90))).mul(0.25).add(0.75))
      .mul(smoothstep(0.0, 0.15, d.y));
    const md = dot(d, U.moonDir);
    const disc = smoothstep(0.99955, 0.99975, md);
    const halo = pow(max(md, 0), 900).mul(0.6).add(pow(max(md, 0), 40).mul(0.08));
    const moon = vec3(1.0, 0.96, 0.88).mul(disc.mul(6)).add(vec3(0.5, 0.6, 0.8).mul(halo));
    const sky = mix(dome, night.add(vec3(star)).add(moon), above);
    return vec4(sky.add(vec3(0.5, 0.6, 1.0).mul(U.flash).mul(0.15)), 1);
  })();
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  return {
    mesh,
    update(camera) {
      mesh.position.copy(camera.position);
    },
  };
}
