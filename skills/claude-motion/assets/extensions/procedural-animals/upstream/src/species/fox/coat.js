// The red fox's coat, painted per vertex in reference space.
//
// Colour fields follow the red fox's pattern (Lariviere & Pasitschniak-Arts 1996):
// rufous-orange back, flanks, head and brush, brightest on the head, shoulders and flanks;
// white upper lips, cheeks, chin, throat and chest bib, a pale grey-white belly; black "stockings"
// from the paws up the front of the forelegs to the elbows and over the hind feet up to the hocks
// (a dark stripe runs on up the front of the shin); black backs of the ears with a white-furred
// inside; dark tear lines from the inner eye corners toward the lips; a black lip line and nose; the
// brush has black-tipped guard hair (the shader's agouti band), a dark tail-gland spot near its
// base and a white tip. Morphs: red (default), cross (a dark cross over the shoulders and down the
// spine, dark legs and belly, grizzled flanks), silver (black with silver-tipped guard hair, white
// tail tip), urban (duller, greyer, grizzled winter coat). Kits: woolly, sandy grey-brown with dark
// legs and a pale face.
// Fur length: long ruff and cheek fluff, long flanks and breeches, the huge brush; short sleek face,
// muzzle and lower legs.
import { HEAD_O, MUZZLE_Z0, HS } from './rig.js';
import { neckS } from './regions.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, sub, dot, cross, len, add, mul, smoothstep, clamp, mix, rng, fbm3, vnoise3 } from '../../core/math/vec.js';
import { srgb, mix3, MAT, smoothField } from '../../core/build/coatKit.js';

const P3 = {
  // sRGB swatches, neutral-light albedo
  red: {
    back: 0xb4582a, flank: 0xc46a32, lowFlank: 0xc97a42, head: 0xca7236, muzzleTop: 0xb46a34, shoulder: 0xc56a32,
    white: 0xece8e2, belly: 0xd8d2ca, stocking: 0x19140f, stockingEdge: 0x3a2418, earBack: 0x1e1814, earInner: 0xe6dccb,
    tail: 0xa45a2c, tailUnder: 0xc08450, tailTip: 0xf0ebe2, gland: 0x3a2618, tear: 0x3e2a1e, rump: 0xc98a58, dark: 0x2a1c14,
    ag: { back: 0.35, flank: 0.1, head: 0.05, leg: 0, tail: 0.55 },
  },
  cross: {
    back: 0x8a5634, flank: 0x9c6a44, lowFlank: 0x8a6448, head: 0xa8703e, muzzleTop: 0x7a5234, shoulder: 0x8e5a36,
    white: 0xcfc8bc, belly: 0x3a3430, stocking: 0x151210, stockingEdge: 0x2a2018, earBack: 0x1a1512, earInner: 0xcfc4b2,
    tail: 0x6e4a32, tailUnder: 0x8a6448, tailTip: 0xe8e2d8, gland: 0x2a1c14, tear: 0x2a1c14, rump: 0x8a6448, dark: 0x1e1a18,
    ag: { back: 0.55, flank: 0.45, head: 0.15, leg: 0, tail: 0.7 },
  },
  silver: {
    back: 0x8e8c8a, flank: 0x7a7876, lowFlank: 0x2e2c2a, head: 0x5e5c5a, muzzleTop: 0x201e1c, shoulder: 0x74726f,
    white: 0x5a5856, belly: 0x1e1c1a, stocking: 0x121010, stockingEdge: 0x181614, earBack: 0x141210, earInner: 0x6a6866,
    tail: 0x242220, tailUnder: 0x1c1a18, tailTip: 0xeae6de, gland: 0x141210, tear: 0x141210, rump: 0x3a3836, dark: 0x161412,
    ag: { back: 0.85, flank: 0.8, head: 0.6, leg: 0.1, tail: 0.3 },
  },
  urban: {
    back: 0x7e4a2e, flank: 0x96684a, lowFlank: 0x9a7a62, head: 0x9a6440, muzzleTop: 0x8a5a3a, shoulder: 0x86522f,
    white: 0xd8d2c8, belly: 0xa8a098, stocking: 0x1c1712, stockingEdge: 0x3a2a1e, earBack: 0x1e1814, earInner: 0xd6cab8,
    tail: 0x6e4630, tailUnder: 0x8e6a50, tailTip: 0xe0dad0, gland: 0x2a1c14, tear: 0x3a2618, rump: 0x9a7a62, dark: 0x2a1c14,
    ag: { back: 0.6, flank: 0.55, head: 0.15, leg: 0, tail: 0.65 },
  },
};
const KIT = 0x7a6450; // woolly sandy grey-brown natal / juvenile coat

