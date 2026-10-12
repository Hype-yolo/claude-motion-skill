// Street furniture and facade clutter: lamps, shopfronts, awnings, air-conditioners, rooftop kit.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  attribute, positionGeometry, positionWorld, normalGeometry, vec2, vec3, float, mix, step, texture, fract, smoothstep, length, If, Discard, Fn,
} from 'three/tsl';
import { U, noiseTex } from '../core/shared.js';
import { chunkedInstances, iPR, iS } from './instancing.js';
import { shopFit, SHOP_NEAR } from './shopkit.js';
import { streetLight } from './lightmap.js';
import { LAYER_NOREFL } from './ground.js';
import SHOP from './shops.json';

function withPart(geo, part) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  return g;
}

export function createProps(city, tex, lightmap) {
  const group = new THREE.Group();
  group.name = 'props';
  const spill = (P) => streetLight(lightmap, P.xz);

  // --- street lamps: pole, arm and a cobra head that throws sodium or LED light ---
  {
    const pole = new THREE.CylinderGeometry(0.08, 0.12, 8.8, 6, 1, true).translate(0, 4.4, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 2.5).translate(0, 8.6, 1.15);
    const head = new THREE.BoxGeometry(0.32, 0.14, 0.8).translate(0, 8.55, 2.35);
    const geo = mergeGeometries([withPart(pole, 0), withPart(arm, 0), withPart(head, 1)]);
    const m = new THREE.MeshStandardNodeMaterial();
    const part = attribute('aPart', 'float');
    const warm = attribute('aWarm', 'float');
    const lampCol = mix(vec3(0.75, 0.86, 1.0), vec3(1.0, 0.62, 0.28), warm);
    const lens = part.mul(step(normalGeometry.y, -0.5));
    m.colorNode = vec3(0.05, 0.05, 0.055);
    m.roughnessNode = float(0.4);
    m.metalnessNode = float(0.7);
    m.emissiveNode = lampCol.mul(lens.mul(14).add(part.mul(0.4)));
    group.add(chunkedInstances({
      items: city.lamps, geometry: geo, material: m, name: 'lamps', maxDist: 700,
      place: (l) => [l.x, 0.18, l.z, Math.atan2(l.ox, l.oz), 1, 1, 1],
      attrs: { aWarm: { size: 1, fn: (l) => (l.warm ? 1 : 0) } },
    }));
  }

  // --- shopfronts: real Hong Kong fronts (assets-src/shops.mjs), lit from inside while open. Near the camera the
  // modelled fronts (shopkit.js) stand in for the strip below the lintel; both show the same fronts, stretched alike ---
  {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.deleteAttribute('uv');
    const m = new THREE.MeshStandardNodeMaterial();
    const info = attribute('aShop', 'vec4'); // seed, open, strip start, strip metres the shop shows
    const seed = info.x, open = info.y;
    const along = positionGeometry.x.add(0.5);
    const lx = along.mul(iS.x); // metres along the front
    const ly = positionGeometry.y.add(0.5).mul(3.8); // metres up
    const kind = fract(seed.mul(7.31));
    const warmI = mix(vec3(1.0, 0.86, 0.66), vec3(0.86, 0.95, 1.0), step(0.45, kind));
    // whole fronts from the strip, stretched to the shop's width; above the 3 m front runs a dark lintel
    const front = step(ly, SHOP.height);
    const suv = vec2(info.z.add(along.mul(info.w)).div(SHOP.length), ly.div(SHOP.height).min(0.995));
    const sA = texture(tex.shopAlbedo, suv).rgb;
    const sM = texture(tex.shopMask, suv);
    const lintel = vec3(0.045, 0.045, 0.05).mul(texture(noiseTex, vec2(lx, ly).div(7)).r.mul(0.5).add(0.75));
    const wallCol = mix(lintel, sA.mul(0.85), front);
    const shopLit = sA.mul(sM.r.mul(warmI).mul(1.9).mul(open).add(sM.g.mul(mix(float(0.5), float(1.1), open)))).mul(front);
    const near = step(iPR.xyz.sub(U.kitCenter).length(), SHOP_NEAR);
    m.colorNode = Fn(() => {
      If(near.mul(front).greaterThan(0.5), () => { Discard(); });
      return wallCol;
    })();
    m.roughnessNode = mix(float(0.65), float(0.08), sM.r.mul(front));
    m.metalnessNode = float(0);
    m.emissiveNode = shopLit.add(spill(positionWorld).mul(wallCol).mul(2.2));
    group.add(chunkedInstances({
      items: city.shopfronts, geometry: geo, material: m, name: 'shops', layer: LAYER_NOREFL, maxDist: 900,
      place: (s) => [s.x, s.y, s.z, s.rotY, s.w, 3.8, 1],
      attrs: { aShop: { size: 4, fn: (s) => { const f = shopFit(s.seed, s.w); return [s.seed, s.open ? 1 : 0, f.start, f.sum]; } } },
    }));
  }

  // --- awnings over the pavement, with downlights in their soffits ---
  {
    const geo = new THREE.BoxGeometry(1, 0.14, 1);
    geo.deleteAttribute('uv');
    const m = new THREE.MeshStandardNodeMaterial();
    const info = attribute('aAwn', 'vec2'); // width, depth
    const lx = positionGeometry.x.mul(info.x);
    const under = step(normalGeometry.y, -0.5);
    const spot = smoothstep(0.22, 0.05, length(vec2(fract(lx.div(1.6)).sub(0.5).mul(1.6), positionGeometry.z.mul(info.y).sub(0.2))));
    m.colorNode = vec3(0.06, 0.065, 0.07);
    m.roughnessNode = float(0.35);
    m.metalnessNode = float(0.6);
    m.emissiveNode = vec3(1.0, 0.84, 0.62).mul(spot.mul(under).mul(6)).add(spill(positionWorld).mul(0.12));
    group.add(chunkedInstances({
      items: city.awnings, geometry: geo, material: m, name: 'awnings', maxDist: 600,
      place: (a) => [a.x, a.y, a.z, a.rotY, a.w, 1, a.depth],
      attrs: { aAwn: { size: 2, fn: (a) => [a.w, a.depth] } },
    }));
  }

  // --- rooftop kit: water tanks, shacks, chillers, masts with a red warning light ---
  {
    const parts = {
      tank: mergeGeometries([withPart(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 12).translate(0, 2.3, 0), 0), withPart(new THREE.BoxGeometry(2.2, 1.0, 2.2).translate(0, 0.5, 0), 0)]),
      shack: withPart(new THREE.BoxGeometry(4.2, 2.7, 3.2).translate(0, 1.35, 0), 0),
      chiller: withPart(new THREE.BoxGeometry(3.2, 1.6, 2.1).translate(0, 0.8, 0), 0),
      mast: mergeGeometries([withPart(new THREE.CylinderGeometry(0.07, 0.12, 12, 5).translate(0, 6, 0), 0), withPart(new THREE.SphereGeometry(0.22, 6, 4).translate(0, 12.1, 0), 1)]),
    };
    const m = new THREE.MeshStandardNodeMaterial();
    const part = attribute('aPart', 'float');
    const seed = attribute('aSeed', 'float');
    const blink = step(0.55, fract(U.time.mul(0.8).add(seed)));
    const base = mix(vec3(0.18, 0.19, 0.2), vec3(0.26, 0.25, 0.23), seed);
    m.colorNode = base.mul(texture(noiseTex, positionWorld.xz.add(positionWorld.y).div(4)).r.mul(0.6).add(0.6));
    m.roughnessNode = float(0.6);
    m.metalnessNode = float(0.3);
    m.emissiveNode = vec3(1.0, 0.08, 0.04).mul(part.mul(blink).mul(10)).add(vec3(0.6, 0.7, 0.9).mul(U.flash).mul(base).mul(0.6));
    for (const [type, geo] of Object.entries(parts)) {
      const items = city.roofProps.filter((r) => r.type === type);
      group.add(chunkedInstances({
        items, geometry: geo, material: m, name: 'roof-' + type, maxDist: 1200,
        place: (r) => [r.x, r.y, r.z, r.rotY, r.s, r.s, r.s],
        attrs: { aSeed: { size: 1, fn: (r) => (r.x * 0.0137 + r.z * 0.0071) % 1 } },
      }));
    }
  }

  return { group };
}
