// The lion, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw).
// Heavy build: a broad, deep chest, thick forearms and big paws, a long level back, a massive head
// with a broad straight muzzle. The male's mane is sculpted volume (the shells add the hair on top
// of it), sized by params.mane (0 lioness / cub .. 1 full black-fringed mane).
import { HEAD_O, TAIL_SEGS, HS, hl, fe, FACE } from './rig.js';
import { add, sub, mul, lerp, norm, cross, rng, len } from '../../core/math/vec.js';
import { SDFModel } from '../../core/sdf/sdf.js';
import { eyeFrameOf } from '../../core/sdf/eyeSocket.js';

// Eye geometry shared by the sculpt (lids + aperture) and the eyeball shader (head-local, left eye).
// Measured on face_female1 / face_male1 in units of the eye separation E (0.129 m): the opening inside the
// black lid margins 0.25-0.27 E wide and 0.17-0.19 E tall (36 x 21 mm), the iris 0.15-0.19 E across (23 mm),
// the upper lid over the top of the iris (the opening set 3 mm low over a 26 mm iris: the lids cut its top ~20 %, face_female1 /
// face_male1; a 23 mm iris in a round opening read as a staring cartoon eye), the inner corner low (tilt 14 deg);
// eyes set forward (yaw 0.15 rad).
// (A 46 x 22 mm slit over a 39 mm iris: the lids always cut the iris, a sleepy look.)
export const EYE = { c: [0.05 * 1.12 * 1.15, 0.047 * 1.15, 0.05 * 1.15], r: 0.0235, back: 0.0133, yaw: 0.15, pitch: 0.03, lid: 0.002, R: 0.0225, d: 0.0135, off: -0.0035, tilt: (14 * Math.PI) / 180, irisZ: 0.019, irisR: 0.0128 };

const X = [1, 0, 0];
const smoothstep01 = (t) => Math.min(1, Math.max(0, t / 0.45)); // (0 at the ear's base .. 1 from its middle up)

