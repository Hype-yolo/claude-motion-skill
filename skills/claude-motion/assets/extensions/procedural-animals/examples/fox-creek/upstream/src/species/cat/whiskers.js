// Whiskers: the mystacial vibrissae as real geometry (species.surfaces, appended to the base mesh).
//
// 12 per side in 4 rows on the whisker pad, 45-75 mm long (the longest about the width of the body),
// fanning out sideways and a little forward and down, each a tapered keratin strand (0.17 mm at the
// root, 0.03 mm at the tip) curving gently down and forward. They ride on their own bone per side
// (whiskerL / whiskerR, children of the head), so the behaviour hook can fan them forward (hunting,
// curious) or sweep them back (eating, angry, asleep) and lift them clear of the ground. White in most
// coats, dark in black cats. Not built for the crowd tier.
import { hl } from './rig.js';
import { projectToSurface, MAT, srgb } from '../../core/build/coatKit.js';
import { norm, add, mul, cross, sub } from '../../core/math/vec.js';

export const WHISKER_BASE = [0.0105, -0.0265, 0.0325]; // head-local joint at the middle of the pad (left)
export const WHISKER_TIP = [0.06, -0.034, 0.046];

// rows (top -> bottom) x columns (back -> front) on the pad, head-local (left side)
function follicles() {
  const out = [];
  const rows = [
    { y: -0.0215, len: 0.074, down: 0.05 },
    { y: -0.0245, len: 0.068, down: 0.12 },
    { y: -0.0275, len: 0.06, down: 0.2 },
    { y: -0.0305, len: 0.048, down: 0.28 },
  ];
  rows.forEach((r, i) => {
    for (let j = 0; j < 3; j++) {
      const z = 0.0265 + j * 0.0042 + i * 0.0006;
      out.push({ p: [0.0125 - j * 0.0012 + i * 0.0006, r.y, z], len: r.len * (0.92 + 0.06 * j), down: r.down, fwd: -0.05 + 0.13 * j, row: i, col: j });
    }
  });
  return out;
}

// head-local sample points of the left fan (middles and tips of every whisker, and the bone's tip joint)
// for the ground clearance in the behaviour hook
export function whiskerSamples() {
  const out = [WHISKER_TIP];
  for (const f of follicles()) {
    const d0 = norm([0.86, -f.down * 0.6, 0.42 + f.fwd]);
    const bow = norm([0.1, -0.55, 0.35]);
    for (const t of [0.5, 1]) out.push(add(add(f.p, mul(d0, f.len * t)), mul(bow, f.len * 0.16 * t * t)));
  }
  return out;
}

export function catWhiskers({ rig, params, Q, model }) {
  if (!Q || Q.shells <= 0) return null;
  const headPrims = model.prims.filter((p) => p.bone === 'head' && !p.carve && p.part === 'body' && p.tag !== 'nictitans');
  const dark = params.variant === 'black';
  const col = dark ? srgb(0x242020) : srgb(0xe8e4dc);
  const SEG = Q.res <= 1.35 ? 7 : 4, SIDES = 3;
  const pos = [], nrm = [], idx = [], comb = [], skinIndex = [];
  const F = follicles();
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const bi = rig.BONE['whisker' + S].index;
    for (const f of F) {
      const root = projectToSurface(headPrims, hl([f.p[0] * s, f.p[1], f.p[2]]));
      // direction: out to the side, a little forward and down; the strand bows down and forward
      const d0 = norm([0.86 * s, -f.down * 0.6, 0.42 + f.fwd]);
      const bow = norm([0.1 * s, -0.55, 0.35]);
      const L = f.len * (params.whisker || 1);
      const pts = [], tans = [];
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG;
        pts.push(add(add(root, mul(d0, L * t)), mul(bow, L * 0.16 * t * t)));
        tans.push(norm(add(d0, mul(bow, 0.32 * t))));
      }
      const v0 = pos.length / 3;
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG, T = tans[k];
        const r = 0.00017 * (1 - t) + 0.00003 * t;
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
    pattern: new Float32Array(nV).fill(1), mark: new Float32Array(nV).fill(1), furLen: new Float32Array(nV),
    patternColor, surf,
  };
}
void sub;