export function palette(p) {
  const base = P3[p.variant] || P3.red;
  const k = p.coatWarmth || 0, l = p.coatLightness || 0, juv = p.juv || 0;
  const kit = srgb(KIT).map((c) => c * (p.variant === 'silver' ? 0.45 : 1));
  const out = { ag: base.ag };
  for (const [key, hex] of Object.entries(base)) {
    if (key === 'ag') continue;
    let c = srgb(hex);
    // warmth shifts red against blue; the white parts stay white
    const wk = /white|belly|earInner|tailTip/.test(key) ? 0.25 : 1;
    c = [c[0] * (1 + (0.1 * k + l) * wk), c[1] * (1 + (0.01 * k + l) * wk), c[2] * (1 - (0.12 * k - l) * wk)];
    // kits: most of the pattern is washed into the woolly juvenile coat (face, stockings, ears and the
    // tail tip stay)
    const keep = /white|earInner|tailTip/.test(key) ? 0.6 : /stocking|earBack/.test(key) ? 0.7 : /head|muzzleTop/.test(key) ? 0.45 : 0.15;
    if (juv > 0) c = mix3(c, kit, juv * (1 - keep));
    out[key] = c;
  }
  // eyelids (the eye shader's lidColor): furred in the face colour round the eye, a little darker; the
  // shader darkens their margin itself, so a blink or a closed eye reads as a furred lid with a dark
  // line (it was near black: every blink, sleep and death showed glossy black beads)
  out.lid = mix3(out.head, out.tear, 0.25).map((c) => c * 0.85);
  return out;
}

