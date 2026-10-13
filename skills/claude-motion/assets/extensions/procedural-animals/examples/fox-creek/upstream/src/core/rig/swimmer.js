// Standard swimmer skeleton (fish, sharks: the names the swimmer motion engine expects) and helpers
// for sculpting fins as thin membranes.
//
// Axial chain (snout -> caudal fin tip; drives the body wave, and the median fins ride on it):
//   joints  snout, spine0 (head-trunk joint, behind the skull), spine1 .. spine{N} (spine{N} = caudal
//           base / hypural plate = caudal0), caudal1 .. caudal{M} (along the caudal fin; for a shark's
//           heterocercal tail they climb into the upper lobe)
//   bones   head (spine0 -> snout), spine0 .. spine{N-1}, caudal0 .. caudal{M-1}
// Head:    jaw (jawHinge -> jawTip, lower jaw, rigid part), upperJaw (premaxBase -> premaxTip, optional:
//          protrusion for suction feeding / shark bites), operculum{S} (opHinge -> opEdge, optional;
//          auxiliary joint opLow{S} gives the hinge axis with opHinge)
// Paired fins (appendages): pectoral{S} (pecBase -> pecTip, auxiliary pecUp{S}: a second point on the
//          fin base line = the fold axis), pelvic{S} (pelBase -> pelTip, auxiliary pelFront{S})
// Dorsal, anal and adipose fins are skinned to the spine (they follow the body wave); the caudal fin
// to the caudal bones.
//
// Everything is measured from the joints, so any fish (or shark) shape works: the engine reads the
// rest geometry of the chain (segment lengths and pitch, e.g. an up-turned heterocercal tail).
import { add, sub, mul, norm, cross, dot, lerp, len } from '../math/vec.js';

export const spineName = (i) => 'spine' + i;
export const caudalName = (i) => 'caudal' + i;

/** Joint list of the axial chain, snout -> caudal tip. */
export function axialJoints(spineSegs, caudalSegs) {
  const pts = ['snout'];
  for (let i = 0; i <= spineSegs; i++) pts.push(spineName(i));
  for (let i = 1; i <= caudalSegs; i++) pts.push(caudalName(i));
  return pts;
}
/** Bone list of the axial chain, matching axialJoints (head first). */
export function axialBones(spineSegs, caudalSegs) {
  const b = ['head'];
  for (let i = 0; i < spineSegs; i++) b.push(spineName(i));
  for (let i = 0; i < caudalSegs; i++) b.push(caudalName(i));
  return b;
}

/**
 * Standard swimmer bones for buildRig.
 * @param o { spineSegs, caudalSegs, jaw, upperJaw, opercula, pectoral, pelvic,
 *            pectoralParent, pelvicParent (spine bone names), extra }
 * The caudal chain's joint 0 is spine{N}: J.caudal0 must equal J['spine' + N] (swimmerJointsAlias does it).
 */
export function swimmerBones({ spineSegs = 12, caudalSegs = 3, jaw = true, upperJaw = false, opercula = true, pectoral = true, pelvic = true, pectoralParent = 'spine0', pelvicParent = 'spine4', extra = [] } = {}) {
  const b = [];
  b.push([spineName(0), spineName(0), spineName(1), null, { region: 'torso' }]);
  b.push(['head', spineName(0), 'snout', spineName(0), { region: 'head' }]);
  for (let i = 1; i < spineSegs; i++) b.push([spineName(i), spineName(i), spineName(i + 1), spineName(i - 1), { region: 'torso' }]);
  for (let i = 0; i < caudalSegs; i++) b.push([caudalName(i), caudalName(i), caudalName(i + 1), i === 0 ? spineName(spineSegs - 1) : caudalName(i - 1), { region: 'tail' }]);
  if (jaw) b.push(['jaw', 'jawHinge', 'jawTip', 'head', { region: 'jaw', group: 'jaw' }]);
  if (upperJaw) b.push(['upperJaw', 'premaxBase', 'premaxTip', 'head', { region: 'head', group: 'upperJaw' }]);
  if (opercula) b.push(['operculum{S}', 'opHinge{S}', 'opEdge{S}', 'head', { region: 'head', group: 'operculum{S}' }]);
  if (pectoral) b.push(['pectoral{S}', 'pecBase{S}', 'pecTip{S}', pectoralParent, { region: 'fin', group: 'pectoral{S}' }]);
  if (pelvic) b.push(['pelvic{S}', 'pelBase{S}', 'pelTip{S}', pelvicParent, { region: 'fin', group: 'pelvic{S}' }]);
  return b.concat(extra);
}

/** Appendage list (skin blended by SDF distance) for the optional head and paired-fin bones. */
export function swimmerAppendages({ upperJaw = false, opercula = true, pectoral = true, pelvic = true, blend = [-0.003, 0.005] } = {}) {
  const a = [];
  const add2 = (g) => { for (const S of ['L', 'R']) a.push({ group: g + S, bone: g + S, blend }); };
  if (opercula) add2('operculum');
  if (pectoral) add2('pectoral');
  if (pelvic) add2('pelvic');
  if (upperJaw) a.push({ group: 'upperJaw', bone: 'upperJaw', blend });
  return a;
}

/** The caudal chain starts at the last spine joint. */
export function swimmerJointsAlias(J, spineSegs) {
  J.caudal0 = J[spineName(spineSegs)].slice();
  return J;
}

