// Claws: real geometry (species.surfaces, appended to the base mesh), rigidly skinned to the paw bones.
//
// A brown bear's fore claws are 5-6 cm straight / 7-10 cm along the curve (x1.15 in the grizzly, x0.65 in the
// black bear), the hind claws ~4 cm [NOTES 1]: thick horn at the base, laterally compressed (taller than wide),
// tapering to a blunt point, curving down from the toe so they lie close along the ground in front of the toes
// (side1, side3, tq2, detail_bipedal); dark horn with paler tips (in grizzlies paler horn, still darker at the base).
// (As SDF cones in the body mesh, at its 7.8-15.6 mm cells, they were faceted spikes 0.6-0.9 cm thick sticking
// straight out 5-6 cm ahead of the toes at toe height, with the mouth's pink interpolated round their bases where
// the material id switched from fur to keratin.)
// Each claw is a closed tube along a circular arc in the paw's sagittal plane: an elliptical cross-section
// (height 1.5 x width at the base) that tapers to an apex, its root buried in the toe.
import { srgb, MAT } from '../../core/build/coatKit.js';
import { add, mul, norm, cross } from '../../core/math/vec.js';
import { TOE_F, TOE_H } from './sculpt.js';
import { clawColour } from './coat.js';

// digits I..V of the left paw (x from the midline out: I is medial), toe sphere offsets as in sculpt.js
const FORE = { x: [-0.056, -0.028, 0.0, 0.028, 0.056], z: [-0.02, -0.004, 0.002, -0.004, -0.02], y: 0.024, len: [0.78, 0.94, 1, 0.97, 0.84] };
const HIND = { x: [-0.048, -0.024, 0.0, 0.024, 0.048], z: [-0.018, -0.004, 0.002, -0.004, -0.016], y: 0.022, len: [0.8, 0.95, 1, 0.97, 0.85] };

// the claw's centre line: pitch below horizontal from th0 at the root to th1 at the tip, along an arc of length L;
// th1 is chosen so the tip ends `drop` below the root (clamped to 75 deg: short black-bear claws hook more steeply)
function arcFor(L, drop, th0) {
  const dropOf = (th1) => (Math.abs(th1 - th0) < 1e-4 ? L * Math.sin(th0) : (L * (Math.cos(th0) - Math.cos(th1))) / (th1 - th0));
  let lo = th0, hi = (75 * Math.PI) / 180;
  if (dropOf(hi) < drop) return hi;
  if (dropOf(lo) > drop) return lo;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (dropOf(m) < drop) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export function clawSpecs(rig, params = {}) {
  const J = rig.J, k = params.claw ?? 1;
  const out = [];
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    for (const fore of [true, false]) {
      const D = fore ? FORE : HIND;
      const T = fore ? J['ftoe' + S] : J['htoe' + S];
      const back = fore ? TOE_F : TOE_H;
      for (let i = 0; i < 5; i++) {
        const tp = [T[0] + D.x[i] * s, D.y, T[2] - back - 0.012 + D.z[i]];
        // root inside the toe, at its front, at the toe's mid height (the toe's hair is 8 mm: the claw shows from there on)
        // (rooted at the top of the toe the claws dropped ~3 cm to the ground and hung from the toes like talons)
        const root = add(tp, [D.x[i] * s * 0.08, 0.001, fore ? 0.012 : 0.01]);
        // fore middle claw 5.8 cm along the curve (~4.2 cm of it outside the toe), hind 2.6 cm (~1.4 cm showing: the hind
        // claws are much shorter, mostly hidden in the toe hair)
        const L = (fore ? 0.058 : 0.026) * k * D.len[i];
        // the tip 5 mm above the ground (standing), at most: in the stance the claws lie along the ground
        const th0 = ((fore ? 3 : 10) * Math.PI) / 180;
        const th1 = arcFor(L, root[1] - (fore ? 0.006 : 0.008), th0);
        // splay: the outer claws turn a little outward with their toes
        const yaw = D.x[i] * s * 2.4;
        // (the width grows nearly with the length: at sqrt(claw) the grizzly's long claws read as thin needles)
        const kk = k ** 0.75;
        out.push({
          bone: (fore ? 'fpaw' : 'hpaw') + S, root, L, th0, th1, yaw,
          // (thick at the base: at 1.05 cm wide the fore claws of a lifted paw read as thin spikes in the live page)
          h0: (fore ? 0.0175 : 0.0125) * kk * (0.85 + 0.15 * D.len[i]), w0: (fore ? 0.012 : 0.009) * kk * (0.85 + 0.15 * D.len[i]),
        });
      }
    }
  }
  return out;
}

