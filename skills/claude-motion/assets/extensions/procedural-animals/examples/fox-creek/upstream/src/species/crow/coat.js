// The crow's plumage and bare parts, baked per vertex: contour-feather shingles (material 9) with a
// blue-violet structural gloss on the back, wings and tail and a matter head and underside, a short
// down haze (shells), forward-pointing nasal bristles, a black keratin bill and claws, scaled black
// tarsi and toes, and a dark eye ring. Colours sampled from the reference photos. Seeded
// variation shifts gloss and wear (brownish worn feathers) and the morph (American / carrion / hooded).
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, add, mul, clamp, smoothstep, mix, fbm3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT } from '../../core/build/coatKit.js';
import { HEAD_O } from './rig.js';

export function crowColours(p = {}) {
  const wear = p.wear || 0, morph = p.morph || 'american';
  const black = srgb(0x131316), matte = srgb(0x19191d), worn = srgb(0x2a2420);
  const tint = (c) => mix3(c, worn, wear * 0.35);
  return {
    body: tint(black), under: tint(matte), head: tint(srgb(0x151518)),
    grey: srgb(0x8c8c8a), greyUnder: srgb(0x9a9a98),
    bill: srgb(0x141414), leg: srgb(0x17171a), claw: srgb(0x0e0e10), ring: srgb(0x1c1b1d),
    // adult mouth lining dark grey (research); juveniles show a pink gape
    gape: p.age === 'juvenile' ? srgb(0xb87c78) : srgb(0x2a2a2e), juvGape: p.age === 'juvenile', hooded: morph === 'hooded',
    irid: (morph === 'carrion' ? 0.45 : 0.55) * (p.gloss ?? 1) * (1 - 0.5 * wear),
  };
}

