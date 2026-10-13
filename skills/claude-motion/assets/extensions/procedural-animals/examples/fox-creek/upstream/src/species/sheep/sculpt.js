// The sheep, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). The head is
// modelled in its own frame (rig.js: hl()), measured from the profile and frontal references (side2,
// side3_texel, face1, face2, front1); the body relative to the joints so the sculpt follows the
// skeleton.
//
// The fleece is a sculpted volume: the skin body is wrapped in offset "fleece" primitives (params.
// wool = depth of the wool volume, m) that give the boxy silhouette of a sheep in wool (the neck
// disappears, the head emerges from the wool, the belly wool hangs, the britch covers the thighs to
// the hocks), and its surface is broken into locks: a Poisson-disc scatter of small ellipsoids
// elongated down the fall of the staples, blended into the fleece. The coat grows short, tightly
// clumped shells on top (the crimped staple tips) and darkens the crevices between locks.
// Separate surfaces ("parts"): 'jaw' (lower lip and chin: the mouth opens) and 'horn' (keratin
// spiral horns of rams, rigid on the skull).
import { HEAD_O, HZ, HY, hl, hdir, TAIL_SEGS } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot, rng, smoothstep } from '../../core/math/vec.js';
import { apertureTiltAlong, eyeFrameOf } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { neckS } from './neck.js';

// Eye: globe ~29 mm across, visible opening ~23 x 15 mm (literature), set on the side of the
// head below the brow, looking out and a little forward (lateral eyes, visual field ~300 deg).
const EYE_LOCAL = [0.058, -0.004, 0.013]; // (set in the orbit: the brow and the orbit's rim stand round it)
const eyeDir = (() => {
  const a = (38 * Math.PI) / 180;
  return norm(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))));
})();
const EYE_BASE = {
  c: sub(hl(EYE_LOCAL), HEAD_O), r: 0.0145, back: 0.003, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0017, R: 0.017, d: 0.0095, off: -0.0006, tilt: 0, irisZ: 0.0081, irisR: 0.0112,
};
// roll the almond so its long axis follows the nasal line, the inner corner a little lower (toward the
// muzzle). (A search over the roll stood the almond on end: a vertical slit, the "bead" eye.)
EYE_BASE.tilt = apertureTiltAlong(EYE_BASE, HEAD_O, HZ) + 0.16;
export const EYE = EYE_BASE;

const X = [1, 0, 0];

// Horn centre line (reference space), shared by the sculpt and the coat: the ram's spiral. From the
// poll it sweeps up and back, down behind the ear, forward under it and up again beside the eye
// (a logarithmic spiral in the side plane of the head, drifting outward so the turns clear the face
// and each other). params.horns = { turns, base (radius, m), r0 (curl radius), flare }.
// Returns [{ p, r, t }].
export function hornPath(params, s) {
  const H = params.horns;
  if (!H || !(H.turns > 0)) return [];
  // (in the world frame of the bind pose: the coil turns in a near-vertical plane beside the head,
  // whatever the head's pitch)
  const B = hl([0.04 * s, 0.03, -0.04]); // horn base on the poll
  const C = [B[0], B[1] - 0.048 * (H.r0 ?? 1), B[2] - 0.05 * (H.r0 ?? 1)]; // curl centre, behind the ear
  const r0 = Math.hypot(B[1] - C[1], B[2] - C[2]);
  const th0 = Math.atan2(B[1] - C[1], B[2] - C[2]);
  const b = Math.log(1.45) / (2 * Math.PI);
  const turns = H.turns;
  const n = Math.max(6, Math.round(22 * turns));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = th0 + t * turns * 2 * Math.PI;
    const r = r0 * Math.exp(b * (th - th0));
    const lat = B[0] + s * (0.095 * (H.flare ?? 1) * turns * t + 0.03 * Math.sin(Math.PI * Math.min(1, t * 2)));
    const v = [lat, C[1] + r * Math.sin(th), C[2] + r * Math.cos(th)];
    const rad = H.base * Math.pow(1 - 0.84 * t, 0.9) + 0.0025;
    out.push({ p: v, r: rad, t });
  }
  return out;
}

// The fall of the staples on the fleece surface (normal n, point p): away from the head along the body
// (the axial chain's direction, nose -> tail, blended softly between its segments) and down. The tangent
// field is the projection of that 3D direction onto the surface, so it only vanishes where the surface
// faces straight along it: under the rear of the belly (down and back), never on the visible fleece.
// (An earlier field added a "back over the top" term (n x X) that pointed UP on the front of the
// neck and the breast: the fall turned through 180 degrees across a line there, and the fur shells, which
// lean along the flow, parted along it: the dark crack across the neck and shoulder.)
const FALL_SEGS = new WeakMap();
const FALL_CHAIN = ['occiput', 'neckMid', 'neckBase', 'chestMid', 'thoraxRear', 'lumbarMid', 'lumbosacral', 'tailBase'];
export function stapleFall(n, p, J) {
  let cd = [0, 0, -1];
  if (p && J) {
    let segs = FALL_SEGS.get(J);
    if (!segs) FALL_SEGS.set(J, segs = FALL_CHAIN.slice(1).map((k, i) => { const a = J[FALL_CHAIN[i]], b = J[k]; const d = sub(b, a); return { a, d, l2: dot(d, d), u: norm(d) }; }));
    let dmin = 1e9; const ds = [];
    for (const S of segs) {
      const t = Math.max(0, Math.min(1, dot(sub(p, S.a), S.d) / S.l2));
      const dd = Math.hypot(p[0] - S.a[0] - S.d[0] * t, p[1] - S.a[1] - S.d[1] * t, p[2] - S.a[2] - S.d[2] * t);
      ds.push(dd); if (dd < dmin) dmin = dd;
    }
    cd = [0, 0, 0];
    segs.forEach((S, i) => { const w = Math.exp(-(ds[i] - dmin) / 0.05); cd = add(cd, mul(S.u, w)); });
    cd = norm(cd);
  }
  const v = [cd[0], cd[1] - 1.2, cd[2]], k = dot(n, v);
  const t = [v[0] - n[0] * k, v[1] - n[1] * k, v[2] - n[2] * k];
  const l = Math.hypot(t[0], t[1], t[2]);
  return l > 1e-6 ? [t[0] / l, t[1] / l, t[2] / l] : [0, 0, -1];
}