// ------------------------------------------------------------------------------------------------
// Fins as membranes: an outline polygon in the fin's plane, extruded to a thin slab (SDF T_FIN).
// A fin is described by its rays: each ray runs from a point on the base line to a tip. The outline
// is base0 (sunk into the body) -> ray tips (with optional notches between spiny rays) -> baseN (sunk).
// The prim keeps the ray layout so the coat can paint the rays (phase between rays, fraction along).
// ------------------------------------------------------------------------------------------------

/**
 * @param m SDFModel
 * @param o { origin [x,y,z], u, v (in-plane axes, 3D), rays: [[bu, bv], [tu, tv]] (2D, u/v coords),
 *            sink: how far the base is pushed into the body (along -outward2D), notch: 0..1 depth of
 *            the membrane notch between ray tips (spiny fins), t: thickness, bone, group, tag, k,
 *            thin, round }
 * @returns the primitive (with prim.fin = { rays2D, origin, u, v })
 */
export function sculptFin(m, o) {
  const rays = o.rays;
  const n = rays.length;
  const sink = o.sink || 0;
  const poly = [];
  // base line direction (first base -> last base) and the side the tips are on
  const b0 = rays[0][0], bN = rays[n - 1][0];
  const bd = [bN[0] - b0[0], bN[1] - b0[1]];
  const bl = Math.hypot(bd[0], bd[1]) || 1;
  let nx = -bd[1] / bl, ny = bd[0] / bl; // normal to the base line
  const tipMid = rays[Math.floor(n / 2)][1];
  if ((tipMid[0] - b0[0]) * nx + (tipMid[1] - b0[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const sunk = (p) => [p[0] - nx * sink, p[1] - ny * sink];
  poly.push(sunk(b0));
  for (let i = 0; i < n; i++) {
    poly.push(rays[i][1].slice());
    if (o.notch && i < n - 1) {
      const a = rays[i][1], b = rays[i + 1][1], ba = rays[i][0], bb = rays[i + 1][0];
      const tm = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bm = [(ba[0] + bb[0]) / 2, (ba[1] + bb[1]) / 2];
      const nt = typeof o.notch === 'function' ? o.notch(i) : o.notch;
      poly.push([tm[0] + (bm[0] - tm[0]) * nt, tm[1] + (bm[1] - tm[1]) * nt]);
    }
  }
  poly.push(sunk(bN));
  const prim = m.fin({ o: o.origin, u: o.u, v: o.v, t: o.t, poly, bone: o.bone, group: o.group, tag: o.tag, k: o.k ?? o.t, round: o.round, part: o.part });
  prim.thin = o.thin !== false;
  const u = norm(o.u), nn = norm(cross(o.u, o.v)), v = cross(nn, u);
  prim.fin = { rays: rays.map((r) => [r[0].slice(), r[1].slice()]), origin: o.origin.slice(), u, v, n: nn, name: o.name || o.tag };
  return prim;
}

/** 2D coordinates of a 3D point in a fin's plane. */
export function finUV(fin, p) {
  const d = sub(p, fin.origin);
  return [dot(d, fin.u), dot(d, fin.v)];
}

/**
 * Ray coordinates of a point in a fin: { phase: continuous ray index (0 .. n-1), along: 0 at the base,
 * 1 at the tip, dir: 3D ray direction there }. Points outside the fan are clamped to the nearest ray.
 */
export function finRayCoords(fin, p) {
  const q = finUV(fin, p);
  const R = fin.rays, n = R.length;
  // side of q relative to ray i (positive toward ray i+1)
  const side = (i) => {
    const [b, t] = R[i];
    const dx = t[0] - b[0], dy = t[1] - b[1];
    const l = Math.hypot(dx, dy) || 1;
    return ((q[0] - b[0]) * -dy + (q[1] - b[1]) * dx) / l;
  };
  // orientation: does side increase from ray 0 to ray n-1?
  const s0 = side(0), sN = side(n - 1);
  const [b0, t0] = R[0], [bN] = R[n - 1];
  const sgn = ((bN[0] - b0[0]) * -(t0[1] - b0[1]) + (bN[1] - b0[1]) * (t0[0] - b0[0])) >= 0 ? 1 : -1;
  let phase;
  if (s0 * sgn <= 0) phase = 0;
  else if (sN * sgn >= 0) phase = n - 1;
  else {
    phase = 0;
    let prev = s0 * sgn;
    for (let i = 1; i < n; i++) {
      const si = side(i) * sgn;
      if (si <= 0) { phase = i - 1 + prev / (prev - si); break; }
      prev = si;
    }
  }
  const i0 = Math.min(n - 2, Math.floor(phase)), f = phase - i0;
  const lp = (a, b) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const b = lp(R[i0][0], R[i0 + 1][0]), t = lp(R[i0][1], R[i0 + 1][1]);
  const dx = t[0] - b[0], dy = t[1] - b[1];
  const L2 = dx * dx + dy * dy || 1e-12;
  const along = Math.max(0, Math.min(1.2, ((q[0] - b[0]) * dx + (q[1] - b[1]) * dy) / L2));
  const dir3 = norm(add(mul(fin.u, dx), mul(fin.v, dy)));
  return { phase, along, dir: dir3 };
}

/** Fan of rays between two base points toward tips given by angle (deg, in the u/v plane) and length. */
export function fanRays({ base0, base1, n, angle0, angle1, length }) {
  const rays = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const b = [base0[0] + (base1[0] - base0[0]) * t, base0[1] + (base1[1] - base0[1]) * t];
    const a = ((angle0 + (angle1 - angle0) * t) * Math.PI) / 180;
    const L = typeof length === 'function' ? length(t, i) : length;
    rays.push([b, [b[0] + Math.cos(a) * L, b[1] + Math.sin(a) * L]]);
  }
  return rays;
}

export { lerp, len };
