// The eagle's plumage and bare parts, baked per vertex: contour-feather shingles (material 9), a short
// down haze (shells), yellow keratin bill and waxy cere, scaled yellow tarsi and toes, black talons.
// Adult bald eagle: dark chocolate body and wings, white head, neck and tail with a ragged hood edge.
// Juvenile bald eagle: brown with white mottling (belly, underwing, armpits), dark head, dark bill.
// Golden eagle: dark brown with a golden crown and nape, pale-edged wing coverts, grey-barred tail,
// dark-tipped blue-grey bill, legs feathered to the toes; juveniles with a white tail base and black
// band. Colours sampled from the reference photos. Seeded variation shifts tones, wear and
// the juvenile mottling.
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, add, mul, clamp, smoothstep, mix, fbm3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT } from '../../core/build/coatKit.js';
import { HEAD_O } from './rig.js';

export function eagleColours(p = {}) {
  const golden = p.variant === 'golden', juv = p.age === 'juvenile';
  const warm = p.warm || 0, wear = p.wear || 0;
  const tone = (c) => mix3(c, srgb(0x5a4430), wear * 0.25 + warm * 0.1);
  if (golden) {
    return {
      golden, juv,
      body: tone(srgb(juv ? 0x33251b : 0x3a2a1e)), under: tone(srgb(juv ? 0x2e2118 : 0x34261b)),
      head: srgb(0x3a2a1e), nape: mix3(srgb(0xc08a3e), srgb(0xd9a650), p.goldK ?? 0.5), face: srgb(0x33251b),
      covertEdge: srgb(0x8a6a48), white: srgb(0xe6e1d6), mottle: 0,
      tail: srgb(0x4a3e34), tailBar: srgb(0x6e665c), tailBase: srgb(0xedeae2), tailBand: srgb(0x1e1a18),
      bill: srgb(0x4c5258), billTip: srgb(0x141416), cere: srgb(0xe8c040), gape: srgb(0xd8b040),
      leg: srgb(0xe8c040), boot: tone(srgb(0x6a4a30)), claw: srgb(0x161616), ring: srgb(0x4a3a2a),
      hoodWhite: false, whiteTail: false,
    };
  }
  const bill = juv ? mix3(srgb(0x2e2a28), srgb(0xb89a58), p.billAge || 0) : srgb(0xecc46f);
  return {
    golden, juv,
    body: tone(srgb(juv ? 0x3a2a1e : 0x2b1e16)), under: tone(srgb(juv ? 0x3a2b20 : 0x2a1d15)),
    head: juv ? srgb(0x2e2218) : srgb(0xf2f0ea), nape: juv ? srgb(0x3a2a1e) : srgb(0xf2f0ea), face: juv ? srgb(0x3a2c20) : srgb(0xeeece6),
    covertEdge: srgb(0x4a3828), white: srgb(0xe0d8c8), mottle: juv ? (p.mottle ?? 0.5) : 0,
    tail: juv ? srgb(0x4a3a2c) : srgb(0xf4f2ec), tailBar: srgb(0x4a3a2c), tailBase: srgb(0xf4f2ec), tailBand: srgb(0x2a1e16),
    bill, billTip: bill, cere: juv ? mix3(srgb(0x7a6a50), srgb(0xd8b450), p.billAge || 0) : srgb(0xedc45a),
    gape: juv ? srgb(0x8a7a60) : srgb(0xe8c060),
    leg: srgb(juv ? 0xe8b840 : 0xf0b830), boot: null, claw: srgb(0x161616), ring: juv ? srgb(0x5a4a38) : srgb(0xd8c078),
    hoodWhite: !juv, whiteTail: !juv,
  };
}

