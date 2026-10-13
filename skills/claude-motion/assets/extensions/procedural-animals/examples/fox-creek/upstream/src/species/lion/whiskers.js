// Whiskers: the mystacial vibrissae as real geometry (species.surfaces, appended to the base mesh), after
// the cat's (src/species/cat/whiskers.js).
//
// The whisker pads carry four slightly curved rows of black follicle dots (face_female1: 0.93-1.19 E below
// the eye line, from beside the nose out to ~0.45 E; the coat paints them from whiskerFollicles()); the
// bigger follicles of the three upper rows carry the whiskers: white keratin strands 7-14 cm long
// (the upper rows longest), 0.4 mm at the root tapering to 0.07 mm, fanning out sideways, a little
// forward and down and curving down. They ride on a bone per side (whiskerL / whiskerR, children of the
// head), so the behaviour hook can sweep the fan back and lift it clear of the ground when the head lies
// on it. Not built for the crowd tier.
import { HEAD_O, HS, FACE } from './rig.js';
import { MAT, srgb } from '../../core/build/coatKit.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { norm, add, mul, cross, rng } from '../../core/math/vec.js';

// the bone of each fan (left): from the middle of the pad out to the side (face units)
export const WHISKER_BASE_F = [0.34, -1.11, 0.78];
export const WHISKER_TIP_F = [1.3, -1.25, 1.15];

// face units -> reference metres (hw: head width factor, rig.js FACE)
const faceToRef = (X, Y, Z, hw) => [HEAD_O[0] + X * FACE.X * hw * HS, HEAD_O[1] + (FACE.EY + Y * FACE.E) * HS, HEAD_O[2] + (FACE.EZ + Z * FACE.E) * HS];

// follicles (both sides, jittered per individual): { s, row, i, X, Y } in face units (X >= 0 for the left)
export function whiskerFollicles(coatSeed = 0) {
  const RD = rng(517 + coatSeed);
  const out = [];
  for (const s of [1, -1]) {
    for (let row = 0; row < 4; row++) {
      const nDots = [4, 5, 6, 5][row];
      for (let i = 0; i < nDots; i++) {
        const X = 0.12 + 0.022 * row + 0.058 * i + 0.012 * (RD() - 0.5);
        const Y = -0.98 - 0.086 * row - 0.1 * (X - 0.13) + 0.012 * (RD() - 0.5);
        out.push({ s, row, i, X, Y, r: 0.0019 + 0.0006 * RD() });
      }
    }
  }
  return out;
}

// the follicle's point on the pad (march in along -Z from in front of the face onto the head surface)
export function follicleRoot(headPrims, f, hw) {
  let Z = 1.4;
  for (let k = 0; k < 300 && SDFModel.evalList(headPrims, ...faceToRef(f.X * f.s, f.Y, Z, hw)) > 0; k++) Z -= 0.005;
  return faceToRef(f.X * f.s, f.Y, Z, hw);
}

// the strand of one follicle (reference space): root, a direction and a length
function strandOf(f, root, lenK) {
  const s = f.s;
  const d0 = norm([0.86 * s, -0.08 - 0.13 * f.row, 0.42 + 0.06 * f.i]);
  const bow = norm([0.1 * s, -0.6, 0.3]);
  const L = (0.14 - 0.022 * f.row - 0.006 * Math.abs(f.i - 2)) * lenK;
  return { root, d0, bow, L };
}

// sample points of the left fan in reference space (mid-points and tips of the strands) for the ground
// clearance in the behaviour hook, with the head width of a lioness (the hook scales them to the bone)
export function whiskerSamples(params = {}) {
  const hw = 1.12 + 0.02 * (params.sex === 'male' && !params.juv ? 1 : 0) - 0.04 * (params.juv || 0);
  const out = [];
  for (const f of whiskerFollicles(params.coatSeed || 0)) {
    if (f.s < 0 || f.row > 2) continue;
    // (the root on the pad lies between Z 0.9 and 1.1 E: both bracket it, so the samples cover the strand)
    for (const Z of [0.9, 1.1]) {
      const root = faceToRef(f.X, f.Y, Z, hw);
      const st = strandOf(f, root, 1);
      // (from near the root to the tip: with the pad on the ground the parts near the roots dip first)
      for (const t of [0.15, 0.35, 0.6, 1]) out.push(add(add(root, mul(st.d0, st.L * t)), mul(st.bow, st.L * 0.14 * t * t)));
    }
  }
  return out;
}

export function lionWhiskers({ rig, params, Q, model }) {
  if (!Q || Q.shells <= 0) return null;
  const juv = params.juv || 0, male = params.sex === 'male' && !juv ? 1 : 0;
  const hw = 1.12 + 0.02 * male - 0.04 * juv;
  const headPrims = model.prims.filter((p) => p.bone === 'head' && !p.carve && p.part === 'body' && p.tag !== 'mane' && p.tag !== 'canine');
  const col = params.variant === 'white' ? srgb(0xf4f0e8) : srgb(0xece8e0);
  const SEG = Q.res <= 1.35 ? 7 : 4, SIDES = 3;
  const lenK = juv ? 0.7 : 1;
  const pos = [], nrm = [], idx = [], comb = [], skinIndex = [];
  for (const f of whiskerFollicles(params.coatSeed || 0)) {
    if (f.row > 2) continue; // (the lowest row: short bristles, painted dots only)
    const bi = rig.BONE[f.s > 0 ? 'whiskerL' : 'whiskerR'].index;
    const st = strandOf(f, follicleRoot(headPrims, f, hw), lenK);
    const pts = [], tans = [];
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      pts.push(add(add(st.root, mul(st.d0, st.L * t)), mul(st.bow, st.L * 0.14 * t * t)));
      tans.push(norm(add(st.d0, mul(st.bow, 0.28 * t))));
    }
    const v0 = pos.length / 3;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, T = tans[k];
      const r = 0.0004 * (1 - t) + 0.00007 * t;
      let a = cross(T, [0, 1, 0]);
      if (Math.hypot(...a) < 1e-4) a = cross(T, [1, 0, 0]);
      a = norm(a);
      const b = cross(T, a);
      for (let q = 0; q < SIDES; q++) {
        const ang = (q / SIDES) * Math.PI * 2;
        const n = add(mul(a, Math.cos(ang)), mul(b, Math.sin(ang)));
        pos.push(...add(pts[k], mul(n, r)));
        nrm.push(...n);
        comb.push(...T);
        skinIndex.push(bi, 0, 0, 0);
      }
    }
    for (let k = 0; k < SEG; k++) {
      for (let q = 0; q < SIDES; q++) {
        const a = v0 + k * SIDES + q, b = v0 + k * SIDES + ((q + 1) % SIDES);
        const c = a + SIDES, d = b + SIDES;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const nV = pos.length / 3;
  const tint = new Float32Array(nV * 4), surf = new Float32Array(nV * 4), patternColor = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) {
    tint.set([col[0], col[1], col[2], MAT.KERATIN], v * 4);
    surf.set([0.75, 0, 0, 0], v * 4);
  }
  const skinWeight = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) skinWeight[v * 4] = 1;
  return {
    nV, pos: new Float32Array(pos), nrm: new Float32Array(nrm), index: new Uint32Array(idx),
    skinIndex: new Uint16Array(skinIndex), skinWeight, comb: new Float32Array(comb), tint,
    pattern: new Float32Array(nV).fill(0.05), mark: new Float32Array(nV).fill(0.03), furLen: new Float32Array(nV),
    patternColor, surf,
  };
}