// lock radius (m) for a sculpted wool depth: staple blocks of 2-3 cm (finer in the Merino)
export const lockRadius = (F, merino) => Math.min(0.032, 0.01 + 0.2 * F) * (merino ? 0.75 : 1);

// all wool tags (the coat grows fleece on them)
export const WOOL_TAGS = new Set(['fleece', 'woolneck', 'woolarm', 'woolthigh', 'woolweb', 'woolbelly', 'wooltail', 'woolpoll', 'woolcheek', 'lock', 'lockleg', 'woolleg', 'fold']);

export function sculptSheep(m, rig, params = {}) {
  const J = rig.J;
  const lamb = params.age === 'juvenile';
  const male = params.sex === 'male';
  const ram = male && !lamb;
  const heavy = params.heavy ?? (ram ? 1 : 0); // 0 ewe .. 1 heavy ram
  const roman = params.roman || 0; // Suffolk / Merino convex nose
  const F = params.wool ?? 0.07; // depth of the sculpted wool volume (m)
  const merino = params.variant === 'merino';
  const R = rng(9127 + (params.coatSeed || 0));

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const H = { bone: 'head' };
  const hell = (o) => m.ell({ ...H, ...o, c: hl(o.c), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });

  // ---------------------------------------------------------------- TORSO (skin)
  // deep, broad barrel, level back, well-sprung ribs, broad rounded rump (meat breeds: Texel, Suffolk)
  const gw = 1 + 0.1 * heavy + (params.muscle || 0) * 0.08;
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.5, 0.07], r: [0.152 * gw, 0.19, 0.27], axis: norm([0, 0.06, 1]), k: 0 });
  m.ell({ tag: 'girth', bone: 'chest', c: [0, 0.49, 0.23], r: [0.122 * gw, 0.17, 0.12], k: 0.05 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.485, -0.13], r: [0.16 * gw, 0.18, 0.2], axis: norm([0, 0.06, -1]), k: 0.06 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.53, -0.26], r: [0.14 * gw, 0.13, 0.13], k: 0.06 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.645, 0.2], r: [0.05, 0.05, 0.13], axis: norm([0, -0.1, 1]), k: 0.07 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.64, 0.0], r: [0.11 * gw, 0.05, 0.22], k: 0.07 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.645, -0.2], r: [0.12 * gw, 0.045, 0.14], k: 0.07 });
  // hindquarters: broad croup, rounded buttocks (the leg of lamb)
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.56, -0.39], r: [0.13 * gw, 0.12, 0.13], k: 0.05 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.63, -0.38], r: [0.105 * gw, 0.045, 0.14], axis: norm([0, -0.1, 1]), k: 0.05 });
  for (const s of [1, -1]) {
    m.sphere({ tag: 'hippoint', bone: 'pelvis', c: [0.1 * s * gw, 0.635, -0.29], rad: 0.022, k: 0.05 });
    m.sphere({ tag: 'pinbone', bone: 'pelvis', c: [0.05 * s, 0.61, -0.49], rad: 0.022, k: 0.04 });
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.06 * s, 0.51, -0.46], r: [0.065 * gw, 0.11, 0.065], k: 0.06 });
  }
  // chest front: brisket between the forelegs
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.395, 0.3], r: [0.075, 0.075, 0.08], k: 0.05 });
  for (const s of [1, -1]) m.ell({ tag: 'pectoral', bone: 'chest', c: [0.046 * s, 0.4, 0.33], r: [0.042, 0.06, 0.04], k: 0.04 });
  // udder (ewes, small, mostly hidden in the wool) / scrotum (rams: large, hanging between the thighs)
  if (!male && !lamb && (params.udder ?? 0.3) > 0.05) {
    const u = params.udder ?? 0.3;
    for (const s of [1, -1]) {
      m.ell({ tag: 'udder', bone: 'udder', group: 'udder', c: [0.026 * s, 0.315 - 0.02 * u, -0.3], r: [0.034 + 0.014 * u, 0.04 + 0.02 * u, 0.045 + 0.015 * u], k: 0.03 });
      const a = [0.032 * s, 0.285 - 0.035 * u, -0.29], b = add(a, [0.01 * s, -0.022, 0.01]);
      m.cone({ tag: 'teat', bone: 'udder', group: 'udder', a, b, ra: 0.008, rb: 0.006, k: 0.01 });
    }
  }
  if (male && !lamb) {
    m.ell({ tag: 'scrotum', bone: 'udder', group: 'udder', c: [0, 0.3, -0.34], r: [0.045, 0.075, 0.045], axis: norm([0, 0.2, 1]), k: 0.035 });
    m.ell({ tag: 'sheath', bone: 'spine2', c: [0, 0.3, -0.05], r: [0.016, 0.02, 0.045], axis: norm([0, 0.3, 1]), k: 0.03 });
  }

  // ---------------------------------------------------------------- NECK (skin)
  // short and thick; a ram's is heavier with a crest
  const nb = J.neckBase, nm = J.neckMid, occ = J.occiput;
  const nd1 = norm(sub(nm, nb)), nd2 = norm(sub(occ, nm));
  const nk = 1 + 0.25 * heavy;
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 0.575, 0.32], r: [0.11 * nk, 0.13, 0.11], axis: nd1, up: [0, 1, -0.6], k: 0.05 });
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 0.67, 0.4], r: [0.1 * nk, 0.105 * (1 + 0.15 * heavy), 0.095], axis: nd1, up: [0, 1, -0.6], k: 0.05 });
  m.ell({ tag: 'neck', bone: 'neck2', c: [0, 0.76, 0.47], r: [0.078 * nk, 0.085 * (1 + 0.15 * heavy), 0.08], axis: nd2, up: [0, 1, -0.6], k: 0.04 });
  // the neck meets the withers and shoulders in one broad mass (no notch in the shorn topline)
  m.ell({ tag: 'neck', bone: 'neck1', c: [0, 0.6, 0.265], r: [0.12 * nk, 0.12, 0.12], k: 0.06 });
  m.ell({ tag: 'crest', bone: 'neck1', c: [0, 0.71, 0.37], r: [0.055 + 0.02 * heavy, 0.05 + 0.02 * heavy, 0.15], axis: norm([0, 0.65, 0.75]), k: 0.07 });
  m.cone({ tag: 'throat', bone: 'neck1', a: [0, 0.51, 0.38], b: [0, 0.65, 0.455], ra: 0.05, rb: 0.038, k: 0.05 });
  // (the throat runs in behind the angle of the jaw: the jaw's outline stands clear of the neck)
  m.cone({ tag: 'throat', bone: 'neck2', a: [0, 0.63, 0.455], b: hl([0, -0.07, -0.1]), ra: 0.03, rb: 0.022, k: 0.03 });

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // A defined skull rather than one smooth mass (side4_suffolk, face1, face2, extra/: Suffolk_Sheep,
  // Tete_de_brebie_Suffolk, Lundy head): a narrow braincase behind a flat forehead; the orbits stand out
  // to the sides under a brow; a long nasal bridge, straight in the white-faced breeds and arched
  // (Roman) in the Suffolk and in rams; the face narrows from the facial crest below the eye to a
  // blunt, deep muzzle with comma nostrils and a split upper lip; the cheek (masseter) and the
  // rounded angle of the jaw behind it, the lower edge of the mandible running forward to the chin.
  // Landmarks: poll (0, 0.04, -0.075), eyes (+-0.059, -0.006, 0.004), nose tip (0, -0.024, 0.2), chin
  // y -0.09 at 0.15, forehead width 0.105 between the brows.
  // dorsal line: straight from the forehead (y 0.046 at z 0) to the top of the nose (0.012 at 0.175),
  // plus the Roman arch
  const topY = (z) => 0.046 - 0.194 * z + (0.004 + 0.011 * roman) * Math.sin(Math.PI * Math.max(0, Math.min(1, (z + 0.02) / 0.21)));
  // (broad and flat across the top: from the front the head is wide at the eyes and ears and narrows to
  // the muzzle, not a dome over a long nose)
  hell({ tag: 'cranium', c: [0, -0.002, -0.042], r: [0.05, 0.04, 0.05], k: 0.03 });
  hell({ tag: 'poll', c: [0, 0.0, -0.068], r: [0.038, 0.032, 0.03], k: 0.03 });
  hell({ tag: 'forehead', c: [0, 0.028, 0.0], r: [0.056, 0.018, 0.05], k: 0.025 });
  // nasal bridge: a narrow, flat-topped ridge following the dorsal line
  for (const [z, w] of [[0.035, 0.032], [0.08, 0.03], [0.122, 0.028], [0.158, 0.027]]) {
    const ry = 0.017;
    const dz = 0.01, slope = (topY(z + dz) - topY(z - dz)) / (2 * dz);
    hell({ tag: 'face', c: [0, topY(z) - ry, z], r: [w, ry, 0.038], axisL: [0, slope, 1], k: 0.022 });
  }
  // the face below the bridge, narrowing to the muzzle
  hell({ tag: 'lowerface', c: [0, -0.043, 0.066], r: [0.043, 0.045, 0.08], k: 0.03 });
  hell({ tag: 'muzzle', c: [0, -0.024, 0.155], r: [0.035 + 0.002 * roman, 0.034, 0.043], k: 0.024 });
  // (the nasal line runs on to a blunt, nearly upright nose front: the tip is not a rounded bulb)
  hell({ tag: 'face', c: [0, topY(0.186) - 0.019, 0.184], r: [0.025, 0.019, 0.016], axisL: [0, -0.3, 1], k: 0.018 });
  // (the throat between the jaws, a little hollow under the lower edges of the mandibles)
  hell({ tag: 'intermandible', c: [0, -0.092, 0.025], r: [0.02, 0.014, 0.06], k: 0.018 });
  for (const s of [1, -1]) {
    // the sides of the face (maxilla), sloping out from the bridge to the cheek
    hell({ tag: 'maxilla', c: [0.031 * s, -0.03, 0.078], r: [0.022, 0.036, 0.074], axisL: [-0.18 * s, 0, 1], k: 0.028 });
    // the brow: the orbit's rim stands out over the eye
    // (a capsule: a flat ellipsoid's approximate distance, blended at k 22-35 mm, drew a crisp groove along its
    // lower edge, a frown line over each eye)
    m.cone({ ...H, tag: 'brow', a: hl([0.043 * s, 0.013, 0.03]), b: hl([0.053 * s, 0.011, -0.012]), ra: 0.006, rb: 0.005, k: 0.02 });
    // the orbit's back and lower rim (behind and below the eye)
    hell({ tag: 'orbitrim', c: [0.048 * s, -0.012, -0.011], r: [0.012, 0.018, 0.014], k: 0.016 });
    // the facial crest: a ridge from below the eye forward along the cheek
    m.cone({ ...H, tag: 'facialcrest', a: hl([0.05 * s, -0.026, 0.001]), b: hl([0.038 * s, -0.033, 0.075]), ra: 0.01, rb: 0.007, k: 0.016 });
    // the side of the face below the facial crest is full down to the lips (a hollow there left the muzzle
    // a thin tube in front of the cheeks: the 'anteater' look in 3/4)
    hell({ tag: 'buccal', c: [0.032 * s, -0.058, 0.075], r: [0.019, 0.028, 0.062], k: 0.03 });
    // cheek (masseter) and the rounded angle of the jaw behind it
    hell({ tag: 'cheek', c: [0.043 * s, -0.074, -0.01], r: [0.021, 0.052, 0.046], k: 0.028 });
    // (the angle a rounded corner standing out of the throat: the jaw's outline breaks into the neck)
    hell({ tag: 'jawangle', c: [0.035 * s, -0.116, -0.03], r: [0.019, 0.032, 0.031], k: 0.024 });
    // lower edge of the mandible
    m.cone({ ...H, tag: 'mandible', a: hl([0.034 * s, -0.128, -0.026]), b: hl([0.024 * s, -0.075, 0.13]), ra: 0.011, rb: 0.0095, k: 0.022 });
    hell({ tag: 'nostrilwing', c: [0.019 * s, -0.019, 0.177], r: [0.012, 0.014, 0.014], k: 0.013 });
    // the sides of the upper lip hang over the lower jaw back to the corner of the mouth (closed lips)
    hell({ tag: 'lipside', c: [0.021 * s, -0.045, 0.16], r: [0.011, 0.011, 0.025], axisL: [-0.14 * s, 0.05, 1], k: 0.015 });
    // the upper lip in two halves (the philtrum splits it)
    hell({ tag: 'upperlip', c: [0.013 * s, -0.04, 0.182], r: [0.016, 0.0125, 0.018], k: 0.012 });
    // the eye socket (as core sculptEyeSocket, without its orbit carve and with a softer lid blend, 0.8 r): the
    // lid's bulge over the globe runs smoothly into the brow and the orbit's rim; the almond's cut stops 1.4 r out
    // (just outside the lids) instead of 2 r
    {
      const ef = eyeFrameOf(EYE, HEAD_O, s);
      m.sphere({ bone: 'head', tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: EYE.r * 0.8 });
      m.lens({ bone: 'head', tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -EYE.r * 0.16, zMax: EYE.r * 1.4, k: EYE.r * 0.18, carve: true });
    }
    // preorbital (infraorbital) gland: a small pit in front of and below the eye
    hell({ tag: 'preorbital', c: [0.047 * s, -0.021, 0.047], r: [0.004, 0.003, 0.008], k: 0.004, carve: true });
    // nostril: a narrow oblique slit on the front of the nose, the upper ends turned toward each other (an
    // inverted V, front1, face2); its centre 1 mm under the skin, ~15 x 2.5 mm where it opens
    // (a 7 x 20 mm carve 9 mm inside the nose opened on its underside, a dark smear from below)
    hell({ tag: 'nostril', c: [0.0105 * s, -0.019, 0.2015], r: [0.0014, 0.0078, 0.004], axisL: [0.3 * s, -0.1, 1], upL: [-0.64 * s, 0.77, 0], k: 0.0015, carve: true });
  }
  // philtrum: the groove that splits the upper lip (sheep graze close with the split lip); a shallow notch in the
  // lip's edge, the line down from the nose is painted (coat.js; a carved groove on the fine nose mesh shaded
  // into a dark fang under the nose)
  hell({ tag: 'philtrum', c: [0, -0.046, 0.2], r: [0.0018, 0.006, 0.006], k: 0.002, carve: true });

  // ---------------------------------------------------------------- JAW (lower lip, chin)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  m.ell({ ...JW, tag: 'chin', c: hl([0, -0.063, 0.158]), r: [0.023, 0.019, 0.028], axis: HZ, up: HY, k: 0 });
  m.ell({ ...JW, tag: 'lowerlip', c: hl([0, -0.053, 0.176]), r: [0.021, 0.013, 0.017], axis: HZ, up: HY, k: 0.012 });
  // (the rear of the lower jaw thins into the head: a full round end stood out of the cheek below the corner of
  // the mouth, its crease turning the mouth line down)
  for (const s of [1, -1]) m.cone({ ...JW, tag: 'mandible', a: hl([0.02 * s, -0.06, 0.124]), b: hl([0.018 * s, -0.058, 0.158]), ra: 0.0085, rb: 0.012, k: 0.015 });

  // ---------------------------------------------------------------- EARS
  // leaf-shaped, held level out to the sides (Suffolk: longer, a little below level); a rolled, thick
  // base (the ear's stalk) widening into the blade, the inside a shallow cup with a rim
  const earW = params.ear === 'droop' ? 0.031 : params.ear === 'small' ? 0.024 : 0.028;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const len = Math.hypot(...sub(tip, base));
    // the blade turned 55 deg about its own axis from level, so the cup opens forward, out and down: the
    // inside shows from the front and from below (face1, front1, threequarter1), the back of the leaf from
    // above, and from the side (ears swept back 46 deg, rig.js) the near ear is a level leaf pointing back
    // showing its inside (side2), not a round cup standing upright (at 32 deg back the cup faced
    // the side camera, a pink cup over the poll; at 28-40 deg of turn the blade was edge-on, a rod). The
    // Suffolk's long hanging ears: the blade near upright, its face forward (Tete_de_brebie_Suffolk; at 55-62
    // deg the leaf seen from the side was a thin black rod)
    const fwd = norm([-s * up[2], 0, Math.abs(up[0])]);
    const tiltB = ((params.ear === 'droop' ? 80 : 55) * Math.PI) / 180;
    const facing = norm(add(mul([0, -1, 0], Math.cos(tiltB)), mul(fwd, Math.sin(tiltB))));
    const lat = norm(cross(up, facing));
    const fc = norm(cross(lat, up));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    m.cone({ ...ear, tag: 'earstalk', a: add(base, mul(up, 0.004)), b: lerp(base, tip, 0.3), ra: 0.0115, rb: 0.0095, k: 0.01 });
    ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.53), ydir: up, lateral: lat, r: [earW, len * 0.4, 0.0062], k: 0.016 });
    // (a leaf narrowing to a point, not a round paddle)
    ellY({ ...ear, tag: 'eartip', c: lerp(base, tip, 0.8), ydir: up, lateral: lat, r: [earW * 0.5, len * 0.24, 0.0045], k: 0.014 });
    // (the cup starts clear of the stalk: where it cut into the stalk's junction it left dark pits)
    ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.58), mul(fc, 0.0054)), ydir: up, lateral: lat, r: [earW * 0.7, len * 0.32, 0.0042], k: 0.005, carve: true });
    m.sphere({ ...H, tag: 'earbase', c: add(base, mul(up, -0.006)), rad: 0.016, k: 0.02 });
  }

  // ---------------------------------------------------------------- HORNS (rams of horned breeds)
  for (const s of [1, -1]) {
    const pth = hornPath(params, s);
    for (let i = 0; i + 1 < pth.length; i++) {
      m.cone({ bone: 'head', part: 'horn', group: 'axial', tag: 'horn', a: pth[i].p, b: pth[i + 1].p, ra: pth[i].r, rb: pth[i + 1].r, k: 0.004 });
    }
    if (pth.length) m.sphere({ ...H, tag: 'hornboss', c: hl([0.036 * s, 0.028, -0.035]), rad: Math.min(0.018, params.horns.base * 0.6), k: 0.015 });
  }

  // ---------------------------------------------------------------- LEGS (skin): fine-boned, long cannons
  const lk = 1 + 0.1 * heavy;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.45), sx([0.03, 0, -0.01])), ydir: sub(Sh, Sc), lateral: lat, r: [0.024 * lk, 0.095, 0.062], k: 0.06 });
    m.sphere({ tag: 'shoulderpoint', bone: 'humerus' + S, group: g, c: add(Sh, sx([0.008, 0.0, 0.012])), rad: 0.027, k: 0.04 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.038 * lk, rb: 0.033 * lk, k: 0.04 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.005, 0.01, -0.045])), ydir: sub(E, Sh), lateral: lat, r: [0.032 * lk, 0.068, 0.05], k: 0.05 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.012, -0.032]), rad: 0.023, k: 0.025 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.005]), b: W, ra: 0.033 * lk, rb: 0.018, k: 0.025 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.004, 0, 0.006])), ydir: sub(W, E), lateral: lat, r: [0.031 * lk, 0.065, 0.034 * lk], k: 0.025 });
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.02, 0.03, -0.01])), b: add(lerp(E, W, 0.3), sx([-0.01, 0, 0])), ra: 0.028, rb: 0.02, k: 0.03 });
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.002]), ydir: [0, 1, 0], lateral: lat, r: [0.02, 0.025, 0.02], k: 0.012 });
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.01, 0.0]), b: add(M, [0, 0.01, 0.0]), ra: 0.014, rb: 0.013, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.015, -0.011]), b: add(M, [0, 0.015, -0.012]), ra: 0.0085, rb: 0.0105, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.018, 0.019, 0.02], k: 0.01 });
    sculptDewclaws(m, 'fpaw' + S, g, M, s);
    m.cone({ tag: 'pastern', bone: 'fpaw' + S, group: g, a: M, b: C, ra: 0.0148, rb: 0.0158, k: 0.01 });
    sculptHoof(m, 'fhoof' + S, g, C, T, 0.97, s);

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.022, 0, -0.03])), ydir: sub(K, Hp), lateral: lat, r: [0.036 * lk, 0.125, 0.095], k: 0.06 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.075, 0.585, -0.28]), b: add(K, sx([0.0, 0.03, 0.02])), ra: 0.05, rb: 0.03, k: 0.05 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.05, 0.58, -0.47]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.04]), ra: 0.05, rb: 0.027, k: 0.04 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.095, 0.41, -0.19]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.025, 0.065, 0.038], k: 0.05 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.004, 0.005, 0.014])), rad: 0.027, k: 0.035 });
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.004, 0, -0.022])), ydir: sub(Hk, K), lateral: lat, r: [0.034 * lk, 0.075, 0.043], k: 0.03 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.026, rb: 0.017, k: 0.025 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.035]), b: add(Hk, [0, 0.03, -0.03]), ra: 0.012, rb: 0.01, k: 0.015 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.027, -0.027]), rad: 0.014, k: 0.012 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.004, -0.002]), ydir: [0, 1, 0.25], lateral: lat, r: [0.019, 0.029, 0.021], k: 0.015 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.016, 0.002]), b: add(Mt, [0, 0.01, 0.0]), ra: 0.0145, rb: 0.013, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.016, -0.012]), b: add(Mt, [0, 0.015, -0.012]), ra: 0.0085, rb: 0.0105, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.018, 0.019, 0.02], k: 0.01 });
    sculptDewclaws(m, 'hpaw' + S, h, Mt, s);
    m.cone({ tag: 'pastern', bone: 'hpaw' + S, group: h, a: Mt, b: Ch, ra: 0.0145, rb: 0.0155, k: 0.01 });
    sculptHoof(m, 'hhoof' + S, h, Ch, Tt, 0.93, s);
  }

  // ---------------------------------------------------------------- TAIL (skin): thin, hanging
  for (let i = 0; i < TAIL_SEGS; i++) {
    const t0 = i / TAIL_SEGS, t1 = (i + 1) / TAIL_SEGS;
    const a = J['tail' + i], b = J['tail' + (i + 1)];
    const w0 = 0.026 - 0.014 * t0, w1 = 0.026 - 0.014 * t1;
    m.cone({ tag: i === 0 ? 'tailhead' : 'tail', bone: 'tail' + i, a, b, ra: w0, rb: w1, k: i === 0 ? 0.03 : 0.008, thin: i >= TAIL_SEGS - 2 });
  }

  // ---------------------------------------------------------------- FLEECE
  if (F > 0.02) sculptFleece(m, J, params, F, { gw, nk, lk, heavy, merino, R, lamb, ram });
  return m;
}

