// The goat, sculpted as a signed distance field.
// Every primitive is attached to a bone (skinning) and a group (axial / limb / ear / jaw). The head is
// modelled in its own frame (rig.js: hl()), measured from the profile and frontal references (side2,
// side3, face1, face3); the body relative to the joints so the sculpt follows the skeleton.
// Separate surfaces ("parts"): 'jaw' (lower lip, chin and the beard: the mouth opens and the beard
// swings with it) and 'horn' (keratin horns, rigid on the skull).
import { HEAD_O, HZ, HY, hl, hdir, TAIL_SEGS, hqOf, faceZ, KID_FACE } from './rig.js';
import { add, sub, mul, lerp, norm, cross, rng, clamp, smoothstep } from '../../core/math/vec.js';
import { apertureTiltAlong, sculptEyeSocket } from '../../core/sdf/eyeSocket.js';
import { SDFModel } from '../../core/sdf/sdf.js';

// Eye: globe ~29 mm across, visible opening ~24 x 16 mm, set high on the side
// of the head, prominent, looking out and a little forward.
const EYE_LOCAL = [0.057, -0.004, 0.0];
const eyeDir = (() => {
  const a = (24 * Math.PI) / 180;
  return norm(add([Math.cos(a), 0, 0], mul(HZ, Math.sin(a))));
})();
const EYE_BASE = {
  c: sub(hl(EYE_LOCAL), HEAD_O), r: 0.0145, back: 0.003, yaw: Math.atan2(eyeDir[0], eyeDir[2]), pitch: Math.asin(eyeDir[1]),
  lid: 0.0017, R: 0.0132, d: 0.0052, off: -0.0006, tilt: 0, irisZ: 0.0081, irisR: 0.0112,
};
// roll the almond: its long axis ~20 deg from the horizontal with the inner corner low (side2, face4,
// walk1), i.e. rolled back ~22 deg from the head axis (a search over a limited range stood it on end)
EYE_BASE.tilt = apertureTiltAlong(EYE_BASE, HEAD_O, HZ) - 0.38;
export const EYE = EYE_BASE;

const X = [1, 0, 0];

// The horn's mesh cell at this individual's quality tier (params.tierRes): its girth sets it (regions.js)
export const hornCell = (params, res = params.tierRes ?? 1.3) => clamp((params.horns?.base || 0.012) * 0.13, 0.0025, 0.0039) * Math.min(res, 3);

// Growth ridges round the horn's base half (face2, face4: transverse corrugations, the keratin added ring by ring
// at the base), shared by the sculpt (raised collars where the tier's cells resolve them) and the coat (a dark
// groove before each ridge at every tier). Spacing S along the horn (m), height amp x the horn radius, fading out
// toward tEnd (fraction of the length). null for horn buds.
export function hornRidges(params) {
  const H = params.horns;
  if (!H || H.len < 0.06) return null;
  const buck = H.base > 0.02;
  const S = clamp(0.45 * H.base, 0.0075, 0.0135);
  // (resolved: at least ~2.6 cells per ridge; at the medium tier and coarser the ridges are painted only)
  const geo = smoothstep(2.4, 3.0, S / hornCell(params));
  // (s0: the first crest, clear of the skin collar round the base: buried in it, a ridge lifted the hair)
  return { S, s0: 0.012 + 0.5 * S, amp: buck ? 0.075 : 0.06, tEnd: buck ? 0.62 : 0.5, geo };
}

// At the low and crowd tiers the horn is meshed as two closed solids: the base ('horn', the tier's horn cells)
// and the tapering outer part ('horntip', at the medium tier's horn cells), the tip's start buried in the base
// and a hair thinner, so the base's rounded end meets it as a fine ring. Returns the first path index of the
// base's end (the tip runs from two segments before it), or -1 when the horn is one solid.
// (one solid at the low tier's ~1 cm cells: the last fifth of a buck's horn, 3-9 mm thick, meshed as a pinched
// neck and a twisted, ragged flake at the tip, the tip read as snapped off; kept ~0.45 of a cell thick, it was a
// sub-cell tube the grid could not resolve)
export function hornSplit(params, pth) {
  if ((params.tierRes ?? 1.3) < 2.5 || !pth || pth.length < 6 || params.horns.len < 0.06) return -1;
  const hc = hornCell(params);
  let j = 1;
  while (j < pth.length - 3 && (pth[j].t < 0.3 || pth[j].r > 1.3 * hc) && pth[j].t < 0.75) j++;
  return j;
}
export const hornTipCell = (params) => hornCell(params, (params.tierRes ?? 1.3) > 3.5 ? 2.25 : 2);

// Horn centre line (reference space), shared by the sculpt and the coat: a scimitar arc from the
// poll, up and back, sweeping further back and out along its length. Returns [{ p, r, t }].
// (at the medium tier and coarser the horn is never thinner than ~0.8 of its cell (the tip solid's cell at the low
// and crowd tiers, hornSplit): at the crowd tier's 16 mm cells the tapering half of a buck's horn, 2-8 mm thick,
// broke into ragged fragments along its length, and with ~0.45 of a cell (and at medium with none) the last
// centimetre ended in a black chisel facet or a needle-thin twisted flake past a pinch, a tip that read as snapped
// off; at ~0.8 the tip is a blunt rounded end, as at the high tier)
export function hornPath(params, s) {
  const H = params.horns;
  if (!H || H.len <= 0) return [];
  const rMin = (params.tierRes ?? 1.3) >= 1.9 ? 0.8 * hornTipCell(params) : 0;
  const base = hl([0.021 * s, 0.035, -0.052]);
  // sagittal start direction (head-local y, z) and the backward-rotated perpendicular
  const d0 = norm([0, 0.15 + 0.35 * (H.upright || 0), -1]); // up and back from the poll
  const v0 = [0, d0[2], -d0[1]]; // d0 rotated 90 degrees backward in the sagittal plane (back and down)
  // (~1 cm segments: at 2.5-3 cm the cones made a faceted curve that caught the light segment by segment)
  const n = Math.max(8, Math.round(20 * Math.min(1.6, H.len / 0.2)));
  const out = [];
  let p = base.slice();
  const ds = H.len / n;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = H.curve * Math.pow(t, 1.15);
    const dl = [
      s * (H.spread * (0.35 + 1.1 * t)),
      d0[1] * Math.cos(th) + v0[1] * Math.sin(th),
      d0[2] * Math.cos(th) + v0[2] * Math.sin(th),
    ];
    const r = Math.max(rMin, H.base * Math.pow(1 - 0.92 * t, 0.85) + 0.0015);
    out.push({ p: p.slice(), r, t });
    p = add(p, mul(norm(hdir(dl)), ds));
  }
  return out;
}

