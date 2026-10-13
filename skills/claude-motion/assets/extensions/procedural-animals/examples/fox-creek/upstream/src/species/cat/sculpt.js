// The domestic cat, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). Compared
// with the cheetah (the template): a much smaller animal with a big round head (short muzzle, puffy
// whisker pads, huge forward-facing eyes, tall triangular ears), a stocky rounded body with a low
// belly (the primordial pouch between the hind legs), thick short legs on round paws, and a long
// even tail. Longhaired individuals get a sculpted ruff, britches and a plumed tail under the coat.
import { HEAD_O, TAIL_SEGS, hl } from './rig.js';
import { add, sub, mul, lerp, norm, cross, dot, clamp } from '../../core/math/vec.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader (head-local, left eye).
// Globe ~20 mm (r 10.2 mm), cornea ~15 mm (iris radius 7.5 mm) filling the palpebral fissure
// (~14.8 x 11.5 mm: 0.4 x 0.31 of the inter-pupil distance in frontal photos; no sclera shows), eyes ~37 mm apart, facing almost straight ahead (yaw ~7 deg),
// the fissure tilted a little (inner corner lower).
// (the eyeball 1.5 mm further back than an earlier build's: its front 4.4 mm proud of the head surface without the lid prims,
// was 7.0) (the fissure 14.7 x 11.5 mm, as measured: 15.8 x 12.5 drew the eyes
// ~20 % wider than face1's and face2's at the same inter-pupil distance; the iris fills its width)
export const EYE_BASE = { c: [0.0185, 0.0, 0.011], r: 0.0105, back: 0.0027, yaw: 0.12, pitch: 0.02, lid: 0.001, R: 0.0076, d: 0.00185, off: -0.0003, tilt: (9 * Math.PI) / 180, irisZ: 0.0063, irisR: 0.0074 };
export const eyeOf = () => EYE_BASE;

const X = [1, 0, 0];

// ear frame (shared with the coat): base, tip, up (along the pinna), facing (its concave front), across
export function earFrame(J, S) {
  const s = S === 'L' ? 1 : -1;
  const base = J['earBase' + S], tip = J['earTip' + S];
  const up = norm(sub(tip, base));
  let f = norm([0.42 * s, 0.05, 1]);
  f = norm(sub(f, mul(up, dot(f, up))));
  const across = norm(cross(up, f)); // in the pinna plane, perpendicular to the ear's axis
  return { base, tip, up, f, across, s, h: Math.hypot(...sub(tip, base)) };
}