// centre-line point, tangent and arc normal (toward the claw's dorsal side) at t in [0, 1]
function frameAt(c, t) {
  const n = 16;
  let x = 0, y = 0;
  const thAt = (u) => c.th0 + (c.th1 - c.th0) * u;
  for (let i = 0; i < n; i++) { const u = ((i + 0.5) / n) * t; x += Math.cos(thAt(u)) * (c.L * t) / n; y -= Math.sin(thAt(u)) * (c.L * t) / n; }
  const th = thAt(t);
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  const fwd = [sy, 0, cy];
  const P = add(c.root, add(mul(fwd, x), [0, y, 0]));
  const Tn = norm(add(mul(fwd, Math.cos(th)), [0, -Math.sin(th), 0]));
  const Up = norm(add(mul(fwd, Math.sin(th)), [0, Math.cos(th), 0]));
  return { P, T: Tn, U: Up, X: norm(cross(Up, Tn)) };
}

export function bearClaws({ rig, params, Q }) {
  if (!Q || Q.shells <= 0) return null;
  const SEG = Q.res <= 1.05 ? 8 : Q.res <= 1.5 ? 7 : 4;
  const SIDES = Q.res <= 1.05 ? 8 : Q.res <= 1.5 ? 7 : Q.res <= 2.5 ? 6 : 5;
  const { base, tip } = clawColour(params);
  const pos = [], nrm = [], idx = [], comb = [], skinIndex = [], tint = [];
  for (const c of clawSpecs(rig, params)) {
    const bi = rig.BONE[c.bone].index;
    const v0 = pos.length / 3;
    const push = (p, n, T, t) => {
      pos.push(...p); nrm.push(...n); comb.push(...T); skinIndex.push(bi, 0, 0, 0);
      // dark horn at the base, paler toward the tip (worn keratin; the tip's last third turns down out of the sun, so the
      // paler horn starts a third of the way out)
      const w = Math.min(1, Math.max(0, (t - 0.3) / 0.7)) ** 1.2;
      tint.push(base[0] + (tip[0] - base[0]) * w, base[1] + (tip[1] - base[1]) * w, base[2] + (tip[2] - base[2]) * w, MAT.KERATIN);
    };
    // root cap centre (buried in the toe)
    const f0 = frameAt(c, 0);
    push(f0.P, mul(f0.T, -1), f0.X, 0);
    for (let k = 0; k < SEG; k++) {
      // rings closer together toward the tip, where the claw turns and narrows
      const t = 1 - (1 - k / SEG) ** 1.25;
      const f = frameAt(c, t);
      // the section tapers to a blunt point (height 1.8 mm, width 1.4 mm, at the last ring)
      const taper = (1 - t) ** 0.6;
      const a = Math.max(0.0007, c.w0 * 0.5 * taper), b = Math.max(0.0009, c.h0 * 0.5 * taper);
      for (let q = 0; q < SIDES; q++) {
        const ang = (q / SIDES) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        // (the dorsal edge rounder, the sole a little flatter: the centre sits slightly below the section's middle)
        const p = add(f.P, add(mul(f.X, a * ca), mul(f.U, b * sa - (sa < 0 ? 0.1 * b * sa : 0))));
        const n = norm(add(mul(f.X, ca / a), mul(f.U, sa / b)));
        // the comb runs round the claw, not along it: the keratin's anisotropic lobe (a sheen wherever the half vector
        // is square to the comb) then lies in one thin line instead of silvering the claw's whole lit side
        push(p, n, norm(add(mul(f.X, -a * sa), mul(f.U, b * ca))), t);
      }
    }
    const f1 = frameAt(c, 1);
    push(f1.P, f1.T, f1.X, 1);
    const ring = (k) => v0 + 1 + k * SIDES;
    for (let q = 0; q < SIDES; q++) { const q1 = (q + 1) % SIDES; idx.push(v0, ring(0) + q1, ring(0) + q); }
    for (let k = 0; k < SEG - 1; k++) {
      for (let q = 0; q < SIDES; q++) {
        const q1 = (q + 1) % SIDES;
        const a0 = ring(k) + q, b0 = ring(k) + q1, a1 = ring(k + 1) + q, b1 = ring(k + 1) + q1;
        idx.push(a0, b0, a1, b0, b1, a1);
      }
    }
    const apex = pos.length / 3 - 1, last = ring(SEG - 1);
    for (let q = 0; q < SIDES; q++) { const q1 = (q + 1) % SIDES; idx.push(last + q, last + q1, apex); }
  }
  const nV = pos.length / 3;
  const surf = new Float32Array(nV * 4);
  // matte horn (the keratin's roughest, 0.55): at 0.6 (the default) the tips flashed white in the sun, at 0.35 the
  // anisotropic sheen ran along each claw as a silver stripe and the sky's reflection silvered their sides
  for (let v = 0; v < nV; v++) surf[v * 4] = 0.001;
  const skinWeight = new Float32Array(nV * 4);
  for (let v = 0; v < nV; v++) skinWeight[v * 4] = 1;
  return {
    nV, pos: new Float32Array(pos), nrm: new Float32Array(nrm), index: new Uint32Array(idx),
    skinIndex: new Uint16Array(skinIndex), skinWeight, comb: new Float32Array(comb), tint: new Float32Array(tint),
    pattern: new Float32Array(nV).fill(1), mark: new Float32Array(nV).fill(1), furLen: new Float32Array(nV),
    patternColor: new Float32Array(nV * 4), surf,
  };
}
void srgb;
