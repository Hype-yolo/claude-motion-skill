// The Zenith's own lighting: light lines up every corner and round every setback, so its stepped silhouette
// reads from anywhere in the city, a pulse that climbs to the pad, the pad's landing ring and the spire beacons.
import * as THREE from 'three/webgpu';
import { positionWorld, vec3, float, mix, exp, fract, sin, step, smoothstep, abs, atan, length, positionGeometry } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U } from '../core/shared.js';
import { CITY } from './layout.js';

export function createZenith(city) {
  const b = city.buildings.find((x) => x.zenith);
  const group = new THREE.Group();
  group.name = 'zenith';
  if (!b) return { group };
  const parts = [];
  const box = (w, h, d, x, y, z) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const tiers = b.tiers.slice(1, -1); // above the podium, below the spire
  for (const t of tiers) {
    const hx = t.w / 2 + 0.5, hz = t.d / 2 + 0.5, h = t.y1 - t.y0;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(1.4, h, 1.4, b.x + sx * hx, t.y0 + h / 2, b.z + sz * hz);
    // a rim round the top of each setback, and a fainter one a floor below it
    for (const dy of [-0.5, -4.2]) {
      box(t.w + 2.4, 0.9, 0.9, b.x, t.y1 + dy, b.z - hz);
      box(t.w + 2.4, 0.9, 0.9, b.x, t.y1 + dy, b.z + hz);
      box(0.9, 0.9, t.d + 2.4, b.x - hx, t.y1 + dy, b.z);
      box(0.9, 0.9, t.d + 2.4, b.x + hx, t.y1 + dy, b.z);
    }
  }
  const geo = mergeGeometries(parts);
  const m = new THREE.MeshBasicNodeMaterial();
  const y = positionWorld.y;
  // a bright band climbs the tower every few seconds; colour shifts from magenta at the foot to cyan at the pad
  const climb = fract(y.div(CITY.zenith.pad).sub(U.time.mul(0.11)));
  const pulse = exp(climb.sub(0.97).abs().mul(-60)).mul(5);
  const tint = mix(vec3(1.0, 0.18, 0.85), vec3(0.2, 0.85, 1.0), smoothstep(200, CITY.zenith.pad, y));
  const rim = step(0.4, fract(y.div(3.1))).mul(0.15).add(0.85);
  m.colorNode = tint.mul(float(3.2).add(pulse)).mul(rim).add(vec3(0.6, 0.7, 1.0).mul(U.flash));
  const lines = new THREE.Mesh(geo, m);
  lines.frustumCulled = false;
  group.add(lines);

  // landing ring and lights on the pad
  const pad = CITY.zenith.pad;
  const ringGeo = new THREE.RingGeometry(5.5, 6.1, 72).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  const ang = atan(positionGeometry.z, positionGeometry.x);
  const chase = step(0.55, fract(ang.mul(24 / (2 * Math.PI)).sub(U.time.mul(1.2))));
  ringMat.colorNode = vec3(0.25, 0.9, 1.0).mul(chase.mul(2.5).add(1.0));
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(b.x + 12.5, pad + 0.06, b.z); // the free side of the pad, clear of the spire
  group.add(ring);
  const edge = [];
  const top = b.tiers[b.tiers.length - 2];
  const half = top.w / 2 - 0.6;
  for (let k = -4; k <= 4; k++) {
    const a = (k / 4) * half;
    for (const [x, z] of [[a, -half], [a, half], [-half, a], [half, a]]) edge.push(new THREE.BoxGeometry(0.5, 0.25, 0.5).translate(b.x + x, pad + 0.12, b.z + z));
  }
  const edgeMat = new THREE.MeshBasicNodeMaterial();
  edgeMat.colorNode = vec3(1.0, 0.62, 0.2).mul(sin(U.time.mul(3)).mul(0.5).add(2.5));
  group.add(new THREE.Mesh(mergeGeometries(edge), edgeMat));

  // aviation beacons on the spire: slow red blinks, the top one strobing white
  const bGeo = [];
  for (const h of [pad + 40, pad + 90, CITY.zenith.top - 2]) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bGeo.push(new THREE.SphereGeometry(0.9, 10, 8).translate(b.x + sx * 5.4, h, b.z + sz * 5.4));
  const bm = new THREE.MeshBasicNodeMaterial();
  const isTop = step(CITY.zenith.top - 10, positionWorld.y);
  const blink = step(0.55, fract(U.time.mul(0.5)));
  const strobe = step(0.93, fract(U.time.mul(0.9)));
  bm.colorNode = mix(vec3(1.0, 0.06, 0.04).mul(blink.mul(9).add(0.4)), vec3(1, 1, 1).mul(strobe.mul(30).add(0.6)), isTop);
  group.add(new THREE.Mesh(mergeGeometries(bGeo), bm));
  return { group };
}