// The wool volume: offsets of the body masses, boxed out into the sheep's silhouette, then broken into
// locks on its surface.
function sculptFleece(m, J, params, F, o) {
  const { gw, nk, heavy, merino, R } = o;
  const fleece = [];
  const add1 = (p) => { fleece.push(p); return p; };
  const kF = 0.035 + 0.25 * F;
  // torso: an offset rounded box (top line level, sides nearly vertical, bottom hanging)
  const side = 0.155 * gw + F, top = 0.685 + F * 0.72, bot = 0.305 - F * 0.3;
  const cy = (top + bot) / 2, hh = (top - bot) / 2;
  // three stacked slabs per section give the flat sides and the squared-off back of a sheep in wool
  const secs = [
    { bone: 'chest', z: 0.2, w: 0.9, t: 0, b: 0.02, rz: 0.16 + F * 0.7 },
    { bone: 'spine3', z: 0.03, w: 1, t: 0, b: -0.01, rz: 0.17 + F * 0.45 },
    { bone: 'spine2', z: -0.14, w: 1.02, t: 0, b: 0, rz: 0.15 + F * 0.4 },
    { bone: 'spine1', z: -0.28, w: 1.02, t: 0.005, b: 0.03, rz: 0.13 + F * 0.4 },
    { bone: 'pelvis', z: -0.4, w: 0.98, t: 0.0, b: 0.06, rz: 0.13 + F * 0.8 },
  ];
  for (const S of secs) {
    const hw = side * S.w, t = top - S.t, b = bot + S.b;
    const c = (t + b) / 2, h = (t - b) / 2;
    add1(m.ell({ tag: 'fleece', bone: S.bone, c: [0, c + h * 0.25, S.z], r: [hw * 0.98, h * 0.78, S.rz], k: kF }));
    add1(m.ell({ tag: 'fleece', bone: S.bone, c: [0, c - h * 0.28, S.z], r: [hw, h * 0.74, S.rz * 0.96], k: kF }));
    add1(m.ell({ tag: 'fleece', bone: S.bone, c: [0, t - hw * 0.45, S.z], r: [hw * 0.92, hw * 0.46, S.rz * 0.98], k: kF }));
  }
  // breast wool (between the forelegs, running up into the neck) and the britch (the back of the thighs)
  add1(m.ell({ tag: 'fleece', bone: 'chest', c: [0, 0.43, 0.3], r: [0.1 + F * 0.8, 0.13 + F * 0.6, 0.09 + F], k: kF }));
  add1(m.ell({ tag: 'woolbelly', bone: 'spine2', c: [0, cy - hh * 0.55, -0.06], r: [side * 0.82, hh * 0.45, 0.3 + F * 0.3], k: kF }));
  for (const s of [1, -1]) add1(m.ell({ tag: 'fleece', bone: 'pelvis', c: [0.065 * s, 0.5, -0.47], r: [0.075 + F * 0.8, 0.13 + F * 0.4, 0.075 + F * 0.95], k: kF }));
  // neck: a thick collar of wool; the head emerges from it behind the ears
  const nf = F * (merino ? 1 : 0.9);
  add1(m.ell({ tag: 'woolneck', bone: 'neck1', c: [0, 0.58, 0.33], r: [0.09 * nk + nf, 0.11 + nf, 0.1 + nf * 0.6], axis: norm(sub(J.neckMid, J.neckBase)), up: [0, 1, -0.6], k: kF }));
  add1(m.ell({ tag: 'woolneck', bone: 'neck1', c: [0, 0.66, 0.39], r: [0.07 * nk + nf, 0.085 + nf, 0.078 + nf * 0.32], axis: norm(sub(J.neckMid, J.neckBase)), up: [0, 1, -0.6], k: kF }));
  const collar = params.horns ? 0.035 : 0; // (a horned ram's wool starts further back: the horns curl there)
  const cc = lerp(J.neckMid, J.occiput, 0.44 - collar * 4);
  add1(m.ell({ tag: 'woolneck', bone: 'neck2', c: add(cc, [0, -0.012, -0.016]), r: [0.05 * nk + nf * 0.62, 0.05 + nf * 0.36, 0.048 + nf * 0.26], axis: norm(sub(J.occiput, J.neckMid)), up: [0, 1, -0.4], k: kF * 0.8 }));
  // the hood: the wool thins toward the head (a tapered sleeve from behind the ears back into the
  // collar), so the face comes out of a short, even edge of wool instead of a wall standing off the cheek
  // (its top stays level with the poll: the head stands out of the fleece, not inside a cowl)
  // (and a short ruff where it starts, standing 1.5-3 cm off the skin behind the jaw and the ear,
  // so the face has an edge: with the hood flush with the head the white face ran on into the neck)
  const hoodA = add(lerp(J.occiput, J.neckMid, 0.12 + collar * 3), [0, -0.058, -0.012]), hoodB = add(lerp(J.occiput, J.neckMid, 0.75), [0, -0.02, 0]);
  add1(m.cone({ tag: 'woolneck', bone: 'neck2', a: hoodA, b: hoodB, ra: 0.048 + nf * 0.3, rb: 0.058 * nk + nf * 0.6, k: kF * 0.6 }));
  // poll topknot (white-faced / Merino: a tuft of wool on the forehead)
  if ((params.topknot || 0) > 0.05) {
    const tk = params.topknot;
    add1(m.ell({ tag: 'woolpoll', bone: 'head', c: hl([0, 0.03, -0.055 + 0.015 * tk]), r: [0.032 + 0.018 * tk, 0.01 + F * 0.15 * tk, 0.028 + 0.022 * tk], axis: HZ, up: HY, k: 0.02 }));
  }
  // Merino: wool over the face to the eyes, the cheeks and down the legs
  if (merino) {
    for (const s of [1, -1]) add1(m.ell({ tag: 'woolcheek', bone: 'head', c: hl([0.036 * s, -0.035, -0.05]), r: [0.03 + F * 0.25, 0.045, 0.045], axis: HZ, up: HY, k: 0.025 }));
  }
  // legs: the wool covers the upper arm to the elbow, the thigh and the gaskin to above the hock
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S];
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S];
    const fl = F * (merino ? 0.85 : 0.7);
    add1(m.ell({ tag: 'woolarm', bone: 'humerus' + S, group: 'F' + S, c: add(lerp(Sh, E, 0.55), sx([0.008, 0, -0.01])), r: [0.045 + fl * 0.8, 0.1 + fl * 0.5, 0.06 + fl * 0.7], axis: norm(sub(E, Sh)), up: [0, 0, 1], k: kF }));
    add1(m.cone({ tag: 'woolleg', bone: 'radius' + S, group: 'F' + S, a: add(E, [0, 0.01, -0.01]), b: lerp(E, W, merino ? 0.75 : 0.28), ra: 0.035 + fl * 0.55, rb: 0.024 + fl * (merino ? 0.25 : 0.35), k: 0.03 }));
    add1(m.ell({ tag: 'woolthigh', bone: 'femur' + S, group: 'H' + S, c: add(lerp(Hp, K, 0.5), sx([0.02, -0.01, -0.04])), r: [0.05 + fl * 0.8, 0.14 + fl * 0.4, 0.1 + fl * 0.8], axis: norm(sub(K, Hp)), up: [0, 0, 1], k: kF }));
    add1(m.cone({ tag: 'woolleg', bone: 'tibia' + S, group: 'H' + S, a: add(K, sx([0.0, 0.0, -0.03])), b: add(lerp(K, Hk, merino ? 0.85 : 0.62), [0, 0, -0.012]), ra: 0.045 + fl * 0.6, rb: 0.026 + fl * (merino ? 0.3 : 0.35), k: 0.03 }));
  }
  // tail wool
  const tailLen = params.tailLen ?? 0.34;
  for (let i = 0; i < TAIL_SEGS; i++) {
    const t0 = i / TAIL_SEGS, t1 = (i + 1) / TAIL_SEGS;
    const a = J['tail' + i], b = J['tail' + (i + 1)];
    const wf = Math.min(F, 0.04) * (tailLen > 0.15 ? 0.6 : 1.2);
    add1(m.cone({ tag: 'wooltail', bone: 'tail' + i, a, b, ra: 0.03 + wf * (1 - 0.3 * t0), rb: 0.03 * (1 - 0.35 * t1) + wf * (1 - 0.3 * t1), k: i === 0 ? 0.022 : 0.012, thin: i >= TAIL_SEGS - 2 }));
  }
  // Merino skin folds: rings of wool around the neck ("necklace") and over the breast
  const folds = merino ? (params.folds ?? 0.6) : 0;
  if (folds > 0.05) {
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.22;
      const c = lerp(J.neckBase, J.occiput, t * 0.8);
      const rr = (0.075 * nk + nf) * (1.02 - 0.2 * t);
      add1(m.ell({ tag: 'fold', bone: t < 0.45 ? 'neck1' : 'neck2', c: add(c, [0, -0.01, 0.01]), r: [rr + 0.012 * folds, rr * 1.1 + 0.012 * folds, 0.018 + 0.008 * folds], axis: norm(sub(J.occiput, J.neckBase)), up: [0, 1, -0.5], k: 0.03 }));
    }
  }

  // ---- locks: a Poisson-disc scatter of staple bundles over the fleece surface
  if (F < 0.016) return;
  const rl = lockRadius(F, merino); // lock radius
  const spacing = rl * 1.55;
  const list = fleece.filter((p) => !p.carve);
  const f = (p) => SDFModel.evalList(list, p[0], p[1], p[2]);
  const grad = (p) => {
    const e = 0.001;
    return norm([f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]), f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]), f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])]);
  };
  const cell = spacing;
  const hash = new Map();
  const key = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  const near = (p) => {
    const i0 = Math.floor(p[0] / cell), j0 = Math.floor(p[1] / cell), k0 = Math.floor(p[2] / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const L = hash.get(`${i0 + i},${j0 + j},${k0 + k}`);
      if (L) for (const q of L) if (Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < spacing) return true;
    }
    return false;
  };
  // area weights: the big torso slabs get most of the samples
  const wts = list.map((p) => (p.type === 0 ? p.P[12] * p.P[13] + p.P[13] * p.P[14] + p.P[12] * p.P[14] : 0.02));
  const wsum = wts.reduce((a, b) => a + b, 0);
  const tries = Math.round(Math.min(16000, 10 * wsum * 4 / (spacing * spacing)));
  const locks = [];
  for (let n = 0; n < tries; n++) {
    let x = R() * wsum, pi = 0;
    while (pi < list.length - 1 && x > wts[pi]) { x -= wts[pi]; pi++; }
    const pr = list[pi];
    let p;
    if (pr.type === 0) {
      // a random point on the ellipsoid's surface
      const u = norm([R() * 2 - 1, R() * 2 - 1, R() * 2 - 1]);
      const P = pr.P;
      p = [0, 1, 2].map((a) => P[a] + P[3 + a] * u[0] * P[12] + P[6 + a] * u[1] * P[13] + P[9 + a] * u[2] * P[14]);
    } else {
      const P = pr.P, t = R();
      p = [P[0] + P[3] * t + (R() - 0.5) * 0.05, P[1] + P[4] * t + (R() - 0.5) * 0.05, P[2] + P[5] * t + (R() - 0.5) * 0.05];
    }
    // project onto the fleece surface
    let ok = true;
    for (let it = 0; it < 6; it++) {
      const d = f(p);
      if (Math.abs(d) < 3e-4) break;
      const g = grad(p);
      p = sub(p, mul(g, d));
      if (it === 5 && Math.abs(f(p)) > 0.003) ok = false;
    }
    if (!ok) continue;
    // not on the face / in front of the collar, not under the hooves
    // (and none at the hood's edge: lumps there stood off the cheek like a wall)
    // (and clear of the head / body hand-over band)
    if (neckS(p[0], p[1], p[2]) > -0.03) continue;
    if (p[1] < 0.1) continue;
    if (near(p)) continue;
    const kk = key(p);
    if (!hash.has(kk)) hash.set(kk, []);
    hash.get(kk).push(p);
    // owning primitive (bone and group) = the nearest fleece primitive
    let best = null, bd = 1e9;
    for (const q of list) { const d = SDFModel.dist(q, p[0], p[1], p[2]); if (d < bd) { bd = d; best = q; } }
    locks.push({ p, n: grad(p), owner: best });
  }
  for (const L of locks) {
    const n = L.n;
    // staples fall down the sides, run back along the top; each lock a little different
    const fall = stapleFall(n, L.p, J);
    // (smaller toward the head, where the scatter stops: full-size locks ending on a line drew a long crevice
    // and a step in the staple length across the collar)
    const r = rl * (0.8 + 0.4 * R()) * (0.35 + 0.65 * smoothstep(-0.03, -0.1, neckS(L.p[0], L.p[1], L.p[2])));
    const onLeg = L.owner.group !== 'axial';
    // (low, staple-shaped blocks blended well in: an even fleece with soft creases between the staples,
    // not deep cauliflower lumps whose crevices shadow into dark blotches under a low sun)
    const c = sub(L.p, mul(n, r * (0.82 + 0.08 * R())));
    m.ell({
      tag: onLeg ? 'lockleg' : 'lock', bone: L.owner.bone, group: L.owner.group,
      c, r: [r, r * 0.9, r * (1.3 + 0.35 * R())], axis: fall, up: n, k: 0.01 + 0.3 * r,
    });
  }
}