export function sculptCat(m, rig, params = {}) {
  const J = rig.J;
  const EYE = eyeOf(params);
  const lh = params.longhair ? 1 : 0;
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // ---------------------------------------------------------------- TORSO
  // a round, barrel-shaped trunk: chest ~10 cm wide and 11-12 cm deep (research: ~0.5 x the withers), its
  // floor at the elbows, the back rising a little to the hips, the belly hanging a little lower behind the
  // ribs (primordial pouch); (the chest floor 2 cm below the elbows read as a munchkin)
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.169, 0.034], r: [0.05, 0.056, 0.074], axis: norm([0, 0.1, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.146, 0.082], r: [0.031, 0.035, 0.036], axis: norm([0, -0.35, 1]), k: 0.02 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.152, 0.104], r: [0.036, 0.032, 0.025], k: 0.017 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.212, 0.07], r: [0.022, 0.02, 0.045], axis: norm([0, -0.08, 1]), k: 0.02 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.213, -0.01], r: [0.03, 0.02, 0.058], k: 0.02 });
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.163, -0.058], r: [0.049, 0.05, 0.07], axis: norm([0, 0.12, -1]), k: 0.022 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.209, -0.085], r: [0.029, 0.02, 0.06], k: 0.017 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.168, -0.11], r: [0.042, 0.04, 0.045], k: 0.017 });
  m.ell({ tag: 'pouch', bone: 'spine1', c: [0, 0.126, -0.098], r: [0.027, 0.018, 0.042], axis: norm([0, 0.2, -1]), k: 0.022 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.184, -0.15], r: [0.041, 0.034, 0.045], k: 0.02 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.203, -0.146], r: [0.026, 0.017, 0.042], k: 0.014 });
  for (const s of [1, -1]) {
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.017 * s, 0.168, -0.182], r: [0.019, 0.029, 0.021], k: 0.014 });
  }

  // ---------------------------------------------------------------- NECK (short, thick, furred)
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.178, 0.096], b: [0, 0.208, 0.134], ra: 0.038, rb: 0.031, k: 0.02 });
  m.cone({ tag: 'neck', bone: 'neck2', a: [0, 0.208, 0.134], b: hl([0, -0.008, -0.03]), ra: 0.031, rb: 0.027, k: 0.014 });
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.226, 0.122], r: [0.022, 0.012, 0.04], axis: norm([0, 0.3, 1]), k: 0.014 });
  m.ell({ tag: 'throat', bone: 'neck1', c: [0, 0.172, 0.142], r: [0.025, 0.026, 0.03], axis: norm([0, 0.8, 0.6]), k: 0.017 });
  m.ell({ tag: 'throat', bone: 'neck2', c: hl([0, -0.031, -0.022]), r: [0.021, 0.013, 0.023], k: 0.01 });
  if (lh) {
    // longhair: the ruff (a collar of long hair round the neck and chest) and the frill under the chin
    // (the fur makes most of the ruff, 3.8x the shorthair's: a smaller skin collar than an earlier, larger one, whose skin far from the
    // neck axis stretched > 3x when the neck bent, longhair seeds 19 / 27 at 4.1 %)
    m.ell({ tag: 'ruff', bone: 'neck1', c: [0, 0.172, 0.126], r: [0.037, 0.036, 0.035], axis: norm([0, 0.6, 1]), k: 0.02 });
    m.ell({ tag: 'ruff', bone: 'neck2', c: hl([0, -0.03, -0.028]), r: [0.026, 0.017, 0.019], k: 0.014 });
  }

  // ---------------------------------------------------------------- HEAD (head-local coords, see HEAD_O)
  // landmarks from frontal / profile photos, in units of the inter-pupil distance (37 mm): face 2.45
  // wide at the cheeks (with fur), eye level -> skull top 0.6, -> nose tip 0.55 down / 0.8 ahead,
  // -> chin 0.9; ears set out on the corners of the skull, their outer base at eye level.
  // Head-local: eyes (+-0.0185, 0, 0.011), nose tip (0,-0.02,0.043), whisker pads (+-0.009,-0.026,0.031),
  // chin (0,-0.035,0.027), skull top 0.022, occiput -0.049, cheeks +-0.04 (toms: wider jowls, params.jowl)
  const H = { bone: 'head' };
  const jw = params.jowl || 1;
  const HL = (v) => hl([v[0] / 1000, v[1] / 1000, v[2] / 1000]); // head-local millimetres
  // (the cheek, malar, whisker pads, lips, jowls and muzzle are their own skin group on the head bone (rig.js appendage
  // 'lips'): the occiput blend's ventral lever gave the lips and jowls 8-30 % neck2 weight while the lower jaw is rigid on
  // the head, and a kitten's mouth corner opened into a dark slit when its head pitched against the neck)
  const LIPS = { group: 'lips' };
  const E3 = (tag, c, r, k, o = {}) => m.ell({ ...H, tag, c: HL(c), r: r.map((v) => v / 1000), k: k / 1000, ...o });
  // The cat's face is flat and broad: the skull is a round dome rising ~28 mm above the eyes, the big eyes
  // face forward from a wide face (skin ~72 mm across the zygomatic arches, ~95 mm with the cheek fur),
  // the short nose bridge runs from the stop between the eyes (level with the corneas) to the nose leather
  // ~18 mm ahead of the cornea, and the muzzle is two round whisker pads that merge into the cheeks; the
  // chin is small and set back. The skin round each eye comes up to the lid margins on every side (brow,
  // canthus, malar, nose bridge), so only the domed cornea shows between the lids.
  // skull: the braincase and the flat forehead between and above the eyes
  E3('cranium', [0, 7, -19], [25, 21.5, 29], 14);
  E3('forehead', [0, 12, 3], [19, 12, 13.5], 10);
  // the short nose bridge, from the stop between the eyes down and forward to the nose leather
  m.cone({ ...H, tag: 'nasal', a: HL([0, -1, 12.5]), b: HL([0, -15.5, 27.5]), ra: 0.007, rb: 0.0055, k: 0.007 });
  for (const s of [1, -1]) {
    E3('temple', [14 * s, 7, -18], [17, 16, 24], 12);
    // the brow over the upper lid (1.5 mm further forward and lower than first built, over the lid: the eye sits in the face, not
    // on it), and its lateral end toward the ear
    E3('brow', [17 * s, 10, 8.5], [11, 5.5, 7.5], 6);
    E3('brow', [26 * s, 8, -2], [9, 7, 11], 8);
    // the lateral canthus: skin beside the eye comes forward to the lid (no globe side showing; 2 mm further forward
    // than first built: the lid shell stood alone at the outer corner, a beak with a groove behind it)
    E3('canthus', [26.5 * s, 0.5, 4], [8, 9, 10], 8);
    // zygomatic arch: behind and below the eye, the widest point of the skull
    E3('zygomatic', [25 * s, -5, -4], [11.5, 8.5, 16], 10, { axis: norm([-0.35 * s, 0, 1]) });
    // cheek: the masseter below the arch (toms: fat jowls, params.jowl)
    // (the face is wider at the zygomatic arch instead: 2 mm wider here pushed its back end through the head / neck
    // overlap at the side of the neck, open edges at the low tier)
    E3('cheek', [21 * s * jw, -16, -12], [12.5 * jw, 12, 20], 12, LIPS);
    // the flat face below the eye, from the lower lid down to the whisker pad (1 mm further forward raised the tuxedo's
    // near-edge stretch at the white muzzle's edge in sleep by 1 %: it stays)
    E3('malar', [16 * s, -13, 8.5], [11, 8, 8], 8, LIPS);
    E3('mastoid', [19 * s, -12, -31], [12, 14, 14], 12);
    // the whisker pads: two round cushions either side of the philtrum
    E3('whisker', [8.5 * s, -22.5, 23.5], [9.5, 7, 7.5], 5, LIPS);
    // the face below the eye runs down into the whisker pad and the lip without a crease: the malar and cheek bulge
    // ended in a steep front edge over the flat side of the pad and lip (skin 7 mm deeper over 3 mm at y -18..-21),
    // a sunken pocket below the eye toward the mouth corner
    E3('mystacial', [13 * s, -22, 13], [8, 7, 9], 8, LIPS);
    E3('lip', [11 * s, -28.5, 19], [6.5, 4, 10], 4, { axis: norm([-0.4 * s, -0.1, 1]), ...LIPS });
    // the lower cheek over the jaw behind the mouth corner: the lower jaw's side stays under it (no
    // pocket at the corner of the mouth)
    E3('jowl', [14 * s, -26, -2], [9 * jw, 6.5, 14], 8, { axis: norm([-0.38 * s, -0.12, 1]), ...LIPS });
    // the throat below the angle of the jaw is full (glands, loose skin): the jowl runs down into it without
    // an undercut (the cheek's fur hung over a crease there and read as a pad with a dark rim)
    // (a tom's fat jowls sit on a thick neck: the fill grows faster than the cheek)
    const tj = jw - 1;
    m.ell({ tag: 'throat', bone: 'neck2', c: HL([(19 + 20 * tj) * s, -30 - 6 * tj, -17]), r: [0.0095 + 0.014 * tj, 0.009 + 0.006 * tj, 0.015], k: 0.012 });
    // (the side of the neck behind a jowled cheek: a cobby tom's jowl stood 6-8 mm proud of the head / neck junction behind
    // it, a waist its hair could not fill, and the cheek read as a round disc with its own outline; the fill grows with the jowl)
    const fk = clamp((jw - 1) / 0.19, 0, 1);
    m.ell({ tag: 'jowlneck', bone: 'neck2', c: HL([(19 + 5 * fk) * s, -21, -38]), r: [0.009 + 0.0035 * fk, 0.014, 0.02], k: 0.014 });
  }
  // the muzzle mass behind the whisker pads, merging into the cheeks
  E3('muzzle', [0, -19, 17], [15, 10.5, 12], 7, LIPS);
  E3('nose', [0, -19, 32.5], [5.9, 4.3, 3.6], 3, { axis: norm([0, 0.2, 1]) });
  E3('philtrum', [0, -23.5, 29.5], [3.5, 4, 3], 3);
  for (const s of [1, -1]) {
    // eyelids: a thin skin shell hugging the eyeball, cut open along an almond aperture 0.5 mm outside the
    // shader's, so the dark lid margin the eye shader paints on its moving lids is the eyeliner: it descends
    // with a blink and becomes the seam of a shut eye (a static line on the mesh rim ringed a shut eye like
    // a coin)
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    // the lids: a thin shell hugging the eyeball (0.7 mm over it, blended over 3.5 mm), with the brow and the canthus
    // brought forward to meet it, so the skin runs from the face into the lid margin without a ridge. (A first
    // shell, 12.3 x 11 x 11.5 mm blended over 8 mm, stood as a thick lip 2-2.5 mm over the eyeball at the corners,
    // and an orbit hollow carved in front of the eye dropped the face away behind it: every eye sat in a raised ring,
    // a round button standing out of the face)
    ellY({ ...H, tag: 'eyelid', c: ef.c, ydir: ef.y, lateral: ef.x, r: [0.0112, 0.0112, 0.0112], k: 0.0035 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R + 0.0005, d: EYE.d, zMin: -0.0016, zMax: 0.02, k: 0.0009, carve: true });
    m.sphere({ ...H, tag: 'nostril', c: HL([2.7 * s, -20.3, 35.3]), rad: 0.0012, k: 0.0008, carve: true });
    // third eyelid (nictitating membrane): a narrow, pigmented sliver deep in the inner corner of the eye
    // (the frame's x points to world +X for both eyes: the medial corner is at -x for the left eye)
    const inner = at(-0.0076 * s, -0.0012, 0.0058);
    m.ell({ ...H, tag: 'nictitans', c: inner, axis: ef.z, up: ef.y, r: [0.0012, 0.0026, 0.0017], k: 0.0005 });
  }

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  // a narrow V of two rami meeting at a small chin tucked under the upper lip; the floor between them
  // (the underside of the jaw) runs back into the throat
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  // (the chin tucked 2-3 mm behind the upper lip and no lower than the lip line: a small rounded chin under
  // the mouth, not a lump standing out below the muzzle)
  // (a slim jaw: its underside only ~2 mm below the head's, so it meets the throat without a shelf)
  m.cone({ ...JW, tag: 'mandible', a: HL([0, -27, -8]), b: HL([0, -29.6, 17.5]), ra: 0.0047, rb: 0.0036, k: 0 });
  for (const s of [1, -1]) {
    m.cone({ ...JW, tag: 'mandible', a: HL([12.5 * s, -23.5, -12]), b: HL([4.5 * s, -29, 18]), ra: 0.004, rb: 0.003, k: 0.005 });
  }
  m.ell({ ...JW, tag: 'chin', c: HL([0, -29.9, 19]), r: [0.0046, 0.0031, 0.0042], k: 0.005 });
  // the floor between the rami, as wide as the head's underside behind the chin: the slim keel alone stood as an island
  // in a channel between the lip lobes, seen from below
  m.ell({ ...JW, tag: 'jawfloor', c: HL([0, -29.6, 7]), r: [0.0145, 0.0037, 0.0135], k: 0.004 });

  // ---------------------------------------------------------------- EARS
  // tall triangular pinnae (~5 cm), thin, cupped forward; the base rounds into the skull
  for (const S of ['L', 'R']) {
    const E = earFrame(J, S);
    const ear = { bone: 'ear' + S, group: 'ear' + S };
    const hk = E.h;
    const w = 0.022 * (params.ear || 1);
    // outline in the pinna plane (u across: + toward the outer edge; v up the ear), the tip gently rounded
    const outer = dot(E.across, [E.s, 0, 0]) >= 0 ? 1 : -1;
    const poly = [[-w * 0.92, -0.004], [w, -0.004], [w * 0.55, hk * 0.5], [w * 0.16, hk * 0.93], [0, hk * 1.02], [-w * 0.14, hk * 0.93], [-w * 0.5, hk * 0.5]].map(([u, v]) => [u * outer, v]);
    m.fin({ ...ear, tag: 'ear', o: add(E.base, mul(E.f, -0.0006)), u: E.across, v: E.up, poly, t: 0.0034, round: 0.0014, k: 0.004, thin: true });
    // rounded back of the pinna base and the cup of the concha
    const eh = hk / 0.0352; // (the cup and the rounded back were fitted to a 35 mm pinna)
    m.ell({ ...ear, tag: 'earback', c: add(add(E.base, mul(E.up, 0.009 * eh)), mul(E.f, -0.0035)), axis: E.f, up: E.up, r: [0.0165, 0.013 * eh, 0.0045], k: 0.005, thin: true });
    // (the cup starts at the pinna's base: reaching below it, it dug a round crater into the side of the skull
    // in front of the ear)
    m.ell({ ...ear, tag: 'earinner', c: add(add(E.base, mul(E.up, 0.53 * hk)), mul(E.f, 0.0107)), axis: E.f, up: E.up, r: [0.0165, 0.5 * hk, 0.0105], k: 0.0015, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  const toeX = [-0.0105, -0.0036, 0.0036, 0.0105], toeZ = [-0.0038, 0, 0, -0.0038];
  const lt = params.limb || 1; // lower-leg thickness (the cobby blue's thick legs)
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    // front
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.003, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.0095, 0.036, 0.022], k: 0.02, bias: 0.0013 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.0175, rb: 0.0132, k: 0.02 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.01]), ydir: sub(E, Sh), lateral: lat, r: [0.0142, 0.029, 0.0165], k: 0.017 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.003, -0.009]), rad: 0.0072, k: 0.007 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.0126 * lt, rb: 0.0081 * lt, k: 0.009 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.27), sx([0.0015, 0, 0.0015])), ydir: sub(W, E), lateral: lat, r: [0.0124 * lt, 0.026, 0.0134 * lt], k: 0.01 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0, -0.0012]), rad: 0.0082 * lt, k: 0.004 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.0035, -0.0068]), rad: 0.0033, k: 0.003 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.0079 * lt, rb: 0.0078 * lt, k: 0.004 });
    m.sphere({ tag: 'dewclaw', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.3), sx([-0.0068, 0, 0.0015])), rad: 0.0026, k: 0.002 });
    const dp = norm(sub(T, M));
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.0075)), [0, -0.0015, 0]), ydir: dp, lateral: lat, r: [0.0128, 0.0138, 0.0072], k: 0.005 });
    m.sphere({ tag: 'pad', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.0068, 0.0028]), rad: 0.0054, k: 0.003 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + toeX[i] * s, 0.0054, T[2] - 0.0042 + toeZ[i]], rad: 0.0051, k: 0.0025 });

    // hind
    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // meaty thighs: a broad teardrop rising into the flank and croup; the flank fold webs the stifle
    // to the low belly
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.34), sx([0.002, 0, -0.012])), ydir: sub(K, Hp), lateral: lat, r: [0.0185, 0.047, 0.037], k: 0.017, bias: 0.0013 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.016, 0.186, -0.098]), b: add(K, sx([-0.0012, 0.018, 0.0])), ra: 0.0138, rb: 0.009, k: 0.02 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.017, 0.188, -0.186]), b: add(lerp(K, Hk, 0.1), [0, 0.006, -0.011]), ra: 0.0158, rb: 0.0095, k: 0.013 }); // (ends at the stifle: femur skin below the knee tore when it bent)
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.019, 0.14, -0.085]), ydir: [-0.03, 0.16, 0.1], lateral: lat, r: [0.0075, 0.028, 0.0135], k: 0.02 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.0007, 0.0027, 0.002])), rad: 0.0068, k: 0.013 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.06), sx([0.0, 0.0, 0.0013])), b: Hk, ra: 0.0095 * lt, rb: 0.0068 * lt, k: 0.01 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.0007, 0.0035, -0.009])), ydir: sub(Hk, K), lateral: lat, r: [0.0102 * lt, 0.024, 0.0115 * lt], k: 0.012 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.5), [0, 0.0033, -0.0115]), b: add(Hk, [0, 0.004, -0.0095]), ra: 0.0042, rb: 0.0038, k: 0.005 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.004, -0.0085]), rad: 0.0052, k: 0.004 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.0072 * lt, k: 0.004 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: Hk, b: Mt, ra: 0.0071 * lt, rb: 0.007 * lt, k: 0.004 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.007)), [0, -0.0015, 0]), ydir: dh, lateral: lat, r: [0.012, 0.0132, 0.007], k: 0.005 });
    m.sphere({ tag: 'pad', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.0068, 0.0026]), rad: 0.0051, k: 0.003 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + toeX[i] * 0.94 * s, 0.0052, Tt[2] - 0.004 + toeZ[i]], rad: 0.0049, k: 0.0025 });
    if (lh) {
      // longhair britches: long hair on the back of the thighs
      ellY({ tag: 'britches', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.55), sx([0.004, -0.004, -0.027])), ydir: sub(K, Hp), lateral: lat, r: [0.012, 0.03, 0.014], k: 0.014 }); // (smaller than first built: the fur makes the britches; the skin behind the thigh stretched > 3x)
    }
  }

  // ---------------------------------------------------------------- TAIL
  // an even, cylindrical tail ~1 cm thick under the coat, tapering only near the tip
  const tb = lh ? 1.25 : 1;
  const tailR = (t) => tb * (t < 0.15 ? 0.0122 - 0.012 * t : t < 0.85 ? 0.0104 - 0.0024 * ((t - 0.15) / 0.7) : 0.008 - 0.014 * (t - 0.85));
  m.cone({ tag: 'tailroot', bone: 'tail0', a: [0, 0.19, -0.158], b: J.tail1, ra: 0.016, rb: tailR(0.08), k: 0.013 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: tailR(i / TAIL_SEGS), rb: tailR((i + 1) / TAIL_SEGS), k: 0, thin: i >= TAIL_SEGS - 3 });
  }

  return m;
}