export function crowCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params } = ctx;
  const { BONES, J } = rig;
  const C = crowColours(params);
  const comb = new Float32Array(nV * 3), tint = new Float32Array(nV * 4), surf = new Float32Array(nV * 4);
  const furLen = new Float32Array(nV), mark = new Float32Array(nV).fill(1), pattern = new Float32Array(nV).fill(1);
  const boneName = BONES.map((b) => b.name);
  const tagged = (t) => model.prims.filter((p) => p.tag === t);
  const billP = tagged('bill'), bristleP = tagged('bristles'), mandP = model.forPart('jaw');
  const eyeP = tagged('eyesocket'), clawP = tagged('claw'), tarsusP = [...tagged('tarsus'), ...tagged('toe'), ...tagged('pad'), ...tagged('shank')];
  const minD = (list, p) => { let d = 1e9; for (const q of list) d = Math.min(d, SDFModel.dist(q, p[0], p[1], p[2])); return d; };
  const H = HEAD_O;
  const axialPts = rig.AXIAL.points;
  // flow along the body axis (bill -> tail) at the nearest axial segment
  const axialDir = (p) => {
    let best = 1e9, dir = [0, 0, -1];
    for (let i = 0; i < axialPts.length - 1; i++) {
      const a = axialPts[i], b = axialPts[i + 1], ab = sub(b, a), l2 = dot(ab, ab);
      const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
      const q = add(a, mul(ab, t)), d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d < best) { best = d; dir = norm(ab); }
    }
    return dir;
  };
  for (let v = 0; v < nV; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    const bn = boneName[weights.dominant[v]] || '';
    const region = regionNames[regionOf[v]];
    let col = C.body, mat = MAT.FEATHER, fl = 0.0035, gloss = 0.55, size = 0.012, irid = C.irid;
    let flow = axialDir(p);
    const h = [p[0] - H[0], p[1] - H[1], p[2] - H[2]];
    const up = n[1];
    if (region === 'jaw' || bn === 'jaw') {
      mat = MAT.KERATIN; col = C.bill; fl = 0; gloss = 0.5; size = 0; irid = 0;
      flow = [0, 0, 1];
      const dh = minD(billP, p);
      if (dh < 0.0006 && h[2] < 0.06) { mat = C.juvGape ? MAT.DARK_SKIN : MAT.KERATIN; col = C.gape; gloss = 0.2; }
    } else if (bn === 'head' || region === 'head') {
      col = C.head; size = 0.006; irid = C.irid * 0.35; gloss = 0.45; fl = 0.0022;
      flow = norm([0, -0.25, -1]);
      if (Math.abs(h[0]) > 0.006) flow = norm([h[0] * 8, -0.3, -1]);
      const db = minD(billP, p), dbr = minD(bristleP, p), dm = minD(mandP, p);
      if (db < 0.0004 && h[2] > 0.028) { mat = MAT.KERATIN; col = C.bill; fl = 0; gloss = 0.55; irid = 0; flow = [0, 0, 1]; }
      else if (dbr < 0.0012 && h[2] > 0.02) {
        // nasal bristles: stiff forward-pointing feathers over the nostrils
        mat = MAT.FUR; col = C.head; fl = 0.0035; flow = norm([h[0] * 2, -0.05, 1]); irid = 0;
      } else if (dm < 0.001 && h[2] > 0.02) { mat = C.juvGape ? MAT.DARK_SKIN : MAT.KERATIN; col = C.gape; fl = 0; gloss = 0.2; irid = 0; }
      // eye ring (bare dark skin right at the lid margin)
      for (const e of eyeP) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0009) { mat = MAT.DARK_SKIN; col = C.ring; fl = 0; }
        else if (Math.abs(de) < 0.0025) { fl = Math.min(fl, 0.0008); size = 0.003; }
      }
      if (h[2] > 0.018) size = 0.0035;
    } else if (/^(tarsus|toe)/.test(bn) || (bn.startsWith('tibia') && minD(tarsusP, p) < 0.0008)) {
      mat = MAT.SCALES; col = C.leg; fl = 0; gloss = 0.35; size = 0.0022; irid = 0;
      flow = [0, -1, 0];
      if (minD(clawP, p) < 0.0004) { mat = MAT.KERATIN; col = C.claw; gloss = 0.65; size = 0; }
      if (/^toe/.test(bn)) { const b = BONES[weights.dominant[v]]; flow = norm(sub(b.tail, b.head)); }
    } else if (bn.startsWith('tibia') || bn.startsWith('femur')) {
      // feathered "trousers": soft, matte, pointing down the leg
      col = C.under; fl = 0.004; size = 0.008; irid = C.irid * 0.2; gloss = 0.4;
      flow = [0, -1, -0.2];
    } else if (/^(humerus|ulna|hand)/.test(bn)) {
      // wing coverts: lie toward the trailing edge, glossy on top
      const b = BONES[weights.dominant[v]];
      const d = norm(sub(b.tail, b.head));
      let wn = norm(cross(sub(J[b.side === 'R' ? 'elbowR' : 'elbowL'], J[b.side === 'R' ? 'shoulderR' : 'shoulderL']), sub(J[b.side === 'R' ? 'wristR' : 'wristL'], J[b.side === 'R' ? 'elbowR' : 'elbowL'])));
      if (wn[1] < 0) wn = mul(wn, -1);
      const s = b.side === 'R' ? -1 : 1;
      flow = mul(norm(cross(wn, d)), s);
      size = 0.009; fl = 0.0025;
      const top = dot(n, wn);
      if (top < 0) { col = C.under; irid = C.irid * 0.25; }
    } else {
      // body: glossy back and mantle, matte breast and belly
      const dorsal = smoothstep(-0.2, 0.5, up);
      col = mix3(C.under, C.body, dorsal);
      irid = C.irid * mix(0.2, 0.7, dorsal) * mix(0.45, 1, dorsal); // underparts ~0.3x the back
      gloss = mix(0.22, 0.6, dorsal); // matte underparts
      size = p[1] > 0.2 && p[2] > 0.03 ? 0.008 : 0.012;
      fl = mix(0.004, 0.003, dorsal);
      if (C.hooded) {
        // hooded crow: grey mantle, back, breast and belly; black head, bib, wings and tail
        // (soft edges: the black bib ends in a rounded line on the upper breast, the grey fades into
        // the black rump and undertail)
        const bib = smoothstep(0.17, 0.2, p[1] + 0.25 * Math.max(0, p[2] - 0.03)) * smoothstep(0.03, 0.06, p[2]);
        const gw = (1 - bib) * smoothstep(-0.105, -0.08, p[2]);
        if (gw > 0) { col = mix3(col, mix3(C.greyUnder, C.grey, dorsal), gw); irid = mix(irid, 0.05, gw); }
      }
      // flow: along the body, bending around the flanks and down the breast
      if (bn === 'chest' && p[2] > 0.04 && up < 0.2) flow = norm(add(flow, [0, -0.8, 0]));
    }
    // low-frequency variation (wear, sheen patches)
    const cv = fbm3(p[0] * 40, p[1] * 40, p[2] * 40, 3) - 0.5;
    col = [col[0] * (1 + 0.1 * cv), col[1] * (1 + 0.1 * cv), col[2] * (1 + 0.08 * cv)];
    // comb: tangent to the surface
    const f = sub(flow, mul(n, dot(flow, n)));
    const fN = norm(Math.hypot(...f) > 1e-6 ? f : cross(n, [1, 0, 0]));
    comb.set(fN, v * 3);
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    furLen[v] = fl;
    surf[v * 4] = gloss; surf[v * 4 + 1] = size; surf[v * 4 + 2] = 0; surf[v * 4 + 3] = mat === MAT.FEATHER ? irid : 0;
  }
  return { comb, tint, pattern, mark, furLen, surf, patternColor: new Float32Array(nV * 4) };
}

// flight-feather card colours: glossy black, iridescent on top, greyer and matte beneath
export function crowFeatherColour(params) {
  const C = crowColours(params);
  return (kind, i, side, t, c, layer) => {
    const top = layer > 0;
    const covert = kind.endsWith('Covert');
    let rgb = top ? C.body : mix3(C.under, srgb(0x2a2a30), 0.35);
    // primaries: the inner vane is a little duller (hidden under the next feather at rest)
    if (kind === 'primary' && c > 0.3) rgb = mix3(rgb, C.under, 0.3);
    if (C.hooded && covert && kind !== 'tailCovert') rgb = top ? C.body : C.under;
    const k = 1 + 0.06 * Math.sin(i * 12.9898 + side * 3.1 + t * 2.1);
    return { rgb: [rgb[0] * k, rgb[1] * k, rgb[2] * k], gloss: top ? 0.5 : 0.1, irid: top ? C.irid * (covert ? 0.7 : 0.5) : 0 };
  };
}