export function foxCoat(ctx) {
  const { model, rig, pos, nrm, regionOf: partOf, weights, nV, params } = ctx;
  const { BONES, AXIAL } = rig;
  const J = rig.J;
  const AX_LEN = weights.axialLengths;
  const C = palette(params);
  const AG = C.ag;
  const juv = params.juv || 0;
  const hw = params.headW || 1, mz = params.muzzle || 1;
  const ruffK = params.ruff ?? 1;
  const bibK = params.bib ?? 1; // extent of the white bib / belly
  const stockK = params.stockings ?? 1; // how far up the black stockings reach
  const tipK = params.tailTip ?? 1; // length of the white tail tip (0 = none)
  const tearK = params.tear ?? 1;
  const variant = params.variant || 'red';
  const nOff = (params.coatSeed || 0) % 997;
  const { dominant, axialS, skinIndex, skinWeight, limbMember, limbWhich } = weights;
  const P = (v) => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
  const N = (v) => [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
  const sOcc = AX_LEN[1], sNeckBase = AX_LEN[3], sTailBase = AX_LEN[8], sTip = AX_LEN[AX_LEN.length - 1];
  const tailLen = sTip - sTailBase;
  const eyePrims = model.prims.filter((p) => p.tag === 'eyesocket');
  const nosePrim = model.prims.find((p) => p.tag === 'nose');
  const caninePrims = model.prims.filter((p) => p.tag === 'canine');
  const jawPrims = model.forPart('jaw').filter((p) => p.tag !== 'canine');
  const bodyPrims = model.forPart('body');
  const headPrims = bodyPrims.filter((p) => p.bone === 'head' && !p.carve && p.tag !== 'canine');
  const earPrims = model.prims.filter((p) => p.tag === 'ear');
  const isLimb = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw|femur|tibia|metatarsus|hpaw)/.test(b.name));
  const isPaw = BONES.map((b) => /^(fpaw|hpaw)/.test(b.name));
  const isFront = BONES.map((b) => /^(scapula|humerus|radius|metacarpus|fpaw)/.test(b.name));
  // reference heights
  const yEl = J.elbowL[1], yHock = J.hockL[1], yKnee = J.kneeL[1], yBack = J.thoraxRear[1];
  const zSh = J.shoulderL[2], zHip = J.hipL[2];
  // head-local coordinates of a reference-space point (undo head width and muzzle stretch)
  const headLocal = (p) => {
    const x = (p[0] - HEAD_O[0]) / hw / HS, y = (p[1] - HEAD_O[1]) / HS;
    let z = (p[2] - HEAD_O[2]) / HS;
    if (z > MUZZLE_Z0) z = MUZZLE_Z0 + (z - MUZZLE_Z0) / mz;
    return [x, y, z];
  };

  // --- regions per vertex (0 torso, 1 neck, 2 head, 4 tail, 5 ear, 6 jaw) and limb blend
  const region = new Uint8Array(nV);
  const legness = new Float32Array(nV);
  const legBone = new Int16Array(nV).fill(-1);
  const junction = new Float32Array(nV);
  const tailT = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const bn = BONES[dominant[v]].name;
    const p = P(v);
    let lb = -1, lw = 0;
    for (let k = 0; k < 4; k++) {
      const b = skinIndex[v * 4 + k], w = skinWeight[v * 4 + k];
      if (isLimb[b] && w > lw) { lw = w; lb = b; }
    }
    legBone[v] = lb;
    const m = limbMember[v];
    legness[v] = lb >= 0 ? smoothstep(0.15, 0.85, m) : 0;
    junction[v] = lb >= 0 ? 4 * m * (1 - m) : 0;
    if (partOf[v] === 2) region[v] = 6;
    else if (bn.startsWith('ear')) region[v] = 5;
    else if (axialS[v] > sTailBase + 0.012 && bn.startsWith('tail')) { region[v] = 4; tailT[v] = clamp((axialS[v] - sTailBase) / tailLen, 0, 1); }
    else if (axialS[v] < sOcc + 0.006 || (partOf[v] === 1 && neckS(p[0], p[1], p[2]) > 0.012)) region[v] = 2;
    else if (axialS[v] < sNeckBase) region[v] = 1;
    else region[v] = 0;
    if (region[v] >= 2) { legness[v] = 0; junction[v] = 0; }
  }
  const underFactor = (v) => {
    const n = N(v), p = P(v), li = limbWhich[v];
    if (li < 0 || junction[v] <= 0) return 0;
    if (li <= 1) return junction[v] * Math.max(smoothstep(0.15, -0.55, n[2]) * smoothstep(yEl + 0.1, yEl + 0.05, p[1]), smoothstep(0.2, -0.6, n[1]));
    return junction[v] * smoothstep(0.35, -0.45, n[1] + 0.35 * Math.abs(n[2]));
  };

  // --- ventral (white underside) factor: throat, bib, belly, inner thighs
  const ventral = new Float32Array(nV);
  const yBib = yEl + 0.13 * bibK; // top of the white bib on the chest front
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let w = 0;
    if (r === 0) {
      w = smoothstep(-0.45, -0.85, n[1]);
      // chest front between the forelegs: the white bib, continuing the throat
      if (p[2] > zSh - 0.05) w = Math.max(w, smoothstep(yBib, yBib - 0.035, p[1] + 0.012 * (fbm3(p[0] * 40, p[1] * 40, p[2] * 40, 2) - 0.5)) * smoothstep(0.042, 0.018, Math.abs(p[0])) * smoothstep(-0.3, 0.35, n[2]));
      w *= smoothstep(yBack - 0.02, yBack - 0.08, p[1]);
    } else if (r === 1) {
      // throat and the front of the neck ruff
      w = smoothstep(0.4, -0.05, n[1] + 0.65 * Math.abs(n[0]) - 0.45 * Math.max(0, n[2]));
    } else if (r === 2 || r === 6) {
      const h = headLocal(p);
      w = smoothstep(-0.028, -0.05, h[1]) * smoothstep(-0.1, -0.6, n[1]) + (r === 6 ? 0.8 : 0);
    }
    const L = legness[v];
    if (L > 0) {
      const side = p[0] >= 0 ? 1 : -1;
      const inner = smoothstep(0.1, -0.6, n[0] * side);
      const wl = inner * 0.75 * smoothstep(yKnee - 0.01, yKnee + 0.05, p[1]) * (isFront[legBone[v]] ? 0.4 : 1) + smoothstep(-0.3, -0.85, n[1]) * 0.4 * smoothstep(yKnee - 0.02, yKnee + 0.04, p[1]);
      w = mix(w, wl, L);
    }
    w = Math.max(w, underFactor(v) * 0.6 * smoothstep(-0.1, -0.5, n[1]));
    ventral[v] = clamp(w, 0, 1);
  }

  // --- comb (hair flow), bind space
  const comb = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let d;
    const bone = BONES[dominant[v]];
    if (r === 5) {
      d = norm(sub(bone.tail, bone.head));
    } else if (r === 2 || r === 6) {
      const h = headLocal(p);
      // out from the nose over the face; the cheek ruff sweeps back, out and down
      const fromNose = norm(sub(h, [0, -0.01, 0.165]));
      d = norm(add(fromNose, [0, -0.2, -0.5]));
      if (h[2] < 0.01 && Math.abs(h[0]) > 0.03) d = norm(add(d, [Math.sign(h[0]) * 0.7, -0.6, -0.7]));
    } else {
      const seg = weights.segT[v * 2] | 0;
      const a = AXIAL.points[seg], b = AXIAL.points[Math.min(seg + 1, AXIAL.points.length - 1)];
      d = norm(sub(b, a));
      if (r === 0) d = norm(add(d, [0, -0.45 * Math.abs(n[0]), 0]));
      if (r === 1) d = norm(add(d, [0, -0.55, 0])); // the ruff hangs down and back
      const L = legness[v];
      if (L > 0 && legBone[v] >= 0) {
        const lbn = BONES[legBone[v]];
        let dl = norm(sub(lbn.tail, lbn.head));
        if (isPaw[legBone[v]]) dl = norm(add(dl, [0, 0, 0.4]));
        else dl = norm(add(dl, [0, -0.2, -0.3]));
        d = norm(add(mul(d, 1 - L), mul(dl, L)));
      }
    }
    let t = sub(d, mul(n, dot(d, n)));
    if (len(t) < 1e-4) t = cross(n, [1, 0, 0]);
    t = norm(t);
    comb[v * 3] = t[0]; comb[v * 3 + 1] = t[1]; comb[v * 3 + 2] = t[2];
  }

  // --- per-vertex paint
  const furLen = new Float32Array(nV);
  const tint = new Float32Array(nV * 4);
  const markSDF = new Float32Array(nV).fill(1);
  const surf = new Float32Array(nV * 4);
  const g3 = (h, c, rr) => Math.exp(-(((Math.abs(h[0]) - c[0]) / rr[0]) ** 2 + ((h[1] - c[1]) / rr[1]) ** 2 + ((h[2] - c[2]) / rr[2]) ** 2));
  // distance (head-local) from a point to the segment a-b, mirrored to the left side
  const segD = (h, a, b) => {
    const q = [Math.abs(h[0]), h[1], h[2]];
    const ab = sub(b, a), t = clamp(dot(sub(q, a), ab) / dot(ab, ab), 0, 1);
    return { d: len(sub(q, add(a, mul(ab, t)))), t };
  };
  const tailSegDorsal = (v) => {
    const bone = BONES[dominant[v]];
    const d = norm(sub(bone.tail, bone.head));
    return norm([0, -d[2], d[1]]);
  };
  const cross_ = variant === 'cross';

  for (let v = 0; v < nV; v++) {
    const p = P(v), n = N(v), r = region[v];
    let col, fl = 0.02, ag = 0, mat = MAT.FUR, mark = 1, under = 0.4;
    // low-frequency noise (ragged pattern edges) and a finer field
    const nz = fbm3(p[0] * 12 + nOff, p[1] * 12, p[2] * 12, 3) - 0.5;
    const nz2 = vnoise3(p[0] * 70 + nOff, p[1] * 70, p[2] * 70) - 0.5;
    if (r === 0 || r === 1) {
      const up = n[1];
      const vent = ventral[v];
      const dors = smoothstep(-0.1, 0.7, up + 0.3 * nz);
      col = mix3(C.lowFlank, C.flank, smoothstep(-0.4, 0.2, up + 0.25 * nz));
      col = mix3(col, C.back, dors * 0.85);
      ag = mix(AG.flank, AG.back, dors);
      if (r === 0) {
        // brighter shoulders; grizzled hips and rump in the dull coats
        const sh = Math.exp(-(((p[2] - zSh + 0.01) / 0.05) ** 2)) * smoothstep(-0.3, 0.3, n[0] * (p[0] >= 0 ? 1 : -1));
        col = mix3(col, C.shoulder, sh * 0.6);
        const rump = smoothstep(zHip + 0.02, zHip - 0.05, p[2]) * smoothstep(-0.2, -0.8, n[2]) * smoothstep(yBack + 0.02, yBack - 0.06, p[1]);
        col = mix3(col, C.rump, rump * 0.6);
        // cross morph: a dark stripe down the spine crossed by one over the shoulders
        if (cross_) {
          const spine = smoothstep(0.4, 0.8, up + 0.15 * nz) * smoothstep(zHip - 0.06, zHip + 0.02, p[2]);
          const bar = Math.exp(-(((p[2] - zSh - 0.035 + 0.02 * nz) / 0.05) ** 2)) * smoothstep(yEl + 0.02, yBack - 0.04, p[1]);
          const c = clamp(Math.max(spine, bar), 0, 1);
          col = mix3(col, C.dark, c * 0.92);
          ag = mix(ag, 0.3, c);
        }
        col = mix3(col, C.belly, vent);
        // the white bib is whiter than the belly
        const bib = smoothstep(zSh - 0.06, zSh + 0.01, p[2]) * vent;
        col = mix3(col, C.white, bib);
        ag *= 1 - vent;
        // guard-hair lengths: flanks, long over the shoulders and hips, a belly fringe
        fl = mix(0.017, 0.024, smoothstep(0.1, 0.85, up)) * (1 + 0.1 * nz2);
        fl = mix(fl, 0.014, smoothstep(0.3, 0.9, vent));
        fl = Math.max(fl, 0.022 * bib);
        if (p[2] < zHip) fl = Math.max(fl, 0.024 * rump);
      } else {
        // neck: rufous above, the white throat below, the ruff long and soft
        col = mix3(col, C.white, smoothstep(0.2, 0.65, vent + 0.15 * nz));
        ag *= 1 - smoothstep(0.2, 0.6, vent);
        fl = mix(0.026, 0.024, vent) * (0.85 + 0.15 * ruffK) * (1 + 0.1 * nz2);
        if (cross_) col = mix3(col, C.dark, smoothstep(0.6, 0.95, up) * 0.6);
      }
      const L = legness[v];
      if (L > 0) {
        const lb = legBone[v];
        const front = lb >= 0 && isFront[lb];
        const side = p[0] >= 0 ? 1 : -1;
        const outer = smoothstep(-0.2, 0.5, n[0] * side);
        // upper leg: body colour (orange thighs, white inside)
        let lc = mix3(col, C.belly, smoothstep(0.2, 0.7, ventral[v]) * (1 - outer));
        // the black stockings: forelegs from the paw up to the elbow (highest on the front), a thin
        // dark line up the front of the upper arm; hind feet up to the hock and a dark stripe up
        // the front of the shin
        let st;
        const e = 0.012 * nz;
        if (front) {
          const top = yEl + 0.01 * stockK + 0.02 * smoothstep(-0.2, 0.8, n[2]);
          st = smoothstep(top + 0.012, top - 0.012, p[1] + e);
          st = Math.max(st, 0.8 * smoothstep(0.4, 0.85, n[2]) * smoothstep(yEl + 0.075, yEl + 0.03, p[1]) * stockK);
        } else {
          const top = yHock + 0.012 + 0.03 * stockK * smoothstep(0.1, 0.8, n[2]);
          st = smoothstep(top + 0.012, top - 0.012, p[1] + e);
          // dark front of the shin (from the hock up toward the stifle)
          st = Math.max(st, 0.85 * smoothstep(0.35, 0.8, n[2]) * smoothstep(yKnee - 0.01, yHock + 0.03, p[1]) * stockK);
        }
        st = clamp(st * (variant === 'silver' ? 1 : 1), 0, 1);
        lc = mix3(lc, mix3(C.stockingEdge, C.stocking, smoothstep(0.3, 0.9, st)), st);
        let lf = mix(0.007, 0.018, smoothstep(front ? yEl - 0.06 : yHock, front ? yEl + 0.06 : yKnee + 0.04, p[1]));
        // breeches on the back of the thighs, a little feathering behind the forearm
        if (!front) lf = Math.max(lf, 0.024 * smoothstep(-0.1, -0.7, n[2]) * smoothstep(yKnee - 0.04, yKnee + 0.05, p[1]));
        else lf = Math.max(lf, 0.009 * smoothstep(-0.2, -0.8, n[2]) * smoothstep(yEl - 0.1, yEl - 0.02, p[1]));
        if (lb >= 0 && isPaw[lb]) { lf = 0.005; lc = C.stocking; }
        col = mix3(col, lc, L);
        ag = mix(ag, AG.leg * (1 - st), L);
        fl = mix(fl, lf, L);
      }
      under = 0.45;
    } else if (r === 4) {
      // the brush: rufous with black-tipped guard hair (strongest on top), a dark tail-gland spot near
      // the base, paler underside, white tip
      const t = tailT[v];
      const dors = dot(n, tailSegDorsal(v));
      const top = smoothstep(-0.45, 0.55, dors + 0.3 * nz);
      col = mix3(C.tailUnder, C.tail, top);
      ag = AG.tail * (0.55 + 0.45 * top) * smoothstep(0.02, 0.2, t);
      const gl = Math.exp(-(((t - 0.14) / 0.05) ** 2)) * smoothstep(0.2, 0.75, dors);
      col = mix3(col, C.gland, gl * 0.75);
      // a darker band before the white tip (dark-tipped hair crowding at the end)
      const tipStart = 1 - 0.17 * tipK;
      const band = Math.exp(-(((t - tipStart + 0.06) / 0.07) ** 2));
      col = mix3(col, C.dark, band * 0.35);
      const tip = tipK > 0 ? smoothstep(tipStart - 0.02, tipStart + 0.04, t + 0.035 * nz) : 0;
      col = mix3(col, C.tailTip, tip);
      ag *= 1 - tip;
      fl = mix(0.024, 0.04, smoothstep(0.0, 0.35, t)) * (1 - 0.35 * smoothstep(0.88, 1, t));
      under = 0.4;
    } else if (r === 5) {
      // ears: black backs, the black running round the rim; the inside furred white
      const earP = earPrims[p[0] > 0 ? 0 : 3];
      const faceDir = [earP.P[9], earP.P[10], earP.P[11]];
      const upE = [earP.P[6], earP.P[7], earP.P[8]];
      const lat = [earP.P[3], earP.P[4], earP.P[5]];
      const front = dot(n, faceDir);
      const rel = sub(p, [earP.P[0], earP.P[1], earP.P[2]]);
      const ht = dot(rel, upE) / 0.095; // ~0 base .. 1 tip
      const edge = Math.abs(dot(rel, lat)) / (0.022 * Math.max(0.25, 1 - ht));
      if (front > 0.25) {
        col = mix3(C.head, C.earInner, smoothstep(0.25, 0.7, front) * (1 - smoothstep(0.75, 1.05, edge)));
        fl = 0.012 * (1 - smoothstep(0.4, 1.0, ht));
      } else {
        // the back: black, orange at the very base where the head fur runs onto it
        col = mix3(C.earBack, C.head, smoothstep(0.12, -0.05, ht) * 0.9);
        fl = 0.005;
      }
      ag = 0;
    } else {
      // ---------------- head & jaw
      const h = headLocal(p);
      col = C.head;
      ag = AG.head;
      // muzzle top a little darker and duller
      const mtop = smoothstep(0.05, 0.1, h[2]) * smoothstep(-0.1, 0.5, n[1]);
      col = mix3(col, C.muzzleTop, mtop * 0.6);
      // white mask: upper lips, muzzle sides low down, cheeks (the white cheek ruff), chin, throat
      const lipSide = smoothstep(0.035, 0.065, h[2]) * smoothstep(-0.018, -0.032, h[1] - 0.06 * (h[2] - 0.1)) * smoothstep(0.1, 0.5, Math.abs(n[0]));
      const cheek = smoothstep(-0.01, -0.03, h[1] + 0.25 * (h[2] - 0.02) + 0.01 * nz) * smoothstep(0.075, 0.02, h[2]) * smoothstep(0.012, 0.03, Math.abs(h[0]));
      const lowFace = smoothstep(-0.03, -0.05, h[1]) * smoothstep(-0.1, -0.6, n[1]);
      const throat = smoothstep(-0.034, -0.055, h[1]) * smoothstep(0.08, 0.03, h[2]);
      let mask = clamp(Math.max(lipSide, cheek, lowFace, throat, r === 6 ? 0.85 : 0), 0, 1);
      col = mix3(col, C.white, mask);
      ag *= 1 - mask;
      // dark tear line: from the inner eye corner down and forward toward the upper lip
      const tl = segD(h, [0.025, 0.012, 0.05], [0.017, -0.018, 0.085]);
      const tear = Math.exp(-((tl.d / (0.0045 + 0.003 * tl.t)) ** 2)) * tearK * (1 - 0.6 * juv);
      col = mix3(col, C.tear, tear * 0.85);
      // cheek ruff: long white fluff with an orange / dark edge toward the neck
      const ruffW = smoothstep(-0.015, -0.06, h[2]) * smoothstep(0.03, 0.05, Math.abs(h[0])) * smoothstep(0.015, -0.015, h[1]);
      // fur length: sleek muzzle and face, longer crown and cheeks, flaring cheek ruff
      fl = mix(0.009, 0.0035, smoothstep(0.02, 0.1, h[2]));
      if (h[1] > 0.03 && h[2] < 0.02) fl = 0.009;
      fl = Math.max(fl, 0.024 * (0.8 + 0.2 * ruffK) * ruffW);
      if (r === 6) fl = mix(0.004, 0.012, smoothstep(0.08, 0.0, h[2]));
      // the throat under the jaw runs into the long fur of the neck ruff (no step at the region seam)
      if (r === 2) fl = mix(fl, 0.024, smoothstep(-0.05, -0.075, h[1]) * smoothstep(0.06, 0.0, h[2]));
      // back of the head blends into the neck
      if (r === 2 && h[2] < -0.07) {
        const b = smoothstep(-0.07, -0.11, h[2]);
        fl = mix(fl, 0.02, b);
      }
      // eye rims (black lid margins)
      for (const e of eyePrims) {
        const de = SDFModel.dist(e, p[0], p[1], p[2]);
        if (Math.abs(de) < 0.0032) mark = Math.min(mark, Math.abs(de) - 0.0013);
        if (Math.abs(de) < 0.0011) { mat = MAT.DARK_SKIN; fl = 0; }
        else if (Math.abs(de) < 0.0032) fl = Math.min(fl, 0.001);
      }
      // nose leather
      const dn = SDFModel.dist(nosePrim, p[0], p[1], p[2]);
      if (dn < 0.0015 && h[2] > 0.138) { mat = MAT.NOSE; col = srgb(0x1a1616); fl = 0; }
      else if (dn < 0.0035 && h[2] > 0.13) { mark = Math.min(mark, dn - 0.0022); fl = Math.min(fl, 0.0015); }
      // lips: head vertices near the jaw surface, jaw vertices near the head surface (black lip line)
      // (the lip line ends at the mouth corner, z ~0.025: behind it the cheek's jowl wraps the jaw's side and
      // the line along their seam ran back under the cheek fur as a dark crease. Skin facing out (the jowl's
      // side and underside, the jaw's outer side) is never the mouth's lining: it shows when the mouth opens,
      // and painted as the lining it drew a dark pocket behind the mouth corner; buried in the other surface it
      // keeps fur only as long as it stays inside it)
      const lipZ = smoothstep(0.012, 0.03, h[2]);
      const nOut = n[0] * Math.sign(h[0] || 1);
      if (partOf[v] !== 2) {
        const dj = SDFModel.evalList(jawPrims, p[0], p[1], p[2]);
        const lining = h[2] > 0.025 ? nOut < 0.55 || n[1] > 0.3 : nOut < 0.2 && n[1] > -0.5;
        if (dj < -0.0004 && lining) { mat = MAT.MOUTH; col = srgb(0x6e3438); fl = 0; }
        else if (dj < -0.0004) fl = Math.min(fl, Math.max(0, -dj - 0.0015));
        else if (dj < 0.006) { mark = Math.min(mark, mix(1, dj - 0.0018, lipZ)); fl = Math.min(fl, mix(fl, mix(0, 0.003, smoothstep(0.002, 0.006, dj)), lipZ)); }
      } else {
        const dh = SDFModel.evalList(headPrims, p[0], p[1], p[2]);
        const lining = nOut < 0.45 || n[1] > 0.35;
        if (dh < 0.0 && lining) { mat = MAT.MOUTH; col = srgb(0x6e3438); fl = 0; }
        else if (dh < 0.0) fl = Math.min(fl, Math.max(0, -dh - 0.0015));
        else if (dh < 0.005) { mark = Math.min(mark, mix(1, dh - 0.0015, lipZ)); fl = Math.min(fl, mix(fl, mix(0, 0.003, smoothstep(0.0015, 0.005, dh)), lipZ)); }
      }
      // teeth
      for (const c of caninePrims) if (SDFModel.dist(c, p[0], p[1], p[2]) < 0.0008) { mat = MAT.KERATIN; col = srgb(0xe8e0cc); fl = 0; mark = 1; }
      under = 0.3;
    }
    // kits: woolly and uniform
    if (juv > 0 && mat === MAT.FUR) {
      fl = mix(fl, Math.max(fl * 0.8, r === 2 || r === 6 ? 0.008 : 0.016), juv);
      ag *= 1 - 0.8 * juv;
    }
    // low-frequency colour variation
    const cvh = fbm3(p[0] * 6 + 5 + nOff, p[1] * 6, p[2] * 6, 2) - 0.5;
    if (mat === MAT.FUR) col = [col[0] * (1 + 0.14 * nz + 0.1 * cvh + 0.06 * nz2), col[1] * (1 + 0.12 * nz + 0.06 * nz2), col[2] * (1 + 0.1 * nz - 0.08 * cvh + 0.06 * nz2)];
    markSDF[v] = mark;
    furLen[v] = fl;
    tint[v * 4] = col[0]; tint[v * 4 + 1] = col[1]; tint[v * 4 + 2] = col[2]; tint[v * 4 + 3] = mat;
    surf[v * 4 + 2] = mat === MAT.FUR ? clamp(ag * (0.85 + 0.3 * nz2), 0, 1) : 0;
    surf[v * 4 + 3] = mat === MAT.FUR ? under : 0;
    if (mat === MAT.KERATIN) surf[v * 4] = 0.7;
    if (mat === MAT.NOSE) surf[v * 4] = 0.55;
  }

  // smooth fur length so the shells do not step (bare skin stays locked)
  smoothField(furLen, weights.neighbors, 3, (v) => tint[v * 4 + 3] > 0);

  void rng;
  const pattern = new Float32Array(nV).fill(1);
  const patternColor = new Float32Array(nV * 4);
  return { comb, tint, pattern, mark: markSDF, furLen, patternColor, surf, region, ventral, tailT };
}
