// The grey wolf, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). The dense
// winter coat is partly sculpted as volume (neck ruff, cheek ruff, cape, breeches, the tail brush),
// with the shells adding the hair on top of it, as a wolf's silhouette is mostly fur.
import { HEAD_O, TAIL_SEGS, HS, hlOf } from './rig.js';
import { add, sub, mul, lerp, norm, cross, smoothstep } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader (head-local, left eye).
// Axial eyeball ~23 mm (r 11.8 mm); almond fissure 22 x 10.5 mm, set obliquely (outer corner
// higher, 18 deg); eyes ~68 mm apart, diverging ~13 deg each; the iris fills the fissure.
export const EYE_BASE = { c: [0.034, 0.021, 0.036], r: 0.0118, back: 0.0025, yaw: 0.23, pitch: 0.04, lid: 0.0015, R: 0.01415, d: 0.0089, off: -0.0008, tilt: (18 * Math.PI) / 180, irisZ: 0.0072, irisR: 0.0096 };
// per individual: the eye moves with the head width (the muzzle stretch starts in front of it)
export const eyeOf = (params = {}) => ({ ...EYE_BASE, c: [EYE_BASE.c[0] * (params.headW || 1) * HS, EYE_BASE.c[1] * HS, EYE_BASE.c[2] * HS] });

const X = [1, 0, 0];

// The nose leather (head-local), two ellipsoids painted as one (coat.js): in profile a rounded wedge whose
// most forward point lies high, near the top, with the front face sloping back and down into the upper
// lip (lying1, threequarter2); from the front a broad pad with a flat top (face1, face2).
// - NOSE: the front lobe, flattened along its axis, which looks forward and down (~14 deg), so its lower
//   front recedes under the tip; the nostrils open on its face. (Tilted further, 24 deg, the face and the
//   nostrils on it turned away from a viewer above the head: face2 shows them from 20 deg above.)
// - NOSE_TOP: the dorsal plate, running back along the bridge line; its front end is the tip.
// (one ellipsoid of 27 x 31 mm in profile made a ball, and a ball focuses the key light into one dot)
export const NOSE = { c: [0, -0.0015, 0.1485], r: [0.0182, 0.0122, 0.0095], ax: norm([0, -0.25, 1]) };
export const NOSE_TOP = { c: [0, 0.0075, 0.142], r: [0.0184, 0.006, 0.017], ax: norm([0, -0.12, 1]) };
// The upper lip's margin (head-local, left side; x, y, z, radius): from the front of the lip ellipsoid round the
// corner of the muzzle and across under the nose to the midline
export const LIP_MARGIN = [[0.018, -0.031, 0.095, 0.0072], [0.0158, -0.0218, 0.1235, 0.0062], [0.0112, -0.0198, 0.1362, 0.0048], [0, -0.0198, 0.1418, 0.0043]];
// head-local point on the front lobe's surface at lateral lx and local height ly (along its tilted up axis),
// pushed `out` along its axis
export function noseAt(lx, ly, out = 0) {
  const Z = NOSE.ax, Y = [0, Z[2], -Z[1]], [rx, ry, rz] = NOSE.r;
  const lz = rz * Math.sqrt(Math.max(0, 1 - (lx / rx) ** 2 - (ly / ry) ** 2)) + out;
  return [NOSE.c[0] + lx, NOSE.c[1] + Y[1] * ly + Z[1] * lz, NOSE.c[2] + Y[2] * ly + Z[2] * lz];
}
// The nostril (left side, mirrored) in the front lobe's frame (lx lateral, ly along its tilted up axis):
// a rounded opening in the lower half of the pad (face1: ~0.26 of the pad's width, centred a quarter of the
// width off the midline, two thirds of the way down, a thin rim below), and its tail, the alar groove, curving up and out
// round the side of the pad (lying1, threequarter2). The carve (below) gives it depth; the coat paints the
// same shape dark (render hint noseMarks), so it reads at every tier, whatever the mesh resolves.
export const NOSTRIL = { c: [0.0088, -0.0036], r: [0.0048, 0.0051], tail: [[0.0124, -0.0012], [0.0148, 0.0004], [0.0172, 0.001]], ta: 0.0015, tb: 0.0007 };
export function nostrilSDF(lx, ly) {
  const x = Math.abs(lx), [cx, cy] = NOSTRIL.c, [rx, ry] = NOSTRIL.r;
  let d = (Math.hypot((x - cx) / rx, (ly - cy) / ry) - 1) * Math.min(rx, ry);
  const T = NOSTRIL.tail;
  let s0 = 0, L = 0;
  for (let i = 1; i < T.length; i++) L += Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]);
  for (let i = 1; i < T.length; i++) {
    const [ax, ay] = T[i - 1], ex = T[i][0] - ax, ey = T[i][1] - ay, l = Math.hypot(ex, ey);
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (ly - ay) * ey) / (l * l)));
    const r = NOSTRIL.ta + (NOSTRIL.tb - NOSTRIL.ta) * ((s0 + t * l) / L);
    d = Math.min(d, Math.hypot(x - ax - t * ex, ly - ay - t * ey) - r);
    s0 += l;
  }
  return d;
}
// the front lobe's frame coordinates (lx, ly) of a head-local point
export function noseFrame(h) {
  const Z = NOSE.ax, d = [h[0] - NOSE.c[0], h[1] - NOSE.c[1], h[2] - NOSE.c[2]];
  return [d[0], d[1] * Z[2] - d[2] * Z[1]];
}
// outward normal of the front lobe there (head-local)
export function noseNormal(lx, ly) {
  const Z = NOSE.ax, Y = [0, Z[2], -Z[1]], [rx, ry, rz] = NOSE.r;
  const lz = rz * Math.sqrt(Math.max(1e-4, 1 - (lx / rx) ** 2 - (ly / ry) ** 2));
  const g = [lx / rx ** 2, ly / ry ** 2, lz / rz ** 2];
  return norm([g[0], Y[1] * g[1] + Z[1] * g[2], Y[2] * g[1] + Z[2] * g[2]]);
}