export function eagleCoat(ctx) {
  const { model, rig, pos, nrm, regionOf, regionNames, weights, nV, params } = ctx;
  const { BONES, J } = rig;
  const C = eagleColours(params);
  const comb = new Float32Array(nV * 3), tint = new Float32Array(nV * 4), surf = new Float32Array(nV * 4);
  const furLen = new Float32Array(nV), mark = new Float32Array(nV).fill(1), pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  const boneName = BONES.map((b) => b.name);
  const tagged = (...t) => model.prims.filter((p) => t.includes(p.tag));
  const billP = tagged('bill'), cereP = tagged('cere'), nostrilP = tagged('nostril'), mandP = model.forPart('jaw');
  const eyeP = tagged('eyesocket'), clawP = tagged('claw'), bareP = tagged('tarsus', 'toe', 'pad'), featherLegP = tagged('cuff', 'boot', 'trousers');
  const minD = (list, p) => { let d = 1e9; for (const q of list) d = Math.min(d, SDFModel.dist(q, p[0], p[1], p[2])); return d; };
  const H = HEAD_O;
  const axialPts = rig.AXIAL.points;
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
  // hood edge (bald adult): along the neck from the neck base (0) to the occiput (1), ragged
  const nb = J.neckBase, nd = sub(J.occiput, J.neckBase), nl2 = dot(nd, nd);
  const hoodT = (p) => dot(sub(p, nb), nd) / nl2;
  // bald adult white hood: everything within a ragged radius of a point at the back of the skull, so the
  // white ends at the base of the neck all round, the throat as cleanly as the nape (a plane across the
  // neck, t above, left the throat white far down onto the breast once the body is levelled in flight).
  // Flight photos: the white reaches ~0.21 m back from the bill tip, the dark breast
  // begins where the neck meets the body.
  const hoodC = add(J.occiput, [0, -0.008, 0.01]);
  const hoodR = 0.1 - ((params.hood ?? 0.26) - 0.26) * 0.15;
  const tailDir = norm(sub(J.tailTip, J.tailBase));
  const seed = (params.seed || 1) * 0.37;
  for (let v = 0; v < nV; v++) {
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    const bn = boneName[weights.dominant[v]] || '';
    const region = regionNames[regionOf[v]];
    let col = C.body, mat = MAT.FEATHER, fl = 0.006, gloss = 0.35, size = 0.022;
    let flow = axialDir(p);
    const h = [p[0] - H[0], p[1] - H[1], p[2] - H[2]];
    const up = n[1];
    let mottleOK = 0; // where juvenile white mottling may appear
    if (region === 'jaw' || bn === 'jaw') {
      mat = MAT.KERATIN; col = mix3(C.bill, C.billTip, smoothstep(0.05, 0.085, h[2])); fl = 0; gloss = C.golden || C.juv ? 0.26 : 0.4; size = 0;
      flow = [0, 0, 1];
      if (h[2] < 0.012) { mat = MAT.SKIN; col = C.gape; gloss = 0.35; }
    } else if (bn === 'head' || region === 'head') {
      col = C.head; size = 0.0055; gloss = 0.3; fl = 0.006;
      flow = norm([0, -0.2, -1]);
      if (Math.abs(h[0]) > 0.01) flow = norm([h[0] * 6, -0.35, -1]);
      if (C.golden) {
        col = C.face; // (the golden crown and nape are laid on below, continuous with the neck)
      } else if (C.juv) {
        // juvenile: dark head with a paler, streaky cheek and throat
        col = mix3(C.head, C.face, smoothstep(0.0, -0.03, h[1]));
      }
      if (h[2] < -0.04) fl = 0.009; // lanceolate hackles on the nape
      const db = minD(billP, p), dc = minD(cereP, p), dn = minD(nostrilP, p), dm = minD(mandP, p);
      // (surface points on the smooth-union blend lie up to ~3 mm from the nearest primitive)
      const bare = Math.min(db, dc) < 0.003 && h[2] > 0.024;
      if (bare && db < dc - 0.0005 && h[2] > 0.045) {
        mat = MAT.KERATIN; fl = 0; gloss = C.golden || C.juv ? 0.26 : 0.4; flow = [0, 0, 1]; size = 0;
        col = mix3(C.bill, C.billTip, smoothstep(0.07, 0.098, h[2]));
      } else if (bare) {
        mat = MAT.SKIN; col = C.cere; fl = 0; gloss = 0.45; flow = [0, 0, 1]; size = 0;
        if (dn < 0.0025) col = mul(C.cere, 0.25);
      } else if (dm < 0.0015 && h[2] > 0.0) { mat = MAT.SKIN; col = C.gape; fl = 0; }
      else if (h[2] > 0.012 && h[1] < 0.004 && Math.abs(h[0]) < 0.022) {
        // lores: short bristly feathers between eye and cere
        fl = 0.0025; size = 0.004; flow = norm([h[0] * 4, -0.1, -1]);
      }
      // eye ring: narrow bare skin at the lid margin, very short feathers around it
      for (const e of eyeP) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0012) { mat = MAT.SKIN; col = C.ring; fl = 0; gloss = 0.4; }
        else if (Math.abs(de) < 0.004) { fl = Math.min(fl, 0.0015); size = 0.004; }
      }
    } else if (/^(tarsus|toe)/.test(bn) || (bn.startsWith('tibia') && minD(bareP, p) < 0.001)) {
      const dFeather = minD(featherLegP, p), dBare = minD(bareP, p);
      if (dFeather < dBare - 0.0015 && /^tarsus/.test(bn)) {
        // feathered tarsus: the cuff below the trousers (bald) or the golden eagle's boot
        col = C.boot || C.under; fl = 0.007; size = 0.012; gloss = 0.3; flow = [0, -1, 0.1];
        mottleOK = 0.5;
      } else {
        mat = MAT.SCALES; col = C.leg; fl = 0; gloss = 0.4; size = 0.006; flow = [0, -1, 0];
        if (minD(clawP, p) < 0.0008) { mat = MAT.KERATIN; col = C.claw; gloss = 0.7; size = 0; }
        if (/^toe/.test(bn)) { const b = BONES[weights.dominant[v]]; flow = norm(sub(b.tail, b.head)); size = 0.0045; }
      }
    } else if (bn.startsWith('tibia') || bn.startsWith('femur')) {
      // feathered "trousers": soft, loose, pointing down the leg
      col = C.golden ? mix3(C.under, C.boot, 0.5) : C.under; fl = 0.009; size = 0.016; gloss = 0.28;
      flow = [0, -1, -0.15]; mottleOK = 0.7;
    } else if (/^(humerus|ulna|hand)/.test(bn)) {
      // wing coverts: lie toward the trailing edge
      const b = BONES[weights.dominant[v]];
      const S = b.side === 'R' ? 'R' : 'L';
      const d = norm(sub(b.tail, b.head));
      let wn = norm(cross(sub(J['elbow' + S], J['shoulder' + S]), sub(J['wrist' + S], J['elbow' + S])));
      if (wn[1] < 0) wn = mul(wn, -1);
      const s = S === 'R' ? -1 : 1;
      flow = mul(norm(cross(wn, d)), s);
      size = 0.018; fl = 0.005;
      const top = dot(n, wn);
      if (top < 0) { col = C.under; mottleOK = 1; } // underwing coverts / armpits
      else if (C.golden) col = mix3(C.body, C.covertEdge, 0.22 * smoothstep(0.2, 0.8, top));
    } else if (bn === 'tail') {
      // tail coverts: white on the adult bald eagle from ~3 cm behind the base of the tail (where the
      // rectrices emerge) back; the rump and vent in front of it stay dark, as in the flight photos (the
      // white used to start at the tail joint and read as a pale wedge in front of the tail)
      const dorsal = smoothstep(-0.2, 0.5, up);
      col = mix3(C.under, C.body, dorsal); size = 0.02; fl = 0.006;
      if (C.whiteTail) {
        const u = dot(sub(p, J.tailBase), tailDir) + (fbm3(p[0] * 70 + seed, p[1] * 70, p[2] * 70, 2) - 0.5) * 0.012;
        col = mix3(col, C.tail, smoothstep(0.02, 0.036, u));
      } else mottleOK = 0.6;
    } else {
      // body: dark back and mantle, the breast and belly a shade warmer
      const dorsal = smoothstep(-0.2, 0.5, up);
      col = mix3(C.under, C.body, dorsal);
      size = 0.024; fl = 0.007;
      mottleOK = 1 - dorsal * 0.7;
      if (bn === 'chest' && up < 0.2) flow = norm(add(flow, [0, -0.7, 0]));
    }
    // hood: bald adult white head and upper neck with a ragged edge; golden eagle golden crown, nape and
    // hind neck (one rule for the head and the neck meshes, so the colour is continuous across the cut)
    if ((bn.startsWith('neck') || bn === 'chest' || bn === 'head' || region === 'head') && mat === MAT.FEATHER) {
      const t = hoodT(p);
      const jag = (fbm3(p[0] * 60 + seed, p[1] * 60, p[2] * 60, 3) - 0.5) * 0.35;
      const h0 = params.hood ?? 0.26;
      let hood = smoothstep(h0, h0 + 0.1, t + jag);
      if (C.hoodWhite) {
        const r = Math.hypot(p[0] - hoodC[0], p[1] - hoodC[1], p[2] - hoodC[2]) + jag * 0.05;
        hood = smoothstep(hoodR + 0.008, hoodR - 0.004, r);
        col = mix3(col, mix3(C.head, srgb(0xd4d2cc), 0.3 * smoothstep(-0.1, -0.7, n[1]) * smoothstep(0.9, 1.2, t)), hood);
      }
      else if (C.golden) {
        const gw = smoothstep(0.45, 0.8, t + jag * 0.5) * smoothstep(-0.25, 0.45, -0.8 * n[2] + 0.6 * n[1]) * smoothstep(0.035, 0.0, h[2]);
        col = mix3(col, C.nape, gw);
      } else if (bn !== 'head' && region !== 'head') col = mix3(col, C.head, hood * 0.7);
      if (hood > 0.5 && bn !== 'head' && region !== 'head') { fl = 0.008; size = 0.012; }
      mottleOK *= 1 - smoothstep(0.2, 0.5, t);
    }
    // juvenile mottling: irregular white blotches on the underparts, armpits and trousers
    if (C.mottle > 0 && mottleOK > 0 && mat === MAT.FEATHER) {
      const m = fbm3(p[0] * 48 + seed * 3, p[1] * 48, p[2] * 48, 4);
      const thr = 0.68 - 0.2 * C.mottle * mottleOK;
      const d = (thr - m) * 0.04; // metres-ish (< 0 inside a blotch)
      pattern[v] = clamp(d, -0.02, 0.02);
      patternColor[v * 4] = C.white[0]; patternColor[v * 4 + 1] = C.white[1]; patternColor[v * 4 + 2] = C.white[2];
      patternColor[v * 4 + 3] = 0.6 * mottleOK;
    }
    // low-frequency variation (wear, sun-bleached feather tips)
    const cv = fbm3(p[0] * 18, p[1] * 18, p[2] * 18, 3) - 0.5;
    const kk = mat === MAT.FEATHER ? 0.3 : 0.08;
    col = [col[0] * (1 + kk * cv), col[1] * (1 + kk * cv), col[2] * (1 + kk * 0.9 * cv)];
    const f = sub(flow, mul(n, dot(flow, n)));
    const fN = norm(Math.hypot(...f) > 1e-6 ? f : cross(n, [1, 0, 0]));
    comb.set(fN, v * 3);
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    furLen[v] = fl;
    surf[v * 4] = gloss; surf[v * 4 + 1] = size; surf[v * 4 + 2] = 0; surf[v * 4 + 3] = mat === MAT.FEATHER ? 0.03 : 0;
  }
  return { comb, tint, pattern, mark, furLen, surf, patternColor };
}

