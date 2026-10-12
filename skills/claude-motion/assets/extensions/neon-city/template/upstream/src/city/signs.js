// Neon and lightbox signs from the baked atlas. Each sign is a thin box: both faces carry the artwork
// (the back mirrored so it reads correctly), the edges are dark metal.
import * as THREE from 'three/webgpu';
import { attribute, positionGeometry, normalGeometry, vec2, vec3, float, mix, step, abs, texture, sin, floor, fract, smoothstep, max } from 'three/tsl';
import { U } from '../core/shared.js';
import { chunkedInstances } from './instancing.js';
import { hash12 } from '../tsl/util.js';

export function createSigns(city, tex) {
  const atlas = city.atlas;
  const m = new THREE.MeshStandardNodeMaterial({ alphaTest: 0.5 });
  const cell = attribute('aCell', 'vec4');
  const prm = attribute('aSign', 'vec4');
  const flickType = prm.x, seed = prm.y, isBox = prm.z, isBare = prm.w;
  const lp = positionGeometry, ln = normalGeometry;
  const face = step(0.5, abs(ln.z));
  const back = step(ln.z, 0);
  const u = mix(lp.x.add(0.5), float(0.5).sub(lp.x), back);
  const v = lp.y.add(0.5);
  const auv = vec2(cell.x.add(u.mul(cell.z)), cell.y.add(v.mul(cell.w)));
  const s = texture(tex.signs, auv);

  // flicker: steady, a faint buzz, or a failing tube that stutters out
  const t = U.time;
  const buzz = float(1).sub(step(0.9, hash12(vec2(floor(t.mul(24)), seed.mul(97)))).mul(0.08));
  const slowN = hash12(vec2(floor(t.mul(1.7).add(seed.mul(13))), seed));
  const stutter = step(0.5, hash12(vec2(floor(t.mul(30)), seed)));
  const broken = mix(float(1), stutter.mul(0.85).add(0.05), step(0.62, slowN));
  const flick = mix(mix(float(1), buzz, step(0.5, flickType)), broken, step(1.5, flickType));
  const intensity = mix(float(5.2), float(1.9), isBox).mul(flick);

  m.colorNode = mix(vec3(0.03, 0.03, 0.035), s.rgb.mul(0.25), face);
  m.roughnessNode = mix(float(0.55), float(0.3), face);
  m.metalnessNode = mix(float(0.6), float(0), face);
  m.emissiveNode = s.rgb.mul(s.rgb).mul(intensity).mul(face).add(vec3(0.004));
  m.opacityNode = mix(float(1).sub(isBare), s.a, face);

  const cells = atlas.map((c) => [c.u, 1 - c.v - c.h, c.w, c.h]);
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.deleteAttribute('uv');
  const group = chunkedInstances({
    items: city.signs,
    geometry: box,
    material: m,
    name: 'signs',
    place: (s) => [s.x, s.y, s.z, s.rotY, s.w, s.h, atlas[s.cell].bare ? 0.04 : s.kind === 'roof' ? 0.35 : 0.22],
    attrs: {
      aCell: { size: 4, fn: (s) => cells[s.cell] },
      aSign: { size: 4, fn: (s) => [s.flicker, (s.x * 0.013 + s.z * 0.007 + s.y) % 1, atlas[s.cell].box, atlas[s.cell].bare] },
    },
  });
  return { group, material: m };
}