export function sculptWolf(m, rig, params = {}) {
  const J = rig.J;
  const EYE = eyeOf(params);
  const mz = params.muzzle || 1, hw = params.headW || 1, ruff = params.ruff ?? 1, juv = params.juv || 0;
  // head-local -> reference space: width factor, and the muzzle stretched ahead of MUZZLE_Z0
  const hl = hlOf(mz, hw);
  const hr = (r) => [r[0] * hw * HS, r[1] * HS, r[2] * HS]; // radii in head space
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // A tube along a Catmull-Rom curve through control points [[point, radius], ...] (`after`: a point beyond the last,
  // setting its end tangent), n round cones per span after the first. The first span blends into the face with o.k;
  // the rest are a hard union: round cones sharing their end spheres and tangents meet smoothly on the outside, while
  // a smooth union of overlapping segments swells the tube by up to k/4 at every joint (a string of beads)
  const tube = (pts, after, n, o) => {
    const P = pts.map((q) => q[0]), Rr = pts.map((q) => q[1]);
    const at = (i, t) => {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = i + 2 < P.length ? P[i + 2] : after || P[i + 1];
      const t2 = t * t, t3 = t2 * t;
      return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
    };
    for (let i = 0; i < P.length - 1; i++) {
      const ns = i === 0 ? 1 : n;
      for (let j = 0; j < ns; j++) {
        const t0 = j / ns, t1 = (j + 1) / ns;
        m.cone({ ...o, k: i === 0 ? o.k : 0, a: at(i, t0), b: at(i, t1), ra: Rr[i] + (Rr[i + 1] - Rr[i]) * t0, rb: Rr[i] + (Rr[i + 1] - Rr[i]) * t1 });
      }
    }
  };

  // ---------------------------------------------------------------- TORSO
  // deep, narrow "keeled" chest; level back; belly tucked up behind the ribs
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.55, 0.14], r: [0.101, 0.142, 0.2], axis: norm([0, 0.12, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.455, 0.29], r: [0.056, 0.07, 0.1], axis: norm([0, -0.35, 1]), k: 0.06 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.5, 0.405], r: [0.066, 0.078, 0.06], k: 0.05 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.69, 0.26], r: [0.052, 0.055, 0.13], axis: norm([0, -0.1, 1]), k: 0.06 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.692, 0.03], r: [0.066, 0.05, 0.16], k: 0.06 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.585, -0.08], r: [0.079, 0.087, 0.16], axis: norm([0, 0.33, -1]), k: 0.07 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.68, -0.14], r: [0.06, 0.05, 0.14], k: 0.05 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.59, -0.19], r: [0.064, 0.064, 0.09], k: 0.05 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.625, -0.28], r: [0.07, 0.085, 0.11], k: 0.06 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.675, -0.27], r: [0.055, 0.04, 0.1], k: 0.04 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.042 * s, 0.585, -0.355], r: [0.042, 0.07, 0.05], k: 0.04 });
  }
  // cape: the long guard hair over the shoulders and hackles (sculpted coat volume)
  m.ell({ tag: 'cape', bone: 'chest', c: [0, 0.675, 0.31], r: [0.09 * (0.8 + 0.2 * ruff), 0.075, 0.13], axis: norm([0, 0.25, 1]), k: 0.07 });

  // ---------------------------------------------------------------- NECK (thick, wrapped in the ruff)
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.58, 0.37], b: [0, 0.685, 0.455], ra: 0.088, rb: 0.07, k: 0.06 });
  m.cone({ tag: 'neck', bone: 'neck2', a: [0, 0.685, 0.455], b: [0, 0.765, 0.51], ra: 0.07, rb: 0.058, k: 0.04 });
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.745, 0.42], r: [0.046, 0.034, 0.1], axis: norm([0, 0.5, 1]), k: 0.04 });
  m.ell({ tag: 'throat', bone: 'neck2', c: [0, 0.625, 0.5], r: [0.048, 0.06, 0.07], axis: norm([0, 0.8, 0.6]), k: 0.05 });
  // the ruff ("mane"): a collar of long hair framing the face, fullest at the throat and the sides
  const rf = (0.75 + 0.25 * ruff) * 1.2; // (+20 %: even a slight female keeps a ruff that frames the face)
  m.ell({ tag: 'ruff', bone: 'neck1', c: [0, 0.64, 0.43], r: [0.082 * rf, 0.088 * rf, 0.095], axis: norm([0, 0.6, 1]), k: 0.06 });
  m.ell({ tag: 'ruff', bone: 'neck2', c: [0, 0.67, 0.505], r: [0.062 * rf, 0.055 * rf, 0.05], axis: norm([0, 0.8, 1]), k: 0.05 });

  // ---------------------------------------------------------------- HEAD (head-local coords, see HEAD_O)
  // landmarks from profile / frontal photos (adult ~0.25 m occiput -> nose): nose tip (0,-0.012,0.155),
  // eyes (+-0.034, 0.021, 0.036), stop ~z 0.05, chin (0,-0.058,0.125), skull top ~0.077, occiput -0.1,
  // zygomatic width ~0.13 (+ cheek ruff); a pup has a domed skull and a short muzzle (params).
  // Profile (lying1 / threequarter2 overlaid on the eye and the nose tip): a moderate stop in front of
  // the eyes, the forehead rising ~0.8 mm per mm from the bridge (z 0.065 -> 0.035) to a broad, domed crown that stands
  // ~10 mm above the eye line's old straight wedge; the midline top at z 100 / 65 / 35 / 0 is 32 / 44 / 69 / 79 mm
  // (was 34 / 50 / 60 / 71: the bridge ran level into the crown, a small flat skull behind a long snout)
  const H = { bone: 'head' };
  m.ell({ ...H, tag: 'cranium', c: hl([0, 0.024 + 0.002 * juv, -0.035]), r: hr([0.053 + 0.002 * juv, 0.053 + 0.005 * juv, 0.066]), k: 0.04 });
  // temporal muscles: a broad, domed skull between the ears (the ears sit on its corners)
  for (const s of [1, -1]) m.ell({ ...H, tag: 'temporal', c: hl([0.03 * s, 0.041, -0.045]), r: hr([0.03, 0.026, 0.045]), k: 0.03 });
  m.ell({ ...H, tag: 'forehead', c: hl([0, 0.043 + 0.002 * juv, 0.014]), r: hr([0.037, 0.032, 0.038]), axis: norm([0, -0.35, 1]), k: 0.025 });
  m.ell({ ...H, tag: 'crest', c: hl([0, 0.052, -0.055]), r: hr([0.018, 0.014, 0.05]), k: 0.03 });
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'brow', c: hl([0.029 * s, 0.037, 0.032]), r: hr([0.016, 0.008, 0.014]), k: 0.012 });
    m.ell({ ...H, tag: 'zygomatic', c: hl([0.056 * s, 0.002, -0.004]), r: hr([0.016, 0.022, 0.045]), axis: norm([-0.3 * s, 0, 1]), k: 0.035 });
    m.ell({ ...H, tag: 'cheek', c: hl([0.038 * s, -0.028, -0.006]), r: hr([0.018, 0.026, 0.038]), k: 0.035 });
    // maxilla: the side of the face under the eye tapers into the muzzle in one plane (a wolf has no
    // step between cheek and muzzle); converges toward the nose, deepest at the lip line
    m.ell({ ...H, tag: 'maxilla', c: hl([0.022 * s, -0.013, 0.052]), r: hr([0.02, 0.027, 0.062]), axis: norm([-0.2 * s, -0.1, 1]), k: 0.024 });
    // mouth corner: the upper lip runs back to the commissure under the eye and meets the cheek
    m.ell({ ...H, tag: 'commissure', c: hl([0.031 * s, -0.036, 0.028]), r: hr([0.013, 0.012, 0.026]), k: 0.016 });
    // cheek ruff: the hair flares sideways and back below the ears (the wide wolf face)
    m.ell({ ...H, tag: 'cheekruff', c: hl([0.056 * s, -0.036, -0.07]), r: hr([0.03 * rf, 0.045, 0.034]), axis: norm([0.35 * s, 0, 1]), k: 0.03 });
    m.ell({ ...H, tag: 'mastoid', c: hl([0.036 * s, -0.018, -0.062]), r: hr([0.024, 0.03, 0.03]), k: 0.03 });
    // upper lip: from the mouth corner under the eye (the lips meet the commissure ~0.6 eye spacings off
    // the midline, face1) forward to under the nose. Its margin, the lip line, keeps its height behind and
    // rises toward the front to the leather's lower back: only ~6-15 mm of lip under the leather (lying1,
    // threequarter2, face1). (Lips running level to 2 cm behind the leather hung a 3 cm white
    // block under it, with the chin as a second lobe below: a puppy's muzzle.)
    m.ell({ ...H, tag: 'lip', c: hl([0.0195 * s, -0.0395, 0.062]), r: hr([0.0095, 0.0108, 0.04]), axis: norm([-0.2 * s, 0.11, 1]), k: 0.014 });
  }
  // the front of the lip: one tube along the margin, from the side of the muzzle round its corner under the side of
  // the nose and across under the nose to the midline, where it meets its mirror image with the same tangent; from
  // the front its margin runs nearly level across the width of the leather before it turns back (face1, face2: a
  // flat "w"). (Three separately blended rolls stood as two knobs either side of a crease under the nose: a pursed
  // mouth from the front and below. Both sides come before the whisker pads, which blend into them.)
  for (const s of [1, -1]) {
    const C = LIP_MARGIN.map(([x, y, z, r]) => [hl([x * s, y, z]), r * HS]);
    const [mx, my, mz2] = LIP_MARGIN[LIP_MARGIN.length - 2];
    tube(C, hl([-mx * s, my, mz2]), 3, { ...H, tag: 'lipfront', k: 0.01 });
  }
  for (const s of [1, -1]) {
    m.ell({ ...H, tag: 'whisker', c: hl([0.0115 * s, -0.0195, 0.116]), r: hr([0.009, 0.0088, 0.018]), k: 0.01 });
  }
  // long, fairly narrow muzzle with a straight nasal bridge and a moderate stop (the cone starts low in front of
  // the forehead, which rises above it). The bridge ends behind
  // the nose pad and its top line runs straight into the top of the leather (threequarter2, side3): a
  // cone ending level with the pad capped it with a round fur dome (a bear's or pig's snout from the front)
  m.cone({ ...H, tag: 'nasal', a: hl([0, 0.021, 0.058]), b: hl([0, 0.0084, 0.126]), ra: 0.024 * hw, rb: 0.013 * hw, k: 0.02 });
  // the bridge: a broad, flat-topped muzzle (square in section, not a wedge), ending behind the leather
  m.ell({ ...H, tag: 'bridge', c: hl([0, 0.009, 0.088]), r: hr([0.02, 0.012, 0.045]), axis: norm([0, -0.25, 1]), k: 0.02 });
  m.ell({ ...H, tag: 'muzzle', c: hl([0, -0.016, 0.082]), r: hr([0.025, 0.0245, 0.05]), axis: norm([0, 0.1, 1]), k: 0.02 });
  // the rostrum keeps the nose pad's width up to the leather (no waist behind the pad), its top under the
  // bridge line
  m.ell({ ...H, tag: 'rostrum', c: hl([0, -0.004, 0.13]), r: hr([0.0165, 0.012, 0.019]), k: 0.012 });
  // the nose leather (face1: 0.55 x 0.38 eye spacings; threequarter2: it caps the whole end of the muzzle,
  // its top running on from the bridge line and its sides reaching ~2.5 cm back)
  m.ell({ ...H, tag: 'nose', c: hl(NOSE.c), r: hr(NOSE.r), axis: NOSE.ax, k: 0.008 });
  m.ell({ ...H, tag: 'nosetop', c: hl(NOSE_TOP.c), r: hr(NOSE_TOP.r), axis: NOSE_TOP.ax, k: 0.006 });
  // (no philtrum primitive: under the nose the two rostral lip rolls meet on the midline, and the groove that
  // splits the bottom of the pad and runs down to the mouth line is painted. A small plate there, along the
  // receding lip, caught the key light on the 5 mm cells of medium as a pale tab under the nose.)
  // (the groove splitting the bottom of the pad is painted (coat.js): carved, it folded into a sliver on
  // the 5 mm cells of the medium tier)
  for (const s of [1, -1]) {
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    // orbit: a soft hollow so brow, cheek and bridge fall away to the lids
    ellY({ ...H, tag: 'orbit', c: at(-0.002 * s, -0.0005, 0.019), ydir: ef.y, lateral: ef.x, r: [0.018, 0.0125, 0.009], k: 0.008, carve: true });
    m.sphere({ ...H, tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: 0.005 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -0.002, zMax: 0.024, k: 0.0022, carve: true });
    // nostrils: comma-shaped openings in the lower half of the pad's face (face1, face2: the darkest marks in
    // the face): a rounded opening that looks forward, down and out, and its tail, the alar slit, running
    // back round the side of the pad (lying1, threequarter2)
    const [ncx, ncy] = NOSTRIL.c, nn = noseNormal(ncx * s, ncy);
    m.ell({ ...H, tag: 'nostril', c: hl(noseAt(ncx * s, ncy, 0.0009)), r: hr([NOSTRIL.r[0], NOSTRIL.r[1], 0.005]), axis: nn, up: [0, 1, 0], k: 0.0012, carve: true });
    const [t0, t1] = NOSTRIL.tail;
    m.cone({ ...H, tag: 'alar', a: hl(noseAt(t0[0] * s, t0[1], 0.0003)), b: hl(noseAt(t1[0] * s, t1[1], 0.0002)), ra: 0.0014, rb: 0.001, k: 0.0008, carve: true });
    // upper canine, hidden behind the lip and inside the closed jaw; shows when the mouth opens
    // (4 mm further back with the front of the mouth: the lips' front ends and the lower jaw)
    m.cone({ ...H, tag: 'canine', a: hl([0.014 * s, -0.0295, 0.1095]), b: hl([0.013 * s, -0.0362, 0.1067]), ra: 0.004, rb: 0.0012, k: 0.002 });
    // upper incisors: three a side in an arc along the front of the upper jaw, just behind the rostral lip, their
    // tips under the head's underside (inside the closed jaw at rest, in front of the lower incisors: a scissor
    // bite); the open mouth shows them under the nose (the third, outer one larger)
    for (const [x, z, ra] of [[0.0024, 0.1215, 0.0014], [0.0066, 0.1202, 0.0014], [0.0106, 0.1175, 0.0017]]) {
      m.cone({ ...H, tag: 'tooth', a: hl([x * s, -0.027, z + 0.001]), b: hl([x * s * 1.03, -0.034, z - 0.0004]), ra, rb: 0.0008, k: 0.001 });
    }
  }

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  // The lower jaw runs forward under the rising lip line to below the back of the leather, its ventral line
  // straight from the throat to the chin (a scissor bite: the lower incisors just behind the upper lip's
  // front, the lower canines in front of the upper ones). (With the jaw ending 2 cm further back, a chin
  // ellipsoid sagged below the lip line as a round lobe: a pouch from the side, a second white lobe from
  // the front.) The front is narrower than the upper lip, so from the front little chin shows under it.
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.05, -0.015]), b: hl([0, -0.049, 0.095]), ra: 0.016, rb: 0.0105, k: 0 });
  m.cone({ ...JW, tag: 'mandible', a: hl([0, -0.049, 0.095]), b: hl([0, -0.0328, 0.1142]), ra: 0.0105, rb: 0.0062, k: 0.006 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: hl([0.036 * s, -0.044, -0.03]), b: hl([0.0105 * s, -0.0315, 0.1135]), ra: 0.013, rb: 0.007, k: 0.02 });
  }
  // the chin: the rounded front of the jaw under the lower lip
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.038, 0.1005]), r: hr([0.0105, 0.006, 0.008]), k: 0.01 });
  // lower lip: the front of the jaw rises to meet the upper lip under the nose (no slit at rest)
  m.ell({ ...JW, tag: 'lowerlip', c: hl([0, -0.0262, 0.118]), r: hr([0.0125, 0.004, 0.0075]), k: 0.01 });
  // lower canines: at rest their tips sit inside the upper lip; they come clear as soon as the jaw drops
  // (the snarl and the bite show fangs; the core cannot retract the lips)
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'canine', a: hl([0.0085 * s, -0.0355, 0.1112]), b: hl([0.0096 * s, -0.0212, 0.1142]), ra: 0.0036, rb: 0.0012, k: 0.002 });
    // the rest of the lower teeth, hidden inside the upper lips at rest (the jaw's crest lies 2-13 mm inside
    // the head there): three incisors between the canines, and the cheek teeth along the crest (P2-P4 and
    // the carnassial), so the open mouth shows a tooth row instead of bare gum
    for (const [x, z] of [[0.0026, 0.1197], [0.0062, 0.1182], [0.0094, 0.1158]]) m.cone({ ...JW, tag: 'tooth', a: hl([x * s, -0.0295, z]), b: hl([x * s * 1.05, -0.0225, z + 0.0012]), ra: 0.0017, rb: 0.0009, k: 0.001 });
    for (const [x, z, y0, hgt, ra] of [[0.0128, 0.086, -0.041, 0.0045, 0.0028], [0.0137, 0.073, -0.041, 0.0055, 0.0032], [0.0146, 0.059, -0.0405, 0.006, 0.0036], [0.0149, 0.043, -0.0395, 0.0065, 0.0044]]) {
      m.cone({ ...JW, tag: 'tooth', a: hl([x * s, y0 - 0.002, z]), b: hl([(x - 0.0006) * s, y0 + hgt, z - 0.001]), ra, rb: 0.0009, k: 0.0015 });
    }
  }

  // ---------------------------------------------------------------- EARS
  // erect, triangular, set wide; broad at the base, pointed tip, cupped front (shorter than a fox's)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const facing = norm([0.32 * s, 0.05, 1]); // (the cups face forward, a little outward: face1, face2)
    const lat = norm(cross(up, facing));
    const L = Math.hypot(...sub(tip, base));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const at = (t) => lerp(base, tip, t);
    ellY({ ...ear, tag: 'ear', c: at(0.22), ydir: up, lateral: lat, r: [0.036, 0.036, 0.0095], k: 0.012 });
    ellY({ ...ear, tag: 'ear', c: at(0.55), ydir: up, lateral: lat, r: [0.023, 0.034, 0.0068], k: 0.012 });
    ellY({ ...ear, tag: 'ear', c: at(0.84), ydir: up, lateral: lat, r: [0.0085, 0.022, 0.0048], k: 0.01 });
    ellY({ ...ear, tag: 'earinner', c: add(at(0.36), mul(facing, 0.0085)), ydir: up, lateral: lat, r: [0.024, 0.034, 0.0062], k: 0.004, carve: true });
    ellY({ ...ear, tag: 'earinner', c: add(at(0.68), mul(facing, 0.0062)), ydir: up, lateral: lat, r: [0.011, 0.026, 0.0045], k: 0.003, carve: true });
    void L;
  }

  // ---------------------------------------------------------------- LEGS
  // long, lean legs; big feet; elbows tucked in under the narrow chest
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.008, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.026, 0.1, 0.058], k: 0.06, bias: 0.004 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.043, rb: 0.032, k: 0.06 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.03]), ydir: sub(E, Sh), lateral: lat, r: [0.03, 0.075, 0.036], k: 0.05 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.008, -0.024]), rad: 0.018, k: 0.02 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.032, rb: 0.019, k: 0.025 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.003, 0, 0.004])), ydir: sub(W, E), lateral: lat, r: [0.028, 0.068, 0.032], k: 0.03 });
    // feathering on the back of the forearm
    ellY({ tag: 'feather', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.45), [0, 0, -0.018]), ydir: sub(W, E), lateral: lat, r: [0.016, 0.06, 0.018], k: 0.02 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0, -0.003]), rad: 0.019, k: 0.012 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.008, -0.019]), rad: 0.009, k: 0.01 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.018, rb: 0.018, k: 0.012 });
    m.sphere({ tag: 'dewclaw', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.3), sx([-0.016, 0, 0.002])), rad: 0.006, k: 0.005 });
    const dp = norm(sub(T, M));
    // big oval forefoot (print ~11 x 9.5 cm incl. claws)
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.022)), [0, -0.006, 0]), ydir: dp, lateral: lat, r: [0.03, 0.04, 0.019], k: 0.014 });
    m.sphere({ tag: 'pad', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.025, 0.012]), rad: 0.013, k: 0.01 });
    const toeX = [-0.021, -0.0072, 0.0072, 0.021], toeZ = [-0.011, 0, 0, -0.011];
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + toeX[i] * s, 0.0122, T[2] - 0.009 + toeZ[i]], rad: 0.0115, k: 0.007 });
    for (let i = 0; i < 4; i++) m.cone({ tag: 'claw', bone: 'fpaw' + S, group: g, a: [T[0] + toeX[i] * s * 0.95, 0.011, T[2] + 0.0 + toeZ[i]], b: [T[0] + toeX[i] * s * 0.95, 0.004, T[2] + 0.011 + toeZ[i]], ra: 0.0032, rb: 0.0012, k: 0.002 });

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // broad muscular thigh with long "breeches" hair behind
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.4), sx([0.004, 0, -0.03])), ydir: sub(K, Hp), lateral: lat, r: [0.042, 0.145, 0.095], k: 0.05, bias: 0.004 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.04, 0.6, -0.15]), b: add(K, sx([-0.004, 0.055, 0.0])), ra: 0.038, rb: 0.024, k: 0.06 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.045, 0.6, -0.36]), b: add(lerp(K, Hk, 0.28), [0, 0, -0.03]), ra: 0.046, rb: 0.028, k: 0.04 });
    ellY({ tag: 'breeches', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.62), sx([0.006, -0.01, -0.085])), ydir: sub(K, Hp), lateral: lat, r: [0.03, 0.08, 0.03], k: 0.035 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.05, 0.48, -0.13]), ydir: [-0.03, 0.16, 0.1], lateral: lat, r: [0.02, 0.08, 0.04], k: 0.06 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.002, 0.008, 0.006])), rad: 0.017, k: 0.04 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.06), sx([0.0, 0.0, 0.004])), b: Hk, ra: 0.023, rb: 0.017, k: 0.03 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.002, 0.01, -0.027])), ydir: sub(Hk, K), lateral: lat, r: [0.025, 0.07, 0.03], k: 0.035 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.5), [0, 0.01, -0.034]), b: add(Hk, [0, 0.012, -0.029]), ra: 0.012, rb: 0.011, k: 0.015 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.012, -0.025]), rad: 0.015, k: 0.012 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.02, k: 0.012 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: Hk, b: Mt, ra: 0.018, rb: 0.017, k: 0.012 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.02)), [0, -0.006, 0]), ydir: dh, lateral: lat, r: [0.027, 0.037, 0.018], k: 0.014 });
    m.sphere({ tag: 'pad', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.025, 0.01]), rad: 0.012, k: 0.01 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + toeX[i] * 0.92 * s, 0.0115, Tt[2] - 0.009 + toeZ[i]], rad: 0.0105, k: 0.007 });
    for (let i = 0; i < 4; i++) m.cone({ tag: 'claw', bone: 'hpaw' + S, group: h, a: [Tt[0] + toeX[i] * 0.88 * s, 0.01, Tt[2] + toeZ[i]], b: [Tt[0] + toeX[i] * 0.88 * s, 0.004, Tt[2] + 0.01 + toeZ[i]], ra: 0.003, rb: 0.0011, k: 0.002 });
  }

  // ---------------------------------------------------------------- TAIL
  // the brush: a dense, round tail thickest at a third of its length, not tapering to a point
  // (the long guard hair is carried partly by this volume, partly by the shells)
  const tb = params.tailBrush ?? 1;
  // spindle: narrow root, fullest at 50-60 % of the length, tapering to the tip
  // (the base mesh carries the brush at coarse tiers; it tapers to a point: the tip hair is the longest)
  const tailR = (t) => tb * (t < 0.15 ? 0.026 + 0.004 * (t / 0.15) : t < 0.55 ? 0.03 + 0.026 * smoothstep(0.15, 0.55, t) : 0.056 - 0.043 * Math.pow((t - 0.55) / 0.45, 1.6));
  m.cone({ tag: 'tailroot', bone: 'tail0', a: [0, 0.645, -0.285], b: J.tail1, ra: 0.032, rb: tailR(0.1), k: 0.04 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: tailR(i / TAIL_SEGS), rb: tailR((i + 1) / TAIL_SEGS), k: 0.012, thin: i >= TAIL_SEGS - 1 });
  }

  return m;
}