// flight-feather card colours
export function eagleFeatherColour(params) {
  const C = eagleColours(params);
  const mot = C.mottle;
  return (kind, i, side, t, c, layer) => {
    const top = layer > 0;
    const covert = kind.endsWith('Covert');
    const hsh = (a) => { const x = Math.sin(a * 12.9898 + i * 78.233 + side * 3.1) * 43758.5453; return x - Math.floor(x); };
    let rgb = top ? mul(C.body, 0.68) : mix3(C.under, srgb(0x4a3e36), 0.3);
    if (kind === 'rectrix' || kind === 'tailCovert') {
      if (C.whiteTail) rgb = top ? C.tail : mix3(C.tail, srgb(0xc8c6c0), 0.3);
      else if (C.golden && C.juv) rgb = t < 0.62 ? C.tailBase : mix3(C.tailBase, C.tailBand, smoothstep(0.62, 0.7, t));
      else if (C.golden) {
        // greyish bands across the tail
        const bar = smoothstep(0.35, 0.5, Math.sin(t * 5 * Math.PI + 0.6) * 0.5 + 0.5) * (1 - smoothstep(0.8, 0.95, t));
        rgb = mix3(C.tail, C.tailBar, bar * (top ? 0.8 : 0.6));
      } else {
        // juvenile bald: brown, mottled white toward the base and inner webs
        rgb = C.tail;
        const w = (1 - smoothstep(0.35, 0.85, t)) * mot * (0.4 + 0.6 * hsh(Math.floor(t * 9) + c));
        rgb = mix3(rgb, C.white, clamp(w, 0, 0.8));
        rgb = mix3(rgb, srgb(0x2a1e16), smoothstep(0.85, 0.97, t) * 0.6);
      }
    } else if (kind === 'primary' || kind === 'secondary') {
      // flight feathers: slightly greyer below, darker tips
      if (!top) rgb = mix3(rgb, srgb(0x5a5048), 0.25);
      rgb = mix3(rgb, srgb(0x16110d), smoothstep(0.7, 1, t) * 0.35);
      if (C.golden && kind === 'secondary' && top) rgb = mix3(rgb, C.tailBar, 0.25 * (Math.sin(t * 14) * 0.5 + 0.5) * (1 - t));
      if (C.golden && C.juv && kind === 'primary' && i < 6) rgb = mix3(rgb, C.tailBase, (1 - smoothstep(0.2, 0.45, t)) * 0.9);
      if (!C.golden && C.juv && !top) rgb = mix3(rgb, C.white, mot * 0.5 * (1 - smoothstep(0.3, 0.6, t)) * (0.5 + 0.5 * hsh(c * 3)));
    } else if (covert) {
      if (C.golden && top) rgb = mix3(mul(C.body, 0.8), C.covertEdge, smoothstep(0.6, 1, t) * 0.45);
      if (!C.golden && C.juv && !top) rgb = mix3(rgb, C.white, mot * 0.7);
      if (!C.golden && C.juv && top) rgb = mix3(rgb, C.white, mot * 0.25 * smoothstep(0.6, 1, t) * hsh(1));
    }
    const k = 1 + 0.07 * Math.sin(i * 12.9898 + side * 3.1 + t * 2.1);
    return { rgb: [rgb[0] * k, rgb[1] * k, rgb[2] * k], gloss: top ? 0.25 : 0.2, irid: 0 };
  };
}