// Dewclaws: two small horny knobs behind the fetlock
function sculptDewclaws(m, bone, group, M, s) {
  for (const k of [1, -1]) m.sphere({ tag: 'dewclaw', bone, group, c: add(M, [0.009 * k * s, -0.006, -0.02]), rad: 0.0052, k: 0.004 });
}

// Cloven hoof: two claws (digits III and IV) with a cleft between them, the front wall parallel to
// the pastern, heel bulbs behind, flat on the ground.
function sculptHoof(m, bone, group, C, T, w, s) {
  const zc = (C[2] + T[2]) * 0.5;
  for (const k of [1, -1]) {
    const x = C[0] + 0.0102 * k * w;
    const top = [x, C[1] + 0.008, C[2] - 0.004];
    const toe = [x - 0.002 * k, 0.006, T[2] - 0.004];
    const heel = [x, 0.008, C[2] - 0.015];
    m.cone({ tag: 'hoof', bone, group, a: top, b: toe, ra: 0.0112 * w, rb: 0.0052 * w, k: 0.006 });
    m.cone({ tag: 'hoof', bone, group, a: heel, b: [toe[0], 0.006, zc + 0.004], ra: 0.0108 * w, rb: 0.0088 * w, k: 0.008 });
    m.sphere({ tag: 'heelbulb', bone, group, c: [x, 0.013, C[2] - 0.019], rad: 0.0102 * w, k: 0.008 });
  }
  m.cone({ tag: 'coronet', bone, group, a: add(C, [0, 0.012, -0.01]), b: add(C, [0, 0.006, 0.008]), ra: 0.0165 * w, rb: 0.0165 * w, k: 0.008 });
  m.ell({ tag: 'cleft', bone, group, c: [C[0], 0.006, zc + 0.012], r: [0.0022, 0.02, 0.028], k: 0.002, carve: true });
  m.ell({ tag: 'sole', bone, group, c: [C[0], -0.1 + 0.001, zc], r: [0.1, 0.1, 0.1], k: 0.002, carve: true });
  void s;
}
