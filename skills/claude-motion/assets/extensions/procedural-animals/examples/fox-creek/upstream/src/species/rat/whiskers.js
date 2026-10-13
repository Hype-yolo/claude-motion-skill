// Whiskers: the mystacial vibrissae as real geometry (species.surfaces, appended to the base mesh),
// after the cat's whiskers.js.
//
// A brown rat carries ~30-35 macrovibrissae per side in 5 rows on the whisker pad; the longest
// (caudal arcs) reach 50-60 mm, the rostral ones ~10-15 mm. Here 22 per side (5 rows x 4-5 arcs,
// the rostral arcs shorter). They fan out sideways and forward, nearly horizontal, each a tapered
// keratin strand (0.12 mm at the root, 0.02 mm at the tip) that bows back and down. They ride on
// their own bone per side (whiskerL / whiskerR, children of the head): the behaviour hook whisks
// them forward and back at 7-10 Hz while exploring (protraction / retraction of the whole pad) and
// lifts them clear of the ground. Mixed dark and white strands in agouti rats, white in albino and
// hooded rats. Not built for the crowd tier.
import { hl } from './rig.js';
import { projectToSurface, MAT, srgb } from '../../core/build/coatKit.js';
import { norm, add, mul, cross } from '../../core/math/vec.js';

export const WHISKER_BASE = [0.0055, -0.0125, 0.0155]; // head-local joint at the middle of the pad (left)
export const WHISKER_TIP = [0.045, -0.013, 0.03];

// rows (dorsal -> ventral) x arcs (caudal -> rostral) on the pad, head-local (left side)
function follicles() {
  const out = [];
  const rows = [
    { y: -0.0092, len: 0.046, down: -0.06, n: 4 },
    { y: -0.0112, len: 0.055, down: 0.0, n: 5 },
    { y: -0.0132, len: 0.056, down: 0.06, n: 5 },
    { y: -0.0152, len: 0.05, down: 0.13, n: 4 },
    { y: -0.017, len: 0.038, down: 0.2, n: 4 },
  ];
  rows.forEach((r, i) => {
    for (let j = 0; j < r.n; j++) {
      const z = 0.0105 + j * 0.0024 + i * 0.0006; // caudal -> rostral
      const w = 0.0068 - j * 0.0007 - Math.abs(i - 2) * 0.0005; // the pad narrows toward the nose
      out.push({ p: [w, r.y, z], len: r.len * (1 - 0.17 * j), down: r.down, fwd: -0.15 + 0.16 * j, row: i, col: j });
    }
  });
  return out;
}

const dirOf = (f, s) => norm([0.8 * s, -f.down * 0.7, 0.55 + f.fwd]);
const BOW = (s) => norm([0.25 * s, -0.35, -0.9]); // the strand bows back and a little down

// head-local sample points of the left fan (middles and tips) for the ground clearance
export function whiskerSamples() {
  const out = [WHISKER_TIP];
  for (const f of follicles()) {
    const d0 = dirOf(f, 1), bow = BOW(1);
    for (const t of [0.5, 1]) out.push(add(add(f.p, mul(d0, f.len * t)), mul(bow, f.len * 0.14 * t * t)));
  }
  return out;
}

export function ratWhiskers({ rig, params, Q, model }) {
  if (!Q || Q.shells <= 0) return null;
  const headPrims = model.prims.filter((p) => (p.bone === 'head' || p.bone === 'snout') && !p.carve && p.part === 'body');
  const white = params.colour === 'albino' || params.colour === 'hooded';
  const cDark = srgb(0x2a2420), cLight = srgb(0xe6e0d6);
  const SEG = Q.res <= 1.35 ? 6 : 4, SIDES = 3;
  const pos = [], nrm = [], idx = [], comb = [], skinIndex = [], cols = [];
  const F = follicles();
  let hash = (params.coatSeed || 1) >>> 0;
  const rnd = () => { hash = (Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return hash / 4294967296; };
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const bi = rig.BONE['whisker' + S].index;
    for (const f of F) {
      const root = projectToSurface(headPrims, hl([f.p[0] * s, f.p[1], f.p[2]]));
      const d0 = dirOf(f, s), bow = BOW(s);
      const L = f.len * (params.whisker || 1) * (0.92 + 0.16 * rnd());
      // agouti: mixed dark and pale strands (the long caudal ones mostly dark)
      const col = white ? cLight : (rnd() < (f.col < 2 ? 0.7 : 0.45) ? cDark : cLight);
      const pts = [], tans = [];
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG;
        pts.push(add(add(root, mul(d0, L * t)), mul(bow, L * 0.14 * t * t)));
        tans.push(norm(add(d0, mul(bow, 0.28 * t))));
      }
      const v0 = pos.length / 3;
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG, T = tans[k];
        const r = 0.00012 * (1 - t) + 0.00002 * t;
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
          cols.push(col);
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
    const c = cols[v];
    tint.set([c[0], c[1], c[2], MAT.KERATIN], v * 4);
    surf.set([0.7, 0, 0, 0], v * 4);
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