// the direction the inner (cupped) side of an ear faces: forward, a little out and down (erect), toward the
// face and a little forward (lop); shared with the coat (inner-ear skin, the rim of a lop ear)
export function earFacing(params, s) {
  return params.ear === 'lop' ? norm(add([-0.9 * s, 0, 0], mul(hdir([0, 0, 1]), 0.4))) : norm([0.25 * s, -0.3, 1]);
}

export function sculptGoat(m, rig, params = {}) {
  const J = rig.J;
  const kid = params.age === 'juvenile';
  const HQ = hqOf(params);
  const male = params.sex === 'male';
  const buck = male && !kid;
  const heavy = params.heavy ?? (buck ? 1 : 0); // 0 doe .. 1 heavy buck
  const R = rng(5311 + (params.coatSeed || 0));
  const roman = params.roman || 0; // Nubian / Boer convex nose
  void R;

  const ellY = (o) => {
    const y = norm(o.ydir);
    const lat = o.lateral || X;
    const z = norm(cross(lat, y));
    return m.ell({ ...o, axis: z, up: y, r: [o.r[0], o.r[1], o.r[2]] });
  };
  const H = { bone: 'head' };
  // (head-local points in adult coordinates; a kid's face in front of the eyes is shorter, rig.js faceZ)
  const hk = (v) => hl([v[0], v[1], faceZ(v[2], kid)]);
  const shortR = (o) => (kid && o.c[2] > 0.02 ? [o.r[0], o.r[1], o.r[2] * KID_FACE] : o.r);
  const hell = (o) => m.ell({ ...H, ...o, c: hk(o.c), r: shortR(o), axis: o.axisL ? norm(hdir(o.axisL)) : HZ, up: o.upL ? norm(hdir(o.upL)) : HY });

  // ---------------------------------------------------------------- TORSO
  // dairy type: deep barrel, sharp withers, level back, prominent hip bones and pin bones, sloping rump
  const gw = 1 + 0.12 * heavy; // bucks are broader
  m.ell({ tag: 'ribcage', bone: 'spine3', c: [0, 0.585, 0.105], r: [0.122 * gw, 0.18, 0.25], axis: norm([0, 0.08, 1]), k: 0 });
  m.ell({ tag: 'girth', bone: 'chest', c: [0, 0.575, 0.28], r: [0.1 * gw, 0.15, 0.12], k: 0.08 });
  // (a doe is deep through the belly, deeper in milk: side2, side3; the barrel hung 2-5 cm higher than theirs;
  // the Boer's barrel is already deep through its girth, and deeper still its short forelegs could not fold
  // under the chest when it lay down)
  const milk = !male && !kid ? (params.udder ?? 0.5) * (params.variant === 'boer' ? 0.7 : 1) : 0;
  const doe = !male && !kid && params.variant !== 'boer' ? 1 : 0;
  // (the trunk pieces blend over 8-10 cm: one smooth barrel with a straight top line, threequarter1 / side2;
  // at 5-7 cm the withers, back, loin and flank showed as separate bumps, and the coat parted over the
  // junctions)
  m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.57 - 0.015 * milk, -0.085], r: [0.14 * gw, 0.19 - 0.02 * heavy + 0.02 * milk, 0.165], axis: norm([0, 0.1, -1]), k: 0.09 });
  // (the deeper belly of a doe hangs between the elbows and the stifles, clear of the stifles: lowered as a
  // whole, the belly's side took the stifle's place and the swinging stifle poked through it at every step)
  if (doe) m.ell({ tag: 'abdomen', bone: 'spine2', c: [0, 0.43 - 0.008 * milk, -0.02], r: [0.1, 0.075 + 0.012 * milk, 0.125], k: 0.08 });
  m.ell({ tag: 'flank', bone: 'spine1', c: [0, 0.62, -0.19], r: [0.12 * gw, 0.12, 0.11], k: 0.09 });
  m.ell({ tag: 'withers', bone: 'chest', c: [0, 0.735, 0.22], r: [0.045, 0.05, 0.15], axis: norm([0, -0.12, 1]), k: 0.09 });
  m.ell({ tag: 'back', bone: 'spine3', c: [0, 0.72, 0.05], r: [0.09 * gw, 0.05, 0.2], k: 0.1 });
  m.ell({ tag: 'loin', bone: 'spine1', c: [0, 0.725, -0.13], r: [0.1 * gw, 0.045, 0.12], k: 0.1 });
  // hindquarters: croup sloping to the tail head, hooks (hip points) and pins
  m.ell({ tag: 'pelvis', bone: 'pelvis', c: [0, 0.645, -0.3], r: [0.115 * gw, 0.115, 0.105], k: 0.05 });
  m.ell({ tag: 'croup', bone: 'pelvis', c: [0, 0.715, -0.29], r: [0.085 * gw, 0.045, 0.11], axis: norm([0, -0.25, 1]), k: 0.05 });
  for (const s of [1, -1]) {
    m.sphere({ tag: 'hippoint', bone: 'pelvis', c: [0.095 * s * gw, 0.715, -0.195], rad: 0.021, k: 0.05 });
    m.sphere({ tag: 'pinbone', bone: 'pelvis', c: [0.045 * s, 0.69, -0.362], rad: 0.022, k: 0.04 });
    m.ell({ tag: 'rump', bone: 'pelvis', c: [0.05 * s, 0.6, -0.335], r: [0.055, 0.1, 0.055], k: 0.06 });
  }
  // chest front: the breast between the forelegs, running smoothly up into the throat (side2: the point
  // of the shoulder shows, the breast does not bulge; it stood 6 cm ahead of the shoulder joints as a knob)
  // (front1, front2, threequarter1: one rounded front, the neck flaring into it, the points of the shoulder
  // at most a gentle angle at its sides. A breast as wide as the shoulders with the humerus heads at its
  // corners read as a box with two round lumps in every front and 3/4 view: the shoulder cones stood
  // 1.2 cm proud of a groove, and 2 cm outside every primitive there, where five of them blended. Now the
  // breast is narrower and centred, the shoulders 2.5-3 cm behind it; the chest front stands 0.06 / 0.09 /
  // 0.11 SH ahead of the forearm at 0.54 / 0.56 / 0.59 SH, side3 0.09 / 0.13 / 0.14 with its near leg)
  m.ell({ tag: 'brisket', bone: 'chest', c: [0, 0.482, 0.272], r: [0.075, 0.07, 0.07], k: 0.05 });
  for (const s of [1, -1]) m.ell({ tag: 'pectoral', bone: 'chest', c: [0.042 * s, 0.475, 0.3], r: [0.04, 0.055, 0.026], k: 0.05 });
  // the breast muscles over the sternum
  // (bias: its skin counts as the chest's for the weights, so a goat lying on its side rests on it: skinned
  // half to the neck and legs, the fuller chest front went 13 mm into the ground in death)
  m.ell({ tag: 'pectoral', bone: 'chest', c: [0, 0.525, 0.325], r: [0.075, 0.065, 0.065], k: 0.05, bias: 0.03 });
  // udder (adult does): two halves and teats, pink skin (size: dry doe .. in milk); a buck's scrotum.
  // Their own closed surface ('udder' part), rigid on the udder bone, its top sunk into the belly: meshed
  // with the body, the udder hangs between the gaskins and took 74 % tibia weights (the core gives the limbs
  // their share before an appendage), so its skin crumpled and the hair shells over it tore into dark shards
  // at every step. Narrow enough to hang between the thighs (their inner skin is ~5 cm off the midline).
  const UD = { bone: 'udder', group: 'udder', part: 'udder' };
  if (!male && !kid && (params.udder ?? 0.5) > 0.05) {
    const u = params.udder ?? 0.5;
    for (const s of [1, -1]) {
      m.ell({ ...UD, tag: 'udder', c: [0.025 * s, 0.35 - 0.03 * u, -0.338 + HQ], r: [0.032 + 0.013 * u, 0.047 + 0.03 * u, 0.052 + 0.022 * u], k: 0.03 });
      const a = [0.033 * s, 0.315 - 0.055 * u, -0.322 + HQ], b = add(a, [0.01 * s, -0.035 - 0.01 * u, 0.013]);
      m.cone({ ...UD, tag: 'teat', a, b, ra: 0.0105, rb: 0.0078, k: 0.012 });
    }
    // the attachment: from the udder up into the belly (hidden inside the body above the groin)
    m.ell({ ...UD, tag: 'udder', c: [0, 0.43, -0.345 + HQ], r: [0.045, 0.085, 0.072], k: 0.035 });
  }
  if (male && !kid) {
    // scrotum between the hind legs, under the groin (walk1: a short-haired pendulous bag hanging behind the stifles to
    // about the middle of the gaskin): a neck of skin from deep in the groin, narrowing to 4.2 cm below the underline,
    // and a pear-shaped bag of two testes side by side (7 cm across, 8 cm deep, 26 cm round once scaled to a buck:
    // dairy bucks 26-34 cm), its bottom 18 cm below the groin. The neck is anchored 7 cm inside the body (the old
    // sausage's top was 1 cm inside: as the groin skin moved with the thighs its end showed, a separate object). Inside
    // the thighs' inner skin (x 4.8-6.4 cm off the midline beside it) with 1.3 cm to spare. Sheath under the belly.
    const zc = -0.385 + HQ;
    // (widening up into the groin; a flare filling the top of the arch between the thighs read as a second bulb from behind)
    m.cone({ ...UD, tag: 'scrotum', a: [0, 0.575, zc + 0.012], b: [0, 0.448, zc - 0.002], ra: 0.034, rb: 0.021, k: 0.02 });
    m.ell({ ...UD, tag: 'scrotum', c: [0, 0.392, zc - 0.004], r: [0.03, 0.05, 0.036], k: 0.03 });
    for (const s of [1, -1]) m.ell({ ...UD, tag: 'scrotum', c: [0.013 * s, 0.375, zc - 0.006], r: [0.022, 0.05, 0.04], axis: norm([0, 0.12, 1]), k: 0.02 });
    m.ell({ tag: 'sheath', bone: 'spine2', c: [0, 0.375, -0.02], r: [0.017, 0.02, 0.045], axis: norm([0, 0.3, 1]), k: 0.03 });
  }

  // ---------------------------------------------------------------- NECK
  // long and slender, flattened sideways, deep at the base; a buck's neck is thick with a crest
  const nb = J.neckBase, nm = J.neckMid, occ = J.occiput;
  const nd1 = norm(sub(nm, nb)), nd2 = norm(sub(occ, nm));
  // (perpendiculars in the sagittal plane: fwd = toward the throat, back = toward the crest)
  const fwdN = (d) => [0, -d[2], d[1]], backN = (d) => [0, d[2], -d[1]];
  const ndM = norm(add(nd1, nd2));
  const nk = 1 + 0.3 * heavy;
  // (the pieces blend over 7 cm: over a sharper junction the 9 mm coat fanned open along a ragged dark line)
  m.ell({ tag: 'neck', bone: 'neck1', c: add(nb, [0, 0.008, 0.006]), r: [0.072 * nk, 0.1, 0.095], axis: nd1, up: [0, 1, -0.6], k: 0.07 });
  m.ell({ tag: 'neck', bone: 'neck1', c: add(lerp(nb, nm, 0.72), [0, 0, 0.012]), r: [0.052 * nk, 0.075 * (1 + 0.15 * heavy), 0.1], axis: nd1, up: [0, 1, -0.6], k: 0.07 });
  // (a bridge at the mid neck: the neck tapers continuously instead of stepping from one piece to the next)
  m.ell({ tag: 'neck', bone: 'neck2', c: add(nm, [0, 0, 0.018]), r: [0.047 * nk, 0.064 * (1 + 0.15 * heavy), 0.075], axis: ndM, up: [0, 1, -0.6], k: 0.07 });
  m.ell({ tag: 'neck', bone: 'neck2', c: add(lerp(nm, occ, 0.39), [0, 0, 0.028]), r: [0.042 * nk, 0.052 * (1 + 0.15 * heavy), 0.08], axis: nd2, up: [0, 1, -0.6], k: 0.06 });
  // a buck's crest: the thick upper neck behind the axis (a narrow crest stood out as a ridge along the side
  // of a doe's neck, where the coat parted)
  if (heavy > 0.05) m.ell({ tag: 'crest', bone: 'neck1', c: add(lerp(nb, nm, 0.9), mul(backN(nd1), 0.045)), r: [0.05 + 0.02 * heavy, 0.035 + 0.025 * heavy, 0.13], axis: norm(add(nd1, [0, 0.1, 0])), k: 0.07 });
  // underline of the neck (trachea) to the throat
  const thr = add(nm, mul(fwdN(ndM), 0.07));
  m.cone({ tag: 'throat', bone: 'neck1', a: add(add(nb, mul(nd1, -0.02)), mul(fwdN(nd1), 0.07)), b: thr, ra: 0.038, rb: 0.031, k: 0.045 });
  m.cone({ tag: 'throat', bone: 'neck2', a: add(thr, mul(ndM, -0.01)), b: hl([0, -0.105 + (kid ? 0.015 : 0), -0.06]), ra: 0.03, rb: 0.027, k: 0.04 });
  // the throatlatch: the larynx fills the corner between the underside of the jaw and the throat (a sharp
  // notch there folded over as the head moved, back faces showing at the throat outline); not in kids (their
  // throats stretched 3x on 4.2 % of the mesh when grazing)
  if (!kid) m.ell({ tag: 'throat', bone: 'neck2', c: hl([0, -0.13, 0.036]), r: [0.02, 0.015, 0.022], k: 0.03 });
  // wattles (toggles): two hair-covered tassels hanging from the throat, behind and below the jaw angle
  // (at head-local y -0.082 they hung from the cheek beside the eye once the head was carried higher)
  if (params.wattles) {
    for (const s of [1, -1]) {
      const a = hl([0.018 * s, -0.128, -0.068]);
      const b = add(a, [0.006 * s, -0.052, -0.006]);
      m.cone({ tag: 'wattle', bone: 'neck2', part: 'wattle', a, b, ra: 0.0065, rb: 0.0095, k: 0.008 });
    }
  }

  // ---------------------------------------------------------------- HEAD (head-local, see rig.js)
  // A goat's head from the side is a wedge (side2, walk1, face2, face4; skull anatomy): the eye sits high
  // on the side of a deep head, the flat, broad forehead rises above it to the horn bases, the straight
  // nasal line runs steeply down (~60 deg below the horizontal, 20 deg below the eye -> nose line) to a
  // compact nose, and the lower border of the jaw runs straight from the chin back and down to a deep jaw
  // angle behind and 13 cm below the eye (the ramus); the cheek is a flat masseter plate, not a jowl. The
  // lips and chin sit well below the nose. From the front the head is widest at the eyes and tapers to
  // the muzzle (face1, face3).
  // landmarks: poll (0, 0, -0.07), eyes (+-0.057, -0.004, 0), forehead top y 0.052 at z 0.02, nose top
  // (0, -0.004, 0.17), nose tip (0, -0.022, 0.205), mouth line y -0.066, chin bottom (0, -0.097, 0.165),
  // jaw angle (+-0.031, -0.138, -0.045)
  // (kd: a kid's head: a domed braincase, a shallow jaw without the adult's masseter plate)
  const kd = kid ? 1 : 0;
  hell({ tag: 'cranium', c: [0, 0.012 + 0.004 * kd, -0.042], r: [0.055, 0.041 + 0.01 * kd, 0.058], k: 0.03 });
  hell({ tag: 'poll', c: [0, -0.014, -0.068], r: [0.035, 0.037, 0.03], k: 0.03 });
  // the dorsal line: one straight line from the forehead between the horn bases to the nose, 16 deg below
  // the head axis (58 deg below the horizontal in the bind carriage; side2 55, walk1 60): the forehead
  // plate and the nasal bridge are laid along it (a level forehead dropping onto a lower nasal bridge
  // made a dog's stop)
  const NL = [0, -0.29, 1];
  hell({ tag: 'forehead', c: [0, 0.026, 0.012], r: [0.062, 0.018, 0.07], axisL: NL, k: 0.025 });
  // nasal bridge: straight / slightly dished in Swiss breeds, convex (Roman) in Nubians and Boers
  // (the arch: a separate ridge at mid-face, up to 26 mm for roman = 1)
  hell({ tag: 'face', c: [0, -0.004, 0.105], r: [0.029, 0.023, 0.095], axisL: NL, k: 0.025 });
  if (roman > 0.05) hell({ tag: 'face', c: [0, 0.0 + 0.013 * roman, 0.105], r: [0.022 + 0.004 * roman, 0.016 + 0.012 * roman, 0.07], axisL: NL, k: 0.03 });
  // (the muzzle is broad: face1 / face3, the nose nearly as wide as the face at the mouth; at 5 cm across it
  // made a horse's narrow nose)
  hell({ tag: 'lowerface', c: [0, -0.042 + 0.004 * kd, 0.082], r: [0.035, 0.043 - 0.006 * kd, 0.088], k: 0.03 });
  hell({ tag: 'muzzle', c: [0, -0.032, 0.17], r: [0.031 + 0.003 * roman, 0.027, 0.03], k: 0.024 });
  hell({ tag: 'upperlip', c: [0, -0.053, 0.181], r: [0.025, 0.014, 0.021], k: 0.016 });
  for (const s of [1, -1]) {
    // the face below the eye (maxilla, facial crest): broad under the eyes, tapering to the muzzle
    // (face1, face3: the face narrowed straight from the eyes into a horse's nose)
    hell({ tag: 'maxilla', c: [0.026 * s, -0.03, 0.045], r: [0.018, 0.033, 0.065], axisL: [0.18 * s, 0, 1], k: 0.03 });
    // masseter: a flat swell over the ramus, from below the eye down to the jaw angle
    // (its rear edge ended 7 cm behind the eye as a 16 mm step against the jaw angle and throat, blended
    // over only 3 cm: a dark strap from under the eye down to the throat on every adult; face1 / face3 /
    // side2 show a flat cheek running into the throat, the masseter only a gentle swell)
    // (a kid has no plate: its small one ended 6 cm behind the eye in an earlier strap from the eye to the
    // throat, and its outline stood as a knob on the throat behind the jaw; the adults' plate moved forward
    // stretched a kid's throat 3x on 4.15 % of the mesh when grazing, the skin of the lower head riding on
    // the neck. Without it a kid's > 3x is lower, 3.49-3.54 %)
    // ... only a fill inside the jaw's hollow below the eye (between the braincase, the maxilla and the jaw,
    // raised on a kid: without anything there the kid's head had a pit down to the midline behind the eye)
    if (kd) hell({ tag: 'cheek', c: [0.012 * s, -0.055, -0.02], r: [0.02, 0.028, 0.03], k: 0.03 });
    else {
      hell({ tag: 'cheek', c: [0.035 * s, -0.072, 0.0], r: [0.012, 0.056, 0.045], k: 0.05 });
      // behind the ramus (parotid): the side of the head slopes from the cheek into the neck over 9 cm (the
      // back of the jaw fell 3-4 cm in as many, a crease from below the eye down to the throat in every
      // 3/4 view)
      hell({ tag: 'parotid', c: [0.022 * s, -0.072, -0.085], r: [0.024, 0.05, 0.05], k: 0.035 });
    }
    // the lower border of the jaw, from the jaw angle forward (the front of the mandible is the jaw part)
    // (it runs forward over the sides of the chin: the jaw part shows only its lower lip at the front and
    // the chin underneath, so the seam between the two surfaces lies along the mouth line and under the
    // chin, not on the side of the jaw)
    // (a kid's jaw angle 2.2 cm higher, its end 4 mm further in and blended over 3.7 cm: at the side of the
    // throat it poked out as a small bare knob, a white fleck at the jaw angle; lower, the throat stretched)
    m.cone({ ...H, tag: 'mandible', a: hk([0.029 * s - 0.004 * s * kd, -0.124 + 0.022 * kd, -0.045 + 0.01 * kd]), b: hk([0.013 * s, -0.083, 0.17]), ra: 0.014 - 0.002 * kd, rb: 0.0085, k: 0.025 + 0.012 * kd });
    // the cheek between the upper and lower jaws (buccinator), flush from the eye to the mouth corner: the
    // face showed a 5-7 mm groove from below the eye forward to the chin between the maxilla and the
    // mandible, a long crease in every front and 3/4 view
    // (a kid's shallow jaw: the fill stays above its jaw line)
    hell({ tag: 'buccal', c: [0.022 * s, -0.073 + 0.005 * kd, 0.085], r: [0.012, 0.019 - 0.004 * kd, 0.07], axisL: [-0.14 * s, 0.14, 1], k: 0.025 });
    hell({ tag: 'brow', c: [0.048 * s, 0.017, -0.005], r: [0.012, 0.008, 0.016], k: 0.015 });
    hell({ tag: 'nostrilwing', c: [0.02 * s, -0.026, 0.177], r: [0.012, 0.014, 0.014], k: 0.013 });
    sculptEyeSocket(m, EYE, HEAD_O, s, { orbit: { r: [0.016, 0.012, 0.01], at: [0.0, 0.001, 0.017], k: 0.007 } });
    // nostril: a comma-shaped slit on the front of the nose, the lower ends toward the philtrum and the
    // upper ends turned out (face3)
    // (its middle, not its tip, breaks the surface: a slit 2 cm long, not a round hole)
    hell({ tag: 'nostril', c: [0.018 * s, -0.026, 0.199], r: [0.0026, 0.0105, 0.0065], axisL: [-0.4 * s, 0.15, 1], upL: [0.5 * s, 1, 0], k: 0.0025, carve: true });
  }
  // the soft floor between the two mandibles (a midline notch under the jaw between the mandible cones)
  hell({ tag: 'intermandible', c: [0, -0.094 + 0.008 * kd, 0.068 + 0.012 * kd], r: [0.018, 0.012 - 0.003 * kd, 0.062 - 0.012 * kd], axisL: [0, 0.18, 1], k: 0.02 });
  // (no philtrum groove: at mesh resolution its notch at the lip margin showed the lower lip behind it as a
  // white fang)

  // ---------------------------------------------------------------- JAW (lower lip, chin, beard)
  const JW = { bone: 'jaw', group: 'jaw', part: 'jaw' };
  // a small lower lip tucked under the upper lip, and a rounded chin below it (walk1, face2)
  // (the lower lip reaches 6 mm up inside the upper lip, so the mouth stays shut while the jaw grinds)
  m.ell({ ...JW, tag: 'chin', c: hk([0, -0.086, 0.168]), r: [0.017, 0.013, 0.02], axis: HZ, up: HY, k: 0 });
  m.ell({ ...JW, tag: 'lowerlip', c: hk([0, -0.071, 0.182]), r: [0.02, 0.0105, 0.015], axis: HZ, up: HY, k: 0.012 });
  // (the front of the mandible, inside the head's jaw: it carries the chin when the mouth opens; its
  // ends reached out between the lips as two white incisors)
  for (const s of [1, -1]) m.cone({ ...JW, tag: 'mandible', a: hk([0.009 * s, -0.085, 0.115]), b: hk([0.008 * s, -0.084, 0.152]), ra: 0.006, rb: 0.0065, k: 0.015 });
  const beard = params.beard || 0; // length (m)
  if (beard > 0.01) {
    // hangs from under the chin in three loose locks (face2, face4: a beard of separate locks, the middle one longest),
    // each a thin round core with long hair: one 3 cm wide core read as a flat, smooth ribbon inside the hair
    const a = hk([0, -0.094, 0.12]);
    const down = norm([0, -1, -0.05]);
    const nB = 4;
    // (each lock a chain of round cones: ellipsoid segments ended in points thinner than a medium-tier cell, whose
    // tips folded over)
    for (const j of [-1, 0, 1]) {
      const L = beard * (j === 0 ? 1 : 0.78);
      const at = (t) => add(add(a, mul(down, L * t)), [j * (0.006 + 0.008 * t), 0, -0.024 * t - 0.004 * Math.abs(j)]);
      const rad = (t) => (0.0045 + 0.0015 * Math.min(1, beard / 0.15)) * (1 - 0.5 * t);
      for (let i = 0; i < nB; i++) {
        const t0 = i / nB, t1 = (i + 1) / nB;
        m.cone({ ...JW, bone: 'beard', part: 'beard', tag: 'beard', thin: true, a: at(t0), b: at(t1), ra: rad(t0), rb: rad(t1), k: 0.008 });
      }
    }
    // the root of the beard under the chin (a 9 cm lock along the underside of the jaw hung below the
    // mandibles as a pale strap)
    m.ell({ ...JW, tag: 'beard', c: hk([0, -0.093, 0.13]), r: [0.019, 0.013, 0.026 * (kid ? KID_FACE : 1)], axis: HZ, up: HY, k: 0.016 });
  }

  // ---------------------------------------------------------------- EARS
  const lop = params.ear === 'lop';
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const base = J['earBase' + S], tip = J['earTip' + S];
    const up = norm(sub(tip, base));
    const len = Math.hypot(...sub(tip, base));
    // the cup opens forward and down (erect), inward toward the face (lop)
    // (erect: the broad inner side faces forward, a little out and down, as in face1 / face3 / front1;
    // it faced straight down, so the ears showed their edge from the front)
    const facing = earFacing(params, s);
    const lat = norm(cross(up, facing));
    const fc = norm(cross(lat, up));
    const ear = { bone: 'ear' + S, group: 'ear' + S, thin: true };
    // a leaf: a rolled, narrow base, the blade widest at ~40 % of the length, a pointed tip (Swiss:
    // ~6 cm wide on 14-16 cm, face1 / face3 / front2); the lop ear a broad drape with a rounded tip
    // (it was an 8.4 cm wide disc: mouse ears)
    // (a kid's lop ear: its thickness, root roll and rim scaled with the ear's length, x0.82, and a little
    // narrower: at the adult's 7.5 mm blades and 5 cm width the blades and the rolled root read through the
    // outer face of the short ear as lumps and a raised pad, round the kid's face like a bonnet)
    const ek = lop && kid ? 0.82 : 1;
    const wd = lop ? 0.05 * (kid ? 0.88 : 1) : 0.029;
    if (lop) {
      // Nubian / Boer: a long, broad, pendulous ear (the Nubian standard: close to the head at the temple,
      // flaring out and forward to the rounded tip, a bell round the face; side_boer). It was one flat oval
      // blade pasted on the cheek: short, no roll at the root, no rim.
      const out = [s, 0, 0];
      const fwd = lat[2] >= 0 ? lat : mul(lat, -1); // the blade's front edge direction
      const fwdF = norm(add(fwd, mul(out, 0.5))); // ... turned out in the lower, flaring half
      // the root: rolled and narrow, leaving the skull sideways before it drops
      // (a 36 mm thick end on the 15 mm blade stood out as a lump with a shadowed step below it)
      m.cone({ ...ear, tag: 'ear', a: add(base, mul(up, 0.004)), b: add(lerp(base, tip, 0.28), mul(out, 0.003 * ek)), ra: 0.0115 * ek, rb: 0.0062 * ek, k: 0.018 * ek });
      // the upper blade, along the side of the head behind the eye
      // (the blades follow the ear bone, which already hangs out 24 deg: set further out on their own they
      // stepped out one after the other, an oval lump on the outside of the ear)
      ellY({ ...ear, tag: 'ear', c: add(lerp(base, tip, 0.44), mul(fwd, 0.002)), ydir: up, lateral: fwd, r: [wd * 0.84, len * 0.32, 0.0075 * ek], k: 0.016 });
      // the lower blade and the rounded tip, turned a little out
      ellY({ ...ear, tag: 'ear', c: add(lerp(base, tip, 0.69), mul(out, 0.0015 * ek)), ydir: up, lateral: fwdF, r: [wd, len * 0.28, 0.0072 * ek], k: 0.018 });
      ellY({ ...ear, tag: 'eartip', c: add(lerp(base, tip, 0.86), mul(out, 0.002 * ek)), ydir: up, lateral: fwdF, r: [wd * 0.8, len * 0.15, 0.0065 * ek], k: 0.016 });
      // the front edge rolled out into a thick rim
      m.cone({ ...ear, tag: 'ear', a: add(lerp(base, tip, 0.14), mul(fwd, wd * 0.4)), b: add(lerp(base, tip, 0.64), add(mul(fwdF, wd * 0.86), mul(out, 0.003 * ek))), ra: 0.003 * ek, rb: 0.0055 * ek, k: 0.01 * ek });
      // the cup: the inner face hollowed down the middle of the blade (short of the root: medium-tier hole)
      // (a kid's cup as deep as an adult's: the coarse tiers inflate thin blades to 1 cm, not carvers, and a cup
      // scaled with the kid's blade only grazed the inflated face there, a ragged speckle over the inner face)
      ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.55), mul(fc, 0.0068)), ydir: up, lateral: fwd, r: [wd * 0.6, len * 0.28, 0.0052], k: 0.004, carve: true });
    } else {
      // (the rolled base no thicker than the blade where it ends: a 32 mm round end on the 17 mm blade folded
      // the skin over at the medium tier, back faces showing through the ear)
      m.cone({ ...ear, tag: 'ear', a: add(base, mul(up, 0.004)), b: lerp(base, tip, 0.27), ra: 0.011, rb: 0.0105, k: 0.014 });
      ellY({ ...ear, tag: 'ear', c: lerp(base, tip, 0.44), ydir: up, lateral: lat, r: [wd, len * 0.42, 0.0085], k: 0.014 });
      ellY({ ...ear, tag: 'eartip', c: lerp(base, tip, 0.78), ydir: up, lateral: lat, r: [wd * 0.5, len * 0.24, 0.0065], k: 0.012 });
      // (the cup stops short of the narrow root: reaching it, it broke through the ear's floor at the medium
      // tier, a ragged hole beside the root; it leaves a 12.5 mm floor at hero and 14 mm at medium: 9.5-12 mm,
      // about two medium cells, still showed pinholes through the ear)
      // (its root end soft, k 8 mm, and 1 cm further from the root: with a 4 mm blend the end of the carve was a
      // corner the medium tier's 5.6 mm cells folded into a white notch)
      ellY({ ...ear, tag: 'earinner', c: add(lerp(base, tip, 0.6), mul(fc, 0.0085)), ydir: up, lateral: lat, r: [wd * 0.66, len * 0.28, 0.0045], k: 0.008, carve: true });
    }
    m.sphere({ ...H, tag: 'earbase', c: add(base, mul(up, -0.006)), rad: 0.016, k: 0.02 });
  }

  // ---------------------------------------------------------------- HORNS (own rigid surface)
  for (const s of [1, -1]) {
    const pth = hornPath(params, s);
    const J = hornSplit(params, pth);
    for (let i = 0; i + 1 < pth.length; i++) {
      if (J < 0 || i < J) m.cone({ bone: 'head', part: 'horn', group: 'axial', tag: 'horn', a: pth[i].p, b: pth[i + 1].p, ra: pth[i].r, rb: pth[i + 1].r, k: 0.004 });
      if (J >= 0 && i >= J - 2) m.cone({ bone: 'head', part: 'horntip', group: 'axial', tag: 'horn', a: pth[i].p, b: pth[i + 1].p, ra: pth[i].r * (i <= J ? 0.96 : 1), rb: pth[i + 1].r * (i + 1 <= J ? 0.96 : 1), k: 0.004 });
    }
    // a horn is flattened sideways at its base (a keel along the front)
    if (pth.length) {
      // (over the first ~2.5 cm of the horn)
      let j = 1;
      while (j + 1 < pth.length && Math.hypot(...sub(pth[j].p, pth[0].p)) < 0.025) j++;
      m.ell({ bone: 'head', part: 'horn', group: 'axial', tag: 'horn', c: lerp(pth[0].p, pth[j].p, 0.5), r: [pth[0].r * 0.75, pth[0].r * 1.15, Math.hypot(...sub(pth[j].p, pth[0].p)) * 0.8], axis: norm(sub(pth[j].p, pth[0].p)), up: HZ, k: 0.004 });
    }
    // growth ridges: a raised collar every S along the base half, rising over a third of the spacing to its crest and
    // falling back to the horn over the rest toward the tip (two round cones about the crest), lower toward tEnd
    const RG = hornRidges(params);
    if (pth.length && RG && RG.geo > 0.01) {
      const L = params.horns.len, n = pth.length - 1;
      const at = (sArc) => {
        const u = clamp(sArc / L, 0, 1) * n, i = Math.min(n - 1, Math.floor(u)), f = u - i;
        return { p: lerp(pth[i].p, pth[i + 1].p, f), r: pth[i].r + (pth[i + 1].r - pth[i].r) * f, t: u / n };
      };
      for (let sA = RG.s0; sA < RG.tEnd * L; sA += RG.S) {
        const c = at(sA), a = at(sA - 0.35 * RG.S), b = at(sA + 0.6 * RG.S);
        const h = RG.amp * RG.geo * (1 - smoothstep(0.55 * RG.tEnd, RG.tEnd, c.t));
        if (h < 0.01) continue;
        const R = { bone: 'head', part: 'horn', group: 'axial', tag: 'horn', k: 0.0015 };
        m.cone({ ...R, a: a.p, b: c.p, ra: a.r * (1 + 0.15 * h), rb: c.r * (1 + h) });
        m.cone({ ...R, a: c.p, b: b.p, ra: c.r * (1 + h), rb: b.r * (1 + 0.1 * h) });
      }
    }
    // horn base boss on the skull (also the polled goat's small knobs)
    if (params.horns && params.horns.len > 0) m.sphere({ ...H, tag: 'hornboss', c: hl([0.021 * s, 0.03, -0.05]), rad: Math.min(0.016, params.horns.base * 0.9), k: 0.015 });
  }

  // ---------------------------------------------------------------- MANE (bucks: long hair along the crest and back)
  if (buck && (params.mane || 0) > 0.05) {
    const mn = params.mane;
    // the crest line: the skin of the neck behind its axis (marched out from the axis), then the back
    const body = m.prims.filter((q) => (q.part || 'body') === 'body' && !q.carve);
    const skin = (p, d) => { let t = 0; while (t < 0.25 && SDFModel.evalList(body, p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t) < 0) t += 0.002; return add(p, mul(d, t - 0.012)); };
    const line = [
      skin(lerp(nm, occ, 0.75), backN(nd2)), skin(lerp(nm, occ, 0.35), backN(nd2)), skin(lerp(nb, nm, 0.85), backN(nd1)),
      skin(lerp(nb, nm, 0.4), backN(nd1)), [0, 0.765, 0.2], [0, 0.745, 0.08],
    ];
    const bones = ['neck2', 'neck2', 'neck1', 'neck1', 'spine3', 'spine3'];
    for (let i = 0; i < line.length; i++) {
      m.ell({ tag: 'mane', bone: bones[i], c: line[i], r: [0.028 * mn + 0.01, 0.022 * mn + 0.006, 0.055], axis: i + 1 < line.length ? norm(sub(line[i], line[i + 1])) : [0, 0, 1], k: 0.03 });
    }
  }

  // ---------------------------------------------------------------- LEGS (slender, long cannons)
  const lk = 1 + 0.12 * heavy;
  for (const S of ['L', 'R']) {
    const s = S === 'L' ? 1 : -1;
    const lat = [s, 0, 0];
    const sx = (v) => [v[0] * s, v[1], v[2]];
    const g = 'F' + S;
    const Sc = J['scapTop' + S], Sh = J['shoulder' + S], E = J['elbow' + S], W = J['wrist' + S], M = J['mcp' + S], C = J['fcoffin' + S], T = J['ftoe' + S];
    ellY({ tag: 'scapmuscle', bone: 'scapula' + S, group: g, c: add(lerp(Sc, Sh, 0.45), sx([0.03, 0, -0.01])), ydir: sub(Sh, Sc), lateral: lat, r: [0.022 * lk, 0.1, 0.062], k: 0.06 });
    // (the point of the shoulder only a gentle angle: no ball on the humerus head, and the upper arm's cone
    // starts a quarter of the way down: seen end-on from the front, a cone from the joint drew a round disc)
    m.cone({ tag: 'upperarm', bone: 'humerus' + S, group: g, a: lerp(Sh, E, 0.25), b: E, ra: 0.036 * lk, rb: 0.032 * lk, k: 0.04 });
    ellY({ tag: 'triceps', bone: 'humerus' + S, group: g, c: add(lerp(Sh, E, 0.55), sx([0.005, 0.01, -0.045])), ydir: sub(E, Sh), lateral: lat, r: [0.03 * lk, 0.07, 0.048], k: 0.05 });
    m.sphere({ tag: 'olecranon', bone: 'radius' + S, group: g, c: add(E, [0, 0.012, -0.034]), rad: 0.024, k: 0.025 });
    m.cone({ tag: 'forearm', bone: 'radius' + S, group: g, a: add(E, [0, 0, -0.005]), b: W, ra: 0.034 * lk, rb: 0.019, k: 0.025 });
    ellY({ tag: 'forearmmuscle', bone: 'radius' + S, group: g, c: add(lerp(E, W, 0.25), sx([0.004, 0, 0.006])), ydir: sub(W, E), lateral: lat, r: [0.032 * lk, 0.075, 0.035 * lk], k: 0.025 });
    m.cone({ tag: 'forearmweb', bone: 'radius' + S, group: g, a: add(E, sx([-0.02, 0.03, -0.01])), b: add(lerp(E, W, 0.3), sx([-0.01, 0, 0])), ra: 0.028, rb: 0.02, k: 0.03 });
    // knee (carpus, with its callus in front)
    ellY({ tag: 'knee', bone: 'metacarpus' + S, group: g, c: add(W, [0, 0.0, 0.002]), ydir: [0, 1, 0], lateral: lat, r: [0.021, 0.026, 0.021], k: 0.012 });
    m.cone({ tag: 'cannon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.01, 0.0]), b: add(M, [0, 0.01, 0.0]), ra: 0.0145, rb: 0.0135, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metacarpus' + S, group: g, a: add(W, [0, -0.015, -0.012]), b: add(M, [0, 0.015, -0.013]), ra: 0.009, rb: 0.011, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metacarpus' + S, group: g, c: add(M, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.019, 0.02, 0.021], k: 0.01 });
    sculptDewclaws(m, 'fpaw' + S, g, M, s);
    m.cone({ tag: 'pastern', bone: 'fpaw' + S, group: g, a: M, b: C, ra: 0.0155, rb: 0.0165, k: 0.01 });
    sculptHoof(m, 'fhoof' + S, g, C, T, 1.0, s);

    const h = 'H' + S;
    const Hp = J['hip' + S], K = J['knee' + S], Hk = J['hock' + S], Mt = J['mtp' + S], Ch = J['hcoffin' + S], Tt = J['htoe' + S];
    ellY({ tag: 'thigh', bone: 'femur' + S, group: h, c: add(lerp(Hp, K, 0.42), sx([0.02, 0, -0.025])), ydir: sub(K, Hp), lateral: lat, r: [0.032 * lk, 0.13, 0.095], k: 0.06 });
    m.cone({ tag: 'thighfront', bone: 'femur' + S, group: h, a: sx([0.075, 0.66, -0.3 + HQ]), b: add(K, sx([0.0, 0.03, 0.02])), ra: 0.048, rb: 0.03, k: 0.05 });
    m.cone({ tag: 'hamstring', bone: 'femur' + S, group: h, a: sx([0.045, 0.64, -0.345]), b: add(lerp(K, Hk, 0.3), [0, 0, -0.04]), ra: 0.045, rb: 0.026, k: 0.04 });
    ellY({ tag: 'flankfold', bone: 'femur' + S, group: h, c: sx([0.09, 0.47, -0.2 + HQ]), ydir: [-0.1, 0.3, 0.12], lateral: lat, r: [0.024, 0.07, 0.038], k: 0.05 });
    m.sphere({ tag: 'stifle', bone: 'tibia' + S, group: h, c: add(K, sx([0.004, 0.005, 0.014])), rad: 0.027, k: 0.035 });
    // (a broad gaskin, side2: the lower thigh read thin next to the barrel)
    ellY({ tag: 'gaskin', bone: 'tibia' + S, group: h, c: add(lerp(K, Hk, 0.3), sx([0.004, 0, -0.024])), ydir: sub(Hk, K), lateral: lat, r: [0.037 * lk, 0.085, 0.048], k: 0.03 });
    m.cone({ tag: 'shin', bone: 'tibia' + S, group: h, a: lerp(K, Hk, 0.1), b: Hk, ra: 0.026, rb: 0.018, k: 0.025 });
    m.cone({ tag: 'achilles', bone: 'tibia' + S, group: h, a: add(lerp(K, Hk, 0.45), [0, 0, -0.035]), b: add(Hk, [0, 0.03, -0.03]), ra: 0.012, rb: 0.01, k: 0.015 });
    m.sphere({ tag: 'calcaneus', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.028, -0.028]), rad: 0.014, k: 0.012 });
    ellY({ tag: 'hock', bone: 'metatarsus' + S, group: h, c: add(Hk, [0, 0.004, -0.002]), ydir: [0, 1, 0.25], lateral: lat, r: [0.02, 0.03, 0.022], k: 0.015 });
    m.cone({ tag: 'cannon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.016, 0.002]), b: add(Mt, [0, 0.01, 0.0]), ra: 0.015, rb: 0.0135, k: 0.01 });
    m.cone({ tag: 'tendon', bone: 'metatarsus' + S, group: h, a: add(Hk, [0, -0.016, -0.013]), b: add(Mt, [0, 0.015, -0.013]), ra: 0.009, rb: 0.011, k: 0.01 });
    ellY({ tag: 'fetlock', bone: 'metatarsus' + S, group: h, c: add(Mt, [0, 0.0, -0.004]), ydir: [0, 1, 0.3], lateral: lat, r: [0.019, 0.02, 0.021], k: 0.01 });
    sculptDewclaws(m, 'hpaw' + S, h, Mt, s);
    m.cone({ tag: 'pastern', bone: 'hpaw' + S, group: h, a: Mt, b: Ch, ra: 0.015, rb: 0.016, k: 0.01 });
    sculptHoof(m, 'hhoof' + S, h, Ch, Tt, 0.95, s);
  }

  // ---------------------------------------------------------------- TAIL: short, flat, triangular, carried up
  // a thin tail with a flat brush of hair that widens to the tip (side2, walk1)
  // (the hair pieces overlap along the tail and blend over 2 cm: five short separate ones left knobs between
  // them, a caterpillar)
  for (let i = 0; i < TAIL_SEGS; i++) {
    const t0 = i / TAIL_SEGS, t1 = (i + 1) / TAIL_SEGS;
    const a = J['tail' + i], b = J['tail' + (i + 1)];
    const w0 = 0.024 - 0.016 * t0, w1 = 0.024 - 0.016 * t1;
    m.cone({ tag: i === 0 ? 'tailhead' : 'tail', bone: 'tail' + i, a, b, ra: w0 * 0.72, rb: w1 * 0.72, k: i === 0 ? 0.03 : 0.012 });
    const d = norm(sub(b, a)), tm = (t0 + t1) * 0.5, L = Math.hypot(...sub(b, a));
    m.ell({ tag: 'tailhair', bone: 'tail' + i, c: lerp(a, b, 0.55), r: [0.015 + 0.01 * tm, 0.0095 + 0.002 * tm, L * 0.95], axis: d, up: norm(cross(d, X)), k: 0.02 });
  }
  void kid;
  return m;
}

// Dewclaws: two small horny knobs behind the fetlock
function sculptDewclaws(m, bone, group, M, s) {
  for (const k of [1, -1]) m.sphere({ tag: 'dewclaw', bone, group, c: add(M, [0.009 * k * s, -0.006, -0.021]), rad: 0.0055, k: 0.004 });
}

// Cloven hoof: two claws (digits III and IV) with a cleft between them, the front wall parallel to
// the pastern, heel bulbs behind, flat on the ground.
function sculptHoof(m, bone, group, C, T, w, s) {
  const zc = (C[2] + T[2]) * 0.5;
  for (const k of [1, -1]) {
    const x = C[0] + 0.0105 * k * w;
    const top = [x, C[1] + 0.008, C[2] - 0.004];
    const toe = [x - 0.002 * k, 0.006, T[2] - 0.004];
    const heel = [x, 0.008, C[2] - 0.016];
    m.cone({ tag: 'hoof', bone, group, a: top, b: toe, ra: 0.0115 * w, rb: 0.0055 * w, k: 0.006 });
    m.cone({ tag: 'hoof', bone, group, a: heel, b: [toe[0], 0.006, zc + 0.004], ra: 0.011 * w, rb: 0.009 * w, k: 0.008 });
    m.sphere({ tag: 'heelbulb', bone, group, c: [x, 0.013, C[2] - 0.02], rad: 0.0105 * w, k: 0.008 });
  }
  m.cone({ tag: 'coronet', bone, group, a: add(C, [0, 0.012, -0.01]), b: add(C, [0, 0.006, 0.008]), ra: 0.017 * w, rb: 0.017 * w, k: 0.008 });
  // the cleft between the claws, open at the toe
  m.ell({ tag: 'cleft', bone, group, c: [C[0], 0.006, zc + 0.012], r: [0.0022, 0.02, 0.03], k: 0.002, carve: true });
  // flat sole
  m.ell({ tag: 'sole', bone, group, c: [C[0], -0.1 + 0.001, zc], r: [0.1, 0.1, 0.1], k: 0.002, carve: true });
  void s;
}