export function sculptLion(m, rig, params = {}) {
  const J = rig.J;
  const mane = params.mane || 0; // 0..1 mane volume
  const male = params.sex === 'male' && !params.juv ? 1 : 0;
  const juv = params.juv || 0;
  const eyeFrame = (s) => eyeFrameOf(EYE, HEAD_O, s);

  // Ellipsoid whose local Y follows `ydir`; radii = [lateral, along ydir, third axis]
  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };

  // ---------------------------------------------------------------- TORSO
  // broad, deep chest (brisket ~0.45 m above the ground), level back, low belly line with a loose
  // skin fold ("primordial pouch") in front of the hind legs
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.745, 0.12], r: [0.145, 0.245, 0.33], axis: norm([0, 0.12, -1]), k: 0 });
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.59, 0.3], r: [0.1, 0.12, 0.14], axis: norm([0, -0.35, 1]), k: 0.08 });
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.625, 0.41], r: [0.11, 0.13, 0.1], k: 0.07 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.955, 0.3], r: [0.085, 0.08, 0.2], axis: norm([0, -0.08, 1]), k: 0.08 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.965, 0.0], r: [0.11, 0.07, 0.25], k: 0.08 });
  // (a level underline from the brisket to the flank fold, no dog's tuck: side_walk_male3 / male2)
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.735, -0.24], r: [0.135, 0.215, 0.29], axis: norm([0, 0.18, -1]), k: 0.09 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.955, -0.34], r: [0.105, 0.075, 0.25], k: 0.07 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.79, -0.45], r: [0.12, 0.12, 0.14], k: 0.07 });
  const bk = params.belly ?? 1; // (individual: small .. heavy belly fold)
  m.ell({ tag: 'pouch', bone: 'spine1', c: [0, 0.6 + 0.02 * (1 - male) + 0.015 * (1 - bk), -0.36], r: [0.085, (0.07 - 0.015 * (1 - male)) * (0.75 + 0.25 * bk), 0.16], axis: norm([0, 0.2, -1]), k: 0.09 });
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.885, -0.64], r: [0.125, 0.14, 0.19], k: 0.08 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.975, -0.63], r: [0.09, 0.06, 0.17], k: 0.06 });
  // a faint ridge along the spine (the dorsal processes; a lion asleep on its side read as a smooth
  // sausage from its back)
  const SPN = [[[0, 1.0, 0.3], 'chest'], [[0, 1.018, 0.08], 'spine3'], [[0, 1.012, -0.2], 'spine2'], [[0, 1.008, -0.42], 'spine1'], [[0, 1.018, -0.6], 'pelvis']];
  for (let i = 0; i < SPN.length - 1; i++) m.cone({ tag: 'spine', bone: SPN[i][1], a: SPN[i][0], b: SPN[i + 1][0], ra: 0.024, rb: 0.024, k: 0.03 });
  for (const s of [1, -1]) {
    // the wings of the ilium either side of the loin
    // (stronger: a lion asleep on its side still read as a smooth tube from behind)
    m.ell({ tag: 'ilium', bone: 'pelvis', c: [0.08 * s, 0.997, -0.53], r: [0.052, 0.048, 0.08], k: 0.04 }); // (still a log at medium)
    // (the buttocks below and in front of the tail root, not a square rear face behind it)
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.07 * s, 0.81, -0.755], r: [0.066, 0.11, 0.063], k: 0.06 });
  }

  // ---------------------------------------------------------------- NECK (short and thick; males thicker)
  const nk = 1 + 0.12 * male;
  m.cone({ tag: 'neck', bone: 'neck1', a: [0, 0.8, 0.43], b: [0, 0.9, 0.585], ra: 0.14 * nk, rb: 0.115 * nk, k: 0.08 });
  m.cone({ tag: 'neck', bone: 'neck2', a: [0, 0.9, 0.585], b: hl([0, 0.0, -0.1]), ra: 0.115 * nk, rb: 0.1 * nk, k: 0.06 });
  m.ell({ tag: 'nape', bone: 'neck1', c: [0, 0.95, 0.54], r: [0.07, 0.05, 0.15], axis: norm([0, 0.35, 1]), k: 0.06 });
  m.ell({ tag: 'throat', bone: 'neck1', c: [0, 0.73, 0.57], r: [0.085, 0.1, 0.12], axis: norm([0, 0.8, 0.6]), k: 0.07 });
  m.ell({ tag: 'throat', bone: 'neck2', c: hl([0, -0.095, -0.075]), r: [0.07, 0.055, 0.09], k: 0.05 });

  // ---------------------------------------------------------------- MANE (sculpted coat volume)
  if (mane > 0) {
    const g = mane;
    // collar round the whole neck, fullest at the sides and throat, hanging down the chest
    m.ell({ tag: 'mane', bone: 'neck1', c: [0, 0.87, 0.53], r: [0.17 + 0.11 * g, 0.2 + 0.1 * g, 0.18 + 0.07 * g], axis: norm([0, 0.55, 1]), k: 0.13 });
    // crest: long hair standing over the nape and between the shoulders
    m.ell({ tag: 'mane', bone: 'neck2', c: [0, 1.0 + 0.07 * g, 0.63], r: [0.11 + 0.08 * g, 0.08 + 0.07 * g, 0.17 + 0.05 * g], axis: norm([0, 0.3, 1]), k: 0.12 });
    m.ell({ tag: 'mane', bone: 'chest', c: [0, 0.96 + 0.025 * g, 0.38], r: [0.13 + 0.08 * g, 0.075 + 0.035 * g, 0.16 + 0.08 * g], axis: norm([0, 0.2, 1]), k: 0.13 });
    // bib under the throat and down the chest between the forelegs
    m.ell({ tag: 'mane', bone: 'neck1', c: [0, 0.7 - 0.02 * g, 0.585], r: [0.13 + 0.045 * g, 0.13 + 0.06 * g, 0.1 + 0.05 * g], axis: norm([0, 0.8, 0.35]), k: 0.09 });
    m.ell({ tag: 'mane', bone: 'chest', c: [0, 0.63 - 0.03 * g, 0.49], r: [0.1 + 0.035 * g, 0.1 + 0.05 * g, 0.075 + 0.03 * g], k: 0.08 });
    // face ruff: frames the face from the cheeks round behind the ears; crown over the forehead
    for (const s of [1, -1]) {
      // (behind the cheeks, not round the face: a ruff volume reaching forward to the eyes read as a hood with
      // a groove round the face; the hair grows out of the cheeks in front of it, coat.js)
      m.ell({ tag: 'mane', bone: 'head', c: hl([0.09 * s, -0.06, -0.175]), r: [0.05 + 0.055 * g, 0.1 + 0.07 * g, 0.065 + 0.04 * g], axis: norm([0.25 * s, 0, 1]), k: 0.09 });
    }
    // (behind the ears, which stand out of the mane: over their bases it buried the lower half of a male's pinnae, leaving
    // small grey plates on top of the mane)
    m.ell({ tag: 'mane', bone: 'head', c: hl([0, 0.08 + 0.03 * g, -0.215]), r: [0.09 + 0.05 * g, 0.05 + 0.05 * g, 0.07 + 0.04 * g], k: 0.09 });
    m.ell({ tag: 'mane', bone: 'head', c: hl([0, -0.14 - 0.03 * g, -0.08]), r: [0.08 + 0.045 * g, 0.05 + 0.05 * g, 0.08], k: 0.07 });
    // locks: the surface breaks up into layered locks and tufts, the outline and the rear edge over the
    // shoulders into ragged points (a smooth volume read as a helmet with a hard rim).
    // Seeded per individual; each lock lies along the hair's fall (radiating on the face ruff, back and
    // down over the neck), partly sunk into the volume, and rides on the bone of the part it grows from.
    const base = m.prims.filter((p) => p.tag === 'mane');
    const RL = rng(4127 + (params.coatSeed || 0));
    const A0 = [0, 0.92, 0.36], A1 = hl([0, 0.0, -0.07]); // the neck's axis: withers -> behind the skull
    const FC = hl([0, -0.03, 0.02]);
    const nLocks = Math.round(14 + 20 * g);
    for (let i = 0; i < nLocks; i++) {
      const u = 0.62 * Math.pow(RL(), 0.8); // (the rear two thirds: withers to mid-neck, clear of the skull's skin blend)
      const th = (RL() * 2 - 1) * Math.PI * 0.9; // round the neck, 0 = the crest
      const ax = lerp(A0, A1, u);
      const dir = norm([Math.sin(th), Math.cos(th), 0.25 * (u - 0.4)]);
      let lo = 0, hi = 0.8;
      for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (SDFModel.evalList(base, ...add(ax, mul(dir, mid))) < 0) lo = mid; else hi = mid; }
      const P = add(ax, mul(dir, lo));
      const e = 0.002, f0 = SDFModel.evalList(base, ...P);
      const n = norm([SDFModel.evalList(base, P[0] + e, P[1], P[2]) - f0, SDFModel.evalList(base, P[0], P[1] + e, P[2]) - f0, SDFModel.evalList(base, P[0], P[1], P[2] + e) - f0]);
      const ruff = Math.max(0, Math.min(1, (P[2] - 0.62) / 0.1));
      let fl = add(mul(norm([0, -0.9, -0.55]), 1 - ruff), mul(norm(add(norm(sub(P, FC)), [0, -0.3, -0.4])), ruff));
      fl = sub(fl, mul(n, fl[0] * n[0] + fl[1] * n[1] + fl[2] * n[2]));
      if (Math.hypot(...fl) < 1e-3) continue;
      fl = norm(fl);
      const rt = (0.022 + 0.016 * RL()) * (0.75 + 0.45 * g), rl = rt * (1.8 + 0.9 * RL());
      let bone = 'neck1', bd = 1e9;
      for (const q of base) { const dq = SDFModel.dist(q, ...P); if (dq < bd) { bd = dq; bone = q.bone; } }
      // (none on the face ruff, which rides on the skull: a lock there moved with the head against the
      // neck's skin, and lay 15 cm in the ground when a sleeping lion rested its head on its side)
      if (bone === 'head') continue;
      ellY({ tag: 'mane', bone, c: add(add(P, mul(n, -0.05 * rt)), mul(fl, 0.4 * rl)), ydir: fl, lateral: norm(cross(fl, n)), r: [rt, rl, 0.48 * rt], k: 0.03 });
    }
  }

  // ---------------------------------------------------------------- HEAD (face units, rig.js FACE)
  // Landmarks in units of the eye separation E from the eye midpoint (head frame, gaze +Z), measured on
  // face_female1 / face_male1 (the lion looks into the lens, so the camera is on the gaze axis): nose
  // leather top edge 0.8 E below the eye line and +-0.3 E wide, its lower point 1.07 E down, whisker
  // pads flanking it +-0.52 E wide down to the lip line at 1.3 E, cheeks +-1.15 E; and on the profile
  // lioness of front_female1: a long straight bridge falling ~50 deg from the stop to the nose, the nose
  // front ~1.2 E ahead of the eyes (0.57 of the way from the ear base to the nose), a deep square
  // muzzle, the chin set back under the upper lip.
  const H = { bone: 'head' };
  const hw = 1.12 + 0.02 * male - 0.04 * juv;
  const hr = (r) => [r[0] * hw * HS, r[1] * HS, r[2] * HS];
  const F = (X, Y, Z) => fe(X, Y, Z, hw);
  const FR = (rx, ry, rz) => hr([rx * FACE.X, ry * FACE.E, rz * FACE.E]);
  const FS = (r) => r * FACE.X * hw * HS; // a radius across the face
  // (the face still read as a smooth swollen dome, a plush toy, worst on the lioness and the white lion:
  // the head is rebuilt as planes with edges after the photos (ffront_*, fprof_*, mprof_*, white_Flickr_bslmmrs_White_Lion): a
  // flat broad skull whose profile runs straight from the nose over the forehead to the crown (the forehead blob rose 0.23 E
  // above that line at the eyes: a dome), a dished forehead between two brow ridges the eyes look out from under, a broad
  // flat-topped bridge with crisp edges falling to the sides of the muzzle, a broad square muzzle of swollen whisker pads, the
  // cheekbones the widest point of the bare head (the head was widest 0.6-0.9 E below the eyes, a pear with hamster cheeks),
  // flat cheeks and heavy jowls under them, a strong chin)
  // braincase: broad and flat-topped, the crown ~0.9 E above the eye line between the ears
  m.ell({ ...H, tag: 'cranium', c: F(0, 0.1 + 0.07 * juv, -0.98), r: FR(0.96 - 0.05 * juv, 0.8 + 0.17 * juv, 1.0), k: 0.05 }); // (cubs: a domed forehead)
  // the forehead: a broad flat plane rising straight back from the stop to the crown at ~45 deg (fprof_*: one straight line from
  // the nose to the crown), its middle set back between the brow ridges (the dished forehead)
  const fhN = norm([0, 0.72 - 0.25 * juv, 1]);
  m.ell({ ...H, tag: 'forehead', c: F(0, 0.42 + 0.06 * juv, -0.5), r: FR(0.64, 0.62, 0.3 + 0.06 * juv), axis: fhN, up: norm([0, 1, -(0.72 - 0.25 * juv)]), k: 0.055 }); // (k 0.055: at 0.045 its seam with the cranium drew a crease, a dark band across the forehead from the front)
  // the temporal muscles fill the head's sides above the cheekbones up to the ear bases: flat sides
  for (const s of [1, -1]) m.ell({ ...H, tag: 'temporal', c: F((0.62 - 0.04 * juv) * s, 0.36 - 0.08 * juv, -0.92), r: FR(0.38, 0.42, 0.6), axis: norm([-0.3 * s, 0, 1]), k: 0.05 });
  // the facial mask round the eyes, flush with the eyeballs' fronts and wrapping their outer sides (set back: it made the face in
  // front of the eyes a dome)
  m.ell({ ...H, tag: 'facemask', c: F(0, -0.12, -0.36), r: FR(0.76, 0.5, 0.36), k: 0.04 });
  for (const s of [1, -1]) {
    // the brow ridge: a bar over each eye from above its inner corner out and back to the temple, standing ~0.15 E in front of the
    // forehead's middle (the dish between them) and overhanging the upper lid, its inner end a little lower (fprof_*: the bump over
    // the eye; ffront_*: a level brow, the eyes looking out from under it); a cub's soft
    m.ell({ ...H, tag: 'brow', c: F(0.4 * s, 0.28, 0.0 - 0.12 * juv), r: FR(0.3, 0.12, 0.2), axis: norm([0.45 * s, 0, 1]), up: norm([0, 1, 0.3]), k: 0.026 }); // (level, its inner end no lower: in the clay the bars met over the bridge in a frown)
    // zygomatic arch: the cheekbone from under the eye's outer corner out and back toward the ear: the widest point of the bare head
    m.ell({ ...H, tag: 'zygomatic', c: F(0.92 * s, -0.14, -0.66), r: FR(0.22, 0.2, 0.6), axis: norm([-0.42 * s, 0, 1]), k: 0.06 }); // (further out, the head's widest point at the eye line behind the eyes: the face read as a column)
    // cheek: the flat side of the face below the cheekbone, down to the jowl (set in from the arch: a ball here made hamster cheeks)
    m.ell({ ...H, tag: 'cheek', c: F(0.72 * s, -0.72, -0.66), r: FR(0.14, 0.5, 0.62), axis: norm([-0.3 * s, -0.2, 1]), k: 0.035 });
    // upper lip: hangs over the lower jaw from the whisker pad back to the corner of the mouth
    m.ell({ ...H, tag: 'lip', c: F(0.38 * s, -1.22, 0.26), r: FR(0.22, 0.24, 0.56), axis: norm([-0.35 * s, -0.1, 1]), k: 0.03 });
    // the back of the cheeks behind the jaw's angle (the mastoid and the thick neck's top), flatter: the head narrows below the
    // cheekbones to the jowls (it was widest here, a pear)
    m.ell({ ...H, tag: 'mastoid', c: F(0.54 * s, -0.98, -1.32), r: FR(0.44, 0.5, 0.46), k: 0.035 });
    // masseter: the chewing muscle under the cheekbone, one flat plane from the arch down to the jaw's angle
    m.ell({ ...H, tag: 'masseter', c: F(0.78 * s, -0.72, -1.04), r: FR(0.18, 0.54, 0.56), axis: norm([-0.25 * s, 0, 1]), k: 0.045 });
    // jowl: heavy skin wrapping the back of the mandible down to the corner of the mouth (lower and fuller: the heavy jowls of
    // mfront_* / white_Flickr_*, under the flat cheek)
    m.ell({ ...H, tag: 'jowl', c: F(0.56 * s, -1.22, -0.78), r: FR(0.26, 0.36, 0.54), k: 0.03 });
    // the side of the muzzle: a steep plane from the bridge's edge down to the whisker pad (set back under the eye: it bulged 0.46 E
    // in front of the eyeball there, a pillow under the eye)
    m.ell({ ...H, tag: 'padside', c: F(0.41 * s, -0.76, 0.3), r: FR(0.17, 0.4, 0.6), axis: norm([-0.22 * s, -0.12, 1]), k: 0.05 });
    // the infraorbital slope under the eye: the muzzle's side runs back into the cheek here as one surface facing forward and out (the
    // bridge stood out of the face as a box with vertical sides, the cheeks a shelf behind it: a dog's snout)
    m.ell({ ...H, tag: 'infraorbital', c: F(0.5 * s, -0.58, -0.12), r: FR(0.18, 0.24, 0.22), axis: norm([0.35 * s, -0.3, 1]), k: 0.04 });
    // whisker pad: a big swollen lobe each side of the philtrum, under and beside the nose leather, reaching back along the lip
    m.ell({ ...H, tag: 'whisker', c: F(0.28 * s, -1.16, 0.58), r: FR(0.3, 0.36, 0.48), axis: norm([0.15 * s, -0.08, 1]), k: 0.025 });
  }
  // the front of the muzzle squared off: a broad, nearly flat plate under the nose carrying the whisker pads, a corner where it
  // meets the side of the muzzle
  m.ell({ ...H, tag: 'whisker', c: F(0, -1.08, 0.82), r: FR(0.42, 0.26, 0.18), axis: norm([0, -0.1, 1]), k: 0.025 });
  // maxilla: the broad bony face under the eyes, tapering forward to the nose under the bridge
  m.ell({ ...H, tag: 'maxilla', c: F(0, -0.68, -0.25), r: FR(0.5, 0.46, 1.0), axis: norm([0, -0.2, 1]), k: 0.025 });
  // muzzle: the deep, square upper jaw under the bridge
  m.ell({ ...H, tag: 'muzzle', c: F(0, -0.82, 0.4), r: FR(0.4, 0.38, 0.54), axis: norm([0, -0.15, 1]), k: 0.04 }); // (smaller, under the bridge: as big as the pads it made the front of the muzzle one round snout, a bear's, the pads lost in it)
  // nasal bridge: long, broad and slightly convex, from the stop (between the brows) straight to the top edge of the nose leather, its
  // shoulders where the tear lines run down (ffront_*, white_Flickr_*: the bridge as wide as the gap between the eyes' inner corners
  // all the way down; two rounded bands read as a round-topped dome of a snout, a flat plate as a horse's plank from above)
  // (the leather stood on the end of a tapering bridge as a disc facing forward, a pig's or a bear's snout in the
  // clay, mfront_Lion_Face / f34_*: the bridge stays broad to the nose and the leather is its end, its top flush with the bridge's,
  // sloping on down to a rounded front over the stem; the nostrils open forward and out at the bar's lower outer corners)
  const top0 = F(0, 0.24 - 0.08 * juv, 0.18), top1 = F(0, -0.68, 0.98); // the bridge's top line at the stop and over the leather
  const bd = norm(sub(top1, top0)), bu = norm(cross(bd, [1, 0, 0])); // along the bridge (down-forward), its top's normal
  const EH = FACE.E * HS; // metres per face unit
  m.ell({ ...H, tag: 'nasal', c: add(lerp(top0, top1, 0.55), mul(bu, -0.24 * EH)), r: FR(0.42, 0.24, 0.82), axis: bd, up: bu, k: 0.026 });
  // the bridge's broad end (an ellipsoid along it tapers to a ridge at the nose)
  m.ell({ ...H, tag: 'nasal', c: add(lerp(top0, top1, 0.86), mul(bu, -0.17 * EH)), r: FR(0.39, 0.17, 0.42), axis: bd, up: bu, k: 0.03 });
  // nose leather: the bridge's end, broad and flat on top, rounding down at its front to the stem between the pads
  m.ell({ ...H, tag: 'nose', c: add(add(top1, mul(bd, 0.06 * EH)), mul(bu, -0.105 * EH)), r: FR(0.39, 0.115, 0.17), axis: bd, up: bu, k: 0.022 }); // (+-0.33 E with its rim: face_female1, face_male1, ffront_*)
  m.ell({ ...H, tag: 'nose', c: F(0, -1.03, 1.06), r: FR(0.15, 0.12, 0.08), k: 0.014 }); // (the stem)
  for (const s of [1, -1]) {
    const ef = eyeFrame(s);
    const at = (u, v, w) => add(add(add(ef.c, mul(ef.x, u)), mul(ef.y, v)), mul(ef.z, w));
    // orbit: a soft hollow so brow, cheek and bridge fall away to the lids
    ellY({ ...H, tag: 'orbit', c: at(-0.003 * s, -0.001, 0.029), ydir: ef.y, lateral: ef.x, r: [0.025, 0.018, 0.012], k: 0.012, carve: true });
    m.sphere({ ...H, tag: 'eyelid', c: ef.c, rad: EYE.r + EYE.lid, k: 0.008 });
    m.lens({ ...H, tag: 'eyesocket', c: add(ef.c, mul(ef.y, EYE.off)), x: ef.x, y: ef.y, z: ef.z, R: EYE.R, d: EYE.d, zMin: -0.003, zMax: 0.036, k: 0.0033, carve: true });
    // nostril: a slit curving up and out from the lower corner of the leather
    m.ell({ ...H, tag: 'nostril', c: F(0.22 * s, -0.94, 1.08), r: FR(0.12, 0.045, 0.08), axis: norm([0.55 * s, -0.2, 1]), up: [-Math.sin(0.4), s * Math.cos(0.4), 0], k: 0.005, carve: true }); // (slits at the leather's lower corners, not two holes in its front: a pig's snout in 3/4)
    // upper canine (~6 cm): its own rigid surface (regions.js 'canine'), hidden inside the upper lip and the closed jaw,
    // bared when the mouth opens and the lip draws back (behaviour.js); merged into the head's surface, only the tip that
    // stood below the lip existed as skin, and the lip carried it up with it
    // (only the part that can show: its root ends inside the muzzle above the highest the lip is drawn back)
    m.cone({ bone: 'head', part: 'canine', tag: 'canine', a: F(0.27 * s, -1.13, 0.645), b: F(0.27 * s, -1.45, 0.61), ra: 0.0076 * HS, rb: 0.0022 * HS, k: 0, thin: true });
  }
  // the upper lip's edge from in front of the canine back to the corner of the mouth, deep inside the lip (it adds no
  // shape): the skin within a few cm of it rides on the lip bone, which draws the lip back and up with the gape
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R';
    m.ell({ ...H, bone: 'lip' + S, group: 'lip' + S, tag: 'lipedge', c: F(0.43 * s, -1.36, 0.28), r: FR(0.05, 0.045, 0.42), axis: norm([-0.26 * s, 0, 1]), k: 0.004 });
  }
  // philtrum: the groove from the nose down to the lip line, between the whisker pads
  m.ell({ ...H, tag: 'philtrum', c: F(0, -1.3, 1.1), r: FR(0.03, 0.16, 0.05), k: 0.01, carve: true });

  // ---------------------------------------------------------------- JAW (separate surface so the mouth can open)
  // A lower jaw that opens into a mouth (a convex jaw read as a tongue slab in the roar, its
  // outside fur showed inside the gape): the two rami carry the lower lip's rim, joined by the chin and the
  // floor under the tongue; a trough between them holds the tongue below the rim; the lower canines stand at
  // the front of the rim. Closed, the rim and the canines lie inside the upper lip, and the chin's white fur
  // runs up to the one lip line.
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  const ER = (r) => r * FACE.E * HS; // a radius in E (metres)
  // (the chin +-0.3 E wide, face_male1: +-0.45 E read as a white bar under the mouth)
  // (a U from the front and a V from below: the rami carry the lower lip's rim and the canines at the top front, the chin
  // bulges below between them, and the floor lies above the rami's lower edges; a flat floor as low as the rami made the
  // jaw a flat shield with a rim, the "pacifier")
  // (the front narrow enough to tuck under the hanging upper lips: wider, its sides stood out below them as a lens)
  for (const s of [1, -1]) m.cone({ ...JW, tag: 'mandible', a: F(0.4 * s, -1.14, -0.78), b: F(0.165 * s, -1.28, 0.55), ra: ER(0.18), rb: ER(0.125), k: 0.03 });
  // (tucked back and up under the upper lip and blended softly into the mandible: a distinct ball jutting under the lip
  // read as a pale pacifier with a crease under it)
  // (tucked back and up under the upper lip, small, blended softly into the mandible (a distinct ball
  // jutting under the lip read as a pale pacifier with a crease under it); the chin's depth in the photos is its white
  // tuft of hair (coat.js), which runs on into the throat's)
  m.ell({ ...JW, tag: 'chin', c: F(0, -1.48, 0.47), r: FR(0.2, 0.2, 0.19), k: 0.06 }); // (a stronger chin, its front facing forward under the lip line: face_male1, ffront_*)
  // (the floor under the tongue: its underside runs on level from the chin to the throat, so the lower outline is one line
  // from the chin back (raised behind the chin, it left a dip there and the chin stood out as a lump, a pacifier; level and low at the back, it jutted below the throat line as a slab)
  m.ell({ ...JW, tag: 'mandible', c: F(0, -1.46, -0.12), r: FR(0.22, 0.15, 0.62), axis: norm([0, 0.12, 1]), k: 0.04 });
  m.ell({ ...JW, tag: 'mouth', c: F(0, -1.13, -0.02), r: FR(0.24, 0.16, 0.7), k: 0.015, carve: true });
  m.ell({ ...JW, tag: 'tongue', c: F(0, -1.28, 0.08), r: FR(0.21, 0.07, 0.56), k: 0.02 });
  for (const s of [1, -1]) m.cone({ ...JW, tag: 'canine', a: F(0.2 * s, -1.23, 0.64), b: F(0.215 * s, -0.99, 0.68), ra: 0.0072 * HS, rb: 0.0022 * HS, k: 0.003 });

  // ---------------------------------------------------------------- EARS
  // short, rounded, cupped forward; set on the sides of the crown
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const facing = norm([0.7 * s, 0.05, 1]);
    const lat = norm(cross(up, facing));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    const at = (t) => lerp(base, tip, t);
    const ek = (1 + 0.45 * juv) * (1 + 0.15 * male); // (cubs: big ears, research 1; males' stand clear of the mane)
    // the upper pinna's width: broad and round-topped (face_female1 0.77 E, face_male1 0.86 E, cub_lying1 ~0.9 E of their
    // eye separations; pointed, 0.63 / 0.57 / 0.5 E)
    // (cubs: ~1 E wide and round, cub_lying1; at 0.5 E they read too small)
    // (a little lower than wide: standing 0.5 E above the crown's side the pinnae read as a mouse's)
    // (a male's 0.85-0.9 E wide, face_male1: at 1.1 + 0.3 they were 0.53 E, small grey plates in the mane)
    const ew = (1 + 1.0 * juv) * (1.1 + 0.6 * male), eh = (1 + 0.55 * juv) * (0.94 + 0.22 * male);
    // a rounded triangle as broad at the base as it is tall (face_female1: 0.55-0.6 E wide, tip ~1.2 E above the eye line
    // and ~1.15 E out), a thin pinna with a shallow bowl in front, its broad base merging into the side of the crown;
    // the stack of discs leans ~9 deg toward the midline of the joints' axis (the tip stood 0.15 E too far out: a mouse's
    // ear on the corner of a ball) and narrows toward a rounded tip (one broad disc on top read as a round
    // teddy bear's ear)
    // (the base disc no lower or wider than this: a head lying on its side rests on it, and 4 mm more reach put a dead
    // lioness's ear base 1 % S in the ground)
    const ca = Math.cos(0.16), sa = Math.sin(0.16);
    const U2 = norm(add(mul(up, ca), mul(lat, -sa * s))), L2 = norm(cross(U2, facing)); // (s: lat points out on the left ear, in on the right)
    const L = len(sub(tip, base));
    // (l outward on both sides: L2 points out on the left ear and in on the right, and the offsets of the upper discs put the
    // right pinna ~0.2 E further in than the left, as measured: ear tips -1.2 / +0.98 E)
    // (a male's pinna a little further out and up: it stands out of the mane, face_male1)
    const pe = (t, l, n = 0) => add(add(add(base, mul(U2, t * L + 0.008 * male * smoothstep01(t))), mul(L2, s * (l + 0.012 * male * smoothstep01(t)))), mul(facing, n));
    ellY({ ...ear, tag: 'ear', c: pe(0.26, 0), ydir: U2, lateral: L2, r: [0.046 * ek, 0.042 * ek, 0.013], k: 0.022 });
    ellY({ ...ear, tag: 'ear', c: pe(0.45, 0.009 * ew), ydir: U2, lateral: L2, r: [0.046 * ew, 0.046 * eh, 0.0085], k: 0.02 });
    ellY({ ...ear, tag: 'ear', c: pe(0.64, 0.004 * ew), ydir: U2, lateral: L2, r: [0.036 * ew, 0.042 * eh, 0.0075], k: 0.018 });
    // (a rounder tip, the lioness's ears read as a fox's or a capybara's pointed ones in the showcase)
    ellY({ ...ear, tag: 'ear', c: pe(0.77, 0.0), ydir: U2, lateral: L2, r: [0.025 * ew, 0.03 * eh, 0.0065], k: 0.016 });
    // (the bowl inside the rim: narrower than the upper pinna, so the rim keeps some flesh; clear of the base by ~3 cm:
    // reaching down to it, it left a sliver where the pinna joins the skull that folded over at the medium tier; a soft
    // carve: k 0.006 drew its edge as dark crack lines at the medium tier)
    ellY({ ...ear, tag: 'earinner', c: add(pe(0.54, 0.002 * ew), mul(facing, 0.0102)), ydir: U2, lateral: L2, r: [0.028 * ew, 0.04 * eh, 0.005], k: 0.01, carve: true });
  }

  // ---------------------------------------------------------------- LEGS
  // thick, muscular forelegs (grappling) with a massive forearm; big round forepaws (the legs read thin
  // against side_male1: +10 % on the arm, forearm, thigh and shin)
  // (cubs: big paws, longer and deeper but no wider than an adult's for their size: a paw lying on its side rests on its
  // outer toes ~3 cm x size above the ground (the core's side pose), and broader cub paws (1.1 x 1.1 warped) lay 2 % S in
  // the ground in death)
  const pawK = 1 + 0.1 * juv, pawL = 1 + 0.25 * juv;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], T = J['ftoe' + S];
    // the top of the shoulder blade: it rolls above the back line at every step (research 3) and gives a
    // lying lion's back some relief (a featureless cylinder from behind)
    ellY({ tag: 'scaptop', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.1), sx([0.016, 0.03, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.045, 0.08, 0.065], k: 0.04 }); // (more relief: a sleeping lion's back read as a smooth log at medium)
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.5), sx([0.012, 0, 0])), ydir: sub(Sh, Sc), lateral: lat, r: [0.042, 0.16, 0.1], k: 0.09, bias: 0.006 });
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: Sh, b: E, ra: 0.076, rb: 0.063, k: 0.09 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), [0, 0, -0.05]), ydir: sub(E, Sh), lateral: lat, r: [0.061, 0.13, 0.07], k: 0.07 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.016, -0.045]), rad: 0.034, k: 0.03 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: E, b: W, ra: 0.075, rb: 0.047, k: 0.04 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.28), sx([0.006, 0, 0.008])), ydir: sub(W, E), lateral: lat, r: [0.067, 0.13, 0.07], k: 0.045 });
    if (male) ellY({ tag: 'elbowtuft', bone: 'radius' + S, group: g, c: add(E, [0, -0.02, -0.06]), ydir: [0, -1, -0.3], lateral: lat, r: [0.03, 0.06, 0.03], k: 0.04 });
    m.sphere({ tag: 'wrist', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0, -0.006]), rad: 0.036, k: 0.02 });
    m.sphere({ tag: 'carpalpad', bone: 'metacarpus' + S, group: g, c: add(W, [0, -0.018, -0.034]), rad: 0.015, k: 0.015 });
    m.cone({ tag: 'pastern', bone: 'metacarpus' + S, group: g, a: W, b: M, ra: 0.036, rb: 0.036 * pawK, k: 0.02 });
    m.sphere({ tag: 'dewclaw', bone: 'metacarpus' + S, group: g, c: add(lerp(W, M, 0.35), sx([-0.03, 0, 0.006])), rad: 0.011, k: 0.01 });
    const dp = norm(sub(T, M));
    ellY({ tag: 'paw', bone: 'fpaw' + S, group: g, c: add(add(M, mul(dp, 0.03)), [0, -0.008 + 0.005 * juv, 0]), ydir: dp, lateral: lat, r: [0.051, 0.066 * pawL, 0.032], k: 0.022 });
    m.sphere({ tag: 'pad', bone: 'fpaw' + S, group: g, c: add(M, [0, -0.025 + 0.004 * juv, 0.02]), rad: 0.02 * pawK, k: 0.015 });
    // (the outer toes within the paw's width: a paw lying on its side (death, sleep) rests 3 cm above the ground
    // on its wrist's skin radius, and outer toes 57 mm out lay 10 mm in the ground)
    // (toes and pads 3 mm higher: the smooth union's blend bulged the sole ~5 mm below the ground plane, so a standing paw
    // sat 0.5 % S in the ground and a cub's lying paw 2 % S)
    const toeX = [-0.033, -0.011, 0.011, 0.033], toeZ = [-0.018, 0, 0, -0.018];
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'fpaw' + S, group: g, c: [T[0] + toeX[i] * s, 0.024 + 0.004 * juv, T[2] - 0.016 * pawL + toeZ[i] * pawL], rad: 0.02 * pawK, k: 0.012 });

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Tt = J['htoe' + S];
    // a broad, heavy thigh rising into the flank and croup; the flank fold webs stifle and belly
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.4), sx([0.008, 0, -0.055])), ydir: sub(K, Hp), lateral: lat, r: [0.076, 0.25, 0.168], k: 0.08, bias: 0.006 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.072, 0.87, -0.47]), b: add(K, sx([-0.006, 0.08, 0.0])), ra: 0.068, rb: 0.042, k: 0.09 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.075, 0.88, -0.8]), b: add(lerp(K, Hk, 0.28), [0, 0, -0.045]), ra: 0.08, rb: 0.05, k: 0.06 });
    // (smaller and higher: skinned to the thigh, a bigger fold swung forward and down under the belly as a
    // lump whenever the hind leg reached forward at the gallop)
    // (and reaching down the thigh's front toward the knee, so a knee swung forward at the sprint stays webbed to the belly
    // rather than standing under it as a round lump)
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.092, 0.62, -0.435]), ydir: [-0.03, 0.16, 0.06], lateral: lat, r: [0.03, 0.13, 0.05], k: 0.09 });
    // (a slim knee: a big, widely blended stifle ball read as a round lump under the belly whenever the hind leg
    // reached forward at the gallop)
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.004, 0.014, 0.004])), rad: 0.026, k: 0.04 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.06), sx([0.0, 0.0, 0.006])), b: Hk, ra: 0.046, rb: 0.033, k: 0.045 });
    ellY({ tag: 'calf', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.004, 0.015, -0.045])), ydir: sub(Hk, K), lateral: lat, r: [0.05, 0.11, 0.055], k: 0.05 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.5), [0, 0.015, -0.055]), b: add(Hk, [0, 0.02, -0.05]), ra: 0.02, rb: 0.019, k: 0.022 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.026, -0.038]), rad: 0.02, k: 0.018 });
    m.sphere({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: Hk, rad: 0.031, k: 0.018 });
    m.cone({ tag: 'metatarsus', bone: 'metatarsus' + S, group: h, a: Hk, b: Mt, ra: 0.034, rb: 0.033 * pawK, k: 0.018 });
    const dh = norm(sub(Tt, Mt));
    ellY({ tag: 'paw', bone: 'hpaw' + S, group: h, c: add(add(Mt, mul(dh, 0.03)), [0, -0.008 + 0.005 * juv, 0]), ydir: dh, lateral: lat, r: [0.048, 0.062 * pawL, 0.03], k: 0.022 });
    m.sphere({ tag: 'pad', bone: 'hpaw' + S, group: h, c: add(Mt, [0, -0.027 + 0.004 * juv, 0.016]), rad: 0.018 * pawK, k: 0.015 });
    for (let i = 0; i < 4; i++) m.sphere({ tag: 'toe', bone: 'hpaw' + S, group: h, c: [Tt[0] + toeX[i] * 0.9 * s, 0.023 + 0.004 * juv, Tt[2] - 0.016 * pawL + toeZ[i] * pawL], rad: 0.0185 * pawK, k: 0.012 });
  }

  // ---------------------------------------------------------------- TAIL
  // a smooth round tail tapering a little, ending in the black tuft (a teardrop of long hair)
  const tailR = (t) => (t < 0.3 ? 0.05 + (0.034 - 0.05) * (t / 0.3) : 0.034 - 0.012 * ((t - 0.3) / 0.7));
  m.cone({ tag: 'tailroot', bone: 'tail0', a: [0, 0.935, -0.72], b: J.tail1, ra: 0.06, rb: tailR(0.1), k: 0.06 });
  for (let i = 0; i < TAIL_SEGS; i++) {
    // (a hard union: consecutive round cones share the sphere at their joint, so the tube runs on smoothly; a
    // smooth union swelled every joint by ~4 mm, which shaded into rings)
    m.cone({ tag: 'tail', bone: 'tail' + i, a: J['tail' + i], b: J['tail' + (i + 1)], ra: tailR(i / TAIL_SEGS), rb: tailR((i + 1) / TAIL_SEGS), k: i === 0 ? 0.015 : 0, thin: i >= TAIL_SEGS - 2 });
  }
  if (!juv || juv < 0.8) {
    const a = J['tail' + (TAIL_SEGS - 1)], b = J['tail' + TAIL_SEGS];
    const d = norm(sub(b, a));
    const tk = 1 - 0.6 * juv;
    ellY({ tag: 'tuft', bone: 'tail' + (TAIL_SEGS - 1), c: add(b, mul(d, -0.012)), ydir: d, lateral: norm(cross(d, [0, 1, 0])), r: [0.038 * tk, 0.075 * tk, 0.038 * tk], k: 0.03, thin: true });
  }

  return m;
}
