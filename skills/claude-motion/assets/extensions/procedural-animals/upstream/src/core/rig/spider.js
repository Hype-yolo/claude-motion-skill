// Standard spider skeleton (the names the spider motion engine expects) and helpers to build it.
//
// Axial (nose -> tail): front (clypeus) - ceph (cephalic / thoracic boundary) - pedA (rear of the
//   carapace, pedicel start) - pedB (pedicel end, abdomen front) - abdEnd (above the spinnerets) -
//   spinTip. Bones: head (ceph -> front, rigid on the prosoma, carries the eyes), prosoma (root,
//   pedA -> ceph), pedicel, abdomen, spinnerets.
// Chelicerae: cheBase{S} -> cheTip{S} (bone chelicera{S}), fang cheTip{S} -> fangTip{S} (fang{S}).
// Legs i = 1..4 (I front .. IV hind), 7 segments each: coxa, troch, femur, patella, tibia, meta,
//   tarsus. The joint named after a segment is where that segment starts; `claw{i}{S}` is the tip.
//   Bones carry the same names as their start joint (coxa1L = coxa1L -> troch1L ...); groups 'L1' ..
//   'R4' (the metrics and state.legs keys); the tarsus is the 'foot' region.
// Pedipalps: palpCoxa, palpTroch, palpFemur, palpPatella, palpTibia, palpTarsus (+ palpTip), group
//   'P{S}', no foot region (palps are not walking legs).
import { add, mul } from '../math/vec.js';

export const LEG_SEGS = ['coxa', 'troch', 'femur', 'patella', 'tibia', 'meta', 'tarsus'];
export const PALP_SEGS = ['palpCoxa', 'palpTroch', 'palpFemur', 'palpPatella', 'palpTibia', 'palpTarsus'];
export const LEG_KEYS = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
export const AXIAL_POINTS = ['front', 'ceph', 'pedA', 'pedB', 'abdEnd', 'spinTip'];
export const AXIAL_BONES = ['head', 'prosoma', 'pedicel', 'abdomen', 'spinnerets'];

/** joint names of leg i (1..4) on side S ('L' | 'R'), base -> claw tip */
export const legJoints = (i, S) => [...LEG_SEGS.map((g) => g + i + S), 'claw' + i + S];
export const legBones = (i, S) => LEG_SEGS.map((g) => g + i + S);
export const palpJoints = (S) => [...PALP_SEGS.map((g) => g + S), 'palpTip' + S];
export const palpBones = (S) => PALP_SEGS.map((g) => g + S);

// Direction of a segment in a vertical leg plane: azimuth phi from forward (+Z) toward the leg's
// side (side = +1 left, -1 right), elevation e above horizontal.
export function planeDir(phi, e, side) {
  const c = Math.cos(e);
  return [Math.sin(phi) * c * side, Math.sin(e), Math.cos(phi) * c];
}

/**
 * Writes a planar chain into J: joints names[0..n] starting at base, segment k along azimuth
 * az[k] (or one number) and elevation el[k] (radians), length lens[k].
 */
export function planarChain(J, names, base, az, el, lens, side) {
  let p = base.slice();
  J[names[0]] = p.slice();
  for (let k = 0; k < lens.length; k++) {
    const a = Array.isArray(az) ? az[k] : az;
    p = add(p, mul(planeDir(a, el[k], side), lens[k]));
    J[names[k + 1]] = p;
  }
  return J;
}

/**
 * Bind-pose leg: finds the elevation of segment `free` so that the claw tip ends at height yTip.
 * Returns the elevations used (radians). If the target cannot be met the free segment is clamped
 * to straight down / up.
 */
export function solveBindElevations(yBase, lens, el, free, yTip) {
  let drop = 0;
  for (let k = 0; k < lens.length; k++) if (k !== free) drop += lens[k] * Math.sin(el[k]);
  const s = (yTip - yBase - drop) / lens[free];
  const out = el.slice();
  out[free] = Math.asin(Math.max(-1, Math.min(1, s)));
  return out;
}

export function spiderBones({ chelicerae = true, palps = true, spinnerets = true, extra = [] } = {}) {
  const b = [
    ['prosoma', 'pedA', 'ceph', null, { region: 'torso' }],
    ['head', 'ceph', 'front', 'prosoma', { region: 'head' }],
    ['pedicel', 'pedA', 'pedB', 'prosoma', { region: 'torso' }],
    ['abdomen', 'pedB', 'abdEnd', 'pedicel', { region: 'torso' }],
  ];
  if (spinnerets) b.push(['spinnerets', 'abdEnd', 'spinTip', 'abdomen', { region: 'tail' }]);
  if (chelicerae) {
    b.push(['chelicera{S}', 'cheBase{S}', 'cheTip{S}', 'head', { region: 'jaw', group: 'chel{S}' }]);
    b.push(['fang{S}', 'cheTip{S}', 'fangTip{S}', 'chelicera{S}', { region: 'jaw', group: 'fang{S}' }]);
  }
  if (palps) {
    const pj = palpJoints('{S}'), pb = palpBones('{S}');
    pb.forEach((name, k) => b.push([name, pj[k], pj[k + 1], k === 0 ? 'prosoma' : pb[k - 1], { region: 'limb', group: 'P{S}' }]));
  }
  for (let i = 1; i <= 4; i++) {
    const lj = legJoints(i, '{S}'), lb = legBones(i, '{S}');
    lb.forEach((name, k) => b.push([name, lj[k], lj[k + 1], k === 0 ? 'prosoma' : lb[k - 1], { region: k === 6 ? 'foot' : 'limb', group: '{S}' + i }]));
  }
  return b.concat(extra);
}

// Limb descriptions for the harmonic limb weights (see core/build/weights.js). The limb core starts
// part way along the coxa (tCore of the way from the coxa base to the femur base), so the coxa's
// arthrodial membrane blends into the prosoma.
export function spiderLimbs({ leg = {}, palp = {} } = {}) {
  const L = {};
  for (const S of ['L', 'R']) {
    const side = S === 'L' ? 1 : -1;
    for (let i = 1; i <= 4; i++) {
      const bones = legBones(i, S);
      L[S + i] = {
        side, S, front: i <= 2, leg: i,
        bones, proximal: [bones[0]], distal: bones.slice(5),
        field: { a: 'coxa' + i + S, b: 'femur' + i + S, top: bones[0], tCore: 0.45, aCore: 0.03, aBody: -0.05, midX: 0.0, ...leg },
      };
    }
    const pb = palpBones(S);
    L['P' + S] = {
      side, S, front: true, palp: true,
      bones: pb, proximal: [pb[0]], distal: pb.slice(4),
      field: { a: 'palpCoxa' + S, b: 'palpFemur' + S, top: pb[0], tCore: 0.4, aCore: 0.03, aBody: -0.05, midX: 0.0, ...palp },
    };
  }
  return L;
}
